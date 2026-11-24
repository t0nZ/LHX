// ============================================
// PLAYER_CAR.JS — Drivable 1986 Peugeot 205 (Grigia 4 Porte / 5p Hatchback)
// --------------------------------------------
// Iconic Pininfarina 1986 4-door metallic grey hatchback with:
//   * Crisp 16-bit pixel-art side doors (4-door split, B/C-pillars, black rub strip,
//     handles), 3-slat front grille + lion emblem, ribbed black tailgate & 1986
//     Italian white/orange Ravenna license plate ("RA 348205").
//   * Front steering pivots, spinning wheels, glowing brake lights & headlights.
//   * Responsive 80s hatchback physics: 5-speed gearing, road vs field traction,
//     handbrake rear-slip (SPACE), terrain slope alignment, building collisions.
// ============================================
import * as THREE from 'three';
import { checkBuildingCollision } from './buildings.js';
import { triggerScreenShake } from './effects.js';

const MAX_FWD_SPEED = 41.5;   // ~150 km/h on paved roads
const MAX_REV_SPEED = 12.0;   // ~43 km/h reverse
const ACCEL_ROAD = 16.5;
const BRAKE_DECEL = 28.0;
const STEER_MAX = 0.52;       // radians (~30 deg)
const WHEELBASE = 2.42;       // real Peugeot 205 wheelbase (m) * scale

function makeSideTexture(flip = false) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 48;
    const g = c.getContext('2d');
    if (flip) { g.translate(128, 0); g.scale(-1, 1); }

    // Metallic Gris Futura body
    g.fillStyle = '#969ca3'; g.fillRect(0, 0, 128, 48);
    // Subtle metallic horizon highlight + lower shadow
    g.fillStyle = '#aeb4bc'; g.fillRect(0, 18, 128, 5);
    g.fillStyle = '#737980'; g.fillRect(0, 35, 128, 13);
    // Black sill rocker
    g.fillStyle = '#242629'; g.fillRect(0, 43, 128, 5);

    // 4-door split seams (front door x=42..76, rear door x=76..105; front is right +X/+Z)
    // Convention: x=0 is REAR (-Z), x=128 is FRONT (+Z)
    g.fillStyle = '#4a4f55';
    g.fillRect(26, 18, 1, 24);  // rear door rear seam
    g.fillRect(58, 4, 2, 38);   // B-pillar + door split
    g.fillRect(92, 18, 1, 24);  // front door front hinge seam

    // Classic 1986 black plastic side moulding strip + tiny red/chrome pin
    g.fillStyle = '#222428'; g.fillRect(14, 31, 100, 4);
    g.fillStyle = '#b8bec6'; g.fillRect(14, 32, 100, 1);

    // 4-door recessed black handles (rear door + front door)
    g.fillStyle = '#1b1d20';
    g.fillRect(31, 23, 6, 3);   // rear door handle
    g.fillRect(63, 23, 6, 3);   // front door handle

    // Characteristic Peugeot 205 rear C-pillar black trim vent
    g.fillStyle = '#26292d';
    g.fillRect(12, 8, 5, 7);

    // Front fender amber side repeater
    g.fillStyle = '#ff9911';
    g.fillRect(98, 26, 3, 2);

    // Wheel-arch dark cutouts
    g.fillStyle = '#181a1d';
    g.beginPath(); g.arc(23, 44, 12, Math.PI, 0); g.fill();
    g.beginPath(); g.arc(103, 44, 12, Math.PI, 0); g.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    return tex;
}

function makeFrontTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#8f959c'; g.fillRect(0, 0, 64, 32);

    // 3-slat horizontal grille
    g.fillStyle = '#1f2226'; g.fillRect(16, 7, 32, 9);
    g.fillStyle = '#7c828a';
    g.fillRect(16, 9, 32, 1);
    g.fillRect(16, 12, 32, 1);
    // Silver Peugeot lion emblem in centre
    g.fillStyle = '#e6ebf0'; g.fillRect(30, 9, 4, 5);

    // Rectangular headlights + outer amber indicators (1986 pre-restyling!)
    g.fillStyle = '#ff9d1c'; g.fillRect(3, 6, 4, 9);   g.fillRect(57, 6, 4, 9);
    g.fillStyle = '#f6f2d0'; g.fillRect(7, 6, 9, 9);   g.fillRect(48, 6, 9, 9);
    g.fillStyle = '#ffffff'; g.fillRect(9, 8, 5, 4);   g.fillRect(50, 8, 5, 4);

    // Black plastic bumper + lower air dam + 1986 Italian front mini-plate
    g.fillStyle = '#22252a'; g.fillRect(0, 17, 64, 15);
    g.fillStyle = '#141619'; g.fillRect(14, 25, 36, 5);
    g.fillStyle = '#f2f2ee'; g.fillRect(23, 19, 18, 5);
    g.fillStyle = '#e06010'; g.fillRect(24, 20, 4, 3); // orange "RA"
    g.fillStyle = '#181818'; g.fillRect(29, 20, 11, 3);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    return tex;
}

function makeRearTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#8b9198'; g.fillRect(0, 0, 64, 32);

    // Iconic Peugeot 205 ribbed dark-grey tailgate garnish between lights
    g.fillStyle = '#25282c'; g.fillRect(14, 6, 36, 9);
    g.fillStyle = '#3a3e44';
    for (let y = 7; y < 15; y += 2) g.fillRect(15, y, 34, 1);
    // "PEUGEOT" & "205" tiny silver badges
    g.fillStyle = '#d8dde2'; g.fillRect(17, 11, 10, 2); g.fillRect(41, 11, 6, 2);

    // 1986 pre-facelift block taillights (amber top, red brake/tail, white reverse)
    g.fillStyle = '#ff9418'; g.fillRect(3, 5, 11, 4);  g.fillRect(50, 5, 11, 4);
    g.fillStyle = '#cc1e1e'; g.fillRect(3, 9, 11, 5);  g.fillRect(50, 9, 11, 5);
    g.fillStyle = '#e8e8e8'; g.fillRect(9, 13, 5, 2);  g.fillRect(50, 13, 5, 2);

    // Rear black bumper + 1986 Italian plate (white with orange "RA")
    g.fillStyle = '#22252a'; g.fillRect(0, 17, 64, 15);
    g.fillStyle = '#f4f4ef'; g.fillRect(20, 19, 24, 6);
    g.fillStyle = '#e86510'; g.fillRect(21, 20, 5, 4); // orange RA province
    g.fillStyle = '#181818'; g.fillRect(27, 20, 15, 4);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    return tex;
}

function makeWheelTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1c1f'; g.fillRect(0, 0, 32, 32);
    // Silver 80s Peugeot steel/alloy wheel rim with holes
    g.fillStyle = '#b4bac2';
    g.beginPath(); g.arc(16, 16, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#34383e';
    for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        g.fillRect(15 + Math.cos(ang) * 6.5, 15 + Math.sin(ang) * 6.5, 2.5, 2.5);
    }
    g.fillStyle = '#5c626a';
    g.beginPath(); g.arc(16, 16, 3.5, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    return tex;
}

