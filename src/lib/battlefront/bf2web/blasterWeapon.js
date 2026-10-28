// The trooper’s E-11 as bf2-web fires it (WebPort/physics/player/blaster-weapon.{h,cpp}): the trigger, heat,
// dispersion and bolt flight of the retail weapon, recovered from the retail binary (bf2-web’s weapons notes, each
// step citing its section there):
//   - the trigger’s states (1.2-1.3): Deploy, NoTrigger with the PendingFireWindow press buffer, PrimaryAutomaticFire
//     at 60 / RateOfFire, TriggerReleaseWait; one 1/30 s tick spent state by state;
//   - heat (2.2-2.3): HeatPerBullet a shot, the drop delay, the overheat’s lock, penalty and faster drop, no fire while
//     overheated;
//   - dispersion (3): the GunSway cone by stance and motion, +IncreasePerShot a shot, NoFireDecreasePerSecond after
//     NoFireTimeThreshold, the shot’s offsets from the retail RNG reseeded from the tick on a pull’s first shot;
//   - the bolt (5): spawned at the camera at Shot.InitialSpeed, swept tick by tick through the caller’s ray, ended by
//     the first hit, its TimeToLive or the world’s bounds;
//   - the hit’s damage (6): StartDamage to EndDamage over the falloff distances from the spawn point.
// Not covered (as in bf2-web): burst, single and charged fire, secondary fire, venting, recoil, zoom, hit capsules.
// Float as the C++ counts it; blasterWeapon.test.js replays its driver. Pure.
//
//   createBlaster(config = E11) → weapon
//   tick(weapon, input, ray?) → shots fired this tick (weapon.shots, weapon.results hold this tick’s)
//     input: { trigger, camera: [left xyz, up xyz, forward xyz, origin xyz], muzzle: (same), moveFraction, airborne, sprinting, crouched }
//     ray(from, to) → null | { fraction, normal: [x, y, z], position: [x, y, z], material, part }
//   status(weapon) → { state, shotsThisTick, automaticActive, overheated, heat, cone, boltsInFlight, ticks }
//   falloffDamage(config, distance)   rngSeedForTick(tick)   rngNext(state) → [value, state]

const f = Math.fround;

export const TICK = f(1 / 30);
export const MAX_BOLTS = 64;
export const MAX_SHOTS_PER_TICK = 4;
export const MAX_RESULTS_PER_TICK = 64;
export const STATE = { deploy: 0, triggerReleaseWait: 2, noTrigger: 5, primaryAutomaticFire: 12 };
export const BOLT_END = { hit: 1, timeout: 2, outOfBounds: 3 };

// the code’s epsilon
const EPSILON = f(1e-6);
const PI = f(Math.PI);
const DEGREES = f(PI / 180);
// a bolt dies where |x| or |z| reaches 4096 or y falls to -1024
const BOUNDS_XZ = 4096;
const BOUNDS_MIN_Y = -1024;
const MODULUS = 0x7fffffff;

const sway = (minAngle, maxAngle, increasePerShot, decreasePerSecond, noFireDecreasePerSecond, noFireTimeThreshold) =>
  ({ minAngle, maxAngle, increasePerShot, decreasePerSecond, noFireDecreasePerSecond, noFireTimeThreshold });

// _DefaultWeapon’s records for the E-11 (WeaponFiring_Default_BlasterRifle, OverheatConfig_Default_Rifle,
// WeaponSway_Default_Rifle, BlasterProjectile_Default_Rifle): automatic at 300 rpm after a 0.8 s deploy; 0.04 heat a
// bolt, dropping 0.3/s after 5 s, a 1 s penalty and ×1.5 while overheated; the hip cone 0.05 to 0.7°, +0.08 a shot,
// −1°/s after 0.2 s; 700 m/s for 3 s; 36 under 20 m to 19 past 40 m
export const E11 = {
  rateOfFire: 300, deployTime: 0.8, pendingFireWindow: 0.1,
  heatPerBullet: 0.04, heatDropPerSecond: 0.3, heatIncreasePerSecond: 0, overheatPenaltyTime: 1, overheatThreshold: 0.001,
  overheatDropDelay: 5, overheatedDropMultiplier: 1.5,
  standHip: sway(0.05, 0.7, 0.08, 1, 1, 0.2),
  standHipMoving: sway(0.1, 0.7, 0.08, 1, 1, 0.2),
  standHipJumping: sway(0.5, 1.5, 0.05, 0.1, 0.1, 0.2),
  crouchHip: sway(0.1, 0.7, 0.08, 1, 1, 0.2),
  powerOfDispersionRandom: 0.5,
  initialSpeed: 700, timeToLive: 3,
  startDamage: 36, endDamage: 19, damageFalloffStartDistance: 20, damageFalloffEndDistance: 40,
  material: 0x30005800,
};
// the bots’ E-11: the same gun with BlasterProjectile_Default_Rifle_AI’s bolt, 18 under 20 m to 10 past 40 m
export const E11_AI = { ...E11, startDamage: 18, endDamage: 10 };

