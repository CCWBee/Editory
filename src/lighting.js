import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

export function addLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  hemi.position.set(0, 50, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(20, 40, 20);
  scene.add(dir);
}
