// What the fellowship carry and wear on the Road: Gandalf's staff (the
// Grey's gnarled, its head a knot of wood round a cold crystal; the White's
// straight and pale), Legolas's bow and Gimli's axe in hand; Aragorn's and
// Boromir's swords at the hip, Boromir's round shield and Legolas's quiver
// on the back. Built here in metres for the cast's proportions (big heads,
// hands at the hip), each held thing with a `grip` where the hand closes
// (lib/three/held.js puts it in the palm and keeps it carried: the staff
// planted, the arm still under it, its head up) and a `tip` where a light
// would sit (Moria's staff light); each worn thing put on its bone where
// the figure's own body is, measured from its skin in the bind pose.
//
//   GEAR: { [name]: [{ kind, held: true, as?, hand? } | { kind, on: bone, at }] }
//     (as: the grip kind held.js carries it by, when it isn't the thing's own:
//     the bow carried upright as a cane is, the axe planted as a staff is)
//   gearFor(name) → the entries, or []
//   makeGear(kind, height) → Object3D (a new one, its own geometry and materials), with a
//     `grip` child (held things) and a `tip` child (a staff's head)
//   bodyAt(model, y, frame) → { back, front, left, right, half }: the body's
//     depth and width at a height, its bind pose, in `frame`'s space (the
//     figure's group: forward +z, its left +x), for what's worn; its sides
//     out to the first gap, so the A-pose's hands hanging at the hips aren't
//     its width
//   wear(model, item, { on, at }, height) → the item on its bone, or null
//     (call it with the model in its bind pose, under its group)

import * as THREE from 'three';

// (what each one has: a staff or a bow in hand, a sword, a shield or a quiver worn)
export const GEAR = {
  gandalf: [{ kind: 'staff', held: true }],
  gandalfwhite: [{ kind: 'white-staff', held: true }],
  legolas: [
    { kind: 'bow', held: true, as: 'cane', hand: 'left' },
    { kind: 'quiver', on: 'Spine02', at: 'back' },
  ],
  // (an axe carried upright, as a staff is: its head by his shoulder, its foot by his boots)
  gimli: [{ kind: 'axe', held: true, as: 'staff' }],
  aragorn: [{ kind: 'sword', on: 'Hips', at: 'hip' }],
  boromir: [
    { kind: 'sword', on: 'Hips', at: 'hip' },
    { kind: 'shield', on: 'Spine02', at: 'back' },
  ],
};
export const gearFor = (name) => GEAR[name] ?? [];

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const add = (parent, geometry, material, [x, y, z] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.userData.gear = true;
  parent.add(m);
  return m;
};
const point = (parent, name, [x, y, z]) => {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};
// a gnarled line: points up y, wandering by a slow seeded wobble
const gnarled = (y0, y1, wobble, seed, n = 9) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = y0 + (y1 - y0) * t;
    pts.push(new THREE.Vector3(Math.sin(t * 7.1 + seed) * wobble, y, Math.cos(t * 5.3 + seed * 1.7) * wobble));
  }
  return new THREE.CatmullRomCurve3(pts);
};

