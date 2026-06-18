const STARTING_THRUST = 0.82;
let pilotModeChosen = false;
let selectedThrottle = STARTING_THRUST;

const baseEnsureHudAdditions = ensureHudAdditions;
const baseResetAircraft = resetAircraft;
const baseUpdateHud = updateHud;

setPilotMode = function setPilotModeWithSelection(mode, silent = false, choose = false) {
  pilotMode = mode === 'keyboard' ? 'keyboard' : 'cursor';
  if (choose) pilotModeChosen = true;

  const label = pilotModeLabel();
  if (ui.pilotModeLabel) ui.pilotModeLabel.textContent = pilotModeChosen ? label : 'Select';
  (ui.pilotButtons || []).forEach((button) => {
    const active = pilotModeChosen && button.dataset.pilotMode === pilotMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (ui.cursorReticle) ui.cursorReticle.classList.toggle('active', pilotMode === 'cursor' && started);
  syncLaunchState();

  if (!silent && ui.message) {
    ui.message.textContent = pilotMode === 'cursor'
      ? 'Cursor mode selected. Point left or right to choose heading; pitch stays stabilized by trim.'
      : 'Full keyboard selected. Arrow keys pitch and roll, A/D controls rudder.';
  }
};

launch = function launchWithPreflightSelection() {
  if (!pilotModeChosen) {
    if (ui.launchHint) ui.launchHint.textContent = 'Choose Cursor or Full Keyboard first';
    if (ui.start) ui.start.textContent = 'Select Pilot Mode';
    return;
  }

  started = true;
  selectedThrottle = THREE.MathUtils.clamp(selectedThrottle, 0, 1);
  aircraft.throttle = selectedThrottle;
  syncThrottleControls(aircraft.throttle);
  ui.launch.classList.add('hidden');
  ui.hud.classList.add('active');
  setPilotMode(pilotMode, true, false);
  ui.message.textContent = pilotMode === 'cursor'
    ? 'Cursor flight live. Point left or right for heading; set thrust with the slider or W/S.'
    : 'Full keyboard flight live. Set thrust with the slider or W/S.';
};

bindInput = function bindInputWithPreflightControls() {
  refreshFlightControlUi();
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
  ui.pilotButtons.forEach((button) => button.addEventListener('click', () => setPilotMode(button.dataset.pilotMode, false, true)));
  ui.throttleInputs.forEach((input) => input.addEventListener('input', () => setThrottleFromPercent(input.value, false)));
  ui.quality.addEventListener('click', () => {
    settings.quality = settings.quality === 'cinematic' ? 'balanced' : 'cinematic';
    ui.quality.textContent = settings.quality === 'cinematic' ? 'Cinematic' : 'Balanced';
    rebuildForestForQuality();
  });
  setPilotMode(pilotMode, true, false);
  syncThrottleControls(selectedThrottle);
};

resetAircraft = function resetAircraftWithSelectedThrottle(first) {
  baseResetAircraft(first);
  aircraft.throttle = selectedThrottle;
  syncThrottleControls(aircraft.throttle);
  setPilotMode(pilotMode, true, false);
};

readControls = function readControlsHeadingOnlyCursor(dt) {
  const beforeThrottle = aircraft.throttle;
  if (keys.has('KeyW')) aircraft.throttle += dt * 0.34;
  if (keys.has('KeyS')) aircraft.throttle -= dt * 0.38;
  aircraft.throttle = THREE.MathUtils.clamp(aircraft.throttle, 0, 1);
  if (Math.abs(aircraft.throttle - beforeThrottle) > 0.0001) {
    selectedThrottle = aircraft.throttle;
    syncThrottleControls(aircraft.throttle);
  }
  aircraft.brakes = keys.has('KeyB') || keys.has('Space') ? 1 : 0;

  if (pilotMode === 'keyboard') {
    aircraft.controls.pitch = smoothControl(aircraft.controls.pitch, keyAxis('ArrowUp', 'ArrowDown'), dt, 5.8);
    aircraft.controls.roll = smoothControl(aircraft.controls.roll, keyAxis('ArrowRight', 'ArrowLeft'), dt, 6.4);
    aircraft.controls.yaw = smoothControl(aircraft.controls.yaw, keyAxis('KeyD', 'KeyA'), dt, 5.2);
    return;
  }

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quat).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quat).normalize();
  const rollNow = Math.atan2(right.y, up.y);
  let headingError = cursorAim.x * 0.72;
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
      headingError = THREE.MathUtils.clamp(Math.atan2(cross, dot), -1.05, 1.05);
    }
  }

  headingError = applyInputDeadzone(headingError, 0.035);
  const targetRoll = THREE.MathUtils.clamp(headingError * 0.86 + cursorAim.x * 0.08, -0.56, 0.56);
  const rollCommand = THREE.MathUtils.clamp((targetRoll - rollNow) * 2.65 - aircraft.angular.z * 0.64, -1, 1);
  const yawCommand = THREE.MathUtils.clamp(headingError * 0.45 - aircraft.angular.y * 0.34, -0.62, 0.62);

  aircraft.controls.pitch = smoothControl(aircraft.controls.pitch, 0, dt, 6.2);
  aircraft.controls.roll = smoothControl(aircraft.controls.roll, rollCommand, dt, 7.4);
  aircraft.controls.yaw = smoothControl(aircraft.controls.yaw, yawCommand, dt, 5.8);
};

