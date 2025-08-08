// One — and only one — Three.js import (ES module build)
import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';

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

const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
function homeCam(){ camera.position.set(38, 24, 48); controls.target.set(0, 3, 0); controls.update(); }
homeCam();

const hemi = new THREE.HemisphereLight(0xbfd3ff, 0x223344, 0.75); scene.add(hemi);
const sun  = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(30,40,10); sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024); scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400), new THREE.MeshStandardMaterial({ color:0x1a1f2a, roughness:0.95 }));
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

const road = new THREE.Mesh(new THREE.RingGeometry(36, 40, 128), new THREE.MeshStandardMaterial({ color:0x0f1218, roughness:0.6 }));
road.rotation.x = -Math.PI/2; road.receiveShadow = true; scene.add(road);

const footpath = new THREE.Mesh(new THREE.RingGeometry(34, 36, 128), new THREE.MeshStandardMaterial({ color:0x252b39, roughness:0.95 }));
footpath.rotation.x = -Math.PI/2; footpath.receiveShadow = true; scene.add(footpath);

// Helpers so you always see *something*
scene.add(new THREE.GridHelper(80, 40, 0x666666, 0x333333));
scene.add(new THREE.AxesHelper(5));

// Shared groups the generator will fill
const districtGroup = new THREE.Group();
const carsGroup = new THREE.Group();
scene.add(districtGroup);
scene.add(carsGroup);

function onResize(){
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

export {
  THREE, renderer, scene, camera, controls,
  hemi, sun, road, districtGroup, carsGroup, homeCam, onResize
};
