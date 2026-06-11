// Parish mode — a small city-builder layered on the Editory generator.
// A grid of plots climbs inland from the harbour road. The player spends a
// treasury on buildings drawn from the Neo-Anglo-Norman registers; buildings
// house residents and earn income at each day's end. A "character" score —
// the flame thesis made mechanical — gates the later registers.
import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { scene, camera, renderer, controls, districtGroup } from './scene.js?v=08';
import { state, makeBuilding, rngFor } from './generator.js?v=08';

const SAVE_KEY = 'editory.parish.v1';
const DAY_SECONDS = 40;            // real seconds per game day at 1×
const COLS = 9, ROWS = 3;
const PLOT_W = 12, ROW_DEPTH = 17;
const PLOT_MAX_W = PLOT_W - 1.4, PLOT_MAX_D = 12.5;

export const TYPES = {
  terrace: { label: 'Terrace',        cost: 240,  residents: 4, income: 7,  character: 6,
             unlock: () => true,            req: '',             desc: 'Narrow attached homes — party walls, shared eaves' },
  house:   { label: 'House',          cost: 380,  residents: 5, income: 10, character: 8,
             unlock: () => true,            req: '',             desc: 'Detached, gabled, twin chimneys' },
  store:   { label: 'Storehouse',     cost: 450,  residents: 0, income: 18, character: 5,
             unlock: () => true,            req: '',             desc: 'Strong earner — storms halve its take' },
  civic:   { label: 'Civic hall',     cost: 900,  residents: 0, income: 2,  character: 16,
             unlock: g => g.population >= 18,  req: '18 residents', desc: '+8% to all parish income (up to three)' },
  bow:     { label: 'Bow-front',      cost: 620,  residents: 6, income: 15, character: 12,
             unlock: g => g.population >= 35,  req: '35 residents', desc: 'Painted Georgian seafront — the St Aubin register' },
  future:  { label: 'Future house',   cost: 980,  residents: 7, income: 20, character: 14,
             unlock: g => g.character >= 70,   req: '70 character', desc: 'Granite base, light upper — the flame carried forward' },
  'granite-glass': { label: 'Granite + glass', cost: 1600, residents: 0, income: 48, character: 8,
             unlock: g => g.population >= 60,  req: '60 residents', desc: 'Office register — the big earner' },
};
const TYPE_ORDER = ['terrace', 'house', 'store', 'civic', 'bow', 'future', 'granite-glass'];

// Material draws per register — parish buildings choose their own palette
const MAT_BY_TYPE = {
  terrace: ['granite', 'render', 'render'],
  house:   ['granite', 'render', 'timber'],
  store:   ['granite', 'granite', 'slate'],
  civic:   ['render', 'granite'],
  bow:     ['render'],
  future:  ['granite'],
  'granite-glass': ['granite'],
};

export const game = {
  active: false, speed: 1,
  treasury: 1500, day: 1,
  population: 0, character: 0,
  weather: 'fair', rainTarget: 0.05,
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
      const plot = { row: r, col: c, mesh, building: null, type: null, seed: 0 };
      mesh.userData.plot = plot;
      game.plots.push(plot);
      plotMeshes.push(mesh);
      parishGroup.add(mesh);
    }
  }
}

function paramsForType(type, rng){
  return {
    preset: type,
    winDensity: 0.6 + rng.rand() * 0.3,
    roofPitch: 38 + rng.int(12),
    material: rng.pick(MAT_BY_TYPE[type]),
    age: 0.08 + rng.rand() * 0.25,
    shutters: 'some',
  };
}

function constructBuilding(plot, type, seed){
  const rng = rngFor(seed);
  const params = paramsForType(type, rng);
  const b = makeBuilding(rng, type, params, { maxW: PLOT_MAX_W, maxD: PLOT_MAX_D });
  const { d } = b.userData.dims;
  b.position.set(colX(plot.col), 0, plotFrontZ(plot.row) + d / 2 + 0.3);
  districtGroup.add(b);
  plot.building = b;
  plot.type = type;
  plot.seed = seed;
}

function removeBuilding(plot){
  if (!plot.building) return;
  districtGroup.remove(plot.building);
  plot.building = null;
  plot.type = null;
  plot.seed = 0;
}

// ---------- economy ----------

