// A hero bot: the soldier's brain picks its target and its way there
// (soldierBrain.js), and this plays the hero on top, as the game's
// AutoPlayers in a hero kit do (bf2-re finding 28 §6, heroKit.json's `ai`):
// a saber hero runs at its mark rather than taking cover, fences on a cycle
// of attacking (3 to 5 s, striking from 2 to 5 m), guarding (2 to 4 s,
// its block up) and pausing (2 to 3 s), strafes now and then; any hero
// uses its abilities on a mark within 10 m (or the ability's own reach,
// whichever is more) when they are ready, and dodges a fifth of the times
// it is hurt. A blaster hero shoots as a soldier does. Pure.
//
//   heroIntent(sim, brain, s)        (the soldier brain's intent, bent for a saber hero: the mark itself the goal)
//   heroAct(sim, brain, s, now)      (the buttons: strike, block, jump, the abilities, the dodge)

import KIT from '../../../data/bf2017/heroKit.json';
import { press, state } from '../abilities.js';
import { heroInput, heroRoll } from '../heroKit.js';
import { roll } from '../soldier.js';

const AI = KIT.ai;
const between = (rand, [a, b]) => a + (b - a) * rand();
// How far off a blaster hero's bot uses what it throws, fires or raises, metres, where the ability's own
// numbers hold no range: by hand (the AutoPlayers' 10 m is the saber heroes' and a dash's).
const FAR = { charge: 20, thrown: 25, cloud: 25, barrage: 30, weaponSwap: 30, reveal: 20, deployShield: 30, selfShield: 30 };
const reachOf = (fx) => Math.max(AI.abilities, fx?.range ?? fx?.hand?.range ?? FAR[fx?.kind] ?? fx?.reach ?? 0);

function mindOf(brain, s) {
  if (brain.hero) return brain.hero;
  const r = brain.rand ?? Math.random;
  brain.hero = { phase: 'attack', until: 0, reach: between(r, AI.swordDistance), side: r() < 0.5 ? 1 : -1, nextAbility: 0, hurtSeen: s.lastHurt ?? -Infinity };
  return brain.hero;
}

const markOf = (sim, brain) => (brain.intent?.target ? sim.entities.get(brain.intent.target) : null);

export function heroIntent(sim, brain, s) {
  const H = s.hero;
  if (!H?.saber && !H?.lightning) return;
  const m = mindOf(brain, s);
  const t = markOf(sim, brain);
  const intent = brain.intent;
  if (!t?.alive) return;
  const d = Math.hypot(t.at[0] - s.at[0], t.at[2] - s.at[2]);
  // (to the mark itself, never to cover: in reach it stands and fences, circling a little in a pause)
  intent.stance = 'stand';
  intent.fire = false;
  intent.aim = [t.at[0], t.at[1] + 1.2, t.at[2]];
  intent.sprint = d > 10;
  if (d > m.reach || m.phase === 'attack') intent.goal = [t.at[0], t.at[2]];
  else if (m.phase === 'pause') {
    const a = Math.atan2(s.at[0] - t.at[0], s.at[2] - t.at[2]) + m.side * 0.6;
    intent.goal = [t.at[0] + Math.sin(a) * m.reach, t.at[2] + Math.cos(a) * m.reach];
  } else intent.goal = null;
}

export function heroAct(sim, brain, s, now) {
  const H = s.hero;
  if (!H || !s.alive) return;
  const m = mindOf(brain, s);
  const r = brain.rand ?? Math.random;
  const t = markOf(sim, brain);
  const d = t?.alive ? Math.hypot(t.at[0] - s.at[0], t.at[2] - s.at[2]) : Infinity;
  if (now >= m.until) {
    m.phase = m.phase === 'attack' ? 'guard' : m.phase === 'guard' ? 'pause' : 'attack';
    m.until = now + between(r, AI[m.phase]);
    m.reach = between(r, AI.swordDistance);
  }
  if (r() < AI.strafe) m.side = -m.side;
  // (face the mark; the strike's lunge closes the last metres)
  if (t?.alive && d < 15) s.yaw = Math.atan2(t.at[0] - s.at[0], t.at[2] - s.at[2]);
  const inReach = d <= m.reach + 0.5;
  const fire = (H.saber && m.phase === 'attack' && inReach) || (H.lightning && d <= 15 && m.phase !== 'pause');
  const aiming = Boolean(H.saber) && (m.phase === 'guard' || (m.phase === 'pause' && d < 8) || (now - (s.lastHurt ?? -Infinity) < 0.4 && !fire));
  heroInput(sim, s, { fire, aiming, jump: false }, now);
  // a dodge, a fifth of the times it is hurt (AP evasive moves: the dodge roll's 0.2)
  if ((s.lastHurt ?? -Infinity) > m.hurtSeen) {
    m.hurtSeen = s.lastHurt;
    if (r() < AI.dodge && press(s.abilities, 0, now).fired) {
      const a = (r() < 0.5 ? -1 : 1) * Math.PI * 0.5 + s.yaw;
      roll(s, [Math.sin(a), Math.cos(a)], now);
      heroRoll(s, now);
    }
  }
  // the abilities, on a mark in reach, one a poll
  if (!t?.alive || now < m.nextAbility) return;
  m.nextAbility = now + 1 + r() * 2;
  const ready = s.abilities.list.filter((a) => a.slot >= 1 && state(s.abilities, a.slot) === 'ready' && d <= reachOf(a.row.hero));
  if (!ready.length) return;
  const pick = ready[Math.floor(r() * ready.length)];
  s.aim = [t.at[0], t.at[1] + 1.2, t.at[2]];
  press(s.abilities, pick.slot, now);
}
