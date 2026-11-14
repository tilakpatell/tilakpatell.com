import { describe, expect, it } from 'vitest';
import { FADE, FAR, beyondFade, discPx, levelWeights, realAt, speckBright } from './levels';

const SCREEN = { fov: 34, height: 1080 }; // (flight.js's field of view, a tall screen)

describe('the levels', () => {
  it('is whole within its reach, a disc to the far plane, a speck past it', () => {
    expect(levelWeights(1000, { reach: 2600 })).toEqual({ full: 1, disc: 0, speck: 0 });
    expect(levelWeights(10000, { reach: 2600 })).toEqual({ full: 0, disc: 1, speck: 0 });
    expect(levelWeights(50000, { reach: 2600 })).toEqual({ full: 0, disc: 0, speck: 1 });
    expect(FAR).toBe(45000);
    expect(FADE).toBe(0.2);
  });

  it('changes smoothly, no faster than its fade allows, and always sums to one', () => {
    // (a smoothstep is at its steepest, 1.5 over its width, at its middle:
    // so a 5-unit step moves a weight 1.5 × 5 / (a fifth of the reach) at most)
    for (const reach of [300, 2600]) {
      const most = (1.5 * 5) / (FADE * reach) + 1e-9;
      let was = levelWeights(0, { reach });
      for (let d = 5; d <= 60000; d += 5) {
        const w = levelWeights(d, { reach });
        expect(Math.abs(w.full + w.disc + w.speck - 1)).toBeLessThan(1e-12);
        for (const k of ['full', 'disc', 'speck']) expect(Math.abs(w[k] - was[k]), `${reach} ${d} ${k}`).toBeLessThanOrEqual(most);
        was = w;
      }
    }
  });

  it('never pops a body in or out by more than 4 px a frame at 900 units a second', () => {
    const step = 900 / 60;
    for (const r of [15, 60, 140, 420]) {
      const reach = r * 3;
      for (let d = r * 1.5; d <= 60000; d += step) {
        // (what's seen as a body: whole or a disc, the same size either way)
        const a = levelWeights(d, { reach });
        const b = levelWeights(d + step, { reach });
        const shown = Math.abs(b.full + b.disc - (a.full + a.disc));
        expect(shown * discPx(d, r, SCREEN), `${r} at ${d}`).toBeLessThanOrEqual(4);
      }
    }
  });

  it('sizes a disc by its true angle', () => {
    const want = ((2 * 100) / (2 * 10000 * Math.tan((34 * Math.PI) / 360))) * 1080;
    expect(discPx(10000, 100, SCREEN)).toBeCloseTo(want, 9);
    expect(discPx(20000, 100, SCREEN)).toBeCloseTo(want / 2, 9); // (half as big twice as far)
  });

  it('lights a speck by how far off it is, as the places do', () => {
    expect(realAt(120)).toBe(2400); // (farStars.js's realAt: twenty reaches, never under 1,500)
    expect(realAt(10)).toBe(1500);
    expect(speckBright(100, 120)).toBe(1);
    expect(speckBright(1e9, 120)).toBe(0.06);
    expect(speckBright(4 * realAt(120) * 2, 120)).toBeCloseTo(0.25, 9);
  });

  it('fades the beyond rings out at their edge', () => {
    expect(beyondFade(1000, 1000)).toBe(0);
    expect(beyondFade(800, 1000)).toBe(1);
    expect(beyondFade(900, 1000)).toBeCloseTo(0.5, 9);
  });
});
