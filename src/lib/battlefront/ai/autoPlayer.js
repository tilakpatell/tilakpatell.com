// The AutoPlayer: the bot the game runs in Instant Action (Mode8), Co-op
// (Mode9), Supremacy (Mode1) and the server's fill (bf2-re findings 28 and
// 34), a player driven by an objective, aiming as a pad does. Its numbers are
// the server's settings (`gameSettings.json`, Online/GameSettingsContainer):
// a row's name is a base, then the difficulty, then the mode
// (`AP_LofReactionTimeS_Expert_Mode8`), and the most particular row the
// settings hold is the one in force, as the game's GameSettingsEntityData
// choices pick them at round start.
//
// The aim: a tracker that sees AP_TargetTrackerFieldOfViewDegrees (140°)
// wide, out to AP_MaxTargetEngagingDistanceScale (2.5) × the AI weapon's
// preferred range; the view turned onto the target led by AP_LofPredictionTime
// (0.15 s) over AP_AimLapTime (0.25 s); a noise on that view of the weapon's
// class (AP_BlasterAimNoise 1.5, AP_LmgAimNoise, AP_ShotgunAimNoise,
// AP_SniperRifleAimNoise, AP_LauncherAimNoise 0) × AP_AimNoiseScale (rookie
// 7, normal 3, expert 2 in Mode8) × the side's (AP_AimNoiseScale_Enemies_*
// for the bots facing a human, _Friendlies_ beside one). The trigger is held
// while the line of fire is clear, once it has been for AP_LofReactionTimeS
// (0.05 s), and for AP_LofTimeoutS (1.5 s) after it is lost, at where the
// target was; the gun's own rate, heat and spread do the rest (weapons.js).
// Its evasion while it fights, read from the game's own step (the decompile
// of FUN_145571ea0, NOTES.md): a strafe of two legs, each for a time drawn in
// AP_EvasiveManeuversInvertStrafeDuration (1.5 to 3.5 s); the ground
// AP_EvasiveManeuversGroundCheckDistanceM (2.5 m) to the leg's side probed
// every step from AP_…GroundCheckHeightOffsetM (1.5 m) above the feet down
// AP_…GroundCheckHeightDistanceM (3.5 m); a failed probe ends the leg and
// bars that side for AP_…GroundCheckCooldownS (3 s); both barred, no strafe.
// As each leg starts the game draws that leg's dodge roll
// (AP_EvasiveManeuversDodgeRollProbability, 0.2) and its jump (0 in these
// modes) (FUN_14556df20): `takeRoll` hands the roll over once. That the bot
// then rolls the way the leg goes is by hand: what reads the drawn flag was
// not read.
//
// Read by hand (src/data/bf2017/NOTES.md, "The AutoPlayers"): the noise's
// unit (degrees of the view) and its wander (a fresh offset each lap time,
// eased toward); the angle inside which it fires (AIM_GATE); the
// difficulty's names (the sim's rookie/normal/expert are the rows' own;
// Instant Action's screen Normal/Hard/Expert map in order onto them).
// Pure: no three.js, no DOM.
//
//   suffixOf(mode) → 'Mode8' | 'Mode1' | 'Mode9'      rowOf(difficulty) → 'Rookie' | 'Normal' | 'Expert'
//   setting(gs, base, { mode, difficulty, side }) → { value, name } | null
//   autoPlayerFor(gs, { mode, difficulty, side }) → ap (every number above, with `sources`)
//   noiseOf(ap, family) → degrees       weaponClass(family, weaponId) → 'blaster' | 'lmg' | 'shotgun' | 'sniper' | 'launcher'
//   createAim() → aim      aimStep(aim, ap, { from, at, vel, noise, dt, rand }) → { point, error }  (error: degrees off the led target)
//   createLof() → lof      lofStep(lof, ap, { clear, now }) → fire?
//   createEvasion() → ev   strafeSide(ev, ap, { now, rand, ground(side) }) → -1 | 1 | 0 (no strafe)
//   groundOk(ap, dy) → bool (the probe's rule for ground dy m above the feet)      takeRoll(ev) → bool (the leg's dodge roll, once)
//   dodges(ap, rand) → bool

