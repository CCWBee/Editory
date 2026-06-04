// Neo-Anglo-Norman district generator.
// Buildings line a coastal road. Preset drives massing; material drives palette;
// age drives weathering; window density, roof pitch and cars are independent knobs.
import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

export const state = {
  version: '0.5.0',
  seed: (Math.random()*1e9) >>> 0,
  env:    { timeOfDay: 13.5, rain: 0.1 },
  params: { preset: 'mix', winDensity: 0.7, roofPitch: 42, material: 'granite', age: 0.3, cars: 8, shutters: 'some' }
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

  // Doors and shutters — painted timber palette pulled from real Channel Island streetscapes:
  // deep teal-green, navy, oxblood, charcoal, terracotta, a paler buttery cream for renders.
  const paintPalette = [0x113022, 0x162f4a, 0x5b1812, 0x2a1610, 0x252a30, 0xa84c2a, 0x195244, 0xd6c08e];
  const door = new THREE.MeshStandardMaterial({
    color: rng.pick(paintPalette), roughness: 0.45, metalness: 0.05
  });
  // Shutter colour: different draw from same palette, slightly more saturated
  const shutter = new THREE.MeshStandardMaterial({
    color: rng.pick(paintPalette), roughness: 0.55, metalness: 0.0
  });

  return { wall, surround, quoin: surround, plinth, roof, roofRidge, chimney: wall, chimneyCap, door, shutter };
}

function chooseDims(rng, preset){
  let w, d, floors, storey = 3.1;
  switch (preset){
    case 'terrace':
      w = rng.range(4.4, 5.6); d = rng.range(7.0, 10.5); floors = 2 + (rng.rand() < 0.35 ? 1 : 0); break;
    case 'house':
      w = rng.range(7.5, 10.5); d = rng.range(8.5, 12); floors = 2; break;
    case 'civic':
      w = rng.range(13, 20); d = rng.range(10, 14); floors = 2 + (rng.rand() < 0.7 ? 1 : 0); break;
    case 'store':
      w = rng.range(8.5, 13.5); d = rng.range(14, 22); floors = 2; break;
    case 'bow':
      w = rng.range(5.0, 6.6); d = rng.range(9, 12); floors = 3; storey = 2.85; break;
    case 'granite-glass':
      w = rng.range(13, 18); d = rng.range(11, 15); floors = 3; storey = 3.45; break;
    case 'future':
      w = rng.range(9, 12); d = rng.range(10, 13); floors = 2; storey = 3.30; break;
    default:
      w = rng.range(6, 10); d = rng.range(8, 13); floors = 2;
  }
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

const WINDOW_W = 0.95;
const WINDOW_H = 1.35;
const SURROUND_THICK = 0.13;
const SHUTTER_W = 0.45;

// Compute clear-of-edge bay centres along one wall face. Keeps windows clear of
// corner quoins, leaves room for shutters if the building is using them, and
// avoids cramming two windows so close their surrounds touch.
function computeBayPositions(faceSize, hasQuoins, allowShutters, preset){
  const quoinMargin = hasQuoins ? 0.85 : 0.12;
  const halfOp = WINDOW_W/2 + SURROUND_THICK + (allowShutters ? SHUTTER_W : 0);
  const edgeMargin = quoinMargin + halfOp + 0.10;
  const usable = faceSize - 2 * edgeMargin;
  if (usable < 0) return [];
  const target = preset === 'civic' ? 2.85 : (preset === 'store' ? 3.30 : 2.45);
  const minSpacing = 2 * halfOp + 0.30;
  let n = Math.max(1, Math.round(usable / target + 0.3));
  while (n > 1 && usable / n < minSpacing) n--;
  if (n < 1) return [];
  const s = n > 0 ? usable / n : 0;
  const out = [];
  for (let b = 0; b < n; b++){
    out.push(-faceSize/2 + edgeMargin + (b + 0.5) * s);
  }
  return out;
}

function addDoor(g, dims, palette, preset){
  const {d} = dims;
  const isStore = preset === 'store';
  const isCivic = preset === 'civic';
  const dw = isStore ? 2.4 : (isCivic ? 1.4 : 1.05);
  const dh = isStore ? 2.6 : (isCivic ? 2.4 : 2.05);

  const faceDir = new THREE.Vector3(0, 0, -1);
  const facePos = new THREE.Vector3(0, 0.45 + 0.05 + dh/2, -d/2);

  // Surround (always present on doors — even for slate/timber/fibreglass)
  const thick = 0.16, depth = 0.10;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(dw + thick*2, dh + thick*2, depth),
    palette.surround
  );
  frame.position.copy(facePos).add(faceDir.clone().multiplyScalar(depth/2 + 0.001));
  frame.castShadow = frame.receiveShadow = true;
  g.add(frame);

  // Door pane
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), palette.door);
  pane.position.copy(facePos).add(faceDir.clone().multiplyScalar(0.07));
  g.add(pane);

  // Threshold step
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(dw + 0.45, 0.10, 0.40),
    palette.surround
  );
  step.position.set(0, 0.50, -d/2 - 0.12);
  step.castShadow = step.receiveShadow = true;
  g.add(step);
}

