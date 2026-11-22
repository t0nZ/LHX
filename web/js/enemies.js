// ============================================
// ENEMIES.JS — Enemy tanks, AA guns and attack helicopters
// ============================================
import * as THREE from 'three';
import { damagePlayer } from './helicopter.js';
import { checkBuildingCollision } from './buildings.js';
import { notify } from './hud.js';

const TYPES = {
    tank: { name: 'TANK',        hp: 80, radius: 4.5, centerY: 1.6, score: 100, range: 420 },
    aa:   { name: 'AA GUN',      hp: 50, radius: 3.2, centerY: 1.8, score: 150, range: 520 },
    heli: { name: 'ENEMY HELI',  hp: 60, radius: 5.0, centerY: 0.5, score: 250, range: 380 },
};

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

const mats = {};

function mat(color) {
    return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function initEnemies(gameState) {
    gameState.enemies = [];
    gameState.enemyShots = [];

    mats.shellGeo = new THREE.BoxGeometry(0.5, 0.5, 3.2);
    mats.bulletGeo = new THREE.BoxGeometry(0.25, 0.25, 2.2);
    mats.shellMat = new THREE.MeshBasicMaterial({ color: 0xff5533 });
    mats.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
}

// ---------- MODELS ----------
function buildTank() {
    const g = new THREE.Group();
    const hullMat = mat(0x7a3b2e);
    const trackMat = mat(0x2a2a2a);
    const turretMat = mat(0x5e2c22);

    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 6.2), hullMat);
    hull.position.y = 1.0;
    g.add(hull);

    for (const s of [-1, 1]) {
        const track = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 6.8), trackMat);
        track.position.set(s * 2.1, 0.7, 0);
        g.add(track);
    }

    const turret = new THREE.Group();
    turret.position.y = 1.9;
    const tBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 2.8), turretMat);
    turret.add(tBody);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 4.2), mat(0x333333));
    barrel.position.set(0, 0.1, 3.2);
    turret.add(barrel);
    // red marking
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    mark.position.set(0, 0.48, -0.2);
    turret.add(mark);
    g.add(turret);

    return { group: g, turret };
}

function buildAA() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.3, 1.0, 6), mat(0x4a4a3a));
    base.position.y = 0.5;
    g.add(base);
    // sandbags
    const bagMat = mat(0x9a8a60);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const bag = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.9), bagMat);
        bag.position.set(Math.cos(a) * 3.2, 0.4, Math.sin(a) * 3.2);
        bag.rotation.y = -a + Math.PI / 2;
        g.add(bag);
    }
    const turret = new THREE.Group();
    turret.position.y = 1.4;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.8), mat(0x7a3b2e));
    turret.add(body);
    for (const s of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 3.4), mat(0x222222));
        b.position.set(s * 0.6, 0.35, 2.0);
        b.rotation.x = -0.35;
        turret.add(b);
    }
    g.add(turret);
    return { group: g, turret };
}

function buildHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 5.5), mat(0x6a2e26));
    g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.8), mat(0x3a1f1a));
    nose.position.set(0, -0.2, 3.2);
    g.add(nose);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.6),
        new THREE.MeshLambertMaterial({ color: 0xaa4433, flatShading: true, transparent: true, opacity: 0.7 }));
    glass.position.set(0, 0.5, 2.3);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 5.5), mat(0x5a281f));
    tail.position.set(0, 0.5, -5.0);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.2), mat(0x5a281f));
    fin.position.set(0, 1.2, -7.4);
    g.add(fin);
    for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.9), mat(0x3a1f1a));
        wing.position.set(s * 2.0, -0.2, 0.2);
        g.add(wing);
    }
    const rotor = new THREE.Group();
    rotor.position.y = 1.2;
    for (let i = 0; i < 2; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.4), mat(0x1a1a1a));
        blade.rotation.y = i * Math.PI / 2;
        rotor.add(blade);
    }
    g.add(rotor);
    g.scale.setScalar(1.2);
    return { group: g, turret: null, rotor };
}

