import { useEffect, useMemo, useRef, useState } from 'react';
import { RiArrowLeftLine } from 'react-icons/ri';
import { BELT } from '../layout';
import { destinationById } from '../nav';
import { CHART_WORDS } from '../words';
import ChartTools from './ChartTools';
import { REGIONS } from './marks';
import { placeMarks, placeShip, ringOn, sectorGrid } from './place';
import { FRAMES, levelOf, project, ringsFor, toFrame, warp } from './projection';

// The nav map's chart (NavMap.jsx keeps the header and the side panel): a
// canvas of stars under an SVG of the bezel, the rings, the sectors, the
// regions, every mark's stem and glyph, the war, the course (and a sight on
// its end), the pilots and fights and the ship with its heading, with a
// button per place over that (Tab through, Enter to pick, Enter again to
// go). Under the circle, a bar: where the ship is (its sector and its
// height) and the chart's tools. Everything goes through the chart's one
// projection (projection.js, place.js), centred on the ship unless the
// visitor has panned; the hands on it are useChartView's, spread on the
// circle as `handlers`.
//
// Only the names with room show (declutter.js, through placeMarks: the place
// picked and where you are first, then the regions, the worlds, the wonders,
// the fights); a name with none comes up on hover and focus (navmap.css). A
// place the filter or the search leaves out (`dim`) is a grey dot with no
// name. The ship, the course, the pilots, the bursts and the sight are drawn
// in screen pixels, so they read the same on a phone as on a desk.

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
// (before the chart is measured, and in a server render: a 1000 px chart at the names' 0.74rem)
const UNMEASURED = { scale: 1, fontPx: 11 };
// (a stem shorter than this is the dot itself)
const STEM_MIN = 1.5;
// the bezel round the chart's rim: a tick every 5°, a longer one every 45°
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i / 72) * Math.PI * 2;
  const major = i % 9 === 0;
  const r0 = major ? 476 : 481;
  const r1 = 488;
  return { d: `M${n2(F.cx + Math.cos(a) * r0)} ${n2(F.cy + Math.sin(a) * r0)} L${n2(F.cx + Math.cos(a) * r1)} ${n2(F.cy + Math.sin(a) * r1)}`, major };
});

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
  glow.addColorStop(0, 'rgba(255,200,130,0.14)');
  glow.addColorStop(0.2, 'rgba(110,140,255,0.06)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  // the stars: fewer and fainter than a sky, so the places are what reads
  let s = 271828;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i++) {
    const b = 0.08 + rand() * rand() * 0.5;
    g.fillStyle = `rgba(${200 + Math.round(rand() * 55)},${210 + Math.round(rand() * 40)},255,${b.toFixed(3)})`;
    const r = rand() < 0.04 ? 1.1 : 0.6;
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
  const opacity = dim ? 0.3 : 1;
  switch (p.mark.shape) {
    case 'sun':
      return <circle cx={x} cy={y} r={n2(Math.max(9, p.size * 1.8))} fill="url(#navmap-sun)" />;
    case 'cloud':
      return <circle cx={x} cy={y} r={r} fill="url(#navmap-cloud)" style={style} opacity={opacity} />;
    case 'hole':
      return (
        <g opacity={opacity}>
          <circle cx={x} cy={y} r={r} className="navmap-pull" />
          <ellipse cx={x} cy={y} rx={n2(r * 0.55)} ry={n2(r * 0.22)} fill="none" stroke="#ffb070" strokeWidth="2" strokeOpacity="0.8" />
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

  // the stars, and the chart's px width and its names' font size, for which
  // names fit; once, and again on a resize
  useEffect(() => {
    const c = canvas.current;
    const box = c?.parentElement;
    if (!c || !box) return undefined;
    const measure = () => {
      paintStars(c);
      // (a place's own name, not a wonder's smaller one; a region's, a fight's or the front's runs smaller too, and only a place's button has an aria-label)
      const name = box.querySelector('li:not([data-kind="wonder"]) .navmap-place[aria-label] .navmap-name') ?? box.querySelector('.navmap-place[aria-label] .navmap-name');
      const fontPx = name ? parseFloat(window.getComputedStyle(name).fontSize) : NaN;
      const scale = box.clientWidth / V;
      setFit((f) => {
        const next = { scale: scale > 0 ? scale : f.scale, fontPx: fontPx > 0 ? fontPx : f.fontPx };
        return next.scale === f.scale && next.fontPx === f.fontPx ? f : next;
      });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(box);
    document.fonts?.ready?.then(measure, () => {});
    return () => ro?.disconnect();
  }, []);

  // Everything below is worked out again only when what it's drawn from
  // changes (the view, the marks, the pick, the measure), not when the side
  // panel re-renders.
  const level = levelOf(view.range);
  const pitched = view.pitch > 0 || view.yaw !== 0;
  const unit = n2(1 / fit.scale); // (SVG units a screen pixel: marks drawn at one size on any screen)
  const shipAt = useMemo(() => (ship ? placeShip(view, ship, F) : null), [view, ship]);
  // (the front's button stays on the chart, at its rim when the front is further than the chart reaches)
  const frontAt = useMemo(() => (front ? onFrame(view, front.at, true) : null), [view, front]);
  const names = useMemo(() => new Map(marks.map((m) => [m.id, m.name])), [marks]);
  // the place picked stays on, named (a star system: its gate)
  const keep = useMemo(() => (pick ? [pick, destinationById(pick)?.via].filter(Boolean) : []), [pick]);
  const placed = useMemo(() => {
    // where you are says its name before any other; a place filtered out holds no room for a name it doesn't show
    const labelled = marks.map((m) => {
      if (keep.includes(m.id)) return m;
      if (m.id === here) return { ...m, priority: Infinity };
      if (m.name && dim?.has(m.id)) return { ...m, name: '' };
      return m;
    });
    return placeMarks(view, labelled, F, { level: levelOf(view.range), keep, fontPx: fit.fontPx, scale: fit.scale, avoid: [shipAt, frontAt].filter(Boolean) });
  }, [view, marks, keep, here, dim, fit, shipAt, frontAt]);
  const glyphs = useMemo(() => placed.filter((p) => GLYPHS.has(p.mark.shape)).sort((a, b) => a.depth - b.depth), [placed]); // (far first)
  const courseTo = shipAt && course ? onFrame(view, course.to, true) : null;

  // the rings, the sectors and the regions: the view's alone
  const backdrop = useMemo(() => {
    const at = levelOf(view.range);
    return (
      <>
        {/* range rings round the focus, at powers of ten */}
        {ringsFor(view.range).map((d) => {
          const rx = warp([d, 0, 0], view.range)[0] * F.r;
          return <ellipse key={d} cx={F.cx} cy={F.cy} rx={n2(rx)} ry={n2(rx * Math.cos(view.pitch))} className="navmap-ring" />;
        })}
        {/* the sectors round the focus */}
        {at !== 'system' && sectorGrid(view, at === 'universe' ? 2 : 1).map((s) => <polyline key={s.key} points={points(s.points)} className="navmap-sector" />)}
        {/* the home system, the belt and the Curve */}
        {REGIONS.filter((g) => g.levels.includes(at) && reaches(view, g)).map((g) => (
          <polyline key={g.id} points={points(ringOn(view, g.centre, g.radius))} className="navmap-region" data-region={g.id} strokeWidth={g.id === 'belt' ? beltWidth(view, g.centre) : undefined} />
        ))}
      </>
    );
  }, [view]);
  // the crew's war (front.js): its sectors in a line, each in the colour of the side
  // that holds it, and the front where they meet, a battle going on there
  const war = useMemo(() => {
    if (!front) return null;
    const at = front.sectors.map((sec) => onFrame(view, sec.at));
    return (
      <g className="navmap-war">
        <polyline points={at.map((q) => `${n2(q.x)},${n2(q.y)}`).join(' ')} className="navmap-war-line" />
        {front.sectors.map((sec, i) => (
          <circle key={sec.id} cx={n2(at[i].x)} cy={n2(at[i].y)} r={n2((i === front.contested ? 6 : 4) * unit)} fill={front.colours[sec.owner]} className="navmap-war-sector" />
        ))}
        <circle cx={n2(frontAt.x)} cy={n2(frontAt.y)} r={n2(11 * unit)} className="navmap-war-front" />
      </g>
    );
  }, [view, front, frontAt, unit]);

  const dimmed = (id) => Boolean(dim?.has(id));
  const spot = (x, y) => ({ left: pc(x, F.w), top: pc(y, F.h) });
  const place = (p) => {
    const m = p.mark;
    const name = names.get(p.id) ?? m.name;
    const region = REGION_PRESET[p.id];
    if (!m.pickable && !region && m.kind !== 'fight') return null; // (the sun and the pilots: the SVG's alone)
    // the place picked and where you are always say theirs: with no room, to the right, on glass over their neighbours (`data-forced`)
    const mine = m.pickable && (keep.includes(p.id) || p.id === here);
    const side = p.side ?? (mine ? 'right' : null);
    const quiet = side === null;
    // (a region or a fight is its name alone: with no room for it, it isn't drawn)
    if (quiet && !m.pickable) return null;
    const attrs = {
      'data-id': p.id,
      'data-kind': m.kind,
      'data-side': side !== 'right' ? side : undefined,
      'data-quiet': quiet || undefined,
      'data-dim': dimmed(p.id) || undefined,
      'data-mine': mine || undefined,
      'data-forced': (mine && p.side === null) || undefined,
      style: { ...spot(p.x, p.y), '--c': m.color },
    };
    // (a region's and a fight's dot is the glyph the SVG draws: the span only holds the name clear of it)
    if (region)
      return (
        <li key={p.id} {...attrs}>
          <button type="button" className={region === 'home' ? 'navmap-place navmap-homebtn' : 'navmap-place'} onClick={() => onRegion?.(region)}>
            <span className="navmap-dot" aria-hidden="true" />
            <span className="navmap-name">{name}</span>
          </button>
        </li>
      );
    if (!m.pickable)
      return (
        <li key={p.id} {...attrs}>
          <span className="navmap-place navmap-fightname">
            <span className="navmap-dot" aria-hidden="true" />
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
              <stop offset="0" stopColor="currentColor" stopOpacity="0.42" />
              <stop offset="0.6" stopColor="currentColor" stopOpacity="0.14" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="navmap-sun">
              <stop offset="0" stopColor="#fff4d6" />
              <stop offset="0.3" stopColor="#ffc56e" />
              <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="navmap-cone" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#cfe9ff" stopOpacity="0.32" />
              <stop offset="1" stopColor="#cfe9ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* the bezel */}
          <g className="navmap-bezel">
            {TICKS.map((t, i) => (
              <path key={i} d={t.d} data-major={t.major || undefined} />
            ))}
          </g>
          {backdrop}
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
          {war}
          {/* the course: where it's going (and how), or to the place picked, and a sight on its end (both in screen pixels, so the dashes and weight are the same on a phone as on a desk) */}
          {courseTo && (
            <>
              <g transform={`scale(${unit})`}>
                <line x1={n2(shipAt.x / unit)} y1={n2(shipAt.y / unit)} x2={n2(courseTo.x / unit)} y2={n2(courseTo.y / unit)} className="navmap-course" data-drive={course.drive} />
              </g>
              {course.sight !== false && (
                <g className="navmap-target" transform={`translate(${n2(courseTo.x)} ${n2(courseTo.y)}) scale(${unit})`}>
                  <circle r="13" />
                  <path d="M0 -19 V-14 M0 14 V19 M-19 0 H-14 M14 0 H19" />
                </g>
              )}
            </>
          )}
          {/* the other pilots online, and someone's fight out in deep space (farFights.js), seen from afar */}
          {placed.map((p) => {
            const x = n2(p.x);
            const y = n2(p.y);
            if (p.mark.shape === 'pilot') return <rect key={p.id} x="-4" y="-4" width="8" height="8" className="navmap-pilot" transform={`translate(${x} ${y}) scale(${unit}) rotate(45)`} />;
            if (p.mark.shape === 'fight')
              return (
                <g key={p.id} transform={`translate(${x} ${y}) scale(${unit})`} className="navmap-fight">
                  <circle r="8" className="navmap-fight-ring" />
                  <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" />
                </g>
              );
            return null;
          })}
          {/* you: always on the chart, pinned to its rim when you're further than it reaches, your heading a cone */}
          {shipAt && (
            <g className="navmap-ship" transform={`translate(${n2(shipAt.x)} ${n2(shipAt.y)}) rotate(${n2(shipAt.angle)}) scale(${unit})`} data-edge={shipAt.edge || undefined}>
              <path d="M0 0 L64 -20 A67 67 0 0 1 64 20 Z" className="navmap-ship-cone" />
              <circle r="14" className="navmap-ship-halo" />
              <path d="M11 0 L-7 -7 L-3.5 0 L-7 7 Z" className="navmap-ship-mark" />
            </g>
          )}
        </svg>
        {/* the places, as buttons over the chart */}
        <ul className="navmap-places" aria-label="Places">
          {placed.map(place)}
          {/* the war's front: to the left of its ring (the wonders round it have their names to the right) */}
          {front && (
            <li style={{ ...spot(frontAt.x, frontAt.y), '--c': '#ffb347' }} data-kind="front" data-side="left">
              <button type="button" className="navmap-place navmap-frontbtn" disabled={frontOff} onClick={onFront} title={frontTitle}>
                <span className="navmap-dot" aria-hidden="true" />
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