function addWindow(g, faceDir, axis, perpSize, u, y, material, palette, withShutters){
  const pos = new THREE.Vector3();
  if (axis === 'x'){
    pos.set(u, y, faceDir.z * perpSize/2);
  } else {
    pos.set(faceDir.x * perpSize/2, y, u);
  }
  const yaw = Math.atan2(faceDir.x, faceDir.z);

  const showSurround = material === 'granite' || material === 'render';
  if (showSurround){
    const depth = material === 'granite' ? 0.08 : 0.04;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(WINDOW_W + SURROUND_THICK*2, WINDOW_H + SURROUND_THICK*2, depth),
      palette.surround
    );
    frame.position.copy(pos).add(faceDir.clone().multiplyScalar(depth/2 + 0.001));
    frame.rotation.y = yaw;
    frame.castShadow = frame.receiveShadow = true;
    g.add(frame);
  }

  // Glass
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW_W, WINDOW_H), sharedGlass);
  pane.position.copy(pos).add(faceDir.clone().multiplyScalar(0.055));
  pane.rotation.y = yaw;
  g.add(pane);

  if (showSurround){
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(WINDOW_W + 0.45, 0.10, 0.22),
      palette.surround
    );
    sill.position.copy(pos).add(faceDir.clone().multiplyScalar(0.10));
    sill.position.y -= WINDOW_H/2 + 0.08;
    sill.rotation.y = yaw;
    sill.castShadow = sill.receiveShadow = true;
    g.add(sill);
  }

  if (withShutters){
    const sw = SHUTTER_W - 0.04;
    const sh = WINDOW_H + SURROUND_THICK*2 - 0.05;
    const sd = 0.05;
    const innerEdge = WINDOW_W/2 + SURROUND_THICK + 0.025;
    for (const side of [-1, +1]){
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), palette.shutter);
      const offset = new THREE.Vector3();
      if (axis === 'x'){
        offset.set(side * (innerEdge + sw/2), 0, 0);
      } else {
        offset.set(0, 0, side * (innerEdge + sw/2));
      }
      shutter.position.copy(pos).add(offset).add(faceDir.clone().multiplyScalar(sd/2 + 0.008));
      shutter.rotation.y = yaw;
      shutter.castShadow = shutter.receiveShadow = true;
      g.add(shutter);
    }
  }
}

