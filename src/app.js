import * as THREE from 'three';

const WORLD = {
  width: 22000,
  depth: 13000,
  treeTarget: 266000,
  runway: { xMin: -2600, xMax: 2600, zHalf: 86 }
};

const STORAGE_KEY = 'yosemite-flight-attempts-v2';

ensureHudAdditions();

const clock = new THREE.Clock();
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9fb9c9, 0.000052);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 60000);
camera.position.set(-5200, 1900, 900);

const ui = {
  launch: document.getElementById('launch'),
  start: document.getElementById('startButton'),
  hud: document.getElementById('hud'),
  message: document.getElementById('systemMessage'),
  airspeed: document.getElementById('airspeed'),
  altitude: document.getElementById('altitude'),
  vsi: document.getElementById('vsi'),
  throttle: document.getElementById('throttle'),
  gear: document.getElementById('gearState'),
  flaps: document.getElementById('flapsValue'),
  wind: document.getElementById('windValue'),
  weather: document.getElementById('weatherValue'),
  forest: document.getElementById('forestValue'),
  attempts: document.getElementById('attemptsList'),
  readout: document.getElementById('readout'),
  quality: document.getElementById('qualityToggle'),
  weatherButtons: Array.from(document.querySelectorAll('[data-weather]')),
  timeButtons: Array.from(document.querySelectorAll('[data-time]')),
  damagePanel: document.getElementById('damageModel'),
  damageList: document.getElementById('damageList'),
  damageVignette: document.getElementById('damageVignette'),
  damageParts: Array.from(document.querySelectorAll('[data-damage-part]'))
};

const tmp = {
  v1: new THREE.Vector3(),
  v2: new THREE.Vector3(),
  v3: new THREE.Vector3(),
  q1: new THREE.Quaternion(),
  e1: new THREE.Euler(),
  m1: new THREE.Matrix4(),
  color: new THREE.Color()
};

const keys = new Set();
const waterMaterials = [];
const fireGroups = [];
const lightningBolts = [];
const damageLabels = {
  nose: 'nose',
  hull: 'fuselage',
  leftWing: 'left wing',
  rightWing: 'right wing',
  leftEngine: 'left engine',
  rightEngine: 'right engine',
  tail: 'tail',
  gear: 'landing gear'
};

let forestMesh = null;
let forestShadowMesh = null;
let precipitation = null;
let aurora = null;
let hurricaneBands = null;
let lightningGroup = null;
let lightningLight = null;
let cameraMode = 0;
let started = false;
let lastHud = 0;
let lastFrameTime = performance.now();
let frameAverage = 16;
let lightningTimer = 5.5;
let lightningFlash = 0;
let smokeClock = 0;

const weatherModes = {
  clear: { label: 'Clear', wind: 8, gust: 2, density: 0, snow: false, rain: false, lightning: false, color: 0xb7d5ef },
  snow: { label: 'Snow', wind: 14, gust: 6, density: 3600, snow: true, rain: false, lightning: false, color: 0xdce8f2 },
  aurora: { label: 'Aurora', wind: 10, gust: 4, density: 900, snow: true, rain: false, lightning: false, color: 0x0b1631 },
  storm: { label: 'Storm', wind: 30, gust: 18, density: 4600, snow: false, rain: true, lightning: true, color: 0x647584 },
  lightning: { label: 'Lightning', wind: 24, gust: 24, density: 5600, snow: false, rain: true, lightning: true, color: 0x3c4865 },
  hurricane: { label: 'Hurricane', wind: 62, gust: 42, density: 6800, snow: false, rain: true, lightning: true, color: 0x3f5362 }
};

const timeModes = {
  dawn: { label: 'Dawn', skyA: 0x16283c, skyB: 0xffb581, sun: 0xffb075, intensity: 0.72, exposure: 0.92 },
  noon: { label: 'Noon', skyA: 0x6eb6ed, skyB: 0xdbeeff, sun: 0xffffff, intensity: 1.28, exposure: 1.04 },
  golden: { label: 'Golden', skyA: 0xf9b15b, skyB: 0x6688a5, sun: 0xffd092, intensity: 1.05, exposure: 1.02 },
  dusk: { label: 'Dusk', skyA: 0x18233d, skyB: 0xe48c6e, sun: 0xff8a65, intensity: 0.58, exposure: 0.88 },
  night: { label: 'Night', skyA: 0x020817, skyB: 0x101a32, sun: 0x8aa7ff, intensity: 0.18, exposure: 0.67 }
};

const settings = {
  weather: 'clear',
  time: 'golden',
  quality: 'balanced',
  windDir: new THREE.Vector3(0.72, 0.03, -0.69).normalize(),
  turbulence: 0.7
};

const aircraft = {
  group: new THREE.Group(),
  parts: {},
  damageMarks: new THREE.Group(),
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  angular: new THREE.Vector3(),
  controls: { pitch: 0, roll: 0, yaw: 0 },
  throttle: 0.76,
  flaps: 0.18,
  flapsTarget: 0.18,
  gear: 1,
  gearTarget: 1,
  brakes: 0,
  trim: 0.035,
  alive: true,
  contactRecorded: false,
  lastContact: 0,
  mass: 79000,
  wingArea: 127,
  maxThrust: 242000,
  wingSpan: 35.92,
  length: 42.16,
  height: 12.3,
  damage: {
    nose: 0,
    hull: 0,
    leftWing: 0,
    rightWing: 0,
    leftEngine: 0,
    rightEngine: 0,
    tail: 0,
    gear: 0
  }
};

const attempts = loadAttempts();

