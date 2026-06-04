import { state } from './generator.js';

const $ = (id) => document.getElementById(id);

export function wireUI({ onGenerate, onReseed, onFrame, onScreenshot, onParam }){
  $('btnGenerate').onclick   = onGenerate;
  $('btnReseed').onclick     = onReseed;
  $('btnFrame').onclick      = onFrame;
  $('btnShot').onclick       = onScreenshot;

  $('btnAbout').onclick = () => $('about').classList.toggle('open');
  $('aboutClose').onclick = () => $('about').classList.remove('open');
  $('about').addEventListener('click', (e) => {
    if (e.target.id === 'about') $('about').classList.remove('open');
  });

  $('btnHide').onclick = () => $('ui').classList.toggle('hidden');

  $('preset').onchange    = () => onParam('preset', $('preset').value);
  $('winDensity').oninput = () => onParam('winDensity', +$('winDensity').value);
  $('roofPitch').oninput  = () => onParam('roofPitch', +$('roofPitch').value);
  $('material').onchange  = () => onParam('material', $('material').value);
  $('age').oninput        = () => onParam('age', +$('age').value);
  $('tod').oninput        = () => { onParam('tod', +$('tod').value); $('todVal').textContent = formatTod(+$('tod').value); };
  $('rain').oninput       = () => onParam('rain', +$('rain').value);
  $('cars').oninput       = () => { onParam('cars', +$('cars').value); $('carsVal').textContent = $('cars').value; };

  // Hydrate defaults from state
  $('preset').value     = state.params.preset;
  $('winDensity').value = state.params.winDensity;
  $('roofPitch').value  = state.params.roofPitch;
  $('material').value   = state.params.material;
  $('age').value        = state.params.age;
  $('tod').value        = state.env.timeOfDay;
  $('rain').value       = state.env.rain;
  $('cars').value       = state.params.cars;
  $('todVal').textContent = formatTod(state.env.timeOfDay);
  $('carsVal').textContent = state.params.cars;
}

function formatTod(t){
  const h = Math.floor(t);
  const m = Math.floor((t - h) * 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

export function updateSeedHash(seed){
  history.replaceState(null, '', `#seed=${seed}`);
  const el = $('seedVal');
  if (el) el.textContent = seed.toString(36);
}

export function logToPanel(msg){
  const el = $('log');
  if (!el) return;
  el.textContent = msg;
}
