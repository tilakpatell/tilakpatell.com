// The AutoPlayer: the bot the game runs in Instant Action (Mode8), Co-op
// (Mode9), Supremacy (Mode1) and the server's fill (bf2-re findings 28 and
// 34), a player driven by an objective, aiming as a pad does. Its numbers are
// the server's settings (`gameSettings.json`, Online/GameSettingsContainer):
// a row's name is a base, then the difficulty, then the mode
// (`AP_LofReactionTimeS_Expert_Mode8`), and the most particular row the
// settings hold is the one in force, as the game's GameSettingsEntityData
// choices pick them at round start.
//
// The aim and the trigger are the game's own, read from its code (NOTES.md,
// "The AutoPlayers"; ai/soldierBrain.js runs them). Each update an aim point
// is drawn afresh: the target led by AP_LofPredictionTime (0.15 s), turned
// about the bot by a uniform draw inside the noise on the yaw and on the
// pitch each, with no memory. The noise is degrees: the weapon's class
// (AP_BlasterAimNoise 1.5, AP_LmgAimNoise, AP_ShotgunAimNoise,
// AP_SniperRifleAimNoise; a launcher falls through to the blaster's) ×
// AP_AimNoiseScale (rookie 7, normal 3, expert 2 in Mode8) × the team's
// (the rows' AP_AimNoiseScale_Enemies_* for the bots facing a human,
// _Friendlies_ beside one). The view turns toward that point no faster than
// a lap every AP_AimLapTime (0.25 s), a quarter of that in pitch. A burst
// starts when the view line passes inside the weapon's tolerance of where
// the target is (TOLERANCE, m², times the noise where that is over one),
// the target more than a metre ahead, with the line of fire's flag: true
// once the line has been clear longer than AP_LofReactionTimeS (0.05 s),
// and for AP_LofTimeoutS (1.5 s) after it is lost. The trigger is held and
// let go by the weapon's cadence (BURSTS); the gun's own rate, heat and
// spread do the rest (weapons.js). There is no angle inside which it fires.
// Its evasion while it fights, read from the game's own step (the decompile
// of FUN_145571ea0, NOTES.md): a strafe of two legs, each for a time drawn in
// AP_EvasiveManeuversInvertStrafeDuration (1.5 to 3.5 s); the ground
// AP_EvasiveManeuversGroundCheckDistanceM (2.5 m) to the leg's side probed
// every step from AP_…GroundCheckHeightOffsetM (1.5 m) above the feet down
// AP_…GroundCheckHeightDistanceM (3.5 m); a failed probe ends the leg and
// bars that side for AP_…GroundCheckCooldownS (3 s); both barred, no strafe.
// As each leg starts the game draws that leg's dodge roll
// (AP_EvasiveManeuversDodgeRollProbability, 0.2) and its jump (0 in these
// modes), its crouch (CROUCH) and whether it also goes forward or back, a
// third each (FUN_14556df20, FUN_14556e140): `takeRoll` hands the roll over
// once. The game holds the roll's input for the whole leg, the stick the way
// the leg goes; whether that rolls once or again is the soldier's own
// handling, not read, and the site rolls once.
//
// Read by hand (src/data/bf2017/NOTES.md, "The AutoPlayers"): the view's law
// under its cap (the site's view goes straight for the aim point as fast as
// the cap lets it); the difficulty's names (the sim's rookie/normal/expert
// are the rows' own); TARGET's two seconds and CROUCH's numbers, which are a
// level's values of settings the rows do not hold; AP_AimAcceleration, which
// no code read uses.
// Pure: no three.js, no DOM.
//
//   suffixOf(mode) → 'Mode8' | 'Mode1' | 'Mode9'      rowOf(difficulty) → 'Rookie' | 'Normal' | 'Expert'
//   setting(gs, base, { mode, difficulty, side }) → { value, name } | null
//   autoPlayerFor(gs, { mode, difficulty, side }) → ap (every number above, with `sources`)
//   noiseOf(ap, class) → degrees       weaponClass(family, weaponId) → 'blaster' | 'lmg' | 'shotgun' | 'sniper'
//   aimPoint(ap, { from, at, vel, noise, rand }) → [x, y, z]     createAim() → aim (the view: yaw, pitch)
//   viewStep(aim, ap, { from, point, dt }) → aim      viewPoint(aim, from, dist) → [x, y, z]
//   viewMiss(aim, from, at) → { miss2, ahead, along }      mayFire(class, noise, miss) → bool
//   createBurst() → burst      burstStep(burst, class, { start, now }) → held?
//   createLof() → lof      lofStep(lof, ap, { clear, now }) → the flag
//   crouched(ev) → bool      TOLERANCE, BURSTS, AHEAD, TARGET, FACING, CROUCH
//   createEvasion() → ev   strafeSide(ev, ap, { now, rand, ground(side) }) → -1 | 1 | 0 (no strafe)
//   groundOk(ap, dy) → bool (the probe's rule for ground dy m above the feet)      takeRoll(ev) → bool (the leg's dodge roll, once)
//   dodges(ap, rand) → bool

