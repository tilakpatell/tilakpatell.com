import { useEffect, useRef, useState } from 'react';
import { RiArrowGoBackLine, RiArrowLeftLine, RiArrowRightLine, RiCompass3Line, RiLayoutGridLine, RiQuestionLine, RiRestartLine, RiSideBarFill, RiSideBarLine } from 'react-icons/ri';
import { openGuide } from '../../lib/palette';
import { restartSite } from '../../lib/restart';
import GuideLink from '../guide/GuideLink';
import { CARDS } from '../interests/cards';
import { STATION_CARDS } from './stationCards';
import { CREWS, crewById } from './crews';
import { hullLine } from './yardRules';
import { PARTS_SLOTS, STOCK, partById } from './outfit';
import { paintById } from './paint';
import { next, prev } from './layout';
import { byId } from './universes';
import Face from './Faces';
import { useTouring } from '../tour/useTouring';
import ModelCredits from '../ModelCredits';
import { CopyButton } from '../ui';
import { ABOUT, PICK_A_SHIP, moonWay } from './words';

// Beside the map (a bottom sheet on a phone). With nothing selected: the
// ships to fly (or how to fly the one you're in, and what it's fitted with
// in the shipyard). With a universe selected:
// its card, the way into its world, previous / next in map order, and back
// out to the whole universe. Put away (tucked), it's a small bar naming where you
// are, so the map has the room; the same element either way, so the scene
// sees it change size and moves the planets into the space it leaves.
// `onNav` opens the nav map (NavMap.jsx): everywhere, and how to get there.

// A moon of the Rick and Morty sector's own card: a place from the show,
// and how going in goes, walked into or a whole world (words.js's moonWay;
// not the crew's card, whose portal gun toy and way to C-137 aren't the way
// into this one).
export function MoonCard({ moon }) {
  return (
    <li className="fun-card">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="stretch-semi text-xl font-semibold text-ink">{moon.label}</h3>
        <p className="mt-1 text-sm text-muted">Rick and Morty</p>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-body">A planet from the show. {moonWay(moon)}</p>
      </div>
    </li>
  );
}

