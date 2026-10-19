// Rivendell's building parts, made in code (moved out of props.js, which
// keeps the falls' shaders and makes the kit): the pointed arch and what is
// cut from it (openings, their mouldings, arcades, walls with doors and
// windows), carved leaves, slender columns with leaf capitals, the upswept
// leaf-roof, balustrades, arched windows and the tracery in their heads,
// lanterns and carved friezes. Free of GLSL, so a 'nodes' world (the Road)
// may build with them; ./build.js re-exports them.

import * as THREE from 'three';
import { mix, smooth } from '../../../../lib/paint';
import { B, cylX, lathe, roundBox, tube } from '../../shire/build';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ── small helpers ──

// A flat shape's texture coordinates: the box (x0, y0, w, h) to 0..1.
function shapeUV(geo, x0, y0, w, h) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - x0) / w;
    uv[i * 2 + 1] = (p.getY(i) - y0) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// A carved band's texture coordinates: u along x (or z), `rep` metres a
// repeat, v from its foot at y0 to its top at y0 + h.
function bandUV(geo, y0, h, rep, along = 'x') {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (along === 'x' ? p.getX(i) : p.getZ(i)) / rep;
    uv[i * 2 + 1] = (p.getY(i) - y0) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

const shapeOf = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const pathOf = (pts) => new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const ext = (shape, depth, bevel = 0) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 4 });

// ── arches ──

// The curve of a pointed arch springing at (±a, 0) and rising to a point at
// (0, rise): two arcs, each struck from the far side (round, if it is no
// higher than it is wide). `kick` draws the point up into a little ogee
// flame, as the elves like it. From the left foot, over, to the right.
function archCurve(a, rise, n = 8, kick = 0) {
  const pts = [];
  if (rise <= a * 1.02) {
    for (let i = 0; i <= 2 * n; i++) {
      const t = Math.PI * (1 - i / (2 * n));
      pts.push([Math.cos(t) * a, Math.sin(t) * rise]);
    }
    return pts;
  }
  const xc = (rise * rise - a * a) / (2 * a);
  const R = xc + a;
  const t1 = Math.atan2(rise, -xc);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const t = mix(Math.PI, t1, f);
    let x = xc + Math.cos(t) * R;
    let y = Math.sin(t) * R;
    if (kick) {
      const k = smooth(0.5, 1, f);
      x *= 1 - kick * 0.4 * k * k;
      y += kick * a * 0.45 * k * k * k;
    }
    pts.push([x, y]);
  }
  for (let i = n - 1; i >= 0; i--) pts.push([-pts[i][0], pts[i][1]]);
  return pts;
}
const archTop = (a, rise, kick = 0) => (rise <= a * 1.02 ? rise : rise + kick * a * 0.45);

// An arched opening's outline: straight sides `hs` high, then the arch.
function archOpening(a, hs, rise, n = 8, kick = 0) {
  const arch = archCurve(a, rise, n, kick).slice(1, -1).map(([x, y]) => [x, y + hs]);
  if (hs < 1e-4) return [[-a, 0], ...arch, [a, 0]];
  return [[-a, 0], [-a, hs], ...arch, [a, hs], [a, 0]];
}

// The moulding round an arched opening, `f` wide, open at the foot.
function archFrame(a, hs, rise, f, n = 8, kick = 0) {
  const outer = archOpening(a + f, hs, rise + f * 1.15, n, kick);
  const inner = archOpening(a, hs, rise, n, kick).reverse();
  return [...outer, ...inner];
}

