import { useCallback, useEffect, useRef, useState } from 'react';
import { createGesture } from '../../../lib/gesture';
import { flatten as flattened, levelOf, recentre, track, zoomBy } from './projection';
import { reveal } from './place';
import { ZOOM_STEP, gestureStep, panFrom, wheelFactor } from './input';

// A dblclick this soon after a click swallowed as a drag's end is that drag's
// too: a press on a place's button that moves the chart never picks it or
// sends the ship. (Longer than a double click's gap, shorter than a second try.)
const DBLCLICK_WINDOW = 600; // ms

// The chart's view and the hands on it: the wheel zooms about the focus, a
// drag pans, Shift-drag (when `orbit`) turns and tilts, two fingers pinch,
// turn and tilt. The pure parts are in input.js and projection.js.
export function useChartView(boxRef, { open, ship = null, frame, orbit = true }) {
  const [view, setView] = useState(open); // (`open` is read once, on mount)
  const gesture = useRef(null);
  gesture.current ??= createGesture();
  const pan = useRef(null); // { anchor, total }: the drag's pans, summed from the view it began on
  const viewRef = useRef(view);
  viewRef.current = view;
  const live = useRef({ frame, orbit });
  live.current = { frame, orbit };
  const swallowedAt = useRef(-Infinity);
  const rect = () => boxRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };

  const sx = ship?.x;
  const sy = ship?.y;
  const sz = ship?.z;
  useEffect(() => {
    if (sx === undefined) return;
    setView((v) => track(v, { x: sx, y: sy, z: sz }));
  }, [sx, sy, sz]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const f = wheelFactor(e.deltaY, e.deltaMode);
      if (f === 1) return;
      setView((v) => zoomBy(v, f));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boxRef]);

  const zoomIn = useCallback(() => setView((v) => zoomBy(v, ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setView((v) => zoomBy(v, 1 / ZOOM_STEP)), []);
  const back = useCallback(() => setView((v) => (ship ? recentre(v, ship) : open)), [ship, open]);
  const flatten = useCallback(() => setView((v) => flattened(v)), []);
  const show = useCallback((mark) => setView((v) => reveal(v, mark)), []);

  const apply = (m) => {
    if (!m) return;
    const { frame: fr, orbit: canOrbit } = live.current;
    if (m.pan) {
      if (!pan.current) pan.current = { anchor: viewRef.current, total: [0, 0] };
      const p = pan.current;
      p.total = [p.total[0] + m.pan[0], p.total[1] + m.pan[1]];
      setView(panFrom(p.anchor, p.total, fr));
    } else {
      setView((v) => gestureStep(v, m, fr, { orbit: canOrbit }));
    }
  };
  const handlers = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (gesture.current.active) pan.current = null; // (a second finger ends the drag's pan)
      gesture.current.down(e.pointerId, e.clientX, e.clientY, rect(), { orbit: live.current.orbit && e.shiftKey });
    },
    onPointerMove: (e) => {
      if (!gesture.current.active) return; // (a mouse passing over the chart: nothing to do)
      const was = gesture.current.dragging;
      apply(gesture.current.move(e.pointerId, e.clientX, e.clientY, rect()));
      if (!was && gesture.current.dragging) e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: (e) => {
      pan.current = null;
      gesture.current.up(e.pointerId);
    },
    onPointerCancel: (e) => {
      pan.current = null;
      gesture.current.cancel(e.pointerId);
    },
    // (a drag that ends over a place doesn't pick it)
    onClickCapture: (e) => {
      const swallowed = gesture.current.takeClick();
      if (!swallowed || e.detail === 0) return; // (a keyboard's click is never a drag's)
      swallowedAt.current = Date.now();
      e.preventDefault();
      e.stopPropagation();
    },
    onDoubleClickCapture: (e) => {
      if (Date.now() - swallowedAt.current > DBLCLICK_WINDOW) return;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return { view, setView, level: levelOf(view.range), zoomIn, zoomOut, back, flatten, show, handlers };
}
