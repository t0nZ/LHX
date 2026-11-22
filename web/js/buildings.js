// ============================================
// BUILDINGS.JS — Real OSM buildings, chunk-merged & destructible
// --------------------------------------------
// Every OpenStreetMap footprint in the baked area is extruded to its real
// (or estimated) height. To stay fast on Intel iGPUs all buildings of a
// 512 m chunk are merged into ONE BufferGeometry (one draw call per chunk).
// Each building remembers its vertex range inside the chunk so it can still
// flash on hit and collapse individually (vertex edits + partial GPU upload).
//
// Building record (compatible with the old module, used by hud/missions/weapons):
//   { position, width, depth, height, health, maxHealth, destroyed, name, flashTimer, ... }
// ============================================
import * as THREE from 'three';

const CHUNK = 512;
const WALLS = {
    house: [0xe6d3a8, 0xd9b77e, 0xe2c393, 0xcfa070, 0xe8dcc4, 0xc98f5e, 0xd8c7a0],
    industrial: [0xb0aea6, 0x9fa3a0, 0xc2bfb4, 0x8f948f],
    brick: [0xa8583a, 0x9a4e34, 0xb06244],
    farm: [0xb87a52, 0xc9a274, 0xa86a48, 0xd8c09a],
};
const ROOFS = { tile: [0xa84a32, 0x9a4430, 0xb85a3a, 0x8f3e2c], flat: [0x7c7a76, 0x8a8782, 0x6e6c68] };
const INDUSTRIAL = new Set(['industrial', 'warehouse', 'commercial', 'retail', 'service', 'hangar', 'manufacture', 'greenhouse', 'roof', 'office', 'supermarket']);
const BRICK = new Set(['church', 'chapel', 'cathedral', 'bell_tower', 'tower', 'castle', 'civic', 'public', 'townhall', 'ruins']);
const FARM = new Set(['barn', 'farm_auxiliary', 'farm', 'cowshed', 'stable', 'sty', 'shed', 'hut']);
const RUBBLE = new THREE.Color(0x6a655c);

let chunks = new Map();          // key -> { mesh, geo, pos, col }
let grid = new Map();            // 32 m spatial hash -> [building]
let collapsing = [];
let flashing = new Set();

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0) / 4294967296); }
function pick(arr, r) { return arr[(r() * arr.length) | 0]; }

