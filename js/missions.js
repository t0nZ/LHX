// ============================================
// MISSIONS.JS — Campaign, score, lives, base resupply
// ============================================
import * as THREE from 'three';
import { spawnEnemy, clearEnemies, countAlive } from './enemies.js';
import { checkBuildingCollision } from './buildings.js';
import { repairPlayer } from './helicopter.js';
import { rearm } from './weapons.js';
import { notify } from './hud.js';

const MISSIONS = [
    {
        title: 'PRESIDIO SULLA VIA EMILIA',
        brief: [
            'Truppe ostili hanno bloccato la Via Emilia a est',
            'di Castel Bolognese, oltre il fiume Senio.',
            '',
            'OBIETTIVO: distruggi i carri armati e le postazioni',
            'contraeree. Segui la freccia sul display.',
            '',
            'ATTENZIONE: ogni edificio distrutto costa punti.',
            'Il centro storico non e\' un bersaglio!',
        ],
        groups: [
            { type: 'tank', cx: 520, cz: -20, r: 70, n: 4 },
            { type: 'aa', cx: 500, cz: -20, r: 90, n: 2 },
        ],
        reinforcements: [],
    },
    {
        title: 'BATTAGLIA DEL SENIO',
        brief: [
            'Il nemico avanza lungo il Senio verso nord-est.',
            'Una colonna corazzata con difesa contraerea sta',
            'attraversando i campi.',
            '',
            'OBIETTIVO: neutralizza la colonna. Elicotteri',
            'd\'attacco nemici sono in zona: usa gli Hellfire.',
            '',
            'Torna sull\'eliporto per ripararti e fare rifornimento.',
        ],
        groups: [
            { type: 'tank', cx: 330, cz: 330, r: 120, n: 5 },
            { type: 'aa', cx: 250, cz: 330, r: 120, n: 3 },
            { type: 'heli', cx: 700, cz: 300, r: 30, n: 1, altitude: 80 },
        ],
        reinforcements: [
            { time: 30, type: 'heli', x: 800, z: -200, msg: 'ELICOTTERO NEMICO IN ARRIVO!' },
        ],
    },
    {
        title: 'OPERAZIONE APPENNINO',
        brief: [
            'Il comando nemico si e\' ritirato sulle colline',
            'a sud, protetto da batterie contraeree e',
            'pattuglie di elicotteri.',
            '',
            'OBIETTIVO: elimina ogni presenza ostile.',
            'Vola basso tra le colline per evitare i radar.',
            '',
            'Questa e\' l\'ultima missione. Buona fortuna, pilota.',
        ],
        groups: [
            { type: 'tank', cx: -150, cz: 640, r: 150, n: 5 },
            { type: 'aa', cx: 0, cz: 700, r: 200, n: 4 },
            { type: 'heli', cx: 200, cz: 520, r: 40, n: 1, altitude: 90, aggression: 1.2 },
            { type: 'heli', cx: -300, cz: 600, r: 40, n: 1, altitude: 90, aggression: 1.2 },
        ],
        reinforcements: [
            { time: 35, type: 'heli', x: 500, z: 800, msg: 'RINFORZI NEMICI IN ARRIVO!' },
            { time: 70, type: 'heli', x: -600, z: 800, msg: 'ALTRI ELICOTTERI IN ARRIVO!' },
        ],
    },
];

const STARTING_LIVES = 3;
const $ = (id) => document.getElementById(id);

let overlayAction = null;
let deathTimer = 0;
let completeTimer = 0;
let rearmTimer = 0;
let wasRearming = false;

export function initMissions(gameState) {
    gameState.score = 0;
    gameState.lives = STARTING_LIVES;
    gameState.missionIndex = 0;
    gameState.mission = null;
    gameState.hiScore = parseInt(localStorage.getItem('lhx_hi') || '0', 10);

    gameState.onEnemyKilled = (e) => {
        gameState.score += e.def.score;
        gameState.missionKills++;
        notify(`${e.def.name} DESTROYED  +${e.def.score}`, '#00ff41');
    };
    gameState.onBuildingDestroyed = (b) => {
        if (!gameState.mission || gameState.state !== 'PLAYING') return;
        const pen = b.name === 'Casale' ? 20 : 40;
        gameState.score = Math.max(0, gameState.score - pen);
        gameState.missionCollateral++;
        notify(`COLLATERAL DAMAGE  -${pen}`, '#ff6644');
    };
    gameState.onPlayerDestroyed = () => {
        deathTimer = 2.5;
        gameState.helicopter.engineRunning = false;
        notify('HELICOPTER DESTROYED', '#ff4444', 4000);
    };

    // Intro text for the first mission
    gameState.stateBeforeBriefing = 'MENU';
}

