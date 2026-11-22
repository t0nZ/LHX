# LHX Castelbolognese — Architettura, Valutazione Motore Grafico & Handoff

> Documento tecnico pensato per il deploy sul server **clanAI (Intel Celeron J1900)** e per consentire a qualsiasi agente futuro di riprendere immediatamente il lavoro senza perdere contesto.

---

## 1. Stato Attuale del Progetto

- **Percorso canonico su J1900**: `/home/t0nz/AiProjects/LHX_cb` (`G:\AiProjects\LHX_cb` via SMB)
- **Cartella stack Docker su J1900**: `/home/t0nz/docker/lhx-cb` (`G:\docker\lhx-cb` via SMB)
- **Repository GitHub**: `https://github.com/t0nZ/LHX.git` (branch `main`)
- **Architettura**: **100% client-side** in Chrome (WebGL + ES Modules + Web Audio API). Il server J1900 si limita a servire file statici compressi in gzip tramite un container `nginx-unprivileged` read-only.

### Struttura Repository

```text
LHX_cb/
├── web/                        # Root statica montata :ro in Nginx
│   ├── index.html              # Entry point, HUD, briefing, attribuzioni DEM/OSM
│   ├── style.css               # Stile retro fosfori verdi + HUD
│   ├── js/                     # 18 moduli ES nativi (zero build step)
│   │   ├── terrain.js          # DEM reale 8.2x8.2 km, chunk 8x8 con 2 LOD + skirt, raster OSM
│   │   ├── buildings.js        # 4.259 edifici OSM reali fusi in chunk 512m, distruttibili
│   │   ├── trees.js            # Alberi/filari/boschi/frutteti OSM reali (solo 4 InstancedMesh)
│   │   ├── retro.js            # Pipeline VGA Bayer 4x4 (sRGB integrato) + preset V (3x/2x/1x)
│   │   ├── missions.js         # 3 missioni su coordinate reali + modalità Volo Libero (F)
│   │   ├── helicopter.js       # Modello LHX, fisica di volo, limiti mondo dinamici ±3946 m
│   │   ├── sky.js              # Sky dome, nebbia 600–3400 m, nuvole in 1 singolo InstancedMesh
│   │   ├── vehicles.js         # Auto civili su strade reali OSM (shared geo + culling 1100 m)
│   │   ├── animals.js / npcs.js# Fauna e contadini con distance culling (< 450 m)
│   │   ├── hud.js              # Bussola, località OSM più vicina, ALT AGL + MSL reale, FPS/DC (I)
│   │   └── main.js, camera.js, weapons.js, enemies.js, effects.js, audio.js, input.js
│   ├── assets/world/           # Dati geografici reali pre-calcolati offline (statici)
│   │   ├── world.json          # Metadati proiezione, bbox, quote min/max/centro
│   │   ├── height.bin          # Heightmap Uint16 LE 513x513 (passo 16 m, 526 KB)
│   │   └── osm.json            # 4.259 edifici, 1.655 strade, 155 corsi d'acqua, ecc. (1.1 MB)
│   └── vendor/                 # Three.js r162 + font locali (zero dipendenze CDN a runtime)
├── tools/
│   ├── bake_world.py           # Baker Python stdlib-only: scarica DEM Terrarium + OSM Overpass
│   └── fetch_vendor.py         # Scarica Three.js r162 e font in web/vendor/
├── deploy/
│   ├── compose.yaml            # Compose hardenizzato (condivide immagine già su clanAI)
│   └── nginx.conf              # Gzip, cache assets, solo GET/HEAD, CSP stretta, access_log off
└── docs/
    ├── ARCHITECTURE_AND_HANDOFF.md  # Questo documento
    └── walkthrough.md               # Guida giocatore e panoramica moduli
```

---

## 2. Deploy sul Server J1900 (`clanAI`)

Il PC Windows non ha chiave SSH verso `192.168.1.40`, quindi il container va avviato direttamente dal server `clanAI` (via SSH / console / Control Deck):

```bash
cd /home/t0nz/docker/lhx-cb
docker compose up -d
docker ps --filter name=lhx_cb
```

- **Indirizzo LAN**: `http://192.168.1.40:8030/`
- **Impatto sul J1900**:
  - Usa lo **stesso digest esatto** `nginxinc/nginx-unprivileged@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03` già scaricato da `ricettario_albertina` -> **0 MB extra su SSD**, avvio istantaneo.
  - Filesystem `read_only: true`, `cap_drop: [ALL]`, `no-new-privileges:true`, `mem_limit: 64m`, `cpus: 0.50`, `access_log off`.
  - Consumo atteso: **~3–5 MB RAM**, **~0% CPU a riposo** (solo trasferimento HTTP statico gzip al caricamento iniziale; dopo il boot di ~1–2 s il server non riceve più alcuna richiesta durante il gioco).
  - Modificando file in `/home/t0nz/AiProjects/LHX_cb/web` basta ricaricare Chrome (`F5`) senza riavviare Docker.

