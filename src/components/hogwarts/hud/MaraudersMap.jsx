import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MiniMap, minimapSize } from '../../../runtime/hud';
import { SCALES, createTrails, drawInk, drawLife, drawPaper, placeName } from './mapInk';
import { BOUNDS, unproject } from '../rules/atlas';
import './map.css';

// The Marauder’s Map (the design’s §4.8): the world’s minimap, the kit’s
// MiniMap disc drawn as a corner of the Map round you, and on M (the Menu,
// or a tap of the disc) the Map itself unfolded over the world: it opens
// with “I solemnly swear that I am up to no good” written on it and the ink
// spreading out from the words, and it’s shut with “Mischief managed”. On
// it the castle and the grounds in ink (hud/mapInk.js from rules/atlas.js)
// and every person in the world as a pair of footprints with a name in a
// banner, moving as they move. Positions come from `source()` every frame
// (the world’s night sim, rules/people.js) and are drawn straight onto the
// canvases: nothing that moves goes through React. The Map stays open as
// you walk; Esc or the words shut it.
//
//   <MaraudersMap ref source touch narrow reduced onOpen onClose />
//   source() → { me: { x, z, dx, dz, moving, name }, people: [...], night, hour } | null
//   ref: { open(), close(), toggle(), isOpen() }

const OPEN = 'I solemnly swear that I am up to no good';
const SHUT = 'Mischief managed';
const TIMES = { words: 1.25, bloom: 1.3, managed: 1.1 }; // s
const ZOOM = [0.3, 4.5]; // px a metre, the Map’s widest and closest
const GROUNDS_MIDDLE = [40, -60]; // (the castle a little left of the middle, the village in the top corner)
const CASTLE_MIDDLE = [-6, -34];
const IN_CASTLE = 150; // m from the castle’s middle: the Map opens on the castle’s plan, else on the grounds round you

// the view the Map opens on, from where you are
function frameFor(me, w, h) {
  const far = Math.hypot(me.x - CASTLE_MIDDLE[0], me.z - CASTLE_MIDDLE[1]);
  if (far < IN_CASTLE) return { cx: me.x, cz: me.z, scale: SCALES.castle, follow: true };
  // (the box round you and the castle’s rock together, a margin round it)
  const [x0, x1] = [Math.min(me.x - 40, CASTLE_MIDDLE[0] - 120), Math.max(me.x + 40, CASTLE_MIDDLE[0] + 120)];
  const [z0, z1] = [Math.min(me.z - 40, CASTLE_MIDDLE[1] - 100), Math.max(me.z + 40, CASTLE_MIDDLE[1] + 90)];
  const scale = Math.min(w / (x1 - x0), h / (z1 - z0)) * 0.92;
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale: Math.min(SCALES.near, Math.max(SCALES.grounds, scale)), follow: false };
}

const clampView = (v) => {
  v.scale = Math.min(ZOOM[1], Math.max(ZOOM[0], v.scale));
  v.cx = Math.min(BOUNDS[2], Math.max(BOUNDS[0], v.cx));
  v.cz = Math.min(BOUNDS[3], Math.max(BOUNDS[1], v.cz));
  return v;
};

