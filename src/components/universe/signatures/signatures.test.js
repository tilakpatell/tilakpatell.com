import { describe, expect, it } from 'vitest';
import { coreStats } from '../ships/profiles';
import { LAB, SIGNATURE_LINE, compartmentRoom, hidden, inspect, labEvery, labStep, portalEvery, portalReady, r2Patch, rangeOf } from './index';
import { dropPod, nearPod, recoverInto } from './pod';
import { holdOps } from '../market/hold';

const here = { sector: [1, 0, 1], pocket: null };

describe('the signatures', () => {
  it('says each crew’s, and R2 plots a hop a sector further', () => {
    for (const crew of ['xwing', 'falcon', 'cruiser', 'rv']) expect(SIGNATURE_LINE[crew]).toBeTruthy();
    expect(rangeOf(coreStats('xwing'))).toBe(3);
    expect(rangeOf(coreStats('falcon'))).toBe(3);
  });

  it('has R2 patch the shields under fire, in bursts, more at a higher tier', () => {
    expect(r2Patch({ tier: 1, since: 1, clock: 1 })).toBe(4);
    expect(r2Patch({ tier: 5, since: 1, clock: 12.5 })).toBe(8);
    expect(r2Patch({ tier: 1, since: 1, clock: 5 })).toBe(0);
    expect(r2Patch({ tier: 1, since: 9, clock: 1 })).toBe(0);
  });

  it('hides a third of the Falcon’s hold, the dearest first', () => {
    expect(compartmentRoom('falcon', 12)).toBe(4);
    expect(compartmentRoom('rv', 16)).toBe(0);
    const lots = [{ good: 'iron', n: 5, from: here }, { good: 'spice', n: 2, from: here }, { good: 'contraband', n: 3, from: here }];
    expect(hidden('falcon', 12, lots)).toEqual([{ good: 'spice', n: 2, from: here }, { good: 'contraband', n: 2, from: here }]);
  });

  it('seizes contraband in the open at a military station, and fines it, but never the Falcon’s hidden', () => {
    const lots = [{ good: 'contraband', n: 3, from: here }];
    expect(inspect({ crew: 'rv', room: 16, lots, type: 'military' })).toEqual({ seized: [{ good: 'contraband', n: 3 }], fine: 660 });
    expect(inspect({ crew: 'falcon', room: 12, lots, type: 'military' })).toEqual({ seized: [], fine: 0 });
    expect(inspect({ crew: 'rv', room: 16, lots, type: 'mining' })).toEqual({ seized: [], fine: 0 });
  });

  it('charges the portal gun quicker at a higher hyperdrive tier', () => {
    expect(portalEvery(1)).toBe(600);
    expect(portalEvery(5)).toBe(240);
    expect(portalReady(undefined, 0, 1)).toBe(true);
    expect(portalReady(100, 650, 1)).toBe(false);
    expect(portalReady(100, 700, 1)).toBe(true);
  });

  it('refines in the RV’s lab, one unit at a time, quicker at a higher reactor tier', () => {
    expect(labEvery(1)).toBe(30);
    expect(labEvery(5)).toBe(10);
    const r = labStep([{ good: 'iron', n: 3, from: here }]);
    expect(r).toMatchObject({ raw: 'iron', out: 'alloys' });
    expect(r.lots).toEqual([{ good: 'iron', n: 1, from: here }, { good: 'alloys', n: 1, from: here }]);
    expect(labStep([{ good: 'iron', n: 1, from: here }])).toBe(null);
    for (const [raw, [, out]] of Object.entries(LAB)) expect(raw !== out).toBe(true);
  });
});

describe('the cargo pod', () => {
  it('drops the hold where the ship went down, less the Falcon’s hidden', () => {
    const lots = [{ good: 'iron', n: 5, from: here }, { good: 'spice', n: 2, from: here }];
    const rv = dropPod({ crew: 'rv', room: 16, lots, at: [1, 2, 3], sector: [0, 0, 0], t: 9 });
    expect(rv.keep).toEqual([]);
    expect(rv.pod).toMatchObject({ crew: 'rv', at: [1, 2, 3], lots });
    const falcon = dropPod({ crew: 'falcon', room: 12, lots, at: [1, 2, 3] });
    expect(falcon.keep).toEqual([{ good: 'spice', n: 2, from: here }, { good: 'iron', n: 2, from: here }]);
    expect(falcon.pod.lots).toEqual([{ good: 'iron', n: 3, from: here }]);
    expect(dropPod({ crew: 'rv', room: 16, lots: [], at: [0, 0, 0] }).pod).toBe(null);
  });

  it('is taken aboard close to, as far as the hold has room', () => {
    const pod = { crew: 'rv', at: [0, 0, 0], lots: [{ good: 'iron', n: 5, from: here }] };
    expect(nearPod(pod, { x: 3, y: 0, z: 4 })).toBe(true);
    expect(nearPod(pod, { x: 30, y: 0, z: 0 })).toBe(false);
    const hold = holdOps([], 3);
    const r = recoverInto(pod, hold);
    expect(r.got).toBe(3);
    expect(r.pod.lots).toEqual([{ good: 'iron', n: 2, from: here }]);
    expect(recoverInto(r.pod, holdOps([], 9)).pod).toBe(null);
  });
});
