// Supremacy's ground half (Mode1: UI/Data/GameModes/Mode1 "SUPREMACY",
// forty players): five command posts (PF_CapturePoint_Mode1, in their
// `ObjectiveIndex` order, each taken in its `CaptureDuration` by one
// soldier alone), each side's reinforcements the level's PF_UI_Mode1
// `MaxReinforcements`. A death costs its side one; the side holding fewer
// posts bleeds one every BLEED_SECONDS. A side out of reinforcements loses
// the ground. The capital ships' half (the boarding, PF_DestroyableObjective
// _Venator) is not played: `gaps` says so. Pure.
//
//   createMode({ rulebook, level, map }) → m
//   tick(m, dt, world)   onEvent(m, e)   view(m)   force(m)   and round.js's sideOf, teamOf, spawnSets, walkersOf, canRespawn

import { mapOf } from '../rulebook.js';
import { ADVANTAGE_MAX } from './objectives.js';
import { STAGE_SETUP } from './galacticAssault.js';
import { baseMode, finish, refuseUnplaced, sense, viewOf } from './round.js';

export { sideOf, spawnSets, teamOf, walkersOf } from './round.js';

export const SETUP_SECONDS = STAGE_SETUP;
// Where the level wires none: PF_CapturePoint_Mode1's CaptureDuration and PF_UI_Mode1's MaxReinforcements as Hoth_02 sets them
export const CAPTURE_DURATION = 20;
export const REINFORCEMENTS = 70;
// The bleed and the ground's longest round, by hand (the game's tug of war is a logic graph's; NOTES.md).
export const BLEED_SECONDS = 5;
export const ROUND_SECONDS = 1200;
// How near a post's middle a soldier stands on it, by hand (the post's capture volume is the prefab's own).
export const POST_REACH = 10;

const xz = (p) => [p[0], p[2]];
const clamp = (v) => Math.max(-1, Math.min(1, v));

// a command post: +1 the attackers' (team `attack`), −1 the defenders', 0 nobody's; whoever stands on it alone moves it
const post = {
  create({ at, seconds, index }) {
    return { type: 'capture', name: `post ${index}`, index, at, reach: POST_REACH, seconds, meter: 0, owner: null, contested: false, moving: null, done: false, tick: post.tick, view: post.view };
  },
  tick(o, dt, { inside }) {
    const net = (inside.attack ?? 0) - (inside.defend ?? 0);
    o.contested = (inside.attack ?? 0) > 0 && (inside.defend ?? 0) > 0;
    o.moving = net > 0 ? 'attack' : net < 0 ? 'defend' : null;
    if (net) o.meter = clamp(o.meter + (Math.sign(net) * Math.min(ADVANTAGE_MAX, Math.abs(net)) * dt) / o.seconds);
    if (o.meter >= 1 - 1e-9) o.owner = 'attack';
    else if (o.meter <= -1 + 1e-9) o.owner = 'defend';
    else if ((o.owner === 'attack' && o.meter <= 0) || (o.owner === 'defend' && o.meter >= 0)) o.owner = null;
    o.done = o.owner === 'attack';
  },
  view: (o) => ({ type: 'capture', name: o.name, meter: o.meter, owner: o.owner, contested: o.contested, armed: false, fuse: 0, progress: Math.abs(o.meter) }),
};

export function createMode({ rulebook = null, level = null, map = null }) {
  const m0 = map ?? mapOf(rulebook, level);
  refuseUnplaced(m0, 'supremacy', 'Supremacy');
  const mine = m0.prefabs.filter((p) => p.mode === 'supremacy');
  const posts = mine.filter((p) => /^PF_CapturePoint_Mode1$/i.test(p.name) && p.at).sort((a, b) => (a.inputs?.ObjectiveIndex ?? 0) - (b.inputs?.ObjectiveIndex ?? 0));
  if (!posts.length) throw new Error(`Supremacy can’t start on ${m0.level}: no command post placed`);
  const ui = mine.find((p) => /^PF_UI_Mode1$/i.test(p.name));
  const max = ui?.inputs?.MaxReinforcements ?? REINFORCEMENTS;
  const m = baseMode({ kind: 'supremacy', label: 'Supremacy', map: m0, level, attack: 1, setup: SETUP_SECONDS });
  m.objectives = posts.map((p, i) => post.create({ at: xz(p.at), seconds: p.inputs?.CaptureDuration ?? CAPTURE_DURATION, index: p.inputs?.ObjectiveIndex ?? i + 1 }));
  m.tickets = { attack: max, defend: max };
  m.bleed = 0;
  m.gaps = [`the capital ship’s boarding (MaxBoardingTickets ${ui?.inputs?.MaxBoardingTickets ?? '–'}) is not played`];
  return m;
}

export const canRespawn = (m, side) => !m.result && m.tickets[side] > 0;

export function onEvent(m, e) {
  if (e.type !== 'down' || m.result) return { respawn: false };
  m.tickets[e.side] = Math.max(0, m.tickets[e.side] - 1);
  return { respawn: m.tickets[e.side] > 0 };
}

export function tick(m, dt, world = { soldiers: [], alive: { attack: 0, defend: 0 } }) {
  m.out = [];
  m.time += dt;
  m.dt = dt;
  if (m.phase === 'over') return m.out;
  if (m.phase === 'setup') {
    m.timer -= dt;
    if (m.timer > 1e-9) return m.out;
    m.phase = 'live';
    m.stageTimer = ROUND_SECONDS;
    m.out.push({ type: 'stage', index: 0, id: 'ground' });
    return m.out;
  }
  sense(m, world.soldiers);
  const held = (side) => m.objectives.filter((o) => o.owner === side).length;
  const [a, d] = [held('attack'), held('defend')];
  if (a !== d) {
    m.bleed += dt;
    while (m.bleed >= BLEED_SECONDS - 1e-9) {
      m.bleed -= BLEED_SECONDS;
      const side = a < d ? 'attack' : 'defend';
      m.tickets[side] = Math.max(0, m.tickets[side] - 1);
    }
  } else m.bleed = 0;
  for (const side of ['attack', 'defend']) if (m.tickets[side] <= 0) return finish(m, side === 'attack' ? m.defend : m.attack, 'reinforcements'), m.out;
  m.stageTimer -= dt;
  if (m.stageTimer <= 0) finish(m, m.tickets.attack === m.tickets.defend ? null : m.tickets.attack > m.tickets.defend ? m.attack : m.defend, 'timer');
  return m.out;
}

export function force(m) {
  for (const o of m.objectives) {
    o.meter = 1;
    o.owner = 'attack';
    o.done = true;
  }
}

export const view = (m) => viewOf(m, { gaps: m.gaps });
