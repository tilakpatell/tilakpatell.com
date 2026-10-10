import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { local, useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { SHIP_KEY, crewById, parseShip } from '../components/universe/crews';
import { jumpEvent } from '../components/jumps/styles';
import { useShipyardPage } from '../components/universe/shipyard/useShipyardPage';
import { useAchievements } from '../components/Achievements';
import Comms from '../components/universe/Comms';
import Online from '../components/universe/online/Online';
import { useOnline } from '../components/universe/online/useOnline';
import EarnNote from '../components/universe/EarnNote';
import { useEarn } from '../components/universe/useEarn';
import { FIRST, parseSystem, systemById } from '../components/galaxy/systems';
import { canLand } from '../components/galaxy/surface/sites';
import { starfighterAt } from '../components/galaxy/surface/missions/starfighterMaps';
import galaxyModule from '../components/galaxy/module';
import surfaceModule from '../components/galaxy/surface/module';
import { prefetchSurface, surfaceProps } from '../components/galaxy/travel';
import { runtime, usePrepareProgress } from '../runtime';
import LoadingVeil from '../components/worlds/LoadingVeil';
import { usePrepareWait } from '../components/worlds/usePrepareWait';
import { galaxyCrew } from '../components/galaxy/lines';
import { battleSay } from '../components/galaxy/warVoice';
import { groundEffects } from '../components/galaxy/siteWar';
import { mine, onWar, warNow } from '../components/galaxy/warState';
import { SIDE_KEY, current as currentOath, readAllegiance, setTheatre, suggestSide, swear } from '../components/galaxy/allegiance';
import { HERO_KEY, readHero } from '../components/galaxy/heroes';
import { RANKS, rankOf } from '../components/galaxy/ranks';
import GalaxyView from '../components/galaxy/GalaxyView';
import GalaxyPanel from '../components/galaxy/GalaxyPanel';
import { holdJump } from '../components/hyperspace3d/timeline';
import HoloMap from '../components/galaxy/HoloMap';
import { readFound } from '../components/galaxy/places';
import GalaxyIntro from '../components/galaxy/GalaxyIntro';
import '../components/galaxy/galaxy.css';
import { thud } from '../lib/sfx';
import { createImpacts } from '../lib/impact';

// the Shipyard (the universe map's own), in its own chunk: opened with H
const Shipyard = lazy(() => import('../components/universe/shipyard/Shipyard'));
// a bump's and a crash's thud, by the hit law (lib/impact.js)
const knockLaw = createImpacts();

const FOUND_KEY = 'tp-galaxy-found'; // the places found out in the open, per system (places.js; the scene writes it)
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
  const view = useRef({ live: false, jump: () => false, goTo: () => false, flyTo: () => false, starfighter: () => false, escape: () => false, dive: () => false, host: () => null });
  const comms = useRef(null);
  const [ship, setShip] = useState(() => parseShip(local.get(SHIP_KEY)));
  const crew = crewById(ship);
  const online = useOnline();
  const { setKind, setLoadout, setBuild: tellBuild } = online;
  useEffect(() => setKind(ship), [setKind, ship]);
  // flying to another pilot in this system (the roster's “Fly to”, or its
  // “Go” from another page: useOnline's follow): once the ship's in and
  // they're flying here in sight, the autopilot takes it to them (the
  // scene's flyTo). Tried till it goes; the trip's end, or the follow's
  // own minute, forgets it. The HUD's line says how it ended: the name is
  // React's text, never markup
  const { followId, follow } = online;
  const followRef = useRef(null); // the pilot whose trip is under way
  const [pilotNote, setPilotNote] = useState(null);
  const noteTimer = useRef(0);
  useEffect(() => () => clearTimeout(noteTimer.current), []);
  const notePilot = useCallback((text) => {
    clearTimeout(noteTimer.current);
    setPilotNote(text);
    noteTimer.current = setTimeout(() => setPilotNote(null), 3500);
  }, []);
  useEffect(() => {
    if (!followId || !ship) return undefined;
    const go = () => {
      if (followRef.current === followId) return true;
      if (!view.current.live || !view.current.flyTo(followId)) return false;
      followRef.current = followId;
      return true;
    };
    if (go()) return undefined;
    const t = setInterval(() => go() && clearInterval(t), 500);
    return () => clearInterval(t);
  }, [followId, ship]);
  useEffect(() => {
    if (!followId) followRef.current = null;
  }, [followId]);
  // a battle asked for by the link (the landing menu's Starfighter Assault,
  // the briefing's card: /galaxy/endor?battle=starfighter&side=rebel): once
  // the scene's in the system, the space level's battle there in place of
  // the war's (surface/missions/starfighterMaps.js says where there's one).
  // Tried till it goes, then dropped from the link, so a reload's the war again
  const [query, setQuery] = useSearchParams();
  const asked = query.get('battle');
  const askedSide = query.get('side');
  useEffect(() => {
    if (asked !== 'starfighter' || !starfighterAt(current)) return undefined;
    const go = () => {
      if (!view.current.live || !view.current.starfighter(current, { side: askedSide })) return false;
      setQuery({}, { replace: true });
      return true;
    };
    if (go()) return undefined;
    const t = setInterval(() => go() && clearInterval(t), 500);
    return () => clearInterval(t);
  }, [asked, askedSide, current, setQuery]);
  // the wallet (economy.js): the war's points and wins pay into it, and an alliance made
  const { pay, note: earned } = useEarn({ client: online.client });
  // the ship as it's fitted in the universe map's hangar: its paint and parts
  const { unlocked, unlock } = useAchievements();
  // the oath (allegiance.js): which war you fight in and the side you swore
  // to in it, kept for the campaign; the scene, the holotable and the panel
  // all read it
  const [oathKept, setOathKept] = useState(() => readAllegiance(local.get(SIDE_KEY)));
  const oath = useMemo(() => currentOath(oathKept), [oathKept]);
  const keepOath = useCallback((next) => {
    setOathKept(next);
    local.set(SIDE_KEY, next);
    window.dispatchEvent(new Event('tp:oath')); // (your hello says it: useOnline.js)
  }, []);
  const onSwear = useCallback(
    (side) => {
      const next = swear(oathKept, side);
      if (next === oathKept) return;
      keepOath(next);
      unlock('gcwSworn');
      if (currentOath(next).turncoat) unlock('gcwTurncoat');
    },
    [oathKept, keepOath, unlock],
  );
  const onTheatre = useCallback((war) => keepOath(setTheatre(oathKept, war)), [oathKept, keepOath]);
  const suggested = useMemo(() => suggestSide({ crew: ship, hero: readHero(local.get(HERO_KEY), ship ?? 'xwing').id }, oath.war), [ship, oath.war]);
  // (for the checks: swear and pick the war from a browser)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__galaxyOath = { swear: onSwear, theatre: onTheatre, get: () => oath };
    return () => delete window.__galaxyOath;
  }, [onSwear, onTheatre, oath]);
  // the war's achievements: a system you fought for turned your side's, the top rank
  const owners = useRef(null);
  useEffect(() => {
    const check = () => {
      if (!oath.side) return;
      const now = Date.now();
      const table = warNow(now, oath.war);
      const record = mine(oath.war, now);
      if (rankOf(oath.side, record.points)?.id === RANKS[oath.side].at(-1).id) unlock('gcwAdmiral');
      const was = owners.current;
      owners.current = Object.fromEntries(table.systems.map((r) => [r.id, r.owner]));
      if (was && record.systems.some((x) => was[x.id] && was[x.id] !== oath.side && owners.current[x.id] === oath.side)) unlock('gcwLiberator');
    };
    check();
    const id = setInterval(check, 5000);
    const off = onWar(check);
    return () => (clearInterval(id), off());
  }, [oath.side, oath.war, unlock]);
  // the ship as it's fitted, and the hull it flies: stock, or its garage build; and the Shipyard (H) that changes them, which is the
  // universe map's, with the same saves (shipyard/useShipyardPage.js)
  const { loadout, build, tune, garage, dropped, yard, setYard, applyDraft, sellPart, yardNote, live, yardSaves } = useShipyardPage({ ship, unlocked });
  useEffect(() => setLoadout(loadout), [setLoadout, loadout]);
  useEffect(() => tellBuild?.(build), [tellBuild, build]);
  const [at, setAt] = useState(null); // what in the system you're at (its planet, the Death Star…)
  // the places found out in the open here (places.js; the scene keeps the store, and says when one's new)
  const [founds, setFounds] = useState(() => readFound(local.get(FOUND_KEY)));
  const found = founds[current] ?? [];
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
  // what a pickup gave, said for a moment over the flight cluster (the scene's 'pickup' event: pickups.js's name and line)
  const [pickupNote, setPickupNote] = useState(null);
  const pickupTimer = useRef(0);
  useEffect(() => () => clearTimeout(pickupTimer.current), []);
  const notePickup = useCallback((text) => {
    clearTimeout(pickupTimer.current);
    setPickupNote(text);
    pickupTimer.current = setTimeout(() => setPickupNote(null), 2200);
  }, []);
  // The Shipyard's doors (its corner button, the panel's link and H) all come through here: shut under the galaxy map, while a jump is
  // on and in the first moments. Open, it holds the scene still, so a jump that begins under it (the course, a star, a link asked for)
  // shuts it: otherwise the jump would stall behind it.
  const openYard = useCallback(
    (on) => {
      if (on && (mapOpen || jumping || intro || leaving)) return;
      setYard(on);
    },
    [setYard, mapOpen, jumping, intro, leaving],
  );
  useEffect(() => {
    if (jumping && yard) setYard(false);
  }, [jumping, yard, setYard]);

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
  // the course plotted on the galaxy map (a system's id, or none): the flight HUD points the way and J jumps to it
  const [course, setCourse] = useState(null);
  useEffect(() => setCourse(null), [current]);
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
      if (jump) window.dispatchEvent(jumpEvent(crew?.jump)); // (the crew's own way: Rick's portal, the RV's Blue Sky)
      timer.current = setTimeout(() => navigate(to), jump ? 1250 : land ? 1500 : 650);
    },
    [leaving, navigate, crew],
  );
  // Flown into the planet: the crash plays, and then you're down on its
  // surface, the screen washing out in the system's colour on the way (as
  // the universe map does it: pages/Universe.jsx's crashInto). True when
  // there's a surface to go down to; otherwise the scene puts you back
  const onCrash = useCallback(
    (id) => {
      if (!id || !canLand(id) || leaving) return false;
      prefetchSurface();
      const to = `/galaxy/${id}/surface`;
      setLeaving({ to, crash: true });
      timer.current = setTimeout(() => navigate(to), 700);
      return true;
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
  const landing = usePrepareProgress(surfaceModule); // (the surface's prepare, for Land's loading screen)
  const landingWait = usePrepareWait(surfaceModule, landing, Boolean(leaving?.prep)); // (and why, once it holds)
  const land = useCallback(
    (id) => {
      if (!canLand(id) || leaving) return;
      audioContext();
      prefetchSurface();
      const to = `/galaxy/${id}/surface`;
      const host = view.current.live ? view.current.host?.() : null;
      if (!host) {
        leave(to, { land: true });
        return;
      }
      // the surface made and sent to the graphics chip first, behind the
      // landing's loading screen, with the ship holding where it is; then the
      // dive, which has nothing left to load (built behind it, the dive
      // stopped for a second or more)
      setLeaving({ to, prep: true });
      const after = new Promise((r) => (dove.current = r));
      const onBuilt = () => {
        if (!alive.current) return;
        setLeaving({ to, land: true, dive: true });
        if (!view.current.dive()) dove.current?.(); // (a dive it can't make: straight down)
        timer.current = setTimeout(() => dove.current?.(), DIVE_MAX); // (a dive that never ends still lands)
      };
      runtime()
        .handover(surfaceModule, surfaceProps(id, { ship, loadout, build, net: online.client, reduced, effects: groundEffects(id, oathKept, Date.now()) }), host, { fade: 900, held: true, after, onBuilt })
        .catch(() => false)
        .then(() => after)
        .then(() => {
          if (!alive.current) return; // (gone elsewhere meanwhile: not this page's to steer)
          navigate(to); // (not handed over: the page makes its own)
        });
    },
    [leave, leaving, navigate, ship, loadout, build, online.client, reduced, oathKept],
  );
  // near a planet you can land on: the surface's code, and its page's, come ahead
  useEffect(() => {
    if (!(at === 'planet' || at === 'cloudcity') || !canLand(current)) return;
    prefetchSurface();
    import('./GalaxySurface').catch(() => {});
  }, [at, current]);

  // The jump to lightspeed between systems is the site's own (App's
  // Hyperspace, the same as the universe map's): played over the scene from
  // the moment the ship spools up, held in its tunnel while the next system's
  // built and the light-years flown, let go when the scene comes out of it
  // (or the Empire's Interdictor pulls it out short).
  const jumpHold = useRef(null);
  const letGo = () => {
    jumpHold.current?.();
    jumpHold.current = null;
  };
  useEffect(() => letGo, []);

  // a course plotted on the map, or J with one: away you go. The scene may refuse (an Interdictor's hold, a crash, a dive: it says why
  // itself, and the map and the course stay as they are); only with no scene to ask is the system's page opened
  const jumpTo = useCallback(
    (id) => {
      audioContext();
      if (view.current.live) {
        if (!view.current.jump(id)) return;
      } else navigate(`/galaxy/${id}`, { replace: true });
      setMapOpen(false);
      setCourse(null);
    },
    [navigate],
  );

  // what the scene says: to the comms, and to the page
  const onEvent = useCallback(
    (e) => {
      if (e.type === 'earn') {
        pay(e.what, e.n, e.side ?? 'galaxy');
        return;
      }
      // a trip to a pilot over: with them, gone, or given up; the follow's done
      if ((e.type === 'arrived' || e.type === 'lost') && typeof e.id === 'string' && e.id.startsWith('pilot:')) {
        if (e.type === 'lost') notePilot(`${e.name ?? 'They'} ${e.name ? 'has' : 'have'} gone`);
        else if (e.done) notePilot(`With ${e.name ?? 'them'}`);
        if (followRef.current && e.id === `pilot:${followRef.current}`) follow(null);
        return;
      }
      if (e.type === 'pickup') {
        notePickup(`${e.name} · ${e.line}`);
        return;
      }
      if (e.type === 'dove') {
        dove.current?.();
        dove.current = null;
        return;
      }
      // (the Shipyard's open: its own keys are the ones that count, and the map and the jump wait)
      if (yard && (e.type === 'map' || e.type === 'jumpKey')) return;
      if (e.type === 'map') {
        setMapOpen((o) => !o);
        return;
      }
      if (e.type === 'jumpKey') {
        // J with the nose on no star: to the course plotted on the map, if there is one, else the map to plot it on
        if (course && course !== current) jumpTo(course);
        else setMapOpen(true);
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
        if (e.phase === 'align') setCourse(null); // (a jump's begun, to the course or not: the plotted course is spent)
        setJumping(e.phase === 'cancel' || e.phase === 'out' ? null : { to: e.to, phase: e.phase });
        if (e.phase === 'spool') {
          letGo();
          jumpHold.current = holdJump();
          window.dispatchEvent(new Event('tp:hyperspace'));
          comms.current?.handle({ type: 'event', id: 'jump' });
        } else if (e.phase === 'out') letGo();
        return;
      }
      if (e.type === 'interdicted') {
        setHeld({ to: e.to });
        comms.current?.handle(e);
        return;
      }
      // clear of the Interdictor's well: the drive's back (a crash ends the hold too, but earns nothing)
      if (e.type === 'find') {
        setFounds(readFound(local.get(FOUND_KEY)));
        return;
      }
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
      // a moment of the war's battle: the commander on the comms, then the crew (warVoice.js)
      if (e.type === 'event' && e.id === 'battle') {
        const record = mine(e.war);
        if (e.sub === 'won' && record.major) unlock('gcwMajor');
        const lines = battleSay(e, crew?.id, record);
        if (lines.length) comms.current?.handle({ type: 'lines', lines });
        return;
      }
      if (e.type === 'action') {
        const s = systemById(current);
        if (e.id === 'deathstar') leave('/deathstar');
        else if ((e.id === 'planet' || e.id === 'cloudcity') && canLand(s.id)) land(s.id);
        else if (e.id === 'planet' || e.id === 'cloudcity') navigate(s.game.status === 'live' && s.game.to ? s.game.to : `/galaxy/${s.id}/mission`);
        return;
      }
      // a knock as hard as it was (galaxy/mapFeel.js's force, the hit law's gain)
      if ((e.type === 'bump' || e.type === 'crash') && e.force) {
        const k = knockLaw.hit(e.force, e.type);
        if (k) thud({ gain: k.gain, pitch: k.pitch });
      }
      comms.current?.handle(e);
    },
    [current, leave, navigate, land, unlock, crew, pay, notePilot, notePickup, follow, course, jumpTo, yard],
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

  // Escape: stop coming round for a jump or flying itself (the map has its own
  // Escape, HoloMap.jsx: it takes the key first, and a dialog open stands this down)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || leaving) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (view.current.escape()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaving]);

  // (every system's colour is light, readable on the dark page: so dark on a button)
  const accent = { '--accent': sys.accent, '--accent-text': sys.accent, '--btn-bg': sys.accent, '--btn-ink': '#03040a' };
  return (
    <div className="dark-scope universe-page galaxy-page" style={accent} data-tucked={tucked ? '' : undefined} data-card="" data-leaving={leaving && !leaving.prep ? (leaving.land ? 'land' : leaving.crash ? 'crash' : 'fade') : undefined} data-jumping={jumping?.phase} data-held={held ? '' : undefined}>
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
        tune={tune}
        net={online.client}
        frozen={Boolean(leaving) || intro || yard}
        hangar={yard}
        onHangar={jumping ? null : openYard}
        onEvent={onEvent}
        onArrive={onArrive}
        onAt={setAt}
        found={found}
        onBoard={onBoard}
        onCrash={onCrash}
        onMap={() => setMapOpen(true)}
        oath={oath}
        course={course}
      />
      {crew && <Comms control={comms} crew={galaxyCrew(crew)} reduced={reduced} />}
      <EarnNote note={yardNote ?? earned} />
      {ship && !leaving && (
        <Suspense fallback={null}>
          <Shipyard
            open={yard}
            onOpen={openYard}
            enabled={yard || (!mapOpen && !jumping && !intro)}
            ship={ship}
            shipName={crew?.ship ?? ''}
            live={live}
            lastBuild={garage[ship] || null}
            saves={yardSaves}
            dropped={dropped}
            onApply={applyDraft}
            onSell={sellPart}
            hint="Secondary and ordnance fire on the universe map; here the crew’s powers take their place."
          />
        </Suspense>
      )}
      {pilotNote && !leaving && (
        <p className="universe-prompt galaxy-note" data-on="" data-plain="" role="status">
          {pilotNote}
        </p>
      )}
      {pickupNote && !leaving && (
        <p className="galaxy-pickup-note" role="status">
          {pickupNote}
        </p>
      )}
      {!leaving && <Online online={online} ship={ship} />}
      <GalaxyPanel
        system={sys}
        at={at}
        ship={ship}
        onShip={pickShip}
        onHangar={ship && !jumping ? () => openYard(true) : null}
        onMap={() => setMapOpen(true)}
        onGo={(id) => view.current.goTo(id)}
        onLeave={() => leave('/universe/starwars', { jump: true })}
        found={found}
        onBoard={(path) => leave(path)}
        onLand={canLand(sys.id) ? () => land(sys.id) : null}
        tucked={tucked}
        onTuck={tuck}
        jumping={jumping}
        held={held}
        balked={balked}
        oath={oath}
        suggested={suggested}
        onSwear={onSwear}
      />
      {mapOpen && <HoloMap current={current} online={online} onJump={jumpTo} onCourse={setCourse} course={course} onClose={() => setMapOpen(false)} onLeave={() => leave('/universe/starwars', { jump: true })} oath={oath} oaths={oathKept.oaths} suggested={suggested} onSwear={onSwear} onTheatre={onTheatre} />}
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
      {/* (the surface getting ready before the dive: Land's loading screen) */}
      <LoadingVeil shown={Boolean(leaving?.prep)} progress={landing.value} step={landing.step} title={`Preparing to land on ${sys.name}`} waiting={landingWait.waiting} onSkip={landingWait.onSkip} />
      {leaving?.land && <div className="galaxy-entry" aria-hidden="true" />}
      {leaving?.dive && (
        <p className="galaxy-entry-note" role="status">
          Coming down through the atmosphere…
        </p>
      )}
      <div className="universe-fade" aria-hidden="true" style={{ background: leaving?.crash ? sys.accent : '#000' }} />
    </div>
  );
}
