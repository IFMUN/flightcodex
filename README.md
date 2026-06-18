# Yosemite Flight Lab

A self-contained browser flight scene for a Yosemite-scale valley simulation. It replaces the repository with a static Three.js app that can run from GitHub Pages or any static file host.

## What is included

- Full-screen 3D Yosemite-inspired terrain using meter-based world units.
- Six placed waterfall systems: Yosemite Falls, Bridalveil Fall, Vernal Fall, Nevada Fall, Ribbon Fall, and Sentinel Fall.
- Custom animated waterfall shader ribbons with mist and pools.
- Procedural forest classification with a 266,000-tree cinematic mode and a lighter balanced mode.
- 737 MAX 9-scale aircraft geometry using real-world approximate length, wingspan, height, mass, wing area, and thrust values.
- Keyboard-paired flight controls with throttle, elevator, aileron, rudder, flaps, trim, brakes, camera modes, time of day, weather, and landing gear.
- Dynamic sky states from dawn through night.
- Weather modes for clear air, snow, aurora, storm, and hurricane-force winds.
- Wind, gust, shear, turbulence, lift, drag, stall, gear drag, flap lift, braking, and collision handling in the flight model.
- Persistent crash fires and landing markers saved in browser local storage so previous attempts remain visible when another airframe is spawned.
- Glass/liquid HUD surfaces using backdrop filtering, refractive highlights, and animated sweep layers.

## Controls

| Input | Action |
| --- | --- |
| Enter / Open Flight Scene | Start |
| W / S | Throttle up / down |
| Arrow keys | Pitch and roll |
| A / D | Rudder yaw |
| G | Landing gear handle |
| F / V | Flaps up / down cycle |
| [ / ] | Pitch trim |
| B or Space | Brakes |
| R | Spawn another airframe |
| C | Camera mode |
| T | Time of day cycle |
| M | Weather cycle |
| 1-5 | Dawn, noon, golden, dusk, night |

## Accuracy notes

This branch was built entirely through the GitHub connector, without a local checkout and without downloading external terrain or satellite datasets. The terrain is a procedural DEM-style Yosemite model, not a verified NASA DEM import. The renderer includes the right hooks for dataset-backed elevation and imagery, but the current branch does not claim surveyed accuracy.

Visual screenshot testing was also not run because the request was to avoid touching the local system. A local or CI browser pass should be added before treating this as production-grade.

## Run

Open `index.html` from a static host. GitHub Pages works because the app has no build step.
