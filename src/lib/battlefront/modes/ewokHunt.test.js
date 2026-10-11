import { describe, expect, it } from 'vitest';
import { ewokHunt } from '../fixtures/modeLevels.js';
import { EWOK_HEALTH, EXTRACTION_AT, ROUND_SECONDS, SETUP_SECONDS, TROOPER_HEALTH, createMode, onEvent, tick } from './ewokHunt.js';

const soldier = (id, side, x, z) => ({ id, side, at: [x, 0, z], alive: true, interact: false });
const world = (soldiers) => ({ soldiers, alive: { attack: soldiers.filter((s) => s.side === 'attack').length, defend: soldiers.filter((s) => s.side === 'defend').length } });

describe('Ewok Hunt (Mode3)', () => {
  it('the night’s two sides on their kits’ health: the stormtroopers survive, the Ewoks hunt', () => {
    const m = createMode({ map: ewokHunt() });
    expect(m.health).toEqual({ [m.attack]: TROOPER_HEALTH, [m.defend]: EWOK_HEALTH });
    expect([TROOPER_HEALTH, EWOK_HEALTH]).toEqual([200, 80]);
  });

  it('a stormtrooper killed joins the Ewoks (Review Focus 4)', () => {
    const m = createMode({ map: ewokHunt() });
    tick(m, SETUP_SECONDS + 0.05);
    expect(onEvent(m, { type: 'down', side: 'attack' })).toEqual({ respawn: true, joins: m.defend });
    expect(onEvent(m, { type: 'down', side: 'defend' })).toEqual({ respawn: true });
  });

  it('the extraction opens on the record’s time, and a survivor in it when the night ends wins it (Review Focus 4)', () => {
    const m = createMode({ map: ewokHunt() });
    tick(m, SETUP_SECONDS + 0.05);
    const hidden = world([soldier('t', 'attack', 50, 50)]);
    tick(m, ROUND_SECONDS - EXTRACTION_AT - 1, hidden);
    expect(m.objectives).toHaveLength(0);
    tick(m, 1.1, hidden);
    expect(m.objectives.map((o) => o.type)).toEqual(['hold']);
    const out = world([soldier('t', 'attack', m.objectives[0].at[0], m.objectives[0].at[1])]);
    for (let t = 0; t < EXTRACTION_AT + 1 && !m.result; t++) tick(m, 1, out);
    expect(m.result).toEqual(expect.objectContaining({ winner: m.attack, why: 'extracted' }));
  });

  it('the Ewoks win when no stormtrooper is left, and the night is over on its clock either way', () => {
    const m = createMode({ map: ewokHunt() });
    tick(m, SETUP_SECONDS + 0.05);
    tick(m, 1, world([soldier('e', 'defend', 0, 0)]));
    expect(m.result).toEqual(expect.objectContaining({ winner: m.defend, why: 'wiped' }));
    const n = createMode({ map: ewokHunt() });
    tick(n, SETUP_SECONDS + 0.05);
    for (let t = 0; t < ROUND_SECONDS + 2 && !n.result; t++) tick(n, 1, world([soldier('t', 'attack', 50, 50)]));
    expect(n.result).toEqual(expect.objectContaining({ winner: n.defend, why: 'timer' }));
    expect(n.time).toBeLessThanOrEqual(SETUP_SECONDS + ROUND_SECONDS + 2);
  });
});
