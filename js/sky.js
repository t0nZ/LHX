// ============================================
// SKY.JS — Sky Gradient, Fog & Lighting
// ============================================
import * as THREE from 'three';

export function initSky(gameState) {
    const scene = gameState.scene;

    // Sky color gradient via vertex colors on a large sphere
    const skyGeo = new THREE.SphereGeometry(4000, 32, 15);
    const skyPositions = skyGeo.attributes.position;
    const skyColors = new Float32Array(skyPositions.count * 3);

    // Top color: deep blue   (0.35, 0.55, 0.85)
    // Horizon:  warm haze    (0.75, 0.80, 0.85)
    // Bottom:   ground brown (0.45, 0.42, 0.35)
    for (let i = 0; i < skyPositions.count; i++) {
        const y = skyPositions.getY(i);
        const normalizedY = (y + 4000) / 8000; // 0 = bottom, 1 = top

        let r, g, b;
        if (normalizedY > 0.52) {
            // Upper sky: blue gradient
            const t = (normalizedY - 0.52) / 0.48;
            r = THREE.MathUtils.lerp(0.70, 0.30, t);
            g = THREE.MathUtils.lerp(0.78, 0.50, t);
            b = THREE.MathUtils.lerp(0.85, 0.82, t);
        } else {
            // Lower sky / horizon haze
            const t = normalizedY / 0.52;
            r = THREE.MathUtils.lerp(0.55, 0.70, t);
            g = THREE.MathUtils.lerp(0.50, 0.78, t);
            b = THREE.MathUtils.lerp(0.40, 0.85, t);
        }

        skyColors[i * 3]     = r;
        skyColors[i * 3 + 1] = g;
        skyColors[i * 3 + 2] = b;
    }

    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
    const skyMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        depthWrite: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -1;
    scene.add(sky);
    gameState.sky = sky;

    // Fog — mimics the LHX draw distance effect
    scene.fog = new THREE.Fog(0xb3c8d9, 300, 2200);

    // Ambient light — soft overall illumination
    const ambient = new THREE.AmbientLight(0x8899aa, 0.7);
    scene.add(ambient);

    // Directional light — sun
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
    sun.position.set(300, 500, 200);
    sun.castShadow = false; // No shadows for retro look
    scene.add(sun);
    gameState.sun = sun;

    // Secondary fill light
    const fill = new THREE.DirectionalLight(0x8899cc, 0.3);
    fill.position.set(-200, 200, -100);
    scene.add(fill);
}

export function updateSky(gameState) {
    // Sky follows camera position (infinite sky effect)
    if (gameState.camera) {
        gameState.sky.position.x = gameState.camera.position.x;
        gameState.sky.position.z = gameState.camera.position.z;
    }
}
