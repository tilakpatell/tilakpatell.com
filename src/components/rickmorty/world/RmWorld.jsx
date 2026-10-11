import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '@fontsource/luckiest-guy/400.css';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import GpuGate from '../../games/GpuGate';
import { readPad, typing } from '../../games/pad';
import { keyDown, keyUp } from '../../middleearth/towns/keys';
import ButterRobot from '../ButterRobot';
import Cable from '../Cable';
import MeeseeksBox from '../MeeseeksBox';
import PlumbusFactory from '../PlumbusFactory';
import PortalPanic from '../portal/PortalPanic'; // (the page has it already, so not lazy)
import Quiz from './Quiz';
import { MORTY_BEST } from './roy/rules';
import {
  ARCADE,
  AREAS,
  CRUISER,
  DINER,
  DRIVEWAY,
  FRONT_WALK,
  FURNITURE,
  GARAGE,
  HATCH,
  HOTSPOTS,
  HOUSE_PARTS,
  INNER_WALLS,
  LIMO,
  LINKS,
  MEMORIES,
  NEIGHBOURS,
  PEOPLE,
  PLAN,
  PLANET_TASKS,
  RINGS,
  ROAD,
  SCHOOL_PARTS,
  START,
  TASKS,
  TREES,
  YARDS,
  behindYaw,
  cameraMove,
  canLand,
  dropAt,
  exitCruiser,
  floorAt,
  inArea,
  nearHotspot,
  nearLink,
  newCruiser,
  newMorty,
  progress,
  stepCruiser,
  stepMorty,
} from './rules';
import { newFedShip, newShipVoice, onTail, shipSays, stepFedShip } from './ship';
import { DESTINATIONS, destinationById, isPlanet, isWayHome, linkTarget, portalTarget, readDial, writeDial } from './dimensions/destinations';
import { backLink, boundOf, inLine, planetOf, planetProgress, relabel } from './planetMode';
import { dialledNote, isGunKey, portalName } from './portalGun';
import Cards from './WorldCards';
import RmHud from './RmHud';
import { ROOMS, newTrial, pick as pickRoom, retry as retryRooms } from './dimensions/vindicatorsRules';
import { speak, stopSpeaking } from './shipVoice';
import { ROOMS_SAY, SAY } from './say';
import { lineSaid } from './voicelines';
import { preloadVoiced, sayVoiced, stopVoiced } from '../../../lib/voiced';
import { useLooks } from '../wardrobe/useLooks';
import './world.css';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { createEmoteWheel, emotePacket, keepEmote, readEmote } from '../../../lib/emote';
import { createPress, pressGroups } from '../../../lib/press';
import { lineHold } from './living';
import LoadingVeil from '../../worlds/LoadingVeil';
import { throttled } from '../../worlds/loadingSteps';
import { createLook } from '../../../runtime/look';
import { FRICTION, coneFor } from '../../../lib/combat/aim';
import { createLockOn } from '../../../lib/combat/lockOn';
import { stepRmLockOn } from './rmLockOn';

// Dimension C-137, the world: walk about the Smiths' street as Morty, go into
// the house, Rick's garage and Harry Herpson High, fly Rick's space cruiser
// over the roofs, and step through the garage's portal to the alien street and
// Blips and Chitz. The rules are in ./rules.js and the drawing in ./scene.js;
// this is the controls, the camera's yaw, the HUD, the doors and the things to
// do. Each toy opens over the page (the page's own components, the pop quiz,
// Roy); close it and you're back in the room. Without 3D, the places are
// cards that open the same things. The egg on the living room's bookcase
// starts Total Rickall there (./interiors/rickall.js, loaded then): Morty
// kept in the room with the crowd, a crosshair, E for a memory of whoever's
// in it, F or a click to shoot them, and a card for how it ended. B (held)
// is a wheel of emotes for Morty (lib/emote.js: wave, cheer, dance, taunt,
// sit; tap it for the last again), seen by the others online; anything he
// does, or walking off, ends one.
// Started on a planet of the universe map's Rick and Morty sector (`start`),
// it's that planet alone, its portal the way back to space (./planetMode.js).

const Roy = lazy(() => import('./roy/Roy').catch(() => ({ default: RoyDown })));
const Sewer = lazy(() => import('./sewer/Sewer').catch(() => ({ default: RoyDown })));
const sound = (name) =>
  import('../../games/gameAudio')
    .then((g) => g[name]?.())
    .catch(() => {});

const DONE = 'tp-c137-done';
const ROY = 'tp-c137-roy';
const TASK_IDS = new Set(TASKS.map((t) => t.id));
const readDone = () => {
  const d = local.get(DONE, []);
  return Array.isArray(d) ? d.filter((x, i) => TASK_IDS.has(x) && d.indexOf(x) === i) : [];
};
// the best age as Roy so far, or null before a life's been lived
const readBest = () => Math.max(0, Math.floor(Number(local.get(ROY, null)?.best) || 0)) || null;
// Roy's tasks from what Roy keeps (tp-c137-roy): a life lived, and one past Morty's 55
const royDone = () => {
  const r = local.get(ROY, null);
  const best = Number(r?.best) || 0;
  return [...((Number(r?.lives) || 0) > 0 || best > 0 ? ['roy'] : []), ...(best > MORTY_BEST ? ['roy55'] : [])];
};
// what's done, with Roy's caught up (a life that ended before the page was left)
const startDone = () => {
  const d = readDone();
  const more = royDone().filter((id) => !d.includes(id));
  if (!more.length) return d;
  const next = [...d, ...more];
  local.set(DONE, next);
  return next;
};
const CANT_LAND = 'Can’t land here. Slow right down over open ground, clear of the doors: the road or a front lawn.';

// what opens over the page, and the task opening it ticks off
const PLACES = {
  cable: { title: 'Interdimensional cable', where: 'The Smiths’ living room', task: 'cable' },
  butter: { title: 'The butter robot', where: 'The breakfast table', task: 'butter' },
  meeseeks: { title: 'Mr. Meeseeks box', where: 'Rick’s worktable', task: 'meeseeks' },
  plumbus: { title: 'The plumbus factory', where: 'Rick’s garage', task: 'plumbus' },
  portalpanic: { title: 'Portal panic', where: 'The cabinet in Rick’s garage', task: 'portalpanic' },
  quiz: { title: 'Mr. Goldenfold’s pop quiz', where: 'Harry Herpson High' },
  roy: { title: 'Roy: A Life Well Lived', where: 'Blips and Chitz', full: true },
  sewer: { title: 'Pickle Rick’s sewer run', where: 'The agency', full: true },
};
const AREA_NAME = {
  street: 'The Smiths’ street',
  house: 'The Smith house',
  upstairs: 'Upstairs',
  garage: 'Rick’s garage',
  school: 'Mr. Goldenfold’s classroom',
  annex: 'The alien street',
  arcade: 'Blips and Chitz',
  basement: 'Rick’s clone lab',
  mindblowers: 'Morty’s Mind Blowers',
  oval: 'The Oval Office',
  diner: 'Shoney’s',
  wong: 'Dr. Wong’s office',
  ...Object.fromEntries(DESTINATIONS.map((d) => [d.id, d.name])),
};
// what talking to someone does, beyond what they say: a thing to do, done
const TALK_DONE = { president: 'president', dineragent: 'diner', therapy: 'wong', ...Object.assign({}, ...DESTINATIONS.map((d) => d.done)) };
// whom a talk is to, where its hotspot isn't named for them (rules.js's PEOPLE)
const TALK_TO = { therapy: 'drwong' };
// and the achievements a talk earns
const TALK_UNLOCK = { therapy: 'wong', ...Object.assign({}, ...DESTINATIONS.map((d) => d.unlock)) };
// the places left in a hurry (./dimensions/destinations.js's `escape`), by
// the hotspot that starts the clock: the Purge Planet's siren, Customs'
// scanner, the wedding's toast
const ESCAPES = Object.fromEntries(DESTINATIONS.filter((d) => d.escape).map((d) => [d.escape.spot, { ...d.escape, area: d.id }]));
// and what using a hotspot tells its place's builder
const ACTS = Object.assign({}, ...DESTINATIONS.map((d) => Object.fromEntries(Object.entries(d.acts).map(([spot, name]) => [spot, [d.id, name]]))));
// and the things done by using every one of a set of hotspots (the simulation's slips), by each hotspot
const COLLECT = Object.assign({}, ...DESTINATIONS.filter((d) => d.collect).map((d) => Object.fromEntries(d.collect.spots.map((spot) => [spot, { ...d.collect, area: d.id }]))));
// a memory's run in the Mind Blowers chair, and how far Morty can stray from the chair before it stops
const MEMORY_S = 5.5;
// Total Rickall: how long a memory of someone stays up over them, and how
// little a click may drag the view and still be a shot (px, ms)
const RECALL_MS = 9000;
const CLICK = { px: 6, ms: 400 };
const NO_HATCH = 'The egg won’t hatch. Give it a moment, then try again.';
const TALK_MS = 3200; // how long someone talks before what they've said counts
const SHIP_WAIT = 6; // how long the cruiser keeps a line it was about to say, in seconds
const CHAIR_R = 1.2;

// the prompt for each thing Morty can be next to
const linkVerb = (l) =>
  l.kind === 'portal' ? 'Step through' : l.kind === 'exit' ? 'Go out' : l.kind === 'stairs' ? (l.to === 'upstairs' ? 'Go up' : 'Go down') : l.kind === 'hatch' ? (l.to === 'basement' ? 'Go down' : 'Climb up') : 'Go in';
const PROMPT = {
  ...Object.fromEntries(LINKS.map((l) => [`link:${l.id}`, { kind: 'link', id: l.id, name: l.label, verb: linkVerb(l), link: l }])),
  ...Object.fromEntries(HOTSPOTS.map((h) => [`spot:${h.id}`, { kind: 'spot', id: h.id, name: h.label, verb: h.verb, spot: h }])),
  cruiser: { kind: 'cruiser', id: 'cruiser', name: 'Rick’s space cruiser', verb: 'Board' },
  land: { kind: 'land', id: 'land', name: 'Open ground', verb: 'Land' },
};
const BOARD_R = 2.7; // how near the cruiser's middle Morty can get in from
// the emote wheel: how far the mouse goes from the view's middle to point at
// one (px), and what each is called
const WHEEL_R = 110;

