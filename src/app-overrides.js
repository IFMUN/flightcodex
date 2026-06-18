const DAMAGE_PARTS = ['nose', 'hull', 'leftWing', 'rightWing', 'leftEngine', 'rightEngine', 'tail', 'gear'];

ensureHudAdditions = function ensureHudAdditionsOverride() {
  installCursorAndDamageStyles();
  installPilotControls();
  installCursorReticle();
  ui.weatherButtons = Array.from(document.querySelectorAll('[data-weather]'));
  ui.pilotModeLabel = document.getElementById('pilotModeValue');
  ui.pilotButtons = Array.from(document.querySelectorAll('[data-pilot-mode]'));
  ui.cursorReticle = document.getElementById('cursorReticle');
  ui.damagePanel = document.getElementById('damageModel');
  ui.damageList = document.getElementById('damageList');
  ui.damageVignette = document.getElementById('damageVignette');
  ui.damageParts = Array.from(document.querySelectorAll('[data-damage-part]'));
  moveCursorReticle(cursorAim.screenX, cursorAim.screenY);
  setPilotMode(pilotMode, true);
};

launch = function launchOverride() {
  started = true;
  ui.launch.classList.add('hidden');
  ui.hud.classList.add('active');
  setPilotMode(pilotMode, true);
  ui.message.textContent = pilotMode === 'cursor'
    ? 'Cursor flight live. Point where you want the jet to go; throttle, gear, flaps, and brakes stay on the keyboard.'
    : 'Keyboard flight live. Arrow keys pitch and roll with fly-by-wire assist.';
};

bindInput = function bindInputOverride() {
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', updateCursorAim, { passive: true });
  window.addEventListener('pointerleave', () => { cursorAim.active = false; });
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
  ui.pilotButtons.forEach((button) => button.addEventListener('click', () => setPilotMode(button.dataset.pilotMode)));
  ui.quality.addEventListener('click', () => {
    settings.quality = settings.quality === 'cinematic' ? 'balanced' : 'cinematic';
    ui.quality.textContent = settings.quality === 'cinematic' ? 'Cinematic' : 'Balanced';
    rebuildForestForQuality();
  });
  setPilotMode('cursor', true);
};

resetAircraft = function resetAircraftOverride(first) {
  aircraft.pos.set(-7600, terrainHeight(-7600, 0) + 1380, 0);
  aircraft.quat.setFromEuler(new THREE.Euler(0.035, -Math.PI / 2, 0, 'XYZ'));
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat);
  aircraft.vel.copy(forward.multiplyScalar(138));
  aircraft.vel.y = 0.35;
  aircraft.angular.set(0, 0, 0);
  aircraft.controls.pitch = 0;
  aircraft.controls.roll = 0;
  aircraft.controls.yaw = 0;
  aircraft.throttle = 0.82;
  aircraft.flaps = 0.25;
  aircraft.flapsTarget = 0.25;
  aircraft.gear = 1;
  aircraft.gearTarget = 1;
  aircraft.brakes = 0;
  aircraft.trim = 0.052;
  aircraft.alive = true;
  aircraft.contactRecorded = false;
  Object.keys(aircraft.damage).forEach((part) => { aircraft.damage[part] = 0; });
  aircraft.damageMarks.clear();
  aircraft.group.visible = true;
  aircraft.group.position.copy(aircraft.pos);
  aircraft.group.quaternion.copy(aircraft.quat);
  cursorAim.active = true;
  updateDamageUi();
  setPilotMode(pilotMode, true);
  if (!first) ui.message.textContent = 'New airframe spawned higher, faster, and stabilized for another try.';
};

