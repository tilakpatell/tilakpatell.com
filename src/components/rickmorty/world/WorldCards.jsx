import { Link as RouterLink } from 'react-router-dom';
import { RiArrowLeftLine, RiCheckLine, RiHome4Line } from 'react-icons/ri';
import { homeLink } from '../adventure/ways';
import { progress } from './rules';
import { WAY_HOME, hereHint, inLine } from './planetMode';
import { toastLife } from './toastSlot';

// The world's title (Dimension C-137, or the planet Morty's landed on) and its
// toast, which ./RmWorld.jsx's HUD shows too; and without 3D, the places as
// cards that open the same things. A planet (./planetMode.js) is one card,
// with the way back to space.

export function Title({ name = null }) {
  // (a planet's last word in green, as C-137's number is)
  const words = name ? name.split(' ') : ['Dimension', 'C-137'];
  const last = words.pop();
  return (
    <h2 id="rm-world-title" className="rm-title" aria-label={name ?? 'Dimension C-137'} data-planet={name ? '' : undefined}>
      {words.length > 0 && <span aria-hidden="true">{words.join(' ')}</span>} <span className="rm-title-num" aria-hidden="true">{last}</span>
    </h2>
  );
}

// a toast: something done, someone talking (fading over its own life: a
// long line stays up longer), or a no
export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="rm-toast" data-kind={toast.kind ?? 'note'} data-bad={toast.bad || undefined} role="status" key={toast.at} style={toast.kind === 'say' ? { animationDuration: `${toastLife(toast)}ms` } : undefined}>
      {toast.kind === 'done' && (
        <span className="rm-toast-tick" aria-hidden="true">
          <RiCheckLine />
        </span>
      )}
      <p>
        {toast.who && <b>{toast.who}</b>}
        <span>{toast.text}</span>
      </p>
    </div>
  );
}

const CARDS = [
  { id: 'house', name: 'The Smith house', blurb: 'Jerry’s on the couch with the TV on, and Rick left something at the breakfast table.', items: ['cable', 'butter'] },
  { id: 'garage', name: 'Rick’s garage', blurb: 'One car wide: the workbench, the worktable, the plumbus machine, a Portal panic cabinet, a portal on the wall, and a hatch in the floor down to Rick’s secret lab.', items: ['meeseeks', 'plumbus', 'portalpanic'] },
  { id: 'school', name: 'Harry Herpson High', blurb: 'Mr. Goldenfold has a pop quiz on the board. Seven right is a pass.', items: ['quiz'] },
  { id: 'arcade', name: 'Blips and Chitz', blurb: 'The arcade on the far side of the portal, and the game everyone queues for.', items: ['roy'] },
];
const CARD_LABEL = { cable: 'Watch interdimensional cable', butter: 'Switch on the butter robot', meeseeks: 'Press the Meeseeks box', plumbus: 'Watch a plumbus get made', portalpanic: 'Play Portal panic', quiz: 'Sit the pop quiz', roy: 'Play Roy: A Life Well Lived' };
const CARD_TASK = { cable: ['cable'], butter: ['butter'], meeseeks: ['meeseeks'], plumbus: ['plumbus'], portalpanic: ['portalpanic'], quiz: ['quiz'], roy: ['roy', 'roy55'] };

export default function Cards({ done, openPlace, three, gl, toast, retry, planet = null }) {
  const prog = progress(done);
  // (the neighbourhood, or the planet: what it is in 3D, and what it is here)
  const here = planet ? inLine(planet.name) : 'the neighbourhood';
  const as = planet ? 'a card' : 'cards';
  const world = planet ? 'world' : 'neighbourhood';
  return (
    <div className="shell rm-cards-wrap">
      <div className="rm-cards-head">
        <div>
          <Title name={planet?.name} />
          <p className="lead mt-4 max-w-[60ch]">{planet ? `A planet in the Rick and Morty sector of the universe map. ${planet.note}` : 'Rick and Morty’s neighbourhood: the Smith house, Rick’s garage lab, Harry Herpson High, and through the portal, Blips and Chitz.'}</p>
          {/* (the cards reach a handful of the toys: the rest needs the 3D) */}
          {!planet && <p className="mt-3 max-w-[60ch] text-sm text-muted">The story, Rick’s portal gun and most of the things to do are in the 3D world.</p>}
        </div>
        <p className="rm-cards-count">
          <b>{prog.count}</b> of {prog.total} things done
        </p>
      </div>
      {three.can ? (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost'
            ? `The graphics chip reset, so here’s ${here} as ${as}.`
            : gl === 'failed'
              ? `The 3D ${world} couldn’t start here, so here it is as ${as}.`
              : three.held
                ? `The 3D ${world} isn’t loaded yet${three.hold?.mb ? ` (about ${three.hold.mb} MB)` : ''}, so here it is as ${as}.`
                : `3D is switched off, so here’s ${here} as ${as}.`}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (!three.on) three.set('auto');
              retry();
            }}
          >
            {three.on ? 'Try 3D again' : three.held ? 'Load the 3D' : 'Turn 3D on'}
          </button>
        </p>
      ) : (
        // (no WebGL at all: nothing to turn on)
        <p className="mt-3 text-sm text-muted">{`This browser has no 3D graphics, so here’s ${here} as ${as}.`}</p>
      )}
      <div className="rm-cards-toast">
        <Toast toast={toast} />
      </div>
      <ul className="rm-cards">
        {planet ? (
          // (its things to do need the 3D: here, what they are, and whether they're done)
          <li data-place="planet">
            <h3 className="rm-card-name">{planet.name}</h3>
            {planet.tasks.map((t) => (
              <p key={t.id} className="rm-card-blurb">
                <b>{t.name}</b>
                {done.includes(t.id) ? ' (done)' : `. ${hereHint(t.hint)}`}
              </p>
            ))}
            <div className="rm-card-acts">
              <RouterLink to={`/universe/${planet.id}`} replace className="rm-card-btn">
                <RiArrowLeftLine aria-hidden="true" /> {WAY_HOME}
              </RouterLink>
              <RouterLink to={homeLink(planet).to} state={homeLink(planet).state} className="rm-card-btn">
                <RiHome4Line aria-hidden="true" /> {homeLink(planet).label}
              </RouterLink>
            </div>
          </li>
        ) : (
          CARDS.map((p) => (
            <li key={p.id} data-place={p.id}>
              <h3 className="rm-card-name">{p.name}</h3>
              <p className="rm-card-blurb">{p.blurb}</p>
              <div className="rm-card-acts">
                {p.items.map((id) => {
                  const ticked = CARD_TASK[id].every((t) => done.includes(t));
                  return (
                    <button key={id} type="button" className="rm-card-btn" data-done={ticked || undefined} onClick={() => openPlace(id)}>
                      <span className="rm-tick" aria-hidden="true">
                        {ticked && <RiCheckLine />}
                      </span>
                      {CARD_LABEL[id]}
                      {ticked && <span className="sr-only"> (done)</span>}
                    </button>
                  );
                })}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
