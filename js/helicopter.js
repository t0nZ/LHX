// ============================================
// HELICOPTER.JS — LHX Helicopter Model & Physics
// ============================================
import * as THREE from 'three';

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
    
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a5a3a, flatShading: true });
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
    const tailMat = new THREE.MeshLambertMaterial({ color: 0x3d4d2d, flatShading: true });
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
    heli.position.set(0, 60, -300);
    
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
        collective: 0.5,   // Start with some lift
        pitchInput: 0,
        rollInput: 0,
        yawInput: 0,
        
        // State
        pitch: 0,
        roll: 0,
        yaw: 0,
        speed: 0,
        altitude: 60,
        health: 100,
        rotorSpeed: 0,
        
        // Weapon state
        weaponIndex: 0,
        
        // Flight helper
        engineRunning: true,
    };
}

export function updateHelicopter(gameState) {
    const h = gameState.helicopter;
    const input = gameState.input;
    const dt = gameState.delta;
    if (!h || !h.group || dt <= 0) return;
    
    // --- Process inputs ---
    // Collective (throttle)
    if (input.keys['ShiftLeft'] || input.keys['ShiftRight']) {
        h.collective = Math.min(1.0, h.collective + dt * 0.5);
    }
    if (input.keys['ControlLeft'] || input.keys['ControlRight']) {
        h.collective = Math.max(0, h.collective - dt * 0.5);
    }
    
    // Cyclic (pitch/roll)
    h.pitchInput = 0;
    h.rollInput = 0;
    h.yawInput = 0;
    
    if (input.keys['KeyW'] || input.keys['ArrowUp'])    h.pitchInput =  1;
    if (input.keys['KeyS'] || input.keys['ArrowDown'])  h.pitchInput = -1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft'])  h.rollInput  = -1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) h.rollInput  =  1;
    if (input.keys['KeyQ'])  h.yawInput = -1;
    if (input.keys['KeyE'])  h.yawInput =  1;
    
    // --- Apply rotations ---
    h.pitch += h.pitchInput * PITCH_RATE * dt;
    h.roll  += h.rollInput  * ROLL_RATE  * dt;
    h.yaw   += h.yawInput   * YAW_RATE   * dt;
    
    // Dampen rotations
    h.pitch *= (1 - 2.0 * dt);
    h.roll  *= (1 - 2.0 * dt);
    
    // Clamp
    h.pitch = THREE.MathUtils.clamp(h.pitch, -MAX_PITCH, MAX_PITCH);
    h.roll  = THREE.MathUtils.clamp(h.roll,  -MAX_ROLL,  MAX_ROLL);
    
    // --- Physics ---
    // Build rotation quaternion
    const euler = new THREE.Euler(h.pitch, h.yaw, h.roll, 'YXZ');
    h.group.rotation.copy(euler);
    
    // Lift force (along helicopter's up vector)
    const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(h.group.quaternion);
    const liftForce = h.collective * COLLECTIVE_POWER;
    
    // Forward force from tilting
    const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(h.group.quaternion);
    const sideVector = new THREE.Vector3(1, 0, 0).applyQuaternion(h.group.quaternion);
    
    // Apply forces
    h.velocity.x += upVector.x * liftForce * dt;
    h.velocity.y += (upVector.y * liftForce - GRAVITY) * dt;
    h.velocity.z += upVector.z * liftForce * dt;
    
    // Drag
    h.velocity.multiplyScalar(Math.pow(DRAG, dt * 60));
    
    // Clamp speed
    const speed = h.velocity.length();
    if (speed > MAX_SPEED) {
        h.velocity.multiplyScalar(MAX_SPEED / speed);
    }
    
    // Update position
    h.position.add(h.velocity.clone().multiplyScalar(dt));
    
    // Ground collision
    const groundHeight = gameState.world ? gameState.world.getHeight(h.position.x, h.position.z) : 0;
    if (h.position.y < groundHeight + 1.5) {
        h.position.y = groundHeight + 1.5;
        h.velocity.y = Math.max(0, h.velocity.y);
        // Dampen horizontal velocity when on ground
        h.velocity.x *= 0.95;
        h.velocity.z *= 0.95;
    }
    
    // Update derived values
    h.altitude = h.position.y - groundHeight;
    h.speed = Math.sqrt(h.velocity.x ** 2 + h.velocity.z ** 2) * 3.6; // m/s to km/h
    
    // --- Animate rotors ---
    const targetRotorSpeed = h.engineRunning ? 15 + h.collective * 10 : 0;
    h.rotorSpeed = THREE.MathUtils.lerp(h.rotorSpeed, targetRotorSpeed, dt * 2);
    
    h.rotorGroup.rotation.y += h.rotorSpeed * dt;
    h.tailRotorGroup.rotation.y += h.rotorSpeed * 1.5 * dt;
    
    // Keep world bounds
    const worldHalf = 950;
    h.position.x = THREE.MathUtils.clamp(h.position.x, -worldHalf, worldHalf);
    h.position.z = THREE.MathUtils.clamp(h.position.z, -worldHalf, worldHalf);
}

export function getHelicopterForward(gameState) {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(gameState.helicopter.group.quaternion);
    return forward;
}

export function getHelicopterPosition(gameState) {
    return gameState.helicopter.position.clone();
}

export function getHelicopterDown(gameState) {
    const down = new THREE.Vector3(0, -1, 0);
    down.applyQuaternion(gameState.helicopter.group.quaternion);
    return down;
}
