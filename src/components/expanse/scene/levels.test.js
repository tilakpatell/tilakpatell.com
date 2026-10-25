import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brightness, realAt as farRealAt, starK } from '../../universe/farStars';
import { FADE, FAR, beyondFade, discPx, levelWeights, realAt, speckBright } from './levels';

const LENS = { fovY: 34, height: 1080 }; // the chase's lens (flight.js's FOV, degrees) on a 1080 px screen
const KINDS = ['full', 'disc', 'speck'];

describe('the levels of detail', () => {
  it('fades over the last fifth, out to the far plane', () => {
    expect(FAR).toBe(45000);
    expect(FADE).toBe(0.2);
  });

  it('is built within its reach, a disc within the far plane and a speck past it', () => {
    expect(levelWeights(1000, { reach: 2600 })).toEqual({ full: 1, disc: 0, speck: 0 });
    expect(levelWeights(10000, { reach: 2600 })).toEqual({ full: 0, disc: 1, speck: 0 });
    expect(levelWeights(50000, { reach: 2600 })).toEqual({ full: 0, disc: 0, speck: 1 });
  });

  it('sums to one and never jumps, from 0 to 60,000', () => {
    const STEP = 5;
    for (const reach of [300, 2600]) {
      // a weight's steepest change is the smoothstep's, 1.5 across its band:
      // the body's own band is FADE × reach wide, the far plane's 9,000
      const own = (1.5 * STEP) / (FADE * reach);
      let sum = 0;
      let range = 0;
      let near = 0;
      let far = 0;
      let was = levelWeights(0, { reach });
      for (let d = STEP; d <= 60000; d += STEP) {
        const w = levelWeights(d, { reach });
        sum = Math.max(sum, Math.abs(w.full + w.disc + w.speck - 1));
        for (const k of KINDS) {
          range = Math.max(range, -w[k], w[k] - 1);
          const step = Math.abs(w[k] - was[k]);
          if (d <= reach) near = Math.max(near, step);
          else far = Math.max(far, step);
        }
        was = w;
      }
      expect(sum).toBeLessThan(1e-12);
      expect(range).toBeLessThanOrEqual(0);
      expect(near).toBeLessThanOrEqual(own + 1e-12);
      expect(far).toBeLessThanOrEqual(0.01);
    }
  });

  it('hands a disc to the built body and back at one size, so nothing shows or goes', () => {
    for (const reach of [45, 300, 1260, 2600]) {
      let off = 0;
      let speck = 0;
      for (let d = 0; d <= FAR * (1 - FADE); d += 5) {
        const w = levelWeights(d, { reach });
        off = Math.max(off, Math.abs(w.full + w.disc - 1));
        speck = Math.max(speck, w.speck);
      }
      expect(off).toBeLessThan(1e-12);
      expect(speck).toBe(0);
    }
  });

  it('puts no more than 4 px on screen in a frame at 900 units a second', () => {
    const STEP = 15; // a frame's flight at 900 units a second, 60 frames a second
    for (const r of [15, 60, 140, 420]) {
      // a planet's reach is three of its radii; a star's is its system's
      for (const reach of [3 * r, 2600]) {
        let body = 0;
        let disc = 0;
        let was = levelWeights(STEP, { reach });
        for (let d = 2 * STEP; d <= 60000; d += STEP) {
          const w = levelWeights(d, { reach });
          const px = discPx(d - STEP, r, LENS); // (the nearer end's, the bigger)
          // the body at its true size, built or a disc, grows in or fades out
          body = Math.max(body, Math.abs(w.full + w.disc - (was.full + was.disc)) * px);
          // and the disc alone, where there's nothing built to hand to
          if (w.full === 0 && was.full === 0) disc = Math.max(disc, Math.abs(w.disc - was.disc) * px);
          was = w;
        }
        expect(body).toBeLessThanOrEqual(4);
        expect(disc).toBeLessThanOrEqual(4);
        expect(disc).toBeGreaterThan(0); // (it did grow in, over the far plane's fade)
      }
    }
  });

  it('fills the weights it is given, so a frame allocates none', () => {
    const out = { full: 9, disc: 9, speck: 9 };
    expect(levelWeights(40000, { reach: 2600 }, out)).toBe(out);
    expect(out).toEqual(levelWeights(40000, { reach: 2600 }));
    expect(out.disc).toBeGreaterThan(0);
    expect(out.speck).toBeGreaterThan(0);
  });

  it('never builds a body with no reach, and gives no NaN', () => {
    for (const reach of [0, undefined, Number.NaN]) {
      const w = levelWeights(500, { reach });
      expect(w.full).toBe(0);
      expect(w.disc + w.speck).toBe(1);
      for (const k of KINDS) expect(Number.isNaN(w[k])).toBe(false);
    }
  });

  it('takes a far plane of its own', () => {
    expect(levelWeights(20000, { reach: 2600, far: 20000 })).toEqual({ full: 0, disc: 0, speck: 1 });
    expect(levelWeights(20000, { reach: 2600, far: 30000 }).disc).toBe(1);
  });
});

