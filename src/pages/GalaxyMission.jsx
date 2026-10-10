import { lazy, Suspense, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { RiArrowDownLine, RiArrowLeftLine, RiArrowRightLine, RiFilmLine, RiPlayFill } from 'react-icons/ri';
import { useDocumentTitle } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { FILMS, SYSTEMS, eraById, eraOf, filmLabel, parseSystem, systemById, yearLabel } from '../components/galaxy/systems';
import { canLand } from '../components/galaxy/surface/sites';
import { modesFor } from '../components/galaxy/surface/modes';
import { starfighterAt } from '../components/galaxy/surface/missions/starfighterMaps';
import { CRAWLS } from '../components/galaxy/crawls';
import '../components/galaxy/galaxy.css';
import '../components/galaxy/mission.css';

const OpeningCrawl = lazy(() => import('../components/experience/OpeningCrawl'));

// A mission's briefing (/galaxy/hoth/mission): the game each system in the
// galaxy is going to be, as a holotable briefing: its opening crawl (a
// button plays it, with the main title), who you play, what you're up
// against, the three things to do and how it'll fly; then where it is and
// what's there now. Most are still being built ('soon'); the ones that are
// already here (the Death Star's trench run, and boarding it) go straight
// in. From here: back to the system (out of hyperspace there), on to the
// next briefing, or the whole galaxy map.
export default function GalaxyMission() {
  const navigate = useNavigate();
  const id = parseSystem(useParams().system);
  const sys = systemById(id);
  useDocumentTitle(sys ? `${sys.game.title} · ${sys.name}` : 'A galaxy far, far away');
  const [crawl, setCrawl] = useState(false);
  if (!sys) return <Navigate to="/galaxy" replace />;
  const g = sys.game;
  const live = g.status === 'live';
  const era = eraById(eraOf(sys));
  const i = SYSTEMS.indexOf(sys);
  const next = SYSTEMS[(i + 1) % SYSTEMS.length];
  const prev = SYSTEMS[(i - 1 + SYSTEMS.length) % SYSTEMS.length];
  const story = CRAWLS[sys.id];
  // (every system's colour is light, readable on the dark page: so dark on a button)
  const accent = { '--accent': sys.accent, '--accent-text': sys.accent, '--btn-bg': sys.accent, '--btn-ink': '#03040a' };

  return (
    <div className="dark-scope mission-page" style={accent}>
      <div className="mission-stars" aria-hidden="true" />
      <div className="shell relative z-10 pb-24 pt-[calc(var(--nav-h)+40px)]">
        <nav className="mission-crumbs" aria-label="Where this is">
          <Link to="/universe/starwars">The universe</Link>
          <span aria-hidden="true">/</span>
          <Link to="/galaxy">A galaxy far, far away</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/galaxy/${sys.id}`}>{sys.name}</Link>
        </nav>

        <header className="mission-head">
          <div>
            <p className="eyebrow">
              Mission briefing · {sys.name} · {filmLabel(g.film)}
            </p>
            <h1 className="display mission-title">{g.title}</h1>
            <p className="lead mt-4 max-w-2xl">{g.pitch}</p>
            {/* another mission on the same world, from the same briefing (game.also) */}
            {g.also?.map((a) => (
              <p key={a.id} className="mt-3 max-w-2xl text-sm text-muted">
                <b>{a.title}.</b> {a.text}
              </p>
            ))}
            <div className="mt-6 flex flex-wrap gap-3">
              {live ? (
                <Link to={g.to} className="btn btn-primary">
                  {g.go ?? 'Fly it now'} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className="mission-soon" role="status">
                  <span aria-hidden="true" className="mission-soon-dot" /> In the hangar: coming in a future update
                </span>
              )}
              {g.also?.map((a) => (
                <Link key={a.id} to={a.to} className="btn btn-primary">
                  {a.go ?? 'Play it now'}: {a.title} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
                </Link>
              ))}
              {/* the game's Starfighter Assault over this world, from its space level (the landing's mode menu has the same card: surface/modes.js) */}
              {starfighterAt(sys.id) && (
                <Link to={`/galaxy/${sys.id}?battle=starfighter`} className="btn btn-primary">
                  Fly it now: Starfighter Assault <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
              {story && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    audioContext();
                    setCrawl(true);
                  }}
                >
                  <RiFilmLine className="h-4 w-4" aria-hidden="true" /> Play its opening crawl
                </button>
              )}
              {canLand(sys.id) && (
                <Link to={`/galaxy/${sys.id}/surface`} className="btn btn-ghost">
                  <RiArrowDownLine className="h-4 w-4" aria-hidden="true" /> Land on {sys.id === 'bespin' ? 'Cloud City' : sys.name} and look round
                </Link>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => navigate(`/galaxy/${sys.id}`)}>
                <RiPlayFill className="h-4 w-4" aria-hidden="true" /> Fly to {sys.name} meanwhile
              </button>
            </div>
          </div>
          <div className="mission-holo" aria-hidden="true">
            <div className="mission-planet" />
            <div className="mission-ring" />
            <div className="mission-ring mission-ring-2" />
            <span className="mission-target" />
            <span className="mission-target mission-target-2" />
            <span className="mission-target mission-target-3" />
          </div>
        </header>

        <div className="mission-grid">
          <section className="mission-card" aria-labelledby="mission-objectives">
            <h2 id="mission-objectives" className="mission-h">
              Objectives
            </h2>
            <ol className="mission-objectives">
              {g.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ol>
          </section>
          <section className="mission-card" aria-labelledby="mission-you">
            <h2 id="mission-you" className="mission-h">
              You fly as
            </h2>
            <p className="mission-big">{g.role}</p>
            <h2 className="mission-h">How it’ll play</h2>
            <p>{g.how}</p>
          </section>
          <section className="mission-card" aria-labelledby="mission-when">
            <h2 id="mission-when" className="mission-h">
              When
            </h2>
            <p className="mission-big" style={{ color: era.color }}>
              {era.name}
            </p>
            <p>
              {FILMS[g.film].title}, {yearLabel(FILMS[g.film].year)}. {era.about}
            </p>
            <h2 className="mission-h">Where</h2>
            <p>
              {sys.name}: {[sys.region, sys.sector, sys.grid && `grid ${sys.grid}`].filter(Boolean).join(', ')}.
            </p>
          </section>
        </div>

        {/* what's played down there, as the landing's menu has it (modes.js) */}
        {canLand(sys.id) && (
          <section className="mission-card" aria-labelledby="mission-modes">
            <h2 id="mission-modes" className="mission-h">
              Down on {sys.name}
            </h2>
            <ul className="mission-objectives">
              {modesFor(sys.id).map((c) => (
                <li key={c.id}>
                  {c.state === 'live' ? <Link to={c.to}>{c.name}</Link> : <span className="text-muted">{c.name}</span>}
                  {': '}
                  {c.state === 'live' ? c.about : c.why}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mission-card mission-moment" aria-label="There now">
          <p className="mission-h">There now: {sys.moment.title}</p>
          <p>{sys.moment.text}</p>
          <p className="mt-3 text-sm text-muted">{sys.about}</p>
        </section>

        <nav className="mission-more" aria-label="More briefings">
          <Link to={`/galaxy/${prev.id}/mission`} className="btn btn-ghost">
            <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" /> {prev.game.title}
          </Link>
          <Link to="/galaxy" className="btn btn-ghost">
            The galaxy
          </Link>
          <Link to={`/galaxy/${next.id}/mission`} className="btn btn-ghost">
            {next.game.title} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </Link>
        </nav>
        <p className="mt-10 text-xs text-muted">A fan tribute: Star Wars and everything in it belong to Lucasfilm.</p>
      </div>
      {crawl && story && (
        <Suspense fallback={null}>
          <OpeningCrawl variant="mission" story={story} onClose={() => setCrawl(false)} />
        </Suspense>
      )}
    </div>
  );
}
