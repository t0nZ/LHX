// ============================================
// TERRAIN.JS — Castel Bolognese Terrain Grid
// ============================================
import * as THREE from 'three';

// World constants
export const WORLD_SIZE = 2000; // 2km x 2km
const GRID_RES = 200;         // 200x200 grid cells
const CELL_SIZE = WORLD_SIZE / GRID_RES;

// Road definitions (approximate layout of Castel Bolognese)
// Via Emilia: east-west through center
// Via Calandrini: north-south through center
// Centro storico: rectangular walled area

const COLORS = {
    field1:    0x4a7a2e, // Dark green field
    field2:    0x5a8a35, // Medium green field
    field3:    0x6a9940, // Light green field
    field4:    0x7aaa4a, // Bright green
    plowed:    0x8b7355, // Plowed earth
    road:      0x555555, // Asphalt
    viaEmilia: 0x666666, // Main road (wider, lighter)
    sidewalk:  0x999988, // Sidewalk
    piazza:    0xbbaa88, // Town square
    courtyard: 0xaa9977, // Building courtyard
    water:     0x3366aa, // River/canal
    dirt:      0x887755, // Dirt path
    rock:      0x8a8070, // Hill rock
    forest:    0x2f5a25, // Hill woods
};

// Helipad (player base) — flat area south of the town
export const HELIPAD = { x: -40, z: -280, r: 14 };

// Foothills of the Apennines to the south (+z)
function hillHeight(x, z) {
    const t = Math.max(0, (z - 420) / 500);
    if (t <= 0) return 0;
    const ramp = t * t * (3 - 2 * t);
    const n = 0.55 + 0.45 * Math.sin(x * 0.011 + 1.7) * Math.cos(z * 0.013) + 0.25 * Math.sin(x * 0.027 + z * 0.019);
    return ramp * Math.max(0, n) * 95;
}

// Check if a point is on a road
function isOnViaEmilia(x, z) {
    // Via Emilia runs east-west, slightly south of center
    return Math.abs(z + 20) < 12;
}

function isOnViaCalandrini(x, z) {
    // Via Calandrini runs north-south through center
    return Math.abs(x - 10) < 8 && z > -150 && z < 150;
}

function isOnSecondaryRoad(x, z) {
    // Grid of secondary roads in centro storico
    const inCentro = Math.abs(x) < 200 && Math.abs(z) < 150;
    if (!inCentro) return false;
    
    // East-west streets every ~60m
    const ewRoads = [-100, -40, 20, 80, 130];
    for (const rz of ewRoads) {
        if (Math.abs(z - rz) < 5 && Math.abs(x) < 180) return true;
    }
    // North-south streets every ~70m
    const nsRoads = [-150, -80, -10, 60, 130];
    for (const rx of nsRoads) {
        if (Math.abs(x - rx) < 5 && Math.abs(z) < 140) return true;
    }
    return false;
}

function isInCentroStorico(x, z) {
    return Math.abs(x) < 200 && Math.abs(z) < 150;
}

function isOnWalls(x, z) {
    // Medieval walls around centro storico
    const margin = 5;
    const inOuter = Math.abs(x) < 205 && Math.abs(z) < 155;
    const inInner = Math.abs(x) < 195 && Math.abs(z) < 145;
    return inOuter && !inInner;
}

function isPiazza(x, z) {
    // Piazza Bernardi - main square
    return Math.abs(x - 10) < 30 && Math.abs(z + 20) < 25;
}

function isRiver(x, z) {
    // Fiume Senio - runs roughly north-south, east of town
    const riverX = 350 + Math.sin(z * 0.008) * 40;
    return Math.abs(x - riverX) < 15;
}