const ambient = new THREE.HemisphereLight(0xcfe4ff, 0x475033, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(-5200, 6500, 2600);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 100;
sun.shadow.camera.far = 18000;
sun.shadow.camera.left = -8000;
sun.shadow.camera.right = 8000;
sun.shadow.camera.top = 8000;
sun.shadow.camera.bottom = -8000;
scene.add(sun);

init();

function init() {
  createSky();
  createTerrain();
  createRiver();
  createRunway();
  createWaterfalls();
  createForest();
  createAircraft();
  createWeatherSystems();
  attempts.forEach(createAttemptMarker);
  resetAircraft(true);
  applyTime('golden');
  applyWeather('clear');
  bindInput();
  updateAttemptPanel();
  updateDamageUi();
  renderer.setAnimationLoop(animate);
}

function ensureHudAdditions() {
  const style = document.createElement('style');
  style.textContent = `
    .damage-vignette {
      --damage-alpha: 0;
      position: fixed;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      opacity: 0;
      background:
        radial-gradient(ellipse at center, transparent 45%, rgba(255, 28, 40, var(--damage-alpha)) 100%),
        linear-gradient(90deg, rgba(255, 56, 48, calc(var(--damage-alpha) * 0.55)), transparent 18%, transparent 82%, rgba(255, 56, 48, calc(var(--damage-alpha) * 0.55))),
        linear-gradient(0deg, rgba(255, 56, 48, calc(var(--damage-alpha) * 0.44)), transparent 18%, transparent 82%, rgba(255, 56, 48, calc(var(--damage-alpha) * 0.44)));
      mix-blend-mode: screen;
      transition: opacity 220ms ease;
    }
    .damage-vignette.active {
      opacity: 1;
      animation: damagePulse 1.25s ease-in-out infinite;
    }
    .damage-model {
      right: 20px;
      top: 362px;
      width: min(274px, calc(100vw - 40px));
      padding: 14px;
      opacity: 0;
      transform: translateY(8px);
      visibility: hidden;
      transition: opacity 220ms ease, transform 220ms ease, visibility 220ms ease;
    }
    .damage-model.active {
      opacity: 1;
      transform: translateY(0);
      visibility: visible;
    }
    .damage-model h2 {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0;
      text-transform: uppercase;
      color: rgba(255, 202, 210, 0.84);
    }
    .airframe-schematic {
      position: relative;
      height: 148px;
      margin: 4px 0 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: radial-gradient(circle at center, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
      overflow: hidden;
    }
    .damage-part {
      position: absolute;
      display: block;
      border: 1px solid rgba(180, 245, 255, 0.42);
      background: rgba(95, 220, 240, 0.13);
      box-shadow: 0 0 18px rgba(104, 239, 255, 0.08);
      transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
    }
    .damage-part.damaged {
      border-color: rgba(255, 83, 82, 0.96);
      background: rgba(255, 44, 52, 0.42);
      box-shadow: 0 0 18px rgba(255, 50, 55, 0.72), inset 0 0 14px rgba(255, 255, 255, 0.2);
      animation: partWarn 760ms ease-in-out infinite;
    }
    .damage-part.nose { left: 124px; top: 18px; width: 24px; height: 28px; border-radius: 50% 50% 38% 38%; }
    .damage-part.hull { left: 113px; top: 40px; width: 46px; height: 78px; border-radius: 999px; }
    .damage-part.leftWing { left: 28px; top: 72px; width: 91px; height: 16px; transform: rotate(-10deg); border-radius: 5px; }
    .damage-part.rightWing { right: 28px; top: 72px; width: 91px; height: 16px; transform: rotate(10deg); border-radius: 5px; }
    .damage-part.leftEngine { left: 71px; top: 92px; width: 20px; height: 20px; border-radius: 50%; }
    .damage-part.rightEngine { right: 71px; top: 92px; width: 20px; height: 20px; border-radius: 50%; }
    .damage-part.tail { left: 118px; bottom: 18px; width: 36px; height: 22px; border-radius: 4px; }
    .damage-part.gear { left: 120px; top: 92px; width: 32px; height: 12px; border-radius: 999px; }
    .damage-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 5px;
      font-size: 12px;
      color: rgba(255, 226, 229, 0.82);
    }
    .damage-list li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      min-height: 18px;
    }
    @keyframes damagePulse {
      0%, 100% { filter: brightness(0.9); }
      50% { filter: brightness(1.24); }
    }
    @keyframes partWarn {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.035); }
    }
    @media (max-width: 760px) {
      .damage-model { display: none; }
    }
  `;
  document.head.appendChild(style);

  const segments = Array.from(document.querySelectorAll('.systems .segment'));
  const weatherSegment = segments.find((segment) => segment.getAttribute('aria-label') === 'Weather');
  if (weatherSegment && !document.querySelector('[data-weather=lightning]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.weather = 'lightning';
    button.textContent = 'Lightning';
    weatherSegment.insertBefore(button, weatherSegment.querySelector('[data-weather=hurricane]'));
  }

  const keyboard = document.querySelector('.keyboard');
  if (keyboard && !keyboard.querySelector('[data-key=lightning]')) {
    const key = document.createElement('span');
    key.className = 'key';
    key.dataset.key = 'lightning';
    key.textContent = 'L';
    keyboard.appendChild(key);
  }

  const hud = document.getElementById('hud');
  if (hud && !document.getElementById('damageVignette')) {
    const vignette = document.createElement('div');
    vignette.id = 'damageVignette';
    vignette.className = 'damage-vignette';
    hud.appendChild(vignette);
  }
  if (hud && !document.getElementById('damageModel')) {
    const panel = document.createElement('div');
    panel.id = 'damageModel';
    panel.className = 'panel damage-model';
    const title = document.createElement('h2');
    title.textContent = 'Airframe Damage';
    const schematic = document.createElement('div');
    schematic.className = 'airframe-schematic';
    Object.keys(damageLabels).forEach((part) => {
      const item = document.createElement('span');
      item.className = `damage-part ${part}`;
      item.dataset.damagePart = part;
      schematic.appendChild(item);
    });
    const list = document.createElement('ul');
    list.id = 'damageList';
    list.className = 'damage-list';
    panel.append(title, schematic, list);
    hud.appendChild(panel);
  }
}

function bindInput() {
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Enter' && !started) launch();
    if (event.code === 'KeyG') aircraft.gearTarget = aircraft.gearTarget > 0.5 ? 0 : 1;
    if (event.code === 'KeyF') aircraft.flapsTarget = Math.min(1, aircraft.flapsTarget + 0.25);
    if (event.code === 'KeyV') aircraft.flapsTarget = Math.max(0, aircraft.flapsTarget - 0.25);
    if (event.code === 'KeyR') resetAircraft(false);
    if (event.code === 'KeyC') cameraMode = (cameraMode + 1) % 4;
    if (event.code === 'KeyM') cycleWeather();
    if (event.code === 'KeyL') applyWeather('lightning');
    if (event.code === 'KeyT') cycleTime();
    if (event.code === 'BracketLeft') aircraft.trim = Math.max(-0.12, aircraft.trim - 0.015);
    if (event.code === 'BracketRight') aircraft.trim = Math.min(0.18, aircraft.trim + 0.015);
    if (event.code === 'Digit1') applyTime('dawn');
    if (event.code === 'Digit2') applyTime('noon');
    if (event.code === 'Digit3') applyTime('golden');
    if (event.code === 'Digit4') applyTime('dusk');
    if (event.code === 'Digit5') applyTime('night');
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  ui.start.addEventListener('click', launch);
  ui.weatherButtons.forEach((button) => button.addEventListener('click', () => applyWeather(button.dataset.weather)));
  ui.timeButtons.forEach((button) => button.addEventListener('click', () => applyTime(button.dataset.time)));
  ui.quality.addEventListener('click', () => {
    settings.quality = settings.quality === 'cinematic' ? 'balanced' : 'cinematic';
    ui.quality.textContent = settings.quality === 'cinematic' ? 'Cinematic' : 'Balanced';
    rebuildForestForQuality();
  });
}

function launch() {
  started = true;
  ui.launch.classList.add('hidden');
  ui.hud.classList.add('active');
  ui.message.textContent = 'Airframe live. Arrow keys now pitch and roll with fly-by-wire assist.';
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(now) {
  const dt = Math.min(clock.getDelta(), 0.045);
  frameAverage = frameAverage * 0.92 + (now - lastFrameTime) * 0.08;
  lastFrameTime = now;

  updateWater(now * 0.001);
  updateWeather(dt, now * 0.001);
  updateLightning(dt);
  updateFires(now * 0.001);
  if (started) updateAircraft(dt, now * 0.001);
  else idleCamera(now * 0.001);
  updateCamera(dt);

  renderer.render(scene, camera);
  if (now - lastHud > 90) {
    updateHud();
    lastHud = now;
  }
}

function createSky() {
  const uniforms = {
    topColor: { value: new THREE.Color(timeModes.golden.skyA) },
    bottomColor: { value: new THREE.Color(timeModes.golden.skyB) },
    offset: { value: 1200 },
    exponent: { value: 0.72 }
  };
  const skyGeo = new THREE.SphereGeometry(50000, 32, 15);
  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 vWorldPosition; void main(){ vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }'
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'physical sky gradient';
  scene.add(sky);
  scene.userData.sky = sky;
}

function createTerrain() {
  const segX = 230;
  const segZ = 140;
  const geometry = new THREE.PlaneGeometry(WORLD.width, WORLD.depth, segX, segZ);
  const pos = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i);
    const y = terrainHeight(x, z);
    pos.setZ(i, y);
    const c = terrainColor(x, z, y);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: false
  });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.name = 'Yosemite procedural DEM terrain';
  scene.add(terrain);
}

function terrainHeight(x, z) {
  const runway = isRunway(x, z);
  const valleyFloor = 1118 + 34 * Math.sin(x / 2400) + 16 * Math.sin((x + z) / 920);
  const valleyWidth = 940 + 180 * Math.sin((x - 1100) / 4300) + 120 * smoothNoise(x * 0.00018, 4.1);
  const side = Math.abs(z) / Math.max(620, valleyWidth);
  const walls = smoothstep(0.56, 2.2, side) * 860 + smoothstep(1.55, 4.3, side) * 740;
  const ribbing = 110 * fbm(x * 0.00023, z * 0.00023) + 58 * Math.sin((x + Math.abs(z) * 1.4) / 680);
  const elCap = 520 * gaussian(x, z, -6200, 1420, 1350, 1100);
  const halfDome = 840 * gaussian(x, z, 6100, -1650, 1240, 920);
  const cathedral = 420 * gaussian(x, z, -5200, -2200, 1500, 1100);
  const highCountry = 310 * smoothstep(2500, 6200, Math.abs(z)) + 210 * smoothstep(5900, 10400, Math.abs(x));
  const riverCut = -48 * gaussian(x, z, 600, riverZ(x), 6200, 120);
  let h = valleyFloor + walls + ribbing + elCap + halfDome + cathedral + highCountry + riverCut;
  if (runway) h = 1128 + 0.0025 * x;
  return Math.max(930, h);
}

function terrainColor(x, z, y) {
  const slope = Math.abs(terrainHeight(x + 22, z) - terrainHeight(x - 22, z)) + Math.abs(terrainHeight(x, z + 22) - terrainHeight(x, z - 22));
  const n = fbm(x * 0.00075, z * 0.00075);
  const forest = forestMask(x, z, y, slope);
  if (isRunway(x, z)) return new THREE.Color(0x2d3433);
  if (Math.abs(z - riverZ(x)) < 52 && y < 1230) return new THREE.Color(0x2b6f83);
  if (y > 2480) return new THREE.Color().setRGB(0.82 + n * 0.08, 0.86 + n * 0.07, 0.84 + n * 0.08);
  if (slope > 105) return new THREE.Color().setRGB(0.48 + n * 0.08, 0.46 + n * 0.07, 0.42 + n * 0.05);
  if (forest > 0.55) return new THREE.Color().setRGB(0.12 + n * 0.08, 0.28 + n * 0.13, 0.16 + n * 0.06);
  if (y < 1235) return new THREE.Color().setRGB(0.36 + n * 0.06, 0.47 + n * 0.08, 0.25 + n * 0.04);
  return new THREE.Color().setRGB(0.43 + n * 0.08, 0.40 + n * 0.06, 0.32 + n * 0.05);
}

