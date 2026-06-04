// Neo-Anglo-Norman district generator.
// Buildings line a coastal road. Preset drives massing; material drives palette;
// age drives weathering; window density, roof pitch and cars are independent knobs.
import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

export const state = {
  version: '0.4.0',
  seed: (Math.random()*1e9) >>> 0,
  env:    { timeOfDay: 13.5, rain: 0.1 },
  params: { preset: 'mix', winDensity: 0.7, roofPitch: 42, material: 'granite', age: 0.3, cars: 8 }
};

// Shared materials whose properties are updated from main.js per environment
export const sharedGlass = new THREE.MeshStandardMaterial({
  color: 0x6c8696, roughness: 0.18, metalness: 0.55,
  emissive: 0xffce80, emissiveIntensity: 0.0,
});
export const sharedLampHead = new THREE.MeshStandardMaterial({
  color: 0x1a1c20, emissive: 0xffd9a0, emissiveIntensity: 0.0, roughness: 0.4
});

// PRNG
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t>>>15), t | 1);
    t ^= t + Math.imul(t ^ (t>>>7), t | 61);
    return ((t ^ (t>>>14)) >>> 0) / 4294967296;
  };
}
function rngFor(seed){
  const r = mulberry32(seed);
  return { rand: r, range:(a,b)=> a + (b-a)*r(), int:(n)=> Math.floor(r()*n), pick:(arr)=> arr[Math.floor(r()*arr.length)] };
}

const HEX_WALL = {
  granite:    0xd2a695,   // Jersey pink granite — warmer, pinker than first pass
  render:     0xefe8d4,
  slate:      0x4d5663,
  timber:     0x84623c,
  fibreglass: 0xc6d4d9,
};

function agedify(col, family, age){
  const hsl = {}; col.getHSL(hsl);
  if (family === 'granite'){
    hsl.s = Math.max(0, hsl.s - age*0.14);
    hsl.h = (hsl.h + age*0.03) % 1;
    hsl.l = Math.max(0, hsl.l - age*0.06);
  } else if (family === 'render'){
    hsl.s = Math.max(0, hsl.s - age*0.10);
    hsl.l = Math.max(0, hsl.l - age*0.12);
    hsl.h = (hsl.h + age*0.02) % 1;
  } else if (family === 'slate'){
    hsl.l = Math.max(0, hsl.l - age*0.04);
  } else if (family === 'timber'){
    hsl.s = Math.max(0, hsl.s - age*0.24);
    hsl.l = Math.min(1, hsl.l + age*0.10);
  } else if (family === 'fibreglass'){
    hsl.s = Math.max(0, hsl.s - age*0.08);
    hsl.l = Math.max(0, hsl.l - age*0.04);
  }
  col.setHSL(hsl.h, hsl.s, hsl.l);
  return col;
}

function makePalette(material, age, preset, rng){
  const family = material;
  const c = new THREE.Color(HEX_WALL[family]);
  // per-building variation
  c.offsetHSL((rng.rand()-0.5)*0.02, (rng.rand()-0.5)*0.05, (rng.rand()-0.5)*0.07);
  agedify(c, family, age);

  const wall = new THREE.MeshStandardMaterial({ color: c, roughness: 0.74 + age*0.16, metalness: family==='fibreglass'? 0.08 : 0.02 });

  const surroundC = c.clone();
  if (family === 'granite')      surroundC.offsetHSL(0,-0.06, 0.10);
  else if (family === 'render')  surroundC.offsetHSL(0, 0, -0.10);
  else if (family === 'slate')   surroundC.offsetHSL(0, 0, +0.10);
  else if (family === 'timber')  surroundC.offsetHSL(0,-0.10, 0.05);
  else                            surroundC.offsetHSL(0, 0, -0.06);
  const surround = new THREE.MeshStandardMaterial({ color: surroundC, roughness: 0.78 });

  const plinthC = c.clone().offsetHSL(0, 0, -0.12);
  const plinth = new THREE.MeshStandardMaterial({ color: plinthC, roughness: 0.92 });

  const roofC = new THREE.Color(0x3a3f4a);
  agedify(roofC, 'slate', age*0.6);
  const roof = new THREE.MeshStandardMaterial({ color: roofC, roughness: 0.6 + age*0.18, metalness: 0.12 });

  const roofRidgeC = roofC.clone().offsetHSL(0, 0, -0.05);
  const roofRidge = new THREE.MeshStandardMaterial({ color: roofRidgeC, roughness: 0.7 });

  const chimneyCap = new THREE.MeshStandardMaterial({ color: 0x7a818c, roughness: 0.75 });

  const doorPalette = [0x113022, 0x2a1610, 0x5b0e0e, 0x123e6a, 0x252a30];
  const door = new THREE.MeshStandardMaterial({ color: rng.pick(doorPalette), roughness: 0.45, metalness: 0.05 });

  return { wall, surround, quoin: surround, plinth, roof, roofRidge, chimney: wall, chimneyCap, door };
}

