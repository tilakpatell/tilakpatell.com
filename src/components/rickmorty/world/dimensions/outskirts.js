// What stands round a place and who's about in it (its world's record,
// ./worlds.js), laid out: pure, no three.js, the same every visit (seeded
// by the place's id). ./surround.js draws it.
//
// outskirtsOf(d, world, { tier, fogFar, tris }) → {
//   reach                     the ground, metres from the middle (past the fog)
//   edge: [{ kind, x0, z0, x1, z1, h, see }]   runs along the box's four sides
//   lots: [{ side, row, style, x, z, turn, w, d, h, y, model?, steps?, stand?, landmark? }]
//                             the ring of buildings, facing in (a model: a set piece),
//                             the stands and the landmarks the record names
//   skyline: [{ x, z, w, d, h, style }]
//   path: { pts: [[x, z]…], w } | null      the forecourt's way to the hero
//   props: [{ model, x, z, turn, s, h, edge? }]   rocks, bushes, lamps, trees…: models,
//                             the edge's, the forecourt's and the record's scatter
//   walkers: [{ key, kinds, n, loop: [[x, z]…], speed, out }]
//   gathers: [{ key, kinds, n, at: [x, z], r, row, y, beat, face: [x, z], block, until, after, when, out }]
//                             (`row`: its people along a row that long, not in a disc;
//                             `y`: how high they stand; `beat`: seconds between hops)
//   lanes: [{ key, model, n, y, from: [x, z], to: [x, z], speed }]
//   extents: { [key]: { x, y, z, r } }      a bounding sphere for each crowd and lane
// }
// `tier`: the renderer row's level (high, mid, low: kit.fit.tier); `fogFar`:
// where the place's fog is whole; `tris`: each crowd kind's triangles
// (./worlds.js's TRIS), which the crowd's allowance is counted in.
// loopProblems(d, loop) → what's wrong with a walker's loop in the box ([dx, dz] points)

import { seeded } from '../../../../lib/seeded';

// what each level lays: the crowd's triangles and kinds, the place's set
// pieces beyond its own, the traffic, the ring's lots and the skyline's
export const LEVELS = {
  high: { crowd: 360000, kinds: 6, sets: 4, traffic: 3, near: 40, far: 34 },
  mid: { crowd: 200000, kinds: 4, sets: 2, traffic: 2, near: 30, far: 24 },
  low: { crowd: 80000, kinds: 3, sets: 0, traffic: 1, near: 20, far: 14 },
};

const GAP = 8; // from the edge to the ring's first row: the street (and the walking camera's 5.6 m)
const STREET = 4; // where the street's walkers go round, from the edge
const LOT = { w: [8, 16], d: [8, 12], alley: [2, 6], row: 18, step: 1.5, rise: 0.2 };
const SKY = { near: 100, far: 0.8, w: [10, 24], over: 2.5 };
const EDGE = { solid: { wall: 0.9, kerb: 0.15 }, see: { rail: 1.4, fence: 1.4, barrier: 1.4 }, clump: 3.5 };
const SETS = { most: 2, apart: 40 };
const LANE = 1.1; // a lane's ends, in the fog's far edges
const FACING = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 };
const CLEAR = { solid: 1, people: 1, spot: 2, ends: 2 };

const hashOf = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h | 0;
};
const within = ([lo, hi], r) => lo + (hi - lo) * r;

// from a point to a box (x0…x1, z0…z1) outside it (0 inside)
const outOf = (A, x, z) => Math.hypot(Math.max(A.x0 - x, x - A.x1, 0), Math.max(A.z0 - z, z - A.z1, 0));
// a turn to the nearest quarter (a building faces square on)
const quarter = (a) => {
  const q = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  return Math.atan2(Math.sin(q), Math.cos(q));
};
// the angle off north, from the way in to (x, z)
const offNorth = (d, x, z) => Math.abs(Math.atan2(x - d.arrive.x, -(z - d.arrive.z)));