function createRiver() {
  const points = [];
  for (let i = 0; i <= 180; i++) {
    const x = -10200 + (20400 * i) / 180;
    const z = riverZ(x);
    points.push(new THREE.Vector3(x, terrainHeight(x, z) + 2.5, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 240, 18, 8, false);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x3e9bb7,
    roughness: 0.18,
    transmission: 0.1,
    transparent: true,
    opacity: 0.72,
    metalness: 0.0
  });
  const river = new THREE.Mesh(geo, mat);
  river.name = 'Merced river corridor';
  scene.add(river);
}

function createRunway() {
  const runwayHeight = terrainHeight(0, 0) + 1.2;
  const runwayGeo = new THREE.BoxGeometry(WORLD.runway.xMax - WORLD.runway.xMin, 1.2, WORLD.runway.zHalf * 2);
  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x232927, roughness: 0.84, metalness: 0.03 });
  const runway = new THREE.Mesh(runwayGeo, runwayMat);
  runway.position.set((WORLD.runway.xMin + WORLD.runway.xMax) / 2, runwayHeight, 0);
  runway.receiveShadow = true;
  scene.add(runway);

  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe9efe5 });
  for (let i = 0; i < 13; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(92, 1.6, 4), stripeMat);
    stripe.position.set(-2100 + i * 350, runwayHeight + 1.05, 0);
    scene.add(stripe);
  }

  const thresholdMat = new THREE.MeshBasicMaterial({ color: 0xf6f8ee });
  [-2380, 2380].forEach((x) => {
    for (let z = -52; z <= 52; z += 17) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(80, 1.6, 7), thresholdMat);
      bar.position.set(x, runwayHeight + 1.08, z);
      scene.add(bar);
    }
  });
}

function createWaterfalls() {
  [
    { name: 'Yosemite Falls', x: -3600, z: 1220, drop: 739, width: 54, tint: 0xcef7ff },
    { name: 'Bridalveil Fall', x: -7600, z: -970, drop: 188, width: 44, tint: 0xdffaff },
    { name: 'Vernal Fall', x: 5150, z: -440, drop: 97, width: 52, tint: 0xbcecff },
    { name: 'Nevada Fall', x: 6750, z: -1020, drop: 181, width: 58, tint: 0xc8f3ff },
    { name: 'Ribbon Fall', x: -5700, z: 1640, drop: 491, width: 32, tint: 0xe7fdff },
    { name: 'Sentinel Fall', x: -900, z: -1330, drop: 585, width: 29, tint: 0xd9f8ff }
  ].forEach(createWaterfall);
}

function createWaterfall(fall) {
  const topY = terrainHeight(fall.x, fall.z) + 26;
  const baseZ = fall.z > 0 ? fall.z - 170 : fall.z + 170;
  const baseY = Math.max(terrainHeight(fall.x, baseZ) + 18, topY - fall.drop);
  const realDrop = Math.max(70, topY - baseY);
  const geo = new THREE.PlaneGeometry(fall.width, realDrop, 9, 48);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(fall.tint) }
    },
    vertexShader: 'varying vec2 vUv; varying float vWave; uniform float uTime; void main(){ vUv = uv; vec3 p = position; float fallLine = 1.0 - uv.y; p.x += sin(uv.y * 28.0 + uTime * 5.0) * 2.2 * fallLine; p.z += cos(uv.y * 17.0 + uTime * 3.0) * 4.2 * fallLine; vWave = fallLine; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'uniform vec3 uTint; uniform float uTime; varying vec2 vUv; varying float vWave; void main(){ float stream = smoothstep(0.02, 0.22, vUv.x) * smoothstep(0.98, 0.78, vUv.x); float streak = 0.55 + 0.45 * sin((vUv.y - uTime * 1.7) * 82.0 + sin(vUv.x * 18.0)); float foam = smoothstep(0.62, 1.0, vWave); float alpha = stream * (0.34 + 0.46 * streak + 0.28 * foam); gl_FragColor = vec4(mix(uTint * 0.65, vec3(1.0), foam * 0.7), alpha); }'
  });
  waterMaterials.push(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(fall.x, (topY + baseY) / 2, fall.z);
  mesh.rotation.y = fall.z > 0 ? Math.PI : 0;
  mesh.name = fall.name;
  scene.add(mesh);

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(fall.width * 1.15, 32),
    new THREE.MeshPhysicalMaterial({ color: 0x8ed8e5, transparent: true, opacity: 0.58, roughness: 0.1, metalness: 0.0 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(fall.x, baseY + 1.5, baseZ);
  scene.add(pool);

  const mistGeo = new THREE.BufferGeometry();
  const count = 180;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = seededRandom(i + fall.x) * fall.width * 1.8;
    const a = seededRandom(i * 7 + fall.z) * Math.PI * 2;
    positions[i * 3] = fall.x + Math.cos(a) * r;
    positions[i * 3 + 1] = baseY + seededRandom(i * 3) * 82;
    positions[i * 3 + 2] = baseZ + Math.sin(a) * r;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: 0xe8fbff, size: 9, transparent: true, opacity: 0.23, depthWrite: false }));
  scene.add(mist);
}

function createForest() {
  const count = settings.quality === 'cinematic' ? WORLD.treeTarget : 112000;
  const coneGeo = new THREE.ConeGeometry(1, 1, 5, 1);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x244c2f, roughness: 0.96, metalness: 0.0 });
  forestMesh = new THREE.InstancedMesh(coneGeo, coneMat, count);
  forestMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  forestMesh.castShadow = settings.quality === 'cinematic';
  forestMesh.receiveShadow = true;
  forestMesh.name = 'classified procedural forest';
  const dummy = new THREE.Object3D();
  let placed = 0;
  let attemptsCount = 0;
  while (placed < count && attemptsCount < count * 12) {
    attemptsCount += 1;
    const x = -WORLD.width / 2 + halton(attemptsCount, 2) * WORLD.width;
    const z = -WORLD.depth / 2 + halton(attemptsCount, 3) * WORLD.depth;
    const y = terrainHeight(x, z);
    const slope = Math.abs(terrainHeight(x + 18, z) - terrainHeight(x - 18, z)) + Math.abs(terrainHeight(x, z + 18) - terrainHeight(x, z - 18));
    const mask = forestMask(x, z, y, slope);
    if (mask < 0.52 || isRunway(x, z) || Math.abs(z - riverZ(x)) < 70) continue;
    const height = 12 + seededRandom(placed * 11.7) * 24;
    const radius = 2.5 + seededRandom(placed * 5.3) * 5.4;
    dummy.position.set(x, y + height * 0.5, z);
    dummy.rotation.y = seededRandom(placed * 3.19) * Math.PI * 2;
    dummy.scale.set(radius, height, radius);
    dummy.updateMatrix();
    forestMesh.setMatrixAt(placed, dummy.matrix);
    const hueShift = seededRandom(placed * 9.2) * 0.12;
    tmp.color.setRGB(0.09 + hueShift, 0.25 + hueShift * 0.75, 0.13 + hueShift * 0.35);
    forestMesh.setColorAt(placed, tmp.color);
    placed += 1;
  }
  forestMesh.count = placed;
  if (forestMesh.instanceColor) forestMesh.instanceColor.needsUpdate = true;
  scene.add(forestMesh);

  if (settings.quality === 'cinematic') {
    const trunkCount = Math.min(42000, placed);
    const trunkGeo = new THREE.CylinderGeometry(0.7, 1.05, 8, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3928, roughness: 0.95 });
    forestShadowMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trunkCount);
    const trunkDummy = new THREE.Object3D();
    for (let i = 0; i < trunkCount; i++) {
      forestMesh.getMatrixAt(i * Math.max(1, Math.floor(placed / trunkCount)), tmp.m1);
      tmp.v1.setFromMatrixPosition(tmp.m1);
      trunkDummy.position.set(tmp.v1.x, terrainHeight(tmp.v1.x, tmp.v1.z) + 4, tmp.v1.z);
      trunkDummy.updateMatrix();
      forestShadowMesh.setMatrixAt(i, trunkDummy.matrix);
    }
    forestShadowMesh.castShadow = true;
    scene.add(forestShadowMesh);
  }
}

function rebuildForestForQuality() {
  if (forestMesh) scene.remove(forestMesh);
  if (forestShadowMesh) scene.remove(forestShadowMesh);
  forestMesh = null;
  forestShadowMesh = null;
  createForest();
  ui.message.textContent = settings.quality === 'cinematic' ? 'Cinematic forest: 266k trees' : 'Balanced forest loaded';
}

