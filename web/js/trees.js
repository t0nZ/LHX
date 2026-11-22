// ============================================
// TREES.JS — Real OSM trees, tree rows & woodland/orchard instancing
// --------------------------------------------
// Places trees from baked OpenStreetMap features:
//   1. Real OSM tree nodes (osm.trees)
//   2. Real OSM tree_row polylines (osm.treeRows)
//   3. Seeded fills inside real forest / wood / scrub / park / orchard areas
//   4. Sparse countryside accents along open farmland (avoiding roads/water/buildings)
// Rendered in ONLY 4 InstancedMesh draw calls total (2 species x trunk/canopy)
// so Intel integrated GPUs stay smooth.
// ============================================
import * as THREE from 'three';
import { checkBuildingCollision } from './buildings.js';

const QUALITY = new URLSearchParams(location.search).get('q') || 'auto';
const MAX_CONIFERS = QUALITY === 'lo' ? 400 : QUALITY === 'hi' ? 1400 : 850;
const MAX_BROADLEAF = QUALITY === 'lo' ? 500 : QUALITY === 'hi' ? 1800 : 1100;

const CONIFER_COLORS = [0x265c28, 0x2f6c30, 0x1f5222, 0x357534];
const BROAD_COLORS = [0x3d7f32, 0x4b8f38, 0x32722c, 0x5c963d, 0x497c2f];

function pointInPoly(x, z, p) {
    let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
}

