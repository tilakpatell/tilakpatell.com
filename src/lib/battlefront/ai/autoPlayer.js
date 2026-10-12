// An AutoPlayer's mind (bf2-re finding 28): the bot the game runs on a
// Galactic Assault map (Instant Action, Co-op, Supremacy, the server fill)
// is a player with a kit, driven by objectives, not a BattleAI soldier with
// tactics and cover queries. It goes where its objective is (the commander's
// task: the stage's objectives, else its squad's leader, else the team's
// objective) and shoots what its tracker holds on the way: a target inside
// `AP_TargetTrackerFieldOfViewDegrees` (140°), the line of fire checked and
// the trigger pulled `AP_LofReactionTimeS` (0.05 s; rookie 0.1, expert
// 0.025) after it clears, kept `AP_LofTimeoutS` (1.5 s) after it closes;
// the aim is the target `AP_LofPredictionTime` (0.15 s) ahead plus a noise
// re-drawn each `AP_AimLapTime` (0.25 s): the weapon class's noise
// (`AP_BlasterAimNoise` 1.5, the LMG's 1.5, the sniper's 1) × the
// difficulty's `AP_AimNoiseScale` (2; rookie 7, normal 3, expert 2) × the
// side's factor (enemies 1.2 / 1 / 0.9) — read as degrees of aim error, by
// hand (the record's unit is the stick's). No cover, no hiding, no
// suppression. In a fight it strafes, the side inverted every
// `AP_EvasiveManeuversInvertStrafeDuration` 1.5–3.5 s, and dodge-rolls a
// hit taken with `AP_EvasiveManeuversDodgeRollProbability` (0.2). The
// site's A* and the brain's path-following are kept (soldierBrain.js's
// navigate). Pure.
//
//   createAutoBrain(s, { ap, rand, difficulty, side, mode }) → brain   (mode: 'instantAction' | 'coop' | 'supremacy')
//   think(brain, world, now) → intent { mode, target, goal, stance, fire, aim, sprint, interact, roll }
//   act(brain, intent, s, dt, world, now)
//   noiseFor(ap, { family, difficulty, side, mode }) → degrees     reactionFor(ap, difficulty) → seconds
//   world: soldierBrain.js's (nav, lineClear, squad, leaderAt, objective, task, enemies, others, muzzle, shoot, who)

import { createSenses } from '../../ai/perception.js';
import { nearestWalkable } from '../nav.js';
import { chestOf, move, roll } from '../soldier.js';
import { INTERACT_CLEAR, SIGHT, TASK_SLACK, navigate } from './soldierBrain.js';

const DEG = Math.PI / 180;
// A weapon family → the server's noise row for its class.
export const NOISE_CLASS = { rifle: 'blaster', pistol: 'blaster', hero: 'blaster', special: 'blaster', heavy: 'lmg', sniper: 'sniperRifle', longRange: 'sniperRifle', shortRange: 'shotgun', launcher: 'launcher' };
// How far a bot steps aside in a fight, by hand (the autoplayer's strafe is a stick input).
export const STRAFE = 4;
// The objective's radius a bot holds inside when its task gives none: `AutoPlayerDefendObjectiveEntityData.DefendAreaRadius`.
export const DEFEND_RADIUS = 10;
// Following the squad's leader: `AutoPlayerFollowObjectiveEntityData.FollowPositionRadius`.
export const FOLLOW_RADIUS = 5;
const NEAR_GOAL = 0.8;

// the difficulty row's key for the server's per-difficulty settings
const levelOf = (difficulty) => {
  const name = String(difficulty?.key ?? difficulty ?? '')
    .split(':')
    .pop()
    .toLowerCase();
  return name === 'medium' ? 'normal' : ['rookie', 'normal', 'expert'].includes(name) ? name : null;
};

export function noiseFor(ap, { family = 'rifle', difficulty = null, side = 'enemies', mode = 'instantAction' } = {}) {
  const level = levelOf(difficulty);
  const cls = NOISE_CLASS[family] ?? 'blaster';
  const weapon = ap.aim.noise[cls]?.[mode] ?? ap.aim.noise[cls]?.instantAction ?? ap.aim.noise.blaster.instantAction;
  const scale = level ? ap.aim.scale[level] : (ap.aim.scale[mode] ?? ap.aim.scale.instantAction);
  const factor = level ? (ap.aim[side]?.[level] ?? 1) : 1;
  return weapon * scale * factor;
}

export const reactionFor = (ap, difficulty = null) => {
  const level = levelOf(difficulty);
  return (level && ap.lof.reaction[level]) ?? ap.lof.reaction.default;
};

