// A soldier bot's brain (spec catalogue 7): a utility pick (`lib/ai/utility`)
// over the game's tactics branches, parameterised by the bot's template and
// tactics rows from ai.json: flee when the squad breaks, hide when
// suppressed or hurt, close combat inside the tactics' close distance,
// attack inside the engage distance (from a cover slot the attack query
// scores, else in the open, strafing), advance on a target past it, and
// otherwise follow the squad's leader to the objective. Fire comes in the
// game's bit patterns (`AIFiringPatterns`, a frame a sim step) and only
// with a clear line to the target's chest; aim errs inside the AI weapon's
// accuracy box (`AimBox*`), which shrinks the longer a bot holds a target.
// A commander's task (`world.task`: a point, a radius, whether to interact)
// turns following into going to the objective and staying on it, firing
// on the way, and holding the interaction there when no enemy is close.
//
//   createBrain(s, { ai, role, rand, aimScale }) → brain   (aimScale widens the aim box: a mode's lethality lever)
//   think(brain, world, now) → intent { mode, target, goal, stance, fire, aim }
//   act(brain, intent, s, dt, world, now)        patternStep(brain) → fire this frame?
//   world: { nav, lineClear(a, b), squad: { centre, leader, posture } | null, objective, task, enemies, others, shoot(s, aim) }
//   task: { at: [x, z], spot: [x, z], radius, interact, reach, role }

import { pick } from '../../ai/utility.js';
import { createSenses, target as believed } from '../../ai/perception.js';
import { lead } from '../../combat/aim.js';
import { findPath, walkable, cellAt, nearestWalkable } from '../nav.js';
import { chestOf, move } from '../soldier.js';
import { clock, profile } from '../core.js';
import { pickCover, queryFor } from './cover.js';

// The class a soldier plays → the game's AI template for it.
export const ROLES = { assault: 'rifleman', heavy: 'heavy', officer: 'officer', specialist: 'sniper' };
// A weapon family → the AI weapon row (aim box, preferred range) and the firing patterns' weapon.
export const AI_WEAPONS = { rifle: 'AI_Rifle', heavy: 'AI_Heavy', pistol: 'AI_Pistol_Officer', sniper: 'AI_Sniper', hero: 'AI_Rifle', special: 'AI_Rifle' };
export const PATTERN_WEAPONS = { rifle: 'AssaultRifle', heavy: 'MachineGun', pistol: 'Pistol', sniper: 'SniperRifle', hero: 'AssaultRifle', special: 'AssaultRifle' };

// Knobs the data does not hold, each the game's by observation:
export const SIGHT = 100; // metres a bot sees (the templates' sensing areas are single-player only)
export const CONE = 0.25; // the cosine of a bot's half view angle (about 75° either side)
export const HEARING = 40; // metres a shot is heard
export const AIM_SETTLE = 2; // seconds on one target for the aim box to shrink from its max to its min
export const REPLAN = 1.5; // seconds a path is kept before it is planned again
export const HIDE_HEALTH = 0.4; // the share of health under which a bot hides
export const SUPPRESSED = 1; // the suppression a bot hides at (near misses fill it by the shooter's SuppressionValue)
export const STRAFE = 4; // metres a bot attacking in the open steps aside
export const WANDER = 30; // metres round the objective a bot with nothing to do searches
const NEAR_GOAL = 0.8;
// A bot with a task this far outside its radius goes there rather than
// fight, unless the enemy is inside FIGHT_AWAY; it interacts only with no
// enemy believed inside INTERACT_CLEAR (the commander's rule). By hand.
export const TASK_SLACK = 10;
export const FIGHT_AWAY = 20;
export const INTERACT_CLEAR = 10;
// A goal further than this is walked to by legs of LEG metres, each its own
// search, so a long walk across a Galactic Assault map never floods A*. By hand.
export const FAR = 80;
export const LEG = 40;
// The cells one of those searches may open before it gives up, by hand.
export const SEARCH_CELLS = 6000;
// A waypoint cell a bot has failed to step into (open on the grid, too
// narrow for its body) is left out of its paths this long, by hand.
export const AVOID = 10;