export function initPlayerCar(gameState) {
    const root = new THREE.Group();
    const chassis = new THREE.Group(); // tilts with pitch/roll & suspension
    root.add(chassis);

    const sideR = new THREE.MeshLambertMaterial({ map: makeSideTexture(false), flatShading: true });
    const sideL = new THREE.MeshLambertMaterial({ map: makeSideTexture(true), flatShading: true });
    const frontM = new THREE.MeshLambertMaterial({ map: makeFrontTexture(), flatShading: true });
    const rearM = new THREE.MeshLambertMaterial({ map: makeRearTexture(), flatShading: true });
    const paintGrey = new THREE.MeshLambertMaterial({ color: 0x969ca3, flatShading: true });
    const darkUnder = new THREE.MeshLambertMaterial({ color: 0x1e2024, flatShading: true });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x3b4f63, flatShading: true });
    const trimBlack = new THREE.MeshLambertMaterial({ color: 0x24272b, flatShading: true });

    // Lower body box (+X left, -X right, +Z front, -Z rear)
    // BoxGeometry material order: [+X, -X, +Y, -Y, +Z, -Z]
    const lowerGeo = new THREE.BoxGeometry(1.62, 0.58, 3.78);
    const lower = new THREE.Mesh(lowerGeo, [sideL, sideR, paintGrey, darkUnder, frontM, rearM]);
    lower.position.set(0, 0.50, 0);
    chassis.add(lower);

    // Sloped Pininfarina bonnet wedge
    const hoodGeo = new THREE.BoxGeometry(1.56, 0.12, 1.05);
    const hood = new THREE.Mesh(hoodGeo, paintGrey);
    hood.position.set(0, 0.78, 1.28);
    hood.rotation.x = 0.09;
    chassis.add(hood);

    // 5-door Greenhouse / Cabin (custom trapezoidal prism for authentic angled windshield + 205 tailgate!)
    const hwTop = 0.66, hwBot = 0.77;
    const yBot = 0.78, yTop = 1.34;
    // Z coords: rear bot -1.78, rear top -1.42 (classic 205 hatchback slant!), front top +0.42, front bot +0.86
    const cabPos = new Float32Array([
        // Roof (+Y)
        -hwTop, yTop, -1.42,  -hwTop, yTop,  0.42,   hwTop, yTop,  0.42,
        -hwTop, yTop, -1.42,   hwTop, yTop,  0.42,   hwTop, yTop, -1.42,
        // Windshield (+Z)
        -hwBot, yBot,  0.86,   hwBot, yBot,  0.86,   hwTop, yTop,  0.42,
        -hwBot, yBot,  0.86,   hwTop, yTop,  0.42,  -hwTop, yTop,  0.42,
        // Rear hatch window (-Z)
         hwBot, yBot, -1.78,  -hwBot, yBot, -1.78,  -hwTop, yTop, -1.42,
         hwBot, yBot, -1.78,  -hwTop, yTop, -1.42,   hwTop, yTop, -1.42,
        // Left windows (+X)
         hwBot, yBot, -1.78,   hwTop, yTop, -1.42,   hwTop, yTop,  0.42,
         hwBot, yBot, -1.78,   hwTop, yTop,  0.42,   hwBot, yBot,  0.86,
        // Right windows (-X)
        -hwBot, yBot,  0.86,  -hwTop, yTop,  0.42,  -hwTop, yTop, -1.42,
        -hwBot, yBot,  0.86,  -hwTop, yTop, -1.42,  -hwBot, yBot, -1.78,
    ]);
    const cabCol = new Float32Array(30 * 3);
    const setTriRangeColor = (startVert, count, hex) => {
        const col = new THREE.Color(hex);
        for (let i = startVert; i < startVert + count; i++) {
            cabCol[i * 3] = col.r; cabCol[i * 3 + 1] = col.g; cabCol[i * 3 + 2] = col.b;
        }
    };
    setTriRangeColor(0, 6, 0x9ca2a9);   // grey metallic roof
    setTriRangeColor(6, 24, 0x384c60);  // tinted glass all around
    const cabGeo = new THREE.BufferGeometry();
    cabGeo.setAttribute('position', new THREE.BufferAttribute(cabPos, 3));
    cabGeo.setAttribute('color', new THREE.BufferAttribute(cabCol, 3));
    cabGeo.computeVertexNormals();
    const cabin = new THREE.Mesh(cabGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    chassis.add(cabin);

    // 4-door B-pillars & C-pillars + wing mirrors + roof radio antenna (so 4 doors read crisply in 3D!)
    for (const sx of [-1, 1]) {
        // B-pillar between front and rear doors
        const bPil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.08), trimBlack);
        bPil.position.set(sx * 0.72, 1.05, -0.36);
        bPil.rotation.z = sx * 0.18;
        chassis.add(bPil);

        // Wide grey 205 C-pillar at the back of the rear door
        const cPil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.28), paintGrey);
        cPil.position.set(sx * 0.72, 1.05, -1.46);
        cPil.rotation.z = sx * 0.18;
        cPil.rotation.x = -0.52;
        chassis.add(cPil);

        // Black wing mirror
        const mir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.12), trimBlack);
        mir.position.set(sx * 0.84, 0.86, 0.56);
        chassis.add(mir);
    }
    // Thin 1980s angled roof radio antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.55, 4), trimBlack);
    ant.position.set(0, 1.56, 0.22);
    ant.rotation.x = -0.45;
    chassis.add(ant);

    // Emissive brake light quads & headlight glow quads
    const brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2211, visible: false });
    for (const sx of [-0.62, 0.62]) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.04), brakeMat);
        bl.position.set(sx, 0.58, -1.90);
        chassis.add(bl);
    }

    // 4 Wheels (front 2 in steering pivots)
    const wheelTex = makeWheelTexture();
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x1c1e21, flatShading: true });
    const capMat = new THREE.MeshLambertMaterial({ map: wheelTex, flatShading: true });
    const wheelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.21, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    const steerPivots = [];
    const wheelMeshes = [];
    const wheelLayout = [
        { x:  0.76, z:  1.21, front: true },
        { x: -0.76, z:  1.21, front: true },
        { x:  0.76, z: -1.21, front: false },
        { x: -0.76, z: -1.21, front: false },
    ];
    for (const w of wheelLayout) {
        const pivot = new THREE.Group();
        pivot.position.set(w.x, 0.31, w.z);
        const wm = new THREE.Mesh(wheelGeo, [tireMat, capMat, capMat]);
        pivot.add(wm);
        root.add(pivot);
        if (w.front) steerPivots.push(pivot);
        wheelMeshes.push(wm);
    }

    root.scale.setScalar(1.15);

    const spawn = gameState.carSpawn || { x: (gameState.helipad?.x || 0) + 20, z: gameState.helipad?.z || 0, yaw: 0 };
    const gy = gameState.world ? gameState.world.getHeight(spawn.x, spawn.z) : 0;
    root.position.set(spawn.x, gy, spawn.z);
    root.rotation.y = spawn.yaw || 0;
    gameState.scene.add(root);

    gameState.playerCar = {
        group: root,
        chassis,
        steerPivots,
        wheelMeshes,
        brakeMat,
        position: root.position,
        velocity: new THREE.Vector3(),
        yaw: spawn.yaw || 0,
        speedMs: 0,        // signed forward speed (m/s)
        speed: 0,          // abs km/h for HUD
        steerAngle: 0,
        gear: 'N',
        rpm: 0.2,
        handbrake: false,
        alive: true,
    };
}

