import { describe, expect, it } from 'vitest';
import { shownLoop } from './shownLoop';

// a frame clock, an IntersectionObserver and a document, each the least the loop uses
function rig({ io = true } = {}) {
  const queue = new Map();
  let next = 1;
  const raf = (cb) => {
    queue.set(next, cb);
    return next++;
  };
  const caf = (id) => queue.delete(id);
  const tick = (now) => {
    const due = [...queue.values()];
    queue.clear();
    for (const cb of due) cb(now);
  };
  const observers = [];
  class IO {
    constructor(cb) {
      this.cb = cb;
      this.on = true;
      observers.push(this);
    }
    observe(el) {
      this.el = el;
    }
    disconnect() {
      this.on = false;
    }
  }
  const seen = (v) => observers.forEach((o) => o.on && o.cb([{ isIntersecting: v, target: o.el }]));
  const listeners = new Set();
  const doc = {
    hidden: false,
    addEventListener: (t, f) => t === 'visibilitychange' && listeners.add(f),
    removeEventListener: (t, f) => listeners.delete(f),
  };
  const tab = (hidden) => {
    doc.hidden = hidden;
    for (const f of [...listeners]) f();
  };
  return { deps: { IO: io ? IO : undefined, doc, raf, caf }, tick, seen, tab, queue, listeners, observers };
}

describe('a loop drawn only while it shows', () => {
  it('calls the frame on every frame while its element is on screen', () => {
    const r = rig();
    const times = [];
    shownLoop({}, (now) => times.push(now), r.deps);
    r.tick(16);
    r.tick(33);
    expect(times).toEqual([16, 33]);
  });

  it('asks for no frames once scrolled out of view, and starts again when back', () => {
    const r = rig();
    const times = [];
    const loop = shownLoop({}, (now) => times.push(now), r.deps);
    r.seen(false);
    expect(r.queue.size).toBe(0);
    expect(loop.running).toBe(false);
    r.tick(16);
    r.seen(true);
    r.tick(50);
    expect(times).toEqual([50]);
  });

  it('asks for no frames while the tab is hidden', () => {
    const r = rig();
    const times = [];
    shownLoop({}, (now) => times.push(now), r.deps);
    r.tab(true);
    r.tick(16);
    expect(times).toEqual([]);
    r.tab(false);
    r.tick(40);
    expect(times).toEqual([40]);
  });

  it('stays stopped in a visible tab while its element is still out of view', () => {
    const r = rig();
    const times = [];
    shownLoop({}, (now) => times.push(now), r.deps);
    r.seen(false);
    r.tab(true);
    r.tab(false);
    r.tick(16);
    expect(times).toEqual([]);
  });

  it('never runs twice at once, however often it is told it shows', () => {
    const r = rig();
    let n = 0;
    shownLoop({}, () => n++, r.deps);
    r.seen(true);
    r.seen(true);
    r.tab(false);
    expect(r.queue.size).toBe(1);
    r.tick(16);
    expect(n).toBe(1);
  });

  it('tells its owner when it starts and stops showing', () => {
    const r = rig();
    const told = [];
    shownLoop({}, () => {}, { ...r.deps, onShown: (v) => told.push(v) });
    r.seen(false);
    r.seen(false);
    r.seen(true);
    expect(told).toEqual([false, true]);
  });

  it('ends for good on stop(), letting go of its observer and the document', () => {
    const r = rig();
    let n = 0;
    const loop = shownLoop({}, () => n++, r.deps);
    loop.stop();
    r.seen(true);
    r.tab(false);
    r.tick(16);
    expect(n).toBe(0);
    expect(r.observers[0].on).toBe(false);
    expect(r.listeners.size).toBe(0);
  });

  it('runs while the tab shows where there is no IntersectionObserver', () => {
    const r = rig({ io: false });
    let n = 0;
    shownLoop({}, () => n++, r.deps);
    r.tick(16);
    r.tab(true);
    r.tick(33);
    expect(n).toBe(1);
  });
});