export function createBrain(s, { ai, role = ROLES[s.cls?.cls] ?? 'rifleman', rand = Math.random, aimScale = 1 }) {
  const template = ai.templates[role] ?? ai.templates.rifleman;
  const tactics = ai.tactics[template.tactics] ?? ai.tactics.Rifleman_Tactics;
  const family = s.weapon?.family ?? 'rifle';
  const aiWeapon = ai.weapons[AI_WEAPONS[family] ?? 'AI_Rifle'];
  const patterns = ai.patterns.filter((p) => p.weapon === (PATTERN_WEAPONS[family] ?? 'AssaultRifle'));
  return {
    s,
    role,
    aimScale,
    template,
    tactics,
    aiWeapon,
    patterns: patterns.length ? patterns : ai.patterns,
    queries: { attack: queryFor(ai, 'attack'), hide: queryFor(ai, 'hide'), flee: queryFor(ai, 'flee'), protective: queryFor(ai, 'protective') },
    rand,
    senses: createSenses({ sight: { range: SIGHT, cone: CONE, far: 1 }, hearing: { range: HEARING }, memory: template.targetLostTime, intuition: 2.5 }),
    me: { pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 1 }, beliefs: {} },
    intent: { mode: 'follow', target: null, goal: null, stance: 'stand', fire: false, aim: null },
    current: null,
    pattern: null,
    frame: 0,
    cover: null,
    coverSince: 0,
    coverStay: 0,
    strafe: 1,
    strafeAt: 0,
    path: null,
    pathGoal: null,
    pathAt: -Infinity,
    wp: 1,
    stuck: 0,
    wander: null,
    aimTarget: null,
    aimSince: 0,
    alerted: new Set(),
  };
}

const flat = (p) => [p[0], p[2]];
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const v3 = (b) => [b.at.x, b.at.y, b.at.z];

// the firing pattern's next frame: its bits, then its delay of frames with none
export function patternStep(brain) {
  if (!brain.pattern) brain.pattern = brain.patterns[Math.floor(brain.rand() * brain.patterns.length)];
  const p = brain.pattern;
  const f = brain.frame;
  brain.frame = (f + 1) % (p.bits.length + (p.delay ?? 0));
  if (brain.frame === 0) brain.pattern = brain.patterns[Math.floor(brain.rand() * brain.patterns.length)];
  return f < p.bits.length && p.bits[f];
}

// the pattern's intensity by range (the patterns' own names), chosen when an attack starts
function choosePattern(brain, dist) {
  const want = dist < 15 ? 'High' : dist < 35 ? 'Medium' : 'Low';
  const list = brain.patterns.filter((p) => p.intensity === want);
  const from = list.length ? list : brain.patterns;
  brain.pattern = from[Math.floor(brain.rand() * from.length)];
  brain.frame = 0;
}

// The AI weapon's aim box at a distance: its width and height, between their min (settled) and max (fresh).
function aimBox(box, dist, settle) {
  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  let w0, w1, h0, h1;
  if (dist >= box.AimBoxDistFarStart) {
    const t = (dist - box.AimBoxDistFarStart) / Math.max(1e-6, box.AimBoxDistFarEnd - box.AimBoxDistFarStart);
    w0 = lerp(box.AimBoxWidthMinDistMax, box.AimBoxWidthMinDistFar, t);
    w1 = lerp(box.AimBoxWidthMaxDistMax, box.AimBoxWidthMaxDistFar, t);
    h0 = lerp(box.AimBoxHeightMinDistMax, box.AimBoxHeightMinDistFar, t);
    h1 = lerp(box.AimBoxHeightMaxDistMax, box.AimBoxHeightMaxDistFar, t);
  } else {
    const t = (dist - box.AimBoxDistMin) / Math.max(1e-6, box.AimBoxDistMax - box.AimBoxDistMin);
    w0 = lerp(box.AimBoxWidthMinDistMin, box.AimBoxWidthMinDistMax, t);
    w1 = lerp(box.AimBoxWidthMaxDistMin, box.AimBoxWidthMaxDistMax, t);
    h0 = lerp(box.AimBoxHeightMinDistMin, box.AimBoxHeightMinDistMax, t);
    h1 = lerp(box.AimBoxHeightMaxDistMin, box.AimBoxHeightMaxDistMax, t);
  }
  return [lerp(w1, w0, settle), lerp(h1, h0, settle)];
}

