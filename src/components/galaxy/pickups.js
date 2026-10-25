// Pickups in flight (the galaxy's): a hostile fighter you shoot down drops
// one now and then (an ace or a capital ship always), floating where it
// went up for PICKUP_RULES.life seconds; fly within `take` and it's yours,
// within `pull` and it drifts to you. Each kind does one thing (PICKUPS):
// deflectors back, a faster boost, faster guns, a bubble that takes the
// next hits, or a power cell. The same effect again runs on longer, to
// twice its time at most. Nothing here goes online; a jump, a landing or a
// crash clears them all (clear). The drawing is pickupFx.js; the models
// are Quaternius's Ultimate Space Kit's (CC0).

export const PICKUP_RULES = { chance: 0.35, max: 4, life: 25, blink: 5, take: 4, pull: 14, pullSpeed: 9 };

// (Overcharge lifts the boost and the pull-up by one factor: ship.js's `surge`, which the scene hands in after the fit is held to what it can do)
export const PICKUPS = {
  repair: { name: 'Repair kit', line: '+40 deflectors', weight: 1, heal: 40 },
  overcharge: { name: 'Overcharge', line: 'boost ×1.35 for 12 s', weight: 1, dur: 12, mods: { boost: 1.35, accel: 1.35 } },
  rapid: { name: 'Rapid fire', line: 'guns faster for 12 s', weight: 1, dur: 12, mods: { delay: 0.6 } },
  bubble: { name: 'Bubble shield', line: 'takes the next 60 damage', weight: 1, dur: 15, bubble: 60 },
  charge: { name: 'Power cell', line: 'the big one +25%', weight: 1, charge: true },
};
const KINDS = Object.keys(PICKUPS);
const NONE = Object.freeze({ boost: 1, accel: 1, delay: 1, bubble: 0 });
const NOTHING = Object.freeze([]);

// Rapid fire's cut to the guns' delay, and the punch it gives where the
// quickest gun holds it back: lib/combat/flight/guns.js's, both maps'.
export { RAPID_PUNCH_CAP, gunsUnder } from '../../lib/combat/flight/guns';

const xyz = (a) => (Array.isArray(a) ? { x: a[0], y: a[1], z: a[2] } : { x: a.x, y: a.y, z: a.z });

// The scene asks every frame (step, mods, buffs), so what they return is kept
// and reused, never made again while nothing has changed: the lists and the
// mods are valid till the next call.
export function createPickups({ rand = Math.random } = {}) {
  let list = [];
  let next = 1;
  const effects = new Map(); // kind → { left, of, points?, view }
  const cur = { boost: 1, accel: 1, delay: 1, bubble: 0 }; // (what mods() hands out while an effect is on)
  const shown = []; // (what buffs() hands out)

  const pick = (shield) => {
    const w = KINDS.map((k) => PICKUPS[k].weight * (k === 'repair' && shield < 50 ? 3 : 1));
    let r = rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < KINDS.length; i++) if ((r -= w[i]) < 0) return KINDS[i];
    return KINDS[KINDS.length - 1];
  };

  const give = (kind) => {
    const p = PICKUPS[kind];
    if (!p) return {};
    if (p.heal) return { heal: p.heal };
    if (p.charge) return { charge: true };
    const e = effects.get(kind);
    if (e) {
      e.left = Math.min(p.dur * 2, e.left + p.dur);
      if (p.bubble) e.points = Math.min(p.bubble * 2, e.points + p.bubble);
    } else effects.set(kind, { left: p.dur, of: p.dur, ...(p.bubble ? { points: p.bubble } : {}) });
    return {};
  };

  return {
    get list() {
      return list;
    },
    drop(at, why = {}) {
      if (list.length >= PICKUP_RULES.max) return null;
      if (!why.ace && !why.capital && rand() >= PICKUP_RULES.chance) return null;
      const kind = why.kind && PICKUPS[why.kind] ? why.kind : pick(why.shield ?? 100);
      const p = { id: next++, kind, at: xyz(at), age: 0, life: PICKUP_RULES.life };
      list.push(p);
      return p;
    },
    give,
    step(dt, ship, { live = true } = {}) {
      let taken = NOTHING;
      for (const [kind, e] of effects) {
        e.left -= dt;
        if (e.left <= 0 || (PICKUPS[kind].bubble && e.points <= 0)) effects.delete(kind);
      }
      let kept = 0;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) continue;
        const dx = ship.x - p.at.x;
        const dy = ship.y - p.at.y;
        const dz = ship.z - p.at.z;
        const d = Math.hypot(dx, dy, dz);
        if (live && d <= PICKUP_RULES.take) {
          if (taken === NOTHING) taken = [];
          taken.push({ id: p.id, kind: p.kind, ...give(p.kind) });
          continue;
        }
        if (live && d <= PICKUP_RULES.pull && d > 0) {
          const m = Math.min(d, PICKUP_RULES.pullSpeed * dt) / d;
          p.at.x += dx * m;
          p.at.y += dy * m;
          p.at.z += dz * m;
        }
        list[kept++] = p;
      }
      list.length = kept;
      return taken;
    },
    mods() {
      if (!effects.size) return NONE;
      cur.boost = 1;
      cur.accel = 1;
      cur.delay = 1;
      cur.bubble = 0;
      for (const [kind, e] of effects) {
        const p = PICKUPS[kind];
        if (p.mods) for (const k in p.mods) cur[k] *= p.mods[k];
        if (p.bubble) cur.bubble = e.points;
      }
      return cur;
    },
    absorb(damage) {
      const e = effects.get('bubble');
      if (!e || e.points <= 0) return damage;
      const took = Math.min(e.points, damage);
      e.points -= took;
      if (e.points <= 0) effects.delete('bubble');
      return damage - took;
    },
    buffs() {
      shown.length = 0;
      for (const [kind, e] of effects) {
        const b = (e.view ??= { kind, name: PICKUPS[kind].name, left: 0, of: e.of, points: null });
        b.left = Math.max(0, e.left);
        b.points = e.points ?? null;
        shown.push(b);
      }
      return shown;
    },
    clear() {
      list = [];
      effects.clear();
    },
  };
}
