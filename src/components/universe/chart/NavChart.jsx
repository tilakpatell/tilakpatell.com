import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RiArrowLeftLine } from 'react-icons/ri';
import { BELT } from '../layout';
import ChartTools from './ChartTools';
import { REGIONS } from './marks';
import { placeMarks, placeShip, ringOn, sectorGrid } from './place';
import { FRAMES, levelOf, project, reachOn, ringsFor, toFrame, warp } from './projection';

// The nav map's chart: the circle the places are drawn on, and the bar under
// it with the ship's sector and height and the chart's tools. It draws a
// view (projection.js) of marks (place.js's shape: marks.js's hand-made ones
// and where()'s live ones) through place.js, and holds no view of its own:
// NavMap.jsx keeps it in useChartView, whose handlers and box it is given.
//
// Under everything a canvas of stars; over it an SVG (1,000 units across,
// FRAMES.nav), drawing in this order: rings round the middle in powers of
// ten, the sectors' outlines (round the middle's, one deep in the
// neighbourhood and two in the universe), the home system's ring, the belt
// and the Curve's edge at the levels that show them, each place's stem (up
// for above the ship, dashed down for below), the wonders and the sun as they
// are (the far ones first), the crew's war (never left off: a check counts
// its seven sectors), the course, the other pilots and the far fights, and
// the ship, always, pinned to the rim when it is far off. Over the SVG, a
// button a place (Tab through them, a click picks, a second goes, a double
// click goes), Home system's and the Curve's (a click opens their chart),
// the front's, and the far fights' names. The sun and the pilots are drawn
// only. A name goes on whichever side of its dot place.js found clear, and
// one with no room (data-quiet) shows on a hover, a focus or a pick.
//
// <NavChart view marks ship course front onFront frontTitle frontOff pick
//   here hover dim onChoose onGo onRegion out tools readout handlers boxRef />
//   ship { x, y, z, heading } or null; course { to: [x, y, z], drive } or
//   null (drawn from the ship); front is where()'s, or null; pick, here (the
//   place the ship is at) and hover (lit from the list) are ids, and dim a
//   Set of the ids the filter leaves out; onRegion gets 'home' or
//   'rickmorty'; out is { label, onClick } or null, the way back out under
//   the circle; tools are ChartTools' props; readout is the bar's words, or
//   null with no ship.
//
// It measures its width and its names' font on a resize, and the names with
// a canvas in that font (and again once the page's fonts are in), so a name's
// box is what the page draws. Server-side it lays them out at 1,000 px with
// place.js's estimate.

const F = FRAMES.nav;
const ALL = ['system', 'neighbourhood', 'universe'];
const GLYPHS = new Set(['cloud', 'hole', 'star', 'portal', 'sun']); // (drawn in the SVG; the rest are a button's dot)
const LISTED = new Set(['region', 'fight', 'front']); // (and every pickable place)
const PRESET = { 'chart:home': 'home', 'chart:curve': 'rickmorty' };
const GRID = { neighbourhood: 1, universe: 2 }; // the sectors outlined round the middle's, by level
const STEM = 1.5; // shorter than this (SVG units), a place is level with the ship and has none
const FRONT = { colour: '#ffb347', priority: 47 }; // (navmap.css's front; its name after the wonders', as before)
const NAME_PAD = 8; // (.navmap-name's padding, both sides)
const REGION_SIZE = 0.6 / 0.7; // (.navmap-homebtn's name against the rest: 0.6rem to 0.7rem, mono, in capitals, 0.08em apart)
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const r2 = (n) => Math.round(n * 100) / 100;
const pc = (n, of) => `${(n / of) * 100}%`;
const uv = (view, at) => {
  const p = project(view, at);
  return [p.u, p.v];
};

function paintStars(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);
  g.fillStyle = '#03050d';
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.55);
  glow.addColorStop(0, 'rgba(255,200,130,0.16)');
  glow.addColorStop(0.18, 'rgba(120,150,255,0.07)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  let s = 271828;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const b = 0.15 + rand() * 0.55;
    g.fillStyle = `rgba(${200 + Math.round(rand() * 55)},${210 + Math.round(rand() * 40)},255,${b.toFixed(3)})`;
    const r = rand() < 0.05 ? 1.2 : 0.6;
    g.fillRect(rand() * w, rand() * h, r, r);
  }
}

