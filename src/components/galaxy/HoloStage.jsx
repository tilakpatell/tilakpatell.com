import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { RiArrowLeftSLine } from 'react-icons/ri';
import { SIDES } from './sides';
import { CORE, SYSTEMS, lightYears, systemById } from './systems';
import { systemLabel } from './warText';
import { FOV, WHOLE, fitTo, focus, lensOf, pan, planeAt, project, settled, turn, zoomAt } from './holo/holoCamera';
import { RINGS, holders, outline, sectorById, sectorName, sectorOf, systemsIn } from './holo/sectors';
import './holo.css';

// The holotable's stage (docs/superpowers/specs/2026-10-19-galaxy-holotable-design.md): the whole window, under
// HoloMap.jsx's glass panels, that the hands work on while the galaxy's scene draws the map in 3D behind it
// (holo/drive.js). As Helldivers 2 has it, the whole galaxy is its sectors: a press on one with systems in it opens it
// (the camera flies in, the map flat, its systems and their names come in), the crumb over the map or Escape shuts it,
// and a press on a system in it picks it (a second, as on the 2D map, jumps). A drag slides the plane; a right drag
// (or one with Shift or Ctrl) turns it round, as two fingers twisting do; a wheel or a pinch zooms about the
// pointer. Every system is a button here (Tab goes through the open sector's, a screen reader reads them), put where
// its system is each frame by the scene (holo/holoScene.js) and named only where there's room; the hover card rides in
// the hovered one's, a sector's follows the pointer. `stage` (a ref) gets the zoom and turn buttons' (HoloMap.jsx's, in
// the map's corner as on the 2D map) and the map keys' calls.

const STEP = 1.5; // (a button's or a key's zoom)
const DRAG = 5; // (px a press moves before it's a drag, not a pick)
const TURN = 0.006; // (radians a pixel, turning)
const TURN_STEP = Math.PI / 8; // (a turn button's or a key's: 22.5°)

// the camera's moves, by what the stage measured (the link's size and inset): made once a link
function cameraOf(holo) {
  let fitted = null; // (the last fitted pose it was sent to, the whole disc's or a sector's, and how to fit it again)
  let refit = () => {};
  // the frame the scene draws in: the stage, and past it what the panels cover (its lens shifted, holoScene.js)
  const frameOf = () => lensOf(holo.size, holo.inset);
  const norm = (x, y) => {
    const f = frameOf();
    return [((x + f.x) / f.W) * 2 - 1, 1 - ((y + f.y) / f.H) * 2];
  };
  // (whether a map point is drawn on the free part of the stage, a name's room in from its edges, where the camera's going)
  const onView = ([x, z], f) => {
    const [nx, ny, depth] = project(holo.target, [x - CORE[0], 0, z - CORE[1]], { aspect: f.aspect, fov: FOV });
    const sx = ((nx + 1) / 2) * f.W - f.x;
    const sy = ((1 - ny) / 2) * f.H - f.y;
    const { top = 0, right = 0, bottom = 0 } = holo.inset;
    return depth > 0 && sx > 40 && sx < holo.size.w - right - 40 && sy > top + 30 && sy < holo.size.h - bottom - 30;
  };
  const under = (x, y) => planeAt(holo.target, ...norm(x, y), { aspect: frameOf().aspect, fov: FOV });
  return {
    frameOf,
    // the whole disc fitted to the free part (now: no easing)
    fit(now = false) {
      const f = frameOf();
      fitted = WHOLE(f.aspect, FOV, f);
      refit = () => this.fit();
      (now ? holo.snap : holo.aim)(fitted);
    },
    // (whether the camera's still where the last fit sent it: the hands haven't moved it off; and that fit again, to a
    // free part that's changed)
    onFit: () => Boolean(fitted) && settled(holo.target, fitted),
    refit: () => refit(),
    // (about the point under the pointer, or a button's about the camera's own: the free part's middle)
    zoomBy: (f, x, y) => holo.aim(zoomAt(holo.target, f, x === undefined ? null : under(x, y))),
    // the map point under a screen point as it's drawn now: what a press or the pointer is over
    seen: (x, y) => planeAt(holo.pose, ...norm(x, y), { aspect: frameOf().aspect, fov: FOV }),
    // a sector opened: its edge and its systems fitted to the free part, the map flat as ever
    open(id, now = false) {
      const f = frameOf();
      const pts = [...outline(sectorById(id), 6), ...systemsIn(id).map((s) => s.pos)];
      fitted = fitTo(holo.target, pts, { aspect: f.aspect, fov: FOV, fx: f.fx, fy: f.fy });
      refit = () => this.open(id);
      (now ? holo.snap : holo.aim)(fitted);
    },
    turnBy: (a) => holo.aim(turn(holo.target, a)),
    // a course's ends in view, fitted to the free part of the screen (with `ifOff`, only if one of them isn't on it)
    frame(points, { ifOff = false } = {}) {
      const f = frameOf();
      if (ifOff && points.every((p) => onView(p, f))) return;
      holo.aim(fitTo(holo.target, points, { aspect: f.aspect, fov: FOV, fx: f.fx, fy: f.fy }));
    },
  };
}

