const environmentGraniteTint = new THREE.Color(0x8d877c);
const environmentSnowTint = new THREE.Color(0xd9e4e8);
const environmentHsl = {};
const environmentMistSystems = [];
const environmentTimeDirections = {
  dawn: new THREE.Vector3(-0.82, 0.18, 0.46).normalize(),
  noon: new THREE.Vector3(-0.34, 0.91, 0.22).normalize(),
  golden: new THREE.Vector3(-0.68, 0.42, 0.36).normalize(),
  dusk: new THREE.Vector3(0.82, 0.16, -0.44).normalize(),
  night: new THREE.Vector3(0.24, 0.62, -0.75).normalize()
};
const environmentWeatherLook = {
  clear: { coverage: 0.18, storm: 0.0 }, snow: { coverage: 0.62, storm: 0.18 },
  aurora: { coverage: 0.12, storm: 0.0 }, storm: { coverage: 0.82, storm: 0.82 },
  lightning: { coverage: 0.9, storm: 1.0 }, hurricane: { coverage: 1.0, storm: 1.0 }
};
const environmentTimeLook = {
  dawn: { light: 0xffc49c, shadow: 0x5e7386, sun: 0xffc184, halo: 0.82 },
  noon: { light: 0xffffff, shadow: 0x8ca8b7, sun: 0xfff9db, halo: 0.72 },
  golden: { light: 0xffd4a0, shadow: 0x718395, sun: 0xffc36f, halo: 0.9 },
  dusk: { light: 0xffa889, shadow: 0x44536d, sun: 0xff8f69, halo: 0.84 },
  night: { light: 0x8498bd, shadow: 0x121b32, sun: 0xa8bdff, halo: 0.16 }
};
let environmentAtmosphere = null;
let environmentSunSprite = null;
let environmentRiverFoam = null;
let environmentSunDirection = environmentTimeDirections.golden.clone();

const environmentBaseTerrainColor = terrainColor;
terrainColor = function terrainColorWithMineralVariation(x, z, y) {
  const color = environmentBaseTerrainColor(x, z, y);
  if (isRunway(x, z) || (Math.abs(z - riverZ(x)) < 58 && y < 1260)) return color;
  const broad = smoothNoise(x * 0.00072 + 17.3, z * 0.00072 - 8.1);
  const detail = smoothNoise(x * 0.0024 - 31.7, z * 0.0024 + 12.8);
  const stratum = 0.5 + 0.5 * Math.sin(y * 0.019 + broad * 5.4);
  const rocky = y > 1340 && color.r > 0.3 ? 1 : 0;
  color.getHSL(environmentHsl);
  color.setHSL(environmentHsl.h + (broad - 0.5) * 0.018, THREE.MathUtils.clamp(environmentHsl.s + (detail - 0.5) * 0.07, 0, 1), THREE.MathUtils.clamp(environmentHsl.l + (detail - 0.5) * 0.055, 0, 1));
  if (rocky) color.lerp(environmentGraniteTint, 0.035 + stratum * 0.075);
  if (y > 2320) color.lerp(environmentSnowTint, smoothstep(2320, 2820, y) * 0.16);
  return color;
};

const environmentBaseCreateSky = createSky;
createSky = function createSkyWithAtmosphere() {
  environmentBaseCreateSky();
  const atmosphereMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
    uniforms: {
      uTime: { value: 0 }, uCoverage: { value: environmentWeatherLook.clear.coverage }, uStorm: { value: 0 },
      uLightColor: { value: new THREE.Color(environmentTimeLook.golden.light) },
      uShadowColor: { value: new THREE.Color(environmentTimeLook.golden.shadow) }
    },
    vertexShader: [
      'varying vec3 vDirection;', 'void main() {', '  vDirection = normalize(position);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);', '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime;', 'uniform float uCoverage;', 'uniform float uStorm;',
      'uniform vec3 uLightColor;', 'uniform vec3 uShadowColor;', 'varying vec3 vDirection;',
      'float cloudPattern(vec2 p) {',
      '  float a = sin(p.x) + sin(p.y * 1.13) + sin(p.x * 0.61 + p.y * 1.37);',
      '  p = p * 2.07 + vec2(2.4, -1.7);',
      '  a += 0.48 * (sin(p.x) + sin(p.y * 0.91) + sin(p.x * 0.73 - p.y));',
      '  return a * 0.111 + 0.5;', '}', 'void main() {', '  vec3 d = normalize(vDirection);',
      '  float band = smoothstep(0.015, 0.15, d.y) * (1.0 - smoothstep(0.72, 0.96, d.y));',
      '  vec2 drift = vec2(uTime * 0.011, uTime * -0.006);',
      '  vec2 p = d.xz / (0.24 + max(d.y, 0.0)) * 5.6 + drift;',
      '  float n = cloudPattern(p);', '  float threshold = mix(0.72, 0.43, uCoverage);',
      '  float cloud = smoothstep(threshold, threshold + 0.16, n) * band;',
      '  float underside = smoothstep(threshold, threshold + 0.3, n);',
      '  vec3 lit = mix(uLightColor, uShadowColor, clamp(underside * 0.5 + uStorm * 0.58, 0.0, 1.0));',
      '  float alpha = cloud * mix(0.24, 0.62, uCoverage);', '  if (alpha < 0.006) discard;',
      '  gl_FragColor = vec4(lit, alpha);', '}'
    ].join('\n')
  });
  environmentAtmosphere = new THREE.Mesh(new THREE.SphereGeometry(46000, 32, 16), atmosphereMaterial);
  environmentAtmosphere.name = 'procedural high atmosphere';
  environmentAtmosphere.frustumCulled = false; environmentAtmosphere.renderOrder = -1; scene.add(environmentAtmosphere);
  environmentSunSprite = createEnvironmentSunSprite();
  if (environmentSunSprite) scene.add(environmentSunSprite);
};

