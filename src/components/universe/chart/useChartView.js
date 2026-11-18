import { useCallback, useEffect, useRef, useState } from 'react';
import { createGesture } from '../../../lib/gesture';
import { prefersReducedMotion } from '../../../lib/hooks';
import { shownLoop } from '../../../lib/shownLoop';
import { between, flatten as flatView, levelOf, recentre, track, zoomBy } from './projection';
import { ZOOM_STEP, gestureStep, panFrom, wheelFactor } from './input';
import { reveal } from './place';

// The chart's view (projection.js) and the hands on it (input.js, through
// lib/gesture.js): the wheel zooms, a drag moves the chart with the hand, a
// Shift-drag or a right-drag turns and tilts it (`orbit`), two fingers
// pinch, turn and tilt. The buttons and keys glide there (GLIDE ms, on
// lib/shownLoop's frames, at once under reduced motion); the hands move it
// straight. It follows the ship until it's dragged away. The DOM wiring
// only: the rules are input.js's and projection.js's, tested in Node.
// `hands: false` leaves the hands off (the view still moves by the calls).
const GLIDE = 280;
// (the chart's own buttons over it: a press on one is its own, not a drag's)
const OVERLAYS = '.navmap-out';
const over = (e) => e.target instanceof Element && e.target.closest(OVERLAYS) !== null;
const ease = (t) => 1 - (1 - t) ** 3;

export function useChartView(boxRef, { open, ship = null, frame, orbit = true, hands = true }) {
  const [view, setViewState] = useState(open);
  const viewRef = useRef(view);
  viewRef.current = view;
  const gesture = useRef(null);
  gesture.current ??= createGesture();
  const drag = useRef(null); // { anchor, total }: a drag's first view and how far it's gone since
  const glide = useRef(null); // { from, to, t0, loop }
  const openRef = useRef(open);
  const held = useRef(-Infinity); // (when a drag's click was last swallowed: the double click it ends in goes too)
  const shipRef = useRef(ship);
  shipRef.current = ship;

  const stopGlide = () => {
    glide.current?.loop?.stop();
    glide.current = null;
  };
  const setView = useCallback((next) => {
    stopGlide();
    setViewState((v) => (typeof next === 'function' ? next(v) : next));
  }, []);
  const glideTo = useCallback((to) => {
    const from = viewRef.current;
    stopGlide();
    const el = boxRef.current;
    if (to === from) return;
    if (!el || prefersReducedMotion()) {
      setViewState(to);
      return;
    }
    const g = { from, to, t0: performance.now(), loop: null };
    glide.current = g;
    g.loop = shownLoop(el, (now) => {
      const k = Math.min(1, (now - g.t0) / GLIDE);
      setViewState(between(g.from, g.to, ease(k)));
      if (k >= 1) stopGlide();
    });
  }, [boxRef]);
  useEffect(() => stopGlide, []);

  // the ship, wherever it's gone since the last look (and a glide's end with it)
  const shipKey = ship ? `${ship.x},${ship.y},${ship.z}` : '';
  useEffect(() => {
    const s = shipRef.current;
    if (!s) return;
    if (glide.current) glide.current.to = track(glide.current.to, s);
    setViewState((v) => track(v, s));
  }, [shipKey]);

  const zoomIn = useCallback(() => glideTo(zoomBy(glide.current?.to ?? viewRef.current, ZOOM_STEP)), [glideTo]);
  const zoomOut = useCallback(() => glideTo(zoomBy(glide.current?.to ?? viewRef.current, 1 / ZOOM_STEP)), [glideTo]);
  const back = useCallback(() => glideTo(shipRef.current ? recentre(viewRef.current, shipRef.current) : openRef.current), [glideTo]);
  const flatten = useCallback(() => glideTo(flatView(viewRef.current)), [glideTo]);
  const show = useCallback((mark) => mark && glideTo(reveal(viewRef.current, mark)), [glideTo]);
  const goTo = glideTo;

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !hands) return undefined; // (a chart that only shows, like Home's teaser, leaves the page's scroll alone)
    const onWheel = (e) => {
      if (over(e)) return;
      e.preventDefault();
      const f = wheelFactor(e.deltaY, e.deltaMode);
      if (f === 1) return;
      stopGlide();
      setViewState((v) => zoomBy(v, f));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boxRef, hands]);

  const rect = () => boxRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };
  const apply = (m) => {
    if (!m) return;
    stopGlide();
    if (m.pan) {
      const d = (drag.current ??= { anchor: viewRef.current, total: [0, 0] });
      d.total = [d.total[0] + m.pan[0], d.total[1] + m.pan[1]];
      setViewState(panFrom(d.anchor, d.total, frame));
      return;
    }
    if (m.zoom !== undefined) drag.current = null; // (a second finger: the drag starts again from where it is)
    setViewState((v) => gestureStep(v, m, frame, { orbit }));
  };
  const handlers = {
    onPointerDown: (e) => {
      if (over(e)) return;
      const right = e.pointerType === 'mouse' && e.button === 2;
      if (e.pointerType === 'mouse' && e.button !== 0 && !(right && orbit)) return;
      drag.current = null;
      gesture.current.down(e.pointerId, e.clientX, e.clientY, rect(), { orbit: orbit && (e.shiftKey || right) });
    },
    onPointerMove: (e) => {
      if (!gesture.current.active) return; // (a mouse passing over: nothing to move, and the box isn't measured for it)
      const was = gesture.current.dragging;
      apply(gesture.current.move(e.pointerId, e.clientX, e.clientY, rect()));
      if (!was && gesture.current.dragging) e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: (e) => {
      gesture.current.up(e.pointerId);
      drag.current = null;
    },
    onPointerCancel: (e) => {
      gesture.current.cancel(e.pointerId);
      drag.current = null;
    },
    // (a drag that ends over a place neither picks it nor sends the ship: a double click included)
    onClickCapture: (e) => {
      const swallowed = gesture.current.takeClick();
      if (!swallowed || e.detail === 0 || over(e)) return; // (a keyboard's click is never a drag's)
      e.preventDefault();
      e.stopPropagation();
      held.current = performance.now();
    },
    onDoubleClickCapture: (e) => {
      if (performance.now() - held.current > 600) return;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e) => orbit && e.preventDefault(), // (a right-drag turns the chart)
  };

  return { view, setView, goTo, level: levelOf(view.range), zoomIn, zoomOut, back, flatten, show, handlers: hands ? handlers : {} };
}