function addOpenings(g, dims, palette, params, rng, preset){
  const {w, d, h, floors, storey} = dims;

  // Door first — placed at front-face centre, so window bays must clear it
  addDoor(g, dims, palette, preset);

  const hasQuoins = params.material === 'granite' || preset === 'store' || preset === 'civic';
  const shutterMode = params.shutters || 'some';  // 'none' | 'some' | 'all'
  const allowShutters = shutterMode !== 'none';

  // Door clearance radius on the front face (ground floor only)
  const isStore = preset === 'store';
  const isCivic = preset === 'civic';
  const doorHalfW = (isStore ? 2.4 : (isCivic ? 1.4 : 1.05)) / 2 + 0.30;

  const faces = [
    { dir: new THREE.Vector3(0, 0, -1), axis: 'x', size: w, perp: d, importance: 1.00, isFront: true  },
    { dir: new THREE.Vector3(0, 0,  1), axis: 'x', size: w, perp: d, importance: 0.55, isFront: false },
    { dir: new THREE.Vector3( 1, 0, 0), axis: 'z', size: d, perp: w, importance: 0.50, isFront: false },
    { dir: new THREE.Vector3(-1, 0, 0), axis: 'z', size: d, perp: w, importance: 0.50, isFront: false },
  ];

  faces.forEach(face => {
    const positions = computeBayPositions(face.size, hasQuoins, allowShutters, preset);

    for (const u of positions){
      // Decide once per column: does this vertical bay have windows on every storey?
      const colDensity = params.winDensity * face.importance + 0.10;
      if (rng.rand() > colDensity) continue;

      // Decide once per column: does this bay carry shutters?
      const colShutters = shutterMode === 'all'
        ? true
        : (shutterMode === 'some' ? (rng.rand() < 0.55) : false);

      for (let s = 0; s < floors; s++){
        // Ground-floor front bay near the door — skip to avoid collision
        if (face.isFront && s === 0 && Math.abs(u) < doorHalfW) continue;

        const y = 0.45 + s*storey + storey*0.52;
        addWindow(g, face.dir, face.axis, face.perp, u, y, params.material, palette, colShutters);
      }
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
  switch (preset){
    case 'bow':           return makeBowfront(rng, params);
    case 'granite-glass': return makeGraniteGlass(rng, params);
    case 'future':        return makeFutureHouse(rng, params);
    default:              return makeStandardBuilding(rng, preset, params);
  }
}

function makeStandardBuilding(rng, preset, params){
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

// =============================================================================
// Mutation registers — three new presets that carry the Jersey language forward
// =============================================================================

// 1. Bow-front Georgian — St Aubin's seafront. Painted render, narrow plot, a
//    shallow semicircular bow extending the full front facade.
const RENDER_BOW_COLOURS = [0xefe8d4, 0xeac9b0, 0xd6c08e, 0xc8dde0, 0xead2c2, 0xe8c8c8, 0xd5e3d2, 0xdfdcd0];

function makeBowfront(rng, params){
  const dims = chooseDims(rng, 'bow');
  const { w, d, h, floors, storey } = dims;

  // Painted render dominates this register regardless of user material;
  // the picked colour decides the building's personality.
  const palette = makePalette('render', params.age, 'bow', rng);
  palette.wall.color.set(rng.pick(RENDER_BOW_COLOURS));
  palette.chimney = palette.wall;

  const g = new THREE.Group();
  g.userData.preset = 'bow';
  g.userData.dims = dims;

  addPlinth(g, dims, palette);
  addShell(g, dims, palette);

  // Bow geometry — shallow arc of a large circle, full facade width
  const sagitta = rng.range(0.55, 0.85);
  const chord = w * 0.94;
  const R = (chord*chord/4 + sagitta*sagitta) / (2*sagitta);
  const thetaMax = Math.asin(chord / (2*R));
  // Cylinder centre placed so chord lies at the facade plane (z = -d/2)
  const centreZ = -d/2 + (R - sagitta);
  const bowGeo = new THREE.CylinderGeometry(
    R, R, h, 40, 1, true,
    3*Math.PI/2 - thetaMax, 2*thetaMax
  );
  const bow = new THREE.Mesh(bowGeo, palette.wall);
  bow.position.set(0, h/2 + 0.45, centreZ);
  bow.castShadow = bow.receiveShadow = true;
  g.add(bow);

  // String course above ground floor (typical Georgian)
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.04, 0.12, d + 0.04),
    palette.surround
  );
  band.position.y = 0.45 + storey - 0.06;
  g.add(band);

  // Cornice at the eaves
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.20, 0.18, d + 0.20),
    palette.surround
  );
  cornice.position.y = h + 0.45 - 0.09;
  cornice.castShadow = cornice.receiveShadow = true;
  g.add(cornice);

  addRoof(g, dims, params.roofPitch, palette);
  addChimneys(g, dims, palette, rng, 'bow');

  // Door at bow centre (flat, sitting on the chord line for simplicity)
  addDoor(g, dims, palette, 'house');

  // Windows on the curved bow — three vertical bays
  const bowBays = 3;
  for (let s = 0; s < floors; s++){
    for (let b = 0; b < bowBays; b++){
      const t = (b + 0.5) / bowBays;
      const theta = (3*Math.PI/2 - thetaMax) + t * (2*thetaMax);
      const wx = Math.cos(theta) * R;
      const wz = Math.sin(theta) * R + centreZ;
      const wy = 0.45 + s*storey + storey*0.52;
      // Skip ground-floor centre column (door is there)
      if (s === 0 && b === Math.floor(bowBays/2)) continue;

      const dir = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();
      addCurvedWindow(g, dir, wx, wy, wz, palette);
    }
  }

  // Side & back windows (rectangular, normal-style)
  addOpeningsSidesOnly(g, dims, palette, params, rng);

  return g;
}

