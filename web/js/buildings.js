// ============================================
// BUILDINGS.JS — Real OSM Buildings + 16-bit Pixel-Art Romagna Texture Atlas
// --------------------------------------------
// Extrudes all 4,259 OpenStreetMap footprints in Castel Bolognese, merged per
// 512 m chunk (1 draw call per chunk on Intel iGPUs!) using a single procedural
// 16-bit pixel-art vertical-band texture atlas (persiane shutters, doors,
// porticoes, terracotta bricks, balconies, industrial bays, coppi roof tiles).
// ============================================
import * as THREE from 'three';

const CHUNK = 512;
const WALLS = {
    house:      [0xf0dfc0, 0xe8c996, 0xedd3aa, 0xdfb486, 0xf2e8d4, 0xdca474, 0xe4d5b4],
    townhouse:  [0xeac490, 0xe2b07a, 0xefd6ac, 0xd99b6c],
    industrial: [0xd4d2cc, 0xc4c8c5, 0xdedbd2, 0xb8bdb8],
    brick:      [0xc97b5a, 0xba6e4e, 0xd28564],
    apartment:  [0xe8e0cf, 0xdcd2be, 0xe5c8a2, 0xcfc8bc],
    farm:       [0xd49a72, 0xe0ba8c, 0xc88a68, 0xe8d2ae],
};
const ROOFS = {
    tile: [0xc86448, 0xba5b40, 0xd47050, 0xad523a],
    flat: [0x9c9a95, 0xa8a5a0, 0x8c8a85],
};

const INDUSTRIAL = new Set(['industrial', 'warehouse', 'commercial', 'retail', 'service', 'hangar', 'manufacture', 'greenhouse', 'roof', 'office', 'supermarket']);
const BRICK = new Set(['church', 'chapel', 'cathedral', 'bell_tower', 'tower', 'castle', 'civic', 'public', 'townhall', 'ruins']);
const FARM = new Set(['barn', 'farm_auxiliary', 'farm', 'cowshed', 'stable', 'sty', 'shed', 'hut']);
const APARTMENT = new Set(['apartments', 'dormitory', 'hotel', 'hospital', 'school']);
const RUBBLE = new THREE.Color(0x6a655c);

let chunks = new Map();
let grid = new Map();
let collapsing = [];
let flashing = new Set();
let buildingAtlas = null;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9 >>> 0) / 4294967296); }
function pick(arr, r) { return arr[(r() * arr.length) | 0]; }