function createAircraft() {
  const group = aircraft.group;
  group.clear();
  aircraft.parts = {};
  aircraft.damageMarks = new THREE.Group();
  group.name = '737 MAX 9 scale airframe detailed';

  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xe9eef1, roughness: 0.28, metalness: 0.2, clearcoat: 0.75, clearcoatRoughness: 0.24 });
  const bellyMat = new THREE.MeshPhysicalMaterial({ color: 0xc6d1d9, roughness: 0.36, metalness: 0.18, clearcoat: 0.42 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x142536, roughness: 0.08, metalness: 0.02, transmission: 0.2, transparent: true, opacity: 0.78 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.58, metalness: 0.12 });
  const wingMat = new THREE.MeshPhysicalMaterial({ color: 0xd7dde2, roughness: 0.34, metalness: 0.25, clearcoat: 0.45 });
  const engineMat = new THREE.MeshPhysicalMaterial({ color: 0xcbd3d8, roughness: 0.28, metalness: 0.32, clearcoat: 0.42 });
  const accentMat = new THREE.MeshBasicMaterial({ color: 0x157c91 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.08, 2.26, aircraft.length, 42, 5), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  group.add(fuselage);
  addPart('hull', fuselage);

  const belly = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.25, aircraft.length * 0.7, 36, 1, true, Math.PI * 0.08, Math.PI * 0.84), bellyMat);
  belly.rotation.x = Math.PI / 2;
  belly.rotation.z = Math.PI;
  belly.position.y = -0.42;
  group.add(belly);
  addPart('hull', belly);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.12, 32, 18), bodyMat);
  nose.scale.set(0.92, 0.9, 1.28);
  nose.position.z = -aircraft.length / 2;
  nose.castShadow = true;
  group.add(nose);
  addPart('nose', nose);

  const tailCap = new THREE.Mesh(new THREE.SphereGeometry(1.9, 28, 14), bodyMat);
  tailCap.scale.set(0.7, 0.74, 1.35);
  tailCap.position.z = aircraft.length / 2;
  tailCap.castShadow = true;
  group.add(tailCap);
  addPart('tail', tailCap);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.34, 0.07, aircraft.length * 0.78), accentMat);
  stripe.position.set(0, 0.5, -1.0);
  group.add(stripe);

  createCockpit(group, glassMat, bodyMat);
  createPassengerWindows(group, glassMat);
  createDoors(group, darkMat);
  createWings(group, wingMat, accentMat);
  createTail(group, wingMat, accentMat);
  createEngines(group, engineMat, darkMat);
  createLandingGear(group);
  createNavLights(group, lightMat);

  group.add(aircraft.damageMarks);
  scene.add(group);
}

function addPart(part, mesh) {
  if (!aircraft.parts[part]) aircraft.parts[part] = [];
  aircraft.parts[part].push(mesh);
}

function createCockpit(group, glassMat, bodyMat) {
  const brow = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.34, 0.18), bodyMat);
  brow.position.set(0, 1.42, -20.5);
  brow.rotation.x = -0.24;
  group.add(brow);
  const center = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.62, 0.09), glassMat);
  center.position.set(0, 1.38, -20.72);
  center.rotation.x = -0.32;
  group.add(center);
  [-0.92, 0.92].forEach((x) => {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.56, 0.09), glassMat);
    pane.position.set(x, 1.36, -20.62);
    pane.rotation.x = -0.3;
    pane.rotation.z = -x * 0.1;
    group.add(pane);
  });
}

function createPassengerWindows(group, glassMat) {
  const geo = new THREE.PlaneGeometry(0.42, 0.25);
  for (let side of [-1, 1]) {
    for (let i = 0; i < 28; i++) {
      const z = -16.8 + i * 1.16;
      if (z > -1.6 && z < 0.8) continue;
      const windowMesh = new THREE.Mesh(geo, glassMat);
      windowMesh.position.set(side * 2.13, 0.78, z);
      windowMesh.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(windowMesh);
    }
  }
}

function createDoors(group, darkMat) {
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x273846, transparent: true, opacity: 0.6 });
  [-1, 1].forEach((side) => {
    [-17.8, -3.6, 8.1, 15.4].forEach((z) => {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.35), doorMat);
      door.position.set(side * 2.18, 0.08, z);
      door.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(door);
    });
  });
  const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 1.2), darkMat);
  antenna.position.set(0, 2.25, -5.4);
  group.add(antenna);
}

function createWings(group, wingMat, accentMat) {
  [-1, 1].forEach((side) => {
    const wing = createWingMesh(side, wingMat);
    wing.position.z = 1.0;
    wing.castShadow = true;
    group.add(wing);
    addPart(side < 0 ? 'leftWing' : 'rightWing', wing);

    const flap = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 1.08), accentMat);
    flap.position.set(side * 8.6, -0.58, 4.15);
    flap.rotation.y = side * 0.08;
    group.add(flap);
    addPart(side < 0 ? 'leftWing' : 'rightWing', flap);

    const slat = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.12, 0.34), wingMat);
    slat.position.set(side * 7.6, -0.48, -1.84);
    slat.rotation.y = side * -0.08;
    group.add(slat);
    addPart(side < 0 ? 'leftWing' : 'rightWing', slat);

    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.0, 1.1), wingMat);
    winglet.position.set(side * 17.8, 1.05, 3.45);
    winglet.rotation.z = side * 0.27;
    winglet.rotation.x = -0.1;
    winglet.castShadow = true;
    group.add(winglet);
    addPart(side < 0 ? 'leftWing' : 'rightWing', winglet);
  });
}

function createWingMesh(side, mat) {
  const s = side;
  const geo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0.2 * s, -0.34, -2.85,
    17.96 * s, -0.46, -0.22,
    16.15 * s, -0.5, 4.92,
    0.2 * s, -0.38, 5.35,
    0.2 * s, -0.16, -2.48,
    17.54 * s, -0.28, 0.02,
    15.85 * s, -0.32, 4.62,
    0.2 * s, -0.2, 4.98
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7]);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function createTail(group, wingMat, accentMat) {
  const tailPlane = new THREE.Mesh(new THREE.BoxGeometry(13, 0.26, 3.2), wingMat);
  tailPlane.position.set(0, 1.0, 17.2);
  tailPlane.castShadow = true;
  group.add(tailPlane);
  addPart('tail', tailPlane);

  const elevator = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.12, 0.82), accentMat);
  elevator.position.set(0, 0.85, 18.62);
  group.add(elevator);
  addPart('tail', elevator);

  const verticalTail = new THREE.Mesh(new THREE.BoxGeometry(0.64, 7.8, 5.8), wingMat);
  verticalTail.position.set(0, 4.2, 16.3);
  verticalTail.rotation.x = -0.18;
  verticalTail.castShadow = true;
  group.add(verticalTail);
  addPart('tail', verticalTail);

  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.68, 5.2, 0.5), accentMat);
  rudder.position.set(0, 4.0, 18.72);
  rudder.rotation.x = -0.14;
  group.add(rudder);
  addPart('tail', rudder);
}

function createEngines(group, engineMat, darkMat) {
  [-1, 1].forEach((side) => {
    const part = side < 0 ? 'leftEngine' : 'rightEngine';
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.16, 2.9, 32), engineMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 7.8, -2.05, -1.1);
    engine.castShadow = true;
    group.add(engine);
    addPart(part, engine);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.08, 10, 32), engineMat);
    ring.position.set(side * 7.8, -2.05, -2.58);
    group.add(ring);
    addPart(part, ring);

    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.9, 0.18, 32), darkMat);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(side * 7.8, -2.05, -2.65);
    group.add(intake);
    addPart(part, intake);

    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.65, 24), darkMat);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.set(side * 7.8, -2.05, -2.82);
    group.add(spinner);
    addPart(part, spinner);

    for (let i = 0; i < 10; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.025), darkMat);
      blade.position.set(side * 7.8, -2.05, -2.9);
      blade.rotation.z = (i / 10) * Math.PI * 2;
      group.add(blade);
      addPart(part, blade);
    }
  });
}

function createNavLights(group, lightMat) {
  const red = new THREE.MeshBasicMaterial({ color: 0xff3145 });
  const green = new THREE.MeshBasicMaterial({ color: 0x44ff97 });
  const beacon = new THREE.MeshBasicMaterial({ color: 0xffe5b0 });
  const left = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), red);
  left.position.set(-18.08, -0.22, 3.15);
  group.add(left);
  const right = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), green);
  right.position.set(18.08, -0.22, 3.15);
  group.add(right);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), lightMat);
  tail.position.set(0, 1.45, 20.5);
  group.add(tail);
  const topBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), beacon);
  topBeacon.position.set(0, 2.38, 1.4);
  group.add(topBeacon);
}