function chooseDims(rng, preset){
  let w, d, floors;
  switch (preset){
    case 'terrace':
      w = rng.range(4.4, 5.6); d = rng.range(7.0, 10.5); floors = 2 + (rng.rand() < 0.35 ? 1 : 0); break;
    case 'house':
      w = rng.range(7.5, 10.5); d = rng.range(8.5, 12); floors = 2; break;
    case 'civic':
      w = rng.range(13, 20); d = rng.range(10, 14); floors = 2 + (rng.rand() < 0.7 ? 1 : 0); break;
    case 'store':
      w = rng.range(8.5, 13.5); d = rng.range(14, 22); floors = 2; break;
    default:
      w = rng.range(6, 10); d = rng.range(8, 13); floors = 2;
  }
  const storey = 3.1;
  return { w, d, floors, storey, h: floors*storey };
}

function addPlinth(g, {w, d}, palette){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.20, 0.45, d + 0.20), palette.plinth);
  m.position.y = 0.225;
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

function addShell(g, {w, d, h}, palette){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), palette.wall);
  m.position.y = h/2 + 0.45;
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

function addQuoins(g, {w, d, h}, palette){
  const baseY = 0.45;
  const stepH = 0.55;
  for (const sx of [-1, +1]){
    for (const sz of [-1, +1]){
      let y = baseY;
      let i = 0;
      while (y < h + baseY - 0.05){
        const longX = i % 2 === 0;
        const bw = longX ? 0.85 : 0.45;
        const bd = longX ? 0.45 : 0.85;
        const blockH = Math.min(stepH, h + baseY - y);
        const block = new THREE.Mesh(new THREE.BoxGeometry(bw, blockH - 0.03, bd), palette.quoin);
        block.position.set(sx*(w/2 - bw/2 + 0.04), y + blockH/2, sz*(d/2 - bd/2 + 0.04));
        block.castShadow = block.receiveShadow = true;
        g.add(block);
        y += blockH;
        i++;
      }
    }
  }
}

function addRoof(g, {w, d, h}, pitchDeg, palette){
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  const ridgeAlongZ = d >= w;
  const W = ridgeAlongZ ? w : d;
  const D = ridgeAlongZ ? d : w;
  const ridgeH = Math.tan(pitch) * (W/2);
  const over = 0.4;
  const baseY = h + 0.45;
  const peakY = baseY + ridgeH;

  // Roof slope geometry (two pitched faces, with eaves overhang)
  const slopeV = new Float32Array([
    -W/2 - over, baseY, -D/2 - over, //0
     W/2 + over, baseY, -D/2 - over, //1
     W/2 + over, baseY,  D/2 + over, //2
    -W/2 - over, baseY,  D/2 + over, //3
     0,          peakY, -D/2 - over, //4
     0,          peakY,  D/2 + over, //5
  ]);
  const slopeI = new Uint16Array([
    0,3,5,  0,5,4,    // left slope (outward normal -X)
    1,4,5,  1,5,2,    // right slope (outward normal +X)
  ]);
  const slopeGeo = new THREE.BufferGeometry();
  slopeGeo.setAttribute('position', new THREE.BufferAttribute(slopeV, 3));
  slopeGeo.setIndex(new THREE.BufferAttribute(slopeI, 1));
  slopeGeo.computeVertexNormals();
  const slopes = new THREE.Mesh(slopeGeo, palette.roof);
  if (!ridgeAlongZ) slopes.rotation.y = Math.PI/2;
  slopes.castShadow = slopes.receiveShadow = true;
  g.add(slopes);

  // Gable end walls (triangles in same material as walls)
  const gV = new Float32Array([
    -W/2, baseY,  D/2,  // front gable
     W/2, baseY,  D/2,
     0,   peakY,  D/2,
    -W/2, baseY, -D/2,  // back gable
     W/2, baseY, -D/2,
     0,   peakY, -D/2,
  ]);
  const gI = new Uint16Array([
    0,1,2,    // front gable (outward +Z)
    3,5,4,    // back gable (outward -Z)
  ]);
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gV, 3));
  gGeo.setIndex(new THREE.BufferAttribute(gI, 1));
  gGeo.computeVertexNormals();
  const gables = new THREE.Mesh(gGeo, palette.wall);
  if (!ridgeAlongZ) gables.rotation.y = Math.PI/2;
  gables.castShadow = gables.receiveShadow = true;
  g.add(gables);

  // Ridge cap
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.20, D + over*2),
    palette.roofRidge
  );
  cap.position.set(0, peakY + 0.10, 0);
  if (!ridgeAlongZ) cap.rotation.y = Math.PI/2;
  cap.castShadow = true;
  g.add(cap);

  g.userData.roof = { ridgeAlongZ, peakY, W, D, baseY, ridgeH };
}

