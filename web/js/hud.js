// ============================================
// HUD.JS — Head-Up Display, target brackets & radar
// ============================================
import * as THREE from 'three';
import { getVideoPresetName } from './retro.js';

const _p = new THREE.Vector3();
let perfVisible = false;
let fpsFrames = 0, fpsAccum = 0, fpsValue = 0;

export function togglePerfOverlay() {
    perfVisible = !perfVisible;
    const el = document.getElementById('hud-perf');
    if (el) el.classList.toggle('hidden', !perfVisible);
    return perfVisible;
}

export function notify(text, color = '#ffaa00', ms = 3000) {
    const container = document.getElementById('hud-notifications');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'notification';
    div.style.color = color;
    div.style.textShadow = `0 0 10px ${color}`;
    div.textContent = text;
    container.appendChild(div);
    while (container.children.length > 4) container.firstChild.remove();
    setTimeout(() => div.remove(), ms);
}

export function initHUD(gameState) {
    const $ = (id) => document.getElementById(id);
    gameState.hudElements = {
        altitude: $('val-altitude'),
        msl: $('val-msl'),
        speed: $('val-speed'),
        vspeed: $('val-vspeed'),
        weaponName: $('val-weapon-name'),
        ammo: $('val-ammo'),
        health: $('val-health'),
        healthBar: $('bar-health'),
        altitudeBar: $('bar-altitude'),
        heading: $('compass-heading'),
        place: $('compass-place'),
        perf: $('hud-perf'),
        lockBox: $('hud-lock'),
        lockText: $('hud-lock-text'),
        arrow: $('hud-arrow'),
        arrowIcon: $('hud-arrow-icon'),
        arrowText: $('hud-arrow-text'),
        pad: $('hud-pad'),
        missileCount: $('val-missiles'),
    };
    gameState.minimapCtx = $('minimap-canvas')?.getContext('2d');
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function updateHUD(gameState) {
    const h = gameState.helicopter;
    const w = gameState.weapons;
    const els = gameState.hudElements;
    if (!h || !els.altitude) return;

    // Altitude (AGL + true MSL above sea level)
    els.altitude.textContent = Math.round(h.altitude);
    if (els.msl && gameState.world) {
        const msl = Math.round(h.position.y + (gameState.world.elevationBase || 0));
        els.msl.textContent = `${msl}m MSL`;
    }
    if (els.altitudeBar) els.altitudeBar.style.width = Math.min(100, (h.altitude / 450) * 100) + '%';

    // Speed (km/h)
    els.speed.textContent = Math.round(h.speed);

    // Vertical speed
    const vs = h.velocity ? Math.round(h.velocity.y * 10) / 10 : 0;
    els.vspeed.textContent = (vs >= 0 ? '+' : '') + vs.toFixed(1);
    els.vspeed.style.color = vs < -6 ? '#ff4444' : (vs > 0.5 ? '#00ff41' : '#ffaa00');

    // Weapon info
    if (w && w.types && w.types[w.selected]) {
        const weapon = w.types[w.selected];
        els.weaponName.textContent = weapon.name;
        els.ammo.textContent = weapon.ammo;
        els.ammo.style.color = weapon.ammo <= weapon.maxAmmo * 0.2 ? '#ff4444' : '#00ff41';
        if (els.missileCount) els.missileCount.textContent = `HF ${w.types[1].ammo}  GUN ${w.types[0].ammo}`;
    }

    // Health
    els.health.textContent = Math.round(h.health);
    if (els.healthBar) {
        els.healthBar.style.width = h.health + '%';
        els.healthBar.className = 'health-bar';
        if (h.health < 30) els.healthBar.classList.add('critical');
        else if (h.health < 60) els.healthBar.classList.add('warning');
    }

    // Heading (0 = north = -Z, clockwise) + nearest real locality
    if (els.heading) {
        let deg = (180 - THREE.MathUtils.radToDeg(h.yaw)) % 360;
        if (deg < 0) deg += 360;
        const card = CARDINALS[Math.round(deg / 45) % 8];
        els.heading.textContent = `${String(Math.round(deg)).padStart(3, '0')}° ${card}`;
    }
    if (els.place && gameState.world && gameState.world.places && gameState.world.places.length) {
        let best = null, bestD = Infinity;
        for (const p of gameState.world.places) {
            const d = Math.hypot(p.x - h.position.x, p.z - h.position.z);
            if (d < bestD) { bestD = d; best = p; }
        }
        if (best) {
            const distStr = bestD < 250 ? '' : ` ${(bestD / 1000).toFixed(1)}km`;
            els.place.textContent = `${best.n.toUpperCase()}${distStr}`;
        }
    }

    // Perf telemetry (toggled with 'I')
    fpsFrames++;
    fpsAccum += gameState.delta;
    if (fpsAccum >= 0.4) {
        fpsValue = Math.round(fpsFrames / fpsAccum);
        fpsFrames = 0; fpsAccum = 0;
        if (perfVisible && els.perf && gameState.renderer) {
            const info = gameState.sceneStats || gameState.renderer.info.render;
            const tris = (info.triangles / 1000).toFixed(1);
            els.perf.textContent = `${fpsValue} FPS | ${info.calls} DC | ${tris}k TRI | ${getVideoPresetName()}`;
        }
    }

    updateLock(gameState, els);
    updateArrow(gameState, els);

    // Warnings
    if (h.altitude < 8 && !h.onGround && h.speed > 40) warn('ALTITUDE LOW');
    if (h.health < 30 && h.alive) warn('HULL CRITICAL', 2500);

    // Helipad hint
    if (els.pad) {
        const pad = gameState.helipad;
        const near = pad && Math.hypot(h.position.x - pad.x, h.position.z - pad.z) < pad.r + 10 && h.altitude < 40;
        els.pad.classList.toggle('hidden', !near);
        if (near) {
            els.pad.textContent = (h.onGround && h.speed < 12) ? 'REARMING / REPAIRING...' : 'LAND ON PAD TO REARM';
        }
    }

    updateMinimap(gameState);
}

function updateLock(gameState, els) {
    const w = gameState.weapons;
    const cam = gameState.camera;
    const h = gameState.helicopter;
    if (!els.lockBox) return;
    const t = w && w.lockTarget;
    if (!t || !t.alive) {
        els.lockBox.classList.add('hidden');
        return;
    }
    _p.set(t.position.x, t.position.y + t.def.centerY, t.position.z);
    const dist = Math.round(_p.distanceTo(h.position));
    _p.project(cam);
    if (_p.z > 1 || Math.abs(_p.x) > 1.2 || Math.abs(_p.y) > 1.2) {
        els.lockBox.classList.add('hidden');
        return;
    }
    els.lockBox.classList.remove('hidden');
    els.lockBox.style.left = ((_p.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    els.lockBox.style.top = ((-_p.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    const pct = Math.max(0, Math.round(t.hp / t.maxHp * 100));
    els.lockText.textContent = `${t.def.name} ${dist}m [${pct}%]`;
    gameState._lockTone = (gameState._lockTone || 0) + gameState.delta;
    if (gameState._lockTone > 0.5 && gameState.audio) {
        gameState._lockTone = 0;
        gameState.audio.playBeep(1200, 0.05);
    }
}

function updateArrow(gameState, els) {
    const h = gameState.helicopter;
    if (!els.arrow) return;
    let best = null, bestD = Infinity;
    for (const e of gameState.enemies || []) {
        if (!e.alive) continue;
        const d = Math.hypot(e.position.x - h.position.x, e.position.z - h.position.z);
        if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) { els.arrow.classList.add('hidden'); return; }
    els.arrow.classList.remove('hidden');
    const bearing = Math.atan2(best.position.x - h.position.x, best.position.z - h.position.z);
    const rel = bearing - h.yaw; // positive = target is to the left
    els.arrowIcon.style.transform = `rotate(${-rel}rad)`;
    els.arrowText.textContent = `${best.def.name} ${Math.round(bestD)}m`;
}

let lastWarning = 0;
function warn(text, interval = 2000) {
    const now = performance.now();
    if (now - lastWarning < interval) return;
    lastWarning = now;
    notify('⚠ ' + text, '#ff4444', 2000);
}

// ---- RADAR / MINIMAP (centred on the helicopter, north up) ----
const RADAR_RANGE = 700; // metres from centre to edge

function updateMinimap(gameState) {
    const ctx = gameState.minimapCtx;
    if (!ctx) return;
    const heli = gameState.helicopter;
    if (!heli) return;

    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    const halfW = cw / 2, halfH = ch / 2;
    const scale = halfW / RADAR_RANGE;
    const hx = heli.position.x, hz = heli.position.z;
    const mx = (x) => halfW + (x - hx) * scale;
    const my = (z) => halfH + (z - hz) * scale;

    ctx.fillStyle = 'rgba(0, 12, 0, 0.9)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.clip();

    // Real map (land cover painted from OSM by terrain.js), dimmed for the radar look
    const W = gameState.world;
    if (W && W.colorMap) {
        const k = W.colorMap.width / W.size, half = W.size / 2;
        ctx.globalAlpha = 0.55;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(W.colorMap, (hx - RADAR_RANGE + half) * k, (hz - RADAR_RANGE + half) * k,
            RADAR_RANGE * 2 * k, RADAR_RANGE * 2 * k, 0, 0, cw, ch);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(0, 40, 0, 0.35)";
        ctx.fillRect(0, 0, cw, ch);
    }


    // Helipad
    if (gameState.helipad) {
        ctx.fillStyle = '#ffd800';
        ctx.font = '12px VT323';
        ctx.textAlign = 'center';
        ctx.fillText('H', mx(gameState.helipad.x), my(gameState.helipad.z) + 4);
    }

    // Vehicles
    ctx.fillStyle = '#ffaa00';
    for (const v of gameState.vehicles || []) {
        ctx.fillRect(mx(v.position.x) - 1, my(v.position.z) - 1, 2, 2);
    }

    // Enemies
    const blink = Math.floor(gameState.time * 4) % 2 === 0;
    for (const e of gameState.enemies || []) {
        if (!e.alive) continue;
        const ex = mx(e.position.x), ey = my(e.position.z);
        ctx.fillStyle = e.type === 'heli' ? '#ff66ff' : '#ff3333';
        const s = e.type === 'aa' ? 5 : 4;
        if (e.type === 'heli') {
            ctx.beginPath();
            ctx.moveTo(ex, ey - s); ctx.lineTo(ex + s, ey); ctx.lineTo(ex, ey + s); ctx.lineTo(ex - s, ey);
            ctx.closePath(); ctx.fill();
        } else {
            ctx.fillRect(ex - s / 2, ey - s / 2, s, s);
        }
        if (gameState.weapons && gameState.weapons.lockTarget === e && blink) {
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(ex - 6, ey - 6, 12, 12);
        }
    }
    ctx.restore();

    // Player
    ctx.save();
    ctx.translate(halfW, halfH);
    ctx.rotate(Math.PI - (heli.yaw || 0));
    ctx.fillStyle = '#00ff41';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 4);
    ctx.lineTo(0, 2);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Range ring + border
    ctx.strokeStyle = '#00ff4130';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(halfW, halfH, halfW * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#00ff4180';
    ctx.strokeRect(0.5, 0.5, cw - 1, ch - 1);
    ctx.fillStyle = '#00ff41';
    ctx.font = '14px VT323';
    ctx.textAlign = 'center';
    ctx.fillText('N', halfW, 12);
}
