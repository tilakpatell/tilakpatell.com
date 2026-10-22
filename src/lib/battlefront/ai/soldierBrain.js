// A soldier bot's brain (spec catalogue 7): a utility pick (`lib/ai/utility`)
// over the game's tactics branches, parameterised by the bot's template and
// tactics rows from ai.json: flee when the squad breaks, hide when
// suppressed or hurt, close combat inside the tactics' close distance,
// attack inside the engage distance (from a cover slot the attack query
// scores, else in the open, strafing), advance on a target past it, and
// otherwise follow the squad's leader to the objective. Cover is the
// tactics' own query (`coverQuery.js`), else the fallback scorer (`cover.js`). Fire comes in the
// game's bit patterns (`AIFiringPatterns`, a frame a sim step) and only
// with a clear line to the target's chest; aim errs inside the AI weapon's
// accuracy box (`AimBox*`), which shrinks the longer a bot holds a target.
// The target is the AI system's pick (`targeting.js`: the game's distance
// scores, the seen, the current, the human; held for the keep-firing time),
// or the squad coordinator's when it assigned one.
// A commander's task (`world.task`: a point, a radius, whether to interact)
// turns following into going to the objective and staying on it, firing
// on the way, and holding the interaction there when no enemy is close.
// Where the game's own AI code answers a rule (`tactics.js`, and the sheet in
// docs/superpowers/evidence/bf-ai-source/README.md), it is the law: a tactic
// only where the template's row has it; close combat tried first, by the
// source's test, held 3 s and left by its limits; a hiding bot firing from its
// cover once there; a bot sent to hide only by a target its weapon cannot hurt,
// and hiding the row's drawn time after; patterns of the AI weapon's own
// class, High until the first shot and Medium after, drawn afresh each burst,
// a bit a thirtieth of a second, a single pattern pulling once a press.
//
//   createBrain(s, { ai, role, rand, aimScale, system, difficulty, pve, ap }) → brain   (aimScale widens the aim box: a
//     mode's lethality lever; system: the AI system row, ai.system by default, AISystem_PvE for a pve bot;
//     difficulty: `difficulty.js`'s row, which times the first shot at a new target, the aim's settling and
//     widens the aim at a target that sprints or crouches; pve: the Skirmish template, tactics and abilities;
//     ap: the AutoPlayers' numbers, autoPlayer.js's, for a bot of an Instant Action round: its view is then the
//     tracker's and its trigger the line of fire's, stepped in act, in place of the aim box and the reaction)
//   think(brain, world, now) → intent { mode, target, goal, stance, fire, aim }
//   act(brain, intent, s, dt, world, now)        patternStep(brain) → fire this frame?
//   world: { nav, lineClear(a, b), squad: { centre, leader, posture } | null, objective, task, enemies, others, shoot(s, aim), who(id), roll(s, dir) }
//   task: { at: [x, z], spot: [x, z], radius, interact, reach, role }

import { pick } from '../../ai/utility.js';
import { createSenses } from '../../ai/perception.js';
import { heightAt, walkable } from '../nav.js';
import { chestOf, eyeOf } from '../soldier.js';
import { kickAim } from '../weapons.js';
import { AVOID, FAR, LEG, NEAR_GOAL, REPLAN, SEARCH_CELLS, navigate, spotNear } from './soldierWay.js';
import { pickCover, queryFor } from './cover.js';
import { pickTarget } from './targeting.js';
import { queryFor as gameQuery, runQuery } from './coverQuery.js';
import { skirmishRole, pressAbility } from './skirmish.js';
import { TICK, aheadOf, available, closeCombat, hideClock, intensityFor, patternWeapon, pulls, stillHiding, turnFrom, validAgainst } from './tactics.js';
import { sensingOf, sightOf } from './sensing.js';
import { DEFAULT } from './difficulty.js';
import { DEFAULT_MOVE, MOVE_FIRE, STILL, aimY, firesOnTheMove, holdsFire, keepFiring, reacquired, weaponRange } from './trigger.js';
import { holdLastSeen } from './memory.js';
import { FLEE_DONE, panicStep, panicking } from './panic.js';
import { asksNewCover, coverTimes, hideCoverTurned, inPreferredRange } from './coverRequest.js';
import { AHEAD, FACING, TARGET, aimPoint, burstStep, createAim, createBurst, createEvasion, createLof, crouched, groundOk, lofStep, mayFire, noiseOf, strafeSide, takeRoll, viewMiss, viewPoint, viewStep, weaponClass } from './autoPlayer.js';

// (a bot's way to its goal, `navigate`, with `spotNear` and the path's knobs, is `soldierWay.js`'s, split out
// under the size rule; the knobs are re-exported here under the names they had)
export { AVOID, FAR, LEG, REPLAN, SEARCH_CELLS };

// The class a soldier plays → the game's AI template for it.
export const ROLES = { assault: 'rifleman', heavy: 'heavy', officer: 'officer', specialist: 'sniper' };
// A weapon family → the AI weapon row (aim box, preferred range) and the firing patterns' weapon.
// (the patterns' weapon is the AI row's own class where it has one, as the source has it: tactics.js;
// the family's is kept for a row with none)
const AI_WEAPONS = { rifle: 'AI_Rifle', heavy: 'AI_Heavy', pistol: 'AI_Pistol_Officer', sniper: 'AI_Sniper', hero: 'AI_Rifle', special: 'AI_Rifle' };
const PATTERN_WEAPONS = { rifle: 'AssaultRifle', heavy: 'MachineGun', pistol: 'Pistol', sniper: 'SniperRifle', hero: 'AssaultRifle', special: 'AssaultRifle' };