// ── the edge ──
function edgeOf(d, edge, r) {
  const A = d.area;
  if (!edge || d.kind === 'room') return { runs: [], clumps: [] };
  const sides = [
    [A.x0, A.z0, A.x1, A.z0],
    [A.x0, A.z1, A.x1, A.z1],
    [A.x1, A.z0, A.x1, A.z1],
    [A.x0, A.z0, A.x0, A.z1],
  ];
  if (edge.kind in EDGE.solid || edge.kind in EDGE.see) {
    const see = edge.kind in EDGE.see;
    const top = see ? EDGE.see[edge.kind] : EDGE.solid[edge.kind];
    const h = Math.min(edge.h ?? top, top);
    return { runs: sides.map(([x0, z0, x1, z1]) => ({ kind: edge.kind, x0, z0, x1, z1, h, see })), clumps: [] };
  }
  if (edge.kind === 'rocks' || edge.kind === 'bushes') {
    const models = edge.models ?? [];
    const clumps = [];
    // along each side every few metres, a little way out, and one at each corner
    for (const [x0, z0, x1, z1] of sides) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.ceil(len / EDGE.clump);
      const ox = z0 === z1 ? 0 : x0 === A.x0 ? -1 : 1;
      const oz = x0 === x1 ? 0 : z0 === A.z0 ? -1 : 1;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const out = within([0.6, 3], r());
        clumps.push({ model: models[i % Math.max(1, models.length)] ?? null, x: x0 + (x1 - x0) * k + ox * out, z: z0 + (z1 - z0) * k + oz * out, turn: r() * Math.PI * 2, s: within([0.8, 1.3], r()), h: edge.h ?? 0.9, edge: true });
      }
    }
    for (const [x, z] of [[A.x0, A.z0], [A.x1, A.z0], [A.x0, A.z1], [A.x1, A.z1]]) clumps.push({ model: models[0] ?? null, x: x + Math.sign(x - d.centre.x) * 2, z: z + Math.sign(z - d.centre.z) * 2, turn: r() * Math.PI * 2, s: 1.4, h: edge.h ?? 0.9, edge: true });
    return { runs: [], clumps };
  }
  return { runs: [], clumps: [] };
}

// ── the ring ──
function ringOf(d, ring, vista, r) {
  const A = d.area;
  const lots = [];
  for (const side of ['n', 'e', 's', 'w']) {
    const spec = ring?.[side];
    if (!spec) continue;
    const rows = spec.rows ?? 1;
    const reachOut = GAP + rows * LOT.row;
    // along the side: n and s run past the corners (the corners are theirs), e and w along the box
    const [from, to] = side === 'n' || side === 's' ? [A.x0 - reachOut, A.x1 + reachOut] : [A.z0, A.z1];
    for (let row = 0; row < rows; row++) {
      let at = from + within(LOT.alley, r());
      while (at < to) {
        const w = Math.round(within(LOT.w, r()) / 2) * 2;
        const dd = Math.round(within(LOT.d, r()) / 2) * 2;
        const u = at + w / 2;
        at += w + within(LOT.alley, r());
        if (u + w / 2 > to) break;
        const out = GAP + row * LOT.row + dd / 2;
        const [x, z] = side === 'n' ? [u, A.z0 - out] : side === 's' ? [u, A.z1 + out] : side === 'e' ? [A.x1 + out, u] : [A.x0 - out, u];
        if (offNorth(d, x, z) < vista) continue;
        const h = within(spec.h ?? [6, 14], r()) * (1 + row * LOT.rise);
        const style = spec.styles[Math.floor(r() * spec.styles.length)];
        lots.push({ side, row, style, x, z, turn: FACING[side], w, d: dd, h, y: row * LOT.step });
      }
    }
  }
  return lots;
}