function createEnvironmentSunSprite() {
  const sunCanvas = document.createElement('canvas'); sunCanvas.width = 128; sunCanvas.height = 128;
  const context = sunCanvas.getContext('2d'); if (!context) return null;
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.1, 'rgba(255,244,210,0.98)');
  gradient.addColorStop(0.28, 'rgba(255,210,135,0.48)'); gradient.addColorStop(1, 'rgba(255,180,80,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(sunCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, color: environmentTimeLook.golden.sun, transparent: true, opacity: environmentTimeLook.golden.halo, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sprite = new THREE.Sprite(material); sprite.name = 'atmospheric sun halo'; sprite.scale.set(4900, 4900, 1); sprite.renderOrder = 0; return sprite;
}

const environmentBaseCreateTerrain = createTerrain;
createTerrain = function createTerrainWithMaterialPolish() {
  environmentBaseCreateTerrain();
  const terrain = scene.getObjectByName('Yosemite procedural DEM terrain');
  if (!terrain || !terrain.material) return;
  terrain.material.roughness = 0.88; terrain.material.dithering = true; terrain.material.needsUpdate = true;
};

const environmentBaseCreateRiver = createRiver;
createRiver = function createRiverWithFoam() {
  environmentBaseCreateRiver();
  const river = scene.getObjectByName('Merced river corridor');
  if (!river || !river.geometry || !river.material) return;
  river.material.clearcoat = 0.3; river.material.clearcoatRoughness = 0.2; river.material.dithering = true; river.material.needsUpdate = true;
  const foamMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1,
    uniforms: { uTime: { value: 0 } },
    vertexShader: [
      'varying vec2 vUv;', 'void main() {', '  vUv = uv;', '  vec3 p = position;', '  p.y += 0.85;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);', '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime;', 'varying vec2 vUv;', 'void main() {',
      '  float current = sin(vUv.x * 122.0 - uTime * 2.4 + sin(vUv.y * 17.0) * 2.0) * 0.5 + 0.5;',
      '  float broken = smoothstep(0.68, 0.94, current);',
      '  float banks = smoothstep(0.19, 0.49, abs(vUv.y - 0.5));',
      '  float alpha = broken * mix(0.055, 0.19, banks);',
      '  gl_FragColor = vec4(0.72, 0.94, 1.0, alpha);', '}'
    ].join('\n')
  });
  environmentRiverFoam = new THREE.Mesh(river.geometry.clone(), foamMaterial);
  environmentRiverFoam.name = 'Merced river foam'; environmentRiverFoam.renderOrder = 1; scene.add(environmentRiverFoam);
};