readControls = function readControlsOverride(dt) {
  if (keys.has('KeyW')) aircraft.throttle += dt * 0.34;
  if (keys.has('KeyS')) aircraft.throttle -= dt * 0.38;
  aircraft.throttle = THREE.MathUtils.clamp(aircraft.throttle, 0, 1);
  aircraft.brakes = keys.has('KeyB') || keys.has('Space') ? 1 : 0;

  if (pilotMode === 'keyboard') {
    aircraft.controls.pitch = smoothControl(aircraft.controls.pitch, keyAxis('ArrowUp', 'ArrowDown'), dt, 5.8);
    aircraft.controls.roll = smoothControl(aircraft.controls.roll, keyAxis('ArrowRight', 'ArrowLeft'), dt, 6.4);
    aircraft.controls.yaw = smoothControl(aircraft.controls.yaw, keyAxis('KeyD', 'KeyA'), dt, 5.2);
    return;
  }

  const t = performance.now() * 0.001;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quat).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quat).normalize();
  const wind = currentWind(t, aircraft.pos);
  const airspeed = Math.max(0.1, aircraft.vel.clone().sub(wind).length());
  const pitchNow = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
  const rollNow = Math.atan2(right.y, up.y);
  const ground = terrainHeight(aircraft.pos.x, aircraft.pos.z);
  const clearance = aircraft.pos.y - ground;
  let headingError = cursorAim.x * 0.62;
  const groundPoint = cursorGroundPoint();

  if (groundPoint) {
    const toTarget = groundPoint.clone().sub(aircraft.pos);
    toTarget.y = 0;
    const flatForward = forward.clone();
    flatForward.y = 0;
    if (toTarget.lengthSq() > 400 && flatForward.lengthSq() > 0.001) {
      toTarget.normalize();
      flatForward.normalize();
      const cross = flatForward.x * toTarget.z - flatForward.z * toTarget.x;
      const dot = THREE.MathUtils.clamp(flatForward.dot(toTarget), -1, 1);
      headingError = THREE.MathUtils.clamp(Math.atan2(cross, dot), -1.1, 1.1);
    }
  }

  let targetPitch = THREE.MathUtils.clamp(-cursorAim.y * 0.24 + 0.04, -0.13, 0.31);
  if (clearance < 260) targetPitch = Math.max(targetPitch, 0.12 + (260 - clearance) * 0.00115);
  if (airspeed < 86) targetPitch = Math.min(targetPitch, 0.11);
  if (airspeed > 180 && cursorAim.y > 0.25) targetPitch = Math.max(targetPitch, -0.07);

  const targetRoll = THREE.MathUtils.clamp(headingError * 0.82 + cursorAim.x * 0.18, -0.68, 0.68);
  const pitchCommand = THREE.MathUtils.clamp((targetPitch - pitchNow) * 3.6 - aircraft.angular.x * 0.68, -1, 1);
  const rollCommand = THREE.MathUtils.clamp((targetRoll - rollNow) * 2.4 - aircraft.angular.z * 0.58, -1, 1);
  const yawCommand = THREE.MathUtils.clamp(headingError * 0.52 - aircraft.angular.y * 0.34, -0.72, 0.72);

  aircraft.controls.pitch = smoothControl(aircraft.controls.pitch, pitchCommand, dt, 7.4);
  aircraft.controls.roll = smoothControl(aircraft.controls.roll, rollCommand, dt, 7.8);
  aircraft.controls.yaw = smoothControl(aircraft.controls.yaw, yawCommand, dt, 5.8);
};

updateLightning = function updateLightningOverride(dt) {
  lightningFlash = Math.max(0, lightningFlash - dt * 2.35);
  if (lightningLight) lightningLight.intensity = lightningFlash * 12;
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const bolt = lightningBolts[i];
    bolt.life -= dt;
    const p = THREE.MathUtils.clamp(bolt.life / Math.max(0.001, bolt.maxLife || 0.5), 0, 1);
    bolt.line.children.forEach((child) => {
      if (child.material) child.material.opacity = (child.userData.baseOpacity || 1) * p;
      if (child.userData.kind === 'shock') child.scale.setScalar(1 + (1 - p) * 5.8);
      if (child.isPointLight) child.intensity = 7 * p;
    });
    if (bolt.life <= 0) {
      lightningGroup.remove(bolt.line);
      disposeObject3D(bolt.line);
      lightningBolts.splice(i, 1);
    }
  }
};

