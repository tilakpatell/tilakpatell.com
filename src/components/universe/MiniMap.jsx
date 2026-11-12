import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { byId } from './universes';
import { FRAMES } from './chart/projection';
import { HAND_MARKS, REGIONS } from './chart/marks';
import { miniView, placeMarks, placeShip, ringOn } from './chart/place';
import { useChartView } from './chart/useChartView';
import { chartKey, ringStep } from './chart/input';
import ChartTools from './chart/ChartTools';
import './universe.css';

// The universe map drawn flat: the nav map's own chart (chart/projection.js
// and chart/place.js, on the same marks, chart/marks.js), seen from the 3D
// overview's tilt, round the sun, with the asteroid belt and a dot per place
// in its colour, the wonders and the Curve's worlds among them. It's Home's
// teaser (just the fandoms, each dot a link into the map) and the map itself
// when 3D is off (every place, each a button in one focus group: the arrow
// keys step through them, Home and End jump to the ends; `interactive`, it
// zooms and pans as the nav map's chart does, with + − 0 and its buttons).
const F = FRAMES.mini;
const W = F.w;
const H = F.h;
const pts = (list) => list.map(([u, v]) => `${(F.cx + u * F.r).toFixed(1)},${(F.cy + v * F.r).toFixed(1)}`).join(' ');
// a place's dot: bigger than its true size on this scale, so it reads
const dot = (mark) => (mark.kind === 'wonder' ? 5 : 5 + Math.min(7, (byId(mark.id)?.size ?? 0) * 0.2));
const SUN = HAND_MARKS.find((m) => m.id === 'chart:sun');
const BELT = REGIONS.find((r) => r.id === 'belt');
// a name's box under its dot, in the page's pixels (universe.css's .minimap-hit:
// 0.68rem of mono type, about 0.6 of it a letter, starting 8 px under the dot's middle)
const NAME = { letter: 6.6, height: 13, dot: 5, gap: 3 };
const marksFor = (kind) => [...HAND_MARKS.filter((m) => m.pickable && (!kind || byId(m.id)?.kind === kind)), SUN].map((m) => (m.name ? { ...m, name: labelOf(m) } : m));
// (a world goes by its fandom's name here, as it always has: Marvel, not Avengers HQ)
const labelOf = (mark) => byId(mark.id)?.label ?? mark.name;

export default function MiniMap({ selected = null, onSelect, linkTo, kind = null, className = '', interactive = false, ship = null }) {
  const shown = useMemo(() => marksFor(kind), [kind]);
  const box = useRef(null);
  const list = useRef(null);
  const [open] = useState(() => miniView(shown));
  const chart = useChartView(box, { open, frame: F, orbit: false, hands: interactive });
  const [px, setPx] = useState(0); // (its width on the page: the names are laid out in pixels)
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const size = () => setPx(el.clientWidth);
    size();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const view = interactive ? chart.view : open;
  const placed = placeMarks(view, shown, F, { levels: false, sides: ['down'], keep: [selected], scale: px ? px / W : 1, measure: (t) => t.length * NAME.letter, height: NAME.height, dot: NAME.dot, gap: NAME.gap });
  const items = placed.filter((p) => p.mark.pickable);
  const ids = items.map((p) => p.id);
  const focusable = selected && ids.includes(selected) ? selected : ids[0];
  const sun = placed.find((p) => p.id === 'chart:sun');
  const shipAt = ship ? placeShip(view, ship, F) : null;

  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const act = interactive ? chartKey(e) : null;
    if (act) {
      e.preventDefault();
      ({ zoomIn: chart.zoomIn, zoomOut: chart.zoomOut, back: () => chart.goTo(open) })[act]();
      return;
    }
    if (!onSelect) return;
    const to = ringStep(ids, e.key, selected);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    list.current?.querySelector(`[data-id="${to}"]`)?.focus();
  };

  return (
    <div className={`minimap ${className}`} data-selected={selected || undefined} data-level={interactive ? chart.level : undefined} onKeyDown={interactive ? onKeyDown : undefined}>
      <div ref={box} className="minimap-box" {...chart.handlers}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="minimap-svg">
          {/* the asteroid belt, a dotted band between the stations and the planets */}
          <polyline points={pts(ringOn(view, BELT.centre, BELT.radius))} fill="none" stroke="#9a8f80" strokeOpacity="0.35" strokeWidth="3" strokeDasharray="1 3" />
          {sun && <circle cx={sun.x} cy={sun.y} r={Math.max(3, sun.size * 0.35)} fill="#ffb347" opacity="0.9" />}
          {items.map((p) => (
            <g key={p.id} className="minimap-planet" data-on={selected === p.id || undefined}>
              {Math.hypot(p.x - p.footX, p.y - p.footY) >= 1.5 && <line x1={p.footX} y1={p.footY} x2={p.x} y2={p.y} className="minimap-stem" />}
              {selected === p.id && <circle cx={p.x} cy={p.y} r={dot(p.mark) + 6} fill="none" stroke={p.mark.color} strokeOpacity="0.6" />}
              {p.mark.shape === 'dot' ? <circle cx={p.x} cy={p.y} r={dot(p.mark)} fill={p.mark.color} /> : <circle cx={p.x} cy={p.y} r={dot(p.mark)} fill="none" stroke={p.mark.color} strokeWidth="1.6" strokeDasharray={p.mark.shape === 'portal' ? '2 1.5' : undefined} />}
            </g>
          ))}
          {shipAt && (
            <g transform={`translate(${+shipAt.x.toFixed(2)} ${+shipAt.y.toFixed(2)}) rotate(${+shipAt.angle.toFixed(2)})`} className="minimap-ship" data-edge={shipAt.edge || undefined}>
              <path d="M9 0 L-6 -5 L-3 0 L-6 5 Z" />
            </g>
          )}
        </svg>
        <ul ref={list} className="minimap-labels" aria-label="Universes" onKeyDown={interactive ? undefined : onKeyDown}>
          {items.map((p) => {
            const style = { left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, '--swatch': p.mark.color };
            const label = labelOf(p.mark);
            const inner = (
              <span className="minimap-name" data-off={(p.side === null && selected !== p.id) || undefined}>
                {label}
              </span>
            );
            return (
              <li key={p.id} style={style} className="minimap-item" data-id={p.id}>
                {linkTo ? (
                  <Link to={linkTo(p.id)} className="minimap-hit" data-id={p.id} aria-label={label}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" className="minimap-hit" data-id={p.id} aria-label={label} aria-pressed={selected === p.id} tabIndex={p.id === focusable ? 0 : -1} onClick={() => onSelect?.(p.id)}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {interactive && <ChartTools className="minimap-tools" buttonClass="chip" onZoomIn={chart.zoomIn} onZoomOut={chart.zoomOut} onFit={() => chart.goTo(open)} fitted={chart.view === open} />}
    </div>
  );
}