// Knobs the data does not hold, each the game's by observation:
// (SIGHT and CONE are now an AutoPlayer's range and the fallback of a world with no rulebook rows: a soldier
// bot sees by its difficulty row's cone, wider once its side is alerted, as the game's AI code has it:
// sensing.js)
export const SIGHT = 100; // metres a bot sees (the templates' sensing areas are single-player only)
export const CONE = 0.25; // the cosine of a bot's half view angle (about 75° either side)
const HEARING = 40; // metres a shot is heard
export const AIM_SETTLE = 2; // seconds on one target for the aim box to shrink from its max to its min
// (the share of health under which a bot hid, by hand, until the source showed that no tactic reads health
// and only a target its weapon cannot hurt sends a bot to hide: tactics.js. Kept for its readers; the brain
// no longer hides by it, nor by suppression, which the same rule retired)
export const HIDE_HEALTH = 0.4;
export const STRAFE = 4; // metres a bot attacking in the open steps aside
const WANDER = 30; // metres round the objective a bot with nothing to do searches
// A bot with a task this far outside its radius goes there rather than
// fight, unless the enemy is inside FIGHT_AWAY; it interacts only with no
// enemy believed inside INTERACT_CLEAR (the commander's rule). By hand.
const TASK_SLACK = 10;
const FIGHT_AWAY = 20;
const INTERACT_CLEAR = 10;

export function createBrain(s, { ai, role: given = null, rand = Math.random, aimScale = 1, system: sys = null, difficulty = null, pve = false, ap = null }) {
  // a Skirmish bot plays its class's PvE template, tactics and AI weapon, under the PvE AI system
  const pveRole = pve ? skirmishRole(s.cls ?? {}) : null;
  const pveTemplate = pve ? ai.skirmish?.templates?.[pveRole] : null;
  const role = given ?? (pveTemplate ? pveRole : (ROLES[s.cls?.cls] ?? 'rifleman'));
  const template = pveTemplate ?? ai.templates[role] ?? ai.templates.rifleman;
  const tactics = (pveTemplate && ai.skirmish.tactics[template.tactics]) ?? ai.tactics[template.tactics] ?? ai.tactics.Rifleman_Tactics;
  const system = sys ?? (pveTemplate ? ai.systemPvE : ai.system);
  const family = s.weapon?.family ?? 'rifle';
  const pveWeapon = pveTemplate ? ai.skirmish.weapons[`AI_${pveRole[0].toUpperCase()}${pveRole.slice(1)}_PvE`] : null;
  const aiWeapon = pveWeapon?.accuracyHitBox ? pveWeapon : ai.weapons[AI_WEAPONS[family] ?? 'AI_Rifle'];
  const patterns = ai.patterns.filter((p) => p.weapon === (patternWeapon(pveWeapon ?? aiWeapon) ?? PATTERN_WEAPONS[family] ?? 'AssaultRifle'));
  const brain = {
    s,
    role,
    aimScale,
    system,
    difficulty,
    pve: !!pveTemplate,
    skirmish: pveTemplate ? ai.skirmish : null,
    // (an AutoPlayer's: its numbers, its tracker, its line of fire and its weapon class's noise in degrees)
    ap,
    apAim: ap ? createAim() : null,
    apLof: ap ? createLof() : null,
    apEvade: ap ? createEvasion() : null,
    apClass: ap ? weaponClass(family, s.weapon?.id) : null,
    apNoise: ap ? noiseOf(ap, weaponClass(family, s.weapon?.id)) : 0,
    apBurst: ap ? createBurst() : null,
    apCandidate: null, // the enemy whose line of fire the tracker is watching
    target: null,
    targetSince: 0,
    assigned: null,
    template,
    tactics,
    aiWeapon,
    patterns: patterns.length ? patterns : ai.patterns,
    queries: { attack: queryFor(ai, 'attack'), hide: queryFor(ai, 'hide'), flee: queryFor(ai, 'flee'), protective: queryFor(ai, 'protective') },
    // the tactics' own queries in the game's selection form (coverQuery.js), tried before `queries`
    gameQueries: { attack: gameQuery(ai, tactics, 'attack'), hide: gameQuery(ai, tactics, 'hide'), flee: gameQuery(ai, tactics, 'flee') },
    coverScores: ai.coverScores ?? {},
    preferred: aiWeapon?.outdoorPreferredRange ?? aiWeapon?.preferredRange ?? system?.preferredRange ?? null,
    rand,
    // (an AutoPlayer's sight is its tracker's field of view, AP_TargetTrackerFieldOfViewDegrees to either side: the code's half angle)
    // (a soldier bot's belief of an enemy out of sight fades from the moment it is lost, over its template's
    // `TargetLostTime`, held where it was seen, memory.js: the senses' 2.5 s of following the truth, by hand,
    // stays an AutoPlayer's alone)
    senses: createSenses({ sight: { range: SIGHT, cone: ap ? Math.cos(ap.fov * (Math.PI / 180)) : CONE, far: 1 }, hearing: { range: HEARING }, memory: template.targetLostTime, intuition: ap ? 2.5 : 0 }),
    // (a soldier bot's cone, the game's: its difficulty row's, the multiplayer default where none is set;
    // set on its senses at each think by whether its side is alerted. An AutoPlayer keeps its tracker's)
    sensing: ap || !ai.difficulties ? null : sensingOf(difficulty?.row ?? ai.difficulties[DEFAULT]),
    sideAlerted: false,
    me: { pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 1 }, beliefs: {} },
    intent: { mode: 'follow', target: null, goal: null, stance: 'stand', fire: false, aim: null },
    current: null,
    pattern: null,
    frame: 0,
    // (when its close combat began, and its hide's drawn hold and end: tactics.js)
    closeSince: null,
    hiding: {},
    // (the source's firing state, tactics.js: the pattern ticks owed to the next step, whether the trigger
    // was down at the last tick, whether the bot has fired since it deployed, the intensity it draws at)
    ticks: 0,
    held: false,
    fired: false,
    intensity: 'High',
    // (the trigger's and the flee's state, the source's: trigger.js and panic.js. The AI weapon's range bounds
    // the trigger; the attack row's move settings say whether it fires on its way to a cover; the panic's
    // causes and times are the difficulty row's, the multiplayer default where none is set)
    aiRange: weaponRange(pveWeapon ?? aiWeapon),
    moveFire: MOVE_FIRE.attack[template.tactics] ?? DEFAULT_MOVE,
    fleeFire: MOVE_FIRE.flee[template.tactics] ?? DEFAULT_MOVE,
    sightTrack: {},
    panicRow: difficulty?.row ?? ai.difficulties?.[DEFAULT] ?? null,
    panicState: { panic: null, over: 0 },
    thoughtAt: null,
    fleeTo: null,
    fleeCoverSince: null,
    // (the attack's cover timers, and when it came to its cover: coverRequest.js)
    coverTimes: null,
    inCoverSince: null,
    cover: null,
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
  if (brain.sensing) Object.assign(brain.senses.sight, sightOf(brain.sensing, false));
  return brain;
}

