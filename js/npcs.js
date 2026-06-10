// ============================================
// NPCS.JS — Farmers / Contadini
// ============================================
import * as THREE from 'three';

const NPC_COUNT = 20;

export function initNPCs(gameState) {
    gameState.npcs = [];
    
    let seed = 555;
    function rand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return seed / 2147483647;
    }
    
    for (let i = 0; i < NPC_COUNT; i++) {
        // Place in countryside fields or near farmhouses
        let x, z;
        let attempts = 0;
        do {
            x = (rand() - 0.5) * 1400;
            z = (rand() - 0.5) * 1400;
            attempts++;
        } while (attempts < 30 && (
            (Math.abs(x) < 220 && Math.abs(z) < 160) || // Skip dense town
            (gameState.world && gameState.world.isWater(x, z))
        ));
        
        const y = gameState.world ? gameState.world.getHeight(x, z) : 0;
        
        const mesh = createFarmerMesh(rand);
        mesh.position.set(x, y, z);
        mesh.rotation.y = rand() * Math.PI * 2;
        gameState.scene.add(mesh);
        
        gameState.npcs.push({
            mesh,
            position: new THREE.Vector3(x, y, z),
            homePosition: new THREE.Vector3(x, y, z),
            velocity: new THREE.Vector3(0, 0, 0),
            state: 'idle',
            stateTimer: rand() * 5,
            targetAngle: rand() * Math.PI * 2,
            walkSpeed: 1.2,
            runSpeed: 4,
            fleeRadius: 50,
            bobPhase: rand() * Math.PI * 2,
            armSwing: 0,
        });
    }
}

function createFarmerMesh(rand) {
    const group = new THREE.Group();
    
    // Shirt colors (typical farmer)
    const shirtColors = [0x4466aa, 0x558844, 0x886644, 0xcc8844, 0x665544, 0xaa4444];
    const shirtColor = shirtColors[Math.floor(rand() * shirtColors.length)];
    const pantColor = 0x334455;
    const skinColor = 0xddbb88;
    const hatColor = rand() > 0.5 ? 0x887755 : 0x444444;
    
    // Torso
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.5, 0.25),
        new THREE.MeshLambertMaterial({ color: shirtColor, flatShading: true })
    );
    torso.position.y = 1.1;
    group.add(torso);
    
    // Head
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.25, 0.22),
        new THREE.MeshLambertMaterial({ color: skinColor, flatShading: true })
    );
    head.position.y = 1.55;
    group.add(head);
    
    // Hat
    if (rand() > 0.3) {
        const hatBrim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 0.03, 6),
            new THREE.MeshLambertMaterial({ color: hatColor, flatShading: true })
        );
        hatBrim.position.y = 1.68;
        group.add(hatBrim);
        
        const hatTop = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.13, 0.12, 5),
            new THREE.MeshLambertMaterial({ color: hatColor, flatShading: true })
        );
        hatTop.position.y = 1.75;
        group.add(hatTop);
    }
    
    // Arms
    for (const side of [-0.28, 0.28]) {
        const arm = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.4, 0.1),
            new THREE.MeshLambertMaterial({ color: shirtColor, flatShading: true })
        );
        arm.position.set(side, 1.0, 0);
        arm.name = side < 0 ? 'leftArm' : 'rightArm';
        group.add(arm);
        
        // Hand
        const hand = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.08, 0.08),
            new THREE.MeshLambertMaterial({ color: skinColor, flatShading: true })
        );
        hand.position.set(side, 0.78, 0);
        group.add(hand);
    }
    
    // Legs
    for (const side of [-0.1, 0.1]) {
        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.5, 0.12),
            new THREE.MeshLambertMaterial({ color: pantColor, flatShading: true })
        );
        leg.position.set(side, 0.55, 0);
        leg.name = side < 0 ? 'leftLeg' : 'rightLeg';
        group.add(leg);
        
        // Boot
        const boot = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.1, 0.18),
            new THREE.MeshLambertMaterial({ color: 0x443322, flatShading: true })
        );
        boot.position.set(side, 0.3, 0.03);
        group.add(boot);
    }
    
    group.scale.setScalar(1.2);
    return group;
}

