// Before the Black Gate: the Mountains of Shadow, the gate’s iron leaves,
// the Morannon between the Towers of the Teeth, and the ash slope’s
// boulders. Moved out of props.js as they were.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../../../lib/three/canvasTexture';
import { clamp01, fbm, makeNoise, smooth } from '../../../../lib/paint';
import { boxUV, rng } from '../../shire/build';
import { bone, C, facet, noise3, oneGeo, rod, spikeAt, TAU, tint, V3 } from './helpers';

// ── before the Black Gate ──

const GATE = { half: 30, height: 40, open: 1.2 };
const STONE = { base: C(0x4a4542), dark: C(0x221f1d), ash: C(0x8a8076), rust: C(0x5a3424), iron: C(0x77706a) };

// A peak of the Mountains of Shadow, `R` across at its foot and `H` high:
// a cone broken into facets and ridges, ash lying on its ledges.
function peakGeo(seed, R, H, detail = 2) {
  const r = rng(seed);
  const n = makeNoise(seed);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const planes = [];
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU;
    const b = 0.5 + r() * 0.9;
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.4 + r() * 0.35 });
  }
  const lean = [(r() - 0.5) * 0.3, (r() - 0.5) * 0.3];
  const flutes = 4 + Math.floor(r() * 4);
  const turn = r() * TAU;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (fbm(n, v.x * 1.7 + v.z + 3, v.y * 1.7 - v.z, { octaves: 3 }) - 0.5) * 0.5;
    v.multiplyScalar(k);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    const hf = clamp01((v.y + 1) / 2);
    const flute = 1 + 0.32 * Math.sin(Math.atan2(v.z, v.x) * flutes + turn) * Math.sin(hf * Math.PI);
    const taper = Math.pow(1 - hf, 0.9) * 1.15 * flute;
    v.set(v.x * R * taper + lean[0] * hf * H, Math.max(-0.15, hf - 0.15) * H, v.z * R * 0.8 * taper + lean[1] * hf * H);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = facet(g);
  tint(g, (x, y, z, out, nx, ny) => {
    out.copy(STONE.base).multiplyScalar(0.7 + noise3(n, x * 0.04, y * 0.04, z * 0.04) * 0.6);
    out.lerp(STONE.ash, smooth(0.35, 0.8, ny) * 0.6);
    out.lerp(STONE.rust, smooth(0.6, 0.75, noise3(n, x * 0.02 + 5, y * 0.03, z * 0.02)) * 0.4);
  });
  return g;
}

