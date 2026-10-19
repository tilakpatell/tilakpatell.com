import { memo } from 'react';
import { Territory, WarLines } from './WarLayers';
import { LETTER_SPACING, REGION_FONT, regionAngle, regionInset, regionNamesShown, regionTurn, unknownNameX } from './regionNames';
import { CORE, GRID, LANES, REGIONS, RIM, UNKNOWN, edgeAt } from './systems';
import { LANDMARKS } from './landmarks';
import { SPURS } from './spurs';
import { FRAME } from './mapView';

// The galaxy map's SVG (HoloMap.jsx), in the stage that zooms and pans: the
// grid, the war's territory, the regions' rings and names and the Unknown
// Regions and the landmarks between the systems, the hyperspace lanes (the
// great and the lesser), the war's lines and the course. It only
// changes with the layers, the war, the course and the zoom (the regions'
// names are set in screen pixels), so it's a memo: a pan, which moves the
// stage and nothing in here, doesn't draw it again. The rings and the
// Unknown Regions' wedge are drawn once, here, for good.
// (the map's square, mapView.js's: the whole disc, in grid squares; the atlas's grid is drawn where it is in it)
const VIEW_BOX = `${FRAME.x0} ${FRAME.z0} ${FRAME.size} ${FRAME.size}`;
// (screen px a grid square: the lesser routes come in zoomed, with the charted worlds' names, HoloMap.jsx's CHARTED_NAMES_AT; and
// the regions' names past a phone's whole map, where they ran into the systems' names, HoloMap.jsx's ROOMY_AT)
const SPURS_AT = 44;
const REGION_NAMES_AT = 20;
const TAU = Math.PI * 2;

// a region's edge, as an SVG path
const ring = (r) =>
  Array.from({ length: 73 }, (_, i) => {
    const a = (i / 72) * TAU;
    const d = edgeAt(r, a);
    return `${i ? 'L' : 'M'}${(CORE[0] + Math.cos(a) * d).toFixed(3)} ${(CORE[1] + Math.sin(a) * d).toFixed(3)}`;
  }).join(' ') + 'Z';
const RINGS = REGIONS.map((r) => [r.id, ring(r.r)]);

// the Unknown Regions' wedge, out west, to the disc's edge (past it, it reached off the map)
const UNKNOWN_D = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI - UNKNOWN.half + (i / 12) * UNKNOWN.half * 2;
    const d = edgeAt(UNKNOWN.from, a);
    pts.push([CORE[0] + Math.cos(a) * d, CORE[1] + Math.sin(a) * d]);
  }
  for (let i = 12; i >= 0; i--) {
    const a = Math.PI - UNKNOWN.half + (i / 12) * UNKNOWN.half * 2;
    pts.push([CORE[0] + Math.cos(a) * RIM, CORE[1] + Math.sin(a) * RIM]);
  }
  return pts.map(([x, z], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${z.toFixed(3)}`).join(' ') + 'Z';
})();

const LANE_POINTS = LANES.map((l) => [l.id, l.name, l.pts.map((p) => p.join(',')).join(' ')]);
// (and the lesser routes, spurs.js's: drawn thinner)
const SPUR_POINTS = SPURS.map((l) => [l.id, l.name, l.pts.map((p) => p.join(',')).join(' ')]);

// the landmarks (landmarks.js), drawn once: a nebula two clouds of its colours, a black hole a dark heart in the glow of what
// falls into it, the Rishi Maze a small spiral; each turned by its id, so no two lie the same way
const turn = (id) => [...id].reduce((t, c) => (t * 31 + c.charCodeAt(0)) % 360, 7);
const f = (v) => +v.toFixed(3);
const LANDMARK_ART = LANDMARKS.map((l) => {
  const [x, z] = l.pos;
  const g = `holomap-lm-${l.id}`;
  const a = turn(l.id);
  if (l.kind === 'blackhole')
    return (
      <g key={l.id} transform={`rotate(${a} ${x} ${z})`}>
        <circle cx={x} cy={z} r={f(l.r * 3)} fill={`url(#${g})`} />
        <ellipse cx={x} cy={z} rx={f(l.r * 2)} ry={f(l.r * 0.55)} fill="none" stroke={l.colors[0]} strokeOpacity="0.75" strokeWidth={f(l.r * 0.28)} />
        <circle cx={x} cy={z} r={f(l.r * 0.7)} fill="#000" />
      </g>
    );
  if (l.kind === 'galaxy')
    return (
      <g key={l.id} transform={`rotate(${a} ${x} ${z})`}>
        <ellipse cx={x} cy={z} rx={l.r} ry={f(l.r * 0.42)} fill={`url(#${g})`} />
        <path d={`M${f(x - l.r * 0.85)} ${f(z)} Q${f(x - l.r * 0.2)} ${f(z - l.r * 0.5)} ${x} ${z} T${f(x + l.r * 0.85)} ${f(z)}`} fill="none" stroke={l.colors[0]} strokeOpacity="0.45" strokeWidth={f(l.r * 0.06)} />
      </g>
    );
  return (
    <g key={l.id} transform={`rotate(${a} ${x} ${z})`}>
      <ellipse cx={x} cy={z} rx={l.r} ry={f(l.r * 0.68)} fill={`url(#${g})`} />
      <ellipse cx={f(x + l.r * 0.35)} cy={f(z - l.r * 0.2)} rx={f(l.r * 0.55)} ry={f(l.r * 0.4)} fill={`url(#${g})`} opacity="0.8" />
    </g>
  );
});
const LANDMARK_DEFS = LANDMARKS.map((l) => (
  <radialGradient key={l.id} id={`holomap-lm-${l.id}`}>
    <stop offset="0" stopColor={l.colors[0]} stopOpacity={l.kind === 'blackhole' ? 0.5 : 0.42} />
    <stop offset="0.55" stopColor={l.colors[1] ?? l.colors[0]} stopOpacity={l.kind === 'blackhole' ? 0.12 : 0.2} />
    <stop offset="1" stopColor={l.colors[1] ?? l.colors[0]} stopOpacity="0" />
  </radialGradient>
));