function recomputeStats(){
  let pop = 0, char_ = 0;
  const kinds = new Set();
  for (const p of game.plots){
    if (!p.type) continue;
    pop += TYPES[p.type].residents;
    char_ += TYPES[p.type].character;
    kinds.add(p.type);
  }
  game.population = pop;
  // Variety bonus — a parish of one register is a costume, not a language
  game.character = char_ + kinds.size * 5;
  checkUnlocks();
}

function incomeMultiplier(){
  const civics = game.plots.filter(p => p.type === 'civic').length;
  return 1 + 0.08 * Math.min(3, civics);
}

function estimateIncome(){
  let inc = 0;
  for (const p of game.plots){
    if (!p.type) continue;
    let v = TYPES[p.type].income;
    if (game.weather === 'storm' && p.type === 'store') v = Math.round(v / 2);
    inc += v;
  }
  return Math.round(inc * incomeMultiplier());
}

function dayTick(){
  const total = estimateIncome();
  game.treasury += total;
  game.day++;

  // Roll tomorrow's weather
  const r = Math.random();
  if (r < 0.60){ game.weather = 'fair';    game.rainTarget = Math.random() * 0.10; }
  else if (r < 0.85){ game.weather = 'drizzle'; game.rainTarget = 0.20 + Math.random() * 0.25; }
  else { game.weather = 'storm'; game.rainTarget = 0.60 + Math.random() * 0.30; }

  if (total > 0) log(`Day ${game.day} — collected £${total}`);
  if (game.weather === 'storm') log('Storm over the harbour — storehouses earn half today');
  checkUnlocks();
  refreshUI();
  save();
}

function checkUnlocks(){
  for (const key of TYPE_ORDER){
    if (TYPES[key].unlock(game) && !game.announced.has(key)){
      game.announced.add(key);
      if (TYPES[key].req) log(`Unlocked: ${TYPES[key].label}`);
    }
  }
}

// ---------- interaction ----------

function affordable(type){ return game.treasury >= TYPES[type].cost; }
function unlocked(type){ return TYPES[type].unlock(game); }

function tryBuild(plot){
  const type = game.tool;
  if (!type || type === 'bulldoze') return;
  if (plot.building){ log('That plot is occupied'); return; }
  if (!unlocked(type)) return;
  if (!affordable(type)){ log(`Need £${TYPES[type].cost} for a ${TYPES[type].label.toLowerCase()}`); return; }

  game.treasury -= TYPES[type].cost;
  constructBuilding(plot, type, (Math.random() * 1e9) >>> 0);
  const t = TYPES[type];
  log(t.residents > 0
    ? `${t.label} built — ${t.residents} residents move in`
    : `${t.label} built`);
  recomputeStats();
  refreshUI();
  save();
}

function tryDemolish(plot){
  if (!plot.building) return;
  const refund = Math.round(TYPES[plot.type].cost * 0.5);
  log(`${TYPES[plot.type].label} demolished — £${refund} reclaimed`);
  removeBuilding(plot);
  game.treasury += refund;
  recomputeStats();
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
        m.opacity = p.building ? 0.40 : 0.06;
        m.color.set(0xd07b6b);
      } else if (!p.building && unlocked(game.tool) && affordable(game.tool)){
        m.opacity = 0.38; m.color.set(0x7bd0a9);
      } else {
        m.opacity = 0.30; m.color.set(0xd07b6b);
      }
    } else if (game.tool && game.tool !== 'bulldoze' && !p.building){
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
    else tryBuild(p);
    refreshPlotStyles();
  });
  addEventListener('keydown', (e) => {
    if (!game.active) return;
    if (e.key === 'Escape') setTool(null);
  });
}

// ---------- UI ----------

function buildCards(){
  const grid = $('buildGrid');
  grid.innerHTML = '';
  for (const key of TYPE_ORDER){
    const t = TYPES[key];
    const btn = document.createElement('button');
    btn.className = 'build-card';
    btn.dataset.type = key;
    btn.title = t.desc;
    btn.innerHTML =
      `<span class="bc-row"><span class="bc-name">${t.label}</span><span class="bc-cost">£${t.cost}</span></span>` +
      `<span class="bc-row"><span class="bc-meta">${t.residents ? `⌂${t.residents} · ` : ''}£${t.income}/day</span>` +
      `<span class="bc-req">${t.req}</span></span>`;
    btn.onclick = () => { if (unlocked(key)) setTool(key); };
    grid.appendChild(btn);
  }
}

