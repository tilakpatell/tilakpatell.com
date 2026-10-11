// The core worlds' props, built in code (props/index.js has what a builder
// returns): Naboo's Theed and its waterfalls, the Gungans' sacred place,
// their shield and their sub, the droid army; Coruscant's towers, the Jedi
// Temple, the Senate and the skylanes; Kamino's Tipoca City on its stilts
// over the storm; Geonosis's arena, its hive spires, the gunships and the
// walkers. Each is what a world places when there's no model of it (yet,
// catalog/core.js), and what there's no model of at all.

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rod, upright } from '../kitCore';
import { canvasTexture, loft, trap8, turned } from '../../../universe/trafficKit';
import { rng } from '../noise';
import { canopy } from './forest';
import { boltPath, strikeAt } from '../storm';

const { PI, cos, sin, abs } = Math;
const lit = (c, k = 2.5) => new THREE.Color(c).multiplyScalar(k);
const vary = (c, r, l = 0.08, h = 0) => new THREE.Color(c).offsetHSL((r() - 0.5) * h, 0, (r() - 0.5) * l);

// a lumpy ball, 1 across (a canopy, a bubble, a cloud of leaves)
function lump(seed, amp = 0.2, w = 12, h = 9) {
  const g = new THREE.SphereGeometry(0.5, w, h);
  const r = rng(seed);
  const bumps = Array.from({ length: 7 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), (r() - 0.35) * amp * 2.4]);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 2;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// a roof's prism: the ridge along x, w long, d across, h high
const prism = (w, d, h) =>
  new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]), { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(PI / 2);

// posts round a disc's rim you can't get past (a railing, or just the
// edge), leaving gaps: [angle (from +z toward +x), half-width (radians)]
function rim(x, z, r, gaps = [], step = 0.8) {
  const out = [];
  const n = Math.ceil((2 * PI * r) / step);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    if (gaps.some(([g, w]) => abs(Math.atan2(sin(a - g), cos(a - g))) < w)) continue;
    out.push({ circle: [x + sin(a) * r, z + cos(a) * r, 0.45] });
  }
  return out;
}
// and along a straight edge, from a to b
function rail(a, b, step = 0.8) {
  const out = [];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) out.push({ circle: [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 0.45] });
  return out;
}

// an arched window (or door), dark, in a wall facing (sin yaw, cos yaw)
function arch(parts, x, y, z, yaw, w, h, color = '#2c2a2c') {
  parts.push(part(box(w, h - w / 2, 0.5), { at: [x, y, z], rot: [0, yaw, 0], color, to: 'dark' }));
  parts.push(part(new THREE.CylinderGeometry(w / 2, w / 2, 0.5, 10, 1, false, 0, PI).rotateZ(PI / 2).rotateY(PI / 2), { at: [x, y + h - w / 2, z], rot: [0, yaw, 0], color, to: 'dark' }));
}

// a light-scrolling material for falling water, a holo sign, a shield…
function streakTexture(seed, { base = 0.25, n = 260 } = {}) {
  const r = rng(seed);
  return canvasTexture(128, (c, s) => {
    c.clearRect(0, 0, s, s);
    c.fillStyle = `rgba(255,255,255,${base})`;
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
      c.fillRect(r() * s, r() * s, 1 + r() * 3, 10 + r() * 50);
    }
  });
}

// Kamino's white, lit from within the storm: the painted parts of a built
// thing, given a glow of their own (one material, shared)
function whiten(k, object) {
  k.mats.kaminoWhite ??= k.own(Object.assign(k.mats.paint.clone(), { emissive: new THREE.Color('#5c6670'), emissiveIntensity: 0.7 }));
  object.traverse((o) => {
    if (o.isMesh && o.material === k.mats.paint) o.material = k.mats.kaminoWhite;
  });
  return object;
}

// ── Naboo ──

const STONE = '#dcc0a6';
const TRIM = '#c8aa8e';
const VERDIGRIS = '#5c9a82';
const COLUMN = '#f3ecdc';

