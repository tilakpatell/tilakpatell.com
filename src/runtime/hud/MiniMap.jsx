import { useEffect, useRef } from 'react';
import { fitCanvas } from './canvas';
import { paced } from './clock';
import { MINIMAP } from './hud';

// A minimap: a disc on glass under the HUD's top row on the right (at
// --hud-under, which ./Hud.jsx sets from layoutRows), a caption under it,
// and a tap on it opens what `onOpen` opens (a world's full map). The world
// draws; the part keeps the clock: `draw(ctx, size)` is called at most `hz`
// times a second from requestAnimationFrame, in CSS px on a canvas as sharp
// as the screen, and what it returns is the caption, written into the
// element, never into state (numbers through refs); null keeps the whole
// part hidden (nothing to draw yet: the world still loading). `children` hang under
// the caption (a waypoint's line on a narrow screen). The key that opens the
// map is the guide's to say (src/components/guide/pages.js), not this.
//
//   <MiniMap size={minimapSize(width, touch)} draw={(ctx, size) => 'Cell 0,0'} onOpen={…} label="Open the map" />
export default function MiniMap({ size = MINIMAP.size, draw, onOpen = null, hz = MINIMAP.hz, label = 'Open the map', className = '', children = null }) {
  const root = useRef(null);
  const canvas = useRef(null);
  const caption = useRef(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Drawn on ./clock's paced beat (a timer between draws, the draw in a
  // frame: not a second requestAnimationFrame chain woken every display
  // beat), in a box measured when the canvas changes size, not on every
  // draw: a layout read ten times a second, under a HUD React had just
  // changed, made the browser lay the page out there and then (the
  // every-world hand-off's performance item 4).
  useEffect(() => {
    const c = canvas.current;
    let box = null;
    const measure = () => {
      box = fitCanvas(c);
    };
    const sizes = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    sizes?.observe(c);
    const tick = () => {
      // (no observer: measured each draw, as before)
      if (!sizes || !box) measure();
      const ctx = box && c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);
      const text = drawRef.current?.(ctx, box.w);
      // (hidden, not gone: the canvas keeps its size, so the next frame can draw)
      const empty = text === null ? 'true' : 'false';
      if (root.current && root.current.dataset.empty !== empty) root.current.dataset.empty = empty;
      if (caption.current && typeof text === 'string' && caption.current.textContent !== text) caption.current.textContent = text;
    };
    const stop = paced(hz, tick);
    return () => {
      stop();
      sizes?.disconnect();
    };
  }, [hz]);

  return (
    <div ref={root} className={`hud-minimap ${className}`.trim()} data-empty="true" style={{ '--hud-minimap': `${size}px` }}>
      <button type="button" className="hud-minimap-disc" onClick={onOpen ?? undefined} aria-label={label} title={label}>
        <canvas ref={canvas} aria-hidden="true" />
      </button>
      <p className="hud-minimap-caption" ref={caption} />
      {children}
    </div>
  );
}