// the place's own set pieces, in the first row of their side: at most twice
// each, 40 m apart, as many as the level allows
function setsIn(lots, ring, most) {
  let left = most;
  for (const side of ['n', 'e', 's', 'w']) {
    for (const set of ring?.[side]?.sets ?? []) {
      const first = lots.filter((l) => l.side === side && l.row === 0 && !l.model);
      const mid = first.length ? (Math.min(...first.map((l) => l.x + l.z)) + Math.max(...first.map((l) => l.x + l.z))) / 2 : 0;
      first.sort((a, b) => Math.abs(a.x + a.z - mid) - Math.abs(b.x + b.z - mid));
      const placed = [];
      for (const l of first) {
        if (left <= 0 || placed.length >= Math.min(SETS.most, set.n ?? SETS.most)) break;
        if (placed.some((p) => Math.hypot(p.x - l.x, p.z - l.z) < SETS.apart)) continue;
        Object.assign(l, { model: set.model, style: 'set', h: set.h, y: 0 });
        placed.push(l);
        left -= 1;
      }
    }
  }
}

// the record's landmarks: what it names, where it says, facing the place (none of the ring's count or its vista)
function landmarksOf(d, list) {
  return (list ?? []).map((m) => {
    const x = d.centre.x + m.at[0];
    const z = d.centre.z + m.at[1];
    return { side: null, row: null, style: m.style, x, z, turn: quarter(Math.atan2(d.centre.x - x, d.centre.z - z)), w: m.w, d: m.d, h: m.h, y: 0, landmark: true };
  });
}
// models scattered out round the place (trees, rocks): as many as the level says, clear of the box and the buildings
function scatterOf(d, list, tier, lots, r) {
  const out = [];
  const clear = (x, z) =>
    outOf(d.area, x, z) >= GAP &&
    !lots.some((l) => {
      const across = Math.abs(Math.sin(l.turn)) > 0.5;
      return Math.abs(x - l.x) < (across ? l.d : l.w) / 2 + 1 && Math.abs(z - l.z) < (across ? l.w : l.d) / 2 + 1;
    });
  for (const sc of list ?? []) {
    const want = sc.n?.[tier] ?? 0;
    let made = 0;
    for (let tries = 0; made < want && tries < want * 40; tries++) {
      const a = r() * Math.PI * 2;
      const rad = within(sc.r ?? [20, 120], Math.sqrt(r()));
      const x = d.centre.x + Math.cos(a) * rad;
      const z = d.centre.z + Math.sin(a) * rad;
      if (!clear(x, z)) continue;
      out.push({ model: sc.model, x, z, turn: r() * Math.PI * 2, s: within([0.85, 1.15], r()), h: sc.h ?? null });
      made += 1;
    }
  }
  return out;
}

// ── the skyline ──
const SECTOR = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 };
function skylineOf(d, far, count, tallest, fogFar, vista, r) {
  const sides = ['n', 'e', 's', 'w'].filter((s) => far?.[s]);
  const r1 = SKY.far * fogFar;
  if (!sides.length || r1 < SKY.near) return [];
  const each = Math.floor(count / sides.length);
  const out = [];
  for (const side of sides) {
    const spec = far[side];
    const lo = Math.max(spec.h[0], SKY.over * tallest);
    const hi = Math.max(spec.h[1], lo * 1.3);
    for (let i = 0; i < each; i++) {
      // (an angle in the side's quarter: off north, clockwise, as offNorth measures)
      const a = SECTOR[side] + (i / Math.max(1, each) - 0.5) * (Math.PI / 2) + (r() - 0.5) * 0.2;
      const rad = within([SKY.near, r1], r());
      const x = d.centre.x + Math.sin(a) * rad;
      const z = d.centre.z - Math.cos(a) * rad;
      const h = within([lo, hi], r());
      const w = within(SKY.w, r());
      if (offNorth(d, x, z) < vista) continue;
      out.push({ x, z, w, d: within(SKY.w, r()), h, style: spec.styles[Math.floor(r() * spec.styles.length)] });
    }
  }
  return out;
}

