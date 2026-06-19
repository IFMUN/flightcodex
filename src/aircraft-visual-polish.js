const aircraftPolish = {
  glow: null,
  fans: [],
  exhausts: [],
  nav: [],
  strobes: [],
  beacons: [],
  landing: [],
  damage: []
};

const aircraftPolishCreateAircraft = createAircraft;
const aircraftPolishUpdateAircraft = updateAircraft;

createAircraft = function createAircraftWithPolish() {
  aircraftPolishCreateAircraft();
  installAircraftPolish();
};

updateAircraft = function updateAircraftWithPolish(dt, t) {
  aircraftPolishUpdateAircraft(dt, t);
  updateAircraftPolish(dt, Number.isFinite(t) ? t : performance.now() * 0.001);
};

function installAircraftPolish() {
  const group = new THREE.Group();
  group.name = 'aircraft visual polish';
  aircraft.group.add(group);
  Object.assign(aircraftPolish, {
    glow: createAircraftGlowTexture(), fans: [], exhausts: [], nav: [], strobes: [], beacons: [], landing: [], damage: []
  });

  const seenMaterials = new Set();
  aircraft.group.traverse((child) => {
    const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
    materials.forEach((material) => {
      if (seenMaterials.has(material)) return;
      seenMaterials.add(material);
      if (material.isMeshPhysicalMaterial) {
        material.clearcoat = Math.max(material.clearcoat || 0, 0.62);
        material.clearcoatRoughness = Math.min(material.clearcoatRoughness == null ? 0.28 : material.clearcoatRoughness, 0.28);
        material.envMapIntensity = Math.max(material.envMapIntensity || 0, 0.72);
      }
      if (material.color && material.color.getHex() === 0x142536) {
        material.roughness = 0.055; material.transmission = 0.28; material.opacity = 0.76; material.ior = 1.45; material.needsUpdate = true;
      }
    });
  });

  createAircraftFans(group);
  createAircraftExhaust(group);
  aircraftPolish.nav.push(
    addAircraftGlow(group, 0xff243f, [-18.14, -0.18, 3.16], 1.3),
    addAircraftGlow(group, 0x3dff91, [18.14, -0.18, 3.16], 1.3),
    addAircraftGlow(group, 0xf5fbff, [0, 1.48, 20.58], 0.8)
  );
  aircraftPolish.strobes.push(
    addAircraftGlow(group, 0xeaf8ff, [-18.25, -0.11, 3.34], 2.7),
    addAircraftGlow(group, 0xeaf8ff, [18.25, -0.11, 3.34], 2.7),
    addAircraftGlow(group, 0xffffff, [0, 1.52, 20.72], 1.7)
  );
  aircraftPolish.beacons.push(
    addAircraftGlow(group, 0xff3e32, [0, 2.47, 1.38], 1.7),
    addAircraftGlow(group, 0xff3e32, [0, -2.28, 1.38], 1.4)
  );
  aircraftPolish.landing.push(
    addAircraftGlow(group, 0xfff3cf, [-3.35, -1.03, -5.1], 2.1),
    addAircraftGlow(group, 0xfff3cf, [3.35, -1.03, -5.1], 2.1)
  );
  if (typeof lightningPartPoints !== 'undefined') {
    Object.entries(lightningPartPoints).forEach(([part, point]) => {
      const entry = addAircraftGlow(group, 0xff7138, point, 1.45);
      entry.part = part; entry.sprite.visible = false; aircraftPolish.damage.push(entry);
    });
  }
}

function createAircraftGlowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,.82)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function createAircraftFanTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const background = context.createRadialGradient(64, 64, 4, 64, 64, 60);
  background.addColorStop(0, '#6a7b84'); background.addColorStop(0.18, '#1a242a');
  background.addColorStop(0.78, '#05080a'); background.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = background; context.fillRect(0, 0, 128, 128);
  context.save(); context.translate(64, 64); context.strokeStyle = 'rgba(170,193,205,.7)'; context.lineWidth = 4;
  for (let index = 0; index < 18; index++) {
    context.rotate(Math.PI / 9); context.beginPath(); context.moveTo(0, -12); context.lineTo(5, -53); context.stroke();
  }
  context.fillStyle = '#aab9c1'; context.beginPath(); context.arc(0, 0, 8, 0, Math.PI * 2); context.fill(); context.restore();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function createAircraftFans(group) {
  const texture = createAircraftFanTexture(); const geometry = new THREE.PlaneGeometry(1.86, 1.86);
  [-1, 1].forEach((side) => {
    const fan = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    fan.position.set(side * 7.8, -2.05, -2.93); fan.renderOrder = 3; group.add(fan); aircraftPolish.fans.push({ fan, side });
  });
}