// The site's modes → the settings' suffix: Instant Action's rows for its own and the modes it plays on
// the multiplayer maps, Supremacy's (Mode1) for Supremacy, Co-op's (Mode9) for Co-op.
export const SUFFIX = { supremacy: 'Mode1', coop: 'Mode9', ModeDefend: 'Mode9' };
export const suffixOf = (mode) => SUFFIX[mode] ?? 'Mode8';
const ROWS = { rookie: 'Rookie', easy: 'Rookie', normal: 'Normal', medium: 'Normal', default: 'Normal', expert: 'Expert' };
export const rowOf = (difficulty) => (difficulty ? (ROWS[String(difficulty).toLowerCase().split(':').pop()] ?? 'Normal') : 'Normal');
// The view's error under which it presses the trigger, degrees (BattleAI's AimingAtAngleThreshold, by hand for the AutoPlayer).
export const AIM_GATE = 5;

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
  if (/launch|rocket|smartrocket/.test(id)) return 'launcher';
  if (/shotgun|scatter|blurrg|dh17|ee3|blastcannon/.test(id) && family !== 'rifle') return 'shotgun';
  if (family === 'heavy') return 'lmg';
  if (family === 'sniper') return 'sniper';
  return 'blaster';
}

// degrees of noise on a bot's view with this weapon class
export const noiseOf = (ap, cls) => (ap.noise[cls] ?? ap.noise.blaster) * ap.noiseScale * ap.sideScale;

const RAD = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const createAim = () => ({ yaw: null, pitch: 0, off: [0, 0], to: [0, 0], next: -Infinity, t: 0 });

// a step of the tracker: the view eased onto the led target with the noise's offset; the point the gun is aimed at
export function aimStep(aim, ap, { from, at, vel = [0, 0, 0], noise = 0, dt = 0.05, rand = Math.random }) {
  aim.t += dt;
  const led = [at[0] + vel[0] * ap.lead, at[1] + (vel[1] ?? 0) * ap.lead, at[2] + vel[2] * ap.lead];
  const dx = led[0] - from[0];
  const dy = led[1] - from[1];
  const dz = led[2] - from[2];
  const flat = Math.hypot(dx, dz) || 1e-6;
  const dist = Math.hypot(flat, dy);
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, flat);
  // (a fresh offset in the noise's disc each lap, eased toward over the next)
  if (aim.t >= aim.next) {
    const r = Math.sqrt(rand()) * noise * RAD;
    const a = rand() * Math.PI * 2;
    aim.to = [Math.cos(a) * r, Math.sin(a) * r];
    aim.next = aim.t + ap.aimLap;
  }
  const k = 1 - Math.exp(-dt / Math.max(1e-3, ap.aimLap));
  aim.off = [aim.off[0] + (aim.to[0] - aim.off[0]) * k, aim.off[1] + (aim.to[1] - aim.off[1]) * k];
  if (aim.yaw === null) {
    aim.yaw = yaw;
    aim.pitch = pitch;
  }
  aim.yaw = wrap(aim.yaw + wrap(yaw + aim.off[0] - aim.yaw) * k);
  aim.pitch += (pitch + aim.off[1] - aim.pitch) * k;
  const c = Math.cos(aim.pitch);
  const point = [from[0] + Math.sin(aim.yaw) * c * dist, from[1] + Math.sin(aim.pitch) * dist, from[2] + Math.cos(aim.yaw) * c * dist];
  const error = Math.hypot(wrap(aim.yaw - yaw), aim.pitch - pitch) / RAD;
  return { point, error, dist };
}

export const createLof = () => ({ clearSince: null, lostAt: -Infinity });

// the line of fire's trigger: held once clear for the reaction, and for the timeout after it is lost
export function lofStep(lof, ap, { clear, now }) {
  if (clear) {
    lof.clearSince ??= now;
    lof.lostAt = now;
    return now - lof.clearSince + 1e-9 >= ap.lofReaction;
  }
  lof.clearSince = null;
  return now - lof.lostAt <= ap.lofTimeout;
}

export const createEvasion = () => ({ side: 0, until: -Infinity, barred: { '-1': -Infinity, 1: -Infinity }, roll: false, jump: false });

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
  return 0;
}

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