// a wonder or the sun as it is, r its reach on the chart (6 at least, as before)
function glyph(p, dimmed) {
  const { x, y, mark } = p;
  const r = Math.max(6, p.size);
  const opacity = dimmed ? 0.35 : 1;
  const at = { cx: r2(x), cy: r2(y) };
  switch (mark.shape) {
    case 'sun':
      return <circle key={p.id} {...at} r={r2(Math.max(9, p.size * 1.8))} fill="url(#navmap-sun)" />;
    case 'cloud':
      return <circle key={p.id} {...at} r={r2(r)} fill="url(#navmap-cloud)" style={{ color: mark.color }} opacity={opacity} />;
    case 'hole':
      return (
        <g key={p.id} opacity={opacity}>
          <circle {...at} r={r2(r)} className="navmap-pull" />
          <ellipse {...at} rx={r2(r * 0.55)} ry={r2(r * 0.22)} fill="none" stroke="#ffb070" strokeWidth="2.5" />
          <circle {...at} r={r2(r * 0.22)} fill="#000" stroke="#ffd9a8" strokeWidth="1" />
        </g>
      );
    case 'star':
      return <circle key={p.id} {...at} r={r2(r)} className="navmap-system" style={{ color: mark.color }} opacity={opacity} />;
    default:
      return <circle key={p.id} {...at} r={r2(Math.max(9, r))} className="navmap-portal" style={{ color: mark.color }} opacity={opacity} />;
  }
}

// the front's place on the chart, named as before, after the wonders
const frontMark = (front) => (front && Array.isArray(front.at) ? { id: 'front', kind: 'front', name: `The front · ${front.name}`, at: front.at, priority: FRONT.priority, color: FRONT.colour, levels: ALL } : null);

// what the page draws a name at: its size, its families, and a canvas to measure them on
function useNameRuler(box) {
  const [ruler, setRuler] = useState({ scale: 1, fontPx: 11, measure: null, fonts: 0 });
  const canvas = useRef(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const read = () => {
      const w = el.clientWidth;
      if (!w) return; // (hidden: a phone's list. It's measured again when it shows)
      const css = getComputedStyle(el);
      const name = el.querySelector('.navmap-name');
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const fontPx = (name && parseFloat(getComputedStyle(name).fontSize)) || 0.7 * root;
      const sans = css.fontFamily;
      const mono = css.getPropertyValue('--font-mono').trim() || 'monospace';
      canvas.current ??= document.createElement('canvas').getContext('2d');
      const g = canvas.current;
      const measure = g
        ? (mark) => {
            if (mark.kind !== 'region') {
              g.font = `${fontPx}px ${sans}`;
              return Math.ceil(g.measureText(mark.name).width) + NAME_PAD;
            }
            const px = fontPx * REGION_SIZE;
            g.font = `${px}px ${mono}`;
            return Math.ceil(g.measureText(mark.name.toUpperCase()).width + 0.08 * px * mark.name.length) + NAME_PAD;
          }
        : null;
      setRuler((r) => ({ ...r, scale: w / F.w, fontPx, measure }));
    };
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    let on = true;
    document.fonts?.ready.then(() => on && setRuler((r) => ({ ...r, fonts: r.fonts + 1 }))); // (the names' widths change once the fonts are in)
    return () => {
      on = false;
      ro?.disconnect();
    };
  }, [box]);
  return ruler;
}

