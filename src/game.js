// Parish mode — the rendering and interaction layer of the city-builder.
// All rules (money, people, weather odds, seasons, milestones) live in
// economy.js so they can be simulated headlessly; this file owns the plots,
// the meshes, the tools and the panel.
import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { scene, camera, renderer, controls, districtGroup } from './scene.js?v=09';
import { state, makeBuilding, rngFor, sharedGlass } from './generator.js?v=09';
import {
  TYPES, TYPE_ORDER, UNLOCKS, MILESTONES,
  newParish, advanceDay, derive, ledger, unlocked, nextMilestone,
  renovateCost, seasonOf, dayOfSeason, yearOf,
  DEMOLISH_REFUND,
} from './economy.js?v=09';

const SAVE_KEY = 'editory.parish.v2';
const DAY_SECONDS = 30;            // real seconds per game day at 1×
const COLS = 9, ROWS = 3;
const PLOT_W = 12, ROW_DEPTH = 17;
const PLOT_MAX_W = PLOT_W - 1.4, PLOT_MAX_D = 12.5;

// Material draws per register — parish buildings choose their own palette
const MAT_BY_TYPE = {
  terrace: ['granite', 'render', 'render'],
  house:   ['granite', 'render', 'timber'],
  store:   ['granite', 'granite', 'slate'],
  civic:   ['render', 'granite'],
  bow:     ['render'],
  pub:     ['render', 'granite'],
  future:  ['granite'],
  'granite-glass': ['granite'],
};

export const game = {
  active: false, speed: 1,
  s: newParish(),
  rainTarget: 0.05,
  plots: [], tool: null,
  announced: new Set(),
};

let cb = {};                 // { updateAtmosphere, updateRain } from main.js
let parishGroup = null;      // plot markers + back streets
let plotMeshes = [];
let hovered = null;
let rainApplied = -1;

const $ = (id) => document.getElementById(id);
const colX = (c) => (c - (COLS - 1) / 2) * PLOT_W;
const plotFrontZ = (r) => 0.5 + r * ROW_DEPTH;
const ageBucket = (age) => age < 0.3 ? 0 : age < 0.6 ? 1 : 2;

// ---------- world ----------

function buildParishGround(){
  parishGroup = new THREE.Group();
  parishGroup.visible = false;
  scene.add(parishGroup);

  // Back streets between the rows
  const streetMat = new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.8 });
  for (let r = 1; r < ROWS; r++){
    const street = new THREE.Mesh(new THREE.PlaneGeometry(COLS * PLOT_W + 6, 3.6), streetMat);
    street.rotation.x = -Math.PI / 2;
    street.position.set(0, 0.015, plotFrontZ(r) - 2.2);
    street.receiveShadow = true;
    parishGroup.add(street);
  }

  // Plot markers
  const planeGeo = new THREE.PlaneGeometry(PLOT_W - 0.8, PLOT_MAX_D + 0.6);
  planeGeo.rotateX(-Math.PI / 2);
  for (let r = 0; r < ROWS; r++){
    for (let c = 0; c < COLS; c++){
      const mat = new THREE.MeshBasicMaterial({ color: 0xd6b07a, transparent: true, opacity: 0.0, depthWrite: false });
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.position.set(colX(c), 0.03, plotFrontZ(r) + PLOT_MAX_D / 2 + 0.4);
      const plot = { row: r, col: c, mesh, buildingMesh: null, b: null, ageBucket: 0 };
      mesh.userData.plot = plot;
      game.plots.push(plot);
      plotMeshes.push(mesh);
      parishGroup.add(mesh);
    }
  }
}

function plotOf(b){ return game.plots.find(p => p.row === b.row && p.col === b.col); }

function paramsForType(type, rng, age){
  return {
    preset: type,
    winDensity: 0.6 + rng.rand() * 0.3,
    roofPitch: 38 + rng.int(12),
    material: rng.pick(MAT_BY_TYPE[type] || ['granite']),
    age: Math.min(0.95, Math.max(0.05, age)),
    shutters: 'some',
  };
}