function createLandingGear(group) {
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x23282b, roughness: 0.52, metalness: 0.55 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.88 });
  const wheelGeo = new THREE.TorusGeometry(0.62, 0.18, 10, 18);
  const strutGeo = new THREE.CylinderGeometry(0.11, 0.13, 3.4, 10);
  const doorGeo = new THREE.BoxGeometry(0.08, 1.2, 0.7);
  const gear = new THREE.Group();
  gear.name = 'animated landing gear';
  const specs = [
    { name: 'nose', x: 0, z: -13.6, y: -3.0, wheels: [0] },
    { name: 'left-main', x: -3.9, z: 2.2, y: -3.1, wheels: [-0.42, 0.42] },
    { name: 'right-main', x: 3.9, z: 2.2, y: -3.1, wheels: [-0.42, 0.42] }
  ];
  specs.forEach((spec) => {
    const leg = new THREE.Group();
    leg.userData.baseY = spec.y;
    leg.userData.z = spec.z;
    const strut = new THREE.Mesh(strutGeo, gearMat);
    strut.position.y = 1.2;
    strut.castShadow = true;
    leg.add(strut);
    const doorL = new THREE.Mesh(doorGeo, gearMat);
    doorL.position.set(-0.46, 1.05, 0.1);
    leg.add(doorL);
    const doorR = doorL.clone();
    doorR.position.x = 0.46;
    leg.add(doorR);
    spec.wheels.forEach((offset) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(offset, -0.68, 0);
      wheel.castShadow = true;
      leg.add(wheel);
    });
    leg.position.set(spec.x, spec.y, spec.z);
    gear.add(leg);
  });
  group.add(gear);
  aircraft.gearGroup = gear;
  addPart('gear', gear);
}

function createWeatherSystems() {
  const precipGeo = new THREE.BufferGeometry();
  const count = 7600;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (seededRandom(i * 1.7) - 0.5) * 5200;
    positions[i * 3 + 1] = seededRandom(i * 3.1) * 2200 + 800;
    positions[i * 3 + 2] = (seededRandom(i * 4.6) - 0.5) * 5200;
    seeds[i] = seededRandom(i * 8.9);
  }
  precipGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  precipGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  precipitation = new THREE.Points(precipGeo, new THREE.PointsMaterial({ color: 0xeaf7ff, size: 6, transparent: true, opacity: 0.0, depthWrite: false }));
  precipitation.frustumCulled = false;
  scene.add(precipitation);

  aurora = new THREE.Group();
  const auroraMat = new THREE.MeshBasicMaterial({ color: 0x5fffc7, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 7; i++) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(5800, 780, 48, 1), auroraMat.clone());
    strip.position.set(-3400 + i * 1150, 5200 + i * 35, -7800 - i * 160);
    strip.rotation.x = -0.58;
    strip.rotation.z = Math.sin(i) * 0.15;
    aurora.add(strip);
  }
  scene.add(aurora);

  hurricaneBands = new THREE.Group();
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xd8e6ef, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1200 + i * 420, 4, 6, 128, Math.PI * 1.45), bandMat.clone());
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = i * 0.5;
    ring.position.y = 2700 + i * 44;
    hurricaneBands.add(ring);
  }
  scene.add(hurricaneBands);

  lightningGroup = new THREE.Group();
  scene.add(lightningGroup);
  lightningLight = new THREE.PointLight(0x9fd6ff, 0, 6400, 1.4);
  scene.add(lightningLight);
}

function updateWater(t) {
  waterMaterials.forEach((mat) => { mat.uniforms.uTime.value = t; });
}

function updateWeather(dt, t) {
  const mode = weatherModes[settings.weather];
  if (precipitation) {
    precipitation.material.opacity = mode.density > 0 ? (mode.rain ? 0.34 : 0.52) : 0;
    precipitation.material.size = mode.rain ? 5 : 8;
    precipitation.material.color.set(mode.rain ? 0xc8d9e8 : 0xffffff);
    const pos = precipitation.geometry.attributes.position;
    const fallRate = mode.rain ? 1480 : 260;
    const wind = currentWind(t);
    for (let i = 0; i < pos.count; i++) {
      if (i > mode.density) {
        pos.setY(i, -10000);
        continue;
      }
      let x = pos.getX(i) + wind.x * dt * 2.2;
      let y = pos.getY(i) - fallRate * dt * (0.55 + seededRandom(i));
      let z = pos.getZ(i) + wind.z * dt * 2.2;
      const anchor = aircraft.pos.lengthSq() > 1 ? aircraft.pos : tmp.v1.set(0, 1400, 0);
      if (y < anchor.y - 260 || Math.abs(x - anchor.x) > 2700 || Math.abs(z - anchor.z) > 2700) {
        x = anchor.x + (seededRandom(i * 17 + t) - 0.5) * 5200;
        y = anchor.y + 900 + seededRandom(i * 13) * 1350;
        z = anchor.z + (seededRandom(i * 19 + t) - 0.5) * 5200;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  if (aurora) {
    aurora.children.forEach((strip, i) => {
      strip.material.opacity = settings.weather === 'aurora' || settings.time === 'night' ? 0.18 + Math.sin(t * 1.3 + i) * 0.05 : 0;
      strip.position.y = 5200 + Math.sin(t * 0.7 + i) * 160;
      strip.scale.y = 1 + Math.sin(t * 1.1 + i * 0.8) * 0.18;
    });
  }

  if (hurricaneBands) {
    hurricaneBands.children.forEach((ring, i) => {
      ring.material.opacity = settings.weather === 'hurricane' ? 0.09 + i * 0.006 : 0;
      ring.position.x = aircraft.pos.x;
      ring.position.z = aircraft.pos.z;
      ring.rotation.z += dt * (0.08 + i * 0.013);
    });
  }

  if (mode.lightning) {
    lightningTimer -= dt;
    if (lightningTimer <= 0) triggerLightning(t);
  } else {
    lightningTimer = Math.max(lightningTimer, 2.8);
  }
}

function updateLightning(dt) {
  lightningFlash = Math.max(0, lightningFlash - dt * 2.6);
  if (lightningLight) lightningLight.intensity = lightningFlash * 11;
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const bolt = lightningBolts[i];
    bolt.life -= dt;
    bolt.line.material.opacity = Math.max(0, bolt.life * 4.6);
    if (bolt.life <= 0) {
      lightningGroup.remove(bolt.line);
      bolt.line.geometry.dispose();
      bolt.line.material.dispose();
      lightningBolts.splice(i, 1);
    }
  }
}

function triggerLightning(t) {
  const mode = weatherModes[settings.weather];
  const hitChance = settings.weather === 'lightning' ? 0.72 : settings.weather === 'hurricane' ? 0.24 : 0.34;
  const hitPlane = started && aircraft.alive && seededRandom(t * 19.73 + aircraft.pos.x) < hitChance;
  const target = hitPlane ? aircraft.pos.clone() : new THREE.Vector3(
    aircraft.pos.x + (seededRandom(t * 2.1) - 0.5) * 3600,
    terrainHeight(aircraft.pos.x, aircraft.pos.z) + 60,
    aircraft.pos.z + (seededRandom(t * 3.4) - 0.5) * 3600
  );
  const start = target.clone().add(new THREE.Vector3((seededRandom(t) - 0.5) * 900, 2600 + seededRandom(t + 4) * 2200, (seededRandom(t + 8) - 0.5) * 900));
  createLightningBolt(start, target, hitPlane);
  lightningFlash = 1;
  lightningLight.position.copy(target);
  ui.message.textContent = hitPlane ? 'Lightning strike. Airframe damage registered.' : `${mode.label} discharge nearby.`;
  if (hitPlane) {
    const parts = ['leftWing', 'rightWing', 'leftEngine', 'rightEngine', 'tail', 'gear', 'hull'];
    const part = parts[Math.floor(seededRandom(t * 11.3) * parts.length)];
    applyDamage(part, 0.32 + seededRandom(t * 7.1) * 0.48, 'lightning strike');
    if (seededRandom(t * 5.9) > 0.62) applyDamage('hull', 0.16 + seededRandom(t * 2.7) * 0.18, 'electrical surge');
  }
  lightningTimer = settings.weather === 'lightning' ? 2.5 + seededRandom(t * 5) * 4.2 : 4.6 + seededRandom(t * 5) * 6.2;
}

function createLightningBolt(start, end, hitPlane) {
  const points = [];
  const segments = 13;
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const p = start.clone().lerp(end, f);
    const jitter = (1 - Math.abs(f - 0.5) * 1.6) * (hitPlane ? 80 : 160);
    p.x += (seededRandom(i * 8.1 + end.x) - 0.5) * jitter;
    p.z += (seededRandom(i * 12.2 + end.z) - 0.5) * jitter;
    points.push(p);
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: hitPlane ? 0xd9fbff : 0x9fd6ff, transparent: true, opacity: 1, linewidth: 2 });
  const line = new THREE.Line(geometry, material);
  lightningGroup.add(line);
  lightningBolts.push({ line, life: 0.26 });
}

