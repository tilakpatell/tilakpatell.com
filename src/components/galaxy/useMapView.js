import { useCallback, useEffect, useRef, useState } from 'react';
import { FIT, centreOn, frameUnits, panBy, zoomAt } from './mapView';
import { createGesture } from '../../lib/gesture';

// The galaxy map's view (mapView.js) and the hands on it (lib/gesture.js, shared with the universe's chart): the
// wheel or a trackpad zooms about the pointer, a drag pans, two fingers
// pinch, and the page's buttons and keys zoom about the middle.
const STEP = 1.5; // (a button's or a key's zoom)
const REVEAL_K = 1.5; // (the least zoom a system brought into view is shown at)
const LINE = { 0: 1, 1: 16, 2: 120 }; // (a wheel's delta in px, lines or pages: Firefox's wheel is in lines)
// the controls over the map (WarStrip, WarLegend, the layers, the zoom buttons): a press or a wheel on them is theirs, not the map's
const OVERLAYS = '.holomap-strip, .holomap-legend, .holomap-layers, .holomap-zoom';
const over = (e) => e.target instanceof Element && e.target.closest(OVERLAYS) !== null;
// (the same view object when nothing changed, so React doesn't draw it again)
const keepIfSame = (v, n) => (n.k === v.k && n.x === v.x && n.y === v.y ? v : n);

export function useMapView(boxRef) {
  const [view, setView] = useState(FIT);
  const gesture = useRef(null);
  gesture.current ??= createGesture();
  const rect = () => boxRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };

  const zoom = useCallback((f, u = 0.5, w = 0.5) => setView((v) => keepIfSame(v, zoomAt(v, f, u, w))), []);
  const zoomIn = useCallback(() => zoom(STEP), [zoom]);
  const zoomOut = useCallback(() => zoom(1 / STEP), [zoom]);
  const fit = useCallback(() => setView((v) => keepIfSame(v, FIT)), []);
  const frame = useCallback((points) => setView((v) => keepIfSame(v, frameUnits(points))), []);
  // (a point brought into the middle at the zoom the view has: it only zooms in from the whole galaxy's, to REVEAL_K)
  const reveal = useCallback((point) => setView((v) => keepIfSame(v, centreOn(v, point, { kMin: REVEAL_K }))), []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (over(e)) return; // (the key's panel scrolls)
      e.preventDefault();
      const dy = e.deltaY * (LINE[e.deltaMode] ?? 1);
      if (!Number.isFinite(dy)) return; // (zoomAt would pass a NaN through into the view)
      const r = el.getBoundingClientRect();
      const f = Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.0068); // (a trackpad's small steps a little; a wheel's notch, about STEP)
      setView((v) => keepIfSame(v, zoomAt(v, f, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boxRef]);

  const apply = (m) => {
    if (!m) return;
    if (m.pan) setView((v) => keepIfSame(v, panBy(v, m.pan[0], m.pan[1])));
    else setView((v) => keepIfSame(v, zoomAt(v, m.zoom, m.u, m.w)));
  };
  const handlers = {
    onPointerDown: (e) => {
      if ((e.pointerType === 'mouse' && e.button !== 0) || over(e)) return;
      gesture.current.down(e.pointerId, e.clientX, e.clientY, rect());
    },
    onPointerMove: (e) => {
      if (!gesture.current.active) return; // (a mouse passing over the map: nothing to pan, and the box isn't measured for it)
      const was = gesture.current.dragging;
      apply(gesture.current.move(e.pointerId, e.clientX, e.clientY, rect()));
      if (!was && gesture.current.dragging) e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: (e) => gesture.current.up(e.pointerId),
    onPointerCancel: (e) => gesture.current.cancel(e.pointerId),
    // (a drag that ends over a system doesn't pick it)
    onClickCapture: (e) => {
      const swallowed = gesture.current.takeClick();
      if (!swallowed || e.detail === 0 || over(e)) return; // (a keyboard's click, or one on the map's own buttons, is never a drag's)
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return { view, setView, zoom, zoomIn, zoomOut, fit, frame, reveal, handlers };
}