function addCurvedWindow(g, dir, px, py, pz, palette){
  // Sash window proportions — narrower, taller than standard
  const ww = 0.82, wh = 1.55;
  const pos = new THREE.Vector3(px, py, pz);
  const yaw = Math.atan2(dir.x, dir.z);

  // Painted surround — flat, on the curved surface
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(ww + 0.18, wh + 0.18, 0.04),
    palette.surround
  );
  frame.position.copy(pos).add(dir.clone().multiplyScalar(0.025));
  frame.rotation.y = yaw;
  frame.castShadow = frame.receiveShadow = true;
  g.add(frame);

  const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), sharedGlass);
  pane.position.copy(pos).add(dir.clone().multiplyScalar(0.06));
  pane.rotation.y = yaw;
  g.add(pane);

  // Sash horizontal divider
  const mullion = new THREE.Mesh(
    new THREE.BoxGeometry(ww, 0.04, 0.04),
    palette.surround
  );
  mullion.position.copy(pos).add(dir.clone().multiplyScalar(0.07));
  mullion.rotation.y = yaw;
  g.add(mullion);

  // Painted sill
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(ww + 0.35, 0.08, 0.18),
    palette.surround
  );
  sill.position.copy(pos).add(dir.clone().multiplyScalar(0.09));
  sill.position.y -= wh/2 + 0.06;
  sill.rotation.y = yaw;
  g.add(sill);
}

// Helper for bow-front and other variants — windows on the side and back only
function addOpeningsSidesOnly(g, dims, palette, params, rng){
  const { w, d, h, floors, storey } = dims;
  const faces = [
    { dir: new THREE.Vector3(0, 0,  1), axis: 'x', size: w, perp: d, importance: 0.45 }, // back
    { dir: new THREE.Vector3( 1, 0, 0), axis: 'z', size: d, perp: w, importance: 0.55 }, // right
    { dir: new THREE.Vector3(-1, 0, 0), axis: 'z', size: d, perp: w, importance: 0.55 }, // left
  ];
  const shutterMode = params.shutters || 'some';
  const allowShutters = shutterMode !== 'none';
  faces.forEach(face => {
    const positions = computeBayPositions(face.size, false, allowShutters, 'house');
    for (const u of positions){
      const colDensity = params.winDensity * face.importance + 0.10;
      if (rng.rand() > colDensity) continue;
      const colShutters = shutterMode === 'all' ? true :
                          (shutterMode === 'some' ? (rng.rand() < 0.55) : false);
      for (let s = 0; s < floors; s++){
        const y = 0.45 + s*storey + storey*0.52;
        addWindow(g, face.dir, face.axis, face.perp, u, y, params.material === 'fibreglass' ? 'render' : params.material, palette, colShutters);
      }
    }
  });
}

