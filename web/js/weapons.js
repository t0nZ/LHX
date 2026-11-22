// ============================================
// WEAPONS.JS — Cannon, Hellfire missiles, lock-on
// ============================================
import * as THREE from 'three';
import { checkBuildingCollision, damageBuilding } from './buildings.js';
import { findTarget, enemyCenter, damageEnemy } from './enemies.js';

const WEAPONS = [
    { name: 'M230 CANNON', ammo: 500, maxAmmo: 500, fireRate: 0.08, damage: 12, speed: 300, type: 'cannon' },
    { name: 'HELLFIRE', ammo: 16, maxAmmo: 16, fireRate: 0.7, damage: 100, speed: 70, type: 'missile' },
];

const LOCK_ANGLE = 0.42;     // ~24 degrees cone
const LOCK_RANGE = 850;

let tracerGeo, tracerMat, missileGeo, missileMat;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

export function initWeapons(gameState) {
    tracerGeo = new THREE.BoxGeometry(0.12, 0.12, 2.2);
    tracerMat = new THREE.MeshBasicMaterial({ color: 0xffff55 });
    missileGeo = new THREE.CylinderGeometry(0.12, 0.18, 2.4, 5);
    missileGeo.rotateX(Math.PI / 2);
    missileMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    gameState.weapons = {
        selected: 0,
        types: WEAPONS.map(w => ({ ...w, lastFired: -10 })),
        projectiles: [],
        lockTarget: null,
    };

    window.addEventListener('keydown', (e) => {
        if (gameState.state !== 'PLAYING') return;
        const w = gameState.weapons;
        if (e.code === 'Digit1') w.selected = 0;
        else if (e.code === 'Digit2') w.selected = 1;
        else if (e.code === 'Tab') w.selected = (w.selected + 1) % w.types.length;
    });
}

export function rearm(gameState) {
    let changed = false;
    for (const t of gameState.weapons.types) {
        if (t.ammo < t.maxAmmo) {
            t.ammo = Math.min(t.maxAmmo, t.ammo + Math.max(1, Math.ceil(t.maxAmmo / 40)));
            changed = true;
        }
    }
    return changed;
}

export function isFullyArmed(gameState) {
    return gameState.weapons.types.every(t => t.ammo >= t.maxAmmo);
}

function aimForward(h) {
    return new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw));
}

export function updateWeapons(gameState) {
    const dt = gameState.delta;
    const input = gameState.input;
    const w = gameState.weapons;
    const h = gameState.helicopter;
    if (!h || !h.group) return;

    if (h.alive) {
        // --- Lock-on (cone ahead of the nose) ---
        const fwd = aimForward(h);
        w.lockTarget = findTarget(gameState, h.position, fwd, LOCK_ANGLE, LOCK_RANGE);

        // --- Fire ---
        const weapon = w.types[w.selected];
        const now = gameState.time;
        if ((input.keys['Space'] || (input.mouseButtons & 1)) && weapon.ammo > 0) {
            if (now - weapon.lastFired >= weapon.fireRate) {
                weapon.lastFired = now;
                weapon.ammo--;
                fireProjectile(gameState, weapon);
            }
        }
    } else {
        w.lockTarget = null;
    }

    updateProjectiles(gameState, dt);
}

function fireProjectile(gameState, weapon) {
    const h = gameState.helicopter;
    const w = gameState.weapons;
    const flat = aimForward(h);
    const target = w.lockTarget;

    // Aim direction: at the locked target (with lead), otherwise along heading, slightly down
    const dir = new THREE.Vector3();
    const origin = h.position.clone().add(new THREE.Vector3(0, -0.8, 0)).addScaledVector(flat, 4);
    if (target) {
        enemyCenter(target, _a);
        const d = _a.distanceTo(origin);
        const t = d / (weapon.speed + 1);
        _a.addScaledVector(target.velocity, weapon.type === 'cannon' ? t : 0);
        dir.copy(_a).sub(origin).normalize();
    } else {
        const down = weapon.type === 'cannon' ? 0.14 : 0.08;
        dir.copy(flat).multiplyScalar(Math.cos(down));
        dir.y = -Math.sin(down);
        dir.normalize();
    }
    if (weapon.type === 'cannon') {
        dir.x += (Math.random() - 0.5) * 0.012;
        dir.y += (Math.random() - 0.5) * 0.012;
        dir.z += (Math.random() - 0.5) * 0.012;
        dir.normalize();
    }

    const horizVel = new THREE.Vector3(h.velocity.x, 0, h.velocity.z);
    const velocity = horizVel.addScaledVector(dir, weapon.speed);

    let mesh;
    if (weapon.type === 'cannon') {
        mesh = new THREE.Mesh(tracerGeo, tracerMat);
        if (gameState.createMuzzleFlash) gameState.createMuzzleFlash(origin);
        if (gameState.audio) gameState.audio.playShot();
    } else {
        mesh = new THREE.Mesh(missileGeo, missileMat);
        if (gameState.audio) gameState.audio.playMissile();
    }
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(velocity));
    gameState.scene.add(mesh);

    w.projectiles.push({
        mesh,
        position: origin.clone(),
        velocity,
        type: weapon.type,
        damage: weapon.damage,
        age: 0,
        maxAge: weapon.type === 'cannon' ? 2.5 : 7.0,
        trailTimer: 0,
        target: weapon.type === 'missile' ? target : null,
        speed: weapon.speed,
    });
}

