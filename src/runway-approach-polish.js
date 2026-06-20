const runwayBaseCreateRunway = createRunway;
const runwayBaseUpdateWeather = updateWeather;
const runwayBaseApplyWeather = applyWeather;
const runwayBaseApplyTime = applyTime;

const runwayLightSets = [];
const runwayPointLights = [];
const runwayPapiSystems = [];
const runwayPapiMaterials = [];
let runwayApproachGroup = null;

createRunway = function createRunwayWithApproachPresentation() {
  const before = new Set(scene.children);
  runwayBaseCreateRunway();

  const added = scene.children.filter((child) => !before.has(child));
  const pavement = added[0];
  if (pavement && pavement.isMesh) {
    pavement.name = 'Yosemite runway pavement';
    pavement.rotation.z = Math.atan(0.0025);
    pavement.material.color.set(0x202522);
    pavement.material.roughness = 0.92;
    pavement.material.metalness = 0.015;
    pavement.material.dithering = true;
    pavement.material.needsUpdate = true;
  }

  added.slice(1).forEach((marking, index) => {
    if (!marking.isMesh) return;
    marking.name = index < 13 ? 'runway centerline marking' : 'runway threshold marking';
    marking.scale.y = 0.11;
    marking.position.y = runwaySurfaceY(marking.position.x) + 0.1;
    marking.material.toneMapped = false;
    marking.material.needsUpdate = true;
  });

  runwayApproachGroup = new THREE.Group();
  runwayApproachGroup.name = 'runway approach presentation';
  scene.add(runwayApproachGroup);

  createRunwaySurfaceDetails();
  createRunwayLighting();
  createRunwayDistanceBoards();
  createPapiSystem(-2380, -104, 1);
  createPapiSystem(2380, 104, -1);
  syncRunwayVisibility();
};

function runwaySurfaceY(x) {
  return terrainHeight(THREE.MathUtils.clamp(x, WORLD.runway.xMin, WORLD.runway.xMax), 0) + 1.82;
}

function addRunwayBox(name, x, z, length, width, height, material, followSlope = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), material);
  mesh.name = name;
  mesh.position.set(x, runwaySurfaceY(x) + height * 0.5 + 0.025, z);
  if (followSlope) mesh.rotation.z = Math.atan(0.0025);
  mesh.receiveShadow = true;
  runwayApproachGroup.add(mesh);
  return mesh;
}

function createRunwaySurfaceDetails() {
  const shoulderMaterial = new THREE.MeshStandardMaterial({
    color: 0x343a35,
    roughness: 0.96,
    metalness: 0.01,
    polygonOffset: true,
    polygonOffsetFactor: 1
  });
  [-93, 93].forEach((z) => addRunwayBox('runway shoulder', 0, z, 5200, 14, 0.16, shoulderMaterial, true));

  const paintMaterial = new THREE.MeshBasicMaterial({ color: 0xf4f1dc, toneMapped: false });
  [-79, 79].forEach((z) => addRunwayBox('runway edge line', 0, z, 5120, 2.6, 0.11, paintMaterial, true));

  [-1, 1].forEach((end) => {
    const aimingX = end * 1420;
    [-30, 30].forEach((z) => addRunwayBox('runway aiming point', aimingX, z, 118, 10, 0.12, paintMaterial));
    [1720, 1950, 2160].forEach((distance, zoneIndex) => {
      const x = end * distance;
      const pairs = zoneIndex === 0 ? 3 : zoneIndex === 1 ? 2 : 1;
      for (let pair = 0; pair < pairs; pair++) {
        const offset = 23 + pair * 13;
        [-offset, offset].forEach((z) => addRunwayBox('touchdown zone bar', x, z, 42, 4.2, 0.12, paintMaterial));
      }
    });
  });

  createRunwayLabel('09', -2260, -Math.PI / 2);
  createRunwayLabel('27', 2260, Math.PI / 2);

  const rubberMaterial = new THREE.MeshBasicMaterial({
    color: 0x080b0a,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
  [-1, 1].forEach((end) => {
    for (let i = 0; i < 12; i++) {
      const x = end * (1280 + i * 51);
      const z = (seededRandom(i * 7.1 + end * 13) - 0.5) * 18;
      const mark = addRunwayBox('touchdown rubber trace', x, z, 76 + seededRandom(i * 5.2) * 84, 1.1, 0.035, rubberMaterial);
      mark.rotation.y = (seededRandom(i * 8.7 + end) - 0.5) * 0.014;
    }
  });
}

function createRunwayLabel(label, x, rotation) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 128;
  const context = labelCanvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, 256, 128);
  context.fillStyle = '#f7f4df';
  context.font = '900 94px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, 128, 67);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(112, 54), material);
  mesh.name = 'runway designation ' + label;
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotation;
  mesh.position.set(x, runwaySurfaceY(x) + 0.16, 0);
  mesh.renderOrder = 4;
  runwayApproachGroup.add(mesh);
}

