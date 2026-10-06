// Middle-earth as a toy world on the map, the way a game's overworld is: the
// ranges stand up off the parchment in low-poly peaks, the forests are woods
// of little trees, and every place on the road has something to see. Hobbiton's
// hills with round doors and the Party Tree, the Prancing Pony at Bree, the
// ruin on Weathertop, Rivendell's towers by a waterfall, the West-gate of
// Moria in the mountains, Lothlórien's golden mallorns full of lights, Orthanc,
// Edoras on its hill, Minas Tirith in white, the Black Gate, the Dead Marshes'
// candles, Barad-dûr with the Eye sweeping the plain and a Nazgûl circling,
// and Mount Doom, smoking and erupting. Frodo and Sam stand on the road and
// walk it to wherever they're sent.
//
// Two of the places are other people's models, from Sketchfab, in the map's
// own plain colours (Mitro123's Minas Tirith and AndreOrla's Orthanc:
// scripts/sketchfab-batch.mjs, credited in data/modelCredits.json). Each is
// built in code first, and its model takes over when it's come; a device on
// the low tier, or one saving data, keeps the built ones.
//
// Everything is placed in the sheet's own 800×560 units (./mapData.js) and
// made in code. `update` moves it all; `walkTo` sends the hobbits.
//
// Other travellers online on the map (towns/travellers.js: the map is a room
// of its own) walk it too, each a pale Frodo from another world with their
// name over them (towns/ghosts.js): `travellers(list)` hands them in, and
// `step` is where your Frodo is, to send.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../lib/stage3d';
import { makeNoise } from '../../lib/paint';
import { FORESTS, RANGES, SHEET, peaks, wood } from './mapData';
import { STOPS } from './road';
import { EMBER, FIRE, SMOKE, createParticles } from './kit';
import { makeGollum, makeToyFigure, makeTreebeard, pose } from './mapFigures';
import { CAST, HOBBIT_LINES } from './mapCast';
import { createGhosts } from './towns/ghosts';

const SCALE = 10;
const P = (sx, sy) => [(sx - SHEET.w / 2) / SCALE, (sy - SHEET.h / 2) / SCALE];
const R = (a) => (Math.random() - 0.5) * 2 * a;
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, flatShading: true, ...o });
const glow = (color, k) => new THREE.MeshBasicMaterial({ color: hot(color, k), toneMapped: true });

