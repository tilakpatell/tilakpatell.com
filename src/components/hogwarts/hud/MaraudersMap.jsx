import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MiniMap, fitCanvas, minimapSize } from '../../../runtime/hud';
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
const LIFE_MS = 33; // the footprints at about thirty a second
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

// The Map unfolded: its paper (CSS), the ink (one canvas, drawn again when
// the view moves or the ink is spreading) and the footprints (another,
// thirty times a second); dragged to look about, the wheel or the buttons
// to come in close or stand back
function Sheet({ source, phase, reduced, narrow, onShut }) {
  const ink = useRef(null);
  const life = useRef(null);
  const title = useRef(null);
  const view = useRef({ cx: 0, cz: 0, scale: SCALES.near, w: 0, h: 0, follow: true, dirty: true });
  const trails = useRef(createTrails());
  const drag = useRef(null);
  const since = useRef(performance.now());
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
    since.current = performance.now();
    view.current.dirty = true;
  }, [phase]);

  useEffect(() => {
    // (where the Map first opens: in the castle, on you and close enough to read
    // its plan by; out on the grounds, on you and the castle both)
    const s = source();
    const box = ink.current?.getBoundingClientRect();
    if (s?.me) Object.assign(view.current, frameFor(s.me, box?.width || 800, box?.height || 560));
    let raf = 0;
    let last = -Infinity;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last < LIFE_MS) return;
      last = t;
      const v = view.current;
      const s = source();
      const age = (t - since.current) / 1000;
      const p = phaseRef.current;
      // the ink spreading out as it opens, drawing back in as it’s managed
      const reveal = reduced ? (p === 'open' ? 1 : 0) : p === 'swear' ? 0 : p === 'open' ? Math.min(1, age / TIMES.bloom) : Math.max(0, 1 - age / TIMES.managed);
      if (s?.me && v.follow) {
        if (Math.abs(v.cx - s.me.x) > 0.05 || Math.abs(v.cz - s.me.z) > 0.05) v.dirty = true;
        v.cx = s.me.x;
        v.cz = s.me.z;
      }
      clampView(v);
      const a = ink.current;
      const b = life.current;
      if (!a || !b) return;
      const boxA = fitCanvas(a);
      const boxB = fitCanvas(b);
      if (!boxA || !boxB) return;
      if (v.w !== boxA.w || v.h !== boxA.h) v.dirty = true;
      v.w = boxA.w;
      v.h = boxA.h;
      if (v.dirty || reveal < 1) {
        const c = a.getContext('2d');
        c.setTransform(boxA.s, 0, 0, boxA.s, 0, 0);
        c.clearRect(0, 0, v.w, v.h);
        drawInk(c, v, { reveal });
        v.dirty = reveal < 1;
      }
      const c = b.getContext('2d');
      c.setTransform(boxB.s, 0, 0, boxB.s, 0, 0);
      c.clearRect(0, 0, v.w, v.h);
      c.globalAlpha = reveal;
      if (s && reveal > 0) drawLife(c, v, { people: s.people, me: s.me, trails: trails.current, now: t / 1000, night: s.night });
      c.globalAlpha = 1;
      const hour = s?.hour;
      const text = hour == null ? '' : `${String(Math.floor(hour) % 24).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}${s.night ? ' · after curfew' : ''}`;
      if (title.current && title.current.textContent !== text) title.current.textContent = text;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [source, reduced]);

  const zoomTo = (scale, follow = view.current.follow, centre = null) => {
    Object.assign(view.current, { scale, follow, dirty: true });
    if (centre) Object.assign(view.current, { cx: centre[0], cz: centre[1] });
    trails.current.clear();
  };
  const onWheel = (e) => {
    const v = view.current;
    const r = ink.current.getBoundingClientRect();
    const at = unproject(v, e.clientX - r.left, e.clientY - r.top);
    const scale = Math.min(ZOOM[1], Math.max(ZOOM[0], v.scale * Math.exp(-e.deltaY * 0.0015)));
    // (zoom about the point under the pointer)
    v.cx = at[0] - (e.clientX - r.left - v.w / 2) / scale;
    v.cz = at[1] - (e.clientY - r.top - v.h / 2) / scale;
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
    v.dirty = true;
  };
  const onUp = () => (drag.current = null);

  const words = phase === 'managed' ? SHUT : phase === 'swear' ? OPEN : null;
  return (
    <div className="hogwarts-map" data-phase={phase} data-reduced={reduced || undefined} data-narrow={narrow || undefined} role="dialog" aria-label="The Marauder’s Map">
      <div className="hogwarts-map-paper">
        <canvas ref={ink} className="hogwarts-map-ink" aria-hidden="true" />
        <canvas ref={life} className="hogwarts-map-life" aria-hidden="true" onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
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
        <button type="button" className="hogwarts-map-btn" onClick={() => {
            const me = source()?.me;
            const inside = me && Math.hypot(me.x - CASTLE_MIDDLE[0], me.z - CASTLE_MIDDLE[1]) < IN_CASTLE;
            zoomTo(SCALES.castle, Boolean(inside), inside ? null : CASTLE_MIDDLE);
          }}>
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
