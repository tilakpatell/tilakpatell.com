// What a soldier's body plays, from what the sim says of it: a state from
// the entity (its state, stance, speed, aim, the way it moves against the
// way it faces), the game's clips for that state by family, and how to get
// there from the last. Pure.
//
// The families are the export's own names (web/anims.jsonl, read
// 2026-10-10): the rifle soldier's C_HM_Rifle_* locomotion, its P_HM_Rifle_*
// poses, its A_HM_Rifle_Dodge_* rolls, the A_HM_Death_Stand_* deaths by
// side, the one T_HM_Rifle_RunToStand transition. A state whose family the
// body has no clip for takes the next in FALLBACK_CHAIN, down to the idle,
// so a figure never stands in its bind pose (walrusRig.js's CLIP_FALLBACK
// does the same for the pack's site names).
//
// The game's clips carry root motion (AITrajectory); the sim moves the body,
// so the pack strips it (scripts/bf2017-clips.mjs keeps the hips in place).
//
//   FAMILIES, FALLBACK_CHAIN, CROSSFADE
//   resolveFamilies(names) → { [state]: clipName[] }
//   stateFor(entity) → { state, speed, dir8, side? }
//   transition(from, to, names) → { clip | null, fade }
//   deathFor(families, { yaw, hitDir }) → clipName
//   packClip(state, { stance }) → the humanoid pack's clip name (walrusClips.js's HUMANOID_SET),
//     or with a held weapon's stance ('t', 'p', 'l') its pack's `stance.<key>.<name>`
//     where the stance has one (walrusSets/stance.js's names)
//   packFallback(name) → a stance clip's humanoid stand-in (the idle a held pose), else null
//   LOCO_STATES, RATE_MIN, RATE_MAX
//   clipSpeed(clip) → m/s the clip's root travels (its `root`), or null
//   rateFor(state, speed, pace) → the timeScale that puts a walking clip's feet on the ground

export const CROSSFADE = 0.15; // s: the blend where the game has no transition clip
// (the humanoid pack's own paces, its clips' root travel over their length,
// read from clips-humanoid.glb 2026-10-11: walk 1.91 m/s, run 3.94, sprint
// 5.90, crouch.run 2.54, the strafes 1.6 to 2.0; so the sim's 3.8 plays the
// run near its pace, 5.97 the sprint and the crouch's 2.5 its run, and these
// two fall near the paces' midpoints, where neither clip is pushed out of
// rateFor's band)
export const WALK_MAX = 2.6; // m/s: under this a soldier walks (the soldier row's walk is 3.8 at full stick)
export const RUN_MAX = 4.6; // m/s: over this they sprint (the row's sprint is 5.97)

export const FAMILIES = {
  idle: [/^P_HM_Rifle_StandIdle/, /^AI_Rifleman_Trooper_Patrol_Twitch/],
  walk: [/^C_HM_Rifle_Walk_Fwd/],
  walkBack: [/^C_HM_Rifle_Walk_Bwd/],
  walkLeft: [/^C_HM_Rifle_Walk_Left1/],
  walkRight: [/^C_HM_Rifle_Walk_Right1/],
  run: [/^C_HM_Rifle_Run_Fwd/],
  runBack: [/^C_HM_Rifle_Run_Bwd/],
  runLeft: [/^C_HM_Rifle_Run_Left1/],
  runRight: [/^C_HM_Rifle_Run_Right1/],
  sprint: [/^C_HM_Rifle_Sprint_Fwd_\d/],
  crouchIdle: [/^C_HM_Rifle_Crouch_ZeroSpeed/],
  crouchWalk: [/^C_HM_Rifle_Crouch_Run_Fwd/],
  aim: [/^P_HM_Rifle_StandZoom/, /^P_HM_Rifle_StandIdle/],
  roll: [/^A_HM_Rifle_Dodge_Front/],
  vault: [/^AI_VaultOverHigh/],
  coverLeft: [/^Cover_Left_Stand_Flanked_Idle/],
  coverRight: [/^Cover_Right_Stand_Flanked_Idle/],
  hit: [/^Stand_Combat_Flinch/, /^A_HM_Rifle_Stagger/],
  deathFront: [/^A_HM_Death_Stand_Front_Upperbody_BlasterFire/, /^A_HM_Death_Stand_Front/],
  deathBack: [/^A_HM_Death_Stand_Back_Upperbody_BlasterFire/, /^A_HM_Death_Stand_Back/],
  deathLeft: [/^A_HM_Death_Stand_Left/],
  deathRight: [/^A_HM_Death_Stand_Right/],
  patrol: [/^AI_Rifleman_Trooper_Patrol_Twitch/],
};