export function beginCampaign(gameState) {
    showBriefing(gameState);
}

// ---------- Overlay ----------
function showOverlay(gameState, title, lines, prompt, action, tone = '') {
    const ov = $('overlay');
    $('overlay-title').textContent = title;
    $('overlay-body').innerHTML = lines.map(l => `<div>${l || '&nbsp;'}</div>`).join('');
    $('overlay-prompt').textContent = prompt;
    ov.className = tone;
    ov.classList.remove('hidden');
    overlayAction = action;
}

function hideOverlay() {
    $('overlay').classList.add('hidden');
    overlayAction = null;
}

export function handleEnter(gameState) {
    if (overlayAction) {
        const a = overlayAction;
        hideOverlay();
        a();
        return true;
    }
    return false;
}

// ---------- Mission flow ----------
function showBriefing(gameState) {
    const m = MISSIONS[gameState.missionIndex];
    gameState.state = 'BRIEFING';
    $('hud').classList.add('hidden');
    prepareMission(gameState);   // spawn the field, reset the helicopter
    showOverlay(
        gameState,
        `MISSIONE ${gameState.missionIndex + 1}/${MISSIONS.length}`,
        [`<span class="ov-big">${m.title}</span>`, '', ...m.brief,
         '', 'COMANDI: W/S avanti-indietro  A/D vira  Q/E scorri',
         'SHIFT/R sali  CTRL/F scendi  SPAZIO fuoco  TAB arma'],
        'PREMI INVIO PER DECOLLARE',
        () => startMission(gameState),
        'briefing'
    );
}

function resetPlayer(gameState) {
    const h = gameState.helicopter;
    const pad = gameState.helipad;
    h.alive = true;
    h.group.visible = true;
    h.engineRunning = true;
    h.health = h.maxHealth;
    h.velocity.set(0, 0, 0);
    h.yaw = 0; h.pitch = 0; h.roll = 0;
    const gy = gameState.world.getHeight(pad.x, pad.z);
    h.position.set(pad.x, gy + 1.3, pad.z);
    h.altitude = 1.3;
    for (const t of gameState.weapons.types) t.ammo = t.maxAmmo;
    gameState.weapons.projectiles.forEach(p => gameState.scene.remove(p.mesh));
    gameState.weapons.projectiles.length = 0;
    gameState.weapons.lockTarget = null;
}

function prepareMission(gameState) {
    const m = MISSIONS[gameState.missionIndex];
    clearEnemies(gameState);
    resetPlayer(gameState);

    for (const g of m.groups) {
        for (let i = 0; i < g.n; i++) scatterSpawn(gameState, g);
    }
    gameState.mission = {
        def: m,
        time: 0,
        pending: m.reinforcements.map(r => ({ ...r, done: false })),
        completed: false,
    };
    gameState.missionKills = 0;
    gameState.missionCollateral = 0;
    gameState.missionStartScore = gameState.score;
}

function scatterSpawn(gameState, g) {
    const v = new THREE.Vector3();
    const pad = gameState.helipad;
    for (let tries = 0; tries < 40; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * g.r;
        const x = THREE.MathUtils.clamp(g.cx + Math.cos(a) * r, -900, 900);
        const z = THREE.MathUtils.clamp(g.cz + Math.sin(a) * r, -900, 900);
        if (gameState.world.isWater(x, z)) continue;
        if (Math.hypot(x - pad.x, z - pad.z) < 80) continue;
        v.set(x, gameState.world.getHeight(x, z) + 1, z);
        if (g.type !== 'heli' && checkBuildingCollision(gameState, v, 10)) continue;
        spawnEnemy(gameState, g.type, x, z, { altitude: g.altitude, aggression: g.aggression });
        return;
    }
    // Fallback: centre of the area
    spawnEnemy(gameState, g.type, g.cx, g.cz, { altitude: g.altitude, aggression: g.aggression });
}

function startMission(gameState) {
    gameState.state = 'PLAYING';
    $('hud').classList.remove('hidden');
    notify(`MISSIONE ${gameState.missionIndex + 1}: ${gameState.mission.def.title}`, '#ffd800', 4500);
    if (gameState.missionIndex === 0) notify('TIENI PREMUTO SHIFT PER DECOLLARE', '#00ff41', 5000);
    deathTimer = 0;
    completeTimer = 0;
}

