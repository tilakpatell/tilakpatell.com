import { useEffect, useRef, useState } from 'react';
import { RiArrowGoBackLine, RiArrowLeftLine, RiArrowRightLine, RiCompass3Line, RiLayoutGridLine, RiRestartLine, RiSideBarFill, RiSideBarLine } from 'react-icons/ri';
import { restartSite } from '../../lib/restart';
import GuideLink from '../guide/GuideLink';
import { CARDS } from '../interests/cards';
import { STATION_CARDS } from './stationCards';
import { CREWS, crewById } from './crews';
import { PARTS_SLOTS, STOCK, partById } from './outfit';
import { paintById } from './paint';
import { next, prev } from './layout';
import { byId } from './universes';
import Face from './Faces';
import ModelCredits from '../ModelCredits';

// Beside the map (a bottom sheet on a phone). With nothing selected: the
// ships to fly (or how to fly the one you're in, and what it's fitted with
// in the hangar). With a universe selected:
// its card, the way into its world, previous / next in map order, and back
// out to the whole map. Put away (tucked), it's a small bar naming where you
// are, so the map has the room; the same element either way, so the scene
// sees it change size and moves the planets into the space it leaves.
// `onNav` opens the nav map (NavMap.jsx): everywhere, and how to get there.

function Ships({ ship, onShip }) {
  return (
    <div className="universe-ships" role="group" aria-label="Pick a ship">
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

const and = (names) => (names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// What the ship's fitted with (outfit.js), and the way into the hangar
function Fitted({ loadout, onHangar }) {
  const paint = paintById(loadout.paint);
  const parts = PARTS_SLOTS.filter((slot) => loadout[slot] !== STOCK).map((slot) => partById(slot, loadout[slot]));
  return (
    <div className="universe-fitted mt-4">
      <p className="universe-fitted-line">
        <span className="universe-fitted-swatch" style={{ background: paint.hull ? `linear-gradient(135deg, ${paint.hull} 50%, ${paint.trim} 50%)` : undefined }} aria-hidden="true" />
        <span>
          {paint.hull ? `${paint.name} paint` : 'Factory paint'}
          {parts.length ? `, with ${and(parts.map((p) => p.name))}` : ', nothing bolted on'}
        </span>
      </p>
      <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={onHangar}>
        Open the hangar
      </button>
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

export default function UniversePanel({ universe, wonder = null, onFly = null, onSelect, onEnter, onWhole, leaving, ship, loadout, onShip, onHangar, onClassic, tucked = false, onTuck, onNav }) {
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
      <aside ref={panel} className="universe-panel" aria-label={universe ? universe.label : 'About the map'} data-tucked="">
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
      <aside ref={panel} className="universe-panel" aria-label={wonder.name}>
        {onTuck && <Tuck onTuck={toggle} />}
        <div className="universe-links flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" className="universe-back" onClick={onWhole}>
            <RiArrowGoBackLine className="h-3.5 w-3.5" aria-hidden="true" /> The whole map
          </button>
          {onNav && (
            <button type="button" className="universe-back" onClick={onNav}>
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
          <p className="mt-4 text-sm text-muted">Pick a ship below the map to fly out to it.</p>
        )}
        <p className="universe-fitted-line mt-4 text-xs text-muted">This link opens the map right here: share it.</p>
      </aside>
    );
  }

  if (!universe) {
    return (
      <aside ref={panel} className="universe-panel" aria-label="About the map">
        {onTuck && <Tuck onTuck={toggle} />}
        <p className="eyebrow">The universe</p>
        <h2 className="universe-title">My whole site, as a universe</h2>
        {onNav && (
          <button type="button" className="btn btn-ghost btn-sm universe-nav-open mt-4" onClick={onNav}>
            <RiCompass3Line className="h-4 w-4" aria-hidden="true" /> Open the nav map
          </button>
        )}
        {!crew || changing ? (
          <>
            <p className="mt-3 text-sm leading-relaxed">
              The stations round the sun are my pages: home, experience, projects, résumé, contact and the terminal. The planets further out are the things I love. Pick a ship and fly to any of them;
              your crew has a word about each.
            </p>
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
            <p className="mt-3 text-sm leading-relaxed">
              You’re flying {crew.ship.replace(/^(The|An) /, (m) => m.toLowerCase())} with {crew.label}. Fly close to a station or a planet to see what’s there, or pick one by name and the ship takes
              you.
            </p>
            {loadout && onHangar && <Fitted loadout={loadout} onHangar={onHangar} />}
            <ul className="universe-keys mt-4">
              <li className="universe-keys-board">
                It flies like a Battlefront starfighter: <kbd>W</kbd> <kbd>S</kbd> for the throttle, <kbd>A</kbd> <kbd>D</kbd> to roll, <kbd>←</kbd> <kbd>→</kbd> to swing the nose and <kbd>↑</kbd> <kbd>↓</kbd> to pull it up and down. Or drag on the map like a stick
              </li>
              <li className="universe-keys-board">
                Nothing stops the nose: hold <kbd>↑</kbd> to loop right over. To turn hard, roll with <kbd>A</kbd> or <kbd>D</kbd> and pull back. Let go and it rolls itself upright again
              </li>
              <li>The worlds are far apart: boost between them for the pulse drive, and fight your way through. Or open the nav map and let the ship take you, at hyperspeed (a jump), super speed or cruising</li>
              <li className="universe-keys-board">
                <kbd>Space</kbd> to boost, hold <kbd>F</kbd> to fire, <kbd>M</kbd> for the nav map, <kbd>J</kbd> to jump to the place picked
              </li>
              <li className="universe-keys-board">
                <kbd>V</kbd> for the cockpit, or back behind the ship
              </li>
              <li>The guns lock on to whoever comes after you, nearest first: shoot at the pip ahead of them and the shots bend home. Arrows at the edge show the ones you can’t see</li>
              <li className="universe-keys-board">
                <kbd>T</kbd> for the next target (<kbd>Q</kbd> the one before), or click one; <kbd>E</kbd> to land or dock where you are
              </li>
              <li className="universe-keys-board">
                <kbd>H</kbd> for the hangar: a paint job (more come with achievements), and boosters, thrusters, guns, shields and fins that change how it flies, as much as its power plant can run
              </li>
              <li className="universe-keys-touch">The wrench in the corner is the hangar: paint and parts for the ship</li>
              <li className="universe-keys-board">
                <kbd>O</kbd> for the flight settings: steering, pitch and roll, self-levelling (off, it stays upside down), drag sensitivity, aim assist, the camera, up and down the other way round, and <kbd>A</kbd> <kbd>D</kbd> to turn instead
              </li>
              <li>Out in deep space, click a wonder and the ship flies you there</li>
              <li className="universe-keys-touch">Drag anywhere to fly, hold the arrows to pull the nose up and down (all the way over, if you like), hold Boost to go fast and Fire to shoot; View is the cockpit, and the sliders button sets how it feels</li>
              <li className="universe-keys-touch">Tap a planet, a station or a wonder to fly there, or a hunter to lock on</li>
            </ul>
            <button type="button" className="btn btn-ghost btn-sm mt-5" onClick={() => setChanging(true)}>
              Change ship
            </button>
          </>
        )}
        {onClassic && (
          <button type="button" className="universe-back mt-5" onClick={onClassic}>
            <RiLayoutGridLine className="h-3.5 w-3.5" aria-hidden="true" /> Switch to the classic site
          </button>
        )}
        <button type="button" className="universe-back mt-2" onClick={restartSite}>
          <RiRestartLine className="h-3.5 w-3.5" aria-hidden="true" /> Restart the site from the beginning
        </button>
        <p className="universe-credit">
          Planet maps and the Milky Way by{' '}
          <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">
            Solar System Scope
          </a>{' '}
          (CC BY 4.0), recoloured; metal and paper from{' '}
          <a href="https://ambientcg.com" target="_blank" rel="noopener noreferrer">
            ambientCG
          </a>{' '}
          (CC0).
        </p>
        <ModelCredits where="universe" className="universe-credit universe-models" />
      </aside>
    );
  }
  const Card = CARDS[universe.id] ?? STATION_CARDS[universe.id];
  const core = universe.kind === 'core';
  const before = byId(prev(universe.id));
  const after = byId(next(universe.id));
  return (
    <aside ref={panel} className="universe-panel" aria-label={universe.label}>
      {onTuck && <Tuck onTuck={toggle} />}
      <div className="universe-links flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" className="universe-back" onClick={onWhole}>
          <RiArrowGoBackLine className="h-3.5 w-3.5" aria-hidden="true" /> The whole map
        </button>
        {onNav && (
          <button type="button" className="universe-back" onClick={onNav}>
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
      <ul className="universe-card mt-4" key={universe.id}>
        <Card />
      </ul>
    </aside>
  );
}
