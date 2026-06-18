# Yosemite Flight Lab

A self-contained browser flight scene for a Yosemite-scale valley simulation. It replaces the repository with a static Three.js app that can run from GitHub Pages or any static file host.

## What is included

- Full-screen 3D Yosemite-inspired terrain using meter-based world units.
- Six placed waterfall systems: Yosemite Falls, Bridalveil Fall, Vernal Fall, Nevada Fall, Ribbon Fall, and Sentinel Fall.
- Custom animated waterfall shader ribbons with mist and pools.
- Procedural forest classification with a 266,000-tree cinematic mode and a lighter balanced mode.
- More detailed 737 MAX 9-scale aircraft geometry with passenger windows, cockpit glazing, doors, winglets, flaps, slats, fan blades, nacelles, animated gear, nav lights, and damage marks.
- Preflight pilot selection for Cursor or Full Keyboard before the aircraft starts flying.
- Cursor pilot mode is a guarded heading autopilot: horizontal pointer aim turns the aircraft, while pitch and spin are clamped by stability protection.
- Cursor pointer height is banned from pitch control, and direction changes rely on capped heading-rate steering rather than climbing or diving.
- A thrust slider with an 82% starting thrust, plus keyboard throttle controls for in-flight adjustments.
- Keyboard-paired elevator, aileron, rudder, flaps, trim, brakes, camera modes, time of day, weather, and landing gear.
- A more forgiving fly-by-wire assist so the aircraft starts higher, steadier, and less prone to immediate terrain impact.
- Dynamic sky states from dawn through night.
- Weather modes for clear air, snow, aurora, storm, lightning, and hurricane-force winds.
- Branching lightning strikes with brighter impact flashes, local electrical arcs, engine surge effects, and part-specific damage to engines, wings, hull, tail, nose, and landing gear.
- A richer airframe damage schematic with severity states, detailed damage notes, red edge warning treatment, and stronger visual feedback when damage creates a downward crash risk.
- Wind, gust, shear, turbulence, lift, drag, stall, gear drag, flap lift, braking, landing, crash, and damage handling in the flight model.
- Persistent crash fires and landing markers saved in browser local storage so previous attempts remain visible when another airframe is spawned.
- Enhanced crash effects with fireballs, expanding shock rings, debris bursts, smoke, scorch marks, and persistent burn sites.
- Glass/liquid HUD surfaces using backdrop filtering, refractive highlights, animated sweep layers, and a corner airframe damage schematic.
- A clean override loader that keeps the simulator patch in `src/app-overrides.js` instead of embedding a large fragile script string inside `src/app.js`.

## Controls

| Input | Action |
| --- | --- |
| Pilot selector | Choose Cursor or Full Keyboard before launch |
| Enter / Open Flight Scene | Start after a pilot mode is selected |
| Thrust slider | Set starting and in-flight thrust |
| W / S | Throttle up / down |
| Cursor / pointer | Aim heading in Cursor mode; vertical pointer movement cannot command pitch |
| Arrow up / down | Pitch up / down in Full Keyboard mode |
| Arrow left / right | Roll left / right in Full Keyboard mode |
| A / D | Rudder yaw in Full Keyboard mode |
| G | Landing gear handle |
| F / V | Flaps up / down cycle |
| [ / ] | Pitch trim |
| B or Space | Brakes |
| R | Spawn another airframe |
| C | Camera mode |
| T | Time of day cycle |
| M | Weather cycle |
| L | Lightning weather mode |
| 1-5 | Dawn, noon, golden, dusk, night |

## Accuracy notes

This branch was built entirely through the GitHub connector, without a local checkout and without downloading external terrain or satellite datasets. The terrain is a procedural DEM-style Yosemite model, not a verified NASA DEM import. The renderer includes the right hooks for dataset-backed elevation and imagery, but the current branch does not claim surveyed accuracy.

Visual screenshot testing was also not run because the request was to avoid touching the local system. A local or CI browser pass should be added before treating this as production-grade.

## Run

Open `index.html` from a static host. GitHub Pages works because the app has no build step.