// Where the next thing to do is, for the map's marker: the area and the spot
// in it, and from anywhere else, the way towards it.
const GOAL = { cable: ['house', 'spot:cable'], butter: ['house', 'spot:butter'], meeseeks: ['garage', 'spot:meeseeks'], plumbus: ['garage', 'spot:plumbus'], portalpanic: ['garage', 'spot:portalpanic'], quiz: ['school', 'spot:quiz'], fly: ['street', 'cruiser'], portal: ['garage', 'link:garage-portal'], basement: ['garage', 'link:garage-hatch'], roy: ['arcade', 'spot:roy'], roy55: ['arcade', 'spot:roy'], president: ['street', 'spot:president'], oval: ['garage', 'link:garage-oval'], diner: ['street', 'link:diner-door'], mindblowers: ['mindblowers', 'spot:chair'], rickall: ['house', 'spot:egg'], wong: ['street', 'link:wong-door'], ...Object.fromEntries(DESTINATIONS.flatMap((d) => d.tasks.map((t) => [t.id, [d.id, `spot:${Object.keys(d.done).find((k) => d.done[k] === t.id) ?? d.escape?.after ?? d.escape?.spot ?? d.goal}`]]))), sewer: ['agency', 'spot:sewer'] };
// (every destination but the planets is through the garage's portal: they're landed on from the universe map)
const toDest = (via) => Object.fromEntries(DESTINATIONS.filter((d) => !isPlanet(d.id)).map((d) => [d.id, via]));
const WAY = {
  street: { house: 'house-door', upstairs: 'house-door', garage: 'garage-door', basement: 'garage-door', mindblowers: 'garage-door', oval: 'garage-door', school: 'school-door', diner: 'diner-door', wong: 'wong-door', annex: 'garage-door', arcade: 'garage-door', ...toDest('garage-door') },
  house: { street: 'front', upstairs: 'stairs-up', garage: 'kitchen-garage', basement: 'kitchen-garage', mindblowers: 'kitchen-garage', oval: 'kitchen-garage', school: 'front', diner: 'front', wong: 'front', annex: 'kitchen-garage', arcade: 'kitchen-garage', ...toDest('kitchen-garage') },
  garage: { street: 'garage-exit', house: 'garage-kitchen', upstairs: 'garage-kitchen', basement: 'garage-hatch', mindblowers: 'garage-hatch', oval: 'garage-oval', school: 'garage-exit', diner: 'garage-exit', wong: 'garage-exit', annex: 'garage-portal', arcade: 'garage-portal', ...toDest('garage-portal') },
  basement: { mindblowers: 'basement-mind' },
  annex: { arcade: 'arcade-door' },
};
const OUT = { upstairs: 'stairs-down', school: 'school-exit', annex: 'annex-portal', arcade: 'arcade-exit', basement: 'basement-ladder', mindblowers: 'mind-door', oval: 'oval-portal', diner: 'diner-exit', wong: 'wong-exit', ...Object.fromEntries(DESTINATIONS.map((d) => [d.id, `${d.id}-portal`])) };
function goalOf(next, s, planet = null) {
  if (s.flying) return null;
  // (on a planet with everything there done, or a clock running to get back out: its portal home; from C-137, a planet's not pointed at)
  if (!next || (planet && s.escape?.area === planet.id)) return planet ? PROMPT[`link:${planet.id}-portal`].link : null;
  const [to, key] = GOAL[next.id];
  if (isPlanet(to) && to !== s.area) return null;
  if (to === s.area) {
    if (key === 'cruiser') return { x: s.c.x, z: s.c.z };
    const p = PROMPT[key];
    return p.link ?? p.spot;
  }
  const id = WAY[s.area]?.[to] ?? OUT[s.area];
  return PROMPT[`link:${id}`]?.link ?? null;
}

// who's standing in Total Rickall, for Morty to walk round (made again when someone's shot)
const crowdOf = (run) => {
  if (run.crowdN !== run.game.shot.length) {
    run.crowdN = run.game.shot.length;
    run.crowd = run.game.people.filter((p) => !run.game.shot.includes(p.id)).map(({ id, x, z, r }) => ({ id, x, z, r }));
  }
  return run.crowd;
};

const PITCH = 0.17; // the walking camera's lift, as the scene has it
const FADE_MS = 260;
const CLIMB_MS = 480; // down the hatch or up the ladder: a slower fade
const FLY_KEYS = { KeyR: 'rise', KeyF: 'sink', KeyC: 'sink' };
const clamp1 = (v) => Math.max(-1, Math.min(1, v));
const roomAt = (area, x, z) => PLAN.find((r) => r.area === area && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)?.name ?? null;
// (at a planet's way in, out of its portal: the camera off to one side, as go() has it)
const newSim = (at = START, portal = false) => ({
  area: at.area,
  m: newMorty(at),
  c: newCruiser(),
  flying: false,
  landing: false,
  landT: 0,
  boardAt: null,
  yaw: behindYaw(at.face) + (portal ? 0.85 : 0),
  pitch: PITCH,
  dragAt: portal ? 0 : -1e9,
  t: 0,
  keys: new Set(),
  stick: { x: 0, y: 0 },
  lift: 0,
  jump: false, // asked to jump (Space, or the jump button), till the next step takes it
  press: createPress(), // the jump's: a moment early on landing, or a moment late off an edge, still jumps
  near: null,
  moved: false,
  fading: false,
  events: [],
  emit: null,
  duel: null, // a fight on (hearts in the HUD; F fires)
  frame: 0,
  padBefore: {},
  view: { link: null, hotspot: null },
  // the cruiser's voice and what it's noticed; the Federation's ship; a memory playing
  voice: newShipVoice(),
  tookOff: false,
  fastT: 0,
  landedAt: -1e9,
  leftFrom: null,
  shipNext: null,
  fed: newFedShip(),
  mind: null,
  // Total Rickall, while it's on: { phase ('hatching', 'on', 'over'), seed,
  // game (./interiors/rickall.js's), aim (who's in the sights), hide (who's
  // right at his shoulder, out of the picture), told (the memory up over
  // someone), end (how it ended), crowd (who's standing, for Morty to walk
  // round) }
  rickall: null,
  // Morty's word to someone, while it plays ({ id, n, hold, x, z, at }: n a
  // new number for each, so they know it's a new one), how many he's said,
  // the emote he's struck ({ id, at }), and whether he's done something
  // since the last frame (which ends it)
  talk: null,
  talkN: 0,
  emote: null,
  acted: false,
});

// `start`: a planet of the universe map's Rick and Morty sector, played on its
// own (./planetMode.js), its portal home calling `onLeave`; else C-137
export default function RmWorld({ start = null, onLeave = null }) {
  const planet = useMemo(() => planetOf(start), [start]);
  const three = use3D();
  const { unlock } = useAchievements();
  const [done, setDone] = useState(startDone);
  const doneRef = useRef(done);
  const [open, setOpen] = useState(null);
  const openRef = useRef(null);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const [toast, setToast] = useState(null);
  const pending = useRef([]); // tasks done while something's open over the page, told on the way out
  const api = useRef(null);

  // (what someone says is heard in their own voice where it's been made
  // (./voicelines.js, lib/voiced.js); the next thing said, voiced or not, stops it)
  const say = useCallback((t) => {
    setToast({ ...t, at: performance.now() });
    if (t.kind === 'say') {
      const said = lineSaid(t.text);
      sayVoiced(said?.who, said?.text);
    }
  }, []);
  useEffect(() => {
    preloadVoiced();
    return stopVoiced;
  }, []);
  const tellDone = useCallback((ids) => {
    const names = ids.map((id) => TASKS.find((t) => t.id === id)?.name).filter(Boolean);
    const p = progress(doneRef.current);
    setToast({ kind: 'done', who: names.join(' and '), text: p.next ? `${p.count} of ${p.total} done` : `All ${p.total} done. Wubba lubba dub dub.`, at: performance.now() });
  }, []);

  // A thing to do, done: kept straight away (not only when the page is left),
  // sparks over Morty, and a toast now or when what's open closes.
  const complete = useCallback(
    (id) => {
      if (!TASK_IDS.has(id) || doneRef.current.includes(id)) return;
      const next = [...doneRef.current, id];
      doneRef.current = next;
      local.set(DONE, next);
      setDone(next);
      api.current?.fx('done', { id });
      sound('gadget');
      // (and Morty's pleased with himself: on his upper half if he's walking)
      api.current?.play('cheer', { hold: 0.2, layer: 'auto' });
      if (openRef.current) pending.current.push(id);
      else tellDone([id]);
    },
    [tellDone],
  );

  const openPlace = useCallback(
    (id) => {
      if (!PLACES[id]) return;
      audioContext();
      openRef.current = id;
      setOpen(id);
      if (PLACES[id].task) complete(PLACES[id].task);
    },
    [complete],
  );
  const close = useCallback(() => {
    openRef.current = null;
    setOpen(null);
    if (pending.current.length) {
      tellDone(pending.current);
      pending.current = [];
    }
  }, [tellDone]);
  const quizDone = useCallback(
    (pass) => {
      if (!pass) return;
      complete('quiz');
      unlock('goldstar');
    },
    [complete, unlock],
  );
  // Roy's headset off: a life lived (and past Morty's 55), and the arcade's board shows the best
  const royLeft = useCallback(
    (age) => {
      const ids = age != null ? ['roy', ...(age > MORTY_BEST ? ['roy55'] : [])] : [];
      for (const id of new Set([...ids, ...royDone()])) complete(id);
      close();
      api.current?.act?.('arcade', 'setBoard', readBest());
    },
    [complete, close],
  );

  // up the hole from the sewer: the run counts when the far drain was made
  const sewerLeft = useCallback(
    (won) => {
      close();
      if (won) complete('sewer');
    },
    [complete, close],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.kind === 'say' ? 5600 : toast.bad ? 3400 : 4400);
    return () => clearTimeout(t);
  }, [toast]);

  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="rm-world" aria-labelledby="rm-world-title" data-mode={world ? '3d' : 'cards'}>
      {world ? (
        <World api={api} done={done} open={open} openPlace={openPlace} complete={complete} unlock={unlock} gl={gl} setGl={setGl} toast={toast} say={say} planet={planet} onLeave={onLeave} />
      ) : (
        <Cards done={done} openPlace={openPlace} three={three} gl={gl} toast={toast} retry={() => setGl('loading')} planet={planet} />
      )}
      {open && <Place id={open} onClose={close} onQuiz={quizDone} onRoy={royLeft} onSewer={sewerLeft} />}
    </section>
  );
}

// others online (middleearth/towns/useTravellers), as Mortys from other
// dimensions, in the street or whichever room you're in (each its own area:
// the places past the portal are built out to some 4.4 km from the street,
// hence the reach)
const ROOM = { bound: boundOf(AREAS), motion: true };

