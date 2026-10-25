import { afterEach, describe, expect, it, vi } from 'vitest';
import { forceLock, inFlight, lockHeld, lockSpot } from './flight-probes.mjs';

const r9 = (...v) => v.map((x) => +x.toFixed(9));
afterEach(() => delete globalThis.window);
describe('flight-probes', () => {
  it('puts the lock 6 ahead, 0.6 up and 1.2 right of the ship', () => {
    expect(lockSpot({ x: 0, y: 0, z: 0, heading: 0 })).toEqual({ x: 1.2, y: 0.6, z: -6 });
    const p = lockSpot({ x: 10, y: 2, z: 5, heading: Math.PI / 2 });
    expect(r9(p.x, p.y, p.z)).toEqual([4, 2.6, 3.8]);
  });
  it('spawns a still TIE there, its clock stopped once, locked by hand', () => {
    const body = { id: 7, at: {}, prev: {}, vel: {} };
    const update = vi.fn();
    const h = { bodies: [], update, pack: vi.fn(() => h.bodies.push(body)) };
    const state = { ship: { x: 0, y: 0, z: 0, heading: 0 }, lock: null };
    let foot = null;
    globalThis.window = { __universeDebug: { state, hunters: h }, __universe: () => ({ foot, lock: state.lock?.id }) };
    const at = { x: 1.2, y: 0.6, z: -6 };
    forceLock(at);
    expect(forceLock(at)).toEqual({ id: 7, at: [1.2, 0.6, -6] });
    expect(h.pack).toHaveBeenCalledWith('empire', state.ship, { size: 1, ace: false, kinds: ['tie'], more: 0 });
    expect(body.prev).toEqual(at);
    expect(r9(body.vel.x, body.vel.z)).toEqual([-0.0024, 0.012]);
    expect([state.lock, lockHeld(7)]).toEqual([{ id: 7, out: 0, manual: true }, true]);
    h.update(0.05, 3, state.ship);
    expect(update.mock.calls).toEqual([[0, 3, state.ship]]);
    foot = { phase: 'walk' };
    expect(forceLock({})).toEqual({ skipped: 'on foot' });
  });
  it('counts the rounds and bolts in flight, not hidden ones', () => {
    const all = [[true, true], [false, true], [true, false], [true, undefined]].map(([visible, heavy]) => ({ isMesh: true, visible, userData: { heavy } }));
    globalThis.window = { __universeDebug: { scene: { traverse: (f) => all.forEach(f) } } };
    expect(inFlight()).toEqual({ rounds: 1, bolts: 1 });
  });
});
