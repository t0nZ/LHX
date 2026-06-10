// ============================================
// ANIMALS.JS — Chickens, Cows, Boars, Wolves
// ============================================
import * as THREE from 'three';

const ANIMAL_TYPES = {
    chicken: { count: 30, speed: 2, color: 0xeeeecc, scale: 0.3, fleeRadius: 40, groupSize: 5 },
    cow:     { count: 25, speed: 1, color: 0xeeeeee, scale: 0.8, fleeRadius: 50, groupSize: 4 },
    boar:    { count: 15, speed: 4, color: 0x665544, scale: 0.6, fleeRadius: 60, groupSize: 3 },
    wolf:    { count: 8,  speed: 5, color: 0x888888, scale: 0.5, fleeRadius: 80, groupSize: 2 },
};

export function initAnimals(gameState) {
    gameState.animals = [];
    
    let seed = 314;
    function rand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return seed / 2147483647;
    }
    
    for (const [type, config] of Object.entries(ANIMAL_TYPES)) {
        // Place in groups
        const groups = Math.ceil(config.count / config.groupSize);
        
        for (let g = 0; g < groups; g++) {
            // Group center in countryside (avoid town center)
            let cx, cz;
            let attempts = 0;
            do {
                cx = (rand() - 0.5) * 1600;
                cz = (rand() - 0.5) * 1600;
                attempts++;
            } while (attempts < 50 && (
                (Math.abs(cx) < 250 && Math.abs(cz) < 200) || // Skip town
                (gameState.world && gameState.world.isWater(cx, cz)) ||
                (gameState.world && gameState.world.isRoad(cx, cz))
            ));
            
            // Wolves more in outskirts
            if (type === 'wolf' && Math.sqrt(cx*cx + cz*cz) < 500) continue;
            
            const groupCount = Math.min(config.groupSize, config.count - g * config.groupSize);
            
            for (let i = 0; i < groupCount; i++) {
                const x = cx + (rand() - 0.5) * 20;
                const z = cz + (rand() - 0.5) * 20;
                const y = gameState.world ? gameState.world.getHeight(x, z) : 0;
                
                const mesh = createAnimalMesh(type, config, rand);
                mesh.position.set(x, y, z);
                mesh.rotation.y = rand() * Math.PI * 2;
                gameState.scene.add(mesh);
                
                gameState.animals.push({
                    mesh,
                    type,
                    position: mesh.position.clone(),
                    velocity: new THREE.Vector3(0, 0, 0),
                    state: 'idle', // idle, walking, fleeing
                    stateTimer: rand() * 5,
                    targetAngle: rand() * Math.PI * 2,
                    speed: config.speed,
                    fleeRadius: config.fleeRadius,
                    walkSpeed: config.speed * 0.5,
                    runSpeed: config.speed * 2,
                    groupCenter: new THREE.Vector3(cx, 0, cz),
                    bobPhase: rand() * Math.PI * 2,
                });
            }
        }
    }
}

