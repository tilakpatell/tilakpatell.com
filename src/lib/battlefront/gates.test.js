import { describe, expect, it } from 'vitest';
import hoth from '../../data/bf2017/maps/hoth.json';
import { HOLD, OPEN_SECONDS, REACH, arrive, createGates, gateOf, openness, tick } from './gates.js';

const rows = () => hoth.rows.gates;
const WEST = 'FantasyBattle_Logic:91';
const EAST = 'FantasyBattle_Logic:307';
const holder = (at) => ({ at, alive: true, interact: true });

describe('Hoth’s hangar gates', () => {
  it('are the two the graph wires, each unlocked by the other side’s walker', () => {
    const g = createGates(rows());
    expect(g.list.map((x) => [x.id, x.unlock, x.barredBy])).toEqual([
      [EAST, 'FantasyBattle_Logic:303', ['FantasyBattle_Logic:123']],
      [WEST, 'FantasyBattle_Logic:123', ['FantasyBattle_Logic:303']],
    ]);
    expect(g.list.every((x) => x.state === 'locked' && x.panel)).toBe(true);
  });

  it('the first walker home unlocks its gate and bars the other', () => {
    const g = createGates(rows());
    expect(arrive(g, 'FantasyBattle_Logic:123')).toEqual([
      { type: 'gate', id: EAST, state: 'barred' },
      { type: 'gate', id: WEST, state: 'unlocked' },
    ]);
    // (the second home changes nothing)
    expect(arrive(g, 'FantasyBattle_Logic:303')).toEqual([]);
    expect(gateOf(g, EAST).state).toBe('barred');
  });

  it('a locked gate does not open, however long it is held', () => {
    const g = createGates(rows());
    const panel = gateOf(g, WEST).panel.at;
    for (let i = 0; i < 100; i++) tick(g, 0.1, [holder(panel)]);
    expect(gateOf(g, WEST).state).toBe('locked');
  });

  it('opens after a second’s hold within reach of its panel, then slides open over 1.5 s', () => {
    const g = createGates(rows());
    arrive(g, 'FantasyBattle_Logic:123');
    const w = gateOf(g, WEST);
    const by = [w.panel.at[0] + REACH - 0.1, w.panel.at[1], w.panel.at[2]];
    let opened = [];
    for (let t = 0; t < HOLD - 0.15; t += 0.1) opened = tick(g, 0.1, [holder(by)]);
    expect(w.state).toBe('unlocked');
    opened = tick(g, 0.2, [holder(by)]);
    expect(opened).toEqual([{ type: 'gate', id: WEST, state: 'opened' }]);
    tick(g, OPEN_SECONDS / 2, []);
    expect(openness(w)).toBeCloseTo(Math.sin(Math.PI / 4), 5);
    expect(tick(g, OPEN_SECONDS, [])).toEqual([{ type: 'gate', id: WEST, state: 'open' }]);
    expect(openness(w)).toBe(1);
  });

  it('a hold broken off, or out of reach, starts again', () => {
    const g = createGates(rows());
    arrive(g, 'FantasyBattle_Logic:123');
    const w = gateOf(g, WEST);
    tick(g, 0.6, [holder(w.panel.at)]);
    tick(g, 0.1, [{ ...holder(w.panel.at), interact: false }]);
    tick(g, 0.6, [holder(w.panel.at)]);
    expect(w.state).toBe('unlocked');
    tick(g, 2, [holder([w.panel.at[0] + REACH + 0.5, w.panel.at[1], w.panel.at[2]])]);
    expect(w.state).toBe('unlocked');
  });
});
