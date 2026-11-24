// ============================================
// TERRAIN.JS — Real Castel Bolognese DEM + AGEA 2023 Orthophoto Tiles
// --------------------------------------------
// Loads static assets baked offline by tools/bake_world.py & tools/bake_ortho.py:
//   assets/world/world.json        (metadata)
//   assets/world/height.bin        (Uint16 heightmap, 16 m grid, 8.2 x 8.2 km)
//   assets/world/osm.json          (buildings, roads, water, land use, trees...)
//   assets/world/ortho/c_X_Z.jpg   (64 real Regione Emilia-Romagna AGEA 2023 RGB tiles:
//                                   0.5 m/px over town & helipad, 1 m/px ring, 2 m/px hills)
//
// NearestFilter magnification gives crisp 16-bit pixel texels at car bumper height
// while mipmaps + anisotropy prevent distant shimmering from helicopter altitude.
// ============================================
import * as THREE from 'three';

export let WORLD_SIZE = 8192;
const QUALITY = new URLSearchParams(location.search).get('q') || 'auto';
const CHUNKS = 8;

const AREA_COLORS = {
    farmland: [0x8f9a4c, 0x7d9142, 0xa59a5a, 0x6e8a3c, 0x9a8455, 0xb2a462],
    orchard: 0x5d8838, vineyard: 0x7b8a42, meadow: 0x77a24a, grass: 0x6fa046,
    grassland: 0x80a850, village_green: 0x6fa046, recreation_ground: 0x6aa045,
    residential: 0x9c9585, industrial: 0x8c8a86, commercial: 0x928c84, retail: 0x928c84,
    construction: 0xa39a80, brownfield: 0x9a9070, garages: 0x7a7a78,
    forest: 0x2e5a26, wood: 0x2e5a26, scrub: 0x55783a, heath: 0x7a8a50, wetland: 0x557a6a,
    park: 0x4f8f3f, garden: 0x5c9a44, playground: 0x8a9a5a, pitch: 0x3f9a4c,
    sports_centre: 0x6a9a5a, stadium: 0x6a9a5a, golf_course: 0x5aa850,
    cemetery: 0x6e7a5e, grave_yard: 0x6e7a5e, allotments: 0x7a8f4a, farmyard: 0x9b8b6a,
    greenhouse_horticulture: 0xb8c0b0, plant_nursery: 0x6a9a4a,
    quarry: 0xa89a7a, landfill: 0x8a8070, railway: 0x7a7068, military: 0x6a7058,
    parking: 0x6c6c6a, school: 0xa39c8c, basin: 0x3d6d9a, reservoir: 0x3d6d9a,
};
const DEFAULT_GROUND = 0x7f9348;
const WATER = 0x3a6a98;
const ROAD_COLORS = ['#55555a', '#5c5c60', '#646466', '#6e6e6e', '#7a7874', '#9e8c68', '#a49a88', '#a09684'];
const BUILDING_BASE = '#4d4640';

async function loadWorldData() {
    const [meta, hbuf, osm] = await Promise.all([
        fetch('assets/world/world.json').then(r => r.json()),
        fetch('assets/world/height.bin').then(r => r.arrayBuffer()),
        fetch('assets/world/osm.json').then(r => r.json()),
    ]);
    return { meta, hbuf, osm };
}

function makeHeightField(meta, hbuf) {
    const n = meta.grid, raw = new Uint16Array(hbuf);
    const base = meta.centerHeight;
    const h = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) h[i] = raw[i] * meta.heightScale + meta.heightOffset - base;
    const half = meta.size / 2, inv = 1 / meta.step;
    function getHeight(x, z) {
        let fx = (x + half) * inv, fz = (z + half) * inv;
        fx = Math.min(Math.max(fx, 0), n - 1.001);
        fz = Math.min(Math.max(fz, 0), n - 1.001);
        const ix = fx | 0, iz = fz | 0, ax = fx - ix, az = fz - iz;
        const o = iz * n + ix;
        const a = h[o], b = h[o + 1], c = h[o + n], d = h[o + n + 1];
        return (a + (b - a) * ax) * (1 - az) + (c + (d - c) * ax) * az;
    }
    return { h, n, base, getHeight };
}

