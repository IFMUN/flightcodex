// Keep precipitation work proportional to the weather mode's visible particle count.
const precipitationBaseCreateWeatherSystems = createWeatherSystems;
createWeatherSystems = function createWeatherSystemsWithActiveRanges() {
  precipitationBaseCreateWeatherSystems();
  if (!precipitation) return;

  const position = precipitation.geometry.attributes.position;
  position.setUsage(THREE.DynamicDrawUsage);
  precipitation.geometry.deleteAttribute('seed');
  precipitation.geometry.setDrawRange(0, 0);
  precipitation.visible = false;

  const fallScales = new Float32Array(position.count);
  for (let i = 0; i < fallScales.length; i++) fallScales[i] = 0.55 + seededRandom(i);
  precipitation.userData.performance = {
    activeCount: -1,
    rain: null,
    fallScales
  };
};

updateWeather = function updateWeatherWithActivePrecipitation(dt, t) {
  const mode = weatherModes[settings.weather];
  if (precipitation) {
    const pos = precipitation.geometry.attributes.position;
    const state = precipitation.userData.performance;
    const activeCount = Math.min(pos.count, Math.max(0, Math.floor(mode.density)));
    const rain = Boolean(mode.rain);

    if (state.activeCount !== activeCount || state.rain !== rain) {
      state.activeCount = activeCount;
      state.rain = rain;
      precipitation.visible = activeCount > 0;
      precipitation.geometry.setDrawRange(0, activeCount);
      if (activeCount > 0) {
        precipitation.material.opacity = rain ? 0.34 : 0.52;
        precipitation.material.size = rain ? 5 : 8;
        precipitation.material.color.set(rain ? 0xc8d9e8 : 0xffffff);
      }
    }

    if (activeCount > 0) {
      const positions = pos.array;
      const fallRate = rain ? 1480 : 260;
      const wind = currentWind(t);
      const anchor = aircraft.pos.lengthSq() > 1 ? aircraft.pos : tmp.v1.set(0, 1400, 0);
      for (let i = 0, offset = 0; i < activeCount; i++, offset += 3) {
        let x = positions[offset] + wind.x * dt * 2.2;
        let y = positions[offset + 1] - fallRate * dt * state.fallScales[i];
        let z = positions[offset + 2] + wind.z * dt * 2.2;
        if (y < anchor.y - 260 || Math.abs(x - anchor.x) > 2700 || Math.abs(z - anchor.z) > 2700) {
          x = anchor.x + (seededRandom(i * 17 + t) - 0.5) * 5200;
          y = anchor.y + 900 + seededRandom(i * 13) * 1350;
          z = anchor.z + (seededRandom(i * 19 + t) - 0.5) * 5200;
        }
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
      }
      pos.clearUpdateRanges();
      pos.addUpdateRange(0, activeCount * 3);
      pos.needsUpdate = true;
    }
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

  if (mode.lightning) {
    lightningTimer -= dt;
    if (lightningTimer <= 0) triggerLightning(t);
  } else {
    lightningTimer = Math.max(lightningTimer, 2.8);
  }
};
