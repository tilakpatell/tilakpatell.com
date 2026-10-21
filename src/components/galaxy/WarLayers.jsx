import { memo } from 'react';
import Emblem from './Emblem';
import { SIDES, WARS } from './sides';
import { systemById } from './systems';
import { CELLS, bordersOf, clashOf, linksOf } from './territory';
import { onSquare } from './mapView';

// One of the galaxy's wars drawn on the holotable (HoloMap.jsx), from its
// war table (gcw.js), the rules territory.js's and warMap.js's:
// - Territory, under the regions' rings: each system's cell filled the
//   colour of who holds it, brighter the firmer the hold, and hatched in the
//   attacker's colour where it's fought over.
// - The war's lines, over the routes: its links fought along (moving), and
//   each operation an arrow from where its fleets come from (a raid dotted,
//   the decisive battle doubled), its head kept the size it has at the whole
//   map, about its tip; and with the territory, the rest of its links (held
//   in the holder's colour, contested dashed) and the borders where two
//   powers meet (moving where they're fighting). Without it they'd be lines
//   between nothing, over the hyperspace lanes.
// - Fleets, over all of it: each operation's side's crest on its arrow,
//   closing in as its side gains (HTML, so it stays a crest's size however
//   small the map is).
// All of it's a picture of what the systems' buttons say in words, so it's
// hidden from screen readers; its motion stops for prefers-reduced-motion
// (warmap.css). Each is a memo: it changes with the war, not with the zoom
// or the pan.

const pct = (v) => `${v * 100}%`;
const at = (id) => systemById(id).pos;
const CELL_D = Object.fromEntries(CELLS.map((c) => [c.id, c.poly.map(([x, z], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${z.toFixed(3)}`).join(' ') + 'Z']));

const contested = (r, liberator) => Boolean(r.attack || (r.front && r.owner !== liberator));

export const Territory = memo(function Territory({ table }) {
  const { liberator, raider } = WARS[table.war];
  return (
    <g className="holomap-territory">
      <defs>
        {[liberator, raider, 'hutt'].map((side) => (
          <pattern key={side} id={`holomap-hatch-${side}`} patternUnits="userSpaceOnUse" width="0.26" height="0.26" patternTransform="rotate(45)">
            <line x1="0.07" y1="0" x2="0.07" y2="0.26" stroke={SIDES[side].colour} strokeWidth="0.06" />
          </pattern>
        ))}
      </defs>
      {table.systems.map((r) => (
        <path key={r.id} d={CELL_D[r.id]} className="holomap-cell" style={{ '--held': SIDES[r.owner].colour, '--hold': r.control }} />
      ))}
      {table.systems
        .filter((r) => contested(r, liberator))
        .map((r) => (
          <path key={`hatch-${r.id}`} d={CELL_D[r.id]} className="holomap-cell-hatch" fill={`url(#holomap-hatch-${r.attack ? r.attack.by : liberator})`} />
        ))}
    </g>
  );
});

export const WarLines = memo(function WarLines({ table, ops, territory }) {
  const owner = Object.fromEntries(table.systems.map((r) => [r.id, r.owner]));
  const borders = territory ? bordersOf(owner, { hot: clashOf(table) }) : [];
  const links = linksOf(table).filter((l) => territory || l.state === 'battle');
  return (
    <g className="holomap-warlines">
      {links.map((l) => {
        const [a, b] = [at(l.a), at(l.b)];
        return <line key={l.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="holomap-link" data-state={l.state} style={l.owner ? { '--held': SIDES[l.owner].colour } : undefined} />;
      })}
      {borders.map((b) => (
        <g key={`${b.a}-${b.b}`} className="holomap-border" data-hot={b.hot || undefined}>
          <line x1={b.p[0][0]} y1={b.p[0][1]} x2={b.p[1][0]} y2={b.p[1][1]} className="holomap-border-glow" />
          <line x1={b.p[0][0]} y1={b.p[0][1]} x2={b.p[1][0]} y2={b.p[1][1]} className="holomap-border-line" />
        </g>
      ))}
      {ops.map((op) => (
        <g key={op.id} className="holomap-op" data-kind={op.kind} data-major={op.major || undefined} style={{ '--by': op.colour, '--w': op.width }}>
          {op.kind === 'decisive' && (
            <>
              <path d={op.d} className="holomap-op-outer" />
              <path d={op.d} className="holomap-op-inner" />
            </>
          )}
          <path d={op.line} className="holomap-op-line" />
          <polygon points={op.head} className="holomap-op-head" style={{ transformOrigin: `${op.tip[0]}px ${op.tip[1]}px` }} />
        </g>
      ))}
    </g>
  );
});

export const Fleets = memo(function Fleets({ ops }) {
  return (
    <ul className="holomap-fleets" aria-hidden="true">
      {ops.map((op) => (
        <li key={op.id} data-kind={op.kind} style={{ left: pct(onSquare(op.token)[0]), top: pct(onSquare(op.token)[1]), '--by': op.colour }}>
          <Emblem side={op.by} />
        </li>
      ))}
    </ul>
  );
});
