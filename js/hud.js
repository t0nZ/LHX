// ============================================
// HUD.JS — Head-Up Display, target brackets & radar
// ============================================
import * as THREE from 'three';

const _p = new THREE.Vector3();

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
        speed: $('val-speed'),
        vspeed: $('val-vspeed'),
        weaponName: $('val-weapon-name'),
        ammo: $('val-ammo'),
        health: $('val-health'),
        healthBar: $('bar-health'),
        altitudeBar: $('bar-altitude'),
        heading: $('compass-heading'),
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

    // Altitude
    els.altitude.textContent = Math.round(h.altitude);
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

    // Heading (0 = north = -Z, clockwise)
    if (els.heading) {
        let deg = (180 - THREE.MathUtils.radToDeg(h.yaw)) % 360;
        if (deg < 0) deg += 360;
        const card = CARDINALS[Math.round(deg / 45) % 8];
        els.heading.textContent = `${String(Math.round(deg)).padStart(3, '0')}° ${card}`;
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

    // River Senio
    ctx.strokeStyle = '#2a6aff90';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let z = -950; z <= 950; z += 50) {
        const x = 350 + Math.sin(z * 0.008) * 40;
        if (z === -950) ctx.moveTo(mx(x), my(z)); else ctx.lineTo(mx(x), my(z));
    }
    ctx.stroke();

    // Town walls
    ctx.strokeStyle = '#00ff4155';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx(-200), my(-150), 400 * scale, 300 * scale);

    // Roads
    ctx.strokeStyle = '#00ff4170';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, my(-20)); ctx.lineTo(cw, my(-20));
    ctx.moveTo(mx(10), 0); ctx.lineTo(mx(10), ch);
    ctx.stroke();

    // Buildings
    ctx.fillStyle = '#00ff4150';
    for (const b of gameState.buildings || []) {
        if (b.destroyed) continue;
        const bx = mx(b.position.x), by = my(b.position.z);
        if (bx < -4 || bx > cw + 4 || by < -4 || by > ch + 4) continue;
        ctx.fillRect(bx - 1, by - 1, 2, 2);
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