// (a sector's ring, its holder and how many systems are in it, as its card and the crumb say them)
const ringOf = (id) => RINGS.find((r) => r.id === sectorById(id)?.ring)?.name ?? '';
const holderOf = (holds, id) => {
  const h = holds[id];
  if (!h?.side) return 'Held by nobody';
  return `${h.held ? 'Held by' : 'In reach of'} ${SIDES[h.side].short}${h.contested ? ' · contested' : ''}`;
};
const countOf = (id) => {
  const n = systemsIn(id).length;
  return n === 1 ? '1 system' : `${n} systems`;
};

export default function HoloStage({ holo, stage, war, current, pick, hover, onHover, onChoose, lit, pilots, fought, now }) {
  const root = useRef(null);
  const here = systemById(current);
  const cam = useMemo(() => cameraOf(holo), [holo]);
  const holds = useMemo(() => holders(war), [war]);
  // the sector open (its systems shown) and the one the pointer's over (ref'd for the hands, which outlive a render)
  const [sector, setSector] = useState(null);
  const [overSector, setOverSector] = useState(null);
  const open = useRef(null);
  const over = useRef(null);
  useEffect(() => {
    open.current = sector;
    holo.set({ sector, hoverSector: overSector });
  }, [holo, sector, overSector]);
  const touch = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);

  // (the size the scene puts the labels by: the stage's, which is the window's; and where the crumb goes, under the header)
  const [crumbAt, setCrumbAt] = useState({ x: 0, y: 0 });
  const remeasure = useRef(() => {});
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const frame = el.parentElement;
    const side = frame?.querySelector('.holomap-side');
    const all = (sel) => [...(frame?.querySelectorAll(sel) ?? [])];
    const heads = all('.holomap-head, .holomap-eras');
    // (a phone's: the war's board and the zoom in a row over the map's top; the key's and the layers' chips may sit
    // over the disc's lower corners, where its round leaves room)
    const tops = all('.holomap-strip, .holomap-zoom:not(.holo-turn)');
    const crumb = el.querySelector('.holo-crumb');
    const measure = () => {
      const r = el.getBoundingClientRect();
      holo.size = { w: r.width, h: r.height };
      // (the side panel beside the map, or along its foot on a phone, and what's over its top, the crumb under that: how
      // much of the stage they cover)
      const p = side?.getBoundingClientRect();
      const beside = Boolean(p && p.width < r.width * 0.6);
      // (the board only when the panel's a sheet, and the zoom where it's a row along the top: a narrow map's)
      const nearTop = (t) => t.getBoundingClientRect().top - r.top < r.height / 3;
      const above = [...heads, ...tops.filter((t) => (t.matches('.holomap-strip') ? !beside : nearTop(t)))];
      const head = Math.max(0, ...above.map((t) => t.getBoundingClientRect().bottom - r.top + 8));
      const right = beside ? Math.max(0, r.right - p.left + 12) : 0;
      holo.inset = { top: head + (crumb?.offsetHeight ?? 0) + 8, right, bottom: p && !beside ? Math.max(0, r.bottom - p.top + 8) : 0 };
      // (every control over the stage, which no name goes under: the header's, the board, the zoom, the chips, the crumb,
      // the side panel)
      const controls = all('.holomap-head > *, .holomap-eras, .holomap-strip-war, .holomap-strip-board, .holomap-zoom, .holomap-legend-toggle, .holomap-layers-toggle, .holo-crumb, .holomap-side');
      holo.blocks = controls.map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0).map((b) => ({ x0: b.left - r.left, y0: b.top - r.top, x1: b.right - r.left, y1: b.bottom - r.top }));
      setCrumbAt((was) => (was.x === (r.width - right) / 2 && was.y === head ? was : { x: (r.width - right) / 2, y: head }));
      // (the whole disc, or the sector open, fitted again to a free part that's changed, unless the hands have moved off it)
      if (cam.onFit()) cam.refit();
      holo.wake();
    };
    remeasure.current = measure;
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    for (const box of [el, side, ...heads]) if (box) ro?.observe(box);
    return () => ro?.disconnect();
  }, [holo, cam]);
  useEffect(() => remeasure.current(), [sector]); // (the crumb's words change with the sector)

  const openSector = (id) => {
    over.current = null;
    setOverSector(null);
    setSector(id);
    onHover(null);
    cam.open(id);
  };
  const galaxy = () => {
    setSector(null);
    cam.fit();
  };
  useImperativeHandle(stage, () => ({
    zoomIn: () => cam.zoomBy(STEP),
    zoomOut: () => cam.zoomBy(1 / STEP),
    fit: galaxy,
    frame: cam.frame,
    // a system shown: its sector opened, if it isn't already (the find's, the side panel's and the war card's picks)
    show(id) {
      const s = systemById(id);
      const sec = s && sectorOf(s.pos);
      if (sec && sec !== open.current) openSector(sec);
    },
    // back to the whole galaxy, if a sector's open (Escape's): whether one was
    back() {
      if (!open.current) return false;
      galaxy();
      return true;
    },
    turn: (dir) => cam.turnBy(dir * TURN_STEP),
  }));
  // the first frame, the whole disc fitted to the part of the window the side panel leaves (measured with the stage)
  useEffect(() => {
    cam.fit(true);
  }, [cam]);

  // the hands
  const hands = useRef({ pts: new Map(), moved: false, last: null, two: null });
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (e.target instanceof Element && e.target.closest('.holo-crumb')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1);
      if (!Number.isFinite(dy) || !dy) return;
      cam.zoomBy(Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.0068), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [cam]);

  const local = (e) => {
    const r = root.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  // (two fingers: how far apart, at what angle, and where their middle is)
  const twoOf = (h) => {
    const [a, b] = [...h.pts.values()];
    return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), a: Math.atan2(b[1] - a[1], b[0] - a[0]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  };
  // the sector card, by the pointer
  const card = useRef(null);
  const hoverAt = (x, y) => {
    const el = root.current;
    // in an open sector, a system first
    if (open.current) {
      const id = holo.at(x, y);
      onHover(id);
      if (id) {
        if (over.current) (over.current = null), setOverSector(null);
        if (el) el.style.cursor = 'pointer';
        return;
      }
    }
    const pt = cam.seen(x, y);
    const sec = pt && sectorOf(pt);
    const can = sec && sec !== open.current && systemsIn(sec).length > 0 ? sec : null;
    if (can !== over.current) (over.current = can), setOverSector(can);
    if (el) el.style.cursor = can ? 'pointer' : '';
    if (card.current) card.current.style.transform = `translate3d(${(x + 16).toFixed(0)}px, ${(y + 14).toFixed(0)}px, 0)`;
  };
  const onPointerLeave = () => {
    onHover(null);
    if (over.current) (over.current = null), setOverSector(null);
  };
  const onPointerDown = (e) => {
    if (e.target instanceof Element && e.target.closest('.holo-crumb')) return;
    const h = hands.current;
    h.pts.set(e.pointerId, local(e));
    h.moved = false;
    h.turning = e.button === 2 || e.shiftKey || e.ctrlKey;
    h.last = local(e);
    if (h.pts.size === 2) h.two = twoOf(h);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const h = hands.current;
    const p = local(e);
    if (!h.pts.has(e.pointerId)) {
      if (e.pointerType === 'mouse') hoverAt(...p);
      return;
    }
    h.pts.set(e.pointerId, p);
    if (h.pts.size === 2 && h.two) {
      // a pinch zooms about the fingers' middle, a twist turns the plane, and the middle moving slides it
      const now2 = twoOf(h);
      if (now2.d > 0 && h.two.d > 0) cam.zoomBy(now2.d / h.two.d, ...now2.mid);
      const twist = Math.atan2(Math.sin(now2.a - h.two.a), Math.cos(now2.a - h.two.a));
      const slid = pan(holo.target, now2.mid[0] - h.two.mid[0], now2.mid[1] - h.two.mid[1], { fov: FOV, h: cam.frameOf().H });
      holo.snap(turn(slid, twist));
      h.two = now2;
      h.moved = true;
      return;
    }
    const dx = p[0] - h.last[0];
    const dy = p[1] - h.last[1];
    if (!h.moved && Math.hypot(dx, dy) < DRAG) return;
    h.moved = true;
    h.last = p;
    holo.snap(h.turning ? turn(holo.target, -dx * TURN, dy * TURN) : pan(holo.target, dx, dy, { fov: FOV, h: cam.frameOf().H }));
  };
  const onPointerUp = (e) => {
    const h = hands.current;
    const was = h.pts.has(e.pointerId);
    const single = h.pts.size === 1;
    h.pts.delete(e.pointerId);
    if (h.pts.size < 2) h.two = null;
    if (!was || h.moved || !single) return;
    // a press that didn't move: in an open sector, the system nearest it (HoloMap.jsx's choose: a pick, and a second
    // press jumps); else the sector it's on, if it has systems and isn't open already
    const [x, y] = local(e);
    if (open.current) {
      const id = holo.at(x, y, e.pointerType === 'mouse' ? 18 : 28);
      if (id) {
        onChoose(id);
        return;
      }
    }
    const pt = cam.seen(x, y);
    const sec = pt && sectorOf(pt);
    if (sec && sec !== open.current && systemsIn(sec).length) openSector(sec);
  };

  const hovered = hover ? systemById(hover) : null;
  const hoveredRow = hovered ? war.byId[hovered.id] : null;
  return (
    <div ref={root} className="holo-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerLeave} onContextMenu={(e) => e.preventDefault()}>
      <ul className="holo-labels" aria-label={sector ? `Star systems in the ${sectorName(sector)}` : 'Star systems'}>
        {SYSTEMS.map((s) => {
          const row = war.byId[s.id];
          const you = row && fought.has(s.id);
          return (
            <li key={s.id}>
              <button
                ref={(el) => holo.label(s.id, el)}
                type="button"
                className="holo-label"
                data-id={s.id}
                data-dim={!lit(s) || undefined}
                data-charted={s.charted || undefined}
                data-off=""
                data-quiet=""
                style={{ '--c': row ? SIDES[row.owner].colour : s.accent }}
                aria-pressed={pick === s.id}
                aria-current={s.id === current ? 'location' : undefined}
                aria-label={row ? systemLabel(row, now, you) : s.name}
                onFocus={(e) => e.currentTarget.matches(':focus-visible') && holo.aim(focus(holo.target, s.pos, { dist: holo.target.dist }))}
                onClick={(e) => {
                  // (a press is the stage's, which picked already; this is the keyboard's Enter or Space)
                  if (e.detail === 0) onChoose(s.id);
                }}
              >
                <span className="holo-name">
                  {s.id === current && <b className="holo-youtag">YOU</b>}
                  <span className="holo-sys">{s.name}</span>
                  {row?.major && <b className="holomap-star" aria-hidden="true">★</b>}
                  {row?.battle?.fighting && <b className="holomap-fight" aria-hidden="true">⚔</b>}
                  {pilots[s.id] > 0 && <span className="holomap-pilots">{pilots[s.id]}</span>}
                </span>
                {hovered?.id === s.id && s.id !== pick && (
                  <span className="holo-card" aria-hidden="true">
                    <b>{s.name}</b>
                    <span>{[s.region, hoveredRow && SIDES[hoveredRow.owner].short, hoveredRow?.battle?.fighting && 'Battle on'].filter(Boolean).join(' · ')}</span>
                    <span>{s.id === current ? 'You are here' : `${lightYears(here, s).toLocaleString('en-US')} ly`}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {/* the sector the pointer's over: its name, its ring, who holds it and how many systems are in it */}
      <div ref={card} className="holo-scard" aria-hidden="true" hidden={!overSector}>
        {overSector && (
          <>
            <b>{sectorName(overSector)}</b>
            <span>{ringOf(overSector)}</span>
            <span>
              {holderOf(holds, overSector)} · {countOf(overSector)}
            </span>
          </>
        )}
      </div>
      {/* where the map is: the whole galaxy (and how to open a sector), or the sector open and the way back */}
      <div className="holo-crumb" style={{ left: crumbAt.x, top: crumbAt.y }} aria-live="polite">
        {sector ? (
          <>
            <button type="button" className="holo-back" onClick={galaxy} title="The whole galaxy (Esc)">
              <RiArrowLeftSLine aria-hidden="true" /> The galaxy
            </button>
            <span className="holo-crumb-name">{sectorName(sector)}</span>
            <span className="holo-crumb-meta">
              {ringOf(sector)} · {holderOf(holds, sector)} · {countOf(sector)}
            </span>
          </>
        ) : (
          <span className="holo-crumb-hint">{touch ? 'Tap' : 'Click'} a sector to see its systems</span>
        )}
      </div>
    </div>
  );
}
