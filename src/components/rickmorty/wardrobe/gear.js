// The wardrobe's gear: hats and headphones, shades, goggles and an eyepatch,
// and something in his hand. Built in code in the show's toon look (the
// portal gun is Bob.Ho's model, CC BY 4.0: scripts/sketchfab-gear.mjs, with
// a built one standing in until it loads), each in a frame of its own:
//
//   head gear  its origin on the crown, a head (chin to crown) a unit, +y up,
//              +z the way the face looks;
//   face gear  its origin between the eyes on the face, the same units;
//   hand gear  its origin in the grip, a unit long, its front −z, its top +y.
//
// wearGear(figure, look) works the frames out from the figure's own
// skeleton, in its bind pose (the Head bone, the crown's head_end, the
// face's headfront; the hand and the forearm it points from), and sets each
// piece on its bone, so it moves with every clip the figure plays.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon } from '../portal/toonCore'; // (the paint without toon.js's ink pass, which is GLSL)
import { BB_GEAR, GEAR, GEAR_SLOTS, gearById, gearWorn } from './looks';

// geometries placed by [geometry, position, rotation, scale], merged into one
function merged(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
    return g.applyMatrix4(m);
  });
  const out = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return out;
}
// a piece of gear: { colour: [[geometry, pos, rot, scale], …] } → a group of one mesh a colour
function piece(parts, glow = {}) {
  const g = new THREE.Group();
  for (const [color, list] of Object.entries(parts)) {
    const mat = glow[color] ? new THREE.MeshBasicMaterial({ color, toneMapped: false }) : toon(color);
    const mesh = new THREE.Mesh(merged(list), mat);
    mesh.castShadow = true;
    g.add(mesh);
  }
  return g;
}
const cyl = (r0, r1, h, seg = 32, open = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
const ball = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ALONG = [Math.PI / 2, 0, 0]; // (a cylinder along z)
// knit ribs: a round geometry's surface pushed in and out round its axis
// (y), `n` ribs, `amp` of its radius deep
function ribbed(geo, n, amp) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const k = 1 + amp * Math.cos(n * Math.atan2(x, z));
    p.setXYZ(i, x * k, p.getY(i), z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

const BUILD = {
  // ── on the head ──
  partyhat() {
    const pink = [];
    const yellow = [];
    const bands = 4;
    for (let i = 0; i < bands; i++) {
      const y0 = (i / bands) * 0.78;
      const y1 = ((i + 1) / bands) * 0.78;
      const r = (y) => 0.27 * (1 - y / 0.8);
      (i % 2 ? yellow : pink).push([cyl(r(y0), r(y1), y1 - y0, 32), [0, y0 + (y1 - y0) / 2, 0]]);
    }
    yellow.push([ball(0.075), [0, 0.8, 0]]);
    const g = piece({ '#ef5a9c': pink, '#f6d743': yellow });
    g.position.y = -0.12;
    g.rotation.set(-0.2, 0, 0.18);
    const holder = new THREE.Group();
    holder.add(g);
    return holder;
  },
  beanie() {
    return piece({
      '#3d8f86': [
        [ball(0.44, 32, 16), [0, -0.2, 0], [0, 0, 0], [1, 0.82, 1.06]],
        [ball(0.1), [0, 0.2, 0]],
      ],
      '#2f6f68': [[cyl(0.452, 0.452, 0.15, 40), [0, -0.27, 0], [0, 0, 0], [1, 1, 1.06]]],
    });
  },
  tophat() {
    return piece({
      '#1f1d26': [
        [cyl(0.25, 0.27, 0.52, 40), [0, 0.22, 0]],
        [cyl(0.44, 0.44, 0.03, 48), [0, -0.04, 0]],
      ],
      '#b8323b': [[cyl(0.256, 0.262, 0.09, 40), [0, 0.03, 0]]],
    });
  },
  crown() {
    const gold = [[cyl(0.3, 0.31, 0.15, 48, true), [0, 0.0, 0]]];
    const gems = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      gold.push([new THREE.ConeGeometry(0.05, 0.15, 12), [Math.sin(a) * 0.3, 0.14, Math.cos(a) * 0.3]]);
      gold.push([ball(0.025, 10, 8), [Math.sin(a) * 0.3, 0.22, Math.cos(a) * 0.3]]);
      if (i % 2 === 0) gems.push([ball(0.035, 12, 8), [Math.sin(a) * 0.31, 0.0, Math.cos(a) * 0.31]]);
    }
    const g = piece({ '#f2c14e': gold, '#c23a57': gems });
    g.position.y = -0.06;
    g.rotation.z = 0.12;
    const holder = new THREE.Group();
    holder.add(g);
    return holder;
  },
  headphones() {
    return piece(
      {
        '#2b2a33': [
          [new THREE.TorusGeometry(0.45, 0.035, 12, 48, Math.PI), [0, -0.42, 0]],
          ...[-1, 1].map((sx) => [cyl(0.15, 0.15, 0.11, 32), [sx * 0.46, -0.45, 0], [0, 0, Math.PI / 2]]),
        ],
        '#97ce4c': [-1, 1].map((sx) => [new THREE.TorusGeometry(0.11, 0.022, 10, 32), [sx * 0.52, -0.45, 0], [0, Math.PI / 2, 0]]),
      },
      {},
    );
  },
  // ── on the face (e: where the eyes are, in heads: spread either side, and their size) ──
  shades(e = EYES.rick) {
    const frame = [[box(e.spread * 0.7, 0.025, 0.03), [0, e.size * 0.3, 0.02]]];
    const lens = [];
    for (const sx of [-1, 1]) {
      lens.push([new THREE.CylinderGeometry(e.size * 1.25, e.size * 1.25, 0.03, 32), [sx * e.spread, 0, 0.03], [Math.PI / 2, 0, 0], [1.15, 1, 0.82]]);
      frame.push([box(0.025, 0.03, 0.42), [sx * Math.max(0.29, e.spread + e.size * 1.35), e.size * 0.3, -0.18]]);
    }
    return piece({ '#16141c': frame, '#27303a': lens });
  },
  goggles(e = EYES.rick) {
    const brass = [];
    const glass = [];
    const r = e.size * 1.2;
    for (const sx of [-1, 1]) {
      brass.push([cyl(r, r, 0.09, 28, true), [sx * e.spread, 0, 0.03], ALONG]);
      brass.push([new THREE.TorusGeometry(r, 0.018, 10, 28), [sx * e.spread, 0, 0.075]]);
      glass.push([new THREE.CircleGeometry(r * 0.94, 28), [sx * e.spread, 0, 0.07]]);
    }
    brass.push([box(Math.max(0.03, e.spread * 2 - r * 2), 0.03, 0.03), [0, 0.0, 0.05]]);
    const strap = [[new THREE.TorusGeometry(0.5, 0.03, 8, 48, Math.PI), [0, 0, -0.32], [Math.PI / 2, 0, Math.PI], [1, 1.05, 1]]];
    return piece({ '#c8963e': brass, '#e7a74a': glass, '#6b4527': strap });
  },
  eyepatch(e = EYES.rick) {
    // over his right eye (−x: he faces +z), its strap round the back of his head
    return piece({
      '#121016': [
        [ball(e.size * 1.3, 24, 12), [-e.spread, 0, 0.02], [0, 0, 0], [1, 0.9, 0.35]],
        [new THREE.TorusGeometry(0.5, 0.014, 6, 48, Math.PI), [0, 0.04, -0.32], [Math.PI / 2 - 0.2, 0, Math.PI], [1, 1.05, 1]],
      ],
    });
  },
  // ── in the hand (front −z, top +y, the grip at the origin) ──
  portalgun() {
    return piece(
      {
        '#dfe3e6': [
          [box(0.34, 0.26, 0.9), [0, 0.25, -0.38]],
          [box(0.22, 0.48, 0.2), [0, -0.05, 0.02], [0.3, 0, 0]],
        ],
        '#2b2d33': [[box(0.18, 0.06, 0.18), [0, 0.4, -0.05]]],
      },
      { '#7dff5c': true },
    ).add(piece({ '#7dff5c': [[ball(0.14, 20, 12), [0, 0.38, -0.5], [0, 0, 0], [1, 0.9, 1]]] }, { '#7dff5c': true }));
  },
  plumbus() {
    const pink = [
      [new THREE.LatheGeometry([[0.0, -0.3], [0.16, -0.26], [0.22, -0.1], [0.15, 0.08], [0.2, 0.22], [0.08, 0.36], [0.0, 0.38]].map(([r, y]) => new THREE.Vector2(r, y)), 32), [0, 0.12, -0.42], [-Math.PI / 2, 0, 0]],
      [ball(0.09), [0.15, 0.2, -0.72]],
    ];
    const deep = [
      [cyl(0.05, 0.06, 0.4, 16), [0, 0, 0.02], [0.15, 0, 0]],
      [new THREE.TorusGeometry(0.12, 0.035, 10, 24), [-0.16, 0.12, -0.3], [0, Math.PI / 2, 0]],
    ];
    return piece({ '#f2a3b8': pink, '#c86b84': deep });
  },
  laserpistol() {
    return piece(
      {
        '#8d96a3': [
          [cyl(0.09, 0.07, 0.62, 24), [0, 0.2, -0.35], ALONG],
          [box(0.14, 0.42, 0.18), [0, -0.05, 0.02], [0.25, 0, 0]],
          ...[0, 1, 2].map((i) => [box(0.02, 0.16, 0.12), [0, 0.3, -0.18 - i * 0.12]]),
        ],
        '#b8323b': [[cyl(0.1, 0.1, 0.06, 24), [0, 0.2, -0.05], ALONG]],
      },
      {},
    ).add(piece({ '#7dff5c': [[cyl(0.045, 0.06, 0.08, 20), [0, 0.2, -0.68], ALONG]] }, { '#7dff5c': true }));
  },

  // ── Walt and Jesse’s ──
  porkpie() {
    // Heisenberg’s: a short flat crown with its top pressed in round the
    // edge, a narrow brim turned up a little, a band a shade off the felt
    const felt = '#1c1b1f';
    return piece({
      [felt]: [
        [cyl(0.45, 0.42, 0.32, 48), [0, 0.01, 0]],
        [new THREE.TorusGeometry(0.375, 0.045, 10, 48), [0, 0.16, 0], [Math.PI / 2, 0, 0]], // (the pressed-in ring round its top)
        [new THREE.LatheGeometry([[0.43, 0.03], [0.55, 0.0], [0.66, 0.035], [0.66, 0.06], [0.55, 0.03], [0.43, 0.05]].map(([r, y]) => new THREE.Vector2(r, y)), 48), [0, -0.17, 0]],
      ],
      '#2e2c31': [[cyl(0.455, 0.45, 0.08, 48), [0, -0.11, 0]]],
    });
  },
  jessebeanie() {
    // his: a charcoal knit pulled snug over the skull and worn a little back,
    // ribbed all the way up, its cuff turned up and ribbed finer
    const crown = ribbed(new THREE.SphereGeometry(0.46, 72, 28, 0, Math.PI * 2, 0, Math.PI * 0.53), 34, 0.022);
    const cuff = ribbed(new THREE.CylinderGeometry(0.476, 0.468, 0.14, 96, 1, true), 56, 0.026);
    const g = piece({
      '#3b3c42': [[crown, [0, -0.24, 0], [0, 0, 0], [1.01, 0.93, 1.1]]],
      '#2f3035': [[cuff, [0, -0.29, 0], [0, 0, 0], [1.02, 1, 1.1]]],
    });
    g.traverse((o) => o.isMesh && (o.material.side = THREE.DoubleSide)); // (the cuff is open: its inside shows from below)
    g.rotation.x = -0.14; // (worn back: the cuff high on the forehead, low on the nape)
    const holder = new THREE.Group();
    holder.add(g);
    return holder;
  },
  glasses(e = EYES.rick) {
    // thin dark rims round soft oblong lenses, each turned a little to wrap
    // round the face, a bridge over the nose, and arms back to the ears
    const w = e.size * 1.3;
    const h = e.size * 0.85;
    const r = Math.min(w, h) * 0.45;
    const lens = (sx) => {
      const shape = new THREE.Shape();
      shape.moveTo(-w + r, -h);
      shape.lineTo(w - r, -h);
      shape.quadraticCurveTo(w, -h, w, -h + r);
      shape.lineTo(w, h - r);
      shape.quadraticCurveTo(w, h, w - r, h);
      shape.lineTo(-w + r, h);
      shape.quadraticCurveTo(-w, h, -w, h - r);
      shape.lineTo(-w, -h + r);
      shape.quadraticCurveTo(-w, -h, -w + r, -h);
      const pts = shape.getSpacedPoints(48).map((q) => new THREE.Vector3(q.x, q.y, 0));
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.012, 6, true);
      return [tube, [sx * e.spread, 0, 0.03], [0, sx * -0.2, 0]];
    };
    const hinge = (sx) => sx * (e.spread + w * Math.cos(0.2));
    const arm = (sx) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(hinge(sx), h * 0.55, 0.03 - w * Math.sin(0.2)), new THREE.Vector3(sx * Math.max(0.3, e.spread + w + 0.06), h * 0.5, -0.2), new THREE.Vector3(sx * Math.max(0.31, e.spread + w + 0.07), h * 0.2, -0.42)]), 16, 0.01, 5);
    const bridge = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-(e.spread - w), h * 0.35, 0.03), new THREE.Vector3(0, h * 0.55, 0.05), new THREE.Vector3(e.spread - w, h * 0.35, 0.03)]), 12, 0.011, 5);
    return piece({ '#2a221d': [lens(-1), lens(1), [arm(-1)], [arm(1)], [bridge]] });
  },
  respirator() {
    // the cook’s half mask: a grey rubber cup over the nose and mouth, a
    // pink filter either side, its straps going back past the cheeks
    const cup = [[ball(0.21, 28, 18), [0, -0.29, 0.06], [0.2, 0, 0], [1, 1.05, 0.72]]];
    const dark = [[cyl(0.06, 0.07, 0.07, 20), [0, -0.38, 0.2], ALONG]];
    const pink = [];
    for (const sx of [-1, 1]) {
      pink.push([cyl(0.105, 0.105, 0.075, 28), [sx * 0.19, -0.34, 0.1], [Math.PI / 2, sx * 0.55, 0]]);
      for (const y of [-0.18, -0.36]) dark.push([box(0.02, 0.025, 0.2), [sx * 0.2, y, -0.04], [0, sx * -0.35, 0]]);
    }
    return piece({ '#7d8086': cup, '#2b2c30': dark, '#d63c82': pink });
  },
  bluebag() {
    // a zip bag of Blue Sky held by its seal: clear plastic, the crystals in
    // the bottom of it
    const crystals = [];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996;
      crystals.push([new THREE.OctahedronGeometry(0.07 + (i % 3) * 0.015), [Math.sin(a) * 0.1, Math.cos(a * 1.7) * 0.012, -0.42 - (i % 4) * 0.04], [a, a * 0.7, 0], [1, 0.75, 1.4]]);
    }
    const g = piece({ '#5fc8ef': crystals, '#2f6fc8': [[box(0.4, 0.035, 0.035), [0, 0, -0.06]]] });
    const bag = piece({ '#e6f4fa': [[box(0.38, 0.09, 0.52), [0, 0, -0.33]]] });
    clear(bag, 0.35);
    return g.add(bag);
  },
  flask() {
    // an Erlenmeyer flask held by its neck, a blue batch in it
    const glassy = piece({ '#e9f6f7': [[new THREE.LatheGeometry([[0.05, 0.02], [0.055, 0], [0.055, -0.2], [0.24, -0.58], [0.24, -0.62], [0, -0.62]].map(([r, y]) => new THREE.Vector2(r, y)), 32), [0, 0, 0], ALONG]] });
    clear(glassy, 0.4);
    const batch = piece({ '#3fb6e8': [[new THREE.LatheGeometry([[0, -0.6], [0.225, -0.6], [0.16, -0.42], [0, -0.42]].map(([r, y]) => new THREE.Vector2(r, y)), 32), [0, 0, 0], ALONG]] });
    return batch.add(glassy);
  },
};
// a piece’s meshes seen through (a bag’s plastic, a flask’s glass)
function clear(g, opacity) {
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.material.transparent = true;
    o.material.opacity = opacity;
    o.material.depthWrite = false;
    o.castShadow = false;
  });
}

