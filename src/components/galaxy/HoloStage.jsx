import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { SIDES } from './sides';
import { CORE, SYSTEMS, lightYears, systemById } from './systems';
import { systemLabel } from './warText';
import { FOV, WHOLE, fitTo, focus, lensOf, pan, planeAt, project, settled, turn, zoomAt } from './holo/holoCamera';
import './holo.css';

// The holotable's stage (docs/superpowers/specs/2026-10-19-galaxy-holotable-design.md): the whole window, under
// HoloMap.jsx's glass panels, that the hands work on while the galaxy's scene draws the map in 3D behind it
// (holo/drive.js). A drag slides the plane, a right drag (or one with Shift) turns it and tips it, a wheel or a
// pinch zooms about the pointer, a press picks the system nearest it (and a second, as on the 2D map, jumps). Every system is
// a button here, as on the 2D map (Tab goes through them, a screen reader reads them), put where its system is each
// frame by the scene (holo/holoScene.js) and named only where there's room; the hover card rides in the hovered
// one's. `stage` (a ref) gets the zoom buttons' (HoloMap.jsx's, in the map's corner as on the 2D map) and the map
// keys' calls.

const STEP = 1.5; // (a button's or a key's zoom)
const DRAG = 5; // (px a press moves before it's a drag, not a pick)
const TURN = 0.006; // (radians a pixel, turning)

// the camera's moves, by what the stage measured (the link's size and inset): made once a link
function cameraOf(holo) {
  let fitted = null; // (the last whole-disc pose it was sent to)
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
      (now ? holo.snap : holo.aim)(fitted);
    },
    // (whether the camera's still where the last fit sent it: the hands haven't moved it off)
    onFit: () => Boolean(fitted) && settled(holo.target, fitted),
    // (about the point under the pointer, or a button's about the camera's own: the free part's middle)
    zoomBy: (f, x, y) => holo.aim(zoomAt(holo.target, f, x === undefined ? null : under(x, y))),
    // a course's ends in view, fitted to the free part of the screen (with `ifOff`, only if one of them isn't on it: a pick's,
    // as on the 2D map)
    frame(points, { ifOff = false } = {}) {
      const f = frameOf();
      if (ifOff && points.every((p) => onView(p, f))) return;
      holo.aim(fitTo(holo.target, points, { aspect: f.aspect, fov: FOV, fx: f.fx, fy: f.fy }));
    },
  };
}

export default function HoloStage({ holo, stage, war, current, pick, hover, onHover, onChoose, lit, pilots, fought, now }) {
  const root = useRef(null);
  const here = systemById(current);
  const cam = useMemo(() => cameraOf(holo), [holo]);
  // (the size the scene puts the labels by: the stage's, which is the window's)
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const frame = el.parentElement;
    const side = frame?.querySelector('.holomap-side');
    const all = (sel) => [...(frame?.querySelectorAll(sel) ?? [])];
    const heads = all('.holomap-head, .holomap-eras');
    // (a phone's: the war's board and the zoom in a row over the map's top; the key's and the layers' chips may sit
    // over the disc's lower corners, where its round leaves room)
    const tops = all('.holomap-strip, .holomap-zoom');
    // (and every control over the stage, which no name goes under: the header's, the board, the zoom, the chips, the
    // side panel)
    const controls = all('.holomap-head > *, .holomap-eras, .holomap-strip-war, .holomap-strip-board, .holomap-zoom, .holomap-legend-toggle, .holomap-layers-toggle, .holomap-side');
    const measure = () => {
      const r = el.getBoundingClientRect();
      holo.size = { w: r.width, h: r.height };
      // (the side panel beside the map, or along its foot on a phone, and what's over its top: how much of the stage
      // they cover)
      const p = side?.getBoundingClientRect();
      const beside = Boolean(p && p.width < r.width * 0.6);
      const over = beside ? heads : [...heads, ...tops];
      const top = Math.max(0, ...over.map((t) => t.getBoundingClientRect().bottom - r.top + 8));
      holo.inset = { top, right: beside ? Math.max(0, r.right - p.left + 12) : 0, bottom: p && !beside ? Math.max(0, r.bottom - p.top + 8) : 0 };
      holo.blocks = controls.map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0).map((b) => ({ x0: b.left - r.left, y0: b.top - r.top, x1: b.right - r.left, y1: b.bottom - r.top }));
      // (the whole disc fitted again to a window that's changed, unless the hands have moved off it)
      if (cam.onFit()) cam.fit(true);
      holo.wake();
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    for (const box of [el, side, ...heads]) if (box) ro?.observe(box);
    return () => ro?.disconnect();
  }, [holo, cam]);

  useImperativeHandle(stage, () => ({ zoomIn: () => cam.zoomBy(STEP), zoomOut: () => cam.zoomBy(1 / STEP), fit: () => cam.fit(), frame: cam.frame }), [cam]);
  // the first frame, the whole disc fitted to the part of the window the side panel leaves (measured with the stage)
  useEffect(() => {
    cam.fit(true);
  }, [cam]);

  // the hands
  const hands = useRef({ pts: new Map(), moved: false, last: null, pinch: null });
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const onWheel = (e) => {
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
  const onPointerDown = (e) => {
    const h = hands.current;
    h.pts.set(e.pointerId, local(e));
    h.moved = false;
    h.turning = e.button === 2 || e.shiftKey;
    h.last = local(e);
    if (h.pts.size === 2) {
      const [a, b] = [...h.pts.values()];
      h.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const h = hands.current;
    const p = local(e);
    if (!h.pts.has(e.pointerId)) {
      if (e.pointerType === 'mouse') onHover(holo.at(...p));
      return;
    }
    h.pts.set(e.pointerId, p);
    if (h.pts.size === 2 && h.pinch) {
      const [a, b] = [...h.pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d > 0 && h.pinch.d > 0) cam.zoomBy(d / h.pinch.d, ...h.pinch.mid);
      h.pinch.d = d;
      h.moved = true;
      return;
    }
    const dx = p[0] - h.last[0];
    const dy = p[1] - h.last[1];
    if (!h.moved && Math.hypot(p[0] - h.last[0], p[1] - h.last[1]) < DRAG) return;
    h.moved = true;
    h.last = p;
    holo.snap(h.turning ? turn(holo.target, -dx * TURN, dy * TURN) : pan(holo.target, dx, dy, { fov: FOV, h: cam.frameOf().H }));
  };
  const onPointerUp = (e) => {
    const h = hands.current;
    const was = h.pts.has(e.pointerId);
    h.pts.delete(e.pointerId);
    if (h.pts.size < 2) h.pinch = null;
    if (!was || h.moved) return;
    // a press that didn't move: the system nearest it, if any (HoloMap.jsx's choose: a pick, and a second press jumps)
    const id = holo.at(...local(e), e.pointerType === 'mouse' ? 18 : 28);
    if (id) onChoose(id);
  };

  const hovered = hover ? systemById(hover) : null;
  const hoveredRow = hovered ? war.byId[hovered.id] : null;
  return (
    <div ref={root} className="holo-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={() => onHover(null)} onContextMenu={(e) => e.preventDefault()}>
      <ul className="holo-labels" aria-label="Star systems">
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
                  {s.name}
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
    </div>
  );
}
