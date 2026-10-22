import { describe, expect, it } from 'vitest';
import { SQUID_EVERY, SQUID_SPOTS, squidAt } from './lake';
import { heightAt, shoreAt } from './terrain';

describe('the giant squid', () => {
  it('rises once every few minutes, and is gone the rest of the time', () => {
    let up = 0;
    let risings = 0;
    let was = false;
    for (let t = 0; t < SQUID_EVERY * 6; t += 0.5) {
      const s = squidAt(t);
      if (s) up += 0.5;
      if (Boolean(s) && !was) risings += 1;
      was = Boolean(s);
    }
    expect(risings).toBe(6);
    expect(up / (SQUID_EVERY * 6)).toBeLessThan(0.15);
    expect(SQUID_EVERY).toBeGreaterThanOrEqual(120);
  });

  it('comes up out of deep water, in sight of a shore, and goes back the way it came', () => {
    for (const [x, z] of SQUID_SPOTS) {
      expect(heightAt(x, z)).toBeLessThan(-4);
      expect(shoreAt(x, z)).toBeGreaterThan(-200);
    }
    let first = null;
    for (let t = 0; t < SQUID_EVERY; t += 0.25) {
      const s = squidAt(t);
      if (!s) continue;
      first ??= s;
      expect(s.up).toBeGreaterThanOrEqual(0);
      expect(s.up).toBeLessThanOrEqual(1);
      expect(s.spot).toEqual(first.spot);
    }
    expect(first).not.toBeNull();
  });
});
