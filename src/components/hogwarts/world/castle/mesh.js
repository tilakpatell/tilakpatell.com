// The castle’s geometry, gathered by material: every part (parts.js) lays
// its faces into one bucket a material, and the buckets come out as one
// merged geometry each, so the whole castle near is a handful of draws.
// Faces are written straight into arrays (no three geometry made and thrown
// away a part), triangles unindexed, each vertex carrying:
//
//   position, normal
//   uv      metres along the surface (a slate is the same size on every roof)
//   color   the part’s tone, multiplied into the material’s (weathering, a
//           darker plinth, a paler tower), linear
//   aLit    a window’s threshold (glass only): it lights when the night is
//           past it, so the castle comes on one window at a time
//
//   createMesh() → {
//     tone(rgb) / lit(k)    the tone and threshold the next faces take
//     quad(mat, a, b, c, d, { u, v })   four corners (counter-clockwise seen
//                           from outside), uv spans in metres
//     tri(mat, a, b, c)
//     box(mat, { at: [x, y, z], size: [w, h, d], turn, bottom })   at: the middle of its foot
//     ring(mat, { at, r, r2, h, sides, from, to, cap })   a round wall (an open
//                           cylinder, or a part of one between angles), r2 its top’s radius
//     lathe(mat, { at, profile: [[r, y], …], sides })   a turned shape (a cone’s
//                           bell, a finial), its profile from the foot up
//     shape(mat, { at, turn, outline: [[x, y], …], depth, out })   a flat polygon
//                           (a window’s pane, a gable) standing up, facing +z turned by `turn`
//     beam(mat, a, b, w, h)   a square-sectioned beam between two points (a brace, a rod)
//     count(mat) → triangles so far
//     geometries() → { [mat]: BufferGeometry }  }
//   archOutline(w, h, { pointed, segs }) → the outline of an arched opening, [x, y] from its sill

import * as THREE from 'three';

