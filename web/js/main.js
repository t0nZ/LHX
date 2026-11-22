// ============================================
// MAIN.JS — Game Initialization & Loop
// ============================================
import * as THREE from 'three';

import { initInput, updateInput, resetKeys } from './input.js';
import { initSky, updateSky } from './sky.js';
import { initTerrain } from './terrain.js';
import { initTrees } from './trees.js';
import { initBuildings, updateBuildings } from './buildings.js';
import { initHelicopter, updateHelicopter } from './helicopter.js';
import { initCamera, updateCamera, cycleCamera } from './camera.js';
import { initWeapons, updateWeapons } from './weapons.js';
import { initEffects, updateEffects } from './effects.js';
import { initVehicles, updateVehicles } from './vehicles.js';
import { initAnimals, updateAnimals } from './animals.js';
import { initNPCs, updateNPCs } from './npcs.js';
import { initHUD, updateHUD, notify, togglePerfOverlay } from './hud.js';
import { initAudio, updateAudio } from './audio.js';
import { initEnemies, updateEnemies } from './enemies.js';
import { initMissions, updateMissions, beginCampaign, beginFreeFlight, handleEnter } from './missions.js';
import { initRetro, renderRetro, cycleVideoPreset } from './retro.js';

// ---- GAME STATE ----
const gameState = {
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    state: 'MENU', // MENU, BRIEFING, PLAYING, PAUSED, DEBRIEF
    time: 0,
    delta: 0,
    helicopter: null,
    buildings: [],
    trees: [],
    vehicles: [],
    animals: [],
    npcs: [],
    enemies: [],
    weapons: null,
    world: null,
    input: null,
};

// ---- DOM ELEMENTS ----
const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');

// ---- INIT ----
async function init() {
    const canvas = document.getElementById('game-canvas');

    gameState.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,   // chunky retro pixels
        alpha: false,
        powerPreference: 'high-performance',
    });
    gameState.renderer.setClearColor(0xb3c8d9);

    gameState.scene = new THREE.Scene();
    gameState.clock = new THREE.Clock();

    // Init all modules (order matters: terrain before buildings/trees)
    initInput(gameState);
    initCamera(gameState);
    initSky(gameState);
    const prompt = document.querySelector('#title-screen .blink');
    const setMsg = (m) => { if (prompt) prompt.textContent = m + '...'; };
    await initTerrain(gameState, setMsg);
    setMsg('BUILDING CASTEL BOLOGNESE');
    initBuildings(gameState);
    initTrees(gameState);
    initHelicopter(gameState);
    initWeapons(gameState);
    initEffects(gameState);
    initVehicles(gameState);
    initAnimals(gameState);
    initNPCs(gameState);
    initEnemies(gameState);
    initHUD(gameState);
    initAudio(gameState);
    initMissions(gameState);
    initRetro(gameState);

    if (prompt) prompt.textContent = 'INVIO: CAMPAGNA   |   F: VOLO LIBERO';
    gameState.ready = true;

    const hi = document.getElementById('title-hiscore');
    if (hi) hi.textContent = `HI-SCORE ${String(gameState.hiScore).padStart(6, '0')}`;

    window.addEventListener('keydown', handleGlobalKeys);
    window.addEventListener('blur', () => {
        if (gameState.state === 'PLAYING') pauseGame();
    });

    gameState.clock.start();
    window.__game = gameState; // debug handle
    animate();
}

function handleGlobalKeys(e) {
    if (!gameState.ready) return;

    if (e.code === 'Enter') {
        if (gameState.state === 'MENU') {
            titleScreen.classList.add('hidden');
            beginCampaign(gameState);
        } else if (gameState.state === 'BRIEFING' || gameState.state === 'DEBRIEF') {
            handleEnter(gameState);
        }
        return;
    }

    if (gameState.state === 'MENU' && e.code === 'KeyF') {
        titleScreen.classList.add('hidden');
        beginFreeFlight(gameState);
        return;
    }

    if (gameState.state === 'PLAYING') {
        if (e.code === 'KeyP' || e.code === 'Escape') pauseGame();
        if (e.code === 'KeyC') cycleCamera(gameState);
        if (e.code === 'KeyV') notify(`VIDEO: ${cycleVideoPreset(gameState)}`, '#00ff41', 2000);
        if (e.code === 'KeyI') togglePerfOverlay();
    } else if (gameState.state === 'PAUSED') {
        if (e.code === 'KeyP' || e.code === 'Escape') resumeGame();
    }
}

function pauseGame() {
    gameState.state = 'PAUSED';
    pauseScreen.classList.remove('hidden');
    resetKeys();
}

function resumeGame() {
    gameState.state = 'PLAYING';
    pauseScreen.classList.add('hidden');
}

// ---- Camera orbit for menu / briefing screens ----
function orbitCamera(target, radius, height, speed) {
    const t = gameState.time * speed;
    gameState.camera.position.set(
        target.x + Math.sin(t) * radius,
        target.y + height,
        target.z + Math.cos(t) * radius
    );
    gameState.camera.lookAt(target.x, target.y + 4, target.z);
}

// ---- GAME LOOP ----
function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(gameState.clock.getDelta(), 0.05); // Cap at 50ms
    gameState.delta = dt;
    gameState.time += dt;

    const st = gameState.state;
    const playing = st === 'PLAYING';
    const ambient = st !== 'PAUSED';

    if (playing) {
        updateInput(gameState);
        updateHelicopter(gameState);
        updateWeapons(gameState);
        updateEnemies(gameState);
        updateMissions(gameState);
        updateCamera(gameState);
    }
    if (ambient) {
        updateEffects(gameState);
        updateBuildings(gameState);
        updateVehicles(gameState);
        updateAnimals(gameState);
        updateNPCs(gameState);
        updateSky(gameState);
    }
    if (playing) {
        updateHUD(gameState);
        updateAudio(gameState);
    } else if (st === 'MENU') {
        orbitCamera(new THREE.Vector3(0, 10, 0), 320, 90, 0.15);
    } else if (st === 'BRIEFING' || st === 'DEBRIEF') {
        const h = gameState.helicopter;
        if (h) {
            h.rotorGroup.rotation.y += 10 * dt;
            h.tailRotorGroup.rotation.y += 15 * dt;
            orbitCamera(h.position, 38, 12, 0.25);
        }
    }

    renderRetro(gameState);
}

// ---- START ----
init().catch((err) => {
    console.error(err);
    const p = document.querySelector('#title-screen .blink');
    if (p) p.textContent = 'LOAD ERROR: ' + err.message;
});
