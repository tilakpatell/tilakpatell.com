// The gun model (spec catalogue 2; `WeaponFiringData`, `GunSwayData`,
// `OverheatConfig`), from a weapons.json row: the rate of fire and bursts,
// heat in place of ammunition with the game's active cooling, a magazine
// where the row has one, the dispersion cone by stance, and damage that
// falls off with range. Times are the sim's clock in seconds. Pure: every
// random draw is the caller's `rand`.
//
//   createGun(row, { rand }) → gun   (gun.heat 0…1, gun.state, gun.cooling while overheated, gun.recoil [yaw°, pitch°])
//   fire(gun, now, { stance, moving }) → [{ at, dir: [dYaw, dPitch], kick: [dYaw, dPitch] }] | null
//   tick(gun, dt, now)        vent(gun, now) → bool        coolPress(gun, now) → 'success' | 'super' | 'fail' | null
//   dispersionFor(gun, stance, moving) → radians            damageAt(row, dist, { bot }) → number
//   recoilOf(gun) → [yaw, pitch] radians (the camera spring's target)      kickAim(gun, from, aim) → aim' (a bot's view, kicked)
//
// Recoil (`GunSwayRecoilData` a row of `WeaponSway_Default_Rifle`,
// `CameraRecoilData`; bf2-re finding 34 §1): a shot adds
// `RecoilAmplitudeIncPerShot` of upward kick to an amplitude capped at
// `RecoilAmplitudeMax`, and a horizontal kick drawn in
// `[HorizontalRecoilAmplitudeIncPerShotMin, Max]` capped at
// `HorizontalRecoilAmplitudeMax`; the amplitude falls by
// `RecoilAmplitudeDecreaseFactor` a second; it is the target of the
// camera's spring (`SpringConstant 3000`, `SpringDamping 0.84`, the row's
// `recoil`), and `RecoilFollowsDispersion` gives the kick the dispersion
// sample's side, so the bolt and the view jump the same way. No pattern.
//
// The rate is the record's whatever the sim's step: the next bolt is owed
// from the last one's time while the trigger stays down, so 900 rpm on a
// 50 ms step is three bolts in four steps, not one in two. A row with
// `firing.preFire` (the sentry's `UseChargeUpLogic`, `PreFireDelay 1`;
// finding 33) spins up before the first bolt of a pull: the wait is the
// delay less what spin the barrel has left, which falls by `chargeDown` a
// second with the trigger up (`gun.spin` 0…1, for the drawing too).

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

// The recoil rows (`GunSwayRecoilData`, one a `GunSwayDispersionData` row of
// `WeaponSway_Default_Rifle`; finding 34 §1): degrees a shot adds up
// (`inc`), the horizontal draw (`h`, ± degrees), the caps (`max`, `hMax`)
// and the fall a second (`decay`). The moving rows take the stand row's.
export const RECOIL = {
  stand: { inc: 0.7, h: 0.5, max: 10, hMax: 2, decay: 10 },
  zoomStand: { inc: 0.55, h: 0.3, max: 10, hMax: 2, decay: 10 },
  crouch: { inc: 0.4, h: 0.6, max: 10, hMax: 2, decay: 10 },
  zoomCrouch: { inc: 0.3, h: 0.3, max: 10, hMax: 2, decay: 10 },
  prone: { inc: 2, h: 1, max: 10, hMax: 10, decay: 4 },
};
// The AI's bolt (`BlasterProjectile_Default_Rifle_AI`, swapped in by the
// weapon's `WeaponProjectileModifier` when a bot holds it: 18 → 10 against
// the A280's 36 → 19, finding 34 §1): a bot's bolt deals half.
export const AI_DAMAGE_SCALE = 0.5;
// How long without a pull the trigger counts as let go, seconds: a step and a half of the sim's. By hand.
export const PULL_GAP = 0.075;

