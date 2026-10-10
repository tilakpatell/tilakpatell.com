// A skirmish: two teams of bots on a navgrid, no mode, for the arena test
// and the balance runner. Counts what the arena asserts: kills, who is left,
// bots stuck (alive, not in cover or hiding, on one spot for STUCK_STEPS)
// and bots off the navgrid (checked every 100th step). Pure.
//
//   runSkirmish({ rulebook, nav, seed, bots, seconds, onStep }) → { kills, alive, stuck, offNav, events, sim }

import { STEP } from './core.js';
import { walkable } from './nav.js';
import { createSim, step } from './sim.js';

// 20 s at the step: the arena's "no bot stands still" rule.
export const STUCK_STEPS = 400;

export function runSkirmish({ rulebook, nav, seed = 1, bots = 20, seconds = 180, onStep = null }) {
  const sim = createSim({ rulebook, nav, seed, bots: { 1: bots, 2: bots } });
  const still = new Map();
  const stuck = new Set();
  let offNav = 0;
  const steps = Math.round(seconds / STEP);
  for (let i = 1; i <= steps; i++) {
    step(sim);
    for (const e of sim.entities.values()) {
      if (!e.alive) continue;
      const mode = e.brain?.intent?.mode;
      const was = still.get(e.id);
      if (was && was.x === e.at[0] && was.z === e.at[2]) {
        if (mode === 'cover' || mode === 'hide') was.n = 0;
        else if (++was.n >= STUCK_STEPS) stuck.add(e.id);
      } else still.set(e.id, { x: e.at[0], z: e.at[2], n: 0 });
      if (i % 100 === 0 && !walkable(nav, e.at[0], e.at[2])) offNav++;
    }
    onStep?.(sim, i);
  }
  const alive = { 1: 0, 2: 0 };
  for (const e of sim.entities.values()) if (e.alive) alive[e.team]++;
  return { kills: { 1: sim.score[1].kills, 2: sim.score[2].kills }, alive, stuck: stuck.size, offNav, events: sim.events, sim };
}