// ---------- SPAWN ----------
export function spawnEnemy(gameState, type, x, z, opts = {}) {
    const def = TYPES[type];
    let built;
    if (type === 'tank') built = buildTank();
    else if (type === 'aa') built = buildAA();
    else built = buildHeli();

    const groundY = gameState.world.getHeight(x, z);
    const y = type === 'heli' ? groundY + (opts.altitude || 60) : groundY;
    built.group.position.set(x, y, z);
    gameState.scene.add(built.group);

    const enemy = {
        type,
        def,
        mesh: built.group,
        turret: built.turret,
        rotor: built.rotor || null,
        position: built.group.position,
        velocity: new THREE.Vector3(),
        hp: def.hp * (opts.hpScale || 1),
        maxHp: def.hp * (opts.hpScale || 1),
        alive: true,
        heading: Math.random() * Math.PI * 2,
        home: new THREE.Vector3(x, 0, z),
        target: new THREE.Vector3(x, 0, z),
        retarget: 0,
        fireTimer: 1 + Math.random() * 3,
        burst: 0,
        flash: 0,
        smokeTimer: 0,
        wreckAge: 0,
        orbitAngle: Math.random() * Math.PI * 2,
        aggression: opts.aggression || 1,
    };
    gameState.enemies.push(enemy);
    return enemy;
}

export function clearEnemies(gameState) {
    for (const e of gameState.enemies) gameState.scene.remove(e.mesh);
    gameState.enemies.length = 0;
    for (const s of gameState.enemyShots) gameState.scene.remove(s.mesh);
    gameState.enemyShots.length = 0;
}

export function countAlive(gameState) {
    let n = 0;
    for (const e of gameState.enemies) if (e.alive) n++;
    return n;
}

// ---------- DAMAGE ----------
export function enemyCenter(e, out = _v) {
    return out.set(e.position.x, e.position.y + e.def.centerY, e.position.z);
}

export function damageEnemy(gameState, enemy, damage) {
    if (!enemy.alive) return;
    enemy.hp -= damage;
    enemy.flash = 0.12;
    setEmissive(enemy.mesh, 0xff5500);
    if (enemy.hp <= 0) killEnemy(gameState, enemy);
}

function setEmissive(root, hex) {
    root.traverse(o => {
        if (o.material && o.material.emissive) o.material.emissive.setHex(hex);
    });
}

function killEnemy(gameState, enemy) {
    enemy.alive = false;
    const c = enemyCenter(enemy, new THREE.Vector3());
    const size = enemy.type === 'heli' ? 7 : 6;
    if (gameState.createExplosion) gameState.createExplosion(c, size, 'missile');
    if (gameState.audio) gameState.audio.playExplosion(2);

    if (enemy.type === 'heli') {
        // falls from the sky as a burning wreck
        enemy.falling = true;
        enemy.velocity.set(enemy.velocity.x, 0, enemy.velocity.z);
    }

    // Charred wreck
    enemy.mesh.traverse(o => {
        if (o.material && o.material.color && !o.material.isMeshBasicMaterial) {
            o.material.color.setHex(0x1c1c1c);
            if (o.material.emissive) o.material.emissive.setHex(0x000000);
        }
    });
    if (enemy.turret) enemy.turret.rotation.y += 0.4;

    if (gameState.onEnemyKilled) gameState.onEnemyKilled(enemy);
}

