// ============================================
// HELICOPTER.JS — LHX Helicopter Model & Physics
// ============================================
import * as THREE from 'three';
import { checkBuildingCollision } from './buildings.js';
import { triggerScreenShake } from './effects.js';
import { triggerDamageFlash } from './retro.js';

// Physics constants
const GRAVITY = 9.81;
const MAX_SPEED = 80;       // m/s (~288 km/h)
const COLLECTIVE_POWER = 18; // Lift force
const PITCH_RATE = 1.5;
const ROLL_RATE = 1.8;
const YAW_RATE = 1.2;
const DRAG = 0.97;
const ANGULAR_DRAG = 0.92;
const MAX_PITCH = 0.6;      // ~34 degrees
const MAX_ROLL = 0.8;       // ~46 degrees

export function initHelicopter(gameState) {
    const heli = new THREE.Group();
    
    // ---- FUSELAGE ----
    // Main body - angular/faceted like the real LHX prototype
    const bodyGeo = new THREE.BufferGeometry();
    const bodyVerts = new Float32Array([
        // Nose (pointed front)
        0, 0.2, 3.5,      -0.6, 0, 2.5,      0.6, 0, 2.5,
        0, 0.2, 3.5,       0.6, 0, 2.5,       0.6, 0.6, 2.0,
        0, 0.2, 3.5,      -0.6, 0.6, 2.0,    -0.6, 0, 2.5,
        0, 0.2, 3.5,       0.6, 0.6, 2.0,    -0.6, 0.6, 2.0,
        // Cockpit top
        -0.6, 0.6, 2.0,    0.6, 0.6, 2.0,     0.7, 0.8, 0.5,
        -0.6, 0.6, 2.0,    0.7, 0.8, 0.5,    -0.7, 0.8, 0.5,
        // Cockpit sides
        -0.6, 0, 2.5,     -0.6, 0.6, 2.0,    -0.8, 0, 0.5,
        -0.6, 0.6, 2.0,   -0.7, 0.8, 0.5,    -0.8, 0, 0.5,
        0.6, 0, 2.5,       0.8, 0, 0.5,       0.6, 0.6, 2.0,
        0.6, 0.6, 2.0,     0.8, 0, 0.5,       0.7, 0.8, 0.5,
        // Main body
        -0.8, 0, 0.5,     -0.7, 0.8, 0.5,    -0.7, 0.8, -2.0,
        -0.8, 0, 0.5,     -0.7, 0.8, -2.0,   -0.6, 0, -2.0,
        0.8, 0, 0.5,       0.7, 0.8, -2.0,    0.7, 0.8, 0.5,
        0.8, 0, 0.5,       0.6, 0, -2.0,      0.7, 0.8, -2.0,
        // Top
        -0.7, 0.8, 0.5,    0.7, 0.8, 0.5,     0.7, 0.8, -2.0,
        -0.7, 0.8, 0.5,    0.7, 0.8, -2.0,    -0.7, 0.8, -2.0,
        // Bottom
        -0.8, 0, 0.5,     -0.6, 0, -2.0,      0.6, 0, -2.0,
        -0.8, 0, 0.5,      0.6, 0, -2.0,      0.8, 0, 0.5,
        -0.6, 0, 2.5,     -0.8, 0, 0.5,       0.8, 0, 0.5,
        -0.6, 0, 2.5,      0.8, 0, 0.5,       0.6, 0, 2.5,
    ]);
    bodyGeo.setAttribute('position', new THREE.BufferAttribute(bodyVerts, 3));
    bodyGeo.computeVertexNormals();
    
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6f8452, flatShading: true, side: THREE.DoubleSide });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    heli.add(body);
    
    // ---- TAIL BOOM ----
    const tailGeo = new THREE.BufferGeometry();
    const tailVerts = new Float32Array([
        // Tapered tail boom
        -0.6, 0, -2.0,    -0.3, 0.5, -5.5,   -0.3, 0, -5.5,
        -0.6, 0, -2.0,    -0.7, 0.8, -2.0,   -0.3, 0.5, -5.5,
        0.6, 0, -2.0,      0.3, 0, -5.5,      0.3, 0.5, -5.5,
        0.6, 0, -2.0,      0.3, 0.5, -5.5,    0.7, 0.8, -2.0,
        // Top
        -0.7, 0.8, -2.0,   0.7, 0.8, -2.0,    0.3, 0.5, -5.5,
        -0.7, 0.8, -2.0,   0.3, 0.5, -5.5,   -0.3, 0.5, -5.5,
        // Bottom
        -0.6, 0, -2.0,    -0.3, 0, -5.5,      0.3, 0, -5.5,
        -0.6, 0, -2.0,     0.3, 0, -5.5,      0.6, 0, -2.0,
    ]);
    tailGeo.setAttribute('position', new THREE.BufferAttribute(tailVerts, 3));
    tailGeo.computeVertexNormals();
    const tailMat = new THREE.MeshLambertMaterial({ color: 0x5d7046, flatShading: true, side: THREE.DoubleSide });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    heli.add(tail);
    
    // ---- TAIL FIN (vertical stabilizer) ----
    const finGeo = new THREE.BufferGeometry();
    const finVerts = new Float32Array([
        0, 0.5, -5.0,     0, 1.6, -5.5,      0, 0.5, -5.8,
        0.05, 0.5, -5.0,  0.05, 1.6, -5.5,   0.05, 0.5, -5.8,
        // Connect sides
        0, 0.5, -5.0,     0.05, 0.5, -5.0,   0.05, 1.6, -5.5,
        0, 0.5, -5.0,     0.05, 1.6, -5.5,   0, 1.6, -5.5,
    ]);
    finGeo.setAttribute('position', new THREE.BufferAttribute(finVerts, 3));
    finGeo.computeVertexNormals();
    const finMat = new THREE.MeshLambertMaterial({ color: 0x3d4d2d, flatShading: true, side: THREE.DoubleSide });
    const fin = new THREE.Mesh(finGeo, finMat);
    heli.add(fin);
    
    // ---- COCKPIT GLASS ----
    const glassGeo = new THREE.BufferGeometry();
    const glassVerts = new Float32Array([
        -0.55, 0.55, 2.1,  0.55, 0.55, 2.1,   0.65, 0.75, 0.8,
        -0.55, 0.55, 2.1,  0.65, 0.75, 0.8,  -0.65, 0.75, 0.8,
    ]);
    glassGeo.setAttribute('position', new THREE.BufferAttribute(glassVerts, 3));
    glassGeo.computeVertexNormals();
    const glassMat = new THREE.MeshLambertMaterial({
        color: 0x88aacc,
        flatShading: true,
        transparent: true,
        opacity: 0.5,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    heli.add(glass);
    
    // ---- MAIN ROTOR ----
    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(0, 1.0, -0.5);
    
    // Rotor mast
    const mastGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.4, 4);
    const mastMat = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    rotorGroup.add(mast);
    
    // Rotor blades (4 blades)
    for (let i = 0; i < 4; i++) {
        const bladeGeo = new THREE.BoxGeometry(6, 0.05, 0.25);
        const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.x = 3;
        
        const bladeWrapper = new THREE.Group();
        bladeWrapper.rotation.y = (Math.PI / 2) * i;
        bladeWrapper.add(blade);
        rotorGroup.add(bladeWrapper);
    }
    
    heli.add(rotorGroup);
    
    // ---- TAIL ROTOR ----
    const tailRotorGroup = new THREE.Group();
    tailRotorGroup.position.set(0.15, 1.2, -5.5);
    tailRotorGroup.rotation.z = Math.PI / 2;
    
    for (let i = 0; i < 2; i++) {
        const tbladeGeo = new THREE.BoxGeometry(1.2, 0.04, 0.15);
        const tbladeMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
        const tblade = new THREE.Mesh(tbladeGeo, tbladeMat);
        tblade.position.x = 0.6;
        
        const wrapper = new THREE.Group();
        wrapper.rotation.y = (Math.PI) * i;
        wrapper.add(tblade);
        tailRotorGroup.add(wrapper);
    }
    
    heli.add(tailRotorGroup);
    
    // ---- LANDING GEAR (skids) ----
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });
    
    for (const side of [-1, 1]) {
        // Skid tube
        const skidGeo = new THREE.BoxGeometry(0.08, 0.08, 3);
        const skid = new THREE.Mesh(skidGeo, skidMat);
        skid.position.set(side * 0.7, -0.4, 0);
        heli.add(skid);
        
        // Front strut
        const strutGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
        const strut1 = new THREE.Mesh(strutGeo, skidMat);
        strut1.position.set(side * 0.65, -0.2, 1.0);
        heli.add(strut1);
        
        // Rear strut
        const strut2 = new THREE.Mesh(strutGeo.clone(), skidMat);
        strut2.position.set(side * 0.65, -0.2, -1.0);
        heli.add(strut2);
    }
    
    // ---- WEAPON PYLONS ----
    const pylonGeo = new THREE.BoxGeometry(1.5, 0.08, 0.3);
    const pylonMat = new THREE.MeshLambertMaterial({ color: 0x3a4a2a, flatShading: true });
    for (const side of [-1, 1]) {
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.set(side * 1.2, 0.1, -0.5);
        heli.add(pylon);
    }
    
    // Scale the whole helicopter
    heli.scale.set(1.5, 1.5, 1.5);
    
    // Position at spawn point
    heli.position.set(-40, 30, -280);
    
    gameState.scene.add(heli);
    
    // Store helicopter state
    gameState.helicopter = {
        group: heli,
        rotorGroup: rotorGroup,
        tailRotorGroup: tailRotorGroup,
        
        // Physics state
        position: heli.position,
        velocity: new THREE.Vector3(0, 0, 0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
        
        // Control inputs (0-1 or -1 to 1)
        collective: 0.5,   // 0.5 = hover
        pitchInput: 0,
        rollInput: 0,
        yawInput: 0,
        
        // State
        pitch: 0,
        roll: 0,
        yaw: 0,
        speed: 0,
        altitude: 30,
        health: 100,
        maxHealth: 100,
        alive: true,
        onGround: false,
        rotorSpeed: 0,
        
        // Weapon state
        weaponIndex: 0,
        
        // Flight helper
        engineRunning: true,
    };
}

