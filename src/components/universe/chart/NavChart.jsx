import { useEffect, useRef, useState } from 'react';
import { RiArrowLeftLine } from 'react-icons/ri';
import { BELT } from '../layout';
import { destinationById } from '../nav';
import { CHART_WORDS } from '../words';
import ChartTools from './ChartTools';
import { REGIONS } from './marks';
import { placeMarks, placeShip, ringOn, sectorGrid } from './place';
import { FRAMES, levelOf, project, ringsFor, toFrame, warp } from './projection';

// The nav map's chart (NavMap.jsx keeps the header, the filters and the side
// panel): a canvas of stars under an SVG of the rings, the sectors, the
// regions, every mark's stem and glyph, the war, the course, the pilots and
// fights and the ship, with a button per place over that (Tab through, Enter
// to pick, Enter again to go). Under the circle, a bar: where the ship is
// (its sector and its height) and the chart's tools. Everything goes through
// the chart's one projection (projection.js, place.js), centred on the ship
// unless the visitor has panned; the hands on it are useChartView's, spread
// on the circle as `handlers`.

const F = FRAMES.nav;
const V = F.w; // the SVG's units across
// (SVG numbers to a hundredth of a unit, far under a pixel: the markup redraws four times a second)
const n2 = (n) => Math.round(n * 100) / 100;
// (a place's position stays exact: the mini-map's test reads it against this to 9 places)
const pc = (n, of) => `${(n / of) * 100}%`;
const onFrame = (view, at, pin = false) => {
  const p = project(view, at);
  return toFrame(F, [p.u, p.v], { pin });
};
const points = (uvs) =>
  uvs
    .map((uv) => {
      const { x, y } = toFrame(F, uv);
      return `${n2(x)},${n2(y)}`;
    })
    .join(' ');
// the two places that stand for a region: a button each, to that preset
const REGION_PRESET = { 'chart:home': 'home', 'chart:curve': 'rickmorty' };
const GLYPHS = new Set(['sun', 'cloud', 'hole', 'star', 'portal']);
// (before the chart is measured, and in a server render: a 1000 px chart at the names' 0.7rem, the wonders named)
const UNMEASURED = { scale: 1, fontPx: 11, wonders: true };
// (a stem shorter than this is the dot itself)
const STEM_MIN = 1.5;

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

// The belt's band, as wide as it looks: its inner and outer edges' gap,
// averaged round the ring (exact straight down on its middle; near enough
// tilted or off to one side).
function beltWidth(view, centre) {
  const inner = ringOn(view, centre, BELT.inner, 32);
  const outer = ringOn(view, centre, BELT.outer, 32);
  let sum = 0;
  for (let i = 0; i < 32; i++) sum += Math.hypot(outer[i][0] - inner[i][0], outer[i][1] - inner[i][1]);
  return n2(Math.max(1, (sum / 32) * F.r));
}

// A region's ring comes near enough to be on the chart: its nearest point is
// within the view's range, and half as far again, so a ring on the rim (the
// Curve's, on its own preset, a little above or below it) still shows. One
// further off would only be drawn off the chart, out at the clamp's far numbers.
const REACH = 1.5;
function reaches(view, g) {
  const [fx, fy, fz] = view.focus;
  const across = Math.hypot(fx - g.centre[0], fz - g.centre[2]);
  return Math.hypot(across - g.radius, fy - g.centre[1]) <= view.range * REACH;
}

// A wonder's or the sun's picture, as the nav map has always drawn them.
function Glyph({ p, dim }) {
  const x = n2(p.x);
  const y = n2(p.y);
  const r = n2(Math.max(6, p.size));
  const style = { color: p.mark.color };
  const opacity = dim ? 0.35 : 1;
  switch (p.mark.shape) {
    case 'sun':
      return <circle cx={x} cy={y} r={n2(Math.max(9, p.size * 1.8))} fill="url(#navmap-sun)" />;
    case 'cloud':
      return <circle cx={x} cy={y} r={r} fill="url(#navmap-cloud)" style={style} opacity={opacity} />;
    case 'hole':
      return (
        <g opacity={opacity}>
          <circle cx={x} cy={y} r={r} className="navmap-pull" />
          <ellipse cx={x} cy={y} rx={n2(r * 0.55)} ry={n2(r * 0.22)} fill="none" stroke="#ffb070" strokeWidth="2.5" />
          <circle cx={x} cy={y} r={n2(r * 0.22)} fill="#000" stroke="#ffd9a8" strokeWidth="1" />
        </g>
      );
    case 'star':
      return <circle cx={x} cy={y} r={r} className="navmap-system" style={style} opacity={opacity} />;
    case 'portal':
      return <circle cx={x} cy={y} r={Math.max(9, r)} className="navmap-portal" style={style} opacity={opacity} />;
    default:
      return null;
  }
}