const flat = (p) => [p[0], p[2]];
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const v3 = (b) => [b.at.x, b.at.y, b.at.z];

// the firing pattern's next frame: its bits, then its delay of frames with none
// (a frame is an AI tick, tactics.js's TICK: act runs the ticks that fall in a sim step)
export function patternStep(brain) {
  if (!brain.pattern) drawPattern(brain);
  const p = brain.pattern;
  const f = brain.frame;
  brain.frame = (f + 1) % (p.bits.length + (p.delay ?? 0));
  // (the burst and its delay done: the next burst draws its own, at the intensity it starts in)
  if (brain.frame === 0) brain.pattern = null;
  return f < p.bits.length && p.bits[f];
}

// A burst's pattern, drawn at random among the weapon's patterns of the bot's
// intensity (`WeaponControl.cpp`, `findRandomFiringPattern`); with none of that
// intensity, a single shot, the source's own default. (It replaced the
// pattern's intensity by range, chosen when an attack started: under 15 m
// High, under 35 m Medium, else Low.)
const SINGLE = { bits: [true], delay: 0, single: true };
function drawPattern(brain) {
  const list = brain.patterns.filter((p) => p.intensity === brain.intensity);
  brain.pattern = list.length ? list[Math.floor(brain.rand() * list.length)] : SINGLE;
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

// the difficulty's widening of the aim at a target that sprints, crouches or lies prone
function penalty(brain, e) {
  const a = brain.difficulty?.aim;
  if (!a || !e) return 1;
  if (e.sprint) return a.sprint;
  if (e.stance === 'prone') return a.prone;
  if (e.stance === 'crouch') return a.crouch;
  return 1;
}

// An AutoPlayer's engaging distance, which bounds who can be its target: AP_MaxTargetEngagingDistanceScale ×
// the gun's own range (the code: the held weapon's MaxRangeMeterDistance), 2.5 × 200 m for a blaster.
export const engaging = (brain, range) => brain.ap.engageScale * range;

export function aimAt(brain, from, belief, now, who = null) {
  const tgt = v3(belief);
  if (brain.aimTarget !== belief.id) {
    brain.aimTarget = belief.id;
    brain.aimSince = now;
  }
  // (a soldier's eye less the system's `AimOffsetY`, where it is or was last seen, and no lead: trigger.js. It
  // replaced the chest, led for the bolt's speed. A target not on foot keeps the chest the senses hold; a
  // soldier the world does not name is read on the bot's own body)
  const body = who ? (who.kind == null || who.kind === 'soldier' ? who : null) : brain.s;
  if (body?.at) tgt[1] = aimY(tgt[1], { eyeOverChest: eyeOf(body)[1] - chestOf(body)[1], offset: brain.system?.targeting?.aimOffsetY ?? 0 });
  const p = tgt;
  const dist = Math.hypot(p[0] - from[0], p[2] - from[2]);
  const settle = brain.difficulty?.settle(dist) ?? AIM_SETTLE;
  const [bw, bh] = aimBox(brain.aiWeapon.accuracyHitBox, dist, Math.min(1, (now - brain.aimSince) / Math.max(1e-3, settle)));
  const k = brain.aimScale * penalty(brain, who);
  const w = bw * k;
  const h = bh * k;
  const fx = (p[0] - from[0]) / (dist || 1);
  const fz = (p[2] - from[2]) / (dist || 1);
  const u = (brain.rand() * 2 - 1) * (w / 2);
  const v = (brain.rand() * 2 - 1) * (h / 2);
  return [p[0] + fz * u, p[1] + v, p[2] - fx * u];
}

// (close combat first, then flee and hide, as the behaviour tree tries them: `combat_Tactics`. Each is
// offered only where the template's row holds it, and close combat is the source's test, worked out in
// think: tactics.js; flee is a panic's, kept until the bot has sat in its flee cover 2 s: panic.js. It
// replaced flee on the squad's posture turned to retreat)
const OPTIONS = [
  { id: 'close', rank: 6, considerations: [(c) => (c.closeCombat ? 1 : 0)] },
  { id: 'flee', rank: 5, considerations: [(c) => (c.flee ? 1 : 0)] },
  { id: 'hide', rank: 4, considerations: [(c) => (c.hide ? 1 : 0)] },
  { id: 'interact', rank: 3.5, considerations: [(c) => (c.interact ? 1 : 0)] },
  { id: 'attack', rank: 2, considerations: [(c) => (c.target && c.dist <= c.engage && (!c.away || c.dist <= FIGHT_AWAY) ? 1 : 0), (c) => 0.5 + 0.5 * c.confidence] },
  { id: 'advance', rank: 1, considerations: [(c) => (c.target && c.dist > c.engage && !c.task ? 1 : 0)] },
  { id: 'follow', rank: 0, considerations: [() => 1] },
];

// a point `by` metres from `from` away from `threat`, leaning toward the squad's centre
function fallBack(nav, from, threat, centre, by = 8, y = null) {
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
  return (nav && spotNear(nav, goal[0], goal[1], 6, y)) ?? goal;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// An AutoPlayer's target as the game's tracker has it (its code, NOTES.md): of every living enemy inside the
// engaging distance (no sight is asked of them), the target it has is kept while it is under two seconds old
// and its line was clear lately; after that every think picks again: the nearest inside the field of view,
// taken only once its line of fire's flag is true. The nearest in view with no line of fire leaves the bot
// with no target, though a farther one stands in the open. → a belief of the target, or null
function trackerTarget(brain, world, s, me, from, now) {
  const reach = engaging(brain, s.weapon?.range ?? 200);
  const fov = brain.ap.fov * (Math.PI / 180);
  const near = (t) => Math.hypot(t.at.x - me[0], t.at.z - me[1]);
  const list = (world.targets ?? []).filter((t) => near(t) <= reach);
  const cur = brain.target != null ? (list.find((t) => t.id === brain.target) ?? null) : null;
  let pick = cur && now - brain.targetSince < TARGET.minSwitch && now - brain.apLof.lastClear < TARGET.clearWithin ? cur : null;
  if (!pick) {
    let best = Infinity;
    let cand = null;
    for (const t of list) {
      const d = near(t);
      if (d < best && Math.abs(wrap(Math.atan2(t.at.x - me[0], t.at.z - me[1]) - s.yaw)) < fov) [cand, best] = [t, d];
    }
    if (cand) {
      // (each enemy's line has its own clocks: another candidate starts them again)
      if (cand.id !== brain.apCandidate) {
        brain.apCandidate = cand.id;
        brain.apLof = createLof();
      }
      if (lofStep(brain.apLof, brain.ap, { clear: world.lineClear(from, [cand.at.x, cand.at.y, cand.at.z]), now })) pick = cand;
    }
  }
  const id = pick?.id ?? null;
  if (id !== brain.target) {
    brain.target = id;
    brain.targetSince = now;
  }
  return pick ? { id: pick.id, at: pick.at, vel: pick.vel, visible: true, confidence: 1, hostile: true } : null;
}

// An AutoPlayer's think (the game's own bot, NOTES.md: it has no cover, no hiding and no fleeing). Its target is
// the tracker's. It keeps to its way, the post or the objective it was sent to, and fires at its target as it
// goes; while it and its target each face the other inside 45° it leaves its way to strafe (autoPlayer.js's
// strafeSide: a leg a side for the settings' time, the ground that way probed each think and a failed side
// barred; the leg may also go forward or back, crouched or not, and open with its dodge roll). The aim point,
// the view and the trigger are stepped in act. By hand: it sprints with no target, far from where it is
// going; at an objective to be worked on it works, as the other bots do, with no enemy near.
function thinkAutoPlayer(brain, world, now) {
  const s = brain.s;
  const me = flat(s.at);
  const from = world.muzzle ? world.muzzle(s) : chestOf(s);
  const b = trackerTarget(brain, world, s, me, from, now);
  const task = world.task ?? null;
  const fromTask = task ? d2(me, task.at) : Infinity;
  const tgt = b ? [b.at.x, b.at.z] : null;
  const dist = tgt ? d2(me, tgt) : Infinity;
  const intent = { mode: b ? 'attack' : task ? 'objective' : 'follow', target: b?.id ?? null, goal: null, stance: 'stand', fire: !!b, aim: b ? v3(b) : null, sprint: false, interact: false };
  brain.strafe = 0;
  if (b) {
    const ax = tgt[0] - me[0];
    const az = tgt[1] - me[1];
    const L = Math.hypot(ax, az) || 1;
    const toT = Math.atan2(ax, az);
    const who = world.who?.(b.id) ?? null;
    const facing = Math.abs(wrap(toT - s.yaw)) <= FACING && (!who || Math.abs(wrap(toT + Math.PI - (who.yaw ?? 0))) <= FACING);
    if (!facing) brain.apEvade = createEvasion();
    else {
      const g = brain.ap.groundCheck;
      const stands = (side) => {
        const x = me[0] + (az / L) * g.distance * side;
        const z = me[1] - (ax / L) * g.distance * side;
        return walkable(world.nav, x, z) && groundOk(brain.ap, heightAt(world.nav, x, z) - s.at[1]);
      };
      brain.strafe = strafeSide(brain.apEvade, brain.ap, { now, rand: brain.rand, ground: world.nav ? stands : null });
    }
    if (brain.strafe) {
      // (the stick: the leg's side across the line to the target, and forward or back along it)
      const fwd = brain.apEvade.fwd;
      const stick = [(az / L) * brain.strafe + (ax / L) * fwd, -(ax / L) * brain.strafe + (az / L) * fwd];
      const n = Math.hypot(stick[0], stick[1]) || 1;
      intent.goal = [me[0] + (stick[0] / n) * STRAFE, me[1] + (stick[1] / n) * STRAFE];
      intent.stance = crouched(brain.apEvade) ? 'crouch' : 'stand';
      if (takeRoll(brain.apEvade)) intent.roll = [stick[0] / n, stick[1] / n];
    }
  } else brain.apEvade = createEvasion();
  if (!brain.strafe) {
    if (task?.interact && fromTask <= (task.reach ?? 3) && dist > INTERACT_CLEAR) {
      intent.mode = 'interact';
      intent.goal = task.spot ?? task.at;
      intent.stance = 'crouch';
      intent.interact = true;
      intent.fire = false;
    } else if (task) {
      // (its post: there, then round it inside its radius)
      if (task.interact || !task.radius) intent.goal = task.spot ?? task.at;
      else {
        if (!brain.wander || brain.wanderFor !== task || d2(me, brain.wander) < 2 || d2(brain.wander, task.at) > task.radius + 1) {
          const a = brain.rand() * Math.PI * 2;
          const r = brain.rand() * task.radius;
          brain.wander = (world.nav && spotNear(world.nav, task.at[0] + Math.cos(a) * r, task.at[1] + Math.sin(a) * r, 6, s.at[1])) ?? task.spot ?? task.at;
          brain.wanderFor = task;
        }
        intent.goal = brain.wander;
      }
      intent.sprint = !b && fromTask > (task.radius ?? 0) + TASK_SLACK + 20;
    } else if (world.objective) {
      intent.goal = world.objective;
      intent.sprint = !b && d2(me, world.objective) > TASK_SLACK + 20;
    }
  }
  brain.cover = null;
  brain.current = intent.mode;
  brain.intent = intent;
  return intent;
}

// What close combat's test reads (tactics.js's closeCombat), from the bot's belief of its target. By hand:
// heights and distances chest to chest (the source's are the target's place against the bot's feet); a
// cover that still shields the bot from its target stands for the source's committable one; and the
// sidestep of a bot attacking in the open counts as standing, for in the source that bot stands and fires
// (`attack_Fire`) and the sidestep is the site's own.
function closeInput(brain, world, b, { me, tgt, clear, now }) {
  const s = brain.s;
  const chest = chestOf(s);
  const there = aheadOf(v3(b), [b.vel?.x ?? 0, 0, b.vel?.z ?? 0], !!b.visible);
  const inCover = !!brain.cover && d2(me, flat(brain.cover.at)) < NEAR_GOAL;
  const sidestep = brain.current === 'attack' && !brain.cover;
  return {
    since: brain.current === 'close' ? brain.closeSince : null,
    now,
    inCover,
    toCover: !!brain.cover && !inCover && !!world.shields?.(brain.cover, tgt),
    seen: !!b.visible,
    lineOfFire: clear,
    sinceSeen: b.visible ? 0 : (brain.me.now ?? now) - (b.seenAt ?? -Infinity),
    ahead: Math.hypot(there[0] - chest[0], there[1] - chest[1], there[2] - chest[2]),
    height: Math.abs(b.at.y - chest[1]),
    turn: sidestep ? 0 : turnFrom(s.vel, [tgt[0] - me[0], tgt[1] - me[1]]),
    inVehicle: world.who?.(b.id)?.kind === 'walker',
  };
}

export function think(brain, world, now) {
  if (brain.ap) return thinkAutoPlayer(brain, world, now);
  // (its side alerted, by the world's word or its own sight of an enemy, its cone widens and stays so:
  // sensing.js)
  if (brain.sensing && !brain.sideAlerted && (world.alerted || Object.values(brain.me.beliefs ?? {}).some((x) => x.visible && x.hostile))) {
    brain.sideAlerted = true;
    Object.assign(brain.senses.sight, sightOf(brain.sensing, true));
  }
  // (an enemy out of sight is held where it was last seen: memory.js; the sim's senses do it as they run,
  // and this is for a world whose own do not)
  holdLastSeen(brain.me);
  const s = brain.s;
  const me = flat(s.at);
  const seen = Object.values(brain.me.beliefs ?? {}).filter((x) => x.hostile);
  const id = pickTarget(brain, seen, { system: brain.system, who: world.who, now, assigned: brain.assigned });
  const b = id ? brain.me.beliefs[id] : null;
  const tgt = b ? [b.at.x, b.at.z] : null;
  const dist = tgt ? d2(me, tgt) : Infinity;
  const task = world.task ?? null;
  const fromTask = task ? d2(me, task.at) : Infinity;
  const from = world.muzzle ? world.muzzle(s) : chestOf(s);
  // (the line of fire to a target in sight, asked once: close combat's test and the trigger both read it,
  // and neither asks it of one out of sight)
  const clear = !!b?.visible && world.lineClear(from, v3(b));
  // (the hide's one cause, the source's: a target the bot's AI weapon is not valid against. No AI weapon row
  // of the game's is so made, so only a row given its own `validAgainst` meets it: tactics.js)
  const e = b ? (world.who?.(b.id) ?? null) : null;
  const hideCause = !!e && !validAgainst(brain.aiWeapon?.validAgainst, { inVehicle: e.kind != null && e.kind !== 'soldier', shielded: !!e.shielded });
  const wasHiding = brain.current === 'hide';
  // (flee's one cause, a panic, and its end, 2 s in its flee cover, after which it hides there: panic.js)
  const panic = panicStep(brain.panicState, { at: s.at, team: s.team, grenades: world.grenades ?? [], suppressed: s.suppressed, tactics: brain.tactics.suppression, dt: now - (brain.thoughtAt ?? now), now, row: brain.panicRow, rand: brain.rand });
  brain.thoughtAt = now;
  const fleeDone = brain.current === 'flee' && brain.fleeCoverSince != null && now - brain.fleeCoverSince > FLEE_DONE;
  const sinceSeen = !b || b.visible ? 0 : (brain.me.now ?? now) - (b.seenAt ?? -Infinity);
  const ctx = {
    task: !!task,
    away: !!task && fromTask > (task.radius ?? 0) + TASK_SLACK,
    interact: !!task?.interact && fromTask <= (task.reach ?? 3) && dist > INTERACT_CLEAR,
    target: !!b,
    dist,
    engage: brain.tactics.engage?.distance ?? 40,
    closeCombat: !!b && available(brain.tactics, 'closeCombat') && closeCombat(brain.tactics.closeCombat, closeInput(brain, world, b, { me, tgt, clear, now })),
    flee: !!b && available(brain.tactics, 'flee') && !fleeDone && (panicking(panic, now) || brain.current === 'flee'),
    // (hiding while its cause holds and the row's drawn hold after: the sheet's T6 and T7 together; a flee
    // done begins one, `isHideValid`'s way in from flee)
    hide: !!b && available(brain.tactics, 'hide') && stillHiding(brain.hiding, { cause: hideCause || fleeDone, was: wasHiding, now }),
    posture: world.squad?.posture ?? 'hold',
    suppressed: s.suppressed,
    health: s.hp / s.hpMax,
    confidence: b?.confidence ?? 0,
  };
  const choice = pick(OPTIONS, ctx, { current: brain.current, rank: (o) => o.rank });
  let mode = choice?.id ?? 'follow';
  // (close combat's clock starts as it begins; a hide draws its hold as it begins and runs it from its cause)
  if (mode === 'hide') hideClock(brain.hiding, { cause: hideCause || fleeDone, was: wasHiding, now, row: brain.tactics.hide, rand: brain.rand });
  if (mode === 'close' && brain.current !== 'close') brain.closeSince = now;
  if (mode !== 'close') brain.closeSince = null;
  // (a flee's place and its time there, and the attack's cover timers, are each that tactic's own)
  if (mode !== 'flee') brain.fleeTo = brain.fleeCoverSince = null;
  if (mode !== 'attack') brain.coverTimes = brain.inCoverSince = null;
  brain.current = mode;
  const intent = { mode, target: b?.id ?? null, goal: null, stance: 'stand', fire: false, aim: null, sprint: false, interact: false };
  const range = brain.s.weapon?.range ?? 200;
  // (the fallback scorer reads the weapon's preferred range and the heights as the game's queries do: cover.js)
  const coverCtx = (query) => ({ me, meY: s.at[1], threat: tgt, threatY: b?.at.y, enemies: world.enemies, objective: world.objective, query, range, preferred: brain.preferred, taken: world.taken, who: s.id });
  // the game's query first, the fallback scorer when it offers nothing
  const findCover = (state) =>
    runQuery(brain.gameQueries[state], { common: brain.coverScores, nav: world.nav, me, meY: s.at[1], threat: tgt, threatY: b?.at.y, enemies: world.enemies, preferred: brain.preferred, current: brain.cover, taken: world.taken, who: s.id, objective: world.objective }) ??
    pickCover(world.nav, coverCtx(brain.queries[state]));
  if (b) {
    intent.aim = aimAt(brain, from, b, now, world.who?.(b.id) ?? null);
    // (a new target's first shot waits the difficulty's reaction at its distance, and one spotted again away
    // from where it was lost its reacquire time; out of sight, a bot standing fires on at where it was last
    // seen for the keep-firing time; past its AI weapon's range, none: trigger.js. A bot sidestepping in the
    // open stands, as the source has it, closeInput's reading)
    const back = reacquired(brain.sightTrack, { id: b.id, seen: !!b.visible, at: v3(b), threshold: brain.difficulty?.row?.targeting?.reaquireTargetDistanceThreshold ?? Infinity, now });
    const ready = !brain.difficulty || (now - brain.targetSince >= brain.difficulty.reaction(dist) && now - back >= brain.difficulty.reacquire(dist));
    const standing = Math.hypot(s.vel[0], s.vel[2]) < STILL || (mode === 'attack' && !brain.cover);
    const sight = b.visible ? clear : !holdsFire({ seen: false, standing, sinceSeen, keep: keepFiring(brain.system) }) && world.lineClear(from, v3(b));
    intent.fire = ready && dist <= brain.aiRange && sight;
    // (a Skirmish bot's class abilities; the online fill's AutoPlayers press the officer's turret alone: ai/throw.js)
    if (s.abilities.list.length > 1) intent.ability = pressAbility(brain, { target: b, now, world, autoPlayer: !brain.pve });
  }
  if (mode === 'flee') {
    const slot = findCover('flee');
    // (with no flee cover in reach, a place away from the panic's, or the threat, kept for the flee: by hand,
    // and its own cover for the flee's 2 s)
    brain.fleeTo = slot ? flat(slot.at) : (brain.fleeTo ?? fallBack(world.nav, me, panic?.from ? [panic.from[0], panic.from[2]] : tgt, world.squad?.centre, 15, s.at[1]));
    intent.goal = brain.fleeTo;
    intent.sprint = true;
    // (no fire on the way: every multiplayer flee row's move settings say so; in its cover it fires as
    // an attacking bot does, the behaviour tree's `combatFlee_Hide`. The Skirmish heavy's row fires on the
    // way at a target inside 30 m: trigger.js)
    const could = intent.fire;
    intent.fire = could && firesOnTheMove(brain.fleeFire, dist);
    // (come to its flee cover: it waits there, crouched, until the flee is done and it hides)
    if (d2(me, intent.goal) < NEAR_GOAL) {
      brain.fleeCoverSince ??= now;
      intent.mode = mode = 'hide';
      intent.stance = 'crouch';
      intent.sprint = false;
      intent.fire = could;
      brain.cover = slot ?? null;
    } else brain.fleeCoverSince = null;
  } else if (mode === 'hide') {
    // (a cover its target has come round past half the row's angle is given up: coverRequest.js)
    const angle = brain.tactics.hide?.InvalidateCoverAngle ?? 180;
    const turned = (sl) => (angle >= 180 && world.shields ? !world.shields(sl, tgt) : hideCoverTurned(sl, tgt, angle));
    const keep = brain.cover && world.taken?.get(brain.cover) === s.id && !turned(brain.cover);
    const slot = keep ? brain.cover : findCover('hide');
    intent.goal = slot ? flat(slot.at) : fallBack(world.nav, me, tgt, world.squad?.centre, 8, s.at[1]);
    intent.stance = 'crouch';
    // (in its cover a hiding bot fires if it may, on the way there it does not: the behaviour tree's
    // `combatHide_Hide`, and no hide row has move settings that would let it)
    intent.fire = !!slot && d2(me, flat(slot.at)) < NEAR_GOAL && intent.fire;
    brain.cover = slot ?? null;
  } else if (mode === 'close') {
    intent.goal = tgt;
  } else if (mode === 'attack') {
    // (a new cover only once in this one past its drawn time, and then only out of its weapon's preferred range
    // of the target or with the target lost its drawn time, never with it too close; or for one that no longer
    // shields: coverRequest.js. It replaced a new query every drawn 1 to 3 s of the outdoor block)
    const here = brain.cover;
    const atCover = !!here && d2(me, flat(here.at)) < NEAR_GOAL;
    brain.inCoverSince = atCover ? (brain.inCoverSince ?? now) : null;
    brain.coverTimes ??= coverTimes(brain.tactics.attack, brain.rand);
    const ask =
      !here ||
      !world.shields(here, tgt) ||
      asksNewCover({ inCover: atCover, timeInCover: atCover ? now - brain.inCoverSince : 0, stay: brain.coverTimes.stay, inRange: inPreferredRange(brain.preferred, flat(here.at), tgt), sinceSeen, lost: brain.coverTimes.lost, tooClose: dist < (brain.tactics.attack?.['CoverRequestSettings.MinimumDistanceToTarget'] ?? 0) });
    let slot = here;
    if (ask) {
      slot = findCover('attack');
      brain.coverTimes = coverTimes(brain.tactics.attack, brain.rand);
      if (slot !== here) brain.inCoverSince = null;
    }
    brain.cover = slot;
    if (slot) {
      intent.mode = mode = 'cover';
      intent.goal = flat(slot.at);
      intent.stance = slot.height === 'crouch' ? 'crouch' : 'stand';
      // (on its way there it fires only by its attack row's move settings: trigger.js)
      if (d2(me, intent.goal) >= NEAR_GOAL) intent.fire = intent.fire && firesOnTheMove(brain.moveFire, dist);
    } else {
      // in the open: step aside across the line of fire, the side changing every few seconds
      const ax = tgt[0] - me[0];
      const az = tgt[1] - me[1];
      const L = Math.hypot(ax, az) || 1;
      if (now >= brain.strafeAt) {
        brain.strafe = brain.rand() < 0.5 ? -1 : 1;
        brain.strafeAt = now + 1.5 + brain.rand() * 2;
      }
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
        brain.wander = (world.nav && spotNear(world.nav, task.at[0] + Math.cos(a) * r, task.at[1] + Math.sin(a) * r, 6, s.at[1])) ?? task.spot ?? task.at;
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
        brain.wander = (world.nav && spotNear(world.nav, base[0] + Math.cos(a) * r, base[1] + Math.sin(a) * r, 8, s.at[1])) ?? world.objective;
      }
      intent.goal = brain.wander;
    }
    intent.fire = false;
  }
  if (mode !== 'cover' && mode !== 'hide') brain.cover = mode === 'attack' ? brain.cover : null;
  brain.intent = intent;
  return intent;
}

export function act(brain, intent, s, dt, world, now) {
  if (!s.alive) return;
  s.sprint = !!intent.sprint && intent.stance === 'stand';
  const arrived = intent.goal && d2(flat(s.at), intent.goal) < NEAR_GOAL;
  // a bot walks upright and crouches where it means to stay
  s.stance = intent.stance === 'crouch' && (arrived || intent.mode === 'attack') ? 'crouch' : 'stand';
  navigate(brain, world, s, intent.goal, dt, now);
  // (an AutoPlayer's dodge roll, drawn with its strafe leg: asked of the world once, which rolls it if its evade is charged)
  if (intent.roll) {
    world.roll?.(s, intent.roll);
    intent.roll = null;
  }
  // (its own gun's recoil kicks its view as a player's: weapons.js's amplitude on the aim point)
  const from = world.muzzle ? world.muzzle(s) : chestOf(s);
  let aim = intent.aim;
  let fire = intent.fire && !!aim && world.lineClear(from, aim);
  if (brain.ap) {
    // (an AutoPlayer's update, the game's own: an aim point drawn afresh under its noise round the led
    // target; the view turned toward it; a burst begun when the view line passes inside the weapon's
    // tolerance of where the target is, with its line of fire's flag, and held and let go by the weapon's
    // cadence. The target's place is its own, sight or none, for as long as the flag lasts)
    const e = intent.target ? (world.who?.(intent.target) ?? null) : null;
    let start = false;
    aim = null;
    if (e?.alive) {
      const at = chestOf(e);
      // (its weapon class's noise, by its side's scale where the round draws one: the world's `aimScale`)
      const noise = brain.apNoise * (world.aimScale ?? 1);
      viewStep(brain.apAim, brain.ap, { from, point: aimPoint(brain.ap, { from, at, vel: e.vel, noise, rand: brain.rand }), dt });
      const miss = viewMiss(brain.apAim, from, at);
      aim = viewPoint(brain.apAim, from, Math.max(AHEAD, miss.along));
      const flag = lofStep(brain.apLof, brain.ap, { clear: world.lineClear(from, at), now });
      start = !!intent.fire && flag && mayFire(brain.apClass, noise, miss);
    }
    fire = burstStep(brain.apBurst, brain.apClass, { start, now }) && !!aim;
  }
  const look = aim ?? (s.moving ? [s.at[0] + s.vel[0], 0, s.at[2] + s.vel[2]] : null);
  if (look) s.yaw = Math.atan2(look[0] - s.at[0], look[2] - s.at[2]);
  s.aim = aim;
  s.interact = !!intent.interact && !!intent.goal && d2(flat(s.at), intent.goal) < NEAR_GOAL + 2;
  // (a flashed bot fires nothing for the flash's 5 s: kit.js)
  const flashed = (s.flashedUntil ?? -Infinity) > now;
  // (an AutoPlayer's cadence is its burst's, above; the other bots' is their firing pattern's)
  const firing = brain.ap ? true : patternFire(brain, intent, fire && !flashed, dt);
  if (fire && firing && !flashed) {
    brain.fired = true;
    world.shoot(s, kickAim(s.gun, from, aim));
  }
}

// A bot's firing pattern over a sim step, as `WeaponControl.cpp` runs it (tactics.js): a bit an AI tick,
// the step running the ticks that fall in it; a bit holds the trigger down, a single pattern asking the gun
// for a shot at each press and an automatic one at every held tick, the gun's own rate deciding what fires;
// each burst's pattern drawn at the intensity it starts in. A bot that does not or may not fire ends its
// burst, so its next shot opens a fresh pattern (`soldierAimAndShoot`).
function patternFire(brain, intent, fire, dt) {
  if (!fire) {
    brain.pattern = null;
    brain.frame = 0;
    brain.ticks = 0;
    brain.held = false;
    return false;
  }
  brain.intensity = intensityFor({ fired: brain.fired, attacking: intent.mode === 'attack' || intent.mode === 'cover', tactics: brain.template.tactics });
  brain.ticks += dt / TICK;
  let any = false;
  // (a hair under one: a step of 0.05 s is 1.5 ticks in floating point, and must give one tick, then two)
  while (brain.ticks >= 1 - 1e-6) {
    brain.ticks -= 1;
    if (!brain.pattern) drawPattern(brain);
    const p = brain.pattern;
    const bit = patternStep(brain);
    if (pulls(p, bit, brain.held)) any = true;
    brain.held = bit;
  }
  return any;
}