triggerLightning = function triggerLightningOverride(t) {
  const mode = weatherModes[settings.weather];
  const hitChance = settings.weather === 'lightning' ? 0.82 : settings.weather === 'hurricane' ? 0.34 : 0.46;
  const hitPlane = started && aircraft.alive && seededRandom(t * 19.73 + aircraft.pos.x) < hitChance;
  const parts = ['leftEngine', 'rightEngine', 'leftWing', 'rightWing', 'tail', 'hull', 'gear', 'nose'];
  const part = hitPlane ? parts[Math.floor(seededRandom(t * 11.3) * parts.length)] : null;
  const target = hitPlane ? partWorldPoint(part) : new THREE.Vector3(
    aircraft.pos.x + (seededRandom(t * 2.1) - 0.5) * 3600,
    terrainHeight(aircraft.pos.x, aircraft.pos.z) + 60,
    aircraft.pos.z + (seededRandom(t * 3.4) - 0.5) * 3600
  );
  const start = target.clone().add(new THREE.Vector3(
    (seededRandom(t) - 0.5) * 1100,
    2800 + seededRandom(t + 4) * 2500,
    (seededRandom(t + 8) - 0.5) * 1100
  ));

  createLightningBolt(start, target, hitPlane, part);
  lightningFlash = hitPlane ? 1.35 : 1;
  lightningLight.position.copy(target);

  if (hitPlane) {
    const base = part.includes('Engine') ? 0.46 : part.includes('Wing') ? 0.36 : part === 'tail' ? 0.34 : 0.28;
    const severity = base + seededRandom(t * 7.1) * (part.includes('Engine') ? 0.34 : 0.26);
    applyDamage(part, severity, `${damageLabels[part]} lightning strike`);
    if (part.includes('Engine')) applyDamage(part === 'leftEngine' ? 'leftWing' : 'rightWing', 0.1 + seededRandom(t * 3.2) * 0.12, 'pylon arc burn');
    if (part !== 'hull' && seededRandom(t * 5.9) > 0.48) applyDamage('hull', 0.1 + seededRandom(t * 2.7) * 0.18, 'airframe electrical surge');
    spawnElectricalBurst(target, part);
    if (part.includes('Engine')) spawnEngineSurge(part);
    ui.message.textContent = `Lightning hit ${damageLabels[part]}: ${damageDetail(part, aircraft.damage[part])}.`;
  } else {
    ui.message.textContent = `${mode.label} discharge nearby.`;
  }

  lightningTimer = settings.weather === 'lightning' ? 2.0 + seededRandom(t * 5) * 3.6 : 4.0 + seededRandom(t * 5) * 5.4;
};

