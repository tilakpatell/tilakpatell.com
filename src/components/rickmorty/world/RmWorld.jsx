import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link as RouterLink } from 'react-router-dom';
import { RiArrowDownLine, RiArrowLeftLine, RiArrowUpLine, RiCheckLine, RiCloseLine, RiListCheck2, RiShirtLine } from 'react-icons/ri';
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
  MEMORY_COLORS,
  NEIGHBOURS,
  PLAN,
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
import { setShipVoice, shipVoiceOn, speak, stopSpeaking } from './shipVoice';
import Wardrobe from '../wardrobe/Wardrobe';
import { useLooks } from '../wardrobe/useLooks';
import './world.css';
import GuideCue from '../../guide/GuideCue';
import { useTravellers } from '../../middleearth/towns/useTravellers';

// Dimension C-137, the world: walk about the Smiths' street as Morty, go into
// the house, Rick's garage and Harry Herpson High, fly Rick's space cruiser
// over the roofs, and step through the garage's portal to the alien street and
// Blips and Chitz. The rules are in ./rules.js and the drawing in ./scene.js;
// this is the controls, the camera's yaw, the HUD, the doors and the things to
// do. Each toy opens over the page (the page's own components, the pop quiz,
// Roy); close it and you're back in the room. Without 3D, the places are
// cards that open the same things.

const Roy = lazy(() => import('./roy/Roy').catch(() => ({ default: RoyDown })));
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
};
// what the people say, and the cabinets that aren't Roy
const SAY = {
  jerry: { who: 'Jerry', text: 'Hungry for apples?' },
  beth: { who: 'Beth', text: 'I’m a horse surgeon, Morty. Your grandfather’s in the garage.' },
  summer: { who: null, text: 'Summer doesn’t look up from her phone. “Get out of my room, Morty.”' },
  rick: { who: 'Rick', text: 'The portal’s on the wall, Morty. Blips and Chitz is through there. Don’t touch anything else.' },
  mortyroom: { who: null, text: 'Morty’s room: the bed, the desk, and the window Rick climbs in through at night.' },
  clone: { who: null, text: 'A Rick, floating in the tube, waiting till he’s needed. He’s breathing. Probably.' },
  console: { who: null, text: 'Screens of cells and DNA, all of it Rick’s. One of them is Rick, waving at you.' },
  pickle: { who: null, text: 'Pickle Rick, in a jar on the desk. He’s been through a lot.' },
  president: { who: 'The President', text: 'Morty. Where’s your grandfather? I need him in the Oval Office. My people put a portal in his garage. Use it.' },
  secretservice: { who: 'Secret Service', text: 'Step back from the vehicle, son. The President’s schedule is very full.' },
  agent1: { who: 'Federation agent', text: 'Earth is a valued member of the Galactic Federation. Smile, citizen.' },
  agent2: { who: 'Federation agent', text: 'Shoney’s is open. I recommend the eggs. I recommend not asking why.' },
  agent3: { who: 'Federation agent', text: 'Your grandfather’s file is very thick, Morty.' },
  ovalpresident: { who: 'The President', text: 'Sit down, Morty. Not there, that’s Lincoln’s. Tell Rick the free world called, and it’s disappointed.' },
  general1: { who: 'A general', text: 'Don’t touch the phone, son. The red one. Or the other one.' },
  general2: { who: 'A general', text: 'Your grandfather is a national security risk and a national treasure. We haven’t decided which.' },
  dineragent: { who: 'Federation agent', text: 'Sit, Morty. The coffee’s a hologram. The questions aren’t. Where does your grandfather keep the portal gun formula?' },
  principal: { who: 'Principal Vagina', text: 'Morty. Hall pass? No? I’m too tired to care. Go learn something, or at least look like it.' },
  jessica: { who: 'Jessica', text: 'Oh, hey Morty. Did you do the homework? I tried, but my pen ran out halfway through number one.' },
  brad: { who: 'Brad', text: 'Sup, Smith. You’re in my seat. Kidding. Nobody wants to sit there.' },
  tammy: { who: 'Tammy', text: 'Morty! Is Summer here? Tell her I’ve got news. Huge news. Nothing to do with birds.' },
  ethan: { who: 'Ethan', text: 'Is this the maths class? Every class feels like the maths class.' },
  tinyrick: { who: 'Tiny Rick', text: 'Tiny Rick! Totally a normal teenager, Morty. Let’s go to the prom and rock out. Help me.' },
  cabinet1: { who: 'Space Mortyball', text: 'Out of order. Everyone’s queueing for Roy anyway.' },
  cabinet2: { who: 'Plumbus Smash', text: 'Somebody’s high score is all nines, and the stick is sticky.' },
  cabinet3: { who: 'Cronenberg Crush', text: 'You lose a life before you’ve found the button.' },
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
};
// what talking to someone does, beyond what they say: a thing to do, done
const TALK_DONE = { president: 'president', dineragent: 'diner' };
// a memory's run in the Mind Blowers chair, and how far Morty can stray from the chair before it stops
const MEMORY_S = 5.5;
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

