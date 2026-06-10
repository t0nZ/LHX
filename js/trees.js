// ============================================
// TREES.JS — Procedural Low-Poly Trees
// ============================================
import * as THREE from 'three';
import { WORLD_SIZE } from './terrain.js';

const TREE_COUNT = 800;

// Create a single tree geometry (cone + cylinder)
function createTreeGeometry(scale = 1) {
    const group = new THREE.Group();
    
    // Trunk (cylinder)
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 3 * scale, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5 * scale;
    
    // Canopy (cone)
    const canopyGeo = new THREE.ConeGeometry(2.5 * scale, 5 * scale, 6);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2d6b30, flatShading: true });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 5 * scale;
    
    return { trunkGeo, trunkMat, canopyGeo, canopyMat };
}

// Merge tree parts into instanced meshes for performance
export function initTrees(gameState) {
    const world = gameState.world;
    const half = WORLD_SIZE / 2;
    
    // Create base geometries
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 3, 5);
    const canopyGeo = new THREE.ConeGeometry(2.5, 5, 6);
    
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e, flatShading: true });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2d6b30, flatShading: true });
    
    // Alternate canopy colors for variety
    const canopyMats = [
        new THREE.MeshLambertMaterial({ color: 0x2d6b30, flatShading: true }),
        new THREE.MeshLambertMaterial({ color: 0x357a35, flatShading: true }),
        new THREE.MeshLambertMaterial({ color: 0x256025, flatShading: true }),
        new THREE.MeshLambertMaterial({ color: 0x408040, flatShading: true }),
    ];
    
    const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
    const canopyInstanced = new THREE.InstancedMesh(canopyGeo, canopyMats[0], TREE_COUNT);
    
    const dummy = new THREE.Object3D();
    const treePositions = [];
    let placed = 0;
    
    // Seeded random for consistent placement
    let seed = 12345;
    function rand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return seed / 2147483647;
    }
    
    const attempts = TREE_COUNT * 10;
    for (let i = 0; i < attempts && placed < TREE_COUNT; i++) {
        const x = (rand() - 0.5) * WORLD_SIZE;
        const z = (rand() - 0.5) * WORLD_SIZE;
        
        // Don't place on roads, water, or piazza
        if (world.isRoad(x, z)) continue;
        if (world.isWater(x, z)) continue;
        if (world.isPiazza(x, z)) continue;
        
        // Sparse in centro storico, dense in countryside
        if (world.isInTown(x, z)) {
            if (rand() > 0.15) continue; // Only 15% chance in town
        }
        
        // Avoid very center of town (buildings area)
        if (Math.abs(x) < 100 && Math.abs(z) < 80) continue;
        
        const y = world.getHeight(x, z);
        const scale = 0.7 + rand() * 0.8;
        const rotation = rand() * Math.PI * 2;
        
        // Trunk
        dummy.position.set(x, y + 1.5 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.y = rotation;
        dummy.updateMatrix();
        trunkInstanced.setMatrixAt(placed, dummy.matrix);
        
        // Canopy (higher up)
        dummy.position.set(x, y + 5 * scale, z);
        dummy.updateMatrix();
        canopyInstanced.setMatrixAt(placed, dummy.matrix);
        
        // Color variation for canopy
        const colorIndex = Math.floor(rand() * canopyMats.length);
        canopyInstanced.setColorAt(placed, canopyMats[colorIndex].color);
        
        treePositions.push(new THREE.Vector3(x, y, z));
        placed++;
    }
    
    // Update count if we placed fewer
    trunkInstanced.count = placed;
    canopyInstanced.count = placed;
    trunkInstanced.instanceMatrix.needsUpdate = true;
    canopyInstanced.instanceMatrix.needsUpdate = true;
    if (canopyInstanced.instanceColor) canopyInstanced.instanceColor.needsUpdate = true;
    
    gameState.scene.add(trunkInstanced);
    gameState.scene.add(canopyInstanced);
    
    gameState.trees = treePositions;
    gameState.treeMeshes = { trunks: trunkInstanced, canopies: canopyInstanced };
    
    // Also place some rows of trees along field edges
    placeFieldRows(gameState, rand);
}

function placeFieldRows(gameState, rand) {
    const rowTrees = [];
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.5, 4);
    const canopyGeo = new THREE.SphereGeometry(1.8, 5, 4); // Round trees for variety
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4226, flatShading: true });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x3a8a3a, flatShading: true });
    
    const count = 200;
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    const dummy = new THREE.Object3D();
    
    let placed = 0;
    // Rows along Via Emilia outside town
    for (let x = -900; x < 900 && placed < count; x += 15) {
        if (Math.abs(x) < 220) continue; // Skip town area
        const side = (placed % 2 === 0) ? -35 : 35;
        const z = -20 + side + (rand() - 0.5) * 3;
        const y = gameState.world.getHeight(x, z);
        const s = 0.8 + rand() * 0.4;
        
        dummy.position.set(x, y + 1.25 * s, z);
        dummy.scale.set(s, s, s);
        dummy.rotation.y = rand() * Math.PI * 2;
        dummy.updateMatrix();
        trunkInst.setMatrixAt(placed, dummy.matrix);
        
        dummy.position.y = y + 3.5 * s;
        dummy.updateMatrix();
        canopyInst.setMatrixAt(placed, dummy.matrix);
        
        placed++;
    }
    
    trunkInst.count = placed;
    canopyInst.count = placed;
    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    
    gameState.scene.add(trunkInst);
    gameState.scene.add(canopyInst);
}

export function updateTrees(gameState) {
    // Trees are static
}