function isCountryRoad(x, z) {
    // Roads leading out of town
    // North road
    if (Math.abs(x - 10) < 6 && z > 150) return true;
    // South road
    if (Math.abs(x - 10) < 6 && z < -150) return true;
    // East road (Via Emilia continues)
    if (Math.abs(z + 20) < 6 && Math.abs(x) > 200) return true;
    // Diagonal road NE
    if (Math.abs((x - 200) - (z - 150)) < 8 && x > 200 && x < 500 && z > 150) return true;
    return false;
}

function getTerrainColor(x, z) {
    if (isPiazza(x, z)) return COLORS.piazza;
    if (isRiver(x, z)) return COLORS.water;
    if (isOnViaEmilia(x, z)) return COLORS.viaEmilia;
    if (isOnViaCalandrini(x, z)) return COLORS.road;
    if (isOnSecondaryRoad(x, z)) return COLORS.road;
    if (isOnWalls(x, z)) return COLORS.sidewalk;
    if (isCountryRoad(x, z)) return COLORS.dirt;
    
    if (isInCentroStorico(x, z)) return COLORS.courtyard;
    
    // Foothills
    const hh = hillHeight(x, z);
    if (hh > 55) return COLORS.rock;
    if (hh > 28) return COLORS.forest;

    // Countryside: patchwork of fields
    const fieldNoise = Math.sin(x * 0.01) * Math.cos(z * 0.012) +
                       Math.sin(x * 0.005 + 1.3) * Math.cos(z * 0.007 + 0.7);
    
    if (fieldNoise > 0.5) return COLORS.field1;
    if (fieldNoise > 0.0) return COLORS.field2;
    if (fieldNoise > -0.5) return COLORS.field3;
    if (fieldNoise > -1.0) return COLORS.field4;
    return COLORS.plowed;
}

function getTerrainHeight(x, z) {
    // Mostly flat (pianura padana) with very gentle undulation
    let h = 0;
    h += Math.sin(x * 0.002) * Math.cos(z * 0.003) * 2;
    h += Math.sin(x * 0.005 + 1.0) * Math.cos(z * 0.004 + 2.0) * 1;
    
    // River is slightly lower
    const riverX = 350 + Math.sin(z * 0.008) * 40;
    const riverDist = Math.abs(x - riverX);
    if (riverDist < 30) {
        h -= (1 - riverDist / 30) * 3;
    }
    
    h += hillHeight(x, z);

    // Helipad plateau
    const pd = Math.hypot(x - HELIPAD.x, z - HELIPAD.z);
    if (pd < 40) {
        const f = pd < 22 ? 1 : 1 - (pd - 22) / 18;
        h = h * (1 - f);
    }

    // Roads are flat
    if (isOnViaEmilia(x, z) || isOnViaCalandrini(x, z)) h = 0;
    if (isInCentroStorico(x, z)) h = 0;
    
    return h;
}