function updateAircraft(dt, t) {
  if (!aircraft.alive) {
    updateAircraftModel(t, 0, 0, 0);
    return;
  }

  readControls(dt);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quat).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quat).normalize();
  const wind = currentWind(t, aircraft.pos);
  const airVel = tmp.v1.copy(aircraft.vel).sub(wind);
  const airspeed = Math.max(0.1, airVel.length());
  const horizontal = Math.max(1, Math.sqrt(aircraft.vel.x * aircraft.vel.x + aircraft.vel.z * aircraft.vel.z));
  const flightPath = Math.atan2(aircraft.vel.y, horizontal);
  const pitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
  const roll = Math.atan2(right.y, up.y);
  const alpha = THREE.MathUtils.clamp(pitch - flightPath + aircraft.flaps * 0.08 + aircraft.trim, -0.28, 0.36);
  const damage = damageTotal();
  const leftWingDamage = aircraft.damage.leftWing;
  const rightWingDamage = aircraft.damage.rightWing;
  const tailHealth = 1 - Math.min(0.72, aircraft.damage.tail * 0.68);
  const leftEngineHealth = 1 - Math.min(0.82, aircraft.damage.leftEngine * 0.72);
  const rightEngineHealth = 1 - Math.min(0.82, aircraft.damage.rightEngine * 0.72);
  const gearDrag = aircraft.gear * (0.018 + aircraft.damage.gear * 0.025);
  const rho = densityAtAltitude(Math.max(0, aircraft.pos.y - 1100));
  const q = 0.5 * rho * airspeed * airspeed;
  const stall = smoothstep(0.28, 0.42, Math.abs(alpha)) * smoothstep(66, 42, airspeed);
  const liftHealth = 1 - Math.min(0.52, leftWingDamage * 0.22 + rightWingDamage * 0.22 + aircraft.damage.hull * 0.08 + aircraft.damage.tail * 0.1);
  const cl = THREE.MathUtils.clamp(0.42 + 4.2 * alpha + 0.72 * aircraft.flaps, -0.55, 1.9) * liftHealth;
  const cd = 0.024 + 0.039 * cl * cl + gearDrag + aircraft.flaps * 0.026 + aircraft.damage.hull * 0.05 + stall * 0.16;
  const liftMag = q * aircraft.wingArea * cl * (1 - stall * 0.38);
  const dragMag = q * aircraft.wingArea * cd;
  const thrustLeft = aircraft.throttle * aircraft.maxThrust * 0.5 * leftEngineHealth;
  const thrustRight = aircraft.throttle * aircraft.maxThrust * 0.5 * rightEngineHealth;
  const thrustMag = (thrustLeft + thrustRight) * (1 - Math.min(0.2, Math.max(0, aircraft.pos.y - 1300) / 17000));

  const liftDir = tmp.v2.copy(up).addScaledVector(right, -right.dot(airVel) / Math.max(airspeed, 1) * 0.12).normalize();
  const dragDir = tmp.v3.copy(airVel).multiplyScalar(-1).normalize();
  const force = new THREE.Vector3(0, -aircraft.mass * 9.80665, 0);
  force.addScaledVector(forward, thrustMag);
  force.addScaledVector(liftDir, liftMag);
  force.addScaledVector(dragDir, dragMag);
  force.y -= aircraft.mass * 1.85 * Math.max(0, damage - 0.35);

  if (aircraft.brakes > 0 && isRunway(aircraft.pos.x, aircraft.pos.z) && onGround()) {
    force.addScaledVector(forward, -aircraft.brakes * 220000 * Math.sign(Math.max(0.1, aircraft.vel.dot(forward))));
  }

  const accel = force.multiplyScalar(1 / aircraft.mass);
  aircraft.vel.addScaledVector(accel, dt);
  aircraft.pos.addScaledVector(aircraft.vel, dt);

  const authority = THREE.MathUtils.clamp((airspeed - 42) / 118, 0.35, 1.45);
  const pitchInput = aircraft.controls.pitch;
  const rollInput = aircraft.controls.roll;
  const yawInput = aircraft.controls.yaw;
  aircraft.angular.x += pitchInput * dt * 1.24 * authority * tailHealth;
  aircraft.angular.z += -rollInput * dt * 1.36 * authority * (1 - Math.min(0.55, (leftWingDamage + rightWingDamage) * 0.24));
  aircraft.angular.y += -yawInput * dt * 0.62 * authority * tailHealth;

  const asymEngine = (thrustLeft - thrustRight) / Math.max(aircraft.maxThrust, 1);
  const asymWing = (rightWingDamage - leftWingDamage) * 0.42;
  aircraft.angular.y += asymEngine * dt * 0.46;
  aircraft.angular.z += (asymWing - asymEngine * 0.28) * dt * (0.85 + airspeed / 180);

  if (Math.abs(rollInput) < 0.04) aircraft.angular.z += -roll * dt * 0.52;
  if (Math.abs(pitchInput) < 0.04) aircraft.angular.x += (0.035 - pitch) * dt * 0.33 * tailHealth;
  aircraft.angular.x += -aircraft.angular.x * dt * 0.86;
  aircraft.angular.y += -aircraft.angular.y * dt * 0.72;
  aircraft.angular.z += -aircraft.angular.z * dt * 0.82;
  if (stall > 0.18) {
    aircraft.angular.z += Math.sin(t * 7.1) * stall * dt * 0.55;
    aircraft.angular.x -= stall * dt * 0.3;
  }

  const deltaQ = tmp.q1.setFromEuler(tmp.e1.set(aircraft.angular.x * dt, aircraft.angular.y * dt, aircraft.angular.z * dt, 'XYZ'));
  aircraft.quat.multiply(deltaQ).normalize();
  aircraft.flaps += (aircraft.flapsTarget - aircraft.flaps) * Math.min(1, dt * 1.5);
  aircraft.gear += (aircraft.gearTarget - aircraft.gear) * Math.min(1, dt * 0.75);
  updateAircraftModel(t, pitchInput, rollInput, yawInput);
  updateSmoke(dt, t, forward);
  handleGroundContact(airspeed, forward, roll);
  aircraft.group.position.copy(aircraft.pos);
  aircraft.group.quaternion.copy(aircraft.quat);
  aircraft.group.visible = aircraft.alive;
}

function readControls(dt) {
  if (keys.has('KeyW')) aircraft.throttle += dt * 0.34;
  if (keys.has('KeyS')) aircraft.throttle -= dt * 0.38;
  aircraft.throttle = THREE.MathUtils.clamp(aircraft.throttle, 0, 1);
  aircraft.controls.pitch = smoothControl(aircraft.controls.pitch, keyAxis('ArrowUp', 'ArrowDown'), dt, 5.8);
  aircraft.controls.roll = smoothControl(aircraft.controls.roll, keyAxis('ArrowRight', 'ArrowLeft'), dt, 6.4);
  aircraft.controls.yaw = smoothControl(aircraft.controls.yaw, keyAxis('KeyD', 'KeyA'), dt, 5.2);
  aircraft.brakes = keys.has('KeyB') || keys.has('Space') ? 1 : 0;
}

function smoothControl(current, target, dt, speed) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * dt));
}

function handleGroundContact(airspeed, forward, roll) {
  const ground = terrainHeight(aircraft.pos.x, aircraft.pos.z);
  const clearance = aircraft.gear > 0.75 ? 5.65 : 2.8;
  if (aircraft.pos.y > ground + clearance || !aircraft.alive) return;

  aircraft.pos.y = ground + clearance;
  const sink = aircraft.vel.y;
  const runway = isRunway(aircraft.pos.x, aircraft.pos.z);
  const aligned = Math.abs(forward.z) < 0.56 && forward.x > 0.18;
  const safeLanding = runway && aircraft.gear > 0.66 && sink > -8.8 && airspeed < 116 && Math.abs(roll) < 0.82 && aligned;

  if (safeLanding) {
    aircraft.vel.y = Math.max(0, -sink * 0.04);
    aircraft.vel.multiplyScalar(0.992 - aircraft.brakes * 0.22);
    aircraft.angular.multiplyScalar(0.78);
    if (!aircraft.contactRecorded) {
      recordAttempt('landing', airspeed, 'controlled touchdown');
      ui.message.textContent = 'Landing stored. Brake or press R for another airframe.';
      aircraft.contactRecorded = true;
    }
    return;
  }

  const scrapeOnly = runway && aircraft.gear > 0.45 && sink > -5.5 && airspeed < 132;
  if (scrapeOnly) {
    applyDamage('gear', 0.32, 'hard runway scrape');
    aircraft.vel.y = Math.max(0, -sink * 0.08);
    aircraft.vel.multiplyScalar(0.96);
    return;
  }

  recordAttempt('crash', airspeed, runway ? 'unstable runway impact' : 'terrain impact');
  applyDamage('hull', 0.9, 'impact');
  applyDamage('gear', 0.7, 'impact');
  aircraft.alive = false;
  aircraft.group.visible = false;
  ui.message.textContent = 'Impact recorded. Fire remains. Press R for another airframe.';
}

