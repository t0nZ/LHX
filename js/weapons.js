// ============================================
// WEAPONS.JS — Cannon & Missiles
// ============================================
import * as THREE from 'three';
import { checkBuildingCollision, damageBuilding } from './buildings.js';

const WEAPONS = [
    { name: 'M230 CANNON', ammo: 500, maxAmmo: 500, fireRate: 0.08, damage: 15, speed: 400, type: 'cannon' },
    { name: 'HELLFIRE', ammo: 16, maxAmmo: 16, fireRate: 0.8, damage: 100, speed: 120, type: 'missile' },
];

export function initWeapons(gameState) {
    gameState.weapons = {
        selected: 0,
        types: WEAPONS.map(w => ({ ...w })),
        projectiles: [],
    };
}

export function updateWeapons(gameState) {
    const dt = gameState.delta;
    const input = gameState.input;
    const w = gameState.weapons;
    const h = gameState.helicopter;
    if (!h || !h.group) return;
    
    // Weapon selection
    if (input.keys['Digit1']) w.selected = 0;
    if (input.keys['Digit2']) w.selected = 1;
    
    // Fire
    const weapon = w.types[w.selected];
    const now = gameState.time;
    
    if ((input.keys['Space'] || (input.mouseButtons & 1)) && weapon.ammo > 0) {
        if (now - weapon.lastFired >= weapon.fireRate) {
            weapon.lastFired = now;
            weapon.ammo--;
            fireProjectile(gameState, weapon);
        }
    }
    
    // Update projectiles
    updateProjectiles(gameState, dt);
}

function fireProjectile(gameState, weapon) {
    const h = gameState.helicopter;
    
    // Spawn position: slightly ahead and below helicopter
    const forward = new THREE.Vector3(0, -0.2, 1).normalize();
    forward.applyQuaternion(h.group.quaternion);
    
    const spawnPos = h.position.clone().add(forward.clone().multiplyScalar(4));
    
    // Velocity: helicopter velocity + weapon speed in forward direction
    const velocity = h.velocity.clone().add(
        forward.clone().multiplyScalar(weapon.speed)
    );
    
    // Create projectile mesh
    let mesh;
    if (weapon.type === 'cannon') {
        // Tracer round: small bright box
        const geo = new THREE.BoxGeometry(0.1, 0.1, 1.5);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffff44 });
        mesh = new THREE.Mesh(geo, mat);
        
        // Muzzle flash
        if (gameState.createMuzzleFlash) {
            gameState.createMuzzleFlash(spawnPos);
        }
    } else {
        // Missile: longer, with glow
        const geo = new THREE.CylinderGeometry(0.1, 0.15, 2, 4);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff8844 });
        mesh = new THREE.Mesh(geo, mat);
    }
    
    mesh.position.copy(spawnPos);
    mesh.lookAt(spawnPos.clone().add(velocity));
    gameState.scene.add(mesh);
    
    gameState.weapons.projectiles.push({
        mesh,
        position: spawnPos.clone(),
        velocity: velocity.clone(),
        type: weapon.type,
        damage: weapon.damage,
        age: 0,
        maxAge: weapon.type === 'cannon' ? 2.0 : 5.0,
        trailTimer: 0,
    });
}

function updateProjectiles(gameState, dt) {
    const projectiles = gameState.weapons.projectiles;
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.age += dt;
        
        // Move
        p.position.add(p.velocity.clone().multiplyScalar(dt));
        p.mesh.position.copy(p.position);
        
        // Gravity for missiles
        if (p.type === 'missile') {
            p.velocity.y -= 3 * dt;
            p.mesh.lookAt(p.position.clone().add(p.velocity));
            
            // Smoke trail
            p.trailTimer += dt;
            if (p.trailTimer > 0.05 && gameState.createSmoke) {
                p.trailTimer = 0;
                gameState.createSmoke(p.position.clone(), 0.5, 1.5);
            }
        }
        
        let hit = false;
        
        // Ground collision
        const groundH = gameState.world ? gameState.world.getHeight(p.position.x, p.position.z) : 0;
        if (p.position.y <= groundH + 0.5) {
            hit = true;
            if (gameState.createExplosion) {
                const size = p.type === 'cannon' ? 2 : 8;
                gameState.createExplosion(p.position.clone(), size, p.type);
            }
        }
        
        // Building collision
        const buildingHit = checkBuildingCollision(gameState, p.position, 0.5);
        if (buildingHit) {
            hit = true;
            damageBuilding(gameState, buildingHit, p.damage);
            if (gameState.createExplosion) {
                const size = p.type === 'cannon' ? 2 : 8;
                gameState.createExplosion(p.position.clone(), size, p.type);
            }
        }
        
        // Max age
        if (p.age >= p.maxAge) hit = true;
        
        if (hit) {
            gameState.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            projectiles.splice(i, 1);
        }
    }
}

export function selectWeapon(gameState, index) {
    if (index >= 0 && index < gameState.weapons.types.length) {
        gameState.weapons.selected = index;
    }
}
