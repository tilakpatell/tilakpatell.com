import { useCallback, useEffect, useRef, useState } from 'react';
import { createGesture } from '../../../lib/gesture';
import { flatten as flat, levelOf, recentre, track, zoomBy } from './projection';
import { reveal } from './place';
import { ZOOM_STEP, createClicks, gestureStep, panFrom, wheelFactor } from './input';

// The chart's view and the hands on it, for the nav map and the mini-map: the
// pointers are read by lib/gesture.js (shared with the galaxy map's
// useMapView.js) and turned into views by input.js, which says what each does.
// The wheel, a pinch and the keys zoom about the focus, so a followed ship
// stays in the middle. A drag pans from the view at its first move, so the
// point under the hand stays under it. With orbit, a Shift-drag and two
// fingers turning or sliding tilt and turn the chart. A drag's click, and the
// double click it is part of, are swallowed: a press on a place's name that
// moved the chart never picks the place or sends the ship.
//
// useChartView(boxRef, { open, ship, frame, orbit }) → { view, setView, level,
//   zoomIn, zoomOut, back, flatten, show(mark), handlers }
//   open is the view it starts on, read once; ship ({ x, y, z } or null) is
//   tracked on every move (projection.js's track); frame is the box's
//   (FRAMES.nav or FRAMES.mini); handlers go on the box (boxRef), which also
//   takes the wheel. back() re-centres on the ship, or goes back to open
//   with none.
//
// The view is kept in a ref beside its state, so a drag's first move anchors
// on the view as it is now, and two changes in one event both land.

const finite = Number.isFinite;
// (the same view when nothing changed, so React doesn't draw it again)
const same = (a, b) => a === b || (a.range === b.range && a.yaw === b.yaw && a.pitch === b.pitch && a.follow === b.follow && a.focus.every((n, i) => n === b.focus[i]));

export function useChartView(boxRef, { open, ship = null, frame, orbit = true }) {
  const [view, setState] = useState(open);
  const live = useRef(view);
  const first = useRef(open);
  const shipNow = useRef(null);
  const gesture = useRef(null);
  gesture.current ??= createGesture();
  const clicks = useRef(null);
  clicks.current ??= createClicks();
  const drag = useRef(null); // { anchor, total }: a drag's pan, from its first move

  const put = useCallback((next) => {
    if (!next || same(next, live.current)) return;
    live.current = next;
    setState(next);
  }, []);
  const change = useCallback((fn) => put(fn(live.current)), [put]);
  const setView = useCallback((next) => put(typeof next === 'function' ? next(live.current) : next), [put]);

  const zoomIn = useCallback(() => change((v) => zoomBy(v, ZOOM_STEP)), [change]);
  const zoomOut = useCallback(() => change((v) => zoomBy(v, 1 / ZOOM_STEP)), [change]);
  const back = useCallback(() => change((v) => (shipNow.current ? recentre(v, shipNow.current) : first.current)), [change]);
  const flatten = useCallback(() => change(flat), [change]);
  const show = useCallback((mark) => change((v) => reveal(v, mark)), [change]);

  // the ship, by its numbers (a new object each tick is the same ship)
  const sx = ship?.x;
  const sy = ship?.y;
  const sz = ship?.z;
  useEffect(() => {
    shipNow.current = finite(sx) && finite(sy) && finite(sz) ? { x: sx, y: sy, z: sz } : null;
    if (shipNow.current) change((v) => track(v, shipNow.current));
  }, [sx, sy, sz, change]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault(); // (the page under the map doesn't scroll)
      change((v) => zoomBy(v, wheelFactor(e.deltaY, e.deltaMode)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boxRef, change]);

  const rect = () => boxRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };
  // A drag pans from its anchor by all it has moved (input.js's panFrom). The
  // anchor is taken again if the chart was zoomed, turned or tilted since (a
  // key, the wheel), and the focus's height is the live view's: the ship's,
  // which track keeps up to date while the hand is down.
  const dragTo = ([du, dv]) => {
    if (!finite(du) || !finite(dv)) return; // (a box with no size)
    const v = live.current;
    let d = drag.current;
    if (!d || d.anchor.range !== v.range || d.anchor.yaw !== v.yaw || d.anchor.pitch !== v.pitch) d = drag.current = { anchor: v, total: [0, 0] };
    d.total = [d.total[0] + du, d.total[1] + dv];
    const p = panFrom(d.anchor, d.total, frame);
    put({ ...v, focus: [p.focus[0], v.focus[1], p.focus[2]], follow: false });
  };
  const apply = (m) => {
    if (!m) return;
    if (m.pan) dragTo(m.pan);
    else change((v) => gestureStep(v, m, frame, { orbit }));
  };
  const handlers = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag.current = null; // (a second finger ends the first one's pan: the pinch has the chart now)
      gesture.current.down(e.pointerId, e.clientX, e.clientY, rect(), { orbit: orbit && e.shiftKey });
    },
    onPointerMove: (e) => {
      if (!gesture.current.active) return; // (a mouse passing over the chart: nothing to do, and the box isn't measured for it)
      const was = gesture.current.dragging;
      apply(gesture.current.move(e.pointerId, e.clientX, e.clientY, rect()));
      if (!was && gesture.current.dragging) e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: (e) => {
      drag.current = null; // (the finger left after a pinch pans from the view as it is then)
      gesture.current.up(e.pointerId);
    },
    onPointerCancel: (e) => {
      drag.current = null;
      gesture.current.cancel(e.pointerId);
    },
    onClickCapture: (e) => {
      if (!clicks.current.click(gesture.current.takeClick(), e.detail)) return;
      e.preventDefault();
      e.stopPropagation();
    },
    onDoubleClickCapture: (e) => {
      if (!clicks.current.double()) return;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return { view, setView, level: levelOf(view.range), zoomIn, zoomOut, back, flatten, show, handlers };
}