function addChimneys(g, dims, palette, rng, preset){
  const roof = g.userData.roof;
  if (!roof) return;
  const {w, d} = dims;
  const count = preset === 'civic' ? 2 : (rng.rand() < 0.55 ? 1 : 2);

  for (let i = 0; i < count; i++){
    const chW = roof.ridgeAlongZ ? 0.7 : 0.9;
    const chD = roof.ridgeAlongZ ? 0.9 : 0.7;
    const chH = 1.5 + rng.rand()*0.8;
    const pos = new THREE.Vector3();
    if (roof.ridgeAlongZ){
      pos.set(0, roof.peakY + chH/2 - 0.05, i === 0 ? d/2 - 0.6 : -d/2 + 0.6);
    } else {
      pos.set(i === 0 ? w/2 - 0.6 : -w/2 + 0.6, roof.peakY + chH/2 - 0.05, 0);
    }
    const ch = new THREE.Mesh(new THREE.BoxGeometry(chW, chH, chD), palette.chimney);
    ch.position.copy(pos);
    ch.castShadow = ch.receiveShadow = true;
    g.add(ch);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(chW + 0.18, 0.14, chD + 0.18), palette.chimneyCap);
    cap.position.copy(pos).add(new THREE.Vector3(0, chH/2 + 0.07, 0));
    cap.castShadow = true;
    g.add(cap);
  }
}

function addOpening(g, faceDir, axis, perpSize, u, y, isDoor, palette, material, preset){
  const ow = isDoor ? (preset === 'store' ? 2.4 : (preset === 'civic' ? 1.4 : 1.05)) : 0.95;
  const oh = isDoor ? (preset === 'store' ? 2.6 : (preset === 'civic' ? 2.4  : 2.05)) : 1.35;

  const pos = new THREE.Vector3();
  if (axis === 'x'){
    pos.set(u, y, faceDir.z * perpSize/2);
  } else {
    pos.set(faceDir.x * perpSize/2, y, u);
  }
  const yaw = Math.atan2(faceDir.x, faceDir.z);

  // Surround
  const showSurround = (material === 'granite') || (material === 'render') || isDoor || (material === 'timber' && isDoor);
  if (showSurround){
    const thick = isDoor ? 0.16 : 0.13;
    const depth = (material === 'granite' || isDoor) ? 0.08 : 0.04;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(ow + thick*2, oh + thick*2, depth),
      palette.surround
    );
    frame.position.copy(pos).add(faceDir.clone().multiplyScalar(depth/2 + 0.001));
    frame.rotation.y = yaw;
    frame.castShadow = frame.receiveShadow = true;
    g.add(frame);
  }

  // Glass / door pane
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(ow, oh),
    isDoor ? palette.door : sharedGlass
  );
  pane.position.copy(pos).add(faceDir.clone().multiplyScalar(0.055));
  pane.rotation.y = yaw;
  g.add(pane);

  // Sill (windows only, for granite/render)
  if (!isDoor && (material === 'granite' || material === 'render')){
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(ow + 0.45, 0.10, 0.22),
      palette.surround
    );
    sill.position.copy(pos).add(faceDir.clone().multiplyScalar(0.10));
    sill.position.y -= oh/2 + 0.08;
    sill.rotation.y = yaw;
    sill.castShadow = sill.receiveShadow = true;
    g.add(sill);
  }
}