function updateAircraftModel(t, pitchInput, rollInput, yawInput) {
  if (aircraft.gearGroup) {
    aircraft.gearGroup.children.forEach((leg) => {
      const extension = aircraft.gear;
      leg.visible = extension > 0.03;
      leg.position.y = leg.userData.baseY + (1 - extension) * 3.2;
      leg.rotation.x = (1 - extension) * -1.18;
      leg.children.forEach((child) => {
        if (child.geometry && child.geometry.type === 'TorusGeometry') child.rotation.z -= aircraft.vel.length() * 0.018;
      });
    });
  }

  setPartHeat('leftWing', aircraft.damage.leftWing);
  setPartHeat('rightWing', aircraft.damage.rightWing);
  setPartHeat('leftEngine', aircraft.damage.leftEngine);
  setPartHeat('rightEngine', aircraft.damage.rightEngine);
  setPartHeat('tail', aircraft.damage.tail);
  setPartHeat('hull', aircraft.damage.hull);
  setPartHeat('gear', aircraft.damage.gear);

  const beacon = aircraft.group.children.find((child) => child.isMesh && child.material && child.material.color && child.material.color.getHex() === 0xffe5b0);
  if (beacon) beacon.scale.setScalar(1 + Math.sin(t * 6) * 0.2);
}

function setPartHeat(part, amount) {
  const meshes = aircraft.parts[part] || [];
  meshes.forEach((mesh) => {
    if (!mesh.material || !mesh.material.emissive) return;
    mesh.material.emissive.setRGB(amount * 0.55, amount * 0.05, amount * 0.04);
    mesh.material.emissiveIntensity = amount > 0.05 ? 0.42 : 0;
  });
}

function updateSmoke(dt, t, forward) {
  const total = damageTotal();
  if (total < 0.35 || !aircraft.alive) return;
  smokeClock -= dt;
  if (smokeClock > 0) return;
  smokeClock = 0.11;
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(7 + seededRandom(t) * 7, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x202426, transparent: true, opacity: 0.18, depthWrite: false })
  );
  smoke.position.copy(aircraft.pos).addScaledVector(forward, 22).add(new THREE.Vector3((seededRandom(t + 1) - 0.5) * 12, -3 + seededRandom(t + 3) * 8, (seededRandom(t + 2) - 0.5) * 12));
  smoke.userData.birth = performance.now();
  smoke.userData.phase = seededRandom(t * 2) * Math.PI * 2;
  fireGroups.push(smoke);
  scene.add(smoke);
}

function updateCamera(dt) {
  if (!started) return;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quat).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quat).normalize();
  const target = tmp.v1.copy(aircraft.pos).addScaledVector(forward, 34).addScaledVector(up, 5);
  const desired = tmp.v2.copy(aircraft.pos);
  if (cameraMode === 0) desired.addScaledVector(forward, -118).addScaledVector(up, 35);
  if (cameraMode === 1) desired.addScaledVector(forward, 11).addScaledVector(up, 7);
  if (cameraMode === 2) desired.addScaledVector(right, 98).addScaledVector(up, 39).addScaledVector(forward, -44);
  if (cameraMode === 3) desired.set(aircraft.pos.x, aircraft.pos.y + 820, aircraft.pos.z + 18);
  camera.position.lerp(desired, 1 - Math.pow(0.025, dt));
  camera.lookAt(target);
}

function idleCamera(t) {
  const radius = 6500;
  camera.position.set(Math.sin(t * 0.08) * radius - 1600, 2600 + Math.sin(t * 0.11) * 260, Math.cos(t * 0.08) * radius);
  camera.lookAt(1200, 1380, 0);
}

function resetAircraft(first) {
  aircraft.pos.set(-7350, terrainHeight(-7350, 0) + 980, 0);
  aircraft.quat.setFromEuler(new THREE.Euler(0.055, -Math.PI / 2, 0, 'XYZ'));
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat);
  aircraft.vel.copy(forward.multiplyScalar(142));
  aircraft.vel.y = -0.7;
  aircraft.angular.set(0, 0, 0);
  aircraft.controls.pitch = 0;
  aircraft.controls.roll = 0;
  aircraft.controls.yaw = 0;
  aircraft.throttle = 0.76;
  aircraft.flaps = 0.18;
  aircraft.flapsTarget = 0.18;
  aircraft.gear = 1;
  aircraft.gearTarget = 1;
  aircraft.brakes = 0;
  aircraft.trim = 0.035;
  aircraft.alive = true;
  aircraft.contactRecorded = false;
  Object.keys(aircraft.damage).forEach((part) => { aircraft.damage[part] = 0; });
  aircraft.damageMarks.clear();
  aircraft.group.visible = true;
  aircraft.group.position.copy(aircraft.pos);
  aircraft.group.quaternion.copy(aircraft.quat);
  updateDamageUi();
  if (!first) ui.message.textContent = 'New airframe spawned on a stable approach.';
}

function applyDamage(part, amount, reason) {
  aircraft.damage[part] = THREE.MathUtils.clamp((aircraft.damage[part] || 0) + amount, 0, 1);
  addDamageMark(part, amount);
  updateDamageUi(reason);
}

function addDamageMark(part, amount) {
  const positions = {
    nose: [0, 1.0, -19.5],
    hull: [0, 0.6, -1.0],
    leftWing: [-9.5, -0.25, 3.0],
    rightWing: [9.5, -0.25, 3.0],
    leftEngine: [-7.8, -2.0, -2.2],
    rightEngine: [7.8, -2.0, -2.2],
    tail: [0, 3.6, 17.8],
    gear: [0, -3.0, 1.8]
  };
  const p = positions[part] || [0, 0, 0];
  const mark = new THREE.Mesh(
    new THREE.SphereGeometry(0.45 + amount * 0.7, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3f32, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending })
  );
  mark.position.set(p[0], p[1], p[2]);
  aircraft.damageMarks.add(mark);
}

function damageTotal() {
  return Object.values(aircraft.damage).reduce((sum, value) => sum + value, 0);
}

function updateDamageUi(reason) {
  const damaged = Object.entries(aircraft.damage).filter(([, value]) => value > 0.04);
  const total = damageTotal();
  if (ui.damageVignette) {
    ui.damageVignette.classList.toggle('active', total > 0.04);
    ui.damageVignette.style.setProperty('--damage-alpha', Math.min(0.82, total / 3.6).toFixed(2));
  }
  if (ui.damagePanel) ui.damagePanel.classList.toggle('active', total > 0.04);
  ui.damageParts.forEach((node) => {
    const value = aircraft.damage[node.dataset.damagePart] || 0;
    node.classList.toggle('damaged', value > 0.04);
  });
  if (ui.damageList) {
    if (damaged.length === 0) {
      ui.damageList.innerHTML = '<li><span>all systems</span><strong>green</strong></li>';
    } else {
      ui.damageList.innerHTML = damaged
        .sort((a, b) => b[1] - a[1])
        .map(([part, value]) => `<li><span>${damageLabels[part]}</span><strong>${Math.round(value * 100)}%</strong></li>`)
        .join('');
    }
  }
  if (reason && total > 0.04) ui.message.textContent = `Damage: ${reason}. Lift and control margins reduced.`;
}

function recordAttempt(type, airspeed, note) {
  const item = {
    type,
    note,
    speed: Math.round(airspeed * 1.94384),
    x: Math.round(aircraft.pos.x),
    y: Math.round(terrainHeight(aircraft.pos.x, aircraft.pos.z) + 3),
    z: Math.round(aircraft.pos.z),
    stamp: new Date().toISOString()
  };
  attempts.unshift(item);
  while (attempts.length > 36) attempts.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  createAttemptMarker(item);
  updateAttemptPanel();
}

function createAttemptMarker(item) {
  if (item.type === 'landing') {
    const mat = new THREE.MeshBasicMaterial({ color: 0x9dffcb, transparent: true, opacity: 0.75 });
    const marker = new THREE.Mesh(new THREE.RingGeometry(30, 46, 32), mat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(item.x, terrainHeight(item.x, item.z) + 3.2, item.z);
    scene.add(marker);
    const trail = new THREE.Mesh(new THREE.BoxGeometry(260, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xc8ffdf, transparent: true, opacity: 0.42 }));
    trail.position.set(item.x - 80, terrainHeight(item.x, item.z) + 2.6, item.z);
    scene.add(trail);
    return;
  }

  const fire = new THREE.Group();
  fire.position.set(item.x, terrainHeight(item.x, item.z) + 2, item.z);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a19, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffdd72, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(8 + i * 1.6, 42 + seededRandom(i) * 48, 7), i % 3 === 0 ? coreMat : flameMat);
    flame.position.set((seededRandom(i * 11) - 0.5) * 54, 16 + seededRandom(i * 9) * 28, (seededRandom(i * 17) - 0.5) * 54);
    flame.rotation.z = (seededRandom(i * 4) - 0.5) * 0.5;
    flame.userData.phase = seededRandom(i * 5) * Math.PI * 2;
    fire.add(flame);
  }
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x1b1d1d, transparent: true, opacity: 0.18, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(22 + i * 4, 10, 8), smokeMat.clone());
    smoke.position.set((seededRandom(i * 13) - 0.5) * 70, 60 + i * 26, (seededRandom(i * 23) - 0.5) * 70);
    smoke.userData.phase = seededRandom(i * 29) * Math.PI * 2;
    fire.add(smoke);
  }
  const light = new THREE.PointLight(0xff6418, 1.3, 460, 2);
  light.position.y = 42;
  fire.add(light);
  fireGroups.push(fire);
  scene.add(fire);
}