// ---- Flight model (arcade): heading + climb + forward/strafe thrust ----
const ACC_FORWARD = 32;      // m/s^2 forward thrust
const ACC_STRAFE = 20;
const CLIMB_SPEED = 14;      // m/s
const MAX_ALTITUDE = 450;
const GROUND_CLEARANCE = 1.3;
const WORLD_HALF = 950;

let hitCooldown = 0;

export function updateHelicopter(gameState) {
    const h = gameState.helicopter;
    const input = gameState.input;
    const dt = gameState.delta;
    if (!h || !h.group || dt <= 0) return;
    if (!h.alive) return;

    const k = input.keys;
    hitCooldown = Math.max(0, hitCooldown - dt);

    // --- Inputs ---
    const fwd    = ((k['KeyW'] || k['ArrowUp']) ? 1 : 0) - ((k['KeyS'] || k['ArrowDown']) ? 1 : 0);
    const turn   = ((k['KeyD'] || k['ArrowRight']) ? 1 : 0) - ((k['KeyA'] || k['ArrowLeft']) ? 1 : 0); // + = right
    const strafe = (k['KeyE'] ? 1 : 0) - (k['KeyQ'] ? 1 : 0);                                        // + = right
    const climb  = ((k['ShiftLeft'] || k['ShiftRight'] || k['KeyR']) ? 1 : 0)
                 - ((k['ControlLeft'] || k['ControlRight'] || k['KeyF']) ? 1 : 0);

    h.pitchInput = fwd; h.rollInput = turn; h.yawInput = strafe;

    // --- Heading (turning right decreases yaw: model faces +Z, +X is its left) ---
    h.yaw -= turn * YAW_RATE * dt;
    const sinY = Math.sin(h.yaw), cosY = Math.cos(h.yaw);
    const fX = sinY, fZ = cosY;     // forward
    const rX = -cosY, rZ = sinY;    // right

    // --- Horizontal thrust + drag ---
    const thrustF = fwd > 0 ? fwd * ACC_FORWARD : fwd * ACC_FORWARD * 0.6;
    const thrustS = strafe * ACC_STRAFE;
    const hasInput = fwd !== 0 || strafe !== 0;
    const drag = hasInput ? 0.55 : 1.4;
    h.velocity.x += (fX * thrustF + rX * thrustS - h.velocity.x * drag) * dt;
    h.velocity.z += (fZ * thrustF + rZ * thrustS - h.velocity.z * drag) * dt;

    // --- Vertical: climb/descend command, otherwise auto-hover ---
    let climbCmd = climb;
    if (h.altitude > MAX_ALTITUDE && climbCmd > 0) climbCmd = 0;
    const targetVy = climbCmd * CLIMB_SPEED;
    h.velocity.y += (targetVy - h.velocity.y) * Math.min(1, dt * 2.5);
    h.collective = THREE.MathUtils.clamp(0.5 + h.velocity.y / 30, 0, 1);

    // --- Integrate ---
    const preVy = h.velocity.y;
    h.position.addScaledVector(h.velocity, dt);

    // --- Ground ---
    const groundHeight = gameState.world ? gameState.world.getHeight(h.position.x, h.position.z) : 0;
    h.onGround = false;
    if (h.position.y < groundHeight + GROUND_CLEARANCE) {
        h.position.y = groundHeight + GROUND_CLEARANCE;
        if (preVy < -9) damagePlayer(gameState, (-preVy - 9) * 6, 'ground');
        h.velocity.y = Math.max(0, h.velocity.y);
        h.velocity.x *= 0.92;
        h.velocity.z *= 0.92;
        h.onGround = true;
    }

    // --- Buildings ---
    const b = checkBuildingCollision(gameState, h.position, 2.4);
    if (b) {
        const topY = b.position.y + b.height;
        const impact = Math.hypot(h.velocity.x, h.velocity.y, h.velocity.z);
        if (h.position.y > topY - 1.5) {
            // Roof landing
            h.position.y = topY + GROUND_CLEARANCE + 0.2;
            h.velocity.y = Math.max(0, h.velocity.y);
            h.onGround = true;
        } else {
            const nx = (h.position.x - b.position.x) / (b.width / 2 + 2.4);
            const nz = (h.position.z - b.position.z) / (b.depth / 2 + 2.4);
            if (Math.abs(nx) > Math.abs(nz)) {
                h.position.x = b.position.x + Math.sign(nx || 1) * (b.width / 2 + 2.5);
                h.velocity.x *= -0.3;
            } else {
                h.position.z = b.position.z + Math.sign(nz || 1) * (b.depth / 2 + 2.5);
                h.velocity.z *= -0.3;
            }
            if (hitCooldown <= 0 && impact > 6) {
                hitCooldown = 0.6;
                damagePlayer(gameState, Math.min(35, impact * 0.7), 'building');
                if (gameState.createExplosion) gameState.createExplosion(h.position.clone(), 1.5, 'cannon');
            }
        }
    }

    // --- World bounds (soft wall) ---
    h.position.x = THREE.MathUtils.clamp(h.position.x, -WORLD_HALF, WORLD_HALF);
    h.position.z = THREE.MathUtils.clamp(h.position.z, -WORLD_HALF, WORLD_HALF);

    // --- Derived values ---
    const gh = gameState.world ? gameState.world.getHeight(h.position.x, h.position.z) : 0;
    h.altitude = Math.max(0, h.position.y - gh);
    h.speed = Math.hypot(h.velocity.x, h.velocity.z) * 3.6;

    // --- Attitude (visual): nose-down when accelerating, bank when turning/strafing ---
    const vForward = h.velocity.x * fX + h.velocity.z * fZ;
    const vSide = h.velocity.x * rX + h.velocity.z * rZ;
    const targetPitch = h.onGround ? 0 : THREE.MathUtils.clamp(vForward / 55 * 0.45, -0.22, 0.45);
    const targetRoll = h.onGround ? 0 : THREE.MathUtils.clamp(turn * 0.5 + vSide / 40 * 0.35, -0.75, 0.75);
    const att = Math.min(1, dt * 4);
    h.pitch += (targetPitch - h.pitch) * att;
    h.roll  += (targetRoll  - h.roll)  * att;
    h.group.rotation.set(h.pitch, h.yaw, h.roll, 'YXZ');

    // --- Rotors ---
    const targetRotorSpeed = h.engineRunning ? 18 + h.collective * 10 : 0;
    h.rotorSpeed = THREE.MathUtils.lerp(h.rotorSpeed, targetRotorSpeed, dt * 2);
    h.rotorGroup.rotation.y += h.rotorSpeed * dt;
    h.tailRotorGroup.rotation.y += h.rotorSpeed * 1.5 * dt;
}

