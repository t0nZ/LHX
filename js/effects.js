// ============================================
// EFFECTS.JS — Explosions, Debris, Smoke, Flash
// ============================================
import * as THREE from 'three';

// Effect pools
const explosions = [];
const debris = [];
const smokePuffs = [];
const muzzleFlashes = [];
const shockwaves = [];

// Shared geometries/materials
let fireballGeo, smokeGeo, debrisGeo, shockwaveGeo;
let fireballMats, smokeMat, debrisMats, shockwaveMat, flashMat;

export function initEffects(gameState) {
    // Pre-create shared geometries
    fireballGeo = new THREE.IcosahedronGeometry(1, 1);
    smokeGeo = new THREE.IcosahedronGeometry(1, 1);
    debrisGeo = new THREE.BoxGeometry(1, 1, 1);
    shockwaveGeo = new THREE.RingGeometry(0.5, 1, 16);
    shockwaveGeo.rotateX(-Math.PI / 2);
    
    // Fireball materials (multiple layers of orange/red/yellow)
    fireballMats = [
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 }),
        new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.8 }),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.85 }),
        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.7 }),
        new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.9 }),
    ];
    
    smokeMat = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.6,
    });
    
    debrisMats = [
        new THREE.MeshLambertMaterial({ color: 0x554433, flatShading: true }),
        new THREE.MeshLambertMaterial({ color: 0x665544, flatShading: true }),
        new THREE.MeshLambertMaterial({ color: 0x443322, flatShading: true }),
        new THREE.MeshLambertMaterial({ color: 0x888877, flatShading: true }),
    ];
    
    shockwaveMat = new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
    });
    
    flashMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
    });
    
    // Register effect creation functions on gameState
    gameState.createExplosion = (pos, size, type) => createExplosion(gameState, pos, size, type);
    gameState.createSmoke = (pos, size, duration) => createSmokePuff(gameState, pos, size, duration);
    gameState.createMuzzleFlash = (pos) => createMuzzleFlash(gameState, pos);
}

function createExplosion(gameState, position, size, type) {
    const scene = gameState.scene;
    const isLarge = type === 'missile' || type === 'building';
    
    // ---- INITIAL WHITE FLASH ----
    const flashGeo = new THREE.SphereGeometry(size * 1.5, 6, 6);
    const flash = new THREE.Mesh(flashGeo, flashMat.clone());
    flash.position.copy(position);
    scene.add(flash);
    muzzleFlashes.push({
        mesh: flash,
        age: 0,
        maxAge: 0.1,
    });
    
    // ---- FIREBALLS (multiple expanding spheres) ----
    const fireballCount = isLarge ? 8 : 3;
    for (let i = 0; i < fireballCount; i++) {
        const mat = fireballMats[i % fireballMats.length].clone();
        const mesh = new THREE.Mesh(fireballGeo, mat);
        
        // Offset each fireball slightly
        mesh.position.copy(position);
        mesh.position.x += (Math.random() - 0.5) * size * 0.5;
        mesh.position.y += Math.random() * size * 0.5;
        mesh.position.z += (Math.random() - 0.5) * size * 0.5;
        
        const startScale = size * (0.3 + Math.random() * 0.3);
        const endScale = size * (0.8 + Math.random() * 0.6);
        mesh.scale.setScalar(startScale);
        scene.add(mesh);
        
        explosions.push({
            mesh,
            age: 0,
            maxAge: 0.4 + Math.random() * 0.4,
            startScale,
            endScale,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                3 + Math.random() * 8,
                (Math.random() - 0.5) * 5
            ),
            delay: i * 0.03, // Stagger for cascade effect
        });
    }
    
    // ---- DEBRIS ----
    const debrisCount = isLarge ? 20 : 8;
    for (let i = 0; i < debrisCount; i++) {
        const mat = debrisMats[i % debrisMats.length];
        const mesh = new THREE.Mesh(debrisGeo, mat);
        
        const debrisSize = 0.2 + Math.random() * (isLarge ? 1.0 : 0.4);
        mesh.scale.set(
            debrisSize * (0.5 + Math.random()),
            debrisSize * (0.3 + Math.random()),
            debrisSize * (0.5 + Math.random())
        );
        
        mesh.position.copy(position);
        mesh.position.y += size * 0.3;
        mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        scene.add(mesh);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = 10 + Math.random() * (isLarge ? 40 : 20);
        const upSpeed = 8 + Math.random() * (isLarge ? 25 : 15);
        
        debris.push({
            mesh,
            age: 0,
            maxAge: 1.5 + Math.random() * 2,
            velocity: new THREE.Vector3(
                Math.cos(angle) * speed,
                upSpeed,
                Math.sin(angle) * speed
            ),
            angularVelocity: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            ),
            bounced: false,
        });
    }
    
    // ---- SMOKE COLUMN ----
    const smokeCount = isLarge ? 12 : 4;
    for (let i = 0; i < smokeCount; i++) {
        createSmokePuff(gameState, 
            position.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * size,
                i * 2,
                (Math.random() - 0.5) * size
            )),
            size * (0.5 + Math.random() * 0.5),
            2 + Math.random() * 3 + i * 0.3,
            i * 0.1 // delay
        );
    }
    
    // ---- SHOCKWAVE RING (ground) ----
    if (isLarge) {
        const swMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat.clone());
        swMesh.position.copy(position);
        swMesh.position.y = (gameState.world ? gameState.world.getHeight(position.x, position.z) : 0) + 0.5;
        swMesh.scale.setScalar(1);
        scene.add(swMesh);
        
        shockwaves.push({
            mesh: swMesh,
            age: 0,
            maxAge: 0.8,
            maxScale: size * 4,
        });
    }
    
    // ---- SCREEN SHAKE ----
    if (gameState.camera) {
        const dist = gameState.camera.position.distanceTo(position);
        const intensity = Math.max(0, 1 - dist / 200) * (isLarge ? 1.5 : 0.5);
        triggerScreenShake(gameState, intensity, isLarge ? 0.5 : 0.2);
    }
}

