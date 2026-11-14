import { describe, expect, it, vi } from 'vitest';
import { QUIET_MS, afterPress, coveredIn, prepFrame, readingIn } from './prepFrame';

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

  it('under the intro, waits for the cockpit’s launch to be over before its idle moment', async () => {
    let open;
    const clear = vi.fn(() => new Promise((resolve) => (open = resolve)));
    const idle = vi.fn((fn) => fn());
    const step = prepFrame({ doc: page({ covered: '' }), frame: vi.fn(), idle, clear });
    await Promise.resolve();
    expect(clear).toHaveBeenCalledWith('launch');
    expect(idle).not.toHaveBeenCalled();
    open();
    await step;
    expect(idle).toHaveBeenCalledTimes(1);
  });

  it('waits out a launch uncovered too (the map is uncovered under the flash), and looks again after its wait', async () => {
    let open;
    const clear = vi.fn(() => (clear.mock.calls.length === 1 ? Promise.resolve() : new Promise((resolve) => (open = resolve))));
    let launching = true;
    const frame = vi.fn(() => Promise.resolve('frame'));
    const step = prepFrame({ doc: page(), frame, idle: vi.fn(), clear, held: () => (launching ? 'launch' : null) });
    // (a launch began while its frame was awaited: it waits again)
    await new Promise((r) => setTimeout(r, 0));
    expect(frame).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(2);
    launching = false;
    open();
    await expect(step).resolves.toBe('frame');
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it('under a cover, waits for the quiet after a press before its idle moment; uncovered, never', async () => {
    let calm;
    const quiet = vi.fn(() => new Promise((resolve) => (calm = resolve)));
    const idle = vi.fn((fn) => fn());
    const step = prepFrame({ doc: page({ covered: '' }), frame: vi.fn(), idle, quiet });
    await new Promise((r) => setTimeout(r, 0));
    expect(quiet).toHaveBeenCalledTimes(1);
    expect(idle).not.toHaveBeenCalled();
    calm();
    await step;
    expect(idle).toHaveBeenCalledTimes(1);
    const q2 = vi.fn(() => Promise.resolve());
    await prepFrame({ doc: page(), frame: vi.fn(() => Promise.resolve()), idle: vi.fn(), quiet: q2 });
    expect(q2).not.toHaveBeenCalled();
  });

  it('the quiet is what is left of QUIET_MS since the last press, and nothing long after one', async () => {
    const wait = vi.fn(() => Promise.resolve());
    await afterPress({ last: 1000, now: 1100, wait });
    expect(wait).toHaveBeenCalledWith(QUIET_MS - 100);
    wait.mockClear();
    await afterPress({ last: 1000, now: 1000 + QUIET_MS + 1, wait });
    await afterPress({ last: -Infinity, now: 5, wait });
    expect(wait).not.toHaveBeenCalled();
  });

  it('counts a cover as being read unless it is the arrival, waited on', () => {
    expect(readingIn(page({ covered: '' }))).toBe(true);
    expect(readingIn(page({ covered: '', arriving: '' }))).toBe(false);
    expect(readingIn(page())).toBe(false);
    expect(readingIn(null)).toBe(false);
  });

  it('reads no page where there is none (Node)', () => {
    expect(coveredIn(null)).toBe(false);
    expect(coveredIn(page({ intro: '1' }))).toBe(false);
  });
});
