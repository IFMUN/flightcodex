const CURSOR_MAX_TURN_RATE = 0.42;
const CURSOR_MAX_ROLL = 0.12;
const CURSOR_PITCH_FLOOR = -0.015;
const CURSOR_PITCH_CEILING = 0.075;
const CURSOR_MIN_SPEED = 124;
const CURSOR_MAX_SPEED = 178;
const CURSOR_TARGET_CLEARANCE = 980;
let cursorAutopilotHeading = null;
let cursorAutopilotPitch = 0.035;

const cursorBaseSetPilotMode = setPilotMode;
const cursorBaseResetAircraft = resetAircraft;
const cursorBaseLaunch = launch;
const cursorBaseReadControls = readControls;
const cursorBaseUpdateAircraft = updateAircraft;

setPilotMode = function setPilotModeWithAutopilot(mode, silent = false, choose = false) {
  cursorBaseSetPilotMode(mode, silent, choose);
  if (pilotMode === 'cursor') captureCursorAutopilotState();
};

launch = function launchWithCursorAutopilot() {
  cursorBaseLaunch();
  if (started && pilotMode === 'cursor') captureCursorAutopilotState();
};

resetAircraft = function resetAircraftWithCursorAutopilot(first) {
  cursorBaseResetAircraft(first);
  captureCursorAutopilotState();
};

readControls = function readControlsWithStableCursor(dt) {
  if (pilotMode !== 'cursor') {
    cursorBaseReadControls(dt);
    return;
  }

  const beforeThrottle = aircraft.throttle;
  if (keys.has('KeyW')) aircraft.throttle += dt * 0.34;
  if (keys.has('KeyS')) aircraft.throttle -= dt * 0.38;
  aircraft.throttle = THREE.MathUtils.clamp(aircraft.throttle, 0, 1);
  if (Math.abs(aircraft.throttle - beforeThrottle) > 0.0001) {
    selectedThrottle = aircraft.throttle;
    syncThrottleControls(aircraft.throttle);
  }

  aircraft.brakes = keys.has('KeyB') || keys.has('Space') ? 1 : 0;
  aircraft.controls.pitch = 0;
  aircraft.controls.roll = 0;
  aircraft.controls.yaw = 0;
};

updateAircraft = function updateAircraftWithStableCursor(dt, t) {
  if (pilotMode === 'cursor' && aircraft.alive) stabilizeCursorFlight(dt, true);
  cursorBaseUpdateAircraft(dt, t);
  if (pilotMode === 'cursor' && aircraft.alive) stabilizeCursorFlight(dt, false);
};

function captureCursorAutopilotState() {
  cursorAutopilotHeading = currentCursorHeading();
  cursorAutopilotPitch = THREE.MathUtils.clamp(currentCursorPitch(), 0.02, 0.055);
  aircraft.angular.set(0, 0, 0);
}

function stabilizeCursorFlight(dt, beforePhysics) {
  if (!Number.isFinite(cursorAutopilotHeading)) captureCursorAutopilotState();

  const input = applyInputDeadzone(cursorAim.active ? cursorAim.x : 0, 0.055);
  const turnRate = THREE.MathUtils.clamp(input * CURSOR_MAX_TURN_RATE, -CURSOR_MAX_TURN_RATE, CURSOR_MAX_TURN_RATE);
  cursorAutopilotHeading = wrapCursorAngle(cursorAutopilotHeading + turnRate * dt);

  const clearance = aircraft.pos.y - terrainHeight(aircraft.pos.x, aircraft.pos.z);
  const lowTerrainAssist = clearance < 360 ? THREE.MathUtils.clamp((360 - clearance) * 0.000055, 0, 0.018) : 0;
  const targetPitch = THREE.MathUtils.clamp(cursorAutopilotPitch + lowTerrainAssist, CURSOR_PITCH_FLOOR, CURSOR_PITCH_CEILING);
  const targetRoll = THREE.MathUtils.clamp(-input * CURSOR_MAX_ROLL, -CURSOR_MAX_ROLL, CURSOR_MAX_ROLL);
  const targetQuat = tmp.q1.setFromEuler(tmp.e1.set(targetPitch, -cursorAutopilotHeading, targetRoll, 'XYZ'));
  const attitudeBlend = 1 - Math.exp((beforePhysics ? -7.5 : -5.5) * dt);
  aircraft.quat.slerp(targetQuat, attitudeBlend).normalize();

  aircraft.angular.x = 0;
  aircraft.angular.y *= beforePhysics ? 0.08 : 0;
  aircraft.angular.z *= beforePhysics ? 0.08 : 0;

  const speed = THREE.MathUtils.clamp(Math.sqrt(aircraft.vel.x * aircraft.vel.x + aircraft.vel.z * aircraft.vel.z), CURSOR_MIN_SPEED, CURSOR_MAX_SPEED);
  const forward = cursorForwardFromHeading(cursorAutopilotHeading);
  const velocityBlend = 1 - Math.exp((beforePhysics ? -3.8 : -2.6) * dt);
  aircraft.vel.x = THREE.MathUtils.lerp(aircraft.vel.x, forward.x * speed, velocityBlend);
  aircraft.vel.z = THREE.MathUtils.lerp(aircraft.vel.z, forward.z * speed, velocityBlend);

  const clearanceError = THREE.MathUtils.clamp((CURSOR_TARGET_CLEARANCE - clearance) / CURSOR_TARGET_CLEARANCE, -0.45, 0.7);
  const targetVerticalSpeed = THREE.MathUtils.clamp(0.25 + clearanceError * 2.2, -0.85, 2.2);
  aircraft.vel.y = THREE.MathUtils.lerp(aircraft.vel.y, targetVerticalSpeed, 1 - Math.exp(-2.4 * dt));

  aircraft.group.position.copy(aircraft.pos);
  aircraft.group.quaternion.copy(aircraft.quat);
}

function currentCursorHeading() {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat).normalize();
  return Math.atan2(forward.x, -forward.z);
}

function currentCursorPitch() {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quat).normalize();
  return Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
}

function cursorForwardFromHeading(heading) {
  return new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading)).normalize();
}

function wrapCursorAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