function createSmokePuff(gameState, position, size, duration, delay = 0) {
    const mat = smokeMat.clone();
    const mesh = new THREE.Mesh(smokeGeo, mat);
    mesh.position.copy(position);
    mesh.scale.setScalar(size * 0.3);
    mesh.visible = delay <= 0;
    gameState.scene.add(mesh);
    
    smokePuffs.push({
        mesh,
        age: -delay,
        maxAge: duration || 2,
        startScale: size * 0.3,
        endScale: size * 1.5,
        riseSpeed: 2 + Math.random() * 4,
        drift: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2),
    });
}

function createMuzzleFlash(gameState, position) {
    const geo = new THREE.SphereGeometry(0.3, 4, 4);
    const mesh = new THREE.Mesh(geo, flashMat.clone());
    mesh.position.copy(position);
    gameState.scene.add(mesh);
    
    muzzleFlashes.push({
        mesh,
        age: 0,
        maxAge: 0.05,
    });
}

// Screen shake state
let shakeIntensity = 0;
let shakeDuration = 0;
let shakeTimer = 0;
const originalCameraOffset = new THREE.Vector3();

function triggerScreenShake(gameState, intensity, duration) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeDuration = Math.max(shakeDuration, duration);
    shakeTimer = 0;
}

export function updateEffects(gameState) {
    const dt = gameState.delta;
    
    // --- Update Explosions (fireballs) ---
    for (let i = explosions.length - 1; i >= 0; i--) {
        const e = explosions[i];
        e.age += dt;
        
        if (e.age < e.delay) continue; // Not yet started
        
        const effectAge = e.age - e.delay;
        const t = effectAge / e.maxAge;
        
        if (t >= 1) {
            gameState.scene.remove(e.mesh);
            e.mesh.geometry.dispose();
            e.mesh.material.dispose();
            explosions.splice(i, 1);
            continue;
        }
        
        // Expand
        const scale = THREE.MathUtils.lerp(e.startScale, e.endScale, t);
        e.mesh.scale.setScalar(scale);
        
        // Rise
        e.mesh.position.add(e.velocity.clone().multiplyScalar(dt));
        e.velocity.y -= 5 * dt; // Gravity on fireball
        
        // Fade out
        e.mesh.material.opacity = (1 - t) * 0.9;
        
        // Color shift: orange → dark red → black
        const r = THREE.MathUtils.lerp(1, 0.2, t);
        const g = THREE.MathUtils.lerp(0.5, 0.05, t);
        const b = THREE.MathUtils.lerp(0, 0, t);
        e.mesh.material.color.setRGB(r, g, b);
    }
    
    // --- Update Debris ---
    for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.age += dt;
        
        if (d.age >= d.maxAge) {
            gameState.scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            debris.splice(i, 1);
            continue;
        }
        
        // Physics
        d.velocity.y -= 20 * dt; // Gravity
        d.mesh.position.add(d.velocity.clone().multiplyScalar(dt));
        
        // Rotation
        d.mesh.rotation.x += d.angularVelocity.x * dt;
        d.mesh.rotation.y += d.angularVelocity.y * dt;
        d.mesh.rotation.z += d.angularVelocity.z * dt;
        
        // Ground bounce
        const groundH = gameState.world ? gameState.world.getHeight(d.mesh.position.x, d.mesh.position.z) : 0;
        if (d.mesh.position.y < groundH + 0.2) {
            d.mesh.position.y = groundH + 0.2;
            d.velocity.y = Math.abs(d.velocity.y) * 0.3;
            d.velocity.x *= 0.7;
            d.velocity.z *= 0.7;
            d.angularVelocity.multiplyScalar(0.5);
            d.bounced = true;
        }
        
        // Fade out in last 30%
        const fadeStart = d.maxAge * 0.7;
        if (d.age > fadeStart) {
            const fade = 1 - (d.age - fadeStart) / (d.maxAge - fadeStart);
            d.mesh.scale.multiplyScalar(0.98);
        }
    }
    
    // --- Update Smoke ---
    for (let i = smokePuffs.length - 1; i >= 0; i--) {
        const s = smokePuffs[i];
        s.age += dt;
        
        if (s.age < 0) continue; // Delayed
        
        s.mesh.visible = true;
        const t = s.age / s.maxAge;
        
        if (t >= 1) {
            gameState.scene.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
            smokePuffs.splice(i, 1);
            continue;
        }
        
        // Expand
        const scale = THREE.MathUtils.lerp(s.startScale, s.endScale, t);
        s.mesh.scale.setScalar(scale);
        
        // Rise
        s.mesh.position.y += s.riseSpeed * dt;
        s.mesh.position.add(s.drift.clone().multiplyScalar(dt));
        
        // Fade: appear quickly, fade slowly
        if (t < 0.1) {
            s.mesh.material.opacity = t * 6;
        } else {
            s.mesh.material.opacity = (1 - t) * 0.5;
        }
        
        // Color: dark gray → light gray
        const gray = THREE.MathUtils.lerp(0.2, 0.5, t);
        s.mesh.material.color.setRGB(gray, gray, gray);
    }
    
    // --- Update Muzzle Flashes ---
    for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        const f = muzzleFlashes[i];
        f.age += dt;
        
        if (f.age >= f.maxAge) {
            gameState.scene.remove(f.mesh);
            f.mesh.geometry.dispose();
            f.mesh.material.dispose();
            muzzleFlashes.splice(i, 1);
            continue;
        }
        
        const t = f.age / f.maxAge;
        f.mesh.material.opacity = 1 - t;
        f.mesh.scale.setScalar(1 + t * 2);
    }
    
    // --- Update Shockwaves ---
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.age += dt;
        
        if (sw.age >= sw.maxAge) {
            gameState.scene.remove(sw.mesh);
            sw.mesh.geometry.dispose();
            sw.mesh.material.dispose();
            shockwaves.splice(i, 1);
            continue;
        }
        
        const t = sw.age / sw.maxAge;
        sw.mesh.scale.setScalar(THREE.MathUtils.lerp(1, sw.maxScale, t));
        sw.mesh.material.opacity = (1 - t) * 0.5;
    }
    
    // --- Screen Shake ---
    if (shakeDuration > 0) {
        shakeTimer += dt;
        if (shakeTimer < shakeDuration) {
            const decay = 1 - shakeTimer / shakeDuration;
            const shake = shakeIntensity * decay;
            if (gameState.camera) {
                gameState.camera.position.x += (Math.random() - 0.5) * shake;
                gameState.camera.position.y += (Math.random() - 0.5) * shake * 0.5;
                gameState.camera.position.z += (Math.random() - 0.5) * shake;
            }
        } else {
            shakeDuration = 0;
            shakeIntensity = 0;
        }
    }
}
