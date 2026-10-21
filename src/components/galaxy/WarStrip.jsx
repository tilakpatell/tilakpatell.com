import { memo } from 'react';
import Emblem from './Emblem';
import { SIDES, WARS } from './sides';
import { strengthLine } from './warText';

// The war on the holotable at a glance, over the map's empty north: which of
// the galaxy's wars it shows (the era chips pick it, HoloMap.jsx; yours is
// marked, the one you fight in, which changes from the war card, WarCard.jsx),
// and each of its powers' systems, share of the galaxy's worth and which way
// it's gone in six hours (gcw.js's strength), with a bar of the three: the
// liberator, the Hutts between, the raider. One row, each side by its crest
// (its name on a hover, and to a screen reader). A memo: it changes with the
// war, not with the zoom or the pan.
const WarStrip = memo(function WarStrip({ table, fighting }) {
  const w = WARS[table.war];
  const sides = [w.liberator, 'hutt', w.raider];
  const strength = table.strength ?? {};
  return (
    <div className="holomap-strip">
      <p className="holomap-strip-war">
        {w.name}
        {table.war === fighting && <span className="holomap-strip-yours"> · yours</span>}
      </p>
      <div className="holomap-strip-board">
        <ul className="holomap-strip-sides" aria-label={`Who holds what in ${w.name}`}>
          {sides.map((side) => {
            const r = strength[side];
            if (!r) return null;
            const trend = r.trend6h > 0 ? 'up' : r.trend6h < 0 ? 'down' : undefined;
            return (
              <li key={side} style={{ '--side': SIDES[side].colour }} title={`${SIDES[side].short}: ${strengthLine(table, side)}`}>
                <Emblem side={side} />
                <span className="holomap-strip-name" aria-hidden="true">
                  {SIDES[side].short}
                </span>
                <span className="holomap-strip-n" aria-hidden="true">
                  {r.systems}
                </span>
                <span className="holomap-strip-share" aria-hidden="true">
                  {Math.round(r.share * 100)}%
                </span>
                <span className="holomap-strip-trend" data-trend={trend} aria-hidden="true">
                  {trend === 'up' ? `▲${r.trend6h}` : trend === 'down' ? `▼${-r.trend6h}` : ''}
                </span>
                <span className="sr-only">
                  {SIDES[side].short}: {strengthLine(table, side)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="holomap-strip-bar" aria-hidden="true">
          {sides.map((side) => (
            <span key={side} style={{ flexGrow: strength[side]?.share ?? 0, '--side': SIDES[side].colour }} />
          ))}
        </div>
      </div>
    </div>
  );
});

export default WarStrip;
