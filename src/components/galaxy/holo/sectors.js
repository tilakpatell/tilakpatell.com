// The holotable's sectors (docs/superpowers/specs/2026-10-19-galaxy-holotable-design.md): the galaxy's rings
// (systems.js REGIONS, bulged as edgeAt has them, and a band of Wild Space past the Outer Rim), each cut into wedges, more of
// them further out, each ring's turned a little from the last so their edges step as Helldivers 2's do; and who
// holds each, from the war's table. Pure, tested.
//
//   RINGS: [{ id, name, r0, r1, n, turn }] the rings, innermost first: the Deep Core one round sector, the hub
//   SECTORS: [{ id, ring, i, a0, a1, r0, r1, unknown }] every wedge (angles in radians, 0 east, π/2 south, as
//     edgeAt's; r0 and r1 before the bulge), the Unknown Regions' marked
//   sectorOf([x, z]) → the id of the sector a map point is in, or null (past the rim)
//   holders(table, { reach }) → { id: { side, by, contested, held } } each sector's holder: the side holding the
//     most of the war's systems in it, else the nearest of them within `reach` grid squares (held false: its
//     reach, not its own), else none; contested where a front, an attack or a battle is in it, `by` the side
//     pushing there (an attack's attacker; on a front, the liberator where it isn't theirs, as WarCard.jsx has it)
//   rimNames(holds, { least }) → [{ side, a, span }] each side's name along the rim: the middle of its longest run
//     of the outermost ring's sectors, where that run is at least `least` radians
//   outline(sector, steps) → [[x, z], …] a sector's edge on the map, bulged, as a closed loop

import { WARS } from '../sides';
import { CORE, REGIONS, SYSTEMS, UNKNOWN, edgeAt } from '../systems';

const TAU = Math.PI * 2;
const WILD = 0.9; // (Wild Space: a band this wide past the Outer Rim, bulged as the rings are)
// how many wedges each ring is cut into, and how far each is turned (a fraction of a wedge) so no two rings' edges line up
const CUTS = { deep: 1, core: 6, colonies: 8, inner: 10, expansion: 12, mid: 16, outer: 20, wild: 24 };
const TURNS = { deep: 0, core: 0.15, colonies: 0.55, inner: 0.3, expansion: 0.75, mid: 0.4, outer: 0.65, wild: 0.2 };

export const RINGS = [
  ...REGIONS.map((r, i) => ({ id: r.id, name: r.name, r0: i ? REGIONS[i - 1].r : 0, r1: r.r })),
  { id: 'wild', name: 'Wild Space', r0: REGIONS.at(-1).r, r1: REGIONS.at(-1).r + WILD },
].map((r) => ({ ...r, n: CUTS[r.id], turn: TURNS[r.id] }));

const norm = (a) => ((a % TAU) + TAU) % TAU;
const WEST = Math.PI;
// (a wedge out in the Unknown Regions: past their edge, its middle within their half-angle of the west)
const inUnknown = (ring, mid) => ring.r1 > UNKNOWN.from && Math.abs(norm(mid - WEST + Math.PI) - Math.PI) < UNKNOWN.half;

export const SECTORS = RINGS.flatMap((ring) =>
  Array.from({ length: ring.n }, (_, i) => {
    const a0 = norm(((i + ring.turn) / ring.n) * TAU);
    const a1 = a0 + TAU / ring.n;
    return { id: `${ring.id}-${i}`, ring: ring.id, i, a0, a1, r0: ring.r0, r1: ring.r1, unknown: inUnknown(ring, a0 + Math.PI / ring.n) };
  }),
);
const BY_ID = new Map(SECTORS.map((s) => [s.id, s]));
export const sectorById = (id) => BY_ID.get(id) ?? null;

