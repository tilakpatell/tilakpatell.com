import { describe, expect, it, vi } from 'vitest';
import { coveredIn, prepFrame } from './prepFrame';

const page = (dataset = {}) => ({ documentElement: { dataset } });

// The map's prepare steps a frame at a time, or an idle moment at a time
// while something covers the page
describe("the map's prepare, a step at a time", () => {
  it('on the next frame when nothing covers the page', async () => {
    const frame = vi.fn(() => Promise.resolve('frame'));
    const idle = vi.fn();
    await expect(prepFrame({ doc: page(), frame, idle })).resolves.toBe('frame');
    expect(idle).not.toHaveBeenCalled();
  });

  it('on the next idle moment under the intro or a tour’s card', async () => {
    for (const dataset of [{ covered: '' }, { tourStill: '' }]) {
      const frame = vi.fn();
      const idle = vi.fn((fn) => fn());
      await prepFrame({ doc: page(dataset), frame, idle });
      expect(idle).toHaveBeenCalledTimes(1);
      expect(frame).not.toHaveBeenCalled();
    }
  });

  it('reads no page where there is none (Node)', () => {
    expect(coveredIn(null)).toBe(false);
    expect(coveredIn(page({ intro: '1' }))).toBe(false);
  });
});
