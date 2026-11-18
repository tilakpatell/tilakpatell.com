import { describe, expect, it } from 'vitest';
import { ACTIONS, ORE_CAP, STORM, act, actionOf, createLedger, inBeam, stormDrain, wormholeThrows } from './rules';

describe('what a thing lets you do', () => {
  it('pays salvage and scans once a visit, ore up to five rocks a field', () => {
    const l = createLedger();
    expect(act(l, { kind: 'derelict', id: 'a', traits: { trap: true } })).toEqual({ verb: 'salvage', pay: 2, trap: true });
    expect(act(l, { kind: 'derelict', id: 'a' }).pay).toBe(0);
    expect(act(l, { kind: 'monolith', id: 'm', traits: { lore: 3 } })).toEqual({ verb: 'scan', pay: 3, lore: 3 });
    expect(act(l, { kind: 'monolith', id: 'm', traits: { lore: 3 } }).lore).toBeUndefined();
    const ore = Array.from({ length: 8 }, () => act(l, { kind: 'field', id: 'f' }).pay);
    expect(ore.reduce((a, b) => a + b, 0)).toBe(ORE_CAP);
    expect(act(l, { kind: 'beacon', id: 'b', traits: { leads: 'distress' } })).toEqual({ verb: 'follow', pay: 0, leads: 'distress' });
    expect(act(l, { kind: 'fleet', id: 'x', hostile: true }).hostile).toBe(true);
    expect(actionOf('storm')).toBeNull();
    expect(act(l, { kind: 'pocket', id: 'p' })).toBeNull();
    for (const a of Object.values(ACTIONS)) expect(a.times).toBeGreaterThanOrEqual(0);
  });
  it('drains the shields in a storm, never below ten, and never from below ten', () => {
    expect(stormDrain(100, 1)).toBe(100 - STORM.drain);
    expect(stormDrain(11, 1)).toBe(STORM.floor);
    expect(stormDrain(5, 1)).toBe(5);
  });
  it('scrambles in a pulsar’s beam, and throws from a wormhole only by hand', () => {
    expect(inBeam([[1, 0, 0]], [0, 0, 0], [500, 10, 0], 50)).toBe(true);
    expect(inBeam([[1, 0, 0]], [0, 0, 0], [0, 500, 0], 50)).toBe(false);
    expect(inBeam([[1, 0, 0]], [0, 0, 0], [5000, 0, 0], 50)).toBe(false);
    const w = { at: [0, 0, 0], size: 100 };
    expect(wormholeThrows(w, [10, 0, 0])).toBe(true);
    expect(wormholeThrows(w, [10, 0, 0], { travelling: true })).toBe(false);
    expect(wormholeThrows(w, [60, 0, 0])).toBe(false);
  });
});
