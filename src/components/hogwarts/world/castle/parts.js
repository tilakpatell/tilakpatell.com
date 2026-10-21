// The castle’s kit of parts: each a function that lays its faces into a
// mesh (mesh.js) by material, so the plan (plan.js) composes the whole
// castle from a list and it comes out merged, a draw a material. Every
// part stands on `base` (its floor, the castle’s by default) and reaches
// down to the ground under it with a plinth of rubble, wherever the crag
// falls away beneath it (`ctx.ground(x, z)`, the terrain’s heights).
//
//   tower     a round tower of a radius and a height: windows in rows, a
//             string course, a slate cone with a bell to its foot and a
//             finial, or a battlement on corbels, or both (a cone rising
//             inside the parapet)
//   square    a square tower or block: windows on each face, a pyramid of
//             slate, a gable, a battlement, corner turrets, a clock’s face
//   hall      a long hall: buttresses with pinnacles, tall gothic windows
//             between them, a steep gabled slate roof with dormers, great
//             windows in its gable ends
//   wall      a curtain wall between two points, battlemented
//   viaduct   a stone bridge of arches on piers down to the ground
//   covered   the timber bridge: a deck on trestles, posts and braces, a slate roof
//   stair     flights of steps between landings, a parapet on the open side
//   gatehouse an arch between two small towers
//   glasshouse  glass over an iron frame on a low wall
//   fountain  a basin, a pedestal, a bowl
//   boathouse a stone shed over the water, its boat arch to the lake
//
// `ctx`: { mesh, ground(x, z), far (the far silhouette’s cut: fewer
// sides, no merlons, sills or buttress steps), rng() }. Materials are named:
// ashlar, rubble, slate, lead, glass, timber, iron, pane (materials.js).

import { archOutline } from './mesh';
import { TONES } from './materials';
import { CASTLE_FLOOR } from '../../rules/places';

const TAU = Math.PI * 2;

// the lowest ground under a circle or a box, so a plinth reaches it
function lowestUnder(ctx, x, z, r) {
  let lo = ctx.ground(x, z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    lo = Math.min(lo, ctx.ground(x + Math.sin(a) * r, z + Math.cos(a) * r));
  }
  return lo;
}

// the windows round a tower: a row at each height, `per` of them, staggered row to row
function towerWindows(ctx, { at, r, rows, per, w, h, voids = false }) {
  const m = ctx.mesh;
  rows.forEach((y, i) => {
    for (let k = 0; k < per; k++) {
      const a = ((k + (i % 2) * 0.5) / per) * TAU + 0.3;
      const pos = [at[0] + Math.sin(a) * (r + 0.04), y, at[2] + Math.cos(a) * (r + 0.04)];
      m.lit(voids ? 0 : 0.05 + ctx.rng() * 0.9);
      m.tone(voids ? TONES.iron : TONES.glass);
      m.shape(voids ? 'iron' : 'glass', { at: pos, turn: a, outline: archOutline(w, h, { pointed: true, segs: ctx.far ? 2 : 3 }) });
      m.lit(0);
      if (!ctx.far) {
        // (a sill under it, and a hood over its head, in the pale stone)
        m.tone(TONES.pale);
        m.box('ashlar', { at: [at[0] + Math.sin(a) * (r + 0.12), y - 0.25, at[2] + Math.cos(a) * (r + 0.12)], size: [w + 0.5, 0.25, 0.3], turn: a });
      }
    }
  });
}

// a ring of merlons on a parapet `r` round at height `y`
function merlonRing(ctx, { at, r, y, tone }) {
  const m = ctx.mesh;
  const n = Math.max(6, Math.round((TAU * r) / 2.1));
  m.tone(tone);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    m.box('ashlar', { at: [at[0] + Math.sin(a) * r, y, at[2] + Math.cos(a) * r], size: [1.05, 1.15, 0.55], turn: a });
  }
}

// a slate cone with a bell at its foot (its eave flared out over the wall), and a lead finial
function cone(ctx, { at, r, h, flare = 1.35, overhang = 0.7, sides, finial = true }) {
  const m = ctx.mesh;
  const n = ctx.far ? 4 : 9;
  const R = r + overhang;
  const profile = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // (concave: the bell kicks out at the eave and the spire draws in above it)
    profile.push([R * Math.pow(1 - t, flare), h * t]);
  }
  profile[n] = [0.001, h];
  m.tone(TONES.slate);
  m.lathe('slate', { at, profile, sides });
  if (finial && !ctx.far) {
    m.tone(TONES.lead);
    m.lathe('lead', { at: [at[0], at[1] + h - 0.3, at[2]], profile: [[0.28, 0], [0.18, 0.5], [0.3, 0.9], [0.05, 2.4], [0.001, 3.4]], sides: 6 });
  }
}

