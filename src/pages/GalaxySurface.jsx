import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { local, useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { CREWS, SHIP_KEY, crewById, parseShip } from '../components/universe/crews';
import { CONTROLS_KEY, readControls } from '../components/universe/controls';
import { LOADOUT_KEY, loadoutOf, readLoadouts } from '../components/universe/outfit';
import { HULL_KEY, TUNE_KEY, readHulls, readTunes } from '../components/universe/shipyard/build';
import { useAchievements } from '../components/Achievements';
import Comms from '../components/universe/Comms';
import Online from '../components/universe/online/Online';
import { useOnline } from '../components/universe/online/useOnline';
import { parseSystem, systemById } from '../components/galaxy/systems';
import { galaxyCrew } from '../components/galaxy/lines';
import { LANDABLE, siteOf } from '../components/galaxy/surface/sites';
import { surfaceUrl } from '../components/galaxy/surface/catalog';
import { CREW, filesOf } from '../components/galaxy/surface/crewList';
import { surfaceCrew } from '../components/galaxy/surface/lines';
import { voiceFor } from '../components/galaxy/surface/voicelines';
import { sayVoiced, stopVoiced } from '../lib/voiced';
import SurfaceView from '../components/galaxy/surface/SurfaceView';
import surfaceModule from '../components/galaxy/surface/module';
import galaxyModule from '../components/galaxy/module';
import { FOUND_KEY, LAUNCH_KEY, QUESTS_KEY, readDone, readFound } from '../components/galaxy/travel';
import { runtime } from '../runtime';
import { thud } from '../lib/sfx';
import { createImpacts } from '../lib/impact';
import ChaseHud from '../components/galaxy/surface/ChaseHud';
import AssaultHud from '../components/galaxy/surface/AssaultHud';
import HeroPanel from '../components/galaxy/surface/HeroPanel';
import { ABILITIES, abilitiesOf } from '../components/galaxy/surface/abilityRules';
import { GameIcon } from '../runtime/hud';
import { HERO_KEY, heroById, heroSpec, loadoutLine, readHero, writeHero } from '../components/galaxy/heroes';
import { missionOf } from '../components/galaxy/surface/missions';
import { sideFor, warSideOf } from '../components/galaxy/surface/missions/assault';
import { SIDE_KEY, current as currentOath, readAllegiance, swear } from '../components/galaxy/allegiance';
import { GCW, campaignAt, scoresAt } from '../components/galaxy/gcw';
import { SIDES, warOfSide } from '../components/galaxy/sides';
import { groundEffects } from '../components/galaxy/siteWar';
import { addPoints, addWin, warNow, warVersion } from '../components/galaxy/warState';
import ModelCredits from '../components/ModelCredits';
import EarnNote from '../components/universe/EarnNote';
import { useEarn } from '../components/universe/useEarn';
import { createCarry, createPayLedger } from '../components/universe/earnRules';
import { wornFiles } from '../components/rickmorty/wardrobe/looks';
import { useLooks } from '../components/rickmorty/wardrobe/useLooks';
import { toggleGuide } from '../lib/palette';
import { Menu, MenuItem, Prompt, Reticle, reticleState } from '../runtime/hud';
import { wayOut } from '../components/worlds/worlds';
import GuideCue from '../components/guide/GuideCue';
import { EMOTES, wheelAngle } from '../lib/emote';
import '../components/universe/universe.css';
import '../components/galaxy/galaxy.css';
import '../components/galaxy/surface/surface.css';

// a ride's knock, by the hit law (lib/impact.js): its force is the speed into
// what it hit × BUMP_MASS, so a scrape at 6 m/s is quiet and 20 m/s is full
const BUMP_MASS = 6;
const bumpLaw = createImpacts();

const LANDED_KEY = 'tp-galaxy-landed'; // the worlds you've set foot on
const CLIMB = 3400; // ms of the climb out seen before space takes over: the ship lifting, then shooting up under the sky's glare (surface.css .surface-exit rises from 2.5 s to here)
export const MISSIONS_KEY = 'tp-galaxy-missions'; // { 'system/id': { t, stars } }: your best at each mission played down on a world

// the emote wheel's slices, by name (lib/emote.js's EMOTES, clockwise from the top)
const EMOTE_NAME = { wave: 'Wave', cheer: 'Cheer', dance: 'Dance', taunt: 'Taunt', sit: 'Sit' };

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
  const { pathname } = useLocation();
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
  // who you play as down here (heroes.js), kept across worlds
  const [hero, setHero] = useState(() => readHero(local.get(HERO_KEY), parseShip(local.get(SHIP_KEY)) ?? 'xwing'));
  const [picking, setPicking] = useState(false);
  // (what's on in the world: the scene says so as a pick goes on, its
  // 'hero' event; a pick whose figure wouldn't load goes back to this)
  const heroNow = useRef(hero);
  heroNow.current = hero;
  const worn = useRef(hero);
  const pickHero = (next) => {
    setHero(next);
    local.set(HERO_KEY, writeHero(next));
    setPicking(false);
  };
  const crew = crewById(ship);
  const { unlocked, unlock } = useAchievements();
  // the galaxy's war (allegiance.js): the side you swore to, and who holds
  // this world (warEffects.js: the troopers you meet are theirs); an assault
  // here is that war's, fought for one of its sides
  const [oathKept, setOathKept] = useState(() => readAllegiance(local.get(SIDE_KEY)));
  // (and, for the people's talk: the side you swore to, and your rank in it, as a step up its ladder)
  // (in the ground's war, its film's: siteWar.js)
  const effects = useMemo(() => groundEffects(id, oathKept, Date.now()), [id, oathKept]);
  const assaultWar = mission?.kind === 'assault' ? warOfSide(warSideOf(mission, 'attack')) : null;
  const sworn = assaultWar ? sideFor(mission, oathKept.oaths[assaultWar]?.side ?? null) : null;
  const onAssaultSide = (k) => {
    const side = warSideOf(mission, k);
    if (warOfSide(side)) {
      const next = swear(oathKept, side);
      if (next !== oathKept) {
        setOathKept(next);
        local.set(SIDE_KEY, next);
        window.dispatchEvent(new Event('tp:oath')); // (your hello says it: useOnline.js)
        unlock('gcwSworn');
        if (currentOath(next).turncoat) unlock('gcwTurncoat');
      }
    }
    view.current?.input?.('side', k);
  };
  // the ground battle's result, counted in the war once: the posts your side
  // took while you were up, and the battle if you won it
  const posted = useRef(false);
  const build = useMemo(() => (ship && readHulls(local.get(HULL_KEY), CREWS.map((c) => c.id))[ship]) || null, [ship]);
  const tune = useMemo(() => (ship && readTunes(local.get(TUNE_KEY), CREWS.map((c) => c.id))[ship]) || null, [ship]); // (the crew's own ship, tuned: its parts must still be ones its plant runs)
  // (the hero's two abilities by id, for the game's icons on the HUD's buttons)
  const powerIds = useMemo(() => abilitiesOf(hero ? heroSpec(hero) : null), [hero]);
  const loadout = useMemo(() => loadoutOf(readLoadouts(local.get(LOADOUT_KEY), CREWS.map((c) => c.id)), ship, unlocked, build, tune), [ship, unlocked, build, tune]);
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
  const [talk, setTalk] = useState(null); // { who, text, voice?, n }
  const [toast, setToast] = useState(null); // { title, text, n }
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(() => readDone()[id] ?? []); // the quests done here
  // the wallet (economy.js): a place found and a quest done pay, the first
  // time only (what was found or done before this visit is paid for already)
  const { pay, note: earned } = useEarn({ client: online.client });
  const [paid] = useState(() => createPayLedger([...found.map((x) => `found:${x}`), ...done.map((x) => `quest:${x}`)]));
  const payOnce = useCallback(
    (key, what) => {
      if (paid.once(key)) pay(what, 1, 'galaxy');
    },
    [paid, pay],
  );
  // (an assault's points come in fractions: the wallet pays whole ones, the
  // rest carried to the next, as the war front in the sky does)
  const [warCarry] = useState(createCarry);
  const [quest, setQuest] = useState(null); // { id, name, text, left, shoot }
  const [list, setList] = useState(false); // the things-to-do list, open
  const [health, setHealth] = useState(100);
  const [zone, setZone] = useState(null); // { id, name } inside somewhere
  const [fade, setFade] = useState(0); // a moment's black, going in or out
  const [aiming, setAiming] = useState(false);
  const [combat, setCombat] = useState(null); // the fight's numbers (scene.js's 'combat' event): guard or heat, abilities, the lock
  const [hitMark, setHitMark] = useState(null); // { n, kill }
  const [looking, setLooking] = useState(null); // the look's mode and lock (scene.js's 'look' event, runtime/look.js)
  const [hurtFlash, setHurtFlash] = useState(0);
  const [parryNote, setParryNote] = useState(0);
  // the emote wheel, as the scene says it is (its 'emote' event: open, the
  // slice pointed at, the last struck, the one on); a phone has no keys to show
  const [emote, setEmote] = useState(null);
  const wheelOpen = useRef(false);
  const [coarse] = useState(() => (typeof window !== 'undefined' ? (window.matchMedia?.('(pointer: coarse)').matches ?? false) : false));
  const lastHealth = useRef(100);
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
  // the line that's up goes (or the next comes) once it's been up long
  // enough to read; said aloud, once it's been said too
  const talkNext = useRef(null); // { at, fn }
  const holdTalk = (ms, fn) => {
    talkNext.current = { at: Date.now() + ms, fn };
    clearTimeout(timers.current.talk);
    timers.current.talk = setTimeout(fn, ms);
  };
  // each line in its speaker's own voice, where it's been made (lib/voiced.js;
  // voicelines.js says who sounds like whom): a new line stops the last
  useEffect(() => {
    if (!talk) return undefined;
    let on = true;
    sayVoiced(talk.voice ?? voiceFor(talk.who), talk.text).then((h) => {
      const t = talkNext.current;
      const said = h && h.length * 1000 + 600;
      if (on && said && t && Date.now() + said > t.at) holdTalk(said, t.fn);
    });
    return () => {
      on = false;
      stopVoiced();
    };
  }, [talk]);
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
        setTalk((t) => ({ who: e.who, text: e.text, voice: e.voice ?? null, n: (t?.n ?? 0) + 1 }));
        holdTalk(3500 + e.text.length * 45, () => setTalk(null));
      } else if (e.type === 'found') {
        const place = site?.places.find((p) => p.id === e.id);
        if (!place) return;
        payOnce(`found:${e.id}`, 'found');
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
      } else if (e.type === 'war') {
        // the ground war's news (ground/director.js): a raid, a post lost or held, a hunt, one line at a time
        setToast((t) => ({ title: SIDES[e.side]?.short ?? 'The ground war', text: e.text, n: (t?.n ?? 0) + 1 }));
        later('toast', 5000, () => setToast(null));
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
          holdTalk(2600 + l.text.length * 42, next);
        };
        if (wasEmpty) next();
      } else if (e.type === 'quest') setQuest(e.id ? e : null);
      else if ((e.type === 'questDone' || e.type === 'questFail') && e.id === mission?.quest?.id) {
        // (a quest mission's own quest: its card says how it went)
      } else if (e.type === 'questDone') {
        const q = site?.quests.find((x) => x.id === e.id);
        payOnce(`quest:${e.id}`, 'questDone');
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
      } else if (e.type === 'health') {
        if (e.value < lastHealth.current - 0.5) {
          setHurtFlash((n) => n + 1);
          later('hurt', 450, () => setHurtFlash(0));
        }
        lastHealth.current = e.value;
        setHealth(e.value);
      } else if (e.type === 'combat') setCombat(e);
      else if (e.type === 'look') setLooking(e);
      else if (e.type === 'emote') {
        wheelOpen.current = Boolean(e.open);
        setEmote(e);
      }
      else if (e.type === 'hit') {
        setHitMark((m) => ({ n: (m?.n ?? 0) + 1, kill: e.kill }));
        later('hitmark', 260, () => setHitMark(null));
      } else if (e.type === 'parry') {
        setParryNote((n) => n + 1);
        later('parry', 900, () => setParryNote(0));
      } else if (e.type === 'vent') {
        if (e.perfect) {
          setParryNote((n) => n + 1);
          later('parry', 900, () => setParryNote(0));
        }
      }
      else if (e.type === 'down') {
        // (in a battle the HUD's deploy card says it)
        if (mission?.kind === 'assault') return;
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
      else if (e.type === 'go') navigate(e.to);
      else if (e.type === 'bump') {
        comms.current?.handle({ type: 'bump', hard: e.hard });
        // and a thud as hard as the knock (the hit law: a scrape quiet, a tree head-on full)
        const k = bumpLaw.hit((e.speed ?? 0) * BUMP_MASS, 'ride');
        if (k) thud({ gain: k.gain, pitch: k.pitch });
      }
      else if (e.type === 'mission') {
        for (const f of chaseFeed.current) f(e.view);
        const v = e.view;
        const shown = v ? (v.key ?? `${v.phase}|${v.count}|${v.left}|${v.result ? 1 : 0}`) : '';
        if (shown !== chaseShown.current) {
          chaseShown.current = shown;
          setChase(v);
        }
        const ev = e.event;
        if (mission?.kind === 'assault' && v?.result && !posted.current) {
          posted.current = true;
          const side = warSideOf(mission, v.result.side);
          const now = Date.now();
          // (it counts where there's a battle on here, or this world's your side's to hold: gcw.js's scoresAt)
          const row = warOfSide(side) ? warNow(now, warOfSide(side)).systems.find((r) => r.id === id) : null;
          if (row && scoresAt(row, side)) {
            const step = campaignAt(now).step;
            const points = (v.result.posts?.[v.result.side] ?? 0) * GCW.points.objective;
            const before = warVersion();
            addPoints(side, id, step, points, now);
            const whole = warVersion() !== before ? warCarry.add(points) : 0; // (not counted: nothing to pay)
            if (whole) pay('warPoints', whole, 'galaxy');
            const was = warVersion();
            if (v.result.won) addWin(side, id, step, now);
            if (warVersion() !== was) pay('warWin', 1, 'galaxy'); // (a battle's win counts once)
          }
        } else if (mission?.kind === 'assault' && v && !v.result) posted.current = false;
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
      } else if (e.type === 'hero') {
        // a pick on in the world, or one that wouldn't load (back to what was on)
        const now = heroNow.current;
        if (e.ok && writeHero(now) === writeHero(worn.current)) return; // (what was on, back on)
        if (e.ok) worn.current = now;
        else {
          setHero(worn.current);
          local.set(HERO_KEY, writeHero(worn.current));
        }
        const name = (h) => heroById(h.id)?.name ?? '';
        setToast((t) => (e.ok ? { title: name(now), text: loadoutLine(now), kind: 'equipped', n: (t?.n ?? 0) + 1 } : { title: name(now), text: `Didn’t load. Still ${name(worn.current)}: try again in a moment.`, kind: 'failed', n: (t?.n ?? 0) + 1 }));
        later('toast', 3200, () => setToast(null));
      }
    },
    [site, id, unlock, mission, missionKey, flyOut, goUp, navigate, pay, payOnce, warCarry],
  );
  const track = (qid) => {
    view.current?.input?.('track', qid);
    setList(false);
  };

  // H (or ?, the site's own key) opens the controls, in the site's guide,
  // and shuts them again (as Invincible's H does); Q
  // for the list of things to do, Escape shuts it; with the emote wheel
  // open (B held), 1 to 5 strike one
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (wheelOpen.current && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && e.key >= '1' && e.key <= String(EMOTES.length) && e.key.length === 1) {
        view.current?.input?.('emote', Number(e.key) - 1);
        return;
      }
      if (e.key === 'h' || e.key === 'H') toggleGuide();
      if (e.key === 'q' || e.key === 'Q') setList((l) => !l);
      if (e.key === 'Escape') setList(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the models on this world, for their credits (a person's crew figure as
  // well as its catalogue model: a duellist of the same kind uses the latter), what the cruiser's crew carry out, and Luke, who walks out of the X-wing (kept, so the credits aren't drawn again with every change of the page)
  const kinds = useMemo(() => (site ? [...[...site.things_all, ...site.scatter, ...site.rides].map((t) => surfaceUrl(t.kind)), ...site.life.flatMap((t) => [surfaceUrl(t.kind), ...(CREW[t.kind] ? filesOf(CREW[t.kind]) : [])]), ...(ship === 'cruiser' ? wornFiles(looks) : []), ...(ship === 'xwing' ? ['/models/galaxy/crew/luke.glb'] : []), ...(heroById(hero.id)?.src.url ? [heroById(hero.id).src.url] : [])] : []), [site, ship, looks, hero.id]);
  if (!site) return <Navigate to={id ? `/galaxy/${id}` : '/galaxy'} replace />;
  const place = site.places.find((p) => p.id === here);
  const accent = { '--accent': sys.accent, '--accent-text': sys.accent, '--btn-bg': sys.accent, '--btn-ink': '#03040a' };
  const left = site.places.filter((p) => !found.includes(p.id)).length;
  return (
    <div className="dark-scope surface-page" style={accent} data-phase={phase} data-leaving={leaving ? (leaving === 'fly' ? 'fly' : '') : undefined}>
      <h1 className="sr-only">
        {sys.name}: {site.place}
      </h1>
      <SurfaceView system={id} mission={mission?.id ?? null} ship={ship} hero={hero} loadout={loadout} build={build} found={found} done={done} compass={compass} net={online.client} handle={view} onEvent={onEvent} effects={effects} />

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
      {mission && mission.kind !== 'assault' && <ChaseHud view={chase} feed={chaseFeed} mission={mission} best={best} fresh={fresh} onAgain={() => view.current?.input?.('restart')} onBack={takeOff} />}
      {mission?.kind === 'assault' && <AssaultHud view={chase} feed={chaseFeed} mission={mission} best={best} fresh={fresh} onSide={onAssaultSide} sworn={sworn} onDeploy={(id) => view.current?.input?.('deploy', id)} onAgain={() => view.current?.input?.('restart')} onBack={goUp} />}

      {phase !== 'landing' && site.quests.length > 0 && !((mission?.kind === 'chase' || mission?.kind === 'assault') && chase && !chase.result) && (
        <div className={quest ? 'surface-quest surface-quest-on' : 'surface-quest'}>
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
          {/* (a way to shut it under the pointer and the thumb, beside Q and Esc) */}
          <div className="surface-list-head">
            <p className="surface-list-title">Things to do on {sys.name}</p>
            <button type="button" className="btn btn-ghost btn-sm surface-list-close" onClick={() => setList(false)}>
              Close
            </button>
          </div>
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
      {/* the fight: the guard a Jedi's block spends (or a gun's heat), the abilities and their cooldowns, who you're squared up to */}
      {combat && phase === 'walk' && (aiming || combat.lock || combat.broken || combat.locked || (combat.heat ?? 0) > 0.02 || (combat.guard ?? 1) < 0.99) && (
        <div className="surface-combat" aria-live="off">
          {combat.lock && (
            <p className="surface-lock">
              <span className="surface-lock-name">{combat.lock.name}</span>
              <span className="surface-lock-bar" role="meter" aria-label="Target health" aria-valuenow={combat.lock.hp} aria-valuemin={0} aria-valuemax={combat.lock.max}>
                <span style={{ width: `${(100 * combat.lock.hp) / Math.max(1, combat.lock.max)}%` }} />
                {combat.lock.shield > 0 && <i style={{ width: `${Math.min(100, combat.lock.shield * 34)}%` }} />}
              </span>
            </p>
          )}
          {combat.saber ? (
            <div className={combat.broken ? 'surface-meter surface-guard is-broken' : 'surface-meter surface-guard'} role="meter" aria-label="Guard" aria-valuenow={Math.round((combat.guard ?? 1) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${(combat.guard ?? 1) * 100}%` }} />
              <b>{combat.broken ? 'Guard broken' : combat.stance}</b>
            </div>
          ) : (
            <div className={combat.locked ? 'surface-meter surface-heat is-locked' : combat.hot ? 'surface-meter surface-heat is-hot' : 'surface-meter surface-heat'} role="meter" aria-label="Heat" aria-valuenow={Math.round((combat.heat ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${(combat.heat ?? 0) * 100}%` }} />
              {combat.vent != null && <i className="surface-vent" style={{ left: `${combat.vent * 100}%` }} />}
              {combat.vent != null && <em className="surface-vent-sweet" />}
              <b>{combat.locked ? 'Overheated: R to vent' : combat.hot ? `${combat.weapon}: overcharged` : combat.weapon}</b>
            </div>
          )}
          <ul className="surface-powers">
            {[
              ['G', combat.powers?.power ?? (combat.saber ? 'Push' : 'Detonator'), 'power', powerIds.power],
              ['V', combat.powers?.second ?? (combat.saber ? 'Pull' : 'Overcharge'), 'second', powerIds.second],
              ['X', 'Dodge', 'dodge'],
              ['B', 'Emote', 'emote'],
            ].map(([key, name, slot, ability]) => {
              const left = combat.cool?.[slot] ?? 0;
              const full = combat.cools?.[slot] ?? 1;
              return (
                <li key={slot} className={left > 0 ? 'surface-power is-cooling' : 'surface-power'} style={{ '--k': left > 0 ? left / full : 0 }}>
                  <kbd>{key}</kbd>
                  {ability && ABILITIES[ability]?.name === name && <GameIcon name={`ability:${ability}`} className="surface-game-icon" />}
                  <span>{name}</span>
                  {left > 0.05 && !(slot === 'power' && combat.powers?.hold) && <small>{left.toFixed(left < 10 ? 1 : 0)}</small>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {hitMark && <span key={`hit-${hitMark.n}`} className={hitMark.kill ? 'surface-hitmark is-kill' : 'surface-hitmark'} aria-hidden="true" />}
      {parryNote > 0 && (
        <p key={`parry-${parryNote}`} className="surface-parry" role="status">
          Perfect
        </p>
      )}
      {hurtFlash > 0 && <div key={`hurt-${hurtFlash}`} className="surface-hurt" aria-hidden="true" />}
      {/* the reticle (the world kit's): up whenever a gun is, or the sights, or a shot's just gone */}
      <Reticle
        className="surface-reticle"
        state={reticleState(null, {
          gun: ((aiming || quest?.shoot || (combat && !combat.saber)) && phase === 'walk') || (mission?.kind === 'chase' && chase && !chase.result && phase === 'ride') || (mission?.kind === 'assault' && chase?.phase === 'run' && chase.you?.up && phase === 'walk'),
          sights: Boolean(combat?.ads && !combat.saber && phase === 'walk'),
          hitAt: hitMark ? 0 : null,
          lock: combat?.lock,
        })}
      />
      {looking?.prompt && phase === 'walk' && !leaving && !emote?.open && <Prompt k="" verb={looking.prompt} className="surface-look" onClick={() => view.current?.input?.('lookLock')} />}
      {/* the emote wheel (B held, or the Emote button on a phone): the five
          round the middle of the view, clockwise from the top, the one pointed
          at lit; let go over it, or click or tap it, or its number */}
      {emote?.open && phase === 'walk' && !leaving && (
        <div className="surface-wheel" role="menu" aria-label="Emotes">
          <p className="surface-wheel-mid">{coarse ? 'Slide to one' : 'Let go of B over one'}</p>
          {EMOTES.map((eid, i) => {
            const a = wheelAngle(i);
            return (
              <button key={eid} type="button" role="menuitem" className="surface-wheel-slice" data-on={emote.hover === eid || undefined} data-last={emote.last === eid || undefined} style={{ '--sx': Math.sin(a).toFixed(3), '--sy': (-Math.cos(a)).toFixed(3) }} onClick={() => view.current?.input?.('emote', eid)}>
                <span>{EMOTE_NAME[eid]}</span>
                {!coarse && <kbd>{i + 1}</kbd>}
              </button>
            );
          })}
        </div>
      )}
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
      <EarnNote note={earned} />
      {toast && (
        <div key={`toast-${toast.n}`} className="surface-toast" data-done={toast.done ? '' : undefined} data-kind={toast.kind} role="status">
          <p className="surface-toast-title">{toast.title}</p>
          <p className="surface-toast-text">{toast.text}</p>
        </div>
      )}
      {phase === 'landing' && (
        <div className="surface-title" aria-hidden="true">
          <p className="surface-title-world">{sys.name}</p>
          <p className="surface-title-place">{site.place}</p>
          <p className="surface-title-line">
            {site.line}
            <GuideCue touch={coarse} />
          </p>
          <p className="surface-title-skip">Any key to skip</p>
        </div>
      )}

      {/* the corner: who you play as, the way back up, and the world's one
          Menu (the list, the controls in the site's guide, the way out of
          the world); the site's own "?" stays the one button for the guide */}
      <div className="surface-corner">
        <button type="button" className="surface-help-btn" onClick={() => setPicking((p) => !p)} aria-expanded={picking} aria-haspopup="dialog" aria-label={`Loadout: ${heroById(hero.id)?.name ?? heroSpec(hero).name}`} title="Who you play as, and what's in your hand">
          <span className="surface-help-k" aria-hidden="true">
            Loadout
          </span>
          {heroSpec(hero).name}
        </button>
        <button type="button" className="surface-help-btn" onClick={takeOff}>
          Back to orbit
        </button>
        <Menu className="surface-menu" todo={site.quests.length > 0 ? { onOpen: () => setList(true), done: done.length, total: site.quests.length } : null} way={wayOut(pathname)}>
          {looking && looking.mode !== 'touch' && (
            <MenuItem keep onClick={() => view.current?.input?.('lookMode', looking.mode === 'lock' ? 'drag' : 'lock')}>
              Look: {looking.mode === 'lock' ? 'Click to lock' : 'Drag'}
            </MenuItem>
          )}
        </Menu>
        <ModelCredits where="galaxy-surface" only={kinds} className="surface-credits-corner" />
      </div>
      {picking && <HeroPanel hero={hero} onChange={pickHero} onClose={() => setPicking(false)} />}
      {crew && talkCrew && <Comms control={comms} crew={talkCrew} reduced={reduced} />}
      {!leaving && <Online online={online} ship={ship} />}
      <div className="surface-fade" aria-hidden="true" />
      {entry && <div className="surface-entry" aria-hidden="true" />}
      {leaving === 'fly' && <div className="surface-exit" aria-hidden="true" />}
    </div>
  );
}
