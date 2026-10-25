import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHART, FRAMES, createView, project } from './projection';
import { ORBIT } from './input';
// (under another name: it is run by hand here, not by React, so the hooks' rules don't apply)
import { useChartView as chartView } from './useChartView';

// The hook run by hand, as React would run it (there's no DOM here): its
// hooks kept between runs, its effects run after each and again till its
// state settles. The box is a stand-in with a size and the wheel's listener.
const H = vi.hoisted(() => ({ hooks: [], at: 0, effects: [], dirty: false }));
vi.mock('react', async (load) => {
  const React = await load();
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const slot = (make) => {
    const i = H.at++;
    H.hooks[i] ??= make();
    return H.hooks[i];
  };
  return {
    ...React,
    useState(init) {
      const s = slot(() => ({ v: typeof init === 'function' ? init() : init }));
      s.set ??= (next) => {
        const v = typeof next === 'function' ? next(s.v) : next;
        if (Object.is(v, s.v)) return;
        s.v = v;
        H.dirty = true;
      };
      return [s.v, s.set];
    },
    useRef: (current) => slot(() => ({ current })),
    useCallback(fn, deps) {
      const s = slot(() => ({}));
      if (!same(s.deps, deps)) Object.assign(s, { deps, fn });
      return s.fn;
    },
    useEffect(fn, deps) {
      const s = slot(() => ({}));
      if (same(s.deps, deps)) return;
      H.effects.push(() => {
        s.deps = deps;
        s.undo?.();
        const undo = fn();
        s.undo = typeof undo === 'function' ? undo : null;
      });
    },
  };
});

const PX = 1000; // (the box's side: the nav map's frame, a px to a unit)
const box = { current: null, wheel: null };
beforeEach(() => {
  H.hooks = [];
  box.wheel = null;
  box.current = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: PX, height: PX }),
    addEventListener: (type, fn, opts) => type === 'wheel' && (box.wheel = { fn, opts }),
    removeEventListener: (type, fn) => box.wheel?.fn === fn && (box.wheel = null),
    setPointerCapture() {},
  };
});

// runs the hook with these options till it settles: → what it gives
function run(opts) {
  for (let n = 0; n < 20; n++) {
    H.at = 0;
    H.effects = [];
    H.dirty = false;
    const out = chartView(box, { frame: FRAMES.nav, ...opts });
    if (H.dirty) continue;
    for (const fx of H.effects) fx();
    if (!H.dirty) return out;
  }
  throw new Error('it never settles');
}
const event = (o = {}) => ({
  pointerType: 'mouse', button: 0, pointerId: 1, clientX: 500, clientY: 500, shiftKey: false, detail: 1,
  currentTarget: box.current,
  preventDefault() { this.prevented = true; },
  stopPropagation() { this.stopped = true; },
  ...o,
});
// a press at (x, y), moved by (dx, dy) in steps, and let go
function drag(c, [x, y], [dx, dy], { steps = 8, ...o } = {}) {
  c.handlers.onPointerDown(event({ clientX: x, clientY: y, ...o }));
  for (let i = 1; i <= steps; i++) c.handlers.onPointerMove(event({ clientX: x + (dx * i) / steps, clientY: y + (dy * i) / steps, ...o }));
  c.handlers.onPointerUp(event(o));
}
const OPEN = createView({ range: 10000, follow: true });
const SHIP = { x: 0, y: 0, z: 0 };

