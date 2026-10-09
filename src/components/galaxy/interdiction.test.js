import { describe, expect, it } from 'vitest';
import { EDGE } from './space';
import { INTERDICTION, createInterdiction, cutAt, dropPoint, holdLifts, interdictionFor, inWell, interdictorPlace, interdictorSolids, nextWindow, pickDue, readCount } from './interdiction';

// a store over a string, as sessionStorage is
const memory = (s = null) => {
  let v = s;
  return { get: () => v, set: (x) => (v = x) };
};
const always = (v) => () => v;
const [LO, HI] = INTERDICTION.jumps;

describe('the Empire’s count of your jumps', () => {
  it('picks the jump that bites from the spec’s range, whatever the dice say', () => {
    expect(pickDue(always(0))).toBe(LO);
    expect(pickDue(always(0.999999))).toBe(HI);
    expect(pickDue(always(0.5))).toBeGreaterThanOrEqual(LO);
    expect(pickDue(always(0.5))).toBeLessThanOrEqual(HI);
    expect(LO).toBe(10);
    expect(HI).toBe(15);
  });

  it('bites on the due jump, not before, and starts over after', () => {
    const i = createInterdiction({ rand: always(0) }); // due: the tenth
    expect(i.due).toBe(10);
    for (let n = 1; n < 10; n++) expect(i.jumped(), `jump ${n}`).toEqual({ n, due: 10, interdicted: false });
    expect(i.jumped()).toEqual({ n: 10, due: 10, interdicted: true });
    // a new cycle: counted from nought, with its own number
    expect(i.jumps).toBe(0);
    expect(i.total).toBe(10);
    expect(i.jumped()).toEqual({ n: 1, due: 10, interdicted: false });
  });

  it('keeps the count in its store, and reads it back', () => {
    const store = memory();
    const a = createInterdiction({ rand: always(0.5), store });
    a.jumped();
    a.jumped();
    expect(store.get()).toBe(JSON.stringify({ n: 2, due: a.due }));
    const b = createInterdiction({ rand: always(0), store });
    expect(b.jumps).toBe(2);
    expect(b.due).toBe(a.due);
    b.reset();
    expect(store.get()).toBe(null);
    expect(b.jumps).toBe(0);
  });

  it('starts a fresh cycle from anything it can’t believe', () => {
    for (const bad of [null, '', 'x', '{}', '[]', '{"n":-3,"due":12}', '{"n":99,"due":2}', '{"n":4,"due":40}', '{"n":"4","due":12}', '{"n":12,"due":12}', '{"n":2.5,"due":12}']) {
      expect(readCount(bad, always(0)), String(bad)).toEqual({ n: 0, due: 10 });
    }
    expect(readCount('{"n":4,"due":12}')).toEqual({ n: 4, due: 12 });
    expect(readCount('{"n":0,"due":15}')).toEqual({ n: 0, due: 15 });
    // a store that throws (private mode) is no store
    const broken = {
      get: () => {
        throw new Error('no');
      },
      set: () => {
        throw new Error('no');
      },
    };
    const i = createInterdiction({ rand: always(0), store: broken });
    expect(i.jumped()).toEqual({ n: 1, due: 10, interdicted: false });
  });

  it('brings the window on two jumps sooner after a jump off the lanes', () => {
    expect(INTERDICTION.offLane).toBe(2);
    expect(nextWindow(8, true)).toBe(nextWindow(10, false));
    expect(nextWindow(10, false)).toBe(10);
    expect(nextWindow(7)).toBe(7);
    // a cycle due on the tenth: the eighth jump bites off the lanes, not on them
    const on = createInterdiction({ rand: always(0) });
    const off = createInterdiction({ rand: always(0) });
    for (let n = 1; n < 8; n++) {
      on.jumped(false);
      off.jumped();
    }
    expect(on.jumped(false)).toEqual({ n: 8, due: 10, interdicted: false });
    expect(off.jumped(true)).toEqual({ n: 8, due: 10, interdicted: true });
    expect(off.jumps).toBe(0);
  });

  it('can be made to bite on the next jump, for checking in a browser', () => {
    const i = createInterdiction({ rand: always(0.5) });
    i.jumped();
    i.force();
    expect(i.due).toBe(2);
    expect(i.jumped().interdicted).toBe(true);
  });
});