function addOpenings(g, dims, palette, params, rng, preset){
  const {w, d, h, floors, storey} = dims;
  const faces = [
    { dir: new THREE.Vector3(0, 0, -1), axis: 'x', size: w, perp: d, importance: 1.00, isFront: true  }, // FRONT (faces harbour, -Z)
    { dir: new THREE.Vector3(0, 0,  1), axis: 'x', size: w, perp: d, importance: 0.55, isFront: false }, // back
    { dir: new THREE.Vector3( 1, 0, 0), axis: 'z', size: d, perp: w, importance: 0.50, isFront: false }, // right
    { dir: new THREE.Vector3(-1, 0, 0), axis: 'z', size: d, perp: w, importance: 0.50, isFront: false }, // left
  ];

  const baySpacing = preset === 'civic' ? 2.9 : (preset === 'store' ? 3.2 : 2.4);

  faces.forEach(face => {
    const bays = Math.max(1, Math.round(face.size / baySpacing));
    const bayW = face.size / bays;
    const cx = bays % 2 === 1 ? Math.floor(bays/2) : -1;

    for (let s = 0; s < floors; s++){
      for (let b = 0; b < bays; b++){
        const isGround = s === 0;
        const isCenter = b === cx;
        const isDoor = face.isFront && isGround && isCenter;
        // density gate (always place door)
        if (!isDoor){
          const threshold = params.winDensity * face.importance + (isGround ? -0.05 : 0.0);
          if (rng.rand() > threshold) continue;
        }
        const u = -face.size/2 + (b + 0.5) * bayW;
        const doorH = preset === 'store' ? 2.6 : (preset === 'civic' ? 2.4 : 2.05);
        const y = isDoor
          ? 0.45 + 0.05 + doorH/2
          : 0.45 + s*storey + storey*0.52;
        addOpening(g, face.dir, face.axis, face.perp, u, y, isDoor, palette, params.material, preset);
      }
    }

    // For storehouse front, add a large loading door once (gable-end style)
    if (preset === 'store' && face.isFront){
      // already handled above by central door
    }
  });
}

function addCornice(g, {w, d, h}, palette){
  // String course between ground and first floor for civic buildings
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.06, 0.16, d + 0.06),
    palette.surround
  );
  band.position.y = 0.45 + 3.1 - 0.08;
  band.castShadow = band.receiveShadow = true;
  g.add(band);

  // Eaves cornice
  const eaves = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.20, 0.20, d + 0.20),
    palette.surround
  );
  eaves.position.y = h + 0.45 - 0.10;
  eaves.castShadow = eaves.receiveShadow = true;
  g.add(eaves);
}

function makeBuilding(rng, preset, params){
  const dims = chooseDims(rng, preset);
  const palette = makePalette(params.material, params.age, preset, rng);

  const g = new THREE.Group();
  g.userData.preset = preset;
  g.userData.dims = dims;

  addPlinth(g, dims, palette);
  addShell(g, dims, palette);

  if (params.material === 'granite' || preset === 'store' || preset === 'civic'){
    addQuoins(g, dims, palette);
  }

  addRoof(g, dims, params.roofPitch, palette);
  addChimneys(g, dims, palette, rng, preset);

  if (preset === 'civic') addCornice(g, dims, palette);

  addOpenings(g, dims, palette, params, rng, preset);

  return g;
}

function pickPreset(mode, rng){
  if (mode !== 'mix') return mode;
  const r = rng.rand();
  if (r < 0.40) return 'terrace';
  if (r < 0.65) return 'house';
  if (r < 0.85) return 'store';
  return 'civic';
}