export function createMesh() {
  const buckets = new Map();
  let tone = [1, 1, 1];
  let lit = 0;
  const bucket = (mat) => {
    let b = buckets.get(mat);
    if (!b) buckets.set(mat, (b = { p: [], n: [], uv: [], c: [], lit: [] }));
    return b;
  };
  const push = (b, p, n, uv) => {
    b.p.push(p[0], p[1], p[2]);
    b.n.push(n[0], n[1], n[2]);
    b.uv.push(uv[0], uv[1]);
    b.c.push(tone[0], tone[1], tone[2]);
    b.lit.push(lit);
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => {
    const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const len = (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  const api = {
    tone(rgb) {
      tone = rgb;
      return api;
    },
    lit(k) {
      lit = k;
      return api;
    },
    tri(mat, a, b, c, uvs = [[0, 0], [1, 0], [0, 1]]) {
      const n = norm(cross(sub(b, a), sub(c, a)));
      const k = bucket(mat);
      push(k, a, n, uvs[0]);
      push(k, b, n, uvs[1]);
      push(k, c, n, uvs[2]);
    },
    // a, b along the bottom, c, d along the top (d over a); uv in metres unless given
    quad(mat, a, b, c, d, { u = len(sub(b, a)), v = len(sub(d, a)), u0 = 0, v0 = 0 } = {}) {
      const n = norm(cross(sub(b, a), sub(d, a)));
      const k = bucket(mat);
      const A = [u0, v0];
      const B = [u0 + u, v0];
      const C = [u0 + u, v0 + v];
      const D = [u0, v0 + v];
      push(k, a, n, A);
      push(k, b, n, B);
      push(k, c, n, C);
      push(k, a, n, A);
      push(k, c, n, C);
      push(k, d, n, D);
    },
    box(mat, { at, size, turn = 0, bottom = false, top = true }) {
      const [x, y, z] = at;
      const [w, h, d] = size;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      // (corners turned about the foot’s middle: u along x, v along z)
      const P = (u, yy, v) => [x + u * c + v * s, y + yy, z - u * s + v * c];
      const hw = w / 2;
      const hd = d / 2;
      const q = (a, b, cc, dd) => api.quad(mat, a, b, cc, dd);
      q(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd)); // +z
      q(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd)); // −z
      q(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd)); // +x
      q(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd)); // −x
      if (top) q(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd));
      if (bottom) q(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd));
    },
    ring(mat, { at, r, r2 = r, h, sides = 16, from = 0, to = Math.PI * 2, cap = false, inside = false }) {
      const [x, y, z] = at;
      const k = bucket(mat);
      const slant = Math.hypot(r - r2, h);
      const ny = (r - r2) / slant;
      const nr = h / slant;
      for (let i = 0; i < sides; i++) {
        const a0 = from + ((to - from) * i) / sides;
        const a1 = from + ((to - from) * (i + 1)) / sides;
        const P = (a, rr, yy) => [x + Math.sin(a) * rr, y + yy, z + Math.cos(a) * rr];
        const N = (a) => (inside ? [-Math.sin(a) * nr, -ny, -Math.cos(a) * nr] : [Math.sin(a) * nr, ny, Math.cos(a) * nr]);
        const u0 = a0 * r;
        const u1 = a1 * r;
        const v = [
          [P(a0, r, 0), N(a0), [u0, 0]],
          [P(a1, r, 0), N(a1), [u1, 0]],
          [P(a1, r2, h), N(a1), [u1, slant]],
          [P(a0, r2, h), N(a0), [u0, slant]],
        ];
        const order = inside ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
        for (const o of order) push(k, v[o][0], v[o][1], v[o][2]);
        if (cap && r2 > 0) {
          const c0 = [x, y + h, z];
          push(k, c0, [0, 1, 0], [0, 0]);
          push(k, P(a0, r2, h), [0, 1, 0], [Math.sin(a0) * r2, Math.cos(a0) * r2]);
          push(k, P(a1, r2, h), [0, 1, 0], [Math.sin(a1) * r2, Math.cos(a1) * r2]);
        }
      }
    },
    lathe(mat, { at, profile, sides = 16 }) {
      const [x, y, z] = at;
      const k = bucket(mat);
      // each profile point’s normal from the slope on either side of it, smooth up the shape
      const slopes = profile.map((_, i) => {
        const a = profile[Math.max(0, i - 1)];
        const b = profile[Math.min(profile.length - 1, i + 1)];
        const dr = b[0] - a[0];
        const dy = b[1] - a[1];
        const l = Math.hypot(dr, dy) || 1;
        return [dy / l, -dr / l]; // (outward, up)
      });
      let run = 0;
      const vs = [0];
      for (let i = 1; i < profile.length; i++) vs.push((run += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1])));
      const r0 = profile[0][0];
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2;
        const a1 = ((i + 1) / sides) * Math.PI * 2;
        for (let j = 0; j < profile.length - 1; j++) {
          const pt = (a, jj) => [x + Math.sin(a) * profile[jj][0], y + profile[jj][1], z + Math.cos(a) * profile[jj][0]];
          const nm = (a, jj) => [Math.sin(a) * slopes[jj][0], slopes[jj][1], Math.cos(a) * slopes[jj][0]];
          // (u round the foot’s circle: the slates narrow toward the top, as a cone’s do)
          const uv = (a, jj) => [a * r0, vs[jj]];
          const q = [
            [pt(a0, j), nm(a0, j), uv(a0, j)],
            [pt(a1, j), nm(a1, j), uv(a1, j)],
            [pt(a1, j + 1), nm(a1, j + 1), uv(a1, j + 1)],
            [pt(a0, j + 1), nm(a0, j + 1), uv(a0, j + 1)],
          ];
          for (const o of [0, 1, 2, 0, 2, 3]) push(k, q[o][0], q[o][1], q[o][2]);
        }
      }
    },
    // a flat outline standing in a vertical plane at `at`, its face toward
    // +z turned by `turn` (and `out` metres out along it), filled as a fan
    // from its first point (convex outlines: a pane, a gable, an arch)
    shape(mat, { at, turn = 0, outline, out = 0, back = false }) {
      const [x, y, z] = at;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      const n = back ? [-s, 0, -c] : [s, 0, c];
      const P = ([u, v]) => [x + u * c + s * out, y + v, z - u * s + c * out];
      const k = bucket(mat);
      for (let i = 1; i < outline.length - 1; i++) {
        const tri = back ? [outline[0], outline[i + 1], outline[i]] : [outline[0], outline[i], outline[i + 1]];
        for (const p of tri) push(k, P(p), n, p);
      }
    },
    // a beam of square section from a to b (a brace, a rafter, a rod), its ends capped
    beam(mat, a, b, w, h = w) {
      const d = norm(sub(b, a));
      const ref = Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
      const sx = norm(cross(d, ref));
      const up = cross(sx, d);
      const at = (p, i, j) => [p[0] + sx[0] * i * (w / 2) + up[0] * j * (h / 2), p[1] + sx[1] * i * (w / 2) + up[1] * j * (h / 2), p[2] + sx[2] * i * (w / 2) + up[2] * j * (h / 2)];
      const L = len(sub(b, a));
      const round = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
      for (let k = 0; k < 4; k++) {
        const [i0, j0] = round[k];
        const [i1, j1] = round[(k + 1) % 4];
        api.quad(mat, at(a, i0, j0), at(a, i1, j1), at(b, i1, j1), at(b, i0, j0), { u: w, v: L });
      }
      api.quad(mat, at(b, 1, 1), at(b, 1, -1), at(b, -1, -1), at(b, -1, 1), { u: w, v: h });
      api.quad(mat, at(a, -1, 1), at(a, -1, -1), at(a, 1, -1), at(a, 1, 1), { u: w, v: h });
    },
    count: (mat) => (buckets.get(mat)?.p.length ?? 0) / 9,
    get materials() {
      return [...buckets.keys()];
    },
    geometries() {
      const out = {};
      for (const [mat, b] of buckets) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
        if (b.lit.some((v) => v !== 0)) g.setAttribute('aLit', new THREE.Float32BufferAttribute(b.lit, 1));
        g.computeBoundingSphere();
        g.computeBoundingBox();
        out[mat] = g;
      }
      return out;
    },
  };
  return api;
}

// An arched opening’s outline from the middle of its sill, counter-clockwise:
// straight sides to the springing, then a pointed (gothic: two arcs struck
// from the far side’s springing) or a round head, `segs` steps a side
export function archOutline(w, h, { pointed = true, segs = 4 } = {}) {
  const hw = w / 2;
  const spring = Math.max(0, h - (pointed ? w * 0.86 : hw));
  const out = [[0, 0], [hw, 0], [hw, spring]];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    if (pointed) {
      // (an arc of radius w centred on the far springing, from this side up to the point)
      const a = (Math.PI / 3) * t;
      out.push([-hw + w * Math.cos(a), spring + w * Math.sin(a)]);
    } else {
      const a = (Math.PI / 2) * t;
      out.push([hw * Math.cos(a), spring + hw * Math.sin(a)]);
    }
  }
  out.push([0, pointed ? spring + w * Math.sin(Math.PI / 3) : spring + hw]);
  for (let i = segs - 1; i > 0; i--) {
    const [px, py] = out[2 + i];
    out.push([-px, py]);
  }
  out.push([-hw, spring], [-hw, 0]);
  return out;
}