// where the eyes are, by face: Morty’s take up most of it; Walt’s and
// Jesse’s are a person’s, Jesse’s drawn a little large
const EYES = { rick: { spread: 0.11, size: 0.08 }, morty: { spread: 0.2, size: 0.15 }, walt: { spread: 0.12, size: 0.075 }, jesse: { spread: 0.12, size: 0.07 }, jesselab: { spread: 0.13, size: 0.08 } };

// a piece of gear, in its own frame; face gear for `face` ('rick' or 'morty')
export function buildGear(id, face = 'rick') {
  return BUILD[id] ? BUILD[id](EYES[face] ?? EYES.rick) : null;
}

// the portal gun, the model's, set in the hand's frame: its grip (towards
// its back and below, as it comes: a unit long, centred) at the origin
let gltf = null;
const GRIP = [0, 0.2, -0.32]; // (how far to move the model so its grip's on the origin)
function loadModel(url) {
  if (!gltf) {
    gltf = new GLTFLoader();
    gltf.setMeshoptDecoder(MeshoptDecoder);
  }
  return gltf.loadAsync(url).then((g) => g.scene);
}
const MODELS = Object.fromEntries([...Object.values(GEAR), ...Object.values(BB_GEAR)].flat().filter((g) => g.file).map((g) => [g.id, g.file])); // (the gear that’s a model of someone else’s)
const models = new Map();
export function loadGear(id) {
  if (!MODELS[id]) return Promise.resolve(buildGear(id));
  if (!models.has(id))
    models.set(
      id,
      loadModel(MODELS[id]).catch(() => null),
    );
  return models.get(id).then((scene) => {
    if (!scene) return buildGear(id);
    const g = new THREE.Group();
    const m = scene.clone(true);
    // toon, like the cast: its own colours, the glow kept bright
    m.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      const t = toon(src.color ?? 0xffffff, { map: src.map ?? null, transparent: src.transparent, opacity: src.opacity, emissive: src.emissive ?? 0x000000, emissiveMap: src.emissiveMap ?? null, emissiveIntensity: src.emissiveIntensity ?? 1 });
      if (src.transparent) t.depthWrite = false;
      o.material = t;
      o.userData.sharedGeometry = true; // (the loaded model's: every copy has it)
      o.castShadow = true;
    });
    m.position.set(...GRIP);
    g.add(m);
    return g;
  });
}

