import { describe, expect, it } from 'vitest';
import { ANCHORS_A, boatsAt, moonFor, routeOf, shotFor } from './shots';
import { BEATS } from '../../rules/arrival';

const route = routeOf(ANCHORS_A.route);
const sets = { station: [0, 0, 3000], steps: [0, -1000, 0], hall: [0, -2000, 0] };

describe('the arrival’s camera', () => {
  it('lays the boats’ way from the jetty to the boathouse, about half a kilometre, smooth', () => {
    expect(route.length).toBeGreaterThan(420);
    expect(route.length).toBeLessThan(560);
    const a = route.at(0);
    const b = route.at(route.length);
    expect([a.x, a.z]).toEqual(ANCHORS_A.route[0]);
    expect(Math.hypot(b.x - ANCHORS_A.route.at(-1)[0], b.z - ANCHORS_A.route.at(-1)[1])).toBeLessThan(1e-6);
    // (no kinks: the heading never turns more than a few degrees a metre)
    let last = route.at(0);
    for (let m = 1; m < route.length; m += 1) {
      const p = route.at(m);
      expect(Math.acos(Math.min(1, p.tx * last.tx + p.tz * last.tz))).toBeLessThan(0.08);
      last = p;
    }
  });

  it('frames every beat of the clock, the camera somewhere, looking somewhere else', () => {
    for (const b of BEATS)
      for (const k of [0, 0.5, 1]) {
        const s = shotFor(b.id, k, { route, sets });
        expect(s.at.every(Number.isFinite), `${b.id} ${k}`).toBe(true);
        expect(s.look.every(Number.isFinite), `${b.id} ${k}`).toBe(true);
        expect(Math.hypot(s.at[0] - s.look[0], s.at[1] - s.look[1], s.at[2] - s.look[2])).toBeGreaterThan(0.5);
        expect(s.fov).toBeGreaterThan(30);
        expect(s.fov).toBeLessThan(70);
      }
  });

  it('keeps the camera over the water on the lake, never in it', () => {
    for (const beat of ['pushoff', 'glide', 'castle', 'squid', 'cliff'])
      for (let k = 0; k <= 1; k += 0.1) expect(shotFor(beat, k, { route, sets }).at[1]).toBeGreaterThan(ANCHORS_A.water + 0.6);
  });

  it('moves the boats forward through the crossing, never back', () => {
    let last = -1;
    for (const beat of ['pushoff', 'glide', 'castle', 'squid', 'cliff'])
      for (let k = 0; k <= 1.0001; k += 0.05) {
        const m = boatsAt(beat, k);
        expect(m).toBeGreaterThanOrEqual(last);
        last = m;
      }
    expect(last).toBeLessThanOrEqual(route.length);
  });

  it('turns the look up to the castle as it comes up', () => {
    const a = shotFor('castle', 0, { route, sets });
    const b = shotFor('castle', 1, { route, sets });
    const pitch = (s) => Math.atan2(s.look[1] - s.at[1], Math.hypot(s.look[0] - s.at[0], s.look[2] - s.at[2]));
    expect(pitch(b)).toBeGreaterThan(pitch(a));
    // (and the castle is ahead: the look runs toward the crag)
    expect(b.look[2]).toBeLessThan(b.at[2]);
  });

  it('cuts instead of glides under reduced motion: one frame a beat', () => {
    for (const beat of ['station', 'castle', 'stair', 'hall']) expect(shotFor(beat, 0, { route, sets, reduced: true })).toEqual(shotFor(beat, 1, { route, sets, reduced: true }));
  });

  it('sets the moon a little over a tower’s top as seen from the boats', () => {
    const from = [40, 2, -200];
    const d = moonFor(from, ANCHORS_A.crown, 0.07);
    expect(Math.hypot(...d)).toBeCloseTo(1, 6);
    const to = ANCHORS_A.crown.map((v, i) => v - from[i]);
    const l = Math.hypot(...to);
    // (the same bearing, a little higher)
    expect(Math.atan2(d[0], d[2])).toBeCloseTo(Math.atan2(to[0], to[2]), 6);
    expect(Math.asin(d[1])).toBeCloseTo(Math.asin(to[1] / l) + 0.07, 6);
  });
});