function hash(i) { i = (i ^ 61) ^ (i >>> 16); i = i + (i << 3); i ^= i >>> 4; i = Math.imul(i, 0x27d4eb2d); return (i ^ (i >>> 15)) >>> 0; }
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }

function tracePoly(g, p, toPx) {
    g.moveTo(toPx(p[0]), toPx(p[1]));
    for (let i = 2; i < p.length; i += 2) g.lineTo(toPx(p[i]), toPx(p[i + 1]));
    g.closePath();
}
function traceLine(g, p, toPx) {
    g.moveTo(toPx(p[0]), toPx(p[1]));
    for (let i = 2; i < p.length; i += 2) g.lineTo(toPx(p[i]), toPx(p[i + 1]));
}

// Fast fallback + initial radar minimap canvas (progressively overwritten by real orthophotos)
function paintColorMap(osm, size, res) {
    const c = document.createElement('canvas');
    c.width = c.height = res;
    const g = c.getContext('2d');
    const k = res / size, half = size / 2;
    const toPx = v => (v + half) * k;
    g.fillStyle = hex(DEFAULT_GROUND);
    g.fillRect(0, 0, res, res);

    const areas = osm.areas.slice().sort((a, b) => b.p.length - a.p.length);
    areas.forEach((a, i) => {
        let col = AREA_COLORS[a.k];
        if (col === undefined) return;
        if (Array.isArray(col)) col = col[hash(i + a.p.length) % col.length];
        g.fillStyle = hex(col);
        g.beginPath(); tracePoly(g, a.p, toPx); g.fill();
    });
    g.fillStyle = hex(WATER);
    for (const p of osm.waterAreas) { g.beginPath(); tracePoly(g, p, toPx); g.fill(); }
    g.strokeStyle = hex(WATER); g.lineCap = g.lineJoin = 'round';
    for (const w of osm.waterLines) {
        g.lineWidth = Math.max(1, w.w * k); g.beginPath(); traceLine(g, w.p, toPx); g.stroke();
    }
    g.strokeStyle = '#4a4038';
    for (const p of osm.rail) { g.lineWidth = Math.max(1, 4 * k); g.beginPath(); traceLine(g, p, toPx); g.stroke(); }
    const roads = osm.roads.slice().sort((a, b) => b.c - a.c);
    for (const r of roads) {
        g.strokeStyle = ROAD_COLORS[r.c] || ROAD_COLORS[5];
        g.lineWidth = Math.max(r.c >= 7 ? 0.6 : 1, r.w * k);
        g.beginPath(); traceLine(g, r.p, toPx); g.stroke();
    }
    g.fillStyle = BUILDING_BASE;
    for (const b of osm.buildings) { g.beginPath(); tracePoly(g, b.p, toPx); g.fill(); }
    return c;
}

