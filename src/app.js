const [coreResponse, overridesResponse, controlUpdatesResponse, cursorAutopilotResponse] = await Promise.all([
  fetch('./src/app-core.js', { cache: 'no-store' }),
  fetch('./src/app-overrides.js', { cache: 'no-store' }),
  fetch('./src/flight-control-updates.js', { cache: 'no-store' }),
  fetch('./src/cursor-autopilot.js', { cache: 'no-store' })
]);

if (!coreResponse.ok) throw new Error('Unable to load simulator core');
if (!overridesResponse.ok) throw new Error('Unable to load simulator overrides');
if (!controlUpdatesResponse.ok) throw new Error('Unable to load flight control updates');
if (!cursorAutopilotResponse.ok) throw new Error('Unable to load cursor autopilot');

let source = await coreResponse.text();
const overrides = await overridesResponse.text();
const controlUpdates = await controlUpdatesResponse.text();
const cursorAutopilot = await cursorAutopilotResponse.text();

source = source.replace(
  "import * as THREE from 'three';",
  "import * as THREE from 'three';\nlet pilotMode = 'cursor';\nconst cursorAim = { x: 0, y: -0.12, active: true, screenX: window.innerWidth * 0.5, screenY: window.innerHeight * 0.44 };\nconst cursorRaycaster = new THREE.Raycaster();\nconst cursorNdc = new THREE.Vector2();\nconst cursorGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1128);\nconst cursorGround = new THREE.Vector3();\nconst effectGroups = [];\nconst lightningPartPoints = { nose: [0, 1.3, -20.6], hull: [0, 0.7, -1.0], leftWing: [-10.5, -0.3, 2.4], rightWing: [10.5, -0.3, 2.4], leftEngine: [-7.8, -2.05, -2.4], rightEngine: [7.8, -2.05, -2.4], tail: [0, 4.2, 18.2], gear: [0, -3.2, 1.7] };"
);

source = source.replace(
  'Object.keys(damageLabels).forEach((part) => {',
  '[' + ['nose', 'hull', 'leftWing', 'rightWing', 'leftEngine', 'rightEngine', 'tail', 'gear'].map((part) => `'${part}'`).join(', ') + '].forEach((part) => {'
);

const startupPoint = '\ninit();\n';
if (!source.includes(startupPoint)) throw new Error('Unable to install simulator overrides');
source = source.replace(startupPoint, `\n${overrides}\n${controlUpdates}\n${cursorAutopilot}\ninit();\n`);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
await import(moduleUrl);
URL.revokeObjectURL(moduleUrl);