createLightningBolt = function createLightningBoltOverride(start, end, hitPlane, targetPart) {
  const group = new THREE.Group();
  group.userData.hitPart = targetPart || 'ground';
  const segments = hitPlane ? 18 : 14;
  const main = buildJaggedPoints(start, end, segments, hitPlane ? 92 : 170, end.x + end.z);
  addBoltLine(group, main, hitPlane ? 0xf3ffff : 0xafe9ff, 1, 0);
  addBoltLine(group, buildJaggedPoints(start, end, segments, hitPlane ? 44 : 86, end.y + 23), 0x6af4ff, 0.52, 2);

  const branchCount = hitPlane ? 8 : 5;
  for (let i = 0; i < branchCount; i++) {
    const anchorIndex = 2 + Math.floor(seededRandom(end.x * 0.01 + i * 13.7) * (main.length - 4));
    const anchor = main[anchorIndex];
    const dir = new THREE.Vector3(
      seededRandom(i * 8.3 + end.x) - 0.5,
      -0.15 - seededRandom(i * 6.2 + end.y) * 0.45,
      seededRandom(i * 9.1 + end.z) - 0.5
    ).normalize().multiplyScalar(hitPlane ? 150 + i * 18 : 260 + i * 24);
    addBoltLine(group, buildJaggedPoints(anchor, anchor.clone().add(dir), 5, hitPlane ? 34 : 72, i * 41.2 + end.z), i % 2 ? 0xd6ffff : 0x74dfff, 0.62, 10 + i);
  }

  if (hitPlane) {
    const shock = new THREE.Mesh(
      new THREE.RingGeometry(24, 58, 64),
      new THREE.MeshBasicMaterial({ color: 0xbdfdff, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    shock.position.copy(end);
    shock.rotation.x = -Math.PI / 2;
    shock.userData.kind = 'shock';
    shock.userData.baseOpacity = 0.68;
    group.add(shock);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(28, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flash.position.copy(end);
    flash.userData.baseOpacity = 0.5;
    group.add(flash);
  }

  const light = new THREE.PointLight(hitPlane ? 0xcffcff : 0x9fd6ff, hitPlane ? 7 : 4.5, hitPlane ? 1200 : 820, 2);
  light.position.copy(end);
  group.add(light);
  lightningGroup.add(group);
  lightningBolts.push({ line: group, life: hitPlane ? 0.62 : 0.42, maxLife: hitPlane ? 0.62 : 0.42 });
};

updateDamageUi = function updateDamageUiOverride(reason) {
  const damaged = Object.entries(aircraft.damage).filter(([, value]) => value > 0.04);
  const total = damageTotal();
  if (ui.damageVignette) {
    ui.damageVignette.classList.toggle('active', total > 0.04);
    ui.damageVignette.classList.toggle('critical', total > 1.12 || aircraft.damage.leftEngine > 0.58 || aircraft.damage.rightEngine > 0.58 || aircraft.damage.tail > 0.68);
    ui.damageVignette.style.setProperty('--damage-alpha', Math.min(0.92, total / 3.2).toFixed(2));
  }
  if (ui.damagePanel) ui.damagePanel.classList.toggle('active', total > 0.04);
  ui.damageParts.forEach((node) => {
    const value = aircraft.damage[node.dataset.damagePart] || 0;
    node.classList.toggle('damaged', value > 0.04);
    node.dataset.severity = value > 0.64 ? 'critical' : value > 0.32 ? 'medium' : value > 0.04 ? 'low' : 'green';
  });
  if (ui.damageList) {
    ui.damageList.innerHTML = damaged.length === 0
      ? '<li><span>all systems<em>green</em></span><strong>0%</strong></li>'
      : damaged
        .sort((a, b) => b[1] - a[1])
        .map(([part, value]) => `<li><span>${damageLabels[part]}<em>${damageDetail(part, value)}</em></span><strong>${Math.round(value * 100)}%</strong></li>`)
        .join('');
  }
  if (reason && total > 0.04) ui.message.textContent = `Damage: ${reason}. ${damageConsequence()}`;
};

createAttemptMarker = function createAttemptMarkerOverride(item) {
  if (item.type === 'landing') {
    const marker = new THREE.Mesh(new THREE.RingGeometry(30, 46, 32), new THREE.MeshBasicMaterial({ color: 0x9dffcb, transparent: true, opacity: 0.75 }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(item.x, terrainHeight(item.x, item.z) + 3.2, item.z);
    scene.add(marker);
    const trail = new THREE.Mesh(new THREE.BoxGeometry(260, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xc8ffdf, transparent: true, opacity: 0.42 }));
    trail.position.set(item.x - 80, terrainHeight(item.x, item.z) + 2.6, item.z);
    scene.add(trail);
    return;
  }
  createExplosionMarker(item);
};

updateFires = function updateFiresOverride(t) {
  updateTransientEffects();
  for (let i = fireGroups.length - 1; i >= 0; i--) {
    const item = fireGroups[i];
    if (item.isMesh && item.userData.birth) {
      const age = (performance.now() - item.userData.birth) / 1000;
      item.position.y += 3.4 * 0.016;
      item.scale.setScalar(1 + age * 0.5);
      item.material.opacity = Math.max(0, 0.18 - age * 0.035);
      if (age > 5) {
        scene.remove(item);
        disposeObject3D(item);
        fireGroups.splice(i, 1);
      }
      continue;
    }
    item.children.forEach((child, childIndex) => {
      if (child.isMesh) {
        if (child.userData.kind === 'scorch') return;
        const pulse = 1 + Math.sin(t * (4.8 + childIndex * 0.2) + (child.userData.phase || 0)) * 0.16;
        child.scale.setScalar(pulse);
        if (child.userData.kind === 'smoke' || child.geometry.type === 'SphereGeometry') {
          child.position.x += Math.sin(t * 0.4 + childIndex) * 0.015;
          child.material.opacity = 0.1 + Math.sin(t * 0.9 + childIndex) * 0.035;
        }
        if (child.userData.kind === 'flame') child.material.opacity = 0.68 + Math.sin(t * 7.0 + childIndex) * 0.12;
      }
      if (child.isPointLight) child.intensity = 1.15 + Math.sin(t * 8 + i) * 0.48;
    });
  }
};

updateHud = function updateHudOverride() {
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
  if (ui.pilotModeLabel) ui.pilotModeLabel.textContent = pilotMode === 'cursor' ? 'Cursor' : 'Keyboard';
  ui.readout.textContent = `${Math.max(1, Math.round(1000 / frameAverage))} fps | ${cameraModeName()} | ${pilotMode} | trim ${aircraft.trim.toFixed(2)} | damage ${Math.round(damageTotal() * 100)}%`;
};

function installCursorAndDamageStyles() {
  if (document.getElementById('cursorFlightStyles')) return;
  const style = document.createElement('style');
  style.id = 'cursorFlightStyles';
  style.textContent = `
    .pilot-stack strong { color: rgba(221, 252, 255, 0.96); }
    .segment.pilot-mode button.active { color: #061317; background: linear-gradient(135deg, rgba(151,250,255,0.96), rgba(220,255,244,0.88)); box-shadow: 0 0 24px rgba(102,235,255,0.3); }
    .cursor-reticle { position: fixed; left: 50%; top: 44%; width: 54px; height: 54px; z-index: 4; pointer-events: none; opacity: 0; transform: translate(-50%, -50%); transition: opacity 180ms ease; mix-blend-mode: screen; }
    .cursor-reticle.active { opacity: 0.82; }
    .cursor-reticle::before, .cursor-reticle::after { content: ''; position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(159,247,255,0.78); box-shadow: 0 0 18px rgba(84,226,255,0.32), inset 0 0 18px rgba(84,226,255,0.16); }
    .cursor-reticle::after { inset: 18px; border-color: rgba(255,255,255,0.74); animation: cursorPulse 1.2s ease-in-out infinite; }
    .cursor-reticle span { position: absolute; left: 50%; top: 50%; width: 76px; height: 1px; transform: translate(-50%, -50%); background: linear-gradient(90deg, transparent, rgba(175,247,255,0.7), transparent); }
    .cursor-reticle span + span { transform: translate(-50%, -50%) rotate(90deg); }
    .damage-vignette.active { background: radial-gradient(ellipse at center, transparent 42%, rgba(255,22,46,calc(var(--damage-alpha) * 0.82)) 100%), linear-gradient(90deg, rgba(255,37,55,calc(var(--damage-alpha) * 0.72)), transparent 20%, transparent 80%, rgba(255,37,55,calc(var(--damage-alpha) * 0.72))), linear-gradient(0deg, rgba(255,37,55,calc(var(--damage-alpha) * 0.58)), transparent 18%, transparent 78%, rgba(255,37,55,calc(var(--damage-alpha) * 0.42))); }
    .damage-vignette.critical::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(135deg, rgba(255,52,61,0.12) 0 12px, transparent 12px 30px); opacity: 0.65; animation: warningScan 0.9s linear infinite; }
    .damage-part[data-severity='medium'] { border-color: rgba(255,171,64,0.96); background: rgba(255,128,36,0.36); box-shadow: 0 0 18px rgba(255,146,39,0.68), inset 0 0 14px rgba(255,255,255,0.18); }
    .damage-part[data-severity='critical'] { border-color: rgba(255,55,79,1); background: rgba(255,15,46,0.58); box-shadow: 0 0 24px rgba(255,35,55,0.86), inset 0 0 18px rgba(255,255,255,0.24); }
    .damage-list li span { display: grid; gap: 1px; }
    .damage-list li em { font-style: normal; font-size: 10px; color: rgba(255,218,222,0.62); }
    @keyframes cursorPulse { 0%, 100% { transform: translate(-50%, -50%) scale(0.88); opacity: 0.54; } 50% { transform: translate(-50%, -50%) scale(1.28); opacity: 1; } }
    @keyframes warningScan { from { background-position: 0 0; } to { background-position: 48px 48px; } }
    @media (max-width: 760px) { .cursor-reticle { width: 44px; height: 44px; } }
  `;
  document.head.appendChild(style);
}

function installPilotControls() {
  const systems = document.querySelector('.systems');
  if (systems && !document.getElementById('pilotModeSegment')) {
    const stack = document.createElement('div');
    stack.className = 'stack pilot-stack';
    stack.innerHTML = '<label>Pilot</label><strong id="pilotModeValue">Cursor</strong>';
    const segment = document.createElement('div');
    segment.id = 'pilotModeSegment';
    segment.className = 'segment pilot-mode';
    segment.setAttribute('aria-label', 'Pilot mode');
    segment.innerHTML = '<button type="button" data-pilot-mode="cursor">Cursor</button><button type="button" data-pilot-mode="keyboard">Keyboard</button>';
    const firstSegment = systems.querySelector('.segment');
    systems.insertBefore(stack, firstSegment);
    systems.insertBefore(segment, firstSegment);
  }

  const weatherSegment = Array.from(document.querySelectorAll('.systems .segment')).find((segment) => segment.getAttribute('aria-label') === 'Weather');
  if (weatherSegment && !document.querySelector('[data-weather=lightning]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.weather = 'lightning';
    button.textContent = 'Lightning';
    weatherSegment.insertBefore(button, weatherSegment.querySelector('[data-weather=hurricane]'));
  }
}

function installCursorReticle() {
  const hud = document.getElementById('hud');
  if (!hud || document.getElementById('cursorReticle')) return;
  const reticle = document.createElement('div');
  reticle.id = 'cursorReticle';
  reticle.className = 'cursor-reticle';
  reticle.setAttribute('aria-hidden', 'true');
  reticle.append(document.createElement('span'), document.createElement('span'));
  hud.appendChild(reticle);
}

function setPilotMode(mode, silent = false) {
  pilotMode = mode === 'keyboard' ? 'keyboard' : 'cursor';
  if (ui.pilotModeLabel) ui.pilotModeLabel.textContent = pilotMode === 'cursor' ? 'Cursor' : 'Keyboard';
  (ui.pilotButtons || []).forEach((button) => button.classList.toggle('active', button.dataset.pilotMode === pilotMode));
  if (ui.cursorReticle) ui.cursorReticle.classList.toggle('active', pilotMode === 'cursor' && started);
  if (!silent && ui.message) {
    ui.message.textContent = pilotMode === 'cursor'
      ? 'Cursor mode selected. Aim the reticle and the jet will bank toward it.'
      : 'Keyboard mode selected. Arrow keys and rudder keys are direct controls.';
  }
}

function updateCursorAim(event) {
  cursorAim.screenX = event.clientX;
  cursorAim.screenY = event.clientY;
  cursorAim.x = THREE.MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
  cursorAim.y = THREE.MathUtils.clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
  cursorAim.active = true;
  moveCursorReticle(event.clientX, event.clientY);
}

function moveCursorReticle(x, y) {
  if (!ui.cursorReticle) return;
  ui.cursorReticle.style.left = `${x}px`;
  ui.cursorReticle.style.top = `${y}px`;
}

function cursorGroundPoint() {
  if (!cursorAim.active) return null;
  cursorNdc.set(cursorAim.x, -cursorAim.y);
  cursorRaycaster.setFromCamera(cursorNdc, camera);
  cursorGroundPlane.constant = -terrainHeight(aircraft.pos.x, aircraft.pos.z);
  return cursorRaycaster.ray.intersectPlane(cursorGroundPlane, cursorGround) ? cursorGround : null;
}

function partWorldPoint(part) {
  const p = lightningPartPoints[part] || lightningPartPoints.hull;
  return aircraft.group.localToWorld(new THREE.Vector3(p[0], p[1], p[2]));
}

function buildJaggedPoints(start, end, segments, jitter, seed) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const p = start.clone().lerp(end, f);
    const falloff = 1 - Math.abs(f - 0.5) * 1.55;
    p.x += (seededRandom(seed + i * 8.1) - 0.5) * jitter * falloff;
    p.y += (seededRandom(seed + i * 5.3) - 0.5) * jitter * 0.16 * falloff;
    p.z += (seededRandom(seed + i * 12.2) - 0.5) * jitter * falloff;
    points.push(p);
  }
  return points;
}

function addBoltLine(group, points, color, opacity, seed) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  line.userData.baseOpacity = opacity;
  line.userData.seed = seed;
  group.add(line);
}

function spawnElectricalBurst(position, part) {
  const burst = new THREE.Group();
  burst.position.copy(position);
  const count = part && part.includes('Engine') ? 24 : 18;
  for (let i = 0; i < count; i++) {
    const end = new THREE.Vector3(
      (seededRandom(position.x + i * 3.2) - 0.5) * 95,
      (seededRandom(position.y + i * 4.7) - 0.35) * 80,
      (seededRandom(position.z + i * 5.1) - 0.5) * 95
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), end]),
      new THREE.LineBasicMaterial({ color: i % 3 ? 0x8cf7ff : 0xffffff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    line.userData.baseOpacity = 0.72;
    burst.add(line);
  }
  const light = new THREE.PointLight(0x9effff, 3.8, 420, 2);
  burst.add(light);
  lightningGroup.add(burst);
  effectGroups.push({ type: 'spark', group: burst, parent: lightningGroup, birth: performance.now() * 0.001, life: 0.9 });
}

function spawnEngineSurge(part) {
  const point = partWorldPoint(part);
  const surge = new THREE.Group();
  surge.position.copy(point);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x5cf7ff, transparent: true, opacity: 0.66, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10 + i * 4, 0.7, 8, 48), ringMat.clone());
    ring.rotation.x = Math.PI / 2;
    ring.userData.kind = 'engine-ring';
    ring.userData.baseOpacity = 0.66 - i * 0.14;
    surge.add(ring);
  }
  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(9, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7043, transparent: true, opacity: 0.54, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ember.userData.kind = 'engine-ember';
  surge.add(ember);
  scene.add(surge);
  effectGroups.push({ type: 'engineSurge', group: surge, parent: scene, birth: performance.now() * 0.001, life: 1.4 });
}

function createExplosionMarker(item) {
  const groundY = terrainHeight(item.x, item.z) + 2.4;
  const fire = new THREE.Group();
  fire.position.set(item.x, groundY, item.z);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(125, 64), new THREE.MeshBasicMaterial({ color: 0x050303, transparent: true, opacity: 0.5, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2;
  scorch.userData.kind = 'scorch';
  fire.add(scorch);

  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6d17, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff0a6, transparent: true, opacity: 0.76, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 18; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(9 + i * 0.9, 42 + seededRandom(i) * 58, 8), i % 3 === 0 ? coreMat.clone() : flameMat.clone());
    flame.position.set((seededRandom(i * 11) - 0.5) * 82, 16 + seededRandom(i * 9) * 46, (seededRandom(i * 17) - 0.5) * 82);
    flame.rotation.z = (seededRandom(i * 4) - 0.5) * 0.72;
    flame.userData.phase = seededRandom(i * 5) * Math.PI * 2;
    flame.userData.kind = 'flame';
    fire.add(flame);
  }

  for (let i = 0; i < 12; i++) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(24 + i * 5, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x161819, transparent: true, opacity: 0.17, depthWrite: false })
    );
    smoke.position.set((seededRandom(i * 13) - 0.5) * 96, 58 + i * 24, (seededRandom(i * 23) - 0.5) * 96);
    smoke.userData.phase = seededRandom(i * 29) * Math.PI * 2;
    smoke.userData.kind = 'smoke';
    fire.add(smoke);
  }

  const light = new THREE.PointLight(0xff6418, 1.6, 620, 2);
  light.position.y = 46;
  fire.add(light);
  fireGroups.push(fire);
  scene.add(fire);

  const blast = new THREE.Group();
  blast.position.set(item.x, groundY + 4, item.z);
  const shock = new THREE.Mesh(
    new THREE.RingGeometry(28, 84, 80),
    new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  shock.rotation.x = -Math.PI / 2;
  shock.userData.kind = 'shock';
  shock.userData.baseOpacity = 0.72;
  blast.add(shock);

  const fireball = new THREE.Mesh(
    new THREE.SphereGeometry(52, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xffa03a, transparent: true, opacity: 0.66, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  fireball.position.y = 54;
  fireball.userData.kind = 'fireball';
  fireball.userData.baseOpacity = 0.66;
  blast.add(fireball);

  for (let i = 0; i < 24; i++) {
    const debris = new THREE.Mesh(
      new THREE.BoxGeometry(4 + seededRandom(i) * 8, 1.8 + seededRandom(i + 2) * 4, 8 + seededRandom(i + 4) * 14),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2a2d30 : 0x5b3222, roughness: 0.74, metalness: 0.22 })
    );
    debris.position.set((seededRandom(i * 2.1) - 0.5) * 32, 18 + seededRandom(i * 3.1) * 26, (seededRandom(i * 4.1) - 0.5) * 32);
    debris.userData.kind = 'debris';
    debris.userData.velocity = new THREE.Vector3((seededRandom(i * 7.1) - 0.5) * 210, 95 + seededRandom(i * 8.7) * 155, (seededRandom(i * 9.3) - 0.5) * 210);
    debris.userData.spin = new THREE.Vector3(seededRandom(i) * 5, seededRandom(i + 1) * 5, seededRandom(i + 2) * 5);
    blast.add(debris);
  }

  scene.add(blast);
  effectGroups.push({ type: 'explosion', group: blast, parent: scene, birth: performance.now() * 0.001, last: performance.now() * 0.001, life: 2.2 });
}

