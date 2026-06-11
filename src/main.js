import {
  THREE, renderer, scene, camera, controls,
  hemi, sun, ambient, sunDisc, sea, road, wall, sky,
  districtGroup, carsGroup, lampGroup, rainGroup, homeCam, onResize
} from './scene.js?v=09';

import {
  state, generateDistrict, updateRainAmount,
  sharedGlass, sharedLampHead, sharedHeadlight, sharedTaillight
} from './generator.js?v=09';

import { wireUI, updateSeedHash, logToPanel } from './ui.js?v=09';
import { game, initParish, enterParish, exitParish, updateGame } from './game.js?v=09';

const clock = new THREE.Clock();

// ---------- ATMOSPHERE: TOD → sun + sky + fog ----------

const SUN_KEYS = [
  [0,  0x4a5a78, 0.05],
  [5,  0x6d7898, 0.12],
  [6,  0xffa672, 0.50],
  [7,  0xffd0a8, 1.10],
  [9,  0xfff1d6, 1.85],
  [12, 0xffffff, 2.10],
  [15, 0xfff0d8, 1.95],
  [17, 0xffc080, 1.40],
  [18, 0xff8050, 0.80],
  [19, 0x9b3a40, 0.25],
  [21, 0x445e88, 0.10],
  [24, 0x4a5a78, 0.05],
];

const SKY_KEYS = [
  // [hour, zenith, horizon, sunwardGlow]
  [0,  0x05080f, 0x0a1124, 0x0a1124],
  [5,  0x0e1530, 0x32334a, 0x44434f],
  [6,  0x344f7a, 0xb87253, 0xefa066],
  [7,  0x537aa3, 0xd3b288, 0xfddca8],
  [9,  0x6398cd, 0xb5cae0, 0xfff0d0],
  [12, 0x5b8fc8, 0xbdd1de, 0xfff8e0],
  [15, 0x6398c5, 0xc5d3da, 0xffe9bd],
  [17, 0x4a78b0, 0xddae7c, 0xffc685],
  [18, 0x32517f, 0xc46546, 0xff7e3c],
  [19, 0x1a2a4a, 0x6e3a48, 0xa6314a],
  [21, 0x0c1230, 0x1a1f3a, 0x1a1f3a],
  [24, 0x05080f, 0x0a1124, 0x0a1124],
];

function lerpKeyframeColor(keys, tod, idx){
  for (let i = 0; i < keys.length - 1; i++){
    if (tod >= keys[i][0] && tod <= keys[i+1][0]){
      const f = (tod - keys[i][0]) / (keys[i+1][0] - keys[i][0]);
      const a = new THREE.Color(keys[i][idx]);
      const b = new THREE.Color(keys[i+1][idx]);
      return a.lerp(b, f);
    }
  }
  return new THREE.Color(keys[0][idx]);
}

function lerpKeyframeNumber(keys, tod, idx){
  for (let i = 0; i < keys.length - 1; i++){
    if (tod >= keys[i][0] && tod <= keys[i+1][0]){
      const f = (tod - keys[i][0]) / (keys[i+1][0] - keys[i][0]);
      return keys[i][idx] + (keys[i+1][idx] - keys[i][idx]) * f;
    }
  }
  return keys[0][idx];
}

function sunPosFromTOD(tod){
  // Above-horizon arc from tod=6 (sunrise, east) to tod=18 (sunset, west).
  // Outside that, the sun is below the horizon — we pin it just under and dim it.
  const above = tod >= 6 && tod <= 18;
  const t = THREE.MathUtils.clamp((tod - 6) / 12, 0, 1);
  const elev = above ? Math.sin(t * Math.PI) : -0.18;
  const azimuth = (t - 0.5) * Math.PI; // -π/2 east → +π/2 west
  const D = 240;
  const horiz = D * Math.sqrt(Math.max(0.0001, 1 - elev*elev));
  // Sun arc is biased toward the sea side (negative Z) so it lights the harbour-facing facades —
  // physically loose but visually right for a harbour vista.
  const x = -Math.sin(azimuth) * horiz;
  const y = Math.max(4, D * elev);
  const z = -Math.abs(horiz) - 60 * Math.max(0, elev);
  return { pos: new THREE.Vector3(x, y, z), elev, above };
}