describe('a disc on screen', () => {
  it('is its true size across, in pixels', () => {
    const want = ((2 * 100) / (2 * 10000 * Math.tan(((34 / 2) * Math.PI) / 180))) * 1080;
    expect(discPx(10000, 100, LENS)).toBeCloseTo(want, 9);
    expect(discPx(10000, 100, LENS)).toBeCloseTo(35.33, 2);
    expect(discPx(20000, 100, LENS)).toBeCloseTo(want / 2, 9);
    expect(discPx(10000, 100, { fovY: 34, height: 540 })).toBeCloseTo(want / 2, 9);
  });
});

describe('a speck', () => {
  it('is full bright within four of where it is real, and falls off as the square', () => {
    const real = realAt({ r: 300 }); // 6,000
    expect(speckBright(4 * real, 300)).toBe(1);
    expect(speckBright(real, 300)).toBe(1);
    expect(speckBright(8 * real, 300)).toBeCloseTo(0.25, 12);
    expect(speckBright(16 * real, 300)).toBeCloseTo(0.0625, 12);
  });

  it('is never dimmer than 0.06', () => {
    expect(speckBright(1e7, 300)).toBe(0.06);
    expect(speckBright(1e12, 15)).toBe(0.06);
    expect(speckBright(0, 15)).toBe(1);
  });

  it('is the far stars’ brightness, squared', () => {
    for (const r of [15, 120, 420]) {
      const real = farRealAt({ r });
      for (const d of [5000, 12000, 30000, 60000, 100000]) {
        const b = brightness(d, real);
        if (b * b > 0.06) expect(speckBright(d, r)).toBeCloseTo(b * b, 12);
      }
    }
  });
});

describe('the rings beyond', () => {
  it('fade to nothing at their edge, from 0.8 of the way', () => {
    const edge = 360000;
    expect(beyondFade(edge, edge)).toBe(0);
    expect(beyondFade(2 * edge, edge)).toBe(0);
    expect(beyondFade(0.8 * edge, edge)).toBe(1);
    expect(beyondFade(0, edge)).toBe(1);
    let was = 1;
    for (let d = 0.8 * edge; d <= edge; d += 1000) {
      const f = beyondFade(d, edge);
      expect(f).toBeLessThanOrEqual(was);
      was = f;
    }
  });
});

describe('the far stars’ rules', () => {
  it('are real where farStars says, within twenty reaches and never under 1,500', () => {
    for (const p of [{ r: 10 }, { r: 100 }, { reach: 322 }, { reach: 50, r: 400 }, { r: 420 }]) {
      expect(realAt(p)).toBe(farRealAt(p));
    }
  });

  it('fade over the same last fifth as farStars’ star', () => {
    for (const real of [1500, 6440]) {
      for (let d = 0; d <= 1.2 * real; d += real / 50) expect(1 - beyondFade(d, real)).toBeCloseTo(starK(d, real), 12);
    }
  });

  it('import no three.js, React or DOM', () => {
    const src = readFileSync(new URL('./levels.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"](three|react)/);
    expect(src).not.toMatch(/\b(window|document)\./);
  });
});