function createAnimalMesh(type, config, rand) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: config.color, flatShading: true });
    
    switch (type) {
        case 'chicken': {
            // Body: small ellipsoid (stretched sphere)
            const body = new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 5, 4),
                new THREE.MeshLambertMaterial({ color: 0xeeeecc, flatShading: true })
            );
            body.scale.set(0.8, 0.8, 1.2);
            body.position.y = 0.3;
            group.add(body);
            
            // Head
            const head = new THREE.Mesh(
                new THREE.SphereGeometry(0.15, 4, 3),
                new THREE.MeshLambertMaterial({ color: 0xeeeecc, flatShading: true })
            );
            head.position.set(0, 0.45, 0.25);
            group.add(head);
            
            // Beak
            const beak = new THREE.Mesh(
                new THREE.ConeGeometry(0.05, 0.12, 3),
                new THREE.MeshLambertMaterial({ color: 0xdd8800, flatShading: true })
            );
            beak.position.set(0, 0.42, 0.4);
            beak.rotation.x = -Math.PI / 2;
            group.add(beak);
            
            // Comb (red on top of head)
            const comb = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.1, 0.1),
                new THREE.MeshLambertMaterial({ color: 0xcc2222, flatShading: true })
            );
            comb.position.set(0, 0.55, 0.22);
            group.add(comb);
            
            // Legs
            for (const side of [-0.08, 0.08]) {
                const leg = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.015, 0.015, 0.2, 3),
                    new THREE.MeshLambertMaterial({ color: 0xddaa00, flatShading: true })
                );
                leg.position.set(side, 0.1, 0);
                group.add(leg);
            }
            break;
        }
        
        case 'cow': {
            // Body: large box
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.9, 0.7, 1.4),
                new THREE.MeshLambertMaterial({ color: 0xeeeeee, flatShading: true })
            );
            body.position.y = 0.7;
            group.add(body);
            
            // Spots (darker patches)
            if (rand() > 0.3) {
                const spot = new THREE.Mesh(
                    new THREE.BoxGeometry(0.4, 0.35, 0.5),
                    new THREE.MeshLambertMaterial({ color: 0x443322, flatShading: true })
                );
                spot.position.set(0.15, 0.8, 0.2);
                group.add(spot);
            }
            
            // Head
            const head = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.4, 0.4),
                new THREE.MeshLambertMaterial({ color: 0xdddddd, flatShading: true })
            );
            head.position.set(0, 0.85, 0.8);
            group.add(head);
            
            // Horns
            for (const side of [-0.15, 0.15]) {
                const horn = new THREE.Mesh(
                    new THREE.ConeGeometry(0.03, 0.15, 3),
                    new THREE.MeshLambertMaterial({ color: 0xccbb88, flatShading: true })
                );
                horn.position.set(side, 1.1, 0.8);
                group.add(horn);
            }
            
            // Legs (4)
            const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 4);
            const legMat = new THREE.MeshLambertMaterial({ color: 0xdddddd, flatShading: true });
            for (const [lx, lz] of [[-0.3, 0.4], [0.3, 0.4], [-0.3, -0.4], [0.3, -0.4]]) {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(lx, 0.25, lz);
                group.add(leg);
            }
            
            // Tail
            const tail = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.01, 0.5, 3),
                new THREE.MeshLambertMaterial({ color: 0xccccbb, flatShading: true })
            );
            tail.position.set(0, 0.7, -0.8);
            tail.rotation.x = 0.5;
            group.add(tail);
            break;
        }
        
        case 'boar': {
            // Body: stocky oval
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.6, 0.5, 1.0),
                mat
            );
            body.position.y = 0.45;
            group.add(body);
            
            // Head (snout)
            const head = new THREE.Mesh(
                new THREE.BoxGeometry(0.35, 0.3, 0.3),
                new THREE.MeshLambertMaterial({ color: 0x554433, flatShading: true })
            );
            head.position.set(0, 0.45, 0.6);
            group.add(head);
            
            // Snout
            const snout = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.1, 0.1, 4),
                new THREE.MeshLambertMaterial({ color: 0x886655, flatShading: true })
            );
            snout.rotation.x = Math.PI / 2;
            snout.position.set(0, 0.4, 0.78);
            group.add(snout);
            
            // Legs
            const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 3);
            const legMat = new THREE.MeshLambertMaterial({ color: 0x443322, flatShading: true });
            for (const [lx, lz] of [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]]) {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(lx, 0.15, lz);
                group.add(leg);
            }
            break;
        }
        
        case 'wolf': {
            // Body: lean
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.4, 1.0),
                mat
            );
            body.position.y = 0.5;
            group.add(body);
            
            // Head
            const head = new THREE.Mesh(
                new THREE.BoxGeometry(0.25, 0.25, 0.35),
                new THREE.MeshLambertMaterial({ color: 0x777777, flatShading: true })
            );
            head.position.set(0, 0.6, 0.6);
            group.add(head);
            
            // Ears
            for (const side of [-0.1, 0.1]) {
                const ear = new THREE.Mesh(
                    new THREE.ConeGeometry(0.04, 0.12, 3),
                    new THREE.MeshLambertMaterial({ color: 0x666666, flatShading: true })
                );
                ear.position.set(side, 0.78, 0.6);
                group.add(ear);
            }
            
            // Tail (bushy)
            const tail = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.02, 0.5, 3),
                new THREE.MeshLambertMaterial({ color: 0x999999, flatShading: true })
            );
            tail.position.set(0, 0.5, -0.6);
            tail.rotation.x = -0.8;
            group.add(tail);
            
            // Legs
            const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 3);
            const legMat = new THREE.MeshLambertMaterial({ color: 0x777777, flatShading: true });
            for (const [lx, lz] of [[-0.15, 0.3], [0.15, 0.3], [-0.15, -0.3], [0.15, -0.3]]) {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(lx, 0.17, lz);
                group.add(leg);
            }
            break;
        }
    }
    
    group.scale.setScalar(config.scale);
    return group;
}

