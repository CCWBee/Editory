// Neo-Anglo-Norman scene: harbour, sea, sky, coastal road.
// Sky vertex colours and sun direction are driven from main.js per time-of-day.
import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9bccc, 80, 380);

const camera = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.1, 1500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 10;
controls.maxDistance = 220;

const HOME_POS = new THREE.Vector3(34, 19, -50);
const HOME_TGT = new THREE.Vector3(0, 5, 5);
function homeCam(){
  camera.position.copy(HOME_POS);
  controls.target.copy(HOME_TGT);
  controls.update();
}
homeCam();

// Sky dome — inside-out sphere via BackSide rendering, vertex-coloured (updated in main.js)
const skyGeo = new THREE.SphereGeometry(600, 48, 28);
const skyColors = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false, fog: false, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
sky.renderOrder = -10;
scene.add(sky);

// Lights
const hemi = new THREE.HemisphereLight(0xbfd3ff, 0x554433, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d6, 1.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 240;
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;  sun.shadow.camera.bottom = -90;
sun.shadow.bias = -0.0006;
scene.add(sun);

const ambient = new THREE.AmbientLight(0x223344, 0.18);
scene.add(ambient);

// Sun disc — visible in the sky
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(7, 36),
  new THREE.MeshBasicMaterial({ color: 0xfff1c2, fog: false, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })
);
sunDisc.renderOrder = -9;
scene.add(sunDisc);

// Sea — large flat plane, slight subdivision for material lighting consistency.
// Tucked entirely behind the beach so its edge can't poke through ground objects.
const seaGeo = new THREE.PlaneGeometry(900, 500, 60, 24);
seaGeo.rotateX(-Math.PI/2);
const seaMat = new THREE.MeshStandardMaterial({
  color: 0x4a708a,
  roughness: 0.38,
  metalness: 0.18,
});
const sea = new THREE.Mesh(seaGeo, seaMat);
sea.position.set(0, -0.04, -262);
sea.receiveShadow = true;
scene.add(sea);

// Beach / pebble strip between wall and sea
const beach = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 9),
  new THREE.MeshStandardMaterial({ color: 0x807162, roughness: 0.97 })
);
beach.rotation.x = -Math.PI/2;
beach.position.set(0, 0.005, -14);
beach.receiveShadow = true;
scene.add(beach);

// Harbour wall — pink granite course running along the coast
const wall = new THREE.Mesh(
  new THREE.BoxGeometry(900, 1.4, 0.9),
  new THREE.MeshStandardMaterial({ color: 0x9c8278, roughness: 0.88, metalness: 0.02 })
);
wall.position.set(0, 0.7, -9.4);
wall.castShadow = true; wall.receiveShadow = true;
scene.add(wall);

// Capstones along the wall — small repeating blocks (visual texture)
const capMat = new THREE.MeshStandardMaterial({ color: 0xb59e92, roughness: 0.82 });
for (let x = -445; x <= 445; x += 5){
  const cap = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.18, 1.05), capMat);
  cap.position.set(x, 1.45, -9.4);
  cap.castShadow = true; cap.receiveShadow = true;
  scene.add(cap);
}

// Coastal road
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 6.2),
  new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.7, metalness: 0.0 })
);
road.rotation.x = -Math.PI/2;
road.position.set(0, 0.01, -5.8);
road.receiveShadow = true;
scene.add(road);

// White centre line — a thin emissive-ish strip
const roadLine = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 0.12),
  new THREE.MeshStandardMaterial({ color: 0xd8d0bd, roughness: 0.8 })
);
roadLine.rotation.x = -Math.PI/2;
roadLine.position.set(0, 0.012, -5.8);
scene.add(roadLine);

// Footpath in front of buildings
const path = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 2.4),
  new THREE.MeshStandardMaterial({ color: 0x827b71, roughness: 0.95 })
);
path.rotation.x = -Math.PI/2;
path.position.set(0, 0.02, -1.6);
path.receiveShadow = true;
scene.add(path);

// Land behind the buildings (rises away from the camera, hidden under district)
const land = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 220),
  new THREE.MeshStandardMaterial({ color: 0x3e4a31, roughness: 0.96 })
);
land.rotation.x = -Math.PI/2;
land.position.set(0, 0.0, 110);
land.receiveShadow = true;
scene.add(land);

// Groups
const districtGroup = new THREE.Group();
const carsGroup     = new THREE.Group();
const lampGroup     = new THREE.Group();
const rainGroup     = new THREE.Group();
scene.add(districtGroup, carsGroup, lampGroup, rainGroup);

function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

export {
  THREE, renderer, scene, camera, controls,
  hemi, sun, ambient, sunDisc, sea, road, roadLine, wall, path, sky,
  districtGroup, carsGroup, lampGroup, rainGroup,
  homeCam, onResize
};
