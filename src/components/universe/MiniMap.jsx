import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BELT } from './layout';
import { byId } from './universes';
import { CHART_WORDS } from './words';
import ChartTools from './chart/ChartTools';
import { HAND_MARKS, REGIONS } from './chart/marks';
import { chartKey, ringStep } from './chart/input';
import { miniView, placeMarks, placeShip, ringOn } from './chart/place';
import { FRAMES, levelOf, toFrame } from './chart/projection';
import { useChartView } from './chart/useChartView';
import './universe.css';

// The universe map drawn flat, on the chart's own projection and marks (the
// nav map's: chart/projection.js, place.js, marks.js), so every hand-made
// place, wonder and moon sits where the nav map puts it. It's Home's teaser
// (`kind="fandom"`: just the worlds, each dot a link into the map) and the
// map itself when 3D is off (every place, each a button in one focus group:
// the arrow keys step through them, Home and End jump to the ends).
//
// Props:
//   selected, onSelect(id)   the place picked, and the pick
//   linkTo(id) → path        makes each place a link (the teaser)
//   kind                     'fandom' shows only the worlds of that kind
//   className                on the root
//   interactive              the visitor can zoom (wheel, + and − keys, the
//                            tools row), pan and go back (0); off, the chart
//                            is drawn at miniView(shown) exactly
//   ship                     { x, y, z, heading } or null. Lane 4c fills it
//                            from the ship's saved position (with 3D off
//                            there is none until then); drawn pinned to the
//                            rim when further than the chart reaches. With
//                            none, nothing ship-related is drawn.
const F = FRAMES.mini;
const STEM_MIN = 1.5; // (a stem shorter than this is the dot itself)
// (SVG numbers to a hundredth of a unit, far under a pixel; a place's own position stays exact: the test reads it against the nav map's to 9 places)
const n2 = (n) => Math.round(n * 100) / 100;
const pc = (n, of) => `${(n / of) * 100}%`;
const belt = REGIONS.find((g) => g.id === 'belt');

// a place's dot: bigger than its true size on this scale, so it reads
const dotOf = (mark) => {
  if (mark.kind === 'wonder') return 5;
  const u = byId(mark.id);
  return 5 + Math.min(7, (u?.size ?? 0) * 0.2);
};
const labelOf = (mark) => byId(mark.id)?.label ?? mark.name;
const swatchOf = (mark) => byId(mark.id)?.swatch ?? mark.color;
const typing = (el) => Boolean(el?.closest?.('input, textarea, select, [contenteditable]'));
const asPoints = (uvs) =>
  uvs
    .map((uv) => {
      const { x, y } = toFrame(F, uv);
      return `${n2(x)},${n2(y)}`;
    })
    .join(' ');