const MaraudersMap = forwardRef(function MaraudersMap({ source, touch = false, narrow = false, reduced = false, onOpen = null, onClose = null }, ref) {
  const [phase, setPhase] = useState('shut'); // 'shut' | 'swear' | 'open' | 'managed'
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const discTrails = useRef(createTrails());
  const open = useCallback(() => {
    if (phaseRef.current !== 'shut') return;
    setPhase(reduced ? 'open' : 'swear');
    onOpen?.();
  }, [reduced, onOpen]);
  const close = useCallback(() => {
    if (phaseRef.current === 'shut' || phaseRef.current === 'managed') return;
    setPhase('managed');
  }, []);
  const toggle = useCallback(() => (phaseRef.current === 'shut' ? open() : close()), [open, close]);
  useImperativeHandle(ref, () => ({ open, close, toggle, isOpen: () => phaseRef.current !== 'shut' }), [open, close, toggle]);

  // M opens and shuts it (the guide says so: guide/hogwarts.js), Esc shuts it;
  // never while typing, nor with a modifier held
  useEffect(() => {
    const key = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.code === 'KeyM' && !e.repeat) toggle();
      else if (e.key === 'Escape' && phaseRef.current !== 'shut') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [toggle, close]);

  // the words, then the ink; and after “Mischief managed”, gone
  useEffect(() => {
    if (phase === 'swear') {
      const t = setTimeout(() => setPhase('open'), TIMES.words * 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'managed') {
      const t = setTimeout(
        () => {
          setPhase('shut');
          onClose?.();
        },
        (reduced ? 0.5 : TIMES.managed) * 1000,
      );
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, reduced, onClose]);

  // the disc: a corner of the Map round you, ten times a second; its caption where you are
  const drawDisc = useCallback(
    (ctx, size) => {
      const s = source();
      if (!s?.me) return null;
      const v = { cx: s.me.x, cz: s.me.z, scale: SCALES.disc, w: size, h: size };
      drawPaper(ctx, size, size);
      drawInk(ctx, v);
      drawLife(ctx, v, { people: s.people, me: s.me, trails: discTrails.current, now: performance.now() / 1000, night: s.night, banners: true });
      return placeName(s.me.x, s.me.z);
    },
    [source],
  );

  return (
    <>
      <MiniMap className="hogwarts-map-disc" size={minimapSize(narrow ? 0 : 1280, touch)} draw={drawDisc} onOpen={open} label="Open the Marauder’s Map" />
      {phase !== 'shut' && <Sheet source={source} phase={phase} reduced={reduced} narrow={narrow} onShut={close} />}
    </>
  );
});
export default MaraudersMap;

// The Map unfolded: its paper (CSS), and over it the kit’s MiniMap part
// stretched to the sheet, the ink (kept in a canvas of its own, drawn again
// only when the view moves or the ink is spreading) and the footprints
// thirty times a second; dragged to look about, the wheel or the buttons to
// come in close or stand back
function Sheet({ source, phase, reduced, narrow, onShut }) {
  const sheet = useRef(null);
  const title = useRef(null);
  const view = useRef({ cx: 0, cz: 0, scale: SCALES.near, w: 0, h: 0, follow: true, dirty: true, placed: false });
  const trails = useRef(createTrails());
  const drag = useRef(null);
  const ink = useRef({ canvas: null, key: '' });
  const since = useRef(performance.now());
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
    since.current = performance.now();
    view.current.dirty = true;
  }, [phase]);

  // Drawn on the kit’s MiniMap clock (its paced beat, thirty a second here:
  // the frames are the runtime’s, not a loop of the Map’s own), the ink
  // drawn once into a canvas of its own whenever the view moves and laid
  // down each beat under the footprints
  const draw = useCallback(
    (ctx, w) => {
      const h = ctx.canvas.clientHeight;
      const v = view.current;
      const s = source();
      if (!w || !h) return '';
      if (!v.placed && s?.me) {
        // (where the Map first opens: in the castle, on you and close enough to
        // read its plan by; out on the grounds, on you and the castle both)
        Object.assign(v, frameFor(s.me, w, h), { placed: true });
      }
      const now = performance.now();
      const age = (now - since.current) / 1000;
      const p = phaseRef.current;
      // the ink spreading out as it opens, drawing back in as it’s managed
      const reveal = reduced ? (p === 'open' ? 1 : 0) : p === 'swear' ? 0 : p === 'open' ? Math.min(1, age / TIMES.bloom) : Math.max(0, 1 - age / TIMES.managed);
      if (s?.me && v.follow) {
        v.cx = s.me.x;
        v.cz = s.me.z;
      }
      clampView(v);
      v.w = w;
      v.h = h;
      const ratio = Math.min(3, window.devicePixelRatio || 1);
      const key = [v.cx.toFixed(2), v.cz.toFixed(2), v.scale.toFixed(4), w, h, ratio, reveal.toFixed(3)].join('|');
      const kept = ink.current;
      if (kept.key !== key) {
        const c = (kept.canvas ??= document.createElement('canvas'));
        c.width = Math.round(w * ratio);
        c.height = Math.round(h * ratio);
        const ic = c.getContext('2d');
        ic.setTransform(ratio, 0, 0, ratio, 0, 0);
        ic.clearRect(0, 0, w, h);
        if (reveal > 0) drawInk(ic, v, { reveal });
        kept.key = key;
      }
      ctx.drawImage(kept.canvas, 0, 0, w, h);
      if (s && reveal > 0) {
        ctx.globalAlpha = reveal;
        drawLife(ctx, v, { people: s.people, me: s.me, trails: trails.current, now: now / 1000, night: s.night });
        ctx.globalAlpha = 1;
      }
      const hour = s?.hour;
      const text = hour == null ? '' : `${String(Math.floor(hour) % 24).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}${s.night ? ' · after curfew' : ''}`;
      if (title.current && title.current.textContent !== text) title.current.textContent = text;
      return '';
    },
    [source, reduced],
  );

  const zoomTo = (scale, follow = view.current.follow, centre = null) => {
    Object.assign(view.current, { scale, follow, placed: true });
    if (centre) Object.assign(view.current, { cx: centre[0], cz: centre[1] });
    trails.current.clear();
  };
  const local = (e) => {
    const r = sheet.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onWheel = (e) => {
    const v = view.current;
    const [px, py] = local(e);
    const at = unproject(v, px, py);
    const scale = Math.min(ZOOM[1], Math.max(ZOOM[0], v.scale * Math.exp(-e.deltaY * 0.0015)));
    // (zoom about the point under the pointer)
    v.cx = at[0] - (px - v.w / 2) / scale;
    v.cz = at[1] - (py - v.h / 2) / scale;
    zoomTo(scale, false);
  };
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: view.current.cx, cz: view.current.cz };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const v = view.current;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3) v.follow = false;
    v.cx = d.cx - (e.clientX - d.x) / v.scale;
    v.cz = d.cz - (e.clientY - d.y) / v.scale;
  };
  const onUp = () => (drag.current = null);

  const words = phase === 'managed' ? SHUT : phase === 'swear' ? OPEN : null;
  return (
    <div className="hogwarts-map" data-phase={phase} data-reduced={reduced || undefined} data-narrow={narrow || undefined} role="dialog" aria-label="The Marauder’s Map">
      <div className="hogwarts-map-paper">
        <div ref={sheet} className="hogwarts-map-sheet" onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <MiniMap className="hogwarts-map-full" hz={30} draw={draw} label="The Marauder’s Map: drag to look about" />
        </div>
        {words && (
          <p key={words} className="hogwarts-map-words" aria-live="polite">
            {words}
          </p>
        )}
        <p className="hogwarts-map-title">
          <span>The Marauder’s Map</span>
          <span ref={title} className="hogwarts-map-hour" />
        </p>
      </div>
      <div className="hogwarts-map-tools">
        <button
          type="button"
          className="hogwarts-map-btn"
          onClick={() => {
            const me = source()?.me;
            const inside = me && Math.hypot(me.x - CASTLE_MIDDLE[0], me.z - CASTLE_MIDDLE[1]) < IN_CASTLE;
            zoomTo(SCALES.castle, Boolean(inside), inside ? null : CASTLE_MIDDLE);
          }}
        >
          The castle
        </button>
        <button type="button" className="hogwarts-map-btn" onClick={() => zoomTo(SCALES.grounds, false, GROUNDS_MIDDLE)}>
          The grounds
        </button>
        <button type="button" className="hogwarts-map-btn" onClick={() => zoomTo(view.current.scale, true)}>
          Find me
        </button>
        <button type="button" className="hogwarts-map-btn hogwarts-map-shut" onClick={onShut}>
          {SHUT}
        </button>
      </div>
    </div>
  );
}