// ---------- bespoke visuals: pub sign, côtil field, parish church ----------

function addPubSign(mesh, rng){
  const { w, d } = mesh.userData.dims;
  const ink = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.6, metalness: 0.4 });
  const boardMat = new THREE.MeshStandardMaterial({
    color: [0x113022, 0x162f4a, 0x5b1812, 0xa84c2a][rng.int(4)], roughness: 0.5,
  });
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.9), ink);
  bracket.position.set(w / 2 - 1.0, 3.1, -d / 2 - 0.45);
  mesh.add(bracket);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.78), boardMat);
  board.position.set(w / 2 - 1.0, 2.68, -d / 2 - 0.55);
  board.castShadow = true;
  mesh.add(board);
}

// A gabled slate prism, hand-rolled (the generator's roofs are bound to its
// building groups, so small outbuildings carry their own).
function gablePrism(w, d, baseY, ridgeH, mat){
  const v = new Float32Array([
    -w/2, baseY, -d/2,   w/2, baseY, -d/2,   w/2, baseY, d/2,   -w/2, baseY, d/2,
     0,   baseY + ridgeH, -d/2,   0, baseY + ridgeH, d/2,
  ]);
  const i = new Uint16Array([0,3,5, 0,5,4,  1,4,5, 1,5,2,  0,1,4,  3,5,2]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.setIndex(new THREE.BufferAttribute(i, 1));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function makeFieldVisual(rng, age){
  const g = new THREE.Group();
  const w = PLOT_W - 1.8, d = PLOT_MAX_D - 0.6;
  g.userData.dims = { w, d };

  const soil = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0x4d3b27, roughness: 1 })
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.045;
  soil.receiveShadow = true;
  g.add(soil);

  // Potato ridges — slightly tired rows when the field is left to age
  const green = new THREE.Color(0x55703a).offsetHSL(0, -age * 0.25, -age * 0.05);
  const cropMat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.95 });
  const rows = Math.floor((w - 3.6) / 1.15);
  for (let i = 0; i < rows; i++){
    const x = -w / 2 + 0.9 + i * 1.15;
    const row = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26 + rng.rand() * 0.14, d - 2.2), cropMat);
    row.position.set(x, 0.18, 0);
    row.castShadow = row.receiveShadow = true;
    g.add(row);
  }

  // Granite barn tucked on the open side
  const stone = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xc09c8a).offsetHSL(0, -age * 0.12, -age * 0.06), roughness: 0.92 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.7 });
  const bw = 3.2, bd = 4.4, bh = 2.3;
  const bx = w / 2 - bw / 2 - 0.2, bz = -d / 2 + bd / 2 + 0.4;
  const barn = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), stone);
  barn.position.set(bx, bh / 2 + 0.05, bz);
  barn.castShadow = barn.receiveShadow = true;
  g.add(barn);
  const roof = gablePrism(bw + 0.5, bd + 0.5, bh + 0.05, 1.0, slate);
  roof.position.set(bx, 0, bz);
  g.add(roof);
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x2a1610, roughness: 0.6 })
  );
  door.position.set(bx, 0.9, bz - bd / 2 - 0.01);
  door.rotation.y = Math.PI;
  g.add(door);

  return g;
}