export function createAutoBrain(s, { ap, rand = Math.random, difficulty = null, side = 'enemies', mode = 'instantAction' }) {
  const family = s.weapon?.family ?? 'rifle';
  return {
    model: 'autoPlayer',
    s,
    ap,
    rand,
    difficulty,
    noise: noiseFor(ap, { family, difficulty, side, mode }),
    reaction: reactionFor(ap, difficulty),
    dodge: (difficulty && ap.evasive.dodgeRoll[levelOf(difficulty)]) ?? ap.evasive.dodgeRoll[mode] ?? ap.evasive.dodgeRoll.instantAction,
    strafeWindow: [ap.evasive.invertStrafeMin[mode] ?? ap.evasive.invertStrafeMin.instantAction, ap.evasive.invertStrafeMax[mode] ?? ap.evasive.invertStrafeMax.instantAction],
    // (the tracker's field of view: the cosine of half of it)
    senses: createSenses({ sight: { range: SIGHT, cone: Math.cos((ap.tracker.fov / 2) * DEG), far: 1 }, hearing: { range: 0 }, memory: ap.lof.timeout, intuition: 2.5 }),
    me: { pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 1 }, beliefs: {} },
    tactics: {},
    target: null,
    targetSince: 0,
    assigned: null,
    task: null,
    cover: null,
    intent: { mode: 'objective', target: null, goal: null, stance: 'stand', fire: false, aim: null },
    lofSince: null,
    lofLost: null,
    noiseAt: -Infinity,
    offset: [0, 0],
    strafe: 1,
    strafeAt: 0,
    hurtSeen: -Infinity,
    wander: null,
    path: null,
    pathGoal: null,
    pathAt: -Infinity,
    wp: 1,
    stuck: 0,
    alerted: new Set(),
  };
}

const flat = (p) => [p[0], p[2]];
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// the tracker's pick: the nearest target in sight, else the nearest one lost within the timeout
function track(brain, now) {
  const beliefs = Object.values(brain.me.beliefs ?? {}).filter((b) => b.hostile && b.confidence > 0);
  const me = brain.s.at;
  const dist = (b) => Math.hypot(b.at.x - me[0], b.at.z - me[2]);
  const held = brain.target ? beliefs.find((b) => b.id === brain.target) : null;
  if (held?.visible) return held;
  const seen = beliefs.filter((b) => b.visible).sort((a, b) => dist(a) - dist(b));
  if (seen[0]) return seen[0];
  // (a target out of sight is kept for the line-of-fire timeout, then dropped)
  if (held && brain.lofLost != null && now - brain.lofLost <= brain.ap.lof.timeout) return held;
  return null;
}

// the aim: the target a prediction time ahead, with the lap's noise in yaw and pitch
function aimAt(brain, from, b, now) {
  const ap = brain.ap;
  const p = [b.at.x + (b.vel?.x ?? 0) * ap.lof.prediction, b.at.y, b.at.z + (b.vel?.z ?? 0) * ap.lof.prediction];
  if (now - brain.noiseAt >= ap.aim.lap - 1e-9) {
    brain.offset = [(brain.rand() * 2 - 1) * brain.noise * DEG, (brain.rand() * 2 - 1) * brain.noise * DEG];
    brain.noiseAt = now;
  }
  const dx = p[0] - from[0];
  const dy = p[1] - from[1];
  const dz = p[2] - from[2];
  const flatD = Math.hypot(dx, dz) || 1e-6;
  const yaw = Math.atan2(dx, dz) + brain.offset[0];
  const pitch = Math.atan2(dy, flatD) + brain.offset[1];
  const L = Math.hypot(dx, dy, dz);
  return [from[0] + Math.sin(yaw) * Math.cos(pitch) * L, from[1] + Math.sin(pitch) * L, from[2] + Math.cos(yaw) * Math.cos(pitch) * L];
}