// The site's modes → the settings' suffix: Instant Action's rows for its own and the modes it plays on
// the multiplayer maps, Supremacy's (Mode1) for Supremacy, Co-op's (Mode9) for Co-op.
export const SUFFIX = { supremacy: 'Mode1', coop: 'Mode9', ModeDefend: 'Mode9' };
export const suffixOf = (mode) => SUFFIX[mode] ?? 'Mode8';
const ROWS = { rookie: 'Rookie', easy: 'Rookie', normal: 'Normal', medium: 'Normal', default: 'Normal', expert: 'Expert' };
export const rowOf = (difficulty) => (difficulty ? (ROWS[String(difficulty).toLowerCase().split(':').pop()] ?? 'Normal') : 'Normal');

// the most particular row the settings hold for a base: base_<Side>_<Difficulty>_<Mode>, … base
export function setting(gs, base, { mode = 'galacticAssault', difficulty = null, side = null } = {}) {
  const m = suffixOf(mode);
  const d = rowOf(difficulty);
  const s = gs?.settings ?? gs ?? {};
  const names = side ? [`${base}_${side}_${d}_${m}`, `${base}_${side}_${m}`, `${base}_${side}`] : [`${base}_${d}_${m}`, `${base}_${m}`, `${base}_${d}`, base];
  for (const name of names) if (name in s && s[name] !== null) return { value: s[name], name };
  return null;
}