export default function NavChart({
  view,
  marks,
  ship = null,
  course = null,
  front = null,
  onFront,
  frontTitle,
  frontOff = false,
  pick = null,
  here = null,
  dim = null,
  onChoose,
  onGo,
  onRegion,
  out = null,
  tools = null,
  readout = null,
  handlers = null,
  boxRef,
}) {
  const canvas = useRef(null);
  const [fit, setFit] = useState(UNMEASURED);

  // the stars, and the chart's px width, its names' font size and whether
  // the wonders' names show (a phone hides them: navmap.css), for which names
  // fit; once, and again on a resize
  useEffect(() => {
    const c = canvas.current;
    const box = c?.parentElement;
    if (!c || !box) return undefined;
    const measure = () => {
      paintStars(c);
      const name = box.querySelector('.navmap-name');
      const fontPx = name ? parseFloat(window.getComputedStyle(name).fontSize) : NaN;
      const scale = box.clientWidth / V;
      const wonders = window.getComputedStyle(box).getPropertyValue('--wonder-names').trim() !== '0';
      setFit((f) => {
        const next = { scale: scale > 0 ? scale : f.scale, fontPx: fontPx > 0 ? fontPx : f.fontPx, wonders };
        return next.scale === f.scale && next.fontPx === f.fontPx && next.wonders === f.wonders ? f : next;
      });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(box);
    return () => ro?.disconnect();
  }, []);

  const level = levelOf(view.range);
  const pitched = view.pitch > 0 || view.yaw !== 0;
  const shipAt = ship ? placeShip(view, ship, F) : null;
  // (the front's button stays on the chart, at its rim when the front is further than the chart reaches)
  const frontAt = front ? onFrame(view, front.at, true) : null;
  // the place picked stays on, named (a star system: its gate)
  const keep = pick ? [pick, destinationById(pick)?.via].filter(Boolean) : [];
  // (where the wonders' names are hidden, bar the one picked, they hold no room from the others')
  const labelled = fit.wonders ? marks : marks.map((m) => (m.kind === 'wonder' && !keep.includes(m.id) ? { ...m, name: '' } : m));
  const names = new Map(marks.map((m) => [m.id, m.name]));
  const placed = placeMarks(view, labelled, F, { level, keep, fontPx: fit.fontPx, scale: fit.scale, avoid: [shipAt, frontAt].filter(Boolean) });
  const glyphs = placed.filter((p) => GLYPHS.has(p.mark.shape)).sort((a, b) => a.depth - b.depth); // (far first)
  const courseTo = shipAt && course ? onFrame(view, course.to, true) : null;

  const dimmed = (id) => Boolean(dim?.has(id));
  const spot = (x, y) => ({ left: pc(x, F.w), top: pc(y, F.h) });
  const place = (p) => {
    const m = p.mark;
    const name = names.get(p.id) ?? m.name;
    const region = REGION_PRESET[p.id];
    if (!m.pickable && !region && m.kind !== 'fight') return null; // (the sun and the pilots: the SVG's alone)
    const quiet = p.side === null;
    // (a region or a fight is its name alone: with no room for it, it isn't drawn)
    if (quiet && !m.pickable) return null;
    const attrs = {
      'data-id': p.id,
      'data-kind': m.kind,
      'data-side': p.side === 'left' || p.side === 'under' ? p.side : undefined,
      'data-quiet': quiet || undefined,
      'data-dim': dimmed(p.id) || undefined,
      style: { ...spot(p.x, p.y), '--c': m.color },
    };
    if (region)
      return (
        <li key={p.id} {...attrs}>
          <button type="button" className={region === 'home' ? 'navmap-place navmap-homebtn' : 'navmap-place'} onClick={() => onRegion?.(region)}>
            <span className="navmap-name">{name}</span>
          </button>
        </li>
      );
    if (!m.pickable)
      return (
        <li key={p.id} {...attrs}>
          <span className="navmap-place navmap-fightname">
            <span className="navmap-name">{name}</span>
          </span>
        </li>
      );
    const type = destinationById(p.id)?.type;
    const atIt = here === p.id;
    return (
      <li key={p.id} {...attrs}>
        <button
          type="button"
          className="navmap-place"
          aria-pressed={pick === p.id}
          aria-current={atIt ? 'location' : undefined}
          aria-label={`${name}${type ? `, ${type}` : ''}${atIt ? ', you’re here' : ''}`}
          onClick={() => onChoose?.(p.id)}
          onDoubleClick={() => onGo?.(p.id)}
        >
          <span className="navmap-dot" aria-hidden="true" />
          <span className="navmap-name">{name}</span>
        </button>
      </li>
    );
  };

  return (
    <div className="navmap-stage">
      <div ref={boxRef} className="navmap-chart" data-level={level} data-pitched={pitched || undefined} {...handlers}>
        <canvas ref={canvas} className="navmap-canvas" aria-hidden="true" />
        <svg className="navmap-svg" viewBox={`0 0 ${V} ${V}`} aria-hidden="true">
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
          {/* range rings round the focus, at powers of ten */}
          {ringsFor(view.range).map((d) => {
            const rx = warp([d, 0, 0], view.range)[0] * F.r;
            return <ellipse key={d} cx={F.cx} cy={F.cy} rx={n2(rx)} ry={n2(rx * Math.cos(view.pitch))} className="navmap-ring" />;
          })}
          {/* the sectors round the focus */}
          {level !== 'system' && sectorGrid(view, level === 'universe' ? 2 : 1).map((s) => <polyline key={s.key} points={points(s.points)} className="navmap-sector" />)}
          {/* the home system, the belt and the Curve */}
          {REGIONS.filter((g) => g.levels.includes(level) && reaches(view, g)).map((g) => (
            <polyline key={g.id} points={points(ringOn(view, g.centre, g.radius))} className="navmap-region" data-region={g.id} strokeWidth={g.id === 'belt' ? beltWidth(view, g.centre) : undefined} />
          ))}
          {/* every mark's stem, from level with the ship up or down to it */}
          {placed.map((p) =>
            Math.hypot(p.x - p.footX, p.y - p.footY) >= STEM_MIN ? (
              <line key={p.id} x1={n2(p.footX)} y1={n2(p.footY)} x2={n2(p.x)} y2={n2(p.y)} className="navmap-stem" data-dir={p.footY > p.y ? 'up' : 'down'} />
            ) : null,
          )}
          {/* the wonders, as they are, and the sun */}
          {glyphs.map((p) => (
            <Glyph key={p.id} p={p} dim={dimmed(p.id)} />
          ))}
          {/* the crew's war (front.js): its sectors in a line, each in the colour of the side
              that holds it, and the front where they meet, a battle going on there */}
          {front && (
            <g className="navmap-war">
              <polyline points={points(front.sectors.map((sec) => [project(view, sec.at).u, project(view, sec.at).v]))} className="navmap-war-line" />
              {front.sectors.map((sec, i) => {
                const q = onFrame(view, sec.at);
                return <circle key={sec.id} cx={n2(q.x)} cy={n2(q.y)} r={i === front.contested ? 7 : 4.5} fill={front.colours[sec.owner]} className="navmap-war-sector" />;
              })}
              <circle cx={n2(frontAt.x)} cy={n2(frontAt.y)} r="14" className="navmap-war-front" />
            </g>
          )}
          {/* the course: where it's going (and how), or to the place picked */}
          {courseTo && <line x1={n2(shipAt.x)} y1={n2(shipAt.y)} x2={n2(courseTo.x)} y2={n2(courseTo.y)} className="navmap-course" data-drive={course.drive} />}
          {/* the other pilots online, and someone's fight out in deep space (farFights.js), seen from afar */}
          {placed.map((p) => {
            const x = n2(p.x);
            const y = n2(p.y);
            if (p.mark.shape === 'pilot') return <rect key={p.id} x={x - 4} y={y - 4} width="8" height="8" className="navmap-pilot" transform={`rotate(45 ${x} ${y})`} />;
            if (p.mark.shape === 'fight')
              return (
                <g key={p.id} transform={`translate(${x} ${y})`} className="navmap-fight">
                  <circle r="9" className="navmap-fight-ring" />
                  <path d="M-4 -4 L4 4 M4 -4 L-4 4" />
                </g>
              );
            return null;
          })}
          {/* you: always on the chart, pinned to its rim when you're further than it reaches */}
          {shipAt && (
            <g className="navmap-ship" transform={`translate(${n2(shipAt.x)} ${n2(shipAt.y)}) rotate(${n2(shipAt.angle)})`} data-edge={shipAt.edge || undefined}>
              <circle r="16" className="navmap-ship-halo" />
              <path d="M13 0 L-8 -7.5 L-4 0 L-8 7.5 Z" />
            </g>
          )}
        </svg>
        {/* the places, as buttons over the chart */}
        <ul className="navmap-places" aria-label="Places">
          {placed.map(place)}
          {/* the war's front: to the left of its dot (the wonders round it have their names to the right) */}
          {front && (
            <li style={{ ...spot(frontAt.x, frontAt.y), '--c': '#ffb347' }} data-kind="front" data-side="left">
              <button type="button" className="navmap-place navmap-frontbtn" disabled={frontOff} onClick={onFront} title={frontTitle}>
                <span className="navmap-name">The front · {front.name}</span>
              </button>
            </li>
          )}
        </ul>
        {out && (
          <button type="button" className="navmap-out" onClick={out.onClick}>
            <RiArrowLeftLine className="h-3.5 w-3.5" aria-hidden="true" /> {out.label}
          </button>
        )}
      </div>
      <div className="navmap-bar">
        {readout && <p className="navmap-readout">{readout}</p>}
        {tools && <ChartTools className="navmap-tools" buttonClass="navmap-tool" label={CHART_WORDS.tools} {...tools} />}
      </div>
    </div>
  );
}