// A band of wall with arches cut up into it from below, between columns at
// `xs` (their tops at y = 0); each opening runs from one column's abacus
// (`half` either side of it) to the next's, rising `ratio` times its half
// span, and no higher than `top` less a margin.
function arcadeShape(xs, half, top, { ratio = 1.75, kick = 0.35, n = 9, margin = 0.24 } = {}) {
  const pts = [[xs[0] - half, 0]];
  for (let i = 0; i < xs.length - 1; i++) {
    const l = xs[i] + half;
    const r = xs[i + 1] - half;
    const a = (r - l) / 2;
    const cx = (l + r) / 2;
    const rise = Math.min(a * ratio, top - margin - kick * a * 0.45);
    pts.push([l, 0]);
    for (const [x, y] of archCurve(a, rise, n, kick).slice(1, -1)) pts.push([cx + x, y]);
    pts.push([r, 0]);
  }
  pts.push([xs[xs.length - 1] + half, 0], [xs[xs.length - 1] + half, top], [xs[0] - half, top]);
  return shapeOf(pts);
}
const bayRise = (a, top, { ratio = 1.75, kick = 0.35, margin = 0.24 } = {}) => Math.min(a * ratio, top - margin - kick * a * 0.45);

// A wall `w` wide and `h` high (foot at y = 0, centred on x = 0) with
// arched openings { x, y, a, hs, rise }: y is the sill, and a door (y = 0)
// is cut up from the foot.
function wallShape(w, h, opens = [], kick = 0.35) {
  const doors = opens.filter((o) => o.y <= 0.001).sort((p, q) => p.x - q.x);
  const pts = [[-w / 2, 0]];
  for (const o of doors) for (const [x, y] of archOpening(o.a, o.hs, o.rise, o.n ?? 6, o.kick ?? kick)) pts.push([o.x + x, y]);
  pts.push([w / 2, 0], [w / 2, h], [-w / 2, h]);
  const s = shapeOf(pts);
  for (const o of opens) {
    if (o.y <= 0.001) continue;
    s.holes.push(pathOf(archOpening(o.a, o.hs, o.rise, o.n ?? 6, o.kick ?? kick).map(([x, y]) => [o.x + x, o.y + y])));
  }
  return s;
}

// ── elven building parts ──