// Where the next thing to do is, for the map's marker: the area and the spot
// in it, and from anywhere else, the way towards it.
const GOAL = { cable: ['house', 'spot:cable'], butter: ['house', 'spot:butter'], meeseeks: ['garage', 'spot:meeseeks'], plumbus: ['garage', 'spot:plumbus'], portalpanic: ['garage', 'spot:portalpanic'], quiz: ['school', 'spot:quiz'], fly: ['street', 'cruiser'], portal: ['garage', 'link:garage-portal'], basement: ['garage', 'link:garage-hatch'], roy: ['arcade', 'spot:roy'], roy55: ['arcade', 'spot:roy'], president: ['street', 'spot:president'], oval: ['garage', 'link:garage-oval'], diner: ['street', 'link:diner-door'], mindblowers: ['mindblowers', 'spot:chair'] };
const WAY = {
  street: { house: 'house-door', upstairs: 'house-door', garage: 'garage-door', basement: 'garage-door', mindblowers: 'garage-door', oval: 'garage-door', school: 'school-door', diner: 'diner-door', annex: 'garage-door', arcade: 'garage-door' },
  house: { street: 'front', upstairs: 'stairs-up', garage: 'kitchen-garage', basement: 'kitchen-garage', mindblowers: 'kitchen-garage', oval: 'kitchen-garage', school: 'front', diner: 'front', annex: 'kitchen-garage', arcade: 'kitchen-garage' },
  garage: { street: 'garage-exit', house: 'garage-kitchen', upstairs: 'garage-kitchen', basement: 'garage-hatch', mindblowers: 'garage-hatch', oval: 'garage-oval', school: 'garage-exit', diner: 'garage-exit', annex: 'garage-portal', arcade: 'garage-portal' },
  basement: { mindblowers: 'basement-mind' },
  annex: { arcade: 'arcade-door' },
};
const OUT = { upstairs: 'stairs-down', school: 'school-exit', annex: 'annex-portal', arcade: 'arcade-exit', basement: 'basement-ladder', mindblowers: 'mind-door', oval: 'oval-portal', diner: 'diner-exit' };
function goalOf(next, s) {
  if (!next || s.flying) return null;
  const [to, key] = GOAL[next.id];
  if (to === s.area) {
    if (key === 'cruiser') return { x: s.c.x, z: s.c.z };
    const p = PROMPT[key];
    return p.link ?? p.spot;
  }
  const id = WAY[s.area]?.[to] ?? OUT[s.area];
  return PROMPT[`link:${id}`]?.link ?? null;
}

const PITCH = 0.17; // the walking camera's lift, as the scene has it
const FADE_MS = 260;
const CLIMB_MS = 480; // down the hatch or up the ladder: a slower fade
const FLY_KEYS = { KeyR: 'rise', KeyF: 'sink', KeyC: 'sink' };
const clamp1 = (v) => Math.max(-1, Math.min(1, v));
const roomAt = (area, x, z) => PLAN.find((r) => r.area === area && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)?.name ?? null;
const newSim = () => ({
  area: START.area,
  m: newMorty(START),
  c: newCruiser(),
  flying: false,
  landing: false,
  landT: 0,
  boardAt: null,
  yaw: behindYaw(START.face),
  pitch: PITCH,
  dragAt: -1e9,
  t: 0,
  keys: new Set(),
  stick: { x: 0, y: 0 },
  lift: 0,
  jump: false, // asked to jump (Space, or the jump button), till the next step takes it
  near: null,
  moved: false,
  fading: false,
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
});