function createRunwayLighting() {
  const edgePositions = [];
  for (let x = -2520; x <= 2520; x += 120) {
    edgePositions.push(new THREE.Vector3(x, runwaySurfaceY(x) + 0.72, -82));
    edgePositions.push(new THREE.Vector3(x, runwaySurfaceY(x) + 0.72, 82));
  }
  createInstancedLightField('runway edge lights', edgePositions, 0xe9f5ff, 0.95, 3.6, false);

  const thresholdGreen = [];
  const runwayEndRed = [];
  [-1, 1].forEach((end) => {
    for (let z = -70; z <= 70; z += 14) {
      thresholdGreen.push(new THREE.Vector3(end * 2390, runwaySurfaceY(end * 2390) + 0.82, z));
      runwayEndRed.push(new THREE.Vector3(end * 2575, runwaySurfaceY(end * 2575) + 0.82, z));
    }
  });
  createInstancedLightField('runway threshold lights', thresholdGreen, 0x72ffbd, 1.1, 4.2, false);
  createInstancedLightField('runway end lights', runwayEndRed, 0xff423d, 1.1, 4.2, false);

  const approachPositions = [];
  [-1, 1].forEach((end) => {
    for (let step = 1; step <= 12; step++) {
      const x = end * (2600 + step * 75);
      approachPositions.push(new THREE.Vector3(x, terrainHeight(x, 0) + 3.2, 0));
      if (step % 4 === 0) {
        for (let z = -45; z <= 45; z += 15) {
          if (z !== 0) approachPositions.push(new THREE.Vector3(x, terrainHeight(x, z) + 3.2, z));
        }
      }
    }
  });
  createInstancedLightField('approach light system', approachPositions, 0xfff7df, 1.15, 4.8, true);

  [-2390, 2390].forEach((x) => {
    const light = new THREE.PointLight(0xb8ffe1, 0.8, 270, 2);
    light.name = 'threshold pool light';
    light.position.set(x, runwaySurfaceY(x) + 7, 0);
    light.userData.runwayBaseIntensity = 0.8;
    runwayPointLights.push(light);
    runwayApproachGroup.add(light);
  });
}

function createInstancedLightField(name, positions, color, coreRadius, glowRadius, pulse) {
  const coreMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
    depthWrite: false
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    toneMapped: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const core = new THREE.InstancedMesh(new THREE.SphereGeometry(coreRadius, 8, 6), coreMaterial, positions.length);
  const glow = new THREE.InstancedMesh(new THREE.SphereGeometry(glowRadius, 8, 6), glowMaterial, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((position, index) => {
    dummy.position.copy(position);
    dummy.updateMatrix();
    core.setMatrixAt(index, dummy.matrix);
    glow.setMatrixAt(index, dummy.matrix);
  });
  core.name = name;
  glow.name = name + ' glow';
  core.instanceMatrix.needsUpdate = true;
  glow.instanceMatrix.needsUpdate = true;
  core.frustumCulled = false;
  glow.frustumCulled = false;
  glow.renderOrder = 5;
  runwayApproachGroup.add(core, glow);
  runwayLightSets.push({ coreMaterial, glowMaterial, pulse, glowBase: pulse ? 0.34 : 0.22 });
}

function createRunwayDistanceBoards() {
  const westbound = [
    { x: -1400, label: '4' }, { x: -400, label: '3' },
    { x: 600, label: '2' }, { x: 1600, label: '1' }
  ];
  const eastbound = [
    { x: 1400, label: '4' }, { x: 400, label: '3' },
    { x: -600, label: '2' }, { x: -1600, label: '1' }
  ];
  westbound.forEach((board) => createDistanceBoard(board.label, board.x, -108, -Math.PI / 2));
  eastbound.forEach((board) => createDistanceBoard(board.label, board.x, 108, Math.PI / 2));
}

function createDistanceBoard(label, x, z, rotationY) {
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 128;
  boardCanvas.height = 128;
  const context = boardCanvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#080b0a';
  context.fillRect(0, 0, 128, 128);
  context.strokeStyle = '#f5f2da';
  context.lineWidth = 7;
  context.strokeRect(7, 7, 114, 114);
  context.fillStyle = '#ffffff';
  context.font = '900 88px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, 64, 68);
  const texture = new THREE.CanvasTexture(boardCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.FrontSide });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), material);
  board.name = label + ' kilometre runway distance board';
  board.position.set(x, terrainHeight(x, z) + 10.5, z);
  board.rotation.y = rotationY;
  runwayApproachGroup.add(board);

  const posts = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 4.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2b302d, roughness: 0.9 })
  );
  posts.position.set(x, terrainHeight(x, z) + 2.25, z);
  runwayApproachGroup.add(posts);
}