export default function MiniMap({ selected = null, onSelect, linkTo, kind = null, className = '', interactive = false, ship = null }) {
  const shown = useMemo(
    () =>
      HAND_MARKS.filter((m) => m.id === 'chart:sun' || (m.pickable && (!kind || byId(m.id)?.kind === kind))).map((m) => ({
        ...m,
        name: m.pickable ? labelOf(m) : m.name,
      })),
    [kind],
  );
  const open = useMemo(() => miniView(shown), [shown]);
  const list = useRef(null);
  const box = useRef(null);
  const none = useRef(null); // (a ref that stays null: not interactive, so no wheel listener)
  const chart = useChartView(interactive ? box : none, { open, frame: F, orbit: false });
  const view = interactive ? chart.view : open;
  const level = levelOf(view.range);

  const placed = placeMarks(view, shown, F, { levels: false, sides: ['under'], keep: selected ? [selected] : [] });
  const sun = placed.find((p) => p.mark.shape === 'sun');
  const places = placed.filter((p) => p.mark.pickable);
  const ids = places.map((p) => p.id);
  const focusable = ids.includes(selected) ? selected : ids[0];
  const shipAt = ship ? placeShip(view, ship, F) : null;
  const beltRing = ringOn(view, belt.centre, belt.radius);
  // (the band as wide as it looks: the gap between its edges, averaged round the ring)
  const edges = [ringOn(view, belt.centre, BELT.inner, 32), ringOn(view, belt.centre, BELT.outer, 32)];
  let beltGap = 0;
  for (let i = 0; i < 32; i += 1) beltGap += Math.hypot(edges[1][i][0] - edges[0][i][0], edges[1][i][1] - edges[0][i][1]) * F.r;
  beltGap = Math.max(1, beltGap / 32);

  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
    if (interactive) {
      const act = chartKey({ key: e.key }, { typing: false });
      if (act) {
        e.preventDefault();
        if (act === 'zoomIn') chart.zoomIn();
        else if (act === 'zoomOut') chart.zoomOut();
        else chart.setView(open);
        return;
      }
    }
    if (!onSelect || !e.target.closest?.('.minimap-labels')) return;
    const to = ringStep(ids, e.key, selected);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    list.current?.querySelector(`li[data-id="${to}"] .minimap-hit`)?.focus();
  };

  return (
    <div
      ref={interactive ? box : null}
      className={`minimap ${className}`}
      data-selected={selected || undefined}
      data-level={level}
      data-interactive={interactive || undefined}
      onKeyDown={onKeyDown}
      {...(interactive ? chart.handlers : {})}
    >
      <svg viewBox={`0 0 ${F.w} ${F.h}`} aria-hidden="true" className="minimap-svg">
        {/* the asteroid belt, a dotted band between the stations and the planets */}
        <polyline points={asPoints(beltRing)} fill="none" stroke="#9a8f80" strokeOpacity="0.35" strokeWidth={n2(beltGap * 0.5)} strokeDasharray="1 3" />
        {placed.map((p) =>
          Math.hypot(p.x - p.footX, p.y - p.footY) >= STEM_MIN ? (
            <line key={p.id} x1={n2(p.footX)} y1={n2(p.footY)} x2={n2(p.x)} y2={n2(p.y)} className="minimap-stem" data-dir={p.footY > p.y ? 'up' : 'down'} />
          ) : null,
        )}
        {sun && <circle cx={n2(sun.x)} cy={n2(sun.y)} r={n2(Math.max(3, sun.size * 0.35))} fill="#ffb347" opacity="0.9" />}
        {places.map((p) => {
          const r = dotOf(p.mark);
          const c = swatchOf(p.mark);
          const on = selected === p.id;
          return (
            <g key={p.id} className="minimap-planet" data-on={on || undefined} data-kind={p.mark.kind}>
              {on && <circle cx={n2(p.x)} cy={n2(p.y)} r={r + 6} fill="none" stroke={c} strokeOpacity="0.6" />}
              <circle cx={n2(p.x)} cy={n2(p.y)} r={r} fill={c} />
            </g>
          );
        })}
        {shipAt && (
          <g className="minimap-ship" transform={`translate(${n2(shipAt.x)} ${n2(shipAt.y)}) rotate(${n2(shipAt.angle)})`} data-edge={shipAt.edge || undefined}>
            <path d="M10 0 L-6 -5.5 L-3 0 L-6 5.5 Z" />
          </g>
        )}
      </svg>
      <ul ref={list} className="minimap-labels" aria-label="Universes">
        {places.map((p) => {
          const label = labelOf(p.mark);
          const quiet = p.side === null; // (no room for the name: the button keeps it as its label)
          const style = { left: pc(p.x, F.w), top: pc(p.y, F.h), '--swatch': swatchOf(p.mark) };
          const inner = <span className="minimap-name">{label}</span>;
          return (
            <li key={p.id} data-id={p.id} style={style} className="minimap-item" data-kind={p.mark.kind} data-quiet={quiet || undefined}>
              {linkTo ? (
                <Link to={linkTo(p.id)} className="minimap-hit" aria-label={quiet ? label : undefined}>
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  className="minimap-hit"
                  aria-label={quiet ? label : undefined}
                  aria-pressed={selected === p.id}
                  tabIndex={p.id === focusable ? 0 : -1}
                  onClick={() => onSelect?.(p.id)}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {interactive && <ChartTools className="minimap-tools" buttonClass="chip" label={CHART_WORDS.tools} onZoomIn={chart.zoomIn} onZoomOut={chart.zoomOut} onFit={() => chart.setView(open)} />}
    </div>
  );
}
