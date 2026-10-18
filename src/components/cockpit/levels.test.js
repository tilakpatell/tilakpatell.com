import { describe, expect, it } from 'vitest';
import { LEVELS, levelOf, ratioFor, shadowRadius } from './levels';

const ORDER = ['low', 'mid', 'high', 'ultra'];

describe('the cockpit at each quality level', () => {
  it('draws more at each level up, never less', () => {
    for (let i = 1; i < ORDER.length; i++) {
      const a = LEVELS[ORDER[i - 1]];
      const b = LEVELS[ORDER[i]];
      for (const k of ['ratio', 'pixels', 'samples', 'shadows', 'stars', 'streaks', 'sky']) expect(b[k], `${ORDER[i]} ${k}`).toBeGreaterThanOrEqual(a[k]);
      for (const k of ['taps', 'aberration', 'dirt', 'flare', 'grain']) expect(b.lens[k], `${ORDER[i]} lens ${k}`).toBeGreaterThanOrEqual(a.lens?.[k] ?? 0);
    }
  });

  it('has a post chain and its lens together, or neither', () => {
    for (const id of ORDER) expect(Boolean(LEVELS[id].lens), id).toBe(LEVELS[id].post);
  });

  it('gives a computer with a graphics chip its level’s row', () => {
    for (const id of ORDER) expect(levelOf({ detail: id, ok: true, coarse: false })).toEqual({ id, ...LEVELS[id] });
  });

  it('draws one pass on a phone or in software GL, as it always has above low', () => {
    for (const id of ['mid', 'high', 'ultra']) {
      for (const at of [{ ok: false, coarse: false }, { ok: true, coarse: true }]) {
        const row = levelOf({ detail: id, ...at });
        expect(row).toMatchObject({ id, post: false, lens: null, samples: 0, shadows: 0, ratio: 1.5, streaks: 1300 });
      }
    }
    expect(levelOf({ detail: 'low', ok: false })).toEqual({ id: 'low', ...LEVELS.low });
  });

  it('takes an unknown level as high', () => {
    expect(levelOf({ detail: 'max' }).id).toBe('high');
  });

  it('draws at the row’s ratio under the device’s, and no more pixels than the row’s', () => {
    const ultra = LEVELS.ultra;
    // a 1440p monitor: 1.5 pixels to the pixel from the device, under ultra's 2
    expect(ratioFor(ultra, 2560, 1440, 1.5)).toBeCloseTo(1.5, 5);
    // a 4K one at 1.5: held to 8.3 million pixels
    const r = ratioFor(ultra, 3840, 2160, 1.5);
    expect(3840 * r * 2160 * r).toBeLessThanOrEqual(8.3e6 + 1);
    // a small window is never drawn under half a pixel to the pixel, nor over the row's
    expect(ratioFor(LEVELS.low, 200, 100, 3)).toBe(1);
    expect(ratioFor(LEVELS.low, 1e5, 1e5, 1)).toBe(0.5);
  });

  it('softens a bigger shadow map over more of its texels, so the edge is as wide', () => {
    expect(shadowRadius({ shadows: 4096, soft: true })).toBe(4);
    expect(shadowRadius(LEVELS.high)).toBe(2);
    expect(shadowRadius(LEVELS.mid)).toBe(1);
    expect(shadowRadius(null)).toBe(1);
  });
});
