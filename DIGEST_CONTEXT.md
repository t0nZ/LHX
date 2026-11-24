<!-- AiTalks: generato con gemini-3.5-flash; 2026-11-24T10:58:27.411384+01:00; fonti originali preservate. -->

<!-- AiTalks: memoria tecnica aggiornata al 2026-11-24; fonti originali preservate. -->

# LHX_cb — LHX Attack Chopper Castelbolognese 3D

- **Scopo**: Simulatore di volo 3D in elicottero rétro ambientato sul territorio di Castel Bolognese, ispirato al videogioco classico *LHX Attack Chopper* (1990).
- **Macchina & Ruolo**: Applicazione web 3D (Three.js) servita via container Docker Nginx statico su **clanAI**.
- **Componenti**: `web/index.html`, `web/js/helicopter.js`, `web/js/hud.js`, modelli Three.js, integrazione elevazione DEM AWS (EU-DEM/SRTM) e mappe OpenStreetMap.
- **Flusso dei Dati**: Asset 3D e codice JS caricati nel browser ➔ rendering WebGL client-side con fisica di volo e HUD integrato.
- **Stato Documentato**: Motore DEM+OSM operativo, ottimizzato per iGPU Intel, pacchettizzato ed eseguito in container Nginx con permessi non elevati (1000:1000).
