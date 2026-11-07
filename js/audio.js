// ============================================
// AUDIO.JS — Retro Sound Effects (Web Audio API)
// ============================================

let audioCtx = null;
let masterGain = null;
let rotorOsc = null;
let rotorGain = null;

export function initAudio(gameState) {
    // Create audio context on first user interaction
    const startAudio = () => {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioCtx.destination);
        
        // Start rotor hum
        startRotorSound();
        
        window.removeEventListener('keydown', startAudio);
        window.removeEventListener('click', startAudio);
    };
    
    window.addEventListener('keydown', startAudio);
    window.addEventListener('click', startAudio);
    
    gameState.audio = {
        playShot: () => playCannonShot(),
        playMissile: () => playMissileLaunch(),
        playExplosion: (size) => playExplosion(size),
        playHit: () => playHit(),
        playEnemyFire: (heavy) => playEnemyFire(heavy),
        playBeep: (freq, dur) => playBeep(freq, dur),
    };
}

function startRotorSound() {
    if (!audioCtx) return;
    
    // Rotor: low frequency oscillator modulated
    rotorOsc = audioCtx.createOscillator();
    rotorOsc.type = 'sawtooth';
    rotorOsc.frequency.value = 18;
    
    const rotorFilter = audioCtx.createBiquadFilter();
    rotorFilter.type = 'lowpass';
    rotorFilter.frequency.value = 100;
    
    rotorGain = audioCtx.createGain();
    rotorGain.gain.value = 0.15;
    
    // Modulate for "thump thump" effect
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 6;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(rotorOsc.frequency);
    lfo.start();
    
    rotorOsc.connect(rotorFilter);
    rotorFilter.connect(rotorGain);
    rotorGain.connect(masterGain);
    rotorOsc.start();
}

function playCannonShot() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    // Short burst of noise
    const bufferSize = audioCtx.sampleRate * 0.05;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + 0.1);
}

function playMissileLaunch() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    // Whoosh sound: descending noise with filter sweep
    const duration = 0.5;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);
    filter.Q.value = 5;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + duration);
}

function playExplosion(size = 1) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    const duration = 0.6 + size * 0.3;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        // Initial crack + rumble
        const crack = Math.exp(-t * 15) * (Math.random() * 2 - 1);
        const rumble = Math.exp(-t * 3) * Math.sin(t * 100) * (Math.random() * 0.5 + 0.5);
        data[i] = (crack * 0.7 + rumble * 0.5) * (1 + size * 0.5);
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(Math.min(0.5, 0.2 * size), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + duration + 0.1);
}

export function updateAudio(gameState) {
    if (!audioCtx || !rotorOsc) return;
    
    const h = gameState.helicopter;
    if (!h) return;
    
    // Modulate rotor pitch based on collective
    const basePitch = 16 + h.collective * 8;
    rotorOsc.frequency.setTargetAtTime(basePitch, audioCtx.currentTime, 0.1);
    
    // Modulate rotor volume based on engine state
    const targetVol = h.engineRunning ? 0.12 + h.collective * 0.08 : 0;
    rotorGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.1);
}

// ---- One-shot SFX ----
function playHit() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
}

function playEnemyFire(heavy) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = heavy ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(heavy ? 120 : 300, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 35 : 120, now + 0.12);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(heavy ? 0.12 : 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
}

function playBeep(freq = 880, dur = 0.08) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
}