export function tower(ctx, s) {
  const m = ctx.mesh;
  const base = s.base ?? CASTLE_FLOOR;
  const at = [s.at[0], base, s.at[1]];
  const sides = ctx.far ? Math.max(8, Math.round((s.sides ?? 16) * 0.6)) : (s.sides ?? (s.r > 5 ? 20 : 14));
  const tone = TONES[s.tone ?? 'stone'];
  // the plinth, down to the ground, a little wider
  const lo = lowestUnder(ctx, s.at[0], s.at[1], s.r + 0.4);
  if (lo < base + 0.5) {
    m.tone(TONES.plinth);
    m.ring('rubble', { at: [at[0], lo - 1.5, at[2]], r: s.r + 0.45, r2: s.r + 0.3, h: base - lo + 2.5, sides });
  }
  m.tone(tone);
  m.ring(s.stone ?? 'ashlar', { at, r: s.r, h: s.h, sides });
  // (a string course two thirds up: one line that makes a tower read as built)
  if (!ctx.far && s.h > 14) {
    m.tone(TONES.pale);
    m.ring('ashlar', { at: [at[0], base + s.h * 0.62, at[2]], r: s.r + 0.18, h: 0.45, sides, cap: false });
  }
  if (s.windows) towerWindows(ctx, { at, r: s.r, rows: s.windows.rows.map((y) => base + y), per: s.windows.per, w: s.windows.w ?? 1.2, h: s.windows.h ?? 2.6, voids: s.windows.voids });
  const top = base + s.h;
  const roof = s.roof ?? 'cone';
  if (roof === 'battlement' || roof === 'both') {
    // corbels and a parapet stepped out over the wall, merlons on it, lead inside
    const pr = s.r + 0.55;
    m.tone(tone);
    m.ring('ashlar', { at: [at[0], top - 1.1, at[2]], r: s.r, r2: pr, h: 1.1, sides });
    m.ring('ashlar', { at: [at[0], top, at[2]], r: pr, h: 1.1, sides, cap: false });
    m.ring('ashlar', { at: [at[0], top, at[2]], r: pr - 0.5, h: 1.1, sides, inside: true });
    // (the parapet’s coping: a flat ring on top of it)
    m.ring('ashlar', { at: [at[0], top + 1.1, at[2]], r: pr, r2: pr - 0.5, h: 0.001, sides });
    m.tone(TONES.lead);
    m.ring('lead', { at: [at[0], top, at[2]], r: pr - 0.5, r2: 0.01, h: 0.4, sides });
    if (!ctx.far) merlonRing(ctx, { at, r: pr - 0.22, y: top + 1.1, tone });
    if (roof === 'both') cone(ctx, { at: [at[0], top + 0.3, at[2]], r: s.r - 0.7, h: s.cone?.h ?? s.r * 2.4, flare: s.cone?.flare ?? 1.2, overhang: 0.3, sides });
  } else if (roof === 'cone') {
    m.tone(tone);
    // (an eave band the cone sits on)
    m.ring('ashlar', { at: [at[0], top - 0.5, at[2]], r: s.r, r2: s.r + 0.3, h: 0.5, sides, cap: true });
    cone(ctx, { at: [at[0], top, at[2]], r: s.r, h: s.cone?.h ?? s.r * 2.6, flare: s.cone?.flare ?? 1.35, overhang: s.cone?.overhang ?? 0.6, sides });
  } else {
    m.tone(TONES.lead);
    m.ring('lead', { at: [at[0], top, at[2]], r: s.r, r2: 0.01, h: 0.6, sides });
  }
}

// the faces of a turned box: its four sides’ middles, the way each faces and how wide
function facesOf(s, h) {
  const c = Math.cos(s.turn ?? 0);
  const sn = Math.sin(s.turn ?? 0);
  const d = s.d ?? s.w;
  const out = (u, v) => [s.at[0] + u * c + v * sn, s.at[1] - u * sn + v * c];
  return [
    { at: out(0, d / 2), turn: s.turn ?? 0, width: s.w, name: 'front' },
    { at: out(0, -d / 2), turn: (s.turn ?? 0) + Math.PI, width: s.w, name: 'back' },
    { at: out(s.w / 2, 0), turn: (s.turn ?? 0) + Math.PI / 2, width: d, name: 'right' },
    { at: out(-s.w / 2, 0), turn: (s.turn ?? 0) - Math.PI / 2, width: d, name: 'left' },
  ].map((f) => ({ ...f, h }));
}

// windows along a flat face: rows of `per`, evenly spaced, on the face’s plane
function faceWindows(ctx, face, base, { rows, per, w = 1.3, h = 2.8, pointed = true }) {
  const m = ctx.mesh;
  const c = Math.cos(face.turn);
  const s = Math.sin(face.turn);
  for (const y of rows)
    for (let k = 0; k < per; k++) {
      const u = (k - (per - 1) / 2) * (face.width / per);
      const pos = [face.at[0] + u * c + s * 0.04, base + y, face.at[1] - u * s + c * 0.04];
      m.tone(TONES.glass).lit(0.05 + ctx.rng() * 0.9);
      m.shape('glass', { at: pos, turn: face.turn, outline: archOutline(w, h, { pointed, segs: ctx.far ? 2 : 3 }) });
      m.lit(0);
      if (!ctx.far) {
        m.tone(TONES.pale);
        m.box('ashlar', { at: [pos[0] + s * 0.1, base + y - 0.25, pos[2] + c * 0.1], size: [w + 0.5, 0.25, 0.3], turn: face.turn });
      }
    }
}

// merlons along a straight parapet from a to b (x, z) at height y, set `out` from the line toward `n`
function merlonRun(ctx, a, b, y, tone, mat = 'ashlar') {
  const m = ctx.mesh;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.round(L / 2.1));
  const turn = Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.PI / 2;
  m.tone(tone);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    m.box(mat, { at: [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t], size: [1.05, 1.15, 0.55], turn });
  }
}

// a parapet round the top of a box `w` × `d` turned `turn` at height `top`, stepped out on a corbel band
function boxParapet(ctx, s, top, tone) {
  const m = ctx.mesh;
  const d = s.d ?? s.w;
  const turn = s.turn ?? 0;
  m.tone(tone);
  m.box('ashlar', { at: [s.at[0], top - 1, s.at[1]], size: [s.w + 1, 1, d + 1], turn });
  // the parapet: four thin walls on the band
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const P = (u, v) => [s.at[0] + u * c + v * sn, s.at[1] - u * sn + v * c];
  const hw = s.w / 2 + 0.5;
  const hd = d / 2 + 0.5;
  const edges = [
    [P(-hw, hd), P(hw, hd)],
    [P(hw, hd), P(hw, -hd)],
    [P(hw, -hd), P(-hw, -hd)],
    [P(-hw, -hd), P(-hw, hd)],
  ];
  for (const [a, b] of edges) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.PI / 2;
    m.box('ashlar', { at: [(a[0] + b[0]) / 2, top, (a[1] + b[1]) / 2], size: [L, 1.1, 0.5], turn: t });
    if (!ctx.far) merlonRun(ctx, a, b, top + 1.1, tone);
  }
  m.tone(TONES.lead);
  m.box('lead', { at: [s.at[0], top, s.at[1]], size: [s.w, 0.3, d], turn });
}