// Classification raster (logic): R = water, G = road, B = built-up
function paintClassMap(osm, size, res) {
    const c = document.createElement('canvas');
    c.width = c.height = res;
    const g = c.getContext('2d', { willReadFrequently: true });
    const k = res / size, half = size / 2;
    const toPx = v => (v + half) * k;
    g.fillStyle = '#000'; g.fillRect(0, 0, res, res);
    g.globalCompositeOperation = 'lighter';
    const TOWN = new Set(['residential', 'industrial', 'commercial', 'retail', 'construction', 'garages', 'parking', 'school']);
    g.fillStyle = '#0000ff';
    for (const a of osm.areas) if (TOWN.has(a.k)) { g.beginPath(); tracePoly(g, a.p, toPx); g.fill(); }
    g.fillStyle = '#ff0000';
    for (const p of osm.waterAreas) { g.beginPath(); tracePoly(g, p, toPx); g.fill(); }
    g.strokeStyle = '#ff0000'; g.lineCap = 'round';
    for (const w of osm.waterLines) { g.lineWidth = Math.max(1, w.w * k); g.beginPath(); traceLine(g, w.p, toPx); g.stroke(); }
    g.strokeStyle = '#00ff00';
    for (const r of osm.roads) if (r.c <= 6) { g.lineWidth = Math.max(1, (r.w + 2) * k); g.beginPath(); traceLine(g, r.p, toPx); g.stroke(); }
    const data = g.getImageData(0, 0, res, res).data;
    const half2 = size / 2;
    const at = (x, z, ch) => {
        const px = ((x + half2) * k) | 0, pz = ((z + half2) * k) | 0;
        if (px < 0 || pz < 0 || px >= res || pz >= res) return false;
        return data[(pz * res + px) * 4 + ch] > 127;
    };
    return {
        isWater: (x, z) => at(x, z, 0),
        isRoad: (x, z) => at(x, z, 1),
        isInTown: (x, z) => at(x, z, 2),
    };
}

// ---------------------------------------------------------------- mesh (chunked, 2 LODs, local 0..1 UVs per chunk)
function buildChunkGeometry(hf, x0, z0, chunk, cells) {
    const step = chunk / cells, n = cells + 1;
    const cx = x0 + chunk * 0.5, cz = z0 + chunk * 0.5;
    const cy = hf.getHeight(cx, cz);
    const pos = [], uv = [], idx = [];
    const vert = (x, z, y) => {
        pos.push(x - cx, y - cy, z - cz);
        // Local chunk UVs [0..1]: u=0 West->1 East, v=1 North(z0)->0 South(z0+chunk)
        uv.push((x - x0) / chunk, 1 - (z - z0) / chunk);
        return pos.length / 3 - 1;
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = x0 + i * step, z = z0 + j * step;
        vert(x, z, hf.getHeight(x, z));
    }
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx.push(a, c, b, b, c, d);
    }
    const SK = 40;
    const edge = (list) => {
        for (let k = 0; k < list.length - 1; k++) {
            const a = list[k], b = list[k + 1];
            const ax = pos[a * 3] + cx, ay = pos[a * 3 + 1] + cy, az = pos[a * 3 + 2] + cz;
            const bx = pos[b * 3] + cx, by = pos[b * 3 + 1] + cy, bz = pos[b * 3 + 2] + cz;
            const a2 = vert(ax, az, ay - SK);
            const b2 = vert(bx, bz, by - SK);
            idx.push(a, a2, b, b, a2, b2, a, b, a2, b, b2, a2);
        }
    };
    const top = [], bottom = [], left = [], right = [];
    for (let i = 0; i < n; i++) { top.push(i); bottom.push(cells * n + i); left.push(i * n); right.push(i * n + cells); }
    edge(top); edge(bottom); edge(left); edge(right);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return { geo, center: [cx, cy, cz] };
}

function makeFallbackChunkTexture(colorCanvas, cx, cz, aniso) {
    const tilePx = colorCanvas.width / CHUNKS;
    const sub = document.createElement('canvas');
    sub.width = sub.height = tilePx;
    sub.getContext('2d').drawImage(colorCanvas, cx * tilePx, cz * tilePx, tilePx, tilePx, 0, 0, tilePx, tilePx);
    const tex = new THREE.CanvasTexture(sub);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = aniso;
    return tex;
}

