import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UNIVERSES } from './universes';
import { BELT, MAP_RADIUS, ORDER, POSITIONS, SUN, keyStep } from './layout';
import { wonderById } from './deep';
import { declutter } from './chart/declutter';
import './universe.css';

// The universe map drawn flat: the same layout as the 3D one, seen from the
// same tilt, with the sun in the middle, the asteroid belt, an orbit for each
// and a planet per place in its colour. It's Home's teaser (just the fandoms, each one a link
// into the map) and the map itself when 3D is off (every place, each a
// button in one focus group: the arrow keys step through them, Home and End
// jump to the ends).
//
// The distances are drawn to a scale of bands, not to the 3D one's: the
// stations are a hundred and some units out and the far worlds tens of
// thousands, so on any one smooth scale the six stations sit in a heap on
// the sun. Here the home system gets the middle fifth (the stations on their
// ring, the belt past them) and the fandoms' orbits, evenly spaced in the 3D
// map too, share the rest evenly; every place keeps its direction from the
// sun. The names go where there's room (chart/declutter.js: under a planet,
// a station's away from the sun), and the rest are on the dot's hover.
const W = 600;
const H = 300;
const TILT = 0.42; // how flat the disc looks: the 3D overview's pitch, roughly
const K = W / 2 - 34; // (the outermost orbit's radius across, in the SVG's units)
const CY = H / 2 - 8; // (the sun's height: a little over the middle, the disc's far side being shorter)
const radius = (id) => Math.hypot(POSITIONS[id][0], POSITIONS[id][2]);
const STATION_R = Math.max(...ORDER.filter((id) => UNIVERSES.find((u) => u.id === id)?.kind === 'core').map(radius));
const FIRST = Math.min(...ORDER.filter((id) => UNIVERSES.find((u) => u.id === id)?.kind !== 'core').map(radius));
// [3D radius, share of K]: the bands, joined by straight lines
const BANDS = [
  [0, 0],
  [STATION_R, 0.2],
  [BELT.inner, 0.25],
  [BELT.outer, 0.3],
  [FIRST, 0.4],
  [MAP_RADIUS, 1],
];
function spread(r) {
  if (r <= 0) return 0;
  for (let i = 1; i < BANDS.length; i++) {
    const [r1, k1] = BANDS[i];
    if (r <= r1) {
      const [r0, k0] = BANDS[i - 1];
      return (k0 + ((r - r0) / (r1 - r0)) * (k1 - k0)) * K;
    }
  }
  return K;
}
const place = ([x, y, z]) => {
  const r = Math.hypot(x, z) || 1;
  const k = spread(r) / r;
  return [W / 2 + x * k, CY + z * k * TILT - (y / MAP_RADIUS) * K * 0.5];
};
const at = (id) => place(POSITIONS[id]);
// the portal to the Rick and Morty sector (portals.js), beside its planet:
// the worlds through it are in a sector of their own, off this map
const PORTAL = wonderById('rmportal');
// a place's planet: bigger than its true size on this scale, so it reads
const dot = (u) => (u.kind === 'core' ? 3.6 : 5.2 + Math.min(2.4, u.size * 0.022));
// one orbit per distinct radius (the stations share theirs)
const ORBITS = [...new Set(ORDER.map((id) => radius(id).toFixed(3)))].map(Number);
const LINE = 18; // (a name's line, px)
// the order a place tries the sides of its dot in: a planet's name hangs
// under it; a station's points away from the sun, so the six fan out
function sidesFor(u, [x, y]) {
  if (u.kind !== 'core') return ['under', 'over', 'right', 'left'];
  const dx = x - W / 2;
  const dy = (y - CY) / TILT;
  if (Math.abs(dx) > Math.abs(dy) * 0.6) return dx > 0 ? ['right', 'under', 'over', 'left'] : ['left', 'under', 'over', 'right'];
  return dy > 0 ? ['under', 'right', 'left', 'over'] : ['over', 'right', 'left', 'under'];
}

let ruler = null;
function textWidth(text, font) {
  if (typeof document === 'undefined') return text.length * 7;
  ruler ??= document.createElement('canvas').getContext('2d');
  if (!ruler) return text.length * 7;
  ruler.font = font;
  return ruler.measureText(text).width;
}

