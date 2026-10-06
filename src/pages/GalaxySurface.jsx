import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { local, useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { CREWS, SHIP_KEY, crewById, parseShip } from '../components/universe/crews';
import { CONTROLS_KEY, readControls } from '../components/universe/controls';
import { LOADOUT_KEY, loadoutOf, readLoadouts } from '../components/universe/outfit';
import { HULL_KEY, readHulls } from '../components/universe/shipyard/build';
import { useAchievements } from '../components/Achievements';
import Comms from '../components/universe/Comms';
import Online from '../components/universe/online/Online';
import { useOnline } from '../components/universe/online/useOnline';
import { parseSystem, systemById } from '../components/galaxy/systems';
import { galaxyCrew } from '../components/galaxy/lines';
import { LANDABLE, siteOf } from '../components/galaxy/surface/sites';
import { surfaceUrl } from '../components/galaxy/surface/catalog';
import { surfaceCrew } from '../components/galaxy/surface/lines';
import SurfaceView from '../components/galaxy/surface/SurfaceView';
import surfaceModule from '../components/galaxy/surface/module';
import galaxyModule from '../components/galaxy/module';
import { FOUND_KEY, LAUNCH_KEY, QUESTS_KEY, readDone, readFound } from '../components/galaxy/travel';
import { runtime } from '../runtime';
import ChaseHud from '../components/galaxy/surface/ChaseHud';
import { missionOf } from '../components/galaxy/surface/missions';
import ModelCredits from '../components/ModelCredits';
import { wornFiles } from '../components/rickmorty/wardrobe/looks';
import { useLooks } from '../components/rickmorty/wardrobe/useLooks';
import { openGuide } from '../lib/palette';
import '../components/universe/universe.css';
import '../components/galaxy/galaxy.css';
import '../components/galaxy/surface/surface.css';

const LANDED_KEY = 'tp-galaxy-landed'; // the worlds you've set foot on
const CLIMB = 3400; // ms of the climb out seen before space takes over: the ship lifting, then shooting up under the sky's glare (surface.css .surface-exit rises from 2.5 s to here)
export const MISSIONS_KEY = 'tp-galaxy-missions'; // { 'system/id': { t, stars } }: your best at each mission played down on a world

const readBests = () => {
  const all = local.get(MISSIONS_KEY);
  return all && typeof all === 'object' ? all : {};
};

// A world, from the ground (/galaxy/tatooine/surface): you land, you get
// out, you walk (or ride) about it finding its places, you talk to whoever's
// there, and when you're done you get back in your ship and take off (back
// to the system, /galaxy/tatooine). What's over the 3D: where you are and
// how much of the world you've found, the compass with what's left to find
// on it, what E does, who's talking, what you've just found and what it is.
export default function GalaxySurface() {
  const navigate = useNavigate();
  // come down from space, flown (the galaxy's page handed its world over to
  // this one before the route changed): the air's glow going as you come out of it
  const [entry] = useState(() => runtime().current?.module === surfaceModule);
  // (the way back up: the galaxy page's code comes ahead, so the route changes under the glare at once)
  useEffect(() => void import('./Galaxy').catch(() => {}), []);
  const id = parseSystem(useParams().system);
  const site = useMemo(() => (id ? siteOf(id) : null), [id]);
  const sys = systemById(id);
  // a mission played down here (?mission=chase): you start in it
  const [params] = useSearchParams();
  const mission = useMemo(() => missionOf(id, params.get('mission')), [id, params]);
  const missionKey = mission ? `${id}/${mission.id}` : null;
  // the scene's view of it, as the page needs it (how it stands, the count,
  // the scouts left, the result: these change now and then); the clock and
  // the leader's progress come ten times a second, and go straight to the
  // HUD through `chaseFeed`, so the rest of the page isn't drawn again for them
  const [chase, setChase] = useState(null);
  const chaseFeed = useRef(new Set());
  const chaseShown = useRef('');
  const [best, setBest] = useState(() => (missionKey ? (readBests()[missionKey] ?? null) : null));
  const bestRef = useRef(best);
  bestRef.current = best;
  const [fresh, setFresh] = useState(false); // the last win was a new best
  // another mission here (or none): its own view and best
  useEffect(() => {
    setChase(null);
    chaseShown.current = '';
    setFresh(false);
    setBest(missionKey ? (readBests()[missionKey] ?? null) : null);
  }, [missionKey]);
  useDocumentTitle(site ? (mission ? `${mission.name} · ${sys.name}` : `${site.place} · ${sys.name}`) : 'A galaxy far, far away');
  const reduced = useReducedMotion();
  const [ship] = useState(() => parseShip(local.get(SHIP_KEY)) ?? 'xwing');
  const crew = crewById(ship);
  const { unlocked, unlock } = useAchievements();
  const build = useMemo(() => (ship && readHulls(local.get(HULL_KEY), CREWS.map((c) => c.id))[ship]) || null, [ship]);
  const loadout = useMemo(() => loadoutOf(readLoadouts(local.get(LOADOUT_KEY), CREWS.map((c) => c.id)), ship, unlocked, build), [ship, unlocked, build]);
  // online: the other pilots down here with you
  const online = useOnline();
  const { setKind, setLoadout, setBuild: tellBuild } = online;
  useEffect(() => setKind(ship), [setKind, ship]);
  useEffect(() => setLoadout(loadout), [setLoadout, loadout]);
  useEffect(() => tellBuild?.(build), [tellBuild, build]);
  const [found, setFound] = useState(() => readFound()[id] ?? []);
  const [phase, setPhase] = useState('landing');
  const [prompt, setPrompt] = useState(null);
  const [here, setHere] = useState(null);
  const [talk, setTalk] = useState(null); // { who, text, n }
  const [toast, setToast] = useState(null); // { title, text, n }
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(() => readDone()[id] ?? []); // the quests done here
  const [quest, setQuest] = useState(null); // { id, name, text, left, shoot }
  const [list, setList] = useState(false); // the things-to-do list, open
  const [health, setHealth] = useState(100);
  const [zone, setZone] = useState(null); // { id, name } inside somewhere
  const [fade, setFade] = useState(0); // a moment's black, going in or out
  const [aiming, setAiming] = useState(false);
  const lines = useRef([]); // what's to be said, in turn
  const view = useRef({ live: false });
  const compass = useRef(null);
  const comms = useRef(null);
  const landed = useRef(false);
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const later = (key, ms, fn) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };
  const [looks] = useLooks(); // (how the cruiser's Rick and Morty come out, for the credits)
  const talkCrew = useMemo(() => (crew && site ? surfaceCrew(galaxyCrew(crew), site) : null), [crew, site]);

  // Back up to the system. From the link as from E at the ship, the climb
  // out comes first (the scene's leaving phase). With the 3D on it's flown:
  // the galaxy's world (made with the ship climbing off this planet:
  // LAUNCH_KEY) is built behind the climb and takes over CLIMB ms in, under
  // the sky's glare, the route following with the glare still on
  // (pages/Galaxy.jsx takes it off). Without, or when the world can't, the
  // screen goes and the system's page comes.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true; // (set here, not at first render: React's second run of an effect in development cleans up and comes back)
    return () => void (alive.current = false);
  }, []);
  const leavingRef = useRef(false);
  const markLaunch = () => {
    try {
      window.sessionStorage.setItem(LAUNCH_KEY, id);
    } catch {
      /* storage unavailable */
    }
  };
  const goUp = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    markLaunch();
    later('leave', 700, () => navigate(`/galaxy/${id}`));
  }, [id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps
  const flyOut = useCallback(() => {
    if (leavingRef.current) return;
    const host = view.current.live ? view.current.host?.() : null;
    if (!host) return goUp();
    leavingRef.current = 'fly';
    setLeaving('fly');
    markLaunch();
    const props = { system: id, reduced, ship, loadout, build, controls: readControls(local.get(CONTROLS_KEY)), net: online.client, frozen: false };
    const climb = new Promise((r) => later('climb', reduced ? 300 : CLIMB, r));
    runtime()
      .handover(galaxyModule, props, host, { fade: 1000, held: true, after: climb })
      .catch(() => false)
      .then((ok) => {
        if (!alive.current) return; // (gone elsewhere meanwhile: not this page's to steer)
        if (ok) return navigate(`/galaxy/${id}`);
        // not handed over: the old way, and the page makes its own
        setLeaving(true);
        later('leave', 700, () => navigate(`/galaxy/${id}`));
      });
  }, [goUp, id, navigate, reduced, ship, loadout, build, online.client]); // eslint-disable-line react-hooks/exhaustive-deps
  const takeOff = useCallback(() => {
    if (leavingRef.current) return;
    if (!(view.current.live && view.current.takeOff?.())) goUp();
  }, [goUp]);

  const onEvent = useCallback(
    (e) => {
      if (e.type === 'phase') {
        setPhase(e.phase);
        if (e.phase === 'out' || (e.phase === 'walk' && !landed.current)) {
          if (e.phase === 'out') comms.current?.handle({ type: 'event', id: 'surface:out' });
          // set foot on it: one more world
          landed.current = true;
          const worlds = new Set([...(Array.isArray(local.get(LANDED_KEY)) ? local.get(LANDED_KEY) : []), id]);
          local.set(LANDED_KEY, [...worlds]);
          unlock('groundside');
          if (LANDABLE.every((w) => worlds.has(w))) unlock('wanderer');
        }
        if (e.phase === 'leaving') {
          comms.current?.handle({ type: 'event', id: 'surface:leave' });
          flyOut();
        }
        if (e.phase === 'ride') comms.current?.handle({ type: 'event', id: `surface:ride` });
      } else if (e.type === 'prompt') setPrompt(e.text);
      else if (e.type === 'here') setHere(e.id);
      else if (e.type === 'talk') {
        setTalk((t) => ({ who: e.who, text: e.text, n: (t?.n ?? 0) + 1 }));
        later('talk', 3500 + e.text.length * 45, () => setTalk(null));
      } else if (e.type === 'found') {
        const place = site?.places.find((p) => p.id === e.id);
        if (!place) return;
        setFound((was) => {
          if (was.includes(e.id)) return was;
          const next = [...was, e.id];
          local.set(FOUND_KEY, { ...readFound(), [id]: next });
          if (site.places.every((p) => next.includes(p.id))) unlock('surveyor');
          return next;
        });
        setToast((t) => ({ title: place.name, text: place.about, n: (t?.n ?? 0) + 1 }));
        later('toast', 7000, () => setToast(null));
        comms.current?.handle({ type: 'event', id: `surface:${e.id}` });
      } else if (e.type === 'edge') {
        setToast((t) => ({ title: 'Nothing out there', text: site?.edge ?? 'Just more of the same, as far as you can see. Better turn back.', n: (t?.n ?? 0) + 1 }));
        later('toast', 4000, () => setToast(null));
      } else if (e.type === 'fell') {
        setToast((t) => ({ title: 'Long way down', text: 'You’d still be falling. Back to the ship.', n: (t?.n ?? 0) + 1 }));
        later('toast', 4000, () => setToast(null));
      } else if (e.type === 'say') {
        // lines in turn, each up long enough to read
        const wasEmpty = !lines.current.length;
        lines.current.push(...e.lines);
        const next = () => {
          const l = lines.current.shift();
          if (!l) {
            setTalk(null);
            return;
          }
          setTalk((t) => ({ who: l.who, text: l.text, n: (t?.n ?? 0) + 1 }));
          later('talk', 2600 + l.text.length * 42, next);
        };
        if (wasEmpty) next();
      } else if (e.type === 'quest') setQuest(e.id ? e : null);
      else if ((e.type === 'questDone' || e.type === 'questFail') && e.id === mission?.quest?.id) {
        // (a quest mission's own quest: its card says how it went)
      } else if (e.type === 'questDone') {
        const q = site?.quests.find((x) => x.id === e.id);
        setDone((was) => {
          if (was.includes(e.id)) return was;
          const next = [...was, e.id];
          local.set(QUESTS_KEY, { ...readDone(), [id]: next });
          return next;
        });
        if (e.achievement) unlock(e.achievement);
        setToast((t) => ({ title: q?.name ?? 'Done', text: q?.reward ?? 'Done.', n: (t?.n ?? 0) + 1, done: true }));
        later('toast', 6000, () => setToast(null));
      } else if (e.type === 'questFail') {
        setToast((t) => ({ title: 'Not this time', text: e.why === 'time' ? 'Out of time. Back to the start of it: try again.' : 'Try that again.', n: (t?.n ?? 0) + 1 }));
        later('toast', 3500, () => setToast(null));
      } else if (e.type === 'health') setHealth(e.value);
      else if (e.type === 'down') {
        setToast((t) => ({ title: 'Knocked down', text: 'Back on your feet. Try that again.', n: (t?.n ?? 0) + 1 }));
        later('toast', 3500, () => setToast(null));
      } else if (e.type === 'zone') {
        setFade(1);
        later('fade', 350, () => setFade(0));
        setZone(e.id ? { id: e.id, name: e.name } : null);
      } else if (e.type === 'fire') {
        setAiming(true);
        later('aim', 3000, () => setAiming(false));
      } else if (e.type === 'leave') goUp();
      else if (e.type === 'bump') comms.current?.handle({ type: 'bump', hard: e.hard });
      else if (e.type === 'mission') {
        for (const f of chaseFeed.current) f(e.view);
        const v = e.view;
        const shown = v ? `${v.phase}|${v.count}|${v.left}|${v.result ? 1 : 0}` : '';
        if (shown !== chaseShown.current) {
          chaseShown.current = shown;
          setChase(v);
        }
        const ev = e.event;
        if (ev?.type === 'won' && mission && v?.result) {
          const run = { t: v.result.t, stars: v.result.stars };
          const was = bestRef.current;
          const isBest = !was || run.t < was.t;
          setFresh(isBest);
          if (isBest) {
            local.set(MISSIONS_KEY, { ...readBests(), [missionKey]: run });
            setBest(run);
          }
          if (mission.achievement) unlock(mission.achievement);
        } else if (ev?.type === 'knocked') {
          setToast((t) => ({ title: 'Thrown off', text: 'Back on the bike in a moment. The trees don’t move.', n: (t?.n ?? 0) + 1 }));
          later('toast', 2500, () => setToast(null));
        }
      }
    },
    [site, id, unlock, mission, missionKey, flyOut, goUp],
  );
  const track = (qid) => {
    view.current?.input?.('track', qid);
    setList(false);
  };

  // H (or ?, the site's own key) for the controls, in the site's guide; Q
  // for the list of things to do, Escape shuts it
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'h' || e.key === 'H') openGuide();
      if (e.key === 'q' || e.key === 'Q') setList((l) => !l);
      if (e.key === 'Escape') setList(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the models on this world, for their credits, what the cruiser's crew carry out, and Luke, who walks out of the X-wing (kept, so the credits aren't drawn again with every change of the page)
  const kinds = useMemo(() => (site ? [...[...site.things_all, ...site.scatter, ...site.life, ...site.rides].map((t) => surfaceUrl(t.kind)), ...(ship === 'cruiser' ? wornFiles(looks) : []), ...(ship === 'xwing' ? ['/models/galaxy/crew/luke.glb'] : [])] : []), [site, ship, looks]);
  if (!site) return <Navigate to={id ? `/galaxy/${id}` : '/galaxy'} replace />;
  const place = site.places.find((p) => p.id === here);
  const accent = { '--accent': sys.accent, '--accent-text': sys.accent, '--btn-bg': sys.accent, '--btn-ink': '#03040a' };
  const left = site.places.filter((p) => !found.includes(p.id)).length;
  return (
    <div className="dark-scope surface-page" style={accent} data-phase={phase} data-leaving={leaving ? (leaving === 'fly' ? 'fly' : '') : undefined}>
      <h1 className="sr-only">
        {sys.name}: {site.place}
      </h1>
      <SurfaceView key={mission?.id ?? 'explore'} system={id} mission={mission?.id ?? null} ship={ship} loadout={loadout} build={build} found={found} done={done} compass={compass} net={online.client} handle={view} onEvent={onEvent} />

      {/* where you are, and how much of it you've found */}
      <div className="surface-where">
        <Link to={`/galaxy/${id}`} className="surface-world" onClick={(e) => (e.preventDefault(), takeOff())} title="Take off, back to the system">
          <span className="surface-dot" aria-hidden="true" />
          {sys.name}
        </Link>
        <p className="surface-place">{zone?.name ?? place?.name ?? site.place}</p>
        <p className="surface-count">
          {left ? `${site.places.length - left} of ${site.places.length} places found` : `All ${site.places.length} places found`}
        </p>
      </div>

      {/* the compass: the way to each place, and the ship */}
      <div className="surface-compass" ref={compass} aria-hidden="true">
        {['n', 'e', 's', 'w'].map((d) => (
          <span key={d} data-id={d} className="surface-mark surface-mark-dir">
            {d.toUpperCase()}
          </span>
        ))}
        <span data-id="quest" className="surface-mark surface-mark-quest">
          <i />
          <b>{quest ? '◆' : '!'}</b>
          <em className="d" />
        </span>
        <span data-id="ship" className="surface-mark surface-mark-ship">
          <i />
          <b>Ship</b>
          <em className="d" />
        </span>
        {site.places.map((p) => (
          <span key={p.id} data-id={p.id} className="surface-mark" data-found={found.includes(p.id) ? '' : undefined}>
            <i />
            <b>{found.includes(p.id) ? p.name : '?'}</b>
            <em className="d" />
          </span>
        ))}
      </div>

      {/* the quest you're on, and the things to do here */}
      {mission && <ChaseHud view={chase} feed={chaseFeed} mission={mission} best={best} fresh={fresh} onAgain={() => view.current?.input?.('restart')} onBack={takeOff} />}

      {phase !== 'landing' && site.quests.length > 0 && !(mission?.kind === 'chase' && chase && !chase.result) && (
        <div className="surface-quest">
          {quest ? (
            <>
              <p className="surface-quest-name">{quest.name}</p>
              <p className="surface-quest-step">
                {quest.text}
                {quest.left != null && <span className="surface-quest-time"> · {quest.left}s</span>}
              </p>
              {quest.id !== mission?.quest?.id && (
                <button type="button" className="surface-quest-link" onClick={() => view.current?.input?.('drop')}>
                  Drop it
                </button>
              )}
            </>
          ) : (
            <button type="button" className="surface-quest-open" onClick={() => setList((l) => !l)} aria-expanded={list}>
              <kbd>Q</kbd> Things to do · {done.length}/{site.quests.length}
            </button>
          )}
        </div>
      )}
      {list && (
        <div className="surface-list" role="dialog" aria-label="Things to do">
          <p className="surface-list-title">Things to do on {sys.name}</p>
          <ul>
            {site.quests.map((q) => (
              <li key={q.id} data-done={done.includes(q.id) ? '' : undefined}>
                <button type="button" onClick={() => track(q.id)} disabled={done.includes(q.id)}>
                  <b>{q.name}</b>
                  <span>{done.includes(q.id) ? 'Done' : q.about}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {health < 100 && (
        <div className="surface-health" role="meter" aria-label="Health" aria-valuenow={Math.round(health)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${health}%` }} />
        </div>
      )}
      {(((aiming || quest?.shoot) && phase === 'walk') || (mission?.kind === 'chase' && chase && !chase.result && phase === 'ride')) && <span className="surface-crosshair" aria-hidden="true" />}
      <div className="surface-door" aria-hidden="true" style={{ opacity: fade }} />
      {prompt && phase !== 'landing' && phase !== 'leaving' && (
        <p className="surface-prompt" role="status">
          <kbd>E</kbd> {prompt}
        </p>
      )}
      {talk && (
        <p key={`talk-${talk.n}`} className="surface-talk" role="status">
          <b>{talk.who}</b> {talk.text}
        </p>
      )}
      {toast && (
        <div key={`toast-${toast.n}`} className="surface-toast" data-done={toast.done ? '' : undefined} role="status">
          <p className="surface-toast-title">{toast.title}</p>
          <p className="surface-toast-text">{toast.text}</p>
        </div>
      )}
      {phase === 'landing' && (
        <div className="surface-title" aria-hidden="true">
          <p className="surface-title-world">{sys.name}</p>
          <p className="surface-title-place">{site.place}</p>
          <p className="surface-title-line">{site.line}</p>
          <p className="surface-title-skip">Any key to skip</p>
        </div>
      )}

      <div className="surface-corner">
        <button type="button" className="surface-help-btn" onClick={openGuide} aria-keyshortcuts="H">
          Controls
        </button>
        <button type="button" className="surface-help-btn" onClick={takeOff}>
          Back to orbit
        </button>
        <ModelCredits where="galaxy-surface" only={kinds} className="surface-credits-corner" />
      </div>
      {crew && talkCrew && <Comms control={comms} crew={talkCrew} reduced={reduced} />}
      {!leaving && <Online online={online} ship={ship} />}
      <div className="surface-fade" aria-hidden="true" />
      {entry && <div className="surface-entry" aria-hidden="true" />}
      {leaving === 'fly' && <div className="surface-exit" aria-hidden="true" />}
    </div>
  );
}