function World({ api, done, open, openPlace, complete, unlock, gl, setGl, toast, say, planet, onLeave }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const touchRef = useRef(touch);
  touchRef.current = touch;
  const trav = useTravellers('c137', gl === 'on', ROOM);
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.35 });
  const canvas = useRef(null);
  const map = useRef(null);
  const brand = useRef(null); // (the title and what to do: Total Rickall's memory card keeps off it)
  const sim = useRef(null);
  if (!sim.current) sim.current = newSim(planet ?? START, !!planet);
  // (C-137's next is never a planet's: they're done on the planets)
  const prog = planet ? planetProgress(planet, done) : progress(done, { skip: PLANET_TASKS });
  const progRef = useRef(prog);
  progRef.current = prog;
  const doneRef = useRef(done);
  doneRef.current = done;
  const [hud, setHud] = useState({ area: (planet ?? START).area, room: null, flying: false, landing: false, near: null, moved: false, alt: 0, kmh: 0 });
  const hudKey = useRef('');
  // the emote wheel (B, held; on a touch screen its button): what it shows
  const wheel = useRef(null);
  wheel.current ??= createEmoteWheel();
  const [wheelUi, setWheelUi] = useState(null); // { hover } while B holds it open
  const [looking, setLooking] = useState(null); // the look (runtime/look.js): its mode, and whether the pointer's locked
  const [touchWheel, setTouchWheel] = useState(false);
  const wheelKey = useRef('');
  // an emote struck: on Morty from this frame (scene.js plays it), and on the wire
  const strike = useCallback((id) => {
    const s = sim.current;
    setTouchWheel(false);
    if (!id || s.flying || s.fading || s.rickall) return;
    audioContext();
    s.emote = { id, at: s.t };
    s.acted = false;
  }, []);
  const [list, setList] = useState(false);
  const listRef = useRef(list);
  listRef.current = list;
  // the wardrobe: how Morty looks here (and Rick, wherever he turns up)
  const [looks, setLook] = useLooks();
  const looksRef = useRef(looks);
  looksRef.current = looks;
  const [wardrobe, setWardrobe] = useState(false);
  // the portal gun's dial, open at its stand in the garage (it holds Morty still, as the wardrobe does)
  const [dialing, setDialing] = useState(false);
  const dialRef = useRef(readDial());
  // Rick's rooms on the Vindicators' ship, asked one at a time (it holds him still too)
  const [trial, setTrial] = useState(null);
  const trialRef = useRef(newTrial());
  const wardrobeRef = useRef(wardrobe);
  wardrobeRef.current = wardrobe || dialing || !!trial;
  const closeWardrobe = useCallback(() => setWardrobe(false), []);
  const closeDial = useCallback(() => setDialing(false), []);
  const pickDial = useCallback(
    (id) => {
      writeDial(id);
      dialRef.current = portalTarget(id);
      setDialing(false);
      say({ kind: 'note', text: dialledNote(dialRef.current, sim.current.area) });
    },
    [say],
  );
  const closeTrial = useCallback(() => setTrial(null), []);
  const pickTrial = useCallback(
    (id) => {
      const t = trialRef.current;
      const r = pickRoom(t, id);
      if (r === 'next') {
        setTrial({ ...t });
        say({ kind: 'note', text: 'Right. The door slides open on the next room.' });
      } else if (r === 'lost') {
        setTrial(null);
        say({ kind: 'say', ...ROOMS_SAY.lost });
      } else if (r === 'won') {
        setTrial(null);
        say({ kind: 'say', ...ROOMS_SAY.won });
        complete('vindicators');
        unlock('vindicators');
      }
    },
    [say, complete, unlock],
  );
  // (the same list for as long as he's in one room, so the overlay keeps its place in it)
  const room = trial?.room ?? null;
  const trialItems = useMemo(() => (room == null ? [] : ROOMS[room].choices.map((c) => ({ id: c.id, name: c.text }))), [room]);
  useEffect(() => {
    api.current?.setLooks?.(looks);
  }, [api, looks]);
  const chip = useRef(null);
  const listBox = useRef(null);
  // closing the list: if the focus was in it, back to the chip that opened it
  const closeList = useCallback(() => {
    const inside = listBox.current?.contains(document.activeElement);
    setList(false);
    if (inside) chip.current?.focus({ preventScroll: true });
  }, []);
  // the portal gun's dial (the bench, P or the chip), the list shut: not over something else, mid-trip, in a game or a fight, nor flying
  const openDial = useCallback(() => {
    const s = sim.current;
    if (wardrobeRef.current || s.fading || s.rickall || s.duel || s.flying) return;
    s.keys.clear();
    dialRef.current = readDial();
    closeList();
    setDialing(true);
  }, [closeList]);
  const [fade, setFade] = useState(null);
  const [duel, setDuel] = useState(null); // the fight's hearts, for the HUD
  const [clock, setClock] = useState(null); // a place left in a hurry: seconds left to the portal
  const clockRef = useRef(null); // null, or the kind of link being gone through
  const [opening, setOpening] = useState(null); // the place a portal's waiting on while it loads
  const [shipLine, setShipLine] = useState(null); // what the cruiser last said, captioned
  const [memory, setMemory] = useState(null); // the memory playing in the Mind Blowers chair
  // the cruiser says something, if it's the time for it (./ship.js decides)
  // (held back only because it's just spoken: asked again for a few seconds)
  const shipTalk = useCallback((event) => {
    const s = sim.current;
    const r = shipSays(s.voice, event, s.t);
    s.voice = r.v;
    if (r.held) s.shipNext = { event, until: s.shipNext?.event === event ? s.shipNext.until : s.t + SHIP_WAIT };
    if (!r.line) return;
    if (s.shipNext?.event === event) s.shipNext = null;
    setShipLine({ text: r.line, at: performance.now() });
    speak(r.line);
  }, []);
  // the ship goes quiet when the world does, and it and whoever was talking when something opens over it
  useEffect(() => stopSpeaking, []);
  useEffect(() => {
    if (open) {
      stopSpeaking();
      stopVoiced();
    }
  }, [open]);
  useEffect(() => {
    if (!shipLine) return undefined;
    const t = setTimeout(() => setShipLine(null), 2600 + shipLine.text.length * 55);
    return () => clearTimeout(t);
  }, [shipLine]);
  // a memory, from the chair: the room flashes its colour
  const playMemory = useCallback(
    (i) => {
      const s = sim.current;
      if (i >= MEMORIES.length) {
        s.mind = null;
        setMemory(null);
        return;
      }
      s.mind = { ...s.mind, i, next: s.t + MEMORY_S };
      setMemory({ i, ...MEMORIES[i], at: performance.now() });
      if (i === 1) complete('mindblowers');
      api.current?.act?.('mindblowers', 'play', MEMORIES[i].color);
      sound('zap');
    },
    [api, complete],
  );
  const timers = useRef(new Set());
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);
  useEffect(() => {
    const all = timers.current;
    return () => {
      all.forEach(clearTimeout);
      all.clear();
    };
  }, []);

  // ── Total Rickall ──
  // The egg picked up: the rules fetched (the first time), the room chosen
  // and everyone in it loaded, Morty kept in the living room meanwhile; one
  // whose model won't load is left out and the room chosen again without
  // them, and Morty is never in it (he's the one looking). Then the crosshair,
  // E for a memory of whoever's in it, F or a click to shoot them, till it
  // ends (a card) or he stops (Esc, or the button).
  const rkRules = useRef(null);
  // Morty's shots as bolts (./rmShots.js), loaded with Total Rickall's rules or a duel's start: { mod, shots, area }
  const shots = useRef(null);
  // the lock-on (./rmLockOn.js): the Lock button and Tab; shown on the button
  const lockOn = useRef(null);
  const [locked, setLocked] = useState(false);
  const toggleLock = useCallback(() => {
    lockOn.current?.toggle();
    audioContext();
  }, []);
  const loadShots = useCallback(async () => {
    if (!shots.current) {
      const mod = await import('./rmShots');
      shots.current ??= { mod, shots: mod.createShots(), area: null };
    }
    return shots.current;
  }, []);
  const [game, setGame] = useState(null); // what the HUD shows of it: { phase, left, secs, aim, told, end }
  const gameKey = useRef('');
  const recall = useRef(null); // the memory card, moved over whoever it's about each frame
  const stopRickall = useCallback(() => {
    const s = sim.current;
    if (!s.rickall) return;
    s.rickall = null;
    s.m = { ...s.m, mode: null };
    s.pitch = PITCH;
    s.keys.clear();
    gameKey.current = '';
    setGame(null);
  }, []);
  const startRickall = useCallback(
    async (seed = Math.floor(Math.random() * 1e9) + 1) => {
      const s = sim.current;
      const w = api.current;
      if (!w || s.area !== 'house' || s.rickall?.phase === 'hatching') return false;
      const run = { phase: 'hatching', seed, game: null, aim: null, hide: [], told: null, end: null, crowd: [], crowdN: -1 };
      s.rickall = run;
      s.m = { ...s.m, mode: 'rickall' };
      s.keys.clear();
      sound('splat');
      try {
        rkRules.current ??= await import('./interiors/rickall');
        await loadShots();
        const { newRickall } = rkRules.current;
        let absent = ['morty'];
        let g = null;
        for (let i = 0; i < 8 && !g; i++) {
          const next = newRickall(seed, { absent });
          const ids = next.people.map((p) => p.id);
          const ok = (await w.act('house', 'rickall', ids)) ?? [];
          if (s.rickall !== run || api.current !== w) return false; // (stopped, or the world gone, meanwhile)
          const missing = ids.filter((id) => !ok.includes(id));
          if (missing.length) absent = [...absent, ...missing];
          else g = next;
        }
        if (!g?.people.some((p) => p.parasite)) throw new Error('nobody to play with');
        run.game = g;
        run.phase = 'on';
        // Morty back at the egg, turned to the room, the camera behind him:
        // nobody's put where he's standing, and the crowd's in front of him
        const at = rkRules.current.MORTY_AT;
        s.m = newMorty(at, 'rickall');
        s.yaw = behindYaw(at.face);
        s.pitch = PITCH;
        s.dragAt = -1e9;
        sound('portalHop');
        return true;
      } catch (err) {
        if (import.meta.env.DEV) console.warn('C-137: Total Rickall', err);
        if (s.rickall === run) {
          stopRickall();
          say({ kind: 'note', bad: true, text: NO_HATCH });
        }
        return false;
      }
    },
    [api, say, stopRickall, loadShots],
  );
  // how it ended: a card, and if it's won, the thing to do done
  const endRickall = useCallback(
    (run) => {
      run.phase = 'over';
      run.told = null;
      run.end = rkRules.current.ending(run.game);
      if (run.end.kind === 'won') {
        complete('rickall');
        unlock('rickall');
      } else sound(run.end.kind === 'out' ? 'powerDown' : 'ouch');
    },
    [complete, unlock],
  );
  // F, or a click: a bolt at whoever's in the sights, or down the line to
  // whatever it meets (./rmShots.js); what it does is landRickall's, when it gets there
  const shootRickall = useCallback(() => {
    const s = sim.current;
    const run = s.rickall;
    if (run?.phase !== 'on' || !shots.current) return;
    audioContext();
    sound('zap');
    // (Morty's arm comes up with the shot, his feet left as they are)
    s.acted = true;
    api.current?.play('shoot', { layer: 'upper' });
    const R = rkRules.current;
    // (a tap on touch snaps onto someone just off the line: aim.js's cone for the input)
    const cone = coneFor({ coarse: touchRef.current, mode: looker.current?.mode });
    shots.current.shots.rickall({ m: s.m, sight: R.sight(s.m, s.yaw, s.pitch), aim: run.aim, game: run.game, solids: shots.current.mod.roomSolids('house'), cone, bodies: shots.current.mod.rickallBodies(run.game, run.hide) });
  }, [api]);
  // a bolt of his has hit someone in the crowd
  const landRickall = useCallback(
    (id) => {
      const run = sim.current.rickall;
      if (run?.phase !== 'on') return;
      const p = run.game.people.find((o) => o.id === id);
      const hit = p ? rkRules.current.shoot(run.game, p.id) : null;
      if (!hit) return;
      api.current?.fx('shot', { x: p.x, y: p.h * 0.6, z: p.z, parasite: p.parasite });
      if (run.told?.id === p.id) run.told = null;
      if (hit === 'parasite') sound('splat');
      else endRickall(run);
    },
    [api, endRickall],
  );
  // E: what Morty remembers of whoever's in the sights, the next memory of them each time
  const tellRickall = useCallback(() => {
    const run = sim.current.rickall;
    if (run?.phase !== 'on' || !run.aim) return;
    sim.current.acted = true;
    const r = rkRules.current.tell(run.game, run.aim);
    if (!r) return;
    const p = run.game.people.find((o) => o.id === run.aim);
    run.told = { id: p.id, name: p.name, text: r.memory.text, n: (run.told?.n ?? 0) + 1, at: performance.now() };
    sound('seed');
  }, []);

  // ── what E does ──
  // through a door, up the stairs or through the portal: a fade to black (or
  // green), and out the other side, the camera behind him; down the hatch or
  // up the ladder, a slower one, the lid clanking. A place not built yet (one
  // that loads when it's first entered) starts loading as the fade begins,
  // and the swirl holds till it's there; if the page is left, or the world
  // lost, meanwhile, the trip's off and what loaded is let go.
  const go = useCallback(
    (via) => {
      const s = sim.current;
      if (s.fading) return;
      // a planet's own portal: out of the game, back to space (a place left in
      // a hurry counted first, and a moment longer for it to be seen)
      if (planet && onLeave && isWayHome(via, planet.id)) {
        s.fading = true;
        s.keys.clear();
        const e = s.escape;
        const made = Boolean(e && e.area === planet.id && s.t - e.at <= e.s);
        if (made) {
          complete(e.task);
          unlock(e.task);
        }
        setFade('portal');
        sound('portalOpen');
        later(onLeave, FADE_MS + (made ? 900 : 0));
        return;
      }
      // (the garage's portal goes where the dial is set: read fresh, in case another tab's set it)
      dialRef.current = readDial();
      const l = linkTarget(via, dialRef.current);
      s.fading = true;
      s.keys.clear();
      const climb = l.kind === 'hatch';
      setFade(l.kind === 'portal' ? 'portal' : climb ? (l.to === 'basement' ? 'down' : 'up') : 'door');
      if (l.kind === 'portal') sound('portalOpen');
      else if (climb) sound('splat');
      const w = api.current;
      const loading = w && !w.hasArea(l.to) ? w.ensureArea(l.to) : null;
      later(async () => {
        if (loading) {
          if (l.kind === 'portal') setOpening(AREA_NAME[l.to] ?? null);
          await loading.catch(() => {});
          setOpening(null);
          if (api.current !== w || !w.hasArea(l.to)) {
            s.fading = false;
            setFade(null);
            return;
          }
        }
        stopRickall(); // (a trip anywhere is the end of Total Rickall)
        s.area = l.to;
        s.m = newMorty(l.arrive);
        // out of a portal, the camera stands off to one side, so the swirl
        // is beside him rather than between him and the camera
        s.yaw = behindYaw(l.arrive.face) + (l.kind === 'portal' ? 0.85 : 0);
        s.pitch = PITCH;
        s.dragAt = l.kind === 'portal' ? s.t : -1e9;
        s.keys.clear();
        s.fading = false;
        if (l.kind === 'portal') {
          // the portal on this side, swirling open behind him
          const far = LINKS.find((x) => x.area === l.to && x.kind === 'portal' && x.to === l.area);
          api.current?.fx('portal', { at: far ? { x: far.x, z: far.z } : { x: l.arrive.x, z: l.arrive.z } });
          sound('portalHop');
          // (Rick's portal, to Blips and Chitz: the President's is a thing to do of its own)
          if (l.id === 'garage-portal') complete('portal');
        }
        if (l.id === 'garage-hatch') complete('basement');
        if (l.id === 'garage-oval') complete('oval');
        // home from a place left in a hurry, inside the time it gave him
        const e = s.escape;
        if (e && l.id === `${e.area}-portal` && s.t - e.at <= e.s) {
          complete(e.task);
          unlock(e.task);
        }
        if (e?.area === l.area) s.escape = null;
        // (what he's used is for this visit, and the place he's left settles)
        s.used = new Set();
        api.current?.act(l.area, 'calm');
        setFade(null);
      }, climb ? CLIMB_MS : FADE_MS);
    },
    [api, complete, unlock, later, stopRickall, planet, onLeave],
  );
  const board = useCallback(() => {
    const s = sim.current;
    s.flying = true;
    s.landing = false;
    s.boardAt = { x: s.c.x, z: s.c.z };
    s.tookOff = false;
    s.fastT = 0;
    s.leftFrom = null;
    s.keys.clear();
    api.current?.fx('board');
    sound('boost');
    shipTalk('board');
  }, [api, shipTalk]);
  const touchDown = useCallback(() => {
    const s = sim.current;
    s.flying = false;
    s.landing = false;
    s.c = { ...s.c, y: CRUISER.hover, vy: 0, speed: 0, bank: 0, bankV: 0 };
    const out = exitCruiser(s.c, { motorcade: !doneRef.current.includes('president') });
    s.m = newMorty(out);
    s.yaw = behindYaw(out.face);
    s.pitch = PITCH;
    s.dragAt = -1e9;
    s.keys.clear();
    api.current?.fx('land');
    sound('powerDown');
    s.landedAt = s.t;
    s.leftFrom = { x: s.c.x, z: s.c.z };
    shipTalk('land');
  }, [api, shipTalk]);
  const act = useCallback(() => {
    const s = sim.current;
    if (!api.current || s.fading || s.landing) return;
    audioContext();
    s.acted = true; // (an emote's over: he's doing something)
    // (in Total Rickall, E is a memory of whoever's in the sights)
    if (s.rickall) {
      tellRickall();
      return;
    }
    if (s.flying) {
      if (canLand(s.c, { motorcade: !doneRef.current.includes('president') })) {
        // straight down from here: no drift into a roof's edge on the way
        s.landing = true;
        s.landT = 0;
        s.c = { ...s.c, speed: 0 };
        s.keys.clear();
      } else {
        say({ kind: 'note', bad: true, text: CANT_LAND });
        shipTalk('refuse');
      }
      return;
    }
    const n = s.near;
    if (!n) return;
    if (n.kind === 'link') go(n.link);
    else if (n.kind === 'cruiser') board();
    else if (n.spot?.kind === 'rickall') startRickall();
    else if (n.spot?.kind === 'trial') {
      // (from the first room, however the last go ended)
      s.keys.clear();
      if (trialRef.current.state !== 'on') retryRooms(trialRef.current);
      setTrial({ ...trialRef.current });
    }
    else if (PLACES[n.id]) {
      s.keys.clear();
      openPlace(n.id);
    } else if (n.id === 'chair') {
      // sat in the chair, the helmet on: the memories, one after another, till
      // he gets up (E again: the next one)
      s.keys.clear();
      if (s.mind) playMemory(s.mind.i + 1);
      else {
        s.mind = { x: s.m.x, z: s.m.z, i: 0, next: 0 };
        playMemory(0);
      }
    } else if (n.id === 'dial') openDial();
    else if (SAY[n.id]) {
      // (a place's clock starts only once what comes first is done: the
      // scanner finds nothing on him till he's taken the seeds)
      const e = ESCAPES[n.id];
      const early = e?.after && !s.used?.has(e.after);
      const line = early ? e.before : SAY[n.id];
      say({ kind: 'say', ...line });
      (s.used ??= new Set()).add(n.id);
      // someone to talk to: their head turns to him and their hands go while
      // the line plays (state.talk), his head on them; a wave from him first,
      // unless they're after him
      const who = PEOPLE.find((p) => p.id === (TALK_TO[n.id] ?? n.id) && p.area === s.area);
      if (who) {
        s.talkN += 1;
        s.talk = { id: who.id, n: s.talkN, hold: lineHold(line?.text), x: who.x, z: who.z, at: s.t, area: s.area };
        if (!who.ai?.hunt && !n.spot?.anim) api.current?.play('wave', { layer: 'upper' });
      }
      if (!early && n.spot?.anim) api.current?.play(n.spot.anim, n.spot.anim === 'dance' ? { loop: false, hold: 0.2 } : {});
      if (!early && ACTS[n.id]) api.current?.act(...ACTS[n.id]);
      // the siren, the scanner, the toast: the clock starts for the portal home
      if (e && !early && !s.escape) {
        s.escape = { ...e, at: s.t };
        sound('siren');
      }
      // (done once they've had their say: the President gets in his car then)
      if (TALK_DONE[n.id]) later(() => complete(TALK_DONE[n.id]), TALK_MS);
      if (COLLECT[n.id] && COLLECT[n.id].spots.every((id) => s.used.has(id))) {
        const c = COLLECT[n.id];
        // (the last one found: the place is told, and either it's done or the clock starts)
        api.current?.act(c.area, 'collected');
        if (c.escape) {
          if (!s.escape) s.escape = { area: c.area, task: c.task, s: c.escape.s, at: s.t };
          sound('siren');
        } else if (!c.start) later(() => complete(c.task), TALK_MS);
      }
      if (TALK_UNLOCK[n.id]) later(() => unlock(TALK_UNLOCK[n.id]), TALK_MS);
    }
  }, [api, go, board, openPlace, openDial, say, complete, unlock, playMemory, shipTalk, later, startRickall, tellRickall]);
  // what a place's people do to Morty (stage.js's NPC behaviour, through the
  // render state's emit): caught, he's put back at the way in with what the
  // catcher said, and the place settles; a bark is a line said in passing
  const npc = useCallback(
    (name, e) => {
      const s = sim.current;
      if (!s || s.fading || s.area !== e.area) return;
      if (name === 'caught') {
        const d = destinationById(e.area);
        if (!d) return;
        say({ kind: 'say', who: SAY[e.who]?.who ?? e.who ?? null, text: e.text ?? d.caught ?? 'Caught.' });
        sound('grab');
        api.current?.shake?.(0.3); // (the Citadel's caught, the same grab)
        api.current?.play('scared', { hold: 0.4, layer: 'auto' });
        // a blink, and he's back at the way in
        s.fading = true;
        s.keys.clear();
        setFade('door');
        later(() => {
          s.m = newMorty(d.arrive);
          s.yaw = behindYaw(d.arrive.face);
          s.pitch = PITCH;
          s.dragAt = -1e9;
          s.used = new Set();
          s.escape = null;
          s.fading = false;
          api.current?.act(e.area, 'calm');
          setFade(null);
        }, FADE_MS);
      } else if (name === 'bark') {
        if (s.t - (s.barkAt ?? -1e9) < 6) return;
        s.barkAt = s.t;
        say({ kind: 'say', who: e.who, text: e.text });
      } else if (name === 'done') complete(e.task);
      else if (name === 'spotted') {
        // someone's seen him: a word and a sound, not too often
        if (s.t - (s.spottedAt ?? -1e9) < 8) return;
        s.spottedAt = s.t;
        sound('alarm');
        say({ kind: 'say', who: SAY[e.who]?.who ?? null, text: e.text ?? 'They’ve seen you.' });
      } else if (name === 'duel') {
        // the fight's on: the hearts show, and F fires (its bolts loaded now)
        loadShots();
        s.duel = { who: e.who, hp: e.hp, max: e.max, mortyHp: e.mortyHp, mortyMax: e.mortyMax };
        setDuel({ ...s.duel });
        sound('zap');
      } else if (name === 'strike') {
        s.duel = { who: e.who, hp: e.hp, max: e.max, mortyHp: e.mortyHp, mortyMax: e.mortyMax };
        setDuel({ ...s.duel });
        sound('thud');
        if (e.beaten) {
          // beaten: he goes down, and comes round at the way in; the fight's off till the next try
          api.current?.play('fall', { hold: 1.2 });
          say({ kind: 'say', who: SAY[e.who]?.who ?? e.who ?? null, text: e.text ?? 'Beaten.' });
          const d = destinationById(e.area);
          s.fading = true;
          s.keys.clear();
          later(() => {
            setFade('door');
            later(() => {
              if (d) {
                s.m = newMorty(d.arrive);
                s.yaw = behindYaw(d.arrive.face);
                s.pitch = PITCH;
                s.dragAt = -1e9;
              }
              s.used = new Set();
              s.escape = null;
              s.duel = null;
              setDuel(null);
              s.fading = false;
              api.current?.act(e.area, 'calm');
              setFade(null);
            }, FADE_MS);
          }, 1400);
        } else api.current?.play('hit', { layer: 'auto' });
      }
    },
    [api, say, complete, later, loadShots],
  );
  // Morty's shot in a duel (F): a bolt at the hunter if he's in the cone
  // (the place says where), else along his facing; the arena's walls stop
  // it, and landDuel hears what it did if it gets to him
  const fire = useCallback(() => {
    const s = sim.current;
    if (!s?.duel || s.fading || s.t - (s.firedAt ?? -1e9) < 0.5 || !shots.current) return;
    s.firedAt = s.t;
    s.acted = true;
    // (his arm comes up with the shot; his feet keep doing what they were)
    api.current?.play('shoot', { hold: 0, layer: 'upper' });
    sound('zap');
    const r = api.current?.act(s.area, 'fire', { x: s.m.x, z: s.m.z, face: s.m.face });
    shots.current.shots.duel({ m: s.m, at: r?.at ?? null });
  }, [api]);
  const landDuel = useCallback(
    (r) => {
      const s = sim.current;
      if (!r || !s?.duel) return;
      s.duel = { ...s.duel, hp: r.hp, max: r.max };
      setDuel({ ...s.duel });
      if (r.down) {
        sound('splat');
        if (r.task) complete(r.task);
        if (r.won) later(() => say({ kind: 'say', ...r.won }), 900);
        later(() => {
          s.duel = null;
          setDuel(null);
        }, 2500);
      }
    },
    [complete, say, later],
  );
  const fns = useRef({});
  fns.current = { act, go, shoot: shootRickall, landRickall, stop: stopRickall, start: startRickall, end: endRickall, npc, fire, landDuel, gun: openDial };

  // ── the world: made once, kept while something's open over it ──
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createRmWorld }) => {
        if (dead || !canvas.current) return null;
        return createRmWorld(canvas.current, { onLost: () => !dead && setGl('lost'), looks: looksRef.current });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        a.tune?.(pressGroups(sim.current.press)); // (behind ?debug: the feel's numbers and the jump's)
        a.act?.('arcade', 'setBoard', readBest());
        a.setLooks?.(looksRef.current); // (a look picked while it loaded)
        if (import.meta.env.DEV) {
          // for the QA scripts (scripts/c137-shots.mjs): where everyone is, E,
          // a jump to anywhere, and a trip anywhere the way a door makes it
          const s = sim.current;
          const land = () => {
            if (s.flying) s.c = { ...s.c, y: CRUISER.hover, vy: 0, speed: 0, bank: 0, bankV: 0 };
            s.flying = false;
            s.landing = false;
          };
          const warp = (area, x, z, face = Math.PI / 2) => {
            land();
            s.area = area;
            s.m = newMorty({ x, z, face }, s.m.mode); // (in Total Rickall, still in the living room)
            s.yaw = behindYaw(face);
            s.keys.clear();
          };
          window.__C137__ = Object.assign(window.__C137__ ?? {}, {
            api: a,
            sim: s,
            act: () => fns.current.act(),
            complete,
            warp,
            // the portal gun's dial, set as the stand in the garage sets it
            dial(id) {
              writeDial(id);
              dialRef.current = portalTarget(id);
              return dialRef.current;
            },
            // Total Rickall, with `seed` (by the egg first, if he isn't in the
            // house): resolves true once it's on. Then lookAt(id) stands Morty
            // in front of someone with them in the sights, as a player would,
            // and shoot() is F. (sim.rickall has the game.)
            rickall(seed = 1) {
              if (s.area !== 'house') warp('house', -305.1, -6.5, 0);
              return fns.current.start(seed);
            },
            // (from the room's middle side of them first, then round either
            // way, the first place he can stand with them in the sights)
            lookAt(id, back = 1.3) {
              const R = rkRules.current;
              const run = s.rickall;
              const p = run?.game?.people.find((o) => o.id === id);
              if (!p || !R) return false;
              const mid = { x: -301.8, z: -4.95 }; // (the living room's middle)
              const toward = Math.atan2(mid.z - p.z, mid.x - p.x);
              for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
                const a = toward + turn;
                const at = { x: p.x + Math.cos(a) * (p.r + back), z: p.z + Math.sin(a) * (p.r + back) };
                const m = newMorty({ ...at, face: Math.atan2(-(p.z - at.z), p.x - at.x) }, 'rickall');
                const stood = stepMorty(m, { x: 0, z: 0 }, 1 / 60, 'house', { crowd: crowdOf(run) });
                if (Math.hypot(stood.x - at.x, stood.z - at.z) > 0.01) continue;
                let yaw = s.yaw;
                for (let i = 0; i < 4; i++) {
                  const o = R.sight(m, yaw);
                  yaw = Math.atan2(-(p.x - o.x), -(p.z - o.z));
                }
                const o = R.sight(m, yaw);
                const pitch = Math.atan2(o.y - p.h * 0.6, Math.hypot(p.x - o.x, p.z - o.z)) + R.SIGHT.level - R.SIGHT.tip;
                if (R.aimAt(run.game, R.sight(m, yaw, pitch)) !== id) continue;
                s.m = m;
                s.yaw = yaw;
                s.pitch = pitch;
                s.dragAt = s.t;
                s.keys.clear();
                return true;
              }
              return false;
            },
            shoot: () => fns.current.shoot(),
            stopRickall: () => fns.current.stop(),
            // through a door that isn't there: the fade, a place that loads
            // when it's entered built first, and Morty out at (x, z) facing
            // `face`, the camera behind him. False if he's already on his way
            // somewhere.
            goto(area, x, z, face = Math.PI / 2) {
              if (!AREAS[area]) throw new Error(`C-137: no area ${area}`);
              if (s.fading) return false;
              land();
              fns.current.go({ id: 'goto', area: s.area, kind: 'door', to: area, label: '', arrive: { x, z, face } });
              return true;
            },
            // true once he's there and nothing's still loading: the place, and
            // whoever's in it
            ready: () => api.current === a && !a.lost && !s.fading && a.hasArea(s.area) && a.loading() === 0,
          });
        }
        // a planet: built before Morty's put in it, and its portal swirling open behind him
        if (planet) {
          if (!a.hasArea(planet.area)) await a.ensureArea(planet.area).catch(() => {});
          if (dead || api.current !== a || a.lost) return; // (gone, or the context lost meanwhile: it's said so)
          a.fx('portal', { at: planet.back });
          sound('portalHop');
        }
        fit();
        // everything on the graphics chip before it's shown, behind the loading screen
        await a.prepare?.(throttled(setPrep), { alive: () => !dead && api.current === a });
        if (dead || api.current !== a) return;
        setGl('on');
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    return () => {
      dead = true;
      ro?.disconnect();
      api.current?.dispose();
      api.current = null;
      setGl((g) => (g === 'on' ? 'loading' : g));
    };
  }, [api, setGl, complete, planet]);

  // keys and the frame loop only while the world's on screen and nothing's
  // open over it (closing the effect lets go of every key held)
  const live = gl === 'on' && inView && !open;
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || wardrobeRef.current) return; // (the wardrobe's open over him: he stands still)
      const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
      // C: the wardrobe, on foot (flying, it's the cruiser's way down)
      if (e.code === 'KeyC' && !s.flying && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
        e.preventDefault();
        s.keys.clear();
        setWardrobe(true);
        return;
      }
      // B, held: the emote wheel (let go over one to strike it; a tap, the last again)
      if (e.code === 'KeyB' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat && !s.flying && !s.rickall) wheel.current.down(s.t);
        return;
      }
      // (the wheel open: 1 to 5 strike one, Esc puts it away)
      if (wheel.current.open && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const i = /^Digit[1-5]$/.test(e.code) ? Number(e.code.slice(5)) - 1 : -1;
        if (i >= 0) {
          e.preventDefault();
          strike(wheel.current.choose(i));
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          wheel.current.cancel();
          return;
        }
      }
      // P: the portal gun's dial, from anywhere in C-137 (not on a planet; openDial says when else not)
      if (!planet && isGunKey(e)) {
        e.preventDefault();
        fns.current.gun();
        return;
      }
      // Tab, in a fight: the lock-on (./rmLockOn.js), as the Lock button
      if ((s.duel || s.rickall) && e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) toggleLock();
        return;
      }
      // a duel (Evil Rick's lair): F fires
      if (s.duel && !s.rickall && e.code === 'KeyF' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) fns.current.fire();
        return;
      }
      // Total Rickall: F shoots; Esc stops it (once the list's shut)
      if (s.rickall && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.code === 'KeyF') {
          e.preventDefault();
          if (!e.repeat) fns.current.shoot();
          return;
        }
        if (e.key === 'Escape' && !listRef.current) {
          e.preventDefault();
          fns.current.stop();
          return;
        }
      }
      const m = keyDown(s.keys, e);
      const f = e.metaKey || e.ctrlKey || e.altKey ? null : FLY_KEYS[e.code];
      if (f) s.keys.add(f);
      if (m || f) {
        // (Space is the cruiser's climb; walking, Morty's jump)
        if (m !== 'run' && !(m === 'space' && onButton)) e.preventDefault();
        if (m === 'space' && !onButton && !s.flying && !e.repeat) {
          s.jump = true;
          s.press.press();
        }
        audioContext();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.key === 'e' || e.key === 'E' || (e.key === 'Enter' && !onButton)) {
        e.preventDefault();
        fns.current.act();
      } else if (e.key === 'm' || e.key === 'M') {
        if (listRef.current) closeList();
        else setList(true);
      } else if (e.key === 'Escape' && listRef.current) closeList();
    };
    const up = (e) => {
      if (e.code === 'KeyB') strike(wheel.current.up(s.t));
      keyUp(s.keys, e);
      if (FLY_KEYS[e.code]) s.keys.delete(FLY_KEYS[e.code]);
    };
    const blur = () => {
      s.keys.clear();
      wheel.current.cancel();
    };
    // the mouse, while the wheel's open: which one it's over (from the middle of the view)
    const aim = (e) => {
      if (!wheel.current.open) return;
      const r = canvas.current?.getBoundingClientRect();
      if (r) wheel.current.aim((e.clientX - (r.left + r.width / 2)) / WHEEL_R, (e.clientY - (r.top + r.height / 2)) / WHEEL_R);
    };
    window.addEventListener('pointermove', aim);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointermove', aim);
      wheel.current.cancel();
      s.keys.clear();
    };
  }, [live, closeList, strike, planet, toggleLock]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const dt = Math.min(0.05, ms / 1000);
    s.t += dt;
    const k = s.keys;
    const raw = readPad();
    const before = s.padBefore;
    s.padBefore = raw ?? {};
    const pad = wardrobeRef.current ? null : raw; // (the wardrobe's open over him: the pad's for it)
    const pressed = (b) => pad?.[b] && !before[b];
    if (pressed('a')) fns.current.act();
    if (pressed('x') && s.rickall) fns.current.shoot();
    if (pressed('b') && listRef.current) closeList();
    if (pressed('y')) {
      if (listRef.current) closeList();
      else setList(true);
    }

    // the emote wheel's look, when it changes; Morty's emote, over once its
    // clip is, once he walks off (but for a wave), or once he does anything
    const wq = wheel.current.tick(s.t);
    const wk = wq.open ? `open|${wq.hover}` : '';
    if (wk !== wheelKey.current) {
      wheelKey.current = wk;
      setWheelUi(wq.open ? { hover: wq.hover } : null);
    }
    s.emote = keepEmote(s.emote, s.t, { moving: (s.m.speed ?? 0) > 0.4, acted: s.acted || s.jump || s.flying || s.fading });
    s.acted = false;

    if (s.flying) {
      let throttle = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) - s.stick.y;
      let steer = (k.has('left') ? 1 : 0) - (k.has('right') ? 1 : 0) - s.stick.x;
      let lift = (k.has('space') || k.has('rise') ? 1 : 0) - (k.has('run') || k.has('sink') ? 1 : 0) + s.lift;
      if (pad) {
        throttle += (pad.rt ? 1 : 0) - (pad.lt ? 1 : 0) - pad.ly;
        steer -= pad.lx;
        lift += (pad.rb ? 1 : 0) - (pad.lb ? 1 : 0) - pad.ry;
      }
      if (s.landing) throttle = steer = lift = 0;
      s.c = stepCruiser(s.c, { throttle: clamp1(throttle), steer: clamp1(steer), lift: clamp1(lift) }, dt);
      // a bump (the edge, a roof, the ground) knocks as hard as the speed it
      // took, by the hit law, with its shake; a set-down sinks onto its
      // hover height on purpose and isn't one
      if (s.c.bump > 0 && !s.landing) api.current?.hit?.(s.c.bump * 20, [s.c.x, s.c.y, s.c.z]);
      if (Math.abs(throttle) + Math.abs(steer) + Math.abs(lift) > 0.1) s.moved = true;
      // set down: it sinks to its hover height, quicker the higher it is; if
      // the ground under it isn't open after all (or it takes too long), it
      // stays up and the controls come back
      if (s.landing) {
        s.landT += dt;
        if (floorAt(s.c.x, s.c.z) > CRUISER.hover + 0.01 || !inArea('street', s.c.x, s.c.z) || s.landT > 6) {
          s.landing = false;
          say({ kind: 'note', bad: true, text: CANT_LAND });
          shipTalk('refuse');
        } else {
          s.c.y = Math.max(CRUISER.hover, s.c.y - Math.max(4, (s.c.y - CRUISER.hover) * 2.6) * dt);
          s.c.vy = -2;
          if (s.c.y <= CRUISER.hover + 0.01) touchDown();
        }
      }
      // the first take-off: up off the driveway, or away along the street
      if (s.flying && s.boardAt && !doneRef.current.includes('fly') && (s.c.y > CRUISER.hover + 1.5 || Math.hypot(s.c.x - s.boardAt.x, s.c.z - s.boardAt.z) > 5)) complete('fly');
      // the cruiser has something to say: up, fast, at the ceiling, the Federation behind
      if (s.flying && !s.landing) {
        if (!s.tookOff && s.c.y > CRUISER.hover + 2) {
          s.tookOff = true;
          shipTalk('takeoff');
        }
        s.fastT = Math.abs(s.c.speed) > CRUISER.top * 0.85 ? s.fastT + dt : 0;
        if (s.fastT > 1.2) shipTalk('fast');
        if (s.c.y > CRUISER.ceiling - 0.5) shipTalk('ceiling');
        if (onTail(s.fed, s.c)) shipTalk('tail');
      }
    } else {
      let fwd = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) - s.stick.y;
      let side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + s.stick.x;
      if (pad) {
        fwd -= pad.ly;
        side += pad.lx;
        if (pad.rx) {
          s.yaw -= pad.rx * dt * 2.4;
          s.dragAt = s.t;
        }
      }
      if (s.fading) fwd = side = 0;
      const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb);
      const mv = cameraMove(s.yaw, clamp1(fwd), clamp1(side));
      // (a press made while the screen's fading is let go: he's being put somewhere else)
      if (s.fading) s.press.reset();
      const around = s.area === 'street' ? { cruiser: { x: s.c.x, z: s.c.z }, motorcade: !doneRef.current.includes('president') } : s.rickall?.game ? { crowd: crowdOf(s.rickall) } : {};
      s.m = stepMorty(s.m, { x: mv.x, z: mv.z, run }, dt, s.area, { ...around, press: s.press });
      s.jump = false;
      // a landing harder than his own jump's (off a roof, a counter, the
      // stoop): a knock by the hit law, and the shake it says. His own jump
      // lands at 5.4 m/s, under the 6 that starts it, so a hop is quiet.
      if (s.m.land > 6) api.current?.hit?.((s.m.land - 6) * 20, [s.m.x, s.m.y, s.m.z]);
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
      // in Total Rickall, stood still, he turns to face the way he's aiming
      if (s.rickall?.game && s.m.speed < 0.5) {
        const d = Math.atan2(Math.cos(s.yaw), -Math.sin(s.yaw)) - s.m.face;
        s.m.face += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 10);
      }
      // out over the open hatch: down it
      const drop = s.fading ? null : dropAt(s.area, s.m.x, s.m.z, s.m.y);
      if (drop) go(drop);
      // up out of the Mind Blowers chair: the memories stop; sat, they go on
      if (s.mind && (s.area !== 'mindblowers' || Math.hypot(s.m.x - s.mind.x, s.m.z - s.mind.z) > CHAIR_R)) {
        s.mind = null;
        setMemory(null);
      } else if (s.mind && s.t > s.mind.next) playMemory(s.mind.i + 1);
      // the cruiser, parked: a word as he walks off, a hello as he comes back, and now and then a thought
      if (s.area === 'street') {
        const d = Math.hypot(s.m.x - s.c.x, s.m.z - s.c.z);
        if (s.leftFrom && d > 7) {
          s.leftFrom = null;
          shipTalk('leave');
        } else if (d < 4.5 && s.t - s.landedAt > 12 && s.t > 6) shipTalk('hello');
        else if (d < 14 && s.t > 30) shipTalk('idle');
      }
      // the camera drifts round behind him as he walks, unless it's just been turned
      if (s.m.speed > 0.5 && s.t - s.dragAt > 1.4) {
        const d = behindYaw(s.m.face) - s.yaw;
        s.yaw += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 1.6);
        s.pitch += (PITCH - s.pitch) * Math.min(1, dt * 0.8);
      }
    }

    // what he's next to: a door, then a thing to touch, then the cruiser; or, flying, somewhere to land
    let near = null;
    const motorcade = !doneRef.current.includes('president');
    s.motorcade = motorcade;
    if (s.flying) near = !s.landing && canLand(s.c, { motorcade }) ? 'land' : null;
    else if (!s.fading && !s.rickall) {
      const l = nearLink(s.area, s.m.x, s.m.z, doneRef.current);
      const h = l ? null : nearHotspot(s.area, s.m.x, s.m.z, doneRef.current);
      near = l ? `link:${l.id}` : h ? `spot:${h.id}` : s.area === 'street' && Math.hypot(s.m.x - s.c.x, s.m.z - s.c.z) < BOARD_R ? 'cruiser' : null;
    }
    s.near = near ? PROMPT[near] : null;
    s.view.link = s.near?.kind === 'link' ? s.near.id : null;
    s.view.hotspot = s.near?.kind === 'spot' ? s.near.id : null;
    // the Federation's patrol ship, round its loop or on the cruiser's tail
    s.fed = stepFedShip(s.fed, s.c, s.flying, dt);
    // the clock of a place left in a hurry, for the HUD (whole seconds, so it rarely redraws)
    const left = s.escape && s.area === s.escape.area ? Math.max(0, Math.ceil(s.escape.s - (s.t - s.escape.at))) : null;
    if (left !== clockRef.current) {
      // (its last ten seconds tick, and it's heard running out)
      if (left != null && left <= 10) sound(left === 0 ? 'timeUp' : 'tick');
      clockRef.current = left;
      setClock(left);
    }
    if (s.escape && left === 0) s.escape = null;
    // what the cruiser was about to say when it'd only just spoken
    if (s.shipNext) {
      if (s.t > s.shipNext.until || s.area !== 'street') s.shipNext = null;
      else shipTalk(s.shipNext.event);
    }

    // others online: where you are to them (on foot, in the street or a room:
    // only those in the same one see you), and where they are
    const tv = trav.ref.current;
    // (and what he's doing: his emote, and how he moves, for their figure of him)
    const turn = s.lastFace == null ? 0 : Math.atan2(Math.sin(s.m.face - s.lastFace), Math.cos(s.m.face - s.lastFace)) / Math.max(dt, 1e-3);
    s.lastFace = s.m.face;
    tv?.pose(s.m, { inside: Boolean(s.flying), area: s.area, emote: s.flying ? null : emotePacket(s.emote, s.t), move: s.flying ? null : { speed: s.m.speed ?? 0, side: 0, turn } });

    // Total Rickall: off, if he's somehow out of the house; the clock; the
    // line the camera's put on, how far back along it, and who's too close
    // to it to be seen; and who's in the sights along it
    // the lock-on: on by itself near a duel's hunter on touch; the camera (or
    // Morty, in a duel) kept on who it's on
    lockOn.current ??= createLockOn({ coarse: touchRef.current });
    const hunter = s.duel ? ((a.act(s.area, 'bodies') || [])[0] ?? null) : null;
    stepRmLockOn(lockOn.current, s, dt, { R: rkRules.current, hunter });
    if (lockOn.current.on !== s.lockShown) {
      s.lockShown = lockOn.current.on;
      setLocked(s.lockShown);
    }

    let sightLine = null;
    if (s.rickall && (s.area !== 'house' || s.flying)) fns.current.stop();
    const run = s.rickall;
    if (run?.game) {
      const R = rkRules.current;
      if (run.phase === 'on' && R.stepRickall(run.game, dt)) fns.current.end(run);
      sightLine = R.sight(s.m, s.yaw, s.pitch);
      const v = R.view(run.game, sightLine);
      sightLine.back = v.back;
      run.hide = v.hide;
      run.aim = run.phase === 'on' ? R.aimAt(run.game, sightLine) : null;
      if (run.told && (performance.now() - run.told.at > RECALL_MS || run.game.shot.includes(run.told.id))) run.told = null;
    }

    // Morty's bolts in flight (./rmShots.js): the room's solids, the crowd
    // and a duel's hunter as bodies; where each ends, and what it did
    const sh = shots.current;
    let boltHits = null;
    if (sh && sh.area !== s.area) {
      sh.shots.clear();
      sh.area = s.area;
    }
    if (sh?.shots.live().length) {
      const bodies = [...(run?.game ? sh.mod.rickallBodies(run.game, run.hide) : []), ...((s.duel && a.act(s.area, 'bodies')) || [])];
      for (const e of sh.shots.step(dt, { solids: sh.mod.roomSolids(s.area), bodies })) {
        if (e.type === 'hit' || e.type === 'solid') (boltHits ??= []).push(e.at);
        if (e.type !== 'hit') continue;
        if (e.bolt.tag === 'rickall') fns.current.landRickall(e.body.ref.id);
        else if (e.body.ref === 'duel') fns.current.landDuel(a.act(s.area, 'hit', e.body.id));
      }
    }

    s.emit ??= (name, e) => s.events.push([name, e]);
    try {
      a.render(
        {
          area: s.area,
          morty: s.m,
          flying: s.flying,
          cruiser: s.c,
          camYaw: s.yaw,
          camPitch: s.pitch,
          near: s.view,
          done: doneRef.current,
          fed: s.fed,
          travellers: tv ? tv.list() : null,
          sight: sightLine,
          rickall: run?.game ? { game: run.game, aim: run.aim, hide: run.hide } : null,
          fading: s.fading,
          emit: s.emit,
          // (Morty's word to someone, while it plays, in the area he said it in; his emote)
          talk: s.talk && s.talk.area === s.area && s.t - s.talk.at < s.talk.hold ? s.talk : null,
          emote: readEmote(s, s.t),
          bolts: sh ? sh.shots.live() : null,
          boltHits,
        },
        ms,
      );
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    // what the place's people did this frame (stage.js's NPC behaviour)
    if (s.events.length) {
      const evs = s.events.splice(0);
      for (const [name, e] of evs) fns.current.npc?.(name, e);
    }

    // its HUD, when what it shows changes, and the memory card over whoever it's about
    if (run || gameKey.current) {
      const R = rkRules.current; // (there once there's a game)
      const left = run?.game ? R.parasitesLeft(run.game) : 0;
      const secs = run?.game ? Math.max(0, Math.ceil(R.RICKALL.time - run.game.t)) : 0;
      const aim = run?.aim ? run.game.people.find((p) => p.id === run.aim) : null;
      const gkey = run ? `${run.phase}|${left}|${secs}|${aim?.id}|${run.told?.n}|${run.end?.kind}` : '';
      if (gkey !== gameKey.current) {
        gameKey.current = gkey;
        setGame(run ? { phase: run.phase, left, secs, aim: aim ? { id: aim.id, name: aim.name } : null, told: run.told, end: run.end } : null);
      }
      const el = recall.current;
      const p = run?.told && run.game.people.find((o) => o.id === run.told.id);
      const at = p ? a.project(p.x, p.h + 0.3, p.z) : null;
      if (el) {
        el.style.visibility = at ? 'visible' : 'hidden';
        if (at) {
          // (kept on screen, and below the title and the map if it'd be over them)
          const c = canvas.current.getBoundingClientRect();
          const half = el.offsetWidth / 2;
          const x = Math.max(half + 12, Math.min(c.width - half - 12, at.x));
          let top = Math.max(12, at.y - el.offsetHeight);
          for (const box of [brand.current, map.current?.parentElement]) {
            const r = box?.getBoundingClientRect();
            if (r && x - half < r.right - c.left && x + half > r.left - c.left && top < r.bottom - c.top) top = r.bottom - c.top + 10;
          }
          el.style.transform = `translate(${x.toFixed(1)}px, ${(top + el.offsetHeight).toFixed(1)}px) translate(-50%, -100%)`;
        }
      }
    }

    // the HUD, when what it shows changes
    const room = s.flying ? null : roomAt(s.area, s.m.x, s.m.z);
    const alt = s.flying ? Math.round(s.c.y) : 0;
    const kmh = s.flying ? Math.round((Math.abs(s.c.speed) * 3.6) / 2) * 2 : 0;
    const key = `${s.area}|${room}|${s.flying}|${s.landing}|${near}|${s.moved}|${alt}|${kmh}`;
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ area: s.area, room, flying: s.flying, landing: s.landing, near, moved: s.moved, alt, kmh });
    }
    if (++s.frame % 3 === 0) {
      // the place's people, for the map (stage.js's NPC layer says where they are)
      s.npcs = api.current?.act(s.area, 'npcs') ?? null;
      drawMap(map.current, s, goalOf(progRef.current.next, s, planet), s.t);
    }
  }, live);

  // something open over the world: let go of the stick and the up and down buttons
  useEffect(() => {
    if (!open) return;
    const s = sim.current;
    s.stick = { x: 0, y: 0 };
    s.lift = 0;
    // (the kit's stick, in RmHud: its knob back to the middle)
    const knob = canvas.current?.parentElement?.querySelector('.hud-stick');
    knob?.style.removeProperty('--sx');
    knob?.style.removeProperty('--sy');
  }, [open]);

  // ── the pointer. A mouse or a trackpad looks through runtime/look.js: a
  // click locks the pointer and its movement turns the view (and in Total
  // Rickall a click is a shot), Esc lets go; a drag where the lock's refused
  // or Drag was picked (the galaxy's Menu keeps the pick for every world).
  // A finger drags the view round, as it always did. ──
  const looker = useRef(null);
  useEffect(() => {
    const host = canvas.current;
    if (!host) return undefined;
    const sense = () => setLooking({ mode: l.mode, locked: l.locked });
    const l = createLook({
      host,
      drag: { yaw: 0.0065, pitch: 0.004 },
      onTurn: (dx, dy) => {
        const s = sim.current;
        s.yaw -= dx;
        s.pitch = Math.max(-0.1, Math.min(0.95, s.pitch + dy));
        s.dragAt = s.t;
      },
      onButton: (which, down) => {
        if (which === 0 && down && sim.current.rickall) fns.current.shoot();
      },
      onLock: sense,
    });
    l.attach();
    looker.current = l;
    sense();
    return () => {
      l.detach();
      looker.current = null;
    };
  }, []);
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') audioContext();
    // (a mouse's the look's, unless the look is touch's)
    if (e.pointerType !== 'touch' && looker.current && looker.current.mode !== 'touch') return;
    if (e.type === 'pointerdown') {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, x0: e.clientX, y0: e.clientY, at: performance.now() };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (e.type === 'pointermove') {
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        drag.current = null;
        return;
      }
      // (slower over someone in Total Rickall's sights: aim.js's friction)
      const k = s.rickall?.aim ? FRICTION : 1;
      s.yaw -= (e.clientX - d.x) * 0.0065 * k;
      s.pitch = Math.max(-0.1, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' || s.rickall ? 0.004 : 0) * k));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
    if (e.type === 'pointerup' && s.rickall && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < CLICK.px && performance.now() - d.at < CLICK.ms) fns.current.shoot();
  };

  // the touch stick (the kit's, in RmHud): drag from where the thumb goes
  // down; the sound wakes on the touch itself, as iOS wants
  const onStick = (x, y) => {
    sim.current.stick = { x, y };
  };
  const onStickStart = () => audioContext();
  const onJump = () => {
    sim.current.jump = true;
    sim.current.press.press();
    audioContext();
  };
  // up and down, held, while flying (the kit's button lets go once, on the
  // lift, a lost touch or the window going)
  const onLift = (dir) => {
    sim.current.lift = dir;
    if (dir) audioContext();
  };

  // (the garage portal says where it's dialled; a planet's own portal is the way back to space)
  const here = relabel(hud.near ? PROMPT[hud.near] : null, { planet, portal: planet ? null : portalName(dialRef.current) });
  const back = backLink(planet);
  const placeName = hud.flying ? 'Over the Smiths’ street' : (hud.room ?? AREA_NAME[hud.area]);
  return (
    <div ref={box} className="rm-world-stage" data-touch={touch || undefined} data-flying={hud.flying || undefined} data-area={hud.area}>
      <canvas
        ref={canvas}
        className="rm-world-canvas"
        data-on={gl === 'on' || undefined}
        role="img"
        aria-label={planet ? `${planet.name} in 3D: Morty in front of the portal he came through, his way back to space` : 'The Smiths’ street in 3D: the Smith house with Rick’s garage, Harry Herpson High across the road, Rick’s space cruiser in the driveway, and Morty on the sidewalk'}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerUp={onPointer}
        onPointerCancel={onPointer}
        onLostPointerCapture={onPointer}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="rm-fade" data-on={fade || undefined} data-kind={fade ?? undefined} aria-hidden="true" />
      {opening && (
        <div className="rm-loading rm-opening" role="status">
          <span className="rm-swirl" aria-hidden="true" />
          <p>Opening a portal to {inLine(opening)}…</p>
        </div>
      )}
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title={`Opening a portal${planet ? ` to ${planet.name}` : ''}`} />

      <RmHud
        touch={touch}
        gl={gl}
        hud={hud}
        planet={planet}
        game={game}
        prog={prog}
        duel={duel}
        clock={clock}
        placeName={placeName}
        list={list}
        done={done}
        trav={trav}
        wardrobe={wardrobe}
        looks={looks}
        dialing={dialing}
        dialValue={dialRef.current}
        trial={trial}
        trialItems={trialItems}
        toast={toast}
        shipLine={shipLine}
        memory={memory}
        here={here}
        back={back}
        wheelUi={wheelUi}
        touchWheel={touchWheel}
        mapSize={[MAP_W * MAP_PX, MAP_H * MAP_PX]}
        brand={brand}
        map={map}
        chip={chip}
        listBox={listBox}
        recall={recall}
        onStickStart={onStickStart}
        stopRickall={stopRickall}
        onToggleList={() => setList((v) => !v)}
        onWardrobe={() => setWardrobe(true)}
        closeWardrobe={closeWardrobe}
        setLook={setLook}
        openDial={openDial}
        pickDial={pickDial}
        closeDial={closeDial}
        pickTrial={pickTrial}
        closeTrial={closeTrial}
        act={act}
        tellRickall={tellRickall}
        shootRickall={shootRickall}
        locked={locked}
        onLock={toggleLock}
        startRickall={startRickall}
        onPickEmote={(id) => strike(wheel.current.choose(id))}
        onCloseWheel={() => {
          wheel.current.cancel();
          setTouchWheel(false);
        }}
        onToggleWheel={() => setTouchWheel((v) => !v)}
        onStick={onStick}
        looking={looking}
        onLookLock={() => looker.current?.request()}
        onJump={onJump}
        onLift={onLift}
        onFire={() => fns.current.fire()}
        closeList={closeList}
      />
    </div>
  );
}