// ---------------------------------------------------------------- 16-bit Pixel-Art Atlas (128x512, 8 bands of 64px)
// Bands (0..7, each 64px tall; wrapS = RepeatWrapping across full 128px width):
//   0: Romagna house (plaster, dark-green persiane shutters, ground door)
//   1: Centro storico townhouse (ground portico arches, brown shutters)
//   2: Historic brickwork (running bond pixel bricks, arched windows)
//   3: 1980s apartment block (balcony railings, roller shutters)
//   4: Industrial capannone (corrugated ribs, roll-up bay doors, high windows)
//   5: Rural casolare / barn (brick base, hayloft openings, wood doors)
//   6: Terracotta coppi roof tiles
//   7: Flat gravel / concrete roof & rubble
function getBuildingAtlas() {
    if (buildingAtlas) return buildingAtlas;
    const W = 128, H = 512, BH = 64;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    const noiseFill = (y0, h, baseHex, speckA, speckB, density = 0.18) => {
        g.fillStyle = baseHex;
        g.fillRect(0, y0, W, h);
        let s = (y0 * 131 + 17) >>> 0;
        const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let y = y0; y < y0 + h; y++) {
            for (let x = 0; x < W; x++) {
                const v = rnd();
                if (v < density * 0.5) { g.fillStyle = speckA; g.fillRect(x, y, 1, 1); }
                else if (v < density) { g.fillStyle = speckB; g.fillRect(x, y, 1, 1); }
            }
        }
    };

    const drawWindowWithShutters = (x, y, shutterCol) => {
        // Sill
        g.fillStyle = '#c8c0b4'; g.fillRect(x - 3, y + 9, 12, 1);
        // Shutters (persiane) left & right
        g.fillStyle = shutterCol;
        g.fillRect(x - 3, y, 3, 9);
        g.fillRect(x + 6, y, 3, 9);
        // Louver lines on shutters
        g.fillStyle = 'rgba(0,0,0,0.28)';
        for (let ly = y + 1; ly < y + 9; ly += 2) {
            g.fillRect(x - 3, ly, 3, 1);
            g.fillRect(x + 6, ly, 3, 1);
        }
        // Dark glass + mullion + sky reflection pixel
        g.fillStyle = '#23303d'; g.fillRect(x, y, 6, 9);
        g.fillStyle = '#5a7890'; g.fillRect(x + 1, y + 1, 2, 3);
        g.fillStyle = '#d8d2c5'; g.fillRect(x + 3, y, 1, 9);
        g.fillRect(x, y + 4, 6, 1);
    };

    // --- Band 0: Romagna plaster house (4 stories x 15px, plinth at bottom) ---
    {
        const y0 = 0 * BH;
        noiseFill(y0, BH, '#f2eee6', '#e5dfd4', '#faf8f2', 0.2);
        g.fillStyle = '#b5ada0'; g.fillRect(0, y0 + 60, W, 4); // stone plinth
        g.fillStyle = '#9e9588'; g.fillRect(0, y0, W, 2);      // eaves shadow
        for (let st = 0; st < 4; st++) {
            const sy = y0 + 62 - (st + 1) * 15;
            g.fillStyle = '#ded8cc'; g.fillRect(0, sy + 14, W, 1); // subtle floor line
            for (let bx = 8; bx < W; bx += 24) {
                if (st === 0 && (bx === 32 || bx === 80)) {
                    // Ground-floor wooden entrance door
                    g.fillStyle = '#b8b0a2'; g.fillRect(bx - 1, sy + 2, 8, 13);
                    g.fillStyle = '#5a3a24'; g.fillRect(bx, sy + 3, 6, 12);
                    g.fillStyle = '#3d2616'; g.fillRect(bx + 1, sy + 4, 4, 5);
                    g.fillStyle = '#d8b858'; g.fillRect(bx + 4, sy + 9, 1, 1); // brass knob
                } else {
                    drawWindowWithShutters(bx, sy + 3, '#2d5236'); // classic Romagna green persiane
                }
            }
        }
    }

    // --- Band 1: Centro storico townhouse (portico arches + brown shutters) ---
    {
        const y0 = 1 * BH;
        noiseFill(y0, BH, '#efe6d8', '#dfd3c0', '#f8f2e8', 0.22);
        g.fillStyle = '#8f8476'; g.fillRect(0, y0, W, 2);
        // Ground-floor portico arches
        const gy = y0 + 47;
        g.fillStyle = '#cbbba4'; g.fillRect(0, gy - 1, W, 2);
        for (let ax = 4; ax < W; ax += 32) {
            g.fillStyle = '#433930';
            g.fillRect(ax + 4, gy + 4, 18, 13);
            g.fillRect(ax + 6, gy + 2, 14, 2);
            g.fillStyle = '#786858';
            g.fillRect(ax, gy + 1, 4, 16); // pillar
            // Shop warm window inside portico
            g.fillStyle = '#7a6848'; g.fillRect(ax + 8, gy + 6, 6, 6);
        }
        for (let st = 1; st < 4; st++) {
            const sy = y0 + 62 - (st + 1) * 15;
            for (let bx = 10; bx < W; bx += 32) {
                drawWindowWithShutters(bx, sy + 3, '#5c3c28');
                drawWindowWithShutters(bx + 16, sy + 3, '#5c3c28');
            }
        }
    }

    // --- Band 2: Historic brickwork (churches, towers, civic) ---
    {
        const y0 = 2 * BH;
        noiseFill(y0, BH, '#d8cfc4', '#c4b8aa', '#e6ded4', 0.35);
        // Brick courses
        for (let y = y0 + 2; y < y0 + BH - 2; y += 3) {
            g.fillStyle = 'rgba(90, 50, 35, 0.22)';
            g.fillRect(0, y, W, 1);
            const off = ((y / 3) | 0) % 2 ? 3 : 0;
            for (let x = off; x < W; x += 6) g.fillRect(x, y - 2, 1, 2);
        }
        // Cornice + pilasters + arched windows
        g.fillStyle = '#9c8e80'; g.fillRect(0, y0 + 2, W, 3);
        for (let px = 0; px < W; px += 32) {
            g.fillStyle = 'rgba(255,250,240,0.16)'; g.fillRect(px, y0 + 4, 4, BH - 6);
            // Tall arched window
            g.fillStyle = '#252a34';
            g.fillRect(px + 13, y0 + 18, 6, 14);
            g.fillRect(px + 14, y0 + 16, 4, 2);
            g.fillRect(px + 13, y0 + 40, 6, 12);
        }
    }

    // --- Band 3: 1970s/80s Condominium / Apartments (balconies) ---
    {
        const y0 = 3 * BH;
        noiseFill(y0, BH, '#ece8e0', '#dcd6cc', '#f6f4ee', 0.16);
        for (let st = 0; st < 4; st++) {
            const sy = y0 + 62 - (st + 1) * 15;
            // Concrete floor slab
            g.fillStyle = '#b8b4ac'; g.fillRect(0, sy + 13, W, 2);
            for (let bx = 6; bx < W; bx += 32) {
                // Window + grey roller shutter header
                g.fillStyle = '#6e7278'; g.fillRect(bx, sy + 2, 8, 2);
                g.fillStyle = '#263442'; g.fillRect(bx, sy + 4, 8, 8);
                g.fillStyle = '#6b8aa2'; g.fillRect(bx + 1, sy + 5, 3, 4);
                // Recessed balcony next to it
                if (st > 0) {
                    g.fillStyle = '#8b867e'; g.fillRect(bx + 12, sy + 3, 14, 10);
                    g.fillStyle = '#2b3540'; g.fillRect(bx + 14, sy + 4, 6, 9);
                    g.fillStyle = '#4a5258'; g.fillRect(bx + 11, sy + 9, 16, 4); // balcony railing
                    g.fillStyle = '#cfd4d8'; g.fillRect(bx + 11, sy + 9, 16, 1);
                } else {
                    g.fillStyle = '#454a50'; g.fillRect(bx + 13, sy + 3, 12, 10); // garage door
                }
            }
        }
    }

    // --- Band 4: Industrial Capannone (corrugated ribs + cargo bays) ---
    {
        const y0 = 4 * BH;
        noiseFill(y0, BH, '#dfdfd9', '#cfd0ca', '#ecece6', 0.12);
        for (let x = 0; x < W; x += 4) {
            g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, y0, 1, BH);
        }
        // Clerestory ribbon windows near top + blue/red industrial stripe
        g.fillStyle = '#3c5a78'; g.fillRect(0, y0 + 12, W, 3);
        for (let x = 4; x < W; x += 16) {
            g.fillStyle = '#2c3d4f'; g.fillRect(x, y0 + 18, 12, 6);
            g.fillStyle = '#7aa0be'; g.fillRect(x + 1, y0 + 19, 4, 2);
        }
        // Large roll-up truck doors at ground level
        for (let x = 8; x < W; x += 40) {
            g.fillStyle = '#5c6268'; g.fillRect(x, y0 + 38, 22, 24);
            for (let y = y0 + 40; y < y0 + 62; y += 3) {
                g.fillStyle = '#3e4348'; g.fillRect(x + 1, y, 20, 1);
            }
        }
    }

    // --- Band 5: Rural Casolare / Barn ---
    {
        const y0 = 5 * BH;
        noiseFill(y0, BH, '#e8dfd0', '#d6c8b2', '#f2eadc', 0.28);
        g.fillStyle = '#a8927c'; g.fillRect(0, y0 + 54, W, 10); // rustic stone base
        for (let bx = 10; bx < W; bx += 32) {
            drawWindowWithShutters(bx, y0 + 22, '#4a3525');
            // Barn arch / wooden double door below
            g.fillStyle = '#523620'; g.fillRect(bx - 2, y0 + 44, 12, 18);
            g.fillStyle = '#382415'; g.fillRect(bx + 4, y0 + 44, 1, 18);
            // Hayloft dark grille
            g.fillStyle = '#2d241e'; g.fillRect(bx + 16, y0 + 22, 10, 8);
        }
    }

    // --- Band 6: Terracotta Coppi Roof Tiles ---
    {
        const y0 = 6 * BH;
        noiseFill(y0, BH, '#e4dcd4', '#cfc2b6', '#f4ece4', 0.25);
        for (let x = 0; x < W; x += 4) {
            g.fillStyle = 'rgba(60, 20, 10, 0.22)'; g.fillRect(x, y0, 1, BH);
            g.fillStyle = 'rgba(255, 240, 220, 0.18)'; g.fillRect(x + 2, y0, 1, BH);
        }
        for (let y = y0 + 2; y < y0 + BH; y += 6) {
            g.fillStyle = 'rgba(50, 18, 8, 0.20)'; g.fillRect(0, y, W, 1);
        }
    }

    // --- Band 7: Flat Gravel / Concrete Roof & Rubble ---
    {
        const y0 = 7 * BH;
        noiseFill(y0, BH, '#d0cec8', '#b4b0a8', '#e4e2dc', 0.45);
        g.strokeStyle = '#9c9890'; g.lineWidth = 2;
        g.strokeRect(2, y0 + 3, W - 4, BH - 6);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter; // prevents vertical bleeding across 64px bands!
    tex.generateMipmaps = false;
    buildingAtlas = tex;
    return tex;
}

