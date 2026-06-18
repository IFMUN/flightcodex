import * as THREE from 'three';

const WORLD = {
  width: 22000,
  depth: 13000,
  treeTarget: 266000,
  runway: { xMin: -2600, xMax: 2600, zHalf: 78 }
};

const STORAGE_KEY = 'yosemite-flight-attempts-v1';
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
  weatherButtons: Array.from(document.querySelectorAll('[data-weather]')),
  timeButtons: Array.from(document.querySelectorAll('[data-time]')),
  quality: document.getElementById('qualityToggle')
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
let forestMesh = null;
let forestShadowMesh = null;
let precipitation = null;
let aurora = null;
let hurricaneBands = null;
let cameraMode = 0;
let started = false;
let lastHud = 0;
let lastFrameTime = performance.now();
let frameAverage = 16;

const weatherModes = {
  clear: { label: 'Clear', wind: 8, gust: 2, density: 0, snow: false, rain: false, color: 0xb7d5ef },
  snow: { label: 'Snow', wind: 14, gust: 6, density: 3600, snow: true, rain: false, color: 0xdce8f2 },
  aurora: { label: 'Aurora', wind: 10, gust: 4, density: 900, snow: true, rain: false, color: 0x0b1631 },
  storm: { label: 'Storm', wind: 28, gust: 18, density: 4600, snow: false, rain: true, color: 0x647584 },
  hurricane: { label: 'Hurricane', wind: 62, gust: 42, density: 6800, snow: false, rain: true, color: 0x3f5362 }
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

const attempts = loadAttempts();

const aircraft = {
  group: new THREE.Group(),
  marker: new THREE.Group(),
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  angular: new THREE.Vector3(),
  throttle: 0.62,
  flaps: 0.25,
  flapsTarget: 0.25,
  gear: 1,
  gearTarget: 1,
  brakes: 0,
  trim: 0,
  alive: true,
  lastContact: null,
  mass: 79000,
  wingArea: 127,
  maxThrust: 242000,
  wingSpan: 35.92,
  length: 42.16,
  height: 12.3
};

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
  renderer.setAnimationLoop(animate);
}