function segmentHitsSphere(p0, p1, center, radius) {
    _b.copy(p1).sub(p0);
    const len2 = _b.lengthSq();
    let t = 0;
    if (len2 > 0) {
        t = _c.copy(center).sub(p0).dot(_b) / len2;
        t = Math.max(0, Math.min(1, t));
    }
    _c.copy(p0).addScaledVector(_b, t);
    return _c.distanceTo(center) <= radius;
}

function updateProjectiles(gameState, dt) {
    const projectiles = gameState.weapons.projectiles;
    const prev = new THREE.Vector3();
    const mid = new THREE.Vector3();

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.age += dt;
        prev.copy(p.position);

        // --- Missile guidance ---
        if (p.type === 'missile') {
            // accelerate
            p.speed = Math.min(190, p.speed + 120 * dt);
            if (p.target && p.target.alive) {
                enemyCenter(p.target, _a).sub(p.position).normalize();
                const cur = p.velocity.clone().normalize();
                cur.lerp(_a, Math.min(1, dt * 2.6)).normalize();
                p.velocity.copy(cur.multiplyScalar(p.speed));
            } else {
                p.velocity.setLength(p.speed);
                p.velocity.y -= 2 * dt;
            }
            p.mesh.lookAt(_c.copy(p.position).add(p.velocity));
            p.trailTimer += dt;
            if (p.trailTimer > 0.04 && gameState.createSmoke) {
                p.trailTimer = 0;
                gameState.createSmoke(p.position.clone(), 0.7, 1.4);
            }
        }

        p.position.addScaledVector(p.velocity, dt);
        p.mesh.position.copy(p.position);
        mid.copy(prev).add(p.position).multiplyScalar(0.5);

        let hit = false;
        const isMissile = p.type === 'missile';

        // --- Enemies ---
        for (const e of gameState.enemies) {
            if (!e.alive) continue;
            enemyCenter(e, _a);
            if (segmentHitsSphere(prev, p.position, _a, e.def.radius + 0.8)) {
                damageEnemy(gameState, e, p.damage);
                if (gameState.createExplosion) {
                    gameState.createExplosion(p.position.clone(), isMissile ? 5 : 1.2, isMissile ? 'missile' : 'cannon');
                }
                if (isMissile) {
                    splashDamage(gameState, p.position, e);
                    if (gameState.audio) gameState.audio.playExplosion(1.5);
                }
                hit = true;
                break;
            }
        }

        // --- Ground ---
        if (!hit) {
            const groundH = gameState.world ? gameState.world.getHeight(p.position.x, p.position.z) : 0;
            if (p.position.y <= groundH + 0.3) {
                hit = true;
                if (isMissile) {
                    if (gameState.createExplosion) gameState.createExplosion(p.position.clone(), 6, 'missile');
                    if (gameState.audio) gameState.audio.playExplosion(1.5);
                    splashDamage(gameState, p.position, null);
                } else if (gameState.createSmoke) {
                    gameState.createSmoke(p.position.clone(), 1.0, 0.7);
                }
            }
        }

        // --- Buildings ---
        if (!hit) {
            const bh = checkBuildingCollision(gameState, p.position, 0.4) ||
                       checkBuildingCollision(gameState, mid, 0.4);
            if (bh) {
                hit = true;
                damageBuilding(gameState, bh, p.damage);
                if (gameState.createExplosion) {
                    gameState.createExplosion(p.position.clone(), isMissile ? 7 : 1.5, isMissile ? 'missile' : 'cannon');
                }
                if (isMissile && gameState.audio) gameState.audio.playExplosion(2);
            }
        }

        if (p.age >= p.maxAge) {
            hit = true;
            if (isMissile && gameState.createExplosion) gameState.createExplosion(p.position.clone(), 4, 'missile');
        }

        if (hit) {
            gameState.scene.remove(p.mesh);
            projectiles.splice(i, 1);
        }
    }
}

function splashDamage(gameState, pos, skip) {
    const radius = 16;
    for (const e of gameState.enemies) {
        if (!e.alive || e === skip) continue;
        const d = enemyCenter(e, _a).distanceTo(pos);
        if (d < radius) damageEnemy(gameState, e, 70 * (1 - d / radius));
    }
}

export function selectWeapon(gameState, index) {
    if (index >= 0 && index < gameState.weapons.types.length) {
        gameState.weapons.selected = index;
    }
}