export function resetPlayerCar(gameState, x, z, yaw = 0) {
    const car = gameState.playerCar;
    if (!car) return;
    const spawn = (x !== undefined && z !== undefined)
        ? { x, z, yaw }
        : (gameState.carSpawn || { x: (gameState.helipad?.x || 0) + 20, z: gameState.helipad?.z || 0, yaw: 0 });
    const gy = gameState.world ? gameState.world.getHeight(spawn.x, spawn.z) : 0;
    car.position.set(spawn.x, gy, spawn.z);
    car.velocity.set(0, 0, 0);
    car.yaw = spawn.yaw || 0;
    car.speedMs = 0;
    car.speed = 0;
    car.steerAngle = 0;
    car.gear = 'N';
    car.group.rotation.set(0, car.yaw, 0);
    car.chassis.rotation.set(0, 0, 0);
}

let crashCooldown = 0;

export function updatePlayerCar(gameState, isActive) {
    const car = gameState.playerCar;
    if (!car || !car.group) return;
    const dt = gameState.delta;
    if (dt <= 0) return;
    crashCooldown = Math.max(0, crashCooldown - dt);

    const k = isActive && gameState.input ? gameState.input.keys : {};
    const throttle = (k['KeyW'] || k['ArrowUp']) ? 1 : 0;
    const brakeRev = (k['KeyS'] || k['ArrowDown']) ? 1 : 0;
    const steerIn  = ((k['KeyD'] || k['ArrowRight']) ? 1 : 0) - ((k['KeyA'] || k['ArrowLeft']) ? 1 : 0);
    const handbrake = !!k['Space'];

    const world = gameState.world;
    const onRoad = world ? world.isRoad(car.position.x, car.position.z) : true;
    const inWater = world ? world.isWater(car.position.x, car.position.z) : false;
    const surfaceMax = inWater ? 11 : onRoad ? MAX_FWD_SPEED : MAX_FWD_SPEED * 0.68;

    // Smooth steering response (tighter at high speed so it doesn't twitch on Via Emilia)
    const speedRatio = Math.min(1, Math.abs(car.speedMs) / MAX_FWD_SPEED);
    const maxSteerNow = STEER_MAX * (1 - speedRatio * 0.58);
    const targetSteer = -steerIn * maxSteerNow;
    car.steerAngle += (targetSteer - car.steerAngle) * Math.min(1, dt * 10);
    for (const p of car.steerPivots) p.rotation.y = car.steerAngle;

    // Longitudinal acceleration / braking / reverse
    let braking = false;
    if (isActive) {
        if (throttle > 0) {
            if (car.speedMs < -0.5) {
                car.speedMs += BRAKE_DECEL * dt;
                braking = true;
            } else {
                const pull = ACCEL_ROAD * (1 - Math.max(0, car.speedMs) / (surfaceMax + 4));
                car.speedMs += pull * dt;
            }
        } else if (brakeRev > 0) {
            if (car.speedMs > 1.0) {
                car.speedMs -= BRAKE_DECEL * dt;
                braking = true;
            } else {
                car.speedMs = Math.max(-MAX_REV_SPEED, car.speedMs - ACCEL_ROAD * 0.7 * dt);
            }
        } else {
            // Natural rolling / engine braking
            const drag = onRoad ? 2.4 : 5.5;
            if (Math.abs(car.speedMs) < 0.25) car.speedMs = 0;
            else car.speedMs -= Math.sign(car.speedMs) * drag * dt;
        }
        if (handbrake) {
            braking = true;
            car.speedMs *= Math.max(0, 1 - 3.6 * dt);
        }
    } else {
        // Parked with handbrake engaged when player is flying the helicopter
        car.speedMs *= Math.max(0, 1 - 6.0 * dt);
        if (Math.abs(car.speedMs) < 0.1) car.speedMs = 0;
    }

    car.speedMs = THREE.MathUtils.clamp(car.speedMs, -MAX_REV_SPEED, surfaceMax);
    car.brakeMat.visible = braking;
    car.handbrake = handbrake;

    // Bicycle-model turning + playful rear slip on handbrake
    if (Math.abs(car.speedMs) > 0.15) {
        const hbBoost = handbrake ? 1.65 : 1.0;
        const yawDelta = (car.speedMs / WHEELBASE) * Math.tan(car.steerAngle) * hbBoost * dt;
        car.yaw += yawDelta;
    }

    const sinY = Math.sin(car.yaw), cosY = Math.cos(car.yaw);
    // Lateral velocity blend (slight drift on dirt or handbrake)
    const grip = handbrake ? 2.8 : onRoad ? 11.0 : 6.0;
    const targetVx = sinY * car.speedMs;
    const targetVz = cosY * car.speedMs;
    car.velocity.x += (targetVx - car.velocity.x) * Math.min(1, grip * dt);
    car.velocity.z += (targetVz - car.velocity.z) * Math.min(1, grip * dt);

    car.position.x += car.velocity.x * dt;
    car.position.z += car.velocity.z * dt;

    // World bounds
    const bound = world ? world.size / 2 - 150 : 3900;
    car.position.x = THREE.MathUtils.clamp(car.position.x, -bound, bound);
    car.position.z = THREE.MathUtils.clamp(car.position.z, -bound, bound);

    // Building collision
    const probe = new THREE.Vector3(car.position.x, car.position.y + 0.9, car.position.z);
    const hitB = checkBuildingCollision(gameState, probe, 1.4);
    if (hitB) {
        const dx = car.position.x - hitB.position.x;
        const dz = car.position.z - hitB.position.z;
        const nx = dx / (hitB.width * 0.5 + 1.5);
        const nz = dz / (hitB.depth * 0.5 + 1.5);
        if (Math.abs(nx) > Math.abs(nz)) {
            car.position.x = hitB.position.x + Math.sign(nx || 1) * (hitB.width * 0.5 + 1.6);
        } else {
            car.position.z = hitB.position.z + Math.sign(nz || 1) * (hitB.depth * 0.5 + 1.6);
        }
        const impact = Math.abs(car.speedMs);
        car.speedMs *= -0.25;
        car.velocity.multiplyScalar(-0.25);
        if (isActive && impact > 5 && crashCooldown <= 0) {
            crashCooldown = 0.4;
            triggerScreenShake(gameState, Math.min(1.2, impact * 0.06), 0.2);
            if (gameState.audio) gameState.audio.playHit();
        }
    }

    // Ground height & natural terrain slope pitch/roll (front/back/left/right sampling)
    const gh = world ? world.getHeight(car.position.x, car.position.z) : 0;
    car.position.y = gh;

    let terrainPitch = 0, terrainRoll = 0;
    if (world) {
        const hFront = world.getHeight(car.position.x + sinY * 1.6, car.position.z + cosY * 1.6);
        const hBack  = world.getHeight(car.position.x - sinY * 1.6, car.position.z - cosY * 1.6);
        const rX = -cosY, rZ = sinY;
        const hRight = world.getHeight(car.position.x + rX * 0.9, car.position.z + rZ * 0.9);
        const hLeft  = world.getHeight(car.position.x - rX * 0.9, car.position.z - rZ * 0.9);
        terrainPitch = -Math.atan2(hFront - hBack, 3.2);
        terrainRoll  = Math.atan2(hRight - hLeft, 1.8);
    }

    // Suspension squat/dive & cornering body roll (classic soft French 80s suspension!)
    const suspDive = braking ? 0.045 : (throttle > 0 && isActive ? -0.03 : 0);
    const bodyRoll = steerIn * Math.min(1, Math.abs(car.speedMs) / 18) * 0.08;

    car.group.rotation.set(terrainPitch, car.yaw, terrainRoll, 'YXZ');
    car.chassis.rotation.x += (suspDive - car.chassis.rotation.x) * Math.min(1, dt * 8);
    car.chassis.rotation.z += (bodyRoll - car.chassis.rotation.z) * Math.min(1, dt * 8);

    // Wheel spin
    const spin = (car.speedMs * dt) / 0.31;
    for (const w of car.wheelMeshes) w.rotation.x += spin;

    // Speed & 5-speed manual gearbox calculation (for HUD & engine audio)
    car.speed = Math.abs(car.speedMs) * 3.6;
    if (car.speedMs < -0.4) {
        car.gear = 'R';
        car.rpm = 0.25 + Math.min(0.75, Math.abs(car.speedMs) / MAX_REV_SPEED * 0.75);
    } else if (car.speed < 2) {
        car.gear = 'N';
        car.rpm = throttle > 0 ? 0.45 : 0.18;
    } else {
        const thresholds = [0, 28, 56, 86, 118, 160]; // km/h per gear 1..5
        let g = 1;
        while (g < 5 && car.speed > thresholds[g]) g++;
        car.gear = String(g);
        const lo = thresholds[g - 1] * 0.72;
        const hi = thresholds[g];
        car.rpm = THREE.MathUtils.clamp((car.speed - lo) / Math.max(10, hi - lo), 0.28, 0.98);
    }
}