// a square pyramid of slate over a box (a spire when tall), its corners on the box’s
function pyramid(ctx, { at, w, d, h, turn = 0, overhang = 0.5 }) {
  const m = ctx.mesh;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const hw = w / 2 + overhang;
  const hd = d / 2 + overhang;
  const P = (u, v, y) => [at[0] + u * c + v * sn, at[1] + y, at[2] - u * sn + v * c];
  const apex = P(0, 0, h);
  const corners = [P(-hw, hd, 0), P(hw, hd, 0), P(hw, -hd, 0), P(-hw, -hd, 0)];
  m.tone(TONES.slate);
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const slant = Math.hypot(h, i % 2 ? hw : hd);
    m.tri('slate', a, b, apex, [[0, 0], [span, 0], [span / 2, slant]]);
  }
  if (!ctx.far) {
    m.tone(TONES.lead);
    m.lathe('lead', { at: [apex[0], apex[1] - 0.3, apex[2]], profile: [[0.25, 0], [0.12, 0.6], [0.001, 2.6]], sides: 6 });
  }
}

// a gabled roof over a box: two slopes of slate along its length (u), its
// gable ends in stone rising to the ridge
function gable(ctx, { at, len, w, h, turn = 0, overhang = 0.7, ends = 'ashlar', tone = TONES.stone }) {
  const m = ctx.mesh;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const P = (u, v, y) => [at[0] + u * c + v * sn, at[1] + y, at[2] - u * sn + v * c];
  const L = len / 2 + overhang * 0.6;
  const W = w / 2 + overhang;
  const slant = Math.hypot(W, h + overhang * (h / (w / 2)));
  const drop = overhang * (h / (w / 2));
  m.tone(TONES.slate);
  // (+v slope: eave to ridge; −v slope the same, mirrored)
  m.quad('slate', P(-L, W, -drop), P(L, W, -drop), P(L, 0, h), P(-L, 0, h), { u: 2 * L, v: slant });
  m.quad('slate', P(L, -W, -drop), P(-L, -W, -drop), P(-L, 0, h), P(L, 0, h), { u: 2 * L, v: slant });
  // the gable ends (and their undersides, the eaves’ soffit, left open: they read dark)
  m.tone(tone);
  m.tri(ends, P(len / 2, w / 2, 0), P(len / 2, -w / 2, 0), P(len / 2, 0, h), [[0, 0], [w, 0], [w / 2, h]]);
  m.tri(ends, P(-len / 2, -w / 2, 0), P(-len / 2, w / 2, 0), P(-len / 2, 0, h), [[0, 0], [w, 0], [w / 2, h]]);
  if (!ctx.far) {
    m.tone(TONES.lead);
    m.box('lead', { at: P(0, 0, h - 0.15), size: [2 * L, 0.35, 0.45], turn });
  }
}

export function square(ctx, s) {
  const m = ctx.mesh;
  const base = s.base ?? CASTLE_FLOOR;
  const d = s.d ?? s.w;
  const turn = s.turn ?? 0;
  const tone = TONES[s.tone ?? 'stone'];
  const lo = lowestUnder(ctx, s.at[0], s.at[1], Math.max(s.w, d) / 2);
  if (lo < base + 0.5) {
    m.tone(TONES.plinth);
    m.box('rubble', { at: [s.at[0], lo - 1.5, s.at[1]], size: [s.w + 0.8, base - lo + 2.5, d + 0.8], turn });
  }
  m.tone(tone);
  m.box(s.stone ?? 'ashlar', { at: [s.at[0], base, s.at[1]], size: [s.w, s.h, d], turn, top: s.roof !== 'gable' });
  if (s.windows) for (const f of facesOf(s, s.h)) if (!s.windows.faces || s.windows.faces.includes(f.name)) faceWindows(ctx, f, base, { ...s.windows, per: f.width === s.w ? (s.windows.per ?? 2) : (s.windows.side ?? s.windows.per ?? 2) });
  const top = base + s.h;
  const roof = s.roof ?? 'pyramid';
  if (roof === 'battlement' || roof === 'both') {
    boxParapet(ctx, s, top, tone);
    if (roof === 'both') pyramid(ctx, { at: [s.at[0], top + 0.3, s.at[1]], w: s.w - 1.4, d: d - 1.4, h: s.spire ?? s.w * 0.8, turn, overhang: 0.2 });
  } else if (roof === 'pyramid') {
    m.tone(tone);
    m.box('ashlar', { at: [s.at[0], top - 0.5, s.at[1]], size: [s.w + 0.5, 0.5, d + 0.5], turn });
    pyramid(ctx, { at: [s.at[0], top, s.at[1]], w: s.w, d, h: s.spire ?? s.w * 1.1, turn });
  } else if (roof === 'gable') gable(ctx, { at: [s.at[0], top, s.at[1]], len: s.w, w: d, h: s.ridge ?? d * 0.55, turn, tone });
  // the corner turrets, standing proud of the corners
  if (s.turrets) {
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    for (const [u, v] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = s.at[0] + (u * s.w) / 2 * c + (v * d) / 2 * sn;
      const z = s.at[1] - (u * s.w) / 2 * sn + (v * d) / 2 * c;
      tower(ctx, { at: [x, z], base: base + (s.turrets.from ?? 0), r: s.turrets.r ?? 2.4, h: (s.turrets.h ?? s.h + 6) - (s.turrets.from ?? 0), roof: 'cone', cone: { h: s.turrets.cone ?? 7 }, tone: s.tone, sides: 10 });
    }
  }
  // a clock’s face on the faces asked for: a pale dial in a lead rim, its hours marked
  if (s.clock) for (const f of facesOf(s, s.h)) if (s.clock.faces.includes(f.name)) dial(ctx, f, base + s.clock.y, s.clock.r);
  // a tall open bay under the clock where the pendulum swings, dark inside
  if (s.bay)
    for (const f of facesOf(s, s.h))
      if (s.bay.faces.includes(f.name)) {
        m.tone(TONES.iron);
        m.shape('iron', { at: [f.at[0] + Math.sin(f.turn) * 0.05, base + s.bay.y, f.at[1] + Math.cos(f.turn) * 0.05], turn: f.turn, outline: archOutline(s.bay.w, s.bay.h, { pointed: true, segs: 3 }) });
      }
}

