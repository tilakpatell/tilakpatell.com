import { EMBLEM_BOX, emblemOf } from './emblems';

// A side's emblem (emblems.js), drawn in the colour it's given (currentColor):
// on the holotable's fleets, in the war's strength strip and in its key. The
// game's faction icon from its sprite where the game has the side, the site's
// crest where it hasn't. Always beside words that say whose it is, so it's
// hidden from screen readers.
export default function Emblem({ side, className = 'holomap-emblem' }) {
  const e = emblemOf(side);
  if (!e) return null;
  if (e.href) {
    return (
      <svg className={className} aria-hidden="true" focusable="false">
        <use href={e.href} />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox={EMBLEM_BOX} aria-hidden="true" focusable="false">
      {e.shapes.map((s) => (
        <path key={s.d} d={s.d} fill="currentColor" fillRule={s.evenodd ? 'evenodd' : undefined} />
      ))}
    </svg>
  );
}