export function think(brain, world, now) {
  const s = brain.s;
  const me = flat(s.at);
  const b = track(brain, now);
  if ((b?.id ?? null) !== brain.target) {
    brain.target = b?.id ?? null;
    brain.targetSince = now;
    brain.lofSince = null;
    brain.lofLost = null;
  }
  const tgt = b ? [b.at.x, b.at.z] : null;
  const dist = tgt ? d2(me, tgt) : Infinity;
  const task = world.task ?? null;
  const fromTask = task ? d2(me, task.at) : Infinity;
  const intent = { mode: 'objective', target: b?.id ?? null, goal: null, stance: 'stand', fire: false, aim: null, sprint: false, interact: false, roll: null };
  const range = s.weapon?.range ?? 200;
  if (b) {
    const from = world.muzzle ? world.muzzle(s) : chestOf(s);
    intent.aim = aimAt(brain, from, b, now);
    const lof = b.visible && dist <= range && world.lineClear(from, [b.at.x, b.at.y, b.at.z]);
    if (lof) {
      brain.lofSince ??= now;
      brain.lofLost = null;
    } else {
      brain.lofLost ??= now;
      brain.lofSince = null;
    }
    // the trigger: the reaction after the line clears, held through the timeout after it closes
    intent.fire = (lof && now - brain.lofSince >= brain.reaction - 1e-9) || (!lof && brain.lofLost != null && now - brain.lofLost < brain.ap.lof.timeout && b.visible);
    intent.mode = 'attack';
  }
  // a hit taken: the dodge roll's chance, away from the shooter
  if (s.lastHurt > brain.hurtSeen) {
    brain.hurtSeen = s.lastHurt;
    if (s.state !== 'roll' && brain.rand() < brain.dodge) {
      const away = tgt ? [me[0] - tgt[0], me[1] - tgt[1]] : [Math.sin(s.yaw + Math.PI / 2), Math.cos(s.yaw + Math.PI / 2)];
      intent.roll = away;
    }
  }
  const away = !!task && fromTask > (task.radius ?? 0) + TASK_SLACK;
  if (task?.interact && fromTask <= (task.reach ?? 3) && dist > INTERACT_CLEAR) {
    intent.mode = 'interact';
    intent.goal = task.spot ?? task.at;
    intent.interact = true;
    intent.fire = false;
  } else if (task && (away || !b)) {
    // the objective: there, then about it inside its radius
    const radius = task.interact || !task.radius ? 0 : task.radius;
    if (!radius) intent.goal = task.spot ?? task.at;
    else {
      if (!brain.wander || brain.wanderFor !== task || d2(me, brain.wander) < 2 || d2(brain.wander, task.at) > radius + 1) {
        const a = brain.rand() * Math.PI * 2;
        const r = brain.rand() * radius;
        brain.wander = (world.nav && nearestWalkable(world.nav, task.at[0] + Math.cos(a) * r, task.at[1] + Math.sin(a) * r, 6)) ?? task.spot ?? task.at;
        brain.wanderFor = task;
      }
      intent.goal = brain.wander;
    }
    intent.sprint = away && fromTask > (task.radius ?? 0) + TASK_SLACK + 20 && !intent.fire;
  } else if (b) {
    // in the fight: step aside across the line of fire, the side inverted every strafe window
    if (now >= brain.strafeAt) {
      brain.strafe = brain.rand() < 0.5 ? -1 : 1;
      brain.strafeAt = now + brain.strafeWindow[0] + brain.rand() * (brain.strafeWindow[1] - brain.strafeWindow[0]);
    }
    const ax = tgt[0] - me[0];
    const az = tgt[1] - me[1];
    const L = Math.hypot(ax, az) || 1;
    intent.goal = [me[0] + (az / L) * STRAFE * brain.strafe, me[1] - (ax / L) * STRAFE * brain.strafe];
  } else {
    const lead_ = world.squad?.leader;
    if (lead_ && lead_ !== s.id && world.leaderAt && d2(me, world.leaderAt) > FOLLOW_RADIUS) intent.goal = world.leaderAt;
    else if (world.objective) {
      if (!brain.wander || brain.wanderFor !== world.objective || d2(me, brain.wander) < 3) {
        const base = d2(me, world.objective) > DEFEND_RADIUS ? world.objective : me;
        const a = brain.rand() * Math.PI * 2;
        const r = brain.rand() * DEFEND_RADIUS;
        brain.wander = (world.nav && nearestWalkable(world.nav, base[0] + Math.cos(a) * r, base[1] + Math.sin(a) * r, 8)) ?? world.objective;
        brain.wanderFor = world.objective;
      }
      intent.goal = brain.wander;
      intent.sprint = d2(me, world.objective) > DEFEND_RADIUS + TASK_SLACK + 20;
    }
  }
  brain.intent = intent;
  return intent;
}

export function act(brain, intent, s, dt, world, now) {
  if (!s.alive) return;
  if (intent.roll && s.state !== 'roll') {
    roll(s, intent.roll, now);
    intent.roll = null;
  }
  s.sprint = !!intent.sprint;
  s.stance = 'stand';
  if (s.state === 'roll') move(s, s.rollDir, dt, world.nav);
  else navigate(brain, world, s, intent.goal, dt, now);
  const look = intent.aim ?? (s.moving ? [s.at[0] + s.vel[0], 0, s.at[2] + s.vel[2]] : null);
  if (look) s.yaw = Math.atan2(look[0] - s.at[0], look[2] - s.at[2]);
  s.aim = intent.aim;
  s.interact = !!intent.interact && !!intent.goal && d2(flat(s.at), intent.goal) < NEAR_GOAL + 2;
  if (intent.fire && intent.aim) world.shoot(s, intent.aim);
}