function updateFires(t) {
  for (let i = fireGroups.length - 1; i >= 0; i--) {
    const item = fireGroups[i];
    if (item.isMesh && item.userData.birth) {
      const age = (performance.now() - item.userData.birth) / 1000;
      item.position.y += 3.4 * 0.016;
      item.scale.setScalar(1 + age * 0.5);
      item.material.opacity = Math.max(0, 0.18 - age * 0.035);
      if (age > 5) {
        scene.remove(item);
        fireGroups.splice(i, 1);
      }
      continue;
    }
    item.children.forEach((child, childIndex) => {
      if (child.isMesh) {
        const pulse = 1 + Math.sin(t * (4.8 + childIndex * 0.2) + child.userData.phase) * 0.16;
        child.scale.setScalar(pulse);
        if (child.geometry.type === 'SphereGeometry') {
          child.position.x += Math.sin(t * 0.4 + childIndex) * 0.015;
          child.material.opacity = 0.11 + Math.sin(t * 0.9 + childIndex) * 0.035;
        }
      }
      if (child.isPointLight) child.intensity = 1 + Math.sin(t * 8 + i) * 0.35;
    });
  }
}

function applyWeather(name) {
  if (!weatherModes[name]) return;
  settings.weather = name;
  const mode = weatherModes[name];
  scene.fog.color.set(mode.color);
  scene.fog.density = name === 'hurricane' ? 0.00018 : name === 'storm' || name === 'lightning' ? 0.00013 : name === 'aurora' ? 0.00006 : 0.000052;
  ui.weatherButtons.forEach((button) => button.classList.toggle('active', button.dataset.weather === name));
  lightningTimer = name === 'lightning' ? 1.5 : lightningTimer;
  ui.message.textContent = mode.label + ' weather loaded';
}

function applyTime(name) {
  if (!timeModes[name]) return;
  settings.time = name;
  const mode = timeModes[name];
  const sky = scene.userData.sky;
  sky.material.uniforms.topColor.value.set(mode.skyA);
  sky.material.uniforms.bottomColor.value.set(mode.skyB);
  sun.color.set(mode.sun);
  sun.intensity = mode.intensity;
  ambient.intensity = name === 'night' ? 0.2 : 0.55;
  renderer.toneMappingExposure = mode.exposure;
  ui.timeButtons.forEach((button) => button.classList.toggle('active', button.dataset.time === name));
}

function cycleWeather() {
  const names = Object.keys(weatherModes);
  applyWeather(names[(names.indexOf(settings.weather) + 1) % names.length]);
}

function cycleTime() {
  const names = Object.keys(timeModes);
  applyTime(names[(names.indexOf(settings.time) + 1) % names.length]);
}

function updateHud() {
  const ground = terrainHeight(aircraft.pos.x, aircraft.pos.z);
  const wind = currentWind(performance.now() * 0.001);
  const airspeed = Math.max(0, aircraft.vel.clone().sub(wind).length() * 1.94384);
  ui.airspeed.textContent = Math.round(airspeed).toString();
  ui.altitude.textContent = Math.round((aircraft.pos.y - ground) * 3.28084).toString();
  ui.vsi.textContent = Math.round(aircraft.vel.y * 196.85).toString();
  ui.throttle.textContent = Math.round(aircraft.throttle * 100) + '%';
  ui.gear.textContent = aircraft.gear > 0.92 ? 'DOWN LOCKED' : aircraft.gear < 0.08 ? 'UP' : Math.round(aircraft.gear * 100) + '%';
  ui.flaps.textContent = Math.round(aircraft.flaps * 40) + ' deg';
  ui.wind.textContent = Math.round(wind.length() * 1.94384) + ' kt';
  ui.weather.textContent = weatherModes[settings.weather].label;
  ui.forest.textContent = (settings.quality === 'cinematic' ? '266,000' : '112,000') + ' / 266,000';
  const damage = Math.round(damageTotal() * 100);
  ui.readout.textContent = `${Math.max(1, Math.round(1000 / frameAverage))} fps | ${cameraModeName()} | trim ${aircraft.trim.toFixed(2)} | damage ${damage}%`;
}

function updateAttemptPanel() {
  if (attempts.length === 0) {
    ui.attempts.innerHTML = '<li>No attempts yet</li>';
    return;
  }
  ui.attempts.innerHTML = attempts.slice(0, 7).map((item, index) => {
    const label = item.type === 'landing' ? 'Landed' : 'Crash fire';
    return `<li><span>${index + 1}. ${label}</span><strong>${item.speed} kt</strong></li>`;
  }).join('');
}

function currentWind(t, position = aircraft.pos) {
  const mode = weatherModes[settings.weather];
  const base = mode.wind;
  const gust = mode.gust * (0.45 + 0.55 * Math.sin(t * 0.37 + position.x * 0.00031));
  const shear = settings.weather === 'hurricane' ? Math.sin(position.y * 0.005 + t * 1.2) * 18 : Math.sin(position.y * 0.003 + t) * mode.gust * 0.14;
  const turbulence = new THREE.Vector3(
    Math.sin(t * 1.7 + position.z * 0.002) * mode.gust * settings.turbulence,
    Math.sin(t * 2.1 + position.x * 0.002) * mode.gust * 0.16,
    Math.cos(t * 1.3 + position.x * 0.0017) * mode.gust * settings.turbulence
  );
  return settings.windDir.clone().multiplyScalar(base + gust + shear).add(turbulence);
}

function densityAtAltitude(metersAboveValley) {
  return 1.225 * Math.exp(-Math.max(0, metersAboveValley) / 8500);
}

function onGround() {
  return aircraft.pos.y <= terrainHeight(aircraft.pos.x, aircraft.pos.z) + 6.2;
}

function keyAxis(positive, negative) {
  return (keys.has(positive) ? 1 : 0) - (keys.has(negative) ? 1 : 0);
}

function isRunway(x, z) {
  return x >= WORLD.runway.xMin && x <= WORLD.runway.xMax && Math.abs(z) <= WORLD.runway.zHalf;
}

function riverZ(x) {
  return Math.sin(x / 1180) * 72 - 165 * smoothstep(2700, 7400, x) + 46 * Math.sin((x + 900) / 530);
}

function forestMask(x, z, y, slope) {
  const valley = smoothstep(650, 1800, Math.abs(z));
  const elev = 1 - smoothstep(2420, 2920, y);
  const steep = 1 - smoothstep(72, 210, slope);
  const patch = fbm(x * 0.0006 + 6.4, z * 0.0006 - 1.7);
  const meadow = 1 - gaussian(x, z, -300, 0, 2100, 360) * 0.85;
  return THREE.MathUtils.clamp((0.32 + patch * 0.72 + valley * 0.22) * elev * steep * meadow, 0, 1);
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian(x, z, cx, cz, sx, sz) {
  const dx = (x - cx) / sx;
  const dz = (z - cz) / sz;
  return Math.exp(-(dx * dx + dz * dz) * 0.5);
}

function seededRandom(n) {
  return fract(Math.sin(n * 12.9898 + 78.233) * 43758.5453123);
}

function fract(x) {
  return x - Math.floor(x);
}

function smoothNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = fract(x);
  const fz = fract(z);
  const a = seededRandom(ix * 9.1 + iz * 3.7);
  const b = seededRandom((ix + 1) * 9.1 + iz * 3.7);
  const c = seededRandom(ix * 9.1 + (iz + 1) * 3.7);
  const d = seededRandom((ix + 1) * 9.1 + (iz + 1) * 3.7);
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uz);
}

function fbm(x, z) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 5; i++) {
    value += smoothNoise(x * freq, z * freq) * amp;
    freq *= 2.07;
    amp *= 0.48;
  }
  return value;
}

function halton(index, base) {
  let result = 0;
  let f = 1 / base;
  let i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

function cameraModeName() {
  return ['chase', 'cockpit', 'wing', 'tower'][cameraMode];
}

function loadAttempts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}
