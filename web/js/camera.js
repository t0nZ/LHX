// ============================================
// CAMERA.JS — Camera System (LHX Helicopter & 1986 Peugeot 205)
// ============================================
import * as THREE from 'three';

let cameraMode = 0; // 0 = CHASE, 1 = COCKPIT, 2 = TOP
const MODES = ['CHASE', 'COCKPIT', 'TOP'];

const HELI_CHASE_OFFSET = new THREE.Vector3(0, 7, -20);
const HELI_COCKPIT_OFFSET = new THREE.Vector3(0, 1.4, 2.0);
const CAR_CHASE_OFFSET = new THREE.Vector3(0, 2.45, -7.2);
const CAR_HOOD_OFFSET = new THREE.Vector3(-0.32, 1.24, 0.25); // left-hand-drive driver seat / hood view!
const UP = new THREE.Vector3(0, 1, 0);

export function initCamera(gameState) {
    const camera = new THREE.PerspectiveCamera(
        65,
        window.innerWidth / window.innerHeight,
        0.35,
        5000
    );
    camera.position.set(0, 70, -320);
    gameState.camera = camera;
    gameState.cameraMode = MODES[cameraMode];
}

export function updateCamera(gameState) {
    const camera = gameState.camera;
    const h = gameState.helicopter;
    const car = gameState.playerCar;
    const isCar = gameState.activeVehicle === 'car' && car && car.group;
    const dt = gameState.delta;

    if (isCar) {
        if (h && h.group) h.group.visible = h.alive;
        const lerpFactor = 1 - Math.exp(-8.5 * dt);

        if (gameState.cameraMode === 'CHASE') {
            car.group.visible = true;
            const offset = CAR_CHASE_OFFSET.clone().applyAxisAngle(UP, car.yaw);
            const targetPos = car.position.clone().add(offset);
            const groundH = gameState.world ? gameState.world.getHeight(targetPos.x, targetPos.z) : 0;
            targetPos.y = Math.max(targetPos.y, groundH + 1.4);
            camera.position.lerp(targetPos, lerpFactor);

            const lookTarget = car.position.clone().add(new THREE.Vector3(0, 1.0, 9).applyAxisAngle(UP, car.yaw));
            camera.lookAt(lookTarget);
        } else if (gameState.cameraMode === 'COCKPIT') {
            // Left-hand-drive windshield view looking out over the grey 205 bonnet!
            car.group.visible = true;
            const offset = new THREE.Vector3(-0.32, 1.26, 0.88).applyQuaternion(car.group.quaternion);
            camera.position.copy(car.position).add(offset);
            const forward = new THREE.Vector3(-0.32, 1.15, 22).applyQuaternion(car.group.quaternion);
            camera.lookAt(car.position.clone().add(forward));
        } else {
            car.group.visible = true;
            const targetPos = new THREE.Vector3(car.position.x, car.position.y + 46, car.position.z - 14);
            camera.position.lerp(targetPos, lerpFactor);
            camera.lookAt(car.position);
        }
        return;
    }

    if (!h || !h.group) return;
    if (car && car.group) car.group.visible = true;
    const lerpFactor = 1 - Math.exp(-4.0 * dt);

    if (gameState.cameraMode === 'CHASE') {
        h.group.visible = h.alive;
        const offset = HELI_CHASE_OFFSET.clone().applyAxisAngle(UP, h.yaw);
        const targetPos = h.position.clone().add(offset);
        const groundH = gameState.world ? gameState.world.getHeight(targetPos.x, targetPos.z) : 0;
        targetPos.y = Math.max(targetPos.y, groundH + 3);
        camera.position.lerp(targetPos, lerpFactor);

        const lookTarget = h.position.clone().add(new THREE.Vector3(0, 2, 12).applyAxisAngle(UP, h.yaw));
        camera.lookAt(lookTarget);
    } else if (gameState.cameraMode === 'COCKPIT') {
        h.group.visible = false;
        const offset = HELI_COCKPIT_OFFSET.clone().applyQuaternion(h.group.quaternion);
        camera.position.copy(h.position).add(offset);
        const forward = new THREE.Vector3(0, 0, 20).applyQuaternion(h.group.quaternion);
        camera.lookAt(h.position.clone().add(forward));
    } else if (gameState.cameraMode === 'TOP') {
        h.group.visible = h.alive;
        const targetPos = new THREE.Vector3(h.position.x, h.position.y + 100, h.position.z - 30);
        camera.position.lerp(targetPos, lerpFactor);
        camera.lookAt(h.position);
    }
}

export function cycleCamera(gameState) {
    cameraMode = (cameraMode + 1) % MODES.length;
    gameState.cameraMode = MODES[cameraMode];
    const container = document.getElementById('hud-notifications');
    if (container) {
        const div = document.createElement('div');
        div.className = 'notification';
        div.textContent = `CAMERA: ${MODES[cameraMode]}`;
        container.appendChild(div);
        setTimeout(() => div.remove(), 2500);
    }
}