// How each body wears it: head gear raised or sunk (in heads) and sized,
// face gear brought forward (in heads); the hand's gear sized (in forearms).
// Tuned by eye in lab/gear-sheet.html (Walt’s and Jesse’s in a sheet of
// their heads from the front, three quarters and the side): `lift` raises
// one piece on top of `hat` (a beanie sits down to the brows, a pork-pie’s
// brim higher), and `back` moves the head’s gear back (in heads) where the
// skull reaches further behind its crown bone than Rick’s; `nudge` moves one
// piece of face gear [up, forward] (in heads) off the eyes' frame, where a
// face stands further out than Rick's (Walt's beard under his respirator).
// Walt's and Jesse's were fitted again on their HD figures, whose head bones
// sit differently against the skull (lab/skull.mjs measures it).
const FIT = {
  default: { eyes: 'rick', hat: 0, hatScale: 1, lift: {}, back: 0, face: 0, faceUp: 0, faceScale: 1, nudge: {}, hand: 1 },
  rick: { hat: -0.12, hatScale: 1.0, face: 0.0, faceUp: 0.02, hand: 1 },
  tinyrick: { hat: -0.12, hatScale: 1.05, face: 0.0, faceUp: 0.0, hand: 1.1 },
  morty: { eyes: 'morty', hat: -0.08, hatScale: 1.05, face: 0.05, faceUp: 0.0, hand: 1.3 },
  walt: { eyes: 'walt', hat: -0.13, hatScale: 1.1, lift: { jessebeanie: 0.14 }, back: -0.11, face: -0.3, faceUp: 0.0, nudge: { respirator: [0.08, 0.22] }, hand: 1.25 },
  jesse: { eyes: 'jesse', hat: -0.14, hatScale: 1.1, lift: { jessebeanie: 0.09, porkpie: 0 }, back: -0.02, face: -0.115, faceUp: 0.03, nudge: { respirator: [0.08, 0.06] }, hand: 1.25 },
  // (Jesse in hazmat: his own figure, its head not his hoodie's since that was made again)
  jesselab: { eyes: 'jesselab', hat: -0.14, hatScale: 1.1, lift: { jessebeanie: 0.15, porkpie: 0.04 }, back: -0.07, face: -0.1, faceUp: 0.1, nudge: { respirator: [0, 0.08] }, hand: 1.25 },
};
// (Walt’s three bodies are one figure)
const SAME = { mrwhite: 'walt', heisenberg: 'walt' };
const fitOf = (body) => ({ ...FIT.default, ...(FIT[SAME[body] ?? body] ?? (body.includes('morty') ? FIT.morty : FIT.rick)) });

