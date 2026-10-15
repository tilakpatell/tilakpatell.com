import { describe, expect, it } from 'vitest';
import hoth from '../../data/bf2017/maps/hoth.json';
import { ANGLE, HOLD, OPEN_SECONDS, PASS, REACH, SCALE, arrive, canUse, createGates, gap, gateOf, openness, reachOf, tick } from './gates.js';

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

  it('the first walker home unlocks the other gate’s panel and blows its own a second later', () => {
    const g = createGates(rows());
    expect(gateOf(g, EAST).blownBy).toEqual([{ path: 'FantasyBattle_Logic:123', after: 1 }]);
    expect(arrive(g, 'FantasyBattle_Logic:123')).toEqual([
      { type: 'gate', id: EAST, state: 'barred' },
      { type: 'gate', id: WEST, state: 'unlocked' },
    ]);
    // (the second home changes nothing)
    expect(arrive(g, 'FantasyBattle_Logic:303')).toEqual([]);
    expect(gateOf(g, EAST).state).toBe('barred');
    expect(tick(g, 0.9, [])).toEqual([]);
    expect(tick(g, 0.2, [])).toEqual([
      { type: 'gate', id: EAST, state: 'blown' },
      { type: 'gate', id: EAST, state: 'passable' },
    ]);
    expect(openness(gateOf(g, EAST))).toBe(1);
    expect(gateOf(g, WEST).state).toBe('unlocked');
  });

  it('a locked gate does not open, however long it is held', () => {
    const g = createGates(rows());
    const panel = gateOf(g, WEST).panel.at;
    for (let i = 0; i < 100; i++) tick(g, 0.1, [holder(panel)]);
    expect(gateOf(g, WEST).state).toBe('locked');
  });

  it('reads the panel’s interaction off the button: 2 m on a transform scaled 3×, 90° off its facing, a second', () => {
    const w = gateOf(createGates(rows()), WEST);
    expect(w.interact).toMatchObject({ distance: REACH, scale: SCALE, angle: ANGLE, hold: HOLD });
    expect(reachOf(w)).toBe(6);
    // (the panel faces the field, +z, where the attackers stand)
    expect(w.panel.yaw).toBe(0);
  });

  it('is held from in front of the panel within its reach, never from behind it', () => {
    const w = gateOf(createGates(rows()), WEST);
    const [x, y, z] = w.panel.at;
    // (the field's floor by the door's jamb, 4.5 m off: the game's nearest in front)
    expect(canUse(w, [187.43, 359, -1568.55])).toBe(true);
    expect(canUse(w, [x, y, z + 5.9])).toBe(true);
    expect(canUse(w, [x, y, z + 6.1])).toBe(false);
    // (the base's floor behind the wall, 0.6 m off: behind the panel's facing)
    expect(canUse(w, [189.5, 359.27, -1572.42])).toBe(false);
  });

  it('reads the leaves’ run off the gate: 70 s and 8.96 m a leaf where the door controller says 1.5 s, Sine EaseOut', () => {
    const w = gateOf(createGates(rows()), WEST);
    expect(w.door).toMatchObject({ seconds: 70, slide: 8.96, curve: 'Sine', mode: 'EaseOut' });
    // (shut, the leaves reach past the middle by their meshes: 1.018 m and 0.997 m)
    expect(w.door.overlap).toBeCloseTo(2.015, 2);
  });

  it('opens after a second’s hold within reach of its panel, a soldier’s way through 6.5 s in, wide open at 70 s', () => {
    const g = createGates(rows());
    arrive(g, 'FantasyBattle_Logic:123');
    const w = gateOf(g, WEST);
    const by = [w.panel.at[0], w.panel.at[1], w.panel.at[2] + reachOf(w) - 0.1];
    let opened = [];
    for (let t = 0; t < HOLD - 0.15; t += 0.1) opened = tick(g, 0.1, [holder(by)]);
    expect(w.state).toBe('unlocked');
    // (the east gate, blown by the walker home a second after, says its own)
    const west = (events) => events.filter((e) => e.id === WEST);
    opened = tick(g, 0.2, [holder(by)]);
    expect(west(opened)).toEqual([{ type: 'gate', id: WEST, state: 'opened' }]);
    // (the leaves 2 m apart overlap still: no way through till they have slid that and a soldier more)
    expect(west(tick(g, 6.3, []))).toEqual([]);
    expect(gap(w)).toBeLessThan(PASS);
    expect(west(tick(g, 0.4, []))).toEqual([{ type: 'gate', id: WEST, state: 'passable' }]);
    expect(gap(w)).toBeGreaterThanOrEqual(PASS);
    tick(g, 35 - 6.7, []);
    expect(openness(w)).toBeCloseTo(Math.sin(Math.PI / 4), 5);
    expect(west(tick(g, 35, []))).toEqual([{ type: 'gate', id: WEST, state: 'open' }]);
    expect(openness(w)).toBe(1);
  });

  it('a gate whose row has no run slides over the controller’s own 1.5 s, passable once open', () => {
    const g = createGates(rows().map((r) => ({ ...r, door: null })));
    arrive(g, 'FantasyBattle_Logic:123');
    const w = gateOf(g, WEST);
    tick(g, 1.1, [holder(w.panel.at.map((v, i) => (i === 2 ? v + 3 : v)))]);
    expect(w.state).toBe('opening');
    expect(tick(g, OPEN_SECONDS, []).filter((e) => e.id === WEST)).toEqual([
      { type: 'gate', id: WEST, state: 'passable' },
      { type: 'gate', id: WEST, state: 'open' },
    ]);
  });

  it('a hold broken off, or out of reach, starts again', () => {
    const g = createGates(rows());
    arrive(g, 'FantasyBattle_Logic:123');
    const w = gateOf(g, WEST);
    tick(g, 0.6, [holder(w.panel.at)]);
    tick(g, 0.1, [{ ...holder(w.panel.at), interact: false }]);
    tick(g, 0.6, [holder(w.panel.at)]);
    expect(w.state).toBe('unlocked');
    tick(g, 2, [holder([w.panel.at[0], w.panel.at[1], w.panel.at[2] + reachOf(w) + 0.5])]);
    expect(w.state).toBe('unlocked');
  });
});
