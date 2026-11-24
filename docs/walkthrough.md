# 🚁 LHX Castelbolognese — Walkthrough

## Cos'è stato costruito

Un simulatore retro 16-bit di **volo (elicottero LHX)** e **guida su strada (Peugeot 205 grigia 4 porte del 1986)** ambientato sulla **vera ortofoto aerea AGEA 2023 (Regione Emilia-Romagna, fino a 0,5 m/px), topografia e altimetria di Castel Bolognese (RA)** (`8.2 km × 8.2 km`, dati reali DEM + OpenStreetMap).

- **100% client-side in Chrome** (Three.js r162 + ES modules + Web Audio API, zero CDN a runtime).
- **Ortofoto aeree reali + Texture 16-bit**: 64 tile ortofoto AGEA 2023 (`web/assets/world/ortho/c_X_Z.jpg`, 7,15 MB totali) + texture atlas pixel-art 16-bit per i 4.259 edifici (persiane verdi/marroni romagnole, portici, mattoni, capannoni, tetti in coppi).
- **Doppio mezzo all'eliporto (`LHX` ⇄ `Peugeot 205 '86`)**: partono affiancati alla base; tasto **`G`** per passare istantaneamente dall'uno all'altro (`Shift+G` quando l'LHX è atterrato ovunque per portare la 205 accanto all'elicottero).
- **Servito staticamente da Docker sul server J1900 (`clanAI`)** tramite `nginx-unprivileged` read-only (~3–5 MB RAM, ~0% CPU a riposo).

> Per i dettagli tecnici di architettura, valutazione del motore grafico (low-poly vs sprite stratificati vs voxel), deploy Docker su J1900 e piano di handoff, vedi [ARCHITECTURE_AND_HANDOFF.md](ARCHITECTURE_AND_HANDOFF.md).

---

## Struttura del Progetto

| Percorso | Descrizione |
|----------|-------------|
| [web/index.html](../web/index.html) | Entry point, schermata titolo, briefing, HUD fosfori verdi, attribuzioni DEM/OSM |
| [web/style.css](../web/style.css) | Stile CRT/HUD, indicatori altitudine AGL/MSL, bussola + località, perf bar |
| [web/js/main.js](../web/js/main.js) | Orchestratore async, loop principale, stati (`MENU`, `BRIEFING`, `PLAYING`, `PAUSED`, `DEBRIEF`) |
| [web/js/terrain.js](../web/js/terrain.js) | Caricamento DEM reale (`height.bin` 513×513) + raster OSM, 8×8 chunk con 2 LOD + skirt, eliporto su campo reale |
| [web/js/buildings.js](../web/js/buildings.js) | 4.259 edifici OSM reali estrusi e fusi in chunk da 512 m, distruttibili singolarmente con hash spaziale 32 m |
| [web/js/trees.js](../web/js/trees.js) | Alberi, filari, boschi, parchi e frutteti OSM reali in soli 4 `InstancedMesh` |
| [web/js/retro.js](../web/js/retro.js) | Shader VGA Bayer 4×4 con sRGB integrato + switcher `V` (`VGA 3x` / `RETRO 2x` / `CRISP 1x`) |
| [web/js/missions.js](../web/js/missions.js) | 3 missioni su coordinate reali (Via Emilia/Ponte del Castello, Fiume Senio, Colline Appenniniche) + **Volo Libero (`F`)** |
| [web/js/enemies.js](../web/js/enemies.js) | IA nemica: carri armati, batterie contraeree (AA) ed elicotteri d'attacco |
| [web/js/helicopter.js](../web/js/helicopter.js) | Modello poligonale LHX, fisica di volo, auto-hover/atterraggio dolce quando si passa all'auto |
| [web/js/player_car.js](../web/js/player_car.js) | **Peugeot 205 grigia 4 porte (1986)**: texture pixel-art 16-bit, targa `RA`, cambio 5 marce, freno a mano, pendenza terreno |
| [tools/bake_ortho.py](../tools/bake_ortho.py) | Baker offline Python (stdlib) per le 64 tile ortofoto AGEA 2023 Regione Emilia-Romagna (`0.5–2 m/px`) |
| [web/js/weapons.js](../web/js/weapons.js) | Cannone M230 (traccianti + auto-aim su target agganciato) e missili Hellfire guidati |
| [web/js/vehicles.js](../web/js/vehicles.js) | Traffico civile su vere strade OSM con culling a 1.100 m |
| [web/js/animals.js](../web/js/animals.js) | Polli, mucche, cinghiali e lupi che fuggono dall'elicottero (culling a 450 m) |
| [web/js/npcs.js](../web/js/npcs.js) | Contadini romagnoli animati con fuga reattiva (culling a 450 m) |
| [web/js/sky.js](../web/js/sky.js) | Sky dome, sole, nebbia `600–3400 m` e nuvole in 1 singolo `InstancedMesh` |
| [web/js/hud.js](../web/js/hud.js) | Strumenti ALT (AGL + MSL reale), SPD, VS, bussola + località OSM, minimappa reale, perf overlay (`I`) |
| [web/js/effects.js](../web/js/effects.js) | Esplosioni multi-stadio (flash, sfere di fuoco, detriti rimbalzanti, fumo, screen shake) |
| [web/js/audio.js](../web/js/audio.js) | Sintesi Web Audio API (rotore modulato, cannone, Hellfire, esplosioni, bip lock-on) |
| [web/js/camera.js](../web/js/camera.js) | Telecamere Chase, Cockpit e dall'alto (`C`) |
| [web/js/input.js](../web/js/input.js) | Gestione tastiera |
| [tools/bake_world.py](../tools/bake_world.py) | Script offline Python (solo stdlib) per rigenerare `height.bin`, `osm.json`, `world.json` |
| [tools/fetch_vendor.py](../tools/fetch_vendor.py) | Script offline per scaricare Three.js r162 e font in `web/vendor/` |
| [deploy/compose.yaml](../deploy/compose.yaml) | Stack Docker `lhx_cb` (porta `8030`, read-only, 64 MB RAM max) |
| [deploy/nginx.conf](../deploy/nginx.conf) | Configurazione Nginx statica con gzip, cache e CSP stretta |

---

## Avvio su J1900 (`clanAI`)

```bash
cd /home/t0nz/docker/lhx-cb
docker compose up -d
```

Poi apri in Chrome: **`http://192.168.1.40:8030/`** (opzionale: `?q=lo` per iGPU molto datate, `?q=hi` per texture terreno 4096 px e più alberi).