function dial(ctx, f, y, r) {
  const m = ctx.mesh;
  const c = Math.cos(f.turn);
  const s = Math.sin(f.turn);
  const at = [f.at[0] + s * 0.12, y, f.at[1] + c * 0.12];
  const segs = ctx.far ? 12 : 28;
  // (counter-clockwise seen from in front, as shape() winds its faces)
  const circle = (rr) => Array.from({ length: segs }, (_, i) => [Math.cos((i / segs) * TAU) * rr, Math.sin((i / segs) * TAU) * rr]);
  // the rim, then the dial a little proud of it (the dial lights first at dusk: a face you can read the time by at night)
  m.tone(TONES.lead);
  m.shape('lead', { at: [at[0] - s * 0.02, y, at[2] - c * 0.02], turn: f.turn, outline: circle(r + 0.5) });
  m.tone(TONES.face).lit(0.02);
  m.shape('glass', { at, turn: f.turn, outline: circle(r) });
  m.lit(0);
  if (!ctx.far) {
    m.tone(TONES.iron);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const big = i % 3 === 0;
      const u = Math.sin(a) * r * 0.84;
      const v = Math.cos(a) * r * 0.84;
      m.shape('iron', { at: [at[0] + u * c + s * 0.03, y + v, at[2] - u * s + c * 0.03], turn: f.turn, outline: [[-0.12, -(big ? 0.5 : 0.3)], [0.12, -(big ? 0.5 : 0.3)], [0.12, big ? 0.5 : 0.3], [-0.12, big ? 0.5 : 0.3]] });
    }
  }
}

export function hall(ctx, s) {
  const m = ctx.mesh;
  const base = s.base ?? CASTLE_FLOOR;
  const turn = s.turn ?? 0;
  const tone = TONES[s.tone ?? 'stone'];
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const P = (u, v) => [s.at[0] + u * c + v * sn, s.at[1] - u * sn + v * c];
  const lo = lowestUnder(ctx, s.at[0], s.at[1], Math.max(s.len, s.w) / 2);
  if (lo < base + 0.5) {
    m.tone(TONES.plinth);
    m.box('rubble', { at: [s.at[0], lo - 1.5, s.at[1]], size: [s.len + 1, base - lo + 2.5, s.w + 1], turn });
  }
  m.tone(tone);
  m.box('ashlar', { at: [s.at[0], base, s.at[1]], size: [s.len, s.h, s.w], turn, top: false });
  // the bays: a buttress at each division, a tall window between, both long sides
  const n = s.windows?.n ?? 6;
  const bay = s.len / n;
  for (const side of [1, -1]) {
    const faceTurn = side > 0 ? turn : turn + Math.PI;
    for (let i = 0; i <= n; i++) {
      const u = -s.len / 2 + i * bay;
      const [bx, bz] = P(u, side * (s.w / 2 + 0.75));
      m.tone(tone);
      if (ctx.far) m.box('ashlar', { at: [bx, base, bz], size: [1.3, s.h - 1, 1.5], turn });
      else {
        // (two set-offs up its face, and a pinnacle on top)
        m.box('ashlar', { at: [bx, base, bz], size: [1.4, s.h * 0.55, 1.6], turn });
        const [bx2, bz2] = P(u, side * (s.w / 2 + 0.55));
        m.box('ashlar', { at: [bx2, base + s.h * 0.55, bz2], size: [1.2, s.h * 0.45 + 1.2, 1.1], turn });
        m.lathe('ashlar', { at: [bx2, base + s.h + 1.2, bz2], profile: [[0.75, 0], [0.55, 0.4], [0.001, 3.6]], sides: 4 });
      }
      if (i < n && s.windows) {
        const [wx, wz] = P(u + bay / 2, side * (s.w / 2 + 0.04));
        if (!ctx.far) {
          m.tone(TONES.pale);
          m.shape('ashlar', { at: [wx, base + s.windows.sill, wz], turn: faceTurn, out: 0.02, outline: archOutline(s.windows.w + 0.9, s.windows.h + 0.6, { pointed: true, segs: 4 }) });
        }
        m.tone(TONES.glass).lit(0.05 + ctx.rng() * 0.9);
        m.shape('glass', { at: [wx, base + s.windows.sill + 0.3, wz], turn: faceTurn, out: 0.06, outline: archOutline(s.windows.w, s.windows.h, { pointed: true, segs: ctx.far ? 2 : 4 }) });
        m.lit(0);
        if (!ctx.far) {
          // (the tracery’s mullion down the middle, so a great window reads as glazed in lights)
          m.tone(TONES.pale);
          m.box('ashlar', { at: [wx + Math.sin(faceTurn) * 0.1, base + s.windows.sill + 0.3, wz + Math.cos(faceTurn) * 0.1], size: [0.22, s.windows.h * 0.8, 0.12], turn: faceTurn });
        }
      }
    }
  }
  // the roof, its gables, and a great window in each gable end
  gable(ctx, { at: [s.at[0], base + s.h, s.at[1]], len: s.len, w: s.w, h: s.roof?.h ?? s.w * 0.75, turn: turn + 0, overhang: 0.9, tone });
  if (s.ends?.window)
    for (const side of [1, -1]) {
      const [ex, ez] = P((side * s.len) / 2 + side * 0.04, 0);
      const t = turn + (side * Math.PI) / 2;
      m.tone(TONES.glass).lit(0.05 + ctx.rng() * 0.6);
      m.shape('glass', { at: [ex, base + s.ends.window.sill, ez], turn: t, out: 0.04, outline: archOutline(s.ends.window.w, s.ends.window.h, { pointed: true, segs: ctx.far ? 2 : 5 }) });
      m.lit(0);
    }
  // dormers along the roof: small gabled windows up its slopes
  if (s.dormers && !ctx.far) {
    const k = s.dormers;
    const rh = s.roof?.h ?? s.w * 0.75;
    for (const side of [1, -1])
      for (let i = 0; i < k; i++) {
        const u = -s.len / 2 + ((i + 0.5) / k) * s.len;
        const v = side * (s.w / 2) * 0.45;
        const [dx, dz] = P(u, v);
        const y = base + s.h + rh * 0.55 - 1.2;
        m.tone(tone);
        m.box('ashlar', { at: [dx, y, dz], size: [2, 2.6, 2.4], turn });
        gable(ctx, { at: [dx, y + 2.6, dz], len: 2.4, w: 2, h: 1.3, turn: turn + Math.PI / 2, overhang: 0.25, tone });
        m.tone(TONES.glass).lit(0.1 + ctx.rng() * 0.85);
        const ft = side > 0 ? turn : turn + Math.PI;
        m.shape('glass', { at: [dx + Math.sin(ft) * 1.22, y + 0.3, dz + Math.cos(ft) * 1.22], turn: ft, outline: archOutline(0.9, 1.8, { pointed: true, segs: 2 }) });
        m.lit(0);
      }
  }
}

