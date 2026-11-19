import { describe, expect, it } from 'vitest';
import { falconHands } from './hands';
import { plan } from './timeline';

const falcon = plan('falcon');

describe('the pilot’s hands through a launch', () => {
  it('sits still, hands on the yoke, until you go', () => {
    expect(falconHands(falcon, 0)).toEqual({ lean: 0, reach: 0, push: 0 });
    expect(falconHands(falcon, 800, { launching: false })).toEqual({ lean: 0, reach: 0, push: 0 });
    expect(falconHands(falcon, -10)).toEqual({ lean: 0, reach: 0, push: 0 });
  });

  it('in the Falcon, leans in and reaches the levers before they go, then pushes them home', () => {
    const at = (t) => falconHands(falcon, t);
    // (the hand on them first, the push after)
    expect(at(150).reach).toBeGreaterThan(at(150).push);
    expect(at(300).reach).toBeGreaterThan(0.95);
    expect(at(700).push).toBeGreaterThan(0.99);
    expect(at(400).lean).toBeGreaterThan(0.7);
    // and they stay pushed
    for (const t of [900, 1500, 2500, falcon.end]) expect(at(t).push).toBe(1);
  });

  it('goes back to the yoke once the ship’s away, and the jump presses you back into the seat', () => {
    const at = (t) => falconHands(falcon, t);
    expect(at(1700).reach).toBeLessThan(0.01);
    const go = at(Math.round((falcon.spool + falcon.peak) / 2) + 300);
    expect(go.lean).toBeLessThan(0);
    expect(go.lean).toBeGreaterThan(-0.31);
    // (and off again by the flash, so the white comes in on a still view)
    expect(Math.abs(at(falcon.peak).lean)).toBeLessThan(0.01);
  });

  it('never leans in further than it reaches, nor back further than the seat', () => {
    for (let t = 0; t <= falcon.end; t += 25) {
      const h = falconHands(falcon, t);
      expect(h.lean).toBeLessThanOrEqual(0.8);
      expect(h.lean).toBeGreaterThanOrEqual(-0.3);
      for (const k of ['reach', 'push']) {
        expect(h[k]).toBeGreaterThanOrEqual(0);
        expect(h[k]).toBeLessThanOrEqual(1);
      }
    }
  });
});
