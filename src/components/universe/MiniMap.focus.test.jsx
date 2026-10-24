import { describe, expect, it, vi } from 'vitest';
import { CHART, FRAMES, createView, reachOn } from './chart/projection';
import { markById } from './chart/marks';
import { BELT } from './layout';
import MiniMap from './MiniMap';

// The mini-map run by hand, as React would run it (there's no DOM here): its
// hooks kept between runs, and the chart's view the test's own, as FlatMap
// passes its hook's, so a zoom or a pan is a view put in its place. The focus
// is a list item's onFocus and onBlur, called as React would call them.
const H = vi.hoisted(() => ({ hooks: [], at: 0, view: null }));
vi.mock('react', async (load) => {
  const React = await load();
  const slot = (make) => {
    const i = H.at++;
    H.hooks[i] ??= make();
    return H.hooks[i];
  };
  return {
    ...React,
    useState(init) {
      const s = slot(() => ({ v: typeof init === 'function' ? init() : init }));
      s.set ??= (next) => (s.v = typeof next === 'function' ? next(s.v) : next);
      return [s.v, s.set];
    },
    useRef: (current) => slot(() => ({ current })),
    useLayoutEffect() {},
    useId: () => slot(() => ({ id: `_r${H.at}_` })).id,
  };
});

const all = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => all(n, out));
  else if (node && typeof node === 'object' && node.props) {
    out.push(node);
    all(node.props.children, out);
  }
  return out;
};
const draw = (props) => {
  H.at = 0;
  return all(MiniMap({ onSelect: () => {}, view: H.view, handlers: {}, ...props }));
};
const item = (tree, id) => tree.find((e) => e.type === 'li' && e.props['data-id'] === id) ?? null;
// a focus event on a place's button: from the keys (it shows its ring) or from a press of the mouse
const focusOn = (visible) => ({ target: { matches: (q) => q === ':focus-visible' && visible } });

describe('the mini-map’s focus', () => {
  it('keeps the place with the focus on the chart, so a zoom or a pan never drops it', () => {
    H.hooks = [];
    H.view = null;
    // Tab lands on the first place, picked or not; then the chart moves off to Invincible, up close
    const opened = draw({});
    const first = opened.find((e) => e.type === 'li').props['data-id'];
    item(opened, first).props.onFocus?.(focusOn(true));
    H.view = createView({ focus: markById('invincible').at, range: CHART.range.min, pitch: CHART.miniPitch });
    expect(item(draw({}), 'invincible')).not.toBeNull();
    expect(item(draw({}), first), `${first}, with the focus`).not.toBeNull();
    // once the focus has gone, it's off the chart as the rest are
    item(draw({}), first).props.onBlur?.({});
    expect(item(draw({}), first)).toBeNull();
  });
  it('keeps no place a press of the mouse focused: a drag from its name takes it off', () => {
    H.hooks = [];
    H.view = null;
    // a press on Marvel's name focuses its button, and the drag picks nothing
    item(draw({}), 'marvel').props.onFocus?.(focusOn(false));
    H.view = createView({ focus: markById('invincible').at, range: CHART.range.min, pitch: CHART.miniPitch });
    const moved = draw({});
    expect(item(moved, 'invincible')).not.toBeNull();
    expect(item(moved, 'marvel'), 'Marvel, dragged off').toBeNull();
  });
});

describe('the mini-map’s belt', () => {
  it('is as wide as the belt is where it is nearest the chart’s focus', () => {
    H.hooks = [];
    // the focus on the belt, on the far side of the sun from its x axis, close in
    const mid = (BELT.inner + BELT.outer) / 2;
    const half = (BELT.outer - BELT.inner) / 2;
    H.view = createView({ focus: [-mid * 0.6, 0, -mid * 0.8], range: mid, pitch: CHART.miniPitch });
    const belt = draw({}).find((e) => e.type === 'polyline');
    const near = reachOn(H.view, [-mid * 0.6, 0, -mid * 0.8], half) * FRAMES.mini.r;
    expect(near).toBeGreaterThan(2 * reachOn(H.view, [mid, 0, 0], half) * FRAMES.mini.r);
    expect(belt.props.strokeWidth).toBeCloseTo(near, 1);
  });
});
