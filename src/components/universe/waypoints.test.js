import { describe, expect, it } from 'vitest';
import { HOME_BEACONS, NODES, nodeById, rampOf } from './waypoints';
import FIXTURE from './__fixtures__/nodes.json';

// The places the fleet war's fronts and the far fights are at: the lane
// nodes as they were (__fixtures__/nodes.json, taken from hyperlanes.js
// before the lanes went; their places moved out with the spread to six on
// 2026-10-09, scale.js's SPREAD, and again with the worlds when they moved
// out to their neighbourhoods on 2026-11-18, neighbourhoods.js, the regions
// with them), ids and all, since online the fronts are shared by these ids
describe('the waypoints', () => {
  it('are the lane nodes as they were', () => {
    expect(NODES.map((n) => n.id)).toEqual(FIXTURE.map((n) => n.id));
    NODES.forEach((n, i) => {
      const f = FIXTURE[i];
      expect({ kind: n.kind, region: n.region, name: n.name, place: n.place ?? null }, n.id).toEqual({ kind: f.kind, region: f.region, name: f.name, place: f.place });
      n.at.forEach((v, k) => expect(v, `${n.id}[${k}]`).toBeCloseTo(f.at[k], 5));
    });
  });

  it('finds a node by id, and a place by its ramp', () => {
    expect(nodeById('beacon:home').at).toEqual(HOME_BEACONS[0].at);
    expect(nodeById('nope')).toBe(null);
    for (const n of NODES.filter((x) => x.kind === 'ramp')) {
      expect(n.place, n.id).toBeTruthy();
      expect(rampOf(n.place)).toBe(n);
    }
  });
});
