import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

export function generateDistrict(scene) {
  // clear old
  [...scene.children].forEach(o => {
    if (o.userData.procedural) scene.remove(o);
  });

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.userData.procedural = true;
  scene.add(ground);

  // 2 buildings
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(4, Math.random() * 4 + 3, 4),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 })
    );
    b.position.set(Math.random() * 20 - 10, b.geometry.parameters.height / 2, Math.random() * 20 - 10);
    b.userData.procedural = true;
    scene.add(b);
  }
}
