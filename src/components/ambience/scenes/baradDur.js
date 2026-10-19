// Barad-dûr for the Mordor background (scenes/middleearth.js), made in code
// as one mesh: a great plinth on the rock; black tiers narrowing up, each
// turned against the one below, fringed with leaning spikes on their
// cornices and ribbed up their faces; eight blade buttresses sweeping out
// and down to the rock like roots, hooked along their edges, and lesser
// blades between; turrets crowding its foot and needle spires above; and at
// the top the two horns of its crown curving out and in round the Eye,
// spurred along their backs. John Howe’s “battlement piled on battlement”,
// drawn to read at a glance as a silhouette against a burning sky.
//
// Pure: three comes in as an argument, so the file is tested without a
// canvas and loads with the scene that already carries three. Unit height:
// the rock at y = 0, the horns’ tips at y = 1, the horns opening to ±x (so
// it shows its crown face on from +z). Every triangle carries its own
// normal (faceted stone), a colour (basalt, the ledges a touch lighter, the
// stone round the Eye warmed by it) and a uv the view lights by: u how
// much of the Eye’s fire reaches it (0 to HEAT_MAX; WINDOW_U for a lit
// window), v its height, so the haze can thicken toward the plain.

import { makeNoise } from '../../../lib/paint';

const TAU = Math.PI * 2;

// where the Eye burns, between the horns
export const EYE_Y = 0.885;
// the uv’s u: the stone’s heat runs 0..HEAT_MAX, a window is WINDOW_U
export const HEAT_MAX = 0.75;
export const WINDOW_U = 0.94;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

// mulberry32: the same tower from the same seed
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The body: tiers [y0, y1, r0, r1, sides], each capped by a cornice that
// juts out over it, the first two the plinth on its rock. Tall and slender
// above, massive below, as the films’ tower is.
const TIERS = [
  [0.0, 0.028, 0.21, 0.195, 10],
  [0.028, 0.07, 0.17, 0.158, 8],
  [0.07, 0.235, 0.13, 0.121, 8],
  [0.249, 0.4, 0.098, 0.09, 8],
  [0.412, 0.535, 0.074, 0.068, 8],
  [0.545, 0.64, 0.055, 0.05, 8],
  [0.649, 0.72, 0.04, 0.036, 8],
  [0.727, 0.775, 0.029, 0.026, 8],
  [0.782, 0.8, 0.021, 0.019, 8],
];
// how far each tier’s cornice juts, and how deep it is (the neck’s flares
// into the cup the horns rise from)
const CORNICE = [0.0, 0.006, 0.016, 0.013, 0.011, 0.009, 0.008, 0.007, 0.014];
const CORNICE_H = [0.0, 0.006, 0.014, 0.012, 0.01, 0.009, 0.007, 0.007, 0.01];

// The body’s radius at height y (its faces, not its cornices), for the
// buttresses and the turrets to meet.
function bodyAt(y) {
  for (const [y0, y1, r0, r1] of TIERS) if (y <= y1) return y < y0 ? r0 : mix(r0, r1, (y - y0) / (y1 - y0));
  return TIERS[TIERS.length - 1][3];
}

// Triangles into flat arrays, each turned to face away from a point inside
// the solid it belongs to, so no part needs its winding worked out by hand.
function builder() {
  const pos = [];
  const nor = [];
  const tag = [];
  const tri = (a, b, c, ref, t = 0) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    // a sliver has no normal to light it by
    if (len < 1e-12) return;
    nx /= len;
    ny /= len;
    nz /= len;
    const ox = (a[0] + b[0] + c[0]) / 3 - ref[0];
    const oy = (a[1] + b[1] + c[1]) / 3 - ref[1];
    const oz = (a[2] + b[2] + c[2]) / 3 - ref[2];
    if (nx * ox + ny * oy + nz * oz < 0) {
      pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
      nx = -nx;
      ny = -ny;
      nz = -nz;
    } else pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    tag.push(t);
  };
  const quad = (a, b, c, d, ref, t) => {
    tri(a, b, c, ref, t);
    tri(a, c, d, ref, t);
  };
  return { tri, quad, pos, nor, tag };
}

