import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { local, useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { CREWS, SHIP_KEY, crewById, parseShip } from '../components/universe/crews';
import { LOADOUT_KEY, loadoutOf, readLoadouts } from '../components/universe/outfit';
import { HULL_KEY, readHulls } from '../components/universe/shipyard/build';
import { useAchievements } from '../components/Achievements';
import Comms from '../components/universe/Comms';
import Online from '../components/universe/online/Online';
import { useOnline } from '../components/universe/online/useOnline';
import { FIRST, parseSystem, systemById } from '../components/galaxy/systems';
import { canLand } from '../components/galaxy/surface/sites';
import galaxyModule from '../components/galaxy/module';
import surfaceModule from '../components/galaxy/surface/module';
import { prefetchSurface, surfaceProps } from '../components/galaxy/travel';
import { runtime } from '../runtime';
import { galaxyCrew } from '../components/galaxy/lines';
import GalaxyView from '../components/galaxy/GalaxyView';
import GalaxyPanel from '../components/galaxy/GalaxyPanel';
import HoloMap from '../components/galaxy/HoloMap';
import GalaxyIntro from '../components/galaxy/GalaxyIntro';
import '../components/galaxy/galaxy.css';

const LAST_KEY = 'tp-galaxy-system'; // the system you were last in
const PANEL_KEY = 'tp-galaxy-panel'; // 'tucked' once the panel's been put away
const INTRO_KEY = 'tp-galaxy-intro'; // (session) the "long time ago" seen this visit
const DIVE_MAX = 4000; // ms at most the landing waits for the dive's end

// A galaxy far, far away: the Star Wars galaxy as a universe of its own,
// inside the universe map (the Star Wars planet there jumps you here). You
// fly the same ship, the same way, one star system at a time (Tatooine,
// Hoth, Endor, Yavin, Coruscant, Naboo, Nevarro… eighteen of them), and jump
// to lightspeed between them from the galaxy map (HoloMap.jsx, M). The URL is
// the system you're in (/galaxy/hoth), swapped in place as you arrive, so a
// link drops you out of hyperspace there, and a link to another system
// while you're here sends you jumping to it. Each system's card (the
// panel) has its era and films, the moment it's shown at, and its mission:
// a briefing for the game it'll be (/galaxy/hoth/mission), or the way into
// one that's here already (the Death Star's trench run). Online, the pilots
// in the same system are there with you.
export default function Galaxy() {
  const navigate = useNavigate();
  const param = parseSystem(useParams().system);
  // up from a world's surface, flown (its page handed the world over to this
  // one before the route changed): the sky's glare it climbed into still on, going
  const [exit] = useState(() => runtime().current?.module === galaxyModule);
  const [current, setCurrent] = useState(() => param ?? parseSystem(local.get(LAST_KEY)) ?? FIRST);
  const sys = systemById(current);
  useDocumentTitle(`${sys.name} · A galaxy far, far away`);
  const reduced = useReducedMotion();
  const view = useRef({ live: false, jump: () => false, goTo: () => false, escape: () => false, dive: () => false, host: () => null });
  const comms = useRef(null);
  const [ship, setShip] = useState(() => parseShip(local.get(SHIP_KEY)));
  const crew = crewById(ship);
  const online = useOnline();
  const { setKind, setLoadout, setBuild: tellBuild } = online;
  useEffect(() => setKind(ship), [setKind, ship]);
  // the ship as it's fitted in the universe map's hangar: its paint and parts
  const { unlocked, unlock } = useAchievements();
  // and the hull it flies: stock, or its garage build from the hangar's shipyard
  const build = useMemo(() => (ship && readHulls(local.get(HULL_KEY), CREWS.map((c) => c.id))[ship]) || null, [ship]);
  const loadout = useMemo(() => loadoutOf(readLoadouts(local.get(LOADOUT_KEY), CREWS.map((c) => c.id)), ship, unlocked, build), [ship, unlocked, build]);
  useEffect(() => setLoadout(loadout), [setLoadout, loadout]);
  useEffect(() => tellBuild?.(build), [tellBuild, build]);
  const [at, setAt] = useState(null); // what in the system you're at (its planet, the Death Star…)
  const [mapOpen, setMapOpen] = useState(false);
  const [jumping, setJumping] = useState(null); // { to, phase } while a jump's on
  const [held, setHeld] = useState(null); // { to } while an Interdictor's gravity well holds you (galaxy/interdiction.js)
  const [balked, setBalked] = useState(false); // the hyperdrive asked for under the hold, for a moment
  const balk = useRef(0);
  useEffect(() => () => clearTimeout(balk.current), []);
  const [leaving, setLeaving] = useState(null); // { to } once you're on your way out of the page
  const [tucked, setTucked] = useState(() => local.get(PANEL_KEY) === 'tucked');
  const [intro, setIntro] = useState(() => {
    try {
      return !reduced && window.sessionStorage.getItem(INTRO_KEY) !== '1';
    } catch {
      return false;
    }
  });
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  // the URL is the system you're in: put it right as you come in
  useEffect(() => {
    if (!param) navigate(`/galaxy/${current}`, { replace: true });
  }, [param, current, navigate]);
  // The system the scene's to be in: where its jumps have taken you, or the
  // URL's when that changes under the page (a link, the back button). Not
  // the URL as it stands: the router puts the page's own URL changes through
  // as transitions, so for a render or two after an arrival it still names
  // the system just left, and the scene would jump straight back there.
  const [wanted, setWanted] = useState(current);
  const seen = useRef(param);
  useEffect(() => {
    if (!param || param === seen.current) return;
    seen.current = param;
    setWanted(param);
    // (with no 3D to fly there in, you're there)
    if (!view.current.live) setCurrent(param);
  }, [param]);
  useEffect(() => {
    local.set(LAST_KEY, current);
  }, [current]);

  const tuck = (on) => {
    setTucked(on);
    local.set(PANEL_KEY, on ? 'tucked' : 'open');
  };
  const pickShip = (id) => {
    audioContext();
    setShip(id);
    local.set(SHIP_KEY, id);
  };

  // out of the page: the screen fades, and on (down through the air, glowing,
  // when it's onto the planet)
  const leave = useCallback(
    (to, { jump = false, land = false } = {}) => {
      if (leaving) return;
      setLeaving({ to, land });
      if (jump) window.dispatchEvent(new Event('tp:hyperspace'));
      timer.current = setTimeout(() => navigate(to), jump ? 1250 : land ? 1500 : 650);
    },
    [leaving, navigate],
  );
  // Down onto the planet you're at, flown: the ship dives on it, the air
  // glows round it, and the runtime hands over to the surface's world,
  // built behind the dive and taking over as it ends ('dove'); then the
  // route follows. Without the 3D flying (or a dive it can't make), the
  // old way: the glow, then the surface's page.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true; // (set here, not at first render: React's second run of an effect in development cleans up and comes back)
    return () => void (alive.current = false);
  }, []);
  const dove = useRef(null); // resolves the dive's end
  const land = useCallback(
    (id) => {
      if (!canLand(id) || leaving) return;
      audioContext();
      prefetchSurface();
      const to = `/galaxy/${id}/surface`;
      const host = view.current.live ? view.current.host?.() : null;
      if (!host || !view.current.dive()) {
        leave(to, { land: true });
        return;
      }
      setLeaving({ to, land: true, dive: true });
      const after = new Promise((r) => (dove.current = r));
      timer.current = setTimeout(() => dove.current?.(), DIVE_MAX); // (a dive that never ends still lands)
      runtime()
        .handover(surfaceModule, surfaceProps(id, { ship, loadout, build, net: online.client, reduced }), host, { fade: 900, held: true, after })
        .catch(() => false)
        .then(() => after)
        .then(() => {
          if (!alive.current) return; // (gone elsewhere meanwhile: not this page's to steer)
          navigate(to); // (not handed over: the page makes its own)
        });
    },
    [leave, leaving, navigate, ship, loadout, build, online.client, reduced],
  );
  // near a planet you can land on: the surface's code, and its page's, come ahead
  useEffect(() => {
    if (!(at === 'planet' || at === 'cloudcity') || !canLand(current)) return;
    prefetchSurface();
    import('./GalaxySurface').catch(() => {});
  }, [at, current]);

  // what the scene says: to the comms, and to the page
  const onEvent = useCallback(
    (e) => {
      if (e.type === 'dove') {
        dove.current?.();
        dove.current = null;
        return;
      }
      if (e.type === 'map') {
        setMapOpen((o) => !o);
        return;
      }
      if (e.type === 'jumpKey') {
        setMapOpen(true);
        return;
      }
      if (e.type === 'jump') {
        // asked for under the Interdictor's hold: the panel says why not
        if (e.phase === 'held') {
          setBalked(true);
          clearTimeout(balk.current);
          balk.current = setTimeout(() => setBalked(false), 3000);
          return;
        }
        setJumping(e.phase === 'cancel' ? null : { to: e.to, phase: e.phase });
        if (e.phase === 'spool') comms.current?.handle({ type: 'event', id: 'jump' });
        return;
      }
      if (e.type === 'interdicted') {
        setHeld({ to: e.to });
        comms.current?.handle(e);
        return;
      }
      // clear of the Interdictor's well: the drive's back (a crash ends the hold too, but earns nothing)
      if (e.type === 'wellclear') {
        setHeld(null);
        setBalked(false);
        if (e.why === 'crash') return;
        unlock('interdicted');
        comms.current?.handle({ type: 'event', id: 'wellclear' });
        return;
      }
      if (e.type === 'tractor') {
        comms.current?.handle({ type: 'event', id: 'tractor' });
        return;
      }
      if (e.type === 'boarded') {
        comms.current?.handle({ type: 'event', id: 'boarded' });
        return;
      }
      if (e.type === 'action') {
        const s = systemById(current);
        if (e.id === 'deathstar') leave('/deathstar');
        else if ((e.id === 'planet' || e.id === 'cloudcity') && canLand(s.id)) land(s.id);
        else if (e.id === 'planet' || e.id === 'cloudcity') navigate(s.game.status === 'live' && s.game.to ? s.game.to : `/galaxy/${s.id}/mission`);
        return;
      }
      comms.current?.handle(e);
    },
    [current, leave, navigate, land, unlock],
  );
  const onArrive = useCallback(
    (id) => {
      setJumping(null);
      setAt(null);
      setCurrent(id);
      setWanted(id);
      seen.current = id;
      navigate(`/galaxy/${id}`, { replace: true });
    },
    [navigate],
  );
  const onBoard = useCallback((path) => leave(path), [leave]);

  // a course plotted on the map: away you go
  const jumpTo = (id) => {
    setMapOpen(false);
    audioContext();
    if (!view.current.jump(id)) navigate(`/galaxy/${id}`, { replace: true });
  };

  // Escape: shut the map, stop coming round for a jump or flying itself
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || leaving) return;
      if (mapOpen) {
        e.preventDefault();
        setMapOpen(false);
        return;
      }
      if (document.querySelector('[aria-modal="true"]')) return;
      if (view.current.escape()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapOpen, leaving]);

  // (every system's colour is light, readable on the dark page: so dark on a button)
  const accent = { '--accent': sys.accent, '--accent-text': sys.accent, '--btn-bg': sys.accent, '--btn-ink': '#03040a' };
  return (
    <div className="dark-scope universe-page galaxy-page" style={accent} data-tucked={tucked ? '' : undefined} data-card="" data-leaving={leaving ? (leaving.land ? 'land' : 'fade') : undefined} data-jumping={jumping?.phase} data-held={held ? '' : undefined}>
      <h1 className="sr-only">A galaxy far, far away: {sys.name}</h1>
      <p className="sr-only" aria-live="polite">
        {jumping ? `Jumping to ${systemById(jumping.to)?.name ?? 'lightspeed'}` : held ? `Interdicted short of ${systemById(held.to)?.name ?? sys.name}: an Imperial Interdictor's gravity well holds you` : `In the ${sys.system ?? sys.name} system`}
      </p>
      <GalaxyView
        system={wanted}
        here={current}
        handle={view}
        ship={ship}
        loadout={loadout}
        build={build}
        net={online.client}
        frozen={Boolean(leaving) || intro}
        onEvent={onEvent}
        onArrive={onArrive}
        onAt={setAt}
        onBoard={onBoard}
        onMap={() => setMapOpen(true)}
      />
      {crew && <Comms control={comms} crew={galaxyCrew(crew)} reduced={reduced} />}
      {!leaving && <Online online={online} ship={ship} />}
      <GalaxyPanel
        system={sys}
        at={at}
        ship={ship}
        onShip={pickShip}
        onMap={() => setMapOpen(true)}
        onGo={(id) => view.current.goTo(id)}
        onLeave={() => leave('/universe/starwars', { jump: true })}
        onBoard={(path) => leave(path)}
        onLand={canLand(sys.id) ? () => land(sys.id) : null}
        tucked={tucked}
        onTuck={tuck}
        jumping={jumping}
        held={held}
        balked={balked}
      />
      {mapOpen && <HoloMap current={current} online={online} onJump={jumpTo} onClose={() => setMapOpen(false)} onLeave={() => leave('/universe/starwars', { jump: true })} />}
      {intro && (
        <GalaxyIntro
          onDone={() => {
            try {
              window.sessionStorage.setItem(INTRO_KEY, '1');
            } catch {
              /* storage unavailable */
            }
            setIntro(false);
          }}
        />
      )}
      {ship && !leaving && !jumping && at && (at === 'planet' || at === 'cloudcity') && canLand(current) && (
        <button type="button" className="galaxy-land" onClick={() => land(current)}>
          <kbd>E</kbd> Land on {at === 'cloudcity' ? 'Cloud City' : sys.name}
        </button>
      )}
      {exit && <div className="galaxy-exit" aria-hidden="true" />}
      {leaving?.land && <div className="galaxy-entry" aria-hidden="true" />}
      {leaving?.dive && (
        <p className="galaxy-entry-note" role="status">
          Coming down through the atmosphere…
        </p>
      )}
      <div className="universe-fade" aria-hidden="true" style={{ background: '#000' }} />
    </div>
  );
}
