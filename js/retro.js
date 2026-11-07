// ============================================
// RETRO.JS — Low-res rendering + palette dithering post-process
// Gives the 90s VGA look: chunky pixels, ordered dither, limited colours.
// ============================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// How many screen pixels make one "game pixel"
const PIXEL_SIZE = 3;
// Colour levels per channel (lower = more retro)
const COLOR_LEVELS = 7.0;

const RetroShader = {
    uniforms: {
        tDiffuse: { value: null },
        levels: { value: COLOR_LEVELS },
        time: { value: 0 },
        flash: { value: 0 },
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
        uniform float time;
        uniform float flash;
        varying vec2 vUv;

        // 4x4 Bayer matrix, computed arithmetically (GLSL ES 1.0 friendly)
        float bayer4(vec2 p) {
            vec2 q = mod(floor(p), 4.0);
            float x = q.x;
            float y = q.y;
            // classic 4x4 ordered dither table
            float v = 0.0;
            if (y < 0.5)      v = (x < 0.5) ? 0.0  : (x < 1.5) ? 8.0  : (x < 2.5) ? 2.0  : 10.0;
            else if (y < 1.5) v = (x < 0.5) ? 12.0 : (x < 1.5) ? 4.0  : (x < 2.5) ? 14.0 : 6.0;
            else if (y < 2.5) v = (x < 0.5) ? 3.0  : (x < 1.5) ? 11.0 : (x < 2.5) ? 1.0  : 9.0;
            else              v = (x < 0.5) ? 15.0 : (x < 1.5) ? 7.0  : (x < 2.5) ? 13.0 : 5.0;
            return v / 16.0 - 0.5;
        }

        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            vec3 col = c.rgb;

            // slight contrast / saturation boost for a punchy VGA palette
            float luma = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(luma), col, 1.15);
            col = (col - 0.5) * 1.08 + 0.5;

            // ordered dither then quantise
            float d = bayer4(gl_FragCoord.xy) / levels;
            col = floor((col + d) * levels + 0.5) / levels;

            // vignette
            vec2 uv = vUv - 0.5;
            float vig = 1.0 - dot(uv, uv) * 0.9;
            col *= vig;

            // damage flash (red tint)
            col = mix(col, vec3(1.0, 0.1, 0.05), flash * 0.45);

            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
    `,
};

export function initRetro(gameState) {
    const renderer = gameState.renderer;
    renderer.setPixelRatio(1);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(gameState.scene, gameState.camera));
    composer.addPass(new OutputPass());

    const retroPass = new ShaderPass(RetroShader);
    composer.addPass(retroPass);

    gameState.composer = composer;
    gameState.retroPass = retroPass;

    const resize = () => {
        const w = Math.max(160, Math.floor(window.innerWidth / PIXEL_SIZE));
        const h = Math.max(100, Math.floor(window.innerHeight / PIXEL_SIZE));
        renderer.setSize(w, h, false); // don't touch CSS size; canvas is stretched by CSS
        composer.setSize(w, h);
        gameState.camera.aspect = window.innerWidth / window.innerHeight;
        gameState.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    resize();
}

export function renderRetro(gameState) {
    if (!gameState.composer) return;
    gameState.retroPass.uniforms.time.value = gameState.time;
    // damage flash decays
    const u = gameState.retroPass.uniforms.flash;
    u.value = Math.max(0, u.value - gameState.delta * 2.5);
    gameState.composer.render();
}

export function triggerDamageFlash(gameState, amount = 1) {
    if (gameState.retroPass) {
        gameState.retroPass.uniforms.flash.value = Math.min(1, amount);
    }
}
