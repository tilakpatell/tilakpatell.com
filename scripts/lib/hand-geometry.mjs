// A hand read from its own vertices, for scripts/hands-extend.mjs: which
// vertices are which finger and which the thumb, where each finger's joints
// go, the turn every new bone rests in, and the skin's weights split from
// the hand bone onto them (and from the forearm onto a twist bone). Pure
// three.js math over points in the hand bone's own space (the figure at
// rest), so it is tested in Node on hands laid out in code.
// (docs/superpowers/specs/2026-10-08-npc-player-rigging-design.md, piece 2)
//
// fingerGroups(points, shape, frame, { k = 4, tris }) → { kind: 'fingers' |
//   'mitten', fingers: [[i…]…] (index first, the pinky last; one group for a
//   mitten), thumb: [i…] | null }: points (Vector3) past shape.s0, the
//   knuckle line grip.js's handShape found along frame.along, split across
//   frame.thumb. With the mesh's triangles (index triples into points) the
//   fingers are what the mesh keeps apart: its pieces past a cut a tenth to
//   six tenths of the way out from the knuckles, four of them, each a
//   finger (a sculpt's fingers touch, so their points leave no gap across,
//   but their skins are separate); without, k-means across from k evenly
//   spaced seeds, and a mitten when the narrowest gap between two
//   neighbouring clusters is under a tenth of the hand's width. The thumb:
//   of the vertices past the fingers' thumb-side edge (shape.cEdge), the
//   piece that stands out furthest, when it stands out a twelfth of the
//   finger plate's width or more; else none.
// fingerChain(points, { joints = 3, toward }) → [{ at, axis, len }…]: joints
//   at 0, ⅓ and ⅔ of the cluster's length (0 and ½ for two), from its
//   knuckle end (the end `toward` points away from), each the middle of the
//   finger's cross-section there (the ends' from a thin slice), so a curled
//   finger's joints follow its curl, not its chord; axis to the next joint
//   (the last to the tip), len that far.
// canonicalFrame(along, back) → [x, y, z, w]: the turn whose +y is along,
//   +z back (out of the back of the hand, squared to along), +x = y × z.
// fingerWeights(points, joints, weights, chains, { hand, along, s0, band =
//   0.2, thumbBand = 0.4 }) → { joints, weights, touched }: four influences
//   a vertex (Uint16Array, Float32Array) in and out. A vertex's hand weight
//   goes to the chain it is nearest: across the knuckles from the hand to
//   the first joint over `band` of the finger's length either side of it
//   (the thumb's over `thumbBand`, since a thumb swung alone tears from the
//   palm), then joint to joint over a tenth of each segment either side of
//   the joint, smoothstepped. No vertex keeps more than four (the smallest
//   go and the rest are scaled back to one). chains: [{ bones: [joint
//   index…], joints: fingerChain's, thumb, radius }]; radius (chainRadius's)
//   fades a chain's pull out between two and three of it from its line, so
//   a thumb's wide band takes the ball of the thumb and not the palm's
//   middle. touched: the vertices changed.
// chainRadius(points, joints) → the median distance of a cluster's points
//   from its chain: the finger's thickness, about.
// twistWeights(points, joints, weights, { fore, twist, elbow, wrist }) →
//   { joints, weights, touched }: each vertex's forearm weight shared with
//   the twist bone in proportion to how far it is from the elbow to the
//   wrist (none at the elbow, all at the wrist).

import * as THREE from 'three';

const V = THREE.Vector3;
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const pct = (values, f) => {
  if (!values.length) return 0;
  const s = Float64Array.from(values).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))];
};
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

// the pieces of the mesh among `inside` vertices (triangles wholly inside)
function pieces(inside, tris) {
  const parent = new Map([...inside].map((i) => [i, i]));
  const find = (i) => {
    while (parent.get(i) !== i) {
      parent.set(i, parent.get(parent.get(i)));
      i = parent.get(i);
    }
    return i;
  };
  for (const [a, b, c] of tris) {
    if (!inside.has(a) || !inside.has(b) || !inside.has(c)) continue;
    parent.set(find(a), find(b));
    parent.set(find(b), find(c));
  }
  const out = new Map();
  for (const i of inside) {
    const r = find(i);
    if (!out.has(r)) out.set(r, []);
    out.get(r).push(i);
  }
  return [...out.values()];
}

// k-means along one axis, from the seeds given
function kmeans(values, seeds, rounds = 10) {
  let c = [...seeds];
  let label = values.map(() => 0);
  for (let r = 0; r < rounds; r++) {
    label = values.map((v) => c.reduce((best, x, k) => (Math.abs(v - x) < Math.abs(v - c[best]) ? k : best), 0));
    c = c.map((x, k) => {
      const mine = values.filter((_, i) => label[i] === k);
      return mine.length ? mean(mine) : x;
    });
  }
  return { centres: c, label };
}