### Esposizione opzionale via Caddy / Control Deck
- Se in futuro si vuole esporre anche in HTTPS (es. `lhx.deeppond.duckdns.org`), aggiungere un blocco in `/home/t0nz/docker/guacamole/Caddyfile` verso `192.168.1.40:8030` (con bypass LAN o Authelia 2FA su WAN) e una scheda in `Control Deck v3.1 -> [7] Siti & Guide`.

---

## 3. Fedeltà Altimetrica, Topografica e Visiva

### Sistema di Coordinate & Dati Reali
- **Origine `(0, 0)`**: Piazza Bernardi, Castel Bolognese (`44.31957° N, 11.79937° E`, quota reale `46.9 m s.l.m.`).
- **Assi**: `+X = Est`, `+Z = Sud`, `+Y = Alto` (in metri reali). `y = 0` corrisponde a `46.9 m MSL` (`world.elevationBase`); l'HUD mostra sia l'altitudine dal suolo (`ALT m`) sia la quota reale sul livello del mare (`MSL`).
- **Area coperta**: `8.192 m × 8.192 m` (dal casello/Autostrada A14 e Zello a nord fino a Biancanigo, Casale, Campiano, Santuario della Fognana e Ossano a sud-ovest; da Selva a ovest fino a Ponte del Castello, Fiume Senio, San Procolo e Gaiano a est).
- **Altimetria reale**: `min 22.0 m` (pianura NE) → `46.9 m` (centro storico) → `max 209.2 m` (prime colline appenniniche SW). Fonte: AWS Terrain Tiles (Terrarium, derivato da EU-DEM/SRTM), campionato su griglia `513×513` (passo `16 m`, precisione verticale `10 cm` in `Uint16`).
- **Topografia reale (OpenStreetMap)**: `4.259` edifici con sagoma e altezza reale/stimata, `1.655` strade (Via Emilia, Via Casolana, Via Lugo, A14, strade urbane), `155` corsi d'acqua (Fiume Senio, Rio Sanguinario, Rio Pideura, canali), `879` aree d'uso suolo (200 campi, 188 vigneti, 151 frutteti, parchi, zone residenziali/industriali), `342` alberi + `10` filari + `25` località reali mostrate sotto la bussola.

---

## 4. Valutazione Riprogettazione Motore Grafico (per Chrome su iGPU Intel)

L'utente ha chiesto di valutare se mantenere il low-poly WebGL oppure riprogettare il motore (es. **sprite stratificati / sprite-stacking** o altri approcci retro). Ecco il confronto tecnico mirato a **Intel HD/UHD/Iris integrata in Chrome**:

