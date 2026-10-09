// A hand laid out in code, for the tests of scripts/lib/hand-geometry.mjs
// and scripts/hands-extend.mjs: a right hand in its bone's space (cm), the
// fingers out along +y from the knuckles at y = 10, the thumb toward +z, the
// palm facing −x (thumb × along), so the back is +x; as a mesh (points and
// triangles), its pieces named.
//
//   FRAME: { along, thumb, normal } (normal out of the palm, as grip.js has it)
//   hand({ r = 0.6, thumb = true, fused = false }) → { pts, tris, fingers:
//     { index, middle, ring, pinky } | { slab }, thumb: [i…] }: r the
//     fingers' radius (they're 2 apart: 1 touches), fused one slab past
//     the knuckles (a mitten, or a glove sewn as one); thumb true (out past
//     the index's edge, as a hand laid flat has it), 'under' (hung under
//     the palm, toward the fingers, as a relaxed hand has it) or false
//   tube(pts, tris, line, { r, rings, m, section }): a tube round line(t)

import * as THREE from 'three';

const V = THREE.Vector3;

export const FRAME = { along: new V(0, 1, 0), thumb: new V(0, 0, 1), normal: new V(-1, 0, 0) };

// a tube round a centre line (a function of t in 0…1), `rings` rings of `m`
// points `r` from it, with the triangles between neighbouring rings
export function tube(pts, tris, line, { r, rings = 13, m = 8, section = null }) {
  const base = pts.length;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const c = line(t);
    const d = line(Math.min(1, t + 0.01)).sub(line(Math.max(0, t - 0.01))).normalize();
    const u = new V(1, 0, 0).addScaledVector(d, -d.x).normalize();
    const w = new V().crossVectors(d, u);
    for (let k = 0; k < m; k++) {
      const a = (2 * Math.PI * k) / m;
      const [x, z] = section ? section(k / m) : [Math.cos(a) * r, Math.sin(a) * r];
      pts.push(c.clone().addScaledVector(u, x).addScaledVector(w, z));
    }
  }
  for (let i = 0; i + 1 < rings; i++)
    for (let k = 0; k < m; k++) {
      const a = base + i * m + k;
      const b = base + i * m + ((k + 1) % m);
      tris.push([a, b, a + m], [b, b + m, a + m]);
    }
}

// the palm: a box 2…10 out, 8 wide, 2 thick, as a grid on its two faces
function palm(pts, tris) {
  for (const x of [-1, 1]) {
    const base = pts.length;
    for (let y = 2; y <= 10; y++) for (let z = -4; z <= 4; z++) pts.push(new V(x, y, z));
    for (let y = 0; y < 8; y++)
      for (let z = 0; z < 8; z++) {
        const a = base + y * 9 + z;
        tris.push([a, a + 1, a + 9], [a + 1, a + 10, a + 9]);
      }
  }
}

// four fingers (index at +z) of radius r, 2 apart, from the knuckles at y = 10
export function hand({ r = 0.6, thumb = true, fused = false } = {}) {
  const pts = [];
  const tris = [];
  palm(pts, tris);
  const fingers = {};
  if (fused) {
    // one slab past the knuckles: a mitten, or a glove sewn as one
    const start = pts.length;
    const per = 24;
    const section = (f) => {
      const s = f * 2 * (7.4 + 1.4);
      if (s < 7.4) return [-0.7, -3.7 + s];
      if (s < 8.8) return [-0.7 + (s - 7.4), 3.7];
      if (s < 16.2) return [0.7, 3.7 - (s - 8.8)];
      return [0.7 - (s - 16.2), -3.7];
    };
    tube(pts, tris, (t) => new V(0, 10 + 6 * t, 0), { r: 0, m: per, section });
    fingers.slab = [...Array(pts.length - start).keys()].map((i) => start + i);
  } else {
    for (const [name, z, len] of [
      ['index', 3, 6],
      ['middle', 1, 6.5],
      ['ring', -1, 6],
      ['pinky', -3, 5],
    ]) {
      const start = pts.length;
      tube(pts, tris, (t) => new V(0, 10 + len * t, z), { r });
      fingers[name] = [...Array(pts.length - start).keys()].map((i) => start + i);
    }
  }
  let thumbIdx = [];
  if (thumb) {
    const start = pts.length;
    const under = thumb === 'under';
    const dir = under ? new V(-0.75, 0.6, -0.25).normalize() : new V(0, 0.6, 0.8);
    tube(pts, tris, (t) => (under ? new V(-1.6, 3.5, 2.8) : new V(-0.4, 3, 4.6)).addScaledVector(dir, 5 * t), { r: 0.8, rings: 9 });
    thumbIdx = [...Array(pts.length - start).keys()].map((i) => start + i);
  }
  return { pts, tris, fingers, thumb: thumbIdx };
}