export function fingerGroups(points, shape, frame, { k = 4, tris = null } = {}) {
  const A = points.map((p) => p.dot(frame.along));
  const C = points.map((p) => p.dot(frame.thumb));
  const thumbish = new Set();
  C.forEach((c, i) => c > shape.cEdge && thumbish.add(i));
  const F = [];
  A.forEach((a, i) => a > shape.s0 && !thumbish.has(i) && F.push(i));
  const width = pct(F.map((i) => C[i]), 0.99) - pct(F.map((i) => C[i]), 0.01);
  let centres = null;
  const owner = new Map(); // a vertex the mesh put in a finger → that finger
  if (tris) {
    const reach = shape.hi - shape.s0;
    const past = new Set();
    A.forEach((a, i) => a > shape.s0 && past.add(i));
    const least = Math.max(6, 0.02 * F.length);
    for (const t of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) {
      const cut = shape.s0 + t * reach;
      const inside = new Set([...past].filter((i) => A[i] > cut));
      const found = pieces(inside, tris).filter((p) => p.length >= least && p.filter((i) => thumbish.has(i)).length * 2 < p.length);
      if (found.length !== k) continue;
      found.sort((a, b) => mean(b.map((i) => C[i])) - mean(a.map((i) => C[i])));
      centres = found.map((p) => mean(p.map((i) => C[i])));
      found.forEach((p, f) => p.forEach((i) => owner.set(i, f)));
      break;
    }
  } else if (F.length >= 4 * k) {
    const lo = pct(F.map((i) => C[i]), 0.02);
    const hi = pct(F.map((i) => C[i]), 0.98);
    const { centres: c, label } = kmeans(
      F.map((i) => C[i]),
      Array.from({ length: k }, (_, j) => lo + ((j + 0.5) / k) * (hi - lo)),
    );
    const order = c.map((x, j) => j).sort((a, b) => c[b] - c[a]);
    const spans = order.map((j) => F.filter((_, n) => label[n] === j).map((i) => C[i]));
    let gap = Infinity;
    for (let j = 0; j + 1 < spans.length; j++) gap = Math.min(gap, pct(spans[j], 0.02) - pct(spans[j + 1], 0.98));
    if (spans.every((s) => s.length) && gap >= width / 10) centres = order.map((j) => c[j]);
  }
  const kind = centres ? 'fingers' : 'mitten';
  if (!centres) centres = [mean(F.map((i) => C[i]))];
  const groups = centres.map(() => []);
  const nearest = (c) => centres.reduce((best, x, f) => (Math.abs(c - x) < Math.abs(c - centres[best]) ? f : best), 0);
  for (const i of F) groups[owner.get(i) ?? nearest(C[i])].push(i);
  // the thumb-side edge of the first finger, past the knuckles, is that
  // finger, not the thumb (handShape's edge is a centile: some of it lies past)
  const first = groups[0].map((i) => C[i]);
  const edge = mean(first) + 3 * Math.sqrt(mean(first.map((c) => (c - mean(first)) ** 2)));
  const rest = [];
  for (const i of thumbish) {
    if (owner.has(i)) groups[owner.get(i)].push(i);
    else if (A[i] > shape.s0 && C[i] <= edge) groups[0].push(i);
    else rest.push(i);
  }
  // the thumb: the piece of what's left that stands out furthest
  const plate = shape.cEdge - pct(F.map((i) => C[i]), 0.01);
  const parts = tris ? pieces(new Set(rest), tris) : [rest];
  let thumb = null;
  let out = 0;
  for (const p of parts) {
    const far = Math.max(...p.map((i) => C[i])) - shape.cEdge;
    if (p.length >= 8 && far > out && far >= plate / 12) {
      out = far;
      thumb = p;
    }
  }
  return { kind, fingers: groups, thumb };
}

// the line a cloud lies along: its covariance's largest axis (power iteration)
function principal(points, toward) {
  const m = new V();
  for (const p of points) m.add(p);
  m.divideScalar(points.length);
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const d = new V();
  for (const p of points) {
    d.subVectors(p, m);
    const a = [d.x, d.y, d.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i * 3 + j] += a[i] * a[j];
  }
  const u = toward.clone().normalize();
  for (let it = 0; it < 50; it++) {
    const x = c[0] * u.x + c[1] * u.y + c[2] * u.z;
    const y = c[3] * u.x + c[4] * u.y + c[5] * u.z;
    const z = c[6] * u.x + c[7] * u.y + c[8] * u.z;
    u.set(x, y, z);
    if (u.lengthSq() < 1e-20) return toward.clone().normalize();
    u.normalize();
  }
  if (u.dot(toward) < 0) u.negate();
  return u;
}

export function fingerChain(points, { joints = 3, toward }) {
  const u = principal(points, toward);
  const s = points.map((p) => p.dot(u));
  const lo = pct(s, 0.02);
  const hi = pct(s, 0.98);
  const L = hi - lo;
  const h = L / (2 * joints);
  const end = L / 12;
  // the middle of the points between from and to along the line
  const centre = (from, to) => {
    const slab = points.filter((_, i) => s[i] >= from && s[i] <= to);
    const c = new V();
    for (const p of slab) c.add(p);
    return c.divideScalar(Math.max(1, slab.length));
  };
  const at = Array.from({ length: joints }, (_, i) => {
    const x = lo + (i / joints) * L;
    return i === 0 ? centre(lo, lo + end) : centre(x - h, x + h);
  });
  const tip = centre(hi - end, hi);
  return at.map((p, i) => {
    const next = at[i + 1] ?? tip;
    const d = next.clone().sub(p);
    return { at: p.toArray(), axis: d.clone().normalize().toArray(), len: d.length() };
  });
}

