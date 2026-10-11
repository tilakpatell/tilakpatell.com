// A Galactic Assault with no player, for the arena test and the balance
// runner: twenty bots a side on a navgrid, stepped until the round has a
// result or the clock runs out. Counts what the arena asserts, as the
// skirmish does: bots stuck (alive, not in cover, hiding or at a prop, on
// one spot for STUCK_STEPS) and bots off the navgrid. Pure.
//
//   runAssault({ rulebook, nav, seed, bots, minutes, onStep, mode, level, teams }) → { result, stage, minutes, kills, heroes, stuck, offNav, events, sim }
//   (mode: any of modes/index.js's, on its level; bots: a number a side, or { 1: n, 2: n })

import { STEP } from './core.js';
import { walkable } from './nav.js';
import { STUCK_STEPS } from './skirmish.js';
import { createSim, step } from './sim.js';

const STILL_OK = new Set(['cover', 'hide', 'interact']);
// (a bot fled to its flee query's cover slot is in cover there: the retreat's own spot)
const atFleeCover = (e) => e.brain?.intent?.mode === 'flee' && e.brain.intent.goal && Math.hypot(e.brain.intent.goal[0] - e.at[0], e.brain.intent.goal[1] - e.at[2]) <= 1.5;

export function runAssault({ rulebook, nav, seed = 1, bots = 20, minutes = 25, onStep = null, mode = 'galacticAssault', level = 'hoth', teams = null }) {
  const sim = createSim({ rulebook, nav, seed, bots: typeof bots === 'number' ? { 1: bots, 2: bots } : bots, mode, level, teams });
  const steps = Math.round((minutes * 60) / STEP);
  const heroes = { 1: 0, 2: 0 };
  const still = new Map();
  const stuck = new Set();
  let offNav = 0;
  for (let i = 1; i <= steps && !sim.ga.result; i++) {
    for (const e of step(sim)) if (e.type === 'deploy' && e.kind === 'hero') heroes[sim.entities.get(e.id).team]++;
    for (const e of sim.entities.values()) {
      if (!e.alive || e.kind !== 'soldier') continue;
      const was = still.get(e.id);
      if (was && was.x === e.at[0] && was.z === e.at[2]) {
        if (STILL_OK.has(e.brain?.intent?.mode) || atFleeCover(e)) was.n = 0;
        else if (++was.n >= STUCK_STEPS) stuck.add(e.id);
      } else still.set(e.id, { x: e.at[0], z: e.at[2], n: 0 });
      if (i % 100 === 0 && !walkable(nav, e.at[0], e.at[2])) offNav++;
    }
    onStep?.(sim, i);
  }
  return { result: sim.ga.result, stage: sim.ga.stage, minutes: sim.time / 60, kills: { 1: sim.score[1].kills, 2: sim.score[2].kills }, heroes, stuck: stuck.size, offNav, events: sim.events, sim };
}
