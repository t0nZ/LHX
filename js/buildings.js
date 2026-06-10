// ============================================
// BUILDINGS.JS — Destructible Buildings
// ============================================
import * as THREE from 'three';

// Building color palette (Romagna architecture)
const BUILDING_COLORS = [
    0xd4c4a0, // Beige
    0xc4a882, // Sandstone
    0xb89878, // Terracotta light
    0xcc8866, // Terracotta
    0xddccaa, // Cream
    0xc8b898, // Warm stone
    0xe0d0b8, // Off-white
];

const ROOF_COLORS = [
    0x994422, // Red tile
    0x883322, // Dark red tile
    0xaa5533, // Orange tile
    0x775533, // Brown
];

export function initBuildings(gameState) {
    gameState.buildings = [];
    
    // ---- CENTRO STORICO BUILDINGS ----
    // Generate buildings along streets inside the old town walls
    
    const buildingDefs = [];
    
    // Seeded random
    let seed = 42;
    function rand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return seed / 2147483647;
    }
    
    // --- LANDMARK BUILDINGS ---
    
    // Torre Civica (tall tower in piazza)
    buildingDefs.push({
        x: 25, z: -10, w: 4, h: 25, d: 4,
        color: 0xc8a878, roofColor: 0x666666,
        roofType: 'pyramid', name: 'Torre Civica', health: 300,
    });
    
    // Chiesa (church - larger, cross-shaped approximated as rectangle)
    buildingDefs.push({
        x: -40, z: -30, w: 12, h: 18, d: 25,
        color: 0xd8c8a8, roofColor: 0x884422,
        roofType: 'gable', name: 'Chiesa', health: 400,
    });
    
    // Bell tower of chiesa
    buildingDefs.push({
        x: -30, z: -18, w: 4, h: 22, d: 4,
        color: 0xd0c0a0, roofColor: 0x666666,
        roofType: 'pyramid', name: 'Campanile', health: 250,
    });
    
    // Municipio (town hall on piazza)
    buildingDefs.push({
        x: -15, z: -35, w: 18, h: 12, d: 10,
        color: 0xddccaa, roofColor: 0x994422,
        roofType: 'gable', name: 'Municipio', health: 250,
    });
    
    // --- REGULAR BUILDINGS IN CENTRO ---
    // Generate along street grid
    const blockSpots = [];
    
    // Blocks between streets
    for (let bx = -170; bx < 170; bx += 40) {
        for (let bz = -130; bz < 130; bz += 35) {
            // Skip piazza area
            if (Math.abs(bx - 10) < 40 && Math.abs(bz + 20) < 30) continue;
            // Skip chiesa area
            if (Math.abs(bx + 40) < 20 && Math.abs(bz + 30) < 20) continue;
            
            const w = 6 + rand() * 10;
            const d = 6 + rand() * 10;
            const h = 5 + rand() * 8;
            
            if (rand() > 0.3) { // 70% fill rate
                buildingDefs.push({
                    x: bx + rand() * 10,
                    z: bz + rand() * 8,
                    w, h, d,
                    color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
                    roofColor: ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)],
                    roofType: rand() > 0.5 ? 'gable' : 'flat',
                    health: 100,
                });
            }
        }
    }
    
    // --- COUNTRYSIDE BUILDINGS (farmhouses) ---
    for (let i = 0; i < 40; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = 300 + rand() * 500;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        
        // Avoid water
        if (gameState.world && gameState.world.isWater(x, z)) continue;
        if (gameState.world && gameState.world.isRoad(x, z)) continue;
        
        buildingDefs.push({
            x, z,
            w: 8 + rand() * 6,
            h: 4 + rand() * 3,
            d: 10 + rand() * 6,
            color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
            roofColor: ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)],
            roofType: 'gable',
            name: 'Casale',
            health: 80,
        });
    }
    
    // Create meshes for all buildings
    for (const def of buildingDefs) {
        createBuilding(gameState, def);
    }
}

