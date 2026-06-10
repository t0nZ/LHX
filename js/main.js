// ============================================
// MAIN.JS — Game Initialization & Loop
// ============================================
import * as THREE from 'three';

import { initInput, updateInput, wasKeyJustPressed, resetKeys } from './input.js';
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
import { initHUD, updateHUD } from './hud.js';
import { initAudio, updateAudio } from './audio.js';

// ---- GAME STATE ----
const gameState = {
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    state: 'MENU', // MENU, PLAYING, PAUSED
    time: 0,
    delta: 0,
    helicopter: null,
    buildings: [],
    trees: [],
    vehicles: [],
    animals: [],
    npcs: [],
    weapons: null,
    world: null,
    input: null,
};

// ---- DOM ELEMENTS ----
const titleScreen = document.getElementById('title-screen');
const hudElement = document.getElementById('hud');
const pauseScreen = document.getElementById('pause-screen');

// ---- INIT ----
function init() {
    // Three.js setup
    const canvas = document.getElementById('game-canvas');
    
    gameState.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
    });
    gameState.renderer.setSize(window.innerWidth, window.innerHeight);
    gameState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gameState.renderer.setClearColor(0x88aacc);
    
    gameState.scene = new THREE.Scene();
    gameState.clock = new THREE.Clock();
    
    // Init all modules
    initInput(gameState);
    initCamera(gameState);
    initSky(gameState);
    initTerrain(gameState);
    initBuildings(gameState);
    initTrees(gameState);
    initHelicopter(gameState);
    initWeapons(gameState);
    initEffects(gameState);
    initVehicles(gameState);
    initAnimals(gameState);
    initNPCs(gameState);
    initHUD(gameState);
    initAudio(gameState);
    
    // Title screen — wait for Enter
    window.addEventListener('keydown', handleGlobalKeys);
    
    // Start render loop
    animate();
}

function handleGlobalKeys(e) {
    if (gameState.state === 'MENU' && e.code === 'Enter') {
        startGame();
    }
    
    if (gameState.state === 'PLAYING') {
        if (e.code === 'KeyP' || e.code === 'Escape') {
            pauseGame();
        }
        if (e.code === 'KeyC') {
            cycleCamera(gameState);
        }
    } else if (gameState.state === 'PAUSED') {
        if (e.code === 'KeyP' || e.code === 'Escape') {
            resumeGame();
        }
    }
}

function startGame() {
    gameState.state = 'PLAYING';
    titleScreen.classList.add('hidden');
    hudElement.classList.remove('hidden');
    pauseScreen.classList.add('hidden');
    gameState.clock.start();
    document.body.style.cursor = 'none';
}

function pauseGame() {
    gameState.state = 'PAUSED';
    pauseScreen.classList.remove('hidden');
    resetKeys();
    document.body.style.cursor = 'default';
}

function resumeGame() {
    gameState.state = 'PLAYING';
    pauseScreen.classList.add('hidden');
    document.body.style.cursor = 'none';
}

// ---- GAME LOOP ----
function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(gameState.clock.getDelta(), 0.05); // Cap at 50ms
    gameState.delta = dt;
    gameState.time += dt;
    
    if (gameState.state === 'PLAYING') {
        // Update all systems
        updateInput(gameState);
        updateHelicopter(gameState);
        updateCamera(gameState);
        updateWeapons(gameState);
        updateEffects(gameState);
        updateBuildings(gameState);
        updateVehicles(gameState);
        updateAnimals(gameState);
        updateNPCs(gameState);
        updateHUD(gameState);
        updateAudio(gameState);
        updateSky(gameState);
    } else if (gameState.state === 'MENU') {
        // Slow camera orbit on title screen
        const menuTime = gameState.time * 0.3;
        if (gameState.camera) {
            gameState.camera.position.set(
                Math.sin(menuTime) * 300,
                80 + Math.sin(menuTime * 0.5) * 20,
                Math.cos(menuTime) * 300
            );
            gameState.camera.lookAt(0, 10, 0);
        }
    }
    
    // Render
    if (gameState.renderer && gameState.scene && gameState.camera) {
        gameState.renderer.render(gameState.scene, gameState.camera);
    }
}

// ---- START ----
init();
