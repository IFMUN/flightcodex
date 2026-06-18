installQualityFixes();

const qualityAttemptMarkers = [];
const qualityBaseLaunch = launch;
const qualityBaseUpdateHud = updateHud;
const qualityBaseHandleGroundContact = handleGroundContact;
const qualityBaseApplyWeather = applyWeather;
const qualityBaseApplyTime = applyTime;
const qualityBaseUpdateCursorAim = updateCursorAim;
const qualityBaseCreateAttemptMarker = createAttemptMarker;

launch = function launchWithQualityFixes() {
  qualityBaseLaunch();
  syncHudAccessibility();
  syncButtonPressedStates();
  if (started && canvas && typeof canvas.focus === 'function') canvas.focus({ preventScroll: true });
};

applyWeather = function applyWeatherWithPressedState(mode) {
  qualityBaseApplyWeather(mode);
  syncButtonPressedStates();
};

applyTime = function applyTimeWithPressedState(mode) {
  qualityBaseApplyTime(mode);
  syncButtonPressedStates();
};

createAttemptMarker = function createTrackedAttemptMarker(item) {
  const before = new Set(scene.children);
  qualityBaseCreateAttemptMarker(item);
  const added = scene.children.filter((child) => !before.has(child));
  if (added.length) qualityAttemptMarkers.unshift(added);
};

recordAttempt = function recordAttemptSafely(type, airspeed, note) {
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
  while (attempts.length > 36) {
    attempts.pop();
    removeAttemptMarkerGroup(qualityAttemptMarkers.pop());
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch (error) {
    ui.message.textContent = 'Attempt saved for this session, but browser storage is unavailable.';
  }
  createAttemptMarker(item);
  updateAttemptPanel();
};

updateCursorAim = function updateHeadingOnlyCursorAim(event) {
  if (isFlightUiTarget(event.target)) return;
  const lockedY = window.innerHeight * 0.5;
  cursorAim.screenX = event.clientX;
  cursorAim.screenY = lockedY;
  cursorAim.x = THREE.MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
  cursorAim.y = 0;
  cursorAim.active = true;
  moveCursorReticle(event.clientX, lockedY);
};

updateHud = function updateHudWithQualityFixes() {
  qualityBaseUpdateHud();
  if (ui.readout) {
    const cappedDamage = Math.min(100, Math.round((damageTotal() / Object.keys(aircraft.damage).length) * 100));
    ui.readout.textContent = ui.readout.textContent.replace(/damage \d+%/, `damage ${cappedDamage}%`);
  }
  syncHudAccessibility();
  syncButtonPressedStates();
};

handleGroundContact = function handleGroundContactWithQualityFixes(airspeed, forward, roll) {
  const ground = terrainHeight(aircraft.pos.x, aircraft.pos.z);
  const clearance = aircraft.gear > 0.75 ? 5.65 : 2.8;
  if (aircraft.pos.y > ground + clearance || !aircraft.alive) return;

  aircraft.pos.y = ground + clearance;
  const sink = aircraft.vel.y;
  const runway = isRunway(aircraft.pos.x, aircraft.pos.z);
  const aligned = Math.abs(forward.z) < 0.56 && Math.abs(forward.x) > 0.18;
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
    const now = performance.now() * 0.001;
    if (!aircraft.lastContact || now - aircraft.lastContact > 1.15) {
      const severity = THREE.MathUtils.clamp(0.12 + Math.abs(sink) * 0.035 + Math.max(0, airspeed - 90) * 0.002, 0.14, 0.34);
      applyDamage('gear', severity, 'runway scrape');
      aircraft.lastContact = now;
    }
    aircraft.vel.y = Math.max(0, -sink * 0.08);
    aircraft.vel.multiplyScalar(0.96);
    return;
  }

  qualityBaseHandleGroundContact(airspeed, forward, roll);
};