export function initTerrain(gameState) {
    const geometry = new THREE.BufferGeometry();
    const half = WORLD_SIZE / 2;
    
    const vertices = [];
    const colors = [];
    const normals = [];
    
    const color = new THREE.Color();
    
    for (let iz = 0; iz < GRID_RES; iz++) {
        for (let ix = 0; ix < GRID_RES; ix++) {
            const x0 = -half + ix * CELL_SIZE;
            const z0 = -half + iz * CELL_SIZE;
            const x1 = x0 + CELL_SIZE;
            const z1 = z0 + CELL_SIZE;
            
            const cx = (x0 + x1) / 2;
            const cz = (z0 + z1) / 2;
            
            const y00 = getTerrainHeight(x0, z0);
            const y10 = getTerrainHeight(x1, z0);
            const y01 = getTerrainHeight(x0, z1);
            const y11 = getTerrainHeight(x1, z1);
            
            color.set(getTerrainColor(cx, cz));
            // Slight color variation per cell for natural look
            const variation = (Math.random() - 0.5) * 0.04;
            const r = Math.max(0, Math.min(1, color.r + variation));
            const g = Math.max(0, Math.min(1, color.g + variation));
            const b = Math.max(0, Math.min(1, color.b + variation));
            
            // Counter-clockwise when seen from above so the faces point UP
            // Triangle 1: (x0,z0), (x0,z1), (x1,z0)
            vertices.push(x0, y00, z0,  x0, y01, z1,  x1, y10, z0);
            // Triangle 2: (x1,z0), (x0,z1), (x1,z1)
            vertices.push(x1, y10, z0,  x0, y01, z1,  x1, y11, z1);
            
            // Same color for both triangles (flat shading per cell)
            for (let v = 0; v < 6; v++) {
                colors.push(r, g, b);
            }
            
            // Compute face normals
            const n1 = computeFaceNormal(x0,y00,z0, x0,y01,z1, x1,y10,z0);
            const n2 = computeFaceNormal(x1,y10,z0, x0,y01,z1, x1,y11,z1);
            for (let v = 0; v < 3; v++) normals.push(n1.x, n1.y, n1.z);
            for (let v = 0; v < 3; v++) normals.push(n2.x, n2.y, n2.z);
        }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = false;
    gameState.scene.add(mesh);
    gameState.terrain = mesh;
    
    createHelipad(gameState);
    gameState.helipad = HELIPAD;

    // Store utility functions in gameState
    gameState.world = {
        size: WORLD_SIZE,
        getHeight: getTerrainHeight,
        isRoad: (x, z) => isOnViaEmilia(x,z) || isOnViaCalandrini(x,z) || isOnSecondaryRoad(x,z) || isCountryRoad(x,z),
        isWater: isRiver,
        isInTown: isInCentroStorico,
        isPiazza: isPiazza,
        roadPaths: generateRoadPaths(),
    };
}

function createHelipad(gameState) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#5a5a5a';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#ffd800';
    g.lineWidth = 4;
    g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(20, 16, 6, 32);
    g.fillRect(38, 16, 6, 32);
    g.fillRect(20, 29, 24, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.CircleGeometry(HELIPAD.r, 20);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const pad = new THREE.Mesh(geo, mat);
    pad.position.set(HELIPAD.x, getTerrainHeight(HELIPAD.x, HELIPAD.z) + 0.25, HELIPAD.z);
    gameState.scene.add(pad);
}

function computeFaceNormal(x0,y0,z0, x1,y1,z1, x2,y2,z2) {
    const ax = x1-x0, ay = y1-y0, az = z1-z0;
    const bx = x2-x0, by = y2-y0, bz = z2-z0;
    const nx = ay*bz - az*by;
    const ny = az*bx - ax*bz;
    const nz = ax*by - ay*bx;
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
    return { x: nx/len, y: ny/len, z: nz/len };
}

// Generate road waypoints for vehicle AI
function generateRoadPaths() {
    const paths = [];
    
    // Via Emilia (east-west)
    const viaEmilia = [];
    for (let x = -900; x <= 900; x += 50) {
        viaEmilia.push(new THREE.Vector3(x, 0.5, -20));
    }
    paths.push({ name: 'Via Emilia', points: viaEmilia, loop: false });
    
    // Via Calandrini (north-south)
    const viaCalandrini = [];
    for (let z = -400; z <= 400; z += 50) {
        viaCalandrini.push(new THREE.Vector3(10, 0.5, z));
    }
    paths.push({ name: 'Via Calandrini', points: viaCalandrini, loop: false });
    
    // Ring road around centro (approximated)
    const ring = [];
    const cx = 0, cz = 0, rx = 210, rz = 160;
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
        ring.push(new THREE.Vector3(
            cx + Math.cos(a) * rx,
            0.5,
            cz + Math.sin(a) * rz
        ));
    }
    ring.push(ring[0].clone());
    paths.push({ name: 'Ring', points: ring, loop: true });
    
    return paths;
}

export function updateTerrain(gameState) {
    // Terrain is static — no update needed
}