---

## Comandi di Volo

| Tasto | Azione |
|-------|--------|
| **INVIO** (nel menu) | Avvia la Campagna (LHX + Peugeot 205 pronti in base) |
| **F** (nel menu) | Avvia **Volo Libero** sull'elicottero LHX |
| **G** (nel menu) | Avvia **Guida Libera** direttamente sulla **Peugeot 205 (1986)** |
| **G** (in gioco) | **Cambia veicolo al volo** (`LHX` ⇄ `Peugeot 205`) |
| **SHIFT + G** (in gioco) | Se l'LHX è atterrato, porta la Peugeot 205 accanto all'elicottero e sali a bordo |
| **W / S** | Avanti / Indietro (Peugeot 205: acceleratore / freno e retromarcia) |
| **A / D** | Vira (LHX) / Sterza ruote anteriori (Peugeot 205) |
| **Q / E** | Trasla (strafe) a sinistra / destra (LHX) |
| **SHIFT / R** | Aumenta collettivo / sali (LHX) |
| **CTRL / F** | Riduci collettivo / scendi (LHX) |
| **SPAZIO** | Fuoco arma attiva (LHX) / **Freno a mano** (Peugeot 205) |
| **H** | **Clacson** bitonale anni '80 (Peugeot 205) |
| **1 / 2 / TAB** | Seleziona Cannone M230 / Missili Hellfire / cambia arma |
| **C** | Cambia visuale telecamera (Chase → Cockpit → Dall'alto) |
| **V** | Cambia preset grafico live (`VGA 3x` → `RETRO 2x` → `CRISP 1x`) |
| **I** | Mostra/nascondi telemetria prestazioni (`FPS | Draw Calls | Triangoli`) |
| **P / ESC** | Pausa |
