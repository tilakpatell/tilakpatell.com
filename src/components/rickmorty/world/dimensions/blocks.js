// A place's blocks: the only solids its world (./worlds.js) adds, each
// what a gathering stands on inside the walkable box (a pen, a rail, a
// counter, the pit's barriers), so Morty never walks through someone who
// stands still. Kept here, apart from the worlds' records, so
// ./destinations.js (and with it ./rules.js, loaded with the page) merges
// these few rows and none of the records' palettes, rings and crowds.
//
// BLOCKS: { [placeId]: [{ id, dx, dz, w, d, h, draw }] }  axis-aligned boxes in
//   metres from the place's middle, `h` how tall they're drawn (≤ 1.2 m:
//   the walking camera passes over them), `draw` how (./surround.js: a
//   rail or a barrier round its edge, a box, or nothing)
// blocksOf(d, list) → solids in the world ({ id, x, z, w, d, h, block })
// withBlocks(rows, table) → the rows, each with its blocks on the end of its solids
// blockProblems(d, solids) → what's wrong with them, in words (none: [])

export const BLOCKS = {
  // the pit, either side of the aisle from the way in to the stage
  schwifty: [
    { id: 'pit-w', dx: -16.25, dz: 14, w: 27.5, d: 12, h: 1.1, draw: 'barrier' },
    { id: 'pit-e', dx: 16.25, dz: 14, w: 27.5, d: 12, h: 1.1, draw: 'barrier' },
  ],
};
// Morty's radius (../rules.js's MORTY.radius, which imports this file's
// importer: the test holds the two to each other)
export const MORTY_R = 0.4;

export const blocksOf = (d, list = BLOCKS[d.id] ?? []) => list.map((b) => ({ id: `${d.id}-${b.id}`, x: d.centre.x + b.dx, z: d.centre.z + b.dz, w: b.w, d: b.d, h: b.h, block: true }));

export const withBlocks = (rows, table = BLOCKS) => rows.map((d) => (table[d.id]?.length ? { ...d, solids: [...d.solids, ...blocksOf(d, table[d.id])] } : d));

const TALLEST = 1.2;
const CLEAR = { spot: MORTY_R + 0.5, ends: 1.5, people: 1 };

// from a point to a box's nearest edge (0 inside it)
const gap = (b, x, z) => Math.hypot(Math.max(Math.abs(x - b.x) - b.w / 2, 0), Math.max(Math.abs(z - b.z) - b.d / 2, 0));
// from a route (a closed loop of points) to a box: sampled every quarter metre
function routeGap(b, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
    for (let k = 0; k <= n; k++) best = Math.min(best, gap(b, ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n));
  }
  return best;
}

export function blockProblems(d, solids) {
  const out = [];
  const A = d.area;
  for (const b of solids) {
    if (b.h > TALLEST) out.push(`${b.id}: taller than ${TALLEST} m`);
    if (b.x - b.w / 2 < A.x0 || b.x + b.w / 2 > A.x1 || b.z - b.d / 2 < A.z0 || b.z + b.d / 2 > A.z1) out.push(`${b.id}: outside the box`);
    for (const s of d.hotspots) if (gap(b, s.x, s.z) < (s.r ?? 1.4) + CLEAR.spot) out.push(`${b.id}: too near the spot ${s.id}`);
    if (gap(b, d.arrive.x, d.arrive.z) < CLEAR.ends) out.push(`${b.id}: too near the way in`);
    if (gap(b, d.back.x, d.back.z) < CLEAR.ends) out.push(`${b.id}: too near the portal home`);
    for (const p of [...d.people, ...d.extras.map((e, i) => ({ ...e, id: `${e.kind}-${i}` }))]) {
      if (gap(b, p.x, p.z) < CLEAR.people) out.push(`${b.id}: too near ${p.id}`);
      else if (p.ai?.wander && routeGap(b, p.ai.wander) < CLEAR.people) out.push(`${b.id}: on ${p.id}’s way round`);
    }
  }
  return out;
}
