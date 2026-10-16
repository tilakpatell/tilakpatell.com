import { describe, expect, it } from 'vitest';
import { readEntry, sunDir } from '../../../../lib/three/light/entry';
import { GAME_TO_SITE } from '../../../../lib/three/gameLight';
import { STACK_TIERS, azElOf, createSurfaceStack, surfaceEntry } from './stack';
import hoth from '../../../../lib/three/light/fixtures/hoth.ve.json';

const site = {
  sky: { zenith: '#3f7ccc', horizon: '#c8d3db', hazeColor: '#dddfdd', suns: [{ az: 0.5, el: 0.3, color: '#fff6e8' }] },
  light: { sun: 3.2, sky: '#b9d2f2', ground: '#b49a7a', ambient: 0.7 },
  fog: { color: '#d9dcdb', density: 0.00055 },
};

describe('the surface’s entry', () => {
  it('is the site in lane G’s derived shape, its sun where the scene’s shines from', () => {
    const e = surfaceEntry(site, null, { sunDir: [0, 0.6, 0.8] });
    const p = readEntry(e);
    expect(p.sun.dir[1]).toBeCloseTo(0.6);
    expect(p.sun.dir[2]).toBeCloseTo(0.8);
    expect(p.sun.intensity).toBe(3.2);
    expect(p.fog.density).toBe(0.00055);
    expect(p.ambient.intensity).toBe(0.7);
    expect(e.gameToSite).toBe(GAME_TO_SITE);
    expect(e.record).toBeUndefined();
  });

  it('takes the picture’s record beside it', () => {
    const pic = { record: hoth.sunny.record, name: hoth.sunny.name, lut: { url: 'x.png', size: 17 } };
    const e = surfaceEntry(site, pic);
    expect(e.record).toBe(hoth.sunny.record);
    expect(e.picture).toBe(pic);
    // (the record's own rate, never lane G's over it: the sky and the lamps at the game's brightness)
    expect(e.gameToSite).toBeUndefined();
    expect(readEntry(e).gameToSite).toBeLessThan(1e-4);
    expect(readEntry(e).sky.luminance).toBeLessThan(5);
  });

  it('turns a direction into entry.js’s angles and back', () => {
    for (const d of [[0, 1, 0.0001], [1, 0.5, -0.3], [-0.2, 0.3, 0.9]]) {
      const { az, el } = azElOf(d);
      const back = sunDir(az, el);
      const l = Math.hypot(...d);
      back.forEach((v, i) => expect(v).toBeCloseTo(d[i] / l, 5));
    }
  });
});

describe('the stack', () => {
  it('only on the node renderer, at every level', async () => {
    expect(STACK_TIERS).toEqual(['low', 'mid', 'high', 'ultra']);
    expect(await createSurfaceStack({ backend: 'webgl', tier: 'high' })).toBe(null);
    expect(await createSurfaceStack({ backend: 'webgpu', tier: 'potato' })).toBe(null);
  });
});

describe('the chain’s exposure under the record', () => {
  // (one exposure: the record's own, in its light, calibrate.js's; the
  // house's 1.4 on top of it was a second, set when the LUT was read with
  // linear values and the light dimmed to hide it)
  it('none of the house’s under the record’s linear tone map: the record’s own, in its light', async () => {
    const { LINEAR_EXPOSURE } = await import('./chain');
    expect(LINEAR_EXPOSURE).toBe(1);
  });
});