export function autoPlayerFor(gs, { mode = 'galacticAssault', difficulty = null, side = null } = {}) {
  const sources = {};
  const get = (key, base, fallback, opts = {}) => {
    const r = setting(gs, base, { mode, difficulty, ...opts });
    sources[key] = r ? r.name : 'hand';
    return r ? r.value : fallback;
  };
  const noise = {
    blaster: get('noise.blaster', 'AP_BlasterAimNoise', 1.5),
    lmg: get('noise.lmg', 'AP_LmgAimNoise', 1.5),
    shotgun: get('noise.shotgun', 'AP_ShotgunAimNoise', 3),
    sniper: get('noise.sniper', 'AP_SniperRifleAimNoise', 1),
    launcher: get('noise.launcher', 'AP_LauncherAimNoise', 0),
  };
  return {
    mode,
    difficulty: rowOf(difficulty),
    side,
    fov: get('fov', 'AP_TargetTrackerFieldOfViewDegrees', 140),
    lofReaction: get('lofReaction', 'AP_LofReactionTimeS', 0.05),
    lofTimeout: get('lofTimeout', 'AP_LofTimeoutS', 1.5),
    lead: get('lead', 'AP_LofPredictionTime', 0.15),
    aimAcceleration: get('aimAcceleration', 'AP_AimAcceleration', 0.25),
    aimLap: get('aimLap', 'AP_AimLapTime', 0.25),
    noise,
    noiseScale: get('noiseScale', 'AP_AimNoiseScale', 2),
    sideScale: side ? get('sideScale', 'AP_AimNoiseScale', 1, { side }) : 1,
    vehicleNoiseScale: get('vehicleNoiseScale', 'AP_VehicleAimNoiseScale', 2),
    engageScale: get('engageScale', 'AP_MaxTargetEngagingDistanceScale', 2.5),
    dodgeRoll: get('dodgeRoll', 'AP_EvasiveManeuversDodgeRollProbability', 0.2),
    jump: get('jump', 'AP_EvasiveManeuversJumpProbability', 0),
    strafeInvert: [get('strafeInvert.min', 'AP_EvasiveManeuversInvertStrafeDurationMin', 1.5), get('strafeInvert.max', 'AP_EvasiveManeuversInvertStrafeDurationMax', 3.5)],
    groundCheck: {
      on: get('groundCheck.on', 'AP_EvasiveManeuversGroundCheckEnabled', true),
      distance: get('groundCheck.distance', 'AP_EvasiveManeuversGroundCheckDistanceM', 2.5),
      drop: get('groundCheck.drop', 'AP_EvasiveManeuversGroundCheckHeightDistanceM', 3.5),
      offset: get('groundCheck.offset', 'AP_EvasiveManeuversGroundCheckHeightOffsetM', 1.5),
      cooldown: get('groundCheck.cooldown', 'AP_EvasiveManeuversGroundCheckCooldownS', 3),
    },
    melee: { on: get('melee.on', 'AP_CombatUseMelee', false), distance: get('melee.distance', 'AP_MeleeDistanceM', 1.5), interval: get('melee.interval', 'AP_MeleeIntervalS', 0.5) },
    // (the hero bots' saber timings, for lib/combat's duellists: the heroes lane reads them)
    sword: {
      distance: [get('sword.distance.min', 'AP_SwordAttackDistanceMetersMin', 2), get('sword.distance.max', 'AP_SwordAttackDistanceMetersMax', 5)],
      attack: [get('sword.attack.min', 'AP_SwordAttackDurationTimeMinS', 3), get('sword.attack.max', 'AP_SwordAttackDurationTimeMaxS', 5)],
      guard: [get('sword.guard.min', 'AP_SwordGuardDurationTimeMinS', 2), get('sword.guard.max', 'AP_SwordGuardDurationTimeMaxS', 4)],
      pause: [get('sword.pause.min', 'AP_PauseSwordAttackDurationTimeMinS', 2), get('sword.pause.max', 'AP_PauseSwordAttackDurationTimeMaxS', 3)],
      abilitiesFrom: get('sword.abilitiesFrom', 'AP_UseSwordAttackingAbilitiesFromMeters', 10),
      strafePerFrame: get('sword.strafePerFrame', 'AP_HeroStrafeProbabilityPerFrame', 0.005),
    },
    turretDamage: get('turretDamage', 'AP_OfficerTurret_DamageMult', 0.75),
    vehicle: {
      bail: get('vehicle.bail', 'AP_VehicleBailTime', 20),
      uTurn: get('vehicle.uTurn', 'AP_MinDistanceForVehicleUTurn', 20),
      minThrottle: get('vehicle.minThrottle', 'AP_VehicleMinimumForwardThrottle', 0.4),
      exitStuck: get('vehicle.exitStuck', 'AP_ExitVehicleWhenStuckTimeout', 30),
      unstuck: get('vehicle.unstuck', 'AP_UnStuckVehicleActionsTriggerTimeSeconds', 5),
      neverExit: get('vehicle.neverExit', 'AP_NeverExitVehicleAfterEntering', false),
    },
    spawn: {
      delay: get('spawn.delay', 'AP_Spawn_Delay', 4),
      respawnDelay: get('spawn.respawnDelay', 'AP_RespawnDelay', 0),
      initialRespawnDelay: get('spawn.initialRespawnDelay', 'AP_InitialRespawnDelay', 0),
      squad: get('spawn.squad', 'AP_SquadSpawnProbability', 0.5),
      hero: get('spawn.hero', 'AP_HeroSpawnProbability', 1),
      special: get('spawn.special', 'AP_SpecialSpawnProbability', 1),
      vehicle: get('spawn.vehicle', 'AP_VehicleSpawnProbability', 0.8),
      heroVehicle: get('spawn.heroVehicle', 'AP_HeroVehicleSpawnProbability', 1),
    },
    sources,
  };
}

// The noise's weapon class for a family (weapons.json's) and, where the family is wide, the gun's id
export function weaponClass(family, weaponId = '') {
  const id = String(weaponId).toLowerCase();
  if (/shotgun|scatter|blurrg|dh17|ee3|blastcannon/.test(id) && family !== 'rifle') return 'shotgun';
  if (family === 'heavy') return 'lmg';
  if (family === 'sniper') return 'sniper';
  return 'blaster';
}

// degrees of noise on a bot's view with this weapon class
export const noiseOf = (ap, cls) => (ap.noise[cls] ?? ap.noise.blaster) * ap.noiseScale * ap.sideScale;