// One iron leaf of the Gate, 30 m wide and 40 high, hinged at x = 0 and
// running out along σx: a slab, wedge ribs up it, bands across, braces in
// a zigzag between, spikes out of the bands and a crown of them along the
// top. Its front faces +z.
function gateLeafGeo(sigma, seed) {
  const r = rng(seed);
  const { half: Wd, height: Ht } = GATE;
  const list = [];
  list.push(new THREE.BoxGeometry(Wd, Ht, 2).translate((sigma * Wd) / 2, Ht / 2, 0));
  const ribs = [2.5, 8.5, 14.5, 20.5, 26.5];
  for (const x of ribs) list.push(new THREE.CylinderGeometry(1.4, 1.4, Ht, 3).scale(0.8, 1, 1).translate(sigma * x, Ht / 2, 1.7));
  // the leading edge, where the two meet
  list.push(new THREE.BoxGeometry(1.4, Ht, 2.6).translate(sigma * (Wd - 0.7), Ht / 2, 0.3));
  const bands = [4, 13, 22, 31];
  for (const y of bands) list.push(new THREE.BoxGeometry(Wd, 1.7, 1).translate((sigma * Wd) / 2, y, 1.4));
  list.push(new THREE.BoxGeometry(Wd, 1.4, 1.2).translate((sigma * Wd) / 2, Ht - 0.7, 1.3));
  // braces, zigzagging up each bay
  for (let b = 0; b < ribs.length - 1; b++) {
    for (let k = 0; k < bands.length - 1; k++) {
      const x0 = sigma * (ribs[b] + 0.8);
      const x1 = sigma * (ribs[b + 1] - 0.8);
      const up = (b + k) % 2 === 0;
      list.push(rod([x0, bands[k] + (up ? 0.9 : 8.1), 1.3], [x1, bands[k] + (up ? 8.1 : 0.9), 1.3], 0.45, 0.45, 4));
    }
  }
  // spikes out of the bands, between the ribs
  for (const y of bands) {
    for (let b = 0; b < ribs.length - 1; b++) list.push(spikeAt(V3(sigma * (ribs[b] + ribs[b + 1]) * 0.5, y, 1.8), V3(0, 0.3, 1), 3.4, 0.55, 4));
  }
  // the crown of spikes along the top
  for (let i = 0; i < 10; i++) {
    const x = sigma * (1.5 + i * 3);
    const tall = i % 2 ? 3 + r() * 1.5 : 5 + r() * 1.5;
    list.push(spikeAt(V3(x, Ht - 0.2, 0.4), V3(sigma * (r() - 0.5) * 0.2, 1, 0.12), tall, 0.9, 4));
  }
  // rivet heads along the bands
  for (const y of bands) for (let i = 0; i < 14; i++) list.push(new THREE.ConeGeometry(0.32, 0.35, 4).rotateX(Math.PI / 2).translate(sigma * (1 + i * 2.1), y + 0.55, 1.98));
  const g = oneGeo(list.map((x) => facet(x)));
  boxUV(g, 0.12);
  const n = makeNoise(seed + 1);
  tint(g, (x, y, z, out) => {
    out.copy(STONE.iron).multiplyScalar(0.8 + noise3(n, x * 0.1, y * 0.1, z * 0.1) * 0.4);
    out.lerp(STONE.rust, (1 - smooth(0, 9, y)) * 0.4);
  });
  return g;
}