// ---------- LOCK-ON ----------
export function findTarget(gameState, origin, dir, maxAngle, maxDist) {
    let best = null;
    let bestScore = Infinity;
    const cosMax = Math.cos(maxAngle);
    for (const e of gameState.enemies) {
        if (!e.alive) continue;
        enemyCenter(e, _w);
        _w.sub(origin);
        const d = _w.length();
        if (d > maxDist || d < 5) continue;
        _w.divideScalar(d);
        const cosA = _w.dot(dir);
        if (cosA < cosMax) continue;
        const score = (1 - cosA) * 400 + d * 0.01;
        if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
}

// ---------- ENEMY FIRE ----------
function fireShot(gameState, from, kind, spread) {
    const h = gameState.helicopter;
    const speed = kind === 'shell' ? 120 : 210;
    const dist = from.distanceTo(h.position);
    const flight = dist / speed;
    // lead the target a bit
    _v.copy(h.position).addScaledVector(h.velocity, flight * 0.75);
    _v.x += (Math.random() - 0.5) * spread * dist;
    _v.y += (Math.random() - 0.5) * spread * dist * 0.6;
    _v.z += (Math.random() - 0.5) * spread * dist;
    const dir = _v.sub(from).normalize().clone(); // clone: _v is a shared scratch vector

    const mesh = new THREE.Mesh(kind === 'shell' ? mats.shellGeo : mats.bulletGeo,
        kind === 'shell' ? mats.shellMat : mats.bulletMat);
    mesh.position.copy(from);
    mesh.lookAt(from.clone().add(dir));
    gameState.scene.add(mesh);
    gameState.enemyShots.push({
        mesh,
        position: from.clone(),
        velocity: dir.multiplyScalar(speed),
        age: 0,
        life: 4,
        damage: kind === 'shell' ? 14 : 5,
        kind,
    });
    if (gameState.createMuzzleFlash) gameState.createMuzzleFlash(from.clone());
    if (gameState.audio) gameState.audio.playEnemyFire(kind === 'shell');
}

// ---------- UPDATE ----------
export function updateEnemies(gameState) {
    const dt = gameState.delta;
    const h = gameState.helicopter;
    if (!h) return;

    for (const e of gameState.enemies) {
        if (e.flash > 0) {
            e.flash -= dt;
            if (e.flash <= 0 && e.alive) setEmissive(e.mesh, 0x000000);
        }
        if (!e.alive) {
            updateWreck(gameState, e, dt);
            continue;
        }
        const dx = h.position.x - e.position.x;
        const dz = h.position.z - e.position.z;
        const dh = Math.hypot(dx, dz);
        const dist = Math.hypot(dh, h.position.y - (e.position.y + e.def.centerY));
        const sees = h.alive && dist < e.def.range;

        if (e.type === 'tank') updateTank(gameState, e, dt, dx, dz, dist, sees);
        else if (e.type === 'aa') updateAA(gameState, e, dt, dx, dz, dist, sees);
        else updateEnemyHeli(gameState, e, dt, dx, dz, dh, dist, sees);
    }

    updateShots(gameState, dt);
}

function updateWreck(gameState, e, dt) {
    e.wreckAge += dt;
    if (e.falling) {
        e.velocity.y -= 25 * dt;
        e.position.addScaledVector(e.velocity, dt);
        e.mesh.rotation.z += 3 * dt;
        e.mesh.rotation.y += 1.5 * dt;
        const gy = gameState.world.getHeight(e.position.x, e.position.z);
        if (e.position.y <= gy + 0.5) {
            e.position.y = gy + 0.5;
            e.falling = false;
            if (gameState.createExplosion) gameState.createExplosion(e.position.clone(), 6, 'missile');
            if (gameState.audio) gameState.audio.playExplosion(2);
        }
    }
    if (e.wreckAge < 14) {
        e.smokeTimer -= dt;
        if (e.smokeTimer <= 0 && gameState.createSmoke) {
            e.smokeTimer = 0.25;
            gameState.createSmoke(e.position.clone().add(new THREE.Vector3(0, 2, 0)), 2.5, 3);
        }
    }
}

function moveGround(gameState, e, dt, speed) {
    const tx = e.target.x - e.position.x;
    const tz = e.target.z - e.position.z;
    const d = Math.hypot(tx, tz);
    if (d < 4) { e.retarget = 0; return; }
    const want = Math.atan2(tx, tz);
    let diff = want - e.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    e.heading += THREE.MathUtils.clamp(diff, -1, 1) * dt * 1.2;
    const nx = e.position.x + Math.sin(e.heading) * speed * dt;
    const nz = e.position.z + Math.cos(e.heading) * speed * dt;
    const blocked = checkBuildingCollision(gameState, _v.set(nx, e.position.y, nz), 4) ||
        gameState.world.isWater(nx, nz);
    if (blocked) { e.retarget = 0; return; }
    e.position.x = nx;
    e.position.z = nz;
}

function pickWander(gameState, e) {
    for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 60;
        const x = e.home.x + Math.cos(a) * r;
        const z = e.home.z + Math.sin(a) * r;
        if (gameState.world.isWater(x, z)) continue;
        if (checkBuildingCollision(gameState, _v.set(x, 0, z), 6)) continue;
        e.target.set(x, 0, z);
        return;
    }
    e.target.copy(e.position);
}

function updateTank(gameState, e, dt, dx, dz, dist, sees) {
    e.retarget -= dt;
    if (e.retarget <= 0) { pickWander(gameState, e); e.retarget = 6 + Math.random() * 6; }
    moveGround(gameState, e, dt, sees ? 3 : 5);

    const gy = gameState.world.getHeight(e.position.x, e.position.z);
    e.position.y = gy;
    e.mesh.rotation.y = e.heading;

    // turret tracks the player
    if (sees) {
        const want = Math.atan2(dx, dz) - e.heading;
        let diff = want - e.turret.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.turret.rotation.y += THREE.MathUtils.clamp(diff, -1.5 * dt, 1.5 * dt);

        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && Math.abs(diff) < 0.3) {
            e.fireTimer = (3.5 + Math.random() * 1.5) / e.aggression;
            const muzzle = new THREE.Vector3(0, 2.0, 4.5)
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), e.heading + e.turret.rotation.y)
                .add(e.position);
            fireShot(gameState, muzzle, 'shell', 0.05);
            maybeWarn(gameState, dist);
        }
    }
}