function updateTransientEffects() {
  const now = performance.now() * 0.001;
  for (let i = effectGroups.length - 1; i >= 0; i--) {
    const effect = effectGroups[i];
    const age = now - effect.birth;
    const p = THREE.MathUtils.clamp(age / effect.life, 0, 1);
    const dt = Math.min(0.05, now - (effect.last || now));
    effect.last = now;
    effect.group.children.forEach((child, index) => {
      if (child.material) child.material.opacity = Math.max(0, (child.userData.baseOpacity || child.material.opacity || 1) * (1 - p));
      if (child.userData.kind === 'shock') child.scale.setScalar(1 + p * (effect.type === 'explosion' ? 10 : 4.8));
      if (child.userData.kind === 'fireball') {
        child.scale.setScalar(1 + p * 4.8);
        child.position.y += dt * 28;
      }
      if (child.userData.kind === 'debris') {
        child.userData.velocity.y -= 85 * dt;
        child.position.addScaledVector(child.userData.velocity, dt);
        child.rotation.x += child.userData.spin.x * dt;
        child.rotation.y += child.userData.spin.y * dt;
        child.rotation.z += child.userData.spin.z * dt;
      }
      if (child.userData.kind === 'engine-ring') {
        child.scale.setScalar(1 + p * (2.2 + index * 0.7));
        child.rotation.z += dt * (3 + index);
      }
      if (child.userData.kind === 'engine-ember') child.scale.setScalar(1 + p * 2.4);
      if (child.isLine) child.scale.setScalar(1 + p * 0.9);
      if (child.isPointLight) child.intensity = 3.8 * (1 - p);
    });

    if (age >= effect.life) {
      (effect.parent || scene).remove(effect.group);
      disposeObject3D(effect.group);
      effectGroups.splice(i, 1);
    }
  }
}

