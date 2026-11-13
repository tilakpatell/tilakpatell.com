// Picking a generated place, and which places' names show. Pure (no React,
// DOM or three.js): it reads the rows around.js lists and a projection the
// scene passes.
//
// Picking is scene.js's pickWonder over rows: a place takes the point within
// its reach on screen, held between 24 and 160 pixels, so a far one can still
// be hit and a near one doesn't cover the screen. The nearest under the point
// wins, and nothing at or behind the near plane (a depth of 0.3 or less).
//
// The names: only so many at once (budget.tags), so they are chosen in order.
// What the pilot picked, aimed at or is going to first, then the place the
// ship is at, then what's within the cone of the nose, nearest first. The cone
// is the caller's (aim.js's NAME_CONE): aim.js reaches three.js through
// farStars.js, and this stays pure.
//
// PICK = { min, max, near }: a place's radius on screen is held between min
//   and max pixels; nothing at a depth of near or less is picked
// pickPlace(rows, project, px, py, { tanHalf, height }) → id | null.
//   project(x, y, z, out) → out with { x, y, z }: the point on screen, in
//   pixels, and its depth (scene.js's toScreen, over map-frame points). A
//   row's radius on screen is reach / (z · tanHalf) · height / 2.
// tagsFor(rows, { ship, nose, focus = [], here = null, max, cone }) → Row[],
//   each once, at most max: the rows whose ids are in focus, in its order;
//   the row whose id is here; then those within cone (radians) of the nose,
//   ahead of the ship, nearest first (from the ship, past their reach). An
//   id with no row, or a null, is skipped. ship: { x, y, z }; nose: [x, y,
//   z], any length; no cone (it has no default) names nothing by the nose.

export const PICK = { min: 24, max: 160, near: 0.3 };

const scratch = { x: 0, y: 0, z: 0 };

export function pickPlace(rows, project, px, py, { tanHalf, height }) {
  let best = null;
  let bestZ = Infinity;
  for (const row of rows) {
    const s = project(row.at[0], row.at[1], row.at[2], scratch);
    if (!(s.z > PICK.near) || s.z >= bestZ) continue;
    const r = ((row.reach ?? 0) / (s.z * tanHalf)) * (height / 2);
    if (Math.hypot(px - s.x, py - s.y) > Math.max(Math.min(r, PICK.max), PICK.min)) continue;
    best = row.id;
    bestZ = s.z;
  }
  return best;
}

export function tagsFor(rows, { ship, nose, focus = [], here = null, max, cone }) {
  const room = Math.max(0, Math.floor(max ?? 0));
  if (room === 0) return [];
  const byId = new Map();
  for (const row of rows) byId.set(row.id, row);
  const out = [];
  const taken = new Set();
  const take = (id) => {
    const row = id == null ? undefined : byId.get(id);
    if (row && !taken.has(id) && out.length < room) {
      taken.add(id);
      out.push(row);
    }
  };
  for (const id of focus) take(id);
  take(here);
  const left = room - out.length;
  if (left <= 0 || !Number.isFinite(cone)) return out;
  // (the nearest `left` within the cone, kept in order as they're found)
  const nl = Math.hypot(nose[0], nose[1], nose[2]) || 1;
  const cos = Math.cos(cone);
  const near = [];
  for (const row of rows) {
    if (taken.has(row.id)) continue;
    const dx = row.at[0] - ship.x;
    const dy = row.at[1] - ship.y;
    const dz = row.at[2] - ship.z;
    const l = Math.hypot(dx, dy, dz);
    if (l === 0 || (dx * nose[0] + dy * nose[1] + dz * nose[2]) / (l * nl) <= cos) continue;
    const d = Math.max(0, l - (row.reach ?? 0));
    if (near.length === left && d >= near[left - 1].d) continue;
    let i = Math.min(near.length, left - 1);
    while (i > 0 && near[i - 1].d > d) i--;
    near.splice(i, 0, { row, d });
    if (near.length > left) near.pop();
  }
  for (const { row } of near) out.push(row);
  return out;
}