export function initBuildings(gameState) {
    gameState.buildings = [];
    chunks = new Map(); grid = new Map(); collapsing = []; flashing = new Set();
    const world = gameState.world;
    const src = world.osm.buildings;
    const half = world.size / 2;
    const builders = new Map();  // chunk key -> { pos: [], col: [] }
    const tmp = new THREE.Color();

    src.forEach((b, idx) => {
        const p = b.p;
        if (p.length < 6) return;
        // footprint stats
        let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, area = 0, cx = 0, cz = 0, ground = 1e9;
        const n = p.length / 2;
        for (let i = 0; i < n; i++) {
            const x = p[i * 2], z = p[i * 2 + 1];
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
            const j = (i + 1) % n;
            area += x * p[j * 2 + 1] - p[j * 2] * z;
            cx += x; cz += z;
            ground = Math.min(ground, world.getHeight(x, z));
        }
        cx /= n; cz /= n;
        if (Math.abs(cx) > half || Math.abs(cz) > half) return;
        const ccw = area > 0;                     // orientation in x/z plane
        area = Math.abs(area) / 2;
        if (area < 6) return;

        const r = rng(idx * 7919 + 13);
        const t = b.t || 'yes';
        const wall = INDUSTRIAL.has(t) ? pick(WALLS.industrial, r) : BRICK.has(t) ? pick(WALLS.brick, r) : FARM.has(t) ? pick(WALLS.farm, r) : pick(WALLS.house, r);
        const flatRoof = INDUSTRIAL.has(t) || area > 600 || n > 12;
        const roof = flatRoof ? pick(ROOFS.flat, r) : pick(ROOFS.tile, r);
        const h = b.h;
        const roofH = flatRoof ? 0 : Math.min(3.5, Math.sqrt(area) * 0.22);
        const top = ground + h;

        const key = Math.floor((cx + half) / CHUNK) + ',' + Math.floor((cz + half) / CHUNK);
        if (!builders.has(key)) builders.set(key, { pos: [], col: [] });
        const B = builders.get(key);
        const start = B.pos.length / 3;
        const push = (x, y, z, c) => { B.pos.push(x, y, z); B.col.push(c.r, c.g, c.b); };

        // Walls (one quad per edge, outward facing). Slight shade per wall = cheap fake lighting variety.
        for (let i = 0; i < n; i++) {
            let a = i, c = (i + 1) % n;
            if (!ccw) [a, c] = [c, a];
            const ax = p[a * 2], az = p[a * 2 + 1], bx = p[c * 2], bz = p[c * 2 + 1];
            tmp.setHex(wall).multiplyScalar(0.92 + r() * 0.12);
            push(ax, ground, az, tmp); push(bx, top, bz, tmp); push(bx, ground, bz, tmp);
            push(ax, ground, az, tmp); push(ax, top, az, tmp); push(bx, top, bz, tmp);
        }
        // Roof
        tmp.setHex(roof);
        if (!flatRoof) {
            // hip/pyramid roof: fan from each eave edge to a raised centroid
            for (let i = 0; i < n; i++) {
                let a = i, c = (i + 1) % n;
                if (!ccw) [a, c] = [c, a];
                push(p[a * 2], top, p[a * 2 + 1], tmp);
                push(cx, top + roofH, cz, tmp);
                push(p[c * 2], top, p[c * 2 + 1], tmp);
            }
        } else {
            const contour = [];
            for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
            const tris = THREE.ShapeUtils.triangulateShape(contour, []);
            for (const [i0, i1, i2] of tris) {
                // ensure upward normal: (v1-v0) x (v2-v0) must have +y
                const ux = p[i1 * 2] - p[i0 * 2], uz = p[i1 * 2 + 1] - p[i0 * 2 + 1];
                const vx = p[i2 * 2] - p[i0 * 2], vz = p[i2 * 2 + 1] - p[i0 * 2 + 1];
                const up = (uz * vx - ux * vz) > 0;
                const order = up ? [i0, i1, i2] : [i0, i2, i1];
                for (const k of order) push(p[k * 2], top, p[k * 2 + 1], tmp);
            }
        }

        const rec = {
            chunkKey: key, start, count: B.pos.length / 3 - start,
            poly: p, ground,
            position: new THREE.Vector3(cx, ground, cz),
            width: maxX - minX, depth: maxZ - minZ, height: h + roofH,
            minX, maxX, minZ, maxZ,
            health: Math.min(400, 40 + area * 0.35), maxHealth: Math.min(400, 40 + area * 0.35),
            destroyed: false, flashTimer: 0, savedColors: null,
            name: b.n || ({ church: 'Chiesa', bell_tower: 'Campanile', school: 'Scuola', industrial: 'Capannone', barn: 'Fienile', farm_auxiliary: 'Casolare', apartments: 'Condominio', house: 'Casa' }[t] || 'Edificio'),
            type: t,
        };
        gameState.buildings.push(rec);
        // spatial hash (32 m)
        for (let gx = Math.floor(minX / 32); gx <= Math.floor(maxX / 32); gx++)
            for (let gz = Math.floor(minZ / 32); gz <= Math.floor(maxZ / 32); gz++) {
                const k = gx + ',' + gz;
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(rec);
            }
    });

    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const [key, B] of builders) {
        const geo = new THREE.BufferGeometry();
        const pos = new THREE.Float32BufferAttribute(B.pos, 3);
        const col = new THREE.Float32BufferAttribute(B.col, 3);
        pos.setUsage(THREE.DynamicDrawUsage); col.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', pos);
        geo.setAttribute('color', col);
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, material);
        gameState.scene.add(mesh);
        chunks.set(key, { mesh, geo, pos, col });
    }
    console.info(`[buildings] ${gameState.buildings.length} OSM buildings in ${chunks.size} chunks`);
}