function bindInput() {
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Enter' && !started) launch();
    if (event.code === 'KeyG') aircraft.gearTarget = aircraft.gearTarget > 0.5 ? 0 : 1;
    if (event.code === 'KeyF') aircraft.flapsTarget = aircraft.flapsTarget >= 1 ? 0 : aircraft.flapsTarget + 0.25;
    if (event.code === 'KeyV') aircraft.flapsTarget = Math.max(0, aircraft.flapsTarget - 0.25);
    if (event.code === 'KeyR') resetAircraft(false);
    if (event.code === 'KeyC') cameraMode = (cameraMode + 1) % 4;
    if (event.code === 'KeyM') cycleWeather();
    if (event.code === 'KeyT') cycleTime();
    if (event.code === 'BracketLeft') aircraft.trim = Math.max(-0.2, aircraft.trim - 0.02);
    if (event.code === 'BracketRight') aircraft.trim = Math.min(0.2, aircraft.trim + 0.02);
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
  ui.message.textContent = 'Airframe live';
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
  if (y > 2480 || (settings.weather === 'snow' && y > 1850)) return new THREE.Color().setRGB(0.82 + n * 0.08, 0.86 + n * 0.07, 0.84 + n * 0.08);
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
  const falls = [
    { name: 'Yosemite Falls', x: -3600, z: 1220, drop: 739, width: 54, tint: 0xcef7ff },
    { name: 'Bridalveil Fall', x: -7600, z: -970, drop: 188, width: 44, tint: 0xdffaff },
    { name: 'Vernal Fall', x: 5150, z: -440, drop: 97, width: 52, tint: 0xbcecff },
    { name: 'Nevada Fall', x: 6750, z: -1020, drop: 181, width: 58, tint: 0xc8f3ff },
    { name: 'Ribbon Fall', x: -5700, z: 1640, drop: 491, width: 32, tint: 0xe7fdff },
    { name: 'Sentinel Fall', x: -900, z: -1330, drop: 585, width: 29, tint: 0xd9f8ff }
  ];
  falls.forEach(createWaterfall);
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
    const r1 = halton(attemptsCount, 2);
    const r2 = halton(attemptsCount, 3);
    const x = -WORLD.width / 2 + r1 * WORLD.width;
    const z = -WORLD.depth / 2 + r2 * WORLD.depth;
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
      trunkDummy.scale.set(1, 1, 1);
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
  group.name = '737 MAX 9 scale airframe';

  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xe9eef1, roughness: 0.34, metalness: 0.18, clearcoat: 0.55, clearcoatRoughness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18212a, roughness: 0.58, metalness: 0.1 });
  const wingMat = new THREE.MeshPhysicalMaterial({ color: 0xd7dde2, roughness: 0.38, metalness: 0.22, clearcoat: 0.35 });
  const engineMat = new THREE.MeshPhysicalMaterial({ color: 0xcbd3d8, roughness: 0.3, metalness: 0.28 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.25, aircraft.length, 28, 1), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.13, 28, 14), bodyMat);
  nose.scale.set(0.92, 0.92, 1.28);
  nose.position.z = -aircraft.length / 2;
  nose.castShadow = true;
  group.add(nose);

  const tailCap = new THREE.Mesh(new THREE.SphereGeometry(1.9, 22, 12), bodyMat);
  tailCap.scale.set(0.7, 0.74, 1.35);
  tailCap.position.z = aircraft.length / 2;
  tailCap.castShadow = true;
  group.add(tailCap);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(aircraft.wingSpan, 0.34, 5.8), wingMat);
  wing.position.set(0, -0.2, 1.1);
  wing.castShadow = true;
  group.add(wing);

  const wingSweepL = new THREE.Mesh(new THREE.BoxGeometry(17, 0.25, 2.5), wingMat);
  wingSweepL.position.set(-10.2, -0.22, 3.3);
  wingSweepL.rotation.y = -0.19;
  group.add(wingSweepL);
  const wingSweepR = wingSweepL.clone();
  wingSweepR.position.x = 10.2;
  wingSweepR.rotation.y = 0.19;
  group.add(wingSweepR);

  const tailPlane = new THREE.Mesh(new THREE.BoxGeometry(13, 0.25, 3.2), wingMat);
  tailPlane.position.set(0, 1.0, 17.2);
  tailPlane.castShadow = true;
  group.add(tailPlane);

  const verticalTail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.8, 5.8), wingMat);
  verticalTail.position.set(0, 4.2, 16.3);
  verticalTail.rotation.x = -0.18;
  verticalTail.castShadow = true;
  group.add(verticalTail);

  [-7.8, 7.8].forEach((x) => {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 2.7, 24), engineMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -2.05, -1.1);
    engine.castShadow = true;
    group.add(engine);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 0.22, 24), darkMat);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(x, -2.05, -2.55);
    group.add(intake);
  });

  const stripeMat = new THREE.MeshBasicMaterial({ color: 0x157c91 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.28, 0.08, aircraft.length * 0.78), stripeMat);
  stripe.position.set(0, 0.52, -1.0);
  group.add(stripe);

  createLandingGear(group);
  scene.add(group);
}

function createLandingGear(group) {
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x23282b, roughness: 0.52, metalness: 0.55 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.88 });
  const wheelGeo = new THREE.TorusGeometry(0.62, 0.18, 10, 18);
  const strutGeo = new THREE.CylinderGeometry(0.11, 0.13, 3.4, 10);
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
    leg.userData.x = spec.x;
    leg.userData.z = spec.z;
    const strut = new THREE.Mesh(strutGeo, gearMat);
    strut.position.y = 1.2;
    strut.castShadow = true;
    leg.add(strut);
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
}

function createWeatherSystems() {
  const precipGeo = new THREE.BufferGeometry();
  const count = 7200;
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
}