export function wall(ctx, s) {
  const m = ctx.mesh;
  const base = s.base ?? CASTLE_FLOOR;
  const [x0, z0] = s.from;
  const [x1, z1] = s.to;
  const L = Math.hypot(x1 - x0, z1 - z0);
  const turn = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
  const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
  const thick = s.thick ?? 2.2;
  const tone = TONES[s.tone ?? 'stone'];
  const lo = Math.min(lowestUnder(ctx, mid[0], mid[1], L / 2), ctx.ground(x0, z0), ctx.ground(x1, z1));
  if (lo < base + 0.5) {
    m.tone(TONES.plinth);
    m.box('rubble', { at: [mid[0], lo - 1.5, mid[1]], size: [L, base - lo + 2.5, thick + 0.8], turn });
  }
  m.tone(tone);
  m.box(s.stone ?? 'ashlar', { at: [mid[0], base, mid[1]], size: [L, s.h, thick], turn });
  if (s.battlement !== false && !ctx.far) {
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    for (const side of [1, -1]) {
      const off = (side * (thick / 2 - 0.28));
      merlonRun(ctx, [x0 + off * sn, z0 + off * c], [x1 + off * sn, z1 + off * c], base + s.h, tone);
    }
  }
}

// Stone arches on piers: the deck from `from` [x, y, z] to `to`, arches
// `span` apart, each pier down to the ground, the spandrels filled up to the
// deck on both faces, the arch’s soffit under, a parapet each side
export function viaduct(ctx, s) {
  const m = ctx.mesh;
  const [x0, y0, z0] = s.from;
  const [x1, y1, z1] = s.to;
  const L = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(L / (s.span ?? 12)));
  const span = L / n;
  const w = s.width ?? 5;
  const turn = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const deck = (t) => y0 + (y1 - y0) * t;
  const P = (u, v, y) => [x0 + ((x1 - x0) * u) / L + v * sn, y, z0 + ((z1 - z0) * u) / L + v * c];
  const pierW = s.pier ?? 2.4;
  const rise = (span - pierW) / 2;
  const segs = ctx.far ? 3 : 7;
  for (let i = 0; i <= n; i++) {
    const u = i * span;
    const top = deck(u / L) - 1.2 - rise;
    const [px, , pz] = P(u, 0, 0);
    const g = Math.min(ctx.ground(px, pz), ctx.ground(px + c * w * 0.5, pz - sn * w * 0.5), ctx.ground(px - c * w * 0.5, pz + sn * w * 0.5));
    if (top - g > 0.3) {
      m.tone(TONES.pier);
      m.box('rubble', { at: [px, g - 2, pz], size: [pierW, top - g + 2, w + 0.6], turn });
    }
  }
  // each span: the arch’s curve, the spandrels from it up to the deck’s underside, the soffit
  for (let i = 0; i < n; i++) {
    const ua = i * span + pierW / 2;
    const ub = (i + 1) * span - pierW / 2;
    const cu = (ua + ub) / 2;
    const r = (ub - ua) / 2;
    const spring = deck(cu / L) - 1.2 - rise;
    for (let k = 0; k < segs; k++) {
      const a0 = Math.PI - (k / segs) * Math.PI;
      const a1 = Math.PI - ((k + 1) / segs) * Math.PI;
      const ua0 = cu + Math.cos(a0) * r;
      const ua1 = cu + Math.cos(a1) * r;
      const ya0 = spring + Math.sin(a0) * r;
      const ya1 = spring + Math.sin(a1) * r;
      const top0 = deck(ua0 / L) - 1.2;
      const top1 = deck(ua1 / L) - 1.2;
      m.tone(TONES.pier);
      for (const side of [1, -1]) {
        const v = (side * w) / 2;
        const q = side > 0 ? [P(ua0, v, ya0), P(ua1, v, ya1), P(ua1, v, top1), P(ua0, v, top0)] : [P(ua1, v, ya1), P(ua0, v, ya0), P(ua0, v, top0), P(ua1, v, top1)];
        m.quad('rubble', ...q);
      }
      m.tone(TONES.plinth);
      m.quad('rubble', P(ua1, w / 2, ya1), P(ua0, w / 2, ya0), P(ua0, -w / 2, ya0), P(ua1, -w / 2, ya1));
    }
  }
  // the deck and its parapets
  m.tone(TONES.stone);
  const segsDeck = Math.max(1, Math.round(L / 20));
  for (let k = 0; k < segsDeck; k++) {
    const t0 = k / segsDeck;
    const t1 = (k + 1) / segsDeck;
    const ya = deck(t0);
    const yb = deck(t1);
    const ua = t0 * L;
    const ub = t1 * L;
    // the band under the deck, its face both sides
    for (const side of [1, -1]) {
      const v = (side * (w / 2 + 0.15));
      const q = side > 0 ? [P(ua, v, ya - 1.2), P(ub, v, yb - 1.2), P(ub, v, yb), P(ua, v, ya)] : [P(ub, v, yb - 1.2), P(ua, v, ya - 1.2), P(ua, v, ya), P(ub, v, yb)];
      m.quad('ashlar', ...q);
      // the parapet on it
      const vp = (side * (w / 2 - 0.2));
      const qo = side > 0 ? [P(ua, v, ya), P(ub, v, yb), P(ub, v, yb + 1.1), P(ua, v, ya + 1.1)] : [P(ub, v, yb), P(ua, v, ya), P(ua, v, ya + 1.1), P(ub, v, yb + 1.1)];
      m.quad('ashlar', ...qo);
      const qi = side > 0 ? [P(ub, vp, yb), P(ua, vp, ya), P(ua, vp, ya + 1.1), P(ub, vp, yb + 1.1)] : [P(ua, vp, ya), P(ub, vp, yb), P(ub, vp, yb + 1.1), P(ua, vp, ya + 1.1)];
      m.quad('ashlar', ...qi);
      // (its coping, facing up: walked the way that keeps it so on either side)
      const cope = side > 0 ? [P(ub, vp, yb + 1.1), P(ua, vp, ya + 1.1), P(ua, v, ya + 1.1), P(ub, v, yb + 1.1)] : [P(ua, vp, ya + 1.1), P(ub, vp, yb + 1.1), P(ub, v, yb + 1.1), P(ua, v, ya + 1.1)];
      m.quad('ashlar', ...cope);
    }
    m.tone(TONES.old);
    m.quad('rubble', P(ua, w / 2, ya), P(ub, w / 2, yb), P(ub, -w / 2, yb), P(ua, -w / 2, ya));
    m.tone(TONES.stone);
  }
}