// ── the crowd ──
const street = (A) => [
  [A.x0 - STREET, A.z0 - STREET],
  [A.x1 + STREET, A.z0 - STREET],
  [A.x1 + STREET, A.z1 + STREET],
  [A.x0 - STREET, A.z1 + STREET],
];
// a stand's seats (a lot) and its people, a row a step, up from the front
function standsOf(d, stands, tier, hero) {
  const lots = [];
  const gathers = [];
  for (const [i, st] of (stands ?? []).entries()) {
    const x = d.centre.x + st.at[0];
    const z = d.centre.z + st.at[1];
    const face = st.face === 'hero' ? hero : [d.centre.x + (st.face?.[0] ?? 0), d.centre.z + (st.face?.[1] ?? 0)];
    const turn = quarter(Math.atan2(face[0] - x, face[1] - z));
    const rows = st.rows ?? 3;
    lots.push({ side: null, row: null, style: 'stand', x, z, turn, w: st.w, d: st.d, h: st.h, y: 0, steps: rows, stand: true });
    const fx = Math.sin(turn);
    const fz = Math.cos(turn);
    const all = st.n?.[tier] ?? 0;
    for (let r = 0; r < rows; r++) {
      const back = st.d / 2 - (r + 0.5) * (st.d / rows);
      const n = Math.floor(all / rows) + (r < all % rows ? 1 : 0);
      gathers.push({ key: `stand-${i}-${r}`, kinds: st.kinds, n, at: [x + fx * back, z + fz * back], r: 0, row: st.w * 0.9, y: ((r + 1) * st.h) / rows, beat: st.beat ?? null, face, block: null, until: st.until ?? null, after: st.after ?? null, when: null, out: true });
    }
  }
  return { lots, gathers };
}

function crowdOf(d, crowd, { tier, row, room, outside, tris, hero, extra = [] }) {
  const A = d.area;
  const W = (p) => [d.centre.x + p[0], d.centre.z + p[1]];
  // the kinds, the first `row.kinds` named
  const kinds = [...new Set([...(crowd?.walk ?? []), ...(crowd?.gather ?? []), ...extra].flatMap((c) => c.kinds))].slice(0, row.kinds);
  const keep = (c) => ({ ...c, kinds: c.kinds.filter((k) => kinds.includes(k)) });
  let walkers = (crowd?.walk ?? []).map((c, i) => {
    const out = c.loop === 'street';
    return { key: `walk-${i}`, ...keep(c), n: c.n?.[tier] ?? 0, loop: out ? street(A) : c.loop.map(W), speed: c.speed ?? 1.2, out };
  });
  let gathers = (crowd?.gather ?? []).map((c, i) => {
    const at = W(c.at);
    const face = c.face === 'hero' ? hero : c.face ? W(c.face) : [d.centre.x, d.centre.z];
    return { key: `gather-${i}`, ...keep(c), n: c.n?.[tier] ?? 0, at, r: c.r ?? 3, row: c.row ?? null, y: c.y ?? 0, beat: c.beat ?? null, face, block: c.block ?? null, until: c.until ?? null, after: c.after ?? null, when: c.when ?? null, out: outOf(A, ...at) > 0 };
  });
  gathers.push(...extra.map(keep));
  // a room: no one outside it with nothing outside, or on low
  if (room) {
    const none = !outside || tier === 'low';
    walkers = walkers.map((c) => (c.out && none ? { ...c, n: 0 } : c));
    gathers = gathers.map((c) => (c.out && none ? { ...c, n: 0 } : c));
  }
  const all = [...walkers, ...gathers].filter((c) => c.kinds.length && c.n > 0);
  // the triangles: a room half a place's
  const allow = room ? row.crowd / 2 : row.crowd;
  const cost = (c) => c.n * Math.max(...c.kinds.map((k) => tris[k] ?? Infinity));
  const total = all.reduce((a, c) => a + cost(c), 0);
  if (total > allow) for (const c of all) c.n = Math.floor((c.n * allow) / total);
  const kept = all.filter((c) => c.n > 0 && Number.isFinite(cost(c)));
  return { walkers: kept.filter((c) => c.loop), gathers: kept.filter((c) => !c.loop) };
}

