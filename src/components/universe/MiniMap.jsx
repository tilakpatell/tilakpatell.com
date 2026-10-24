import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { byId } from './universes';
import { BELT } from './layout';
import { CHART_WORDS as W } from './words';
import { HAND_MARKS } from './chart/marks';
import { miniView, placeMarks, placeShip, ringOn } from './chart/place';
import { FRAMES, levelOf, reachOn } from './chart/projection';
import './universe.css';

// The universe map drawn flat: Home's teaser (just the fandoms, each dot a
// link into the map) and, under FlatMap.jsx, the map itself when 3D is off
// (every place: the stations, the worlds, their moons and the wonders, each a
// button in one focus group). It is the nav map's chart in a box: the same
// marks (chart/marks.js), the same projection and the same placing
// (chart/place.js), seen from the old flat map's tilt with the sun in the
// middle and the belt round it. Each place stands on a stem from the disc, up
// for above it and dashed down for below, and its name hangs under its dot,
// or beside it, where there's room (a world's over a lesser place's dot,
// where it has none clear of them all); one with none shows on a hover or a
// focus, and the picked one's always does. It only draws: the hands, the keys
// and the tools are FlatMap's, so the teaser loads none of them.
//
// <MiniMap selected onSelect linkTo kind className ship view boxRef handlers onKeyDown onListKey>{children}</MiniMap>
//   kind 'fandom' keeps it to the worlds (the teaser); linkTo(id) makes each
//   place a link, else a click is onSelect(id). ship ({ x, y, z, heading }) is
//   drawn, pinned to the box when it's off it; nothing passes one yet: with
//   3D off nothing knows where the ship is until its place is saved. view is
//   the chart's (the whole map without one); handlers go on the box (boxRef)
//   and make it live; onKeyDown is the root's, onListKey(e, ids) the list's,
//   with the ids of the places on the chart in order; children go under the box.

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
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const rankOf = (p) => (finite(p.mark.priority) ? p.mark.priority : 0);
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

export default function MiniMap({ selected = null, onSelect, linkTo, kind = null, className = '', ship = null, view = null, boxRef = null, handlers = null, onKeyDown, onListKey, children }) {
  const { marks, open } = shownFor(kind);
  const own = useRef(null);
  const box = boxRef ?? own;
  const clip = useId(); // (the belt's clip, its own on each map: two on one page never share an id)
  const live = Boolean(handlers);
  // the place with the keys' focus, kept on the chart as the pick is: a zoom
  // or a drag that took its button off would drop the focus, and the keys
  // with it. Only the keys' (it shows its ring): a press of the mouse focuses
  // a button too, and a drag from its name would leave it stuck to the edge
  const [focused, setFocused] = useState(null);
  const at = view ?? open;
  const { scale, fontPx } = useBoxScale(box);

  const shipAt = placeShip(at, ship, F);
  const placed = placeMarks(at, marks, F, {
    levels: false,
    sides: SIDES,
    keep: [selected, live && focused].filter(Boolean),
    fontPx,
    scale,
    avoid: [shipAt],
    // (a world's name may lie over a wonder's or a moon's dot where it has no
    // other room: names are under every button, so that dot stays its own)
    ranked: true,
    measure: (m) => m.name.length * MONO * fontPx + Math.max(0, dot(m.id) * scale - DOT_PX),
  });
  const sun = placed.find((p) => p.id === SUN);
  const places = placed.filter((p) => p.id !== SUN);
  const order = places.map((p) => p.id);
  const focusable = order.includes(selected) ? selected : order[0];
  // a button stacks by its place's priority, the highest on top, whatever its
  // place in the list: a wonder or a moon comes later in it, and its 44 px
  // button would sit over a world's dot beside it (the portal's over Rick
  // and Morty's), and a click on the world pick it. Nothing lifts a button: a
  // hover or the keys' focus lifts its name alone over them all, and a click
  // goes through it (--top: universe.css)
  const tiers = [...new Set(places.map(rankOf))].sort((a, b) => a - b);
  // the belt, a dotted band between the stations and the planets, as wide as
  // half of it where it's nearest the chart's focus: the scale is biggest
  // there, and one line is one width all round
  const mid = (BELT.inner + BELT.outer) / 2;
  const belt = ringOn(at, [0, 0, 0], mid).map(([u, v]) => `${r2(F.cx + u * F.r)},${r2(F.cy + v * F.r)}`).join(' ');
  const toward = Math.atan2(at.focus[2], at.focus[0]);
  const beltWide = reachOn(at, [mid * Math.cos(toward), 0, mid * Math.sin(toward)], (BELT.outer - BELT.inner) / 2) * F.r;

  return (
    <div className={`minimap ${className}`} data-level={levelOf(at.range)} data-live={live || undefined} data-selected={selected || undefined} onKeyDown={onKeyDown}>
      <div ref={box} className="minimap-chart" {...handlers}>
        <svg viewBox={`0 0 ${F.w} ${F.h}`} aria-hidden="true" className="minimap-svg">
          {/* (the belt is the one thing drawn whatever the range, so it's held to the box: zoomed
              in away from the sun it would run off it, over the page; the same box on every map) */}
          <clipPath id={clip}>
            <rect width={F.w} height={F.h} />
          </clipPath>
          {belt && <polyline points={belt} fill="none" stroke="#9a8f80" strokeOpacity="0.35" strokeWidth={r2(beltWide)} strokeDasharray="1 3" clipPath={`url(#${clip})`} />}
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
        <ul className="minimap-labels" aria-label={W.places} style={{ '--top': tiers.length + 1 }} onKeyDown={onListKey && ((e) => onListKey(e, order))}>
          {places.map((p) => {
            const name = p.mark.name;
            const inner = <span className="minimap-name">{name}</span>;
            return (
              <li
                key={p.id}
                style={{ left: pc(p.x, F.w), top: pc(p.y, F.h), '--swatch': p.mark.color, '--dot': `${r2(dot(p.id) * scale)}px`, '--z': tiers.indexOf(rankOf(p)) + 1 }}
                className="minimap-item"
                data-id={p.id}
                data-kind={p.mark.kind}
                data-side={p.side ?? p.spare ?? 'under'}
                data-quiet={p.side === null || undefined}
                onFocus={(e) => setFocused(e.target?.matches?.(':focus-visible') ? p.id : null)}
                onBlur={() => setFocused(null)}
              >
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
      {children}
    </div>
  );
}