const RAD = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The fire tolerance by weapon class, m²: how far the view line may pass from the target for the trigger
// to be pressed (the weapon record's own number, the same at every range).
export const TOLERANCE = { blaster: 2, lmg: 1, shotgun: 1, sniper: 0.15 };
// The trigger's cadence by weapon class, s: held a burst, let go a pause (the weapon record's own).
export const BURSTS = { blaster: { hold: 0.2, pause: 0.1 }, lmg: { hold: 0.2, pause: 0.1 }, shotgun: { hold: 0.2, pause: 2 }, sniper: { hold: 0.1, pause: 2 } };
// The target must be this far ahead along the view line, m.
export const AHEAD = 1;

export const createAim = () => ({ yaw: null, pitch: 0 });

// The aim point of an update: the target led by the prediction time, then turned about the shooter by a
// fresh draw, uniform inside the noise on the yaw and on the pitch each (a square, with no memory)
export function aimPoint(ap, { from, at, vel = [0, 0, 0], noise = 0, rand = Math.random }) {
  const led = [at[0] + vel[0] * ap.lead, at[1] + (vel[1] ?? 0) * ap.lead, at[2] + vel[2] * ap.lead];
  if (!(noise > 0)) return led;
  const dx = led[0] - from[0];
  const dy = led[1] - from[1];
  const dz = led[2] - from[2];
  const flat = Math.hypot(dx, dz) || 1e-6;
  const dist = Math.hypot(flat, dy);
  const yaw = Math.atan2(dx, dz) + (rand() * 2 - 1) * noise * RAD;
  const pitch = Math.atan2(dy, flat) + (rand() * 2 - 1) * noise * RAD;
  const c = Math.cos(pitch);
  return [from[0] + Math.sin(yaw) * c * dist, from[1] + Math.sin(pitch) * dist, from[2] + Math.cos(yaw) * c * dist];
}

// The view turned toward the aim point: no faster than a lap every AP_AimLapTime, a quarter of that in
// pitch (the code's cap on its turn command; the law under the cap is the soldier's own and is not read,
// so the view goes straight for the point as fast as the cap lets it)
export function viewStep(aim, ap, { from, point, dt = 0.05 }) {
  const dx = point[0] - from[0];
  const dy = point[1] - from[1];
  const dz = point[2] - from[2];
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz) || 1e-6);
  if (aim.yaw === null) {
    aim.yaw = yaw;
    aim.pitch = pitch;
    return aim;
  }
  const cap = ((2 * Math.PI) / Math.max(1e-6, ap.aimLap)) * dt;
  const turn = (d, most) => Math.max(-most, Math.min(most, d));
  aim.yaw = wrap(aim.yaw + turn(wrap(yaw - aim.yaw), cap));
  aim.pitch += turn(pitch - aim.pitch, cap / 4);
  return aim;
}

// The trigger's measure: the squared distance from a point (the target's own place, not led and not
// noised) to the view line, and whether the point is more than AHEAD along it
export function viewMiss(aim, from, at) {
  const c = Math.cos(aim.pitch);
  const dir = [Math.sin(aim.yaw) * c, Math.sin(aim.pitch), Math.cos(aim.yaw) * c];
  const rel = [at[0] - from[0], at[1] - from[1], at[2] - from[2]];
  const along = rel[0] * dir[0] + rel[1] * dir[1] + rel[2] * dir[2];
  const miss2 = Math.max(0, rel[0] * rel[0] + rel[1] * rel[1] + rel[2] * rel[2] - along * along);
  return { miss2, ahead: along > AHEAD, along };
}

// whether a burst may start: the view line inside the class's tolerance of the target, the tolerance
// times the noise where that is over one, and the target ahead
export const mayFire = (cls, noise, { miss2, ahead }) => ahead && miss2 < (TOLERANCE[cls] ?? TOLERANCE.blaster) * Math.max(1, noise);

// where the gun points: along the view, as far as the target is
export function viewPoint(aim, from, dist) {
  const c = Math.cos(aim.pitch);
  return [from[0] + Math.sin(aim.yaw) * c * dist, from[1] + Math.sin(aim.pitch) * dist, from[2] + Math.cos(aim.yaw) * c * dist];
}

export const createBurst = () => ({ heldSince: null, pausedAt: -Infinity });

// The trigger this update: held for the class's burst once one may start, then let go for its pause
export function burstStep(burst, cls, { start, now }) {
  const { hold, pause } = BURSTS[cls] ?? BURSTS.blaster;
  if (burst.heldSince !== null && now - burst.heldSince + 1e-9 >= hold) {
    burst.heldSince = null;
    burst.pausedAt = now;
  }
  if (burst.heldSince === null && start && now - burst.pausedAt + 1e-9 >= pause) burst.heldSince = now;
  return burst.heldSince !== null;
}

