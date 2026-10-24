import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { byId } from './universes';
import { BELT } from './layout';
import { CHART_WORDS as W } from './words';
import ChartTools from './chart/ChartTools';
import { chartKey, ringStep } from './chart/input';
import { HAND_MARKS } from './chart/marks';
import { miniView, placeMarks, placeShip, ringOn } from './chart/place';
import { FRAMES, levelOf, reachOn } from './chart/projection';
import { useChartView } from './chart/useChartView';
import './universe.css';

// The universe map drawn flat: Home's teaser (just the fandoms, each dot a
// link into the map) and the map itself when 3D is off (every place: the
// stations, the worlds, their moons and the wonders, each a button in one
// focus group: the arrow keys step through them, Home and End jump to the
// ends). It is the nav map's chart in a box: the same marks (chart/marks.js),
// the same projection and the same placing (chart/place.js), seen from the
// old flat map's tilt with the sun in the middle and the belt round it. Each
// place stands on a stem from the disc, up for above it and dashed down for
// below, and its name hangs under its dot, or beside it, where there's room;
// one with none shows on a hover or a focus, and the picked one's always does.
//
// <MiniMap selected onSelect linkTo kind className interactive ship />
//   kind 'fandom' keeps it to the worlds (the teaser); linkTo(id) makes each
//   place a link, else a click is onSelect(id). interactive (the 3D-off map)
//   gives it the chart's hands: a drag moves it, the wheel and a pinch zoom,
//   + and − zoom with the focus inside it and 0 goes back to the whole map,
//   and its tools are under it. ship ({ x, y, z, heading }) is drawn, pinned
//   to the box when it's off it. Nothing passes one yet: with 3D off nothing
//   knows where the ship is until its place is saved.

const F = FRAMES.mini;
const SUN = 'chart:sun';
const STEM = 1.5; // shorter than this (the box's units), a place is level with the disc and has none
// a name hangs under its dot, as it always has, or goes beside it where
// that's clear: under alone, a wonder's dot beside nearly every world kept
// all but a few names off the whole map
const SIDES = ['under', 'right', 'left'];
// a name's letters: the mono face's 0.6em and .minimap-hit's 0.02em apart
const MONO = 0.62;
// (place.js's boxes are the nav map's 16 px dot, its name from 6 px past it:
// a name beside a bigger dot starts as far past that, and its box is as much
// longer, universe.css's --dot)
const DOT_PX = 8;
const STILL = { current: null }; // (the teaser's box, for the hook: no wheel on it)
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const r2 = (n) => Math.round(n * 100) / 100;
const pc = (n, of) => `${(n / of) * 100}%`;

// a place's words: its universe's own label where it has one (the teaser
// reads "Marvel", not its world's name), else nav.js's name
const named = (m) => {
  const label = byId(m.id)?.label;
  return label && label !== m.name ? { ...m, name: label } : m;
};
// what each kind of map shows, and the view that fits round it, made once
const SHOWN = new Map();
function shownFor(kind) {
  const key = kind ?? '';
  if (!SHOWN.has(key)) {
    const marks = HAND_MARKS.filter((m) => m.id === SUN || (kind ? byId(m.id)?.kind === kind : m.pickable)).map(named);
    SHOWN.set(key, { marks, open: miniView(marks) });
  }
  return SHOWN.get(key);
}
// a place's dot: bigger than its true size on this scale, so it reads (a
// wonder's, as small as the smallest)
const dot = (id) => {
  const u = byId(id);
  return u ? 5 + Math.min(7, u.size * 0.2) : 5;
};

