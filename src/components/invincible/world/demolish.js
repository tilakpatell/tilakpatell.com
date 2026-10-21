// The city that breaks, as plain numbers (./ruins.js and ./facade.js draw
// it): every tower and house keeps a damage from 0 to 1, moved by what hits
// it, drawn in stages (cracks and dark glass; a bite out of the top; the
// top third gone, a stub and rubble), kept between visits and mended a
// quarter a real-world day, Cecil's crews at work. Pure: no three, no DOM.
//
// A thing is keyed by its collider (./map.js's boxes): `b:<building id>`
// for a tower, `h:<house index>` for a house (keyOf). A hit's force is one
// of DAMAGE's, picked by forceOf from the event that did it.
//
// newRuins(now) → { damage: Map<key, d>, at: now, collateral }
// hitTower(ruins, key, force) → { ruins, delta, stage, d }
// stageOf(d) → 0..3; heightOf(d) → the instance's height as a share of its own
// forceOf(event, { held }) → a DAMAGE value or 0
// repair(ruins, now) → ruins, healed by the whole days since `at`; what is
//   still hurt after is in `mending` (scaffolding), until it is hit again
// serialise(ruins) → { at, list: [[key, d], …] } (the RUINS.keep most damaged)
// parse(kept, now) → ruins (anything unreadable is none)

export const DAMAGE = {
  car: 0.15, // a thrown car into a face
  slam: 0.3, // a carry-slam: something in hand into a wall or the street at a tower's foot
  mach: 0.5, // Mark into a wall at RUINS.fast or over, flat out
  swing: 0.1, // a Mauler's swing at a face
  line: 0.05, // a window line shattered (Omni-Man's line-break, part 3's section 4)
};
export const STAGES = [0.3, 0.6]; // cracks under the first, a bite to the second, the top third gone past it
export const RUINS = {
  keep: 400, // the most damaged kept between visits
  heal: 0.25, // off every thing a real-world day
  day: 86400000,
  fast: 150, // m/s: Mark into a wall at this or over marks it
  bite: 0.33, // of the height, gone at stage 3
};

export const newRuins = (now = 0) => ({ damage: new Map(), at: now, collateral: 0, mending: new Set() });

export const keyOf = (box) => (box?.building != null ? `b:${box.building}` : box?.house != null ? `h:${box.house}` : null);

export const stageOf = (d) => (d <= 0 ? 0 : d < STAGES[0] ? 1 : d < STAGES[1] ? 2 : 3);

// stage 2 lowers the top by up to a third as the damage climbs; stage 3 is the third gone
export function heightOf(d) {
  const s = stageOf(d);
  if (s < 2) return 1;
  if (s === 3) return 1 - RUINS.bite;
  return 1 - RUINS.bite * ((d - STAGES[0]) / (STAGES[1] - STAGES[0]));
}

export function hitTower(prev, key, force) {
  if (!key || !(force > 0)) return { ruins: prev, delta: 0, stage: stageOf(prev.damage.get(key) ?? 0), d: prev.damage.get(key) ?? 0 };
  const was = prev.damage.get(key) ?? 0;
  const d = Math.min(1, was + force);
  const damage = new Map(prev.damage);
  damage.set(key, d);
  // (a fresh hit sends the crews away again)
  const mending = new Set(prev.mending ?? []);
  mending.delete(key);
  return { ruins: { ...prev, damage, mending, collateral: prev.collateral + (d - was) }, delta: d - was, stage: stageOf(d), d };
}

// what an event does to a face: Mark into a wall flat out, a slam with
// something in hand, a thrown car, a Mauler's swing
export function forceOf(e, { held = false } = {}) {
  if (!e) return 0;
  if (e.type === 'impact') return held ? DAMAGE.slam : e.speed >= RUINS.fast ? DAMAGE.mach : 0;
  if (e.type === 'carrySlam') return DAMAGE.slam;
  if (e.type === 'carDown' || e.type === 'carHit') return DAMAGE.car;
  if (e.type === 'swing') return DAMAGE.swing;
  if (e.type === 'line') return DAMAGE.line;
  return 0;
}

// Cecil's crews: a quarter off everything a whole day since the last mend
export function repair(prev, now) {
  const days = Math.floor(Math.max(0, now - prev.at) / RUINS.day);
  if (!days) return prev;
  const damage = new Map();
  const mending = new Set();
  for (const [k, d] of prev.damage) {
    const left = d - RUINS.heal * days;
    if (left > 1e-6) {
      damage.set(k, Math.min(1, left));
      mending.add(k); // (still standing hurt: the crews are on it, scaffolding up)
    }
  }
  return { ...prev, damage, mending, at: prev.at + days * RUINS.day };
}

export function serialise(ruins) {
  const list = [...ruins.damage].filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]).slice(0, RUINS.keep);
  return { at: ruins.at, list };
}

const okKey = (k) => typeof k === 'string' && /^[bh]:\d+$/.test(k);
export function parse(kept, now = 0) {
  try {
    const o = typeof kept === 'string' ? JSON.parse(kept) : kept;
    if (!o || !Array.isArray(o.list)) return newRuins(now);
    const r = newRuins(Number.isFinite(o.at) ? o.at : now);
    for (const row of o.list) {
      if (!Array.isArray(row) || !okKey(row[0]) || typeof row[1] !== 'number' || !(row[1] > 0) || !(row[1] <= 1)) continue;
      r.damage.set(row[0], row[1]);
    }
    return r;
  } catch {
    return newRuins(now);
  }
}
