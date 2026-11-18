import { describe, expect, it } from 'vitest';
import { THING_NEAR, UNIVERSE, fullSector, rowAt, tailOf, traitsOf } from '../../expanse/shared/gen';
import { ANCHOR, anchorOf, beamDirs, blink, cometParts, fieldRocks, herdBodies, rigHaulers, weightOf } from './layout';

const s = fullSector(UNIVERSE, 1, 0, 0, { lattice: false });
const field = s.extras.field[0];
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('where a near thing’s parts go', () => {
  it('fills a field with rocks, clear of its middle, the same every time', () => {
    const rocks = fieldRocks(field, 96);
    expect(rocks).toHaveLength(96);
    for (const r of rocks) {
      expect(Math.hypot(r.x, r.y, r.z)).toBeGreaterThanOrEqual(0.12 * field.size);
      expect(Math.hypot(r.x, r.z)).toBeLessThanOrEqual(field.size);
      expect(r.r).toBeGreaterThanOrEqual(0.3);
      expect(r.r).toBeLessThanOrEqual(3);
    }
    expect(fieldRocks(field, 96)).toEqual(rocks);
  });
  it('fades a thing in over its reach, and anchors in cells', () => {
    expect(weightOf(THING_NEAR * 100 * 1.01, 100)).toBe(0);
    expect(weightOf(THING_NEAR * 100 * 0.79, 100)).toBe(1);
    expect(anchorOf([ANCHOR * 2.4, -10, 9.6e6]).map((v) => v / ANCHOR)).toEqual([2, -0, Math.round(9.6e6 / ANCHOR)]);
  });
  it('moves haulers, herds and beams smoothly in time, and points a comet’s tail from its star', () => {
    const rig = s.extras.rig[0];
    const a = rigHaulers(rig, 4, 1000);
    const b = rigHaulers(rig, 4, 1000.1);
    a.forEach((h, i) => expect(len(h.at, b[i].at)).toBeLessThan(5));
    for (const h of a) expect(len(h.at, rig.at)).toBeLessThanOrEqual(rig.size * 4.2);
    const herd = s.extras.herd[0];
    const h0 = herdBodies(herd, 6, 1.7e9);
    const h1 = herdBodies(herd, 6, 1.7e9 + 0.1);
    h0.forEach((x, i) => expect(len(x.at, h1[i].at)).toBeLessThan(5));
    const comet = s.extras.comet[0];
    const c = cometParts(comet, 1234);
    expect(c.head).toEqual(rowAt(comet, 1234));
    expect(c.tail).toEqual(tailOf(comet, 1234));
    const p = s.extras.pulsar.find((x) => x.kind === 'pulsar');
    const [d0, d1] = beamDirs(traitsOf(p), 10);
    expect(Math.hypot(...d0)).toBeCloseTo(1, 9);
    expect(d1).toEqual(d0.map((v) => -v));
    expect([0, 1]).toContain(Math.round(blink(5n, 3)));
  });
});