const fRow = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, f(v)]));
function floats(config) {
  const c = {};
  for (const [k, v] of Object.entries(config)) c[k] = typeof v === 'number' && k !== 'material' ? f(v) : typeof v === 'object' ? fRow(v) : v;
  return c;
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dot3 = (a, b) => f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]));

export function createBlaster(config = E11) {
  return {
    config: floats(config), state: STATE.deploy, next: STATE.deploy, tick: 0, timeToWait: 0, toFire: 0,
    consumed: false, pending: 0, pendingTick: 0, overheated: false, heat: 0, penaltyTimer: 0, dropDelayTimer: 0,
    cone: 0, timeSinceShot: 1e9, coneInitialized: false, pullShots: 0, rng: 1, nextShotId: 1,
    bolts: [], shots: [], results: [],
  };
}

// the retail RNG (3.1): the seed tick × 0xa21 ^ 0xd59fab13 in 31 bits, then ×24112 and ×26143 modulo 2³¹ − 1
export function rngSeedForTick(tick) {
  const s = (Math.imul(tick, 0xa21) ^ 0xd59fab13) >>> 0;
  return (s === 0 ? 1 : s) & MODULUS;
}
export function rngNext(state) {
  let s = state === 0 ? 1 : state;
  s = Number((BigInt(s) * 24112n) % BigInt(MODULUS));
  s = Number((BigInt(s) * 26143n) % BigInt(MODULUS));
  return [s, s];
}
function uniform01(w) {
  const [v, s] = rngNext(w.rng);
  w.rng = s;
  return f((((v | 0x80) >>> 7) + 1) * (1 / 16777216));
}

// 2.2: a shot adds HeatPerBullet; at 1 the gun overheats for its penalty
function addHeat(w, amount, resetDelay) {
  const c = w.config;
  w.heat = clamp(f(w.heat + amount), 0, 1);
  if (w.heat >= 1) {
    w.heat = 1;
    w.overheated = true;
    w.penaltyTimer = c.overheatPenaltyTime;
    w.dropDelayTimer = 0;
  } else if (resetDelay) w.dropDelayTimer = c.overheatDropDelay;
}

// 2.3: the drop after its delay, the penalty first while overheated
function heatUpdate(w, dt) {
  const c = w.config;
  if (!w.overheated && c.heatIncreasePerSecond > 0) addHeat(w, f(c.heatIncreasePerSecond * dt), false);
  if (w.overheated || w.dropDelayTimer <= 0) {
    if (w.penaltyTimer > 0) w.penaltyTimer = Math.max(0, f(w.penaltyTimer - dt));
    else if (w.heat > 0) {
      let drop = f(c.heatDropPerSecond * dt);
      if (w.overheated) drop = f(drop * c.overheatedDropMultiplier);
      w.heat = Math.max(0, f(w.heat - drop));
      if (w.overheated && w.heat < c.overheatThreshold) w.overheated = false;
    } else if (w.overheated) w.overheated = false;
  } else w.dropDelayTimer = Math.max(0, f(w.dropDelayTimer - dt));
}

// 1.2: a state waits out its time and gives the rest back to the tick; in automatic fire a release with nothing left
// to fire ends the pull while the cadence runs on
function waiting(w, left, input) {
  w.timeToWait = f(w.timeToWait - left);
  if (w.timeToWait < 0) {
    // a remainder under the epsilon snaps to 0, so six ticks end a 0.2 s wait exactly
    left = -w.timeToWait < EPSILON ? 0 : -w.timeToWait;
    w.timeToWait = 0;
  } else {
    left = 0;
    if (w.timeToWait < EPSILON) w.timeToWait = 0;
  }
  if (w.state === STATE.primaryAutomaticFire && !input.trigger && w.next !== STATE.noTrigger && w.toFire <= 0) {
    w.toFire = 0;
    w.next = STATE.noTrigger;
  }
  return left;
}