// ── the traffic ──
function lanesOf(d, fliers, { tier, row, room, outside, fogFar }, r) {
  if (room && (!outside || tier === 'low')) return [];
  let left = room ? Math.floor(row.traffic / 2) || (tier === 'low' ? 0 : 1) : row.traffic;
  // (from past the fog to past it again: a ship comes and goes in the sky's own colour)
  const R = LANE * fogFar;
  const out = [];
  for (const [i, f] of (fliers ?? []).entries()) {
    const n = Math.min(f.n?.[tier] ?? 0, left);
    if (n <= 0) continue;
    left -= n;
    const a = r() * Math.PI * 2;
    const y = within(f.y ?? [30, 60], r());
    out.push({ key: `lane-${i}`, model: f.model, h: f.h ?? null, n, y, from: [d.centre.x - Math.cos(a) * R, d.centre.z - Math.sin(a) * R], to: [d.centre.x + Math.cos(a) * R, d.centre.z + Math.sin(a) * R], speed: f.speed ?? 16 });
  }
  return out;
}

// a bounding sphere round what a crowd or a lane may cover
function extentOf(c) {
  const pts = c.loop ?? (c.from ? [c.from, c.to] : [c.at]);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2;
  const z = (Math.min(...zs) + Math.max(...zs)) / 2;
  const far = Math.max(...pts.map(([px, pz]) => Math.hypot(px - x, pz - z)));
  return { x, y: c.from ? c.y : (c.y ?? 0) + 1, z, r: far + (c.r ?? 0) + (c.row ?? 0) / 2 + (c.from ? 15 : 2.5) };
}

// ── the forecourt ──
function forecourtOf(d, fc, hero, r) {
  if (!fc || d.kind === 'room') return { path: null, props: [] };
  const from = [d.arrive.x, d.arrive.z - 1];
  const path = fc.path ? { pts: [from, hero], w: fc.path.w ?? 3, color: fc.path.color } : null;
  const props = [];
  const len = Math.hypot(hero[0] - from[0], hero[1] - from[1]);
  const ux = (hero[0] - from[0]) / (len || 1);
  const uz = (hero[1] - from[1]) / (len || 1);
  for (const p of fc.props ?? []) {
    const h = Math.min(p.h ?? 1, 1.2);
    for (let i = 0; i < (p.n ?? 0); i++) {
      const k = within([2, Math.max(2, len - 3)], (i + r() * 0.5) / Math.max(1, p.n));
      const side = i % 2 ? 1 : -1;
      const off = side * within([(fc.path?.w ?? 3) / 2 + 1.5, (fc.path?.w ?? 3) / 2 + 4], r());
      const x = from[0] + ux * k - uz * off;
      const z = from[1] + uz * k + ux * off;
      if (!clearOf(d, x, z, 1.2)) continue;
      props.push({ model: p.model, x, z, turn: r() * Math.PI * 2, s: within([0.85, 1.15], r()), h });
    }
  }
  return { path, props };
}
// (a spot clear of everything the place has there)
function clearOf(d, x, z, pad) {
  if (outOf(d.area, x, z) > 0 || x < d.area.x0 + 1 || x > d.area.x1 - 1 || z < d.area.z0 + 1 || z > d.area.z1 - 1) return false;
  for (const s of d.hotspots) if (Math.hypot(s.x - x, s.z - z) < (s.r ?? 1.4) + pad) return false;
  for (const p of [...d.people, ...d.extras]) if (Math.hypot(p.x - x, p.z - z) < pad) return false;
  for (const o of d.solids) if (o.r != null ? Math.hypot(o.x - x, o.z - z) < o.r + pad : Math.abs(o.x - x) < o.w / 2 + pad && Math.abs(o.z - z) < o.d / 2 + pad) return false;
  for (const q of [d.arrive, d.back]) if (Math.hypot(q.x - x, q.z - z) < 1.5 + pad) return false;
  return true;
}

