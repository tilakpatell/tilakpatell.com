import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowDownLine, RiArrowRightLine, RiCompass3Line, RiPlayFill, RiRocket2Line, RiSideBarFill, RiSideBarLine } from 'react-icons/ri';
import { playClip } from '../../lib/clips';
import { audioContext } from '../../lib/audio';
import { sayVoiced, voicedSrc, voiceOf } from '../../lib/voiced';
import { CREWS, crewById } from '../universe/crews';
import Face from '../universe/Faces';
import ModelCredits from '../ModelCredits';
import GuideLink from '../guide/GuideLink';
import { FILMS, eraById, eraOf, filmLabel, filmsOf, goalsOf, systemById, yearLabel } from './systems';
import { placesOf } from './places';
import { Oath, SystemWar } from './WarCard';
import { useWar } from './useWar';
import { Film } from '../../runtime/hud';
import { filmFor, tilesFor } from '../../lib/bf2017/films';
import '../../lib/bf2017/fonts.css';

// Beside the galaxy (a bottom sheet on a phone): the system you're in, as
// its card: the game's loading film of it (Battlefront II's, where the game
// went there), where it is in the galaxy, its era and the films it's in, the
// moment it's shown at, what it is, a line from the films (with the
// recording, where there is one, or else the line made in the speaker's
// voice), its facts, and its mission (a briefing
// for the game it's going to be, or the way into the one that's here
// already); what's here to fly to; and the way on (the galaxy map) and out
// (back to the universe map). With no ship yet, the ships to fly first. Put
// away (tucked), a slim bar naming where you are.

