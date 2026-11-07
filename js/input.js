// ============================================
// INPUT.JS — Keyboard & Mouse Input Manager
// ============================================
import * as THREE from 'three';

const keys = {};
let mouseX = 0, mouseY = 0;
let mouseButtons = 0;
let pointerLocked = false;

export function initInput(gameState) {
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        // Prevent default for game keys
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
             'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
             'Tab'].includes(e.code)) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (pointerLocked) {
            mouseX += e.movementX * 0.002;
            mouseY += e.movementY * 0.002;
        }
    });

    window.addEventListener('mousedown', (e) => {
        mouseButtons = e.buttons;
        e.preventDefault();
    });

    window.addEventListener('mouseup', (e) => {
        mouseButtons = e.buttons;
    });

    document.addEventListener('pointerlockchange', () => {
        pointerLocked = document.pointerLockElement === gameState.renderer.domElement;
    });

    // Store reference in game state
    gameState.input = {
        keys,
        mouseX: 0,
        mouseY: 0,
        mouseButtons: 0,
        isKeyDown: (code) => !!keys[code],
        isKeyPressed: (code) => !!keys[code], // Same for now
    };
}

export function updateInput(gameState) {
    gameState.input.keys = keys;
    gameState.input.mouseX = mouseX;
    gameState.input.mouseY = mouseY;
    gameState.input.mouseButtons = mouseButtons;
    
    // Dampen mouse accumulation
    mouseX *= 0.9;
    mouseY *= 0.9;
}

// Check if a key was just pressed this frame (rising edge)
const previousKeys = {};
export function wasKeyJustPressed(code) {
    const justPressed = keys[code] && !previousKeys[code];
    previousKeys[code] = keys[code];
    return justPressed;
}

export function resetKeys() {
    for (const k in keys) keys[k] = false;
}