function createPapiSystem(thresholdX, sideZ, direction) {
  const system = { thresholdX, direction, lamps: [] };
  const x = thresholdX + direction * 310;
  for (let i = 0; i < 4; i++) {
    const z = sideZ + (i - 1.5) * 7.5;
    const ground = terrainHeight(x, z);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.2, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x242a28, roughness: 0.72, metalness: 0.18 })
    );
    housing.name = 'PAPI housing';
    housing.position.set(x, ground + 1.2, z);
    runwayApproachGroup.add(housing);

    const material = new THREE.MeshBasicMaterial({
      color: i < 2 ? 0xffffff : 0xff3c35,
      transparent: true,
      opacity: 1,
      toneMapped: false,
      depthWrite: false
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: i < 2 ? 0xffffff : 0xff3c35,
      transparent: true,
      opacity: 0.3,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), material);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(3.8, 10, 8), glowMaterial);
    lamp.name = 'PAPI lamp';
    glow.name = 'PAPI lamp glow';
    lamp.position.set(x - direction * 0.45, ground + 2.35, z);
    glow.position.copy(lamp.position);
    runwayApproachGroup.add(lamp, glow);
    system.lamps.push({ material, glowMaterial });
    runwayPapiMaterials.push(material, glowMaterial);
  }
  runwayPapiSystems.push(system);
}

function updateRunwayPapi() {
  runwayPapiSystems.forEach((system) => {
    const distance = (system.thresholdX - aircraft.pos.x) * system.direction;
    let whiteCount = 2;
    if (distance > 80) {
      const thresholdY = runwaySurfaceY(system.thresholdX);
      const angle = THREE.MathUtils.radToDeg(Math.atan2(aircraft.pos.y - thresholdY, distance));
      whiteCount = angle > 3.5 ? 4 : angle > 3.2 ? 3 : angle >= 2.8 ? 2 : angle >= 2.5 ? 1 : 0;
    }
    system.lamps.forEach((lamp, index) => {
      const color = index < whiteCount ? 0xffffff : 0xff3c35;
      lamp.material.color.setHex(color);
      lamp.glowMaterial.color.setHex(color);
    });
  });
}

function syncRunwayVisibility() {
  const lowLight = ['dawn', 'dusk', 'night'].includes(settings.time);
  const lowVisibility = ['snow', 'storm', 'lightning', 'hurricane'].includes(settings.weather);
  const emphasized = lowLight || lowVisibility;
  runwayLightSets.forEach((set) => {
    set.coreMaterial.opacity = emphasized ? 1 : 0.82;
    set.glowMaterial.opacity = emphasized ? set.glowBase : set.glowBase * 0.34;
  });
  runwayPapiMaterials.forEach((material, index) => {
    material.opacity = index % 2 === 0 ? 1 : emphasized ? 0.38 : 0.16;
  });
  runwayPointLights.forEach((light) => {
    light.intensity = light.userData.runwayBaseIntensity * (emphasized ? 1 : 0.2);
  });
}

updateWeather = function updateWeatherWithRunwayPresentation(dt, t) {
  runwayBaseUpdateWeather(dt, t);
  updateRunwayPapi();
  const emphasized = ['dawn', 'dusk', 'night'].includes(settings.time) ||
    ['snow', 'storm', 'lightning', 'hurricane'].includes(settings.weather);
  runwayLightSets.forEach((set, index) => {
    if (!set.pulse) return;
    const pulse = emphasized ? 0.92 + Math.sin(t * 2.1 + index) * 0.08 : 0.34;
    set.glowMaterial.opacity = set.glowBase * pulse;
  });
};

applyWeather = function applyWeatherWithRunwayVisibility(name) {
  runwayBaseApplyWeather(name);
  syncRunwayVisibility();
};

applyTime = function applyTimeWithRunwayVisibility(name) {
  runwayBaseApplyTime(name);
  syncRunwayVisibility();
};
