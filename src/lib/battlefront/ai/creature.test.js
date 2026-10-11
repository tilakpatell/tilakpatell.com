import { describe, expect, it } from 'vitest';
import CREATURES from '../../../data/bf2017/ai.creatures.json';
import { seeded } from '../../seeded.js';
import { createCreatureMind, settingsFor } from './creature.js';

const jawa = settingsFor('Actor_Jawa_01');
const path = [
  [0, 0],
  [10, 0],
  [10, 10],
];

function walk(mind, actor, player, seconds, dt = 0.1, rand = seeded(1)) {
  const out = [];
  for (let t = 0; t < seconds; t += dt) {
    const s = mind.step(dt, { player, waypoints: path, rand });
    if (s.to) {
      const d = Math.hypot(s.to[0] - actor.at[0], s.to[1] - actor.at[1]);
      const k = Math.min(1, (s.speed * dt) / (d || 1));
      actor.at = [actor.at[0] + (s.to[0] - actor.at[0]) * k, actor.at[1] + (s.to[1] - actor.at[1]) * k];
    }
    out.push({ ...s, at: [...actor.at] });
  }
  return out;
}

describe('the living world: a creature on its game settings', () => {
  it('finds an actor’s settings through its entity, and its reaction to a player', () => {
    expect(jawa).toBe(CREATURES.rows.settings.CLS_Jawa);
    expect(jawa.events.HumanPlayer).toMatchObject({ range: 4, probability: 1, cooldown: 4 });
    expect(settingsFor('CLS_Jawa')).toBe(jawa);
    expect(settingsFor('nobody')).toBe(null);
  });

  it('follows its waypoints at its slow speed with nobody near', () => {
    const actor = { at: [0, 0] };
    const mind = createCreatureMind(jawa, actor);
    const s = walk(mind, actor, null, 6);
    expect(s.every((x) => x.state === 'follow')).toBe(true);
    expect(s[0].speed).toBeLessThanOrEqual(jawa.speeds.slow.max);
    expect(actor.at[0]).toBeGreaterThan(3);
  });

  it('a player inside its consideration range: it acts on the first tick (probability 1); farther, nothing', () => {
    const actor = { at: [5, 0] };
    const mind = createCreatureMind(jawa, actor);
    const first = mind.step(0.1, { player: [5, 3], waypoints: path, rand: seeded(1) });
    expect(first.state).toBe('react');
    // (away from the player, quicker than its walk)
    expect(first.to[1]).toBeLessThan(0);
    expect(first.speed).toBeGreaterThan(jawa.speeds.slow.max);
    const far = createCreatureMind(jawa, { at: [5, 0] });
    expect(far.step(0.1, { player: [5, 4.5], waypoints: path, rand: seeded(1) }).state).toBe('follow');
  });

  it('goes back to its waypoints once the player has gone and its cooldown is over', () => {
    const actor = { at: [5, 0] };
    const mind = createCreatureMind(jawa, actor);
    walk(mind, actor, [5, 3], 1);
    const after = walk(mind, actor, null, 8);
    const back = after.findIndex((x) => x.state === 'follow');
    expect(back).toBeGreaterThan(0);
    expect(back * 0.1).toBeLessThanOrEqual(jawa.events.HumanPlayer.cooldown + 1e-9);
    expect(after.some((x) => x.state === 'return' || x.state === 'follow')).toBe(true);
  });

  it('a stop-and-look creature stands its stop delay, turned toward what it saw', () => {
    const humanoid = settingsFor('CLS_Humanoid');
    const odd = humanoid.events.UnknownEvent;
    expect(odd).toMatchObject({ action: 'StopAndAct', alignment: 'Towards', stopDelay: 4.5 });
    const mind = createCreatureMind({ ...humanoid, events: { HumanPlayer: { ...odd, probability: 1 } } }, { at: [0, 0] });
    const s = mind.step(0.1, { player: [0.5, 0], waypoints: null, rand: seeded(1) });
    expect(s).toMatchObject({ state: 'stop', speed: 0 });
    expect(s.face).toBeCloseTo(Math.PI / 2, 5);
  });
});