export function createGun(row, { rand = Math.random } = {}) {
  return {
    row,
    rand,
    heat: 0,
    state: 'ready',
    lastShot: -Infinity,
    lastFire: -Infinity,
    spread: 0, // degrees the shots have added to the cone
    recoil: [0, 0], // degrees of kick the shots have left: yaw (the dispersion's frame, + toward +X at yaw 0), pitch (up positive)
    coolMul: 1, // a cooling-power affector's multiplier on the heat's fall (the officer's presence)
    spin: 0, // the barrel's spin, 0…1 (a row with `firing.preFire`)
    spinAt: 0,
    pullAt: -Infinity,
    lastPull: -Infinity,
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
  return Math.min(Math.max(d.min, d.max), Math.max(Math.min(d.min, d.max), d.min + gun.spread)) * DEG;
}

function recoilRow(row, stance, moving) {
  const zoom = typeof stance === 'string' && stance.startsWith('zoom');
  const base = zoom ? stance.slice(4).toLowerCase() : stance;
  const name = STANCES[base] === 'prone' ? 'prone' : moving || base === 'roll' ? 'stand' : (STANCES[base] ?? 'stand');
  const want = zoom ? `zoom${name[0].toUpperCase()}${name.slice(1)}` : name;
  const table = row.recoilRows ?? RECOIL;
  return table[want] ?? table[name] ?? RECOIL.stand;
}

// a shot's kick: the vertical the row's, the horizontal drawn in ± the
// row's and given the dispersion sample's side (`RecoilFollowsDispersion`)
function kick(gun, r, azimuth) {
  const h = (gun.rand() * 2 - 1) * r.h;
  const side = Math.cos(azimuth) < 0 ? -1 : 1;
  const dYaw = Math.abs(h) * side;
  gun.recoil[0] = Math.max(-r.hMax, Math.min(r.hMax, gun.recoil[0] + dYaw));
  gun.recoil[1] = Math.min(r.max, gun.recoil[1] + r.inc);
  return [dYaw * DEG, r.inc * DEG];
}

export const recoilOf = (gun) => (gun ? [gun.recoil[0] * DEG, gun.recoil[1] * DEG] : [0, 0]);

// a bot's aim point turned by its own gun's recoil (its view is kicked as a player's is)
export function kickAim(gun, from, aim) {
  const [ry, rp] = recoilOf(gun);
  if (!ry && !rp) return aim;
  const d = [aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]];
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const yaw = Math.atan2(d[0], d[2]) + ry;
  const pitch = Math.asin(Math.max(-1, Math.min(1, d[1] / L))) + rp;
  const c = Math.cos(pitch);
  return [from[0] + Math.sin(yaw) * c * L, from[1] + Math.sin(pitch) * L, from[2] + Math.cos(yaw) * c * L];
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
  if (f.preFire) {
    // (a new pull: the wait starts again, ResetPreFireWaitOnRelease, less the spin the barrel kept)
    if (now - gun.lastPull > PULL_GAP + EDGE) {
      gun.pullAt = now;
      gun.spinAt = gun.spin;
    }
    gun.lastPull = now;
    const wait = f.preFire * (1 - gun.spinAt);
    gun.spin = Math.min(1, gun.spinAt + (now - gun.pullAt) / f.preFire);
    if (now - gun.pullAt < wait - EDGE) return null;
  }
  const rof = f.rof ?? 600;
  const burst = f.mode === 'burst' ? (f.burst ?? 1) : 1;
  const gap = burst > 1 && f.burstsPerMinute ? 60 / f.burstsPerMinute : 60 / rof;
  if (now - gun.lastFire < gap - EDGE) return null;
  // (the trigger held: the next bolt is owed from the last one's time, so a rate between steps is kept)
  gun.lastFire = now - gun.lastFire < 2 * gap - EDGE ? gun.lastFire + gap : now;
  const shots = [];
  const sway = swayOf(gun.row, stance, moving);
  const rr = recoilRow(gun.row, stance, moving);
  for (let k = 0; k < burst && gun.state === 'ready'; k++) {
    const at = now + (k * 60) / rof;
    const cone = dispersionFor(gun, stance, moving);
    let first = null;
    const per = f.bulletsPerShot ?? 1;
    for (let b = 0; b < per; b++) {
      const r = cone * Math.sqrt(gun.rand());
      const a = gun.rand() * Math.PI * 2;
      first ??= a;
      shots.push({ at, dir: [r * Math.cos(a), r * Math.sin(a)], kick: null });
    }
    const kicked = kick(gun, rr, first ?? 0);
    for (let i = shots.length - per; i < shots.length; i++) shots[i].kick = kicked;
    // (a negative perShot is the sentry's: its cone tightens as it spins)
    gun.spread = sway.perShot >= 0 ? Math.min(sway.max, gun.spread + sway.perShot) : Math.max(sway.max - sway.min, gun.spread + sway.perShot);
    gun.rr = rr;
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
  const f = gun.row.firing;
  // (the barrel winds down with the trigger up: ChargeUpDecrease)
  if (f?.preFire && now - gun.lastPull > PULL_GAP + EDGE) gun.spin = Math.max(0, gun.spin - (f.chargeDown ?? 0) * dt);
  const sway = swayOf(gun.row, 'stand', false);
  // (a negative decay is the sentry's: the cone opens again when the trigger drops)
  if (now - gun.lastShot >= sway.noFireDelay) gun.spread = sway.decay >= 0 ? Math.max(0, gun.spread - sway.decay * dt) : Math.min(0, gun.spread - sway.decay * dt);
  // (the kick falls from its shot's own time: one fired this step has not begun to, so the
  // view sees the whole 0.7° before it goes, whatever the step)
  const fall = (gun.rr ?? recoilRow(gun.row, 'stand', false)).decay * Math.max(0, Math.min(dt, now - gun.lastShot));
  gun.recoil[0] = Math.abs(gun.recoil[0]) <= fall ? 0 : gun.recoil[0] - Math.sign(gun.recoil[0]) * fall;
  gun.recoil[1] = Math.max(0, gun.recoil[1] - fall);
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
    gun.heat = Math.max(0, gun.heat - h.dropPerSecond * (gun.coolMul ?? 1) * dt);
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

export function damageAt(row, dist, { bot = false } = {}) {
  const d = row.damage;
  // (a row that is the AI's own already, the sentry's and the turret's, is not halved again)
  const scale = bot && !row.aiDamage ? AI_DAMAGE_SCALE : 1;
  if (!d) return (HAND_DAMAGE[row.family] ?? HAND_DAMAGE.rifle) * scale;
  const span = d.endDistance - d.startDistance;
  const t = span <= 0 ? (dist > d.startDistance ? 1 : 0) : Math.min(1, Math.max(0, (dist - d.startDistance) / span));
  return (d.start * (d.max ?? 1) * (1 - t) + d.end * (d.min ?? 1) * t) * scale;
}
