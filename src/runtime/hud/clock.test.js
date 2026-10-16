import { describe, expect, it } from 'vitest';
import { paced } from './clock';

// timers and frames by hand: the least the clock uses
function rig() {
  const timers = new Map();
  const frames = new Map();
  let id = 1;
  const deps = {
    setTimeout: (fn, ms) => (timers.set(id, { fn, ms }), id++),
    clearTimeout: (t) => timers.delete(t),
    raf: (fn) => (frames.set(id, fn), id++),
    caf: (f) => frames.delete(f),
  };
  const fireTimers = () => {
    const due = [...timers.values()];
    timers.clear();
    for (const t of due) t.fn();
  };
  const fireFrames = (now) => {
    const due = [...frames.values()];
    frames.clear();
    for (const f of due) f(now);
  };
  return { deps, timers, frames, fireTimers, fireFrames };
}

describe('a HUD part’s paced clock', () => {
  it('draws in an animation frame at once, then waits a tick of its rate on a timer', () => {
    const r = rig();
    const drawn = [];
    paced(10, (now) => drawn.push(now), r.deps);
    expect(r.frames.size).toBe(1);
    r.fireFrames(16);
    expect(drawn).toEqual([16]);
    expect(r.frames.size).toBe(0);
    expect([...r.timers.values()].map((t) => t.ms)).toEqual([100]);
  });

  it('asks for no frame while it waits: the page is woken its rate a second, not every beat', () => {
    const r = rig();
    let n = 0;
    paced(10, () => n++, r.deps);
    r.fireFrames(0);
    r.fireFrames(16);
    r.fireFrames(33);
    expect(n).toBe(1);
    r.fireTimers();
    r.fireFrames(100);
    expect(n).toBe(2);
  });

  it('stops for good, whether waiting on the timer or the frame', () => {
    const r = rig();
    let n = 0;
    const stop = paced(10, () => n++, r.deps);
    stop();
    r.fireFrames(0);
    expect(n).toBe(0);
    const stop2 = paced(10, () => n++, r.deps);
    r.fireFrames(0);
    stop2();
    r.fireTimers();
    r.fireFrames(100);
    expect(n).toBe(1);
    expect(r.timers.size + r.frames.size).toBe(0);
  });
});