function addStreetlights(lampGroup, rng){
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.75 });
  const poleGeo = new THREE.CylinderGeometry(0.065, 0.07, 4.6, 8);
  for (let x = -56; x <= 56; x += 14){
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.3, -3.0);
    pole.castShadow = true;
    lampGroup.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.3), poleMat);
    arm.position.set(x, 4.55, -3.65);
    arm.castShadow = true;
    lampGroup.add(arm);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), sharedLampHead);
    head.position.set(x, 4.6, -4.3);
    lampGroup.add(head);

    const bulb = new THREE.PointLight(0xffd9a0, 0.0, 16, 2);
    bulb.position.set(x, 4.4, -4.3);
    bulb.userData.flicker = rng.rand() * 1000;
    bulb.userData.isLampBulb = true;
    lampGroup.add(bulb);
  }
}

function addCars(carsGroup, count, rng){
  for (let i = 0; i < count; i++){
    const col = new THREE.Color().setHSL(rng.rand(), 0.35 + rng.rand()*0.25, 0.42 + rng.rand()*0.15);
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.7),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.5 }));
    body.position.y = 0.4;
    body.castShadow = body.receiveShadow = true;
    car.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.5, 1.85),
      new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.25, metalness: 0.4 }));
    cabin.position.set(0, 0.95, -0.15);
    cabin.castShadow = true;
    car.add(cabin);

    car.userData.speed = (rng.rand() < 0.5 ? 1 : -1) * (3 + rng.rand()*5);
    car.userData.lane = rng.rand() < 0.5 ? -4.6 : -7.0;
    car.position.x = (rng.rand() - 0.5) * 110;
    car.position.z = car.userData.lane;
    car.rotation.y = car.userData.speed > 0 ? Math.PI/2 : -Math.PI/2;
    carsGroup.add(car);
  }
}

function makeRain(count){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 6);
  for (let i = 0; i < count; i++){
    const x = (Math.random()-0.5) * 220;
    const y = Math.random() * 45;
    const z = (Math.random()-0.5) * 110 - 5;
    pos[i*6+0] = x;     pos[i*6+1] = y;       pos[i*6+2] = z;
    pos[i*6+3] = x+0.04; pos[i*6+4] = y-0.55; pos[i*6+5] = z+0.05;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xa9b9c8, transparent: true, opacity: 0.55 });
  return new THREE.LineSegments(geo, mat);
}

export function generateDistrict({ districtGroup, carsGroup, lampGroup, rainGroup }){
  // Clear
  while (districtGroup.children.length) districtGroup.remove(districtGroup.children[0]);
  while (carsGroup.children.length)     carsGroup.remove(carsGroup.children[0]);
  while (lampGroup.children.length)     lampGroup.remove(lampGroup.children[0]);
  while (rainGroup.children.length)     rainGroup.remove(rainGroup.children[0]);

  const rng = rngFor(state.seed);

  // Place buildings along the harbour, walking the X cursor
  let cursorX = -58;
  const guardRail = 60;
  let placed = 0;
  while (cursorX < guardRail && placed < 36){
    const preset = pickPreset(state.params.preset, rng);
    const b = makeBuilding(rng, preset, state.params);
    const { w, d } = b.userData.dims;

    cursorX += w/2 + 0.05;
    if (cursorX + w/2 > guardRail) break;

    // Front face of building sits at z = 0 (along the footpath edge)
    // With building origin centred, that means origin.z = d/2 + small setback
    const setback = 0.1 + rng.range(0, 0.6);
    b.position.set(cursorX, 0, d/2 + setback);

    // Slight yaw for non-terrace buildings — keeps the line organic
    if (preset !== 'terrace') b.rotation.y = (rng.rand() - 0.5) * 0.03;

    districtGroup.add(b);

    const gap = preset === 'terrace' ? 0.0 : rng.range(0.3, 1.6);
    cursorX += w/2 + gap;
    placed++;
  }

  addStreetlights(lampGroup, rng);
  addCars(carsGroup, state.params.cars|0, rng);

  // Rain particles — count proportional to intensity, capped
  if (state.env.rain > 0.02){
    const count = Math.floor(800 + state.env.rain * 2400);
    rainGroup.add(makeRain(count));
  }
}

export function updateRainAmount(rainGroup){
  while (rainGroup.children.length) rainGroup.remove(rainGroup.children[0]);
  if (state.env.rain > 0.02){
    const count = Math.floor(800 + state.env.rain * 2400);
    rainGroup.add(makeRain(count));
  }
}