export default function MiniMap({ selected = null, onSelect, linkTo, kind = null, className = '' }) {
  const shown = kind ? UNIVERSES.filter((u) => u.kind === kind) : UNIVERSES;
  const radii = kind ? [...new Set(shown.map((u) => radius(u.id).toFixed(3)))].map(Number) : ORBITS;
  const root = useRef(null);
  const list = useRef(null);
  const [box, setBox] = useState({ w: 0, font: '500 12px sans-serif' });
  const focusable = selected ?? ORDER[0];

  // the map's size on the screen and its names' font, for where the names fit
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const read = () => {
      const cs = list.current && window.getComputedStyle(list.current);
      setBox({ w: el.clientWidth, font: cs ? `500 ${cs.fontSize} ${cs.fontFamily}` : '500 12px sans-serif' });
    };
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    document.fonts?.ready?.then(read, () => {});
    return () => ro?.disconnect();
  }, []);

  const k = box.w / W; // (px a unit)
  const pad = (u) => Math.round(dot(u) * k) + 5; // (from a dot's middle to its name, px: universe.css reads it as --pad)
  const sides = box.w
    ? declutter(
        shown.map((u) => {
          const [x, y] = at(u.id);
          return { id: u.id, x: x * k, y: y * k, w: textWidth(u.label, box.font) + pad(u) + 14, h: LINE, priority: u.id === selected ? 100 : u.kind === 'core' ? 60 : u.id === 'starwars' ? 55 : 50, sides: sidesFor(u, [x, y]) };
        }),
        { bounds: { x0: 0, y0: 0, x1: box.w, y1: box.w / 2 }, dots: shown.map((u) => ({ x: at(u.id)[0] * k, y: at(u.id)[1] * k })) },
      )
    : new Map();

  const onKeyDown = (e) => {
    if (!onSelect || e.altKey || e.ctrlKey || e.metaKey) return;
    const to = keyStep(e.key, selected);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    list.current?.querySelector(`[data-id="${to}"]`)?.focus();
  };

  const sunR = Math.max(5, spread(SUN.r) * 0.16);
  return (
    <div ref={root} className={`minimap ${className}`} data-selected={selected || undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="minimap-svg">
        <defs>
          <radialGradient id="minimap-sun">
            <stop offset="0" stopColor="#fff6dc" />
            <stop offset="0.22" stopColor="#ffc56e" />
            <stop offset="0.5" stopColor="#ff9a45" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
          </radialGradient>
          {/* the light on every planet, from up and to the left, over its own colour */}
          <radialGradient id="minimap-shade" cx="0.38" cy="0.34" r="0.75">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.75" stopColor="#000" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
        </defs>
        {radii.map((r) => {
          const on = selected && Math.abs(radius(selected) - r) < 1e-3;
          return <ellipse key={r} className="minimap-orbit" data-on={on || undefined} cx={W / 2} cy={CY} rx={spread(r)} ry={spread(r) * TILT} style={on ? { stroke: UNIVERSES.find((u) => u.id === selected)?.swatch } : undefined} />;
        })}
        {/* the asteroid belt, a dotted band between the stations and the planets */}
        <ellipse cx={W / 2} cy={CY} rx={spread((BELT.inner + BELT.outer) / 2)} ry={spread((BELT.inner + BELT.outer) / 2) * TILT} fill="none" stroke="#9a8f80" strokeOpacity="0.32" strokeWidth={(spread(BELT.outer) - spread(BELT.inner)) * 0.45} strokeDasharray="0.8 3.2" />
        <circle cx={W / 2} cy={CY} r={sunR * 3.4} fill="url(#minimap-sun)" />
        <circle cx={W / 2} cy={CY} r={sunR} fill="#ffd38a" />
        {!kind && PORTAL && (
          <circle cx={place(PORTAL.at)[0]} cy={place(PORTAL.at)[1]} r={4} fill="none" stroke={PORTAL.color} strokeWidth="1.4" strokeDasharray="2 1.5" className="minimap-portal">
            <title>A portal to the Rick and Morty sector</title>
          </circle>
        )}
        {shown.map((u) => {
          const [x, y] = at(u.id);
          const r = dot(u);
          return (
            <g key={u.id} className="minimap-planet" data-on={selected === u.id || undefined}>
              <circle cx={x} cy={y} r={r + 3.5} fill={u.swatch} opacity="0.16" />
              {selected === u.id && <circle cx={x} cy={y} r={r + 5} fill="none" stroke={u.swatch} strokeWidth="1.2" />}
              <circle cx={x} cy={y} r={r} fill={u.swatch} />
              <circle cx={x} cy={y} r={r} fill="url(#minimap-shade)" />
            </g>
          );
        })}
      </svg>
      <ul ref={list} className="minimap-labels" aria-label="Universes" onKeyDown={onKeyDown}>
        {shown.map((u) => {
          const [x, y] = at(u.id);
          const side = sides.get(u.id) ?? (u.id === selected ? sidesFor(u, [x, y])[0] : null);
          const style = { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, '--swatch': u.swatch, '--pad': `${pad(u)}px` };
          const inner = <span className="minimap-name">{u.label}</span>;
          return (
            <li key={u.id} style={style} className="minimap-item" data-side={side ?? undefined} data-label={side ? undefined : 'off'} data-kind={u.kind}>
              {linkTo ? (
                <Link to={linkTo(u.id)} className="minimap-hit" data-id={u.id} aria-label={u.label}>
                  {inner}
                </Link>
              ) : (
                <button type="button" className="minimap-hit" data-id={u.id} aria-label={u.label} aria-pressed={selected === u.id} tabIndex={u.id === focusable ? 0 : -1} onClick={() => onSelect?.(u.id)}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