// a Theed colonnade: columns along x from x0 to x1 at z, h tall, with the
// beam across their tops
function colonnade(parts, x0, x1, z, y, h, n, { yaw = 0, r = 0.6 } = {}) {
  const c = cos(yaw);
  const s = sin(yaw);
  const at = (x, yy, zz) => [x * c + zz * s, yy, -x * s + zz * c];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    parts.push(part(cyl(r, r * 0.85, h, 12), { at: at(x, y, z), color: COLUMN, to: 'stone' }));
    parts.push(part(box(r * 2.6, r * 0.8, r * 2.6), { at: at(x, y + h - 0.1, z), rot: [0, yaw, 0], color: TRIM, to: 'stone' }));
  }
  parts.push(part(box(abs(x1 - x0) + r * 3, h * 0.12, r * 3), { at: at((x0 + x1) / 2, y + h + r * 0.6, z), rot: [0, yaw, 0], color: TRIM, to: 'stone' }));
}
// a green dome on its drum, with a lantern and a finial
function theedDome(parts, x, y, z, r, { drum = r * 0.6, tall = 0.9 } = {}) {
  parts.push(part(cyl(r, r, drum, 28), { at: [x, y, z], color: STONE, to: 'stone' }));
  parts.push(part(ring(r * 1.04, r * 0.06, 28), { at: [x, y + drum, z], color: TRIM, to: 'stone' }));
  parts.push(part(dome(r * 1.02, r * tall, 28), { at: [x, y + drum, z], color: VERDIGRIS, to: 'paint' }));
  const top = y + drum + r * tall;
  parts.push(part(cyl(r * 0.16, r * 0.14, r * 0.3, 10), { at: [x, top - r * 0.05, z], color: STONE, to: 'stone' }));
  parts.push(part(dome(r * 0.19, r * 0.18, 10), { at: [x, top + r * 0.25, z], color: VERDIGRIS, to: 'paint' }));
  parts.push(part(cyl(r * 0.03, 0.02, r * 0.4, 6), { at: [x, top + r * 0.4, z], color: '#c9b46a', to: 'metal' }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    arch(parts, x + sin(a) * r * 0.99, y + drum * 0.2, z + cos(a) * r * 0.99, a, r * 0.16, drum * 0.6);
  }
}

// N-1 starfighter: a long yellow needle, chrome behind, its engines out on
// the wingtips and their spikes trailing; parked on three legs. 11 m.
function n1Parts(H = 1.25) {
  const YEL = '#ecc63a';
  const CHROME = '#e2e6ea';
  const parts = [];
  const fl = [1, 0.62, 1];
  parts.push(part(turned([[0.02, -5.6], [0.16, -4.4], [0.5, -3.5], [0.82, -1.8], [0.9, -0.6]], 18), { at: [0, H, 0], scale: fl, color: CHROME, to: 'metal' }));
  parts.push(part(turned([[0.9, -0.6], [0.92, 0.4], [0.78, 2.0], [0.45, 3.8], [0.05, 5.6]], 18), { at: [0, H, 0], scale: fl, color: YEL, to: 'paint' }));
  for (const x of [-2.75, 2.75]) {
    parts.push(part(turned([[0.02, -5.0], [0.1, -4.0], [0.3, -2.9], [0.42, -1.6], [0.44, 0.2]], 14), { at: [x, H + 0.05, -0.2], color: CHROME, to: 'metal' }));
    parts.push(part(turned([[0.44, 0.2], [0.44, 1.2], [0.3, 2.3], [0.06, 2.8]], 14), { at: [x, H + 0.05, -0.2], color: YEL, to: 'paint' }));
    parts.push(part(box(2.2, 0.16, 2.0), { at: [x / 2, H - 0.05, -0.9], rot: [0, x > 0 ? -0.18 : 0.18, 0], color: YEL, to: 'paint' }));
  }
  parts.push(part(new THREE.SphereGeometry(0.5, 14, 10), { at: [0, H + 0.42, 0.9], scale: [0.95, 0.75, 2.1], color: '#2a3440', to: 'glass' }));
  parts.push(part(new THREE.SphereGeometry(0.28, 12, 8, 0, PI * 2, 0, PI / 2), { at: [0, H + 0.42, -1.35], color: '#e8ecf0', to: 'paint' }));
  parts.push(part(ring(0.27, 0.05, 12), { at: [0, H + 0.5, -1.35], color: '#3a5ab8', to: 'paint' }));
  for (const [x, z] of [[0, 2.6], [-0.9, -1.8], [0.9, -1.8]]) {
    parts.push(rod([x, 0.1, z], [x * 0.8, H - 0.3, z * 0.95], 0.1, 0.12, { color: '#55585c', to: 'metal' }));
    parts.push(part(cyl(0.24, 0.24, 0.12, 10), { at: [x, 0, z], color: '#3a3c40', to: 'metal' }));
  }
  return parts;
}

// the towers' body: the kit's paint, with its windows lit in the shader
// (the kit's looks: windows.js or nodes/props.js), one material for every
// tower in the world
const towerMat = (k) => {
  if (!k.mats.tower) {
    k.mats.tower = k.own(k.mats.paint.clone());
    k.looks.litWindows(k.mats.tower, { seed: 11, density: 0.55, cell: [3, 4] });
  }
  return 'tower';
};

export const PROPS = {
  // A Theed building, 40 m: cream stone, colonnades, a green dome. A hall,
  // a tower or a rotunda.
  theed(k, { style } = {}) {
    const r = k.rand;
    const s = style ?? ['hall', 'tower', 'rotunda'][Math.floor(r() * 3)];
    const parts = [];
    const solids = [];
    if (s === 'hall') {
      const w = 30;
      const d = 22;
      const h = 16;
      parts.push(part(box(w + 2, 1.2, d + 2), { color: TRIM, to: 'stone' }));
      parts.push(part(box(w, h, d), { color: STONE, to: 'stone' }));
      parts.push(part(box(w + 1.4, 1.1, d + 1.4), { at: [0, h, 0], color: TRIM, to: 'stone' }));
      parts.push(part(box(w, 1.2, d), { at: [0, h + 1.1, 0], color: STONE, to: 'stone' }));
      for (const row of [2.5, 9.5]) for (let i = 0; i < 6; i++) for (const z of [-d / 2 - 0.05, d / 2 + 0.05]) arch(parts, -w / 2 + 3 + i * ((w - 6) / 5), row, z, 0, 1.8, 4.6);
      for (const row of [2.5, 9.5]) for (let i = 0; i < 4; i++) for (const x of [-w / 2 - 0.05, w / 2 + 0.05]) arch(parts, x, row, -d / 2 + 3.5 + i * ((d - 7) / 3), PI / 2, 1.8, 4.6);
      parts.push(part(box(w, 1.2, 6), { at: [0, 0, d / 2 + 3], color: TRIM, to: 'stone' }));
      colonnade(parts, -w / 2 + 1.5, w / 2 - 1.5, d / 2 + 4.6, 1.2, 10, 8);
      theedDome(parts, 0, h + 2.3, 0, 8);
      for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
        parts.push(part(cyl(2.4, 2.4, 4, 16), { at: [x, h, z], color: STONE, to: 'stone' }));
        parts.push(part(dome(2.5, 2.4, 16), { at: [x, h + 4, z], color: VERDIGRIS, to: 'paint' }));
      }
      solids.push({ box: [0, 2, w / 2 + 1, d / 2 + 4, 0] });
    } else if (s === 'tower') {
      parts.push(part(box(24, 12, 16), { color: STONE, to: 'stone' }));
      parts.push(part(box(25, 1, 17), { at: [0, 12, 0], color: TRIM, to: 'stone' }));
      parts.push(part(box(11, 30, 11), { at: [6, 0, 0], color: STONE, to: 'stone' }));
      parts.push(part(box(12, 1, 12), { at: [6, 30, 0], color: TRIM, to: 'stone' }));
      for (const y of [4, 13, 21]) for (const [x, z, a] of [[6, 5.55, 0], [6, -5.55, 0], [11.55, 0, PI / 2], [0.45, 0, PI / 2]]) arch(parts, x, y, z, a, 2.2, 5.5);
      for (let i = 0; i < 4; i++) for (const z of [-8.05, 8.05]) arch(parts, -10 + i * 3, 3, z, 0, 1.6, 5);
      theedDome(parts, 6, 31, 0, 5.2, { drum: 3, tall: 1.25 });
      colonnade(parts, -11, -1, 9.6, 0, 8, 5, { r: 0.45 });
      solids.push({ box: [0, 0.8, 12.5, 9.2, 0] });
    } else {
      parts.push(part(cyl(14, 14, 1.2, 36), { color: TRIM, to: 'stone' }));
      parts.push(part(cyl(10, 10, 14, 32), { at: [0, 1.2, 0], color: STONE, to: 'stone' }));
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2;
        parts.push(part(cyl(0.6, 0.5, 12, 10), { at: [sin(a) * 12.6, 1.2, cos(a) * 12.6], color: COLUMN, to: 'stone' }));
        if (i % 2 === 0) arch(parts, sin(a) * 10.05, 4, cos(a) * 10.05, a, 2, 6);
      }
      parts.push(part(cyl(13.6, 13.6, 1.4, 36), { at: [0, 13.2, 0], color: TRIM, to: 'stone' }));
      theedDome(parts, 0, 14.6, 0, 10.5, { drum: 4, tall: 0.85 });
      solids.push({ circle: [0, 0, 13.4] });
    }
    return { object: k.build(parts, { name: 'theed' }), solids };
  },

  // The Royal Palace of Theed: the great rotunda under its green dome, its
  // colonnaded wings, the towers at their ends, the steps down to the plaza
  theedpalace(k) {
    const parts = [];
    parts.push(part(box(132, 2.2, 54), { at: [0, 0, -4], color: TRIM, to: 'stone' }));
    // the rotunda
    parts.push(part(cyl(17, 17, 26, 40), { at: [0, 2.2, -6], color: STONE, to: 'stone' }));
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * PI * 2;
      if (cos(a) < -0.3) continue;
      parts.push(part(cyl(0.9, 0.8, 22, 12), { at: [sin(a) * 19, 2.2, -6 + cos(a) * 19], color: COLUMN, to: 'stone' }));
      arch(parts, sin(a) * 17.05, 8, -6 + cos(a) * 17.05, a, 2.4, 9);
    }
    parts.push(part(cyl(20.2, 20.2, 2.2, 40), { at: [0, 24.2, -6], color: TRIM, to: 'stone' }));
    theedDome(parts, 0, 26.4, -6, 15, { drum: 7, tall: 0.88 });
    // the wings, their colonnades, their roofs
    for (const sx of [-1, 1]) {
      const x = sx * 40;
      parts.push(part(box(46, 18, 26), { at: [x, 2.2, -10], color: STONE, to: 'stone' }));
      parts.push(part(box(47.5, 1.2, 27.5), { at: [x, 20.2, -10], color: TRIM, to: 'stone' }));
      parts.push(part(box(46, 1.4, 26), { at: [x, 21.4, -10], color: STONE, to: 'stone' }));
      for (const y of [5, 13]) for (let i = 0; i < 9; i++) arch(parts, x - 20 + i * 5, y, 3.05, 0, 2, 5.4);
      colonnade(parts, x - 21, x + 21, 7.5, 2.2, 13, 12, { r: 0.7 });
      parts.push(part(box(44, 1.2, 8), { at: [x, 2.2, 6], color: TRIM, to: 'stone' }));
      // the tower at the wing's end
      const tx = sx * 62;
      parts.push(part(box(14, 30, 14), { at: [tx, 2.2, -8], color: STONE, to: 'stone' }));
      for (const y of [8, 18]) for (const [dx, dz, a] of [[0, 7.05, 0], [sx * 7.05, 0, PI / 2]]) arch(parts, tx + dx, y, -8 + dz, a, 2.6, 6.5);
      parts.push(part(box(15, 1.2, 15), { at: [tx, 32.2, -8], color: TRIM, to: 'stone' }));
      theedDome(parts, tx, 33.4, -8, 6.2, { drum: 3, tall: 1.2 });
      // small domes along the wing's roof
      for (const dx of [-12, 12]) theedDome(parts, x + dx, 22.8, -10, 3.4, { drum: 2, tall: 1 });
    }
    // the steps down to the plaza
    for (let i = 0; i < 6; i++) parts.push(part(box(34 - i * 0.6, 0.38, 2.2), { at: [0, 1.85 - i * 0.37, 23.4 + i * 2.1], color: TRIM, to: 'stone' }));
    parts.push(part(box(38, 2.2, 12), { at: [0, 0, 16], color: TRIM, to: 'stone' }));
    // the great doors
    arch(parts, 0, 2.2, 11.2, 0, 7, 14, '#3a3024');
    return {
      object: k.build(parts, { name: 'theedpalace', shadows: true }),
      solids: [{ circle: [0, -6, 21] }, { box: [-40, -8, 24, 16, 0] }, { box: [40, -8, 24, 16, 0] }, { box: [-62, -8, 8, 8, 0] }, { box: [62, -8, 8, 8, 0] }, { box: [0, 16, 19, 6, 0] }, { box: [0, 34, 62, 12.5, 0] }, { box: [0, -36, 62, 11, 0] }],
    };
  },

  // A waterfall pouring off a ledge: a sheet of water arcing out and down
  // `h` metres (its top at y = 0, on the lip), spray where it lands
  waterfall(k, { h = 30, w = 12, out = 7 } = {}) {
    const tex = k.own(streakTexture(5, { base: 0.32 }));
    tex.repeat.set(Math.max(1, w / 8), Math.max(1, h / 12));
    const geo = k.own(new THREE.PlaneGeometry(w, 1, 6, 18));
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = 0.5 - p.getY(i);
      p.setXYZ(i, p.getX(i) * (1 + 0.35 * t), -h * t, out * Math.sqrt(t) + 0.4);
    }
    geo.computeVertexNormals();
    const mat = k.own(new THREE.MeshBasicMaterial({ map: tex, color: '#e4f4ff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    const sheet = new THREE.Mesh(geo, mat);
    const object = k.build([part(box(w + 3, 1.2, 2.4), { at: [0, -1.1, 0], color: TRIM, to: 'stone' }), part(box(w + 3, 0.5, 2.6), { at: [0, -1.3, 0.3], color: '#c8b896', to: 'stone' })], { name: 'waterfall' });
    object.add(sheet);
    // the spray at its foot
    const mist = [];
    const mistMat = k.own(new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.32, depthWrite: false }));
    const mistGeo = k.own(lump(9, 0.25, 10, 8));
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(mistGeo, mistMat);
      m.position.set((i - 1.5) * w * 0.28, -h + 1.5, out + 1.5);
      m.scale.set(w * 0.55, w * 0.32, w * 0.4);
      object.add(m);
      mist.push(m);
    }
    return {
      object,
      update(t) {
        tex.offset.y = (t * 0.9) % 1;
        mist.forEach((m, i) => {
          const f = 1 + 0.12 * sin(t * 2.3 + i * 1.7);
          m.scale.set(w * 0.55 * f, w * 0.32 * f, w * 0.4 * f);
        });
      },
    };
  },

  // an N-1 starfighter, parked
  n1fighter(k) {
    return { object: k.build(n1Parts(), { name: 'n1fighter' }), solids: [{ box: [0, -0.3, 3.4, 4.6, 0] }] };
  },

  // the Royal Starship: chrome, 76 m, its nose and tail drawn to points,
  // the engines out on its flanks; on its landing legs
  royalship(k) {
    const CHROME = '#e6eaee';
    const H = 4.2;
    const parts = [part(turned([[0.2, -38], [2.4, -33], [7.5, -24], [12.2, -10], [13.5, 2], [11.5, 15], [6.5, 27], [2, 34], [0.2, 38]], 32), { at: [0, H, 0], scale: [1, 0.3, 1], color: CHROME, to: 'metal' })];
    // the raised spine and the bridge's windows
    parts.push(part(turned([[0.2, -20], [3, -12], [4, 4], [2.6, 16], [0.2, 22]], 20), { at: [0, H + 2.2, 0], scale: [1, 0.35, 1], color: CHROME, to: 'metal' }));
    parts.push(part(box(3.4, 0.5, 2), { at: [0, H + 2.6, 18.5], rot: [-0.25, 0, 0], color: '#18202a', to: 'glass' }));
    for (const sx of [-1, 1]) {
      parts.push(part(turned([[0.2, -16], [1.2, -12], [2.6, -6], [2.9, 4], [2.2, 9], [0.4, 11]], 18), { at: [sx * 12.5, H + 0.6, -14], color: CHROME, to: 'metal' }));
      parts.push(part(new THREE.CylinderGeometry(1.9, 1.9, 0.2, 18), { at: [sx * 12.5, H + 0.6, -24], rot: [PI / 2, 0, 0], color: lit('#9ad8ff', 2), to: 'glow' }));
    }
    for (const [x, z] of [[-6, 16], [6, 16], [-8, -12], [8, -12], [0, 26]]) {
      parts.push(rod([x, 0, z], [x * 0.8, H - 0.4, z], 0.3, 0.4, { color: '#8a8e94', to: 'metal' }));
      parts.push(part(cyl(0.9, 0.9, 0.3, 12), { at: [x, 0, z], color: '#5a5e64', to: 'metal' }));
    }
    // the ramp, down
    parts.push(part(box(3, 0.3, 9), { at: [0, 1.6, -4], rot: [0.32, 0, 0], color: '#c8ccd2', to: 'metal' }));
    return { object: k.build(parts, { name: 'royalship' }), solids: [{ box: [0, 0, 10, 30, 0] }, { box: [0, -14, 15, 8, 0] }] };
  },

  // the Theed Hangar, on one side of the palace: stone outside, its great
  // door open, the floor polished, strip lights under the roof. Wookieepedia:
  // a heavy blast-proof door at its back to the city's plasma generator, a
  // blast-proof roof, and over the hangar the air traffic controllers' room
  // (its windows high on the back wall, a gallery in front of them)
  hangar(k, { w = 70, d = 48, h = 22 } = {}) {
    const parts = [];
    const ST = '#b98f7a'; // (this hangar's stone, warmer than the palace's)
    parts.push(part(box(w, h, 3), { at: [0, 0, -d / 2 + 1.5], color: ST, to: 'stone' }));
    for (const sx of [-1, 1]) {
      parts.push(part(box(3, h, d), { at: [sx * (w / 2 - 1.5), 0, 0], color: ST, to: 'stone' }));
      for (const y of [4, 13]) arch(parts, sx * (w / 2 + 0.05), y, -6, PI / 2, 2.4, 6);
    }
    // the front: one wall with a 34 m half-round mouth cut in it
    const front = new THREE.Shape();
    front.moveTo(-w / 2, 0);
    front.lineTo(-17, 0);
    front.lineTo(-17, 3);
    front.absarc(0, 3, 17, PI, 0, true);
    front.lineTo(17, 0);
    front.lineTo(w / 2, 0);
    front.lineTo(w / 2, h);
    front.lineTo(-w / 2, h);
    parts.push(part(new THREE.ExtrudeGeometry(front, { depth: 3.4, bevelEnabled: false }), { at: [0, 0, d / 2 - 3.4], color: ST, to: 'stone' }));
    // its hood: a segment of a ring round (0, -6), cut level at y 12, out
    // over paired columns
    const [ro, ri] = [31.5, 30.5];
    const [ao, ai] = [Math.asin(18 / ro), Math.asin(18 / ri)];
    const hood = new THREE.Shape();
    hood.absarc(0, -6, ro, ao, PI - ao, false);
    hood.lineTo(Math.cos(PI - ai) * ri, -6 + Math.sin(PI - ai) * ri);
    hood.absarc(0, -6, ri, PI - ai, ai, true);
    hood.closePath();
    parts.push(part(new THREE.ExtrudeGeometry(hood, { depth: 6, bevelEnabled: false, curveSegments: 32 }), { at: [0, 0, d / 2], color: ST, to: 'stone' }));
    const columns = [-24.5, -22.5, 22.5, 24.5];
    for (const x of columns) parts.push(part(cyl(0.9, 0.8, 12, 14), { at: [x, 0, d / 2 + 3], color: COLUMN, to: 'stone' }));
    parts.push(part(box(w + 2, 1.4, d + 2), { at: [0, h, 0], color: VERDIGRIS, to: 'paint' }));
    parts.push(part(box(w - 6, 0.12, d - 4), { at: [0, 0, 0], color: '#b8b2a4', to: 'tiles' }));
    for (let i = 0; i < 5; i++) parts.push(part(box(w - 10, 0.2, 0.5), { at: [0, h - 0.4, -d / 2 + 6 + i * 9], color: lit('#fff2d0', 2.2), to: 'glow' }));
    // its floor markings, and the bay doors' tracks
    for (const x of [-12, 12]) parts.push(part(box(0.5, 0.02, d - 6), { at: [x, 0.13, 0], color: '#e8c838', to: 'paint' }));
    // pilasters down the walls inside, green-capped
    for (let z = -d / 2 + 6; z < d / 2 - 6; z += 8)
      for (const sx of [-1, 1]) parts.push(part(box(1.2, h - 1, 0.9), { at: [sx * (w / 2 - 3.4), 0, z], color: COLUMN, to: 'stone' }), part(box(1.6, 0.8, 1.2), { at: [sx * (w / 2 - 3.4), h - 1.8, z], color: VERDIGRIS, to: 'paint' }));
    // the blast door to the generator, shut: grey plate in bands, in a deep frame
    const back = -d / 2 + 3;
    parts.push(part(box(14, 11, 0.8), { at: [0, 0, back + 0.4], color: '#5a5e62', to: 'metal' }));
    for (let i = 0; i < 6; i++) parts.push(part(box(13.4, 0.35, 0.2), { at: [0, 1 + i * 1.8, back + 0.9], color: '#44484c', to: 'metal' }));
    parts.push(part(box(0.25, 10.6, 0.25), { at: [0, 0, back + 0.95], color: '#2a2c2e', to: 'dark' }));
    for (const sx of [-1, 1]) parts.push(part(box(1.4, 12.2, 1.6), { at: [sx * 7.6, 0, back + 0.6], color: TRIM, to: 'stone' }));
    parts.push(part(box(16.6, 1.4, 1.6), { at: [0, 11.2, back + 0.6], color: TRIM, to: 'stone' }));
    // the controllers' room over it: a row of lit windows, the gallery
    parts.push(part(box(30, 0.5, 2.6), { at: [0, 13.6, back + 1.3], color: '#d8ccb0', to: 'stone' }), part(box(30, 1.1, 0.12), { at: [0, 14.1, back + 2.55], color: '#b8c2c8', to: 'metal' }));
    for (let i = 0; i < 6; i++) parts.push(part(box(3.6, 3.4, 0.12), { at: [-12.5 + i * 5, 15.4, back + 0.05], color: lit('#cfe6ff', 1.3), to: 'glow' }));
    return {
      object: k.build(parts, { name: 'hangar' }),
      solids: [
        { box: [0, -d / 2 + 1.5, w / 2, 1.5, 0] },
        { box: [-(w / 2 - 1.5), 0, 1.5, d / 2, 0] },
        { box: [w / 2 - 1.5, 0, 1.5, d / 2, 0] },
        { box: [-26, d / 2 - 1.7, 9, 1.7, 0] },
        { box: [26, d / 2 - 1.7, 9, 1.7, 0] },
        ...columns.map((x) => ({ circle: [x, d / 2 + 3, 1] })),
      ],
    };
  },

  // a paved plaza, cream flagstones in a grid, a fountain in its middle
  plaza(k, { w = 60, d = 40, fountain = true } = {}) {
    // (polished slabs, a metre each: the scan's own joints; a darker band
    // every 6 m, and a kerb round the edge)
    const parts = [part(box(w, 0.3, d), { color: '#d6c6b8', to: 'tiles' })];
    for (let x = -w / 2 + 6; x < w / 2 - 1; x += 6) parts.push(part(box(0.3, 0.02, d - 0.4), { at: [x, 0.3, 0], color: '#a89a8e', to: 'stone' }));
    for (let z = -d / 2 + 6; z < d / 2 - 1; z += 6) parts.push(part(box(w - 0.4, 0.02, 0.3), { at: [0, 0.3, z], color: '#a89a8e', to: 'stone' }));
    for (const sx of [-1, 1]) parts.push(part(box(0.8, 0.45, d), { at: [sx * (w / 2 - 0.4), 0, 0], color: '#cfc2a2', to: 'stone' }), part(box(w, 0.45, 0.8), { at: [0, 0, sx * (d / 2 - 0.4)], color: '#cfc2a2', to: 'stone' }));
    const solids = [];
    if (fountain) {
      parts.push(part(cyl(5, 5, 0.9, 32), { at: [0, 0.3, 0], color: '#cfc2a2', to: 'stone' }), part(cyl(4.4, 4.4, 0.92, 32), { at: [0, 0.3, 0], color: '#5e9aa4', to: 'glass' }));
      parts.push(part(cyl(0.6, 0.45, 3.4, 12), { at: [0, 0.3, 0], color: COLUMN, to: 'stone' }), part(dome(1.8, 0.7, 16), { at: [0, 3.2, 0], color: VERDIGRIS, to: 'paint' }));
      solids.push({ circle: [0, 0, 5], top: 1.2 });
    }
    return { object: k.build(parts, { name: 'plaza' }), floors: [{ x: 0, z: 0, hw: w / 2, hd: d / 2, yaw: 0, y: 0.3 }], solids };
  },

  // a Gungan cart of boomas: energy balls in a wicker basket, glowing blue
  boomas(k) {
    const r = rng(61);
    const parts = [part(cyl(1.1, 1.4, 1.1, 14, true), { color: '#8a6a3a', to: 'bark' }), part(ring(1.4, 0.08, 14), { at: [0, 1.1, 0], color: '#6a4a2a', to: 'bark' })];
    for (let i = 0; i < 9; i++) parts.push(part(new THREE.SphereGeometry(0.32, 10, 8), { at: [(r() - 0.5) * 1.4, 1.0 + r() * 0.4, (r() - 0.5) * 1.4], color: lit('#5ab4ff', 2.6), to: 'glow' }));
    for (const s of [-1, 1]) parts.push(part(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), { at: [s * 1.3, 0.5, 0], rot: [0, 0, PI / 2], color: '#5a4028', to: 'bark' }));
    return { object: k.build(parts, { name: 'boomas' }), solids: [{ circle: [0, 0, 1.4], top: 1.2 }] };
  },

  // a great stone head at the Gungans' sacred place, mossy, half sunk
  stonehead(k, { s = 1 } = {}) {
    const r = k.rand;
    const G = vary('#8e8c78', r, 0.1);
    const MOSS = '#5f7440';
    const DARK = '#24241c';
    const parts = [
      // the skull and the long face, the brow, the nose, the lips
      part(new THREE.SphereGeometry(3, 20, 16), { at: [0, 4.4, -0.4], scale: [1, 1.15, 1], color: G, to: 'stone' }),
      part(new THREE.SphereGeometry(2.4, 18, 14), { at: [0, 2.2, 0.8], scale: [1.05, 1.25, 1], color: G, to: 'stone' }),
      part(new THREE.CylinderGeometry(0.5, 0.5, 5.2, 10).rotateZ(PI / 2), { at: [0, 4.4, 2.35], scale: [1, 1, 0.9], color: G, to: 'stone' }),
      part(new THREE.ConeGeometry(0.75, 2.6, 4), { at: [0, 2.7, 3.05], rot: [-0.25, PI / 4, 0], color: G, to: 'stone' }),
      part(new THREE.CylinderGeometry(0.28, 0.28, 2.2, 8).rotateZ(PI / 2), { at: [0, 1.0, 3.05], color: G, to: 'stone' }),
      part(box(2.0, 0.16, 0.4), { at: [0, 0.85, 3.05], color: DARK, to: 'dark' }),
      // the crown band of carving round the brow
      part(new THREE.TorusGeometry(2.95, 0.32, 6, 24), { at: [0, 5.3, -0.4], rot: [PI / 2 + 0.15, 0, 0], color: '#7c7a66', to: 'stone' }),
      // moss over the top and down the back
      part(new THREE.SphereGeometry(3.08, 18, 10, 0, PI * 2, 0, PI * 0.32), { at: [0, 4.6, -0.5], scale: [1.01, 1.15, 1.01], color: MOSS, to: 'stone' }),
    ];
    for (const x of [-1.15, 1.15]) {
      parts.push(part(new THREE.SphereGeometry(0.62, 12, 8), { at: [x, 3.7, 2.35], scale: [1.2, 0.75, 0.5], color: DARK, to: 'dark' }));
      parts.push(part(new THREE.SphereGeometry(0.3, 8, 6), { at: [x, 3.7, 2.48], scale: [1, 0.8, 0.5], color: '#a8a690', to: 'stone' }));
    }
    // the long lobes down each side (a Gungan's ears), braided
    for (const x of [-1, 1]) {
      parts.push(part(new THREE.CapsuleGeometry(0.75, 5.5, 4, 10), { at: [x * 2.9, 1.0, -0.2], rot: [0.12, 0, x * 0.1], scale: [1, 1, 0.7], color: G, to: 'stone' }));
      for (let i = 0; i < 4; i++) parts.push(part(new THREE.TorusGeometry(0.78, 0.12, 5, 12), { at: [x * (2.9 - i * 0.03), 2.6 - i * 1.2, -0.2 + i * 0.12], rot: [PI / 2, 0, 0], scale: [1, 0.7, 1], color: i % 2 ? MOSS : '#7c7a66', to: 'stone' }));
    }
    const object = k.build(parts, { name: 'stonehead' });
    object.scale.setScalar(s);
    const holder = new THREE.Group();
    holder.add(object);
    return { object: holder, solids: [{ circle: [0, 0, 3.4 * s] }] };
  },

  // broken columns, a fallen one, an arch still standing, old steps
  ruins(k, { seed = 1 } = {}) {
    const r = rng(seed);
    const G = '#8a8a78';
    const MOSS = '#4c5a36';
    const parts = [];
    const solids = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2 + r();
      const d = 9 + r() * 6;
      const h = 2 + r() * 7;
      const [x, z] = [sin(a) * d, cos(a) * d];
      parts.push(part(cyl(0.9, 0.8, h, 12), { at: [x, 0, z], color: vary(G, r), to: 'stone' }));
      parts.push(part(cyl(0.95, 0.85, 0.6, 12), { at: [x, h * 0.55, z], color: MOSS, to: 'stone' }));
      if (r() < 0.5) parts.push(part(box(2.4, 0.7, 2.4), { at: [x, h, z], rot: [0, r(), 0.1], color: G, to: 'stone' }));
      solids.push({ circle: [x, z, 1] });
    }
    // the arch
    for (const x of [-3.2, 3.2]) parts.push(part(box(1.6, 9, 1.6), { at: [x, 0, -4], color: G, to: 'stone' }));
    parts.push(part(new THREE.TorusGeometry(3.2, 0.8, 8, 16, PI), { at: [0, 9, -4], color: G, to: 'stone' }));
    parts.push(part(box(9, 1.2, 2), { at: [0, 12.2, -4], color: MOSS, to: 'stone' }));
    solids.push({ circle: [-3.2, -4, 1.1] }, { circle: [3.2, -4, 1.1] });
    // a column fallen across, in pieces
    for (let i = 0; i < 3; i++) parts.push(part(cyl(0.85, 0.85, 3.2, 12), { at: [-8 + i * 3.4, 0.85, 6 + i * 0.4], rot: [0, 0, PI / 2 + (r() - 0.5) * 0.2], color: vary(G, r), to: 'stone' }));
    solids.push({ box: [-4.6, 6.4, 5, 0.9, 0], top: 1.7 });
    // a stepped ruin behind the arch, its tops mossy, a stair up its front
    let y = 0;
    for (const [w, d] of [
      [14, 10],
      [10, 7],
      [6, 4],
    ]) {
      parts.push(part(box(w, 2.2, d), { at: [0, y, -18], color: G, to: 'stone' }), part(box(w + 0.2, 0.25, d + 0.2), { at: [0, y + 2.1, -18], color: MOSS, to: 'stone' }));
      y += 2.2;
    }
    for (let i = 0; i < 18; i++) parts.push(part(box(2.4, (i + 1) * 0.37, 0.3), { at: [0, 0, -10.4 - i * 0.27], color: i % 3 ? G : MOSS, to: 'stone' }));
    solids.push({ box: [0, -18, 7, 5, 0] });
    return { object: k.build(parts, { name: 'ruins' }), solids };
  },

  // a grove of Naboo's forest trees: straight trunks, buttressed roots,
  // high broad canopies; `n` of them within `r`
  grove(k, { n = 12, r: R = 22, seed = 3 } = {}) {
    const r = rng(seed);
    const parts = [];
    const solids = [];
    for (let i = 0; i < n; i++) {
      const a = r() * PI * 2;
      const d = Math.sqrt(r()) * R;
      const x = sin(a) * d;
      const z = cos(a) * d;
      const h = 13 + r() * 10;
      const tr = 0.45 + r() * 0.35;
      parts.push(part(cyl(tr, tr * 0.6, h * 0.8, 9), { at: [x, -0.3, z], color: vary('#5e4a36', r, 0.1), to: 'bark' }));
      for (let j = 0; j < 4; j++) {
        const b = (j / 4) * PI * 2 + r();
        parts.push(rod([x + sin(b) * tr * 2.6, -0.2, z + cos(b) * tr * 2.6], [x, 2.4, z], 0.12, tr * 0.5, { color: '#56442f', to: 'bark' }));
      }
      for (let j = 0; j < 3; j++) {
        const b = r() * PI * 2;
        parts.push(rod([x, h * 0.55, z], [x + sin(b) * 3.5, h * 0.82, z + cos(b) * 3.5], tr * 0.35, 0.08, { color: '#56442f', to: 'bark' }));
      }
      // (the crown: rounded lobes of leaf cards, a holm oak's, the dark
      // olive green of the Naboo woods as filmed)
      const lobes = 4 + Math.floor(r() * 3);
      for (let j = 0; j < lobes; j++) {
        const b = r() * PI * 2;
        const o = j ? 2.2 + r() * 2.5 : 0;
        const s = 5.5 + r() * 3.5;
        parts.push(...canopy([x + sin(b) * o, h * (0.72 + r() * 0.2), z + cos(b) * o], s, { flat: 0.72, color: vary(['#4c6236', '#566e3c', '#46592f'][j % 3], r, 0.06, 0.02), seed: seed * 101 + i * 7 + j, density: 0.8 }));
      }
      solids.push({ circle: [x, z, tr + 0.2] });
    }
    return { object: k.build(parts, { name: 'grove' }), solids };
  },

  // the Gungan Grand Army's shield: a shimmering dome, thrown up from the
  // generator on a fambaa's back in the middle of it
  shield(k, { r: R = 64 } = {}) {
    const mat = k.own(k.looks.shield());
    const { uniforms } = mat;
    const bubble = new THREE.Mesh(k.own(new THREE.SphereGeometry(R, 56, 22, 0, PI * 2, 0, PI / 2)), mat);
    bubble.renderOrder = 4;
    // the fambaa, and the generator on its back
    const SKIN = '#6c7f84';
    const BELLY = '#a99a7a';
    const parts = [
      part(new THREE.SphereGeometry(1, 20, 14), { at: [0, 4.2, 0], scale: [3.6, 2.7, 6.2], color: SKIN, to: 'leaf' }),
      part(new THREE.SphereGeometry(1, 16, 10), { at: [0, 3.2, 0.3], scale: [3.2, 1.8, 5.4], color: BELLY, to: 'leaf' }),
      part(new THREE.CapsuleGeometry(1.1, 4, 4, 10), { at: [0, 5.4, 7.5], rot: [1.1, 0, 0], color: SKIN, to: 'leaf' }),
      part(new THREE.SphereGeometry(1.3, 14, 10), { at: [0, 6.6, 9.8], scale: [1, 0.8, 1.5], color: SKIN, to: 'leaf' }),
      part(new THREE.CapsuleGeometry(0.9, 6, 4, 10), { at: [0, 3.4, -8.5], rot: [-1.25, 0, 0], color: SKIN, to: 'leaf' }),
    ];
    for (const [x, z] of [[-2.6, 3.4], [2.6, 3.4], [-2.6, -3.4], [2.6, -3.4]]) parts.push(part(cyl(0.95, 0.8, 3.4, 12), { at: [x, 0, z], color: SKIN, to: 'leaf' }));
    // the generator: a saddle, a mast, a ring of fins, the glowing bulb
    parts.push(part(box(4, 1, 6), { at: [0, 6.8, -0.5], color: '#7a5a3a', to: 'bark' }));
    parts.push(part(cyl(0.7, 0.45, 8, 12), { at: [0, 7.6, -0.5], color: '#8a7050', to: 'bark' }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      parts.push(rod([0, 9.5, -0.5], [sin(a) * 3.2, 13.5, -0.5 + cos(a) * 3.2], 0.2, 0.1, { color: '#a07a50', to: 'bark' }));
      parts.push(part(new THREE.SphereGeometry(0.45, 10, 8), { at: [sin(a) * 3.2, 13.6, -0.5 + cos(a) * 3.2], color: lit('#ffb070', 2.4), to: 'glow' }));
    }
    parts.push(part(new THREE.SphereGeometry(1.1, 16, 12), { at: [0, 16.2, -0.5], scale: [1, 1.3, 1], color: lit('#ff9ad0', 2.2), to: 'glow' }));
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * PI * 2;
      parts.push(part(new THREE.SphereGeometry(0.5, 6, 4), { at: [sin(a) * R, 0.2, cos(a) * R], scale: [2.6, 0.5, 2.6], color: lit('#8ad0ff', 2.2), to: 'glow' }));
    }
    const object = k.build(parts, { name: 'shield' });
    object.add(bubble);
    return {
      object,
      solids: [{ circle: [0, 0, 4] }, { circle: [0, 7, 1.6] }],
      update(t) {
        uniforms.uTime.value = t;
      },
    };
  },

  // a Multi-Troop Transport: the droid army's carrier, its bulbous nose
  // (its doors) to the front, hovering, 31 m
  mtt(k) {
    const TAN = '#a98d62';
    const DARK = '#6a5638';
    const H = 1.6;
    const hull = loft([
      { z: -15, pts: trap8(9, 7, 9, 1.4, H + 6) },
      { z: -12, pts: trap8(11.5, 9, 11.5, 1.8, H + 6.4) },
      { z: 6, pts: trap8(12, 9.5, 12.2, 1.8, H + 6.6) },
      { z: 10, pts: trap8(10.5, 8, 11.5, 1.6, H + 6.3) },
    ]);
    const parts = [part(hull, { color: TAN, to: 'paint' })];
    // the nose: a great bulb, split down the middle (its doors), the eyes
    parts.push(part(new THREE.SphereGeometry(1, 24, 16), { at: [0, H + 6, 11], scale: [5.4, 5.6, 5.4], color: TAN, to: 'paint' }));
    parts.push(part(box(0.3, 9.5, 2), { at: [0, H + 1.4, 16.1], color: DARK, to: 'metal' }));
    for (const x of [-3.2, 3.2]) parts.push(part(new THREE.SphereGeometry(0.75, 12, 8), { at: [x, H + 9.2, 14.1], scale: [1, 0.7, 0.6], color: lit('#ffcf6a', 1.6), to: 'glow' }));
    // the ridge along its back, vents, repulsor pods
    parts.push(part(box(3, 1.4, 22), { at: [0, H + 12.6, -3], color: DARK, to: 'metal' }));
    for (let i = 0; i < 6; i++) for (const x of [-6.1, 6.1]) parts.push(part(box(0.3, 3, 1.4), { at: [x, H + 4, -11 + i * 3.6], color: DARK, to: 'metal' }));
    for (const x of [-3.5, 3.5]) for (const z of [-9, 4]) parts.push(part(cyl(1.6, 1.2, 1.2, 14), { at: [x, H - 1.2, z], color: '#3a3226', to: 'metal' }));
    return { object: k.build(parts, { name: 'mtt' }), solids: [{ box: [0, 0, 6.2, 15, 0] }, { circle: [0, 12, 5.4] }] };
  },

  // an Armored Assault Tank: a hover tank, its prow forward, the turret
  // and its long gun on top, the cannon pods either side; 9.75 m
  aat(k) {
    const TAN = '#bba37a';
    const STRIPE = '#7a3a2a';
    const H = 1.1;
    const hull = loft([
      { z: -4.4, pts: trap8(4.6, 3.6, 2.2, 0.4, H + 1.1) },
      { z: 1.4, pts: trap8(4.8, 3.4, 2.2, 0.4, H + 1.1) },
      { z: 4.9, pts: trap8(2.2, 1.2, 1.0, 0.2, H + 0.7) },
    ]);
    const parts = [part(hull, { color: TAN, to: 'paint' })];
    parts.push(part(box(4.9, 0.25, 0.6), { at: [0, H + 1.6, 0.4], color: STRIPE, to: 'paint' }));
    parts.push(part(box(3.2, 1.0, 3.2), { at: [0, H + 2.2, -1.6], color: TAN, to: 'paint' }));
    parts.push(part(new THREE.CylinderGeometry(0.14, 0.18, 5.6, 8), { at: [0, H + 2.8, 2.6], rot: [PI / 2, 0, 0], color: '#5a4a36', to: 'metal' }));
    for (const x of [-2.3, 2.3]) {
      parts.push(part(new THREE.CylinderGeometry(0.45, 0.5, 3.6, 10), { at: [x, H + 0.9, 2.2], rot: [PI / 2, 0, 0], color: TAN, to: 'paint' }));
      parts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), { at: [x, H + 0.9, 4.6], rot: [PI / 2, 0, 0], color: '#3a3226', to: 'metal' }));
    }
    for (const x of [-1.4, 1.4]) parts.push(part(box(0.6, 0.6, 0.15), { at: [x, H + 1.2, 4.0], color: lit('#ffb84a', 1.5), to: 'glow' }));
    parts.push(part(box(3.8, 0.4, 7), { at: [0, H - 0.4, -0.6], color: '#4a3e2e', to: 'metal' }));
    return { object: k.build(parts, { name: 'aat' }), solids: [{ box: [0, 0, 2.6, 4.6, 0] }] };
  },

  // a droideka, deployed: bronze, three-legged, its arms' twin blasters
  // forward, its shield up (or not); 1.8 m
  droideka(k, { shield = false } = {}) {
    const BRONZE = '#8a6a46';
    const DARK = '#3a3028';
    const parts = [
      part(new THREE.SphereGeometry(0.22, 14, 10), { at: [0, 1.45, 0.22], scale: [1.1, 0.8, 1.6], color: BRONZE, to: 'metal' }),
      part(new THREE.TorusGeometry(0.5, 0.15, 8, 16, PI * 1.05), { at: [0, 0.95, -0.12], rot: [0, PI / 2, PI / 2 + 0.2], color: BRONZE, to: 'metal' }),
      part(new THREE.SphereGeometry(0.2, 12, 8), { at: [0, 1.05, 0.05], scale: [1.4, 1, 1.4], color: DARK, to: 'metal' }),
    ];
    for (const x of [-0.06, 0.06]) parts.push(part(new THREE.SphereGeometry(0.035, 8, 6), { at: [x, 1.47, 0.55], color: lit('#ff5a3a', 2), to: 'glow' }));
    for (const s of [-1, 1]) {
      parts.push(rod([s * 0.2, 1.12, 0.1], [s * 0.34, 0.98, 0.45], 0.04, 0.04, { color: DARK, to: 'metal' }));
      for (const y of [0.93, 1.03]) parts.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), { at: [s * 0.36, y, 0.62], rot: [PI / 2, 0, 0], color: DARK, to: 'metal' }));
      parts.push(rod([s * 0.18, 0.95, 0.08], [s * 0.36, 0.55, 0.3], 0.05, 0.04, { color: BRONZE, to: 'metal' }));
      parts.push(rod([s * 0.36, 0.55, 0.3], [s * 0.42, 0, 0.42], 0.04, 0.03, { color: BRONZE, to: 'metal' }));
    }
    parts.push(rod([0, 0.6, -0.55], [0, 0, -0.75], 0.05, 0.04, { color: BRONZE, to: 'metal' }));
    const object = k.build(parts, { name: 'droideka' });
    if (shield) {
      const m = new THREE.Mesh(k.own(new THREE.SphereGeometry(1.05, 20, 14)), k.own(new THREE.MeshBasicMaterial({ color: '#4a9aff', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })));
      m.position.y = 0.85;
      object.add(m);
    }
    return { object, solids: [{ circle: [0, 0, 0.6] }] };
  },

  // a Gungan bongo: an orange-red sub, its bubble cockpits at the front,
  // the three fins at its tail turning; 15 m (floating, its belly under)
  bongo(k) {
    const BODY = '#c8693e';
    const LIGHT = '#e8a874';
    const parts = [
      part(turned([[0.2, -6.5], [1.2, -5], [2.2, -1.5], [2.5, 2], [2.1, 4.6], [1.0, 6.2], [0.2, 6.8]], 24), { scale: [1.5, 0.65, 1], color: BODY, to: 'leaf' }),
      part(new THREE.SphereGeometry(1, 20, 12), { at: [0, 0.8, 1.6], scale: [3, 1.0, 4.2], color: LIGHT, to: 'leaf' }),
    ];
    for (const [x, s] of [[0, 1.35], [-2.3, 0.95], [2.3, 0.95]]) parts.push(part(new THREE.SphereGeometry(s, 16, 12), { at: [x, 1.0, 5.0 - abs(x) * 0.6], color: '#cfeaff', to: 'glass' }));
    // the side fins
    for (const sx of [-1, 1]) parts.push(part(new THREE.SphereGeometry(1, 14, 8), { at: [sx * 4.3, -0.1, -0.5], rot: [0, sx * 0.4, sx * 0.2], scale: [2.4, 0.18, 1.4], color: BODY, to: 'leaf' }));
    const object = k.build(parts, { name: 'bongo' });
    const tail = k.build(
      Array.from({ length: 3 }, (_, i) => part(new THREE.SphereGeometry(1, 12, 8), { at: [sin((i / 3) * PI * 2) * 1.3, cos((i / 3) * PI * 2) * 1.3, -2.2], rot: [0, 0, -(i / 3) * PI * 2], scale: [0.6, 1.6, 2.8], color: i === 0 ? LIGHT : BODY, to: 'leaf' })),
      { name: 'bongo-tail' },
    );
    tail.position.z = -6.3;
    object.add(tail);
    const holder = new THREE.Group();
    holder.add(object);
    return {
      object: holder,
      solids: [{ box: [0, 0, 3, 7, 0] }],
      update(t, dt) {
        tail.rotation.z += (dt ?? 0) * 1.4;
        object.position.y = sin(t * 0.8) * 0.12;
        object.rotation.z = sin(t * 0.6) * 0.03;
      },
    };
  },

  // the tops of Otoh Gunga's bubbles, glowing up through the lake
  otohgunga(k) {
    const r = rng(17);
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2 + r();
      const d = i ? 14 + r() * 26 : 0;
      const s = i ? 7 + r() * 8 : 16;
      const at = [sin(a) * d, -s * (0.25 + r() * 0.3), cos(a) * d];
      parts.push(part(new THREE.SphereGeometry(s, 24, 16), { at, color: '#bfe2dc', to: 'glass' }));
      parts.push(part(new THREE.SphereGeometry(s * 0.82, 18, 12), { at, color: i % 3 ? lit('#ffb060', 1.4) : lit('#ff8a50', 1.4), to: 'glow' }));
      // its frame: four ribs over it, a dark finial on top
      for (let j = 0; j < 4; j++) parts.push(part(new THREE.TorusGeometry(s * 1.01, s * 0.02, 4, 24), { at, rot: [0, (j * PI) / 4, 0], color: '#4a3a2a', to: 'metal' }));
      parts.push(part(new THREE.ConeGeometry(s * 0.06, s * 0.2, 8).translate(0, s * 0.1, 0), { at: [at[0], at[1] + s, at[2]], color: '#2e241a', to: 'metal' }));
      // a hub's ring of lights round it, at the water
      parts.push(part(ring(s * 0.86, 0.25, 24), { at: [at[0], 0.1, at[2]], color: lit('#fff4c8', 2), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'otohgunga', shadows: false }) };
  },

  // the lake retreat at Varykino: cream walls and terracotta roofs over a
  // terrace on the water, a round tower, steps down to a boat dock
  varykino(k) {
    const WALL = '#ead7b2';
    const ROOF = '#b5583a';
    const parts = [];
    const house = (x, z, w, d, h, yaw = 0) => {
      parts.push(part(box(w, h, d), { at: [x, 0, z], rot: [0, yaw, 0], color: WALL, to: 'adobe' }));
      parts.push(part(prism(w + 1.2, d + 1.4, d * 0.32), { at: [x, h, z], rot: [0, yaw, 0], color: ROOF, to: 'paint' }));
      for (let i = 0; i < Math.floor(w / 3.2); i++) {
        const ox = -w / 2 + 1.8 + i * 3.2;
        for (const y of [1, h * 0.55]) arch(parts, x + ox * cos(yaw), y, z + d / 2 + 0.05 - ox * sin(yaw), yaw, 1.2, h * 0.32, '#3a3a40');
      }
    };
    parts.push(part(box(46, 2.6, 28), { at: [0, -2.4, -2], color: '#c9b693', to: 'stone' }));
    house(-6, -6, 20, 11, 9);
    house(12, -10, 12, 9, 7, -0.3);
    house(-20, 2, 8, 8, 6, 0.4);
    // the tower
    parts.push(part(cyl(3.4, 3.4, 16, 20), { at: [12, 0, 2], color: WALL, to: 'adobe' }));
    parts.push(part(new THREE.ConeGeometry(4.3, 4.2, 20).translate(0, 2.1, 0), { at: [12, 16, 2], color: ROOF, to: 'paint' }));
    for (const y of [5, 11]) arch(parts, 12, y, 5.45, 0, 1.3, 2.6, '#3a3a40');
    // the terrace over the water: columns, the balustrade, the loggia's roof
    parts.push(part(box(20, 0.5, 9), { at: [-4, 0, 6], color: '#d8c8a6', to: 'stone' }));
    for (let i = 0; i < 6; i++) parts.push(part(cyl(0.3, 0.3, 4.4, 10), { at: [-13 + i * 3.6, 0.5, 9.8], color: COLUMN, to: 'stone' }));
    parts.push(part(prism(21, 4.4, 1.2), { at: [-4, 4.9, 8.6], color: ROOF, to: 'paint' }));
    parts.push(part(box(20, 1, 0.3), { at: [-4, 0.5, 10.4], color: '#d8c8a6', to: 'stone' }));
    // steps down to the dock, the dock, a boat
    for (let i = 0; i < 8; i++) parts.push(part(box(4, 0.4, 1.2), { at: [16, -0.4 - i * 0.4, 6 + i * 1.2], color: '#cdbb98', to: 'stone' }));
    parts.push(part(box(5, 0.4, 12), { at: [16, -3.8, 20], color: '#7a5a3c', to: 'bark' }));
    parts.push(part(new THREE.SphereGeometry(1, 14, 8), { at: [20, -3.6, 22], scale: [1.2, 0.5, 3.4], color: '#e8e0cc', to: 'paint' }));
    // flowers along the terrace's edge
    for (let i = 0; i < 10; i++) parts.push(part(new THREE.SphereGeometry(0.7, 8, 6), { at: [-13 + i * 2, 1.4, 10.2], scale: [1, 0.6, 0.7], color: i % 2 ? '#d86a8a' : '#f2c84a', to: 'leaf' }));
    return {
      object: k.build(parts, { name: 'varykino' }),
      solids: [{ box: [-6, -6, 10.5, 6, 0] }, { box: [12, -10, 6.5, 5, -0.3] }, { box: [-20, 2, 4.5, 4.5, 0.4] }, { circle: [12, 2, 3.6] }, ...rail([-14, 10.4], [6, 10.4])],
    };
  },

  // a shaak, grazing on the plains: round, mottled, on little legs
  shaak(k) {
    const r = k.rand;
    const FUR = vary('#b59c78', r, 0.1);
    const parts = [
      part(new THREE.SphereGeometry(1, 18, 12), { at: [0, 1.25, 0], scale: [0.95, 0.85, 1.25], color: FUR, to: 'leaf' }),
      part(new THREE.SphereGeometry(0.5, 12, 8), { at: [0, 1.55, -0.2], scale: [1.6, 1.0, 1.9], color: '#e6dcc4', to: 'leaf' }),
      part(new THREE.SphereGeometry(0.32, 12, 8), { at: [0, 1.05, 1.25], scale: [1, 0.9, 1.3], color: '#6a5440', to: 'leaf' }),
    ];
    for (const x of [-0.12, 0.12]) parts.push(part(new THREE.SphereGeometry(0.05, 6, 4), { at: [x, 1.15, 1.6], color: '#141210', to: 'dark' }));
    for (const [x, z] of [[-0.45, 0.6], [0.45, 0.6], [-0.45, -0.6], [0.45, -0.6]]) parts.push(part(cyl(0.12, 0.1, 0.55, 8), { at: [x, 0, z], color: '#5a4836', to: 'leaf' }));
    const body = k.build(parts, { name: 'shaak' });
    const object = new THREE.Group();
    object.add(body);
    let ph = r() * 10;
    return {
      object,
      update(t, dt, move = 0) {
        ph += (dt ?? 0) * (2 + move * 9);
        body.rotation.z = sin(ph) * 0.07 * move;
        body.position.y = abs(sin(ph)) * 0.08 * move;
        body.rotation.x = move < 0.05 ? 0.18 + sin(t * 0.7) * 0.05 : 0;
      },
    };
  },

  // ── Coruscant ──

  // a Coruscant tower, ~200 m: stepped, round, a slab or an octagon, its
  // windows lit in bands, a beacon on top
  skyscraper(k, { style = 0, h = 200, w = 24, seed = 1 } = {}) {
    const r = rng(seed + style * 31);
    const BODY = ['#8c8780', '#a09a8e', '#77767a', '#938a7e'][style % 4];
    const TOWER = towerMat(k);
    const parts = [];
    const windows = (cx, cz, ww, dd, y0, y1, every = 7) => {
      for (let y = y0 + 4; y < y1 - 2; y += every) {
        if (r() < 0.2) continue;
        const c = r() < 0.75 ? lit('#ffd49a', 1.5 + r()) : lit('#9ad4ff', 1.4 + r());
        parts.push(part(new THREE.BoxGeometry(ww * (0.6 + r() * 0.35), 1.1, dd + 0.3), { at: [cx, y, cz], color: c, to: 'glow' }));
        parts.push(part(new THREE.BoxGeometry(ww + 0.3, 1.1, dd * (0.6 + r() * 0.35)), { at: [cx, y + every / 2, cz], color: c, to: 'glow' }));
      }
    };
    let top;
    if (style === 0) {
      const tiers = [[w, h * 0.55], [w * 0.74, h * 0.28], [w * 0.5, h * 0.17]];
      let y = 0;
      for (const [tw, th] of tiers) {
        parts.push(part(box(tw, th, tw), { at: [0, y, 0], color: BODY, to: TOWER }));
        parts.push(part(box(tw + 1.2, 1.2, tw + 1.2), { at: [0, y + th - 1.2, 0], color: '#5a5650', to: 'metal' }));
        windows(0, 0, tw, tw, y, y + th);
        y += th;
      }
      top = y;
      parts.push(part(cyl(1.2, 0.2, 24, 8), { at: [0, top, 0], color: '#6a6660', to: 'metal' }));
      top += 24;
    } else if (style === 1) {
      parts.push(part(cyl(w * 0.5, w * 0.42, h * 0.9, 20), { color: BODY, to: TOWER }));
      for (let y = 10; y < h * 0.9; y += 9) parts.push(part(cyl(w * 0.5 + 0.4, w * 0.5 + 0.4, 1.2, 20), { at: [0, y, 0], color: r() < 0.7 ? lit('#ffd49a', 1.6 + r()) : '#5a5650', to: r() < 0.7 ? 'glow' : 'metal' }));
      parts.push(part(cyl(w * 0.42, w * 0.95, h * 0.06, 24), { at: [0, h * 0.9, 0], color: BODY, to: TOWER }));
      parts.push(part(cyl(w * 0.95, w * 0.8, h * 0.04, 24), { at: [0, h * 0.96, 0], color: '#6a6660', to: 'metal' }));
      top = h;
    } else if (style === 2) {
      // (a deeper slab, its side window bands showing past the pilasters)
      parts.push(part(box(w * 1.3, h, w * 0.8), { color: BODY, to: TOWER }));
      parts.push(part(box(w * 0.5, h * 0.12, w * 0.8), { at: [w * 0.4, h, 0], rot: [0, 0, 0.5], color: BODY, to: TOWER }));
      windows(0, 0, w * 1.3, w * 0.8, 0, h, 6);
      for (const x of [-w * 0.66, w * 0.66]) parts.push(part(box(1.2, h, w * 0.3), { at: [x, 0, 0], color: '#5a5650', to: 'metal' }));
      top = h + h * 0.06;
    } else {
      parts.push(part(cyl(w * 0.62, w * 0.42, h * 0.85, 8), { color: BODY, to: TOWER }));
      windows(0, 0, w * 0.75, w * 0.75, 0, h * 0.85, 8);
      parts.push(part(cyl(w * 0.42, w * 0.6, h * 0.05, 8), { at: [0, h * 0.85, 0], color: '#6a6660', to: 'metal' }));
      parts.push(part(cyl(w * 0.5, w * 0.08, h * 0.15, 8), { at: [0, h * 0.9, 0], color: BODY, to: TOWER }));
      top = h * 1.05;
    }
    const object = k.build(parts, { name: 'skyscraper', shadows: false });
    // (the warning light at the top, blinking)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a2a').multiplyScalar(3), toneMapped: false }));
    beacon.position.y = top + 1;
    object.add(beacon);
    const phase = r() * 6;
    return { object, solids: [{ circle: [0, 0, w * 0.55] }], update: (t) => (beacon.visible = sin(t * 5.2 + phase) > 0.2) };
  },

  // the column of city under a platform or a plaza, `depth` down into the
  // haze, lit windows down it
  plinth(k, { w = 60, d = 60, depth = 330, round = false } = {}) {
    const r = rng(Math.round(w * 7 + d));
    const parts = [round ? part(cyl(w * 0.5, w * 0.5, depth, 28), { at: [0, -depth, 0], color: '#7e7870', to: 'paint' }) : part(box(w, depth, d), { at: [0, -depth, 0], color: '#7e7870', to: 'paint' })];
    for (let y = -depth + 6; y < -4; y += 7) {
      if (r() < 0.25) continue;
      const c = lit(r() < 0.8 ? '#ffd49a' : '#9ad4ff', 1.4 + r());
      if (round) parts.push(part(cyl(w * 0.5 + 0.25, w * 0.5 + 0.25, 1.1, 28), { at: [0, y, 0], color: c, to: 'glow' }));
      else parts.push(part(new THREE.BoxGeometry(w + 0.4, 1.1, d + 0.4), { at: [0, y, 0], color: c, to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'plinth', shadows: false }) };
  },

  // a landing platform on top of its tower: a disc of plating, its lights
  // round the rim, the markings; the tower down into the haze below
  cplatform(k, { r: R = 28, depth = 330, light = '#8fd0ff', color = '#9a968e' } = {}) {
    const parts = [
      part(cyl(R, R, 0.6, 48), { at: [0, -0.3, 0], color, to: 'paint' }),
      part(cyl(R * 0.94, R * 0.94, 0.62, 48), { at: [0, -0.3, 0], color: '#7c7a76', to: 'paint' }),
      part(cyl(R * 0.45, R, 10, 48), { at: [0, -10.3, 0], color: '#6c6862', to: 'paint' }),
      part(cyl(R * 0.45, R * 0.45, depth, 28), { at: [0, -depth, 0], color: '#77736c', to: 'paint' }),
      part(ring(R * 0.62, 0.3, 40), { at: [0, 0.33, 0], color: '#d8c890', to: 'paint' }),
    ];
    for (const a of [0, PI / 2]) parts.push(part(new THREE.BoxGeometry(R * 1.3, 0.04, 0.8), { at: [0, 0.32, 0], rot: [0, a, 0], color: '#d8c890', to: 'paint' }));
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      parts.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 8), { at: [sin(a) * R * 0.97, 0.36, cos(a) * R * 0.97], color: lit(light, 3), to: 'glow' }));
    }
    for (let y = -16; y > -depth + 10; y -= 9) parts.push(part(cyl(R * 0.45 + 0.3, R * 0.45 + 0.3, 1.1, 28), { at: [0, y, 0], color: lit('#ffd49a', 1.2 + ((y * 7) % 5) * 0.2), to: 'glow' }));
    return { object: k.build(parts, { name: 'cplatform' }), floors: [{ x: 0, z: 0, r: R, y: 0.3 }] };
  },

  // a plaza on its plinth: a broad deck, paved, lit round its edge
  deck(k, { hw = 50, hd = 35, depth = 330, color = '#a8a296' } = {}) {
    const parts = [part(box(hw * 2, 0.6, hd * 2), { at: [0, -0.3, 0], color, to: 'stone' }), part(box(hw * 2 - 6, 4, hd * 2 - 6), { at: [0, -4.3, 0], color: '#6c6862', to: 'paint' })];
    for (let i = -hw + 6; i < hw - 2; i += 8) parts.push(part(box(0.3, 0.02, hd * 2 - 4), { at: [i, 0.3, 0], color: '#8e887c', to: 'stone' }));
    for (const s of [-1, 1]) {
      for (let i = 0; i < 12; i++) parts.push(part(new THREE.BoxGeometry(0.6, 0.12, 0.6), { at: [-hw + 3 + (i * (hw * 2 - 6)) / 11, 0.36, s * (hd - 1)], color: lit('#ffe2b0', 2.5), to: 'glow' }));
      for (let i = 0; i < 8; i++) parts.push(part(new THREE.BoxGeometry(0.6, 0.12, 0.6), { at: [s * (hw - 1), 0.36, -hd + 3 + (i * (hd * 2 - 6)) / 7], color: lit('#ffe2b0', 2.5), to: 'glow' }));
    }
    const object = k.build(parts, { name: 'deck' });
    const under = PROPS.plinth(k, { w: hw * 2 - 8, d: hd * 2 - 8, depth });
    under.object.position.y = -4.3;
    object.add(under.object);
    return { object, floors: [{ x: 0, z: 0, hw, hd, y: 0.3 }] };
  },

  // a skybridge: a deck between two platforms, its glass rails lit along
  // the top, the truss underneath; `len` long, facing along z
  skybridge(k, { len = 100, w = 6, style = 'coruscant' } = {}) {
    const K = style === 'kamino';
    const DECK = K ? '#8a939a' : '#8e8a84';
    const parts = [part(box(w, 0.6, len), { at: [0, -0.3, 0], color: DECK, to: 'paint' }), part(box(w * 0.5, 1.6, len), { at: [0, -1.9, 0], color: K ? '#b8c0c8' : '#5e5a56', to: 'metal' })];
    const rl = len - 3;
    for (const s of [-1, 1]) {
      parts.push(part(box(0.1, 1.05, rl), { at: [s * (w / 2 - 0.1), 0.3, 0], color: K ? '#c8d8e4' : '#9ab0c0', to: 'glass' }));
      parts.push(part(box(0.22, 0.12, rl), { at: [s * (w / 2 - 0.1), 1.35, 0], color: K ? lit('#d8f0ff', 1.6) : lit('#9ad8ff', 2.2), to: 'glow' }));
      for (let z = -rl / 2; z <= rl / 2; z += 6) parts.push(part(box(0.14, 1.2, 0.14), { at: [s * (w / 2 - 0.1), 0.3, z], color: '#5a5a5e', to: 'metal' }));
    }
    for (let z = -len / 2 + 5; z < len / 2 - 4; z += 10) parts.push(rod([-w * 0.25, -2.6, z], [w * 0.25, -2.6, z + 5], 0.12, 0.12, { color: '#5a5a5e', to: 'metal' }));
    const solids = [...rail([-(w / 2 - 0.1), -rl / 2], [-(w / 2 - 0.1), rl / 2]), ...rail([w / 2 - 0.1, -rl / 2], [w / 2 - 0.1, rl / 2])];
    return { object: k.build(parts, { name: 'skybridge', shadows: false }), floors: [{ x: 0, z: 0, hw: w / 2, hd: len / 2, yaw: 0, y: 0.3 }], solids };
  },

  // the Jedi Temple: a ziggurat of pale stone, 300 m, its five spires on
  // top (the tallest the High Council's), the great doors at its foot
  jeditemple(k) {
    const S = '#cbbd9f';
    const D = '#a99a7e';
    const parts = [];
    const sq = (bot, top, h, y) => part(new THREE.CylinderGeometry(top / Math.SQRT2, bot / Math.SQRT2, h, 4, 1).rotateY(PI / 4).translate(0, h / 2, 0), { at: [0, y, 0], color: S, to: 'stone' });
    parts.push(sq(200, 168, 64, 0), sq(166, 140, 8, 64), sq(138, 112, 46, 72), sq(110, 96, 6, 118), sq(94, 84, 22, 124));
    // the fluting up its faces
    for (let i = -8; i <= 8; i++) for (const [yaw, off] of [[0, 1], [PI / 2, 1], [PI, 1], [-PI / 2, 1]]) {
      const x = i * 10;
      const at = [x * cos(yaw) + 96.5 * sin(yaw) * off, 6, -x * sin(yaw) + 96.5 * cos(yaw) * off];
      parts.push(part(box(1.4, 52, 1.4), { at, rot: [0, yaw, 0], color: D, to: 'stone' }));
    }
    // the great doors and their columns
    parts.push(part(box(36, 46, 2), { at: [0, 0, 99.5], color: '#2e2a24', to: 'dark' }));
    for (let i = 0; i < 6; i++) parts.push(part(cyl(2.2, 2, 48, 14), { at: [-25 + i * 10, 0, 103], color: S, to: 'stone' }));
    parts.push(part(box(60, 5, 8), { at: [0, 48, 102], color: D, to: 'stone' }));
    // the spires: four at the corners, the tallest in the middle
    const spire = (x, z, base, h) => {
      parts.push(part(cyl(9, 7.5, h * 0.5, 12), { at: [x, base, z], color: S, to: 'stone' }));
      parts.push(part(cyl(7.5, 3.6, h * 0.36, 12), { at: [x, base + h * 0.5, z], color: S, to: 'stone' }));
      parts.push(part(cyl(4.2, 4.2, 2.4, 12), { at: [x, base + h * 0.62, z], color: lit('#ffd9a0', 1.5), to: 'glow' }));
      parts.push(part(cyl(3.6, 0.3, h * 0.16, 12), { at: [x, base + h * 0.86, z], color: '#d8c890', to: 'metal' }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        parts.push(part(box(1.2, h * 0.42, 1.2), { at: [x + sin(a) * 8.6, base + 2, z + cos(a) * 8.6], color: D, to: 'stone' }));
      }
    };
    for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) spire(x, z, 146, 110);
    spire(0, 0, 146, 160);
    return { object: k.build(parts, { name: 'jeditemple', shadows: false }), solids: [{ box: [0, 0, 100, 100, 0] }, { box: [0, 103, 30, 3, 0] }] };
  },

  // the Senate: the great mushroom of a dome on its stem, ringed with
  // windows, standing over its plaza
  senate(k, { r: R = 90 } = {}) {
    const BODY = '#a8b0b8';
    const parts = [
      part(cyl(R * 0.62, R * 0.5, 30, 48), { color: '#8e969e', to: 'paint' }),
      part(cyl(R * 0.5, R * 0.98, 18, 48), { at: [0, 30, 0], color: BODY, to: 'paint' }),
      part(cyl(R * 0.98, R, 4, 48), { at: [0, 48, 0], color: '#8e969e', to: 'paint' }),
      part(dome(R, R * 0.22, 48), { at: [0, 52, 0], color: BODY, to: 'paint' }),
      part(ring(R * 0.99, 0.8, 48), { at: [0, 50, 0], color: lit('#cfe6ff', 1.5), to: 'glow' }),
    ];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * PI * 2;
      parts.push(part(box(3, 16, 1), { at: [sin(a) * R * 0.6, 6, cos(a) * R * 0.6], rot: [0, a, 0], color: '#2a3038', to: 'dark' }));
    }
    for (let y = 8; y < 28; y += 7) parts.push(part(cyl(R * 0.6 + 0.4, R * 0.6 + 0.4, 0.8, 48), { at: [0, y, 0], color: lit('#ffe2b0', 1.6), to: 'glow' }));
    return { object: k.build(parts, { name: 'senate', shadows: false }), solids: [{ circle: [0, 0, R * 0.62] }] };
  },

  // a great statue on its pedestal (the Senate's founders, the Temple's
  // Jedi of old), the pedestal's column down to the city, `drop` metres
  // (style 'jedi': the Processional Way's, the audit lane's model where it
  // loads; this one where it won't)
  statue(k, { h = 22, drop = 0 } = {}) {
    const S = '#c4b89c';
    const parts = [
      part(box(5, 3, 5), { color: '#8e887c', to: 'stone' }),
      part(cyl(1.6, 2.6, h * 0.62, 12), { at: [0, 3, 0], color: S, to: 'stone' }),
      part(new THREE.SphereGeometry(1.6, 12, 10), { at: [0, 3 + h * 0.66, 0], scale: [1.4, 1, 1.1], color: S, to: 'stone' }),
      part(new THREE.SphereGeometry(1.1, 12, 10), { at: [0, 3 + h * 0.78, 0.2], color: S, to: 'stone' }),
      part(new THREE.ConeGeometry(1.3, 1.6, 12).translate(0, 0.8, 0), { at: [0, 3 + h * 0.8, -0.1], color: S, to: 'stone' }),
    ];
    for (const s of [-1, 1]) parts.push(rod([s * 1.9, 3 + h * 0.64, 0.2], [s * 1.2, 3 + h * 0.42, 1.4], 0.55, 0.45, { color: S, to: 'stone' }));
    parts.push(rod([0, 3 + h * 0.42, 1.6], [0, 3 + h * 0.95, 1.6], 0.3, 0.3, { color: '#b0a488', to: 'stone' }));
    if (drop) parts.push(part(box(4, drop, 4), { at: [0, -drop, 0], color: '#7e7870', to: 'paint' }));
    return { object: k.build(parts, { name: 'statue', shadows: false }), solids: [{ box: [0, 0, 2.5, 2.5, 0] }] };
  },

  // 500 Republica: the tallest of the residential towers, its fluted
  // spire, and a senator's veranda out over the skylanes (railed, but for
  // the way in from the bridge, at +z)
  republica(k, { depth = 330 } = {}) {
    const BODY = '#c9c2b4';
    const parts = [
      part(cyl(16, 13, depth + 120, 16), { at: [0, -depth, 0], color: BODY, to: 'paint' }),
      part(cyl(13, 6, 150, 16), { at: [0, 120, 0], color: BODY, to: 'paint' }),
      part(cyl(6, 0.6, 60, 12), { at: [0, 270, 0], color: '#d8d0c0', to: 'metal' }),
      part(cyl(16, 16, 0.6, 32), { at: [0, -0.3, 22], color: '#bdb6a8', to: 'stone' }),
      part(cyl(9, 16, 6, 32), { at: [0, -6.3, 22], color: '#8a847a', to: 'paint' }),
    ];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2;
      parts.push(part(box(1.4, depth + 260, 1.4), { at: [sin(a) * 16, -depth, cos(a) * 16], color: '#a8a090', to: 'stone' }));
    }
    for (let y = -depth + 8; y < 260; y += 8) if ((y * 13) % 7 > 1) parts.push(part(cyl(y < 120 ? 16.2 : 12, y < 120 ? 16.2 : 12, 1.1, 16), { at: [0, y, 0], color: lit('#ffe0b0', 1.5), to: 'glow' }));
    // Padmé's rooms off the veranda: tall lit windows, a low wall of planters
    parts.push(part(box(18, 5, 0.4), { at: [0, 0.3, 15.8], color: lit('#ffd9a8', 1.3), to: 'glow' }));
    for (let i = 0; i < 9; i++) parts.push(part(box(0.5, 5, 0.6), { at: [-8 + i * 2, 0.3, 16.1], color: '#8a847a', to: 'metal' }));
    const solids = [{ circle: [0, 0, 16.4] }];
    for (const c of rim(0, 22, 15.6, [[0, 0.32]])) if (Math.hypot(c.circle[0], c.circle[1]) > 16.5) solids.push(c);
    parts.push(part(new THREE.TorusGeometry(15.6, 0.12, 6, 48, PI * 1.8).rotateX(PI / 2).rotateY(PI / 2 + 0.31), { at: [0, 1.25, 22], color: lit('#9ad8ff', 2), to: 'glow' }));
    return { object: k.build(parts, { name: 'republica', shadows: false }), floors: [{ x: 0, z: 22, r: 15.6, y: 0.3 }], solids };
  },

  // Dex's Diner in CoCo Town: a chrome-trimmed diner, its windows warm,
  // its sign in neon on the roof
  dexdiner(k) {
    const tex = k.own(
      canvasTexture(256, (c, s) => {
        c.clearRect(0, 0, s, s);
        c.font = 'bold 92px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.shadowColor = '#ff6a3a';
        c.shadowBlur = 18;
        c.fillStyle = '#ffd0a0';
        c.fillText('DEX’S', s / 2, s * 0.36);
        c.font = 'bold 44px sans-serif';
        c.fillStyle = '#9af0ff';
        c.shadowColor = '#2ad0ff';
        c.fillText('DINER', s / 2, s * 0.7);
      }),
    );
    const parts = [
      part(new THREE.CapsuleGeometry(4, 12, 6, 16).rotateZ(PI / 2), { at: [0, 4, 0], scale: [1, 1, 1.2], color: '#d8c8a8', to: 'paint' }),
      part(box(20, 0.4, 10.4), { at: [0, 0, 0], color: '#6a6660', to: 'metal' }),
      part(box(15, 2.2, 9.9), { at: [0, 2.3, 0], color: lit('#ffcf8a', 1.15), to: 'glow' }),
      part(box(20.4, 0.4, 10.2), { at: [0, 5.2, 0], color: '#e8e8ec', to: 'metal' }),
      part(box(20.4, 0.4, 10.2), { at: [0, 1.8, 0], color: '#3aa8a0', to: 'paint' }),
      part(box(2, 3, 0.4), { at: [0, 0.2, 4.95], color: '#2a2420', to: 'dark' }),
      part(box(0.4, 4.2, 0.4), { at: [-4, 8, 0], color: '#5a5650', to: 'metal' }),
      part(box(0.4, 4.2, 0.4), { at: [4, 8, 0], color: '#5a5650', to: 'metal' }),
    ];
    for (let i = 0; i < 8; i++) parts.push(part(box(0.3, 2.3, 10.1), { at: [-7 + i * 2, 2.25, 0], color: '#4a4a50', to: 'metal' }));
    const object = k.build(parts, { name: 'dexdiner' });
    // the sign, readable from both sides
    const signMat = k.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, color: lit('#ffffff', 1.6), depthWrite: false }));
    for (const a of [0, PI]) {
      const sign = new THREE.Mesh(k.own(new THREE.PlaneGeometry(10, 10)), signMat);
      sign.position.set(0, 12, a ? -0.05 : 0.05);
      sign.rotation.y = a;
      object.add(sign);
    }
    return { object, solids: [{ box: [0, 0, 10, 5.2, 0] }] };
  },

  // the Outlander Club, in the Uscru entertainment district: neon up its
  // front, a vertical sign, light spilling out of its door
  club(k) {
    const r = rng(41);
    // its sign's dark glyphs, strokes of an alien script on the lit panel
    const tex = k.own(
      canvasTexture(256, (c, s) => {
        c.clearRect(0, 0, s, s);
        c.fillStyle = '#1a0e10';
        for (let i = 0; i < 7; i++) {
          const x = 14 + i * 34;
          c.fillRect(x, 40 + r() * 20, 22, 10);
          c.fillRect(x + (r() < 0.5 ? 0 : 12), 50, 10, 120 + r() * 40);
          if (r() < 0.6) c.fillRect(x, 150 + r() * 40, 22, 10);
        }
      }),
    );
    const parts = [
      part(box(24, 16, 16), { color: '#2a1a1e', to: 'paint' }),
      part(box(26, 1, 18), { at: [0, 16, 0], color: '#2a2830', to: 'metal' }),
      // the sign over the door
      part(box(15, 1.8, 0.5), { at: [-2, 8.5, 8.3], color: lit('#ffe6b0', 1.8), to: 'glow' }),
      // the door: a dark round-ended portal, a glowing half-ring beside it
      part(box(7, 5, 0.3), { at: [-2, 0, 8.1], color: '#140c10', to: 'dark' }),
      part(new THREE.TorusGeometry(4, 0.45, 8, 24, PI), { at: [3.5, 4, 8.4], rot: [0, 0, -PI / 2], color: lit('#fff2d8', 2.2), to: 'glow' }),
      // the green and red roundels
      part(cyl(1.2, 1.2, 0.3, 20), { at: [7.5, 10, 8.3], rot: [PI / 2, 0, 0], color: lit('#3aff8a', 2), to: 'glow' }),
      part(cyl(1.2, 1.2, 0.3, 20), { at: [7.5, 12.5, 8.3], rot: [PI / 2, 0, 0], color: lit('#ff3a3a', 2), to: 'glow' }),
    ];
    for (const x of [-5.5, 1.5]) parts.push(part(cyl(2.5, 2.5, 0.3, 24), { at: [x, 2.5, 8.1], rot: [PI / 2, 0, 0], color: '#140c10', to: 'dark' }));
    // blue panels down the side the bridge comes in on
    for (let i = 0; i < 3; i++) parts.push(part(box(0.2, 4, 1.4), { at: [12.1, 4, -4 + i * 4], color: lit('#3ad8ff', 1.8), to: 'glow' }));
    const object = k.build(parts, { name: 'club' });
    const sign = new THREE.Mesh(k.own(new THREE.PlaneGeometry(14, 1.6)), k.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    sign.position.set(-2, 9.4, 8.57);
    object.add(sign);
    return { object, solids: [{ box: [0, 0, 12, 8, 0] }] };
  },

  // the Works: the derelict industrial district, rusting cranes and
  // girder towers, chimneys with beacons
  works(k) {
    const r = rng(23);
    const RUST = '#5a3e30';
    const parts = [];
    const solids = [];
    for (let i = 0; i < 3; i++) {
      const x = -14 + i * 14;
      const h = 30 + r() * 22;
      const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [dx, dz] of legs) parts.push(rod([x + dx * 2.4, 0, -8 + dz * 2.4], [x + dx * 2.4 * 0.7, h, -8 + dz * 2.4 * 0.7], 0.25, 0.22, { color: RUST, to: 'metal' }));
      // braced as a lattice mast: a diagonal across each face in every 5 m
      // bay, alternating; a deck every 10 m
      const off = (y) => 2.4 * (1 - (0.3 * y) / h);
      for (let y0 = 0, bay = 0; y0 + 5 <= h; y0 += 5, bay++)
        for (let f = 0; f < 4; f++) {
          const [a0, b0] = legs[f];
          const [a1, b1] = legs[(f + 1) % 4];
          const [lo, hi] = bay % 2 ? [[a1, b1], [a0, b0]] : [[a0, b0], [a1, b1]];
          parts.push(rod([x + lo[0] * off(y0), y0, -8 + lo[1] * off(y0)], [x + hi[0] * off(y0 + 5), y0 + 5, -8 + hi[1] * off(y0 + 5)], 0.1, 0.1, { color: RUST, to: 'metal' }));
        }
      for (let y = 4; y < h; y += 10) parts.push(part(box(5, 0.4, 5), { at: [x, y, -8], color: '#3e2e26', to: 'metal' }));
      // the crane's boom out over the edge, its cable and hook
      const a = r() * PI * 2;
      const L = 22 + r() * 10;
      parts.push(rod([x, h, -8], [x + sin(a) * L, h + 4, -8 + cos(a) * L], 0.45, 0.3, { color: '#c8902a', to: 'paint' }));
      parts.push(rod([x + sin(a) * L, h + 4, -8 + cos(a) * L], [x + sin(a) * L, h - 14, -8 + cos(a) * L], 0.05, 0.05, { color: '#2a2622', to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.5, 8, 6), { at: [x, h + 1, -8], color: lit('#ff4a2a', 3), to: 'glow' }));
      solids.push({ box: [x, -8, 2.8, 2.8, 0] });
    }
    for (const [x, z, h] of [[16, 10, 34], [20, 2, 26]]) {
      parts.push(part(cyl(2.6, 2.2, h, 14), { at: [x, 0, z], color: '#6a5a4c', to: 'metal' }));
      parts.push(part(cyl(2.3, 2.3, 0.6, 14), { at: [x, h, z], color: lit('#ffb05a', 2), to: 'glow' }));
      solids.push({ circle: [x, z, 2.7] });
    }
    for (let i = 0; i < 4; i++) parts.push(part(cyl(4, 4, 7, 18), { at: [-16 + i * 9, 0, 12], color: vary('#5e5046', r, 0.12), to: 'metal' }));
    solids.push({ box: [-2.5, 12, 18, 4.2, 0] });
    parts.push(part(box(26, 0.3, 6), { at: [-6, 14, -2], color: '#3e2e26', to: 'metal' }));
    return { object: k.build(parts, { name: 'works' }), solids };
  },

  // Anakin's airspeeder: yellow, its twin turbines out front with the
  // energy binder crackling between them, the open cockpit behind; 6 m,
  // hovering
  airspeeder(k, { color = '#eac524' } = {}) {
    const H = 1.2;
    const parts = [];
    for (const x of [-0.85, 0.85]) {
      parts.push(part(turned([[0.05, -1.2], [0.42, -0.9], [0.48, 1.2], [0.4, 2.0], [0.3, 2.2]], 14), { at: [x, H, 1.1], color, to: 'paint' }));
      parts.push(part(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), { at: [x, H, 3.33], rot: [PI / 2, 0, 0], color: '#2a2a2c', to: 'dark' }));
    }
    parts.push(part(new THREE.TorusGeometry(0.85, 0.04, 6, 16, PI), { at: [0, H, 3.2], rot: [0, 0, 0], color: lit('#bfe8ff', 3), to: 'glow' }));
    const body = loft([
      { z: -2.9, pts: trap8(0.8, 0.5, 0.5, 0.1, H + 0.1) },
      { z: -1.2, pts: trap8(1.4, 1.0, 0.8, 0.15, H + 0.1) },
      { z: 0.4, pts: trap8(1.3, 0.9, 0.7, 0.15, H) },
      { z: 1.4, pts: trap8(0.5, 0.4, 0.4, 0.1, H) },
    ]);
    parts.push(part(body, { color, to: 'paint' }));
    parts.push(part(box(1.0, 0.5, 1.4), { at: [0, H + 0.3, -1.2], color: '#3a2a22', to: 'cloth' }));
    parts.push(part(new THREE.BoxGeometry(1.1, 0.4, 0.05), { at: [0, H + 0.7, -0.35], rot: [-0.5, 0, 0], color: '#a8c0c8', to: 'glass' }));
    for (const x of [-0.85, 0.85]) parts.push(rod([x, H, 0.2], [0, H, -0.2], 0.08, 0.08, { color: '#7a7a7e', to: 'metal' }));
    return { object: k.build(parts, { name: 'airspeeder' }), solids: [{ box: [0, 0.3, 1.3, 3.2, 0] }] };
  },

  // the skylanes: a stream of speeders going one way, and another coming
  // back alongside it; `len` long, along z
  airlane(k, { len = 1400, n = 30, speed = 34, gap = 9, seed = 1 } = {}) {
    const r = rng(seed);
    const COLORS = ['#c8c2b8', '#d84a3a', '#e8c040', '#5a7ad0', '#e0e0e4', '#3a3a40', '#a86ad0'];
    const body = k.geometry([part(new THREE.CapsuleGeometry(0.7, 3.2, 4, 8).rotateX(PI / 2), { scale: [1.2, 0.6, 1], color: '#ffffff', to: 'paint' }), part(box(3.2, 0.2, 1.2), { at: [0, -0.1, -0.8], color: '#ffffff', to: 'paint' })]);
    const glow = k.geometry([part(new THREE.SphereGeometry(0.35, 6, 4), { at: [-0.6, 0, -2.4], color: lit('#ff7a4a', 3), to: 'glow' }), part(new THREE.SphereGeometry(0.35, 6, 4), { at: [0.6, 0, -2.4], color: lit('#ff7a4a', 3), to: 'glow' })]);
    const mat = k.own(k.mats.paint.clone());
    mat.vertexColors = true;
    const ships = new THREE.InstancedMesh(body, mat, n * 2);
    const lights = new THREE.InstancedMesh(glow, k.mats.glow, n * 2);
    for (const m of [ships, lights]) m.frustumCulled = false;
    const lanes = Array.from({ length: n * 2 }, (_, i) => ({ dir: i < n ? 1 : -1, at: r() * len, dy: (r() - 0.5) * 4, dx: (i < n ? -gap / 2 : gap / 2) + (r() - 0.5) * 2, v: speed * (0.8 + r() * 0.4) }));
    const c = new THREE.Color();
    lanes.forEach((l, i) => ships.setColorAt(i, c.set(COLORS[i % COLORS.length])));
    const object = new THREE.Group();
    object.add(ships, lights);
    // (the lane itself, glowing: a ribbon a side, one tone each way, the
    // skylanes of the film's sunsets seen from afar)
    for (const [dx, tone] of [[-gap / 2, '#ffd9a0'], [gap / 2, '#8fd0ff']]) {
      const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.6, len).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(tone).multiplyScalar(1.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      ribbon.position.set(dx, -1.2, 0);
      ribbon.frustumCulled = false;
      object.add(ribbon);
    }
    const M = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qBack = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI);
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const place = (t) => {
      lanes.forEach((l, i) => {
        const z = ((((l.at + t * l.v) % len) + len) % len) - len / 2;
        p.set(l.dx, l.dy + sin(t * 0.7 + i) * 0.3, z * l.dir);
        M.compose(p, l.dir > 0 ? q : qBack, one);
        ships.setMatrixAt(i, M);
        lights.setMatrixAt(i, M);
      });
      ships.instanceMatrix.needsUpdate = true;
      lights.instanceMatrix.needsUpdate = true;
    };
    place(0);
    return { object, update: (t) => place(t) };
  },

  // a Senate Guard: blue robes to the ground, the tall crested helmet, a
  // ceremonial pike
  senateguard(k) {
    const BLUE = '#2a4a9a';
    const parts = [
      part(new THREE.ConeGeometry(0.42, 1.5, 14, 1, true).translate(0, 0.75, 0), { color: BLUE, to: 'cloth' }),
      part(new THREE.CapsuleGeometry(0.2, 0.45, 4, 10), { at: [0, 1.45, 0], scale: [1.2, 1, 0.8], color: BLUE, to: 'cloth' }),
      part(new THREE.SphereGeometry(0.15, 12, 10), { at: [0, 1.88, 0], scale: [1, 1.2, 1.1], color: '#1e3a86', to: 'paint' }),
      part(box(0.05, 0.4, 0.34), { at: [0, 1.86, -0.02], color: '#1e3a86', to: 'paint' }),
      part(box(0.18, 0.04, 0.04), { at: [0, 1.9, 0.14], color: '#0a0a10', to: 'dark' }),
      part(cyl(0.025, 0.025, 2.6, 6), { at: [0.3, 0, 0.12], color: '#c8c0a8', to: 'metal' }),
      part(new THREE.ConeGeometry(0.05, 0.3, 6), { at: [0.3, 2.7, 0.12], color: '#e8e0c8', to: 'metal' }),
    ];
    for (const s of [-1, 1]) parts.push(rod([s * 0.26, 1.62, 0], [s * 0.3 * (s > 0 ? 1 : 1.1), 1.15, 0.12], 0.07, 0.06, { color: BLUE, to: 'cloth' }));
    const body = k.build(parts, { name: 'senateguard' });
    const object = new THREE.Group();
    object.add(body);
    return {
      object,
      update(t, dt, move = 0) {
        body.rotation.z = sin(t * 7) * 0.03 * move;
        body.position.y = abs(sin(t * 7)) * 0.03 * move;
      },
    };
  },

  // ── Kamino ──

  // a building of Tipoca City, 40 m: a broad white dome over a ring of
  // lit windows, on its stilts out of the sea; its door at 22 m, facing +z
  tipoca(k, { style = 'dome', s: S = 1 } = {}) {
    const WHITE = '#f2f5f8';
    const GREY = '#c4cad0';
    const parts = [];
    if (style === 'tower') {
      parts.push(part(cyl(5, 4, 44, 20), { color: GREY, to: 'paint' }));
      parts.push(part(cyl(4, 9, 6, 24), { at: [0, 44, 0], color: WHITE, to: 'paint' }));
      parts.push(part(cyl(9, 9, 4, 24), { at: [0, 50, 0], color: WHITE, to: 'paint' }));
      parts.push(part(cyl(9.15, 9.15, 1.4, 24), { at: [0, 51.2, 0], color: lit('#e8f6ff', 1.6), to: 'glow' }));
      parts.push(part(dome(9, 5, 24), { at: [0, 54, 0], color: WHITE, to: 'paint' }));
      parts.push(part(cyl(0.3, 0.1, 10, 6), { at: [0, 59, 0], color: GREY, to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.5, 8, 6), { at: [0, 69, 0], color: lit('#ff4a3a', 3), to: 'glow' }));
      for (let y = 6; y < 42; y += 6) parts.push(part(cyl(4.6 - y * 0.02, 4.6 - y * 0.02, 0.8, 20), { at: [0, y, 0], color: lit('#dff2ff', 1.2), to: 'glow' }));
      return { object: whiten(k, k.build(parts, { name: 'tipoca' })), solids: [{ circle: [0, 0, 5] }] };
    }
    // the stilts, and the column up the middle
    parts.push(part(cyl(4.5, 3.5, 19, 16), { at: [0, -6, 0], color: GREY, to: 'paint' }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + 0.3;
      parts.push(rod([sin(a) * 13, -6, cos(a) * 13], [sin(a) * 10, 19, cos(a) * 10], 1.2, 0.9, { color: GREY, to: 'paint' }));
    }
    parts.push(part(cyl(13, 17, 4, 32), { at: [0, 18, 0], color: GREY, to: 'paint' }));
    parts.push(part(upright([[18, 0], [20, 1.5], [20.6, 5], [19.6, 9], [16.6, 13.5], [11, 17.4], [4, 19.4], [0, 19.7]], 40), { at: [0, 22, 0], color: WHITE, to: 'paint' }));
    parts.push(part(cyl(20.35, 20.35, 1.5, 40), { at: [0, 24.2, 0], color: lit('#e2f2ff', 1.5), to: 'glow' }));
    parts.push(part(cyl(19.75, 19.75, 0.9, 40), { at: [0, 30.4, 0], color: lit('#e2f2ff', 1.1), to: 'glow' }));
    parts.push(part(cyl(2.2, 2.2, 2, 14), { at: [0, 41.4, 0], color: GREY, to: 'paint' }));
    parts.push(part(dome(2.4, 1.6, 14), { at: [0, 43.4, 0], color: WHITE, to: 'paint' }));
    // the door, at the walkways' level
    parts.push(part(box(4, 3.6, 1), { at: [0, 22, 19.9], color: '#2a3038', to: 'dark' }));
    parts.push(part(box(5.2, 0.4, 1.4), { at: [0, 25.6, 20], color: GREY, to: 'paint' }));
    const object = k.build(parts, { name: 'tipoca' });
    whiten(k, object);
    object.scale.set(S, 1, S);
    const holder = new THREE.Group();
    holder.add(object);
    return { object: holder, solids: [{ circle: [0, 0, 20 * S] }] };
  },

  // a Kamino landing platform: a white disc on its column and struts
  // over the sea, its landing lights round the rim
  kpad(k, { r: R = 28, depth = 28 } = {}) {
    const parts = [
      // (its deck a grey tread plate, the wet catching the light)
      part(cyl(R, R, 0.7, 48), { at: [0, -0.4, 0], color: '#7c858c', to: 'deck' }),
      part(new THREE.RingGeometry(R * 0.68, R * 0.72, 48).rotateX(-PI / 2), { at: [0, 0.31, 0], color: '#3e464c', to: 'paint' }),
      // (under it, a cone flaring up to the deck, on a column wider at its foot)
      part(cyl(R * 0.36, R * 0.98, 8, 32), { at: [0, -8.4, 0], color: '#6a737a', to: 'paint' }),
      part(cyl(R * 0.42, R * 0.32, depth, 20), { at: [0, -depth, 0], color: '#5e676e', to: 'paint' }),
    ];
    for (const a of [0.4, 0.4 + PI / 2]) parts.push(part(new THREE.BoxGeometry(R * 1.2, 0.04, 1), { at: [0, 0.32, 0], rot: [0, a, 0], color: '#f0f2f4', to: 'paint' }));
    // amber strips round its rim (no curb: the skybridges join it there)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * PI * 2;
      parts.push(part(box(1.8, 0.1, 0.3), { at: [sin(a) * R * 0.96, 0.3, cos(a) * R * 0.96], rot: [0, a + PI / 2, 0], color: lit('#ffd28a', 3), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'kpad' }), floors: [{ x: 0, z: 0, r: R, y: 0.3 }] };
  },

  // a weather mast at the city's edge: a lattice, a dish, a beacon
  kmast(k) {
    const parts = [];
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) parts.push(rod([x * 1.6, 0, z * 1.6], [x * 0.3, 26, z * 0.3], 0.18, 0.12, { color: '#9aa4ae', to: 'metal' }));
    for (let y = 4; y < 26; y += 4) parts.push(part(box(3.6 - y * 0.1, 0.3, 3.6 - y * 0.1), { at: [0, y, 0], color: '#8a949e', to: 'metal' }));
    parts.push(part(new THREE.SphereGeometry(2.6, 16, 8, 0, PI * 2, 0, PI * 0.35), { at: [0, 20, 1.6], rot: [-1.2, 0, 0], color: '#dfe4e8', to: 'paint' }));
    parts.push(part(new THREE.SphereGeometry(0.6, 10, 8), { at: [0, 26.6, 0], color: lit('#ff3a2a', 3.5), to: 'glow' }));
    return { object: k.build(parts, { name: 'kmast' }), solids: [{ circle: [0, 0, 2.4] }] };
  },

  // a static discharge tower (Wookieepedia: Tipoca City has "several static
  // discharge towers to secure the city during electrical storms"): a
  // slender white mast in rings, a collector ball at its tip, a red beacon;
  // now and then the storm's lightning comes down onto it (storm.js says
  // when, and the bolt's path)
  kdischarge(k, { h = 16, seed = 1, every = 11 } = {}) {
    const parts = [
      part(cyl(1.6, 1.9, 1.2, 16), { color: '#c8ced4', to: 'paint' }),
      part(cyl(0.55, 0.9, h - 1.2, 14), { at: [0, 1.2, 0], color: '#e4e8ec', to: 'paint' }),
      part(new THREE.SphereGeometry(1.1, 16, 12), { at: [0, h + 0.6, 0], color: '#9aa4ae', to: 'metal' }),
      part(cyl(0.12, 0.05, 2.4, 6), { at: [0, h + 1.6, 0], color: '#5a6066', to: 'metal' }),
      part(new THREE.SphereGeometry(0.3, 8, 6), { at: [0, h - 1.4, 0.75], color: lit('#ff3a2a', 3.5), to: 'glow' }),
    ];
    for (let y = 3; y < h - 1; y += Math.max(3, h / 6)) parts.push(part(ring(0.95 - (y / h) * 0.3, 0.12, 16), { at: [0, y, 0], color: '#9aa4ae', to: 'metal' }));
    const object = k.build(parts, { name: 'kdischarge' });
    // the bolt, from the cloud to the tip, and the flare round the ball
    const tip = [0, h + 3.8, 0];
    const path = boltPath([0, h + 150, 0], tip, seed);
    const boltParts = [];
    for (let i = 1; i < path.length; i++) boltParts.push(rod(path[i - 1], path[i], 0.35, 0.35, { color: lit('#d8e8ff', 4), to: 'glow' }, 5));
    boltParts.push(part(new THREE.SphereGeometry(2.4, 12, 8), { at: [0, h + 0.8, 0], color: lit('#cfe0ff', 3), to: 'glow' }));
    const bolt = k.build(boltParts, { name: 'kdischarge-bolt', shadows: false });
    bolt.visible = false;
    object.add(bolt);
    return {
      object,
      solids: [{ circle: [0, 0, 1.9] }],
      update(t) {
        const v = strikeAt(t, { seed, every });
        bolt.visible = v > 0.3;
        // (a different way down each time)
        if (bolt.visible) bolt.rotation.y = Math.floor(t / every) * 2.39;
      },
    };
  },

  // Slave I, Jango Fett's Firespray, standing on its tail as it lands:
  // the broad green-grey hull, the cockpit up top, the wings at its foot
  slave1(k) {
    const HULL = '#6f7b62';
    const RED = '#8c3a2a';
    const parts = [
      part(upright([[0.2, 0], [5, 0.6], [7, 3], [7.4, 7], [6.4, 12], [4.4, 17], [2.4, 20], [0.3, 21.5]], 28), { at: [0, 0.8, 0], scale: [1, 1, 0.5], color: HULL, to: 'paint' }),
      part(ring(7.3, 0.35, 28), { at: [0, 8, 0], scale: [1, 1, 0.5], color: RED, to: 'paint' }),
      part(new THREE.SphereGeometry(1.6, 14, 10), { at: [0, 17.6, 2.3], scale: [1.2, 1, 0.6], color: '#1a2026', to: 'glass' }),
      part(ring(1.9, 0.18, 16).rotateX(PI / 2), { at: [0, 17.6, 2.5], scale: [1.2, 1, 1], color: RED, to: 'paint' }),
      part(cyl(4.4, 4.8, 1.2, 24), { at: [0, 0, 0], scale: [1, 1, 0.55], color: '#4a5244', to: 'metal' }),
    ];
    for (const s of [-1, 1]) {
      parts.push(part(box(1.2, 10, 5), { at: [s * 8.6, 0.4, 0], rot: [0, 0, s * -0.22], color: HULL, to: 'paint' }));
      parts.push(part(box(1.3, 2, 5.2), { at: [s * 9.6, 7.6, 0], rot: [0, 0, s * -0.22], color: RED, to: 'paint' }));
      parts.push(part(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 8), { at: [s * 2.2, 15, 3.4], rot: [PI / 2 - 0.3, 0, 0], color: '#2a2e2a', to: 'metal' }));
    }
    for (let i = 0; i < 3; i++) parts.push(part(cyl(1.0, 1.0, 0.3, 14), { at: [-2.5 + i * 2.5, 1.2, -3.5], rot: [PI / 2, 0, 0], color: lit('#ff9a5a', 1.4), to: 'glow' }));
    return { object: k.build(parts, { name: 'slave1' }), solids: [{ box: [0, 0, 9, 3.6, 0] }] };
  },

  // Jango Fett: silver-blue Mandalorian armour, the T-visored helmet, the
  // jetpack, a blaster on each hip
  jango(k) {
    const ARMOR = '#9aa4ae';
    const BLUE = '#4a5e7a';
    const parts = [
      part(new THREE.CapsuleGeometry(0.07, 0.62, 4, 8), { at: [-0.1, 0.42, 0], color: BLUE, to: 'cloth' }),
      part(new THREE.CapsuleGeometry(0.07, 0.62, 4, 8), { at: [0.1, 0.42, 0], color: BLUE, to: 'cloth' }),
      part(new THREE.CapsuleGeometry(0.18, 0.36, 4, 10), { at: [0, 1.2, 0], scale: [1.05, 1, 0.7], color: BLUE, to: 'cloth' }),
      part(box(0.36, 0.3, 0.12), { at: [0, 1.22, 0.1], color: ARMOR, to: 'metal' }),
      part(new THREE.SphereGeometry(0.135, 14, 12), { at: [0, 1.6, 0], scale: [1, 1.1, 1.05], color: ARMOR, to: 'metal' }),
      part(box(0.16, 0.035, 0.05), { at: [0, 1.62, 0.13], color: '#0a0c10', to: 'dark' }),
      part(box(0.035, 0.11, 0.05), { at: [0, 1.56, 0.135], color: '#0a0c10', to: 'dark' }),
      part(box(0.28, 0.42, 0.16), { at: [0, 1.0, -0.2], color: ARMOR, to: 'metal' }),
      part(new THREE.ConeGeometry(0.06, 0.4, 8), { at: [0, 1.62, -0.22], color: ARMOR, to: 'metal' }),
    ];
    for (const s of [-1, 1]) {
      parts.push(rod([s * 0.24, 1.4, 0], [s * 0.28, 0.95, 0.05], 0.055, 0.05, { color: BLUE, to: 'cloth' }));
      parts.push(part(box(0.06, 0.16, 0.2), { at: [s * 0.2, 0.72, 0.05], color: '#3a2a20', to: 'cloth' }));
    }
    const body = k.build(parts, { name: 'jango' });
    const object = new THREE.Group();
    object.add(body);
    return {
      object,
      update(t, dt, move = 0) {
        body.rotation.z = sin(t * 7) * 0.025 * move;
      },
    };
  },

  // an aiwha: Kamino's winged whale, gliding over the waves, its great
  // wings beating slowly
  aiwha(k) {
    const SKIN = '#6c7c8c';
    const BELLY = '#c8d0d6';
    const body = k.build(
      [
        part(new THREE.CapsuleGeometry(1.6, 7, 6, 14).rotateX(PI / 2), { at: [0, 0, 0], scale: [1, 0.8, 1], color: SKIN, to: 'leaf' }),
        part(new THREE.CapsuleGeometry(1.3, 6, 6, 12).rotateX(PI / 2), { at: [0, -0.5, 0.4], scale: [1, 0.6, 1], color: BELLY, to: 'leaf' }),
        part(new THREE.SphereGeometry(1, 12, 8), { at: [0, -0.1, -6.4], scale: [2.6, 0.25, 1.2], color: SKIN, to: 'leaf' }),
      ],
      { name: 'aiwha' },
    );
    const wings = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(s * 1.2, 0.3, 0.8);
      g.add(k.build([part(new THREE.SphereGeometry(1, 14, 8), { at: [s * 5, 0, -0.6], scale: [5.4, 0.16, 2.2], rot: [0, s * 0.2, 0], color: SKIN, to: 'leaf' })], { name: 'aiwha-wing' }));
      body.add(g);
      wings.push([g, s]);
    }
    const object = new THREE.Group();
    object.add(body);
    return {
      object,
      update(t) {
        for (const [g, s] of wings) g.rotation.z = s * sin(t * 1.3) * 0.45;
        body.position.y = -sin(t * 1.3) * 0.4;
      },
    };
  },

  // ── Geonosis ──

  // the Petranaki arena, 150 m: a great oval of red stone, its tiers of
  // seats round a sandy floor, spires along its rim, the gate at +z
  arena(k) {
    const R = 60;
    const SX = 1.0;
    const ROCK = '#b07650';
    const gap = 0.22;
    const lathe = (pts, color, to = 'stone') => part(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 64, gap, PI * 2 - gap * 2), { scale: [SX, 1, 1], color, to });
    const parts = [
      lathe([[R + 2, 0], [R + 1, 26], [R - 1, 30], [R - 4, 30.5]], ROCK),
      lathe([[R - 4, 30.5], [R - 6, 27], [R - 22, 6], [R - 24, 5.4], [R - 24, 0]], '#9a6444'),
      part(new THREE.CircleGeometry(R - 24, 48).rotateX(-PI / 2), { at: [0, 0.06, 0], scale: [SX, 1, 1], color: '#d8b080', to: 'adobe' }),
    ];
    // the terraces' rings of seats
    for (let i = 1; i < 6; i++) {
      const rr = R - 22 + i * 3.1;
      parts.push(part(new THREE.TorusGeometry(rr, 0.35, 4, 64, PI * 2 - gap * 2).rotateX(PI / 2).rotateY(PI / 2 - gap), { at: [0, 6 + i * 3.6, 0], scale: [SX, 1, 1], color: '#7a4a32', to: 'stone' }));
    }
    // the spires and buttresses round the rim
    for (let i = 0; i < 30; i++) {
      const a = gap + 0.1 + (i / 29) * (PI * 2 - gap * 2 - 0.2);
      const [x, z] = [sin(a) * (R + 1.5) * SX, cos(a) * (R + 1.5)];
      parts.push(part(new THREE.ConeGeometry(1.8, 14 + (i % 3) * 5, 7).translate(0, 7 + (i % 3) * 2.5, 0), { at: [x, 28, z], color: '#a06a46', to: 'stone' }));
      parts.push(part(box(3, 26, 3), { at: [x, 0, z], rot: [0, a, 0], color: '#8e5a3c', to: 'stone' }));
    }
    // the gate's towers and its arch
    for (const s of [-1, 1]) parts.push(part(cyl(5, 3.5, 40, 10), { at: [s * 15, 0, R + 1], color: '#9a6444', to: 'stone' }), part(new THREE.ConeGeometry(3.6, 12, 10).translate(0, 6, 0), { at: [s * 15, 40, R + 1], color: '#a06a46', to: 'stone' }));
    parts.push(part(new THREE.TorusGeometry(11, 2.4, 8, 16, PI), { at: [0, 18, R + 1], color: '#8e5a3c', to: 'stone' }));
    // the royal box over the floor, opposite the gate
    parts.push(part(box(16, 4, 6), { at: [0, 14, -(R - 18)], color: '#7a4a32', to: 'stone' }), part(box(14, 0.6, 5), { at: [0, 18, -(R - 18)], color: '#c8a070', to: 'cloth' }));
    // walls you can't go through, fitted to the model (+/-75 x +/-73): the
    // floor's edge at r 22 (where it ends on its -x side) and the outer wall
    // at r 74, but for the gate
    const IN = 22;
    const OUT = 74;
    const solids = [];
    const oval = (rr, step = 1.5) => {
      const n = Math.ceil((2 * PI * rr * 1.13) / step);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2;
        if (abs(Math.atan2(sin(a), cos(a))) < gap + 0.04) continue;
        solids.push({ circle: [sin(a) * rr * SX, cos(a) * rr, 0.85] });
      }
    };
    oval(IN);
    oval(OUT);
    for (const s of [-1, 1]) solids.push({ circle: [s * (OUT * sin(gap) + 4), OUT + 1, 5] }, ...rail([s * IN * sin(gap) * SX, IN * cos(gap)], [s * OUT * sin(gap) * SX, OUT * cos(gap)], 1.2));
    return { object: k.build(parts, { name: 'arena' }), solids };
  },

  // the execution posts in the arena: slim tapered stone, a knob on top,
  // chains hanging from under it on the three in the middle
  pillars(k) {
    const parts = [];
    const xs = [-14, -7, 0, 7, 14];
    for (const x of xs) {
      parts.push(part(cyl(0.85, 0.55, 7.5, 10), { at: [x, 0, 0], color: '#a87250', to: 'stone' }));
      parts.push(part(new THREE.SphereGeometry(0.9, 12, 8), { at: [x, 7.5, 0], scale: [1, 0.7, 1], color: '#a87250', to: 'stone' }));
      if (abs(x) > 7) continue;
      for (const s of [-1, 1]) parts.push(rod([x + s * 0.5, 7.1, 0.5], [x + s * 0.7, 5, 0.65], 0.05, 0.05, { color: '#3a3430', to: 'metal' }), part(ring(0.18, 0.05, 8), { at: [x + s * 0.7, 4.9, 0.65], color: '#3a3430', to: 'metal' }));
    }
    return { object: k.build(parts, { name: 'pillars' }), solids: xs.map((x) => ({ circle: [x, 0, 0.9] })) };
  },

  // the acklay: a crab-mantis of a beast, its two scythe arms up, its
  // long neck and head; it scuttles on six legs
  acklay(k) {
    const SKIN = '#6c7a58';
    const BELLY = '#b4b48a';
    const body = new THREE.Group();
    body.add(
      k.build(
        [
          part(new THREE.SphereGeometry(1, 16, 12), { at: [0, 3.2, -0.4], scale: [1.3, 1.2, 2.0], color: SKIN, to: 'leaf' }),
          part(new THREE.SphereGeometry(1, 12, 10), { at: [0, 2.8, -0.2], scale: [1.0, 0.9, 1.6], color: BELLY, to: 'leaf' }),
          part(new THREE.CapsuleGeometry(0.4, 2.2, 4, 10), { at: [0, 4.6, 1.8], rot: [0.8, 0, 0], color: SKIN, to: 'leaf' }),
          part(new THREE.SphereGeometry(0.7, 12, 10), { at: [0, 5.6, 2.9], scale: [1, 0.8, 1.4], color: SKIN, to: 'leaf' }),
          part(new THREE.ConeGeometry(0.35, 0.9, 8), { at: [0, 5.3, 3.8], rot: [PI / 2 + 0.3, 0, 0], color: BELLY, to: 'leaf' }),
          part(new THREE.SphereGeometry(0.12, 6, 4), { at: [-0.4, 5.85, 3.3], color: lit('#ffdc4a', 2), to: 'glow' }),
          part(new THREE.SphereGeometry(0.12, 6, 4), { at: [0.4, 5.85, 3.3], color: lit('#ffdc4a', 2), to: 'glow' }),
        ],
        { name: 'acklay' },
      ),
    );
    const legs = [];
    for (const s of [-1, 1]) {
      // the scythes
      const arm = new THREE.Group();
      arm.position.set(s * 1.1, 3.8, 1.4);
      arm.add(k.build([rod([0, 0, 0], [s * 0.8, 2.6, 1.6], 0.22, 0.16, { color: SKIN, to: 'leaf' }), rod([s * 0.8, 2.6, 1.6], [s * 1.0, 0.6, 3.6], 0.16, 0.04, { color: BELLY, to: 'leaf' })], { name: 'acklay-arm' }));
      body.add(arm);
      legs.push({ g: arm, ph: s > 0 ? 0 : PI, arm: true });
      for (const [z, ph] of [[0.6, 0.5], [-1.0, 2.6], [-2.4, 4.2]]) {
        const leg = new THREE.Group();
        leg.position.set(s * 1.1, 3.2, z);
        leg.add(k.build([rod([0, 0, 0], [s * 2.4, 1.2, z * 0.3], 0.18, 0.14, { color: SKIN, to: 'leaf' }), rod([s * 2.4, 1.2, z * 0.3], [s * 3.2, -3.2, z * 0.5], 0.14, 0.05, { color: SKIN, to: 'leaf' })], { name: 'acklay-leg' }));
        body.add(leg);
        legs.push({ g: leg, ph: ph + (s > 0 ? PI : 0) });
      }
    }
    const object = new THREE.Group();
    object.add(body);
    let cyc = 0;
    return {
      object,
      update(t, dt, move = 0) {
        cyc += (dt ?? 0) * (1 + move * 6);
        for (const l of legs) l.g.rotation.x = l.arm ? -0.2 + sin(t * 1.4 + l.ph) * 0.25 : sin(cyc + l.ph) * 0.25 * move;
        body.position.y = abs(sin(cyc)) * 0.12 * move;
      },
    };
  },

  // an AT-TE: the Republic's six-legged walker, its two hull segments,
  // the mass-driver cannon on top; 22 m long; its legs walk as it goes
  atte(k) {
    const W = '#d6d2c4';
    const G = '#7c7c74';
    const RED = '#9a3a2a';
    const object = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = 7.2;
    object.add(body);
    const seg = (z0, z1, wb, wt, h) =>
      loft([
        { z: z0, pts: trap8(wb * 0.9, wt * 0.9, h * 0.9, 0.5, 0) },
        { z: z0 + 0.8, pts: trap8(wb, wt, h, 0.6, 0) },
        { z: z1 - 0.8, pts: trap8(wb, wt, h, 0.6, 0) },
        { z: z1, pts: trap8(wb * 0.85, wt * 0.8, h * 0.85, 0.5, 0) },
      ]);
    const parts = [part(seg(0.8, 11, 6.4, 5.2, 4.6), { color: W, to: 'paint' }), part(seg(-11, -0.8, 6.0, 5.0, 4.2), { color: W, to: 'paint' }), part(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 12), { rot: [PI / 2, 0, 0], color: G, to: 'metal' })];
    // the cockpit windows, the red markings, the cannon
    parts.push(part(box(3.6, 0.7, 0.3), { at: [0, 0.6, 11.0], color: '#1a1e22', to: 'dark' }));
    for (const s of [-1, 1]) parts.push(part(box(0.2, 1.2, 4), { at: [s * 3.25, 0.4, 7], color: RED, to: 'paint' }));
    parts.push(part(cyl(1.8, 1.6, 1.4, 14), { at: [0, 2.2, 4], color: G, to: 'metal' }));
    parts.push(part(box(2.2, 1.6, 4.4), { at: [0, 3.4, 4.6], color: W, to: 'paint' }));
    parts.push(part(new THREE.CylinderGeometry(0.32, 0.38, 9, 10), { at: [0, 4.9, 9.5], rot: [PI / 2 - 0.2, 0, 0], color: G, to: 'metal' }));
    for (const s of [-1, 1]) parts.push(part(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8), { at: [s * 1.6, -1.2, 11.6], rot: [PI / 2, 0, 0], color: G, to: 'metal' }));
    body.add(k.build(parts, { name: 'atte-body' }));
    const legs = [];
    for (const [z, ph] of [[7.5, 0], [0, 0.5], [-7.5, 0]]) {
      for (const s of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(s * 3.3, 6.4, z);
        hip.add(k.build([part(new THREE.SphereGeometry(0.9, 10, 8), { color: G, to: 'metal' }), rod([0, 0, 0], [s * 2.2, 2.2, 0], 0.5, 0.45, { color: W, to: 'paint' })], { name: 'atte-thigh' }));
        const knee = new THREE.Group();
        knee.position.set(s * 2.2, 2.2, 0);
        knee.add(k.build([part(new THREE.SphereGeometry(0.6, 10, 8), { color: G, to: 'metal' }), rod([0, 0, 0], [s * 0.8, -8.4, 0], 0.42, 0.36, { color: W, to: 'paint' }), part(cyl(1.2, 1.3, 0.5, 12), { at: [s * 0.8, -8.6, 0], color: G, to: 'metal' })], { name: 'atte-shin' }));
        hip.add(knee);
        object.add(hip);
        legs.push({ hip, knee, ph: (ph + (s > 0 ? 0.5 : 0) + (z > 0 ? 0 : z < 0 ? 0 : 0.5)) % 1 });
      }
    }
    let cyc = 0;
    return {
      object,
      solids: [{ box: [0, 0, 5.5, 11.5, 0] }],
      update(t, dt, move = 0) {
        cyc += (dt ?? 0) * 0.45 * move;
        for (const l of legs) {
          const a = (cyc + l.ph) * PI * 2;
          l.hip.rotation.x = sin(a) * 0.22 * move;
          l.knee.rotation.x = -Math.max(0, sin(a + 1)) * 0.25 * move;
        }
        body.position.y = 7.2 + abs(sin(cyc * PI * 2)) * 0.18 * move;
      },
    };
  },

  // a LAAT/i gunship: the troop bay, the bulbous cockpits, the wings swept
  // down with their ball turrets, red nose art; 17.4 m; hovering
  laat(k, { doors = true } = {}) {
    const W = '#cfcbb8';
    const G = '#7e8070';
    const RED = '#a23a2a';
    const H = 2.2;
    const hull = loft([
      { z: -8.7, pts: trap8(1.6, 1.2, 1.8, 0.3, H + 2.6) },
      { z: -5, pts: trap8(3.6, 2.6, 3.4, 0.5, H + 2.2) },
      { z: 3, pts: trap8(4.0, 3.0, 3.8, 0.6, H + 2.0) },
      { z: 5.6, pts: trap8(3.2, 2.4, 3.0, 0.5, H + 1.8) },
    ]);
    const parts = [part(hull, { color: W, to: 'paint' })];
    parts.push(part(new THREE.SphereGeometry(1, 16, 12), { at: [0, H + 1.9, 6.1], scale: [1.6, 1.4, 2.4], color: W, to: 'paint' }));
    for (const [x, y, z] of [[-0.7, H + 2.6, 7.6], [0.7, H + 2.6, 7.6], [0, H + 1.4, 8.1]]) parts.push(part(new THREE.SphereGeometry(0.55, 12, 8), { at: [x, y, z], scale: [1, 0.8, 1.2], color: '#20303a', to: 'glass' }));
    parts.push(part(box(3.3, 0.5, 1.6), { at: [0, H + 1.2, 6.6], color: RED, to: 'paint' }));
    if (doors) for (const s of [-1, 1]) parts.push(part(box(0.1, 2.4, 4.6), { at: [s * 2.02, H + 0.9, 0.4], color: '#2a2a28', to: 'dark' }));
    // the wings, the turrets, the tail
    for (const s of [-1, 1]) {
      parts.push(part(box(7.6, 0.4, 3.4), { at: [s * 5.2, H + 4.0, -2.5], rot: [0, s * -0.12, s * -0.2], color: W, to: 'paint' }));
      parts.push(part(box(0.5, 1.6, 3.6), { at: [s * 8.9, H + 2.6, -3.1], color: G, to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.75, 12, 10), { at: [s * 2.4, H + 4.2, 0.8], color: '#2a3238', to: 'glass' }));
      parts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), { at: [s * 6.8, H + 3.6, -0.6], rot: [PI / 2, 0, 0], color: G, to: 'metal' }));
      parts.push(part(box(0.3, 2.6, 2.2), { at: [s * 1.1, H + 4.2, -7.6], rot: [0, 0, s * 0.3], color: W, to: 'paint' }));
      parts.push(part(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 10), { at: [s * 0.9, H + 2.8, -8.75], rot: [PI / 2, 0, 0], color: lit('#7ad0ff', 2.5), to: 'glow' }));
    }
    const object = k.build(parts, { name: 'laat' });
    const holder = new THREE.Group();
    holder.add(object);
    return {
      object: holder,
      solids: [{ box: [0, 0, 2.2, 8.4, 0] }],
      update(t) {
        object.position.y = sin(t * 1.1) * 0.25;
        object.rotation.z = sin(t * 0.7) * 0.02;
      },
    };
  },

  // a hive spire: the Geonosians' termite-mound towers of red rock, `h`
  // tall, lumpy, holed, glowing in its openings now and then
  hive(k, { h = 60, seed = 1, lights = true } = {}) {
    const r = rng(seed);
    const parts = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const rr = h * 0.16 * (1 - t * 0.8);
      parts.push(part(lump(seed * 13 + i, 0.18), { at: [(r() - 0.5) * rr * 0.3, h * t + rr * 0.4, (r() - 0.5) * rr * 0.3], scale: [rr * 2.2, (h / n) * 1.9, rr * 2.2], color: vary('#a8663e', r, 0.08), to: 'redrock' }));
    }
    parts.push(part(new THREE.ConeGeometry(h * 0.04, h * 0.2, 7), { at: [0, h * 1.0, 0], color: '#9a5a36', to: 'redrock' }));
    if (lights)
      for (let i = 0; i < 6; i++) {
        const t = 0.15 + r() * 0.7;
        const a = r() * PI * 2;
        const rr = h * 0.16 * (1 - t * 0.8) * 1.02;
        parts.push(part(new THREE.SphereGeometry(rr * 0.18, 8, 6), { at: [sin(a) * rr, h * t, cos(a) * rr], scale: [1, 1.5, 0.5], rot: [0, a, 0], color: r() < 0.5 ? lit('#ffb05a', 2) : '#2a1a14', to: r() < 0.5 ? 'glow' : 'dark' }));
      }
    return { object: k.build(parts, { name: 'hive' }), solids: [{ circle: [0, 0, h * 0.2] }] };
  },

  // the droid foundry: a mound of hive rock with furnaces glowing in its
  // mouths, gantries out of it, and droid parts by the crate
  foundry(k) {
    const r = rng(29);
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      const d = i ? 14 : 0;
      const s = i ? 18 + r() * 8 : 30;
      parts.push(part(lump(70 + i, 0.2), { at: [sin(a) * d, s * 0.35, cos(a) * d - 8], scale: [s * 1.3, s * 1.2, s * 1.1], color: vary('#9a5a36', r, 0.08), to: 'redrock' }));
    }
    for (const [x, h] of [[-8, 52], [6, 44]]) {
      parts.push(part(cyl(2.8, 2.2, h, 12), { at: [x, 0, -16], color: '#5a3a2a', to: 'metal' }));
      parts.push(part(cyl(2.25, 2.25, 0.8, 12), { at: [x, h, -16], color: lit('#ff7a2a', 2.4), to: 'glow' }));
    }
    // the furnace mouths
    for (const [x, y, w] of [[-9, 0, 10], [10, 0, 8], [0, 12, 7]]) {
      parts.push(part(new THREE.SphereGeometry(w * 0.5, 12, 8), { at: [x, y + w * 0.35, 15 - y * 0.5], scale: [1, 0.9, 0.6], color: lit('#ff8a2a', 2.8), to: 'glow' }));
      parts.push(part(new THREE.TorusGeometry(w * 0.52, w * 0.12, 6, 14, PI), { at: [x, y + w * 0.35, 15.6 - y * 0.5], color: '#5a3422', to: 'redrock' }));
    }
    // the gantries and the conveyor out of it, and its crates of parts
    for (const s of [-1, 1]) {
      parts.push(part(box(3, 1, 30), { at: [s * 16, 8, 14], rot: [0.12, s * 0.3, 0], color: '#5a4a3e', to: 'metal' }));
      for (let i = 0; i < 4; i++) parts.push(part(box(0.6, 8, 0.6), { at: [s * (16 + i * 2.2), 0, 4 + i * 7], color: '#4a3a30', to: 'metal' }));
    }
    for (let i = 0; i < 8; i++) parts.push(part(box(1.4, 1.4, 1.4), { at: [-12 + (i % 4) * 3, Math.floor(i / 4) * 1.4, 22 + (i % 2) * 2], rot: [0, r(), 0], color: '#a89870', to: 'paint' }));
    return { object: k.build(parts, { name: 'foundry' }), solids: [{ circle: [0, -8, 30] }, { circle: [14, 0, 14] }, { circle: [-14, 0, 14] }, { box: [-7.5, 23, 6.5, 2.5, 0] }] };
  },

  // Count Dooku's solar sailer: a bronze pod under its great lattice sail
  solarsailer(k) {
    const BRONZE = '#9a7448';
    const parts = [
      part(new THREE.SphereGeometry(3.2, 20, 14), { at: [0, 4, 0], scale: [1, 0.8, 1.5], color: BRONZE, to: 'metal' }),
      part(new THREE.SphereGeometry(1.2, 12, 8), { at: [0, 4.6, 4.4], scale: [1, 0.7, 1], color: '#2a2018', to: 'glass' }),
      part(cyl(0.3, 0.2, 9, 8), { at: [0, 6, -2], color: BRONZE, to: 'metal' }),
    ];
    for (const [x, z] of [[-2, 2], [2, 2], [0, -3]]) parts.push(rod([x, 0, z], [x * 0.6, 2.4, z * 0.6], 0.15, 0.15, { color: '#5a4430', to: 'metal' }));
    const object = k.build(parts, { name: 'solarsailer' });
    const tex = k.own(
      canvasTexture(128, (c, sz) => {
        c.clearRect(0, 0, sz, sz);
        c.fillStyle = 'rgba(60,40,24,0.55)';
        c.fillRect(0, 0, sz, sz);
        c.strokeStyle = 'rgba(200,150,90,0.9)';
        c.lineWidth = 2;
        for (let i = 0; i <= sz; i += 16) {
          c.beginPath();
          c.moveTo(i, 0);
          c.lineTo(i, sz);
          c.moveTo(0, i);
          c.lineTo(sz, i);
          c.stroke();
        }
      }),
    );
    tex.repeat.set(4, 2);
    const sail = new THREE.Mesh(k.own(new THREE.SphereGeometry(11, 24, 10, 0, PI * 2, 0, PI * 0.42)), k.own(new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.6, metalness: 0.3 })));
    sail.scale.set(1, 0.7, 1.2);
    sail.position.set(0, 3, -4);
    sail.rotation.x = -0.35;
    object.add(sail);
    return { object, solids: [{ circle: [0, 0, 3.6] }] };
  },

  // Dooku's secret hangar: a spire of rock with a dark mouth at its foot
  // (the mesa it's cut into is the hive model behind it: sites/core.js)
  geohangar(k) {
    const parts = [];
    parts.push(part(new THREE.CylinderGeometry(9, 9, 2, 20, 1, false, 0, PI).rotateZ(PI / 2).rotateY(PI / 2), { at: [0, 0, -4], scale: [1, 1.1, 1], color: '#140c08', to: 'dark' }));
    parts.push(part(box(18, 10, 2), { at: [0, 0, -5], color: '#140c08', to: 'dark' }));
    parts.push(part(cyl(16, 16, 0.4, 28), { at: [0, 0, 12], color: '#7a5a42', to: 'metal' }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2;
      parts.push(part(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 6), { at: [sin(a) * 15.4, 0.45, 12 + cos(a) * 15.4], color: lit('#ffb05a', 3), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'geohangar' }), solids: [{ circle: [-10, -16, 11] }, { circle: [10, -16, 11] }, { circle: [0, -24, 12] }] };
  },

  // a Separatist core ship, set down on the plain: a sphere 220 m across
  // on its landing legs; lifts off now and then
  coresphere(k, { rise = 0 } = {}) {
    const R = 110;
    const parts = [
      part(new THREE.SphereGeometry(R, 40, 28), { at: [0, R + 22, 0], color: '#8a8272', to: 'paint' }),
      part(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 8, 40), { at: [0, R + 22, 0], color: '#5e584e', to: 'metal' }),
      part(new THREE.CylinderGeometry(R * 1.015, R * 1.015, 1.5, 40), { at: [0, R + 30, 0], color: lit('#ffd9a0', 1.3), to: 'glow' }),
      part(new THREE.SphereGeometry(R * 0.3, 20, 12), { at: [0, 26, 0], scale: [1, 0.3, 1], color: lit('#ff9a5a', rise ? 2.4 : 0.6), to: 'glow' }),
    ];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      parts.push(rod([sin(a) * R * 0.6, R * 0.5, cos(a) * R * 0.6], [sin(a) * R * 0.95, 0, cos(a) * R * 0.95], 3, 2.2, { color: '#5e584e', to: 'metal' }));
      parts.push(part(cyl(8, 9, 2, 12), { at: [sin(a) * R * 0.95, 0, cos(a) * R * 0.95], color: '#4a453e', to: 'metal' }));
    }
    const object = k.build(parts, { name: 'coresphere', shadows: false });
    const holder = new THREE.Group();
    holder.add(object);
    return {
      object: holder,
      update(t) {
        if (rise) object.position.y = (t * rise) % 900;
      },
    };
  },

  // the Republic's forward command post: a low bunker, the holotable with
  // the battle over it in blue light, antennae, crates
  commandpost(k) {
    const parts = [
      part(box(14, 3, 9), { at: [0, 0, -6], color: '#c8c4b4', to: 'paint' }),
      part(box(15, 0.6, 10), { at: [0, 3, -6], color: '#8a8a7c', to: 'metal' }),
      part(cyl(1.8, 2.0, 1.1, 18), { at: [0, 0, 3], color: '#5a5c58', to: 'metal' }),
      part(cyl(1.7, 1.7, 0.06, 18), { at: [0, 1.12, 3], color: lit('#6ac8ff', 2), to: 'glow' }),
      rod([5, 3.6, -8], [5, 12, -8], 0.08, 0.05, { color: '#5a5c58', to: 'metal' }),
      part(new THREE.SphereGeometry(1.4, 12, 8, 0, PI * 2, 0, PI * 0.4), { at: [-4, 3.6, -8], rot: [-0.9, 0.6, 0], color: '#d8d8d0', to: 'paint' }),
    ];
    parts.push(part(box(2.2, 1.6, 0.2), { at: [0, 1.4, -1.4], color: '#20303a', to: 'glass' }));
    for (let i = 0; i < 5; i++) parts.push(part(box(1.2, 1.2, 1.2), { at: [-6 + i * 1.4, 0, 4 + (i % 2)], rot: [0, i, 0], color: '#a8a48a', to: 'paint' }));
    const object = k.build(parts, { name: 'commandpost' });
    // the hologram over the table: the battle, in blue light, turning
    const holo = new THREE.Mesh(k.own(new THREE.SphereGeometry(1.4, 14, 8, 0, PI * 2, 0, PI / 2)), k.own(new THREE.MeshBasicMaterial({ color: lit('#6ac8ff', 1.6), wireframe: true, transparent: true, opacity: 0.6, toneMapped: false })));
    holo.position.set(0, 1.4, 3);
    holo.scale.set(1, 0.6, 1);
    object.add(holo);
    return {
      object,
      solids: [{ box: [0, -6, 7, 4.5, 0] }, { circle: [0, 3, 2] }],
      update(t) {
        holo.rotation.y = t * 0.4;
      },
    };
  },

  // the command post's holotable on its own, the battle turning over it in
  // blue light (in front of the audit lane's model of the command post,
  // which has no table)
  holotable(k) {
    const parts = [
      part(cyl(1.8, 2.0, 1.1, 18), { color: '#5a5c58', to: 'metal' }),
      part(cyl(1.7, 1.7, 0.06, 18), { at: [0, 1.12, 0], color: lit('#6ac8ff', 2), to: 'glow' }),
    ];
    const object = k.build(parts, { name: 'holotable' });
    const holo = new THREE.Mesh(k.own(new THREE.SphereGeometry(1.4, 14, 8, 0, PI * 2, 0, PI / 2)), k.own(new THREE.MeshBasicMaterial({ color: lit('#6ac8ff', 1.6), wireframe: true, transparent: true, opacity: 0.6, toneMapped: false })));
    holo.position.set(0, 1.4, 0);
    holo.scale.set(1, 0.6, 1);
    object.add(holo);
    return {
      object,
      solids: [{ circle: [0, 0, 2] }],
      update(t) {
        holo.rotation.y = t * 0.4;
      },
    };
  },

  // Geonosis's ring, a pale band across the sky from one horizon to the
  // other (far off, past the fog)
  skyring(k, { az = 0.6, el = 0.62, width = 0.05, dist = 9000 } = {}) {
    const tex = k.own(
      canvasTexture(256, (c, sz) => {
        c.clearRect(0, 0, sz, sz);
        const r = rng(3);
        for (let x = 0; x < sz; x++) {
          const a = 0.25 + 0.5 * r() * r() + (x % 37 < 3 ? -0.2 : 0);
          c.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`;
          c.fillRect(x, 0, 1, sz);
        }
      }),
    );
    const n = 96;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const a = az - PI / 2 - 0.15 + (i / n) * (PI + 0.3);
      const e = Math.atan(Math.tan(el) * cos(a - az));
      for (const [j, d] of [[0, -width / 2], [1, width / 2]]) {
        const ee = e + d;
        pos.push(sin(a) * cos(ee) * dist, sin(ee) * dist, cos(a) * cos(ee) * dist);
        uv.push(j, i / 8);
      }
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = k.own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, k.own(new THREE.MeshBasicMaterial({ map: tex, color: '#f2d2b0', transparent: true, opacity: 0.55, depthWrite: false, fog: false, side: THREE.DoubleSide })));
    m.frustumCulled = false;
    m.renderOrder = -5;
    const object = new THREE.Group();
    object.add(m);
    return { object };
  },
};

// Things scattered by the dozen (drawn instanced)
export const SCATTER = {
  // a lone Naboo tree on the plains: a trunk and a broad, layered canopy
  nabootree(k, { seed = 4 } = {}) {
    const r = rng(seed);
    const trunk = [part(cyl(0.5, 0.32, 7, 8), { color: '#5e4a36', to: 'bark' })];
    for (let j = 0; j < 3; j++) {
      const b = (j / 3) * PI * 2;
      trunk.push(rod([0, 4, 0], [sin(b) * 2.4, 6.6, cos(b) * 2.4], 0.2, 0.08, { color: '#56442f', to: 'bark' }));
    }
    // (a broad crown of leaf cards in lobes, on smooth cores)
    const leaves = [];
    for (let j = 0; j < 5; j++) {
      const b = (j / 5) * PI * 2;
      const o = j ? 2.4 : 0;
      const s = j ? 4 + r() : 5.5;
      leaves.push(...canopy([sin(b) * o, 7 + r() * 1.2, cos(b) * o], s, { flat: 0.55, color: vary(['#566e3c', '#4c6236', '#62783f'][j % 3], r, 0.06), seed: seed * 11 + j }));
    }
    const by = (to) => leaves.filter((p) => p.to === to);
    return {
      parts: [
        { geometry: k.geometry(trunk), material: k.mats.bark },
        { geometry: k.geometry(by('foliage')), material: k.mats.foliage },
        { geometry: k.geometry(by('crown')), material: k.mats.crown },
      ],
      radius: 0.6,
    };
  },
  // a hive spire, small, by the hundred across Geonosis's plains
  // (Geonosis's red rock, wearing the redrock scan)
  spire(k, { seed = 2, color = '#a8663e' } = {}) {
    const r = rng(seed);
    const list = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const rr = 4 * (1 - t * 0.78);
      list.push(part(lump(seed * 17 + i, 0.2, 10, 7), { at: [(r() - 0.5) * 1.2, 30 * t + rr * 0.3, (r() - 0.5) * 1.2], scale: [rr * 2, 12, rr * 2], color: vary(color, r, 0.08), to: 'redrock' }));
    }
    list.push(part(new THREE.ConeGeometry(1, 7, 6), { at: [0, 31, 0], color, to: 'redrock' }));
    return { parts: [{ geometry: k.geometry(list), material: k.mats.redrock }], radius: 3.4 };
  },
  // a storm buoy off Tipoca City: a float, a mast, its light
  buoy(k) {
    const list = [part(cyl(0.9, 0.6, 1.6, 10), { at: [0, -0.8, 0], color: '#d8dde2', to: 'paint' }), part(cyl(0.12, 0.08, 3, 6), { at: [0, 0.8, 0], color: '#8a949e', to: 'paint' })];
    const glow = [part(new THREE.SphereGeometry(0.3, 8, 6), { at: [0, 3.9, 0], color: lit('#ff4a3a', 3), to: 'glow' })];
    return { parts: [{ geometry: k.geometry(list), material: k.mats.paint }, { geometry: k.geometry(glow), material: k.mats.glow, shadow: false }], radius: null };
  },
  // a tuft of long grass, some of it in flower
  grass(k, { color = '#6f9a3e', flower = null } = {}) {
    const r = rng(7);
    const blades = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      blades.push(part(new THREE.ConeGeometry(0.05, 0.7 + r() * 0.4, 3).translate(0, 0.4, 0), { at: [sin(a) * 0.12, 0, cos(a) * 0.12], rot: [cos(a) * 0.35, 0, -sin(a) * 0.35], color: vary(color, r, 0.12), to: 'leaf' }));
    }
    if (flower) for (let i = 0; i < 3; i++) blades.push(part(new THREE.SphereGeometry(0.07, 6, 4), { at: [sin(i * 2.1) * 0.3, 0.75 + i * 0.08, cos(i * 2.1) * 0.3], color: flower, to: 'leaf' }));
    return { parts: [{ geometry: k.geometry(blades), material: k.mats.leaf, shadow: false }], radius: null };
  },
};