// The Morannon: the Black Gate of Mordor across its pass, two iron leaves
// each 30 m wide and 40 high in a wall 58 high, the Towers of the Teeth
// either side, 70 m and crowned with fangs, slits of fire in them; walls
// running off to bastions and into the jagged mountains either side. Its
// front faces +z, the leaves hinged at x = ±30 and swinging in (to −z):
// open(k) 0 shut, 1 open. Built to be seen from 100–200 m.
export function blackGate(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'blackGate';
  const n = makeNoise(907);
  const r = rng(907);
  const stone = [];
  const fire = [];
  const add = (geo) => stone.push(geo);
  const box = (w, h, d, x, y, z) => add(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  // a square tier from y0 to y1, `a` across at its foot and `b` at its head
  const tier = (a, b, y0, y1, x, z) => add(new THREE.CylinderGeometry((b * Math.SQRT2) / 2, (a * Math.SQRT2) / 2, y1 - y0, 4, 1).rotateY(Math.PI / 4).translate(x, (y0 + y1) / 2, z));
  const merlons = (x0, x1, y, z, d, step = 5) => {
    for (let x = x0 + step / 2; x < x1; x += step) {
      box(step * 0.55, 3.2, d, x, y + 1.6, z);
      if (Math.round((x - x0) / step) % 2 === 0) add(spikeAt(V3(x, y + 3.1, z), V3(0, 1, 0.08), 3.5, 0.8, 4));
    }
  };
  const slit = (x, y, z, h = 3.6, face = 'z') => fire.push(face === 'z' ? new THREE.BoxGeometry(0.7, h, 0.4).translate(x, y, z) : new THREE.BoxGeometry(0.4, h, 0.7).translate(x, y, z));

  // ── the wall the Gate stands in
  const TOP = 58;
  box(22, TOP + 10, 18, -41, TOP / 2 - 5, -4);
  box(22, TOP + 10, 18, 41, TOP / 2 - 5, -4);
  box(60, TOP - 47, 18, 0, (TOP + 47) / 2, -4);
  // the frame of the opening, wedged, and the cornice over it
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(2.4, 2.4, TOP + 10, 3).scale(1, 1, 1.2).translate(s * 31.6, TOP / 2 - 5, 5.4));
    add(new THREE.CylinderGeometry(1.8, 1.8, TOP + 6, 3).scale(1, 1, 1.2).translate(s * 46, TOP / 2 - 7, 5.4));
  }
  box(104, 2.6, 4, 0, 46, 6.2);
  box(104, 2, 3, 0, TOP - 1, 5.8);
  merlons(-52, 52, TOP, 2.5, 3);
  // teeth along the lintel, down and out over the leaves
  for (let i = 0; i < 12; i++) add(spikeAt(V3(-27.5 + i * 5, 46.5, 7.4), V3(0, -1, 0.7), 5 + (i % 2) * 1.5, 0.8, 4));
  slit(-41, 30, 5.1);
  slit(41, 30, 5.1);
  slit(-10, 52, 5.1, 2.6);
  slit(10, 52, 5.1, 2.6);
  slit(0, 52, 5.1, 2.6);

  // ── the Towers of the Teeth
  for (const s of [-1, 1]) {
    const x = s * 64;
    tier(24, 20, -12, 34, x, -2);
    box(22.5, 2, 22.5, x, 34.5, -2);
    tier(18, 15, 35, 57, x, -2);
    box(17, 1.8, 17, x, 57.5, -2);
    tier(13, 11, 58, 70, x, -2);
    // buttress fins at its corners
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(new THREE.CylinderGeometry(2.2, 2.2, 52, 3).rotateY(Math.atan2(cx, cz)).translate(x + cx * 11.5, 14, -2 + cz * 11.5));
      add(spikeAt(V3(x + cx * 11.5, 40, -2 + cz * 11.5), V3(cx * 0.3, 1, cz * 0.3), 6, 1.3, 4));
      add(spikeAt(V3(x + cx * 8, 58, -2 + cz * 8), V3(cx * 0.35, 1, cz * 0.35), 5, 1, 4));
    }
    // the teeth: a crown of fangs round its head
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3;
      const rr = 5.2;
      add(spikeAt(V3(x + Math.cos(a) * rr, 69.5, -2 + Math.sin(a) * rr), V3(Math.cos(a) * 0.28, 1, Math.sin(a) * 0.28), 7 + (i % 3) * 2.5 + r() * 2, 1.5, 4));
    }
    add(spikeAt(V3(x, 69.5, -2), V3(0, 1, 0), 15, 2.4, 4));
    // its windows, slits of fire
    for (const y of [12, 22, 42, 50]) for (const dx of [-5, 0, 5]) slit(x + dx, y, -2 + (y < 34 ? 10.6 : 8.2));
    for (const dx of [-3, 3]) slit(x + dx, 63, -2 + 6.2, 2.8);
    for (const y of [18, 44]) slit(x + s * (y < 34 ? 10.6 : 8.2), y, -2, 3.6, 'x');
  }

  // ── the walls running off to bastions, and into the mountains
  for (const s of [-1, 1]) {
    box(110, 42, 9, s * 130, 9, -4);
    merlons(s > 0 ? 76 : -184, s > 0 ? 184 : -76, 30, -4, 9, 6);
    for (const bx of [110, 150]) {
      tier(13, 11, -12, 42, s * bx, -2);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        add(spikeAt(V3(s * bx + Math.cos(a) * 4, 41.5, -2 + Math.sin(a) * 4), V3(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3), 5 + (i % 2) * 2, 1, 4));
      }
      slit(s * bx, 32, 4, 3);
    }
  }
  const stoneGeo = oneGeo(stone.map((x) => facet(x)));
  boxUV(stoneGeo, 0.08);
  tint(stoneGeo, (x, y, z, out, nx, ny) => {
    out.copy(STONE.base).multiplyScalar(0.72 + noise3(n, x * 0.06, y * 0.06, z * 0.06) * 0.56);
    out.lerp(STONE.dark, (1 - smooth(-6, 12, y)) * 0.5);
    if (ny > 0.6) out.lerp(STONE.ash, 0.5);
    out.lerp(STONE.rust, smooth(0.62, 0.75, noise3(n, x * 0.05 + 3, y * 0.08, z * 0.05)) * 0.3);
  });
  const wall = new THREE.Mesh(stoneGeo, mats.gateStone);
  wall.name = 'gateWall';
  g.add(wall);
  const glow = new THREE.Mesh(oneGeo(fire), mats.slit);
  glow.name = 'gateFires';
  g.add(glow);

  // ── the mountains either side, and the dark ground behind
  const peaks = [];
  const PEAKS = [
    [150, -40, 70, 120], [196, 10, 65, 165], [244, -60, 80, 210], [292, 14, 70, 150], [330, -110, 90, 240], [132, -130, 70, 150], [205, -170, 80, 200], [270, -230, 90, 260], [120, 40, 40, 70], [360, 40, 60, 120],
  ];
  for (const s of [-1, 1]) {
    PEAKS.forEach(([x, z, R, H], i) => {
      const px = s * (x + (r() - 0.5) * 20);
      const geo = peakGeo(500 + i * 7 + (s > 0 ? 3 : 0), R, H * (0.85 + r() * 0.3));
      geo.rotateY(r() * TAU).translate(px, -12, z);
      peaks.push(geo);
      // shoulders of lesser crags about it, so it reads as a range
      for (let k = 0; k < 2; k++) {
        const a = r() * TAU;
        const sub = peakGeo(700 + i * 11 + k + (s > 0 ? 5 : 0), R * (0.4 + r() * 0.25), H * (0.35 + r() * 0.3), 1);
        sub.rotateY(r() * TAU).translate(px + Math.cos(a) * R * 0.75, -12, z + Math.sin(a) * R * 0.6);
        peaks.push(sub);
      }
    });
  }
  const ground = new THREE.PlaneGeometry(260, 340, 1, 1).rotateX(-Math.PI / 2).translate(0, -0.5, -180);
  tint(ground, (x, y, z, out) => out.copy(STONE.dark).lerp(STONE.ash, 0.15));
  peaks.push(ground);
  const mountains = oneGeo(peaks);
  boxUV(mountains, 0.02);
  const hills = new THREE.Mesh(mountains, mats.mountain);
  hills.name = 'mountains';
  g.add(hills);

  // ── the leaves
  const leaves = [-1, 1].map((s) => {
    const hinge = bone(s < 0 ? 'leafL' : 'leafR', g, [s * GATE.half, 0, 0]);
    const m = new THREE.Mesh(gateLeafGeo(-s, 950 + s), mats.gateIron);
    m.name = 'gateLeaf';
    hinge.add(m);
    return hinge;
  });
  // the glow of Mordor through the gap as they part
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(64, 46), new THREE.MeshBasicMaterial({ map: K.tex.glow, color: hot(0xff6a28, 1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  haze.position.set(0, 20, -26);
  haze.scale.set(1.4, 1.2, 1);
  haze.name = 'mordorGlow';
  g.add(haze);
  const open = (k) => {
    const e = clamp01(k);
    const a = e * e * (3 - 2 * e) * GATE.open;
    leaves[0].rotation.y = a;
    leaves[1].rotation.y = -a;
    haze.material.opacity = e * 0.85;
    haze.visible = e > 0.001;
  };
  open(0);
  return { group: g, leaves, open };
}


// A boulder of the ash slope, about 2 m across: broken flat-faced rock,
// dark, ash lying grey on whatever faces up. One geometry.
export function ashRockGeo(seed = 1) {
  const r = rng(seed);
  const n = makeNoise(seed + 5);
  let g = new THREE.IcosahedronGeometry(1, 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const planes = [];
  for (let i = 0; i < 8; i++) {
    const a = r() * TAU;
    const b = Math.acos(r() * 1.6 - 0.6);
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.6 + r() * 0.25 });
  }
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.3 + v.z * 0.7 + 4, v.y * 1.3 - v.z * 0.4, { octaves: 3 }) - 0.5) * 0.6);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    v.set(v.x * 1.05, v.y * 0.72 + 0.32, v.z * 0.9);
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = facet(g);
  boxUV(g, 0.7);
  tint(g, (x, y, z, out, nx, ny) => {
    out.copy(STONE.base).multiplyScalar(1.1 + noise3(n, x * 2, y * 2, z * 2) * 0.6);
    out.lerp(STONE.ash, smooth(0.25, 0.7, ny) * 0.75);
    out.lerp(STONE.dark, (1 - smooth(-0.1, 0.4, y)) * 0.4);
  });
  g.computeBoundingSphere();
  return g;
}
