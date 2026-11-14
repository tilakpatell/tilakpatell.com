import { RiArrowRightLine } from 'react-icons/ri';
import { CHART_WORDS, PICK_A_SHIP, PLACE } from '../words';

// A generated place's card in the universe's panel: what it is and in which
// sector, its name, a line about it, its facts and the one way there (fly,
// dock, or the hangar once docked). For a link still being found, only its
// sector and the plotting line; with no scene to find it, its id and how to
// get there. It takes a row the scene made (places/cards.js's words, already
// in it), never the generator.
export default function PlaceCard({ dest, docked = false, onFly = null, onHangar = null, leaving = false }) {
  const sector = CHART_WORDS.sector(dest.cube ?? [0, 0, 0]);
  if (dest.pending || dest.flat) {
    return (
      <>
        <p className="eyebrow mt-3">{sector}</p>
        <h2 className="universe-title">{dest.pending ? PLACE.plotting : dest.id}</h2>
        {dest.flat && <p className="mt-3 text-sm leading-relaxed text-body">{PLACE.flat}</p>}
      </>
    );
  }
  const station = dest.kind === 'station';
  return (
    <>
      <p className="eyebrow mt-3" style={{ color: dest.color }}>
        {dest.type} · {sector}
      </p>
      <h2 className="universe-title">{dest.name}</h2>
      <p className="mt-3 text-sm leading-relaxed text-body">{dest.about}</p>
      {dest.facts?.length > 0 && (
        <dl className="universe-facts mt-3">
          {dest.facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {docked && onHangar ? (
        <button type="button" className="btn btn-primary universe-enter mt-4" onClick={onHangar} disabled={leaving}>
          {PLACE.hangar} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : onFly ? (
        <button type="button" className="btn btn-primary universe-enter mt-4" onClick={() => onFly(dest.id)} disabled={leaving}>
          {station ? PLACE.dock : PLACE.fly} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <p className="mt-4 text-sm text-muted">{PICK_A_SHIP}</p>
      )}
    </>
  );
}
