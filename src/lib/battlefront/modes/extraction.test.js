import { describe, expect, it } from 'vitest';
import { extraction } from '../fixtures/modeLevels.js';
import { SETUP_SECONDS, createMode, tick, view } from './extraction.js';

const soldier = (id, side, x, z) => ({ id, side, at: [x, 0, z], alive: true, interact: false });
const world = (soldiers) => ({ soldiers, alive: { attack: soldiers.filter((s) => s.side === 'attack').length, defend: soldiers.filter((s) => s.side === 'defend').length } });

describe('Extraction (Mode5)', () => {
  it('reads the cargo, its checkpoints and their times from the level', () => {
    const m = createMode({ map: extraction() });
    expect(m.objectives).toHaveLength(1);
    expect(m.objectives[0]).toMatchObject({ type: 'carry', home: [-90, 0], to: [-30, 0] });
    expect(m.checkpoints.map((c) => [c.at, c.seconds])).toEqual([[[-30, 0], 240], [[30, 0], 270], [[90, 0], 300]]);
  });

  it('a checkpoint reached gives the next one’s time; the last one carried home wins', () => {
    const m = createMode({ map: extraction() });
    tick(m, SETUP_SECONDS + 0.05);
    expect(view(m).timer).toBeCloseTo(240, 0);
    tick(m, 0.05, world([soldier('a', 'attack', -90, 0)]));
    tick(m, 100, world([soldier('a', 'attack', -30, 0)]));
    tick(m, 0.05, world([soldier('a', 'attack', -30, 0)]));
    expect(m.checkpoint).toBe(1);
    expect(view(m).timer).toBeCloseTo(270, 0);
    tick(m, 0.05, world([soldier('a', 'attack', 30, 0)]));
    tick(m, 0.05, world([soldier('a', 'attack', 30, 0)]));
    expect(view(m).timer).toBeCloseTo(300, 0);
    tick(m, 0.05, world([soldier('a', 'attack', 90, 0)]));
    tick(m, 0.05, world([soldier('a', 'attack', 90, 0)]));
    expect(m.result).toEqual(expect.objectContaining({ winner: m.attack, why: 'objectives' }));
  });

  it('ends within its own time: the clock out, the defenders hold', () => {
    const m = createMode({ map: extraction() });
    tick(m, SETUP_SECONDS + 0.05);
    for (let t = 0; t <= 241 && !m.result; t++) tick(m, 1, world([]));
    expect(m.result).toEqual(expect.objectContaining({ winner: m.defend, why: 'timer' }));
    expect(m.time).toBeLessThan(SETUP_SECONDS + 242);
  });
});
