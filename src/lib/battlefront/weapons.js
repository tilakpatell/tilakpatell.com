// The gun model (spec catalogue 2; `WeaponFiringData`, `GunSwayData`,
// `OverheatConfig`), from a weapons.json row: the rate of fire and bursts,
// heat in place of ammunition with the game's active cooling, a magazine
// where the row has one, the dispersion cone by stance, and damage that
// falls off with range. Times are the sim's clock in seconds. Pure: every
// random draw is the caller's `rand`.
//
//   createGun(row, { rand }) → gun   (gun.heat 0…1, gun.state, gun.cooling while overheated)
//   fire(gun, now, { stance, moving }) → [{ at, dir: [dYaw, dPitch] }] | null
//   tick(gun, dt, now)        vent(gun, now) → bool        coolPress(gun, now) → 'success' | 'super' | 'fail' | null
//   dispersionFor(gun, stance, moving) → radians            damageAt(row, dist) → number

const DEG = Math.PI / 180;

// A row with no bolt damage (lane 0 found it on every gun but the bowcaster,
// whose bolt is a ProjectileBlueprint): the family's damage, the game's by observation.
export const HAND_DAMAGE = { rifle: 35, heavy: 30, pistol: 40, sniper: 55, longRange: 55, shortRange: 25, special: 30, hero: 40 };
// How long after the last shot the heat starts to fall when not overheated:
// the data's `OverheatDropDelay` (5 s on the A280C) holds a full bar after an
// overheat, and the ordinary drop's delay is not in the record. The game's by observation.
export const COOL_DELAY = 0.3;
// How far a success narrows the cooling window's low edge (`OnSuccess` counts
// steps; the step's size is not in the record): the game's by observation.
export const WINDOW_STEP = 0.05;
const EDGE = 1e-9;

export function createGun(row, { rand = Math.random } = {}) {
  return {
    row,
    rand,
    heat: 0,
    state: 'ready',
    lastShot: -Infinity,
    lastFire: -Infinity,
    spread: 0, // degrees the shots have added to the cone
    successes: 0,
    cooling: null,
    until: 0,
    mag: row.ammo ? row.ammo.magazine : Infinity,
  };
}

const STANCES = { stand: 'stand', crouch: 'crouch', prone: 'prone', roll: 'moving' };

function swayOf(row, stance, moving) {
  const zoom = typeof stance === 'string' && stance.startsWith('zoom');
  const base = zoom ? stance.slice(4).toLowerCase() : stance;
  const name = moving ? 'moving' : (STANCES[base] ?? 'stand');
  const want = zoom ? `zoom${name[0].toUpperCase()}${name.slice(1)}` : name;
  const list = row.dispersion ?? [];
  return list.find((d) => d.stance === want) ?? list.find((d) => d.stance === name) ?? list[0] ?? { min: 0, max: 0, perShot: 0, decay: 1, noFireDelay: 0 };
}

export function dispersionFor(gun, stance = 'stand', moving = false) {
  const d = swayOf(gun.row, stance, moving);
  return Math.min(d.max, d.min + gun.spread) * DEG;
}

function windowOf(gun) {
  const c = gun.row.heat.cooling;
  const lo = Math.min(c.window[0] - WINDOW_STEP, c.window[1] + gun.successes * c.shrink * WINDOW_STEP);
  return [c.window[0], lo];
}

function overheat(gun, now) {
  const h = gun.row.heat;
  gun.state = 'overheated';
  gun.until = now + h.penalty;
  gun.cooling = h.cooling ? { at: now, window: windowOf(gun), super: [...h.cooling.super] } : null;
}

