# 🚁 LHX Castelbolognese — Walkthrough

## What Was Built

A complete retro-style helicopter flight simulator inspired by **LHX Attack Chopper (EA, 1990)**, set over the town of **Castel Bolognese (RA)**. Built with Three.js and JavaScript ES modules — no build step, no framework.

## Project Structure

| File | Size | Description |
|------|------|-------------|
| [index.html](file:///c:/NSCpythons/LHX/index.html) | 5.3 KB | Entry point with importmap, title screen, HUD overlay |
| [style.css](file:///c:/NSCpythons/LHX/style.css) | 8.7 KB | Retro green-on-black HUD styling, scanlines |
| [main.js](file:///c:/NSCpythons/LHX/js/main.js) | 5.0 KB | Game loop orchestrator, state management |
| [terrain.js](file:///c:/NSCpythons/LHX/js/terrain.js) | 8.9 KB | Castel Bolognese terrain with Via Emilia, roads, Senio |
| [buildings.js](file:///c:/NSCpythons/LHX/js/buildings.js) | 10.5 KB | Destructible buildings: Torre Civica, Chiesa, Municipio |
| [trees.js](file:///c:/NSCpythons/LHX/js/trees.js) | 6.2 KB | 800+ instanced trees with color variation |
| [helicopter.js](file:///c:/NSCpythons/LHX/js/helicopter.js) | 12.5 KB | Hand-built LHX polygon model + flight physics |
| [camera.js](file:///c:/NSCpythons/LHX/js/camera.js) | 3.4 KB | Chase / cockpit / top-down camera modes |
| [weapons.js](file:///c:/NSCpythons/LHX/js/weapons.js) | 5.2 KB | M230 cannon + Hellfire missiles |
| [effects.js](file:///c:/NSCpythons/LHX/js/effects.js) | 13.5 KB | Multi-layered explosions, debris, smoke, shockwaves |
| [vehicles.js](file:///c:/NSCpythons/LHX/js/vehicles.js) | 5.9 KB | Civilian cars driving on roads |
| [animals.js](file:///c:/NSCpythons/LHX/js/animals.js) | 14.5 KB | Chickens, cows, wild boars, wolves with AI |
| [npcs.js](file:///c:/NSCpythons/LHX/js/npcs.js) | 8.6 KB | Farmer characters with walking animation |
| [hud.js](file:///c:/NSCpythons/LHX/js/hud.js) | 6.4 KB | HUD gauges + radar minimap |
| [audio.js](file:///c:/NSCpythons/LHX/js/audio.js) | 6.3 KB | Synthesized rotor, cannon, missile, explosion sounds |
| [input.js](file:///c:/NSCpythons/LHX/js/input.js) | 2.3 KB | Keyboard + mouse input with pointer lock |

**Total**: ~115 KB of hand-written game code (17 files)

## How to Play

1. Open **http://localhost:3000** in your browser
2. Press **ENTER** to start
3. Controls:

| Key | Action |
|-----|--------|
| **W / S** | Pitch forward / back |
| **A / D** | Roll left / right |
| **Q / E** | Yaw (rotate) left / right |
| **SHIFT** | Increase collective (climb) |
| **CTRL** | Decrease collective (descend) |
| **SPACE** | Fire weapon |
| **1 / 2** | Switch to Cannon / Missiles |
| **C** | Cycle camera view |
| **P / ESC** | Pause |

## Features

### World: Castel Bolognese
- Via Emilia (east-west highway) and Via Calandrini (north-south)
- Rectangular centro storico with medieval walls
- Piazza Bernardi as open square
- Fiume Senio (river) to the east with sinuous curves
- Patchwork countryside fields in various greens
- 40+ farmhouses scattered in the countryside

### Landmarks
- **Torre Civica** — tall tower with pyramid roof
- **Chiesa** — large church building
- **Campanile** — bell tower
- **Municipio** — town hall on the piazza

### Helicopter (LHX)
- Hand-modeled flat-shaded polygon fuselage
- Animated 4-blade main rotor + tail rotor
- Landing skids + weapon pylons
- Semi-realistic physics (collective, cyclic, pedals)

### Destructible Buildings
- Shoot buildings to damage them (flash red)
- When destroyed: collapse animation + explosion + rubble

### Explosions & Effects
- Multi-stage: white flash → fireballs → debris → smoke column → shockwave ring
- Fireballs shift color (orange → red → black) as they expand
- Physics-simulated debris with ground bouncing
- Screen shake proportional to distance
- Missile smoke trails

### Life
- **25 civilian cars** driving on roads (various colors)
- **30 chickens** (with red combs and beaks)
- **25 cows** (white with brown spots)
- **15 wild boars** (brown, stocky)
- **8 wolves** (gray, in outskirts)
- **20 farmers** (with hats, boots, arm/leg walking animation)
- All flee from the helicopter when it gets close!

### Audio
- Synthesized rotor hum (modulated by collective)
- Cannon shot burst
- Missile whoosh
- Multi-layered explosion rumble

## What's NOT included yet (future iterations)
- Enemy units and combat AI
- Mission system
- Multiple helicopter types (Apache, Blackhawk, Osprey)
- Multiplayer
- Save/load