// 2. Granite-glass — the new Government of Jersey HQ register.
//    Granite ground floor, glass curtain wall above with vertical granite fins,
//    very shallow roof or near-flat, no chimneys, granite top band.
function makeGraniteGlass(rng, params){
  const dims = chooseDims(rng, 'granite-glass');
  const { w, d, h, floors, storey } = dims;
  // Granite drives the wall palette regardless of user material picker.
  const palette = makePalette('granite', params.age, 'granite-glass', rng);

  const g = new THREE.Group();
  g.userData.preset = 'granite-glass';
  g.userData.dims = dims;

  addPlinth(g, dims, palette);

  // Granite ground floor mass
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, storey, d), palette.wall);
  base.position.y = storey/2 + 0.45;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  // Glass upper mass — slightly inset
  const upperH = h - storey;
  const upperW = w * 0.96, upperD = d * 0.96;
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x6a8a99, roughness: 0.12, metalness: 0.62
  });
  const upper = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), glassMat);
  upper.position.y = storey + upperH/2 + 0.45;
  upper.castShadow = upper.receiveShadow = true;
  g.add(upper);

  // Vertical granite fins on all four facades (visual rhythm)
  const finMat = palette.wall;
  const placeFin = (x, z) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, upperH, 0.35), finMat);
    fin.position.set(x, storey + upperH/2 + 0.45, z);
    fin.castShadow = fin.receiveShadow = true;
    g.add(fin);
  };
  const finCountFront = Math.max(5, Math.floor(w / 2.0));
  for (let i = 0; i <= finCountFront; i++){
    const x = -w/2 + (i / finCountFront) * w;
    placeFin(x, -d/2 - 0.10);
    placeFin(x, +d/2 + 0.10);
  }
  const finCountSide = Math.max(4, Math.floor(d / 2.3));
  for (let i = 0; i <= finCountSide; i++){
    const z = -d/2 + (i / finCountSide) * d;
    placeFin(-w/2 - 0.10, z);
    placeFin(+w/2 + 0.10, z);
  }

  // Granite slab between ground and upper — a horizontal expression of the join
  const joinBand = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.10, 0.25, d + 0.10),
    palette.surround
  );
  joinBand.position.y = storey + 0.45 + 0.025;
  joinBand.castShadow = joinBand.receiveShadow = true;
  g.add(joinBand);

  // Top cornice — granite cap reading as the eaves
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.30, 0.40, d + 0.30),
    palette.surround
  );
  top.position.y = h + 0.45 - 0.20;
  top.castShadow = top.receiveShadow = true;
  g.add(top);

  // Very shallow pitch roof — almost reads as flat
  const flatPitch = 8;
  addRoof(g, { ...dims, h: h - 0.05 }, flatPitch, palette);

  // Ground-floor entrance — a wide civic-style door
  addDoor(g, dims, palette, 'civic');

  // Ground-floor windows in granite surrounds (the upper is already all glass)
  const hasQuoins = false; // smooth granite — no quoins on contemporary
  const groundPositions = computeBayPositions(w, hasQuoins, false, 'civic');
  const doorHalfW = 0.7 + 0.25;
  for (const u of groundPositions){
    if (Math.abs(u) < doorHalfW) continue;
    const y = 0.45 + storey * 0.52;
    addWindow(g, new THREE.Vector3(0, 0, -1), 'x', d, u, y, 'granite', palette, false);
  }
  // Sides — fewer ground openings
  for (const u of computeBayPositions(d, false, false, 'civic').slice(0, 2)){
    const y = 0.45 + storey * 0.52;
    addWindow(g, new THREE.Vector3( 1, 0, 0), 'z', w, u, y, 'granite', palette, false);
    addWindow(g, new THREE.Vector3(-1, 0, 0), 'z', w, u, y, 'granite', palette, false);
  }

  return g;
}