const environmentBaseCreateWaterfalls = createWaterfalls;
createWaterfalls = function createWaterfallsWithPolish() {
  const before = new Set(scene.children);
  environmentBaseCreateWaterfalls();
  waterMaterials.forEach((material) => {
    material.vertexShader = [
      'varying vec2 vUv;', 'varying float vFall;', 'varying float vRipple;', 'uniform float uTime;', 'void main() {',
      '  vUv = uv;', '  float fallLine = 1.0 - uv.y;', '  vec3 p = position;',
      '  float primary = sin(uv.y * 29.0 + uTime * 4.7);',
      '  float secondary = sin(uv.y * 67.0 - uTime * 2.2 + uv.x * 8.0);',
      '  p.x += (primary + secondary * 0.28) * (1.1 + fallLine * 1.8);',
      '  p.z += cos(uv.y * 19.0 + uTime * 3.1) * (2.4 + fallLine * 2.2);',
      '  vFall = fallLine;', '  vRipple = primary * 0.5 + 0.5;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);', '}'
    ].join('\n');
    material.fragmentShader = [
      'uniform vec3 uTint;', 'uniform float uTime;', 'varying vec2 vUv;', 'varying float vFall;', 'varying float vRipple;', 'void main() {',
      '  float leftEdge = smoothstep(0.015, 0.16, vUv.x);',
      '  float rightEdge = 1.0 - smoothstep(0.84, 0.985, vUv.x);',
      '  float ribbon = leftEdge * rightEdge;',
      '  float fine = sin(vUv.y * 132.0 - uTime * 8.0 + vUv.x * 31.0) * 0.5 + 0.5;',
      '  float broad = sin(vUv.y * 51.0 - uTime * 3.7 + vRipple * 4.0) * 0.5 + 0.5;',
      '  float streak = smoothstep(0.26, 0.94, fine * 0.62 + broad * 0.55);',
      '  float spray = smoothstep(0.6, 1.0, vFall);',
      '  float core = 1.0 - smoothstep(0.0, 0.44, abs(vUv.x - 0.5));',
      '  vec3 color = mix(uTint * 0.62, vec3(0.96, 1.0, 1.0), core * 0.42 + spray * 0.48 + streak * 0.18);',
      '  float alpha = ribbon * (0.31 + streak * 0.48 + spray * 0.2);',
      '  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.94));', '}'
    ].join('\n');
    material.dithering = true; material.needsUpdate = true;
  });
  scene.children.forEach((child) => {
    if (before.has(child) || !child.isPoints) return;
    child.name = 'waterfall drifting mist'; child.material.blending = THREE.AdditiveBlending;
    child.material.opacity = 0.27; child.material.size = 10; child.material.needsUpdate = true;
    child.userData.environmentPhase = environmentMistSystems.length * 0.91; environmentMistSystems.push(child);
  });
};

const environmentBaseUpdateWater = updateWater;
updateWater = function updateWaterWithSurfaceMotion(t) {
  environmentBaseUpdateWater(t);
  if (environmentRiverFoam) environmentRiverFoam.material.uniforms.uTime.value = t;
  environmentMistSystems.forEach((mist, index) => {
    mist.material.opacity = 0.24 + Math.sin(t * 0.72 + mist.userData.environmentPhase) * 0.045;
    mist.material.size = 9.5 + Math.sin(t * 0.94 + index) * 1.2;
  });
};

const environmentBaseUpdateWeather = updateWeather;
updateWeather = function updateWeatherWithAtmosphere(dt, t) {
  environmentBaseUpdateWeather(dt, t);
  if (environmentAtmosphere) { environmentAtmosphere.position.copy(camera.position); environmentAtmosphere.material.uniforms.uTime.value = t; }
  if (environmentSunSprite) environmentSunSprite.position.copy(camera.position).addScaledVector(environmentSunDirection, 40000);
};

const environmentBaseApplyWeather = applyWeather;
applyWeather = function applyWeatherWithAtmosphere(name) {
  environmentBaseApplyWeather(name);
  const look = environmentWeatherLook[name];
  if (!look || !environmentAtmosphere) return;
  environmentAtmosphere.material.uniforms.uCoverage.value = look.coverage;
  environmentAtmosphere.material.uniforms.uStorm.value = look.storm;
};

const environmentBaseApplyTime = applyTime;
applyTime = function applyTimeWithAtmosphere(name) {
  environmentBaseApplyTime(name);
  const look = environmentTimeLook[name]; const direction = environmentTimeDirections[name];
  if (!look || !direction) return;
  environmentSunDirection.copy(direction); sun.position.copy(direction).multiplyScalar(9000);
  ambient.color.set(name === 'night' ? 0x6f83a7 : name === 'dawn' || name === 'dusk' ? 0xd5c1b4 : 0xcfe4ff);
  ambient.groundColor.set(name === 'night' ? 0x18202e : 0x475033);
  if (environmentAtmosphere) {
    environmentAtmosphere.material.uniforms.uLightColor.value.set(look.light);
    environmentAtmosphere.material.uniforms.uShadowColor.value.set(look.shadow);
  }
  if (environmentSunSprite) { environmentSunSprite.material.color.set(look.sun); environmentSunSprite.material.opacity = look.halo; }
};