export default function RmWorld() {
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

  const say = useCallback((t) => setToast({ ...t, at: performance.now() }), []);
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

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.kind === 'say' ? 5600 : toast.bad ? 3400 : 4400);
    return () => clearTimeout(t);
  }, [toast]);

  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="rm-world" aria-labelledby="rm-world-title" data-mode={world ? '3d' : 'cards'}>
      {world ? (
        <World api={api} done={done} open={open} openPlace={openPlace} complete={complete} gl={gl} setGl={setGl} toast={toast} say={say} />
      ) : (
        <Cards done={done} openPlace={openPlace} three={three} gl={gl} toast={toast} retry={() => setGl('loading')} />
      )}
      {open && <Place id={open} onClose={close} onQuiz={quizDone} onRoy={royLeft} />}
    </section>
  );
}

function Title() {
  return (
    <h2 id="rm-world-title" className="rm-title" aria-label="Dimension C-137">
      <span aria-hidden="true">Dimension</span> <span className="rm-title-num" aria-hidden="true">C-137</span>
    </h2>
  );
}

// a toast: something done, someone talking, or a no
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="rm-toast" data-kind={toast.kind ?? 'note'} data-bad={toast.bad || undefined} role="status" key={toast.at}>
      {toast.kind === 'done' && (
        <span className="rm-toast-tick" aria-hidden="true">
          <RiCheckLine />
        </span>
      )}
      <p>
        {toast.who && <b>{toast.who}</b>}
        <span>{toast.text}</span>
      </p>
    </div>
  );
}

// others online (middleearth/towns/useTravellers), as Mortys from other
// dimensions, in the street or whichever room you're in (each its own area:
// the rooms are built out to some 400 m from the street, hence the reach)
const ROOM = { bound: 820, motion: true };

