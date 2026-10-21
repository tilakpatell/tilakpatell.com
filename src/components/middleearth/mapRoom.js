// The room the map lies in, for the backdrop (./MapBackdrop3D.js): a desk of
// dark planks reaching past the sheet on every side, so a far or tall view
// shows wood rather than a void; the sheet’s torn edge (its material options,
// for the backdrop to spread into the sheet’s own); two brass weights on the
// south corners, an inkwell and a quill to the south-west, a pipe by the
// Shire, a closed red book by the north-west, and a candle in a brass holder
// on the north-west corner, whose flame is lit at night.
//
// buildRoom(scene, { W, H, tier }) → { candle, sheetOptions, textures,
// update(dt, t, { night, m, flick }), dispose() }. `candle` is the flame’s
// base, where the backdrop puts its candle light; `textures` are the
// pictures to send to the chip before the first frame; W and H are the
// sheet’s size in scene units. Everything is made in code: nothing is
// downloaded.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm, makeCanvas, makeNoise, mix, paintPixels, smooth } from '../../lib/paint';
import { FIRE } from './nodes/kit';
import { paintEdge } from './mapPaint';
import { REGIONS, SHEET } from './mapData';

const DESK_Y = -0.3;
// The sheet’s corners stand 0.15 up (MapBackdrop3D), and the weights and the
// candle stand on the corners.
// (they sit about 3 units in from the corners, so the subdivided sheet that comes next must keep 0.15 under them)
const SHEET_Y = 0.15;

// The props are many small shapes in three finishes. Each shape is painted
// its colour into its vertices and merged with the others of its finish, so
// all of them are three draws, and two more for the shadows of the two that
// throw one, however many shapes there are.
const mat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true, ...o });

const o3 = new THREE.Object3D();
const tint = new THREE.Color();
// One shape, moved, turned, stretched and coloured, ready to merge.
function put(geo, color, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) {
  o3.position.set(x, y, z);
  o3.rotation.set(rx, ry, rz);
  o3.scale.set(sx, sy, sz);
  o3.updateMatrix();
  geo.applyMatrix4(o3.matrix);
  tint.set(color);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) tint.toArray(c, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
// A prop’s shapes, built round its own foot, set down at x, y, z and turned by ry.
function place(parts, x, y, z, ry = 0) {
  o3.position.set(x, y, z);
  o3.rotation.set(0, ry, 0);
  o3.scale.set(1, 1, 1);
  o3.updateMatrix();
  for (const g of parts) g.applyMatrix4(o3.matrix);
  return parts;
}

// Dark planks, four to a tile, tiling both ways: each plank its own shade,
// a grain bent by slow noise, and a dark joint between planks and one butt
// joint along each.
function paintDesk(size = 512) {
  const n = makeNoise(7);
  const PLANKS = 4;
  return paintPixels(makeCanvas(size), (u, v, out) => {
    const p = Math.floor(v * PLANKS);
    const f = v * PLANKS - p;
    const shade = 0.8 + n(p * 3.7 + 0.5, 0.5) * 0.4;
    const warp = fbm(n, u * 4, v * 4, { period: 4, octaves: 3 });
    const grain = 0.5 + 0.5 * Math.sin((v * 96 + warp * 5 + p * 0.37) * Math.PI * 2);
    const fine = fbm(n, u * 32, v * 32, { period: 32, octaves: 2 });
    const seam = smooth(0, 0.02, f) * smooth(0, 0.02, 1 - f);
    const ju = n(p * 5.1 + 0.5, 2.5);
    const du = Math.min(Math.abs(u - ju), 1 - Math.abs(u - ju));
    const joint = smooth(0.001, 0.004, du);
    const k = shade * (0.8 + grain * 0.12 + fine * 0.16) * (0.35 + 0.65 * seam * joint);
    out[0] = 74 * k;
    out[1] = 46 * k;
    out[2] = 27 * k;
  });
}

// The flame’s picture: a teardrop, hottest low in its middle, in the kit’s
// FIRE colours (./kit.js), black outside, for additive blending.
function paintFlame() {
  const at = (t) => {
    let k = 1;
    while (k < FIRE.length - 1 && FIRE[k][0] < t) k += 1;
    const a = FIRE[k - 1];
    const b = FIRE[k];
    const f = clamp01((t - a[0]) / (b[0] - a[0] || 1));
    return [1, 2, 3, 4].map((j) => mix(a[j], b[j], f));
  };
  return paintPixels(makeCanvas(32, 64), (u, v, out) => {
    const y = 1 - v; // canvas rows run down; the flame stands up from its base
    const hw = 0.46 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + y * 0.88)), 0.7) * (1 - 0.5 * y);
    const q = hw > 0 ? clamp01(1 - Math.abs(u + 0.5 / 32 - 0.5) / hw) : 0;
    const heat = q * Math.sqrt(clamp01(1 - y));
    const [r, g, b, a] = at(0.08 + (1 - heat) * 0.8);
    const k = clamp01(a * Math.sqrt(q)) * 255;
    out[0] = Math.min(1, r) * k;
    out[1] = Math.min(1, g) * k;
    out[2] = Math.min(1, b) * k;
  });
}

