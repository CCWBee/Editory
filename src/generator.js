import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

// simple shared state used by the editor UI
export const state = {
  version: 1,
  seed: (Math.random() * 1e9) >>> 0,
  env: { timeOfDay: 14 },
  params: {}
};

// placeholder groups so main.js can attach them to the scene
export const districtGroup = new THREE.Group();
export const carsGroup = new THREE.Group();

// very small linear congruential generator (unused but exported for completeness)
export function rngFor(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// basic stubs for UI hooks
export function setParam(k, v, scene) {
  state.params[k] = v;
}

export function regenRain(scene) {
  // rain system not implemented in this pared-down demo
}

export function updateSun(scene, tod) {
  // sun / lighting adjustments omitted
}

// generate a very small district: a ground plane and two simple boxes
export function generateDistrict(scene) {
  districtGroup.clear();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.userData.procedural = true;
  districtGroup.add(ground);

  for (let i = 0; i < 2; i++) {
    const h = Math.random() * 4 + 3;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(4, h, 4),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 })
    );
    b.position.set(Math.random() * 20 - 10, h / 2, Math.random() * 20 - 10);
    b.userData.procedural = true;
    districtGroup.add(b);
  }
}
