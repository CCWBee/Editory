import { state } from './generator.js?v=07';

const $ = (id) => document.getElementById(id);
const PRESET_LABELS = {
  mix: 'District mix',
  terrace: 'Terrace',
  house: 'House',
  civic: 'Civic',
  store: 'Coastal storehouse',
  bow: 'Bow-front Georgian',
  'granite-glass': 'Granite + glass',
  future: 'Future register',
};
const MAT_LABELS = {
  granite: 'Pink granite',
  render: 'Lime render',
  slate: 'Slate panels',
  timber: 'Timber + stone',
  fibreglass: 'Fibreglass',
};

function fmtTod(t){
  const h = Math.floor(t);
  const m = Math.floor((t - h) * 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function fmtPct(v){ return `${Math.round(v*100)}%`; }
function fmtDeg(v){ return `${Math.round(v)}°`; }

function setActiveButton(group, value, attr){
  group.querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', b.dataset[attr] === value);
  });
}

export function wireUI({ onGenerate, onReseed, onFrame, onScreenshot, onParam }){
  $('btnGenerate').onclick = onGenerate;
  $('btnReseed').onclick   = onReseed;
  $('btnFrame').onclick    = onFrame;
  $('btnShot').onclick     = onScreenshot;

  $('btnAbout').onclick = () => $('about').classList.toggle('open');
  $('aboutClose').onclick = () => $('about').classList.remove('open');
  $('about').addEventListener('click', (e) => {
    if (e.target.id === 'about') $('about').classList.remove('open');
  });

  $('btnHide').onclick = () => $('ui').classList.toggle('hidden');

  // Preset grid — click handlers
  const presetGrid = $('presetGrid');
  presetGrid.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      const v = btn.dataset.preset;
      setActiveButton(presetGrid, v, 'preset');
      $('presetLabel').textContent = PRESET_LABELS[v];
      onParam('preset', v);
    };
  });

  // Material swatches
  const matGrid = $('matGrid');
  matGrid.querySelectorAll('.mat-btn').forEach(btn => {
    btn.onclick = () => {
      const v = btn.dataset.mat;
      setActiveButton(matGrid, v, 'mat');
      $('matLabel').textContent = MAT_LABELS[v];
      onParam('material', v);
    };
  });

  // Shutters segmented control
  const shuttersSeg = $('shuttersSeg');
  shuttersSeg.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      const v = btn.dataset.shutters;
      setActiveButton(shuttersSeg, v, 'shutters');
      onParam('shutters', v);
    };
  });

  // Sliders — emit onParam + update live value labels
  function bindSlider(id, formatter){
    const el = $(id), valEl = $(id + 'Val');
    el.oninput = () => {
      const v = +el.value;
      if (valEl) valEl.textContent = formatter ? formatter(v) : v;
      onParam(id, v);
    };
    // Set initial display
    if (valEl) valEl.textContent = formatter ? formatter(+el.value) : el.value;
  }
  bindSlider('winDensity', fmtPct);
  bindSlider('roofPitch',  fmtDeg);
  bindSlider('age',        fmtPct);
  bindSlider('tod',        fmtTod);
  bindSlider('rain',       fmtPct);
  bindSlider('cars',       null);

  // Hydrate from state
  setActiveButton(presetGrid, state.params.preset, 'preset');
  $('presetLabel').textContent = PRESET_LABELS[state.params.preset];
  setActiveButton(matGrid, state.params.material, 'mat');
  $('matLabel').textContent = MAT_LABELS[state.params.material];
  setActiveButton(shuttersSeg, state.params.shutters, 'shutters');
  $('winDensity').value = state.params.winDensity;
  $('winDensityVal').textContent = fmtPct(state.params.winDensity);
  $('roofPitch').value = state.params.roofPitch;
  $('roofPitchVal').textContent = fmtDeg(state.params.roofPitch);
  $('age').value = state.params.age;
  $('ageVal').textContent = fmtPct(state.params.age);
  $('tod').value = state.env.timeOfDay;
  $('todVal').textContent = fmtTod(state.env.timeOfDay);
  $('rain').value = state.env.rain;
  $('rainVal').textContent = fmtPct(state.env.rain);
  $('cars').value = state.params.cars;
  $('carsVal').textContent = state.params.cars;
}

export function updateSeedHash(seed){
  history.replaceState(null, '', `#seed=${seed}`);
  const el = $('seedVal');
  if (el) el.textContent = seed.toString(36);
}

export function logToPanel(_msg){
  // No-op now — the redesigned panel uses inline value labels rather than a status log
}
