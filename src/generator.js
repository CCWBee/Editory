// Import the SAME Three.js URL as scene.js to avoid “multiple instances”
import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

export const state = {
  version: '0.3.0',
  seed: (Math.random()*1e9)>>>0,
  env: { timeOfDay: 14.0, rain: 0.2 },
  params: { preset: 'mix', winDensity: 0.65, roofPitch: 38, material: 'granite', age: 0.35, cars: 10 }
};

function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function rngFor(){ const r = mulberry32(state.seed); return { rand:r, range(a,b){return a+(b-a)*r()}, int(n){return Math.floor(r()*n)} }; }

// Basic materials (no eval, CSP-safe)
const baseMats = {
  granite: new THREE.MeshStandardMaterial({ color:0xb28c8a, roughness:0.8, metalness:0.05 }),
  render: new THREE.MeshStandardMaterial({ color:0xe9e7df, roughness:0.9, metalness:0.0 }),
  slate: new THREE.MeshStandardMaterial({ color:0x404651, roughness:0.6, metalness:0.1 }),
  timber: new THREE.MeshStandardMaterial({ color:0x6a4a2f, roughness:0.7, metalness:0.05 }),
  fibreglass: new THREE.MeshStandardMaterial({ color:0xaec7cf, roughness:0.25, metalness:0.0 })
};
function aged(choice, age){
  const m = baseMats[choice].clone();
  const c = new THREE.Color(m.color); c.multiplyScalar(1 - age*0.22); m.color = c;
  m.roughness = THREE.MathUtils.clamp((m.roughness||0.6)+age*0.25, 0, 1);
  return m;
}
function familyFor(preset, choice){
  if (choice!=='granite') return choice;
  if (preset==='civic') return 'render';
  if (preset==='store') return 'slate';
  return 'granite';
}

export function generateDistrict({ scene, districtGroup, carsGroup }){
  // Clear old
  while(districtGroup.children.length) districtGroup.remove(districtGroup.children[0]);
  while(carsGroup.children.length) carsGroup.remove(carsGroup.children[0]);

  const rng = rngFor();

  // Two showcase buildings at origin so you always see geometry
  addBuilding(districtGroup, makeBuilding(rng,'civic',state.params), 6, state.params.age*0.2, 0,  Math.PI/6);
  addBuilding(districtGroup, makeBuilding(rng,'terrace',state.params), -10, state.params.age*0.2, -4, -Math.PI/8);

  // Ring buildings
  const N = 24, R = 30;
  for(let i=0;i<N;i++){
    const a0 = i/N*Math.PI*2, a1 = (i+1)/N*Math.PI*2, mid=(a0+a1)/2;
    const out = R + rng.range(6, 14);
    const px = Math.cos(mid)*out, pz = Math.sin(mid)*out;
    const preset = pickPreset(state.params.preset, rng);
    const b = makeBuilding(rng, preset, state.params);
    addBuilding(districtGroup, b, px, state.params.age*0.2, pz, mid + Math.PI);
  }

  // Lamps
  const lampGeom = new THREE.CylinderGeometry(0.06,0.06,4,8);
  for(let i=0;i<16;i++){
    const a = i/16*Math.PI*2; const r = 33.5;
    const pole = new THREE.Mesh(lampGeom, new THREE.MeshStandardMaterial({ color:0x9aa3ad, roughness:0.8 }));
    pole.position.set(Math.cos(a)*r, 2, Math.sin(a)*r);
    districtGroup.add(pole);
    const bulb = new THREE.PointLight(0xffe9bb, 0.0, 12, 2);
    bulb.position.set(pole.position.x, 4.1, pole.position.z);
    bulb.userData.flicker = Math.random()*1000;
    districtGroup.add(bulb);
  }

  // Cars
  const carCount = state.params.cars|0;
  for(let i=0;i<carCount;i++){
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.7,3.2), new THREE.MeshStandardMaterial({ color:new THREE.Color().setHSL(i/Math.max(1,carCount),0.5,0.5) }));
    car.userData.t = Math.random();
    carsGroup.add(car);
  }
}

function addBuilding(group, mesh, x, y, z, ry){ mesh.position.set(x,y,z); mesh.rotation.y = ry; group.add(mesh); }
function pickPreset(mode, rng){
  if (mode!=='mix') return mode;
  const r=rng.rand(); if(r<0.45) return 'terrace'; if(r<0.7) return 'house'; if(r<0.88) return 'store'; return 'civic';
}