export function aimAt(brain, from, belief, now) {
  const tgt = v3(belief);
  if (brain.aimTarget !== belief.id) {
    brain.aimTarget = belief.id;
    brain.aimSince = now;
  }
  const speed = brain.s.weapon?.firing?.speed ?? 700;
  const vel = [belief.vel?.x ?? 0, 0, belief.vel?.z ?? 0];
  const p = lead(tgt, vel, from, speed) ?? tgt;
  const dist = Math.hypot(p[0] - from[0], p[2] - from[2]);
  const [bw, bh] = aimBox(brain.aiWeapon.accuracyHitBox, dist, Math.min(1, (now - brain.aimSince) / AIM_SETTLE));
  const w = bw * brain.aimScale;
  const h = bh * brain.aimScale;
  const fx = (p[0] - from[0]) / (dist || 1);
  const fz = (p[2] - from[2]) / (dist || 1);
  const u = (brain.rand() * 2 - 1) * (w / 2);
  const v = (brain.rand() * 2 - 1) * (h / 2);
  return [p[0] + fz * u, p[1] + v, p[2] - fx * u];
}

const OPTIONS = [
  { id: 'flee', rank: 5, considerations: [(c) => (c.target && c.posture === 'retreat' ? 1 : 0)] },
  { id: 'hide', rank: 4, considerations: [(c) => (c.target && (c.suppressed >= SUPPRESSED || c.health < HIDE_HEALTH) ? 1 : 0)] },
  { id: 'interact', rank: 3.5, considerations: [(c) => (c.interact ? 1 : 0)] },
  { id: 'close', rank: 3, considerations: [(c) => (c.target && c.dist <= c.close ? 1 : 0)] },
  { id: 'attack', rank: 2, considerations: [(c) => (c.target && c.dist <= c.engage && (!c.away || c.dist <= FIGHT_AWAY) ? 1 : 0), (c) => 0.5 + 0.5 * c.confidence] },
  { id: 'advance', rank: 1, considerations: [(c) => (c.target && c.dist > c.engage && !c.task ? 1 : 0)] },
  { id: 'follow', rank: 0, considerations: [() => 1] },
];

// a point `by` metres from `from` away from `threat`, leaning toward the squad's centre
function fallBack(nav, from, threat, centre, by = 8) {
  let ax = from[0] - threat[0];
  let az = from[1] - threat[1];
  const L = Math.hypot(ax, az) || 1;
  ax /= L;
  az /= L;
  if (centre && d2(centre, from) > 2) {
    const cx = centre[0] - from[0];
    const cz = centre[1] - from[1];
    const C = Math.hypot(cx, cz);
    // toward the squad, never back toward the threat
    if (cx * ax + cz * az > -0.2 * C) {
      ax += cx / C;
      az += cz / C;
    }
  }
  const M = Math.hypot(ax, az) || 1;
  const goal = [from[0] + (ax / M) * by, from[1] + (az / M) * by];
  return (nav && nearestWalkable(nav, goal[0], goal[1], 6)) ?? goal;
}