const v = () => new THREE.Vector3();
// a world matrix from its axes, origin and size
const basis = (x, y, z, at, s) => new THREE.Matrix4().makeBasis(x, y, z).scale(new THREE.Vector3(s, s, s)).setPosition(at);

// Gear on a figure from createMeshyCast().make(), for a look; returns a
// function that takes it all off again. The frames are worked out in the
// skeleton's bind pose, in the skinned mesh's own space (from its bones'
// inverses: no pose is touched), and each piece is set on its bone by where
// it sits against that bone there. The portal gun comes when its model does
// (the built one meanwhile).
export function wearGear(figure, look) {
  const skinned = [];
  figure.group.traverse((o) => o.isSkinnedMesh && !o.userData.ink && skinned.push(o));
  const skeleton = skinned[0]?.skeleton;
  if (!skeleton) return () => {};
  const bone = (n) => skeleton.getBoneByName(n);
  const head = bone('Head');
  const crown = bone('head_end');
  const front = bone('headfront');
  const hand = bone('RightHand');
  const arm = bone('RightForeArm');
  const on = [];
  let gone = false;
  // a bone's matrix in the bind pose, in the mesh's space
  const bind = (b) => new THREE.Matrix4().copy(skeleton.boneInverses[skeleton.bones.indexOf(b)]).invert();
  const at = (b) => v().setFromMatrixPosition(bind(b));
  const fit = fitOf(look.body);
  const put = (b, obj, frame) => {
    if (!b || !obj || gone) return;
    bind(b).invert().multiply(frame).decompose(obj.position, obj.quaternion, obj.scale);
    obj.userData.gear = true;
    obj.traverse((o) => (o.userData.noPaint = true));
    b.add(obj);
    on.push(obj);
  };
  const frames = {};
  if (head && crown) {
    const H = at(head);
    const E = at(crown);
    const up = v().subVectors(E, H);
    const s = up.length();
    up.normalize();
    const F = front ? at(front) : H.clone().add(new THREE.Vector3(0, 0, s * 0.4));
    const fwd = v().subVectors(F, H);
    fwd.addScaledVector(up, -fwd.dot(up));
    const reach = fwd.length();
    fwd.normalize();
    const right = v().crossVectors(up, fwd);
    frames.head = (id) => basis(right, up, fwd, E.clone().addScaledVector(up, (fit.hat + (fit.lift[id] ?? 0)) * s).addScaledVector(fwd, -fit.back * s), s * fit.hatScale);
    const eyes = H.clone().addScaledVector(up, (0.52 + fit.faceUp) * s).addScaledVector(fwd, reach + fit.face * s);
    frames.face = (id) => {
      const [u, f] = fit.nudge[id] ?? [0, 0];
      return basis(right, up, fwd, eyes.clone().addScaledVector(up, u * s).addScaledVector(fwd, f * s), s * fit.faceScale);
    };
  }
  if (hand && arm) {
    const A = at(arm);
    const R = at(hand);
    const along = v().subVectors(R, A);
    const forearm = along.length();
    along.normalize(); // (down the forearm: where it points)
    const fwd = v().set(0, 0, 1); // (the way he faces, in his own space: the gear's top)
    fwd.addScaledVector(along, -fwd.dot(along)).normalize();
    const back = along.clone().negate(); // (the gear's +z: back up the arm)
    const x = v().crossVectors(fwd, back);
    frames.hand = basis(x, fwd, back, R.clone().addScaledVector(along, 0.25 * forearm), fit.hand * forearm);
  }
  const bones = { head, face: head, hand };
  // (what was picked, and what the body always has on: Heisenberg’s hat)
  const worn = look.gear ? gearWorn(look) : {};
  for (const slot of GEAR_SLOTS) {
    const id = worn[slot];
    if (!id || id === 'none' || !frames[slot] || !gearById(slot, id)) continue; // (readLook already took any hat off a head that has its own)
    const world = slot === 'hand' ? frames.hand : frames[slot](id);
    if (MODELS[id]) {
      const stand = buildGear(id, fit.eyes);
      put(bones[slot], stand, world);
      loadGear(id).then((model) => {
        if (gone || !model) return;
        stand.removeFromParent();
        put(bones[slot], model, world);
      });
    } else put(bones[slot], buildGear(id, fit.eyes), world);
  }
  return () => {
    gone = true;
    for (const o of on) {
      o.removeFromParent();
      o.traverse((m) => {
        if (!m.isMesh) return;
        if (!m.userData.sharedGeometry) m.geometry.dispose();
        m.material.dispose();
      });
    }
  };
}