// 1.3: each state’s action, which first spends the rest of the tick
function updateState(w, left, input) {
  const c = w.config;
  w.timeToWait = left;
  const interval = c.rateOfFire !== 0 ? f(60 / c.rateOfFire) : 1;
  if (w.state === STATE.deploy) {
    w.timeToWait = c.deployTime;
    w.next = STATE.noTrigger;
  } else if (w.state === STATE.noTrigger) {
    // a buffered press counts while it is younger than PendingFireWindow
    const pending = w.pending === 1 && w.pendingTick <= w.tick && f((w.tick - w.pendingTick) * TICK) <= c.pendingFireWindow;
    if ((input.trigger || pending) && !w.overheated) {
      w.consumed = true;
      w.toFire = 1;
      w.pending = 0;
      w.timeToWait = 0;
      w.next = STATE.primaryAutomaticFire;
    } else w.pullShots = 0;
  } else if (w.state === STATE.primaryAutomaticFire) {
    if (w.toFire === 0) w.toFire = 1;
    if (!w.overheated && w.toFire > 0) {
      spawnShot(w, input);
      w.timeToWait = interval;
      w.next = STATE.primaryAutomaticFire;
    } else {
      w.next = STATE.triggerReleaseWait;
      w.timeToWait = interval;
    }
  } else if (w.state === STATE.triggerReleaseWait) {
    w.toFire = 0;
    w.timeToWait = 0;
    w.next = STATE.noTrigger;
  } else w.next = STATE.noTrigger;
  // the tick’s remainder is left as it was: the wait just set spends it
  return left;
}

// 1.4, 3.1 and 5.1: the dispersion’s sample, the bolt at the camera, the heat
function spawnShot(w, input) {
  const c = w.config;
  w.toFire--;
  if (w.pullShots === 0) w.rng = rngSeedForTick(w.tick);
  w.pullShots++;
  const angle = f(-PI + f(uniform01(w) * f(2 * PI)));
  const radius = f(f(f(Math.pow(uniform01(w), c.powerOfDispersionRandom)) * w.cone) * DEGREES);
  const yaw = f(radius * f(Math.cos(angle)));
  const pitch = f(radius * f(Math.sin(angle)));
  const cam = input.camera.map(f);
  const [left, up, forward, origin] = [cam.slice(0, 3), cam.slice(3, 6), cam.slice(6, 9), cam.slice(9, 12)];
  const cp = f(Math.cos(pitch)), cy = f(Math.cos(yaw)), sy = f(Math.sin(yaw)), sp = f(Math.sin(pitch));
  const direction = [0, 1, 2].map((i) => f(f(f(f(forward[i] * cp) * cy) + f(f(left[i] * sy) * cp)) + f(up[i] * sp)));
  const length = f(Math.sqrt(dot3(direction, direction)));
  for (let i = 0; i < 3; i++) direction[i] = f(direction[i] / (length > 0 ? length : 1));
  if (w.shots.length < MAX_SHOTS_PER_TICK) {
    w.shots.push({ id: w.nextShotId, tick: w.tick, origin, direction: [...direction], muzzle: (input.muzzle ?? input.camera).slice(9, 12).map(f), yawOffset: yaw, pitchOffset: pitch, cone: w.cone, heat: 0 });
  }
  if (w.bolts.length < MAX_BOLTS) {
    w.bolts.push({ shot: w.nextShotId, spawn: [...origin], position: [...origin], velocity: direction.map((d) => f(d * c.initialSpeed)), age: 0 });
  }
  w.nextShotId++;
  addHeat(w, c.heatPerBullet, true);
  if (w.shots.length) w.shots[w.shots.length - 1].heat = w.heat;
}

const rowOf = (w, input) => (input.airborne || input.sprinting ? w.config.standHipJumping : input.crouched ? w.config.crouchHip : w.config.standHip);

// 3.2: +IncreasePerShot a shot below the maximum; −NoFireDecreasePerSecond after the threshold without a shot; held
// to the row, whose minimum moves from standing to moving with the speed
function swayUpdate(w, input, dt, fired) {
  const r = rowOf(w, input);
  let minimum = r.minAngle;
  if (r === w.config.standHip) minimum = f(minimum + f(f(w.config.standHipMoving.minAngle - r.minAngle) * clamp(f(input.moveFraction ?? 0), 0, 1)));
  if (!w.coneInitialized) {
    w.cone = minimum;
    w.coneInitialized = true;
  }
  if (fired) w.timeSinceShot = 0;
  else w.timeSinceShot = f(w.timeSinceShot + dt);
  for (let i = 0; i < w.shots.length; i++) if (w.cone < r.maxAngle) w.cone = f(w.cone + r.increasePerShot);
  if (w.timeSinceShot >= r.noFireTimeThreshold) w.cone = f(w.cone - f(r.noFireDecreasePerSecond * dt));
  w.cone = clamp(w.cone, minimum, r.maxAngle);
}

