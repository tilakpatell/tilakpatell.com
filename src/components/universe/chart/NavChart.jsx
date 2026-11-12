import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { destinationById } from '../nav';
import { FRAMES, levelOf, project, ringsFor, toFrame } from './projection';
import { placeMarks, placeShip, ringOn, sectorGrid } from './place';
import { REGIONS } from './marks';
import ChartTools from './ChartTools';
import { CHART_WORDS } from '../words';

// The nav map's chart (NavMap.jsx keeps the header, the filters and the side
// panel): a canvas of stars under an SVG of the range rings round the
// focus, the sector grid fading out round it, the rings round the home
// system, the belt and the Curve, every mark on its stem (up for above the
// ship, dashed down for below), the wonders as they are, the crew's war, the
// course, the other pilots, the far fights and the ship, always (pinned to
// the rim when it's off the chart); over that a button per place, its name
// on whichever side is clear (place.js, through chartLabels.js). Under the
// circle, a bar: where the ship is (its sector and height) and the tools.
// Pure placing: what's drawn where is projection.js's and place.js's.

const V = FRAMES.nav.w;
const NAME_REM = 0.7; // (navmap.css's .navmap-place: the names are measured at it)
const NAME_H = 18; // (.navmap-name's height, and NAME_PAD its padding either side)
const NAME_PAD = 10;

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

const pts = (list) => list.map(([u, v]) => `${(V / 2 + u * FRAMES.nav.r).toFixed(1)},${(V / 2 + v * FRAMES.nav.r).toFixed(1)}`).join(' ');
const pct = (x, y) => ({ left: `${(x / V) * 100}%`, top: `${(y / V) * 100}%` });
const at = (view, p) => toFrame(FRAMES.nav, [project(view, p).u, project(view, p).v]);
const REGION_OF = { 'chart:home': 'home', 'chart:curve': 'rickmorty' };

// a wonder's or the sun's glyph, as the chart has always drawn them
function Glyph({ p }) {
  const { mark, x, y } = p;
  const r = Math.max(6, p.size);
  if (mark.shape === 'sun') return <circle cx={x} cy={y} r={Math.max(9, p.size * 1.8)} fill="url(#navmap-sun)" />;
  if (mark.shape === 'cloud') return <circle cx={x} cy={y} r={r} fill="url(#navmap-cloud)" style={{ color: mark.color }} />;
  if (mark.shape === 'hole')
    return (
      <g>
        <circle cx={x} cy={y} r={r} className="navmap-pull" />
        <ellipse cx={x} cy={y} rx={r * 0.55} ry={r * 0.22} fill="none" stroke="#ffb070" strokeWidth="2.5" />
        <circle cx={x} cy={y} r={r * 0.22} fill="#000" stroke="#ffd9a8" strokeWidth="1" />
      </g>
    );
  if (mark.shape === 'star') return <circle cx={x} cy={y} r={r} className="navmap-system" style={{ color: mark.color }} />;
  if (mark.shape === 'portal') return <circle cx={x} cy={y} r={Math.max(9, r)} className="navmap-portal" style={{ color: mark.color }} />;
  return null;
}