function makeChurchVisual(rng, age){
  const g = new THREE.Group();
  const naveW = 5.6, naveD = 8.6, naveH = 4.2;
  const towerS = 3.0, towerH = 8.2;
  const d = naveD + towerS;
  g.userData.dims = { w: Math.max(naveW, towerS) + 0.4, d };

  const granite = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xc7a08e).offsetHSL(0, -age * 0.14, -age * 0.07), roughness: 0.9,
  });
  const dressed = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd8b6a4).offsetHSL(0, -age * 0.1, -age * 0.04), roughness: 0.85,
  });
  const slate = new THREE.MeshStandardMaterial({ color: 0x363b46, roughness: 0.65 });

  // Nave, behind the tower
  const naveZ = -d / 2 + towerS + naveD / 2;
  const nave = new THREE.Mesh(new THREE.BoxGeometry(naveW, naveH, naveD), granite);
  nave.position.set(0, naveH / 2 + 0.05, naveZ);
  nave.castShadow = nave.receiveShadow = true;
  g.add(nave);
  const naveRoof = gablePrism(naveW + 0.5, naveD + 0.4, naveH + 0.05, 2.0, slate);
  naveRoof.position.set(0, 0, naveZ);
  g.add(naveRoof);

  // Square west tower with a low pyramid cap — the Jersey parish silhouette
  const towerZ = -d / 2 + towerS / 2;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(towerS, towerH, towerS), granite);
  tower.position.set(0, towerH / 2 + 0.05, towerZ);
  tower.castShadow = tower.receiveShadow = true;
  g.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(towerS * 0.78, 2.6, 4), slate);
  cap.position.set(0, towerH + 1.35, towerZ);
  cap.rotation.y = Math.PI / 4;
  cap.castShadow = true;
  g.add(cap);

  // Tall lancet windows along the nave; a west door in the tower
  for (const sx of [-1, 1]){
    for (let i = 0; i < 3; i++){
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.9), sharedGlass);
      win.position.set(sx * (naveW / 2 + 0.01), 2.2, naveZ - naveD / 2 + 1.6 + i * 2.6);
      win.rotation.y = sx * Math.PI / 2;
      g.add(win);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.1, 0.75), dressed);
      frame.position.set(sx * (naveW / 2 - 0.01), 2.2, naveZ - naveD / 2 + 1.6 + i * 2.6);
      g.add(frame);
    }
  }
  const beltWin = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.1), sharedGlass);
  beltWin.position.set(0, towerH - 1.4, towerZ - towerS / 2 - 0.01);
  beltWin.rotation.y = Math.PI;
  g.add(beltWin);
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 2.3),
    new THREE.MeshStandardMaterial({ color: 0x2a1610, roughness: 0.55 })
  );
  door.position.set(0, 1.25, towerZ - towerS / 2 - 0.012);
  door.rotation.y = Math.PI;
  g.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.6, 0.1), dressed);
  doorFrame.position.set(0, 1.35, towerZ - towerS / 2 + 0.04);
  g.add(doorFrame);

  return g;
}

// ---------- construction ----------

function buildVisual(b){
  const rng = rngFor(b.seed);
  let mesh;
  if (b.type === 'field') mesh = makeFieldVisual(rng, b.age);
  else if (b.type === 'church') mesh = makeChurchVisual(rng, b.age);
  else {
    const visualPreset = b.type === 'pub' ? 'house' : b.type;
    const params = paramsForType(b.type, rng, b.age);
    mesh = makeBuilding(rng, visualPreset, params, { maxW: PLOT_MAX_W, maxD: PLOT_MAX_D });
    if (b.type === 'pub') addPubSign(mesh, rng);
  }
  const { d } = mesh.userData.dims;
  mesh.position.set(colX(b.col), 0, plotFrontZ(b.row) + d / 2 + 0.3);
  districtGroup.add(mesh);
  return mesh;
}

function attachBuilding(b){
  const plot = plotOf(b);
  plot.b = b;
  plot.buildingMesh = buildVisual(b);
  plot.ageBucket = ageBucket(b.age);
}

function detachBuilding(plot){
  if (plot.buildingMesh) districtGroup.remove(plot.buildingMesh);
  plot.buildingMesh = null;
  plot.b = null;
}

// Rebuild any building whose weathering crossed a visual threshold — same
// seed, so it's the same building, just older.
function refreshAges(){
  for (const plot of game.plots){
    if (!plot.b) continue;
    const nb = ageBucket(plot.b.age);
    if (nb !== plot.ageBucket){
      districtGroup.remove(plot.buildingMesh);
      plot.buildingMesh = buildVisual(plot.b);
      plot.ageBucket = nb;
    }
  }
}

// ---------- tools ----------

function affordable(type){ return game.s.treasury >= TYPES[type].cost; }

