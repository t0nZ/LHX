// ============================================
// RETRO.JS — Low-res VGA post-process & Intel-iGPU preset switcher
// --------------------------------------------
// Presets (cycle at runtime with key 'V', or initial ?q=lo|med|hi):
//   0: VGA 3x   (1/3 scale = 1/9 pixels, Bayer 4x4 dither) — fastest on Intel iGPU
//   1: RETRO 2x (1/2 scale, sharper retro dither)
//   2: CRISP 1x (native low-poly, direct WebGL render — skips EffectComposer)
//
// Optimisation: Linear->sRGB conversion is folded directly into RetroShader,
// removing the extra OutputPass fullscreen FBO pass on integrated GPUs.
// ============================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const PRESETS = [
    { name: 'VGA 3x',   pixelSize: 3, levels: 7.0,  dither: 1.0, direct: false },
    { name: 'RETRO 2x', pixelSize: 2, levels: 10.0, dither: 0.7, direct: false },
    { name: 'CRISP 1x', pixelSize: 1, levels: 32.0, dither: 0.0, direct: true  },
];

const RetroShader = {
    uniforms: {
        tDiffuse: { value: null },
        levels:   { value: 7.0 },
        dither:   { value: 1.0 },
        flash:    { value: 0.0 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float levels;
        uniform float dither;
        uniform float flash;
        varying vec2 vUv;

        // 4x4 Bayer ordered dither (GLSL ES 1.0 friendly)
        float bayer4(vec2 p) {
            vec2 q = mod(floor(p), 4.0);
            float x = q.x;
            float y = q.y;
            float v = 0.0;
            if (y < 0.5)      v = (x < 0.5) ? 0.0  : (x < 1.5) ? 8.0  : (x < 2.5) ? 2.0  : 10.0;
            else if (y < 1.5) v = (x < 0.5) ? 12.0 : (x < 1.5) ? 4.0  : (x < 2.5) ? 14.0 : 6.0;
            else if (y < 2.5) v = (x < 0.5) ? 3.0  : (x < 1.5) ? 11.0 : (x < 2.5) ? 1.0  : 9.0;
            else              v = (x < 0.5) ? 15.0 : (x < 1.5) ? 7.0  : (x < 2.5) ? 13.0 : 5.0;
            return v / 16.0 - 0.5;
        }

        void main() {
            vec3 col = texture2D(tDiffuse, vUv).rgb;
            // Linear -> sRGB (replaces separate OutputPass)
            col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

            // Punchy VGA saturation/contrast
            float luma = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(luma), col, 1.15);
            col = (col - 0.5) * 1.08 + 0.5;

            // Ordered dither + quantisation
            if (dither > 0.01) {
                float d = bayer4(gl_FragCoord.xy) * dither / levels;
                col = floor((col + d) * levels + 0.5) / levels;
            }

            // Subtle CRT vignette
            vec2 uv = vUv - 0.5;
            col *= 1.0 - dot(uv, uv) * 0.85;

            // Damage flash
            col = mix(col, vec3(1.0, 0.1, 0.05), flash * 0.45);
            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
    `,
};

let presetIndex = 0;
let resizeFn = null;

export function getVideoPresetName() {
    return PRESETS[presetIndex].name;
}

export function cycleVideoPreset(gameState) {
    presetIndex = (presetIndex + 1) % PRESETS.length;
    applyPreset(gameState);
    return PRESETS[presetIndex].name;
}

function applyPreset(gameState) {
    const p = PRESETS[presetIndex];
    if (gameState.retroPass) {
        gameState.retroPass.uniforms.levels.value = p.levels;
        gameState.retroPass.uniforms.dither.value = p.dither;
    }
    if (resizeFn) resizeFn();
}

export function initRetro(gameState) {
    const renderer = gameState.renderer;
    renderer.setPixelRatio(1);

    const q = new URLSearchParams(location.search).get('q');
    presetIndex = q === 'hi' ? 1 : 0; // default VGA 3x (fastest & most authentic)

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(gameState.scene, gameState.camera);
    const origRender = renderPass.render.bind(renderPass);
    renderPass.render = (r, wb, rb, dt, ma) => {
        origRender(r, wb, rb, dt, ma);
        gameState.sceneStats = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    };
    composer.addPass(renderPass);
    const retroPass = new ShaderPass(RetroShader);
    composer.addPass(retroPass);

    gameState.composer = composer;
    gameState.retroPass = retroPass;

    resizeFn = () => {
        const p = PRESETS[presetIndex];
        const scale = p.pixelSize;
        const w = Math.max(160, Math.floor(window.innerWidth / scale));
        const h = Math.max(100, Math.floor(window.innerHeight / scale));
        renderer.setSize(w, h, false); // canvas stretched via CSS
        composer.setSize(w, h);
        gameState.camera.aspect = window.innerWidth / window.innerHeight;
        gameState.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resizeFn);
    applyPreset(gameState);
}

export function renderRetro(gameState) {
    if (!gameState.renderer) return;
    const p = PRESETS[presetIndex];
    const u = gameState.retroPass ? gameState.retroPass.uniforms.flash : null;
    if (u) u.value = Math.max(0, u.value - gameState.delta * 2.5);

    if (p.direct || !gameState.composer) {
        // Direct render: zero post-processing FBO overhead
        const df = document.getElementById('damage-flash');
        if (df && u) df.style.opacity = (u.value * 0.45).toFixed(2);
        gameState.renderer.render(gameState.scene, gameState.camera);
        gameState.sceneStats = {
            calls: gameState.renderer.info.render.calls,
            triangles: gameState.renderer.info.render.triangles,
        };
    } else {
        const df = document.getElementById('damage-flash');
        if (df) df.style.opacity = '0';
        gameState.composer.render();
    }
}

export function triggerDamageFlash(gameState, amount = 1) {
    if (gameState.retroPass) {
        gameState.retroPass.uniforms.flash.value = Math.min(1, amount);
    }
}