export default function NavChart({ view, marks, ship = null, course = null, front = null, onFront = null, frontTitle = '', frontOff = false, pick = null, here = null, hover = null, dim = null, onChoose, onGo, onRegion, out = null, tools = null, readout = null, handlers = {}, boxRef = null, dragging = false }) {
  const own = useRef(null);
  const box = boxRef ?? own;
  const canvas = useRef(null);
  const ruler = useRef(null);
  const [px, setPx] = useState(0); // (the chart's width on the page: its names are laid out in pixels)
  const [, setFonts] = useState(0); // (bumped once the page's fonts are in: the names' widths change)

  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const draw = () => paintStars(c);
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const size = () => setPx(el.clientWidth);
    size();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
    ro?.observe(el);
    let on = true;
    document.fonts?.ready.then(() => on && setFonts((n) => n + 1));
    return () => {
      on = false;
      ro?.disconnect();
    };
  }, [box]);

  const level = levelOf(view.range);
  const pitched = view.pitch > 0 || view.yaw !== 0;
  const scale = px ? px / V : 1;
  const measure = (() => {
    const el = box.current;
    const g = px && el ? (ruler.current ??= document.createElement('canvas').getContext('2d')) : null;
    if (!g) return (t) => t.length * 6.3 + NAME_PAD;
    g.font = `${NAME_REM * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)}px ${getComputedStyle(el).fontFamily}`;
    return (t) => Math.ceil(g.measureText(t).width) + NAME_PAD;
  })();
  const shipAt = ship ? placeShip(view, ship, FRAMES.nav) : null;
  const grid = level === 'system' ? [] : sectorGrid(view, level === 'universe' ? 2 : 1);
  // the sectors' names, in their corners, at the neighbourhood's zoom (further out they'd pile up in the middle)
  const sectorNames = level === 'neighbourhood' ? grid.filter((g) => g.ring <= 1 && Math.hypot(...g.corner) < 0.92).map((g) => ({ ...g, x: V / 2 + g.corner[0] * FRAMES.nav.r + 6, y: V / 2 + g.corner[1] * FRAMES.nav.r + 16, text: CHART_WORDS.sector(g.at) })) : [];
  const placed = placeMarks(view, marks, FRAMES.nav, {
    level,
    keep: [pick, hover, 'chart:home'], // (home is always on the chart: at the rim, the way back, when it's far)
    scale,
    measure,
    height: NAME_H,
    avoid: shipAt ? [shipAt] : [],
    obstacles: [
      ...(out ? [{ x0: px / 2 - 95, y0: px * 0.91 - 32, x1: px / 2 + 95, y1: px * 0.91 }] : []),
      // (13 units of mono type: 7.8 a letter, 16 high, in the SVG's units)
      ...sectorNames.map((n) => ({ x0: n.x * scale, y0: (n.y - 13) * scale, x1: (n.x + n.text.length * 7.8) * scale, y1: (n.y + 3) * scale })),
    ],
  });
  const glyphs = placed.filter((p) => ['sun', 'cloud', 'hole', 'star', 'portal'].includes(p.mark.shape)).sort((a, b) => a.depth - b.depth);
  const listed = placed.filter((p) => p.mark.pickable || REGION_OF[p.id] || p.mark.kind === 'fight');
  const regions = REGIONS.filter((r) => r.levels.includes(level));
  const courseAt = course && shipAt ? toFrame(FRAMES.nav, (({ u, v }) => [u, v])(project(view, course.to)), { pin: true }) : null;
  const frontAt = front ? at(view, front.at) : null;

  return (
    <div className="navmap-stage">
      <div ref={box} className="navmap-chart" data-level={level} data-pitched={pitched || undefined} data-dragging={dragging || undefined} {...handlers}>
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
          {/* range rings round the middle, a power of ten each */}
          {ringsFor(view.range).map((r) => {
            const rx = (r / view.range) ** 0.375 * FRAMES.nav.r;
            return <ellipse key={r} cx={V / 2} cy={V / 2} rx={rx} ry={rx * Math.cos(view.pitch)} className="navmap-ring" />;
          })}
          {/* the sectors round the middle's, fading out: space goes on past them */}
          {grid.map((g) => (
            <polyline key={g.key} points={pts(g.points)} className="navmap-sector" data-ring={g.ring} data-here={g.ring === 0 || undefined} />
          ))}
          {sectorNames.map((n) => (
            <text key={`name:${n.key}`} x={n.x} y={n.y} className="navmap-sector-name" data-ring={n.ring}>
              {n.text}
            </text>
          ))}
          {regions.map((r) => (
            <polyline key={r.id} points={pts(ringOn(view, r.centre, r.radius))} className="navmap-region" data-region={r.id} />
          ))}
          {/* each mark's stem, from the ship's level up or down to it */}
          {placed.map((p) =>
            Math.hypot(p.x - p.footX, p.y - p.footY) >= 1.5 ? (
              <g key={`stem:${p.id}`} className="navmap-stem-g">
                <line x1={p.footX} y1={p.footY} x2={p.x} y2={p.y} className="navmap-stem" data-dir={p.y < p.footY ? 'up' : 'down'} />
                <ellipse cx={p.footX} cy={p.footY} rx="3" ry={3 * Math.max(0.3, Math.cos(view.pitch))} className="navmap-foot" />
              </g>
            ) : null,
          )}
          {glyphs.map((p) => (
            <g key={`glyph:${p.id}`} opacity={dim?.has(p.id) ? 0.35 : 1}>
              <Glyph p={p} />
            </g>
          ))}
          {/* the crew's war (front.js): its sectors in a line, each in the colour of the side that holds it, and the front */}
          {front && (
            <g className="navmap-war">
              <polyline points={front.sectors.map((sec) => { const a = at(view, sec.at); return `${a.x},${a.y}`; }).join(' ')} className="navmap-war-line" />
              {front.sectors.map((sec, i) => {
                const a = at(view, sec.at);
                return <circle key={sec.id} cx={a.x} cy={a.y} r={i === front.contested ? 7 : 4.5} fill={front.colours[sec.owner]} className="navmap-war-sector" />;
              })}
              <circle cx={frontAt.x} cy={frontAt.y} r="14" className="navmap-war-front" />
            </g>
          )}
          {courseAt && <line x1={shipAt.x} y1={shipAt.y} x2={courseAt.x} y2={courseAt.y} className="navmap-course" data-drive={course.drive ?? 'plot'} />}
          {placed
            .filter((p) => p.mark.kind === 'pilot')
            .map((p) => (
              <rect key={p.id} x={p.x - 4} y={p.y - 4} width="8" height="8" className="navmap-pilot" transform={`rotate(45 ${p.x} ${p.y})`} />
            ))}
          {placed
            .filter((p) => p.mark.kind === 'fight')
            .map((p) => (
              <g key={p.id} transform={`translate(${p.x} ${p.y})`} className="navmap-fight">
                <circle r="9" className="navmap-fight-ring" />
                <path d="M-4 -4 L4 4 M4 -4 L-4 4" />
              </g>
            ))}
          {shipAt && (
            <g transform={`translate(${+shipAt.x.toFixed(2)} ${+shipAt.y.toFixed(2)}) rotate(${+shipAt.angle.toFixed(2)})`} className="navmap-ship" data-edge={shipAt.edge || undefined}>
              <circle r="16" className="navmap-ship-halo" />
              <path d="M13 0 L-8 -7.5 L-4 0 L-8 7.5 Z" />
            </g>
          )}
        </svg>
        <ul className="navmap-places" aria-label="Places">
          {listed.map((p) => {
            const { mark } = p;
            const off = p.side === null || undefined;
            const name = (
              <span className="navmap-name" style={{ '--lx': `${p.dx}px`, '--ly': `${p.dy}px` }} data-off={off}>
                {mark.name}
              </span>
            );
            const d = destinationById(mark.id);
            return (
              <li key={mark.id} style={{ ...pct(p.x, p.y), '--c': mark.color }} data-id={mark.id} data-kind={mark.kind === 'moon' ? 'world' : mark.kind} data-side={p.side ?? undefined} data-quiet={off} data-dim={dim?.has(mark.id) || undefined} data-hover={hover === mark.id || undefined} data-pick={pick === mark.id || undefined}>
                {mark.kind === 'fight' ? (
                  <span className="navmap-place navmap-fightname">{name}</span>
                ) : REGION_OF[mark.id] ? (
                  <button type="button" className="navmap-place navmap-region-btn" onClick={() => onRegion?.(REGION_OF[mark.id])}>
                    {name}
                  </button>
                ) : (
                  <button type="button" className="navmap-place" aria-pressed={pick === mark.id} aria-current={here === mark.id ? 'location' : undefined} aria-label={`${mark.name}, ${d?.type ?? mark.kind}${here === mark.id ? ', you’re here' : ''}`} onClick={() => onChoose?.(mark.id)} onDoubleClick={() => onGo?.(mark.id)}>
                    <span className="navmap-dot" aria-hidden="true" />
                    {name}
                  </button>
                )}
              </li>
            );
          })}
          {front && (
            <li style={{ ...pct(frontAt.x, frontAt.y), '--c': '#ffb347' }} data-kind="front">
              <button type="button" className="navmap-place navmap-frontbtn" disabled={frontOff} onClick={onFront ?? undefined} title={frontTitle}>
                <span className="navmap-name">{front.name}</span>
              </button>
            </li>
          )}
        </ul>
        {out && (
          <button type="button" className="navmap-out" onClick={out.onClick}>
            {out.icon} {out.label}
          </button>
        )}
      </div>
      {(readout || tools) && (
        <div className="navmap-bar">
          {readout && <p className="navmap-readout">{readout}</p>}
          {tools && <ChartTools {...tools} />}
        </div>
      )}
    </div>
  );
}