updateHud = function updateHudWithControlState() {
  baseUpdateHud();
  if (ui.pilotModeLabel) ui.pilotModeLabel.textContent = pilotModeChosen ? pilotModeLabel() : 'Select';
  syncThrottleControls(aircraft.throttle);
  const modeLabel = pilotModeChosen ? (pilotMode === 'cursor' ? 'cursor heading' : 'full keyboard') : 'select mode';
  ui.readout.textContent = `${Math.max(1, Math.round(1000 / frameAverage))} fps | ${cameraModeName()} | ${modeLabel} | trim ${aircraft.trim.toFixed(2)} | damage ${Math.round(damageTotal() * 100)}%`;
};

ensureHudAdditions = function ensureHudAdditionsWithFlightControls() {
  baseEnsureHudAdditions();
  installFlightControlUpdateStyles();
  installPreflightControls();
  installHudThrottleControl();
  refreshFlightControlUi();
  setPilotMode(pilotMode, true, false);
  syncThrottleControls(selectedThrottle);
};

ensureHudAdditions();

function installFlightControlUpdateStyles() {
  if (document.getElementById('flightControlUpdateStyles')) return;
  const style = document.createElement('style');
  style.id = 'flightControlUpdateStyles';
  style.textContent = `
    .flight-setup { display: grid; gap: 14px; max-width: 620px; }
    .setup-row, .hud-throttle-control { display: grid; grid-template-columns: minmax(96px, auto) minmax(180px, 1fr) auto; gap: 12px; align-items: center; }
    .setup-row > span, .hud-throttle-control span { color: rgba(236, 247, 255, 0.72); font-size: 13px; text-transform: uppercase; }
    .preflight-mode { padding: 0; }
    .preflight-mode button { min-width: 118px; }
    .primary-button:disabled { cursor: not-allowed; opacity: 0.58; box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 12px 32px rgba(0,0,0,0.18); }
    .primary-button:disabled::after { animation: none; opacity: 0.24; }
    .throttle-range strong, .hud-throttle-control strong { min-width: 44px; text-align: right; color: rgba(221, 252, 255, 0.96); }
    .hud-throttle-control { padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
    input[type='range'][data-throttle-range] { width: 100%; accent-color: var(--green); cursor: pointer; }
    @media (max-width: 760px) {
      .setup-row, .hud-throttle-control { grid-template-columns: 1fr; gap: 7px; }
      .preflight-mode button { flex: 1 1 136px; }
    }
  `;
  document.head.appendChild(style);
}