function installQualityFixes() {
  canvas.tabIndex = 0;
  if (ui.message) {
    ui.message.setAttribute('role', 'status');
    ui.message.setAttribute('aria-live', 'polite');
    ui.message.setAttribute('aria-atomic', 'true');
  }
  if (ui.hud) {
    ui.hud.setAttribute('aria-hidden', 'true');
    ui.hud.setAttribute('inert', '');
  }
  if (ui.start) ui.start.setAttribute('aria-describedby', 'launchHint');

  installClearAttemptsButton();
  document.addEventListener('keydown', stopFlightKeysFromControls);
  document.addEventListener('keyup', stopFlightKeysFromControls);
  document.addEventListener('pointermove', stopCursorAimFromControls);
  installQualityStyles();
  syncButtonPressedStates();
}

function installClearAttemptsButton() {
  const panel = document.querySelector('.attempts');
  const title = panel ? panel.querySelector('h2') : null;
  if (!panel || !title || document.getElementById('clearAttempts')) return;
  const button = document.createElement('button');
  button.id = 'clearAttempts';
  button.className = 'icon-button clear-attempts-button';
  button.type = 'button';
  button.textContent = 'Clear';
  button.setAttribute('aria-label', 'Clear persistent attempts');
  button.addEventListener('click', clearAttempts);
  title.insertAdjacentElement('afterend', button);
}

function clearAttempts() {
  attempts.length = 0;
  qualityAttemptMarkers.splice(0).forEach(removeAttemptMarkerGroup);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    ui.message.textContent = 'Attempts cleared for this session, but browser storage is unavailable.';
  }
  updateAttemptPanel();
  ui.message.textContent = 'Persistent attempts cleared.';
}

function removeAttemptMarkerGroup(group) {
  if (!group) return;
  group.forEach((object) => {
    scene.remove(object);
    removeFromArray(fireGroups, object);
    if (typeof effectGroups !== 'undefined') {
      for (let i = effectGroups.length - 1; i >= 0; i--) {
        if (effectGroups[i].group === object) effectGroups.splice(i, 1);
      }
    }
    disposeTrackedObject(object);
  });
}

function disposeTrackedObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function removeFromArray(items, value) {
  const index = items.indexOf(value);
  if (index >= 0) items.splice(index, 1);
}

function stopFlightKeysFromControls(event) {
  if (!isFlightUiTarget(event.target)) return;
  event.stopPropagation();
}

function stopCursorAimFromControls(event) {
  if (!isFlightUiTarget(event.target)) return;
  event.stopPropagation();
}

function isFlightUiTarget(target) {
  if (!target || target === canvas || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('button, input, select, textarea, [role="button"], [role="slider"], .panel, .launch, .keyboard'));
}

function syncHudAccessibility() {
  if (!ui.hud) return;
  ui.hud.toggleAttribute('inert', !started);
  ui.hud.setAttribute('aria-hidden', started ? 'false' : 'true');
}

function syncButtonPressedStates() {
  (ui.weatherButtons || []).forEach((button) => button.setAttribute('aria-pressed', button.dataset.weather === settings.weather ? 'true' : 'false'));
  (ui.timeButtons || []).forEach((button) => button.setAttribute('aria-pressed', button.dataset.time === settings.time ? 'true' : 'false'));
  if (ui.quality) {
    ui.quality.setAttribute('aria-pressed', settings.quality === 'cinematic' ? 'true' : 'false');
    ui.quality.setAttribute('aria-label', `Quality: ${settings.quality === 'cinematic' ? 'Cinematic' : 'Balanced'}`);
  }
}

function installQualityStyles() {
  if (document.getElementById('qualityFixStyles')) return;
  const style = document.createElement('style');
  style.id = 'qualityFixStyles';
  style.textContent = `
    .hud:not(.active) {
      visibility: hidden;
    }
    button:focus-visible,
    input[type='range']:focus-visible,
    canvas:focus-visible {
      outline: 2px solid rgba(157, 255, 203, 0.96);
      outline-offset: 3px;
    }
    .cursor-reticle {
      top: 50% !important;
      height: 34px;
    }
    .cursor-reticle::before {
      border-radius: 999px;
      transform: scaleX(1.8);
    }
    .cursor-reticle::after {
      display: none;
    }
    .clear-attempts-button {
      min-height: 28px;
      margin: 0 0 10px;
      padding: 0 10px;
      font-size: 12px;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
      }
    }
  `;
  document.head.appendChild(style);
}
