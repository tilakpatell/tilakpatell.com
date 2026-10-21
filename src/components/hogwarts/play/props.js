// The things the wand, the broom and the lessons handle: the knockables
// Leviosa lifts (a feather, a stone, a chair, a pumpkin), a brazier for
// Incendio, a chest for Alohomora, the wand itself, and the props the cast
// lane is making as models (a broom, the Snitch, the Quaffle, a Bludger, a
// cauldron, a Mandrake pot, Buckbeak). Until a model is in, each is drawn
// here from the house’s materials, the boats’ way (world/boats.js): painted
// parts merged into one geometry a prop. A model in, its row below names
// its file, and the prop is that model from then on: the swap is one line.
//
//   PROPS → { [kind]: { glb, make } }
//   makeProp(kind, { house, rt }) → a THREE.Group (the stand-in at once;
//     the model swapped in when it comes), with userData.kind and, where a
//     part moves, userData.parts (the Snitch’s wings, the chest’s lid, the
//     brazier’s fire’s seat, the Mandrake’s root)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBasicNodeMaterial } from 'three/webgpu';

// a part plain (position and normal) and painted one colour, as world/boats.js paints
function paint(g, colour) {
  const p = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(p.attributes)) if (name !== 'position' && name !== 'normal') p.deleteAttribute(name);
  if (!p.attributes.normal) p.computeVertexNormals();
  const c = new THREE.Color().setStyle(colour, THREE.SRGBColorSpace);
  const a = new Float32Array(p.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
  p.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return p;
}
const merged = (parts) => mergeGeometries(parts.map(([g, c]) => paint(g, c)));
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => g.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z);

