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
//   packClip(state) → the humanoid pack's clip name (walrusClips.js's HUMANOID_SET)

export const CROSSFADE = 0.15; // s: the blend where the game has no transition clip
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
export function packClip(s) {
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