function World({ api, done, open, openPlace, complete, gl, setGl, toast, say }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const trav = useTravellers('c137', gl === 'on', ROOM);
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.35 });
  const canvas = useRef(null);
  const map = useRef(null);
  const sim = useRef(null);
  if (!sim.current) sim.current = newSim();
  const prog = progress(done);
  const progRef = useRef(prog);
  progRef.current = prog;
  const doneRef = useRef(done);
  doneRef.current = done;
  const [hud, setHud] = useState({ area: START.area, room: null, flying: false, landing: false, near: null, moved: false, alt: 0, kmh: 0 });
  const hudKey = useRef('');
  const [list, setList] = useState(false);
  const listRef = useRef(list);
  listRef.current = list;
  // the wardrobe: how Morty looks here (and Rick, wherever he turns up)
  const [looks, setLook] = useLooks();
  const looksRef = useRef(looks);
  looksRef.current = looks;
  const [wardrobe, setWardrobe] = useState(false);
  const wardrobeRef = useRef(wardrobe);
  wardrobeRef.current = wardrobe;
  const closeWardrobe = useCallback(() => setWardrobe(false), []);
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
  const [fade, setFade] = useState(null); // null, or the kind of link being gone through
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
  // the ship goes quiet when the world does
  useEffect(() => stopSpeaking, []);
  useEffect(() => {
    if (open) stopSpeaking();
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

  // ── what E does ──
  // through a door, up the stairs or through the portal: a fade to black (or
  // green), and out the other side, the camera behind him; down the hatch or
  // up the ladder, a slower one, the lid clanking
  const go = useCallback(
    (l) => {
      const s = sim.current;
      if (s.fading) return;
      s.fading = true;
      s.keys.clear();
      const climb = l.kind === 'hatch';
      setFade(l.kind === 'portal' ? 'portal' : climb ? (l.to === 'basement' ? 'down' : 'up') : 'door');
      if (l.kind === 'portal') sound('portalOpen');
      else if (climb) sound('splat');
      later(() => {
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
        setFade(null);
      }, climb ? CLIMB_MS : FADE_MS);
    },
    [api, complete, later],
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
    s.c = { ...s.c, y: CRUISER.hover, vy: 0, speed: 0, bank: 0 };
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
    } else if (SAY[n.id]) {
      say({ kind: 'say', ...SAY[n.id] });
      // (done once they've had their say: the President gets in his car then)
      if (TALK_DONE[n.id]) later(() => complete(TALK_DONE[n.id]), TALK_MS);
    }
  }, [api, go, board, openPlace, say, complete, playMemory, shipTalk, later]);
  const fns = useRef({});
  fns.current = { act };

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
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        a.act?.('arcade', 'setBoard', readBest());
        a.setLooks?.(looksRef.current); // (a look picked while it loaded)
        if (import.meta.env.DEV) {
          // for the QA scripts: where everyone is, E, and a jump to anywhere
          const s = sim.current;
          window.__C137__ = Object.assign(window.__C137__ ?? {}, {
            sim: s,
            act: () => fns.current.act(),
            complete,
            warp(area, x, z, face = Math.PI / 2) {
              if (s.flying) s.c = { ...s.c, y: CRUISER.hover, vy: 0, speed: 0, bank: 0 };
              s.area = area;
              s.flying = false;
              s.landing = false;
              s.m = newMorty({ x, z, face });
              s.yaw = behindYaw(face);
              s.keys.clear();
            },
          });
        }
        fit();
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
  }, [api, setGl, complete]);

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
      const m = keyDown(s.keys, e);
      const f = e.metaKey || e.ctrlKey || e.altKey ? null : FLY_KEYS[e.code];
      if (f) s.keys.add(f);
      if (m || f) {
        // (Space is the cruiser's climb; walking, Morty's jump)
        if (m !== 'run' && !(m === 'space' && onButton)) e.preventDefault();
        if (m === 'space' && !onButton && !s.flying && !e.repeat) s.jump = true;
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
      keyUp(s.keys, e);
      if (FLY_KEYS[e.code]) s.keys.delete(FLY_KEYS[e.code]);
    };
    const blur = () => s.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      s.keys.clear();
    };
  }, [live, closeList]);

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
    if (pressed('b') && listRef.current) closeList();
    if (pressed('y')) {
      if (listRef.current) closeList();
      else setList(true);
    }

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
      s.m = stepMorty(s.m, { x: mv.x, z: mv.z, run, jump: s.jump && !s.fading }, dt, s.area, s.area === 'street' ? { cruiser: { x: s.c.x, z: s.c.z }, motorcade: !doneRef.current.includes('president') } : undefined);
      s.jump = false;
      if (Math.hypot(mv.x, mv.z) > 0.1) s.moved = true;
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
    else if (!s.fading) {
      const l = nearLink(s.area, s.m.x, s.m.z, doneRef.current);
      const h = l ? null : nearHotspot(s.area, s.m.x, s.m.z, doneRef.current);
      near = l ? `link:${l.id}` : h ? `spot:${h.id}` : s.area === 'street' && Math.hypot(s.m.x - s.c.x, s.m.z - s.c.z) < BOARD_R ? 'cruiser' : null;
    }
    s.near = near ? PROMPT[near] : null;
    s.view.link = s.near?.kind === 'link' ? s.near.id : null;
    s.view.hotspot = s.near?.kind === 'spot' ? s.near.id : null;
    // the Federation's patrol ship, round its loop or on the cruiser's tail
    s.fed = stepFedShip(s.fed, s.c, s.flying, dt);
    // what the cruiser was about to say when it'd only just spoken
    if (s.shipNext) {
      if (s.t > s.shipNext.until || s.area !== 'street') s.shipNext = null;
      else shipTalk(s.shipNext.event);
    }

    // others online: where you are to them (on foot, in the street or a room:
    // only those in the same one see you), and where they are
    const tv = trav.ref.current;
    tv?.pose(s.m, { inside: Boolean(s.flying), area: s.area });

    try {
      a.render({ area: s.area, morty: s.m, flying: s.flying, cruiser: s.c, camYaw: s.yaw, camPitch: s.pitch, near: s.view, done: doneRef.current, fed: s.fed, travellers: tv ? tv.list() : null }, ms);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
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
    if (++s.frame % 3 === 0) drawMap(map.current, s, goalOf(progRef.current.next, s), s.t);
  }, live);

  // something open over the world: let go of the stick and the up and down buttons
  const stickEl = useRef(null);
  useEffect(() => {
    if (!open) return;
    const s = sim.current;
    s.stick = { x: 0, y: 0 };
    s.lift = 0;
    stickEl.current?.style.setProperty('--sx', '0px');
    stickEl.current?.style.setProperty('--sy', '0px');
  }, [open]);

  // ── the pointer: drag the view round ──
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      audioContext();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
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
      s.yaw -= (e.clientX - d.x) * 0.0065;
      s.pitch = Math.max(-0.1, Math.min(0.95, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0)));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
  };

  // the touch stick: drag from where the thumb goes down
  const stick = useRef(null);
  const onStick = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      stick.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      audioContext();
    }
    if (!stick.current || stick.current.id !== e.pointerId) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'lostpointercapture') {
      stick.current = null;
      s.stick = { x: 0, y: 0 };
      e.currentTarget.style.setProperty('--sx', '0px');
      e.currentTarget.style.setProperty('--sy', '0px');
      return;
    }
    const dx = clamp1((e.clientX - stick.current.x) / 46);
    const dy = clamp1((e.clientY - stick.current.y) / 46);
    s.stick = { x: dx, y: dy };
    e.currentTarget.style.setProperty('--sx', `${dx * 26}px`);
    e.currentTarget.style.setProperty('--sy', `${dy * 26}px`);
  };
  // up and down, held, while flying
  const onJump = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    sim.current.jump = true;
    audioContext();
  };
  const onLift = (dir) => (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      s.lift = dir;
      audioContext();
    } else s.lift = 0;
  };

  const here = hud.near ? PROMPT[hud.near] : null;
  const placeName = hud.flying ? 'Over the Smiths’ street' : (hud.room ?? AREA_NAME[hud.area]);
  return (
    <div ref={box} className="rm-world-stage" data-touch={touch || undefined} data-flying={hud.flying || undefined} data-area={hud.area}>
      <canvas
        ref={canvas}
        className="rm-world-canvas"
        data-on={gl === 'on' || undefined}
        role="img"
        aria-label="The Smiths’ street in 3D: the Smith house with Rick’s garage, Harry Herpson High across the road, Rick’s space cruiser in the driveway, and Morty on the sidewalk"
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerUp={onPointer}
        onPointerCancel={onPointer}
        onLostPointerCapture={onPointer}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="rm-fade" data-on={fade || undefined} data-kind={fade ?? undefined} aria-hidden="true" />
      {gl === 'loading' && (
        <div className="rm-loading" role="status">
          <span className="rm-swirl" aria-hidden="true" />
          <p>Opening a portal…</p>
        </div>
      )}

      <div className="rm-hud rm-hud-top">
        <div className="rm-brand">
          <Title />
          <p className="rm-objective" aria-live="polite">
            <span className="rm-swirl rm-swirl-sm" aria-hidden="true" />
            <span>{prog.objective}</span>
          </p>
          {hud.flying && (
            <p className="rm-flightstats" aria-live="off">
              <span>
                Height <b>{hud.alt}</b> m
              </span>
              <span>
                Speed <b>{hud.kmh}</b> km/h
              </span>
            </p>
          )}
        </div>
        <div className="rm-side">
          <figure className="rm-map">
            <canvas ref={map} width={MAP_W * MAP_PX} height={MAP_H * MAP_PX} aria-hidden="true" />
            <figcaption>{placeName}</figcaption>
          </figure>
          <button ref={chip} type="button" className="rm-chip" onClick={() => setList((v) => !v)} aria-expanded={list} aria-controls="rm-list" aria-label={`Things to do, ${prog.count} of ${prog.total} done`}>
            <RiListCheck2 aria-hidden="true" />
            <span>Things to do</span>
            <b>
              {prog.count}/{prog.total}
            </b>
            {!touch && <kbd>M</kbd>}
          </button>
          <button type="button" className="rm-chip" onClick={() => setWardrobe(true)} aria-haspopup="dialog" aria-label="Wardrobe: how Morty and Rick look">
            <RiShirtLine aria-hidden="true" />
            <span>Wardrobe</span>
            {!touch && <kbd>C</kbd>}
          </button>
          <OtherMortys trav={trav} />
        </div>
      </div>
      <Wardrobe open={wardrobe} onClose={closeWardrobe} looks={looks} onLook={setLook} who="morty" />

      <Toast toast={toast} />
      {shipLine && hud.area === 'street' && (
        <p className="rm-shipline" role="status" key={shipLine.at}>
          <span className="rm-shipline-eyes" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>
            <b>The ship</b> {shipLine.text}
          </span>
        </p>
      )}
      {memory && hud.area === 'mindblowers' && (
        <div className="rm-memory" role="status" key={memory.at} style={{ '--vial': MEMORY_COLORS[memory.color] }}>
          <p className="rm-memory-head">
            <span className="rm-memory-vial" aria-hidden="true" />
            Memory {memory.i + 1} of {MEMORIES.length}
          </p>
          <p className="rm-memory-text">{memory.caption}</p>
          <p className="rm-memory-hint">{touch ? 'Tap for the next one; walk away to stop.' : 'E for the next one; walk away to stop.'}</p>
        </div>
      )}

      {gl === 'on' && here && (
        <div className="rm-prompt" data-kind={here.kind}>
          <p className="rm-prompt-name">{here.name}</p>
          {!touch && (
            <button type="button" className="rm-btn" onClick={act}>
              {here.verb} <kbd>E</kbd>
            </button>
          )}
        </div>
      )}

      {gl === 'on' && !here && !hud.flying && !hud.moved && (
        <p className="rm-hint">{touch ? 'Drag the stick to walk; push it all the way to run; the arrow jumps. Swipe sideways to look round.' : 'W A S D or the arrows to walk, Shift to run, Space to jump. Drag to look round. E uses things, M lists what to do.'}<GuideCue touch={touch} /></p>
      )}
      {gl === 'on' && hud.flying && !here && (
        <p className="rm-hint rm-keys">
          {touch ? (
            'The stick flies; hold the arrows to climb and drop. Slow down over open ground to land.'
          ) : hud.landing ? (
            'Setting down…'
          ) : (
            <>
              <span>
                <kbd>W</kbd>
                <kbd>S</kbd> speed
              </span>
              <span>
                <kbd>A</kbd>
                <kbd>D</kbd> steer
              </span>
              <span>
                <kbd>Space</kbd> up
              </span>
              <span>
                <kbd>Shift</kbd> down
              </span>
              <span>Slow down over open ground, then E to land</span>
            </>
          )}
        </p>
      )}

      <div className="rm-hud rm-hud-bottom">
        {touch ? (
          <>
            <div ref={stickEl} className="rm-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} onLostPointerCapture={onStick} aria-hidden="true">
              <span />
            </div>
            <div className="rm-pad">
              {!hud.flying && (
                <div className="rm-lift">
                  <button type="button" aria-label="Jump" onPointerDown={onJump} onContextMenu={(e) => e.preventDefault()}>
                    <RiArrowUpLine aria-hidden="true" />
                  </button>
                </div>
              )}
              {hud.flying && (
                <div className="rm-lift">
                  <button type="button" aria-label="Climb" onPointerDown={onLift(1)} onPointerUp={onLift(0)} onPointerCancel={onLift(0)} onLostPointerCapture={onLift(0)} onContextMenu={(e) => e.preventDefault()}>
                    <RiArrowUpLine aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Drop" onPointerDown={onLift(-1)} onPointerUp={onLift(0)} onPointerCancel={onLift(0)} onLostPointerCapture={onLift(0)} onContextMenu={(e) => e.preventDefault()}>
                    <RiArrowDownLine aria-hidden="true" />
                  </button>
                </div>
              )}
              <button type="button" className="rm-act" data-idle={!here || undefined} onClick={act}>
                {here ? here.verb : hud.flying ? 'Land' : 'Use'}
              </button>
            </div>
          </>
        ) : (
          <RouterLink to="/" className="rm-back">
            <RiArrowLeftLine aria-hidden="true" /> Back to the site
          </RouterLink>
        )}
      </div>

      {list && <ThingsToDo box={listBox} prog={prog} done={done} onClose={closeList} />}
    </div>
  );
}