const mats = new WeakMap();
// one house material for every stand-in (vertex colours), one a house
function woodOf(house) {
  if (!mats.has(house)) mats.set(house, house?.material ? house.material({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
  return mats.get(house);
}
const mesh = (g, house, cast = true) => {
  const m = new THREE.Mesh(g, woodOf(house));
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

// The stand-ins, each standing on y = 0 (or, held things, about its grip)

function feather(house) {
  // a quill: a long vane either side of the shaft, curving a little
  const vane = new THREE.PlaneGeometry(0.06, 0.3, 1, 6);
  const pos = vane.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.02 * Math.sin((pos.getY(i) + 0.15) * 6));
  return mesh(merged([[at(vane, 0, 0.17, 0, -Math.PI / 2), '#f2efe6'], [at(new THREE.CylinderGeometry(0.003, 0.004, 0.36, 4), 0, 0.17, 0, -Math.PI / 2), '#d8cfb8']]), house, false);
}

function stone(house) {
  const g = new THREE.DodecahedronGeometry(0.18, 0).scale(1, 0.72, 0.9).translate(0, 0.13, 0);
  return mesh(merged([[g, '#77746c']]), house);
}

function chair(house) {
  const parts = [[new THREE.BoxGeometry(0.46, 0.05, 0.44).translate(0, 0.46, 0), '#6b4a30']];
  for (const [x, z] of [
    [-0.2, -0.19],
    [0.2, -0.19],
    [-0.2, 0.19],
    [0.2, 0.19],
  ])
    parts.push([new THREE.BoxGeometry(0.045, 0.46, 0.045).translate(x, 0.23, z), '#563a24']);
  for (const x of [-0.2, 0.2]) parts.push([new THREE.BoxGeometry(0.045, 0.5, 0.045).translate(x, 0.72, 0.19), '#563a24']);
  parts.push([new THREE.BoxGeometry(0.42, 0.18, 0.03).translate(0, 0.86, 0.19), '#6b4a30']);
  return mesh(merged(parts), house);
}

function pumpkin(house, size = 0.5) {
  // ridged: a sphere pushed in along its ribs
  const g = new THREE.SphereGeometry(size, 24, 14);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 - 0.06 * Math.abs(Math.cos(a * 5)) ** 0.5;
    p.setXYZ(i, v.x * k, v.y * 0.72, v.z * k);
  }
  g.computeVertexNormals();
  g.translate(0, size * 0.72, 0);
  return mesh(merged([[g, '#d8762a'], [new THREE.CylinderGeometry(0.03, 0.05, 0.14, 6).translate(0, size * 1.44 + 0.05, 0), '#4f5a2a']]), house);
}

function brazier(house) {
  // an iron bowl on a post, the fire’s seat at its rim
  const g = merged([
    [new THREE.CylinderGeometry(0.05, 0.07, 1.1, 8).translate(0, 0.55, 0), '#24221f'],
    [new THREE.CylinderGeometry(0.28, 0.16, 0.22, 12, 1, true).translate(0, 1.2, 0), '#2c2925'],
    [new THREE.CylinderGeometry(0.17, 0.17, 0.03, 12).translate(0, 1.1, 0), '#2c2925'],
    [new THREE.DodecahedronGeometry(0.1, 0).translate(0.04, 1.2, 0.02), '#3a2a20'],
    [new THREE.DodecahedronGeometry(0.09, 0).translate(-0.06, 1.18, -0.03), '#33241b'],
  ]);
  const group = new THREE.Group();
  group.add(mesh(g, house));
  const seat = new THREE.Object3D();
  seat.position.set(0, 1.28, 0);
  group.add(seat);
  group.userData.parts = { fire: seat };
  return group;
}

function chest(house) {
  const box = merged([
    [new THREE.BoxGeometry(0.8, 0.42, 0.5).translate(0, 0.21, 0), '#5a3c25'],
    [new THREE.BoxGeometry(0.82, 0.05, 0.52).translate(0, 0.12, 0), '#2a2622'],
    [new THREE.BoxGeometry(0.1, 0.12, 0.03).translate(0, 0.34, 0.26), '#b08a3a'],
  ]);
  const lidG = merged([
    [new THREE.CylinderGeometry(0.25, 0.25, 0.8, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 0.5, 1).translate(0, 0, 0.25), '#6a4830'],
    [new THREE.BoxGeometry(0.82, 0.04, 0.04).translate(0, 0.1, 0.25), '#2a2622'],
  ]);
  const group = new THREE.Group();
  group.add(mesh(box, house));
  // the lid hinged along the back edge
  const lid = new THREE.Group();
  lid.position.set(0, 0.42, -0.25);
  lid.add(mesh(lidG, house));
  group.add(lid);
  group.userData.parts = { lid };
  return group;
}

// the wand: about 28 cm, its tip at +z, its grip at the origin
export function wandGeometry(wood = '#5a3d27') {
  return merged([
    [new THREE.CylinderGeometry(0.004, 0.0075, 0.24, 7).rotateX(Math.PI / 2).translate(0, 0, 0.13), wood],
    [new THREE.CylinderGeometry(0.0095, 0.009, 0.07, 8).rotateX(Math.PI / 2).translate(0, 0, -0.015), '#3a271a'],
    [new THREE.SphereGeometry(0.0105, 8, 6).translate(0, 0, -0.05), '#3a271a'],
    [new THREE.TorusGeometry(0.0092, 0.0018, 4, 10).translate(0, 0, 0.02), '#2c1f15'],
  ]);
}

function broom(house) {
  // the shaft along +z (its handle forward), the twigs bound at the tail
  const twigs = new THREE.ConeGeometry(0.16, 0.6, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.85);
  const p = twigs.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 + 0.15 * Math.sin(i * 1.7)));
  return mesh(
    merged([
      [new THREE.CylinderGeometry(0.018, 0.022, 1.7, 8).rotateX(Math.PI / 2).translate(0, 0, 0.2), '#6a4a2c'],
      [twigs, '#8a6a3a'],
      [new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateX(Math.PI / 2).translate(0, 0, -0.53), '#3a3a40'],
      [new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0, -0.6), '#3a3a40'],
    ]),
    house,
  );
}