function Ships({ ship, onShip }) {
  return (
    <div className="universe-ships" data-tour="ships" role="group" aria-label="Pick a ship">
      {CREWS.map((c) => (
        <button key={c.id} type="button" className="universe-ship" aria-pressed={ship === c.id} onClick={() => onShip(c.id)}>
          <span className="universe-ship-faces" aria-hidden="true">
            {Object.keys(c.speakers)
              .slice(0, 2) // the crew, not their guests
              .map((who) => (
                <Face key={who} who={who} className="universe-ship-face" />
              ))}
          </span>
          <span className="universe-ship-text">
            <span className="universe-ship-name">{c.ship}</span>
            <span className="universe-ship-crew">with {c.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// The keys to get going, as a grid; the guide (?) has all of them, and the tips
const KEYMAP = [
  [['W', 'S'], 'Throttle'],
  [['A', 'D'], 'Roll'],
  [['←', '→', '↑', '↓'], 'Steer'],
  [['Space'], 'Boost'],
  [['F'], 'Fire'],
  [['M'], 'Nav map'],
  [['V'], 'Cockpit'],
  [['H'], 'Hangar'],
];
// (and the one way down there's no key for, said under the grid)
const LANDING = 'Fly down into a planet’s air to go straight into its world.';

const and = (names) => (names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// What the ship's fitted with (outfit.js), and the way into the shipyard
// and to another ship
function Fitted({ loadout, build = null, craft = '', onHangar, onChange }) {
  const hull = hullLine(build, craft);
  const paint = paintById(loadout.paint);
  const parts = PARTS_SLOTS.filter((slot) => loadout[slot] !== STOCK).map((slot) => partById(slot, loadout[slot]));
  return (
    <div className="universe-fitted mt-4">
      <p className="universe-fitted-line">
        <span className="universe-fitted-swatch" style={{ background: paint.hull ? `linear-gradient(135deg, ${paint.hull} 50%, ${paint.trim} 50%)` : undefined }} aria-hidden="true" />
        <span>
          {paint.hull ? `${paint.name} paint` : 'Stock paint'}
          {parts.length ? `, with ${and(parts.map((p) => p.name))}` : ', nothing bolted on'}
        </span>
      </p>
      {hull && <p className="universe-fitted-hull mt-2 text-sm text-muted">{hull}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {onHangar && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onHangar}>
            Open the shipyard
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onChange}>
          Change ship
        </button>
      </div>
    </div>
  );
}

// Put the panel away, from its top corner (and the guide, beside it)
function Tuck({ onTuck }) {
  return (
    <>
      <button type="button" className="universe-tuck" onClick={() => onTuck(true)} aria-expanded="true" aria-label="Hide the panel" title="Hide the panel">
        <RiSideBarFill className="h-4 w-4" aria-hidden="true" />
      </button>
      <GuideLink className="universe-tuck universe-guide" />
    </>
  );
}

// The ways out of the universe, at the foot of the panel whatever it shows
// (the map, a wonder, a world's card), and kept in view as the panel
// scrolls: to the classic site, and back to the intro (the welcome, the
// crawl and the cockpit, as on a first visit). Below the flying keys, a
// pilot never saw them; with a world picked, they weren't there at all.
function Exits({ onClassic }) {
  return (
    <div className="universe-exits">
      {onClassic && (
        <button type="button" className="universe-back" onClick={onClassic}>
          <RiLayoutGridLine className="h-3.5 w-3.5" aria-hidden="true" /> Classic site
        </button>
      )}
      <button type="button" className="universe-back" onClick={restartSite} title="The welcome, the crawl and the cockpit again">
        <RiRestartLine className="h-3.5 w-3.5" aria-hidden="true" /> Start over
      </button>
    </div>
  );
}

export default function UniversePanel({ universe, wonder = null, onFly = null, onSelect, onEnter, onWhole, leaving, ship, loadout, build = null, onShip, onHangar, onClassic, tucked: tuckedAsked = false, onTuck, onNav }) {
  // (out of hiding while a tour runs: its stops are on it)
  const touring = useTouring();
  const tucked = tuckedAsked && !touring;
  const [changing, setChanging] = useState(false);
  const crew = crewById(ship);
  // a press on hide or show unmounts the button pressed: the focus goes on
  // to the one that takes its place
  const panel = useRef(null);
  const refocus = useRef(false);
  const toggle = (on) => {
    refocus.current = true;
    onTuck(on);
  };
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    panel.current?.querySelector('.universe-tuck, .universe-untuck')?.focus();
  }, [tucked]);

  if (tucked) {
    return (
      <aside ref={panel} className="universe-panel dialog overflow-y-auto" data-tour="panel" aria-label={universe ? universe.label : 'About the map'} data-tucked="">
        <button type="button" className="universe-untuck" onClick={() => toggle(false)} aria-expanded="false">
          <span className="eyebrow truncate" style={universe ? { color: universe.accent } : undefined}>
            {universe ? universe.label : 'The universe'}
          </span>
          <span className="universe-untuck-say">
            <RiSideBarLine className="h-4 w-4" aria-hidden="true" /> Show the panel
          </span>
        </button>
        <GuideLink className="universe-guide-tucked" />
      </aside>
    );
  }

  // a wonder, from a link out to it (/universe/aurelia): what it is, and the way there
  if (!universe && wonder) {
    return (
      <aside ref={panel} className="universe-panel dialog overflow-y-auto" data-tour="panel" aria-label={wonder.name}>
        {onTuck && <Tuck onTuck={toggle} />}
        <div className="universe-links flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" className="universe-back" onClick={onWhole}>
            <RiArrowGoBackLine className="h-3.5 w-3.5" aria-hidden="true" /> The whole universe
          </button>
          {onNav && (
            <button type="button" className="universe-back" data-tour="navmap" onClick={onNav}>
              <RiCompass3Line className="h-3.5 w-3.5" aria-hidden="true" /> Nav map
            </button>
          )}
        </div>
        <p className="eyebrow mt-3" style={{ color: wonder.color }}>
          {wonder.type}
        </p>
        <h2 className="universe-title">{wonder.name}</h2>
        <p className="mt-3 text-sm leading-relaxed text-body">{wonder.about}</p>
        {onFly ? (
          <button type="button" className="btn btn-primary universe-enter mt-4" onClick={() => onFly(wonder.id)} disabled={leaving}>
            Fly here <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <p className="mt-4 text-sm text-muted">{PICK_A_SHIP}</p>
        )}
        {/* this view has its own address: a way to share it */}
        <CopyButton className="universe-back mt-4" text={window.location.href} label="Copy a link to this view" />
        <Exits onClassic={onClassic} />
      </aside>
    );
  }

  if (!universe) {
    return (
      <aside ref={panel} className="universe-panel dialog overflow-y-auto" data-tour="panel" aria-label="About the map">
        {onTuck && <Tuck onTuck={toggle} />}
        <p className="eyebrow">The universe</p>
        <h2 className="universe-title">My whole site, as a universe</h2>
        {onNav && (
          <button type="button" className="btn btn-ghost btn-sm mt-4" data-tour="navmap" onClick={onNav}>
            <RiCompass3Line className="h-4 w-4" aria-hidden="true" /> Open the nav map
          </button>
        )}
        {!crew || changing ? (
          <>
            {/* one sentence: the ships under it say the rest */}
            <p className="mt-3 text-sm leading-relaxed">{`${ABOUT[0].toUpperCase()}${ABOUT.slice(1)}: pick a ship and fly to any of them.`}</p>
            <Ships
              ship={ship}
              onShip={(id) => {
                setChanging(false);
                onShip(id);
              }}
            />
            {crew ? (
              <button type="button" className="universe-back mt-3" onClick={() => onShip(null)}>
                No ship, just look around
              </button>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-muted">Or pick a place by name, and the camera takes you there.</p>
            )}
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed" data-tour="ships">
              You’re flying {crew.ship.replace(/^(The|An) /, (m) => m.toLowerCase())} with {crew.label}. Fly close to a station or a planet to see what’s there, or pick one by name and the ship takes
              you.
            </p>
            {loadout ? (
              <Fitted loadout={loadout} build={build} craft={crewById(ship)?.ship ?? ''} onHangar={onHangar} onChange={() => setChanging(true)} />
            ) : (
              <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setChanging(true)}>
                Change ship
              </button>
            )}
            <dl className="universe-keymap" aria-label="Keys">
              {KEYMAP.map(([keys, does]) => (
                <div key={does}>
                  <dt>
                    {keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{does}</dd>
                </div>
              ))}
            </dl>
            <p className="universe-keymap-land">{LANDING}</p>
            <p className="universe-keymap-touch mt-4">Drag anywhere to fly, or tap a place and the ship takes you. Boost, Fire and View are on the screen, and the Shipyard button opens the shipyard.</p>
            <button type="button" className="universe-back universe-guide-all" onClick={openGuide}>
              <RiQuestionLine className="h-3.5 w-3.5" aria-hidden="true" /> All the controls and tips
            </button>
          </>
        )}
        <details className="universe-credits">
          <summary>Credits</summary>
          <p className="universe-credit">
            Planet maps by{' '}
            <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">
              Solar System Scope
            </a>{' '}
            (CC BY 4.0), recoloured; the Milky Way from{' '}
            <a href="https://www.eso.org/public/images/eso0932a/" target="_blank" rel="noopener noreferrer">
              ESO/S. Brunier
            </a>
            &rsquo;s photograph (CC BY 4.0); metal and paper from{' '}
            <a href="https://ambientcg.com" target="_blank" rel="noopener noreferrer">
              ambientCG
            </a>{' '}
            (CC0).
          </p>
          <p className="universe-credit">
            The worlds stand in their light the way{' '}
            <a href="https://bruno-simon.com" target="_blank" rel="noopener noreferrer">
              Bruno Simon
            </a>
            ’s folio does (
            <a href="https://github.com/brunosimon/folio-2019" target="_blank" rel="noopener noreferrer">
              folio-2019
            </a>
            , MIT): soft shadows baked into the ground, a bounce of the ground’s colour on everything, and a soft blob under whatever moves, rendered once in your browser as each world opens.
          </p>
          <ModelCredits where="universe" className="universe-credit universe-models" />
        </details>
        <Exits onClassic={onClassic} />
      </aside>
    );
  }
  // (a moon of the Rick and Morty sector has a card of its own: MoonCard)
  const Card = universe.kind === 'moon' ? MoonCard : (CARDS[universe.id] ?? STATION_CARDS[universe.id] ?? null);
  const core = universe.kind === 'core';
  const before = byId(prev(universe.id));
  const after = byId(next(universe.id));
  return (
    <aside ref={panel} className="universe-panel dialog overflow-y-auto" data-tour="panel" aria-label={universe.label}>
      {onTuck && <Tuck onTuck={toggle} />}
      <div className="universe-links flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" className="universe-back" onClick={onWhole}>
          <RiArrowGoBackLine className="h-3.5 w-3.5" aria-hidden="true" /> The whole universe
        </button>
        {onNav && (
          <button type="button" className="universe-back" data-tour="navmap" onClick={onNav}>
            <RiCompass3Line className="h-3.5 w-3.5" aria-hidden="true" /> Nav map
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="globe-btn" onClick={() => onSelect(before.id)} aria-label={`Previous: ${before.label}`} title={before.label}>
          <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="eyebrow truncate" style={{ color: universe.accent }}>
          {universe.label}
        </p>
        <button type="button" className="globe-btn" onClick={() => onSelect(after.id)} aria-label={`Next: ${after.label}`} title={after.label}>
          <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="btn btn-primary universe-enter mt-4" onClick={onEnter} disabled={leaving}>
        {crew ? (universe.go ?? (core ? 'Dock at' : 'Land on')) : 'Go to'} {universe.place} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
      </button>
      {Card && (
        <ul className="universe-card mt-4" key={universe.id}>
          <Card moon={universe} />
        </ul>
      )}
      <Exits onClassic={onClassic} />
    </aside>
  );
}