function createAircraftExhaust(group) {
  const geometry = new THREE.CylinderGeometry(0.24, 0.7, 4.5, 14, 1, true);
  [-1, 1].forEach((side) => {
    const plume = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x78c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    plume.rotation.x = Math.PI / 2; plume.position.set(side * 7.8, -2.05, 1.45); plume.renderOrder = 2; group.add(plume); aircraftPolish.exhausts.push({ plume, side });
  });
}

function addAircraftGlow(group, color, position, scale) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: aircraftPolish.glow, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sprite.position.fromArray(position); sprite.scale.setScalar(scale); sprite.renderOrder = 6; group.add(sprite); return { sprite, scale };
}

function updateAircraftPolish(dt, t) {
  const dark = settings.time === 'night' ? 1 : settings.time === 'dusk' || settings.time === 'dawn' ? 0.76 : 0.48;
  aircraftPolish.nav.forEach((entry) => setAircraftGlow(entry, dark * (0.86 + Math.sin(t * 2.4) * 0.05)));
  const wingFlash = Math.max(aircraftLightPulse(t % 1.12, 0.035), aircraftLightPulse((t % 1.12) - 0.14, 0.035));
  aircraftPolish.strobes.forEach((entry, index) => setAircraftGlow(entry, index < 2 ? wingFlash : aircraftLightPulse((t + 0.28) % 1.12, 0.045)));
  setAircraftGlow(aircraftPolish.beacons[0], aircraftLightPulse(t % 1.34, 0.16) * 0.92);
  setAircraftGlow(aircraftPolish.beacons[1], aircraftLightPulse((t + 0.67) % 1.34, 0.16) * 0.78);
  const landing = aircraft.alive ? THREE.MathUtils.smoothstep(aircraft.gear, 0.08, 0.72) * dark : 0;
  aircraftPolish.landing.forEach((entry) => setAircraftGlow(entry, landing * 0.82));
  aircraftPolish.fans.forEach((entry) => {
    const damage = aircraft.damage[entry.side < 0 ? 'leftEngine' : 'rightEngine'];
    const health = 1 - Math.min(0.88, damage * 0.8);
    entry.fan.rotation.z += dt * (7 + aircraft.throttle * 36) * health * -entry.side;
    entry.fan.material.opacity = aircraft.alive ? 0.62 + health * 0.34 : 0.28;
  });
  aircraftPolish.exhausts.forEach((entry, index) => {
    const damage = aircraft.damage[entry.side < 0 ? 'leftEngine' : 'rightEngine'];
    const power = aircraft.alive ? aircraft.throttle * (1 - Math.min(0.92, damage * 0.82)) : 0;
    entry.plume.material.opacity = power * 0.095 * (0.88 + Math.sin(t * 23 + index * 1.7) * 0.12);
    const radial = 0.82 + power * 0.24; entry.plume.scale.set(radial, 0.72 + power * 0.5, radial);
  });
  aircraftPolish.damage.forEach((entry, index) => {
    const severity = aircraft.damage[entry.part] || 0; entry.sprite.visible = aircraft.alive && severity > 0.18;
    const flicker = 0.64 + Math.sin(t * 17 + index * 2.1) * 0.22 + Math.sin(t * 37 + index) * 0.12;
    setAircraftGlow(entry, entry.sprite.visible ? THREE.MathUtils.clamp((severity - 0.15) * flicker, 0, 0.74) : 0);
  });
}

function aircraftLightPulse(phase, duration) {
  return phase >= 0 && phase <= duration ? Math.sin((phase / duration) * Math.PI) : 0;
}

function setAircraftGlow(entry, intensity) {
  if (!entry) return;
  const value = THREE.MathUtils.clamp(intensity, 0, 1);
  entry.sprite.material.opacity = value * 0.92;
  entry.sprite.scale.setScalar(entry.scale * (0.72 + value * 0.82));
}
