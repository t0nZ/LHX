// ============================================
// HUD.JS — Head-Up Display & Minimap
// ============================================
import * as THREE from 'three';

export function initHUD(gameState) {
    gameState.hudElements = {
        altitude: document.getElementById('val-altitude'),
        speed: document.getElementById('val-speed'),
        vspeed: document.getElementById('val-vspeed'),
        weaponName: document.getElementById('val-weapon-name'),
        ammo: document.getElementById('val-ammo'),
        health: document.getElementById('val-health'),
        healthBar: document.getElementById('bar-health'),
        altitudeBar: document.getElementById('bar-altitude'),
        compassStrip: document.getElementById('compass-strip'),
    };
    
    // Minimap canvas
    gameState.minimapCtx = document.getElementById('minimap-canvas')?.getContext('2d');
}

export function updateHUD(gameState) {
    const h = gameState.helicopter;
    const w = gameState.weapons;
    const els = gameState.hudElements;
    if (!h || !els.altitude) return;
    
    // Altitude
    els.altitude.textContent = Math.round(h.altitude);
    if (els.altitudeBar) {
        els.altitudeBar.style.width = Math.min(100, (h.altitude / 500) * 100) + '%';
    }
    
    // Speed (km/h)
    els.speed.textContent = Math.round(h.speed);
    
    // Vertical speed (m/s)
    const vs = h.velocity ? Math.round(h.velocity.y * 10) / 10 : 0;
    els.vspeed.textContent = (vs >= 0 ? '+' : '') + vs.toFixed(1);
    if (vs > 0) {
        els.vspeed.style.color = '#00ff41';
    } else if (vs < -3) {
        els.vspeed.style.color = '#ff4444';
    } else {
        els.vspeed.style.color = '#ffaa00';
    }
    
    // Weapon info
    if (w && w.types && w.types[w.selected]) {
        const weapon = w.types[w.selected];
        els.weaponName.textContent = weapon.name;
        els.ammo.textContent = weapon.ammo;
        
        // Flash ammo when low
        if (weapon.ammo <= weapon.maxAmmo * 0.2) {
            els.ammo.style.color = '#ff4444';
        } else {
            els.ammo.style.color = '#00ff41';
        }
    }
    
    // Health
    els.health.textContent = h.health;
    if (els.healthBar) {
        els.healthBar.style.width = h.health + '%';
        els.healthBar.className = 'health-bar';
        if (h.health < 30) els.healthBar.classList.add('critical');
        else if (h.health < 60) els.healthBar.classList.add('warning');
    }
    
    // Compass
    if (els.compassStrip && h.group) {
        const yaw = h.yaw !== undefined ? h.yaw : 0;
        const degrees = THREE.MathUtils.radToDeg(-yaw) % 360;
        // Move compass strip based on heading
        const compassWidth = 500; // approximate width of strip
        const offset = (degrees / 360) * compassWidth - 150;
        els.compassStrip.style.left = -offset + 'px';
    }
    
    // Altitude warning
    if (h.altitude < 10 && h.altitude > 0) {
        showWarning('ALTITUDE LOW');
    }
    
    // Update minimap
    updateMinimap(gameState);
}

let lastWarning = 0;
function showWarning(text) {
    const now = performance.now();
    if (now - lastWarning < 2000) return;
    lastWarning = now;
    
    const container = document.getElementById('hud-notifications');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'notification';
    div.style.color = '#ff4444';
    div.style.textShadow = '0 0 10px #ff4444';
    div.textContent = '⚠ ' + text;
    container.appendChild(div);
    setTimeout(() => div.remove(), 2000);
}

function updateMinimap(gameState) {
    const ctx = gameState.minimapCtx;
    if (!ctx) return;
    
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    const halfW = w / 2;
    const halfH = h / 2;
    const worldSize = 2000;
    const scale = w / worldSize;
    
    // Clear
    ctx.fillStyle = 'rgba(0, 10, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);
    
    const heli = gameState.helicopter;
    if (!heli) return;
    
    // Draw terrain features
    // Centro storico outline
    ctx.strokeStyle = '#00ff4140';
    ctx.lineWidth = 1;
    ctx.strokeRect(
        halfW - 200 * scale, halfH - 150 * scale,
        400 * scale, 300 * scale
    );
    
    // Via Emilia
    ctx.strokeStyle = '#00ff4160';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, halfH - 20 * scale);
    ctx.lineTo(w, halfH - 20 * scale);
    ctx.stroke();
    
    // Via Calandrini
    ctx.beginPath();
    ctx.moveTo(halfW + 10 * scale, 0);
    ctx.lineTo(halfW + 10 * scale, h);
    ctx.stroke();
    
    // Draw buildings
    ctx.fillStyle = '#00ff4130';
    if (gameState.buildings) {
        for (const b of gameState.buildings) {
            if (b.destroyed) continue;
            const bx = halfW + b.position.x * scale;
            const by = halfH + b.position.z * scale;
            ctx.fillRect(bx - 1, by - 1, 2, 2);
        }
    }
    
    // Draw vehicles
    ctx.fillStyle = '#ffaa00';
    if (gameState.vehicles) {
        for (const v of gameState.vehicles) {
            const vx = halfW + v.position.x * scale;
            const vy = halfH + v.position.z * scale;
            ctx.fillRect(vx - 1, vy - 1, 2, 2);
        }
    }
    
    // Draw animals as tiny dots
    ctx.fillStyle = '#44ff4480';
    if (gameState.animals) {
        for (const a of gameState.animals) {
            const ax = halfW + a.position.x * scale;
            const ay = halfH + a.position.z * scale;
            ctx.fillRect(ax, ay, 1, 1);
        }
    }
    
    // Draw helicopter (player)
    const hx = halfW + heli.position.x * scale;
    const hy = halfH + heli.position.z * scale;
    
    // Helicopter direction indicator
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(heli.yaw || 0);
    
    ctx.fillStyle = '#00ff41';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-3, 3);
    ctx.lineTo(3, 3);
    ctx.closePath();
    ctx.fill();
    
    // Range circle
    ctx.strokeStyle = '#00ff4130';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
    
    // Border
    ctx.strokeStyle = '#00ff4160';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
    
    // "N" indicator
    ctx.fillStyle = '#00ff41';
    ctx.font = '10px VT323';
    ctx.textAlign = 'center';
    ctx.fillText('N', halfW, 12);
}