// The covered bridge: a timber deck on trestles, posts both sides with
// braces between, a slate roof on top. It is laid along +x from its own
// origin (`from`), turned and tilted to `to` (coveredFrame): baked into the
// mesh’s frame for the far castle, or left local (`ctx.local`) for its own
// group, which grounds/bridge.js sways as you cross
export function coveredFrame({ from, to }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const run = Math.hypot(dx, dz);
  return { yaw: Math.atan2(-dz, dx), pitch: Math.atan2(to[1] - from[1], run), len: Math.hypot(run, to[1] - from[1]) };
}

export function covered(ctx, s) {
  const m = ctx.mesh;
  const { yaw, pitch, len: L } = coveredFrame(s);
  if (!ctx.local) m.frame({ origin: s.from, yaw, pitch });
  const w = s.width ?? 3.6;
  const posts = Math.max(2, Math.round(L / 3));
  const step = L / posts;
  const H = s.height ?? 3.2;
  // a point along the deck in the world: for the trestles’ ground
  const along = (u) => {
    const k = u / L;
    return [s.from[0] + (s.to[0] - s.from[0]) * k, s.from[1] + (s.to[1] - s.from[1]) * k, s.from[2] + (s.to[2] - s.from[2]) * k];
  };
  m.tone(TONES.timber);
  m.box('timber', { at: [L / 2, -0.35, 0], size: [L, 0.35, w], turn: 0 });
  for (let i = 0; i <= posts; i++) {
    const u = i * step;
    for (const side of [1, -1]) {
      m.tone(TONES.oak);
      m.box('timber', { at: [u, 0, (side * w) / 2], size: [0.28, H, 0.28] });
      if (i < posts && !ctx.far) {
        // a rail at hand height and a brace across each bay, the films’ bridge being open at its sides
        m.box('timber', { at: [u + step / 2, 1.0, (side * w) / 2], size: [step, 0.16, 0.18] });
        m.beam('timber', [u + 0.15, 1.1, (side * w) / 2], [u + step - 0.15, H - 0.25, (side * w) / 2], 0.14, 0.18);
      }
    }
    // the trestle under it, every other post, down to the ground (or the gully’s floor)
    if (i % 2 === 0) {
      const [gx, gy, gz] = along(u);
      const drop = gy - ctx.ground(gx, gz);
      if (drop > 0.6) {
        m.tone(TONES.oak);
        for (const side of [1, -1]) m.box('timber', { at: [u, -drop - 0.8, side * (w / 2 - 0.3)], size: [0.4, drop + 0.5, 0.4] });
        m.box('timber', { at: [u, -1.2, 0], size: [0.3, 0.3, w], turn: 0 });
        if (drop > 6 && !ctx.far) for (const side of [1, -1]) m.beam('timber', [u, -1.2, side * (w / 2 - 0.3)], [u, -drop * 0.6, -side * (w / 2 - 0.3)], 0.2);
      }
    }
  }
  m.tone(TONES.oak);
  if (!ctx.far) for (let i = 0; i <= posts; i += 2) m.box('timber', { at: [i * step, H, 0], size: [0.22, 0.25, w + 0.3] });
  gable(ctx, { at: [L / 2, H + 0.2, 0], len: L, w: w + 0.4, h: 1.5, turn: 0, overhang: 0.5, ends: 'timber', tone: TONES.timber });
  if (!ctx.local) m.frame(null);
}