function loadOrthoTile(cx, cz, mat, colorCanvas, aniso) {
    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            // Optional downscale in ?q=lo mode to save iGPU VRAM on very old chipsets
            let source = img;
            if (QUALITY === 'lo' && img.width > 512) {
                const c = document.createElement('canvas');
                c.width = c.height = 512;
                c.getContext('2d').drawImage(img, 0, 0, 512, 512);
                source = c;
            }
            const tex = new THREE.Texture(source);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
            // NearestFilter magnification = crisp 16-bit texels up close (no blurry road edges!)
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.anisotropy = aniso;
            tex.needsUpdate = true;

            const old = mat.map;
            mat.map = tex;
            mat.needsUpdate = true;
            if (old) old.dispose();

            // Composite onto radar minimap canvas so HUD minimap shows real aerial view too
            const tilePx = colorCanvas.width / CHUNKS;
            colorCanvas.getContext('2d').drawImage(img, cx * tilePx, cz * tilePx, tilePx, tilePx);
            resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = `assets/world/ortho/c_${cx}_${cz}.jpg`;
    });
}

async function buildTerrainMeshes(gameState, hf, size, colorCanvas, onProgress) {
    const chunk = size / CHUNKS, half = size / 2;
    const fine = Math.round(chunk / 16), coarse = Math.round(chunk / 64);
    const aniso = Math.min(4, gameState.renderer.capabilities.getMaxAnisotropy());
    const group = new THREE.Group();
    const coreJobs = [];
    const outerJobs = [];

    for (let cz = 0; cz < CHUNKS; cz++) for (let cx = 0; cx < CHUNKS; cx++) {
        const x0 = -half + cx * chunk, z0 = -half + cz * chunk;
        const fallbackTex = makeFallbackChunkTexture(colorCanvas, cx, cz, aniso);
        const mat = new THREE.MeshLambertMaterial({ map: fallbackTex, flatShading: true });

        const lod = new THREE.LOD();
        const f = buildChunkGeometry(hf, x0, z0, chunk, fine);
        const c = buildChunkGeometry(hf, x0, z0, chunk, coarse);
        lod.position.set(f.center[0], f.center[1], f.center[2]);
        lod.addLevel(new THREE.Mesh(f.geo, mat), 0);
        lod.addLevel(new THREE.Mesh(c.geo, mat), chunk * 1.5);
        group.add(lod);

        const isCore = cx >= 2 && cx <= 5 && cz >= 2 && cz <= 5;
        if (isCore) coreJobs.push(() => loadOrthoTile(cx, cz, mat, colorCanvas, aniso));
        else outerJobs.push(() => loadOrthoTile(cx, cz, mat, colorCanvas, aniso));
    }
    gameState.scene.add(group);

    // Await core 16 tiles around Castel Bolognese + Helipad (~200ms on LAN), stream outer 48 in background
    onProgress('LOADING AERIAL ORTHOPHOTOS');
    await Promise.all(coreJobs.map(fn => fn()));
    (async () => {
        for (let i = 0; i < outerJobs.length; i += 6) {
            await Promise.all(outerJobs.slice(i, i + 6).map(fn => fn()));
        }
    })();

    return group;
}

// ---------------------------------------------------------------- helipad + Peugeot 205 parking apron
function findHelipad(hf, cls, osm) {
    const occupied = new Set();
    const CELL = 20;
    for (const b of osm.buildings) for (let i = 0; i < b.p.length; i += 2)
        occupied.add(((b.p[i] / CELL) | 0) + ',' + ((b.p[i + 1] / CELL) | 0));
    const free = (x, z) => {
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
            if (occupied.has((((x / CELL) | 0) + dx) + ',' + (((z / CELL) | 0) + dz))) return false;
        for (let a = 0; a < 8; a++) {
            const sx = x + Math.cos(a) * 25, sz = z + Math.sin(a) * 25;
            if (cls.isWater(sx, sz) || cls.isRoad(sx, sz) || cls.isInTown(sx, sz)) return false;
            if (Math.abs(hf.getHeight(sx, sz) - hf.getHeight(x, z)) > 1.5) return false;
        }
        return true;
    };
    const px = -700, pz = 150;
    for (let r = 0; r < 1500; r += 20)
        for (let a = 0; a < Math.PI * 2; a += Math.max(0.05, 20 / (r + 1))) {
            const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
            if (free(x, z)) return { x: Math.round(x), z: Math.round(z), r: 14 };
        }
    return { x: px, z: pz, r: 14 };
}