// a ring of `sides` corners about the axis at height y
const ringAt = (y, r, sides, turn) => Array.from({ length: sides }, (_, k) => [Math.cos(turn + (k / sides) * TAU) * r, y, Math.sin(turn + (k / sides) * TAU) * r]);

// Two unit vectors square to `d` (normalised), for a spike’s base.
function across(d) {
  const ax = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let px = d[1] * ax[2] - d[2] * ax[1];
  let py = d[2] * ax[0] - d[0] * ax[2];
  let pz = d[0] * ax[1] - d[1] * ax[0];
  const pl = Math.hypot(px, py, pz);
  px /= pl;
  py /= pl;
  pz /= pl;
  return [
    [px, py, pz],
    [d[1] * pz - d[2] * py, d[2] * px - d[0] * pz, d[0] * py - d[1] * px],
  ];
}

export function buildBaradDur(THREE, { detail = 1, seed = 2101 } = {}) {
  const dl = clamp01(detail);
  // a count at full detail, cut down as detail falls (never below `min`)
  const count = (n, min = 1) => Math.max(min, Math.round(n * mix(0.35, 1, dl)));
  const r = rng(seed);
  const noise = makeNoise(seed);
  const B = builder();
  const { tri, quad } = B;

  // A frustum between two rings, with its top (and, where it overhangs
  // what is below, its underside) closed.
  const frustum = (y0, y1, r0, r1, sides, turn, { bottom = false, wobble = 0 } = {}) => {
    const lo = ringAt(y0, r0, sides, turn);
    const hi = ringAt(y1, r1, sides, turn);
    if (wobble) {
      for (const p of [...lo, ...hi]) {
        const k = 1 + (r() - 0.5) * wobble;
        p[0] *= k;
        p[2] *= k;
      }
    }
    const ref = [0, (y0 + y1) / 2, 0];
    for (let k = 0; k < sides; k++) {
      const j = (k + 1) % sides;
      quad(lo[k], lo[j], hi[j], hi[k], ref);
      tri([0, y1, 0], hi[k], hi[j], ref);
      if (bottom) tri([0, y0, 0], lo[k], lo[j], ref);
    }
    return { lo, hi };
  };

  // A spike from `at` along `dir`, `sides`-sided.
  const spike = (at, dir, len, rad, sides = 4, t = 0) => {
    const dlen = Math.hypot(dir[0], dir[1], dir[2]);
    const d = [dir[0] / dlen, dir[1] / dlen, dir[2] / dlen];
    const [u, v] = across(d);
    const tip = [at[0] + d[0] * len, at[1] + d[1] * len, at[2] + d[2] * len];
    const ref = [at[0] + d[0] * len * 0.25, at[1] + d[1] * len * 0.25, at[2] + d[2] * len * 0.25];
    const base = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU;
      const c = Math.cos(a) * rad;
      const s = Math.sin(a) * rad;
      base.push([at[0] + u[0] * c + v[0] * s, at[1] + u[1] * c + v[1] * s, at[2] + u[2] * c + v[2] * s]);
    }
    for (let k = 0; k < sides; k++) tri(base[k], base[(k + 1) % sides], tip, ref, t);
  };

  // A blade standing out from the body at angle `a`: rows [y, rIn, rOut,
  // half its thickness] up it, wedge-sectioned, its edge out along the
  // angle and its back in the stone.
  const fin = (rows, a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const at = (rr, y, w) => [c * rr - s * w, y, s * rr + c * w];
    const pts = rows.map(([y, ri, ro, h]) => [at(ri, y, -h), at(ro, y, 0), at(ri, y, h), at((ri + ro) / 2, y, 0)]);
    for (let k = 0; k < pts.length - 1; k++) {
      const [a0, e0, b0, m0] = pts[k];
      const [a1, e1, b1, m1] = pts[k + 1];
      const ref = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2, (m0[2] + m1[2]) / 2];
      quad(a0, e0, e1, a1, ref);
      quad(e0, b0, b1, e1, ref);
    }
    const [a0, e0, b0, m0] = pts[pts.length - 1];
    tri(a0, e0, b0, [m0[0], m0[1] - 0.01, m0[2]]);
  };

  // A horn: a tube through `points` (x, y, z), tapering by `radii`, its
  // section deeper (z) than it is wide, closed at the tip.
  const horn = (points, radii, seg, radial, deep = 1.5) => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      false,
      'centripetal',
    );
    const rings = [];
    const mids = [];
    for (let k = 0; k <= seg; k++) {
      const f = k / seg;
      const p = curve.getPoint(f);
      const t = curve.getTangent(f);
      // the side square to the tangent in the horn’s own plane
      const nx = -t.y;
      const ny = t.x;
      const nl = Math.hypot(nx, ny) || 1;
      const fi = f * (radii.length - 1);
      const i0 = Math.min(radii.length - 2, Math.floor(fi));
      const rad = mix(radii[i0], radii[i0 + 1], fi - i0);
      const ring = [];
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * TAU;
        const cx = Math.cos(a) * rad;
        ring.push([p.x + (nx / nl) * cx, p.y + (ny / nl) * cx, p.z + Math.sin(a) * rad * deep]);
      }
      rings.push(ring);
      mids.push([p.x, p.y, p.z]);
    }
    for (let k = 0; k < seg; k++) {
      const ref = mids[k].map((v, i) => (v + mids[k + 1][i]) / 2);
      for (let j = 0; j < radial; j++) {
        const i = (j + 1) % radial;
        quad(rings[k][j], rings[k][i], rings[k + 1][i], rings[k + 1][j], ref);
      }
    }
    const tip = curve.getPoint(1);
    const end = [tip.x, tip.y, tip.z];
    const last = rings[seg];
    const near = mids[seg - 1];
    for (let j = 0; j < radial; j++) tri(last[j], last[(j + 1) % radial], end, near);
    return curve;
  };

  // Points round a polygon’s edges (not its circle), so spikes stand on
  // the cornice itself and not inside it.
  const alongEdges = (ring, n) => {
    const out = [];
    const sides = ring.length;
    for (let i = 0; i < n; i++) {
      const f = (i / n) * sides;
      const k = Math.floor(f);
      const a = ring[k];
      const b = ring[(k + 1) % sides];
      const t = f - k;
      out.push([mix(a[0], b[0], t), a[1], mix(a[2], b[2], t), t]);
    }
    return out;
  };

  // ── the body ──
  TIERS.forEach(([y0, y1, r0, r1, sides], i) => {
    // each tier turned half a face against the one below
    const turn = (i % 2) * (Math.PI / sides);
    frustum(y0, y1, r0, r1, sides, turn, { wobble: i === 0 ? 0.12 : 0 });
    if (i === 0) return;
    // the cornice, jutting out over the tier, its underside showing
    const cj = CORNICE[i];
    const ch = CORNICE_H[i];
    const { hi } = frustum(y1, y1 + ch, r1 + cj, r1 + cj * 0.85, sides, turn, { bottom: true });
    // a fringe of spikes about its edge, leaning out, a taller one at each
    // corner (the jagged step the tower’s outline is made of)
    if (i >= 2) {
      const n = count(Math.round(r1 * 520), 8);
      for (const [x, y, z, t] of alongEdges(hi, n)) {
        const rr = Math.hypot(x, z);
        const ox = x / rr;
        const oz = z / rr;
        const corner = t < 1e-6;
        const len = corner ? 0.03 + r1 * 0.22 + r() * 0.012 : 0.008 + r() * 0.01 + (Math.round(t * 8) % 2) * 0.006;
        const lean = corner ? 0.28 : 0.42;
        spike([x * 0.985, y - 0.001, z * 0.985], [ox * lean, 1, oz * lean], len, corner ? 0.006 + r1 * 0.04 : 0.0032 + r1 * 0.012, corner ? 4 : 3);
      }
    }
    // ribs up its faces, the grain of the stone, and here and there a
    // window slit burning
    if (i >= 2) {
      const per = count(i < 4 ? 3 : 2, 1);
      const winds = count(i < 4 ? 3 : 2, 1);
      for (let k = 0; k < sides; k++) {
        const a0 = turn + (k / sides) * TAU;
        const a1 = turn + ((k + 1) / sides) * TAU;
        for (let m = 1; m <= per; m++) {
          const f = m / (per + 1);
          const p0 = [mix(Math.cos(a0), Math.cos(a1), f) * r0, y0, mix(Math.sin(a0), Math.sin(a1), f) * r0];
          const p1 = [mix(Math.cos(a0), Math.cos(a1), f) * r1, y1, mix(Math.sin(a0), Math.sin(a1), f) * r1];
          rib(p0, p1, (a0 + a1) / 2, 0.0026 + r0 * 0.012, 0.003 + r0 * 0.02);
        }
        for (let m = 0; m < winds; m++) {
          if (r() > 0.2) continue;
          const f = 0.12 + r() * 0.76;
          const h = 0.1 + r() * 0.75;
          const y = mix(y0, y1, h);
          const rr = mix(r0, r1, h) * Math.cos(Math.PI / sides) + 0.0012;
          const am = (a0 + a1) / 2;
          // on the face, between its corners
          const cx = mix(Math.cos(a0), Math.cos(a1), f) * mix(r0, r1, h);
          const cz = mix(Math.sin(a0), Math.sin(a1), f) * mix(r0, r1, h);
          const ox = Math.cos(am) * 0.0012;
          const oz = Math.sin(am) * 0.0012;
          const tx = -Math.sin(am) * 0.0014;
          const tz = Math.cos(am) * 0.0014;
          const hh = 0.003 + r() * 0.002;
          const c = [cx + ox, y, cz + oz];
          quad([c[0] - tx, y - hh, c[2] - tz], [c[0] + tx, y - hh, c[2] + tz], [c[0] + tx, y + hh, c[2] + tz], [c[0] - tx, y + hh, c[2] - tz], [Math.cos(am) * (rr - 0.01), y, Math.sin(am) * (rr - 0.01)], 1);
        }
      }
    }
  });

  // A rib up a face from p0 to p1 at angle `a`: a triangular ridge.
  function rib(p0, p1, a, w, out) {
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    const tx = -oz * w;
    const tz = ox * w;
    const l0 = [p0[0] - tx, p0[1], p0[2] - tz];
    const r0 = [p0[0] + tx, p0[1], p0[2] + tz];
    const t0 = [p0[0] + ox * out, p0[1], p0[2] + oz * out];
    const l1 = [p1[0] - tx, p1[1], p1[2] - tz];
    const r1 = [p1[0] + tx, p1[1], p1[2] + tz];
    const t1 = [p1[0] + ox * out * 0.8, p1[1], p1[2] + oz * out * 0.8];
    const ref = [(p0[0] + p1[0]) / 2 - ox * 0.01, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2 - oz * 0.01];
    quad(l0, t0, t1, l1, ref);
    quad(t0, r0, r1, t1, ref);
  }

  // ── the great buttresses, blades sweeping out from its flanks to the rock ──
  const blades = 8;
  const rowsN = count(16, 6);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TAU + Math.PI / 8;
    const top = 0.36 + (i % 2) * 0.06;
    const rows = [];
    for (let k = 0; k <= rowsN; k++) {
      const f = k / rowsN;
      const y = 0.02 + f * (top - 0.02);
      const body = bodyAt(y);
      rows.push([y, Math.max(0.02, body - 0.02), body + 0.006 + 0.17 * Math.pow(1 - f, 3.2) + 0.012 * (1 - f), 0.013 * (1 - f) + 0.004]);
    }
    fin(rows, a);
    // hooked spurs along its edge, pointing out and up
    const spurs = count(7, 3);
    for (let k = 1; k <= spurs; k++) {
      const row = rows[Math.round((k / (spurs + 1)) * rowsN)];
      const [y, , ro] = row;
      spike([Math.cos(a) * (ro - 0.004), y, Math.sin(a) * (ro - 0.004)], [Math.cos(a), 0.6, Math.sin(a)], 0.02 + (k % 3) * 0.008, 0.005, 3);
    }
    // a lesser blade between each pair, not so high
    const b = a + Math.PI / blades;
    const rows2 = [];
    const n2 = count(10, 4);
    for (let k = 0; k <= n2; k++) {
      const f = k / n2;
      const y = 0.02 + f * 0.25;
      const body = bodyAt(y);
      rows2.push([y, Math.max(0.02, body - 0.02), body + 0.004 + 0.11 * Math.pow(1 - f, 2.4), 0.008 * (1 - f) + 0.003]);
    }
    fin(rows2, b);
  }

  // ── turrets crowding its foot, each with its cornice and spire ──
  const turrets = count(8, 4);
  for (let i = 0; i < turrets; i++) {
    const a = (i / turrets) * TAU + 0.21 + (r() - 0.5) * 0.2;
    const h = 0.2 + r() * 0.2;
    const tr = 0.017 + r() * 0.008;
    const rr = bodyAt(0.15) + tr * 0.35;
    const cx = Math.cos(a) * rr;
    const cz = Math.sin(a) * rr;
    const lo = ringAt(0.07, tr, 6, a);
    const hi = ringAt(h, tr * 0.8, 6, a);
    const ref = [cx, (0.07 + h) / 2, cz];
    for (let k = 0; k < 6; k++) {
      const j = (k + 1) % 6;
      const at = (p) => [p[0] + cx, p[1], p[2] + cz];
      quad(at(lo[k]), at(lo[j]), at(hi[j]), at(hi[k]), ref);
      tri([cx, h, cz], at(hi[k]), at(hi[j]), ref);
    }
    for (let k = 0; k < count(6, 3); k++) {
      const b = a + (k / count(6, 3)) * TAU;
      spike([cx + Math.cos(b) * tr * 0.8, h, cz + Math.sin(b) * tr * 0.8], [Math.cos(b) * 0.4, 1, Math.sin(b) * 0.4], 0.008 + r() * 0.006, 0.0028, 3);
    }
    spike([cx, h, cz], [0, 1, 0], 0.05 + r() * 0.05, tr * 0.6, 4);
  }

  // ── lesser towers standing against the tiers above, battlement piled
  // on battlement, each with its spire ──
  for (let ti = 2; ti <= 4; ti++) {
    const [, y1, , r1, sides] = TIERS[ti];
    const [ny0, ny1, nr0] = TIERS[ti + 1];
    const base = y1 + CORNICE_H[ti];
    const per = count(4, 2);
    for (let m = 0; m < per; m++) {
      // on the cornice’s corners, every other one, turned with the tier
      const a = ((ti % 2) * Math.PI) / sides + ((m * 2 + (ti % 2)) / sides) * TAU;
      const tr = r1 * 0.13;
      const rr = Math.max(nr0 + tr * 0.4, r1 + CORNICE[ti] - tr * 1.1);
      const cx = Math.cos(a) * rr;
      const cz = Math.sin(a) * rr;
      const top = mix(ny0, ny1, 0.45 + r() * 0.3);
      const lo = ringAt(base, tr, 4, a + Math.PI / 4);
      const hi = ringAt(top, tr * 0.85, 4, a + Math.PI / 4);
      const ref = [cx, (base + top) / 2, cz];
      const at = (p) => [p[0] + cx, p[1], p[2] + cz];
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        quad(at(lo[k]), at(lo[j]), at(hi[j]), at(hi[k]), ref);
      }
      spike([cx, top, cz], [Math.cos(a) * 0.08, 1, Math.sin(a) * 0.08], tr * 4.5 + r() * 0.012, tr * 1.15, 4);
    }
  }

  // ── needle spires about the upper tiers ──
  const spires = count(8, 4);
  for (let i = 0; i < spires; i++) {
    const a = (i / spires) * TAU + 0.4;
    const ti = 3 + (i % 3);
    const [, y1, , r1] = TIERS[ti];
    const y = y1 + CORNICE_H[ti];
    const rr = (r1 + CORNICE[ti]) * 0.8;
    spike([Math.cos(a) * rr, y - 0.004, Math.sin(a) * rr], [Math.cos(a) * 0.05, 1, Math.sin(a) * 0.05], 0.05 + (i % 3) * 0.022 + r() * 0.015, 0.0045, 4);
  }

  // ── the crown: two horns, out and up and in, spurred along their backs ──
  const seg = count(22, 10);
  const radial = count(7, 5);
  for (const sd of [-1, 1]) {
    const P = [
      [sd * 0.012, 0.802, 0],
      [sd * 0.034, 0.828, 0],
      [sd * 0.058, 0.862, 0],
      [sd * 0.068, 0.9, 0],
      [sd * 0.061, 0.94, 0],
      [sd * 0.041, 0.972, 0],
      [sd * 0.016, 0.998, 0],
    ];
    // blades, broad face on and thin through, as the films’ crown is
    const curve = horn(P, [0.017, 0.015, 0.012, 0.0095, 0.007, 0.0045, 0.0006], seg, radial, 0.55);
    const spurs = count(8, 3);
    for (let k = 0; k < spurs; k++) {
      const f = 0.1 + (k / spurs) * 0.78;
      const p = curve.getPoint(f);
      const t = curve.getTangent(f);
      // out from its back: the side away from the Eye
      let ox = -t.y;
      let oy = t.x;
      if (ox * sd < 0) {
        ox = -ox;
        oy = -oy;
      }
      const back = 0.017 - f * 0.015;
      spike([p.x + ox * back * 0.6, p.y + oy * back * 0.6, p.z], [ox + sd * 0.2, oy + 0.55, k % 2 ? 0.25 : -0.25], 0.03 - k * 0.0024, 0.0042 - k * 0.0002, 3);
    }
    // a lesser horn before and behind, the crown’s outer points
    for (const sz of [-1, 1]) {
      horn(
        [
          [sd * 0.016, 0.808, sz * 0.012],
          [sd * 0.032, 0.83, sz * 0.026],
          [sd * 0.046, 0.86, sz * 0.03],
        ],
        [0.006, 0.004, 0.0004],
        count(8, 4),
        5,
        1,
      );
    }
  }
  // the cup between the horns’ roots, a ring of teeth
  const teeth = count(12, 6);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    spike([Math.cos(a) * 0.026, 0.814, Math.sin(a) * 0.026], [Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5], 0.012 + (i % 2) * 0.008, 0.0035, 3);
  }

  // ── colour, and how the Eye’s fire falls on it ──
  const { pos, nor, tag } = B;
  const n = pos.length / 3;
  const color = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let f = 0; f < n / 3; f++) {
    const v0 = f * 9;
    const x = (pos[v0] + pos[v0 + 3] + pos[v0 + 6]) / 3;
    const y = (pos[v0 + 1] + pos[v0 + 4] + pos[v0 + 7]) / 3;
    const z = (pos[v0 + 2] + pos[v0 + 5] + pos[v0 + 8]) / 3;
    const nx = nor[v0];
    const ny = nor[v0 + 1];
    const nz = nor[v0 + 2];
    const window = tag[f] === 1;
    // basalt, each facet its own shade, mottled at two scales
    const k = 0.62 + noise(x * 90 + 7.1, y * 90 + z * 61) * 0.5 + noise(x * 9 + z * 6 + 1.7, y * 11) * 0.35;
    let cr = 0.046 * k;
    let cg = 0.041 * k;
    let cb = 0.039 * k;
    // the ledges and the tops of things catch the sky
    if (ny > 0.55) {
      cr = mix(cr, 0.12, 0.55);
      cg = mix(cg, 0.104, 0.55);
      cb = mix(cb, 0.097, 0.55);
    }
    // the Eye’s fire on the stone about it, most on what faces it: the
    // colour a facet at a time, the heat (the view’s glow) a corner at a
    // time, so it runs smooth across the faces
    for (let c = 0; c < 3; c++) {
      const i = v0 + c * 3;
      const ex = -pos[i];
      const ey = EYE_Y - pos[i + 1];
      const ez = -pos[i + 2];
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
      const facing = Math.max(0, (nx * ex + ny * ey + nz * ez) / d);
      const warm = Math.exp(-d / 0.075) * (0.3 + 0.7 * facing) * 0.5;
      const o = (f * 3 + c) * 3;
      color[o] = window ? 0.02 : mix(cr, 0.2, warm);
      color[o + 1] = window ? 0.012 : mix(cg, 0.055, warm);
      color[o + 2] = window ? 0.01 : mix(cb, 0.025, warm);
      const u = (f * 3 + c) * 2;
      uv[u] = window ? WINDOW_U : HEAT_MAX * clamp01(1.3 * Math.exp(-Math.max(0, d - 0.035) / 0.05) * (0.2 + 0.8 * facing));
      uv[u + 1] = clamp01(pos[i + 1]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, eyeAt: new THREE.Vector3(0, EYE_Y, 0), height: geometry.boundingBox.max.y };
}