function Ships({ ship, onShip }) {
  return (
    <div className="universe-ships" role="group" aria-label="Pick a ship">
      {CREWS.map((c) => (
        <button key={c.id} type="button" className="universe-ship" aria-pressed={ship === c.id} onClick={() => onShip(c.id)}>
          <span className="universe-ship-faces" aria-hidden="true">
            {Object.keys(c.speakers)
              .slice(0, 2)
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

// the game's menu tile for a mode the galaxy has here: a galactic assault
// plays as the 2017 game's own multiplayer tile does
function ModeTile({ game }) {
  const assault = [game, ...(game.also ?? [])].find((x) => x.to?.includes('mission=assault'));
  const tile = assault ? tilesFor('assault')[0] : null;
  if (!tile) return null;
  return (
    <Link to={assault.to} className="galaxy-mode-tile">
      <Film film={tile} className="galaxy-mode-tile-film" />
      <span className="galaxy-mode-tile-text">
        <b>Galactic Assault</b> {assault.title}
      </span>
    </Link>
  );
}

function Mission({ system }) {
  const g = system.game;
  const live = g.status === 'live';
  return (
    <section className="galaxy-mission" aria-labelledby={`mission-${system.id}`}>
      <p className="galaxy-mission-kicker">
        <span>Mission</span>
        <span className="galaxy-badge" data-live={live || undefined}>
          {live ? 'Play now' : 'Coming soon'}
        </span>
      </p>
      <h3 id={`mission-${system.id}`} className="galaxy-mission-title">
        {g.title}
      </h3>
      <p className="galaxy-mission-role">
        {g.role} · {FILMS[g.film].title}
      </p>
      <p className="galaxy-mission-pitch">{g.pitch}</p>
      <ModeTile game={g} />
      <div className="mt-3 flex flex-wrap gap-2">
        {live ? (
          <Link to={g.to} className="btn btn-primary">
            {g.go ?? 'Fly it now'} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        {g.also?.map((a) => (
          <Link key={a.id} to={a.to} className="btn btn-primary" title={a.text}>
            {a.go ?? 'Play it now'}: {a.title} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </Link>
        ))}
        <Link to={`/galaxy/${system.id}/mission`} className={live ? 'btn btn-ghost' : 'btn btn-primary'}>
          Read the briefing
        </Link>
      </div>
    </section>
  );
}

// the system's place in the war you fight in, and the oath when you're
// nobody's and there's a battle on (WarCard.jsx)
function SystemWarCard({ sys, oath, suggested, onSwear }) {
  const { now, table } = useWar(oath.war);
  const row = table.systems.find((r) => r.id === sys);
  if (!row) return null;
  return (
    <div className="galaxy-war">
      <dl className="holomap-stats">
        <SystemWar row={row} war={oath.war} now={now} side={oath.side} />
      </dl>
      {row.battle && !oath.side && <Oath oath={oath} suggested={suggested} onSwear={onSwear} />}
    </div>
  );
}

// Whether a line has been made in this voice (found once the manifest's in).
function useMade(voice, text) {
  const [made, setMade] = useState(null);
  useEffect(() => {
    if (!voice) return undefined;
    let live = true;
    voicedSrc(voice, text).then((src) => live && src && setMade(`${voice}|${text}`));
    return () => {
      live = false;
    };
  }, [voice, text]);
  return Boolean(voice) && made === `${voice}|${text}`;
}

// The system's line from the films: the recording, where there is one; or,
// where there isn't, the line in the speaker's own voice once it's been made
// (systems.js's quote.voice, lib/voiced.js).
function Quote({ quote }) {
  const voice = quote.clip ? null : voiceOf(quote.voice);
  const made = useMade(voice, quote.text);
  const play = quote.clip ? () => playClip(quote.clip) : made ? () => sayVoiced(quote.voice, quote.text) : null;
  return (
    <figure className="galaxy-quote">
      <blockquote>“{quote.text}”</blockquote>
      <figcaption>
        {quote.by}, <i>{FILMS[quote.film].title}</i>
        {play && (
          <button
            type="button"
            className="galaxy-play"
            aria-label={`Play: ${quote.text}`}
            onClick={() => {
              audioContext();
              play();
            }}
          >
            <RiPlayFill className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </figcaption>
    </figure>
  );
}

export default function GalaxyPanel({ system, at, ship, onShip, onHangar = null, onMap, onGo, onLeave, onBoard, onLand, tucked, onTuck, jumping, held = null, balked = false, oath = null, suggested = null, onSwear, found = [] }) {
  const crew = crewById(ship);
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
  const era = eraById(eraOf(system));
  const goals = goalsOf(system);
  const places = placesOf(system);
  const toward = jumping ? systemById(jumping.to) : null;
  const short = held ? (systemById(held.to) ?? system) : null; // (where the Interdictor pulled you out short of)

  if (tucked) {
    return (
      <aside ref={panel} className="universe-panel galaxy-panel" data-tour="galaxy-panel" aria-label={system.name} data-tucked="">
        <button type="button" className="universe-untuck" onClick={() => toggle(false)} aria-expanded="false">
          <span className="eyebrow truncate" style={{ color: short && !toward ? '#ff8a80' : system.accent }}>
            {toward ? `Jumping to ${toward.name}…` : short ? 'Interdicted!' : system.name}
          </span>
          <span className="universe-untuck-say">
            <RiSideBarLine className="h-4 w-4" aria-hidden="true" /> Show the panel
          </span>
        </button>
        <GuideLink className="universe-guide-tucked" />
      </aside>
    );
  }

  const quote = system.quote;
  return (
    <aside ref={panel} className="universe-panel galaxy-panel" data-tour="galaxy-panel" aria-label={system.name}>
      <button type="button" className="universe-tuck" onClick={() => toggle(true)} aria-expanded="true" aria-label="Hide the panel" title="Hide the panel">
        <RiSideBarFill className="h-4 w-4" aria-hidden="true" />
      </button>
      <GuideLink className="universe-tuck universe-guide" />
      <p className="eyebrow">A galaxy far, far away</p>
      {toward && (
        <p className="galaxy-jumping" role="status">
          {jumping.phase === 'align' ? 'Coming round onto the bearing for' : 'Jumping to lightspeed:'} <b>{toward.name}</b>
        </p>
      )}
      {short && !toward && (
        <p className="galaxy-jumping" data-held="" data-balked={balked || undefined} role="alert">
          <b>Interdicted.</b> An Imperial Interdictor pulled you out of hyperspace short of {short.name}. Its gravity well holds you: no jump till you’re clear of it. Shoot its fighters down, or run for the edge of the well.
          {balked && (
            <>
              {' '}
              <b>The hyperdrive won’t take.</b>
            </>
          )}
        </p>
      )}
      <Film film={filmFor({ system: system.id })} className="galaxy-film-card" label={`${system.name}, from Star Wars Battlefront II’s loading film`} />
      <h2 className="universe-title galaxy-title">{system.name}</h2>
      <p className="galaxy-where">
        {[system.region, system.sector, system.grid && `Grid ${system.grid}`].filter(Boolean).join(' · ')}
      </p>
      <div className="galaxy-eras" aria-label="Era and films">
        <span className="galaxy-era" style={{ '--era': era.color }}>
          {era.name} · {yearLabel(FILMS[system.moment.film].year)}
        </span>
        {filmsOf(system).map((f) => (
          <span key={f.id} className="galaxy-film" data-now={f.id === system.moment.film || undefined} title={filmLabel(f.id)}>
            {f.episode ?? f.title}
          </span>
        ))}
      </div>

      {oath && <SystemWarCard sys={system.id} oath={oath} suggested={suggested} onSwear={onSwear} />}

      <div className="mt-4 flex flex-wrap gap-2">
        {crew && onLand && (
          <button type="button" className="btn btn-primary" onClick={onLand}>
            <RiArrowDownLine className="h-4 w-4" aria-hidden="true" /> Land on {system.id === 'bespin' ? 'Cloud City' : system.name}
          </button>
        )}
        <button type="button" className={crew && onLand ? 'btn btn-ghost' : 'btn btn-primary'} onClick={onMap}>
          <RiCompass3Line className="h-4 w-4" aria-hidden="true" /> Plot a course
        </button>
        {goals
          .filter((g) => g.board)
          .map((g) => (
            <button key={g.id} type="button" className="btn btn-ghost" onClick={() => (at === g.id ? onBoard(g.board) : onGo(g.id))}>
              {at === g.id ? 'Board the Death Star' : 'Fly to the Death Star'}
            </button>
          ))}
      </div>

      {!crew && (
        <>
          <p className="mt-5 text-sm leading-relaxed">Pick a ship to fly the galaxy in. The crew have something to say about every system.</p>
          <Ships ship={ship} onShip={onShip} />
        </>
      )}

      <section className="galaxy-moment" aria-label="The moment">
        <p className="galaxy-moment-film">{filmLabel(system.moment.film)}</p>
        <h3 className="galaxy-moment-title">{system.moment.title}</h3>
        <p className="galaxy-moment-text">{system.moment.text}</p>
      </section>

      <p className="mt-4 text-sm leading-relaxed">{system.about}</p>

      <Quote quote={quote} />

      <dl className="galaxy-facts">
        {system.facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <Mission system={system} />

      {crew && goals.length > 1 && (
        <section className="galaxy-here" aria-label="In this system">
          <p className="label">In this system</p>
          <ul>
            {goals.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => onGo(g.id)} disabled={at === g.id}>
                  <RiRocket2Line className="h-4 w-4" aria-hidden="true" /> {at === g.id ? `At ${g.name}` : `Fly to ${g.name}`}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {crew && places.length > 0 && (
        <section className="galaxy-here galaxy-out" aria-label="Out there">
          <p className="label">
            Out there <span className="text-muted">· {found.filter((id) => places.some((p) => p.id === id)).length} of {places.length} found</span>
          </p>
          <ul>
            {places.map((p) => {
              const got = found.includes(p.id);
              return (
                <li key={p.id} data-found={got ? '' : undefined}>
                  <button type="button" onClick={() => onGo(p.id)} disabled={at === p.id}>
                    <RiCompass3Line className="h-4 w-4" aria-hidden="true" /> {at === p.id ? `At ${(got ? p.name : p.hint).replace(/^(A|An|The) /, (m) => m.toLowerCase())}` : got ? p.name : `${p.hint}, somewhere out there`}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {crew && (
        <p className="mt-5 text-xs leading-relaxed text-muted">
          Flying {crew.ship.replace(/^(The|An) /, (m) => m.toLowerCase())} with {crew.label}.{' '}
          {onHangar && (
            <>
              <button type="button" className="universe-back inline galaxy-yard-link" onClick={onHangar}>
                Open the shipyard
              </button>{' '}
            </>
          )}
          <button type="button" className="universe-back inline" onClick={() => onShip(null)}>
            Change ship
          </button>
        </p>
      )}

      <button type="button" className="universe-back mt-4" onClick={onLeave}>
        Leave the galaxy, back to the universe
      </button>
      <p className="universe-credit">A fan tribute: Star Wars and everything in it belong to Lucasfilm. The ships here are built in code, but for these:</p>
      <ModelCredits where="galaxy" className="universe-credit universe-models" />
    </aside>
  );
}
