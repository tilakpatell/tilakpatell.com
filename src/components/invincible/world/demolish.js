// The city that breaks, as rules (part 3): how much of each tower a fight
// has taken (0 whole to 1 broken), what that looks like (./ruins.js and the
// facade draw it), how the city mends between visits, and what's kept.
//
// A hit adds its force over RUINS.per (./hits.js's numbers: a thrown car
// 0.15, a slam 0.3, a Viltrumite at Mach speed 0.5), never past 1. The
// stages: 1, cracks and dark glass (under 0.3); 2, a bite out of the top
// (under 0.6); 3, the top third gone, a smoking stub. Every real-world day
// since the last visit mends 0.25 off every tower; one that has been mended
// a while wears scaffolding until it is whole. Kept as `tp-inv-world-ruins`:
// { at (when it was last mended, ms), d: [[id, damage, mending?]…] }, the 400
// most damaged; anything in it that can't be read makes it no ruins at all.
//
// Ruins are { at, d: Map id → damage, mend: Set of ids being mended }; every
// function here returns new ones, never changing what it was given.

export const DAMAGE = { car: 0.15, slam: 0.3, mach: 0.5, swing: 0.1, line: 0.05 };
export const RUINS = { per: 400, keep: 400, heal: 0.25, stages: [0.3, 0.6] };
const DAY = 86400000;

export const newRuins = (at = 0) => ({ at, d: new Map(), mend: new Set() });

// the force that does a kind's damage (./hits.js's units)
export const forceOf = (kind) => (DAMAGE[kind] ?? 0) * RUINS.per;

// 0 whole, 1 cracked, 2 bitten, 3 broken
export const stageOf = (d) => (!(d > 0) ? 0 : d < RUINS.stages[0] ? 1 : d < RUINS.stages[1] ? 2 : 3);

// one hit on tower `id` with `force`: the ruins after, how much it took, its stage now
export function hitTower(ruins, id, force) {
  const was = ruins.d.get(id) ?? 0;
  const now = Math.min(1, was + Math.max(0, Number.isFinite(force) ? force : 0) / RUINS.per);
  if (now === was) return { ruins, delta: 0, stage: stageOf(was) };
  const d = new Map(ruins.d);
  d.set(id, now);
  return { ruins: { ...ruins, d }, delta: now - was, stage: stageOf(now) };
}

// `days` of mending (a quarter a day); `now`, when, for the next visit's count
export function repair(ruins, days, now = ruins.at) {
  const heal = RUINS.heal * Math.max(0, Number.isFinite(days) ? days : 0);
  const d = new Map();
  const mend = new Set();
  for (const [id, v] of ruins.d) {
    const left = v - heal;
    if (left <= 1e-9) continue;
    d.set(id, left);
    if (heal > 0 || ruins.mend.has(id)) mend.add(id);
  }
  return { at: now, d, mend };
}
// how many days since the ruins were last mended, by the clock
export const daysSince = (ruins, now) => (Number.isFinite(now) && now > ruins.at ? (now - ruins.at) / DAY : 0);

// the towers wearing scaffolding
export const mending = (ruins) => [...ruins.mend].filter((id) => ruins.d.has(id));

// what's kept: the most damaged first, RUINS.keep of them
export function serialise(ruins) {
  const rows = [...ruins.d].sort((a, b) => b[1] - a[1]).slice(0, RUINS.keep);
  return { at: ruins.at, d: rows.map(([id, v]) => (ruins.mend.has(id) ? [id, v, 1] : [id, v])) };
}

// What was kept, read back: `known(id)` says whether a tower is there to be
// damaged. Anything not as it was written (a hand edit, an old version, a
// half-written save) is no ruins at all, rather than a city broken wrong.
export function parse(kept, known = () => true) {
  let o = kept;
  if (typeof kept === 'string') {
    try {
      o = JSON.parse(kept);
    } catch {
      return newRuins();
    }
  }
  if (!o || typeof o !== 'object' || !Array.isArray(o.d) || (o.at != null && !Number.isFinite(o.at))) return newRuins();
  const r = newRuins(o.at ?? 0);
  for (const row of o.d) {
    if (!Array.isArray(row) || row.length < 2 || !known(row[0]) || !Number.isFinite(row[1]) || row[1] <= 0 || row[1] > 1) return newRuins();
    r.d.set(row[0], row[1]);
    if (row[2] === 1) r.mend.add(row[0]);
  }
  return r;
}

// How much of a tower's height is gone: nothing until the second stage,
// then up to a sixth, a third from the third on (the top third gone).
export function biteOf(d) {
  const st = stageOf(d);
  if (st < 2) return 0;
  if (st === 3) return 1 / 3;
  return ((d - RUINS.stages[0]) / (RUINS.stages[1] - RUINS.stages[0])) * (1 / 3);
}

// Its boxes in the world (./map.js's, that he collides with) cut down to
// what stands, or put back as it was: this changes the world it's given,
// which is the one place the city's shape is kept.
export function applyRuin(world, id, d) {
  const boxes = world.boxes.filter((b) => b.building === id);
  const tall = Math.max(...boxes.map((b) => (b.whole ??= b.y1)));
  const stands = tall * (1 - biteOf(d));
  for (const b of boxes) b.y1 = Math.max(b.y0, Math.min(b.whole, stands));
}

// chunks a hit throws (lib/three/fx/debris.js's rock), by the tier: low gets
// the cracks and the stub only
export const chunksFor = (tier) => ({ low: 0, mid: 24, medium: 24, high: 60 })[tier] ?? 0;