export function fire(gun, now, { stance = 'stand', moving = false } = {}) {
  if (gun.state !== 'ready') return null;
  const f = gun.row.firing ?? {};
  const rof = f.rof ?? 600;
  const burst = f.mode === 'burst' ? (f.burst ?? 1) : 1;
  const gap = burst > 1 && f.burstsPerMinute ? 60 / f.burstsPerMinute : 60 / rof;
  if (now - gun.lastFire < gap - EDGE) return null;
  gun.lastFire = now;
  const shots = [];
  const sway = swayOf(gun.row, stance, moving);
  for (let k = 0; k < burst && gun.state === 'ready'; k++) {
    const at = now + (k * 60) / rof;
    const cone = dispersionFor(gun, stance, moving);
    for (let b = 0; b < (f.bulletsPerShot ?? 1); b++) {
      const r = cone * Math.sqrt(gun.rand());
      const a = gun.rand() * Math.PI * 2;
      shots.push({ at, dir: [r * Math.cos(a), r * Math.sin(a)] });
    }
    gun.spread = Math.min(sway.max, gun.spread + sway.perShot);
    gun.lastShot = at;
    if (gun.row.heat) {
      gun.heat = Math.min(1, gun.heat + gun.row.heat.perBullet);
      // the game's compare is `>=`: at exactly the threshold the gun overheats
      if (gun.heat >= gun.row.heat.threshold - EDGE) overheat(gun, at);
    } else if (gun.row.ammo && --gun.mag <= 0) {
      gun.state = 'reloading';
      gun.until = at + gun.row.ammo.reload;
    }
  }
  return shots;
}

export function tick(gun, dt, now) {
  const h = gun.row.heat;
  const sway = swayOf(gun.row, 'stand', false);
  if (now - gun.lastShot >= sway.noFireDelay) gun.spread = Math.max(0, gun.spread - sway.decay * dt);
  if (gun.state === 'overheated') {
    if (now - gun.cooling?.at >= h.dropDelay || !gun.cooling) gun.heat = Math.max(0, gun.heat - h.dropPerSecond * h.overheatedDrop * dt);
    if (now >= gun.until - EDGE) {
      gun.state = 'venting';
      gun.until = now + (h.cooling?.vent ?? 0);
      gun.cooling = null;
    }
  } else if (gun.state === 'venting') {
    if (now >= gun.until - EDGE) {
      gun.state = 'ready';
      gun.heat = 0;
    }
  } else if (gun.state === 'reloading') {
    if (now >= gun.until - EDGE) {
      gun.state = 'ready';
      gun.mag = gun.row.ammo.magazine;
    }
  } else if (h && now - gun.lastShot >= COOL_DELAY) {
    gun.heat = Math.max(0, gun.heat - h.dropPerSecond * dt);
  }
}

// A manual vent: heat to nothing after the vent time (above `MinimumTriggerHeat`).
export function vent(gun, now) {
  const c = gun.row.heat?.cooling;
  if (!c || gun.state !== 'ready' || gun.heat < c.minHeat) return false;
  gun.state = 'venting';
  gun.until = now + c.vent;
  return true;
}

// The bar under an overheated gun, 1 at the overheat falling to 0 over the penalty.
export const coolBar = (gun, now) => (gun.state === 'overheated' && gun.cooling ? 1 - (now - gun.cooling.at) / gun.row.heat.penalty : null);

export function coolPress(gun, now) {
  const b = coolBar(gun, now);
  if (b === null) return null;
  const c = gun.row.heat.cooling;
  const inside = ([hi, lo]) => b <= hi + EDGE && b >= lo - EDGE;
  if (inside(gun.cooling.super)) {
    gun.successes += c.shrink;
    gun.state = 'ready';
    gun.heat = 0;
    gun.cooling = null;
    return 'super';
  }
  if (inside(gun.cooling.window)) {
    gun.successes += c.shrink;
    gun.until = now + c.successPenalty;
    gun.state = 'venting';
    gun.cooling = null;
    return 'success';
  }
  gun.successes = Math.max(0, gun.successes + c.reset);
  gun.until += c.failurePenalty;
  gun.cooling = { ...gun.cooling, window: windowOf(gun) };
  return 'fail';
}

export function damageAt(row, dist) {
  const d = row.damage;
  if (!d) return HAND_DAMAGE[row.family] ?? HAND_DAMAGE.rifle;
  const span = d.endDistance - d.startDistance;
  const t = span <= 0 ? (dist > d.startDistance ? 1 : 0) : Math.min(1, Math.max(0, (dist - d.startDistance) / span));
  return d.start * (d.max ?? 1) * (1 - t) + d.end * (d.min ?? 1) * t;
}