| Approccio | Fedeltà altimetrica & topografica | Costo su iGPU Intel (Chrome) | Estetica Retro & Volo 3D | Verdetto |
|---|---|---|---|---|
| **A. Low-Poly WebGL Chunked + Shader VGA** *(attuale)* | **Eccellente**: mesh reale dal DEM + 4.259 poligoni OSM estrusi con tetti a falde/piani + 360° liberi di camera (chase / cockpit / overview). | **Molto basso**: testato live a **60 FPS** con ~111 draw call e ~136k triangoli in `CRISP 1x`, e **1/9 dei pixel** in `VGA 3x` (640×360 su monitor Full HD). | Fedelissimo a **LHX Attack Chopper (1990)** e *Gunship 2000* con dithering Bayer 4×4 e shading piatto. | **SCELTA PRIMARIA CONSIGLIATA** |
| **B. Sprite Stratificati (Sprite-Stacking 2.5D)** | **Scarsa su terreno collinare**: nasce per viste isometriche/top-down a camera fissa (*Desert Strike*, *Nium*). Con camera libera in picchiata o cockpit si vedono i "fogli" tagliati e le pendenze collinari diventano a gradoni. | **Alto overdraw su iGPU Intel**: 4.259 edifici × 8–16 strati di sprite trasparenti saturano il fill-rate delle Intel HD/UHD (che soffrono molto l'alpha-blending ripetuto). | Carino in stile pixel-art isometrico, ma poco adatto a un simulatore di volo con rilievi reali. | **Sconsigliato come motore principale** (utile solo come effetto per alberi lontani o nuvole/fumo) |
| **C. Voxel Space / Raycasting Heightmap** (*Comanche*) | **Ottima per il solo terreno** (colline morbide e altimetria pura), ma **inadatta a 4.259 edifici poligonali** con tetti spigolosi e distruzione per singolo edificio. | **Alto su CPU JS** (se software Canvas2D) oppure richiede fragment shader complesso su WebGL2 per raymarching, comunque più pesante di 64 chunk triangolari su iGPU vecchie. | Molto evocativo per valli/montagne, ma fa perdere precisione urbana nel centro storico di Castel Bolognese. | **Sconsigliato come sostituto** |
| **D. Ibrido Low-Poly + Billboard/Impostor (evoluzione futura)** | Mantiene il 100% della fedeltà altimetrica/topografica di **A**. | **Riduce ulteriormente i triangoli**: oltre 600–800 m gli alberi passano da 3D instanced a billboard/sprite crociati; edifici lontani usano LOD semplificato. | Unisce il meglio dei due mondi: solidità geometrica da vicino, densità retro da lontano. | **Evoluzione naturale consigliata per i prossimi step** |

### Ottimizzazioni iGPU Intel già implementate
1. **Chunked Terrain LOD (8×8 chunk, 2 livelli LOD centrati su ogni chunk + skirt)**: solo i chunk vicini alla camera usano la griglia 16 m; quelli lontani scendono a 64 m.
2. **4.259 edifici in ~50 chunk (512 m)** con `BufferGeometry` fusa per chunk + `addUpdateRange` per far lampeggiare/crollare un singolo edificio senza ricostruire il chunk.
3. **Alberi reali OSM in soli 4 `InstancedMesh`** + **nuvole in 1 solo `InstancedMesh`** (ridotte da ~136 draw call a 1).
4. **Distance culling su entità piccole**: animali e contadini invisibili oltre `450 m`, auto civili oltre `1.100 m` (risparmio di ~800–900 draw call per frame).
5. **Post-processing ridotto a 1 solo passo**: rimosso `OutputPass` (conversione Linear→sRGB integrata in `RetroShader`), e modalità `CRISP 1x` (`V`) che bypassa completamente `EffectComposer`.
6. **Parametri URL e hotkey live**:
   - `?q=lo` (texture terreno 1024 px, meno alberi), `?q=auto` (default, 2048 px), `?q=hi` (4096 px, più alberi).
   - Tasto **`V`** in volo: cicla `VGA 3x` → `RETRO 2x` → `CRISP 1x`.
   - Tasto **`I`** in volo: mostra/nasconde `FPS | DC | TRI | PRESET`.

---

## 5. Verifica Live Effettuata (Chrome)

Testato via browser reale su `web/` (server temporaneo subito terminato dopo il test):
- **33/33** richieste HTTP `200 OK`, **0 errori in console**.
- **60 FPS stabili** in tutti e 3 i preset (`VGA 3x`, `RETRO 2x`, `CRISP 1x`).
- In `CRISP 1x` nativo: `111 DC | 136.2k TRI`.
- Quota reale verificata: eliporto a `45 m MSL`, in salita `ALT 23 m / 66 m MSL`, località `CASTEL BOLOGNESE 0.8km`, colline appenniniche visibili a sud e minimappa reale OSM perfettamente allineata.

---

## 6. Handoff — Idee & Prossimi Passi per il Prossimo Agente

Se l'utente vorrà spingere ancora oltre fedeltà e prestazioni, ecco le priorità ordinate per impatto/sforzo:

1. **Altimetria ad altissima risoluzione (TINITALY 10 m / LiDAR RER Emilia-Romagna 1–5 m)**:
   - Oggi `tools/bake_world.py` usa AWS Terrarium (~20–30 m reali, campionato a 16 m). Sostituendo la sola sorgente DEM in `bake_world.py` con i dati aperti **INGV TINITALY (10 m)** o **DTM Regione Emilia-Romagna** (senza toccare il formato `height.bin` o `terrain.js`!), argini del Senio, cavalcavia ferroviario e calanchi appenninici diventano ultra-precisi.
2. **Landmark iconici fatti a mano sopra OSM (`buildings.js`)**:
   - Sostituire o arricchire le sagome OSM di **Torre Civica**, **Chiesa di San Petronio** `(-51, 155)`, **San Francesco** `(-20, 31)`, **Ponte del Castello** sul Senio e **Stazione ferroviaria** con modelli low-poly dedicati + texture procedurali di finestre/mattoni romagnoli (usando un texture atlas singolo per mantenere 1 draw call per chunk).
3. **Instancing per fauna, contadini e auto (`animals.js`, `npcs.js`, `vehicles.js`)**:
   - Oggi usano `THREE.Group` con distance culling; se l'utente vola basso su zone dense si possono convertire in `InstancedMesh` o **sprite billboard a 8 direzioni** stile Doom/LHX per azzerare del tutto i draw call delle entità a terra.
4. **Billboard / Impostor ibridi per gli alberi lontani (`trees.js`)**:
   - Sostituire le chiome oltre ~600 m con semplici sprite/cross-quad instanziati per permettere 5.000+ alberi sui colli a costo quasi nullo su Intel HD.
5. **Ottimizzazione UI su finestre piccole & Gamepad**:
   - A risoluzioni strette (< 800 px) il pannello missione in alto a sinistra può sfiorare la bussola: aggiungere media query responsive in `web/style.css` e supporto `navigator.getGamepads()` in `web/js/input.js`.
6. **Rigenerazione dati**:
   - `python3 tools/bake_world.py` (cache in `tools/.cache/`, git-ignored; nota: `overpass-api.de` aveva certificato scaduto il 22/11/2026 ma il fallback `overpass.kumi.systems` funziona; eventualmente aggiungere `maps.mail.ru/osm/tools/overpass/api/interpreter` come terzo mirror).