function snitch() {
  // gold that glows (over 1: the house bloom takes it), and two wings
  const group = new THREE.Group();
  const gold = new MeshBasicNodeMaterial({ color: new THREE.Color(1, 0.78, 0.3).multiplyScalar(2.2) });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), gold));
  const wingMat = new MeshBasicNodeMaterial({ color: new THREE.Color(1, 0.96, 0.85).multiplyScalar(1.4), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
  const wingG = new THREE.PlaneGeometry(0.16, 0.05).translate(0.09, 0, 0);
  const wings = [1, -1].map((s) => {
    const w = new THREE.Mesh(wingG, wingMat);
    w.scale.x = s;
    group.add(w);
    return w;
  });
  group.userData.parts = { wings };
  return group;
}

const ball = (house, r, colour) => mesh(merged([[new THREE.SphereGeometry(r, 18, 12), colour]]), house);

function cauldron(house) {
  const pot = new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.82).translate(0, 0.42, 0);
  const group = new THREE.Group();
  group.add(
    mesh(
      merged([
        [pot, '#1d1d1f'],
        [new THREE.TorusGeometry(0.36, 0.035, 6, 20).rotateX(Math.PI / 2).translate(0, 0.76, 0), '#2a2a2c'],
        ...[0, 1, 2].map((i) => [new THREE.CylinderGeometry(0.03, 0.04, 0.16, 6).translate(Math.cos((i * Math.PI * 2) / 3) * 0.26, 0.06, Math.sin((i * Math.PI * 2) / 3) * 0.26), '#1d1d1f']),
      ]),
      house,
    ),
  );
  // the brew’s surface, its colour the lesson’s
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20).rotateX(-Math.PI / 2).translate(0, 0.7, 0), new MeshBasicNodeMaterial({ color: '#2f3a40' }));
  group.add(brew);
  group.userData.parts = { brew };
  return group;
}

function mandrakePot(house) {
  const group = new THREE.Group();
  group.add(
    mesh(
      merged([
        [new THREE.CylinderGeometry(0.2, 0.14, 0.3, 14).translate(0, 0.15, 0), '#a8583a'],
        [new THREE.CylinderGeometry(0.19, 0.19, 0.02, 14).translate(0, 0.29, 0), '#3a2a1c'],
      ]),
      house,
    ),
  );
  // the root, pulled up and pushed down by the lesson
  const root = new THREE.Group();
  root.add(
    mesh(
      merged([
        [new THREE.SphereGeometry(0.08, 10, 8).scale(1, 1.3, 1), '#a88aa0'],
        [new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.12, 0), '#a88aa0'],
        ...[0, 1, 2, 3].map((i) => [new THREE.ConeGeometry(0.04, 0.22, 4).translate(0, 0.11, 0).rotateZ((i - 1.5) * 0.35).translate(0, 0.16, 0), '#4f7a3a']),
      ]),
      house,
      false,
    ),
  );
  root.position.y = 0.22;
  group.add(root);
  group.userData.parts = { root };
  return group;
}

function buckbeak(house) {
  // a stand-in only: a grey body, the eagle’s head and wings, four legs
  const parts = [
    [new THREE.SphereGeometry(0.55, 14, 10).scale(1, 0.75, 1.6).translate(0, 1.25, 0), '#8a8580'],
    [new THREE.SphereGeometry(0.26, 12, 8).translate(0, 1.95, 0.85), '#d8d2c6'],
    [new THREE.ConeGeometry(0.08, 0.24, 6).rotateX(Math.PI / 2).translate(0, 1.92, 1.15), '#c8a040'],
    [new THREE.BoxGeometry(1.6, 0.06, 0.7).translate(-0.9, 1.45, 0).rotateZ(0.25), '#7a7570'],
    [new THREE.BoxGeometry(1.6, 0.06, 0.7).translate(0.9, 1.45, 0).rotateZ(-0.25), '#7a7570'],
    [new THREE.CylinderGeometry(0.16, 0.12, 0.6, 8).rotateX(-0.6).translate(0, 1.6, 0.6), '#d0cabe'],
  ];
  for (const [x, z] of [
    [-0.25, 0.55],
    [0.25, 0.55],
    [-0.25, -0.55],
    [0.25, -0.55],
  ])
    parts.push([new THREE.CylinderGeometry(0.07, 0.05, 0.95, 6).translate(x, 0.48, z), z > 0 ? '#c8a040' : '#7a7570']);
  return mesh(merged(parts), house);
}

