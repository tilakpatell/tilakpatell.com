// The sim's bots: a brain each, squads, and what the battle does to them.
// Each bot senses every SENSE s and thinks every THINK s on a phase of its
// own drawn from the sim's seed (so the stagger is the seed's, not the
// order bots were made in), and acts every step; squads update every SQUAD
// s. A near miss fills the target's suppression by the shooter's
// `SuppressionValue` and it fades over the target's `SuppressionTime`; a
// hit or a near miss tells the target where the shot came from; a first
// sight of an enemy is passed to the squad as an alert. Every bot has a name
// from the game's lists (`names.js`, by its team's faction and the sim's
// `namesMode`, Skirmish by default), kept by its id across redeploys. Pure.
//
//   createBrains(sim) → { brains: Map, squads, taken, add(s), remove(id) }
//   addBrain(sim, s) (a bot deployed after the start)
//   stepBrains(sim)          onEvents(sim, boltEvents)

import { sense } from '../../ai/perception.js';
import { SENSE, SQUAD, STEP, THINK, clock, muzzleOf, profile, shoot } from '../core.js';
import { aiOf } from '../rulebook.js';
import { lineClear, shields } from '../nav.js';
import { chestOf, eyeOf } from '../soldier.js';
import { act, createBrain, think } from './soldierBrain.js';
import { alert, createSquads, deliver, squadOf, update } from './squad.js';
import { factionOf, nameFor } from './names.js';

// The suppression a player's shots give, with no tactics row of their own: the Rebel soldier's.
const PLAYER_TACTICS = 'AIRebelSoldierTactics';

const toV = (a) => ({ x: a[0], y: a[1], z: a[2] });

// a bot's name, the same each time it deploys (its own seeded draw: the battle's `rand` is untouched)
function nameOf(sim, s) {
  sim.botNames ??= new Map();
  sim.namesTaken ??= new Set();
  if (!sim.botNames.has(s.id)) sim.botNames.set(s.id, nameFor(factionOf(sim.teams?.[s.team], sim.era), sim.namesMode ?? 'skirmish', sim.seed * 2 + s.team, sim.namesTaken));
  return sim.botNames.get(s.id);
}

function brainFor(sim, ai, s) {
  s.name = nameOf(sim, s);
  const brain = createBrain(s, { ai, rand: sim.rand, aimScale: sim.aimScale ?? 1, difficulty: sim.difficulty ?? null, pve: !!sim.pve });
  brain.name = s.name;
  brain.nextSense = sim.time + sim.rand() * SENSE;
  brain.nextThink = sim.time + sim.rand() * THINK;
  s.brain = brain;
  return brain;
}

export function addBrain(sim, s) {
  const B = sim.brains;
  const b = brainFor(sim, B.ai, s);
  B.brains.set(s.id, b);
  return b;
}

export function createBrains(sim) {
  const ai = aiOf(sim.rb);
  const brains = new Map();
  for (const s of sim.entities.values()) if (s.bot) brains.set(s.id, brainFor(sim, ai, s));
  // each team's objective for the skirmish: where the other team started
  const objective = {};
  for (const team of [1, 2]) {
    const them = [...sim.entities.values()].filter((e) => e.team !== team);
    objective[team] = them.length ? [them.reduce((n, e) => n + e.at[0], 0) / them.length, them.reduce((n, e) => n + e.at[2], 0) / them.length] : null;
  }
  const out = {
    ai,
    brains,
    squads: createSquads(sim),
    nextSquad: sim.rand() * SQUAD,
    objective,
    taken: new Map(),
    add() {},
    remove(id) {
      const b = brains.get(id);
      if (b?.cover && out.taken.get(b.cover) === id) out.taken.delete(b.cover);
      brains.delete(id);
    },
  };
  return out;
}

function worldFor(sim, b, s) {
  const sq = squadOf(sim.brains.squads, s.id);
  const leader = sq?.leader ? sim.entities.get(sq.leader) : null;
  return {
    nav: sim.nav,
    lineClear: (a, c) => lineClear(sim.nav, a, c),
    shields,
    squad: sq,
    leaderAt: leader ? [leader.at[0], leader.at[2]] : null,
    objective: b.task?.at ?? sim.objective?.[s.team] ?? sim.brains.objective[s.team],
    task: b.task ?? null,
    enemies: sim.cache.enemies[s.team],
    others: sim.cache.all,
    taken: sim.brains.taken,
    muzzle: muzzleOf,
    shoot: (who, aim) => shoot(sim, who, aim),
    who: (id) => sim.entities.get(id) ?? null,
  };
}