export function sectorOf([x, z]) {
  const dx = x - CORE[0];
  const dz = z - CORE[1];
  const a = norm(Math.atan2(dz, dx));
  const d = Math.hypot(dx, dz);
  // (the ring by the bulged edges at this bearing: the regions' egg)
  const ring = RINGS.find((r) => d >= edgeAt(r.r0, a) && d < edgeAt(r.r1, a));
  if (!ring) return null;
  const i = Math.floor(norm(a - (ring.turn / ring.n) * TAU) / (TAU / ring.n)) % ring.n;
  return `${ring.id}-${i}`;
}

// a point in a sector's middle (its angle's and its radii's), on the map
export function middleOf(s) {
  const a = (s.a0 + s.a1) / 2;
  const r = edgeAt((s.r0 + s.r1) / 2, a);
  return [CORE[0] + Math.cos(a) * r, CORE[1] + Math.sin(a) * r];
}

const pushing = (row, liberator) => (row.attack ? row.attack.by : row.front && row.owner !== liberator ? liberator : null);

export function holders(table, { reach = 2.6 } = {}) {
  const liberator = WARS[table?.war]?.liberator ?? null;
  const rows = (table?.systems ?? []).map((r) => ({ row: r, s: SYSTEMS.find((x) => x.id === r.id) })).filter((x) => x.s);
  const inside = new Map(); // sector id → the war's rows in it
  for (const x of rows) {
    const id = sectorOf(x.s.pos);
    if (!id) continue;
    if (!inside.has(id)) inside.set(id, []);
    inside.get(id).push(x);
  }
  const out = {};
  for (const sec of SECTORS) {
    const here = inside.get(sec.id) ?? [];
    let side = null;
    let held = false;
    if (here.length) {
      // (the most systems; a tie to the one with more of its systems' control)
      const tally = {};
      for (const { row } of here) tally[row.owner] = (tally[row.owner] ?? 0) + 1 + (row.control ?? 1) * 0.01;
      side = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
      held = true;
    } else {
      const [mx, mz] = middleOf(sec);
      let best = reach;
      for (const { row, s } of rows) {
        const d = Math.hypot(s.pos[0] - mx, s.pos[1] - mz);
        if (d < best) (best = d), (side = row.owner);
      }
    }
    const fight = here.find(({ row }) => row.attack || row.front || row.battle);
    out[sec.id] = { side, held, contested: Boolean(fight), by: fight ? pushing(fight.row, liberator) : null };
  }
  return out;
}

export function rimNames(holds, { least = 0.6 } = {}) {
  const ring = RINGS.findLast((r) => r.id !== 'wild');
  const row = SECTORS.filter((s) => s.ring === ring.id);
  const wedge = TAU / ring.n;
  const out = [];
  const sides = new Set(row.map((s) => holds[s.id]?.side).filter(Boolean));
  for (const side of sides) {
    // the longest run of this side's wedges round the ring (it wraps)
    const mine = row.map((s) => holds[s.id]?.side === side);
    if (mine.every(Boolean)) {
      out.push({ side, a: row[0].a0 + Math.PI, span: TAU });
      continue;
    }
    let best = { n: 0, at: 0 };
    for (let i = 0; i < row.length; i++) {
      if (!mine[i] || mine[(i - 1 + row.length) % row.length]) continue; // (a run's first wedge)
      let n = 0;
      while (mine[(i + n) % row.length]) n++;
      if (n > best.n) best = { n, at: i };
    }
    const span = best.n * wedge;
    if (span >= least) out.push({ side, a: norm(row[best.at].a0 + span / 2), span });
  }
  return out.sort((a, b) => b.span - a.span);
}

export function outline(s, steps = 12) {
  const pts = [];
  const at = (a, r) => [CORE[0] + Math.cos(a) * edgeAt(r, a), CORE[1] + Math.sin(a) * edgeAt(r, a)];
  for (let i = 0; i <= steps; i++) pts.push(at(s.a0 + ((s.a1 - s.a0) * i) / steps, s.r1));
  for (let i = steps; i >= 0; i--) pts.push(at(s.a0 + ((s.a1 - s.a0) * i) / steps, s.r0));
  return pts;
}