export function updateAnimals(gameState) {
    const dt = gameState.delta;
    const heliPos = gameState.helicopter ? gameState.helicopter.position : null;
    
    for (const a of gameState.animals) {
        a.stateTimer -= dt;
        
        // Check distance to helicopter for fleeing
        let distToHeli = Infinity;
        if (heliPos) {
            distToHeli = a.position.distanceTo(heliPos);
        }
        
        // State machine
        switch (a.state) {
            case 'idle':
                if (distToHeli < a.fleeRadius) {
                    a.state = 'fleeing';
                    a.stateTimer = 3 + Math.random() * 2;
                    break;
                }
                if (a.stateTimer <= 0) {
                    a.state = 'walking';
                    a.targetAngle = a.mesh.rotation.y + (Math.random() - 0.5) * 2;
                    a.stateTimer = 2 + Math.random() * 4;
                }
                // Idle bobbing for chickens
                if (a.type === 'chicken') {
                    a.bobPhase += dt * 8;
                    a.mesh.position.y = a.position.y + Math.abs(Math.sin(a.bobPhase)) * 0.05;
                }
                break;
                
            case 'walking':
                if (distToHeli < a.fleeRadius) {
                    a.state = 'fleeing';
                    a.stateTimer = 3 + Math.random() * 2;
                    break;
                }
                
                // Walk toward target angle
                a.mesh.rotation.y = THREE.MathUtils.lerp(
                    a.mesh.rotation.y, a.targetAngle, dt * 2
                );
                
                const walkDir = new THREE.Vector3(
                    Math.sin(a.mesh.rotation.y), 0, Math.cos(a.mesh.rotation.y)
                );
                a.position.add(walkDir.multiplyScalar(a.walkSpeed * dt));
                
                // Stay near group center
                const toCenter = a.groupCenter.clone().sub(a.position);
                toCenter.y = 0;
                if (toCenter.length() > 30) {
                    a.targetAngle = Math.atan2(toCenter.x, toCenter.z);
                }
                
                if (a.stateTimer <= 0) {
                    a.state = 'idle';
                    a.stateTimer = 1 + Math.random() * 3;
                }
                
                // Walking bob
                a.bobPhase += dt * 6;
                a.mesh.position.y = a.position.y + Math.abs(Math.sin(a.bobPhase)) * 0.03;
                break;
                
            case 'fleeing':
                if (heliPos) {
                    // Run away from helicopter
                    const fleeDir = a.position.clone().sub(heliPos);
                    fleeDir.y = 0;
                    fleeDir.normalize();
                    
                    a.mesh.rotation.y = Math.atan2(fleeDir.x, fleeDir.z);
                    a.position.add(fleeDir.multiplyScalar(a.runSpeed * dt));
                    
                    // Fast bobbing when running
                    a.bobPhase += dt * 15;
                    a.mesh.position.y = a.position.y + Math.abs(Math.sin(a.bobPhase)) * 0.08;
                }
                
                if (a.stateTimer <= 0 || distToHeli > a.fleeRadius * 2) {
                    a.state = 'idle';
                    a.stateTimer = 2 + Math.random() * 3;
                }
                break;
        }
        
        // Update ground height
        const groundH = gameState.world ? gameState.world.getHeight(a.position.x, a.position.z) : 0;
        a.position.y = groundH;
        a.mesh.position.x = a.position.x;
        a.mesh.position.z = a.position.z;
        if (a.state !== 'walking' && a.state !== 'fleeing') {
            a.mesh.position.y = groundH;
        }
        
        // Keep in world bounds
        a.position.x = THREE.MathUtils.clamp(a.position.x, -900, 900);
        a.position.z = THREE.MathUtils.clamp(a.position.z, -900, 900);
    }
}