function createHelipadMesh(gameState, pad, getHeight) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#525458'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#ffd800'; g.lineWidth = 4;
    g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(20, 16, 6, 32); g.fillRect(38, 16, 6, 32); g.fillRect(20, 29, 24, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.CircleGeometry(pad.r, 20);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.position.set(pad.x, getHeight(pad.x, pad.z) + 0.25, pad.z);
    gameState.scene.add(mesh);

    // Adjacent asphalt parking bay for the 1986 Peugeot 205
    const pc = document.createElement('canvas');
    pc.width = 64; pc.height = 32;
    const pg = pc.getContext('2d');
    pg.fillStyle = '#4d5056'; pg.fillRect(0, 0, 64, 32);
    pg.strokeStyle = '#e8e4d0'; pg.lineWidth = 2;
    pg.strokeRect(18, 4, 42, 24);
    pg.fillStyle = '#ffd800'; pg.font = 'bold 10px monospace';
    pg.fillText('205', 30, 20);
    const ptex = new THREE.CanvasTexture(pc);
    ptex.magFilter = ptex.minFilter = THREE.NearestFilter;
    ptex.colorSpace = THREE.SRGBColorSpace;
    const pgeo = new THREE.PlaneGeometry(14, 7);
    pgeo.rotateX(-Math.PI / 2);
    const pmesh = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ map: ptex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const px = pad.x + 18, pz = pad.z;
    pmesh.position.set(px, getHeight(px, pz) + 0.22, pz);
    gameState.scene.add(pmesh);

    gameState.carSpawn = { x: pad.x + 20, z: pad.z, yaw: 0 };
}

function buildRoadPaths(osm, getHeight) {
    const paths = [];
    for (const r of osm.roads) {
        if (r.c > 3 || r.p.length < 4) continue;
        let len = 0;
        for (let i = 2; i < r.p.length; i += 2) len += Math.hypot(r.p[i] - r.p[i - 2], r.p[i + 1] - r.p[i - 1]);
        const cx = r.p[0], cz = r.p[1];
        if (len < 150 || Math.hypot(cx, cz) > 3500) continue;
        const pts = [];
        for (let i = 0; i < r.p.length; i += 2) pts.push(new THREE.Vector3(r.p[i], getHeight(r.p[i], r.p[i + 1]) + 0.5, r.p[i + 1]));
        paths.push({ name: r.n || r.k, points: pts, loop: false, len });
    }
    paths.sort((a, b) => b.len - a.len);
    return paths.slice(0, 90);
}

export async function initTerrain(gameState, onProgress = () => {}) {
    onProgress('DOWNLOADING TERRAIN DATA');
    const { meta, hbuf, osm } = await loadWorldData();
    WORLD_SIZE = meta.size;

    onProgress('BUILDING HEIGHTFIELD');
    const hf = makeHeightField(meta, hbuf);

    onProgress('PREPARING MAP LAYERS');
    const colorCanvas = paintColorMap(osm, meta.size, 1024);
    const cls = paintClassMap(osm, meta.size, 1024);

    const pad = findHelipad(hf, cls, osm);
    createHelipadMesh(gameState, pad, hf.getHeight);
    gameState.helipad = pad;

    gameState.terrain = await buildTerrainMeshes(gameState, hf, meta.size, colorCanvas, onProgress);

    gameState.world = {
        size: meta.size,
        meta,
        osm,
        places: osm.places || [],
        elevationBase: hf.base,
        getHeight: hf.getHeight,
        getMSL: (x, z) => hf.getHeight(x, z) + hf.base,
        isRoad: cls.isRoad,
        isWater: cls.isWater,
        isInTown: cls.isInTown,
        isPiazza: (x, z) => cls.isRoad(x, z) && cls.isInTown(x, z),
        roadPaths: buildRoadPaths(osm, hf.getHeight),
        colorMap: colorCanvas,
    };
}

export function updateTerrain() { /* static */ }