function makeBuilding(rng, preset, params){
  const g = new THREE.Group();

  const baseW = rng.range(8, 16), baseD = rng.range(10, 20);
  const floors = Math.floor(rng.range(2, 5)), storey=3.2, baseH = floors*storey;

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(baseW, baseH, baseD),
    aged(familyFor(preset, params.material), params.age)
  ); shell.castShadow = shell.receiveShadow = true; g.add(shell);

  if (rng.rand()<0.7){
    const w = baseW*rng.range(0.5, 0.85), d = baseD*rng.range(0.5, 0.9), h = storey*rng.range(1,2);
    const dx = rng.range(-0.5,0.5)*(baseW-w)*0.6; const dz = rng.range(-0.5,0.5)*(baseD-d)*0.6;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), aged(familyFor(preset, params.material), params.age));
    upper.position.set(dx, baseH/2 + h/2, dz); upper.castShadow = upper.receiveShadow = true;
    g.add(upper);
  }

  // Windows (instanced)
  g.add(buildWindowsFor(g, params.winDensity, rng));

  // Simple pitched roof
  g.add(buildRoofFor(g, THREE.MathUtils.degToRad(params.roofPitch), params));

  return g;
}

function buildWindowsFor(group, density, rng){
  const geo = new THREE.PlaneGeometry(0.9,1.3);
  const mat = new THREE.MeshStandardMaterial({ color:0x9fb6c8, emissive:0x111315, emissiveIntensity:0.7, roughness:0.2, side:THREE.FrontSide });
  const mesh = new THREE.InstancedMesh(geo, mat, 6000);
  let idx = 0; const tmp = new THREE.Object3D();

  group.children.forEach(ch=>{
    if (!ch.isMesh) return;
    ch.geometry.computeBoundingBox();
    const size = new THREE.Vector3(); ch.geometry.boundingBox.getSize(size);
    const floors = Math.max(1, Math.floor(size.y/3.2));
    const baysX = Math.max(2, Math.floor(size.x/(2.2 - density*1.2)));
    const baysZ = Math.max(2, Math.floor(size.z/(2.2 - density*1.2)));
    const faces = [
      { n:new THREE.Vector3(1,0,0), u:'z', bays:baysZ, width:size.z },
      { n:new THREE.Vector3(-1,0,0), u:'z', bays:baysZ, width:size.z },
      { n:new THREE.Vector3(0,0,1), u:'x', bays:baysX, width:size.x },
      { n:new THREE.Vector3(0,0,-1), u:'x', bays:baysX, width:size.x }
    ];
    faces.forEach(f=>{
      for(let fl=1; fl<floors; fl++){
        for(let b=0; b<f.bays; b++){
          if (rng.rand() > density) continue;
          const frac = (b+0.5)/f.bays;
          const px = f.u==='x' ? (frac-0.5)*size.x : (f.n.x>0? size.x/2 : -size.x/2);
          const pz = f.u==='z' ? (frac-0.5)*size.z : (f.n.z>0? size.z/2 : -size.z/2);
          const py = -size.y/2 + fl*3.2 + 1.6;
          tmp.position.set(px, py, pz).add(ch.position);
          tmp.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), f.n);
          const s = 1 + (rng.rand()*0.18 - 0.08);
          tmp.scale.set(s, s, 1);
          tmp.updateMatrix();
          if (idx<mesh.count) mesh.setMatrixAt(idx++, tmp.matrix);
        }
      }
    });
  });
  mesh.count = Math.max(1, idx);
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function buildRoofFor(group, pitch, params){
  // Find largest box
  let base=null, maxVol=-1, size=new THREE.Vector3();
  group.traverse(o=>{
    if(o.isMesh){
      o.geometry.computeBoundingBox(); const s=new THREE.Vector3(); o.geometry.boundingBox.getSize(s);
      const v=s.x*s.y*s.z; if(v>maxVol){maxVol=v;base=o;size.copy(s)}
    }
  });
  if(!base) return new THREE.Group();
  const roof = new THREE.Group();
  const ridgeH = Math.tan(pitch)*(size.x*0.5);
  const g = new THREE.ConeGeometry(size.x*0.5, ridgeH*2, 4, 1, true);
  const m = baseMats.slate.clone(); m.roughness = 0.8 - 0.3*(1-params.age);
  const c = new THREE.Mesh(g,m); c.castShadow = c.receiveShadow = true;
  c.rotation.z = Math.PI/2; c.scale.set(1,1, size.z/(size.x*0.5));
  c.position.y = size.y/2 + ridgeH*0.5; roof.add(c);
  return roof;
}