function refreshUI(){
  $('statTreasury').textContent = `£${game.treasury}`;
  $('statPop').textContent = game.population;
  $('statChar').textContent = game.character;
  $('statDay').textContent = game.day;

  const weatherLabel = { fair: 'Fair over the harbour', drizzle: 'Drizzle off the Atlantic', storm: 'Storm — batten down' }[game.weather];
  $('statWeather').textContent = weatherLabel;
  const inc = estimateIncome();
  $('statIncome').textContent = inc > 0 ? `+£${inc}/day` : '';

  $('toolLabel').textContent =
    game.tool === 'bulldoze' ? 'demolish — click a building'
    : game.tool ? `${TYPES[game.tool].label} — click a plot`
    : 'select a card';

  document.querySelectorAll('#buildGrid .build-card').forEach(btn => {
    const key = btn.dataset.type;
    btn.classList.toggle('active', game.tool === key);
    btn.classList.toggle('locked', !unlocked(key));
    btn.classList.toggle('broke', unlocked(key) && !affordable(key));
  });
  $('btnBulldoze').classList.toggle('active', game.tool === 'bulldoze');
  document.querySelectorAll('#speedSeg button').forEach(b => {
    b.classList.toggle('active', +b.dataset.speed === game.speed);
  });
}

function log(msg){
  const ul = $('eventLog');
  if (!ul) return;
  const li = document.createElement('li');
  li.textContent = msg;
  ul.prepend(li);
  while (ul.children.length > 6) ul.removeChild(ul.lastChild);
}

function wirePanel(){
  buildCards();
  $('btnBulldoze').onclick = () => setTool('bulldoze');
  document.querySelectorAll('#speedSeg button').forEach(b => {
    b.onclick = () => { game.speed = +b.dataset.speed; refreshUI(); };
  });
  $('btnNewParish').onclick = () => {
    if (!confirm('Raze the parish and start again?')) return;
    localStorage.removeItem(SAVE_KEY);
    resetParish();
    log('A new parish — £1500 in the treasury');
    refreshUI();
  };
}

// ---------- save / load ----------

function save(){
  if (!game.active) return;
  const data = {
    treasury: game.treasury, day: game.day, weather: game.weather, rainTarget: game.rainTarget,
    plots: game.plots.filter(p => p.type).map(p => ({ r: p.row, c: p.col, type: p.type, seed: p.seed })),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode etc. */ }
}

function load(){
  let data;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return false; }
  if (!data || !Array.isArray(data.plots)) return false;
  game.treasury = data.treasury ?? 1500;
  game.day = data.day ?? 1;
  game.weather = data.weather ?? 'fair';
  game.rainTarget = data.rainTarget ?? 0.05;
  for (const s of data.plots){
    const plot = game.plots.find(p => p.row === s.r && p.col === s.c);
    if (plot && TYPES[s.type]) constructBuilding(plot, s.type, s.seed >>> 0);
  }
  return true;
}

function resetParish(){
  for (const p of game.plots) removeBuilding(p);
  game.treasury = 1500;
  game.day = 1;
  game.weather = 'fair';
  game.rainTarget = 0.05;
  game.tool = null;
  game.announced = new Set();
  recomputeStats();
  refreshPlotStyles();
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
  for (const p of game.plots){ p.building = null; p.type = null; }

  const hadSave = load();
  if (!hadSave) resetParish();
  recomputeStats();
  // Existing unlocks shouldn't re-announce on load
  for (const key of TYPE_ORDER) if (TYPES[key].unlock(game)) game.announced.add(key);

  if (!hadSave) log('Welcome to the parish — pick a card, click a plot');
  refreshUI();
  refreshPlotStyles();

  // Pull the camera up so the inland plots read
  camera.position.set(44, 30, -46);
  controls.target.set(0, 3, 16);
  controls.update();

  // Wake to morning if entering in the dead of night
  if (state.env.timeOfDay < 6 || state.env.timeOfDay > 21) state.env.timeOfDay = 8;
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
  for (const p of game.plots){ p.building = null; p.type = null; }
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