function installPreflightControls() {
  const hero = document.querySelector('.hero');
  const actions = document.querySelector('.launch-actions');
  if (!hero || !actions) return;

  const hint = actions.querySelector('.hint');
  if (hint && !hint.id) hint.id = 'launchHint';
  if (!document.getElementById('preflightControls')) {
    const setup = document.createElement('div');
    setup.id = 'preflightControls';
    setup.className = 'flight-setup';
    setup.setAttribute('aria-label', 'Preflight controls');
    setup.innerHTML = `
      <div class="setup-row">
        <span>Pilot</span>
        <div class="segment pilot-mode preflight-mode" aria-label="Pilot mode">
          <button type="button" data-pilot-mode="cursor" aria-pressed="false">Cursor</button>
          <button type="button" data-pilot-mode="keyboard" aria-pressed="false">Full keyboard</button>
        </div>
        <strong id="launchPilotModeValue">Select</strong>
      </div>
      <label class="setup-row throttle-range" for="launchThrottleRange">
        <span>Start thrust</span>
        <input id="launchThrottleRange" data-throttle-range type="range" min="0" max="100" step="1" value="82" />
        <strong data-throttle-value>82%</strong>
      </label>
    `;
    hero.insertBefore(setup, actions);
  }
  if (ui.start) {
    ui.start.disabled = !pilotModeChosen;
    ui.start.textContent = pilotModeChosen ? 'Open Flight Scene' : 'Select Pilot Mode';
  }
}

function installHudThrottleControl() {
  const systems = document.querySelector('.systems');
  const throttleValue = document.getElementById('throttle');
  const throttleStack = throttleValue ? throttleValue.closest('.stack') : null;
  if (!systems || !throttleStack || document.getElementById('hudThrottleControl')) return;

  const control = document.createElement('label');
  control.id = 'hudThrottleControl';
  control.className = 'hud-throttle-control';
  control.setAttribute('for', 'hudThrottleRange');
  control.innerHTML = '<span>Thrust</span><input id="hudThrottleRange" data-throttle-range type="range" min="0" max="100" step="1" value="82" /><strong data-throttle-value>82%</strong>';
  throttleStack.insertAdjacentElement('afterend', control);
}

function refreshFlightControlUi() {
  document.querySelectorAll('[data-pilot-mode="keyboard"]').forEach((button) => { button.textContent = 'Full keyboard'; });
  ui.launchHint = document.getElementById('launchHint') || document.querySelector('.launch-actions .hint');
  ui.launchPilotModeValue = document.getElementById('launchPilotModeValue');
  ui.pilotModeLabel = document.getElementById('pilotModeValue');
  ui.pilotButtons = Array.from(document.querySelectorAll('[data-pilot-mode]'));
  ui.throttleInputs = Array.from(document.querySelectorAll('[data-throttle-range]'));
  ui.throttleValueNodes = Array.from(document.querySelectorAll('[data-throttle-value]'));
  ui.weatherButtons = Array.from(document.querySelectorAll('[data-weather]'));
  ui.timeButtons = Array.from(document.querySelectorAll('[data-time]'));
  ui.cursorReticle = document.getElementById('cursorReticle');
}

function setThrottleFromPercent(value, silent = true) {
  const next = THREE.MathUtils.clamp(Number.parseFloat(value) / 100, 0, 1);
  selectedThrottle = Number.isFinite(next) ? next : STARTING_THRUST;
  aircraft.throttle = selectedThrottle;
  syncThrottleControls(aircraft.throttle);
  if (!silent && started && ui.message) ui.message.textContent = `Thrust set to ${Math.round(aircraft.throttle * 100)}%.`;
}

function syncThrottleControls(value) {
  const percent = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 100);
  (ui.throttleInputs || []).forEach((input) => {
    if (document.activeElement !== input) input.value = String(percent);
  });
  (ui.throttleValueNodes || []).forEach((node) => { node.textContent = `${percent}%`; });
  selectedThrottle = percent / 100;
}

function syncLaunchState() {
  if (ui.launchPilotModeValue) ui.launchPilotModeValue.textContent = pilotModeChosen ? pilotModeLabel() : 'Select';
  if (ui.launchHint) ui.launchHint.textContent = pilotModeChosen ? `${pilotModeLabel()} ready` : 'Choose a pilot mode';
  if (ui.start && !started) {
    ui.start.disabled = !pilotModeChosen;
    ui.start.textContent = pilotModeChosen ? 'Open Flight Scene' : 'Select Pilot Mode';
  }
}

function pilotModeLabel() {
  return pilotMode === 'keyboard' ? 'Full Keyboard' : 'Cursor';
}

function applyInputDeadzone(value, deadzone) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
}