// each kind, `h` the figure's height (m); held ones built up +y, their grip at the origin
const MAKERS = {
  // the Grey's: a long gnarled shaft, its foot by the ground, its head a knot of three roots round a crystal
  staff(h) {
    const g = new THREE.Group();
    const wood = mat(0x5e4128);
    const below = 0.39 * h; // the grip over the foot
    const above = 0.63 * h; // the head over the grip
    add(g, new THREE.TubeGeometry(gnarled(-below, above, 0.012, 1.3), 24, 0.022, 7), wood);
    const top = above + 0.05 * h;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const pts = [new THREE.Vector3(0, above - 0.02 * h, 0)];
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const r = Math.sin(t * Math.PI) * 0.055 * h * (1 - 0.4 * t);
        pts.push(new THREE.Vector3(Math.cos(a + t * 2.4) * r, above + t * 0.11 * h, Math.sin(a + t * 2.4) * r));
      }
      add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.011, 5), wood);
    }
    add(g, new THREE.IcosahedronGeometry(0.03 * h, 1), mat(0xcfe2ff, { emissive: 0x9fc4ff, emissiveIntensity: 1.4, roughness: 0.2 }), [0, top, 0]);
    point(g, 'grip', [0, 0, 0]);
    point(g, 'tip', [0, top, 0]);
    return g;
  },
  // the White's: straight and pale, its head a cage of three tines drawn to a point
  'white-staff'(h) {
    const g = new THREE.Group();
    const white = mat(0xe9e4d6, { roughness: 0.6 });
    const below = 0.39 * h;
    const above = 0.62 * h;
    add(g, new THREE.CylinderGeometry(0.02, 0.024, below + above, 8), white, [0, (above - below) / 2, 0]);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const r = Math.sin(t * Math.PI) * 0.045 * h;
        pts.push(new THREE.Vector3(Math.cos(a + t * 1.2) * r, above + t * 0.12 * h, Math.sin(a + t * 1.2) * r));
      }
      add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.009, 5), white);
    }
    add(g, new THREE.SphereGeometry(0.022 * h, 10, 8), mat(0xffffff, { emissive: 0xf4f2ea, emissiveIntensity: 1.1, roughness: 0.2 }), [0, above + 0.06 * h, 0]);
    point(g, 'grip', [0, 0, 0]);
    point(g, 'tip', [0, above + 0.06 * h, 0]);
    return g;
  },
  // Legolas's: a long bow held by its middle, its limbs curved back, its string taut
  bow(h) {
    const g = new THREE.Group();
    const wood = mat(0xb08a52, { roughness: 0.55 });
    const half = 0.42 * h;
    const limb = (s) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push(new THREE.Vector3(0, s * t * half, -Math.sin(t * Math.PI * 0.5) * 0.07 * h + Math.sin(t * Math.PI) * 0.02 * h));
      }
      return new THREE.CatmullRomCurve3(pts);
    };
    for (const s of [1, -1]) add(g, new THREE.TubeGeometry(limb(s), 12, 0.012, 5), wood);
    add(g, new THREE.CylinderGeometry(0.018, 0.018, 0.1 * h, 7), mat(0x4a3420), [0, 0, 0]);
    // (the string, end to end behind the limbs' tips)
    const tipZ = -0.07 * h;
    add(g, new THREE.CylinderGeometry(0.0025, 0.0025, 2 * half, 3), mat(0xe8e2d0), [0, 0, tipZ]);
    point(g, 'grip', [0, 0, 0]);
    return g;
  },
  // Gimli's: a long haft, a broad bearded blade one side and a spike the other
  axe(h) {
    const g = new THREE.Group();
    const below = 0.3 * h;
    const above = 0.5 * h;
    add(g, new THREE.CylinderGeometry(0.02, 0.024, below + above, 7), mat(0x5a3c22), [0, (above - below) / 2, 0]);
    const steel = mat(0xb4b8c0, { metalness: 0.25, roughness: 0.45 });
    const blade = new THREE.Shape();
    blade.moveTo(0, -0.07 * h);
    blade.quadraticCurveTo(0.2 * h, -0.13 * h, 0.22 * h, 0);
    blade.quadraticCurveTo(0.2 * h, 0.13 * h, 0, 0.07 * h);
    blade.lineTo(0, -0.07 * h);
    const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.014, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
    bladeGeo.translate(0.02, 0, -0.007);
    add(g, bladeGeo, steel, [0, above - 0.06 * h, 0]);
    add(g, new THREE.ConeGeometry(0.03 * h, 0.1 * h, 6), steel, [-0.06 * h, above - 0.06 * h, 0]).rotation.z = Math.PI / 2;
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.05 * h, 8), mat(0x7a6a40, { metalness: 0.2, roughness: 0.5 }), [0, above - 0.06 * h, 0]);
    point(g, 'grip', [0, 0, 0]);
    point(g, 'tip', [0, above, 0]);
    return g;
  },
  // a sword in its scabbard, built down -y from the belt: the hilt above, the sheath below
  sword(h) {
    const g = new THREE.Group();
    const len = 0.33 * h;
    const leather = mat(0x2e221a, { roughness: 0.7 });
    const scabbard = add(g, new THREE.BoxGeometry(0.05, len, 0.022), leather, [0, -len / 2, 0]);
    scabbard.scale.set(1, 1, 1);
    add(g, new THREE.BoxGeometry(0.058, 0.04, 0.03), mat(0x8a7a5a, { metalness: 0.2, roughness: 0.5 }), [0, -len + 0.02, 0]);
    const steel = mat(0xa8aeb6, { metalness: 0.25, roughness: 0.45 });
    add(g, new THREE.BoxGeometry(0.16, 0.022, 0.03), steel, [0, 0.012, 0]);
    add(g, new THREE.CylinderGeometry(0.014, 0.016, 0.09 * h, 7), mat(0x3a2a20), [0, 0.012 + 0.045 * h, 0]);
    add(g, new THREE.SphereGeometry(0.022, 8, 6), steel, [0, 0.012 + 0.09 * h + 0.012, 0]);
    return g;
  },
  // a round shield, its face out (+z), a boss in its middle and a rim
  shield(h) {
    const g = new THREE.Group();
    const r = 0.16 * h;
    const face = add(g, new THREE.CylinderGeometry(r, r, 0.03, 20), mat(0x6a2a22, { roughness: 0.65 }));
    face.rotation.x = Math.PI / 2;
    const rim = add(g, new THREE.TorusGeometry(r, 0.012, 5, 24), mat(0x9a8a5a, { metalness: 0.2, roughness: 0.5 }));
    rim.position.z = 0.012;
    add(g, new THREE.SphereGeometry(0.035, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb0a070, { metalness: 0.2, roughness: 0.45 }), [0, 0, 0.015]).rotation.x = Math.PI / 2;
    return g;
  },
  // a quiver of arrows, slung across the back, the fletchings over the shoulder
  quiver(h) {
    const g = new THREE.Group();
    const len = 0.3 * h;
    add(g, new THREE.CylinderGeometry(0.04, 0.034, len, 10), mat(0x4a3a24, { roughness: 0.7 }), [0, 0, 0]);
    const fletch = mat(0xd8d2c0, { roughness: 0.8 });
    for (let k = 0; k < 5; k++) add(g, new THREE.ConeGeometry(0.012, 0.06, 4), fletch, [Math.cos(k * 1.3) * 0.02, len / 2 + 0.035, Math.sin(k * 1.3) * 0.02]);
    return g;
  },
};