export function initTrees(gameState) {
    const world = gameState.world;
    const osm = world.osm;
    const half = world.size / 2 - 40;
    const pad = gameState.helipad;

    let seed = 12345;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const probe = new THREE.Vector3();
    const canPlace = (x, z, checkTown = false) => {
        if (Math.abs(x) > half || Math.abs(z) > half) return false;
        if (pad && Math.hypot(x - pad.x, z - pad.z) < pad.r + 22) return false;
        if (world.isRoad(x, z) || world.isWater(x, z)) return false;
        if (checkTown && world.isInTown(x, z)) return false;
        probe.set(x, world.getHeight(x, z) + 2, z);
        if (checkBuildingCollision(gameState, probe, 3.5)) return false;
        return true;
    };

    const conifers = [];   // { x, y, z, s, ry, col }
    const broadleaf = [];  // { x, y, z, s, ry, col }
    const addTree = (x, z, kind, scaleMin = 0.75, scaleMax = 1.45) => {
        const list = kind === 'conifer' ? conifers : broadleaf;
        const cap = kind === 'conifer' ? MAX_CONIFERS : MAX_BROADLEAF;
        if (list.length >= cap) return false;
        const y = world.getHeight(x, z);
        const palette = kind === 'conifer' ? CONIFER_COLORS : BROAD_COLORS;
        list.push({
            x, y, z,
            s: scaleMin + rand() * (scaleMax - scaleMin),
            ry: rand() * Math.PI * 2,
            col: palette[(rand() * palette.length) | 0],
        });
        return true;
    };

    // 1. Real OSM individual trees
    for (let i = 0; i < osm.trees.length; i += 2) {
        const x = osm.trees[i], z = osm.trees[i + 1];
        if (!canPlace(x, z, false)) continue;
        addTree(x, z, rand() < 0.35 ? 'conifer' : 'broad', 0.85, 1.35);
    }

    // 2. Real OSM tree rows (sample every ~14 m)
    for (const row of osm.treeRows || []) {
        for (let i = 0; i < row.length - 2; i += 2) {
            const x0 = row[i], z0 = row[i + 1], x1 = row[i + 2], z1 = row[i + 3];
            const len = Math.hypot(x1 - x0, z1 - z0);
            const steps = Math.max(1, Math.floor(len / 14));
            for (let k = 0; k <= steps; k++) {
                const t = k / steps;
                const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
                if (!canPlace(x, z, false)) continue;
                addTree(x, z, rand() < 0.45 ? 'conifer' : 'broad', 0.8, 1.25);
            }
        }
    }

    // 3. Real OSM woods, forests, parks, scrub, orchards
    const WOOD_KINDS = new Set(['forest', 'wood', 'scrub', 'park', 'orchard', 'garden']);
    for (const a of osm.areas || []) {
        if (!WOOD_KINDS.has(a.k) || a.p.length < 6) continue;
        let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
        for (let i = 0; i < a.p.length; i += 2) {
            const x = a.p[i], z = a.p[i + 1];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        const bw = maxX - minX, bd = maxZ - minZ;
        if (bw < 12 || bd < 12) continue;
        const density = (a.k === 'forest' || a.k === 'wood') ? 1 / 450 : a.k === 'park' ? 1 / 650 : 1 / 1400;
        const target = Math.min(45, Math.max(2, Math.round(bw * bd * density)));
        const isOrchard = a.k === 'orchard';
        for (let t = 0; t < target * 2 && (conifers.length < MAX_CONIFERS || broadleaf.length < MAX_BROADLEAF); t++) {
            const x = minX + rand() * bw, z = minZ + rand() * bd;
            if (!pointInPoly(x, z, a.p)) continue;
            if (!canPlace(x, z, false)) continue;
            const kind = isOrchard ? 'broad' : (a.k === 'forest' || a.k === 'wood') ? (rand() < 0.65 ? 'conifer' : 'broad') : (rand() < 0.3 ? 'conifer' : 'broad');
            addTree(x, z, kind, isOrchard ? 0.55 : 0.75, isOrchard ? 0.85 : 1.55);
        }
    }

    // 4. Sparse Romagna countryside trees (hills get more conifers, plains get more broadleaf)
    for (let i = 0; i < 4500 && (conifers.length < MAX_CONIFERS || broadleaf.length < MAX_BROADLEAF); i++) {
        const x = (rand() - 0.5) * world.size * 0.94;
        const z = (rand() - 0.5) * world.size * 0.94;
        if (!canPlace(x, z, true)) continue;
        const y = world.getHeight(x, z);
        const onHills = y > 20;
        if (!onHills && rand() > 0.35) continue;
        const kind = onHills ? (rand() < 0.7 ? 'conifer' : 'broad') : (rand() < 0.35 ? 'conifer' : 'broad');
        addTree(x, z, kind, 0.75, 1.45);
    }

    // Build 4 InstancedMeshes total
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const buildSpecies = (list, trunkGeo, canopyGeo, trunkY, canopyY, trunkHex) => {
        const n = list.length;
        if (n === 0) return null;
        const tMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: trunkHex, flatShading: true }), n);
        const cMesh = new THREE.InstancedMesh(canopyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), n);
        for (let i = 0; i < n; i++) {
            const tr = list[i];
            dummy.scale.set(tr.s, tr.s, tr.s);
            dummy.rotation.set(0, tr.ry, 0);
            dummy.position.set(tr.x, tr.y + trunkY * tr.s, tr.z);
            dummy.updateMatrix();
            tMesh.setMatrixAt(i, dummy.matrix);

            dummy.position.set(tr.x, tr.y + canopyY * tr.s, tr.z);
            dummy.updateMatrix();
            cMesh.setMatrixAt(i, dummy.matrix);
            cMesh.setColorAt(i, tmpColor.setHex(tr.col));
        }
        tMesh.instanceMatrix.needsUpdate = true;
        cMesh.instanceMatrix.needsUpdate = true;
        if (cMesh.instanceColor) cMesh.instanceColor.needsUpdate = true;
        tMesh.frustumCulled = false;
        cMesh.frustumCulled = false;
        gameState.scene.add(tMesh);
        gameState.scene.add(cMesh);
        return { tMesh, cMesh };
    };

    const con = buildSpecies(
        conifers,
        new THREE.CylinderGeometry(0.35, 0.55, 3.0, 5),
        new THREE.ConeGeometry(2.5, 5.5, 5),
        1.5, 5.2, 0x5c3a1e
    );
    const brd = buildSpecies(
        broadleaf,
        new THREE.CylinderGeometry(0.3, 0.45, 2.6, 4),
        new THREE.IcosahedronGeometry(2.2, 0),
        1.3, 4.1, 0x6b4426
    );

    gameState.trees = [...conifers, ...broadleaf];
    gameState.treeMeshes = { conifers: con, broadleaf: brd };
    console.info(`[trees] ${conifers.length} conifers + ${broadleaf.length} broadleaf (4 draw calls)`);
}

export function updateTrees() { /* static */ }