function tryBuild(plot){
  const type = game.tool;
  const s = game.s;
  if (plot.b){ log('That plot is occupied'); return; }
  if (!unlocked(type, s)) return;
  if (!affordable(type)){ log(`Need £${TYPES[type].cost} for a ${TYPES[type].label.toLowerCase()}`); return; }

  s.treasury -= TYPES[type].cost;
  const b = { type, row: plot.row, col: plot.col, age: 0.05, seed: (Math.random() * 1e9) >>> 0 };
  s.buildings.push(b);
  attachBuilding(b);
  const t = TYPES[type];
  log(t.homes > 0 ? `${t.label} built — room for ${t.homes} residents`
    : t.jobs > 0 ? `${t.label} built — ${t.jobs} jobs`
    : `${t.label} built`);
  refreshUI();
  save();
}

function tryDemolish(plot){
  if (!plot.b) return;
  const s = game.s;
  const refund = Math.round(TYPES[plot.b.type].cost * DEMOLISH_REFUND);
  log(`${TYPES[plot.b.type].label} demolished — £${refund} reclaimed`);
  s.buildings.splice(s.buildings.indexOf(plot.b), 1);
  detachBuilding(plot);
  s.treasury += refund;
  // Evict anyone the parish can no longer house
  const st = derive(s);
  if (s.residents > st.homes) s.residents = st.homes;
  refreshUI();
  save();
}

function tryRenovate(plot){
  if (!plot.b) return;
  const s = game.s;
  const b = plot.b;
  if (b.age < 0.15){ log(`The ${TYPES[b.type].label.toLowerCase()} doesn't need it yet`); return; }
  const cost = renovateCost(b.type);
  if (s.treasury < cost){ log(`Renovation costs £${cost}`); return; }
  s.treasury -= cost;
  b.age = 0.05;
  districtGroup.remove(plot.buildingMesh);
  plot.buildingMesh = buildVisual(b);
  plot.ageBucket = 0;
  log(`${TYPES[b.type].label} renovated — fresh lime and pointing (−£${cost})`);
  refreshUI();
  save();
}

function setTool(tool){
  game.tool = (game.tool === tool) ? null : tool;
  refreshUI();
  refreshPlotStyles();
}