export function buildRoom(scene, { W, H, tier = 'high' }) {
  const seg = tier === 'high' ? 18 : tier === 'mid' ? 12 : 8;
  const added = [];
  const add = (obj) => {
    scene.add(obj);
    added.push(obj);
    return obj;
  };

  // ── the desk ──
  // painted on the main thread: a weak device paints them at half the size
  const low = tier === 'low';
  const deskMap = new THREE.CanvasTexture(paintDesk(low ? 256 : 512));
  deskMap.wrapS = deskMap.wrapT = THREE.RepeatWrapping;
  deskMap.colorSpace = THREE.SRGBColorSpace;
  // a tile is 32 units, so a plank is 8: wide boards under an 80-unit sheet
  deskMap.repeat.set((W + 60) / 32, (H + 60) / 32);
  const desk = add(new THREE.Mesh(new THREE.PlaneGeometry(W + 60, H + 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: deskMap, roughness: 0.72 })));
  desk.position.y = DESK_Y;
  desk.receiveShadow = true;

  // ── the sheet’s edge ──
  const alphaMap = new THREE.CanvasTexture(paintEdge(low ? 512 : 1024));
  const sheetOptions = { alphaMap, alphaTest: 0.5 };
  // and the paper’s shade on the desk, in the same torn shape, a little
  // larger and to the south-east, away from the window: the sheet can’t
  // throw it as a shadow (its back faces would, and they face the desk)
  const shade = add(new THREE.Mesh(new THREE.PlaneGeometry(W + 1.4, H + 1.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a0604, alphaMap, transparent: true, opacity: 0.5, depthWrite: false })));
  shade.position.set(0.5, DESK_Y + 0.02, 0.6);

  // ── the props, in three finishes ──
  const polished = []; // brass, and the inkwell’s glass
  const matte = []; // leather, wood, paper and feather
  const wax = []; // the candle, which glows at night
  const BRASS = 0xb48a3c;
  const nw = [-W / 2 + 3, -H / 2 + 2.8]; // the candle, on the north-west corner

  // two brass weights holding down the south corners
  for (const sx of [-1, 1]) {
    polished.push(
      ...place(
        [
          put(new THREE.CylinderGeometry(1.25, 1.35, 0.8, seg), BRASS, [0, 0.4, 0]),
          put(new THREE.CylinderGeometry(0.7, 1.25, 0.3, seg), BRASS, [0, 0.95, 0]),
          put(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), BRASS, [0, 1.25, 0]),
          put(new THREE.SphereGeometry(0.32, 10, 6), BRASS, [0, 1.55, 0]),
        ],
        sx * (W / 2 - 3),
        SHEET_Y,
        H / 2 - 2.8,
      ),
    );
  }

  // the inkwell, on the desk off the south-west corner, and its quill
  // leaning away from the sheet so it never lies across the map
  const ink = [-W / 2 - 4.2, H / 2 - 8];
  polished.push(
    ...place(
      [
        put(new THREE.CylinderGeometry(1.35, 1.5, 1.4, 8), 0x1e3a34, [0, 0.7, 0]),
        put(new THREE.CylinderGeometry(0.55, 1.35, 0.45, 8), 0x1e3a34, [0, 1.62, 0]),
        put(new THREE.CylinderGeometry(0.58, 0.58, 0.32, 8), BRASS, [0, 2.0, 0]),
        put(new THREE.CylinderGeometry(0.44, 0.44, 0.04, 8), 0x050608, [0, 2.16, 0]),
      ],
      ink[0],
      DESK_Y,
      ink[1],
    ),
  );
  const quill = [put(new THREE.CylinderGeometry(0.04, 0.07, 7, 5), 0xd8ccb0, [0, 3.5, 0]), put(new THREE.SphereGeometry(1, 8, 4), 0xece4d2, [0.12, 4.7, 0], [0, 0, 0], [0.55, 3, 0.06])];
  // leant back from the inkwell’s mouth, towards the west and a little north
  for (const g of quill) g.rotateZ(0.6).rotateY(-0.5);
  matte.push(...place(quill, ink[0], DESK_Y + 1.5, ink[1]));

  // a pipe on the desk by the Shire’s edge of the sheet, level with the
  // Shire’s name (sheet units to the scene’s, as the backdrop places them)
  const shire = REGIONS.find(([name]) => name === 'THE SHIRE');
  const pz = ((shire[2] - SHEET.h / 2) / SHEET.h) * H;
  matte.push(
    ...place(
      [
        put(new THREE.CylinderGeometry(0.5, 0.4, 1.1, seg), 0x5b3418, [0, 0.55, 0]),
        put(new THREE.CylinderGeometry(0.4, 0.4, 0.04, seg), 0x1b120c, [0, 1.1, 0]),
        put(new THREE.CylinderGeometry(0.12, 0.1, 5.2, 6), 0x5b3418, [2.9, 0.35, 0], [0, 0, Math.PI / 2 + 0.06]),
        put(new THREE.CylinderGeometry(0.1, 0.07, 0.8, 6), 0x2a1a10, [5.9, 0.18, 0], [0, 0, Math.PI / 2 + 0.06]),
      ],
      -W / 2 - 3.6,
      DESK_Y,
      pz,
      2.1,
    ),
  );

  // a closed red book on the desk by the sheet’s north-west edge, its spine
  // banded in gold
  const LEATHER = 0x6e1d18;
  matte.push(
    ...place(
      [
        put(new THREE.BoxGeometry(7, 0.16, 9.6), LEATHER, [0, 0.08, 0]),
        put(new THREE.BoxGeometry(7, 0.16, 9.6), LEATHER, [0, 1.22, 0]),
        put(new THREE.BoxGeometry(6.7, 1.0, 9.3), 0xe6dcc0, [0.1, 0.65, 0]),
        put(new THREE.BoxGeometry(0.3, 1.3, 9.6), LEATHER, [-3.45, 0.65, 0]),
      ],
      -W / 2 - 5.4,
      DESK_Y,
      -H / 2 + 9.5,
      0.1,
    ),
  );
  polished.push(...place([put(new THREE.BoxGeometry(0.34, 1.32, 0.25), 0xd4a84a, [-3.46, 0.65, -3.2]), put(new THREE.BoxGeometry(0.34, 1.32, 0.25), 0xd4a84a, [-3.46, 0.65, 3.2])], -W / 2 - 5.4, DESK_Y, -H / 2 + 9.5, 0.1));

  // the candle: a brass dish and cup with a ring to carry it by, and the wax
  const WAX = 3.15; // where the wax ends and the flame begins, above the sheet
  polished.push(
    ...place(
      [
        put(new THREE.CylinderGeometry(1.15, 1.25, 0.16, seg), BRASS, [0, 0.08, 0]),
        put(new THREE.CylinderGeometry(0.42, 0.5, 0.55, seg), BRASS, [0, 0.43, 0]),
        put(new THREE.TorusGeometry(0.4, 0.09, 6, 12), BRASS, [1.3, 0.3, 0]),
      ],
      nw[0],
      SHEET_Y,
      nw[1],
      -0.8,
    ),
  );
  wax.push(...place([put(new THREE.CylinderGeometry(0.32, 0.34, 2.4, seg), 0xeee3c8, [0, 1.8, 0])], nw[0], SHEET_Y, nw[1]));
  matte.push(...place([put(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 4), 0x241a12, [0, WAX - 0.04, 0])], nw[0], SHEET_Y, nw[1]));

  // The light is on the flame, above the wax, so the wax’s sides would be
  // lit by nothing but the dim room: it glows warm at night instead, as wax
  // does round a flame. Too thin to throw a shadow worth a draw.
  const glow = mat({ roughness: 0.6, emissive: 0xffa860, emissiveIntensity: 0 });
  const finish = [mat({ roughness: 0.45, metalness: 0.25 }), mat(), glow];
  const props = [polished, matte, wax].map((parts, i) => {
    const m = add(new THREE.Mesh(mergeGeometries(parts), finish[i]));
    for (const g of parts) g.dispose();
    m.castShadow = parts !== wax;
    m.receiveShadow = true;
    return m;
  });

  // ── the flame: two crossed planes on the wick, added to what’s behind ──
  const candle = add(new THREE.Object3D());
  candle.position.set(nw[0], SHEET_Y + WAX, nw[1]);
  const flameMap = new THREE.CanvasTexture(paintFlame());
  flameMap.colorSpace = THREE.SRGBColorSpace;
  const a = new THREE.PlaneGeometry(0.6, 1.2).translate(0, 0.6, 0);
  const flameGeo = mergeGeometries([a, a.clone().rotateY(Math.PI / 2)]);
  a.dispose();
  const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ map: flameMap, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  flame.visible = false;
  candle.add(flame);
  const warm = new THREE.Color(1, 1, 1);
  const red = new THREE.Color(1, 0.55, 0.4);

  return {
    candle,
    sheetOptions,
    textures: [deskMap, alphaMap, flameMap],
    // the flame is lit at night only, and fades in and out with it; it
    // stands a little taller in the dark, sways, and burns redder in Mordor.
    // `flick` is the candle light’s own flicker, so flame and light move as one
    update(dt, t, { night = 0, m = 0, flick = 1 } = {}) {
      flame.visible = night > 0.02;
      glow.emissiveIntensity = flame.visible ? night * 0.35 : 0;
      if (!flame.visible) return;
      const s = 0.7 + night * 0.3;
      // the light swings about ±10 %; the flame’s height twice that, its width a little
      const f = 1 + (flick - 1) * 2;
      flame.scale.set(s * (1 + (flick - 1) * 0.6), s * f, s);
      flame.rotation.set(0.05 * Math.sin(t * 3.7), 0.3 * Math.sin(t * 0.7), 0.06 * Math.sin(t * 4.3 + 2));
      flame.material.opacity = night;
      flame.material.color.copy(warm).lerp(red, m);
    },
    dispose() {
      for (const obj of added) scene.remove(obj);
      desk.geometry.dispose();
      desk.material.dispose();
      shade.geometry.dispose();
      shade.material.dispose();
      for (const p of props) p.geometry.dispose();
      for (const f of finish) f.dispose();
      flameGeo.dispose();
      flame.material.dispose();
      deskMap.dispose();
      alphaMap.dispose();
      flameMap.dispose();
    },
  };
}
