import { describe, expect, it } from 'vitest';
import { perMinute, targets } from './pacing';

// the spec's targets, and a fifth either way (a change that moves one more fails here)
const NEAR = (got, want) => [got / want, 0.8, 1.2];

describe('the pace of the ships’ tiers', () => {
  it('earns more a minute the further a pilot gets', () => {
    for (let t = 1; t < 5; t++) expect(perMinute(t + 1).mean).toBeGreaterThan(perMinute(t).mean);
  });

  it('keeps every kind of play worth doing: none more than three times another', () => {
    for (let t = 1; t <= 5; t++) {
      const { combat, explore, trade } = perMinute(t);
      const all = [combat, explore, trade];
      expect(Math.max(...all) / Math.min(...all), `Mk ${t}`).toBeLessThanOrEqual(3);
    }
  });

  it('holds the spec’s targets within a fifth', () => {
    const { mk2, allMk3, firstMk5 } = targets();
    const checks = { mk2: NEAR(mk2, 10), allMk3: NEAR(allMk3, 120), firstMk5: NEAR(firstMk5, 300) };
    for (const [what, [k, lo, hi]] of Object.entries(checks)) {
      expect(k, `${what}: ${k.toFixed(2)} of its target`).toBeGreaterThanOrEqual(lo);
      expect(k, `${what}: ${k.toFixed(2)} of its target`).toBeLessThanOrEqual(hi);
    }
  });
});