export default function NavChart({ view, marks, ship = null, course = null, front = null, onFront, frontTitle, frontOff = false, pick = null, here = null, hover = null, dim = null, onChoose, onGo, onRegion, out = null, tools = null, readout = null, handlers = null, boxRef = null }) {
  const own = useRef(null);
  const box = boxRef ?? own;
  const canvas = useRef(null);
  const { scale, fontPx, measure } = useNameRuler(box);

  // the stars, once (and again on a resize)
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const draw = () => paintStars(c);
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, []);

  const level = levelOf(view.range);
  const pitched = view.pitch > 0 || view.yaw !== 0;
  const dimmed = (id) => Boolean(dim?.has(id)) && id !== pick;
  const xy = (at) => {
    const { x, y } = toFrame(F, uv(view, at));
    return [r2(x), r2(y)];
  };
  const points = (list) => list.map((p) => toFrame(F, p)).map(({ x, y }) => `${r2(x)},${r2(y)}`).join(' ');

  // the places, and the front: one the filter leaves out keeps its dot but
  // not a name of its own (it shows on a hover, as one with no room does)
  const fm = frontMark(front);
  const all = fm ? [...marks, fm] : marks;
  const byId = new Map(all.map((m) => [m.id, m]));
  const shipAt = placeShip(view, ship, F);
  const placed = placeMarks(
    view,
    all.map((m) => (dimmed(m.id) && m.name ? { ...m, name: '' } : m)),
    F,
    { keep: pick ? [pick] : [], fontPx, scale, avoid: [shipAt], measure },
  );
  const listed = placed.filter((p) => p.mark.pickable || LISTED.has(p.mark.kind));
  const war = front && Array.isArray(front.sectors) ? front.sectors.filter((s) => Array.isArray(s?.at) && s.at.every(finite)) : [];
  const warFront = front && Array.isArray(front.at) && front.at.every(finite) ? xy(front.at) : null;
  const courseEnd = shipAt && course?.to?.every?.(finite) ? toFrame(F, uv(view, course.to), { pin: true }) : null;
  const belt = (() => {
    const mid = (BELT.inner + BELT.outer) / 2;
    return reachOn(view, [mid, 0, 0], (BELT.outer - BELT.inner) / 2) * 2 * F.r; // (the belt's width where it is, as a stroke)
  })();

  const nameOf = (p) => byId.get(p.id)?.name ?? p.mark.name;
  const label = (p) => {
    const m = byId.get(p.id) ?? p.mark;
    return `${m.name}${m.type ? `, ${m.type}` : ''}${here === p.id ? ', you’re here' : ''}`;
  };
  const item = (p) => {
    const m = p.mark;
    const name = <span className="navmap-name">{nameOf(p)}</span>;
    if (m.kind === 'region')
      return (
        <button type="button" className="navmap-place navmap-homebtn" onClick={() => onRegion?.(PRESET[p.id])}>
          {name}
        </button>
      );
    if (m.kind === 'front')
      return (
        <button type="button" className="navmap-place navmap-frontbtn" disabled={frontOff} onClick={() => onFront?.()} title={frontTitle}>
          {name}
        </button>
      );
    if (m.kind === 'fight') return <span className="navmap-place navmap-fightname">{name}</span>;
    return (
      <button type="button" className="navmap-place" aria-pressed={pick === p.id} aria-current={here === p.id ? 'location' : undefined} aria-label={label(p)} onClick={() => onChoose?.(p.id)} onDoubleClick={() => onGo?.(p.id)}>
        <span className="navmap-dot" aria-hidden="true" />
        {name}
      </button>
    );
  };

  return (
    <div className="navmap-stage">
      <div ref={box} className="navmap-chart" data-level={level} data-pitched={pitched || undefined} {...handlers}>
        <canvas ref={canvas} className="navmap-canvas" aria-hidden="true" />
        <svg className="navmap-svg" viewBox={`0 0 ${F.w} ${F.h}`} aria-hidden="true">
          <defs>
            <radialGradient id="navmap-cloud">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.5" />
              <stop offset="0.6" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="navmap-sun">
              <stop offset="0" stopColor="#fff4d6" />
              <stop offset="0.35" stopColor="#ffbf5e" />
              <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* rings round the middle, a power of ten apart, on the ship's plane */}
          {ringsFor(view.range).map((ring) => {
            const rx = warp([ring, 0, 0], view.range)[0] * F.r;
            return <ellipse key={ring} cx={F.cx} cy={F.cy} rx={r2(rx)} ry={r2(rx * Math.cos(view.pitch))} className="navmap-ring" />;
          })}
          {/* the sectors round the middle's */}
          {GRID[level] && sectorGrid(view, GRID[level]).map((s) => <polyline key={s.key} points={points(s.points)} className="navmap-sector" />)}
          {/* the home system's ring, the belt and the Curve's edge */}
          {REGIONS.filter((r) => r.levels.includes(level)).map((r) => (
            <polyline key={r.id} points={points(ringOn(view, r.centre, r.radius))} className="navmap-region" data-region={r.id} strokeWidth={r.id === 'belt' ? r2(belt) : undefined} />
          ))}
          {/* how far above or below the ship each place is */}
          {placed
            .filter((p) => Math.hypot(p.x - p.footX, p.y - p.footY) >= STEM)
            .map((p) => (
              <line key={p.id} x1={r2(p.footX)} y1={r2(p.footY)} x2={r2(p.x)} y2={r2(p.y)} className="navmap-stem" data-dir={p.y < p.footY ? 'up' : 'down'} />
            ))}
          {/* the wonders and the sun, as they are, the far ones under the near */}
          {placed
            .filter((p) => GLYPHS.has(p.mark.shape))
            .sort((a, b) => a.depth - b.depth)
            .map((p) => glyph(p, dimmed(p.id)))}
          {/* the crew's war (front.js): its sectors in a line, each in the colour of the side
              that holds it, and the front where they meet, a battle going on there */}
          {front && war.length > 0 && (
            <g className="navmap-war">
              <polyline points={war.map((s) => xy(s.at).join(',')).join(' ')} className="navmap-war-line" />
              {war.map((sec) => {
                const [x, y] = xy(sec.at);
                return <circle key={sec.id} cx={x} cy={y} r={front.sectors.indexOf(sec) === front.contested ? 7 : 4.5} fill={front.colours?.[sec.owner]} className="navmap-war-sector" />;
              })}
              {warFront && <circle cx={warFront[0]} cy={warFront[1]} r="14" className="navmap-war-front" />}
            </g>
          )}
          {/* the course: where it's going (and how), or to the place picked */}
          {courseEnd && <line x1={r2(shipAt.x)} y1={r2(shipAt.y)} x2={r2(courseEnd.x)} y2={r2(courseEnd.y)} className="navmap-course" data-drive={course.drive} />}
          {/* the other pilots online, and someone's fight out in deep space (farFights.js), seen from afar */}
          {placed
            .filter((p) => p.mark.shape === 'pilot')
            .map((p) => (
              <rect key={p.id} x={r2(p.x - 4)} y={r2(p.y - 4)} width="8" height="8" className="navmap-pilot" transform={`rotate(45 ${r2(p.x)} ${r2(p.y)})`} />
            ))}
          {placed
            .filter((p) => p.mark.shape === 'fight')
            .map((p) => (
              <g key={p.id} transform={`translate(${r2(p.x)} ${r2(p.y)})`} className="navmap-fight">
                <circle r="9" className="navmap-fight-ring" />
                <path d="M-4 -4 L4 4 M4 -4 L-4 4" />
              </g>
            ))}
          {/* you, wherever you are */}
          {shipAt && (
            <g transform={`translate(${r2(shipAt.x)} ${r2(shipAt.y)}) rotate(${r2(shipAt.angle)})`} className="navmap-ship" data-edge={shipAt.edge || undefined}>
              <circle r="16" className="navmap-ship-halo" />
              <path d="M13 0 L-8 -7.5 L-4 0 L-8 7.5 Z" />
            </g>
          )}
        </svg>
        {/* the places, as buttons over the chart (the galaxy's systems all sit at the gate: the list has them) */}
        <ul className="navmap-places" aria-label="Places">
          {listed.map((p) => (
            <li
              key={p.id}
              style={{ left: pc(p.x, F.w), top: pc(p.y, F.h), '--c': p.mark.color }}
              data-id={p.id}
              data-kind={p.mark.kind}
              data-side={p.side ?? p.spare ?? 'right'}
              data-quiet={p.side === null || undefined}
              data-dim={dimmed(p.id) || undefined}
              data-hover={hover === p.id || undefined}
              data-pick={pick === p.id || undefined}
            >
              {item(p)}
            </li>
          ))}
        </ul>
        {out && (
          <button type="button" className="navmap-out" onClick={out.onClick}>
            <RiArrowLeftLine className="h-3.5 w-3.5" aria-hidden="true" /> {out.label}
          </button>
        )}
      </div>
      <div className="navmap-bar">
        {readout && <p className="navmap-readout">{readout}</p>}
        {tools && <ChartTools className="navmap-tools" buttonClass="navmap-tool" {...tools} />}
      </div>
    </div>
  );
}