function refreshPlotStyles(){
  for (const p of game.plots){
    const m = p.mesh.material;
    if (p === hovered && game.tool){
      if (game.tool === 'bulldoze'){
        m.opacity = p.b ? 0.40 : 0.06;
        m.color.set(0xd07b6b);
      } else if (game.tool === 'renovate'){
        const ok = p.b && p.b.age >= 0.15 && game.s.treasury >= renovateCost(p.b.type);
        m.opacity = p.b ? 0.40 : 0.06;
        m.color.set(ok ? 0x7ab8d0 : 0xd07b6b);
      } else if (!p.b && unlocked(game.tool, game.s) && affordable(game.tool)){
        m.opacity = 0.38; m.color.set(0x7bd0a9);
      } else {
        m.opacity = 0.30; m.color.set(0xd07b6b);
      }
    } else if (game.tool && game.tool !== 'bulldoze' && game.tool !== 'renovate' && !p.b){
      m.opacity = 0.10; m.color.set(0xd6b07a);
    } else {
      m.opacity = 0.0;
    }
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downX = 0, downY = 0, downT = 0;

function plotAt(e){
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(plotMeshes, false)[0];
  return hit ? hit.object.userData.plot : null;
}

function wirePointer(){
  const el = renderer.domElement;
  el.addEventListener('pointermove', (e) => {
    if (!game.active || !game.tool) return;
    const p = plotAt(e);
    if (p !== hovered){ hovered = p; refreshPlotStyles(); }
  });
  el.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
  el.addEventListener('pointerup', (e) => {
    if (!game.active || !game.tool) return;
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 6 || performance.now() - downT > 400) return;  // it was a drag, not a click
    const p = plotAt(e);
    if (!p) return;
    if (game.tool === 'bulldoze') tryDemolish(p);
    else if (game.tool === 'renovate') tryRenovate(p);
    else tryBuild(p);
    refreshPlotStyles();
  });
  addEventListener('keydown', (e) => {
    if (!game.active) return;
    if (e.key === 'Escape') setTool(null);
  });
}

// ---------- UI ----------

function cardMeta(t){
  const bits = [];
  if (t.homes) bits.push(`⌂${t.homes}`);
  if (t.jobs) bits.push(`⚒${t.jobs}`);
  if (t.income) bits.push(`£${t.income}/d`);
  if (t.amenity) bits.push(`♣${t.amenity}`);
  bits.push(`★${t.character}`);
  return bits.join(' · ');
}

function buildCards(){
  const grid = $('buildGrid');
  grid.innerHTML = '';
  for (const key of TYPE_ORDER){
    const t = TYPES[key];
    const btn = document.createElement('button');
    btn.className = 'build-card';
    btn.dataset.type = key;
    btn.title = `${t.desc} — upkeep £${t.upkeep}/day`;
    btn.innerHTML =
      `<span class="bc-row"><span class="bc-name">${t.label}</span><span class="bc-cost">£${t.cost}</span></span>` +
      `<span class="bc-row"><span class="bc-meta">${cardMeta(t)}</span>` +
      `<span class="bc-req">${UNLOCKS[key].req}</span></span>`;
    btn.onclick = () => { if (unlocked(key, game.s)) setTool(key); };
    grid.appendChild(btn);
  }
}

const WEATHER_LABEL = {
  fair: 'Fair over the harbour',
  drizzle: 'Drizzle off the Atlantic',
  storm: 'Storm — batten down',
};

function refreshUI(){
  const s = game.s;
  const st = derive(s);
  const led = ledger(s, st);

  $('statTreasury').textContent = `£${s.treasury}`;
  $('statTreasury').classList.toggle('bad', s.treasury < 0);
  $('statPop').textContent = `${s.residents}/${st.homes}`;
  $('statJobs').textContent = `${st.employed}/${st.jobs}`;
  $('statHappy').textContent = s.happiness;
  $('statChar').textContent = st.character;
  $('statDay').textContent = `${dayOfSeason(s.day)}·${seasonOf(s.day).slice(0, 3)}·Y${yearOf(s.day)}`;

  $('statWeather').textContent = `${WEATHER_LABEL[s.weather]} · day ${s.day}`;
  $('statIncome').textContent = `${led.net >= 0 ? '+' : '−'}£${Math.abs(led.net)}/day`;
  $('statIncome').classList.toggle('bad', led.net < 0);

  const next = nextMilestone(s);
  $('statGoal').textContent = next
    ? `Next: ${next.label} — ${next.desc}`
    : 'Royal Charter held — the flame is carried';

  $('toolLabel').textContent =
    game.tool === 'bulldoze' ? 'demolish — click a building'
    : game.tool === 'renovate' ? 'renovate — click a weathered building'
    : game.tool ? `${TYPES[game.tool].label} — click a plot`
    : 'select a card';

  document.querySelectorAll('#buildGrid .build-card').forEach(btn => {
    const key = btn.dataset.type;
    btn.classList.toggle('active', game.tool === key);
    btn.classList.toggle('locked', !unlocked(key, s, st));
    btn.classList.toggle('broke', unlocked(key, s, st) && !affordable(key));
  });
  $('btnBulldoze').classList.toggle('active', game.tool === 'bulldoze');
  $('btnRenovate').classList.toggle('active', game.tool === 'renovate');
  document.querySelectorAll('#speedSeg button').forEach(b => {
    b.classList.toggle('active', +b.dataset.speed === game.speed);
  });
}

function log(msg){
  const ul = $('eventLog');
  if (!ul) return;
  const li = document.createElement('li');
  if (msg.startsWith('★')) li.className = 'milestone';
  li.textContent = msg;
  ul.prepend(li);
  while (ul.children.length > 8) ul.removeChild(ul.lastChild);
}

function announceUnlocks(silent){
  const st = derive(game.s);
  for (const key of TYPE_ORDER){
    if (unlocked(key, game.s, st) && !game.announced.has(key)){
      game.announced.add(key);
      if (!silent && UNLOCKS[key].req) log(`Unlocked: ${TYPES[key].label}`);
    }
  }
}

function wirePanel(){
  buildCards();
  $('btnBulldoze').onclick = () => setTool('bulldoze');
  $('btnRenovate').onclick = () => setTool('renovate');
  document.querySelectorAll('#speedSeg button').forEach(b => {
    b.onclick = () => { game.speed = +b.dataset.speed; refreshUI(); };
  });
  $('btnNewParish').onclick = () => {
    if (!confirm('Raze the parish and start again?')) return;
    localStorage.removeItem(SAVE_KEY);
    resetParish();
    log('A new parish — £1,500 in the treasury');
    refreshUI();
  };
}

// ---------- weather presentation ----------

function rainTargetFor(weather, rnd = Math.random){
  if (weather === 'storm') return 0.65 + rnd() * 0.3;
  if (weather === 'drizzle') return 0.22 + rnd() * 0.2;
  return rnd() * 0.07;
}

// ---------- save / load ----------

function save(){
  if (!game.active) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, s: game.s })); } catch { /* private mode etc. */ }
}