function updateSkyVertices(zenith, horizon, sunward, sunDir){
  const posAttr = sky.geometry.attributes.position;
  const colAttr = sky.geometry.attributes.color;
  const n = posAttr.count;
  const sd = sunDir.clone().normalize();
  for (let i = 0; i < n; i++){
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    const len = Math.sqrt(x*x + y*y + z*z) || 1;
    const yFrac = Math.max(0, y / len);
    const t = Math.pow(yFrac, 0.55);
    const c = horizon.clone().lerp(zenith, t);

    // Sun glow — tight bright halo around sun direction
    const dx = x/len, dy = y/len, dz = z/len;
    const dot = Math.max(0, dx*sd.x + dy*sd.y + dz*sd.z);
    const glow = Math.pow(dot, 12) * 0.9;
    c.lerp(sunward, glow);

    // Horizon haze along sun's azimuth — widens toward the band where sky meets sea
    const horizFactor = Math.max(0, 1 - yFrac*3.5);
    const azDot = Math.max(0, dx*sd.x + dz*sd.z);
    const hazeDot = Math.pow(azDot, 5);
    c.lerp(sunward, hazeDot * horizFactor * 0.45);

    colAttr.setXYZ(i, c.r, c.g, c.b);
  }
  colAttr.needsUpdate = true;
}

function updateAtmosphere(){
  const tod = state.env.timeOfDay;
  const sunInfo = sunPosFromTOD(tod);
  sun.position.copy(sunInfo.pos);
  // Aim shadow toward origin
  sun.target.position.set(0, 0, 0);
  sun.target.updateMatrixWorld();

  const sunCol = lerpKeyframeColor(SUN_KEYS, tod, 1);
  const sunInt = lerpKeyframeNumber(SUN_KEYS, tod, 2);
  sun.color.copy(sunCol);
  sun.intensity = sunInt * (1.0 - state.env.rain * 0.45);

  const sky_z = lerpKeyframeColor(SKY_KEYS, tod, 1);
  const sky_h = lerpKeyframeColor(SKY_KEYS, tod, 2);
  const sky_s = lerpKeyframeColor(SKY_KEYS, tod, 3);
  // Blend down a touch when it's raining — softer, more silver
  if (state.env.rain > 0){
    const r = state.env.rain;
    const silver = new THREE.Color(0x8c98a4);
    sky_z.lerp(silver, r * 0.45);
    sky_h.lerp(silver, r * 0.55);
    sky_s.lerp(silver, r * 0.45);
  }
  updateSkyVertices(sky_z, sky_h, sky_s, sunInfo.pos);

  // Fog matches horizon
  scene.fog.color.copy(sky_h);
  const rainTight = state.env.rain;
  scene.fog.near = 70 - rainTight * 35;
  scene.fog.far  = 380 - rainTight * 200;

  // Hemisphere light tint
  hemi.color.copy(sky_z).lerp(new THREE.Color(0xffffff), 0.35);
  hemi.groundColor.set(0x554433);
  hemi.intensity = sunInfo.above ? 0.70 : 0.22;
  ambient.intensity = sunInfo.above ? 0.16 : 0.06;

  // Sun disc in the sky — position on dome, colour, opacity
  const discDist = 520;
  const sd = sunInfo.pos.clone().normalize().multiplyScalar(discDist);
  sunDisc.position.copy(sd);
  sunDisc.lookAt(camera.position); // face the camera
  sunDisc.material.color.copy(sunCol);
  sunDisc.material.opacity = sunInfo.above ? 0.85 : 0.0;
  sunDisc.scale.setScalar(0.6 + Math.max(0, sunInfo.elev) * 0.6);

  // Glass / lamps — emit when dark
  const dark = sunInfo.elev < 0.18;
  const darkness = THREE.MathUtils.clamp(0.25 - sunInfo.elev, 0, 1);
  sharedGlass.emissiveIntensity = darkness * 1.4;
  sharedLampHead.emissiveIntensity = darkness * 1.3;
  sharedHeadlight.emissiveIntensity = dark ? 1.5 : 0.30;
  sharedTaillight.emissiveIntensity = dark ? 1.1 : 0.28;
  lampGroup.children.forEach(c => {
    if (c.isPointLight){
      c.intensity = dark ? (1.1 + Math.sin((performance.now() + c.userData.flicker)*0.005) * 0.10) : 0.0;
    }
  });

  // Wet stone & road
  const wet = state.env.rain;
  road.material.roughness = THREE.MathUtils.clamp(0.7 - wet*0.55, 0.05, 1);
  road.material.metalness = wet * 0.4;
  road.material.needsUpdate = true;
  wall.material.roughness = THREE.MathUtils.clamp(0.88 - wet*0.4, 0.1, 1);
  wall.material.needsUpdate = true;
  sea.material.roughness = THREE.MathUtils.clamp(0.28 - wet*0.1, 0.05, 1);
  sea.material.metalness = 0.4 + wet*0.15;
  sea.material.needsUpdate = true;
}

