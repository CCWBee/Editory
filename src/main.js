import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js?module';
import { generateDistrict, rngFor, state, setParam, regenRain, updateSun, carsGroup, districtGroup } from './generator.js';
import { wireUI } from './ui.js';

// -------- Renderer / scene --------
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);

// Camera and controls
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
function homeCam(){ camera.position.set(38, 24, 48); controls.target.set(0, 3, 0); controls.update(); }
homeCam();

// Lights
const hemi = new THREE.HemisphereLight(0xbfd3ff, 0x223344, 0.75); scene.add(hemi);
const sun  = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(30,40,10); sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024); scene.add(sun);

// Ground, road, pavement
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400), new THREE.MeshStandardMaterial({ color:0x1a1f2a, roughness:0.95 }));
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

const road = new THREE.Mesh(new THREE.RingGeometry(36, 40, 128), new THREE.MeshStandardMaterial({ color:0x0f1218, roughness:0.6 }));
road.rotation.x = -Math.PI/2; road.receiveShadow = true; scene.add(road);

const footpath = new THREE.Mesh(new THREE.RingGeometry(34, 36, 128), new THREE.MeshStandardMaterial({ color:0x252b39, roughness:0.95 }));
footpath.rotation.x = -Math.PI/2; footpath.receiveShadow = true; scene.add(footpath);

// Drains
const drainGeom = new THREE.BoxGeometry(0.6, 0.05, 0.2);
for(let i=0;i<16;i++){
  const m = new THREE.MeshStandardMaterial({ color:0x22272f, roughness:0.8 });
  const d = new THREE.Mesh(drainGeom,m);
  const a = i/16*Math.PI*2; const r = 35.1;
  d.position.set(Math.cos(a)*r, 0.03, Math.sin(a)*r);
  d.rotation.y = a; scene.add(d);
}

// Attach shared groups
scene.add(districtGroup);
scene.add(carsGroup);

// Debug helpers to guarantee visibility
scene.add(new THREE.GridHelper(80, 40, 0x666666, 0x333333));
scene.add(new THREE.AxesHelper(5));

// WebGL context loss overlay
const overlay = document.getElementById('overlay');
renderer.domElement.addEventListener('webglcontextlost', (e)=>{ e.preventDefault(); overlay.style.display='flex'; }, false);
renderer.domElement.addEventListener('webglcontextrestored', ()=> location.reload(), false);

// Wire UI
wireUI({
  onGenerate: ()=>{ generateDistrict(scene); },
  onReseed: ()=>{ state.seed = (Math.random()*1e9)>>>0; generateDistrict(scene); },
  onFrame: ()=> homeCam(),
  onSave: ()=> {
    const json = JSON.stringify({ version: state.version, seed: state.seed, env: state.env, params: state.params }, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `neo-anglo-norman-${state.seed}.json`; a.click();
  },
  onRestore: (obj)=> {
    state.seed = obj.seed ?? state.seed;
    if (obj.env) Object.assign(state.env, obj.env);
    if (obj.params) Object.assign(state.params, obj.params);
    generateDistrict(scene); regenRain(scene); updateSun(scene, state.env.timeOfDay);
    homeCam();
  },
  onParam: (k,v)=> setParam(k,v, scene)
});

// First boot: bright day, guaranteed centre buildings
function boot(){
  updateSun(scene, state.env.timeOfDay);
  regenRain(scene);
  generateDistrict(scene, { forceShowcase:true });
  homeCam();
  animate();
  log('Auto-generated demo on load.');
}
boot();

// Animation loop
const clock = new THREE.Clock();
function carPosAt(t){ const R = 38; const a = t*Math.PI*2; return new THREE.Vector3(Math.cos(a)*R, 0.15, Math.sin(a)*R); }

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());
  const t = performance.now()*0.001;

  // Cars loop
  for(const car of carsGroup.children){
    car.userData.t = (car.userData.t + dt*0.03*(0.7+Math.sin(t+car.id)*0.3))%1;
    const p = carPosAt(car.userData.t);
    const p2 = carPosAt((car.userData.t+0.01)%1);
    car.position.copy(p);
    car.lookAt(p2.x, p2.y, p2.z);
  }

  // Per-object ticks
  districtGroup.traverse(o=>{ if (o.userData && o.userData.tick) o.userData.tick(t); });

  renderer.render(scene, camera);
}

// Simple logger
function log(s){ const el=document.getElementById('log'); if(el) el.textContent=s; }

// Window resize
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Expose for the generator
export { THREE, sun, hemi, road };