// The list (M): every thing to do, ticked when it's done, with where to go
// for the rest; and the switch for the cruiser's voice.
function ThingsToDo({ box, prog, done, onClose }) {
  const [voice, setVoice] = useState(shipVoiceOn);
  return (
    <div ref={box} className="rm-list" id="rm-list" role="region" aria-label="Things to do in Dimension C-137">
      <div className="rm-list-head">
        <p>
          Things to do <b>{prog.count}</b>/{prog.total}
        </p>
        <button type="button" className="rm-icon-btn" onClick={onClose} aria-label="Close the list">
          <RiCloseLine aria-hidden="true" />
        </button>
      </div>
      <ol>
        {TASKS.map((t) => {
          const ticked = done.includes(t.id);
          return (
            <li key={t.id} data-done={ticked || undefined} data-next={prog.next?.id === t.id || undefined}>
              <span className="rm-tick" aria-hidden="true">
                {ticked && <RiCheckLine />}
              </span>
              <div>
                <p className="rm-list-name">
                  {t.name}
                  {ticked && <span className="sr-only"> (done)</span>}
                </p>
                {!ticked && <p className="rm-list-sub">{t.hint}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <label className="rm-list-switch">
        <input
          type="checkbox"
          checked={voice}
          onChange={(e) => {
            setShipVoice(e.target.checked);
            setVoice(e.target.checked);
            if (!e.target.checked) stopSpeaking();
          }}
        />
        <span>The ship’s voice</span>
      </label>
      <RouterLink to="/" className="rm-list-back">
        <RiArrowLeftLine aria-hidden="true" /> Back to the site
      </RouterLink>
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

// ── without 3D: the places as cards ──
const CARDS = [
  { id: 'house', name: 'The Smith house', blurb: 'Jerry’s on the couch with the TV on, and Rick left something at the breakfast table.', items: ['cable', 'butter'] },
  { id: 'garage', name: 'Rick’s garage', blurb: 'One car wide: the workbench, the worktable, the plumbus machine, a Portal panic cabinet, a portal on the wall, and a hatch in the floor down to Rick’s secret lab.', items: ['meeseeks', 'plumbus', 'portalpanic'] },
  { id: 'school', name: 'Harry Herpson High', blurb: 'Mr. Goldenfold has a pop quiz on the board. Seven right is a pass.', items: ['quiz'] },
  { id: 'arcade', name: 'Blips and Chitz', blurb: 'The arcade on the far side of the portal, and the game everyone queues for.', items: ['roy'] },
];
const CARD_LABEL = { cable: 'Watch interdimensional cable', butter: 'Switch on the butter robot', meeseeks: 'Press the Meeseeks box', plumbus: 'Watch a plumbus get made', portalpanic: 'Play Portal panic', quiz: 'Sit the pop quiz', roy: 'Play Roy: A Life Well Lived' };
const CARD_TASK = { cable: ['cable'], butter: ['butter'], meeseeks: ['meeseeks'], plumbus: ['plumbus'], portalpanic: ['portalpanic'], quiz: ['quiz'], roy: ['roy', 'roy55'] };

function Cards({ done, openPlace, three, gl, toast, retry }) {
  const prog = progress(done);
  return (
    <div className="shell rm-cards-wrap">
      <div className="rm-cards-head">
        <div>
          <Title />
          <p className="lead mt-4 max-w-[60ch]">Rick and Morty’s neighbourhood: the Smith house, Rick’s garage lab, Harry Herpson High, and through the portal, Blips and Chitz.</p>
        </div>
        <p className="rm-cards-count">
          <b>{prog.count}</b> of {prog.total} things done
        </p>
      </div>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost'
            ? 'The graphics chip reset, so here’s the neighbourhood as cards.'
            : gl === 'failed'
              ? 'The 3D neighbourhood couldn’t start here, so here it is as cards.'
              : three.held
                ? `The 3D neighbourhood isn’t loaded yet${three.hold?.mb ? ` (about ${three.hold.mb} MB)` : ''}, so here it is as cards.`
                : '3D is switched off, so here’s the neighbourhood as cards.'}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (!three.on) three.set('auto');
              retry();
            }}
          >
            {three.on ? 'Try 3D again' : three.held ? 'Load the 3D' : 'Turn 3D on'}
          </button>
        </p>
      )}
      <div className="rm-cards-toast">
        <Toast toast={toast} />
      </div>
      <ul className="rm-cards">
        {CARDS.map((p) => (
          <li key={p.id} data-place={p.id}>
            <h3 className="rm-card-name">{p.name}</h3>
            <p className="rm-card-blurb">{p.blurb}</p>
            <div className="rm-card-acts">
              {p.items.map((id) => {
                const ticked = CARD_TASK[id].every((t) => done.includes(t));
                return (
                  <button key={id} type="button" className="rm-card-btn" data-done={ticked || undefined} onClick={() => openPlace(id)}>
                    <span className="rm-tick" aria-hidden="true">
                      {ticked && <RiCheckLine />}
                    </span>
                    {CARD_LABEL[id]}
                    {ticked && <span className="sr-only"> (done)</span>}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
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
function Place({ id, onClose, onQuiz, onRoy }) {
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

// Others online in the street: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as on the universe map).
function OtherMortys({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="rm-chip" onClick={trav.join} title="Go online, and see everyone else in the street as a Morty from another dimension">
        <span>See other Mortys</span>
      </button>
    );
  return (
    <span className="rm-chip" title="Everyone else online in the street shows as a Morty from another dimension: they can’t touch your things to do, nor you theirs">
      <b>{trav.count}</b>
      <span>{trav.count === 1 ? 'other Morty' : 'other Mortys'} here</span>
    </span>
  );
}