export function think(brain, world, now) {
  const s = brain.s;
  const me = flat(s.at);
  const b = believed(brain.me, { hostile: true });
  const tgt = b ? [b.at.x, b.at.z] : null;
  const dist = tgt ? d2(me, tgt) : Infinity;
  const task = world.task ?? null;
  const fromTask = task ? d2(me, task.at) : Infinity;
  const ctx = {
    task: !!task,
    away: !!task && fromTask > (task.radius ?? 0) + TASK_SLACK,
    interact: !!task?.interact && fromTask <= (task.reach ?? 3) && dist > INTERACT_CLEAR,
    target: !!b,
    dist,
    engage: brain.tactics.engage?.distance ?? 40,
    close: brain.tactics.closeCombat?.Distance ?? 0,
    posture: world.squad?.posture ?? 'hold',
    suppressed: s.suppressed,
    health: s.hp / s.hpMax,
    confidence: b?.confidence ?? 0,
  };
  const choice = pick(OPTIONS, ctx, { current: brain.current, rank: (o) => o.rank });
  let mode = choice?.id ?? 'follow';
  brain.current = mode;
  const intent = { mode, target: b?.id ?? null, goal: null, stance: 'stand', fire: false, aim: null, sprint: false, interact: false };
  const range = brain.s.weapon?.range ?? 200;
  const coverCtx = (query) => ({ me, threat: tgt, enemies: world.enemies, objective: world.objective, query, range, taken: world.taken, who: s.id });
  if (b) {
    const from = world.muzzle ? world.muzzle(s) : chestOf(s);
    intent.aim = aimAt(brain, from, b, now);
    intent.fire = b.visible && dist <= range && world.lineClear(from, v3(b));
  }
  if (mode === 'flee') {
    const slot = pickCover(world.nav, coverCtx(brain.queries.flee));
    intent.goal = slot ? flat(slot.at) : fallBack(world.nav, me, tgt, world.squad?.centre, 15);
    intent.sprint = true;
    intent.fire = false;
  } else if (mode === 'hide') {
    const keep = brain.cover && world.taken?.get(brain.cover) === s.id;
    const slot = keep ? brain.cover : pickCover(world.nav, coverCtx(brain.queries.hide));
    intent.goal = slot ? flat(slot.at) : fallBack(world.nav, me, tgt, world.squad?.centre);
    intent.stance = 'crouch';
    intent.fire = false;
    brain.cover = slot ?? null;
  } else if (mode === 'close') {
    intent.goal = tgt;
  } else if (mode === 'attack') {
    if (brain.pattern === null || brain.aimTarget !== b.id) choosePattern(brain, dist);
    const here = brain.cover;
    const stale = here && (now - brain.coverSince > brain.coverStay || !world.shields(here, tgt));
    let slot = here && !stale ? here : null;
    if (!slot) {
      slot = pickCover(world.nav, coverCtx(brain.queries.attack));
      if (slot !== here) {
        brain.coverSince = now;
        const c = brain.tactics.attack ?? {};
        const lo = c['OutdoorCoverRequestSettings.MinimumTimeInCoverToRequest'] ?? 1;
        const hi = c['OutdoorCoverRequestSettings.MaximumTimeInCoverToRequest'] ?? 6;
        brain.coverStay = lo + brain.rand() * (hi - lo);
      }
    }
    brain.cover = slot;
    if (slot) {
      intent.mode = mode = 'cover';
      intent.goal = flat(slot.at);
      intent.stance = slot.height === 'crouch' ? 'crouch' : 'stand';
    } else {
      // in the open: step aside across the line of fire, the side changing every few seconds
      if (now >= brain.strafeAt) {
        brain.strafe = brain.rand() < 0.5 ? -1 : 1;
        brain.strafeAt = now + 1.5 + brain.rand() * 2;
      }
      const ax = tgt[0] - me[0];
      const az = tgt[1] - me[1];
      const L = Math.hypot(ax, az) || 1;
      intent.goal = [me[0] + (az / L) * STRAFE * brain.strafe, me[1] - (ax / L) * STRAFE * brain.strafe];
      intent.stance = 'crouch';
    }
  } else if (mode === 'interact') {
    intent.goal = task.spot ?? task.at;
    intent.stance = 'crouch';
    intent.interact = true;
    intent.fire = false;
  } else if (mode === 'advance') {
    intent.goal = tgt;
    intent.sprint = dist > ctx.engage + 20;
  } else if (task) {
    // the commander's objective: there, then round it inside its radius, firing at what is in sight on the way
    intent.mode = mode = 'objective';
    if (task.interact || !task.radius) intent.goal = task.spot ?? task.at;
    else {
      if (!brain.wander || brain.wanderFor !== task || d2(me, brain.wander) < 2 || d2(brain.wander, task.at) > task.radius + 1) {
        const a = brain.rand() * Math.PI * 2;
        const r = brain.rand() * task.radius;
        brain.wander = (world.nav && nearestWalkable(world.nav, task.at[0] + Math.cos(a) * r, task.at[1] + Math.sin(a) * r, 6)) ?? task.spot ?? task.at;
        brain.wanderFor = task;
      }
      intent.goal = brain.wander;
    }
    intent.sprint = fromTask > (task.radius ?? 0) + TASK_SLACK + 20 && !intent.fire;
  } else {
    // follow the squad's leader; the leader (or one with no squad) takes the objective, then searches round it
    const lead_ = world.squad?.leader;
    if (lead_ && lead_ !== s.id && world.leaderAt && d2(me, world.leaderAt) > 6) intent.goal = world.leaderAt;
    else if (world.objective) {
      if (!brain.wander || d2(me, brain.wander) < 3) {
        const base = d2(me, world.objective) > WANDER ? world.objective : me;
        const a = brain.rand() * Math.PI * 2;
        const r = 8 + brain.rand() * WANDER;
        brain.wander = (world.nav && nearestWalkable(world.nav, base[0] + Math.cos(a) * r, base[1] + Math.sin(a) * r, 8)) ?? world.objective;
      }
      intent.goal = brain.wander;
    }
    intent.fire = false;
  }
  if (mode !== 'cover' && mode !== 'hide') brain.cover = mode === 'attack' ? brain.cover : null;
  brain.intent = intent;
  return intent;
}

