# 🚁 LHX Castelbolognese — Walkthrough

## What Was Built

A complete retro-style helicopter flight and combat simulator inspired by **LHX Attack Chopper (EA, 1990)**, set over the town and countryside of **Castel Bolognese (RA)**. Built with modern Three.js and modular JavaScript (ES modules) with a custom retro VGA dither shader — no heavy build step, zero dependencies.

---

## Project Structure

| File | Size | Description |
|------|------|-------------|
| [index.html](file:///c:/NSCpythons/LHX/index.html) | 6.5 KB | Entry point with importmap, title screen, briefing modals, and green-phosphor HUD overlay |
| [style.css](file:///c:/NSCpythons/LHX/style.css) | 12.3 KB | Retro CRT scanlines, arcade font styles, tactical gauges, lock brackets, damage flash |
| [main.js](file:///c:/NSCpythons/LHX/js/main.js) | 5.6 KB | Game loop orchestrator, state machine (Menu, Briefing, Playing, Paused, Debrief) |
| [retro.js](file:///c:/NSCpythons/LHX/js/retro.js) | 4.2 KB | VGA pixelation & ordered palette dithering post-process shader pipeline |
| [missions.js](file:///c:/NSCpythons/LHX/js/missions.js) | 12.5 KB | Campaign progression, briefings, hostile wave tracking, score, lives, base rearm & repair |
| [enemies.js](file:///c:/NSCpythons/LHX/js/enemies.js) | 18.4 KB | AI enemies: hostile tanks, AA flak guns, and enemy attack helicopters with projectile physics |
| [helicopter.js](file:///c:/NSCpythons/LHX/js/helicopter.js) | 15.6 KB | Hand-crafted low-poly LHX gunship, spinning rotor animations, flight physics & damage states |
| [weapons.js](file:///c:/NSCpythons/LHX/js/weapons.js) | 9.6 KB | M230 chain gun (tracers + auto-aim lock) & Hellfire guided missiles with smoke trails |
| [buildings.js](file:///c:/NSCpythons/LHX/js/buildings.js) | 11.6 KB | Destructible landmarks: Torre Civica, Chiesa, Campanile, Municipio, farmhouses & rubble |
| [terrain.js](file:///c:/NSCpythons/LHX/js/terrain.js) | 10.9 KB | Castel Bolognese map: Via Emilia highway, cross streets, Senio river curve, farmland plots |
| [trees.js](file:///c:/NSCpythons/LHX/js/trees.js) | 6.3 KB | 800+ instanced 3D trees with seasonal color variations and cluster generation |
| [vehicles.js](file:///c:/NSCpythons/LHX/js/vehicles.js) | 5.9 KB | Civilian traffic (colorful Fiat-style cars) navigating town and countryside routes |
| [animals.js](file:///c:/NSCpythons/LHX/js/animals.js) | 14.5 KB | Low-poly fauna: chickens, cows, wild boars, wolves with reactive wandering and fleeing AI |
| [npcs.js](file:///c:/NSCpythons/LHX/js/npcs.js) | 8.6 KB | Animated Romagna farmers with hats, boots, arm/leg walking cycles and flee behaviors |
| [camera.js](file:///c:/NSCpythons/LHX/js/camera.js) | 3.3 KB | Multiple perspective modes: chase camera, cockpit view, and top-down / fly-by angles |
| [effects.js](file:///c:/NSCpythons/LHX/js/effects.js) | 13.5 KB | Multi-layer explosion FX: flash, fireball color shift, bouncing debris, smoke columns, screen shake |
| [audio.js](file:///c:/NSCpythons/LHX/js/audio.js) | 7.5 KB | Procedural Web Audio API sound synthesis: dynamic rotor hum, cannon bursts, missile whoosh, flak rumbles |
| [hud.js](file:///c:/NSCpythons/LHX/js/hud.js) | 9.7 KB | Real-time instrument gauges (ALT, SPD, VS), compass tape, target lock-on, waypoint arrow, radar minimap |
| [sky.js](file:///c:/NSCpythons/LHX/js/sky.js) | 4.2 KB | Horizon haze, atmospheric sky dome gradient, sun directional lighting, and low-poly clouds |
| [input.js](file:///c:/NSCpythons/LHX/js/input.js) | 2.2 KB | Keyboard and mouse controller handler with key debounce and pointer support |

**Total**: 20 source files (~167 KB of custom game code).

---

## How to Play

1. Run a local web server (e.g. `npx serve .` or `python -m http.server 3000`)
2. Open **`http://localhost:3000`** in any modern web browser
3. Press **ENTER** on the title screen to view the mission briefing and start flying!

### Controls

| Key | Action |
|-----|--------|
| **W / S** | Pitch nose down (forward) / nose up (backward) |
| **A / D** | Roll / turn left or right |
| **Q / E** | Strafe left / strafe right |
| **SHIFT / R** | Increase collective / climb |
| **CTRL / F** | Decrease collective / descend |
| **SPACE** | Fire active weapon (auto-aims towards locked target) |
| **1 / 2 / TAB** | Select Cannon (1), Hellfire Missiles (2), or cycle weapon (TAB) |
| **C** | Cycle camera view (Chase → Cockpit → Overview) |
| **P / ESC** | Pause / resume game |

---

## Gameplay & Features

### 1. Mission Campaign System
- **Mission Briefings & Objectives**: Read tactical briefs before takeoff outlining enemy troop concentrations, objectives, and collateral damage warnings.
- **Combat Target Arrow**: Real-time HUD arrow indicating direction and distance to the nearest hostile.
- **Helipad Base Operations**: Land back on the home helipad to repair hull damage and replenish 30mm rounds and Hellfire missiles.
- **Scoring & Lives**: Earn points by neutralizing hostiles; maintain situational awareness to avoid losing aircraft.

### 2. Enemies & Combat AI
- **Tanks**: Armored vehicles guarding roads and bridges that fire heavy ballistic shells.
- **Anti-Air (AA) Guns**: Rapid-fire flak cannons with high threat ranges.
- **Enemy Attack Helicopters**: Patrol choppers that hunt down the LHX.
- **Dynamic Lock-On**: Tactical targeting bracket locks onto targets in front of your crosshair for guided missile trajectories and cannon lead tracking.

### 3. Visuals & 90s VGA Post-Processing
- **Low-Poly Flat-Shaded 3D**: Hand-modeled polygons reminiscent of early 90s flight simulators.
- **VGA Retro Shader**: Authentic chunky resolution rendering combined with ordered dithering and a limited color palette.
- **Multi-Stage Explosions**: Detonations produce a blinding flash, expanding fireballs shifting from bright yellow to smoldering smoke, physics-driven bouncing debris, and distance-attenuated screen shake.

### 4. Living World of Castel Bolognese
- **Accurate Town Layout**: Features the Via Emilia, Via Calandrini, the winding Senio river, and surrounding Romagna fields.
- **Destructible Landmarks**: Torre Civica, Chiesa, Campanile, and town hall buildings that flash on impact and collapse into smoking piles of rubble.
- **Wildlife & Citizens**: Flocks of chickens, herds of cattle, wild boars in the brush, wolves on the perimeter, and local farmers who react and flee when aircraft fly low overhead.
- **Traffic**: Moving civilian cars navigating the road network.