function damageDetail(part, value) {
  if (part === 'leftEngine' || part === 'rightEngine') return value > 0.64 ? 'compressor surge, thrust loss' : 'fan arc and pylon scorch';
  if (part === 'leftWing' || part === 'rightWing') return value > 0.64 ? 'spar damage, lift loss' : 'skin scorch, lift penalty';
  if (part === 'hull') return value > 0.64 ? 'airframe breach, drag rise' : 'skin burn and electrical path';
  if (part === 'tail') return value > 0.64 ? 'stability loss, heavy trim' : 'elevator and rudder noise';
  if (part === 'gear') return value > 0.64 ? 'hydraulic failure risk' : 'door and strut arcing';
  return value > 0.64 ? 'avionics bay disruption' : 'radome scorch';
}

function damageConsequence() {
  if (aircraft.damage.leftEngine > 0.58 || aircraft.damage.rightEngine > 0.58) return 'Engine thrust is asymmetric and descent risk is rising.';
  if (aircraft.damage.tail > 0.62) return 'Tail authority is degraded; keep pitch changes small.';
  if (aircraft.damage.leftWing + aircraft.damage.rightWing > 0.9) return 'Wing lift is uneven; expect rolling pull.';
  if (damageTotal() > 1.2) return 'Airframe is unstable and sinking tendency is increasing.';
  return 'Lift and control margins are reduced.';
}

function disposeObject3D(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

ensureHudAdditions();