export function canonicalFrame(along, back) {
  const y = new V().copy(along).normalize();
  const z = new V().copy(back).addScaledVector(y, -back.dot(y)).normalize();
  const x = new V().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)).toArray();
}

export function chainRadius(points, joints) {
  return pct(
    points.map((p) => onChain(p, joints).d),
    0.5,
  );
}

// four influences, the smallest dropped, scaled back to one
function four(pairs) {
  const merged = new Map();
  for (const [j, w] of pairs) if (w > 0) merged.set(j, (merged.get(j) ?? 0) + w);
  const top = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
  return top.map(([j, w]) => [j, w / sum]);
}

function write(out, i, pairs) {
  for (let k = 0; k < 4; k++) {
    out.joints[i * 4 + k] = pairs[k]?.[0] ?? 0;
    out.weights[i * 4 + k] = pairs[k]?.[1] ?? 0;
  }
}

// where a point is on a chain: how far from it, and how far along it from
// the first joint (before it: less than 0; past the last joint: on along)
function onChain(p, chain) {
  let best = { d: Infinity, u: 0 };
  let run = 0;
  const a = new V();
  const ax = new V();
  chain.forEach((j, n) => {
    a.fromArray(j.at);
    ax.fromArray(j.axis);
    let t = p.clone().sub(a).dot(ax);
    if (n > 0) t = Math.max(0, t);
    if (n < chain.length - 1) t = Math.min(j.len, t);
    const d = a.clone().addScaledVector(ax, t).distanceTo(p);
    if (d < best.d) best = { d, u: run + t };
    run += j.len;
  });
  return best;
}

export function fingerWeights(points, joints, weights, chains, { hand, along, s0, band = 0.2, thumbBand = 0.4 }) {
  const out = { joints: Uint16Array.from(joints), weights: Float32Array.from(weights), touched: new Set() };
  const lengths = chains.map((c) => c.joints.reduce((s, j) => s + j.len, 0));
  const reachBack = Math.max(...chains.map((c, n) => (c.thumb ? 0 : band * lengths[n])));
  points.forEach((p, i) => {
    let h = 0;
    for (let k = 0; k < 4; k++) if (joints[i * 4 + k] === hand) h += weights[i * 4 + k];
    if (h <= 0) return;
    let pick = null;
    chains.forEach((c, n) => {
      // (a finger takes nothing of the palm short of its knuckles' band)
      if (!c.thumb && p.dot(along) < s0 - reachBack) return;
      const on = onChain(p, c.joints);
      if (!pick || on.d < pick.on.d) pick = { c, n, on };
    });
    if (!pick) return;
    const { c, n, on } = pick;
    const b = (c.thumb ? thumbBand : band) * lengths[n];
    const near = c.radius ? 1 - smooth((on.d - 2 * c.radius) / c.radius) : 1;
    const f = smooth((on.u + b) / (2 * b)) * near;
    if (f <= 0) return;
    // joint to joint along the finger
    const share = [];
    let carry = 1;
    let at = 0;
    c.joints.forEach((j, m) => {
      if (m === c.joints.length - 1) return share.push(carry);
      at += j.len;
      const hw = j.len / 10;
      const next = smooth((on.u - (at - hw)) / (2 * hw));
      share.push(carry * (1 - next));
      carry *= next;
    });
    const pairs = [];
    for (let k = 0; k < 4; k++) if (joints[i * 4 + k] !== hand) pairs.push([joints[i * 4 + k], weights[i * 4 + k]]);
    pairs.push([hand, h * (1 - f)]);
    c.bones.forEach((bone, m) => pairs.push([bone, h * f * share[m]]));
    write(out, i, four(pairs));
    out.touched.add(i);
  });
  return out;
}

export function twistWeights(points, joints, weights, { fore, twist, elbow, wrist }) {
  const out = { joints: Uint16Array.from(joints), weights: Float32Array.from(weights), touched: new Set() };
  const d = new V().subVectors(wrist, elbow);
  const L2 = d.lengthSq();
  points.forEach((p, i) => {
    let f = 0;
    for (let k = 0; k < 4; k++) if (joints[i * 4 + k] === fore) f += weights[i * 4 + k];
    if (f <= 0) return;
    const x = Math.min(1, Math.max(0, p.clone().sub(elbow).dot(d) / L2));
    if (x <= 0) return;
    const pairs = [];
    for (let k = 0; k < 4; k++) if (joints[i * 4 + k] !== fore) pairs.push([joints[i * 4 + k], weights[i * 4 + k]]);
    pairs.push([fore, f * (1 - x)], [twist, f * x]);
    write(out, i, four(pairs));
    out.touched.add(i);
  });
  return out;
}
