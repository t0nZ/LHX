// ============================================
// VEHICLES.JS — Civilian Cars Driving on Roads
// ============================================
import * as THREE from 'three';

const CAR_COLORS = [
    0xcc3333, // Red Fiat
    0x3344aa, // Blue
    0xeeeeee, // White
    0x333333, // Black
    0x44aa44, // Green
    0xddaa22, // Yellow
    0x885522, // Brown
    0xaa4488, // Purple
];

const MAX_CARS = 25;

export function initVehicles(gameState) {
    gameState.vehicles = [];
    
    let seed = 777;
    function rand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return seed / 2147483647;
    }
    
    const roads = gameState.world ? gameState.world.roadPaths : [];
    
    for (let i = 0; i < MAX_CARS; i++) {
        // Pick a random road path
        const pathIndex = Math.floor(rand() * roads.length);
        const path = roads[pathIndex];
        if (!path || path.points.length < 2) continue;
        
        // Random position along path
        const segIndex = Math.floor(rand() * (path.points.length - 1));
        const t = rand();
        const pos = path.points[segIndex].clone().lerp(path.points[segIndex + 1], t);
        
        // Direction
        const dir = path.points[Math.min(segIndex + 1, path.points.length - 1)]
            .clone().sub(path.points[segIndex]).normalize();
        
        // Sometimes reverse direction
        const reversed = rand() > 0.5;
        if (reversed) dir.negate();
        
        // Create car mesh
        const car = createCarMesh(rand, CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]);
        car.position.copy(pos);
        car.position.y += 0.5;
        
        // Orient car along road
        if (dir.length() > 0) {
            car.lookAt(pos.clone().add(dir));
        }
        
        // Offset to one side of road
        const sideOffset = reversed ? 3 : -3;
        const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        car.position.add(right.multiplyScalar(sideOffset));
        
        gameState.scene.add(car);
        
        gameState.vehicles.push({
            mesh: car,
            position: car.position.clone(),
            direction: dir.clone(),
            speed: 5 + rand() * 10, // 5-15 m/s (18-54 km/h)
            pathIndex,
            segIndex,
            segT: t,
            reversed,
            state: 'driving',
        });
    }
}

function createCarMesh(rand, color) {
    const group = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.7, 3.5);
    const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.35;
    group.add(body);
    
    // Cabin/roof
    const cabinGeo = new THREE.BoxGeometry(1.5, 0.5, 1.8);
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x555566, flatShading: true });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.y = 0.95;
    cabin.position.z = -0.2;
    group.add(cabin);
    
    // Wheels (4 small cylinders)
    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 6);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
    
    const wheelPositions = [
        [-0.9, 0.25, 1.0],
        [0.9, 0.25, 1.0],
        [-0.9, 0.25, -1.0],
        [0.9, 0.25, -1.0],
    ];
    
    for (const [wx, wy, wz] of wheelPositions) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(wx, wy, wz);
        group.add(wheel);
    }
    
    group.scale.setScalar(0.8);
    return group;
}

export function updateVehicles(gameState) {
    const dt = gameState.delta;
    const roads = gameState.world ? gameState.world.roadPaths : [];
    
    for (const v of gameState.vehicles) {
        if (v.state !== 'driving') continue;
        
        const path = roads[v.pathIndex];
        if (!path || path.points.length < 2) continue;
        
        // Move along path
        const direction = v.reversed ? -1 : 1;
        v.segT += direction * v.speed * dt / 50; // Normalized speed
        
        // Next segment
        while (v.segT >= 1) {
            v.segT -= 1;
            v.segIndex++;
            if (v.segIndex >= path.points.length - 1) {
                if (path.loop) {
                    v.segIndex = 0;
                } else {
                    // Reverse direction
                    v.reversed = !v.reversed;
                    v.segIndex = path.points.length - 2;
                    v.segT = 1;
                }
            }
        }
        while (v.segT < 0) {
            v.segT += 1;
            v.segIndex--;
            if (v.segIndex < 0) {
                if (path.loop) {
                    v.segIndex = path.points.length - 2;
                } else {
                    v.reversed = !v.reversed;
                    v.segIndex = 0;
                    v.segT = 0;
                }
            }
        }
        
        // Interpolate position
        const p0 = path.points[v.segIndex];
        const p1 = path.points[Math.min(v.segIndex + 1, path.points.length - 1)];
        const targetPos = p0.clone().lerp(p1, v.segT);
        
        // Side offset
        const dir = p1.clone().sub(p0).normalize();
        if (v.reversed) dir.negate();
        const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        targetPos.add(right.multiplyScalar(v.reversed ? 3 : -3));
        targetPos.y = (gameState.world ? gameState.world.getHeight(targetPos.x, targetPos.z) : 0) + 0.5;
        
        // Smooth position update
        v.mesh.position.lerp(targetPos, 0.1);
        
        // Orient car
        if (dir.length() > 0.01) {
            const lookTarget = v.mesh.position.clone().add(dir.multiplyScalar(5));
            v.mesh.lookAt(lookTarget);
        }
        
        v.position.copy(v.mesh.position);
    }
}