function updateAA(gameState, e, dt, dx, dz, dist, sees) {
    e.mesh.rotation.y = 0;
    e.position.y = gameState.world.getHeight(e.position.x, e.position.z);
    if (!sees) return;
    const want = Math.atan2(dx, dz);
    let diff = want - e.turret.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    e.turret.rotation.y += THREE.MathUtils.clamp(diff, -2.5 * dt, 2.5 * dt);

    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && Math.abs(diff) < 0.35) {
        e.burst++;
        e.fireTimer = 0.16;
        if (e.burst >= 4) {
            e.burst = 0;
            e.fireTimer = (2.2 + Math.random() * 1.2) / e.aggression;
        }
        const muzzle = new THREE.Vector3(0, 2.4, 2.5)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), e.turret.rotation.y)
            .add(e.position);
        fireShot(gameState, muzzle, 'bullet', 0.07);
        if (e.burst === 1) maybeWarn(gameState, dist);
    }
}

function updateEnemyHeli(gameState, e, dt, dx, dz, dh, dist, sees) {
    const h = gameState.helicopter;
    e.rotor.rotation.y += 25 * dt;

    // Orbit the player at a distance, switching direction now and then
    e.orbitAngle += dt * 0.25 * e.aggression;
    const orbitR = 170 + Math.sin(gameState.time * 0.3 + e.orbitAngle) * 50;
    const tx = h.position.x + Math.cos(e.orbitAngle) * orbitR;
    const tz = h.position.z + Math.sin(e.orbitAngle) * orbitR;
    const gy = gameState.world.getHeight(e.position.x, e.position.z);
    const ty = Math.max(gy + 25, h.position.y + 15 + Math.sin(e.orbitAngle * 2) * 20);

    const toX = tx - e.position.x, toY = ty - e.position.y, toZ = tz - e.position.z;
    const td = Math.hypot(toX, toY, toZ) || 1;
    const speed = Math.min(38, td * 0.5);
    e.velocity.x += (toX / td * speed - e.velocity.x) * Math.min(1, dt * 1.2);
    e.velocity.y += (toY / td * speed - e.velocity.y) * Math.min(1, dt * 1.2);
    e.velocity.z += (toZ / td * speed - e.velocity.z) * Math.min(1, dt * 1.2);
    e.position.addScaledVector(e.velocity, dt);
    e.position.y = Math.max(e.position.y, gy + 12);
    // avoid buildings: lift over them
    const b = checkBuildingCollision(gameState, e.position, 6);
    if (b) e.position.y = Math.max(e.position.y, b.position.y + b.height + 10);

    // face the player
    const want = Math.atan2(dx, dz);
    let diff = want - e.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    e.heading += THREE.MathUtils.clamp(diff, -1.4 * dt, 1.4 * dt);
    e.mesh.rotation.set(0.12, e.heading, THREE.MathUtils.clamp(-e.velocity.x * 0.01, -0.3, 0.3), 'YXZ');

    if (sees) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && Math.abs(diff) < 0.25) {
            e.burst++;
            e.fireTimer = 0.12;
            if (e.burst >= 6) {
                e.burst = 0;
                e.fireTimer = (2.5 + Math.random() * 1.5) / e.aggression;
                maybeWarn(gameState, dist);
            }
            const muzzle = new THREE.Vector3(0, -0.3, 4.5)
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), e.heading)
                .add(e.position);
            fireShot(gameState, muzzle, 'bullet', 0.06);
        }
    }
}

let lastWarn = -10;
function maybeWarn(gameState, dist) {
    if (gameState.time - lastWarn > 3) {
        lastWarn = gameState.time;
        notify('⚠ INCOMING FIRE', '#ff4444');
    }
}

function updateShots(gameState, dt) {
    const shots = gameState.enemyShots;
    const h = gameState.helicopter;
    for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.age += dt;
        let hit = false;
        const steps = 3;
        for (let k = 0; k < steps && !hit; k++) {
            s.position.addScaledVector(s.velocity, dt / steps);
            if (h.alive && s.position.distanceTo(h.position) < 4.2) {
                damagePlayer(gameState, s.damage, 'enemy');
                if (gameState.createExplosion) gameState.createExplosion(s.position.clone(), 1.5, 'cannon');
                hit = true;
            } else {
                const gy = gameState.world.getHeight(s.position.x, s.position.z);
                if (s.position.y <= gy + 0.3) {
                    if (gameState.createExplosion && s.kind === 'shell') gameState.createExplosion(s.position.clone(), 2, 'cannon');
                    hit = true;
                }
            }
        }
        s.mesh.position.copy(s.position);
        if (hit || s.age > s.life) {
            gameState.scene.remove(s.mesh);
            shots.splice(i, 1);
        }
    }
}