function perceive(sim, b, s) {
  const eye = eyeOf(s);
  b.me.pos = toV(eye);
  b.me.dir = { x: Math.sin(s.yaw), y: 0, z: Math.cos(s.yaw) };
  const before = new Set(Object.keys(b.me.beliefs).filter((id) => b.me.beliefs[id].visible));
  sense(b.senses, b.me, { targets: sim.cache.targets[s.team] }, SENSE, { seesThrough: (a, c) => lineClear(sim.nav, [a.x, a.y, a.z], [c.x, c.y, c.z]) });
  for (const [id, belief] of Object.entries(b.me.beliefs)) {
    if (!belief.visible || before.has(id) || b.alerted.has(id)) continue;
    b.alerted.add(id);
    alert(sim.brains.squads, s, { id, at: [belief.at.x, belief.at.y, belief.at.z] }, sim.time);
  }
}

// what every brain reads this step, gathered once
function gather(sim) {
  const all = [];
  const targets = { 1: [], 2: [] };
  const enemies = { 1: [], 2: [] };
  for (const e of sim.entities.values()) {
    all.push(e);
    if (!e.alive) continue;
    // a walker is a target only while a bombing run has it open
    if (e.kind === 'walker' && !e.vulnerable) continue;
    const t = { id: e.id, at: toV(chestOf(e)), vel: { x: e.vel[0], y: 0, z: e.vel[2] }, hostile: true };
    const other = e.team === 1 ? 2 : 1;
    targets[other].push(t);
    if (e.kind === 'soldier') enemies[other].push([e.at[0], e.at[2]]);
  }
  sim.cache = { all, targets, enemies };
}

export function stepBrains(sim) {
  const B = sim.brains;
  if (!B) return;
  gather(sim);
  if (sim.time >= B.nextSquad) {
    update(B.squads, sim);
    B.nextSquad += SQUAD;
  }
  deliver(B.squads, sim, sim.time);
  for (const [id, b] of B.brains) {
    const s = sim.entities.get(id);
    if (!s?.alive) {
      if (b.cover && B.taken.get(b.cover) === id) B.taken.delete(b.cover);
      continue;
    }
    const fade = b.tactics.suppression?.time ?? 10;
    s.suppressed = Math.max(0, s.suppressed - STEP / fade);
    if (sim.time >= b.nextSense) {
      perceive(sim, b, s);
      b.nextSense += SENSE;
    }
    const world = worldFor(sim, b, s);
    if (sim.time >= b.nextThink) {
      const was = b.cover;
      const t0 = clock();
      think(b, world, sim.time);
      if (profile.on) profile.think += clock() - t0;
      if (was && was !== b.cover && B.taken.get(was) === id) B.taken.delete(was);
      if (b.cover) B.taken.set(b.cover, id);
      b.nextThink += THINK;
      sim.thinks = (sim.thinks ?? 0) + 1;
    }
    act(b, b.intent, s, STEP, world, sim.time);
  }
}

// a felt shot: the target now believes in the shooter, where it fired from
function felt(sim, target, shooter, from) {
  const b = target.brain;
  if (!b || !shooter) return;
  const mine = b.me.beliefs[shooter.id];
  if (mine && mine.confidence >= 0.6) return;
  b.me.beliefs[shooter.id] = { id: shooter.id, at: toV(from), vel: { x: 0, y: 0, z: 0 }, seenAt: -Infinity, heardAt: b.me.now ?? 0, confidence: 0.6, visible: false, timer: 0, kind: null, faction: null, hostile: true };
}

export function onEvents(sim, events) {
  const ai = sim.brains?.ai;
  if (!ai) return;
  for (const e of events) {
    if (e.type !== 'near' && e.type !== 'hit') continue;
    const target = sim.entities.get(e.target);
    if (!target?.alive) continue;
    const shooter = sim.entities.get(e.bolt.owner);
    felt(sim, target, shooter, e.bolt.from);
    if (e.type === 'near') {
      const tactics = shooter?.brain?.tactics ?? ai.tactics[PLAYER_TACTICS];
      target.suppressed = Math.min(1, target.suppressed + (tactics.suppression?.value ?? 0));
    }
  }
}