// What the cast lane is making as a model, and where it will be: until it
// is in, null, and the stand-in below draws it.
// TODO(hogwarts props): Lane B’s models, one line each as they land
export const PROPS = {
  feather: { glb: null, make: feather },
  stone: { glb: null, make: stone },
  chair: { glb: null, make: chair },
  pumpkin: { glb: null, make: pumpkin },
  brazier: { glb: null, make: brazier },
  chest: { glb: null, make: chest },
  broom: { glb: null, make: broom }, // (models/hogwarts/props/broom.glb)
  snitch: { glb: null, make: snitch }, // (models/hogwarts/props/snitch.glb)
  quaffle: { glb: null, make: (h) => ball(h, 0.16, '#8a2a22') }, // (models/hogwarts/props/quaffle.glb)
  bludger: { glb: null, make: (h) => ball(h, 0.13, '#1c1c1e') }, // (models/hogwarts/props/bludger.glb)
  cauldron: { glb: null, make: cauldron }, // (models/hogwarts/props/cauldron.glb)
  mandrake: { glb: null, make: mandrakePot }, // (models/hogwarts/props/mandrake.glb)
  buckbeak: { glb: null, make: buckbeak }, // (models/hogwarts/props/buckbeak.glb)
};

export function makeProp(kind, { house = null, rt = null } = {}) {
  const row = PROPS[kind];
  if (!row) throw new Error(`props: no '${kind}'`);
  const group = new THREE.Group();
  group.name = `hogwarts-${kind}`;
  const stand = row.make(house);
  group.add(stand);
  group.userData.kind = kind;
  group.userData.parts = stand.userData?.parts ?? null;
  // the model, when there is one, takes the stand-in’s place (its parts,
  // where the model names them, the same way)
  if (row.glb && rt?.assets?.gltf) {
    Promise.resolve(rt.assets.gltf(row.glb))
      .then((got) => {
        if (!got?.scene || !group.parent) return;
        const model = got.scene.clone(true);
        group.remove(stand);
        group.add(model);
        const named = (n) => model.getObjectByName(n) ?? null;
        if (group.userData.parts) for (const k of Object.keys(group.userData.parts)) group.userData.parts[k] = named(k) ?? group.userData.parts[k];
      })
      .catch(() => {});
  }
  return group;
}

// The wand’s first things, laid out beside a place (the shore by the
// jetty, until the lessons’ rooms are in): two stones, a feather on a
// chair, a pumpkin, a brazier to light and two chests, one that may be
// opened and one of Filch’s that may not. `at` is [x, z], `yaw` the way
// the place faces; each lies on the floor there.
export function practiceSet({ at: [ax, az], yaw = 0, floorAt = () => 0, house = null, rt = null }) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // (in the place’s own frame, x to the right and z ahead: the walk’s yaw
  // looks along (−sin, −cos), as a camera’s does)
  const put = (x, z) => [ax + x * c - z * s, az - x * s - z * c];
  const rows = [
    { id: 'stone-1', kind: 'stone', x: 1.6, z: 5.6, r: 0.25, mid: 0.13 },
    { id: 'stone-2', kind: 'stone', x: 2.3, z: 6.3, r: 0.25, mid: 0.13 },
    { id: 'chair', kind: 'chair', x: 3.4, z: 4.8, r: 0.45, mid: 0.5 },
    { id: 'feather', kind: 'feather', x: 3.4, z: 4.8, r: 0.2, mid: 0.02, lift: 0.49 },
    { id: 'pumpkin', kind: 'pumpkin', x: 4.8, z: 6.8, r: 0.55, mid: 0.36 },
    { id: 'brazier', kind: 'brazier', x: -2.6, z: 5.2, r: 0.35, mid: 1.15, burns: 'brazier' },
    { id: 'chest', kind: 'chest', x: -3.9, z: 4.2, r: 0.45, mid: 0.25, locked: true, allowed: true },
    { id: 'filch-chest', kind: 'chest', x: -5.2, z: 5.6, r: 0.45, mid: 0.25, locked: true, allowed: false, why: 'Filch’s, by the padlock. It stays shut, and so had you better.' },
  ];
  return rows.map((r) => {
    const object = makeProp(r.kind, { house, rt });
    const [x, z] = put(r.x, r.z);
    object.position.set(x, floorAt(x, z) + (r.lift ?? 0), z);
    object.rotation.y = yaw + r.x * 0.7;
    // (a brazier is Incendio’s as a torch is: the rules call it one)
    return { id: r.id, kind: r.burns ? 'torch' : r.kind, object, r: r.r, mid: r.mid, locked: r.locked, allowed: r.allowed, why: r.why, fire: object.userData.parts?.fire ?? null };
  });
}
