// A starfighter's guns and abilities on the game's firing tables (src/data/
// bf2017/air.json: each vehicle's `weapons` and `abilities`, from its
// blueprint, its `_Weapons` layer and its kit's ability records). Pure.
//
// createGuns(row) → { fire(dt, held) → shots, heat, overheated, charged(on) }:
// - fires at RateOfFire (shots a minute) while held, each shot
//   HeatPerBullet of heat;
// - cools at HeatDropPerSecond, not while firing (the game's
//   PreventHeatDropWhileFiring);
// - at a full heat bar it overheats: no shots for OverHeatPenaltyTime, and
//   it cools OverheatedDropMultiplier times as fast until it's empty;
// - `charged(true)` (the overcharge ability) fires the overcharged bolt and
//   heats by the layer's override where it has one.
// damageAt(bolt, d) → a bolt's damage at `d` metres: StartDamage to the
//   falloff's start, EndDamage past its end, between them in a line.
// createAbilities(rows) → { use(id) → bool, step(dt), ready(id), active(id),
//   left(id) }: each ability's activation, active time and recharge.

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function damageAt(bolt, d) {
  if (!bolt) return 0;
  const [a, b] = bolt.falloff ?? [Infinity, Infinity];
  if (d <= a) return bolt.damage;
  if (d >= b) return bolt.damageFar;
  return bolt.damage + ((bolt.damageFar - bolt.damage) * (d - a)) / (b - a);
}

export function createGuns(row) {
  const w = row?.weapons ?? row;
  if (!w?.rateOfFire) throw new Error(`${row?.id ?? 'a starfighter'}: no firing table`);
  const base = w.overheat ?? { perShot: 0, dropPerSecond: 1, overheatedDrop: 1, penalty: 0 };
  const hot = w.overheatOverrides?.[0] ?? base;
  const g = { heat: 0, overheated: false, penalty: 0, cool: 0, charged: false, shots: 0 };
  const interval = 60 / w.rateOfFire;

  function fire(dt, held) {
    const oh = g.charged ? hot : base;
    let shots = 0;
    if (!held || g.overheated) g.cool = Math.max(0, g.cool - dt);
    if (g.overheated) {
      g.penalty = Math.max(0, g.penalty - dt);
      if (!g.penalty) g.heat = Math.max(0, g.heat - oh.dropPerSecond * oh.overheatedDrop * dt);
      if (!g.heat) g.overheated = false;
    } else if (held) {
      // (as many shots as the time owes, each heating the bar)
      let t = dt;
      while (t >= g.cool && !g.overheated) {
        t -= g.cool;
        g.cool = interval;
        shots++;
        g.heat = clamp01(g.heat + oh.perShot);
        if (g.heat >= 1) {
          g.overheated = true;
          g.penalty = oh.penalty;
        }
      }
      g.cool = Math.max(0, g.cool - t);
    } else g.heat = Math.max(0, g.heat - oh.dropPerSecond * dt);
    g.shots += shots;
    return shots;
  }

  return {
    fire,
    get heat() {
      return g.heat;
    },
    get overheated() {
      return g.overheated;
    },
    get shots() {
      return g.shots;
    },
    // (the bolt it fires now)
    get bolt() {
      return g.charged && w.overcharged ? w.overcharged : w.bolt;
    },
    charged(on) {
      g.charged = Boolean(on);
    },
  };
}

export function createAbilities(rows = []) {
  const list = (rows?.abilities ?? rows).map((a) => ({ ...a, phase: 'ready', t: 0 }));
  const of = (id) => list.find((a) => a.id === id) ?? null;
  return {
    list,
    ready: (id) => of(id)?.phase === 'ready',
    active: (id) => of(id)?.phase === 'active',
    left: (id) => of(id)?.t ?? 0,
    use(id) {
      const a = of(id);
      if (!a || a.phase !== 'ready') return false;
      a.phase = a.activation ? 'arming' : 'active';
      a.t = a.activation || a.active || 0;
      return true;
    },
    step(dt) {
      for (const a of list) {
        if (a.phase === 'ready') continue;
        a.t -= dt;
        if (a.t > 0) continue;
        if (a.phase === 'arming') [a.phase, a.t] = ['active', a.active || 0];
        else if (a.phase === 'active') [a.phase, a.t] = ['recharging', a.recharge ?? 0];
        else [a.phase, a.t] = ['ready', 0];
        // (an ability with no time in a phase passes through it)
        if (a.t <= 0 && a.phase !== 'ready') a.t = 0;
      }
    },
  };
}