// Flights of steps between landings [[x, y, z], …], `w` wide, a parapet on
// the side `open` (1: right of the way up, −1: left)
export function stair(ctx, s) {
  const m = ctx.mesh;
  const w = s.width ?? 2.4;
  // a lamp at each landing on the open side, lit before the castle’s windows:
  // at dusk the stair is a line of lights up the cliff from the boats
  if (s.lamps)
    for (let i = 1; i < s.points.length - 1; i += 2) {
      const [x, y, z] = s.points[i];
      const [nx, , nz] = s.points[i + 1];
      const turn = Math.atan2(nx - s.points[i - 1][0], nz - s.points[i - 1][2]) - Math.PI / 2;
      const off = (s.open ?? 1) * (w / 2 + 0.25);
      const at = [x + Math.sin(turn) * off, y, z + Math.cos(turn) * off];
      m.tone(TONES.iron);
      m.box('iron', { at, size: [0.12, 2.1, 0.12] });
      m.tone(TONES.white).lit(0.01);
      m.box('glass', { at: [at[0], y + 2.1, at[2]], size: [0.6, 0.8, 0.6], bottom: true });
      m.lit(0);
      m.tone(TONES.iron);
      m.box('iron', { at: [at[0], y + 2.9, at[2]], size: [0.72, 0.1, 0.72] });
    }
  for (let i = 1; i < s.points.length; i++) {
    const [x0, y0, z0] = s.points[i - 1];
    const [x1, y1, z1] = s.points[i];
    const run = Math.hypot(x1 - x0, z1 - z0);
    const turn = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const rise = y1 - y0;
    const n = Math.max(1, Math.round(Math.abs(rise) / 0.22));
    const tread = run / n;
    m.tone(TONES.old);
    for (let k = 0; k < (ctx.far ? 0 : n); k++) {
      const t = (k + 0.5) / n;
      const y = y0 + (rise * (k + 1)) / n;
      m.box('rubble', { at: [x0 + (x1 - x0) * t, y - 0.6, z0 + (z1 - z0) * t], size: [tread + 0.02, 0.6, w], turn });
    }
    // its stringer wall down to the ground, and a parapet on the open side
    const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
    const g = Math.min(ctx.ground(mid[0], mid[1]), ctx.ground(x0, z0), ctx.ground(x1, z1));
    const lowY = Math.min(y0, y1);
    m.tone(TONES.plinth);
    if (lowY - g > 0.4) m.box('rubble', { at: [mid[0], g - 1, mid[1]], size: [run, lowY - g + 1, w], turn });
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    const off = (s.open ?? 1) * (w / 2 + 0.25);
    const P = (x, y, z) => [x + sn * off, y, z + c * off];
    m.tone(TONES.stone);
    const a = P(x0, y0, z0);
    const b = P(x1, y1, z1);
    for (const side of [1, -1]) {
      const o = side * 0.25;
      const A = [a[0] + sn * o, a[1], a[2] + c * o];
      const B = [b[0] + sn * o, b[1], b[2] + c * o];
      const q = side > 0 ? [A, B, [B[0], B[1] + 1.1, B[2]], [A[0], A[1] + 1.1, A[2]]] : [B, A, [A[0], A[1] + 1.1, A[2]], [B[0], B[1] + 1.1, B[2]]];
      m.quad('ashlar', ...q);
    }
    m.quad('ashlar', [a[0] - sn * 0.25, a[1] + 1.1, a[2] - c * 0.25], [a[0] + sn * 0.25, a[1] + 1.1, a[2] + c * 0.25], [b[0] + sn * 0.25, b[1] + 1.1, b[2] + c * 0.25], [b[0] - sn * 0.25, b[1] + 1.1, b[2] - c * 0.25]);
  }
}

export function gatehouse(ctx, s) {
  const m = ctx.mesh;
  const base = s.base ?? CASTLE_FLOOR;
  const turn = s.turn ?? 0;
  const gap = s.gap ?? 5;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const P = (u) => [s.at[0] + u * c, s.at[1] - u * sn];
  for (const side of [1, -1]) tower(ctx, { at: P(side * (gap / 2 + 2.6)), base, r: 2.8, h: s.h ?? 15, roof: 'both', cone: { h: 7 }, sides: 12, windows: { rows: [8], per: 3, w: 0.6, h: 1.4 } });
  // the arch’s lintel block over the gap, battlemented
  m.tone(TONES.stone);
  const archTop = base + (s.arch ?? 7);
  m.box('ashlar', { at: [s.at[0], archTop, s.at[1]], size: [gap + 2, (s.h ?? 15) - (s.arch ?? 7) - 3, 3.4], turn });
  const top = base + (s.h ?? 15) - 3;
  if (!ctx.far) {
    const a = P(-(gap / 2 + 1));
    const b = P(gap / 2 + 1);
    merlonRun(ctx, [a[0] + sn * 1.4, a[1] + c * 1.4], [b[0] + sn * 1.4, b[1] + c * 1.4], top, TONES.stone);
    merlonRun(ctx, [a[0] - sn * 1.4, a[1] - c * 1.4], [b[0] - sn * 1.4, b[1] - c * 1.4], top, TONES.stone);
  }
}

