import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { local, useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { byId } from '../components/universe/universes';
import { parseId } from '../components/universe/layout';
import { beyondPlan, crashPlan, enterPlan } from '../components/universe/flight';
import { beyondOf, parseWonder } from '../components/universe/deep';
import { DRIVE_KEY, destinationById, distanceTo, parseDrive, tourFrom } from '../components/universe/nav';
import { FLY_PAST } from '../components/universe/words';
import { SHIP_KEY, crewById, parseShip } from '../components/universe/crews';
import { useShipyardPage } from '../components/universe/shipyard/useShipyardPage';
import { useAchievements } from '../components/Achievements';
import { saveStart } from '../lib/view';
import { useView } from '../components/ViewSwitch';
import { portalSound } from '../components/universe/sounds';
import { jumpEvent } from '../components/jumps/styles';
import { jumpOut } from '../components/jumps/jumpOut';
import UniverseMap from '../components/universe/UniverseMap';
import UniversePanel from '../components/universe/UniversePanel';
import Comms from '../components/universe/Comms';
import StartChoice from '../components/universe/StartChoice';
import Rain from '../components/universe/Rain';
import Online from '../components/universe/online/Online';
import Wardrobe from '../components/rickmorty/wardrobe/Wardrobe';
const Shipyard = lazy(() => import('../components/universe/shipyard/Shipyard'));
import { useLooks } from '../components/rickmorty/wardrobe/useLooks';
import { CASTS, castOfCrew } from '../components/rickmorty/wardrobe/looks';
import { useOnline } from '../components/universe/online/useOnline';
import EarnNote from '../components/universe/EarnNote';
import { useEarn } from '../components/universe/useEarn';
import { goodStanding } from '../components/universe/economy';
import { createPayLedger } from '../components/universe/earnRules';
import { pocketOf, registerPocket } from '../components/expanse/pocket';
import { createRegistry } from '../components/worlds/registry';
import { worldStore } from '../runtime';

const PORTAL = '#97ce4c';
// the phone out past the belt (universe/phone.js): its lock screen, fetched
// only when it's picked up, and the saffron wash into what it unlocks
const PhoneOverlay = lazy(() => import('../components/dickansh/PhoneOverlay'));
// (the nav map, M: fetched the first time it opens)
const NavMap = lazy(() => import('../components/universe/NavMap'));
const SAFFRON = '#ff9a2a';
const PHONE_MS = 700;
const PANEL_KEY = 'tp-universe-panel'; // 'tucked' once the panel's been put away
// (the page you go into knows you came from the map, so its way out can be
// back to space: the Citadel's)
const FROM_MAP = { state: { from: 'universe' } };

// The galaxy's page and its scene, fetched once its gate is picked or
// flown into, so the jump into it isn't waiting on them (App.jsx loads the
// page lazily, and the page its scene), as galaxy/travel.js fetches a
// world's surface on the way down to it.
let galaxyFetched = null;
const prefetchGalaxy = () => (galaxyFetched ??= Promise.all([import('./Galaxy'), import('../components/galaxy/scene')]).catch(() => (galaxyFetched = null)));

// The universe map: every fandom on the site is a planet, and you travel
// between them, flying a ship of your choice (remembered between visits,
// each fitted out in the hangar its own way: outfit.js) or letting the
// camera take you. The URL is the selection (/universe/marvel),
// swapped in place so a link shares the view and Back leaves the map in one
// press. The page accent follows the selected universe, so the panel
// recolours as you go. Fly into a planet too fast and the crash takes you
// into its page; fall into the black hole out in deep space and you're
// through to a friend's universe, their own site (deep.js's `beyond`).
// Gone online (online/), everyone else flying it right then is there too,
// in their own ships: allies, or fair game. The nav map (M, or its button:
// NavMap.jsx) charts it all and sends you anywhere by the drive picked
// there (nav.js: hyperspeed, super speed or cruise; kept between visits),
// which is how picking a place anywhere else on the page goes too.
export default function Universe({ ask = false }) {
  const { pathname, search } = useLocation();
  const atRoot = pathname === '/';
  // a pocket universe (/universe?seed=marble): the Expanse past the rim made
  // from its own seed, and kept on /worlds (expanse/pocket.js)
  const pocketWord = pocketOf(search).word;
  const pocket = useMemo(() => pocketOf(`?seed=${encodeURIComponent(pocketWord)}`), [pocketWord]);
  useEffect(() => {
    if (pocket.pocket) registerPocket(createRegistry(worldStore()), pocket).catch(() => {});
  }, [pocket]);
  useDocumentTitle(atRoot ? null : 'The universe'); // the front door keeps the site's own title
  const navigate = useNavigate();
  const param = useParams().id;
  const selected = parseId(param);
  const selectedRef = useRef(selected); // (for the scene's events, which keep their first render's closure)
  selectedRef.current = selected;
  const universe = byId(selected);
  // a link out to a wonder (/universe/aurelia): the ship starts parked beside it, and the panel shows it
  const wonder = parseWonder(param);
  const wonderDest = wonder ? destinationById(wonder) : null;
  const reduced = useReducedMotion();
  const map = useRef({ live: false, dive: () => 0, escape: () => false, whole: () => false, travel: () => false, where: () => null }); // the 3D map, while it's drawing
  const comms = useRef(null);
  const [ship, setShip] = useState(() => parseShip(local.get(SHIP_KEY)));
  const crew = crewById(ship);
  const online = useOnline(); // (OnlineProvider, above the pages: the link stays up off the map)
  const { setKind, setLoadout, setBuild: tellBuild } = online;
  useEffect(() => setKind(ship), [setKind, ship]);
  // the wallet (economy.js): what the scene pays for, a good standing
  // reached and an alliance made earn into it, with a note over the HUD
  const { pay, note: earned } = useEarn({ client: online.client });
  // (a level is paid for once a visit: lost and won back with a shot at the
  // law and a hunter down, it's no living)
  const [stood] = useState(createPayLedger);
  // what each ship's fitted with in the hangar (kept between visits): the
  // paint job and parts it flies with, while they're still earned
  const { unlocked, unlock } = useAchievements();
  // (the loadouts, hulls and garage builds, the Shipyard's door and what Apply and a sale do: shipyard/useShipyardPage.js, which the galaxy uses too)
  const { loadout, build, tune, garage, dropped, yard, setYard, applyDraft, sellPart, yardNote, live, yardSaves } = useShipyardPage({ ship, unlocked });
  useEffect(() => setLoadout(loadout), [setLoadout, loadout]);
  useEffect(() => tellBuild?.(build), [tellBuild, build]);
  // the wardrobe, from the shipyard: how the cruiser’s Rick and Morty look,
  // or the RV’s Walt and Jesse (whichever crew’s flying)
  const [looks, setLook] = useLooks();
  const dressing = castOfCrew(ship) ?? 'rickmorty';
  const [wardrobe, setWardrobe] = useState(false);
  const closeWardrobe = useCallback(() => setWardrobe(false), []);
  // the nav map, and the drive picked on it (kept between visits)
  const [charting, setCharting] = useState(false);
  const [phone, setPhone] = useState(false); // the phone out past the belt, picked up: its lock screen
  const [drive, setDriveState] = useState(() => parseDrive(local.get(DRIVE_KEY)));
  const driveRef = useRef(drive); // (for the tour's later legs: the drive as it is then)
  driveRef.current = drive;
  const setDrive = (d) => {
    const next = parseDrive(d);
    setDriveState(next);
    local.set(DRIVE_KEY, next);
  };
  const jumped = useRef(false); // the crew's had their say about a jump this visit
  const [leaving, setLeaving] = useState(null); // { id, mode } once Enter is pressed
  const [asking, setAsking] = useState(ask); // the front door's choice, on a first arrival
  // the panel, put away to give the map the room (remembered between visits)
  const [tucked, setTucked] = useState(() => local.get(PANEL_KEY) === 'tucked');
  const tuck = (on) => {
    setTucked(on);
    local.set(PANEL_KEY, on ? 'tucked' : 'open');
  };
  const timer = useRef(0);
  const trip = useRef(null); // a jump out (jumps/jumpOut.js): this page gone first, its dark coming late changes nothing
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      trip.current?.cancel();
    },
    [],
  );
  // a trip on through the gate: to a star system picked on the nav map, the
  // ship flies to the gate, and when it parks there the page goes on in
  const onward = useRef(null); // { via, to }
  // the grand tour (nav.js's tourFrom): every place in turn, the crew talking
  const tour = useRef(null); // { ids, i, timer }
  const [touring, setTouring] = useState(null); // { i, n, next } for the pill
  const stopTour = useCallback(() => {
    if (!tour.current) return;
    clearTimeout(tour.current.timer);
    tour.current = null;
    setTouring(null);
  }, []);
  useEffect(() => () => clearTimeout(tour.current?.timer), []);

  // flying to another pilot (the roster's “Fly to”, or its “Go” from
  // another page: useOnline's follow): once the ship's in and they're
  // flying here in sight, the autopilot takes it to them (scene.js's
  // `pilot:<id>`, by the drive picked). Tried till it goes; the trip's end
  // (there, gone, or the stick taken back) or the follow's own minute
  // forgets it
  const { followId, follow } = online;
  const followRef = useRef(null); // the pilot whose trip is under way
  useEffect(() => {
    if (!followId || !ship) return undefined;
    const go = () => {
      if (followRef.current === followId) return true;
      if (!map.current.live || !map.current.travel(`pilot:${followId}`, driveRef.current)) return false;
      followRef.current = followId;
      stopTour();
      onward.current = null;
      setCharting(false);
      return true;
    };
    if (go()) return undefined;
    const t = setInterval(() => go() && clearInterval(t), 500);
    return () => clearInterval(t);
  }, [followId, ship, stopTour]);
  useEffect(() => {
    if (!followId) followRef.current = null;
  }, [followId]);

  // out of the cockpit's launch (App's intro, or ⌘K's replay): flying the
  // ship it was, with no question first. Sat down in the cockpit with no
  // ship yet (a first visit), that one's made under it as you sit there
  // (tp:board, again if you change seats), so the flash comes out on a
  // ship that's ready; a replay keeps the ship it's flying until the flash.
  const boarding = useRef(false);
  const flyingNow = useRef(ship);
  flyingNow.current = ship;
  useEffect(() => {
    const arrive = (e) => {
      boarding.current = false;
      const id = parseShip(e.detail?.ship);
      if (id) setShip(id);
      setAsking(false);
    };
    const board = (e) => {
      const id = parseShip(e.detail?.ship);
      if (!id || (flyingNow.current && !boarding.current)) return;
      boarding.current = true;
      setShip(id);
      setAsking(false);
    };
    window.addEventListener('tp:arrive', arrive);
    window.addEventListener('tp:board', board);
    return () => {
      window.removeEventListener('tp:arrive', arrive);
      window.removeEventListener('tp:board', board);
    };
  }, []);

  // (not once the page is on its way out: the scene's last word as it's torn
  // down, or a key pressed on the way, mustn't pull the address back to the
  // map from the page it's leaving for)
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);
  const select = useCallback(
    (id) => {
      if (gone.current) return;
      navigate(id ? `/universe/${id}` : '/universe', { replace: true });
    },
    [navigate],
  );
  // the Star Wars gate picked: the galaxy behind it fetched while you fly there
  const toGalaxy = Boolean(universe?.to?.startsWith('/galaxy'));
  useEffect(() => {
    if (toGalaxy) prefetchGalaxy();
  }, [toGalaxy]);

  const pickShip = (id) => {
    audioContext(); // inside the press, so the engine can start
    setShip(id);
    local.set(SHIP_KEY, id);
  };

  // into a place: the selected one (Enter, E), or a station whose sign was
  // clicked (`to`: somewhere inside it to go on to, a star system through the gate)
  const go = (u, to = u?.to) => {
    if (!u || leaving) return;
    setCharting(false);
    stopTour();
    const plan = enterPlan(u, { reduced, three: map.current.live, ship });
    if (plan.mode === 'now') {
      navigate(to, FROM_MAP);
      return;
    }
    audioContext(); // inside the press, so the way out can sound
    setLeaving({ id: u.id, mode: plan.mode });
    if (plan.mode === 'jump') {
      // the page changes under the jump's dark. Into the galaxy, its page
      // and scene are fetched now, and the jump's tunnel is held from the
      // change until the galaxy has drawn, so it clears onto the galaxy,
      // not its loading line
      const galaxy = Boolean(to?.startsWith('/galaxy'));
      if (galaxy) prefetchGalaxy();
      trip.current = jumpOut({ style: crew?.jump, to, navigate: (page) => navigate(page, FROM_MAP), hold: galaxy, delay: plan.delay });
      return;
    }
    if (plan.mode === 'portal') portalSound();
    map.current.dive(u.id);
    timer.current = setTimeout(() => navigate(to, FROM_MAP), plan.delay);
  };
  const enter = () => go(universe);
  // the phone unlocked: the Dickansh and Deekbeggers Universe (its page keeps
  // the password the lock screen kept for it)
  const unlockPhone = () => {
    setPhone(false);
    if (leaving) return;
    setCharting(false);
    stopTour();
    if (reduced || !map.current.live) {
      navigate('/dickansh');
      return;
    }
    audioContext();
    portalSound();
    setLeaving({ id: 'phone', mode: 'phone' });
    timer.current = setTimeout(() => navigate('/dickansh'), PHONE_MS);
  };
  // the nav map's "straight in" for a system: the gate's jump, then the system
  const enterDest = (id) => {
    const d = destinationById(id);
    if (d?.via) go(byId(d.via), d.to);
    else go(byId(id));
  };

  // flown into a planet or a station too fast: once the crash has played,
  // on into its page, the screen washing out in its colour (true tells the
  // map the ship isn't coming back; the sun, with no page, sends it back).
  // Fallen into the black hole: on through to what's on its far side, a
  // friend's universe (deep.js's `beyond`), the screen going black on the
  // way, and the site left behind (Back brings you home)
  const crashInto = (id, page = null) => {
    if (leaving) return false;
    const far = beyondOf(id);
    if (far) {
      const plan = beyondPlan({ reduced });
      setLeaving({ id, mode: plan.mode });
      timer.current = setTimeout(() => window.location.assign(far.url), plan.delay);
      return true;
    }
    const u = byId(id);
    const plan = crashPlan(u, { reduced });
    if (!plan) return false;
    setLeaving({ id: u.id, mode: plan.mode });
    // (a wonder with a page of its own, the Citadel, goes there)
    timer.current = setTimeout(() => navigate(page ?? u.crashTo ?? u.to, FROM_MAP), plan.delay);
    return true;
  };

  // the front door's choice: fly, or the home page; kept if asked to
  const start = (where, remember) => {
    if (remember) saveStart(where);
    if (where === 'home') navigate('/home');
    else setAsking(false);
  };
  const { switchTo } = useView();

  const whole = () => {
    if (!map.current.whole()) select(null);
  };

  // what the scene says: the nav map (M), a jump to lightspeed (the site's
  // own jump plays over the map, or the crew's own way across it, Rick's
  // portal or the RV's Blue Sky: the scene has the ship out at the place
  // under its flash either way), through a gate, or something for the crew to say
  const onEvent = (e) => {
    if (e.type === 'earn') {
      pay(e.what, e.n, e.side);
      return;
    }
    // (the hello says what you are to the others: useOnline.js reads it again)
    if (e.type === 'event' && e.id === 'standing') window.dispatchEvent(new Event('tp:standing'));
    if (e.type === 'event' && e.id === 'standing' && goodStanding(e.sub) && stood.once(`${e.side}:${e.sub}`)) pay('standingUp', 1, e.side);
    // a trip to a pilot over (with them, gone, or the stick taken back): the follow's done
    if ((e.type === 'arrived' || e.type === 'jumped' || e.type === 'lost') && followRef.current && e.id === `pilot:${followRef.current}`) follow(null);
    // a trip ended: on through the gate, or the tour's next leg
    if (e.type === 'arrived' || e.type === 'jumped') {
      const done = e.type === 'jumped' || e.done;
      // the trip on through the gate: only an arrival at the gate goes on; any other trip ending forgets it
      const on = onward.current;
      if (on) {
        onward.current = null;
        if (e.id === on.via && done) go(byId(on.via), on.to);
      }
      const t = tour.current;
      if (t && e.id === t.ids[t.i]) {
        if (!done) stopTour();
        else if (t.i + 1 >= t.ids.length) {
          unlock('grandtour');
          stopTour();
        } else {
          const next = t.ids[t.i + 1];
          setTouring({ i: t.i + 1, n: t.ids.length, next: destinationById(next)?.name ?? next });
          t.timer = setTimeout(() => {
            if (tour.current !== t) return;
            // (still parked where it arrived? a pilot who flew off in the meantime has the stick)
            const w = map.current.where?.();
            if (!w?.ship || (distanceTo(w.ship, t.ids[t.i]) ?? Infinity) > 80) return stopTour();
            t.i += 1;
            if (!travel(next, driveRef.current, { tour: true })) stopTour();
          }, 6000);
        }
      }
    } else if (e.type === 'crash' || e.type === 'destroyed' || e.type === 'rifted') {
      onward.current = null;
      stopTour();
    }
    if (e.type === 'map') setCharting((o) => !o);
    else if (e.type === 'jump') {
      window.dispatchEvent(jumpEvent(crew?.jump));
      if (!jumped.current) {
        jumped.current = true;
        comms.current?.handle({ type: 'event', id: 'hyperspeed' });
      }
    } else if (e.type === 'portal') go(byId(e.id));
    else if (e.type === 'phone') {
      if (e.what === 'open') setPhone(true);
    }
    else if (e.type === 'siege' && e.what === 'down' && e.mine) {
      unlock('citadelfall'); // (you helped bring it down)
      comms.current?.handle(e);
    } else if (e.type === 'rifted') unlock('rifted'); // (the crew's line comes as an event of its own)
    else if (e.type === 'sector') {
      // through a portal into the other sector of the map: a place picked on
      // this side is let go (a trip on through it picked where it's going)
      const sel = selectedRef.current;
      if (sel && destinationById(sel)?.sector !== e.id) select(null);
      comms.current?.handle(e);
    }
    else if (e.type === 'event' && e.id === 'removerDown') {
      unlock('remover'); // (the NX-5 shot down before it fired)
      comms.current?.handle(e);
    }
    else {
      if (e.type === 'kill' && e.hunter && (e.kind === 'slave1' || e.kind === 'phoenixperson')) unlock('wanted'); // (a bounty hunter shot down: not Slave I going by as traffic)
      comms.current?.handle(e);
    }
  };

  // off from the nav map: with a ship, it flies (or jumps) there, and a
  // station or a world is picked too, so the panel shows it; without one
  // (or with the 3D off), the camera takes you to a station or a world
  // (true if the ship's flying there; false with no ship or the 3D off, when the camera goes instead)
  const travel = (id, d, { tour: onTour = false } = {}) => {
    setDrive(d);
    setCharting(false);
    audioContext(); // inside the press, so the jump and the engine can sound
    if (!onTour) stopTour();
    const dest = destinationById(id);
    const flies = Boolean(ship && map.current.live);
    // a star system: to the gate, and on through it once the ship's parked there (the camera: just the gate)
    onward.current = dest?.via && flies ? { via: dest.via, to: dest.to } : null;
    if (dest?.via) id = dest.via;
    const u = byId(id);
    if (flies) {
      const going = map.current.travel(id, d);
      select(u ? id : null); // (a wonder has no card: the panel goes back to the map's)
      if (!going) onward.current = null;
      return going;
    }
    if (u) select(id);
    return false;
  };
  // the grand tour: every station, world and wonder from here, nearest first
  // (not the one you're parked at: that's seen)
  const startTour = () => {
    const w = map.current.where?.();
    if (!w?.ship || !ship) return;
    const ids = tourFrom(w.ship).filter((id) => (distanceTo(w.ship, id) ?? Infinity) > 60);
    if (!ids.length) return;
    stopTour();
    const t = { ids, i: 0, timer: 0 };
    tour.current = t;
    if (!travel(ids[0], drive, { tour: true })) return stopTour();
    setTouring({ i: 0, n: ids.length, next: destinationById(ids[0])?.name ?? ids[0] });
  };

  // Escape: back from the map view or the autopilot first, then out of the
  // universe; unless something took it already or a dialog is open. Heard on
  // the window, since a click on the map leaves the focus where it was.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || leaving) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (tour.current) {
        // the tour first, and the trip it was on: the ship stays where it is
        e.preventDefault();
        stopTour();
        map.current.escape();
        return;
      }
      if (map.current.escape()) {
        e.preventDefault();
        return;
      }
      if (!selected) return;
      e.preventDefault();
      select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaving, selected, select, stopTour]);

  const accent = universe ? { '--accent': universe.accent, '--accent-text': universe.accent, '--btn-bg': universe.accent } : undefined;
  const fade = leaving?.mode === 'phone' ? SAFFRON : leaving?.mode === 'portal' ? PORTAL : leaving?.mode === 'beyond' ? '#000' : leaving?.mode === 'dive' || leaving?.mode === 'crash' ? byId(leaving.id).palette.base : undefined;

  return (
    <div className="dark-scope universe-page" style={accent} data-leaving={leaving?.mode} data-card={universe ? '' : undefined} data-tucked={tucked ? '' : undefined}>
      <h1 className="sr-only">Tilak Patel: the whole site as a universe</h1>
      <p className="sr-only" aria-live="polite">
        {universe ? `${universe.label}: selected` : ''}
      </p>
      <UniverseMap
        key={pocket.word}
        universe={pocket.universe}
        selected={selected}
        onSelect={select}
        onOpen={(id) => go(byId(id))}
        handle={map}
        frozen={Boolean(leaving)}
        ship={ship}
        loadout={loadout}
        build={build}
        tune={tune}
        canFit={Boolean(ship)}
        hangar={yard}
        onHangar={setYard}
        net={online.client}
        onEvent={onEvent}
        drive={drive}
        charting={charting || phone}
        onMap={() => setCharting((o) => !o)}
        onLand={enter}
        onCrash={crashInto}
        startAt={wonder}
      />
      {pocket.pocket && !leaving && (
        <p className="universe-pocket" role="status">
          Pocket universe · {pocket.name}
        </p>
      )}
      {touring && !leaving && (
        <div className="universe-tour" role="status">
          <span>
            {FLY_PAST.pill(touring.i + 1, touring.n, touring.next)}
          </span>
          <button type="button" onClick={stopTour}>
            Stop <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {crew && <Comms control={comms} crew={crew} reduced={reduced} />}
      {!leaving && <EarnNote note={yardNote ?? earned} />}
      {ship && !leaving && (
        <Suspense fallback={null}>
          <Shipyard
            open={yard}
            onOpen={setYard}
            enabled={!charting && !wardrobe}
            ship={ship}
            shipName={crew?.ship ?? ''}
            live={live}
            lastBuild={garage[ship] || null}
            saves={yardSaves}
            dropped={dropped}
            onApply={applyDraft}
            onSell={sellPart}
            onCrew={() => {
              setYard(false);
              setWardrobe(true);
            }}
          />
        </Suspense>
      )}
      <Wardrobe open={wardrobe} onClose={closeWardrobe} looks={looks} onLook={setLook} cast={dressing} who={CASTS[dressing][0]} returnTo=".universe-hangar-btn" />
      {!asking && !leaving && <Online online={online} ship={ship} />}
      <UniversePanel
        universe={universe}
        wonder={wonderDest}
        onFly={ship ? (id) => travel(id, drive) : null}
        onSelect={select}
        onEnter={enter}
        onWhole={whole}
        leaving={Boolean(leaving)}
        ship={ship}
        loadout={loadout}
        build={build}
        onShip={pickShip}
        onHangar={() => setYard(true)}
        onClassic={() => switchTo('classic')}
        tucked={tucked}
        onTuck={tuck}
        onNav={() => setCharting(true)}
      />
      {charting && !leaving && (
        <Suspense fallback={null}>
          <NavMap
            where={map.current.live ? map.current.where : null}
            drive={drive}
            onDrive={setDrive}
            selected={selected}
            live={map.current.live}
            onTravel={(id, d) => travel(id, d)}
            onEnter={enterDest}
            onTour={startTour}
            onWhole={() => {
              setCharting(false);
              whole();
            }}
            onClose={() => setCharting(false)}
          />
        </Suspense>
      )}
      {phone && !leaving && (
        <Suspense fallback={null}>
          <PhoneOverlay onClose={() => setPhone(false)} onUnlock={unlockPhone} />
        </Suspense>
      )}
      {asking && <StartChoice onPick={start} />}
      <div className="universe-fade" aria-hidden="true" style={{ background: fade }} />
      {leaving?.mode === 'beyond' && <Beyond far={beyondOf(leaving.id)} />}
    </div>
  );
}

// Through the black hole: over the black, the far side's falling code and
// where you're going, while the crew have their say above it. The page
// leaves for it once the plan's time is up; the link is there for anyone
// who can't wait.
function Beyond({ far }) {
  return (
    <>
      <Rain />
      <div className="universe-beyond" role="status">
        <p className="universe-beyond-kicker">Through the Maw</p>
        <p className="universe-beyond-text">
          On the far side is a friend’s universe: <a href={far.url}>{far.name}</a>’s portfolio, {far.what}.
        </p>
      </div>
    </>
  );
}
