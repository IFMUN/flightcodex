const response = await fetch('./src/app-core.js', { cache: 'no-store' });
if (!response.ok) throw new Error('Unable to load simulator core');

let source = await response.text();

source = source.replace(
  "import * as THREE from 'three';",
  "import * as THREE from 'three';\nlet pilotMode = 'cursor';\nconst cursorAim = { x: 0, y: -0.12, active: false, screenX: window.innerWidth * 0.5, screenY: window.innerHeight * 0.44 };\nconst effectGroups = [];\nconst lightningPartPoints = { nose: [0, 1.3, -20.6], hull: [0, 0.7, -1.0], leftWing: [-10.5, -0.3, 2.4], rightWing: [10.5, -0.3, 2.4], leftEngine: [-7.8, -2.05, -2.4], rightEngine: [7.8, -2.05, -2.4], tail: [0, 4.2, 18.2], gear: [0, -3.2, 1.7] };"
);

source = source.replace(
  'Object.keys(damageLabels).forEach((part) => {',
  '[' + ['nose', 'hull', 'leftWing', 'rightWing', 'leftEngine', 'rightEngine', 'tail', 'gear'].map((part) => `'${part}'`).join(', ') + '].forEach((part) => {'
);

source += String.raw`

function ensureHudAdditions() {
  const damagePartNames = ['nose', 'hull', 'leftWing', 'rightWing', 'leftEngine', 'rightEngine', 'tail', 'gear'];
  const style = document.createElement('style');
  style.textContent = '
    .damage-vignette { --damage-alpha: 0; position: fixed; inset: 0; z-index: 3; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at center, transparent 42%, rgba(255, 28, 40, var(--damage-alpha)) 100%), linear-gradient(90deg, rgba(255, 56, 48, calc(var(--damage-alpha) * 0.55)), transparent 18%, transparent 82%, rgba(255, 56, 48, calc(var(--damage-alpha) * 0.55))), linear-gradient(0deg, rgba(255, 56, 48, calc(var(--damage-alpha) * 0.44)), transparent 18%, transparent 82%, rgba(255, 56, 48, calc(var(--damage-alpha) * 0.44))); mix-blend-mode: screen; transition: opacity 220ms ease; }\n    .damage-vignette.active { opacity: 1; animation: damagePulse 1.25s ease-in-out infinite; }\n    .damage-model { right: 20px; top: 420px; width: min(286px, calc(100vw - 40px)); padding: 14px; opacity: 0; transform: translateY(8px); visibility: hidden; transition: opacity 220ms ease, transform 220ms ease, visibility 220ms ease; }\n    .damage-model.active { opacity: 1; transform: translateY(0); visibility: visible; }\n    .damage-model h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: 0; text-transform: uppercase; color: rgba(255, 202, 210, 0.84); }\n    .airframe-schematic { position: relative; height: 148px; margin: 4px 0 10px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; background: radial-gradient(circle at center, rgba(255,255,255,0.08), rgba(255,255,255,0.02)); overflow: hidden; }\n    .damage-part { position: absolute; display: block; border: 1px solid rgba(180, 245, 255, 0.42); background: rgba(95, 220, 240, 0.13); box-shadow: 0 0 18px rgba(104, 239, 255, 0.08); transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }\n    .damage-part.damaged { border-color: rgba(255, 83, 82, 0.96); background: rgba(255, 44, 52, 0.42); box-shadow: 0 0 18px rgba(255, 50, 55, 0.72), inset 0 0 14px rgba(255, 255, 255, 0.2); animation: partWarn 760ms ease-in-out infinite; }\n    .damage-part.nose { left: 124px; top: 18px; width: 24px; height: 28px; border-radius: 50% 50% 38% 38%; }\n    .damage-part.hull { left: 113px; top: 40px; width: 46px; height: 78px; border-radius: 999px; }\n    .damage-part.leftWing { left: 28px; top: 72px; width: 91px; height: 16px; transform: rotate(-10deg); border-radius: 5px; }\n    .damage-part.rightWing { right: 28px; top: 72px; width: 91px; height: 16px; transform: rotate(10deg); border-radius: 5px; }\n    .damage-part.leftEngine { left: 71px; top: 92px; width: 20px; height: 20px; border-radius: 50%; }\n    .damage-part.rightEngine { right: 71px; top: 92px; width: 20px; height: 20px; border-radius: 50%; }\n    .damage-part.tail { left: 118px; bottom: 18px; width: 36px; height: 22px; border-radius: 4px; }\n    .damage-part.gear { left: 120px; top: 92px; width: 32px; height: 12px; border-radius: 999px; }\n    .damage-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; font-size: 12px; color: rgba(255, 226, 229, 0.82); }\n    .damage-list li { display: flex; justify-content: space-between; gap: 12px; min-height: 18px; }\n    .pilot-mode { padding-top: 10px; }\n    .pilot-mode button.active { border-color: rgba(157,255,203,0.76); background: rgba(75, 205, 144, 0.27); }\n    .cursor-reticle { position: fixed; z-index: 5; left: 50%; top: 44%; width: 34px; height: 34px; border: 1px solid rgba(157,255,203,0.76); border-radius: 999px; pointer-events: none; transform: translate(-50%, -50%); opacity: 0.82; box-shadow: 0 0 22px rgba(120,255,205,0.28), inset 0 0 16px rgba(120,255,205,0.13); transition: opacity 180ms ease; }\n    .cursor-reticle::before, .cursor-reticle::after { content: ""; position: absolute; background: rgba(157,255,203,0.75); }\n    .cursor-reticle::before { left: 50%; top: -8px; width: 1px; height: 48px; }\n    .cursor-reticle::after { left: -8px; top: 50%; width: 48px; height: 1px; }\n    .cursor-reticle.keyboard { opacity: 0; }\n    @keyframes damagePulse { 0%, 100% { filter: brightness(0.9); } 50% { filter: brightness(1.24); } }\n    @keyframes partWarn { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.55); } }\n    @media (max-width: 760px) { .damage-model { display: none; } }\n  ';
  document.head.appendChild(style);

  const systems = document.querySelector('.systems');
  const firstSegment = systems ? systems.querySelector('.segment') : null;
  if (systems && !document.querySelector('[data-pilot-mode]')) {
    const controls = document.createElement('div');
    controls.className = 'segment pilot-mode';
    controls.setAttribute('aria-label', 'Control mode');
    controls.innerHTML = '<button type="button" data-pilot-mode="cursor">Cursor</button><button type="button" data-pilot-mode="keyboard">Keyboard</button>';
    systems.insertBefore(controls, firstSegment);
  }

  const weatherSegment = Array.from(document.querySelectorAll('.systems .segment')).find((segment) => segment.getAttribute('aria-label') === 'Weather');
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
  if (hud && !document.getElementById('cursorReticle')) {
    const reticle = document.createElement('div');
    reticle.id = 'cursorReticle';
    reticle.className = 'cursor-reticle';
    hud.appendChild(reticle);
  }
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
    damagePartNames.forEach((part) => {
      const item = document.createElement('span');
      item.className = 'damage-part ' + part;
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
  window.addEventListener('pointermove', (event) => {
    cursorAim.screenX = event.clientX;
    cursorAim.screenY = event.clientY;
    cursorAim.x = THREE.MathUtils.clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
    cursorAim.y = THREE.MathUtils.clamp((0.5 - event.clientY / window.innerHeight) * 2, -1, 1);
    cursorAim.active = true;
    const reticle = document.getElementById('cursorReticle');
    if (reticle) reticle.style.transform = 'translate(' + (event.clientX - window.innerWidth / 2 - 17) + 'px, ' + (event.clientY - window.innerHeight * 0.44 - 17) + 'px)';
  });
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
  Array.from(document.querySelectorAll('[data-pilot-mode]')).forEach((button) => button.addEventListener('click', () => setPilotMode(button.dataset.pilotMode)));
  setPilotMode('cursor');
}

function setPilotMode(mode) {
  pilotMode = mode === 'keyboard' ? 'keyboard' : 'cursor';
  Array.from(document.querySelectorAll('[data-pilot-mode]')).forEach((button) => button.classList.toggle('active', button.dataset.pilotMode === pilotMode));
  const reticle = document.getElementById('cursorReticle');
  if (reticle) reticle.classList.toggle('keyboard', pilotMode === 'keyboard');
  ui.message.textContent = pilotMode === 'cursor' ? 'Cursor mode: steer toward the reticle. Keyboard still handles throttle, gear, flaps, and brakes.' : 'Keyboard mode: arrow keys fly the aircraft directly.';
}

function readControls(dt) {
  if (keys.has('KeyW')) aircraft.throttle += dt * 0.34;
  if (keys.has('KeyS')) aircraft.throttle -= dt * 0.38;
  aircraft.throttle = THREE.MathUtils.clamp(aircraft.throttle, 0, 1);
  if (pilotMode === 'cursor') {
    const ground = terrainHeight(aircraft.pos.x, aircraft.pos.z);
    const agl = aircraft.pos.y - ground;
    const targetPitch = THREE.MathUtils.clamp(cursorAim.y * 1.05 + (agl < 520 ? 0.42 : 0), -0.85, 0.9);
    const targetRoll = THREE.MathUtils.clamp(cursorAim.x * 0.95, -0.82, 0.82);
    const targetYaw = THREE.MathUtils.clamp(cursorAim.x * 0.24 + keyAxis('KeyD', 'KeyA') * 0.45, -0.55, 0.55);
    aircraft.controls.pitch = smoothControl(aircraft.controls.pitch, targetPitch, dt, 4.7);
    aircraft.controls.roll = smoothControl(aircraft.controls.roll, targetRoll, dt, 4.9);
    aircraft.controls.yaw = smoothControl(aircraft.controls.yaw, targetYaw, dt, 4.3);
    if (agl < 320 && aircraft.vel.y < -3) aircraft.throttle = Math.max(aircraft.throttle, 0.84);
  } else {
    aircraft.controls.pitch = smoothControl(aircraft.controls.pitch, keyAxis('ArrowUp', 'ArrowDown'), dt, 5.8);
    aircraft.controls.roll = smoothControl(aircraft.controls.roll, keyAxis('ArrowRight', 'ArrowLeft'), dt, 6.4);
    aircraft.controls.yaw = smoothControl(aircraft.controls.yaw, keyAxis('KeyD', 'KeyA'), dt, 5.2);
  }
  aircraft.brakes = keys.has('KeyB') || keys.has('Space') ? 1 : 0;
}

function triggerLightning(t) {
  const mode = weatherModes[settings.weather];
  const hitChance = settings.weather === 'lightning' ? 0.86 : settings.weather === 'hurricane' ? 0.34 : 0.44;
  const hitPlane = started && aircraft.alive && seededRandom(t * 19.73 + aircraft.pos.x) < hitChance;
  const partPool = ['leftEngine', 'rightEngine', 'leftWing', 'rightWing', 'tail', 'hull', 'gear', 'nose'];
  const part = partPool[Math.floor(seededRandom(t * 11.3) * partPool.length)];
  const target = hitPlane ? partWorldPoint(part) : new THREE.Vector3(
    aircraft.pos.x + (seededRandom(t * 2.1) - 0.5) * 3600,
    terrainHeight(aircraft.pos.x, aircraft.pos.z) + 60,
    aircraft.pos.z + (seededRandom(t * 3.4) - 0.5) * 3600
  );
  const start = target.clone().add(new THREE.Vector3((seededRandom(t) - 0.5) * 950, 3000 + seededRandom(t + 4) * 2300, (seededRandom(t + 8) - 0.5) * 950));
  createLightningBolt(start, target, hitPlane, part);
  lightningFlash = 1;
  lightningLight.position.copy(target);
  ui.message.textContent = hitPlane ? 'Lightning strike: ' + damageLabels[part] + ' hit. Systems degrading.' : mode.label + ' discharge nearby.';
  if (hitPlane) {
    applyDamage(part, 0.42 + seededRandom(t * 7.1) * 0.46, 'lightning strike to ' + damageLabels[part]);
    if (part.includes('Engine')) spawnEngineSurge(part);
    if (seededRandom(t * 5.9) > 0.52) applyDamage('hull', 0.15 + seededRandom(t * 2.7) * 0.22, 'electrical surge through airframe');
    spawnElectricalBurst(part, target);
  }
  lightningTimer = settings.weather === 'lightning' ? 1.8 + seededRandom(t * 5) * 3.2 : 3.8 + seededRandom(t * 5) * 5.2;
}

function createLightningBolt(start, end, hitPlane, part) {
  const boltGroup = new THREE.Group();
  boltGroup.userData.kind = 'lightning';
  boltGroup.userData.life = 0.48;
  const makeLine = (points, color, opacity) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geometry, material);
    boltGroup.add(line);
    return line;
  };
  const main = [];
  const segments = 18;
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const p = start.clone().lerp(end, f);
    const jitter = (1 - Math.abs(f - 0.5) * 1.45) * (hitPlane ? 115 : 190);
    p.x += (seededRandom(i * 8.1 + end.x) - 0.5) * jitter;
    p.z += (seededRandom(i * 12.2 + end.z) - 0.5) * jitter;
    p.y += Math.sin(f * Math.PI * 3) * (hitPlane ? 36 : 60);
    main.push(p);
  }
  makeLine(main, hitPlane ? 0xf7fdff : 0xa8d8ff, 1);
  makeLine(main.map((p) => p.clone().add(new THREE.Vector3(8, 0, -8))), 0x78f4ff, 0.58);
  for (let b = 2; b < main.length - 2; b += 3) {
    const origin = main[b];
    const branch = [origin.clone()];
    const dir = new THREE.Vector3(seededRandom(b + end.x) - 0.5, seededRandom(b + 3) * -0.2, seededRandom(b + end.z) - 0.5).normalize();
    for (let k = 1; k <= 4; k++) branch.push(origin.clone().addScaledVector(dir, k * (65 + seededRandom(k * b) * 55)).add(new THREE.Vector3(0, -k * 18, 0)));
    makeLine(branch, 0xb9ecff, 0.44);
  }
  if (hitPlane) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(18, 0.7, 8, 64), new THREE.MeshBasicMaterial({ color: 0xbfffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
    ring.position.copy(end);
    ring.rotation.x = Math.PI / 2;
    ring.userData.velocity = new THREE.Vector3();
    boltGroup.add(ring);
  }
  lightningGroup.add(boltGroup);
  lightningBolts.push({ line: boltGroup, life: 0.48 });
}

function partWorldPoint(part) {
  const p = lightningPartPoints[part] || [0, 0, 0];
  return new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(aircraft.quat).add(aircraft.pos);
}

function spawnElectricalBurst(part, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.kind = 'sparkBurst';
  group.userData.age = 0;
  group.userData.life = 1.2;
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xbfffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6f2a, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 22; i++) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.5 + seededRandom(i) * 0.8, 8, 6), i % 4 === 0 ? emberMat.clone() : sparkMat.clone());
    const dir = new THREE.Vector3(seededRandom(i * 3) - 0.5, seededRandom(i * 5) - 0.25, seededRandom(i * 7) - 0.5).normalize();
    spark.userData.velocity = dir.multiplyScalar(30 + seededRandom(i * 11) * 86);
    spark.userData.spin = new THREE.Vector3(seededRandom(i) * 3, seededRandom(i + 1) * 3, seededRandom(i + 2) * 3);
    group.add(spark);
  }
  effectGroups.push(group);
  scene.add(group);
}

function spawnEngineSurge(part) {
  const point = partWorldPoint(part);
  const flame = new THREE.Group();
  flame.position.copy(point);
  flame.userData.kind = 'engineSurge';
  flame.userData.age = 0;
  flame.userData.life = 3.2;
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7b23, transparent: true, opacity: 0.74, blending: THREE.AdditiveBlending, depthWrite: false });
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x151719, transparent: true, opacity: 0.26, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(3 + i, 22 + i * 7, 8), i < 3 ? flameMat.clone() : smokeMat.clone());
    plume.rotation.x = Math.PI / 2;
    plume.position.set((seededRandom(i) - 0.5) * 7, (seededRandom(i + 2) - 0.5) * 7, i * 7);
    plume.userData.velocity = new THREE.Vector3((seededRandom(i + 5) - 0.5) * 5, 5 + seededRandom(i + 9) * 8, 18 + i * 2);
    flame.add(plume);
  }
  effectGroups.push(flame);
  scene.add(flame);
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
  createExplosionMarker(item);
}

function createExplosionMarker(item) {
  const origin = new THREE.Vector3(item.x, terrainHeight(item.x, item.z) + 4, item.z);
  const fire = new THREE.Group();
  fire.position.copy(origin);
  fire.userData.kind = 'persistentFire';
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a19, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff0a6, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false });
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x171b1d, transparent: true, opacity: 0.2, depthWrite: false });
  for (let i = 0; i < 18; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(9 + seededRandom(i) * 14, 48 + seededRandom(i * 5) * 78, 8), i % 4 === 0 ? coreMat.clone() : flameMat.clone());
    flame.position.set((seededRandom(i * 11) - 0.5) * 82, 18 + seededRandom(i * 9) * 48, (seededRandom(i * 17) - 0.5) * 82);
    flame.rotation.z = (seededRandom(i * 4) - 0.5) * 0.6;
    flame.userData.phase = seededRandom(i * 5) * Math.PI * 2;
    fire.add(flame);
  }
  for (let i = 0; i < 14; i++) {
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(24 + i * 4, 10, 8), smokeMat.clone());
    smoke.position.set((seededRandom(i * 13) - 0.5) * 96, 60 + i * 22, (seededRandom(i * 23) - 0.5) * 96);
    smoke.userData.phase = seededRandom(i * 29) * Math.PI * 2;
    fire.add(smoke);
  }
  const light = new THREE.PointLight(0xff6418, 2.1, 680, 2);
  light.position.y = 55;
  fire.add(light);
  fireGroups.push(fire);
  scene.add(fire);

  const blast = new THREE.Group();
  blast.position.copy(origin);
  blast.userData.kind = 'explosion';
  blast.userData.age = 0;
  blast.userData.life = 2.7;
  const shock = new THREE.Mesh(new THREE.TorusGeometry(26, 2.5, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffd18a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
  shock.rotation.x = Math.PI / 2;
  shock.userData.role = 'shockwave';
  blast.add(shock);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(34, 18, 12), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.userData.role = 'flash';
  blast.add(flash);
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x4d5358, roughness: 0.72, metalness: 0.35 });
  for (let i = 0; i < 34; i++) {
    const debris = new THREE.Mesh(new THREE.BoxGeometry(4 + seededRandom(i) * 8, 1.2 + seededRandom(i + 2) * 3, 3 + seededRandom(i + 4) * 7), debrisMat.clone());
    debris.position.set(0, 16, 0);
    debris.userData.velocity = new THREE.Vector3(seededRandom(i * 3) - 0.5, seededRandom(i * 5) * 0.8, seededRandom(i * 7) - 0.5).normalize().multiplyScalar(70 + seededRandom(i * 9) * 180);
    debris.userData.spin = new THREE.Vector3(seededRandom(i) * 4, seededRandom(i + 1) * 4, seededRandom(i + 2) * 4);
    blast.add(debris);
  }
  effectGroups.push(blast);
  scene.add(blast);
}

function updateFires(t) {
  const dt = 0.016;
  for (let i = effectGroups.length - 1; i >= 0; i--) {
    const group = effectGroups[i];
    group.userData.age += dt;
    const age = group.userData.age;
    const life = group.userData.life || 1;
    const fade = Math.max(0, 1 - age / life);
    group.children.forEach((child, childIndex) => {
      if (child.userData.role === 'shockwave') {
        child.scale.setScalar(1 + age * 7.5);
        child.material.opacity = 0.72 * fade;
      } else if (child.userData.role === 'flash') {
        child.scale.setScalar(1 + age * 2.6);
        child.material.opacity = 0.78 * fade;
      } else {
        if (child.userData.velocity) child.position.addScaledVector(child.userData.velocity, dt);
        if (child.userData.spin) {
          child.rotation.x += child.userData.spin.x * dt;
          child.rotation.y += child.userData.spin.y * dt;
          child.rotation.z += child.userData.spin.z * dt;
        }
        if (child.material && 'opacity' in child.material) child.material.opacity = Math.min(child.material.opacity, fade);
      }
    });
    if (age > life) {
      scene.remove(group);
      effectGroups.splice(i, 1);
    }
  }

  for (let i = fireGroups.length - 1; i >= 0; i--) {
    const item = fireGroups[i];
    if (item.isMesh && item.userData.birth) {
      const age = (performance.now() - item.userData.birth) / 1000;
      item.position.y += 3.4 * dt;
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
        const pulse = 1 + Math.sin(t * (5.2 + childIndex * 0.22) + child.userData.phase) * 0.18;
        child.scale.setScalar(pulse);
        if (child.geometry.type === 'SphereGeometry') {
          child.position.x += Math.sin(t * 0.4 + childIndex) * 0.018;
          child.material.opacity = 0.11 + Math.sin(t * 0.9 + childIndex) * 0.04;
        }
      }
      if (child.isPointLight) child.intensity = 1.25 + Math.sin(t * 8 + i) * 0.5;
    });
  }
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
  ui.readout.textContent = Math.max(1, Math.round(1000 / frameAverage)) + ' fps | ' + cameraModeName() + ' | ' + pilotMode + ' | trim ' + aircraft.trim.toFixed(2) + ' | damage ' + damage + '%';
}
`;

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
await import(moduleUrl);
URL.revokeObjectURL(moduleUrl);
