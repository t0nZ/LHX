// ============================================
// CAMERA.JS — Camera System (1st/3rd Person)
// ============================================
import * as THREE from 'three';

let cameraMode = 0; // 0 = third person, 1 = first person, 2 = top-down
const MODES = ['CHASE', 'COCKPIT', 'TOP'];
const LERP_SPEED = 4.0;

// Chase camera offsets
const CHASE_OFFSET = new THREE.Vector3(0, 7, -20);
const COCKPIT_OFFSET = new THREE.Vector3(0, 1.4, 2.0);
const UP = new THREE.Vector3(0, 1, 0);

export function initCamera(gameState) {
    const camera = new THREE.PerspectiveCamera(
        65, // FOV
        window.innerWidth / window.innerHeight,
        0.5,
        5000
    );
    camera.position.set(0, 70, -320);
    gameState.camera = camera;
    
    // Resize is handled in retro.js (low-res render target)
    
    gameState.cameraMode = MODES[cameraMode];
}

export function updateCamera(gameState) {
    const camera = gameState.camera;
    const h = gameState.helicopter;
    if (!h || !h.group) return;
    
    const dt = gameState.delta;
    const lerpFactor = 1 - Math.exp(-LERP_SPEED * dt);
    
    if (gameState.cameraMode === 'CHASE') {
        // Third-person chase cam
        h.group.visible = h.alive;
        const offset = CHASE_OFFSET.clone();
        offset.applyAxisAngle(UP, h.yaw);
        const targetPos = h.position.clone().add(offset);
        
        // Don't go below ground
        const groundH = gameState.world ? gameState.world.getHeight(targetPos.x, targetPos.z) : 0;
        targetPos.y = Math.max(targetPos.y, groundH + 3);
        
        camera.position.lerp(targetPos, lerpFactor);
        
        // Look at helicopter, slightly ahead
        const lookTarget = h.position.clone();
        const forward = new THREE.Vector3(0, 2, 12).applyAxisAngle(UP, h.yaw);
        lookTarget.add(forward);
        camera.lookAt(lookTarget);
        
    } else if (gameState.cameraMode === 'COCKPIT') {
        // First-person cockpit view (hide own model)
        h.group.visible = false;
        const offset = COCKPIT_OFFSET.clone();
        offset.applyQuaternion(h.group.quaternion);
        const targetPos = h.position.clone().add(offset);
        
        camera.position.copy(targetPos);
        
        // Look forward from cockpit
        const forward = new THREE.Vector3(0, 0, 20).applyQuaternion(h.group.quaternion);
        camera.lookAt(h.position.clone().add(forward));
        
    } else if (gameState.cameraMode === 'TOP') {
        // Top-down tactical view
        h.group.visible = h.alive;
        const targetPos = new THREE.Vector3(
            h.position.x,
            h.position.y + 100,
            h.position.z - 30
        );
        camera.position.lerp(targetPos, lerpFactor);
        camera.lookAt(h.position);
    }
}

export function cycleCamera(gameState) {
    cameraMode = (cameraMode + 1) % MODES.length;
    gameState.cameraMode = MODES[cameraMode];
    showNotification(gameState, `CAMERA: ${MODES[cameraMode]}`);
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