// ---------- ANIMATION ----------

// Sea is intentionally flat — its mood comes from material + sky reflection in the horizon haze,
// not from per-vertex wave displacement (which made the silhouette jagged where it met the beach).
function animateSea(_t){ /* no-op; preserved for future envMap-driven shimmer */ }

function animateRain(dt){
  const speed = 22 + state.env.rain * 18;
  rainGroup.children.forEach(lines => {
    const pos = lines.geometry.attributes.position;
    const n = pos.count;
    const dy = speed * dt;
    for (let i = 0; i < n; i++){
      let y = pos.getY(i);
      y -= dy;
      if (y < -1) y += 55;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });
}

function animateCars(dt){
  carsGroup.children.forEach(car => {
    car.position.x += car.userData.speed * dt;
    if (car.position.x > 64) car.position.x = -64;
    if (car.position.x < -64) car.position.x = 64;
  });
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = performance.now() * 0.001;

  animateSea(t);
  if (rainGroup.children.length) animateRain(dt);
  animateCars(dt);
  updateGame(dt);

  controls.update();
  renderer.render(scene, camera);
}

// ---------- WIRING ----------

function regen(){
  generateDistrict({ districtGroup, carsGroup, lampGroup, rainGroup });
  updateSeedHash(state.seed);
  logToPanel(`seed ${state.seed}  •  ${state.params.preset} / ${state.params.material}  •  age ${(state.params.age*100|0)}%  •  ${state.env.rain > 0.3 ? 'rain' : (state.env.rain > 0 ? 'drizzle' : 'fair')}`);
}

function boot(){
  // Restore seed from URL hash if present
  const fromHash = (location.hash.match(/seed=(\d+)/) || [])[1];
  if (fromHash) state.seed = parseInt(fromHash, 10) >>> 0;

  wireUI({
    onGenerate: regen,
    onReseed: () => { state.seed = (Math.random()*1e9) >>> 0; regen(); },
    onFrame: () => homeCam(),
    onScreenshot: () => {
      const url = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `editory-${state.seed}-${state.params.preset}.png`;
      a.click();
    },
    onParam: (k, v) => {
      const p = state.params;
      switch(k){
        case 'preset':     p.preset = v;       regen(); break;
        case 'winDensity': p.winDensity = +v;  regen(); break;
        case 'roofPitch':  p.roofPitch = +v;   regen(); break;
        case 'material':   p.material = v;     regen(); break;
        case 'age':        p.age = +v;         regen(); break;
        case 'shutters':   p.shutters = v;     regen(); break;
        case 'cars':       p.cars = +v;        regen(); break;
        case 'tod':        state.env.timeOfDay = +v; updateAtmosphere(); break;
        case 'rain':       state.env.rain = +v;
                           updateRainAmount(rainGroup);
                           updateAtmosphere(); break;
      }
    }
  });

  // Parish mode — city-builder layered on the generator
  initParish({
    updateAtmosphere,
    updateRain: () => updateRainAmount(rainGroup),
  });
  const modeTabs = document.getElementById('modeTabs');
  modeTabs.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.mode;
      if ((mode === 'parish') === game.active) return;
      modeTabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      if (mode === 'parish'){
        document.body.classList.add('parish');
        enterParish();
      } else {
        document.body.classList.remove('parish');
        exitParish();
        // Parish drove time and rain; hand control back to the sliders
        state.env.timeOfDay = +document.getElementById('tod').value;
        state.env.rain = +document.getElementById('rain').value;
        updateRainAmount(rainGroup);
        regen();
        homeCam();
        updateAtmosphere();
      }
    };
  });

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (game.active && (e.key === 'g' || e.key === 'G' || e.key === 'r' || e.key === 'R')) return;
    if (e.key === 'g' || e.key === 'G'){ regen(); }
    else if (e.key === 'r' || e.key === 'R'){ state.seed = (Math.random()*1e9) >>> 0; regen(); }
    else if (e.key === 'f' || e.key === 'F'){ homeCam(); }
    else if (e.key === 'h' || e.key === 'H'){
      const ui = document.getElementById('ui'); if (ui) ui.classList.toggle('hidden');
    }
    else if (e.key === '?' || e.key === '/'){
      const a = document.getElementById('about'); if (a) a.classList.toggle('open');
    }
  });

  updateAtmosphere();
  regen();
  homeCam();
  animate();
}

addEventListener('resize', onResize);
boot();