// ── the map in the corner ──
// The street from above (the road, the houses, the school, the trees, the
// cruiser), a room as its plan (the rooms, the walls, the furniture), or the
// alien street; the doors as rings, the next thing to do as a gold one, and Morty.
const MAP_W = 184;
const MAP_H = 124;
const MAP_PX = 2; // canvas pixels to a CSS pixel
const INK = '#1b1424';
const css = (n) => `#${n.toString(16).padStart(6, '0')}`;
const FLOORS = { garage: 0xa9b3a4, school: 0xa9c6e0, arcade: 0x3d2a5c };
function drawMap(c, s, goal, t) {
  const g = c?.getContext('2d');
  if (!g) return;
  const W = c.width;
  const H = c.height;
  const u = MAP_PX;
  const A = AREAS[s.area];
  const pad = 8 * u;
  const k = Math.min((W - pad * 2) / (A.x1 - A.x0), (H - pad * 2) / (A.z1 - A.z0));
  const ox = W / 2 - ((A.x0 + A.x1) / 2) * k;
  const oz = H / 2 - ((A.z0 + A.z1) / 2) * k;
  const X = (x) => ox + x * k;
  const Z = (z) => oz + z * k;
  const rect = (x0, x1, z0, z1) => g.fillRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k);
  const edge = (x0, x1, z0, z1) => g.strokeRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k);
  const foot = (b, fill) => {
    g.fillStyle = fill;
    rect(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2);
    edge(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2);
  };
  const disc = (x, z, r, fill, stroke) => {
    g.beginPath();
    g.arc(X(x), Z(z), r, 0, Math.PI * 2);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.stroke();
    }
  };
  g.setLineDash([]);
  g.lineJoin = 'round';

  if (s.area === 'street') {
    g.fillStyle = '#7cc25a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#6bb04b';
    for (const y of YARDS) rect(y.x0, y.x1, y.z0, y.z1);
    g.fillStyle = '#d8d1c1';
    rect(A.x0 - 20, A.x1 + 20, ROAD.z - ROAD.w / 2 - ROAD.sidewalk, ROAD.z + ROAD.w / 2 + ROAD.sidewalk);
    g.fillStyle = '#4b5060';
    rect(A.x0 - 20, A.x1 + 20, ROAD.z - ROAD.w / 2, ROAD.z + ROAD.w / 2);
    g.strokeStyle = '#f2d34b';
    g.lineWidth = 1 * u;
    g.setLineDash([3 * u, 3 * u]);
    g.beginPath();
    g.moveTo(0, Z(ROAD.z));
    g.lineTo(W, Z(ROAD.z));
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#c8c0b0';
    rect(DRIVEWAY.x0, DRIVEWAY.x1, DRIVEWAY.z0, DRIVEWAY.z1);
    g.fillStyle = '#b4533e';
    rect(FRONT_WALK.x0, FRONT_WALK.x1, FRONT_WALK.z0, FRONT_WALK.z1);
    for (const tr of TREES) disc(tr.x, tr.z, Math.max(1.8 * u, 1.7 * tr.s * k), '#3f8a35');
    g.strokeStyle = INK;
    g.lineWidth = 1 * u;
    // Shoney's, yellow, and its lot; the limo at the kerb while the President's there
    g.fillStyle = '#7d8088';
    rect(DINER.x - DINER.w / 2 - 1.5, DINER.x + DINER.w / 2 + 1.5, DINER.z + DINER.d / 2, -ROAD.w / 2 - ROAD.sidewalk);
    for (const n of NEIGHBOURS) foot(n, n === DINER ? '#f0dc86' : css(n.tint));
    if (s.motorcade) foot({ x: LIMO.x, z: LIMO.z, w: LIMO.d, d: LIMO.w }, '#16171b');
    for (const p of SCHOOL_PARTS) foot(p, '#c0603f');
    foot(GARAGE, '#f4e3b5');
    for (const p of HOUSE_PARTS) foot(p, '#f4e3b5');
  } else if (s.area === 'annex') {
    g.fillStyle = '#3a2560';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#5e4290';
    rect(A.x0, A.x1, A.z0, A.z1);
    g.strokeStyle = INK;
    g.lineWidth = 1 * u;
    foot(ARCADE, '#ff7ac8');
  } else {
    g.fillStyle = '#211a2b';
    g.fillRect(0, 0, W, H);
    const rooms = PLAN.filter((r) => r.area === s.area);
    const ring = RINGS[s.area];
    g.strokeStyle = 'rgba(27, 20, 36, 0.55)';
    g.lineWidth = 0.75 * u;
    if (ring) {
      // a round room: its ellipse
      g.fillStyle = css(rooms[0]?.floor ?? 0xc4a77a);
      g.beginPath();
      g.ellipse(X(ring.x), Z(ring.z), ring.a * k, ring.b * k, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (rooms.length)
      for (const r of rooms) {
        g.fillStyle = css(r.floor);
        rect(r.x0, r.x1, r.z0, r.z1);
        edge(r.x0, r.x1, r.z0, r.z1);
      }
    else {
      g.fillStyle = css(FLOORS[s.area] ?? 0xc4a77a);
      rect(A.x0, A.x1, A.z0, A.z1);
    }
    g.fillStyle = 'rgba(27, 20, 36, 0.42)';
    for (const f of FURNITURE) {
      if (f.area !== s.area) continue;
      const side = Math.abs(Math.sin(f.turn)) > 0.5;
      const w = side ? f.d : f.w;
      const d = side ? f.w : f.d;
      rect(f.x - w / 2, f.x + w / 2, f.z - d / 2, f.z + d / 2);
    }
    g.strokeStyle = INK;
    g.lineWidth = 1.6 * u;
    g.lineCap = 'round';
    for (const [x0, z0, x1, z1] of INNER_WALLS[s.area] ?? []) {
      g.beginPath();
      g.moveTo(X(x0), Z(z0));
      g.lineTo(X(x1), Z(z1));
      g.stroke();
    }
    for (const h of HOTSPOTS) if (h.area === s.area) disc(h.x, h.z, 2.1 * u, '#c9ff5a');
    // the hatch in the garage floor
    if (s.area === 'garage') {
      g.fillStyle = '#3a4046';
      g.strokeStyle = '#f2c23c';
      g.lineWidth = 1 * u;
      rect(HATCH.x - HATCH.w / 2, HATCH.x + HATCH.w / 2, HATCH.z - HATCH.d / 2, HATCH.z + HATCH.d / 2);
      edge(HATCH.x - HATCH.w / 2, HATCH.x + HATCH.w / 2, HATCH.z - HATCH.d / 2, HATCH.z + HATCH.d / 2);
    }
  }

  // the doors and portals
  g.lineWidth = 1.4 * u;
  for (const l of LINKS) if (l.area === s.area) disc(l.x, l.z, 3 * u, null, l.kind === 'portal' ? '#9dff5a' : '#ffffff');
  // the next thing to do, pulsing
  // the place's people: a dot each, red and pulsing for one who's after Morty, grey for one who's down
  if (Array.isArray(s.npcs))
    for (const n of s.npcs) {
      if (!n.visible) continue;
      if (n.hunting) disc(n.x, n.z, (2.6 + Math.sin(t * 8) * 0.8) * u, '#ff3a3a', '#ffffff');
      else disc(n.x, n.z, 1.8 * u, n.dead ? '#6a6a6a' : '#ffffff', null);
    }
  if (goal) {
    g.lineWidth = 2 * u;
    disc(goal.x, goal.z, (6 + Math.sin(t * 4.5) * 1.6) * u, null, '#ffd23a');
  }
  // the cruiser, parked; or flying, as the arrow
  const arrow = (x, z, turn, fill) => {
    g.save();
    g.translate(X(x), Z(z));
    g.rotate(turn);
    g.fillStyle = fill;
    g.strokeStyle = INK;
    g.lineWidth = 1.5 * u;
    g.beginPath();
    g.moveTo(0, -6.5 * u);
    g.lineTo(4.8 * u, 5 * u);
    g.lineTo(0, 2.4 * u);
    g.lineTo(-4.8 * u, 5 * u);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  };
  if (s.area === 'street') {
    if (s.flying) arrow(s.c.x, s.c.z, Math.PI - s.c.yaw, '#9dff5a');
    else {
      g.lineWidth = 1.2 * u;
      disc(s.c.x, s.c.z, Math.max(3.6 * u, CRUISER.radius * k), '#c4cad2', INK);
    }
  }
  if (!s.flying) arrow(s.m.x, s.m.z, Math.PI / 2 - s.m.face, '#f3d84b');
}

// Roy, if its code won't load (offline, or a deploy since the page opened)
function RoyDown({ onLeave }) {
  return (
    <div className="rm-place-down" role="alert">
      <p>Roy’s headset didn’t load. Check the connection, then reload the page to try again.</p>
      <button type="button" className="rm-btn" onClick={() => onLeave?.(null, null)}>
        Back to the arcade
      </button>
    </div>
  );
}

// ── what opens over the page ──
// Its component, and the way back to the room (Esc, the button, or B on a
// controller). Roy fills the screen and has its own way out.
function Place({ id, onClose, onQuiz, onRoy, onSewer }) {
  const p = PLACES[id];
  const back = useRef(null);
  const shell = useRef(null);
  // where the focus was before this opened (read while rendering, before the toy takes it)
  const before = useRef(typeof document === 'undefined' ? null : document.activeElement);
  useEffect(() => {
    const from = before.current;
    if (!shell.current?.contains(document.activeElement)) (back.current ?? shell.current)?.focus({ preventScroll: true });
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    // (a game that marks itself [data-owns-escape] takes Esc for itself: Roy
    // and Portal panic pause what's being played, and Esc on the pause card,
    // or its own way out, leaves; Roy also leaves on Esc from its intro or
    // end card, or while it's loading)
    const esc = (e) => e.key === 'Escape' && !e.defaultPrevented && !shell.current?.querySelector('[data-owns-escape]') && onClose();
    window.addEventListener('keydown', esc);
    // B on a controller, for the ones that aren't games with their own buttons
    let raf = 0;
    let held = true;
    const poll = () => {
      const b = Boolean(readPad()?.b);
      if (b && !held) onClose();
      held = b;
      raf = requestAnimationFrame(poll);
    };
    if (!p.full && id !== 'portalpanic') raf = requestAnimationFrame(poll);
    return () => {
      html.style.overflow = was;
      window.removeEventListener('keydown', esc);
      cancelAnimationFrame(raf);
      if (from instanceof HTMLElement) from.focus({ preventScroll: true });
    };
  }, [id, p.full, onClose]);
  const body = {
    cable: <Cable />,
    butter: <ButterRobot />,
    meeseeks: <MeeseeksBox />,
    plumbus: <PlumbusFactory />,
    portalpanic: <PortalPanic />,
    quiz: <Quiz onDone={onQuiz} />,
    // (behind the site's 3D gate, as Portal panic is, with a way back from its cards)
    roy: (
      <GpuGate
        className="rm-roy-gate"
        extra={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRoy(null, null)}>
            Back to the arcade
          </button>
        }
      >
        {() => <Roy onLeave={onRoy} />}
      </GpuGate>
    ),
    sewer: (
      <GpuGate
        className="rm-roy-gate"
        extra={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSewer(false)}>
            Back up the hole
          </button>
        }
      >
        {() => <Sewer onLeave={onSewer} />}
      </GpuGate>
    ),
  }[id];
  return createPortal(
    <div ref={shell} className="rm-place" data-full={p.full || undefined} data-place={id} role="dialog" aria-modal="true" aria-label={p.full ? p.title : undefined} aria-labelledby={p.full ? undefined : 'rm-place-title'} tabIndex={-1}>
      {!p.full && (
        <header className="rm-place-head">
          <div>
            <p className="rm-place-where">{p.where}</p>
            <h2 id="rm-place-title" className="rm-place-title">
              {p.title}
            </h2>
          </div>
          <button ref={back} type="button" className="rm-btn rm-btn-ghost" onClick={onClose}>
            Back to the room <kbd>Esc</kbd>
          </button>
        </header>
      )}
      <div className="rm-place-body">
        <Suspense fallback={<p className="rm-place-wait">{p.full ? 'Putting the headset on…' : 'Opening it up…'}</p>}>{p.full ? body : <div className="shell py-6 md:py-10">{body}</div>}</Suspense>
      </div>
    </div>,
    document.body,
  );
}