export function updateNPCs(gameState) {
    const dt = gameState.delta;
    const heliPos = gameState.helicopter ? gameState.helicopter.position : null;
    
    for (const npc of gameState.npcs) {
        npc.stateTimer -= dt;
        
        let distToHeli = Infinity;
        if (heliPos) {
            distToHeli = npc.position.distanceTo(heliPos);
        }
        
        switch (npc.state) {
            case 'idle':
                if (distToHeli < npc.fleeRadius) {
                    npc.state = 'fleeing';
                    npc.stateTimer = 4;
                    break;
                }
                if (npc.stateTimer <= 0) {
                    npc.state = 'walking';
                    npc.targetAngle = npc.mesh.rotation.y + (Math.random() - 0.5) * 2;
                    npc.stateTimer = 3 + Math.random() * 5;
                }
                break;
                
            case 'walking':
                if (distToHeli < npc.fleeRadius) {
                    npc.state = 'fleeing';
                    npc.stateTimer = 4;
                    break;
                }
                
                npc.mesh.rotation.y = THREE.MathUtils.lerp(
                    npc.mesh.rotation.y, npc.targetAngle, dt * 3
                );
                
                const walkDir = new THREE.Vector3(
                    Math.sin(npc.mesh.rotation.y), 0, Math.cos(npc.mesh.rotation.y)
                );
                npc.position.add(walkDir.multiplyScalar(npc.walkSpeed * dt));
                
                // Stay near home
                const toHome = npc.homePosition.clone().sub(npc.position);
                toHome.y = 0;
                if (toHome.length() > 40) {
                    npc.targetAngle = Math.atan2(toHome.x, toHome.z);
                }
                
                // Arm and leg swing
                npc.armSwing += dt * 4;
                animateWalking(npc, npc.armSwing, 0.3);
                
                if (npc.stateTimer <= 0) {
                    npc.state = 'idle';
                    npc.stateTimer = 1 + Math.random() * 4;
                    resetPose(npc);
                }
                break;
                
            case 'fleeing':
                if (heliPos) {
                    const fleeDir = npc.position.clone().sub(heliPos);
                    fleeDir.y = 0;
                    fleeDir.normalize();
                    
                    npc.mesh.rotation.y = Math.atan2(fleeDir.x, fleeDir.z);
                    npc.position.add(fleeDir.multiplyScalar(npc.runSpeed * dt));
                    
                    // Faster arm swing when running
                    npc.armSwing += dt * 10;
                    animateWalking(npc, npc.armSwing, 0.6);
                }
                
                if (npc.stateTimer <= 0 || distToHeli > npc.fleeRadius * 2.5) {
                    npc.state = 'idle';
                    npc.stateTimer = 2 + Math.random() * 3;
                    resetPose(npc);
                }
                break;
        }
        
        // Ground height
        const groundH = gameState.world ? gameState.world.getHeight(npc.position.x, npc.position.z) : 0;
        npc.position.y = groundH;
        npc.mesh.position.copy(npc.position);
        
        // World bounds
        npc.position.x = THREE.MathUtils.clamp(npc.position.x, -900, 900);
        npc.position.z = THREE.MathUtils.clamp(npc.position.z, -900, 900);
    }
}

function animateWalking(npc, phase, amplitude) {
    const mesh = npc.mesh;
    mesh.children.forEach(child => {
        if (child.name === 'leftArm') {
            child.rotation.x = Math.sin(phase) * amplitude;
        } else if (child.name === 'rightArm') {
            child.rotation.x = -Math.sin(phase) * amplitude;
        } else if (child.name === 'leftLeg') {
            child.rotation.x = -Math.sin(phase) * amplitude * 0.5;
        } else if (child.name === 'rightLeg') {
            child.rotation.x = Math.sin(phase) * amplitude * 0.5;
        }
    });
}

function resetPose(npc) {
    npc.mesh.children.forEach(child => {
        if (['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].includes(child.name)) {
            child.rotation.x = 0;
        }
    });
}
