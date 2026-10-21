import { describe, expect, it } from 'vitest';
import { BANK, PERIOD, circle } from './fellbeast.rules';

describe('the fell beast’s circle', () => {
  it('keeps to its ring round the centre, at the radius given', () => {
    for (const t of [0, 1.3, 4, 9.9]) {
      const p = circle(t, { at: [10, -4], r: 30 });
      expect(Math.hypot(p.x - 10, p.z + 4)).toBeCloseTo(30, 6);
    }
  });

  it('comes round again after its period, and a slower ring takes longer', () => {
    const a = circle(1, { r: 20 });
    const b = circle(1 + PERIOD, { r: 20 });
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.z).toBeCloseTo(a.z, 6);
    const c = circle(1 + PERIOD, { r: 20, period: PERIOD * 2 });
    expect(c.x).not.toBeCloseTo(a.x, 2);
  });

  it('flies along the ring, heading on the tangent, banked into the turn', () => {
    const r = 25;
    const p = circle(2, { r });
    const q = circle(2.01, { r });
    const yaw = Math.atan2(q.x - p.x, q.z - p.z);
    expect(Math.cos(p.yaw - yaw)).toBeCloseTo(1, 3);
    expect(p.bank).toBeCloseTo(BANK, 6);
    expect(circle(2, { r, dir: -1 }).bank).toBeCloseTo(-BANK, 6);
  });
});
