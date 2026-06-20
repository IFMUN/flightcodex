/*
 * Crash-impact presentation only. Detection, damage, physics, controls and
 * persistence stay in the simulator core.
 */
const impactBaseCreateExplosionMarker = createExplosionMarker;

createExplosionMarker = function createReadableImpactMarker(item) {
  const before = new Set(scene.children);
  impactBaseCreateExplosionMarker(item);

  const speed = Number.isFinite(Number(item.speed)) ? Number(item.speed) : 110;
  const severity = THREE.MathUtils.clamp((speed - 65) / 190, 0, 1);
  const scale = 0.82 + severity * 0.72;
  const added = scene.children.filter((child) => !before.has(child));
  const fire = added.find((child) => fireGroups.includes(child));
  const blast = added.find((child) => child !== fire && child.userData);

  if (fire) {
    fire.userData.impactSeverity = severity;
    const flames = fire.children.filter((child) => child.userData.kind === 'flame');
    const smoke = fire.children.filter((child) => child.userData.kind === 'smoke');
    const scorch = fire.children.find((child) => child.userData.kind === 'scorch');

    if (scorch) {
      scorch.geometry.scale(0.8 + severity * 0.78, 0.8 + severity * 0.78, 1);
      scorch.material.color.set(severity > 0.58 ? 0x030202 : 0x0a0705);
      scorch.material.opacity = 0.4 + severity * 0.18;
      scorch.material.polygonOffset = true;
      scorch.material.polygonOffsetFactor = -1;
    }

    const hotRim = new THREE.Mesh(
      new THREE.RingGeometry((48 + severity * 28) * scale, (72 + severity * 42) * scale, 48),
      new THREE.MeshBasicMaterial({
        color: severity > 0.62 ? 0x8d2913 : 0x4b2417,
        transparent: true,
        opacity: 0.22 + severity * 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    hotRim.rotation.x = -Math.PI / 2;
    hotRim.position.y = 0.18;
    hotRim.userData.kind = 'scorch';
    fire.add(hotRim);

    flames.forEach((flame, index) => {
      const flameScale = (0.82 + severity * 0.48) * (0.9 + (index % 4) * 0.055);
      flame.geometry.scale(flameScale, flameScale * (0.9 + severity * 0.22), flameScale);
      flame.position.x *= 0.82 + severity * 0.42;
      flame.position.z *= 0.82 + severity * 0.42;
      flame.position.y *= 0.88 + severity * 0.26;
      flame.material.color.set(index % 5 === 0 ? 0xfff0aa : index % 2 === 0 ? 0xffa127 : 0xff5412);
    });

    smoke.forEach((puff, index) => {
      const progress = smoke.length > 1 ? index / (smoke.length - 1) : 0;
      const puffScale = (0.78 + severity * 0.42) * (0.9 + progress * 0.26);
      puff.geometry.scale(puffScale, puffScale * (1 + progress * 0.12), puffScale);
      puff.position.y *= 0.88 + severity * 0.3;
      puff.position.x *= 0.72 + progress * 0.5;
      puff.position.z *= 0.72 + progress * 0.5;
      puff.material.color.set(index < 3 ? 0x241a17 : 0x111719);
      puff.material.opacity = 0.13 + (1 - progress) * 0.06;
    });

    fire.children.forEach((child) => {
      if (!child.isPointLight) return;
      child.intensity = 1.1 + severity * 0.78;
      child.distance = 440 + severity * 300;
    });
  }

  if (blast) {
    blast.userData.impactSeverity = severity;
    const shock = blast.children.find((child) => child.userData.kind === 'shock');
    const fireball = blast.children.find((child) => child.userData.kind === 'fireball');
    const debris = blast.children.filter((child) => child.userData.kind === 'debris');

    if (shock) {
      shock.geometry.scale(scale, scale, 1);
      shock.material.color.set(severity > 0.6 ? 0xfff2c7 : 0xffbd70);
    }
    if (fireball) {
      fireball.geometry.scale(scale, scale, scale);
      fireball.position.y *= 0.9 + severity * 0.28;
      fireball.material.color.set(severity > 0.64 ? 0xff6a20 : 0xffa13c);
    }

    const echoRing = new THREE.Mesh(
      new THREE.RingGeometry((58 + severity * 24) * scale, (76 + severity * 32) * scale, 56),
      new THREE.MeshBasicMaterial({
        color: 0xff9845,
        transparent: true,
        opacity: 0.48 + severity * 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    echoRing.rotation.x = -Math.PI / 2;
    echoRing.position.y = 3;
    echoRing.userData.kind = 'shock';
    echoRing.userData.baseOpacity = 0.48 + severity * 0.12;
    blast.add(echoRing);

    const hotCore = new THREE.Mesh(
      new THREE.SphereGeometry((16 + severity * 9) * scale, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xfff2c2,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    hotCore.position.y = (34 + severity * 16) * scale;
    hotCore.userData.kind = 'fireball';
    hotCore.userData.baseOpacity = 0.82;
    blast.add(hotCore);

    debris.forEach((fragment, index) => {
      const fragmentScale = 0.8 + severity * 0.44;
      fragment.geometry.scale(fragmentScale, fragmentScale, fragmentScale);
      fragment.userData.velocity.multiplyScalar(0.84 + severity * 0.52);
      if (index % 5 === 0) {
        fragment.material.color.set(0x9d3b20);
        fragment.material.emissive.set(0x501007);
        fragment.material.emissiveIntensity = 0.5;
      } else {
        fragment.material.color.offsetHSL(0, -0.08, -0.08);
      }
    });

    blast.children.forEach((child) => {
      if (!child.isPointLight) return;
      child.intensity = 2.8 + severity * 2;
      child.distance = 560 + severity * 420;
    });
  }
};
