import { describe, expect, it, vi } from 'vitest';
import { afterFirstFrame } from './afterFirstFrame';

// a page whose world is drawn when the test says, and idle moments it lets go of
const page = (on = false) => {
  const p = { on, watchers: new Set(), idles: [] };
  p.deps = {
    drawn: () => p.on,
    watch: (cb) => (p.watchers.add(cb), () => p.watchers.delete(cb)),
    idle: (cb) => (p.idles.push(cb), () => (p.idles = p.idles.filter((c) => c !== cb))),
  };
  p.draw = () => {
    p.on = true;
    for (const w of [...p.watchers]) w();
  };
  return p;
};

describe('afterFirstFrame', () => {
  it('waits for the world’s first frame, then for an idle moment', () => {
    const p = page();
    const fn = vi.fn();
    afterFirstFrame(fn, p.deps);
    expect(p.idles).toHaveLength(0);
    p.draw();
    expect(fn).not.toHaveBeenCalled();
    expect(p.idles).toHaveLength(1);
    expect(p.watchers.size).toBe(0); // (stops watching once it's seen)
    p.idles[0]();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('goes to the idle moment at once when the world is drawn already', () => {
    const p = page(true);
    const fn = vi.fn();
    afterFirstFrame(fn, p.deps);
    expect(p.idles).toHaveLength(1);
    p.idles[0]();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does nothing once cancelled, waiting or idle', () => {
    const fn = vi.fn();
    const a = page();
    afterFirstFrame(fn, a.deps)();
    a.draw();
    expect(a.idles).toHaveLength(0);
    const b = page(true);
    afterFirstFrame(fn, b.deps)();
    expect(b.idles).toHaveLength(0);
    expect(fn).not.toHaveBeenCalled();
  });
});