export const FALLBACK_CHAIN = {
  sprint: 'run',
  run: 'walk',
  runBack: 'walkBack',
  runLeft: 'walkLeft',
  runRight: 'walkRight',
  walkBack: 'walk',
  walkLeft: 'walk',
  walkRight: 'walk',
  walk: 'idle',
  crouchWalk: 'crouchIdle',
  crouchIdle: 'idle',
  aim: 'idle',
  roll: 'run',
  vault: 'run',
  coverLeft: 'crouchIdle',
  coverRight: 'crouchIdle',
  hit: 'idle',
  deathLeft: 'deathFront',
  deathRight: 'deathFront',
  deathBack: 'deathFront',
  deathFront: 'idle',
  patrol: 'idle',
};

export function resolveFamilies(names) {
  const own = {};
  for (const [state, pats] of Object.entries(FAMILIES)) {
    const hit = [];
    for (const re of pats) {
      for (const n of names) if (re.test(n) && !hit.includes(n)) hit.push(n);
      if (hit.length) break;
    }
    own[state] = hit;
  }
  const out = {};
  for (const state of Object.keys(FAMILIES)) {
    let s = state;
    const seen = new Set();
    while (!own[s]?.length && FALLBACK_CHAIN[s] && !seen.has(s)) {
      seen.add(s);
      s = FALLBACK_CHAIN[s];
    }
    out[state] = own[s] ?? [];
  }
  return out;
}

// the way a body moves against the way it faces, in eighths clockwise from
// ahead (0 ahead, 2 right, 4 back, 6 left); facing yaw 0 is +Z
export function dir8Of(yaw, vel) {
  const [vx, vz] = vel;
  if (Math.hypot(vx, vz) < 1e-6) return 0;
  const move = Math.atan2(vx, vz);
  let rel = yaw - move; // (clockwise from the facing, seen from above)
  rel = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.round(rel / (Math.PI / 4)) % 8;
}

// which side a hit came from, against the facing: the bolt's travel
const sideOf = (yaw, hitDir) => {
  if (!hitDir) return 'front';
  const d = dir8Of(yaw, [-hitDir[0], -hitDir[2]]);
  return d === 0 || d === 1 || d === 7 ? 'front' : d >= 3 && d <= 5 ? 'back' : d === 2 ? 'right' : 'left';
};

export function stateFor(e) {
  const vel = e.vel ?? [0, 0];
  const speed = Math.hypot(vel[0], vel[1]);
  const dir8 = dir8Of(e.yaw ?? 0, vel);
  if (e.state === 'down' || e.state === 'dying') return { state: 'death', speed: 0, dir8, side: sideOf(e.yaw ?? 0, e.hitDir) };
  if (e.rolling || e.state === 'roll') return { state: 'roll', speed, dir8 };
  if (e.hitAt != null && e.hitAt > 0) return { state: 'hit', speed, dir8 };
  const moving = e.moving ?? speed > 0.2;
  if (e.stance === 'crouch') return { state: moving ? 'crouchWalk' : 'crouchIdle', speed, dir8 };
  if (e.aim) return { state: 'aim', speed: moving ? speed : 0, dir8 };
  if (!moving) return { state: 'idle', speed: 0, dir8 };
  return { state: speed > RUN_MAX ? 'sprint' : speed > WALK_MAX ? 'run' : 'walk', speed, dir8 };
}

const TRANSITION = { run: 'Run', sprint: 'Run', walk: 'Walk', idle: 'Stand', aim: 'Stand', crouchIdle: 'Crouch', crouchWalk: 'Crouch' };

export function transition(from, to, names = []) {
  const a = TRANSITION[from];
  const b = TRANSITION[to];
  if (a && b && a !== b) {
    const re = new RegExp(`^T_HM_Rifle_${a}To${b}_Fwd`);
    const clip = names.find((n) => re.test(n));
    if (clip) return { clip, fade: CROSSFADE };
  }
  return { clip: null, fade: CROSSFADE };
}