// Convert Canvas pixel Y (0=top..512=bottom) to WebGL V (1=top..0=bottom)
const pyToV = (py) => 1.0 - py / 512.0;

export function initBuildings(gameState) {
    gameState.buildings = [];
    chunks = new Map(); grid = new Map(); collapsing = []; flashing = new Set();
    const world = gameState.world;
    const src = world.osm.buildings;
    const half = world.size / 2;
    const builders = new Map();  // chunk key -> { pos: [], col: [], uv: [] }
    const tmp = new THREE.Color();

    src.forEach((b, idx) => {
        const p = b.p;
        if (p.length < 6) return;
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
        const ccw = area > 0;
        area = Math.abs(area) / 2;
        if (area < 6) return;

        const r = rng(idx * 7919 + 13);
        const t = b.t || 'yes';
        const inHistoricCore = Math.hypot(cx, cz) < 340;

        let band = 0, wallPalette = WALLS.house;
        if (INDUSTRIAL.has(t)) { band = 4; wallPalette = WALLS.industrial; }
        else if (BRICK.has(t)) { band = 2; wallPalette = WALLS.brick; }
        else if (FARM.has(t))  { band = 5; wallPalette = WALLS.farm; }
        else if (APARTMENT.has(t) || b.h >= 11.5) { band = 3; wallPalette = WALLS.apartment; }
        else if (inHistoricCore && r() < 0.55) { band = 1; wallPalette = WALLS.townhouse; }

        const wall = pick(wallPalette, r);
        const flatRoof = INDUSTRIAL.has(t) || area > 650 || n > 14;
        const roof = flatRoof ? pick(ROOFS.flat, r) : pick(ROOFS.tile, r);
        const h = b.h;
        const roofH = flatRoof ? 0 : Math.min(3.5, Math.sqrt(area) * 0.22);
        const top = ground + h;

        const key = Math.floor((cx + half) / CHUNK) + ',' + Math.floor((cz + half) / CHUNK);
        if (!builders.has(key)) builders.set(key, { pos: [], col: [], uv: [] });
        const B = builders.get(key);
        const start = B.pos.length / 3;
        const push = (x, y, z, c, u, v) => {
            B.pos.push(x, y, z);
            B.col.push(c.r, c.g, c.b);
            B.uv.push(u, v);
        };

        // Stories (1..4) mapped inside the 64px band [band*64+2 .. band*64+62]
        const stories = Math.max(1, Math.min(4, Math.round(h / 3.1)));
        const vBot = pyToV(band * 64 + 62);
        const vTop = pyToV(band * 64 + 62 - stories * 15);

        // Walls (split tall towers into <=12.5m vertical tiers so windows stay to scale)
        const tiers = h > 14 ? Math.ceil(h / 12) : 1;
        const tierH = h / tiers;
        for (let i = 0; i < n; i++) {
            let a = i, c = (i + 1) % n;
            if (!ccw) [a, c] = [c, a];
            const ax = p[a * 2], az = p[a * 2 + 1], bx = p[c * 2], bz = p[c * 2 + 1];
            const edgeLen = Math.hypot(bx - ax, bz - az);
            // 1.0 U = 16 metres (4 window bays)
            const uSpan = Math.max(0.25, Math.round((edgeLen / 16) * 4) / 4);
            tmp.setHex(wall).multiplyScalar(0.92 + r() * 0.12);

            for (let tr = 0; tr < tiers; tr++) {
                const y0 = ground + tr * tierH;
                const y1 = y0 + tierH;
                const tvBot = tr === 0 ? vBot : pyToV(band * 64 + 47);
                const tvTop = tiers > 1 ? pyToV(band * 64 + 4) : vTop;
                push(ax, y0, az, tmp, 0, tvBot);
                push(bx, y1, bz, tmp, uSpan, tvTop);
                push(bx, y0, bz, tmp, uSpan, tvBot);
                push(ax, y0, az, tmp, 0, tvBot);
                push(ax, y1, az, tmp, 0, tvTop);
                push(bx, y1, bz, tmp, uSpan, tvTop);
            }
        }

        // Roof
        tmp.setHex(roof);
        if (!flatRoof) {
            const rvEave = pyToV(6 * 64 + 60);
            const rvPeak = pyToV(6 * 64 + 6);
            for (let i = 0; i < n; i++) {
                let a = i, c = (i + 1) % n;
                if (!ccw) [a, c] = [c, a];
                const ax = p[a * 2], az = p[a * 2 + 1], bx = p[c * 2], bz = p[c * 2 + 1];
                const uSpan = Math.max(0.5, Math.hypot(bx - ax, bz - az) / 8);
                push(ax, top, az, tmp, 0, rvEave);
                push(cx, top + roofH, cz, tmp, uSpan * 0.5, rvPeak);
                push(bx, top, bz, tmp, uSpan, rvEave);
            }
        } else {
            const contour = [];
            for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
            const tris = THREE.ShapeUtils.triangulateShape(contour, []);
            const fvMin = pyToV(7 * 64 + 58), fvSpan = pyToV(7 * 64 + 6) - fvMin;
            const spanX = Math.max(1, maxX - minX), spanZ = Math.max(1, maxZ - minZ);
            for (const [i0, i1, i2] of tris) {
                const ux = p[i1 * 2] - p[i0 * 2], uz = p[i1 * 2 + 1] - p[i0 * 2 + 1];
                const vx = p[i2 * 2] - p[i0 * 2], vz = p[i2 * 2 + 1] - p[i0 * 2 + 1];
                const order = (uz * vx - ux * vz) > 0 ? [i0, i1, i2] : [i0, i2, i1];
                for (const k of order) {
                    const px = p[k * 2], pz = p[k * 2 + 1];
                    push(px, top, pz, tmp, (px - minX) / 16, fvMin + ((pz - minZ) / spanZ) * fvSpan);
                }
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
        for (let gx = Math.floor(minX / 32); gx <= Math.floor(maxX / 32); gx++)
            for (let gz = Math.floor(minZ / 32); gz <= Math.floor(maxZ / 32); gz++) {
                const k = gx + ',' + gz;
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(rec);
            }
    });

    const material = new THREE.MeshLambertMaterial({
        map: getBuildingAtlas(),
        vertexColors: true,
        flatShading: true,
    });
    for (const [key, B] of builders) {
        const geo = new THREE.BufferGeometry();
        const pos = new THREE.Float32BufferAttribute(B.pos, 3);
        const col = new THREE.Float32BufferAttribute(B.col, 3);
        const uv = new THREE.Float32BufferAttribute(B.uv, 2);
        pos.setUsage(THREE.DynamicDrawUsage); col.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', pos);
        geo.setAttribute('color', col);
        geo.setAttribute('uv', uv);
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, material);
        gameState.scene.add(mesh);
        chunks.set(key, { mesh, geo, pos, col, uv });
    }
    console.info(`[buildings] ${gameState.buildings.length} 16-bit textured OSM buildings in ${chunks.size} chunks`);
}

function markDirty(attr, rec, itemSize = 3) {
    attr.clearUpdateRanges();
    attr.addUpdateRange(rec.start * itemSize, rec.count * itemSize);
    attr.needsUpdate = true;
}

function setColor(rec, color) {
    const C = chunks.get(rec.chunkKey);
    for (let v = rec.start; v < rec.start + rec.count; v++) C.col.setXYZ(v, color.r, color.g, color.b);
    markDirty(C.col, rec, 3);
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
                markDirty(C.col, b, 3);
                b.savedColors = null;
            }
        }
    }
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
        markDirty(C.pos, c.rec, 3);
        if (c.t >= 1) {
            setColor(c.rec, RUBBLE);
            const rv = pyToV(7 * 64 + 32);
            for (let v = c.rec.start; v < c.rec.start + c.rec.count; v++) C.uv.setXY(v, (v % 3) * 0.5, rv);
            markDirty(C.uv, c.rec, 2);
            collapsing.splice(i, 1);
        }
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