// 3. Future house — Jersey vernacular grown forward. Granite base + lighter
//    upper (timber or render), larger window openings, deeper reveals, gabled
//    roof and chimney preserved. The veneration-of-the-flame register.
function makeFutureHouse(rng, params){
  const dims = chooseDims(rng, 'future');
  const { w, d, h, floors, storey } = dims;

  const granitePalette = makePalette('granite', params.age, 'future', rng);
  const upperFamily = rng.rand() < 0.55 ? 'timber' : 'render';
  const upperPalette = makePalette(upperFamily, params.age, 'future', rng);
  // Use granite-style surrounds even on upper level for material continuity
  upperPalette.surround = granitePalette.surround;

  const g = new THREE.Group();
  g.userData.preset = 'future';
  g.userData.dims = dims;

  addPlinth(g, dims, granitePalette);

  // Granite base — usually ground floor (~storey high). Sometimes 1.5 storeys.
  const baseH = storey * (rng.rand() < 0.3 ? 1.35 : 1.0);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, d), granitePalette.wall);
  base.position.y = baseH/2 + 0.45;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  // Light upper mass
  const upperH = h - baseH;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(w, upperH, d), upperPalette.wall);
  upper.position.y = baseH + upperH/2 + 0.45;
  upper.castShadow = upper.receiveShadow = true;
  g.add(upper);

  // Stone band marking the material join
  const joinBand = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.10, 0.18, d + 0.10),
    granitePalette.surround
  );
  joinBand.position.y = baseH + 0.45 + 0.01;
  joinBand.castShadow = true;
  g.add(joinBand);

  addRoof(g, dims, params.roofPitch, granitePalette);
  addChimneys(g, dims, granitePalette, rng, 'future');

  // Door at base centre — full-height door for contemporary feel
  addDoor(g, dims, granitePalette, 'civic');

  // Big openings — ground floor uses granite surrounds, upper uses BIG inset windows
  const shutterMode = params.shutters || 'some';
  const allowShutters = shutterMode !== 'none';

  // Ground floor windows: standard size, granite surrounds
  const groundPositions = computeBayPositions(w, false, false, 'house');
  const doorHalfW = 0.7 + 0.30;
  for (const u of groundPositions){
    if (Math.abs(u) < doorHalfW) continue;
    addWindow(g, new THREE.Vector3(0, 0, -1), 'x', d, u, 0.45 + baseH*0.5, 'granite', granitePalette, false);
  }
  for (const u of computeBayPositions(d, false, false, 'house')){
    addWindow(g, new THREE.Vector3( 1, 0, 0), 'z', w, u, 0.45 + baseH*0.5, 'granite', granitePalette, false);
    addWindow(g, new THREE.Vector3(-1, 0, 0), 'z', w, u, 0.45 + baseH*0.5, 'granite', granitePalette, false);
  }
  // Back of ground floor
  for (const u of groundPositions){
    if (rng.rand() < 0.5) continue;
    addWindow(g, new THREE.Vector3(0, 0,  1), 'x', d, u, 0.45 + baseH*0.5, 'granite', granitePalette, false);
  }

  // Upper floor BIG inset windows
  addBigUpperWindows(g, dims, baseH, upperFamily, granitePalette, upperPalette, params, rng);

  return g;
}