function load(){
  let data;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return false; }
  if (!data || data.v !== 2 || !data.s || !Array.isArray(data.s.buildings)) return false;
  game.s = Object.assign(newParish(), data.s);
  game.s.flags = game.s.flags || {};
  for (const b of game.s.buildings) attachBuilding(b);
  return true;
}

function resetParish(){
  for (const p of game.plots) detachBuilding(p);
  game.s = newParish();
  game.tool = null;
  game.announced = new Set();
  announceUnlocks(true);
  refreshPlotStyles();
}

// ---------- the day tick ----------

function dayTick(){
  const { msgs } = advanceDay(game.s);
  for (const m of msgs) log(m);
  game.rainTarget = rainTargetFor(game.s.weather);
  refreshAges();
  announceUnlocks(false);
  refreshUI();
  save();
}

// ---------- mode switching & per-frame update ----------

export function initParish(callbacks){
  cb = callbacks;
  buildParishGround();
  wirePointer();
  wirePanel();
}

export function enterParish(){
  game.active = true;
  parishGroup.visible = true;

  // Parish owns the district group — clear the sandbox street
  while (districtGroup.children.length) districtGroup.remove(districtGroup.children[0]);
  for (const p of game.plots){ p.buildingMesh = null; p.b = null; }

  const hadSave = load();
  if (!hadSave) resetParish();
  announceUnlocks(true);

  if (!hadSave){
    log('Welcome to the parish — pick a card, click a plot');
    log('Homes draw residents; jobs and a pub keep them; salt air takes its toll');
  }
  refreshUI();
  refreshPlotStyles();

  // Pull the camera up so the inland plots read
  camera.position.set(44, 30, -46);
  controls.target.set(0, 3, 16);
  controls.update();

  // Wake to morning if entering in the dead of night
  if (state.env.timeOfDay < 6 || state.env.timeOfDay > 21) state.env.timeOfDay = 8;
  game.rainTarget = rainTargetFor(game.s.weather);
  state.env.rain = game.rainTarget;
  rainApplied = -1;
  cb.updateAtmosphere();
}

export function exitParish(){
  save();
  game.active = false;
  game.tool = null;
  hovered = null;
  parishGroup.visible = false;
  refreshPlotStyles();
  for (const p of game.plots){ p.buildingMesh = null; p.b = null; }
  // caller regenerates the sandbox district
}

export function updateGame(dt){
  if (!game.active || game.speed === 0) return;

  state.env.timeOfDay += (24 / DAY_SECONDS) * game.speed * dt;
  if (state.env.timeOfDay >= 24){
    state.env.timeOfDay -= 24;
    dayTick();
  }

  // Drift rain toward today's weather; rebuilding the particle field is
  // costly, so only reapply on meaningful change.
  state.env.rain += (game.rainTarget - state.env.rain) * Math.min(1, dt * 0.4);
  if (Math.abs(state.env.rain - rainApplied) > 0.08){
    rainApplied = state.env.rain;
    cb.updateRain();
  }
  cb.updateAtmosphere();
}
