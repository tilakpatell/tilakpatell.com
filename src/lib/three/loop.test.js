import { describe, expect, it } from 'vitest';
import { createLoop } from './loop';

// a stand-in for requestAnimationFrame: frames run when tick() says
const frames = () => {
  let q = new Map();
  let n = 0;
  return {
    raf: (f) => (q.set(++n, f), n),
    caf: (id) => q.delete(id),
    pending: () => q.size,
    tick(now = 0) {
      const run = q;
      q = new Map();
      for (const f of run.values()) f(now);
    },
  };
};

describe('createLoop', () => {
  it('keeps one chain when a frame kicks while drawing (a held trigger)', () => {
    const f = frames();
    let draws = 0;
    const loop = createLoop(
      () => {
        draws++;
        loop.kick(); // a shot fired from inside the frame
        return true;
      },
      { raf: f.raf, caf: f.caf },
    );
    loop.kick();
    for (let i = 0; i < 20; i++) f.tick();
    expect(f.pending()).toBe(1);
    expect(draws).toBe(20);
  });

  it('a kick while drawing still gets a next frame when the step says stop', () => {
    const f = frames();
    let first = true;
    const loop = createLoop(
      () => {
        if (first) loop.kick();
        first = false;
        return false;
      },
      { raf: f.raf, caf: f.caf },
    );
    loop.kick();
    f.tick();
    expect(f.pending()).toBe(1);
    f.tick();
    expect(f.pending()).toBe(0);
  });

  it('stop cancels, and kicks are ignored while it may not draw', () => {
    const f = frames();
    let ok = true;
    const loop = createLoop(() => true, { raf: f.raf, caf: f.caf, can: () => ok });
    loop.kick();
    loop.stop();
    expect(f.pending()).toBe(0);
    ok = false;
    loop.kick();
    expect(f.pending()).toBe(0);
  });

  it('with a cadence of 2, steps on every second display beat exactly, asking for each beat between', () => {
    const f = frames();
    const at = [];
    const loop = createLoop((now) => (at.push(now), true), { raf: f.raf, caf: f.caf, cadence: 2 });
    loop.kick();
    for (let beat = 1; beat <= 8; beat++) {
      f.tick(beat * 16.7);
      expect(f.pending()).toBe(1);
    }
    expect(at.map((t) => Math.round(t / 16.7))).toEqual([1, 3, 5, 7]);
  });

  it('a cadence changed while running takes from the next beat, and a kick from rest draws at once', () => {
    const f = frames();
    let n = 0;
    let more = true;
    const loop = createLoop(() => (n++, more), { raf: f.raf, caf: f.caf });
    loop.kick();
    f.tick();
    f.tick();
    expect(n).toBe(2);
    loop.setCadence(3);
    expect(loop.cadence).toBe(3);
    for (let i = 0; i < 6; i++) f.tick();
    expect(n).toBe(4);
    more = false;
    for (let i = 0; i < 3; i++) f.tick();
    expect(f.pending()).toBe(0);
    more = true;
    const before = n;
    loop.kick();
    f.tick();
    expect(n).toBe(before + 1);
    loop.setCadence(0);
    expect(loop.cadence).toBe(1);
  });
});