function markDirty(attr, rec) {
    attr.clearUpdateRanges();
    attr.addUpdateRange(rec.start * 3, rec.count * 3);
    attr.needsUpdate = true;
}

function setColor(rec, color) {
    const C = chunks.get(rec.chunkKey);
    for (let v = rec.start; v < rec.start + rec.count; v++) C.col.setXYZ(v, color.r, color.g, color.b);
    markDirty(C.col, rec);
}

export function updateBuildings(gameState) {
    const dt = gameState.delta;
    for (const b of flashing) {
        b.flashTimer -= dt;
        if (b.flashTimer <= 0) {
            flashing.delete(b);
            if (b.savedColors && !b.destroyed) {
                const C = chunks.get(b.chunkKey);
                C.col.array.set(b.savedColors, b.start * 3);
                markDirty(C.col, b);
                b.savedColors = null;
            }
        }
    }
    // collapse animations
    for (let i = collapsing.length - 1; i >= 0; i--) {
        const c = collapsing[i];
        c.t = Math.min(1, c.t + dt * 1.2);
        const C = chunks.get(c.rec.chunkKey);
        const a = C.pos.array, o = c.orig, g = c.rec.ground;
        const s = 1 - 0.88 * c.t * c.t;
        for (let v = 0; v < c.rec.count; v++) {
            const k = (c.rec.start + v) * 3;
            const spread = 1 + 0.15 * c.t;
            a[k] = c.rec.position.x + (o[v * 3] - c.rec.position.x) * spread + (Math.random() - 0.5) * 0.6 * (1 - c.t);
            a[k + 1] = g + (o[v * 3 + 1] - g) * s;
            a[k + 2] = c.rec.position.z + (o[v * 3 + 2] - c.rec.position.z) * spread + (Math.random() - 0.5) * 0.6 * (1 - c.t);
        }
        markDirty(C.pos, c.rec);
        if (c.t >= 1) { setColor(c.rec, RUBBLE); collapsing.splice(i, 1); }
    }
}

export function damageBuilding(gameState, building, damage) {
    if (building.destroyed) return;
    building.health -= damage;
    const C = chunks.get(building.chunkKey);
    if (!building.savedColors) building.savedColors = C.col.array.slice(building.start * 3, (building.start + building.count) * 3);
    setColor(building, new THREE.Color(0xff5544));
    building.flashTimer = 0.12;
    flashing.add(building);
    if (building.health <= 0) destroyBuilding(gameState, building);
}

function destroyBuilding(gameState, building) {
    building.destroyed = true;
    const C = chunks.get(building.chunkKey);
    if (building.savedColors) { C.col.array.set(building.savedColors, building.start * 3); building.savedColors = null; }
    collapsing.push({ rec: building, t: 0, orig: C.pos.array.slice(building.start * 3, (building.start + building.count) * 3) });

    if (gameState.createExplosion) {
        gameState.createExplosion(
            building.position.clone().add(new THREE.Vector3(0, Math.min(building.height, 20) / 2, 0)),
            Math.min(40, Math.max(building.width, building.depth) * 1.2), 'building');
    }
    if (gameState.audio) gameState.audio.playExplosion(2.5);
    if (gameState.onBuildingDestroyed) gameState.onBuildingDestroyed(building);
    showNotification(`${building.name.toUpperCase()} DESTROYED!`);
}

function showNotification(text) {
    const container = document.getElementById('hud-notifications');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = text;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function pointInPoly(x, z, p) {
    let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
}

// Collision: AABB pre-test via spatial hash, then exact footprint test.
export function checkBuildingCollision(gameState, point, radius = 1) {
    const list = grid.get(Math.floor(point.x / 32) + ',' + Math.floor(point.z / 32));
    if (!list) return null;
    for (const b of list) {
        if (b.destroyed) continue;
        if (point.x < b.minX - radius || point.x > b.maxX + radius || point.z < b.minZ - radius || point.z > b.maxZ + radius) continue;
        const dy = point.y - b.ground;
        if (dy < -radius || dy > b.height + radius) continue;
        if (radius > 3 || pointInPoly(point.x, point.z, b.poly)) return b;
    }
    return null;
}
