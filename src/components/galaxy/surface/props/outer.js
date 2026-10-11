// The Outer Rim worlds' own props (sites/outer.js): Mandalore's, as The
// Mandalorian shows it after the Purge. Sundari's great dome, dark grey and
// broken open on one side; the angular towers of the city under it, their
// tops sheared off; and the glass the bombing left of the plains.

import * as THREE from 'three';
import { part, upright } from '../kitCore';
import { rng } from '../noise';

const { PI } = Math;

// a surface with its triangles turned to face the other way (the inside of a
// shell or a wall, seen from within)
const inward = (g) => {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  g.computeVertexNormals();
  return g;
};

export const PROPS = {
  // Sundari's dome (r: its radius): twelve sectors of dark grey shell over a
  // ringed foot, the ribs between them; `broken` sectors are torn away down
  // to a jagged band, the way in. Walls all round but there.
  sundaridome(k, { r = 46, h = 30, broken = [4, 5], seed = 3 } = {}) {
    const rand = rng(seed);
    const shell = '#57534d';
    const rib = '#3e3c39';
    const foot = '#6a665e';
    const parts = [];
    const sectors = 12;
    const step = (2 * PI) / sectors;
    const k2 = h / r; // (squashed: a dome lower than it is wide)
    for (let i = 0; i < sectors; i++) {
      const gone = broken.includes(i);
      // a broken sector keeps a band at the foot, ragged: a fifth to a third of the way up
      const top = gone ? PI / 2 - (0.18 + rand() * 0.16) * (PI / 2) : 0;
      const outer = new THREE.SphereGeometry(r, 6, 10, i * step, step, top, PI / 2 - top);
      outer.scale(1, k2, 1);
      parts.push(part(outer, { color: shell, to: 'concrete' }));
      const inner = inward(new THREE.SphereGeometry(r - 0.8, 6, 10, i * step, step, top, PI / 2 - top));
      inner.scale(1, (h - 0.8) / (r - 0.8), 1);
      parts.push(part(inner, { color: '#4a4743', to: 'concrete' }));
      // the rib on its edge, where the shell still stands
      if (!gone && !broken.includes((i + sectors - 1) % sectors)) {
        const arc = new THREE.TorusGeometry(r + 0.3, 0.7, 6, 18, PI / 2);
        arc.scale(1, k2, 1);
        // (a sphere's longitude φ runs from (-x) round to (+z): the arc, which
        // rises from +x, turned to meet it)
        parts.push(part(arc, { rot: [0, PI - i * step, 0], color: rib, to: 'metal' }));
      }
    }
    // the foot: a low wall the shell stands on, open where it's broken (a
    // cylinder's angle θ runs from +z round to +x: sector i's is φ - π/2)
    for (let i = 0; i < sectors; i++) {
      if (broken.includes(i)) continue;
      const wall = (rr) => new THREE.CylinderGeometry(rr, rr, 3.2, 4, 1, true, i * step - PI / 2, step).translate(0, 1.6, 0);
      parts.push(part(wall(r + 1.2), { color: foot, to: 'concrete' }));
      parts.push(part(inward(wall(r - 0.6)), { color: foot, to: 'concrete' }));
    }
    // walls to bump into round it, but not where it's broken open
    const solids = [];
    for (let phi = 0; phi < 2 * PI; phi += 3 / r) {
      if (broken.includes(Math.floor(phi / step) % sectors)) continue;
      solids.push({ circle: [-(r + 0.3) * Math.cos(phi), (r + 0.3) * Math.sin(phi), 1.8] });
    }
    return { object: k.build(parts, { name: 'sundaridome' }), solids };
  },
};

// Lothal's rock spires (Rebels): rounded fingers of banded stone standing
// out of the grass, `h` tall, `r` across the foot, each a little bulged and
// leaning; the layers lighter and darker up it, warm where the sun is
// (the grain of the rock scan over them). Walls to bump into at the foot.
PROPS.lothspire = (k, { h = 20, r = 4.6, seed = 1, color = '#a59684' } = {}) => {
  const rand = rng(seed);
  const rings = 20;
  const bulge = 0.08 + rand() * 0.08;
  const ph = rand() * 6;
  const prof = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    // (a finger: steep sides, a rounded top, swelling and pinching as it goes)
    const w = r * (1 - 0.62 * t ** 1.7) * (1 + bulge * Math.sin(t * 9 + ph)) * Math.sqrt(Math.max(0, 1 - Math.max(0, (t - 0.86) / 0.14) ** 2));
    prof.push([Math.max(0.05, w), t * h]);
  }
  const g = upright(prof, 22);
  const lean = [(rand() - 0.5) * h * 0.12, (rand() - 0.5) * h * 0.12];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    p.setX(i, p.getX(i) + lean[0] * t * t);
    p.setZ(i, p.getZ(i) + lean[1] * t * t);
  }
  g.computeVertexNormals();
  // (the strata: bands a metre or two thick, some paler, some darker)
  const shade = (x, y) => 0.74 + 0.16 * Math.sin(y * 0.9 + ph) + 0.1 * Math.sin(y * 2.3 + ph * 2) + 0.08 * (y / h);
  return { object: k.build([part(g, { at: [0, -0.6, 0], color, to: 'rock', shade })], { name: 'lothspire' }), solids: [{ circle: [0, 0, r * 0.92] }] };
};

export const SCATTER = {
  // the glass the bombing made of the sand: shards of it standing up out of
  // the ground, catching the light (walked through)
  glassshard(k) {
    const g = new THREE.ConeGeometry(0.35, 1.6, 4, 1).translate(0, 0.55, 0).rotateZ(0.35);
    const g2 = new THREE.ConeGeometry(0.22, 0.9, 4, 1).translate(0.4, 0.3, 0.2).rotateZ(-0.5);
    const color = new THREE.Color('#8fa6a8');
    const paint = (geo) => {
      const n = geo.attributes.position.count;
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [color.r, color.g, color.b][i % 3]), 3));
      return geo;
    };
    return { parts: [{ geometry: k.own(paint(g)), material: k.mats.glass }, { geometry: k.own(paint(g2)), material: k.mats.glass }], radius: null };
  },
};