// a glasshouse: a low stone wall, an iron frame of ribs, glass between, a
// door in its north end (grounds/greenhouses.js furnishes the open one)
export function glasshouse(ctx, s) {
  const m = ctx.mesh;
  const base = s.base ?? ctx.ground(s.at[0], s.at[1]);
  const { len, w } = s;
  const turn = s.turn ?? 0;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const P = (u, v, y) => [s.at[0] + u * c + v * sn, base + y, s.at[1] - u * sn + v * c];
  const wallH = 0.8;
  const eave = 3.2;
  const ridge = 5.4;
  m.tone(TONES.old);
  m.box('ashlar', { at: [s.at[0], base - 0.4, s.at[1]], size: [len, wallH + 0.4, w], turn });
  // the glass: the sides, the roof’s two slopes, the ends
  m.tone(TONES.pane);
  for (const side of [1, -1]) {
    const v = (side * w) / 2;
    const q = side > 0 ? [P(-len / 2, v, wallH), P(len / 2, v, wallH), P(len / 2, v, eave), P(-len / 2, v, eave)] : [P(len / 2, v, wallH), P(-len / 2, v, wallH), P(-len / 2, v, eave), P(len / 2, v, eave)];
    m.quad('pane', ...q);
    const r = side > 0 ? [P(-len / 2, v, eave), P(len / 2, v, eave), P(len / 2, 0, ridge), P(-len / 2, 0, ridge)] : [P(len / 2, v, eave), P(-len / 2, v, eave), P(-len / 2, 0, ridge), P(len / 2, 0, ridge)];
    m.quad('pane', ...r);
  }
  for (const end of [1, -1]) {
    const u = (end * len) / 2;
    const ends = [P(u, -w / 2, wallH), P(u, w / 2, wallH), P(u, w / 2, eave), P(u, 0, ridge), P(u, -w / 2, eave)];
    const o = end > 0 ? ends : [...ends].reverse();
    for (let i = 1; i < o.length - 1; i++) m.tri('pane', o[0], o[i], o[i + 1]);
  }
  // the iron ribs: a frame every two metres, up the side, over the ridge, down the other
  m.tone(TONES.iron);
  const ribs = Math.round(len / 2);
  for (let i = 0; i <= ribs; i++) {
    const u = -len / 2 + (i * len) / ribs;
    for (const side of [1, -1]) {
      const [ax, ay, az] = P(u, (side * w) / 2, wallH);
      m.box('iron', { at: [ax, ay, az], size: [0.1, eave - wallH, 0.1], turn });
      if (!ctx.far) m.beam('iron', P(u, (side * w) / 2, eave), P(u, 0, ridge), 0.1);
    }
  }
  m.box('iron', { at: P(0, 0, ridge - 0.08), size: [len + 0.2, 0.16, 0.18], turn });
}

export function fountain(ctx, s) {
  const m = ctx.mesh;
  const base = s.base ?? CASTLE_FLOOR;
  const at = [s.at[0], base, s.at[1]];
  const r = s.r ?? 4;
  const sides = ctx.far ? 8 : 24;
  m.tone(TONES.pale);
  m.ring('ashlar', { at, r, h: 0.75, sides });
  m.ring('ashlar', { at, r: r - 0.4, h: 0.75, sides, inside: true });
  m.ring('ashlar', { at: [at[0], base + 0.75, at[2]], r: r + 0.1, r2: r - 0.5, h: 0.12, sides });
  m.tone(TONES.lead);
  m.ring('lead', { at: [at[0], base + 0.5, at[2]], r: r - 0.4, r2: 0.01, h: 0.01, sides });
  m.tone(TONES.pale);
  m.lathe('ashlar', { at, profile: [[0.9, 0], [0.5, 0.6], [0.45, 1.8], [1.8, 2.2], [1.9, 2.45], [0.4, 2.5], [0.35, 3.4], [0.6, 3.6], [0.001, 4.1]], sides: ctx.far ? 6 : 14 });
}

export function boathouse(ctx, s) {
  const m = ctx.mesh;
  const base = s.base ?? 1.2;
  const turn = s.turn ?? 0;
  const { len, w } = s;
  const h = s.h ?? 6;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const P = (u, v) => [s.at[0] + u * c + v * sn, s.at[1] - u * sn + v * c];
  m.tone(TONES.old);
  // the back wall and the two side walls (the front is the boat arch, open to the lake)
  const back = P(-len / 2, 0);
  m.box('rubble', { at: [back[0], base - 2.5, back[1]], size: [0.8, h + 2.5, w], turn });
  for (const side of [1, -1]) {
    const p = P(0, (side * w) / 2);
    m.box('rubble', { at: [p[0], base - 2.5, p[1]], size: [len, h + 2.5, 0.8], turn });
  }
  const front = P(len / 2, 0);
  m.box('rubble', { at: [front[0], base + h - 1.6, front[1]], size: [0.8, 1.6, w], turn });
  // two small windows a side, lit early: someone is always down with the boats
  for (const side of [1, -1])
    for (const u of [-len / 4, len / 4]) {
      const p = P(u, side * (w / 2 + 0.44));
      m.tone(TONES.glass).lit(0.02 + ctx.rng() * 0.05);
      m.shape('glass', { at: [p[0], base + 2.2, p[1]], turn: turn + (side > 0 ? 0 : Math.PI), outline: archOutline(1.2, 2, { pointed: false, segs: 3 }) });
      m.lit(0);
    }
  gable(ctx, { at: [s.at[0], base + h, s.at[1]], len: len + 0.8, w: w + 0.8, h: w * 0.42, turn, overhang: 0.6, tone: TONES.old });
  // the jetty out from the arch over the water, on its posts
  m.tone(TONES.timber);
  const j0 = P(len / 2, 0);
  const j1 = P(len / 2 + (s.jetty ?? 10), 0);
  m.box('timber', { at: [(j0[0] + j1[0]) / 2, base - 0.2, (j0[1] + j1[1]) / 2], size: [s.jetty ?? 10, 0.2, 2.4], turn });
  if (!ctx.far)
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      for (const side of [1, -1]) {
        const p = P(len / 2 + t * (s.jetty ?? 10), side * 1.1);
        m.box('timber', { at: [p[0], -3, p[1]], size: [0.25, base + 3.4, 0.25], turn });
      }
    }
}

export const PARTS = { tower, square, hall, wall, viaduct, covered, stair, gatehouse, glasshouse, fountain, boathouse };