export function deathFor(families, { yaw = 0, hitDir = null } = {}) {
  const side = sideOf(yaw, hitDir);
  const key = { front: 'deathFront', back: 'deathBack', left: 'deathLeft', right: 'deathRight' }[side];
  return (families[key] ?? families.deathFront ?? [])[0] ?? null;
}

// The humanoid pack's names (phase 1 and 2's clips-humanoid.glb, the game's
// clips stored under the site's names): a strafe by its eighth
const STRAFE = ['walk', 'walk', 'walk.right', 'walk.back', 'walk.back', 'walk.back', 'walk.left', 'walk'];
// the names a stance pack stands in for (walrusSets/stance.js's NAMES, the
// ones a soldier here plays); a death, a hit or a roll is the humanoid's
const STANCED = new Set(['idle', 'aim', 'walk', 'run', 'sprint', 'walk.back', 'walk.left', 'walk.right', 'crouch', 'crouch.run']);
export function packClip(s, { stance = null } = {}) {
  if (!stance) return humanoidClip(s);
  const base = s.state === 'idle' ? 'idle' : s.state === 'aim' && !(s.speed > 0.2) ? 'aim' : humanoidClip(s);
  return STANCED.has(base) ? `stance.${stance}.${base}` : base;
}

// (Luke's unarmed idle would hang the gun barrel-down: a held pose instead)
export function packFallback(name) {
  const m = /^stance\.([a-z])\.(.+)$/.exec(name);
  if (!m) return null;
  const [, key, base] = m;
  if (base === 'idle' || base === 'aim') return key === 'p' ? 'aim.pistol' : 'aim.rifle';
  return base;
}

function humanoidClip(s) {
  switch (s.state) {
    case 'death':
      return s.side === 'back' ? 'die.back' : 'die.fwd';
    case 'roll':
      return 'dodge.front';
    case 'hit':
      return 'hit.chest';
    case 'crouchIdle':
      return 'crouch';
    case 'crouchWalk':
      return 'crouch.run';
    case 'aim':
      return s.speed > 0.2 ? STRAFE[s.dir8] : 'aim.rifle';
    case 'idle':
      return 'idle';
    case 'sprint':
      return s.dir8 === 0 ? 'sprint' : STRAFE[s.dir8];
    case 'run':
      return s.dir8 === 0 ? 'run' : STRAFE[s.dir8];
    default:
      return STRAFE[s.dir8] ?? 'walk';
  }
}

// The states whose clips walk. The pack's clips play in place (the sim moves
// the body), so one played at its own pace over a body moved at another
// slides its feet: these play at the body's speed over the clip's. The rest
// (the idle, the aim standing, a death, a hit, the roll, the crouch) are not
// steps over the ground and keep their own.
export const LOCO_STATES = new Set(['walk', 'run', 'sprint', 'crouchWalk', 'aim']);
// By hand: past half or 1.8 times its pace a stride reads as slow motion or
// a scurry whatever the feet do, so a speed out there slides a little instead
// (a strafe at the full 3.8 asks 1.9 of walk.left, 2.35 of walk.back)
export const RATE_MIN = 0.5;
export const RATE_MAX = 1.8;

// metres a second the clip's root goes: its last row's distance from the
// start over that row's time (the clip's length where the row has none); null
// for a clip with no root, or one that ends where it began (the pack keeps a
// root only past a centimetre: scripts/bf2017-clips.mjs)
export function clipSpeed(clip) {
  const root = clip?.userData?.root;
  if (!root?.length) return null;
  const [t, dx, dz] = root[root.length - 1];
  const time = t > 0 ? t : clip.duration;
  const dist = Math.hypot(dx, dz);
  if (!(time > 0) || !(dist > 0.01)) return null;
  return dist / time;
}

// (the aim walks only on the move, as packClip strafes it; a body the view
// gives no speed, or a clip with no pace of its own, plays as it was made)
export function rateFor(state, speed, pace) {
  if (!LOCO_STATES.has(state) || !(speed > 0.2) || !(pace > 0)) return 1;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, speed / pace));
}