function updateAircraft(dt, t) {
  readControls(dt);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quat).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quat).normalize();
  const wind = currentWind(t, aircraft.pos);
  const airVel = tmp.v1.copy(aircraft.vel).sub(wind);
  const airspeed = Math.max(0.1, airVel.length());
  const speedForward = airVel.dot(forward);
  const horizontal = Math.max(1, Math.sqrt(aircraft.vel.x * aircraft.vel.x + aircraft.vel.z * aircraft.vel.z));
  const flightPath = Math.atan2(aircraft.vel.y, horizontal);
  const pitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
  const alpha = THREE.MathUtils.clamp(pitch - flightPath + aircraft.flaps * 0.11 + aircraft.trim, -0.36, 0.44);
  const rho = densityAtAltitude(Math.max(0, aircraft.pos.y - 1100));
  const q = 0.5 * rho * airspeed * airspeed;
  const clRaw = 0.18 + 5.1 * alpha + 0.82 * aircraft.flaps;
  const cl = THREE.MathUtils.clamp(clRaw, -0.75, 2.15);
  const stall = smoothstep(0.22, 0.42, Math.abs(alpha)) * smoothstep(68, 43, airspeed);
  const cd = 0.027 + 0.047 * cl * cl + aircraft.gear * 0.023 + aircraft.flaps * 0.036 + stall * 0.18;
  const liftMag = q * aircraft.wingArea * cl * (1 - stall * 0.43);
  const dragMag = q * aircraft.wingArea * cd;
  const thrustMag = aircraft.throttle * aircraft.maxThrust * (1 - Math.min(0.24, Math.max(0, aircraft.pos.y - 1300) / 16000));

  const liftDir = tmp.v2.copy(up).addScaledVector(right, -right.dot(airVel) / Math.max(airspeed, 1) * 0.18).normalize();
  const dragDir = tmp.v3.copy(airVel).multiplyScalar(-1).normalize();

  const force = new THREE.Vector3(0, -aircraft.mass * 9.80665, 0);
  force.addScaledVector(forward, thrustMag);
  force.addScaledVector(liftDir, liftMag);
  force.addScaledVector(dragDir, dragMag);

  if (aircraft.brakes > 0 && isRunway(aircraft.pos.x, aircraft.pos.z) && onGround()) {
    force.addScaledVector(forward, -aircraft.brakes * 180000 * Math.sign(Math.max(0.1, speedForward)));
  }

  const accel = force.multiplyScalar(1 / aircraft.mass);
  aircraft.vel.addScaledVector(accel, dt);
  aircraft.pos.addScaledVector(aircraft.vel, dt);

  const authority = THREE.MathUtils.clamp((airspeed - 38) / 115, 0.22, 1.35);
  const elevator = (keyAxis('ArrowDown', 'ArrowUp') + aircraft.trim * 0.55) * authority;
  const aileron = keyAxis('ArrowRight', 'ArrowLeft') * authority;
  const rudder = keyAxis('KeyD', 'KeyA') * authority;
  aircraft.angular.x += elevator * dt * 0.72;
  aircraft.angular.y += rudder * dt * 0.36 + aileron * dt * 0.05;
  aircraft.angular.z += aileron * dt * 0.92 + rudder * dt * 0.06;
  aircraft.angular.multiplyScalar(Math.pow(0.31, dt));
  if (stall > 0.2) {
    aircraft.angular.z += Math.sin(t * 7.1) * stall * dt * 0.55;
    aircraft.angular.x -= stall * dt * 0.32;
  }
  const deltaQ = tmp.q1.setFromEuler(tmp.e1.set(aircraft.angular.x * dt, aircraft.angular.y * dt, aircraft.angular.z * dt, 'XYZ'));
  aircraft.quat.multiply(deltaQ).normalize();

  aircraft.flaps += (aircraft.flapsTarget - aircraft.flaps) * Math.min(1, dt * 1.5);
  aircraft.gear += (aircraft.gearTarget - aircraft.gear) * Math.min(1, dt * 0.75);
  updateAircraftModel(t);
  handleGroundContact(airspeed, forward);

  aircraft.group.position.copy(aircraft.pos);
  aircraft.group.quaternion.copy(aircraft.quat);
  aircraft.group.visible = aircraft.alive;
}

function readControls(dt) {
  if (!aircraft.alive) return;
  if (keys.has('KeyW')) aircraft.throttle += dt * 0.24;
  if (keys.has('KeyS')) aircraft.throttle -= dt * 0.28;
  aircraft.throttle = THREE.MathUtils.clamp(aircraft.throttle, 0, 1);
  aircraft.brakes = keys.has('KeyB') || keys.has('Space') ? 1 : 0;
}