// still bots' cells, which a path routes round (never the goal's own)
function blockedCells(world, s, goal, avoid = null) {
  const out = new Set(avoid ?? []);
  const gc = cellAt(world.nav, goal[0], goal[1]);
  const gi = gc ? gc[1] * world.nav.cols + gc[0] : -1;
  for (const o of world.others ?? []) {
    if (o === s || !o.alive || o.moving) continue;
    if (Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) > 30) continue;
    const c = cellAt(world.nav, o.at[0], o.at[2]);
    if (!c) continue;
    const i = c[1] * world.nav.cols + c[0];
    if (i !== gi) out.add(i);
  }
  return out;
}

function plan(brain, world, s, goal, now) {
  const t0 = clock();
  const from = flat(s.at);
  const blocked = blockedCells(world, s, goal, now < (brain.avoidUntil ?? -Infinity) ? brain.avoid : null);
  const d = d2(from, goal);
  let path = d <= FAR ? findPath(world.nav, from, goal, { blocked, max: SEARCH_CELLS }) : null;
  // too far for one search, or walled off for now: a leg toward it
  if (!path) {
    const k = Math.min(1, LEG / (d || 1));
    const mid = nearestWalkable(world.nav, from[0] + (goal[0] - from[0]) * k, from[1] + (goal[1] - from[1]) * k, 8);
    path = mid ? findPath(world.nav, from, mid, { blocked, max: SEARCH_CELLS }) : null;
  }
  brain.path = path ?? [from, goal];
  brain.pathGoal = goal;
  brain.pathAt = now;
  brain.wp = 1;
  if (profile.on) profile.path += clock() - t0;
}

function navigate(brain, world, s, goal, dt, now) {
  if (!goal) return move(s, [0, 0], dt, world.nav);
  if (d2(flat(s.at), goal) < NEAR_GOAL) {
    brain.stuck = 0;
    return move(s, [0, 0], dt, world.nav);
  }
  if (!brain.path || !brain.pathGoal || d2(brain.pathGoal, goal) > 2 || now - brain.pathAt > REPLAN || brain.stuck > 1) plan(brain, world, s, goal, now);
  while (brain.wp < brain.path.length - 1 && d2(flat(s.at), brain.path[brain.wp]) < 0.6) brain.wp++;
  const wp = brain.path[Math.min(brain.wp, brain.path.length - 1)];
  const moved = move(s, [wp[0] - s.at[0], wp[1] - s.at[2]], dt, world.nav);
  brain.stuck = moved < 0.01 ? brain.stuck + dt : 0;
  if (brain.stuck > 3) {
    // nothing works: the cell it could not enter is left out a while, and a fresh path somewhere else near
    const wc = cellAt(world.nav, wp[0], wp[1]);
    if (wc) {
      if (now >= (brain.avoidUntil ?? -Infinity)) brain.avoid = new Set();
      brain.avoid.add(wc[1] * world.nav.cols + wc[0]);
      brain.avoidUntil = now + AVOID;
    }
    const a = brain.rand() * Math.PI * 2;
    const spot = nearestWalkable(world.nav, s.at[0] + Math.cos(a) * 6, s.at[2] + Math.sin(a) * 6, 6);
    if (spot && walkable(world.nav, spot[0], spot[1])) brain.path = findPath(world.nav, flat(s.at), spot, { blocked: brain.avoid }) ?? [flat(s.at), spot];
    brain.wp = 1;
    brain.pathGoal = goal;
    brain.pathAt = now;
    brain.stuck = 0;
  }
  return moved;
}

export function act(brain, intent, s, dt, world, now) {
  if (!s.alive) return;
  s.sprint = !!intent.sprint && intent.stance === 'stand';
  const arrived = intent.goal && d2(flat(s.at), intent.goal) < NEAR_GOAL;
  // a bot walks upright and crouches where it means to stay
  s.stance = intent.stance === 'crouch' && (arrived || intent.mode === 'attack') ? 'crouch' : 'stand';
  navigate(brain, world, s, intent.goal, dt, now);
  const look = intent.aim ?? (s.moving ? [s.at[0] + s.vel[0], 0, s.at[2] + s.vel[2]] : null);
  if (look) s.yaw = Math.atan2(look[0] - s.at[0], look[2] - s.at[2]);
  s.aim = intent.aim;
  s.interact = !!intent.interact && !!intent.goal && d2(flat(s.at), intent.goal) < NEAR_GOAL + 2;
  const firing = patternStep(brain);
  if (intent.fire && firing && intent.aim && world.lineClear(world.muzzle ? world.muzzle(s) : chestOf(s), intent.aim)) world.shoot(s, intent.aim);
}