function createBuilding(gameState, def) {
    const group = new THREE.Group();
    const groundY = gameState.world ? gameState.world.getHeight(def.x, def.z) : 0;
    
    // Main building body
    const bodyGeo = new THREE.BoxGeometry(def.w, def.h, def.d);
    const bodyMat = new THREE.MeshLambertMaterial({
        color: def.color,
        flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = def.h / 2;
    group.add(body);
    
    // Roof
    if (def.roofType === 'pyramid') {
        const roofGeo = new THREE.ConeGeometry(
            Math.max(def.w, def.d) * 0.75, def.h * 0.3, 4
        );
        const roofMat = new THREE.MeshLambertMaterial({
            color: def.roofColor,
            flatShading: true,
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = def.h + def.h * 0.15;
        roof.rotation.y = Math.PI / 4;
        group.add(roof);
    } else if (def.roofType === 'gable') {
        // Triangular prism roof
        const roofHeight = def.h * 0.3;
        const roofGeo = createGableRoofGeo(def.w * 1.1, roofHeight, def.d * 1.1);
        const roofMat = new THREE.MeshLambertMaterial({
            color: def.roofColor,
            flatShading: true,
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = def.h;
        group.add(roof);
    }
    
    group.position.set(def.x, groundY, def.z);
    gameState.scene.add(group);
    
    gameState.buildings.push({
        group: group,
        body: body,
        position: new THREE.Vector3(def.x, groundY, def.z),
        width: def.w,
        height: def.h,
        depth: def.d,
        health: def.health || 100,
        maxHealth: def.health || 100,
        destroyed: false,
        name: def.name || 'Edificio',
        originalColor: def.color,
        flashTimer: 0,
    });
}

function createGableRoofGeo(width, height, depth) {
    const hw = width / 2;
    const hd = depth / 2;
    
    const vertices = new Float32Array([
        // Front face
        -hw, 0, hd,    hw, 0, hd,     0, height, hd,
        // Back face
        hw, 0, -hd,   -hw, 0, -hd,    0, height, -hd,
        // Left slope
        -hw, 0, hd,    0, height, hd,   0, height, -hd,
        -hw, 0, hd,    0, height, -hd, -hw, 0, -hd,
        // Right slope
        hw, 0, hd,     hw, 0, -hd,      0, height, -hd,
        hw, 0, hd,     0, height, -hd,  0, height, hd,
        // Bottom
        -hw, 0, hd,   -hw, 0, -hd,     hw, 0, -hd,
        -hw, 0, hd,    hw, 0, -hd,     hw, 0, hd,
    ]);
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
}

export function updateBuildings(gameState) {
    const dt = gameState.delta;
    
    for (const b of gameState.buildings) {
        if (b.destroyed) continue;
        
        // Damage flash effect
        if (b.flashTimer > 0) {
            b.flashTimer -= dt;
            if (b.flashTimer <= 0) {
                b.body.material.color.set(b.originalColor);
                b.body.material.emissive.set(0x000000);
            }
        }
    }
}

export function damageBuilding(gameState, building, damage) {
    if (building.destroyed) return;
    
    building.health -= damage;
    
    // Flash red on hit
    building.body.material.color.set(0xff4444);
    building.body.material.emissive.set(0x441111);
    building.flashTimer = 0.15;
    
    if (building.health <= 0) {
        destroyBuilding(gameState, building);
    }
}

function destroyBuilding(gameState, building) {
    building.destroyed = true;
    
    // Collapse animation: scale down rapidly
    const collapse = { progress: 0 };
    const originalScale = building.group.scale.clone();
    
    function animateCollapse() {
        collapse.progress += 0.03;
        if (collapse.progress >= 1) {
            // Replace with rubble
            building.group.visible = false;
            createRubble(gameState, building);
            return;
        }
        
        const t = collapse.progress;
        building.group.scale.y = originalScale.y * (1 - t * 0.9);
        building.group.scale.x = originalScale.x * (1 + t * 0.3);
        building.group.scale.z = originalScale.z * (1 + t * 0.3);
        building.group.position.y = building.position.y - t * building.height * 0.4;
        
        // Shake
        building.group.position.x = building.position.x + (Math.random() - 0.5) * t * 2;
        building.group.position.z = building.position.z + (Math.random() - 0.5) * t * 2;
        
        requestAnimationFrame(animateCollapse);
    }
    animateCollapse();
    
    // Trigger explosion (handled by effects module)
    if (gameState.createExplosion) {
        gameState.createExplosion(
            building.position.clone().add(new THREE.Vector3(0, building.height / 2, 0)),
            building.width * 1.5,
            'building'
        );
    }
    
    // Notification
    showNotification(gameState, `${building.name} DESTROYED!`);
}

function createRubble(gameState, building) {
    const rubbleGeo = new THREE.BoxGeometry(
        building.width * 1.2, building.height * 0.15, building.depth * 1.2
    );
    const rubbleMat = new THREE.MeshLambertMaterial({
        color: 0x666655,
        flatShading: true,
    });
    const rubble = new THREE.Mesh(rubbleGeo, rubbleMat);
    rubble.position.copy(building.position);
    rubble.position.y += building.height * 0.075;
    gameState.scene.add(rubble);
}

function showNotification(gameState, text) {
    const container = document.getElementById('hud-notifications');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = text;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// Collision check: is a point inside a building's bounding box?
export function checkBuildingCollision(gameState, point, radius = 1) {
    for (const b of gameState.buildings) {
        if (b.destroyed) continue;
        const dx = Math.abs(point.x - b.position.x);
        const dz = Math.abs(point.z - b.position.z);
        const dy = point.y - b.position.y;
        
        if (dx < (b.width / 2 + radius) &&
            dz < (b.depth / 2 + radius) &&
            dy > -radius && dy < b.height + radius) {
            return b;
        }
    }
    return null;
}
