import { describe, expect, it, vi } from 'vitest';
import { CHART, createView } from './chart/projection';
import { markById } from './chart/marks';
import MiniMap from './MiniMap';

// The mini-map run by hand, as React would run it (there's no DOM here): its
// hooks kept between runs, and the chart's view the test's own, so a zoom or
// a pan is a view put in its place. The focus is a list item's onFocus and
// onBlur, called as React would call them.
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
vi.mock('./chart/useChartView', () => ({
  useChartView: (box, { open }) => ({ view: H.view ?? open, setView() {}, zoomIn() {}, zoomOut() {}, back() {}, handlers: {} }),
}));

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
  return all(MiniMap({ onSelect: () => {}, interactive: true, ...props }));
};
const item = (tree, id) => tree.find((e) => e.type === 'li' && e.props['data-id'] === id) ?? null;

describe('the mini-map’s focus', () => {
  it('keeps the place with the focus on the chart, so a zoom or a pan never drops it', () => {
    H.hooks = [];
    H.view = null;
    // Tab lands on the first place, picked or not; then the chart moves off to Invincible, up close
    const opened = draw({});
    const first = opened.find((e) => e.type === 'li').props['data-id'];
    item(opened, first).props.onFocus?.({});
    H.view = createView({ focus: markById('invincible').at, range: CHART.range.min, pitch: CHART.miniPitch });
    expect(item(draw({}), 'invincible')).not.toBeNull();
    expect(item(draw({}), first), `${first}, with the focus`).not.toBeNull();
    // once the focus has gone, it's off the chart as the rest are
    item(draw({}), first).props.onBlur?.({});
    expect(item(draw({}), first)).toBeNull();
  });
});