describe('the chart’s view and the hands on it', () => {
  it('pans a drag with the hand, from where it began, and lets go of the ship', () => {
    let c = run({ open: OPEN, ship: SHIP });
    drag(c, [500, 500], [47, 0]); // (47 of the frame's 1000, over its radius 470: 0.1 on the chart)
    c = run({ open: OPEN, ship: SHIP });
    const p = project(c.view, [0, 0, 0]);
    expect(p.u).toBeCloseTo(0.1, 9);
    expect(p.v).toBeCloseTo(0, 9);
    expect(c.view.follow).toBe(false);
  });
  it('swallows the click a drag ends in, and the double click it is part of, but never a plain click', () => {
    const c = run({ open: OPEN, ship: SHIP });
    drag(c, [500, 500], [40, 0]);
    const [one, two, double] = [event({ detail: 1 }), event({ detail: 2 }), event()];
    c.handlers.onClickCapture(one);
    c.handlers.onClickCapture(two);
    c.handlers.onDoubleClickCapture(double);
    expect([one.stopped, two.stopped, double.stopped]).toEqual([true, undefined, true]);
    drag(c, [500, 500], [2, 0]); // (a press that moves less than DRAG is a click)
    const plain = event({ detail: 1 });
    c.handlers.onClickCapture(plain);
    expect(plain.prevented).toBeUndefined();
  });
  it('follows the ship; once let go, keeps only its height; back goes to it, or to where it opened with none', () => {
    let c = run({ open: OPEN, ship: SHIP });
    c = run({ open: OPEN, ship: { x: 100, y: 50, z: 0 } });
    expect(c.view.focus).toEqual([100, 50, 0]);
    drag(c, [500, 500], [40, 0]);
    c = run({ open: OPEN, ship: { x: 200, y: 80, z: 0 } });
    const [fx, fy] = c.view.focus;
    expect([fx === 200, fy]).toEqual([false, 80]);
    c.back();
    c = run({ open: OPEN, ship: { x: 200, y: 80, z: 0 } });
    expect(c.view).toMatchObject({ focus: [200, 80, 0], follow: true, range: 10000 });

    H.hooks = [];
    const open = createView({ range: CHART.range.max });
    c = run({ open, ship: null });
    drag(c, [500, 500], [40, 0]);
    c.zoomIn();
    c = run({ open, ship: null });
    expect(c.view).not.toEqual(open);
    c.back();
    expect(run({ open, ship: null }).view).toBe(open);
  });
  it('zooms with the wheel and the buttons, and a flood or a NaN keeps it on the chart', () => {
    let c = run({ open: OPEN, ship: SHIP });
    expect(box.wheel.opts).toEqual({ passive: false });
    const turn = event({ deltaY: -100, deltaMode: 0 });
    box.wheel.fn(turn);
    c = run({ open: OPEN, ship: SHIP });
    expect(turn.prevented).toBe(true);
    expect(c.view.range).toBeLessThan(10000);
    const before = c.view;
    box.wheel.fn(event({ deltaY: NaN, deltaMode: 0 }));
    expect(run({ open: OPEN, ship: SHIP }).view).toBe(before);
    for (let i = 0; i < 60; i++) box.wheel.fn(event({ deltaY: 1e6, deltaMode: 2 }));
    c = run({ open: OPEN, ship: SHIP });
    expect(c.view).toMatchObject({ range: CHART.range.max, focus: [0, 0, 0], follow: true });
    expect(c.level).toBe('universe');
    c.zoomIn();
    expect(run({ open: OPEN, ship: SHIP }).view.range).toBeCloseTo(CHART.range.max / 1.5);
  });
  it('tilts and turns on a Shift-drag where it may, and looks straight down again', () => {
    let c = run({ open: OPEN, ship: SHIP });
    drag(c, [500, 500], [60, -100], { shiftKey: true });
    c = run({ open: OPEN, ship: SHIP });
    expect(c.view.yaw).toBeCloseTo(0.06 * ORBIT.yaw, 9);
    expect(c.view.pitch).toBeCloseTo(0.1 * ORBIT.pitch, 9);
    expect(c.view.focus).toEqual([0, 0, 0]);
    c.flatten();
    expect(run({ open: OPEN, ship: SHIP }).view).toMatchObject({ yaw: 0, pitch: 0 });

    H.hooks = [];
    c = run({ open: OPEN, ship: SHIP, frame: FRAMES.mini, orbit: false });
    drag(c, [500, 500], [60, 0], { shiftKey: true });
    c = run({ open: OPEN, ship: SHIP, frame: FRAMES.mini, orbit: false });
    expect([c.view.yaw, c.view.follow]).toEqual([0, false]);
  });
  it('pinches with two fingers, and the finger left pans from the pinched view', () => {
    let c = run({ open: OPEN, ship: SHIP });
    const touch = (id, x, o = {}) => event({ pointerType: 'touch', pointerId: id, clientX: x, clientY: 500, ...o });
    c.handlers.onPointerDown(touch(1, 400));
    c.handlers.onPointerMove(touch(1, 450));
    c.handlers.onPointerDown(touch(2, 600));
    c.handlers.onPointerMove(touch(2, 750)); // (apart from 150 to 300: twice the zoom)
    c.handlers.onPointerUp(touch(2, 750));
    c = run({ open: OPEN, ship: SHIP });
    expect(c.view.range).toBeCloseTo(5000, 6);
    const pinched = c.view;
    c.handlers.onPointerMove(touch(1, 497));
    c = run({ open: OPEN, ship: SHIP });
    expect(c.view.range).toBe(pinched.range);
    expect(project(c.view, pinched.focus).u).toBeCloseTo(0.1, 9);
  });
});