// the box's px to a unit of its frame, and its names' size: measured on a
// resize (server-side, a px a unit and the names at 11 px)
function useBoxScale(box) {
  const [fit, setFit] = useState({ scale: 1, fontPx: 11 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const read = () => {
      const w = el.clientWidth;
      if (!w) return;
      const hit = el.querySelector('.minimap-hit');
      const fontPx = (hit && parseFloat(getComputedStyle(hit).fontSize)) || 11;
      setFit((f) => (f.scale === w / F.w && f.fontPx === fontPx ? f : { scale: w / F.w, fontPx }));
    };
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [box]);
  return fit;
}

export default function MiniMap({ selected = null, onSelect, linkTo, kind = null, className = '', interactive = false, ship = null }) {
  const { marks, open } = shownFor(kind);
  const box = useRef(null);
  const list = useRef(null);
  const chart = useChartView(interactive ? box : STILL, { open, frame: F, orbit: false });
  const view = interactive ? chart.view : open;
  const { scale, fontPx } = useBoxScale(box);

  const shipAt = placeShip(view, ship, F);
  const placed = placeMarks(view, marks, F, {
    levels: false,
    sides: SIDES,
    keep: selected ? [selected] : [],
    fontPx,
    scale,
    avoid: [shipAt],
    measure: (m) => m.name.length * MONO * fontPx + Math.max(0, dot(m.id) * scale - DOT_PX),
  });
  const sun = placed.find((p) => p.id === SUN);
  const places = placed.filter((p) => p.id !== SUN);
  const order = places.map((p) => p.id);
  const focusable = order.includes(selected) ? selected : order[0];
  // the belt, a dotted band between the stations and the planets, as wide as half of it
  const mid = (BELT.inner + BELT.outer) / 2;
  const belt = ringOn(view, [0, 0, 0], mid).map(([u, v]) => `${r2(F.cx + u * F.r)},${r2(F.cy + v * F.r)}`).join(' ');
  const beltWide = reachOn(view, [mid, 0, 0], (BELT.outer - BELT.inner) / 2) * F.r;

  // the chart's keys, the focus anywhere inside it: + and − zoom, 0 shows it all again
  const onChartKey = (e) => {
    const act = chartKey(e);
    if (!act) return;
    e.preventDefault();
    chart[act]();
  };
  const onKeyDown = (e) => {
    if (!onSelect || e.altKey || e.ctrlKey || e.metaKey) return;
    const to = ringStep(order, e.key, selected);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    list.current?.querySelector(`[data-id="${to}"] .minimap-hit`)?.focus();
  };

  return (
    <div className={`minimap ${className}`} data-level={levelOf(view.range)} data-live={interactive || undefined} data-selected={selected || undefined} onKeyDown={interactive ? onChartKey : undefined}>
      <div ref={box} className="minimap-chart" {...(interactive ? chart.handlers : null)}>
        <svg viewBox={`0 0 ${F.w} ${F.h}`} aria-hidden="true" className="minimap-svg">
          {/* (the belt is the one thing drawn whatever the range, so it's held to the box: zoomed
              in away from the sun it would run off it, over the page; the same box on every map) */}
          <clipPath id="minimap-box">
            <rect width={F.w} height={F.h} />
          </clipPath>
          {belt && <polyline points={belt} fill="none" stroke="#9a8f80" strokeOpacity="0.35" strokeWidth={r2(beltWide)} strokeDasharray="1 3" clipPath="url(#minimap-box)" />}
          {/* (drawn smaller than its true size here, as it was: true, it would reach the stations) */}
          {sun && <circle cx={r2(sun.x)} cy={r2(sun.y)} r={r2(Math.max(3, sun.size * 0.4))} fill="#ffb347" opacity="0.9" />}
          {places
            .filter((p) => Math.hypot(p.x - p.footX, p.y - p.footY) >= STEM)
            .map((p) => (
              <line key={p.id} x1={r2(p.footX)} y1={r2(p.footY)} x2={r2(p.x)} y2={r2(p.y)} className="minimap-stem" data-dir={p.y < p.footY ? 'up' : 'down'} />
            ))}
          {places.map((p) => (
            <g key={p.id} className="minimap-planet" data-on={selected === p.id || undefined}>
              {selected === p.id && <circle cx={r2(p.x)} cy={r2(p.y)} r={dot(p.id) + 6} fill="none" stroke={p.mark.color} strokeOpacity="0.6" />}
              <circle cx={r2(p.x)} cy={r2(p.y)} r={dot(p.id)} fill={p.mark.color} />
            </g>
          ))}
          {shipAt && finite(shipAt.angle) && (
            <g transform={`translate(${r2(shipAt.x)} ${r2(shipAt.y)}) rotate(${r2(shipAt.angle)})`} className="minimap-ship" data-edge={shipAt.edge || undefined}>
              <path d="M8 0 L-5 -4.5 L-2.5 0 L-5 4.5 Z" />
            </g>
          )}
        </svg>
        <ul ref={list} className="minimap-labels" aria-label={W.places} onKeyDown={onKeyDown}>
          {places.map((p) => {
            const name = p.mark.name;
            const inner = <span className="minimap-name">{name}</span>;
            return (
              <li key={p.id} style={{ left: pc(p.x, F.w), top: pc(p.y, F.h), '--swatch': p.mark.color, '--dot': `${r2(dot(p.id) * scale)}px` }} className="minimap-item" data-id={p.id} data-kind={p.mark.kind} data-side={p.side ?? p.spare ?? 'under'} data-quiet={p.side === null || undefined}>
                {linkTo ? (
                  <Link to={linkTo(p.id)} className="minimap-hit" aria-label={name}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" className="minimap-hit" aria-label={name} aria-pressed={selected === p.id} tabIndex={p.id === focusable ? 0 : -1} onClick={() => onSelect?.(p.id)}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {interactive && <ChartTools className="minimap-tools" buttonClass="chip" onZoomIn={chart.zoomIn} onZoomOut={chart.zoomOut} onFit={() => chart.setView(open)} />}
    </div>
  );
}