// Heading vector on the ground plane (unit)
export function getHeading(gameState) {
    const yaw = gameState.helicopter.yaw;
    return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
}

export function damagePlayer(gameState, amount, source = 'enemy') {
    const h = gameState.helicopter;
    if (!h || !h.alive || amount <= 0) return;
    h.health = Math.max(0, h.health - amount);
    triggerDamageFlash(gameState, Math.min(1, 0.4 + amount / 30));
    triggerScreenShake(gameState, Math.min(2, amount / 10), 0.3);
    if (gameState.audio) gameState.audio.playHit();
    if (h.health <= 0) {
        h.alive = false;
        h.group.visible = false;
        if (gameState.createExplosion) {
            gameState.createExplosion(h.position.clone(), 6, 'missile');
        }
        if (gameState.audio) gameState.audio.playExplosion(3);
        if (gameState.onPlayerDestroyed) gameState.onPlayerDestroyed(source);
    }
}

export function repairPlayer(gameState, amount) {
    const h = gameState.helicopter;
    h.health = Math.min(h.maxHealth, h.health + amount);
}

export function getHelicopterForward(gameState) {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(gameState.helicopter.group.quaternion);
    return forward;
}

export function getHelicopterPosition(gameState) {
    return gameState.helicopter.position.clone();
}