const MapSvg = memo(function MapSvg({ layers, war, ops, route, unitPx }) {
  const regionFont = REGION_FONT / unitPx; // (11.5 px on screen at any zoom)
  const regionShown = unitPx >= REGION_NAMES_AT ? regionNamesShown(REGIONS, unitPx) : new Set(); // (the ones with the room: the inner ones as you zoom)
  const course = route ? route.pts.map((p) => p.join(',')).join(' ') : null;
  return (
    <svg className="holomap-svg" viewBox={VIEW_BOX} aria-hidden="true">
      {/* the grid (off till asked for) */}
      {layers.grid &&
        Array.from({ length: GRID.cols + 1 }, (_, i) => (
          <line key={`c${i}`} x1={i} y1={0} x2={i} y2={GRID.rows} className="holomap-grid" />
        ))}
      {layers.grid &&
        Array.from({ length: GRID.rows + 1 }, (_, i) => (
          <line key={`r${i}`} x1={0} y1={i} x2={GRID.cols} y2={i} className="holomap-grid" />
        ))}
      {/* the war's territory */}
      {layers.territory && <Territory table={war} />}
      {/* the regions: their rings and names, and the Unknown Regions; and what lies between the systems (their names are HoloMap.jsx's) */}
      {layers.regions && (
        <>
          <path d={UNKNOWN_D} className="holomap-unknown" />
          {RINGS.map(([id, d]) => (
            <path key={id} d={d} className="holomap-region" data-id={id} />
          ))}
          <defs>{LANDMARK_DEFS}</defs>
          <g className="holomap-landmarks-art">{LANDMARK_ART}</g>
          {REGIONS.map((r, i) => {
            if (!regionShown.has(r.id)) return null;
            const a = regionAngle(i);
            const d = edgeAt(r.r, a) - regionFont * regionInset(a);
            const x = CORE[0] + Math.cos(a) * d;
            const y = CORE[1] + Math.sin(a) * d;
            const deg = regionTurn(a); // (along the ring, the right way up)
            return (
              <text key={r.id} x={x} y={y} transform={`rotate(${deg.toFixed(1)} ${x.toFixed(3)} ${y.toFixed(3)})`} className="holomap-region-name" style={{ fontSize: regionFont, letterSpacing: regionFont * LETTER_SPACING }}>
                {r.name}
              </text>
            );
          })}
          {unitPx >= REGION_NAMES_AT && (
            <text x={unknownNameX(unitPx, REGION_FONT, FRAME.x0)} y={CORE[1] + 0.1} className="holomap-region-name holomap-unknown-name" style={{ fontSize: regionFont }}>
              Unknown Regions
            </text>
          )}
        </>
      )}
      {/* the routes */}
      {layers.lanes &&
        unitPx >= SPURS_AT &&
        SPUR_POINTS.map(([id, name, points]) => (
          <polyline key={id} points={points} className="holomap-spur">
            <title>{name}</title>
          </polyline>
        ))}
      {layers.lanes &&
        LANE_POINTS.map(([id, name, points]) => (
          <polyline key={id} points={points} className="holomap-lane">
            <title>{name}</title>
          </polyline>
        ))}
      {/* the war's lanes, borders and offensives */}
      {layers.fronts && <WarLines table={war} ops={ops} territory={layers.territory} />}
      {/* the course */}
      {course && (
        <>
          <polyline points={course} fill="none" className="holomap-course-glow" />
          <polyline points={course} fill="none" className="holomap-course" />
        </>
      )}
    </svg>
  );
});

// the grid's letters and numbers (HTML, so they keep their size): nothing in them changes
export const Axes = memo(function Axes() {
  const pct = (v, o) => `${((v - o) / FRAME.size) * 100}%`;
  return (
    <>
      <div className="holomap-axis holomap-axis-x" aria-hidden="true">
        {Array.from({ length: GRID.cols }, (_, i) => (
          <span key={i} style={{ left: pct(i + 0.5, FRAME.x0) }}>
            {String.fromCharCode(65 + i)}
          </span>
        ))}
      </div>
      <div className="holomap-axis holomap-axis-y" aria-hidden="true">
        {Array.from({ length: GRID.rows }, (_, i) => (
          <span key={i} style={{ top: pct(i + 0.5, FRAME.z0) }}>
            {i + 1}
          </span>
        ))}
      </div>
    </>
  );
});

export default MapSvg;
