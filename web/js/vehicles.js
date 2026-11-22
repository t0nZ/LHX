// ============================================
// VEHICLES.JS — Civilian Cars Driving on Real OSM Roads
// --------------------------------------------
// Uses shared geometries/materials and distance culling (< 1100 m)
// to keep draw calls minimal on Intel integrated GPUs.
// ============================================
import * as THREE from 'three';

const CAR_COLORS = [
    0xcc3333, 0x3344aa, 0xeeeeee, 0x333333,
    0x44aa44, 0xddaa22, 0x885522, 0xaa4488,
];
const MAX_CARS = 30;
const CULL_DIST_SQ = 1100 * 1100;

let sharedGeos = null;
let sharedMats = null;
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _look = new THREE.Vector3();

function ensureShared() {
    if (sharedGeos) return;
    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 6);
    wheelGeo.rotateZ(Math.PI / 2);
    sharedGeos = {
        body: new THREE.BoxGeometry(1.8, 0.7, 3.5),
        cabin: new THREE.BoxGeometry(1.5, 0.5, 1.8),
        wheel: wheelGeo,
    };
    sharedMats = {
        bodies: CAR_COLORS.map(color => new THREE.MeshLambertMaterial({ color, flatShading: true })),
        cabin: new THREE.MeshLambertMaterial({ color: 0x555566, flatShading: true }),
        wheel: new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true }),
    };
}

export function initVehicles(gameState) {
    gameState.vehicles = [];
    ensureShared();

    let seed = 777;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const roads = gameState.world ? gameState.world.roadPaths : [];
    if (!roads.length) return;

    for (let i = 0; i < MAX_CARS; i++) {
        const pathIndex = Math.floor(rand() * roads.length);
        const path = roads[pathIndex];
        if (!path || path.points.length < 2) continue;

        const segIndex = Math.floor(rand() * (path.points.length - 1));
        const t = rand();
        const pos = path.points[segIndex].clone().lerp(path.points[segIndex + 1], t);
        const dir = path.points[segIndex + 1].clone().sub(path.points[segIndex]).normalize();
        const reversed = rand() > 0.5;
        if (reversed) dir.negate();

        const car = createCarMesh(Math.floor(rand() * CAR_COLORS.length));
        car.position.copy(pos);
        car.position.y = (gameState.world ? gameState.world.getHeight(pos.x, pos.z) : 0) + 0.5;
        if (dir.lengthSq() > 0.001) car.lookAt(car.position.x + dir.x, car.position.y, car.position.z + dir.z);

        const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        car.position.addScaledVector(right, reversed ? 2.6 : -2.6);
        gameState.scene.add(car);

        gameState.vehicles.push({
            mesh: car,
            position: car.position.clone(),
            direction: dir.clone(),
            speed: 7 + rand() * 11, // 25–65 km/h
            pathIndex,
            segIndex,
            segT: t,
            reversed,
            state: 'driving',
        });
    }
}

function createCarMesh(colorIdx) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(sharedGeos.body, sharedMats.bodies[colorIdx % sharedMats.bodies.length]);
    body.position.y = 0.35;
    group.add(body);

    const cabin = new THREE.Mesh(sharedGeos.cabin, sharedMats.cabin);
    cabin.position.set(0, 0.95, -0.2);
    group.add(cabin);

    for (const [wx, wy, wz] of [[-0.9, 0.25, 1.0], [0.9, 0.25, 1.0], [-0.9, 0.25, -1.0], [0.9, 0.25, -1.0]]) {
        const wheel = new THREE.Mesh(sharedGeos.wheel, sharedMats.wheel);
        wheel.position.set(wx, wy, wz);
        group.add(wheel);
    }
    group.scale.setScalar(0.8);
    return group;
}

export function updateVehicles(gameState) {
    const dt = gameState.delta;
    const roads = gameState.world ? gameState.world.roadPaths : [];
    const camPos = gameState.camera ? gameState.camera.position : null;

    for (const v of gameState.vehicles) {
        if (v.state !== 'driving') continue;
        const path = roads[v.pathIndex];
        if (!path || path.points.length < 2) continue;

        // Distance culling for Intel iGPU
        if (camPos) {
            const dx = v.position.x - camPos.x, dz = v.position.z - camPos.z;
            const visible = (dx * dx + dz * dz) < CULL_DIST_SQ;
            v.mesh.visible = visible;
            if (!visible) continue;
        }

        const p0cur = path.points[v.segIndex];
        const p1cur = path.points[Math.min(v.segIndex + 1, path.points.length - 1)];
        const segLen = Math.max(2, p0cur.distanceTo(p1cur));
        const direction = v.reversed ? -1 : 1;
        v.segT += (direction * v.speed * dt) / segLen;

        // Advance segments safely (bounded loop, never hangs)
        let guard = 8;
        while (v.segT >= 1 && guard-- > 0) {
            v.segT -= 1;
            v.segIndex++;
            if (v.segIndex >= path.points.length - 1) {
                if (path.loop) {
                    v.segIndex = 0;
                } else {
                    v.reversed = true;
                    v.segIndex = path.points.length - 2;
                    v.segT = 0.99;
                    break;
                }
            }
        }
        guard = 8;
        while (v.segT < 0 && guard-- > 0) {
            v.segT += 1;
            v.segIndex--;
            if (v.segIndex < 0) {
                if (path.loop) {
                    v.segIndex = path.points.length - 2;
                } else {
                    v.reversed = false;
                    v.segIndex = 0;
                    v.segT = 0.01;
                    break;
                }
            }
        }

        const p0 = path.points[v.segIndex];
        const p1 = path.points[Math.min(v.segIndex + 1, path.points.length - 1)];
        _target.lerpVectors(p0, p1, THREE.MathUtils.clamp(v.segT, 0, 1));

        _dir.subVectors(p1, p0);
        _dir.y = 0;
        if (_dir.lengthSq() > 0.0001) _dir.normalize();
        if (v.reversed) _dir.negate();

        _right.set(-_dir.z, 0, _dir.x);
        _target.addScaledVector(_right, v.reversed ? 2.6 : -2.6);
        _target.y = (gameState.world ? gameState.world.getHeight(_target.x, _target.z) : 0) + 0.5;

        v.mesh.position.lerp(_target, Math.min(1, dt * 8));
        if (_dir.lengthSq() > 0.0001) {
            _look.copy(v.mesh.position).addScaledVector(_dir, 5);
            v.mesh.lookAt(_look);
        }
        v.position.copy(v.mesh.position);
    }
}