export function makeGear(kind, height) {
  const make = MAKERS[kind];
  if (!make) return null;
  const item = make(height);
  item.name = `gear:${kind}`;
  return item;
}

// the body's depth and width at a height: its skin's faces within a few
// centimetres of it, where the skin puts them (three's own skinning, through
// the bones and their inverses: a Meshy figure's mesh sits under an armature
// scaled a hundredth, which only the skeleton undoes), in `frame`'s space.
// By the shape, not by the bones: Meshy's weights give a chest's sides to the
// forearms and its belly to the thighs. `left` and `right` are its sides out
// to the first gap (a hand hanging by the hips is not its width), `back` and
// `front` down its middle.
const V = new THREE.Vector3();
const M = new THREE.Matrix4();
const BIN = 0.015;
const GAP = 2;
export function bodyAt(model, y, frame = null, band = 0.06) {
  // each face's reach across the band: x from, x to, z from, z to
  const spans = [];
  model.updateMatrixWorld(true);
  const toFrame = frame ? new THREE.Matrix4().copy(frame.matrixWorld).invert() : new THREE.Matrix4();
  model.traverse((o) => {
    // (the body alone: not what it already wears, nor the ink round it)
    if (!o.isMesh || o.userData.gear || o.userData.ink || !o.geometry?.attributes?.position) return;
    const n = o.geometry.attributes.position.count;
    M.multiplyMatrices(toFrame, o.matrixWorld);
    const at = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      o.getVertexPosition(i, V).applyMatrix4(M);
      at[i * 3] = V.x;
      at[i * 3 + 1] = V.y;
      at[i * 3 + 2] = V.z;
    }
    const index = o.geometry.index;
    const tris = Math.floor((index ? index.count : n) / 3);
    for (let t = 0; t < tris; t++) {
      const [i, j, k] = [0, 1, 2].map((c) => 3 * (index ? index.getX(t * 3 + c) : t * 3 + c));
      if (Math.max(at[i + 1], at[j + 1], at[k + 1]) < y - band || Math.min(at[i + 1], at[j + 1], at[k + 1]) > y + band) continue;
      spans.push(Math.min(at[i], at[j], at[k]), Math.max(at[i], at[j], at[k]), Math.min(at[i + 2], at[j + 2], at[k + 2]), Math.max(at[i + 2], at[j + 2], at[k + 2]));
    }
  });
  if (!spans.length) return null;
  const side = (sign) => {
    const filled = new Set();
    for (let s = 0; s < spans.length; s += 4) {
      const lo = Math.max(0, Math.min(sign * spans[s], sign * spans[s + 1]));
      const hi = Math.max(sign * spans[s], sign * spans[s + 1]);
      for (let k = Math.floor(lo / BIN); k <= Math.floor(hi / BIN) && hi >= 0; k++) filled.add(k);
    }
    let last = -1;
    for (let k = 0, empty = 0; empty < GAP; k++) {
      if (filled.has(k)) {
        last = k;
        empty = 0;
      } else empty++;
    }
    return (last + 1) * BIN;
  };
  const left = side(1);
  const right = side(-1);
  const mid = Math.max(BIN, 0.35 * Math.min(left, right));
  let back = Infinity;
  let front = -Infinity;
  for (let s = 0; s < spans.length; s += 4) {
    if (spans[s + 1] < -mid || spans[s] > mid) continue;
    back = Math.min(back, spans[s + 2]);
    front = Math.max(front, spans[s + 3]);
  }
  return Number.isFinite(back) ? { back, front, left, right, half: Math.max(left, right) } : null;
}

// a worn thing on its bone: where the body is at that bone's height (its
// back, or its left hip), put there in the figure's frame (forward +z, its
// left +x) and kept on the bone as it moves
export function wear(model, item, { on, at }, height) {
  const bone = model.getObjectByName(on);
  const root = model.parent;
  if (!bone || !root) return null;
  root.updateMatrixWorld(true);
  const p = root.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  const body = bodyAt(model, p.y, root);
  if (!body) return null;
  if (at === 'hip') {
    // (at the left hip, a little forward, the blade swept back)
    item.position.set(Math.min(body.left, 0.2 * height) * 0.85, p.y + 0.02 * height, (body.back + body.front) / 2 + 0.03 * height);
    item.rotation.set(0.45, 0, 0.12);
  } else {
    // (on the back, flat to it, a little below the shoulders)
    item.position.set(0, p.y + 0.02 * height, body.back - 0.02 * height);
    item.rotation.set(0, Math.PI, 0);
    if (item.name === 'gear:quiver') {
      item.position.x = -0.04 * height;
      item.rotation.set(0.15, Math.PI, 0.45);
    }
  }
  root.add(item);
  item.updateMatrixWorld(true);
  bone.attach(item);
  return item;
}