export function outskirtsOf(d, world, { tier = 'high', fogFar = 300, tris = {} } = {}) {
  const r = seeded(hashOf(d.id));
  const row = LEVELS[tier] ?? LEVELS.high;
  const room = d.kind === 'room';
  const outside = room ? (world.outside ?? null) : 'ground';
  const hero = world.hero ? [d.centre.x + world.hero[0], d.centre.z + world.hero[1]] : [d.centre.x, d.area.z0];
  const vista = world.vista ?? 0;

  const { runs, clumps } = edgeOf(d, world.edge, r);
  // the ring: only where there's ground outside; the first rows first, nearest first, up to the level's count
  let lots = outside === 'ground' ? ringOf(d, world.ring, vista, r) : [];
  lots.sort((a, b) => a.row - b.row || Math.hypot(a.x - d.centre.x, a.z - d.centre.z) - Math.hypot(b.x - d.centre.x, b.z - d.centre.z));
  lots = lots.slice(0, row.near);
  setsIn(lots, world.ring, row.sets);
  const tallest = lots.reduce((a, l) => Math.max(a, l.h + l.y), 0);
  const skyline = outside === 'ground' ? skylineOf(d, world.far, row.far, tallest, fogFar, vista, r) : [];
  const { path, props } = forecourtOf(d, world.forecourt, hero, r);
  const stands = outside === 'ground' ? standsOf(d, world.stands, tier, hero) : { lots: [], gathers: [] };
  const landmarks = outside === 'ground' ? landmarksOf(d, world.landmarks) : [];
  const scattered = outside === 'ground' ? scatterOf(d, world.scatter, tier, [...lots, ...stands.lots, ...landmarks], r) : [];
  const { walkers, gathers } = crowdOf(d, world.crowd, { tier, row, room, outside, tris, hero, extra: stands.gathers });
  const lanes = outside ? lanesOf(d, world.fliers, { tier, row, room, outside, fogFar }, r) : [];
  const extents = Object.fromEntries([...walkers, ...gathers, ...lanes].map((c) => [c.key, extentOf(c)]));
  return { reach: fogFar + 20, edge: runs, lots: [...lots, ...stands.lots, ...landmarks], skyline, path, props: [...clumps, ...props, ...scattered], walkers, gathers, lanes, extents };
}

// ── a walker's loop in the box, checked ──
const segGap = (ax, az, bx, bz, f) => {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
  let best = Infinity;
  for (let k = 0; k <= n; k++) best = Math.min(best, f(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n));
  return best;
};
const loopGap = (pts, f) => Math.min(...pts.map(([ax, az], i) => segGap(ax, az, pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], f)));
export function loopProblems(d, loop) {
  const pts = loop.map(([dx, dz]) => [d.centre.x + dx, d.centre.z + dz]);
  const A = d.area;
  const out = [];
  if (pts.some(([x, z]) => x < A.x0 + 0.5 || x > A.x1 - 0.5 || z < A.z0 + 0.5 || z > A.z1 - 0.5)) out.push('outside the box');
  for (const o of d.solids) {
    const g = loopGap(pts, (x, z) => (o.r != null ? Math.hypot(o.x - x, o.z - z) - o.r : Math.hypot(Math.max(Math.abs(x - o.x) - o.w / 2, 0), Math.max(Math.abs(z - o.z) - o.d / 2, 0))));
    if (g < CLEAR.solid) out.push(`too near the solid ${o.id}`);
  }
  for (const p of [...d.people, ...d.extras.map((e, i) => ({ ...e, id: `${e.kind}-${i}` }))]) {
    if (loopGap(pts, (x, z) => Math.hypot(p.x - x, p.z - z)) < CLEAR.people) out.push(`too near ${p.id}`);
    else if (p.ai?.wander) {
      const route = p.ai.wander.map(([x, z]) => [x, z]);
      const g = Math.min(...route.map(([ax, az], i) => segGap(ax, az, route[(i + 1) % route.length][0], route[(i + 1) % route.length][1], (x, z) => loopGap(pts, (lx, lz) => Math.hypot(lx - x, lz - z)))));
      if (g < CLEAR.people) out.push(`across ${p.id}’s way round`);
    }
  }
  for (const s of d.hotspots) if (loopGap(pts, (x, z) => Math.hypot(s.x - x, s.z - z)) < (s.r ?? 1.4) + CLEAR.spot) out.push(`too near the spot ${s.id}`);
  if (loopGap(pts, (x, z) => Math.hypot(d.arrive.x - x, d.arrive.z - z)) < CLEAR.ends) out.push('too near the way in');
  if (loopGap(pts, (x, z) => Math.hypot(d.back.x - x, d.back.z - z)) < CLEAR.ends) out.push('too near the portal home');
  return out;
}
