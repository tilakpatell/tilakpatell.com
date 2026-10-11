import { describe, expect, it } from 'vitest';
import { supremacy } from '../fixtures/modeLevels.js';
import { BLEED_SECONDS, SETUP_SECONDS, createMode, onEvent, tick, view } from './supremacy.js';

const soldier = (id, side, x, z) => ({ id, side, at: [x, 0, z], alive: true, interact: false });
const world = (soldiers) => ({ soldiers, alive: { attack: soldiers.filter((s) => s.side === 'attack').length, defend: soldiers.filter((s) => s.side === 'defend').length } });

describe('Supremacy’s ground half (Mode1)', () => {
  it('five command posts in their ObjectiveIndex order, each side’s reinforcements the level’s', () => {
    const m = createMode({ map: supremacy() });
    expect(m.objectives.map((o) => o.at[0])).toEqual([-80, -40, 0, 40, 80]);
    expect(m.objectives.every((o) => o.owner === null && o.seconds === 20)).toBe(true);
    expect(m.tickets).toEqual({ attack: 70, defend: 70 });
    expect(m.gaps).toContain('the capital ship’s boarding (MaxBoardingTickets 20) is not played');
  });

  it('one soldier takes a post in its CaptureDuration; neither side owns it while both stand on it', () => {
    const m = createMode({ map: supremacy() });
    tick(m, SETUP_SECONDS + 0.05);
    for (let t = 0; t < 21; t++) tick(m, 1, world([soldier('a', 'attack', -80, 0)]));
    expect(m.objectives[0].owner).toBe('attack');
    tick(m, 5, world([soldier('a', 'attack', -80, 0), soldier('d', 'defend', -80, 0)]));
    expect(m.objectives[0].owner).toBe('attack');
    expect(view(m).objectives[0].contested).toBe(true);
  });

  it('the side holding fewer posts bleeds, and a side out of reinforcements loses the ground', () => {
    const m = createMode({ map: supremacy() });
    tick(m, SETUP_SECONDS + 0.05);
    for (let t = 0; t < 21; t++) tick(m, 1, world([soldier('a', 'attack', -80, 0)]));
    const before = m.tickets.defend;
    tick(m, BLEED_SECONDS + 0.05, world([]));
    expect(m.tickets.defend).toBe(before - 1);
    expect(m.tickets.attack).toBe(70);
    for (let i = 0; i < 70; i++) onEvent(m, { type: 'down', side: 'defend' });
    tick(m, 0.05, world([]));
    expect(m.result).toEqual(expect.objectContaining({ winner: m.attack, why: 'reinforcements' }));
  });
});