describe('where it bites', () => {
  it('cuts the tunnel in its middle, never before it’s built nor after it would have ended', () => {
    const [lo, hi] = INTERDICTION.cut;
    expect(cutAt(4.2, always(0))).toBeCloseTo(4.2 * lo);
    expect(cutAt(4.2, always(1))).toBeCloseTo(4.2 * hi);
    // the shortest jump there is: built first, out before the end
    expect(cutAt(1.8, always(0))).toBeGreaterThanOrEqual(1.2);
    expect(cutAt(1.8, always(1))).toBeLessThan(1.8);
    for (const d of [1.8, 2.4, 3.1, 4.2]) {
      for (const r of [0, 0.3, 0.7, 1]) {
        const c = cutAt(d, always(r));
        expect(c).toBeGreaterThanOrEqual(1.2);
        expect(c).toBeLessThan(d);
      }
    }
  });

  it('drops you out a long way short, on the arrival’s bearing and at its height, inside the system', () => {
    const a = { x: 120, y: 18, z: -90, heading: Math.atan2(120, -90) };
    const d = dropPoint(a);
    expect(d.y).toBe(18);
    expect(d.heading).toBe(a.heading);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(Math.hypot(120, -90) * INTERDICTION.far);
    expect(d.x / d.z).toBeCloseTo(120 / -90);
    // never out past the edge, whatever the arrival
    const far = dropPoint({ x: 600, y: 0, z: 600, heading: 0 });
    expect(Math.hypot(far.x, far.z)).toBeLessThanOrEqual(EDGE * 0.8 + 1e-6);
    expect(far.x / far.z).toBeCloseTo(1);
  });

  it('puts the Interdictor ahead of you and off to one side, broadside on, with its hangar under it', () => {
    const ship = { x: 10, y: 5, z: 20, heading: 0 }; // (nose along −z)
    const p = interdictorPlace(ship, 1);
    expect(p.at[2]).toBeLessThan(ship.z - 10); // ahead
    expect(p.at[0]).not.toBeCloseTo(ship.x); // and to one side
    expect(Math.abs(p.at[1] - ship.y)).toBeLessThan(3);
    // broadside: its nose roughly across your way
    const across = Math.abs(Math.sin(p.heading - ship.heading));
    expect(across).toBeGreaterThan(0.9);
    expect(p.hangar[1]).toBeLessThan(p.at[1]);
    expect(p.hangar[0]).toBe(p.at[0]);
    expect(p.hangar[2]).toBe(p.at[2]);
    // the other side mirrors it
    const q = interdictorPlace(ship, -1);
    expect(Math.sign(q.at[0] - ship.x)).toBe(-Math.sign(p.at[0] - ship.x));
    expect(typeof p.drift[0]).toBe('number');
    expect(Math.hypot(...p.drift)).toBeGreaterThan(0);
    expect(Math.hypot(...p.drift)).toBeLessThan(3);
  });

  it('knows when you’re in the well', () => {
    const at = [100, 0, 100];
    expect(inWell({ x: 100, y: 40, z: 100 }, at, 150)).toBe(true);
    expect(inWell({ x: 100 + 149, y: 0, z: 100 }, at, 150)).toBe(true);
    expect(inWell({ x: 100 + 151, y: 0, z: 100 }, at, 150)).toBe(false);
    expect(inWell({ x: 100, y: 200, z: 100 }, at, 150)).toBe(false);
  });
});

describe('the hold', () => {
  const hold = INTERDICTION.hold;
  it('lifts once the fighters are gone, once you’re clear of the well, or once it’s had its go, and not before', () => {
    expect(holdLifts({ since: 0, now: 5, pack: 'coming', inWell: true })).toBe(null);
    expect(holdLifts({ since: 0, now: 5, pack: 'here', inWell: true })).toBe(null);
    // the pack hasn't come yet: nothing's cleared
    expect(holdLifts({ since: 0, now: 1, pack: 'coming', inWell: true })).toBe(null);
    expect(holdLifts({ since: 0, now: 20, pack: 'gone', inWell: true })).toBe('cleared');
    expect(holdLifts({ since: 0, now: 20, pack: 'here', inWell: false })).toBe('clear');
    expect(holdLifts({ since: 0, now: hold - 1, pack: 'here', inWell: true })).toBe(null);
    expect(holdLifts({ since: 0, now: hold + 1, pack: 'here', inWell: true })).toBe('time');
    // a pack that never came (the ship crashed, say) still lets go in time
    expect(holdLifts({ since: 0, now: hold + 1, pack: 'coming', inWell: true })).toBe('time');
  });
});

describe('the Interdictor as a solid', () => {
  it('is one sphere where it is once it’s here, so flying into it is a bump or a crash', () => {
    const [s] = interdictorSolids('here', [1, 2, 3]);
    expect(s).toMatchObject({ id: 'interdictor', at: [1, 2, 3], ship: true });
    expect(s.r).toBeCloseTo(INTERDICTION.size * 0.3, 6);
    expect(s.reach).toBe(s.r);
  });
  it('is nothing while it jumps in or out, or when it’s gone', () => {
    for (const state of ['in', 'out', null]) expect(interdictorSolids(state, [1, 2, 3]), String(state)).toEqual([]);
    expect(interdictorSolids('here', null)).toEqual([]);
  });
});

describe('whose Interdictor it is', () => {
  it('is the Empire’s in the Civil War, the Remnant’s after, and nobody’s in the Clone Wars', () => {
    expect(interdictionFor('gcw')).toBe('empire');
    expect(interdictionFor('remnant')).toBe('remnant');
    expect(interdictionFor('clone')).toBeNull();
  });
});