export const createLof = () => ({ clearSince: null, lastClear: -Infinity, passed: false });

// The line of fire's flag: true once the line has been clear for longer than the reaction with no break,
// and for the timeout after it is lost if that clear stretch had outlasted the reaction; a line that
// clears again waits the reaction again
export function lofStep(lof, ap, { clear, now }) {
  if (clear) {
    lof.clearSince ??= now;
    lof.lastClear = now;
    lof.passed = now - lof.clearSince > ap.lofReaction;
    return lof.passed;
  }
  lof.clearSince = null;
  return lof.passed && now - lof.lastClear < ap.lofTimeout;
}

// The tracker's own numbers: a target is kept this long before it is picked again (TargetMinSwitchTimeS,
// 2 s in a level; the settings' rows hold none) if its line was clear within the second; s.
export const TARGET = { minSwitch: 2, clearWithin: 10 };
// The strafe runs while the bot and its target each face the other inside this angle (the code's π / 4).
export const FACING = Math.PI / 4;
// A leg's crouch: its odds as a leg starts and how long it lasts (EvasiveManeuversCrouchProbability and
// …Duration as a level holds them; the settings' rows hold neither).
export const CROUCH = { probability: 0.25, duration: 4 };

export const createEvasion = () => ({ side: 0, until: -Infinity, barred: { '-1': -Infinity, 1: -Infinity }, roll: false, jump: false, fwd: 0, crouchSince: null });

// The strafe's side this step, as the game's step has it (bf2-re's decompile of FUN_145571ea0): two legs, one
// a side, each for a time drawn afresh between the two durations; when a leg's time is up the other starts,
// unless the other side is cooling, and then the leg goes on past its time. The ground to the leg's side is
// probed every step: a failed probe ends the leg at once and starts that side's cooldown. 0: both sides are
// cooling, and the bot does not strafe.
export function strafeSide(ev, ap, { now, rand = Math.random, ground = null }) {
  const cooling = (s) => now < ev.barred[s];
  const start = (s) => {
    ev.side = s;
    const [lo, hi] = ap.strafeInvert;
    ev.until = now + lo + rand() * Math.max(0, hi - lo);
    // (as each leg starts the game draws its jump and its dodge roll, FUN_14556df20: once a leg, at the settings' odds)
    ev.jump = rand() < ap.jump;
    ev.roll = rand() < ap.dodgeRoll;
    // (and its crouch, looked at only as a leg starts: begun at its odds, ended once it has lasted)
    if (ev.crouchSince === null) {
      if (rand() < CROUCH.probability) ev.crouchSince = now;
    } else if (now - ev.crouchSince >= CROUCH.duration) ev.crouchSince = null;
    // (and whether the leg also goes forward or back: a third each, a third neither, FUN_14556e140)
    const r = rand();
    ev.fwd = r < 0.33 ? 1 : r < 0.66 ? -1 : 0;
  };
  // (the leg to run: the first one, the other when this one's time is up, this one still while the other cools)
  if (ev.side === 0) start(1);
  else if (now >= ev.until && !cooling(-ev.side)) start(-ev.side);
  for (let tries = 0; tries < 2; tries++) {
    if (!cooling(ev.side) && (!ground || !ap.groundCheck.on || ground(ev.side))) return ev.side;
    if (!cooling(ev.side)) ev.barred[ev.side] = now + ap.groundCheck.cooldown;
    if (cooling(-ev.side)) break;
    start(-ev.side);
  }
  ev.side = 0;
  ev.roll = ev.jump = false;
  ev.fwd = 0;
  return 0;
}

// whether the leg is crouched
export const crouched = (ev) => ev.crouchSince !== null;

// the leg's dodge roll, handed over once (the leg that drew it opens with it)
export function takeRoll(ev) {
  const roll = ev.roll;
  ev.roll = false;
  return roll;
}

// The ground probe's rule (the same step): from the check's height above the feet, ground within the check's
// distance below that point. `dy`: the ground at the probed spot against the feet, m (up positive).
export const groundOk = (ap, dy) => dy <= ap.groundCheck.offset && dy >= ap.groundCheck.offset - ap.groundCheck.drop;

export const dodges = (ap, rand = Math.random) => rand() < ap.dodgeRoll;
