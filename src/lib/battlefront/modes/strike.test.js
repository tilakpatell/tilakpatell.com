import { describe, expect, it } from 'vitest';
import { strikeBombs, strikeCarry, strikeUnplaced } from '../fixtures/modeLevels.js';
import { INTERACT_REACH } from './objectives.js';
import { RETURN_SECONDS, ROUND_SECONDS, SETUP_SECONDS, createMode, force, onEvent, sideOf, spawnSets, tick, view } from './strike.js';

const live = (m) => {
  tick(m, SETUP_SECONDS + 0.05);
  expect(m.phase).toBe('live');
};
const soldier = (id, side, x, z) => ({ id, side, at: [x, 0, z], alive: true, interact: false });
const world = (soldiers) => ({ soldiers, alive: { attack: soldiers.filter((s) => s.side === 'attack').length, defend: soldiers.filter((s) => s.side === 'defend').length } });

describe('Strike (the Domination layer)', () => {
  it('reads who defends and the bomb sites from what the level wires into PF_Strike_Bombs', () => {
    const m = createMode({ map: strikeBombs() });
    expect([m.attack, m.defend]).toEqual([2, 1]);
    expect(m.objectives.map((o) => [o.type, o.at])).toEqual([['arm', [-60, 20]], ['arm', [-60, -20]]]);
    expect(sideOf(m, 2)).toBe('attack');
    expect(spawnSets(m).attack.every((id) => id.startsWith('strike_Logic:2'))).toBe(true);
  });

  it('plays two rounds with the sides swapped; the faster attack wins a round each', () => {
    const m = createMode({ map: strikeBombs() });
    live(m);
    tick(m, 100);
    force(m);
    tick(m, 0.05);
    expect(m.rounds).toEqual([expect.objectContaining({ attack: 2, winner: 2, why: 'objectives' })]);
    expect(m.phase).toBe('pause');
    tick(m, 60);
    live(m);
    expect([m.attack, m.defend]).toEqual([1, 2]);
    expect(m.objectives.every((o) => !o.done)).toBe(true);
    tick(m, 50);
    force(m);
    tick(m, 0.05);
    expect(m.result).toEqual(expect.objectContaining({ winner: 1, why: 'faster' }));
    expect(view(m).rounds).toHaveLength(2);
  });

  it('gives the round to the defenders when the clock runs out', () => {
    const m = createMode({ map: strikeBombs() });
    live(m);
    for (let t = 0; t < ROUND_SECONDS + 1; t += 1) tick(m, 1);
    expect(m.rounds[0]).toEqual(expect.objectContaining({ winner: 1, why: 'timer' }));
  });

  it('a carried objective drops where its carrier fell, and goes home after the record’s time (Review Focus 3)', () => {
    const m = createMode({ map: strikeCarry() });
    live(m);
    const [o] = m.objectives;
    expect(o.type).toBe('carry');
    tick(m, 0.05, world([soldier('a', 'attack', -40 + INTERACT_REACH / 2, 0)]));
    expect(o.carrier).toBe('a');
    tick(m, 0.05, world([soldier('a', 'attack', 10, 5)]));
    expect(o.at).toEqual([10, 5]);
    // the carrier down: it lies where they fell
    tick(m, 0.05, world([]));
    expect(o.carrier).toBe(null);
    expect(o.at).toEqual([10, 5]);
    tick(m, RETURN_SECONDS - 1, world([]));
    expect(o.at).toEqual([10, 5]);
    // picked up again before the time: the clock starts over when it next drops
    tick(m, 0.05, world([soldier('b', 'attack', 10, 5)]));
    expect(o.carrier).toBe('b');
    tick(m, 0.05, world([]));
    tick(m, RETURN_SECONDS - 1, world([]));
    expect(o.at).toEqual([10, 5]);
    tick(m, 1.1, world([]));
    expect(o.at).toEqual([-40, 0]);
    // carried into the drop-off, the round is the attackers'
    tick(m, 0.05, world([soldier('c', 'attack', -40, 0)]));
    tick(m, 0.05, world([soldier('c', 'attack', 90, 0)]));
    expect(m.rounds[0]).toEqual(expect.objectContaining({ winner: 2, why: 'objectives' }));
  });

  it('a defender cannot carry it', () => {
    const m = createMode({ map: strikeCarry() });
    live(m);
    tick(m, 0.05, world([soldier('d', 'defend', -40, 0)]));
    expect(m.objectives[0].carrier).toBe(null);
  });

  it('every death respawns: Strike’s sides have no tickets', () => {
    const m = createMode({ map: strikeBombs() });
    live(m);
    expect(onEvent(m, { type: 'down', side: 'defend' }).respawn).toBe(true);
    expect(onEvent(m, { type: 'down', side: 'attack' }).respawn).toBe(true);
  });

  it('refuses a map whose objective it cannot place, in plain words (Review Focus 2)', () => {
    expect(() => createMode({ map: strikeUnplaced() })).toThrow(/Strike can’t start on Fixture\/Strike: PF_Strike_Bombs is not placed/);
  });
});