// 6: the falloff over the straight line from the spawn point
export function falloffDamage(config, distance) {
  const s = f(config.startDamage), e = f(config.endDamage), a = f(config.damageFalloffStartDistance), b = f(config.damageFalloffEndDistance);
  distance = f(distance);
  const d2 = f(distance * distance);
  if (d2 < f(a * a)) return s;
  if (d2 > f(b * b)) return e;
  if (f(b - a) >= EPSILON) return f(s - f(f(f(distance - a) / f(b - a)) * f(s - e)));
  return e;
}

// 5.2: age, the step clipped at the TimeToLive, the sweep, the end
function sweepBolts(w, ray) {
  const c = w.config;
  const dt = TICK;
  const ttl = c.timeToLive > EPSILON ? c.timeToLive : 1024;
  const kept = [];
  for (const bolt of w.bolts) {
    bolt.age = f(bolt.age + dt);
    const step = f(dt - Math.max(0, f(bolt.age - ttl)));
    const next = bolt.position.map((p, i) => f(p + f(bolt.velocity[i] * step)));
    const delta = next.map((n, i) => f(n - bolt.position[i]));
    const result = { shot: bolt.shot, tick: w.tick, end: 0, position: [0, 0, 0], normal: [0, 0, 0], material: 0, part: 0, distance: 0, damage: 0, age: bolt.age, velocity: [...bolt.velocity] };
    let ended = false;
    const hit = dot3(delta, delta) > EPSILON && ray ? ray(bolt.position, next) : null;
    if (hit) {
      result.end = BOLT_END.hit;
      result.position = hit.position.map(f);
      result.normal = hit.normal.map(f);
      result.material = hit.material ?? 0;
      result.part = hit.part ?? 0;
      ended = true;
    } else {
      bolt.position = next;
      if (bolt.age >= ttl) {
        result.end = BOLT_END.timeout;
        ended = true;
      } else if (Math.abs(next[0]) >= BOUNDS_XZ || Math.abs(next[2]) >= BOUNDS_XZ || next[1] <= BOUNDS_MIN_Y) {
        result.end = BOLT_END.outOfBounds;
        ended = true;
      }
      if (ended) result.position = [...next];
    }
    if (!ended) {
      kept.push(bolt);
      continue;
    }
    const from = result.position.map((p, i) => f(p - bolt.spawn[i]));
    result.distance = f(Math.sqrt(dot3(from, from)));
    result.damage = result.end === BOLT_END.hit ? falloffDamage(c, result.distance) : 0;
    if (w.results.length < MAX_RESULTS_PER_TICK) w.results.push(result);
  }
  w.bolts = kept;
}

export function tick(w, input, ray = null) {
  const c = w.config;
  w.tick++;
  w.shots = [];
  w.results = [];
  // the bolts already flying move first; this tick’s shots first move on the next
  sweepBolts(w, ray);
  if (!w.coneInitialized) swayUpdate(w, input, 0, false);
  heatUpdate(w, TICK);
  if (!input.trigger) w.consumed = false;
  if (input.trigger && c.pendingFireWindow > EPSILON && !w.consumed) {
    w.pending = 1;
    w.pendingTick = w.tick;
  }
  // a state’s wait includes the rest of the tick it was set in: a 0.2 s interval set at a tick’s start fires again
  // six ticks later
  let left = TICK;
  for (let guard = 0; left > 0 && guard < 64; guard++) {
    if (w.timeToWait > 0) left = waiting(w, left, input);
    else if (w.next !== w.state) w.state = w.next;
    else left = updateState(w, left, input);
  }
  swayUpdate(w, input, TICK, w.shots.length > 0);
  return w.shots.length;
}

export const status = (w) => ({
  state: w.state, shotsThisTick: w.shots.length, automaticActive: w.state === STATE.primaryAutomaticFire, overheated: w.overheated,
  heat: w.heat, cone: w.cone, boltsInFlight: w.bolts.length, ticks: w.tick,
});