function handleGroundContact(airspeed, forward) {
  const ground = terrainHeight(aircraft.pos.x, aircraft.pos.z);
  const clearance = aircraft.gear > 0.75 ? 5.65 : 2.8;
  if (aircraft.pos.y > ground + clearance || !aircraft.alive) return;

  aircraft.pos.y = ground + clearance;
  const sink = aircraft.vel.y;
  const runway = isRunway(aircraft.pos.x, aircraft.pos.z);
  const roll = Math.atan2(new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quat).dot(new THREE.Vector3(1, 0, 0)), new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quat).y);
  const aligned = Math.abs(forward.z) < 0.42 && forward.x > 0.35;
  const safeLanding = runway && aircraft.gear > 0.82 && sink > -4.8 && airspeed < 94 && Math.abs(roll) < 0.36 && aligned;

  if (safeLanding) {
    aircraft.vel.y = 0;
    aircraft.vel.multiplyScalar(0.985 - aircraft.brakes * 0.18);
    aircraft.angular.multiplyScalar(0.82);
    if (!aircraft.lastContact || performance.now() - aircraft.lastContact > 2600) {
      recordAttempt('landing', airspeed, 'stable touchdown');
      ui.message.textContent = 'Landing stored. Press R for another airframe.';
      aircraft.lastContact = performance.now();
    }
  } else {
    recordAttempt('crash', airspeed, runway ? 'unstable runway impact' : 'terrain impact');
    aircraft.alive = false;
    aircraft.group.visible = false;
    ui.message.textContent = 'Impact recorded. Press R for another airframe.';
  }
}

function updateAircraftModel(t) {
  if (!aircraft.gearGroup) return;
  aircraft.gearGroup.children.forEach((leg) => {
    const extension = aircraft.gear;
    leg.visible = extension > 0.03;
    leg.position.y = leg.userData.baseY + (1 - extension) * 3.2;
    leg.rotation.x = (1 - extension) * -1.18;
    leg.children.forEach((child) => {
      if (child.geometry && child.geometry.type === 'TorusGeometry') child.rotation.z -= aircraft.vel.length() * 0.018;
    });
  });
  aircraft.group.children.forEach((child) => {
    if (child.material && child.material.color && child.geometry && child.geometry.type === 'BoxGeometry') {
      child.rotation.x += Math.sin(t * 5) * 0.00002 * aircraft.flaps;
    }
  });
}

function updateCamera(dt) {
  if (!started) return;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quat).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quat).normalize();
  const target = tmp.v1.copy(aircraft.pos).addScaledVector(forward, 32).addScaledVector(up, 5);
  let desired = tmp.v2.copy(aircraft.pos);
  if (cameraMode === 0) desired.addScaledVector(forward, -108).addScaledVector(up, 31);
  if (cameraMode === 1) desired.addScaledVector(forward, 12).addScaledVector(up, 7);
  if (cameraMode === 2) desired.addScaledVector(right, 96).addScaledVector(up, 38).addScaledVector(forward, -44);
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
  aircraft.pos.set(-5600, terrainHeight(-5600, 0) + 720, 0);
  aircraft.quat.setFromEuler(new THREE.Euler(0.02, -Math.PI / 2, 0, 'XYZ'));
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat);
  aircraft.vel.copy(forward.multiplyScalar(88));
  aircraft.vel.y = -1.8;
  aircraft.angular.set(0, 0, 0);
  aircraft.throttle = 0.64;
  aircraft.flaps = 0.25;
  aircraft.flapsTarget = 0.25;
  aircraft.gear = 1;
  aircraft.gearTarget = 1;
  aircraft.brakes = 0;
  aircraft.alive = true;
  aircraft.lastContact = null;
  aircraft.group.visible = true;
  aircraft.group.position.copy(aircraft.pos);
  aircraft.group.quaternion.copy(aircraft.quat);
  if (!first) ui.message.textContent = 'New airframe spawned';
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
  fireGroups.forEach((fire, groupIndex) => {
    fire.children.forEach((child, i) => {
      if (child.isMesh) {
        const pulse = 1 + Math.sin(t * (4.8 + i * 0.2) + child.userData.phase) * 0.16;
        child.scale.setScalar(pulse);
        if (child.geometry.type === 'SphereGeometry') {
          child.position.x += Math.sin(t * 0.4 + i) * 0.015;
          child.material.opacity = 0.11 + Math.sin(t * 0.9 + i) * 0.035;
        }
      }
      if (child.isPointLight) child.intensity = 1 + Math.sin(t * 8 + groupIndex) * 0.35;
    });
  });
}

function applyWeather(name) {
  if (!weatherModes[name]) return;
  settings.weather = name;
  const mode = weatherModes[name];
  scene.fog.color.set(mode.color);
  scene.fog.density = name === 'hurricane' ? 0.00018 : name === 'storm' ? 0.00012 : name === 'aurora' ? 0.00006 : 0.000052;
  ui.weatherButtons.forEach((button) => button.classList.toggle('active', button.dataset.weather === name));
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
  ui.readout.textContent = `${Math.max(1, Math.round(1000 / frameAverage))} fps | ${cameraModeName()} | trim ${aircraft.trim.toFixed(2)}`;
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