function put(parent, geo, material, x, y, z, { shadow = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function at(scene, sx, sy) {
  const g = new THREE.Group();
  const [x, z] = P(sx, sy);
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

// Instanced copies of one mesh, from a list of [x, y, z, scale, turn].
function instanced(scene, geo, material, list, { shadow = true } = {}) {
  const m = new THREE.InstancedMesh(geo, material, list.length);
  const o = new THREE.Object3D();
  list.forEach(([x, y, z, s, r = 0], i) => {
    o.position.set(x, y, z);
    o.scale.setScalar(s);
    o.rotation.set(0, r, 0);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.castShadow = shadow;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// ── the road, as a path the hobbits can walk ──
// where they stand at each stop: in front of its landmark, not inside it
const STAND = { hobbiton: [-1.8, 1.5], bree: [0, 1.4], weathertop: [0, 2], rivendell: [0.8, 2.7], moria: [0, 2.3], lorien: [0.4, 1.9], 'black-gate': [0, 1.3], 'mount-doom': [-3.9, 1.1] };
const ROAD = STOPS.map((s) => {
  const [x, z] = P(s.x, s.y);
  const [dx, dz] = STAND[s.id] || [0, 0];
  return new THREE.Vector3(x + dx, 0, z + dz);
});

// A place's model: its shape alone (the map gives it its colour), stood on
// the ground with its middle at the place, `height` tall or `width` across,
// turned by `turn`, and `stretch` times taller than it came (a toy's
// proportions: the built places are all taller than they are wide).
// Resolves to its mesh, or null if it doesn't come.
// (the site's shared loader, fetched only when a model is wanted, so the
// map's own chunk stays without it)
const loaders = () => import('../../lib/three/gltf');
function placeModel(name, material, { height, width, turn = 0, stretch = 1 }) {
  return loaders()
    .then(({ gltfLoader }) => gltfLoader().loadAsync(`/models/sketchfab/${name}.glb`))
    .then((gltf) => {
      let mesh = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => o.isMesh && !mesh && (mesh = o));
      // its corners as plain numbers in the model's own space (they come packed into whole numbers, which can't be moved about)
      const from = mesh.geometry.attributes.position;
      const corners = new Float32Array(from.count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < from.count; i++) v.fromBufferAttribute(from, i).applyMatrix4(mesh.matrixWorld).toArray(corners, i * 3);
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(corners, 3)).setIndex(mesh.geometry.index);
      geo.computeBoundingBox();
      const box = geo.boundingBox;
      const k = width ? width / Math.max(box.max.x - box.min.x, box.max.z - box.min.z) : height / (box.max.y - box.min.y);
      geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2).scale(k, k * stretch, k).rotateY(turn);
      geo.computeBoundingBox();
      const m = new THREE.Mesh(geo, material);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    })
    .catch(() => null);
}

export function buildDiorama(scene, { soft = false, reduced = false, models = true } = {}) {
  const world = new THREE.Group();
  scene.add(world);
  let gone = false;
  // a place built in code gives way to its model: the built parts go, the model stands in their place
  const takeOver = (group, built, name, material, fit, then) => {
    if (!models) return;
    placeModel(name, material, fit).then((m) => {
      if (!m) return;
      if (gone) return m.geometry.dispose();
      for (const b of built) {
        b.removeFromParent();
        b.geometry.dispose();
      }
      group.add(m);
      then?.(m);
    });
  };
  const n = makeNoise(17);
  const near = (sx, sy, list, r) => list.some(([x, y]) => Math.hypot(sx - x, sy - y) < r);

  // ── the ranges ──
  {
    const clear = [
      [388, 176],
      [186, 196],
    ]; // Rivendell's valley, and the Shire
    const rock = [];
    const dark = [];
    for (const [x0, y0, x1, y1, black] of RANGES) {
      for (const [sx, sy] of peaks(x0, y0, x1, y1, 12)) {
        if (near(sx, sy, clear, 15)) continue;
        const [x, z] = P(sx + R(3), sy + R(2));
        const s = 0.75 + n(sx * 0.1, sy * 0.1) * 0.75;
        (black ? dark : rock).push([x, 0, z, s, Math.random() * 6]);
      }
    }
    const peak = new THREE.ConeGeometry(0.95, 2, 5).translate(0, 1, 0);
    const cap = new THREE.ConeGeometry(0.45, 0.62, 5).translate(0, 1.7, 0);
    instanced(world, peak, mat(0x9a8f80), rock);
    instanced(world, cap, mat(0xf6f3ea, { roughness: 0.5 }), rock, { shadow: false });
    instanced(world, peak, mat(0x3a2c27), dark);
    instanced(world, new THREE.ConeGeometry(0.3, 0.4, 5).translate(0, 1.82, 0), glow(0xff5a1a, 1.2), dark.filter((_, i) => i % 4 === 0), { shadow: false });
  }

  // ── the woods ──
  {
    const leafy = [];
    const gold = [];
    const darkw = [];
    for (const [cx, cy, rx, ry, seed, count, kind] of FORESTS) {
      for (const [sx, sy, r] of wood(cx, cy, rx, ry, seed, count)) {
        const [x, z] = P(sx, sy);
        const s = (kind === 'gold' ? 0.17 : kind === 'dark' ? 0.13 : 0.17) * r * (0.9 + Math.random() * 0.3);
        (kind === 'gold' ? gold : kind === 'dark' ? darkw : leafy).push([x, 0, z, s, Math.random() * 6]);
      }
    }
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0);
    const pine = new THREE.ConeGeometry(0.75, 1.9, 7).translate(0, 1.6, 0);
    const round = new THREE.IcosahedronGeometry(0.9, 1).translate(0, 1.6, 0);
    const bark = mat(0x6b4a2b);
    for (const [list, geo, color] of [
      [leafy, pine, 0x3f7d3a],
      [gold, round, 0xe8b63a],
      [darkw, round, 0x2a3a26],
    ]) {
      instanced(world, trunk, bark, list);
      instanced(world, geo, mat(color), list);
    }
  }

  // ── the places ──
  const grass = mat(0x86b552);
  const stone = mat(0xd9d2c4);
  const whiteStone = mat(0xf1ede4);
  const black = mat(0x1d1716, { roughness: 0.6 });
  const orthancStone = mat(0x2b2523, { roughness: 0.55 }); // a little lighter than the rest of the black, so the tower's carving shows
  const wood_ = mat(0x7a5634);
  const roof = mat(0x9a3b2a);

  // Hobbiton: hills with round doors, the Party Tree
  {
    const g = at(world, 186, 196);
    for (const [x, z, r, door] of [
      [-1.4, -0.9, 1.3, 0x2f7a3e],
      [0.9, -1.3, 1.1, 0xe0a92e],
      [0.2, 1.2, 0.95, 0xb5432e],
    ]) {
      const hill = put(g, new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), grass, x, 0, z);
      hill.scale.y = 0.62;
      const d = put(g, new THREE.CircleGeometry(r * 0.32, 18), mat(door, { flatShading: false }), x, r * 0.24, z + r * 0.93, { shadow: false });
      d.rotation.x = -0.25;
      put(g, new THREE.SphereGeometry(r * 0.06, 6, 5), glow(0xffd76a, 1.2), x + r * 0.12, r * 0.24, z + r * 0.97, { shadow: false });
      put(g, new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), wood_, x + r * 0.7, r * 0.55, z - 0.2); // chimney
    }
    put(g, new THREE.CylinderGeometry(0.16, 0.24, 1.4, 7), wood_, 2.2, 0.7, 0.6);
    put(g, new THREE.IcosahedronGeometry(1.05, 1), mat(0x4f8f3a), 2.2, 1.9, 0.6);
  }
  // Bree: the Prancing Pony
  {
    const g = at(world, 262, 200);
    put(g, new THREE.BoxGeometry(1.5, 0.8, 1), mat(0xe9dcc0), 0, 0.4, 0);
    const r = put(g, new THREE.ConeGeometry(1.15, 0.7, 4), roof, 0, 1.15, 0);
    r.rotation.y = Math.PI / 4;
    r.scale.set(1, 1, 0.75);
    put(g, new THREE.BoxGeometry(0.3, 0.4, 0.04), mat(0xd9a33a), 0.95, 0.75, 0.4, { shadow: false });
  }
  // Weathertop: a hill and a broken ring of stones
  {
    const g = at(world, 312, 192);
    const hill = put(g, new THREE.ConeGeometry(1.6, 1.3, 9), mat(0x8a9a5a), 0, 0.65, 0);
    hill.scale.y = 1;
    for (let i = 0; i < 8; i++) {
      if (i === 3) continue;
      const a = (i / 8) * Math.PI * 2;
      put(g, new THREE.BoxGeometry(0.18, 0.35 + (i % 3) * 0.12, 0.18), stone, Math.cos(a) * 0.55, 1.35, Math.sin(a) * 0.55);
    }
  }
  // Rivendell: slender towers in a green valley, a waterfall, warm lights
  const falls = [];
  {
    const g = at(world, 392, 178);
    put(g, new THREE.CylinderGeometry(2.1, 2.4, 0.18, 18), mat(0x5f9a4a), 0, 0.09, 0);
    for (const [x, z, h] of [
      [0, 0, 2.1],
      [0.9, 0.5, 1.5],
      [-0.8, 0.6, 1.3],
      [0.3, -0.9, 1.7],
    ]) {
      put(g, new THREE.CylinderGeometry(0.2, 0.26, h, 8), whiteStone, x, h / 2, z);
      put(g, new THREE.ConeGeometry(0.34, 0.6, 8), mat(0xc79a3a, { metalness: 0.3, roughness: 0.5 }), x, h + 0.3, z);
      put(g, new THREE.BoxGeometry(0.08, 0.14, 0.02), glow(0xffd28a, 1.6), x, h * 0.7, z + 0.24, { shadow: false });
    }
    // the hall, a bridge, the falls off the cliff behind
    put(g, new THREE.BoxGeometry(1.2, 0.5, 0.7), whiteStone, -0.2, 0.33, 1.3);
    put(g, new THREE.BoxGeometry(1.4, 0.18, 0.7), mat(0xb98a3a), -0.2, 0.68, 1.3);
    put(g, new THREE.BoxGeometry(1.4, 2.6, 0.6), mat(0x8f8576), -1.6, 1.3, -1.3);
    for (const x of [-1.9, -1.3]) {
      const f = put(g, new THREE.PlaneGeometry(0.28, 2.5, 1, 12), new THREE.MeshBasicMaterial({ color: hot(0xdff2ff, 1.3), transparent: true, opacity: 0.8 }), x, 1.3, -0.98, { shadow: false });
      falls.push(f);
    }
    put(g, new THREE.CircleGeometry(0.7, 16), new THREE.MeshStandardMaterial({ color: 0x6aa8d8, roughness: 0.2, metalness: 0.2 }), -1.6, 0.2, -0.5, { shadow: false }).rotation.x = -Math.PI / 2;
  }
  // Moria: the West-gate in a great peak, its lines glowing faintly
  let moriaGlow;
  {
    const g = at(world, 380, 262);
    put(g, new THREE.ConeGeometry(1.9, 3.4, 6), mat(0x8a8274), 0, 1.7, -0.6);
    put(g, new THREE.ConeGeometry(0.85, 0.9, 6), mat(0xf6f3ea), 0, 3.0, -0.6, { shadow: false });
    const arch = new THREE.Shape();
    arch.moveTo(-0.45, 0);
    arch.lineTo(-0.45, 0.6);
    arch.absarc(0, 0.6, 0.45, Math.PI, 0, true);
    arch.lineTo(0.45, 0);
    const door = put(g, new THREE.ShapeGeometry(arch, 16), mat(0x121418), 0, 0.02, 1.02, { shadow: false });
    door.rotation.x = -0.5;
    moriaGlow = put(g, new THREE.ShapeGeometry(arch, 16), new THREE.MeshBasicMaterial({ color: hot(0x9fc4ff, 2), wireframe: true, transparent: true, opacity: 0.6 }), 0, 0.03, 1.04, { shadow: false });
    moriaGlow.rotation.x = -0.5;
  }
  // Lothlórien: one great mallorn among the gold, and lights drifting in the boughs
  {
    const g = at(world, 440, 286);
    put(g, new THREE.CylinderGeometry(0.22, 0.34, 2.6, 8), mat(0xd9d0bc), 0, 1.3, 0);
    put(g, new THREE.IcosahedronGeometry(1.25, 1), mat(0xf2c64a), 0, 2.9, 0);
    put(g, new THREE.CylinderGeometry(0.9, 0.9, 0.08, 14), mat(0xe9dcc0), 0, 2.1, 0); // a flet
  }
  // Isengard: Orthanc, black, in its ring. The tower itself can be clicked,
  // for whoever thinks to (the way in: ./hidden.js); its ring can't.
  const orthanc = new THREE.Group();
  orthanc.userData.who = 'orthanc';
  {
    const g = at(world, 378, 362);
    const ring = put(g, new THREE.TorusGeometry(1.3, 0.14, 6, 24), mat(0x4a4642), 0, 0.12, 0);
    ring.rotation.x = Math.PI / 2;
    g.add(orthanc);
    const built = [put(orthanc, new THREE.CylinderGeometry(0.28, 0.42, 3, 6), black, 0, 1.5, 0)];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const h = put(orthanc, new THREE.ConeGeometry(0.1, 0.7, 4), black, Math.cos(a) * 0.2, 3.25, Math.sin(a) * 0.2);
      h.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      built.push(h);
    }
    // a little fatter than the tower, and never drawn, so a click near it counts
    const reach = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 4, 8), new THREE.MeshBasicMaterial());
    reach.position.y = 2;
    reach.visible = false;
    orthanc.add(reach);
    takeOver(orthanc, built, 'orthanc', orthancStone, { height: 3.9 });
  }
  // Edoras: the golden hall on its hill. It can be clicked too (the way in:
  // ./hidden.js).
  let edoras;
  {
    const g = at(world, 418, 410);
    g.userData.who = 'edoras';
    edoras = g;
    // a little wider than the hill, and never drawn, so a click near it counts
    const reach = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 2.4, 10), new THREE.MeshBasicMaterial());
    reach.position.y = 1.1;
    reach.visible = false;
    g.add(reach);
    const hill = put(g, new THREE.ConeGeometry(1.5, 1.1, 10), mat(0x9ab05a), 0, 0.55, 0);
    hill.scale.y = 1;
    put(g, new THREE.BoxGeometry(0.9, 0.38, 0.5), mat(0x9a6a3a), 0, 1.25, 0);
    const r = put(g, new THREE.ConeGeometry(0.62, 0.42, 4), mat(0xe8b53a, { metalness: 0.5, roughness: 0.4 }), 0, 1.64, 0);
    r.rotation.y = Math.PI / 4;
    r.scale.set(1.2, 1, 0.65);
  }
  // Minas Tirith: seven white tiers and the tower. The city itself can be
  // clicked too, for whoever thinks to (the way in: ./hidden.js).
  let banner;
  let minasTirith;
  {
    const g = at(world, 520, 444);
    g.userData.who = 'minas-tirith';
    minasTirith = g;
    // a little wider than the city, and never drawn, so a click near it counts
    const reach = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 4, 10), new THREE.MeshBasicMaterial());
    reach.position.y = 1.8;
    reach.visible = false;
    g.add(reach);
    const built = [];
    for (let i = 0; i < 7; i++) built.push(put(g, new THREE.CylinderGeometry(1.6 - i * 0.2, 1.65 - i * 0.2, 0.32, 20), whiteStone, 0, 0.16 + i * 0.32, -i * 0.08));
    built.push(put(g, new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), whiteStone, 0, 2.9, -0.56));
    built.push(put(g, new THREE.ConeGeometry(0.18, 0.3, 8), mat(0xe8e2d0), 0, 3.75, -0.56));
    const pole = put(g, new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), wood_, 0, 4.1, -0.56);
    banner = put(g, new THREE.PlaneGeometry(0.4, 0.26, 6, 1), mat(0x1a1a1a, { side: THREE.DoubleSide }), 0.2, 4.25, -0.56, { shadow: false });
    // the city faces east, to Mordor; here it's turned half towards you, so its gate and its seven levels show
    takeOver(g, built, 'minas-tirith', whiteStone, { width: 3.6, turn: -Math.PI / 4, stretch: 1.7 }, (city) => {
      // the banner flies from the Tower of Ecthelion: the model's highest point
      const p = city.geometry.attributes.position;
      let top = 0;
      for (let i = 1; i < p.count; i++) if (p.getY(i) > p.getY(top)) top = i;
      // the hill it stands on is the mountains' rock, and the city white: by height, with a short blend between
      const rock = new THREE.Color(0x9a8f80);
      const white = new THREE.Color(0xf6f3ea);
      const tint = new THREE.Color();
      const colors = new Float32Array(p.count * 3);
      const h = p.getY(top);
      for (let i = 0; i < p.count; i++) tint.copy(rock).lerp(white, THREE.MathUtils.smoothstep(p.getY(i) / h, 0.47, 0.55)).toArray(colors, i * 3);
      city.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      city.material = mat(0xffffff, { vertexColors: true });
      pole.position.set(p.getX(top), p.getY(top) + 0.3, p.getZ(top));
      banner.position.set(p.getX(top) + 0.2, p.getY(top) + 0.45, p.getZ(top));
    });
  }
  // the Black Gate
  {
    const g = at(world, 604, 368);
    for (const x of [-0.9, 0.9]) {
      put(g, new THREE.BoxGeometry(0.6, 2.2, 0.6), black, x, 1.1, 0);
      put(g, new THREE.ConeGeometry(0.42, 0.6, 4), black, x, 2.5, 0).rotation.y = Math.PI / 4;
    }
    put(g, new THREE.BoxGeometry(1.3, 1.5, 0.25), mat(0x2a2422, { metalness: 0.5, roughness: 0.5 }), 0, 0.75, 0);
  }
  // Barad-dûr, the Eye, and its light on the plain
  let eye;
  let beam;
  {
    const g = at(world, 712, 392);
    put(g, new THREE.CylinderGeometry(0.75, 1.3, 1.2, 6), black, 0, 0.6, 0);
    put(g, new THREE.CylinderGeometry(0.45, 0.75, 2.6, 6), black, 0, 2.5, 0);
    put(g, new THREE.CylinderGeometry(0.3, 0.45, 1.6, 6), black, 0, 4.6, 0);
    for (const s of [-1, 1]) {
      const prong = put(g, new THREE.ConeGeometry(0.12, 1.3, 4), black, s * 0.32, 5.9, 0);
      prong.rotation.z = -s * 0.22;
    }
    eye = new THREE.Group();
    eye.position.set(0, 5.75, 0);
    g.add(eye);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), glow(0xff7a1a, 3.2));
    iris.scale.set(1, 0.6, 0.35);
    eye.add(iris);
    const pupil = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.32), new THREE.MeshBasicMaterial({ color: 0x050101 }));
    pupil.position.z = 0.13;
    eye.add(pupil);
    const cone = new THREE.ConeGeometry(2.2, 16, 24, 1, true).translate(0, -8, 0).rotateX(-Math.PI / 2);
    beam = new THREE.Mesh(
      cone,
      new THREE.MeshBasicMaterial({ color: hot(0xffa24a, 0.55), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.copy(eye.position);
    g.add(beam);
  }
  // a Nazgûl on its fell beast, circling
  const nazgul = new THREE.Group();
  const wings = [];
  {
    const dark = mat(0x141012, { side: THREE.DoubleSide });
    put(nazgul, new THREE.SphereGeometry(0.22, 8, 6), dark, 0, 0, 0).scale.set(2.2, 0.8, 0.8);
    put(nazgul, new THREE.ConeGeometry(0.14, 0.5, 6), dark, 0.18, 0.25, 0); // the rider
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(-0.5, s * 1.3);
      shape.lineTo(0.1, s * 1.1);
      shape.lineTo(0.35, s * 0.2);
      const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), dark);
      w.rotation.x = Math.PI / 2;
      w.castShadow = true;
      pivot.add(w);
      nazgul.add(pivot);
      wings.push({ pivot, s });
    }
    scene.add(nazgul);
  }

  // Mount Doom: the cone, its crater, rivers of fire, and the eruptions
  const doomAt = P(660, 420);
  const DOOM = new THREE.Vector3(doomAt[0], 3.3, doomAt[1]);
  const doomLight = new THREE.PointLight(0xff5a1a, 60, 26, 1.6);
  let lavaMat;
  {
    const g = at(world, 660, 420);
    const prof = [
      [3.3, 0],
      [2.7, 0.5],
      [2.0, 1.4],
      [1.35, 2.4],
      [0.95, 3.25],
      [0.72, 3.15],
      [0.5, 2.9],
      [0.001, 2.85],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const cone = new THREE.LatheGeometry(prof, 22);
    const p = cone.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < 0.01 || y > 3.1) continue;
      const k = 1 + (n(p.getX(i) * 0.9, p.getZ(i) * 0.9) - 0.5) * 0.28;
      p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
    }
    cone.computeVertexNormals();
    put(g, cone, mat(0x2e2320), 0, 0, 0);
    lavaMat = glow(0xff6a1a, 2.4);
    put(g, new THREE.CircleGeometry(0.62, 16), lavaMat, 0, 2.95, 0, { shadow: false }).rotation.x = -Math.PI / 2;
    // fire running down the slopes
    const rivers = [];
    for (const a of [0.5, 1.8, 3.6, 5.1]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        const r = 0.9 + k * 2.3;
        const y = 3.15 - k * 3.05;
        const w = a + Math.sin(k * 5 + a) * 0.18;
        pts.push(new THREE.Vector3(Math.cos(w) * r * 1.02, y + 0.04, Math.sin(w) * r * 1.02));
      }
      rivers.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.07, 5, false));
    }
    put(g, mergeGeometries(rivers), lavaMat, 0, 0, 0, { shadow: false });
    doomLight.position.set(DOOM.x, 4.5, DOOM.z);
    scene.add(doomLight);
  }
  const fire = createParticles(soft ? 140 : 340, { ramp: FIRE, gravity: 2.2, drag: 0.8, swirl: 0.6 });
  const bombs = createParticles(soft ? 80 : 180, { ramp: EMBER, gravity: -7, drag: 0.15, stretch: 1.4 });
  const smoke = createParticles(soft ? 60 : 140, { ramp: SMOKE, additive: false, gravity: 0.5, drag: 0.4, swirl: 0.5 });
  const wisps = createParticles(60, { ramp: [[0, 0.6, 1.4, 2, 0], [0.3, 0.6, 1.4, 2.2, 0.8], [1, 0.2, 0.5, 1, 0]], gravity: 0.15, drag: 1, swirl: 0.6 });
  const motes = createParticles(70, { ramp: [[0, 2, 1.9, 1.3, 0], [0.3, 2.2, 2, 1.4, 0.9], [1, 1, 0.9, 0.5, 0]], gravity: 0.05, drag: 1, swirl: 0.8 });
  scene.add(fire.mesh, bombs.mesh, smoke.mesh, wisps.mesh, motes.mesh);

  // ── Frodo and Sam, and the people they meet ──
  const roots = [orthanc, minasTirith, edoras]; // what a tap can land on
  const tag = (group, id) => {
    group.userData.who = id;
    roots.push(group);
    return group;
  };
  const frodo = makeToyFigure({ hair: 0x3a2214, coat: 0x8a3a2a, cloak: 0x5f6b48, ring: true, seed: 1 });
  const sam = makeToyFigure({ hair: 0x8a5a2b, coat: 0xb8873a, cloak: 0x6a6448, pack: true, seed: 2 });
  frodo.group.scale.setScalar(1.9);
  sam.group.scale.setScalar(1.8);
  scene.add(tag(frodo.group, 'frodo'), tag(sam.group, 'sam'));
  const top = (g) => new THREE.Box3().setFromObject(g).max.y;
  const people = CAST.map((c) => {
    const f = c.kind === 'ent' ? makeTreebeard() : c.kind === 'gollum' ? makeGollum() : makeToyFigure(c.look);
    const [x, z] = P(...c.at);
    f.group.scale.setScalar(c.kind === 'ent' ? 1.45 : 1.8);
    f.group.position.set(x, 0, z);
    const face = Math.PI * 0.5 + R(0.6); // towards the viewer, more or less
    f.group.rotation.y = face;
    scene.add(tag(f.group, c.id));
    return { c, f, face, home: face, wave: 0, talk: 0, greeted: false, line: 0, top: top(f.group) };
  });
  const hobbitTop = top(frodo.group) + 0.1;
  // other travellers, online, as pale Frodos from other worlds
  const ghosts = createGhosts({
    make: () => {
      const f = makeToyFigure({ hair: 0x3a2214, coat: 0x8a3a2a, cloak: 0x5f6b48, seed: 1 });
      f.group.scale.setScalar(1.9);
      return { ...f, top: top(f.group) };
    },
    tag: 0.62,
    halo: 1.9,
  });
  scene.add(ghosts.group);
  let travellers = [];
  const lines = { frodo: 0, sam: 0 };

  // what happens on the map, for the page: someone says something
  const heard = new Set();
  const emit = (e) => heard.forEach((f) => f(e));
  const say = (id) => {
    const p = people.find((q) => q.c.id === id);
    if (p) {
      p.wave = 1;
      p.talk = 1;
      const line = p.c.lines[p.line % p.c.lines.length];
      p.line += 1;
      emit({ type: 'talk', id, name: p.c.name, line });
      return;
    }
    if (HOBBIT_LINES[id]) {
      const line = HOBBIT_LINES[id][lines[id] % HOBBIT_LINES[id].length];
      lines[id] += 1;
      (id === 'frodo' ? frodoTalk : samTalk).v = 1;
      emit({ type: 'talk', id, name: id === 'frodo' ? 'Frodo Baggins' : 'Samwise Gamgee', line });
    }
  };
  const frodoTalk = { v: 0 };
  const samTalk = { v: 0 };

  // where they are: free on the map, or walking a path (a list of points)
  const LIMIT = { x: SHEET.w / SCALE / 2 - 2, z: SHEET.h / SCALE / 2 - 2 };
  const H = { x: ROAD[0].x, z: ROAD[0].z, path: [], speed: 8, face: 0, moving: false, drive: [0, 0] };
  try {
    const kept = JSON.parse(window.sessionStorage.getItem('tp-me-frodo') || 'null');
    if (kept && Number.isFinite(kept.x)) Object.assign(H, { x: kept.x, z: kept.z });
    else if (Number.isFinite(kept)) Object.assign(H, { x: ROAD[Math.min(kept, ROAD.length - 1)].x, z: ROAD[Math.min(kept, ROAD.length - 1)].z });
  } catch {
    /* Hobbiton */
  }
  const Sam = { x: H.x - 0.95, z: H.z + 0.8, face: 0, moving: false };
  const keep = () => {
    try {
      window.sessionStorage.setItem('tp-me-frodo', JSON.stringify({ x: H.x, z: H.z }));
    } catch {
      /* fine */
    }
  };
  const nearestStop = () => {
    let best = 0;
    ROAD.forEach((p, i) => {
      if (Math.hypot(p.x - H.x, p.z - H.z) < Math.hypot(ROAD[best].x - H.x, ROAD[best].z - H.z)) best = i;
    });
    return best;
  };
  const pathLength = (pts) => pts.reduce((sum, p, i) => sum + Math.hypot(p.x - (i ? pts[i - 1].x : H.x), p.z - (i ? pts[i - 1].z : H.z)), 0);
  // Down the road to a stop, hurrying; says how long it will take, in ms.
  const walkTo = (stop) => {
    const to = Math.max(0, Math.min(ROAD.length - 1, stop));
    const from = nearestStop();
    const pts = [];
    const step = to >= from ? 1 : -1;
    for (let i = from; i !== to + step; i += step) pts.push({ x: ROAD[i].x, z: ROAD[i].z });
    const len = pathLength(pts);
    if (len < 0.1) return 0;
    H.path = pts;
    H.drive = [0, 0];
    H.speed = reduced ? 1e4 : Math.max(9, len / 2.8);
    return (len / H.speed) * 1000;
  };
  // Straight across the map to a point.
  const walkToPoint = (x, z) => {
    H.path = [{ x: Math.max(-LIMIT.x, Math.min(LIMIT.x, x)), z: Math.max(-LIMIT.z, Math.min(LIMIT.z, z)) }];
    H.drive = [0, 0];
    H.speed = 8;
  };
  const place = (stop) => {
    const p = ROAD[Math.max(0, Math.min(ROAD.length - 1, stop))];
    H.x = p.x;
    H.z = p.z;
    H.path = [];
    keep();
  };
  // Steering, from the keys: a direction on the map, or [0, 0] to stop.
  const drive = (dx, dz) => {
    H.drive = [dx, dz];
    if (dx || dz) H.path = [];
  };
  const ray = new THREE.Raycaster();
  const pick = (raycaster) => {
    const hit = raycaster.intersectObjects(roots, true)[0];
    let o = hit?.object;
    while (o && !o.userData.who) o = o.parent;
    return o?.userData.who || null;
  };
  const headOf = (id, out) => {
    if (id === 'frodo') return out.set(H.x, hobbitTop, H.z);
    if (id === 'sam') return out.set(Sam.x, hobbitTop, Sam.z);
    const p = people.find((q) => q.c.id === id);
    return p ? out.set(p.f.group.position.x, p.top + 0.2, p.f.group.position.z) : null;
  };

  const S = { erupt: 3, shake: 0, flare: 0 };
  const update = (dt, t, { night = 0 } = {}) => {
    ghosts.update(travellers, t, dt);
    // Frodo: steered, or walking his path
    const wasMoving = H.moving;
    let vx = 0;
    let vz = 0;
    if (H.drive[0] || H.drive[1]) {
      const l = Math.hypot(H.drive[0], H.drive[1]);
      vx = (H.drive[0] / l) * 7;
      vz = (H.drive[1] / l) * 7;
    } else if (H.path.length) {
      const p = H.path[0];
      const dx = p.x - H.x;
      const dz = p.z - H.z;
      const d = Math.hypot(dx, dz);
      const stepLen = H.speed * dt;
      if (d <= stepLen) {
        H.x = p.x;
        H.z = p.z;
        H.path.shift();
      } else {
        vx = (dx / d) * H.speed;
        vz = (dz / d) * H.speed;
      }
    }
    H.x = Math.max(-LIMIT.x, Math.min(LIMIT.x, H.x + vx * dt));
    H.z = Math.max(-LIMIT.z, Math.min(LIMIT.z, H.z + vz * dt));
    H.moving = Boolean(vx || vz || H.path.length);
    if (vx || vz) H.face = Math.atan2(-vz, vx);
    if (wasMoving && !H.moving) keep();
    frodo.group.position.set(H.x, 0, H.z);
    frodo.group.rotation.y = H.face;
    // Sam keeps up, a little behind
    {
      const dx = H.x - Sam.x;
      const dz = H.z - Sam.z;
      const d = Math.hypot(dx, dz);
      const gap = 1.5;
      Sam.moving = d > gap + 0.05;
      if (Sam.moving) {
        const go = Math.min(d - gap, Math.max(7, H.speed) * dt * 1.05);
        Sam.x += (dx / d) * go;
        Sam.z += (dz / d) * go;
        Sam.face = Math.atan2(-dz, dx);
      }
      sam.group.position.set(Sam.x, 0, Sam.z);
      sam.group.rotation.y = Sam.face;
    }
    frodoTalk.v = Math.max(0, frodoTalk.v - dt * 0.4);
    samTalk.v = Math.max(0, samTalk.v - dt * 0.4);
    pose(frodo, t, { moving: H.moving, speed: H.speed > 9 ? 1.3 : 1, talk: frodoTalk.v });
    pose(sam, t + 0.4, { moving: Sam.moving, speed: H.speed > 9 ? 1.3 : 1, talk: samTalk.v });

    // the people: they turn to Frodo as he comes by, wave, and say their piece
    for (const p of people) {
      const g = p.f.group;
      const d = Math.hypot(H.x - g.position.x, H.z - g.position.z);
      if (d < 2.8 && !p.greeted) {
        p.greeted = true;
        say(p.c.id);
      } else if (d > 4.5) p.greeted = false;
      const want = d < 5 ? Math.atan2(-(H.z - g.position.z), H.x - g.position.x) : p.home;
      let diff = want - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 3);
      p.wave = Math.max(0, p.wave - dt * 0.35);
      p.talk = Math.max(0, p.talk - dt * 0.3);
      pose(p.f, t + p.face * 3, { wave: Math.min(1, p.wave * 2), talk: p.talk });
    }

    // Rivendell's falls, Minas Tirith's banner, Moria's lines, the Eye
    for (const f of falls) {
      const p = f.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 6 + t * 8 + f.position.x * 3) * 0.03);
      p.needsUpdate = true;
    }
    {
      const p = banner.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 10 - t * 6) * 0.05 * (p.getX(i) + 0.2));
      p.needsUpdate = true;
    }
    moriaGlow.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.4)) + night * 0.2;
    const look = Math.sin(t * 0.35) * 1.1 - 0.4;
    eye.rotation.y = look;
    beam.rotation.y = look;
    beam.rotation.x = 0.42 + Math.sin(t * 0.6) * 0.05;

    // the Nazgûl
    const a = t * 0.32;
    const [bx, bz] = P(700, 400);
    nazgul.position.set(bx + Math.cos(a) * 7, 7.5 + Math.sin(t * 0.9) * 0.4, bz + Math.sin(a) * 5);
    nazgul.rotation.set(0, -a - Math.PI / 2, Math.sin(t * 0.9) * 0.15 + 0.25);
    for (const w of wings) w.pivot.rotation.x = Math.sin(t * 4.2) * 0.5 * w.s;

    // Mount Doom smokes, spits fire, and every few seconds erupts
    lavaMat.color.copy(hot(0xff6a1a, 2.2 + Math.sin(t * 3) * 0.4 + S.flare * 3));
    if (!reduced) {
      fire.emit(DOOM.x + R(0.4), DOOM.y - 0.1, DOOM.z + R(0.4), R(0.5), 1.6 + Math.random() * 1.5, R(0.5), 0.5 + Math.random() * 0.6, 0.5, 1.3, 1);
      if (Math.random() < dt * 6) smoke.emit(DOOM.x + R(0.3), DOOM.y + 0.4, DOOM.z + R(0.3), 0.4 + R(0.2), 1.4 + Math.random(), R(0.3), 5 + Math.random() * 3, 1, 3.6, 1);
      S.erupt -= dt;
      if (S.erupt <= 0) {
        S.erupt = 5 + Math.random() * 4;
        S.flare = 1;
        S.shake = 1;
        for (let i = 0; i < (soft ? 50 : 120); i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 5;
          bombs.emit(DOOM.x, DOOM.y, DOOM.z, Math.cos(ang) * sp * 0.6, 6 + Math.random() * 7, Math.sin(ang) * sp * 0.6, 1.4 + Math.random() * 1.2, 0.22, 0.08, 1.4);
        }
        for (let i = 0; i < (soft ? 30 : 70); i++) fire.emit(DOOM.x + R(0.5), DOOM.y, DOOM.z + R(0.5), R(2.5), 4 + Math.random() * 6, R(2.5), 0.8 + Math.random() * 0.8, 0.8, 2.4, 1.3);
        for (let i = 0; i < 10; i++) smoke.emit(DOOM.x + R(0.6), DOOM.y + 0.6, DOOM.z + R(0.6), R(0.8), 2.5 + Math.random() * 2, R(0.8), 6 + Math.random() * 3, 1.6, 5, 1);
      }
      // the marsh candles, and Lórien's lights
      if (Math.random() < dt * 5) {
        const [mx, mz] = P(562 + R(20), 342 + R(10));
        wisps.emit(mx, 0.3, mz, 0, 0.2, 0, 2.5, 0.25, 0.1, 1);
      }
      if (Math.random() < dt * 9) {
        const [lx, lz] = P(440 + R(22), 286 + R(16));
        motes.emit(lx, 1.5 + Math.random() * 1.6, lz, 0, 0.15, 0, 3, 0.16, 0.05, 1);
      }
    }
    S.flare = Math.max(0, S.flare - dt * 0.7);
    S.shake = Math.max(0, S.shake - dt * 1.6);
    doomLight.intensity = (50 + night * 60) * (1 + S.flare * 3) * (0.92 + 0.08 * Math.sin(t * 9));
    fire.step(dt);
    bombs.step(dt);
    smoke.step(dt);
    wisps.step(dt);
    motes.step(dt);
  };

  return {
    update,
    // a model still on its way has nowhere to go now
    dispose() {
      gone = true;
      ghosts.dispose();
    },
    // the other travellers on the map now (towns/travellers.js's list())
    travellers(list) {
      travellers = list ?? [];
    },
    // where your Frodo is, for them: { x, z, face, speed }
    get step() {
      return { x: H.x, z: H.z, face: H.face, speed: H.moving ? H.speed : 0 };
    },
    walkTo,
    walkToPoint,
    drive,
    place,
    say,
    pick,
    headOf,
    on(f) {
      heard.add(f);
      return () => heard.delete(f);
    },
    ray,
    get frodo() {
      return frodo.group.position;
    },
    get walking() {
      return H.moving;
    },
    get shake() {
      return S.shake;
    },
  };
}