function completeMission(gameState) {
    const mi = gameState.mission;
    mi.completed = true;
    const seconds = Math.round(mi.time);
    const timeBonus = Math.max(0, 300 - seconds) * 2;
    const bonus = 500 + timeBonus;
    gameState.score += bonus;
    const last = gameState.missionIndex >= MISSIONS.length - 1;
    gameState.state = 'DEBRIEF';
    $('hud').classList.add('hidden');
    saveHi(gameState);

    const lines = [
        `<span class="ov-big">${mi.def.title}</span>`,
        '',
        `Nemici distrutti ........ ${gameState.missionKills}`,
        `Danni collaterali ....... ${gameState.missionCollateral}`,
        `Tempo ................... ${seconds}s`,
        `Bonus missione .......... +${bonus}`,
        '',
        `PUNTEGGIO: ${gameState.score}`,
        `RECORD:    ${gameState.hiScore}`,
    ];
    if (last) {
        showOverlay(gameState, 'VITTORIA!', [
            'Castel Bolognese e\' salva grazie a te, pilota.', '', ...lines,
        ], 'PREMI INVIO PER RICOMINCIARE', () => location.reload(), 'victory');
    } else {
        showOverlay(gameState, 'MISSIONE COMPIUTA', lines, 'PREMI INVIO PER LA PROSSIMA MISSIONE', () => {
            gameState.missionIndex++;
            showBriefing(gameState);
        }, 'debrief');
    }
}

function playerLost(gameState) {
    gameState.lives--;
    saveHi(gameState);
    gameState.state = 'DEBRIEF';
    $('hud').classList.add('hidden');
    if (gameState.lives > 0) {
        showOverlay(gameState, 'ELICOTTERO PERDUTO', [
            `Elicotteri rimasti: ${gameState.lives}`,
            '',
            `PUNTEGGIO: ${gameState.score}`,
        ], 'PREMI INVIO PER RIPROVARE LA MISSIONE', () => showBriefing(gameState), 'gameover');
    } else {
        showOverlay(gameState, 'GAME OVER', [
            'Hai perso tutti gli elicotteri.',
            '',
            `PUNTEGGIO: ${gameState.score}`,
            `RECORD:    ${gameState.hiScore}`,
        ], 'PREMI INVIO PER RICOMINCIARE', () => location.reload(), 'gameover');
    }
}

function saveHi(gameState) {
    if (gameState.score > gameState.hiScore) {
        gameState.hiScore = gameState.score;
        localStorage.setItem('lhx_hi', String(gameState.hiScore));
    }
}

// ---------- Per-frame ----------
export function updateMissions(gameState) {
    const dt = gameState.delta;
    const h = gameState.helicopter;
    const mi = gameState.mission;
    if (!mi || gameState.state !== 'PLAYING') return;

    mi.time += dt;

    // Reinforcements
    for (const r of mi.pending) {
        if (!r.done && mi.time >= r.time) {
            r.done = true;
            spawnEnemy(gameState, r.type, r.x, r.z, { altitude: 70, aggression: 1.1 });
            notify(r.msg, '#ff4444', 4000);
        }
    }

    // Helipad resupply
    const pad = gameState.helipad;
    const onPad = h.alive && h.onGround && h.speed < 12 &&
        Math.hypot(h.position.x - pad.x, h.position.z - pad.z) < pad.r;
    if (onPad) {
        rearmTimer -= dt;
        if (rearmTimer <= 0) {
            rearmTimer = 0.1;
            const armed = rearm(gameState);
            const damaged = h.health < h.maxHealth;
            if (damaged) repairPlayer(gameState, 3);
            if (armed || damaged) wasRearming = true;
            else if (wasRearming) {
                wasRearming = false;
                notify('REARMED & REPAIRED', '#00ff41');
            }
        }
    }

    // Objectives
    const alive = countAlive(gameState);
    const incoming = mi.pending.filter(r => !r.done).length;
    updateHudPanel(gameState, alive, incoming);

    if (h.alive && alive === 0 && incoming === 0 && !mi.completed) {
        completeTimer += dt;
        if (completeTimer > 2.5) completeMission(gameState);
        else if (completeTimer - dt <= 0) notify('TUTTI GLI OBIETTIVI DISTRUTTI!', '#ffd800', 3000);
    }

    // Death
    if (!h.alive && deathTimer > 0) {
        deathTimer -= dt;
        if (deathTimer <= 0) playerLost(gameState);
    }
}

function updateHudPanel(gameState, alive, incoming) {
    const m = gameState.mission;
    $('m-title').textContent = `M${gameState.missionIndex + 1}: ${m.def.title}`;
    $('m-obj').textContent = `HOSTILES: ${alive}${incoming ? ' (+' + incoming + ' INBOUND)' : ''}`;
    $('m-score').textContent = `SCORE ${String(gameState.score).padStart(6, '0')}`;
    $('m-lives').textContent = 'LIVES ' + '♦'.repeat(Math.max(0, gameState.lives));
}
