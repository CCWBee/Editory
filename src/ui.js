import { state } from './generator.js';

export function wireUI({ onGenerate, onReseed, onFrame, onParam }){
  const $ = (id)=> document.getElementById(id);

  $('btnGenerate').onclick = onGenerate;
  $('btnReseed').onclick   = onReseed;
  $('btnFrame').onclick    = onFrame;

  $('preset').onchange     = ()=> onParam('preset', $('preset').value);
  $('winDensity').oninput  = ()=> onParam('winDensity', +$('winDensity').value);
  $('roofPitch').oninput   = ()=> onParam('roofPitch', +$('roofPitch').value);
  $('material').onchange   = ()=> onParam('material', $('material').value);
  $('age').oninput         = ()=> onParam('age', +$('age').value);
  $('tod').oninput         = ()=> onParam('tod', +$('tod').value);
  $('rain').oninput        = ()=> onParam('rain', +$('rain').value);
  $('cars').oninput        = ()=> onParam('cars', +$('cars').value);

  // Set defaults in UI
  $('preset').value      = state.params.preset;
  $('winDensity').value  = state.params.winDensity;
  $('roofPitch').value   = state.params.roofPitch;
  $('material').value    = state.params.material;
  $('age').value         = state.params.age;
  $('tod').value         = state.env.timeOfDay;
  $('rain').value        = state.env.rain;
  $('cars').value        = state.params.cars;
}