function addBigUpperWindows(g, dims, baseH, upperFamily, granitePalette, upperPalette, params, rng){
  const { w, d, floors, storey } = dims;
  const upperFloors = floors - 1;
  if (upperFloors <= 0) return;

  const winW = 1.85, winH = 2.10;
  const frameDepth = 0.22;     // chunky granite frame
  const protrude = frameDepth/2 + 0.01;  // how far frame centre sits in front of wall

  const placeBig = (faceDir, axis, perpSize, u, y) => {
    const pos = new THREE.Vector3();
    if (axis === 'x'){ pos.set(u, y, faceDir.z * perpSize/2); }
    else              { pos.set(faceDir.x * perpSize/2, y, u); }
    const yaw = Math.atan2(faceDir.x, faceDir.z);
    const out = faceDir.clone();   // outward-pointing unit vector

    // Top lintel — thick granite slab protruding from the wall, sitting above the opening
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(winW + 0.40, 0.22, frameDepth),
      granitePalette.surround
    );
    top.position.copy(pos).add(out.clone().multiplyScalar(protrude));
    top.position.y += winH/2 + 0.11;
    top.rotation.y = yaw;
    top.castShadow = top.receiveShadow = true;
    g.add(top);

    // Bottom sill — deeper, juts out a touch more like a window seat
    const sillDepth = frameDepth + 0.14;
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(winW + 0.55, 0.20, sillDepth),
      granitePalette.surround
    );
    sill.position.copy(pos).add(out.clone().multiplyScalar(sillDepth/2 + 0.01));
    sill.position.y -= winH/2 + 0.10;
    sill.rotation.y = yaw;
    sill.castShadow = sill.receiveShadow = true;
    g.add(sill);

    // Side jambs — vertical granite slabs framing the opening
    for (const side of [-1, +1]){
      const jamb = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, winH + 0.22, frameDepth),
        granitePalette.surround
      );
      const off = new THREE.Vector3();
      if (axis === 'x'){ off.set(side * (winW/2 + 0.09), 0, 0); }
      else              { off.set(0, 0, side * (winW/2 + 0.09)); }
      jamb.position.copy(pos).add(off).add(out.clone().multiplyScalar(protrude));
      jamb.rotation.y = yaw;
      jamb.castShadow = jamb.receiveShadow = true;
      g.add(jamb);
    }

    // Glass — just outside the wall so it isn't occluded; the protruding frame
    // creates the "deep reveal" silhouette by being much further forward.
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), sharedGlass);
    pane.position.copy(pos).add(out.clone().multiplyScalar(0.012));
    pane.rotation.y = yaw;
    g.add(pane);

    // Vertical mullion across the glass — divides large pane
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, winH, 0.05),
      granitePalette.surround
    );
    mullion.position.copy(pos).add(out.clone().multiplyScalar(0.04));
    mullion.rotation.y = yaw;
    g.add(mullion);
  };

  // Front face
  const target = 2.6;
  const usable = w - 1.6;
  const n = Math.max(1, Math.round(usable / target));
  const sp = usable / n;
  for (let b = 0; b < n; b++){
    const u = -w/2 + 0.8 + (b + 0.5) * sp;
    for (let s = 0; s < upperFloors; s++){
      const y = 0.45 + baseH + s*storey + storey*0.5;
      placeBig(new THREE.Vector3(0, 0, -1), 'x', d, u, y);
    }
  }
  // Sides — fewer, only 1-2
  const sideN = Math.max(1, Math.round((d - 1.6) / 3.0));
  const sideSp = (d - 1.6) / sideN;
  for (let b = 0; b < sideN; b++){
    const u = -d/2 + 0.8 + (b + 0.5) * sideSp;
    for (let s = 0; s < upperFloors; s++){
      const y = 0.45 + baseH + s*storey + storey*0.5;
      placeBig(new THREE.Vector3( 1, 0, 0), 'z', w, u, y);
      placeBig(new THREE.Vector3(-1, 0, 0), 'z', w, u, y);
    }
  }
  // Back — sparse
  for (let b = 0; b < n; b++){
    if (rng.rand() < 0.4) continue;
    const u = -w/2 + 0.8 + (b + 0.5) * sp;
    for (let s = 0; s < upperFloors; s++){
      const y = 0.45 + baseH + s*storey + storey*0.5;
      placeBig(new THREE.Vector3(0, 0,  1), 'x', d, u, y);
    }
  }
}

function pickPreset(mode, rng){
  if (mode !== 'mix') return mode;
  const r = rng.rand();
  if (r < 0.28) return 'terrace';
  if (r < 0.45) return 'house';
  if (r < 0.60) return 'store';
  if (r < 0.70) return 'civic';
  if (r < 0.82) return 'bow';
  if (r < 0.92) return 'granite-glass';
  return 'future';
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