// A carved leaf `len` long and `wid` wide, pointed at both ends, rising up
// y from its stalk and curling out towards +z (`curl` radians by its tip),
// folded a little along its midrib; a thin solid, so it needs no
// double-sided material.
function leafBlade(len, wid, { curl = 1, seg = 4, fold = 0.25, thick = 0.012 } = {}) {
  const pos = [];
  const idx = [];
  let py = 0;
  let pz = 0;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    if (i) {
      const a0 = curl * ((i - 0.5) / seg) ** 2;
      py += (Math.cos(a0) * len) / seg;
      pz += (Math.sin(a0) * len) / seg;
    }
    const ang = curl * t * t;
    const nx = -Math.sin(ang);
    const nz = Math.cos(ang);
    const half = wid * 0.5 * Math.pow(Math.sin(Math.PI * t), 0.8);
    const f = half * fold;
    pos.push(-half, py, pz, 0, py + nx * f, pz + nz * f, half, py, pz);
    pos.push(-half, py - nx * thick, pz - nz * thick, 0, py + nx * (f - thick), pz + nz * (f - thick), half, py - nx * thick, pz - nz * thick);
    if (i) {
      const a = (i - 1) * 6;
      const b = i * 6;
      idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      idx.push(a + 3, b + 3, a + 4, a + 4, b + 3, b + 4, a + 4, b + 4, a + 5, a + 5, b + 4, b + 5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A slender column `h` tall standing at (x, y, z), its shaft `r` round: a
// moulded base, a shaft that swells a little, a gilded necking, and a
// capital that opens like a lily, carved leaves curling out round it under
// a thin abacus.
function column(bk, K, { x = 0, y = 0, z = 0, h, r = 0.15, leaves = 6, base = true, mat = null, seg = 10 }) {
  const { mats } = K;
  const m = mat || mats.carve;
  const cap = Math.min(0.7, Math.max(0.36, h * 0.15));
  const hs = h - cap;
  const prof = base
    ? [[r * 1.95, 0], [r * 1.95, 0.12], [r * 1.65, 0.16], [r * 1.62, 0.22], [r * 1.3, 0.3], [r * 1.12, 0.42], [r * 1.02, 0.56], [r * 1.04, hs * 0.4], [r * 0.9, hs]]
    : [[r * 1.04, 0], [r * 1.04, hs * 0.4], [r * 0.9, hs]];
  bk.add(m, lathe(prof, seg), { p: [x, y, z], uv: 1 });
  bk.add(m, lathe([[r * 0.9, hs], [r * 0.98, hs + cap * 0.3], [r * 1.25, hs + cap * 0.62], [r * 1.7, hs + cap * 0.86], [r * 1.95, hs + cap * 0.9]], seg), { p: [x, y, z], uv: 1 });
  bk.add(m, roundBox(r * 4.2, cap * 0.1, r * 4.2, 0.012), { p: [x, y + h - cap * 0.05, z], uv: 1 });
  bk.add(mats.gilt, new THREE.TorusGeometry(r * 0.93, r * 0.11, 4, seg), { p: [x, y + hs, z], r: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * TAU + 0.3;
    bk.add(m, leafBlade(cap * 0.95, r * 1.45, { curl: 1.5, thick: r * 0.08 }), { p: [x + Math.cos(a) * r * 0.82, y + hs + 0.01, z + Math.sin(a) * r * 0.82], r: [0, Math.PI / 2 - a, 0] });
  }
  return y + h;
}

// An upswept roof, like an upturned leaf: rings from the ridge (s = 0) out
// to the eaves (s = 1), each an oblong with rounded ends `ridge` + s·dx by
// s·dz (or, with `sides`, a polygon s·dx round), at a height that falls
// steeply from the ridge and flattens out towards the eaves, where they
// lift (`lift` all round, `tips` more at the ends or the corners) like the
// curl of a leaf. Its texture runs in courses round the rings and down the
// slope. Returns the roof (its top and the eaves' edge, `t` thick), its
// underside, the eaves' line, and where a point (s, turn) on it is.
function leafRoof({ ridge = 0, dx, dz, rise, t = 0.16, prof = (s) => Math.pow(1 - s, 1.7), lift = 0.35, tips = 0.8, n = 4, sides = 0, rot = 0, rings = 12, around = 56, uvK = 0.55 }) {
  const at = (s, f) => {
    const phi = f * TAU;
    const c = Math.cos(phi);
    const sn = Math.sin(phi);
    let x;
    let z;
    let corner;
    if (sides) {
      const k = TAU / sides;
      const rel = ((((phi - rot) % k) + k) % k) - k / 2;
      const rp = Math.cos(k / 2) / Math.cos(rel);
      x = c * dx * s * rp;
      z = sn * dz * s * rp;
      corner = (rp - Math.cos(k / 2)) / (1 - Math.cos(k / 2));
    } else {
      x = Math.sign(c) * (ridge + s * dx * Math.abs(c) ** (2 / n));
      z = Math.sign(sn) * s * dz * Math.abs(sn) ** (2 / n);
      corner = Math.abs(c) ** 4;
    }
    return [x, rise * prof(s) + lift * s ** 3 + tips * s ** 4 * corner, z];
  };
  const M = around;
  const S = (i) => Math.pow(i / rings, 0.9);
  const eave = [];
  let perim = 0;
  for (let j = 0; j <= M; j++) {
    eave.push(at(1, j / M));
    if (j) perim += Math.hypot(eave[j][0] - eave[j - 1][0], eave[j][2] - eave[j - 1][2]);
  }
  let slant = 0;
  for (let i = 1; i <= rings; i++) {
    const p = at(S(i), 0.25);
    const q = at(S(i - 1), 0.25);
    slant += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  const row = M + 1;
  const sheet = (under) => {
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= rings; i++) {
      for (let j = 0; j <= M; j++) {
        const [x, y, z] = at(S(i), j / M);
        pos.push(x, y - under * t, z);
        uv.push((j / M) * perim * uvK, S(i) * slant * uvK);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * row + j;
        const b = a + row;
        if (under) idx.push(a, b, a + 1, a + 1, b, b + 1);
        else idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    // the top sheet takes the edge at the eaves
    if (!under) {
      const e0 = pos.length / 3;
      for (let j = 0; j <= M; j++) {
        const [x, y, z] = eave[j];
        pos.push(x, y, z, x, y - t, z);
        uv.push((j / M) * perim * uvK, 0, (j / M) * perim * uvK, t * uvK);
        if (j) {
          const a = e0 + (j - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const geo = sheet(0);
  const under = sheet(1);
  // the height of the top at (x, z), from its eaves' middle
  const yAt = (x, z) => {
    let q;
    let corner;
    if (sides) {
      const k = TAU / sides;
      const rel = ((((Math.atan2(z, x) - rot) % k) + k) % k) - k / 2;
      const rp = Math.cos(k / 2) / Math.cos(rel);
      q = Math.hypot(x / dx, z / dz) / rp;
      corner = (rp - Math.cos(k / 2)) / (1 - Math.cos(k / 2));
    } else {
      const ax = Math.max(0, Math.abs(x) - ridge) / dx;
      const az = Math.abs(z) / dz;
      q = Math.pow(ax ** n + az ** n, 1 / n);
      corner = q > 1e-6 ? Math.pow(ax / q, 2 * n) : 0;
    }
    q = Math.min(1, q);
    return rise * prof(q) + lift * q ** 3 + tips * q ** 4 * corner;
  };
  return { geo, under, eave: eave.slice(0, M).map(([x, y, z]) => V3(x, y, z)), at, yAt, t };
}

// A leaf roof put on a building (`p` the middle of its eaves, turned `ry`),
// with its gilding: a rounded gilt rim along the eaves, gilt ribs down the
// hips, a gilt ridge, and a finial on each end of it (or on the point).
function roofOn(bk, K, o, { p = [0, 0, 0], ry = 0, ribs = null, finial = 1.2, rim = 0.045 } = {}) {
  const { mats } = K;
  const roof = leafRoof(o);
  bk.at(p, ry, () => {
    bk.add(mats.roof, roof.geo);
    bk.add(mats.soffit, roof.under);
    bk.add(mats.gilt, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(roof.eave, true), roof.eave.length, rim, 4, true));
    const hips = ribs ?? (o.sides ? Array.from({ length: o.sides }, (_, k) => (o.rot ?? 0) / TAU + k / o.sides) : [0.125, 0.375, 0.625, 0.875]);
    for (const f of hips) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const [x, y, z] = roof.at(Math.pow(i / 8, 0.9) * 0.995, f);
        pts.push(V3(x, y + 0.015, z));
      }
      bk.add(mats.gilt, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, rim * 0.75, 3, false));
    }
    const top = o.rise * (o.prof ? o.prof(0) : 1);
    const ridge = o.ridge ?? 0;
    if (ridge > 0) bk.add(mats.gilt, cylX(rim * 1.5, ridge * 2 + 0.1, 6), { p: [0, top + 0.01, 0] });
    if (!finial) return;
    for (const x of ridge > 0 ? [-ridge, ridge] : [0]) {
      const h = finial;
      bk.add(mats.gilt, lathe([[0.001, h], [0.03 * h, h * 0.72], [0.05 * h, h * 0.42], [0.06 * h, h * 0.3], [0.04 * h, h * 0.2], [0.07 * h, h * 0.08], [0.05 * h, 0]], 6), { p: [x, top - 0.05, 0] });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + 0.4;
        bk.add(mats.gilt, leafBlade(h * 0.42, h * 0.14, { curl: 1.1, thick: 0.01 }), { p: [x + Math.cos(a) * 0.04, top - 0.03, Math.sin(a) * 0.04], r: [0, Math.PI / 2 - a, 0] });
      }
    }
  });
  return roof;
}

// A strip standing on a line of points ([x, y, z]), from y0 to y1 above
// them, its texture repeating every `rep` metres along it (a whole number
// of times): a balustrade's panel of tracery, a curtain.
function ribbon(pts, y0, y1, rep = 1) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  const k = total / Math.max(1, Math.round(total / rep));
  const pos = [];
  const uv = [];
  const idx = [];
  let d = 0;
  pts.forEach((p, i) => {
    if (i) d += Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]);
    pos.push(p[0], p[1] + y0, p[2], p[0], p[1] + y1, p[2]);
    uv.push(d / k, 0, d / k, 1);
    if (i) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Points along a polyline, every `step` metres or closer.
function resample(pts, step = 0.4) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const m = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= m; k++) out.push([mix(a[0], b[0], k / m), mix(a[1], b[1], k / m), mix(a[2], b[2], k / m)]);
  }
  return out;
}

// A balustrade along a line of points ([x, y, z], y its foot): a rounded
// handrail and a foot rail, a panel of flowing tracery between, and a post
// with a gilt leaf finial at each end and every `step` metres.
function balustrade(bk, K, pts, { h = 0.95, step = 2.2, rep = 0.95, rail = 0.05, radial = 5, posts = true, ends = true } = {}) {
  const { mats } = K;
  const line = resample(pts, 0.5);
  const seg = Math.max(2, line.length);
  bk.add(mats.carve, tube(line.map(([x, y, z]) => [x, y + h, z]), rail, rail, { seg, radial }), { uv: 2 });
  bk.add(mats.carve, tube(line.map(([x, y, z]) => [x, y + 0.08, z]), rail * 0.9, rail * 0.9, { seg, radial: 4 }), { uv: 2 });
  bk.add(mats.tracery, ribbon(line, 0.1, h - rail * 0.6, rep));
  if (!posts) return;
  // where the posts go: the ends, and every `step` along (not too near an end)
  let total = 0;
  for (let i = 1; i < line.length; i++) total += Math.hypot(line[i][0] - line[i - 1][0], line[i][2] - line[i - 1][2]);
  const at = ends ? [0] : [];
  let d = 0;
  let next = step;
  for (let i = 1; i < line.length - 1; i++) {
    d += Math.hypot(line[i][0] - line[i - 1][0], line[i][2] - line[i - 1][2]);
    if (d >= next && total - d > step * 0.4) {
      at.push(i);
      next = d + step;
    }
  }
  if (ends) at.push(line.length - 1);
  for (const i of at) {
    const [x, y, z] = line[i];
    const q = line[Math.min(i + 1, line.length - 1)];
    const pp = line[Math.max(i - 1, 0)];
    const ry = -Math.atan2(q[2] - pp[2], q[0] - pp[0]);
    const tall = ends && (i === 0 || i === line.length - 1) ? 0.18 : 0;
    bk.add(mats.carve, roundBox(0.15, h + tall, 0.15, 0.02), { p: [x, y + (h + tall) / 2, z], r: [0, ry, 0], uv: 1 });
    bk.add(mats.carve, roundBox(0.22, 0.06, 0.22, 0.015), { p: [x, y + h + tall + 0.03, z], r: [0, ry, 0], uv: 1 });
    bk.add(mats.gilt, leafBlade(0.2, 0.08, { curl: 0.3, seg: 3, thick: 0.008 }), { p: [x, y + h + tall + 0.05, z], r: [0, ry, 0] });
  }
}

// An arched window in a wall whose face is at z = 0 (in the wall's own
// frame, x along it), its sill at y: a moulded frame with a gilt edge
// round it, a sill, and leaded glass set back `depth` into the wall. A door
// is the same with y = 0 and no sill.
function archWindow(bk, K, { x, y = 0, a, hs, rise, depth = 0.25, pane = null, frame = 0.11, gilt = true, kick = 0.35, sill = true, finial = false, n = 6 }) {
  const { mats } = K;
  if (frame) bk.add(mats.carve, ext(shapeOf(archFrame(a, hs, rise, frame, n, kick)), 0.07), { p: [x, y, -0.01], uv: 1 });
  if (gilt) bk.add(mats.gilt, ext(shapeOf(archFrame(a + frame, hs, rise + frame * 1.15, 0.03, n, kick)), 0.085), { p: [x, y, -0.01] });
  if (sill) bk.add(mats.carve, roundBox(2 * a + 0.4, 0.1, 0.24, 0.02), { p: [x, y - 0.05, 0.06], uv: 1 });
  const top = hs + archTop(a, rise, kick);
  if (pane !== false) {
    const pg = new THREE.ShapeGeometry(shapeOf(archOpening(a, hs, rise, n, kick)));
    shapeUV(pg, -a, 0, 2 * a, top);
    bk.add(pane || mats.pane, pg, { p: [x, y, -depth] });
  }
  if (finial) bk.add(mats.gilt, leafBlade(0.42, 0.16, { curl: 0.2, seg: 3, thick: 0.01 }), { p: [x, y + top + frame * 1.2 + 0.02, 0.03] });
  return y + top;
}

// Tracery in the head of an arch (the opening's top, from where it springs
// at y0), cut to its shape: stone, or gilt.
function archFill(bk, mat, { x = 0, y0, a, rise, kick = 0.35, z = 0, n = 7 }) {
  const pts = archCurve(a, rise, n, kick);
  const top = archTop(a, rise, kick);
  const geo = new THREE.ShapeGeometry(shapeOf(pts));
  shapeUV(geo, -a, 0, 2 * a, top);
  bk.add(mat, geo, { p: [x, y0, z] });
}

// An elven lantern, a drop of warm glass in a gilt cage of curving ribs, a
// cap and a point beneath, hanging so its middle is at (x, y, z); `s`
// sizes it (1: 0.5 m tall).
function lanternParts(bk, K, x, y, z, s = 1) {
  const { mats } = K;
  const prof = [[0.001, -0.22], [0.05, -0.17], [0.1, -0.04], [0.105, 0.04], [0.075, 0.13], [0.035, 0.19]].map(([r, h]) => [r * s, h * s]);
  bk.add(mats.glow, lathe(prof, 10), { p: [x, y, z] });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    const pts = prof.map(([r, h]) => [x + Math.cos(a) * (r + 0.008 * s), y + h, z + Math.sin(a) * (r + 0.008 * s)]);
    bk.add(mats.gilt, tube(pts, 0.008 * s, 0.008 * s, { seg: 8, radial: 3 }));
  }
  bk.add(mats.gilt, lathe([[0.03 * s, 0.19 * s], [0.07 * s, 0.21 * s], [0.04 * s, 0.25 * s], [0.012 * s, 0.32 * s]], 8), { p: [x, y, z] });
  bk.add(mats.gilt, lathe([[0.001, -0.36 * s], [0.012 * s, -0.3 * s], [0.03 * s, -0.24 * s], [0.04 * s, -0.215 * s], [0.001, -0.2 * s]], 6), { p: [x, y, z] });
}

// Stretch a geometry's u (a cylinder's band round, to repeat along it).
function scaleU(geo, k) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
  return geo;
}

// A carved frieze band, `len` long and `h` high, along x (or z), standing
// a little proud of a wall.
function friezeGeo(len, h, along = 'x', rep = h * 4) {
  const geo = along === 'x' ? B(len, h, 0.05) : B(0.05, h, len);
  return bandUV(geo, -h / 2, h, rep, along);
}

export { shapeUV, bandUV, shapeOf, pathOf, ext, archCurve, archTop, archOpening, archFrame, arcadeShape, bayRise, wallShape, leafBlade, column, leafRoof, roofOn, ribbon, resample, balustrade, archWindow, archFill, lanternParts, scaleU, friezeGeo };
