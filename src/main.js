import { THREE, renderer, scene, camera, controls, hemi, sun, road, districtGroup, carsGroup, homeCam, onResize } from './scene.js';
import { state, generateDistrict } from './generator.js';
import { wireUI } from './ui.js';

// One render loop, one clock — declared BEFORE use
const clock = new THREE.Clock();

function updateSunAndWetness(){
  const tod = state.env.timeOfDay;
  const theta = (tod/24)*Math.PI*2;
  const elevRaw = Math.sin(theta)*0.9;
  const elev = Math.max(0.12, elevRaw);
  const az = Math.cos(theta)*Math.PI;
  const dir = new THREE.Vector3(Math.cos(az)*Math.cos(elev), Math.sin(elev), Math.sin(az)*Math.cos(elev));
  sun.position.copy(dir.multiplyScalar(60));
  const isNightish = elev<0.2;
  sun.intensity = isNightish ? 0.35 : 2.2;
  hemi.intensity = isNightish ? 0.35 : 0.75;
  const wet = state.env.rain*0.8;
  road.material.roughness = THREE.MathUtils.clamp(0.7 - wet*0.5, 0.05, 1);
  road.material.needsUpdate = true;
  // streetlights (if any)
  districtGroup.children.forEach(ch=>{
    if (ch.isPointLight) ch.intensity = isNightish ? 1.2 + Math.sin((performance.now()+ch.userData.flicker)*0.004)*0.2 : 0.0;
  });
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());
  const t = performance.now()*0.001;

  // Simple car loop animation
  const R = 38;
  for(const car of carsGroup.children){
    car.userData.t = (car.userData.t + dt*0.03*(0.7+Math.sin(t+car.id)*0.3))%1;
    const a = car.userData.t*Math.PI*2;
    const p = new THREE.Vector3(Math.cos(a)*R, 0.15, Math.sin(a)*R);
    const p2 = new THREE.Vector3(Math.cos((car.userData.t+0.01)%1*Math.PI*2)*R, 0.15, Math.sin((car.userData.t+0.01)%1*Math.PI*2)*R);
    car.position.copy(p);
    car.lookAt(p2);
  }

  renderer.render(scene, camera);
}

function boot(){
  // Wire UI
  wireUI({
    onGenerate: ()=> generateDistrict({ scene, districtGroup, carsGroup }),
    onReseed: ()=> { state.seed = (Math.random()*1e9)>>>0; generateDistrict({ scene, districtGroup, carsGroup }); },
    onFrame: ()=> homeCam(),
    onParam: (k,v)=>{
      const p = state.params;
      switch(k){
        case 'preset': p.preset=v; break;
        case 'winDensity': p.winDensity=+v; break;
        case 'roofPitch': p.roofPitch=+v; break;
        case 'material': p.material=v; break;
        case 'age': p.age=+v; break;
        case 'tod': state.env.timeOfDay=+v; updateSunAndWetness(); return;
        case 'rain': state.env.rain=+v; updateSunAndWetness(); return;
        case 'cars': p.cars=+v; break;
      }
      generateDistrict({ scene, districtGroup, carsGroup });
    }
  });

  // First frame
  updateSunAndWetness();
  generateDistrict({ scene, districtGroup, carsGroup });
  homeCam();
  animate();
}

// Resize
addEventListener('resize', onResize);

// Go
boot();
