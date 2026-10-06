import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { settle } from '../../../lib/settle';
import { readPad, typing } from '../../games/pad';
import { keyDown, keyUp, moveOf } from '../../middleearth/towns/keys';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { STONES } from '../../interests/stones';
import { SOUL_HALVES, earnedStones, hasEarned } from '../hq/stones';
import { ARMOUR, BUILDINGS, HERO_R, LAWN_W, PACKS, PLACES, PORTAL, RIVER_W, ROADS_W, ROAD_HALF, SETTINGS, SETTINGS_DEFAULTS, START, SUIT, TOUR, behindYaw, cameraMove, floorAt, lapAt, linesFor, nearCast, newPhoto, readPhoto, PHOTO, nearPack, nearPlace, newHero, newTour, outside, placeById, progress, readLap, readSettings, recordLap, stepHero, stepTour, underPortal, walkable } from './rules';
import { useAchievements } from '../../Achievements';
import './world.css';
import '../../../styles/lazy/avengers.css';
import GuideCue from '../../guide/GuideCue';

// The Avengers compound, the world: walk about the compound as Spider-Man,
// and go into the buildings to play their games. Anyone else online here
// shows as a hologram (as in the Middle-earth towns). The rules are in
// ./rules.js, the drawing in ./scene.js; this is the walking, the HUD and the
// doors. Each game opens over the page (./Place.jsx); leave it and you're
// back outside its door. Without 3D, the compound is the drawing from the
// air, and its pins open the games.

const Place = lazy(() => import('./Place'));
const CompoundMap = lazy(() => import('../Compound'));
const clip = (id) => import('../../../lib/clips').then((c) => c.playClip(id)).catch(() => null);
const sfx = (name) => import('../../../lib/sfx').then((s) => s[name]?.()).catch(() => null);
const AT = 'tp-hq-world-at';
const TOUR_BEST = 'tp-hq-swing-tour';
const TOUR_LAP = 'tp-hq-swing-lap'; // the best lap's recording, raced as a ghost
const FOUND = 'tp-hq-packs';
const SET = 'tp-hq-settings';
const STYLE_BEST = 'tp-hq-style-best';
const SHOWBOAT = 2000; // style banked in one flight for the achievement
const TRICK_NAME = { flip: 'Front flip', back: 'Backflip', twist: 'Twist' };
const SUIT_HIGH = 40; // over the roofs in the armour: the achievement
// the backpacks found so far (ids), as kept between visits
const readFound = () => {
  const v = local.get(FOUND, []);
  return Array.isArray(v) ? v.filter((id) => PACKS.some((p) => p.id === id)) : [];
};
// seconds as 0:41.3
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
// the lines the site has the films' own recordings of (lib/clips)
const SPOKEN = { 'Hulk smash!': 'hulkSmash', 'Puny god.': 'punyGod' };
const STONE_OF = { 'soul-clint': 'soul', 'soul-natasha': 'soul' };
const stoneFor = (p) => (p.stone ? STONES.find((s) => s.id === (STONE_OF[p.stone] ?? p.stone)) : null);
// what a door's card and the lists say about its stone
const stoneLine = (p) => {
  const st = stoneFor(p);
  if (!st) return 'No stone here: just Peter, and school';
  return p.done ? `${st.name}: won back` : `Win it for the ${p.stone.startsWith('soul-') ? 'half of the ' : ''}${st.name}`;
};
// every stone won back, and either half of the Soul Stone
const readHeist = () => [...earnedStones(), ...SOUL_HALVES.filter(hasEarned)];
// where he is, to come back to (on the lawn or a roof, never mid-air)
const keep = (h) => ({ x: h.x, z: h.z, face: h.face, y: h.mode === 'ground' ? h.y : 0 });

export default function CompoundWorld({ onPortal }) {
  const three = use3D();
  const [heist, setHeist] = useState(readHeist);
  const prog = progress(heist);
  const [inside, setInside] = useState(null);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const api = useRef(null);

  useEffect(() => {
    const on = () => setHeist(readHeist());
    window.addEventListener('tp:stones', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('tp:stones', on);
      window.removeEventListener('storage', on);
    };
  }, []);

  const enter = useCallback((id) => {
    audioContext(); // in the key press or click, so the game can be heard
    api.current?.fx('enter', { id });
    setInside(id);
  }, []);
  const leave = useCallback(() => {
    setInside(null);
    setHeist(readHeist());
  }, []);
  // through the portal: out of the hangar (or out from under it) to Titan, down the page
  const portal = useCallback(() => {
    audioContext();
    setInside(null);
    setHeist(readHeist());
    api.current?.fx('portal');
    onPortal?.();
  }, [onPortal]);

  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section id="hq-world" className="cw-world" aria-labelledby="cw-title" data-mode={world ? '3d' : 'cards'}>
      {world ? <World api={api} prog={prog} inside={inside} enter={enter} portal={portal} gl={gl} setGl={setGl} /> : <Cards prog={prog} enter={enter} three={three} gl={gl} retry={() => setGl('loading')} />}
      {inside && (
        <Suspense fallback={null}>
          <Place id={inside} onLeave={leave} onPortal={portal} />
        </Suspense>
      )}
    </section>
  );
}

// the compound reaches past the towns' 200 m, and its people run and jump
const ROOM = { bound: 260, motion: true };

function World({ api, prog, inside, enter, portal, gl, setGl }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  // other players online here, as holograms (middleearth/towns/useTravellers)
  const trav = useTravellers('avengers', gl === 'on', ROOM);
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.25 });
  const canvas = useRef(null);
  const map = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    const kept = local.get(AT, null);
    // (where he was last time: on the lawn, or up on a roof)
    const ky = Number.isFinite(kept?.y) ? kept.y : 0;
    const ok = kept && Number.isFinite(kept.x) && Number.isFinite(kept.z) && floorAt(kept.x, kept.z, ky) === ky && walkable(kept.x, kept.z, HERO_R, ky);
    const h = newHero(ok ? { ...kept, y: ky } : START);
    sim.current = { h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.2, dragAt: -1e9, near: null, portal: false, talk: null, frame: 0, moved: false, t: 0, jump: false, zip: false, perch: false, trick: false, suit: false, photo: null, armour: false, touchDown: false, mouseWeb: false, touchWeb: false, padBefore: null, tour: newTour(Number.isFinite(local.get(TOUR_BEST, null)) ? local.get(TOUR_BEST, null) : null), found: readFound(), lap: readLap(local.get(TOUR_LAP, null)), rec: null };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ near: null, portal: false, moved: false, armour: false, suit: false });
  const hudKey = useRef('');
  const [bubble, setBubble] = useState(null);
  const bubbleRef = useRef(null);
  const lines = useRef({});
  const [list, setList] = useState(false);
  // the settings (O): live (the frame loop reads them) and kept
  const [settings, setSettings] = useState(() => readSettings(local.get(SET, null)));
  const setRef = useRef(settings);
  setRef.current = settings;
  const [tuning, setTuning] = useState(false);
  // photo mode (P): time stopped, the HUD away, a camera to put anywhere round him
  const [photo, setPhoto] = useState(null);
  const photoMode = useCallback((on) => {
    const s = sim.current;
    s.photo = on ? newPhoto(s.yaw, s.pitch) : null;
    s.keys.clear();
    setPhoto(s.photo ? { ...s.photo } : null);
    if (on) {
      setList(false);
      setTuning(false);
    }
  }, []);
  const changePhoto = useCallback((patch) => {
    const s = sim.current;
    if (!s.photo) return;
    s.photo = readPhoto({ ...s.photo, ...patch });
    setPhoto({ ...s.photo });
  }, []);
  const changeSettings = useCallback((next) => {
    const d = readSettings(next);
    setSettings(d);
    local.set(SET, d);
  }, []);
  const speedRef = useRef(null);
  const { unlock } = useAchievements();
  const tourRef = useRef(null);
  const [tourBest, setTourBest] = useState(() => sim.current?.tour.best ?? null);
  const [tourMsg, setTourMsg] = useState(null);
  useEffect(() => {
    if (!tourMsg) return undefined;
    const t = setTimeout(() => setTourMsg(null), 2600);
    return () => clearTimeout(t);
  }, [tourMsg]);
  // Peter's backpacks: how many found, and the one just found
  const [found, setFound] = useState(() => sim.current.found.length);
  const [pack, setPack] = useState(null);
  useEffect(() => {
    if (!pack) return undefined;
    const t = setTimeout(() => setPack(null), 5200);
    return () => clearTimeout(t);
  }, [pack]);
  // a perfect release, a trick, the style banked: a word of it on the screen
  const [trick, setTrick] = useState(null);
  const trickN = useRef(0);
  const showTrick = useCallback((text, combo = 0, cls = '') => setTrick({ n: ++trickN.current, text, combo, cls }), []);
  const styleRef = useRef(null);
  const [styleBest, setStyleBest] = useState(() => (Number.isFinite(local.get(STYLE_BEST, null)) ? local.get(STYLE_BEST, null) : 0));
  useEffect(() => {
    if (!trick) return undefined;
    const t = setTimeout(() => setTrick(null), 1300);
    return () => clearTimeout(t);
  }, [trick]);

  // the world: made once, kept while you're inside a building
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createCompoundWorld }) => {
        if (dead || !canvas.current) return null;
        return createCompoundWorld(canvas.current, { onLost: () => !dead && setGl('lost'), calm: prefersReducedMotion() });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        fit();
        // its shaders linked in the background before the first frame
        await settle(a.engine.precompile(), 4000);
        if (dead || a.lost) return;
        if (import.meta.env.DEV) window.__HQWORLD__ = { api: a, sim: sim.current, enter }; // for the QA scripts
        setGl('on');
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    const s = sim.current;
    return () => {
      dead = true;
      ro?.disconnect();
      local.set(AT, keep(s.h));
      api.current?.dispose();
      api.current = null;
    };
  }, [api, setGl, enter]);

  // out of a building: back outside its door, the camera off to one side so it isn't in the wall
  const was = useRef(inside);
  useEffect(() => {
    const from = was.current;
    was.current = inside;
    // gone indoors: the others see you go (they'd otherwise see you stand at the door)
    if (inside) trav.ref.current?.pose(sim.current.h, { inside: true }, { force: true });
    if (inside || !from) return;
    const p = placeById(from);
    if (!p) return;
    const s = sim.current;
    s.h = outside(p);
    s.yaw = behindYaw(p.face) + 0.85;
    s.dragAt = s.t;
    s.keys.clear();
    // (trav.ref is a ref: read when it changes, not a reason to run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inside]);

  const live = gl === 'on' && inView && !inside;

  const go = useCallback(() => {
    const s = sim.current;
    if (s.near) enter(s.near);
    else if (s.portal) portal();
    else if (s.armour || s.h.mode === 'suit') s.suit = true;
  }, [enter, portal]);

  // the walking keys: held by their place on the keyboard (middleearth/towns/keys)
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target)) return;
      keyDown(s.keys, e);
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const m = moveOf(e);
      if (m) {
        e.preventDefault();
        audioContext();
        if (m === 'space' && !e.repeat) s.jump = true;
        // Shift in the air: a web zip
        if (m === 'run' && !e.repeat && s.h.mode !== 'ground' && s.h.mode !== 'wall') s.zip = true;
        return;
      }
      const k = e.key;
      if ((k === 'e' || k === 'E' || k === 'Enter') && !(e.target instanceof HTMLButtonElement) && (s.near || s.portal || s.armour || s.h.mode === 'suit')) {
        e.preventDefault();
        if (!e.repeat) go();
      } else if (k === 'm' || k === 'M') {
        setList((v) => !v);
        setTuning(false);
      } else if (k === 'o' || k === 'O') {
        setTuning((v) => !v);
        setList(false);
      } else if ((k === 'p' || k === 'P') && !e.repeat) photoMode(!s.photo);
      else if (s.photo && (k === '[' || k === ']')) changePhoto({ fov: s.photo.fov + (k === '[' ? -4 : 4) });
      else if ((k === 'q' || k === 'Q') && !e.repeat) s.perch = true;
      else if ((k === 't' || k === 'T') && !e.repeat) s.trick = true;
      else if (k === 'Escape') {
        setList(false);
        setTuning(false);
        if (s.photo) photoMode(false);
      }
    };
    const up = (e) => keyUp(s.keys, e);
    const blur = () => {
      s.keys.clear();
      s.mouseWeb = false;
      s.touchWeb = false;
      s.touchDown = false;
    };
    // (the right button let go anywhere, off the canvas too)
    const mouseUp = (e) => {
      if (e.button === 2) s.mouseWeb = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('pointerup', mouseUp);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerup', mouseUp);
      s.keys.clear();
    };
  }, [live, go, photoMode, changePhoto]);

  // ── every frame ──
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const p = progRef.current;
    const set = setRef.current;
    // photo mode: nothing moves; the drawing puts the camera where the photo says
    if (s.photo) {
      const tv = trav.ref.current;
      tv?.pose(s.h);
      try {
        a.render({ hero: s.h, travellers: tv ? tv.list() : null, camYaw: s.yaw, camPitch: s.pitch, camDist: 7.6, near: null, done: p.done, next: p.next, portal: p.portal, tour: s.tour, found: s.found, photo: s.photo }, 0);
      } catch (err) {
        if (import.meta.env.DEV) console.error(err);
      }
      return;
    }
    // (the QA scripts can run the clock faster, in development only)
    const fast = import.meta.env.DEV ? (s.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    s.t += dt;
    const k = s.keys;
    const pad = readPad();
    const before = s.padBefore ?? {};
    const pressed = (b) => pad?.[b] && !before[b];
    s.padBefore = pad ?? {};

    let fwd = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) - s.stick.y;
    let side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + s.stick.x;
    if (pad) {
      fwd -= pad.ly;
      side += pad.lx;
      if (Math.abs(pad.rx) > 0) {
        s.yaw -= pad.rx * dt * 2.4 * set.look;
        s.dragAt = s.t;
      }
      if (Math.abs(pad.ry) > 0.1) s.pitch = Math.max(0.05, Math.min(0.9, s.pitch + pad.ry * dt * 1.2 * set.look * (set.invert ? -1 : 1)));
      if (pressed('a')) {
        if (s.near || s.portal) go();
        else s.jump = true;
      }
      if (pressed('b')) s.jump = true;
      if (pressed('x')) s.zip = true;
      if (pressed('up')) s.perch = true;
      if (pressed('down')) {
        if (s.h.mode === 'suit') s.suit = true;
        else s.trick = true;
      }
      if (pressed('y')) setList((v) => !v);
    }
    const suited = s.h.mode === 'suit';
    // (Shift, or in the armour the touch Down button and a pad's X, brings it down)
    const run = k.has('run') || Math.hypot(s.stick.x, s.stick.y) > 0.92 || Boolean(pad?.rb || pad?.lb) || (suited && (s.touchDown || Boolean(pad?.x)));
    const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
    // the web: the jump button held (Space, the right mouse button, the touch
    // button, or a pad's A or right trigger)
    const web = k.has('space') || s.mouseWeb || s.touchWeb || Boolean(pad?.rt || (pad?.a && !s.near && !s.portal) || pad?.b);
    const p0 = [s.h.x, s.h.y + 1, s.h.z];
    s.h = stepHero(s.h, { x: mv.x, z: mv.z, run, jump: s.jump, web, zip: s.zip, perch: s.perch, trick: s.trick, suit: s.suit, assist: set.assist }, dt);
    // the swing tour: the rings, in order, against the clock
    const [tour, tev] = stepTour(s.tour, p0, [s.h.x, s.h.y + 1, s.h.z], dt);
    s.tour = tour;
    // the lap, recorded as it goes, to race as a ghost next time if it's the best
    if (s.tour.on && s.rec) s.rec = recordLap(s.rec, s.h, s.tour.t);
    for (const e of tev) {
      if (e.type === 'tour-start') {
        sfx('ding');
        s.rec = recordLap([], s.h, 0);
        setTourMsg(s.lap ? 'The tour’s on: race your best lap, through the red rings' : 'The tour’s on: through the red rings');
      } else if (e.type === 'tour-ring') sfx('coin');
      else if (e.type === 'tour-lost') {
        s.rec = null;
        setTourMsg('Tour lost: back to the first ring to try again');
      } else if (e.type === 'tour-done') {
        sfx('fanfare');
        unlock('swingtour');
        if (e.best) {
          local.set(TOUR_BEST, e.time);
          setTourBest(e.time);
          if (s.rec?.length > 1) {
            s.rec = recordLap(s.rec, s.h, e.time);
            s.lap = s.rec;
            local.set(TOUR_LAP, s.lap);
          }
        }
        s.rec = null;
        setTourMsg(`${e.best ? 'A best: ' : 'Round in '}${clock(e.time)}`);
      }
    }
    if (tourRef.current && s.frame % 3 === 0) tourRef.current.textContent = s.tour.on ? `Ring ${s.tour.next} of ${TOUR.length - 1} · ${clock(s.tour.t)}` : '';
    // the flight's style so far, while there is some
    if (styleRef.current && s.frame % 3 === 1) styleRef.current.textContent = s.h.style > 0 ? `Style ${s.h.style.toLocaleString()} · ×${s.h.combo}` : '';
    s.jump = false;
    s.zip = false;
    s.perch = false;
    s.trick = false;
    s.suit = false;
    if (s.h.mode === 'suit' && s.h.y >= SUIT_HIGH) unlock('suitup');
    // a backpack within reach: found
    const pk = nearPack(s.h.x, s.h.y, s.h.z, s.found);
    if (pk) {
      s.found = [...s.found, pk.id];
      local.set(FOUND, s.found);
      sfx('coin');
      a.fx('pack', { id: pk.id });
      setFound(s.found.length);
      setPack({ n: s.found.length, ...pk });
      if (s.found.length === PACKS.length) {
        sfx('fanfare');
        unlock('backpacks');
      }
    }
    for (const e of s.h.ev) {
      if (e.type === 'web' || e.type === 'zip' || e.type === 'corner' || e.type === 'point') sfx('zip');
      else if (e.type === 'perfect') {
        sfx('ding');
        showTrick('Perfect swing', e.combo);
      } else if (e.type === 'trick') {
        sfx('pop');
        showTrick(TRICK_NAME[e.kind] ?? 'Trick', e.combo);
      } else if (e.type === 'bank') {
        sfx('oneUp');
        showTrick(`Style ${e.style.toLocaleString()}`, 0, 'cw-bank');
        if (e.style > styleBest) {
          local.set(STYLE_BEST, e.style);
          setStyleBest(e.style);
        }
        if (e.style >= SHOWBOAT) unlock('showboat');
      } else if (e.type === 'bail') {
        sfx('thunk');
        showTrick('Bailed', 0, 'cw-bail');
      } else if (e.type === 'suitup') sfx('repulsor');
      else if (e.type === 'suitoff') sfx('repulse');
      else if (e.type === 'land' && e.impact > 14) sfx('thunk');
      if (e.type !== 'jump' && e.type !== 'release') a.fx(e.type, { ...e, vx: s.h.vx, vy: s.h.vy, vz: s.h.vz });
    }
    if (Math.hypot(mv.x, mv.z) > 0.1 || s.h.mode !== 'ground') s.moved = true;
    // the camera drifts round behind him as he goes (quicker while he's
    // flying), unless you've just turned it
    if (s.h.speed > 0.5 && s.t - s.dragAt > 1.4 && set.follow > 0) {
      let d = behindYaw(s.h.face) - s.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.yaw += d * Math.min(1, dt * (s.h.fly ? 2.4 : 1.5) * set.follow);
    }
    // how fast it feels: lines at the edges of the screen
    if (speedRef.current) {
      const fast = s.h.mode === 'ground' ? 0 : Math.max(0, Math.min(1, (Math.hypot(s.h.vx, s.h.vy, s.h.vz) - 20) / 16));
      speedRef.current.style.opacity = (fast * 0.7 * set.shake).toFixed(2);
    }

    // a door, the portal, and who's about (on the lawn, on his feet)
    // (the armour's plinth is by the workshop's door: whichever is nearer)
    const grounded = s.h.mode === 'ground' && s.h.y < 0.3;
    const door = grounded ? nearPlace(s.h.x, s.h.z) : null;
    const plinth = grounded ? Math.hypot(s.h.x - ARMOUR.x, s.h.z - ARMOUR.z) : Infinity;
    s.armour = plinth < SUIT.r && (!door || plinth < door.d);
    s.near = s.armour ? null : (door?.id ?? null);
    s.portal = grounded && !s.near && !s.armour && p.portal && underPortal(s.h.x, s.h.z);
    const person = grounded ? nearCast(s.h.x, s.h.z) : null;
    const talk = person?.id ?? null;
    if (talk !== s.talk) {
      s.talk = talk;
      if (person) {
        const pool = linesFor(person, p.done);
        const n = lines.current[talk] ?? 0;
        lines.current[talk] = n + 1;
        const line = pool[n % pool.length];
        setBubble({ id: talk, name: person.name, line });
        if (SPOKEN[line]) clip(SPOKEN[line]);
      } else setBubble(null);
    }

    // other players: where you are to them, and where they are; and, while
    // a tour's on, the ghost of your best lap, drawn as they are
    const tv = trav.ref.current;
    tv?.pose(s.h);
    let others = tv ? tv.list() : null;
    const ghost = s.tour.on && s.lap ? lapAt(s.lap, s.tour.t) : null;
    if (ghost) others = [...(others ?? []), { id: 'best-lap', name: `Your best · ${clock(s.tour.best ?? 0)}`, ...ghost, moving: ghost.speed > 0.4, inside: false, ring: false }];
    try {
      a.render({ hero: s.h, travellers: others, camYaw: s.yaw, camPitch: s.pitch, camDist: (touch ? 8.4 : 7.6) * set.camera, shake: set.shake, near: s.near, done: p.done, next: p.next, portal: p.portal, tour: s.tour, found: s.found, move: { mx: mv.x, mz: mv.z, len: Math.hypot(mv.x, mv.z) } }, ms * fast);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      a.dispose();
      api.current = null;
      setGl('failed');
      return;
    }

    const key = [s.near, s.portal, s.moved, s.armour, suited].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ near: s.near, portal: s.portal, moved: s.moved, armour: s.armour, suit: suited });
    }
    // the speech bubble follows whoever's talking
    if (s.talk && bubbleRef.current) {
      const at = a.screenOf('cast', s.talk);
      if (at) {
        bubbleRef.current.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        bubbleRef.current.style.opacity = '1';
      } else bubbleRef.current.style.opacity = '0';
    }
    if (++s.frame % 4 === 0) drawMap(map.current, s.h, p, others, s.found, s.tour);
    if (s.frame % 120 === 0 && s.h.mode === 'ground') local.set(AT, keep(s.h));
  }, live);

  // drag to look round
  const drag = useRef(null);
  const onPointer = (e) => {
    const s = sim.current;
    // the right mouse button is the web (and a jump, from the ground); a
    // press while the left is down comes as a move
    if (e.pointerType === 'mouse' && e.button === 2) {
      const down = Boolean(e.buttons & 2);
      if (down && !s.mouseWeb) {
        audioContext();
        s.jump = true;
      }
      s.mouseWeb = down;
      if (e.type !== 'pointermove') return;
    }
    if (e.type === 'pointerdown') {
      audioContext();
      drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      return;
    }
    if (e.type === 'pointermove') {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const set = setRef.current;
      if (s.photo) {
        s.photo = readPhoto({ ...s.photo, yaw: s.photo.yaw - (e.clientX - d.x) * 0.0065 * set.look, pitch: s.photo.pitch + (e.clientY - d.y) * 0.005 * set.look * (set.invert ? -1 : 1) });
        d.x = e.clientX;
        d.y = e.clientY;
        return;
      }
      s.yaw -= (e.clientX - d.x) * 0.0065 * set.look;
      s.pitch = Math.max(0.05, Math.min(0.9, s.pitch + (e.clientY - d.y) * (e.pointerType === 'mouse' ? 0.004 : 0) * set.look * (set.invert ? -1 : 1)));
      d.x = e.clientX;
      d.y = e.clientY;
      s.dragAt = s.t;
      return;
    }
    drag.current = null;
  };

  // the touch stick: drag from where you put your thumb
  const stick = useRef(null);
  const onStick = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      e.currentTarget.setPointerCapture(e.pointerId);
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
    const dx = Math.max(-1, Math.min(1, (e.clientX - stick.current.x) / 46));
    const dy = Math.max(-1, Math.min(1, (e.clientY - stick.current.y) / 46));
    s.stick = { x: dx, y: dy };
    e.currentTarget.style.setProperty('--sx', `${dx * 26}px`);
    e.currentTarget.style.setProperty('--sy', `${dy * 26}px`);
  };

  // to the swing tour's start: on the drive behind the first ring, facing it
  const toTour = () => {
    const r = TOUR[0];
    const s = sim.current;
    const face = Math.atan2(-r.n[2], r.n[0]);
    s.h = newHero({ x: r.x - r.n[0] * 14, z: r.z - r.n[2] * 14, face });
    s.yaw = behindYaw(face);
    s.dragAt = s.t;
    s.tour = newTour(s.tour.best);
    s.rec = null;
    setList(false);
  };

  // to a door, from the list
  const travel = (id) => {
    const p = placeById(id);
    const s = sim.current;
    s.h = outside(p);
    s.yaw = behindYaw(p.face) + Math.PI; // looking back at the door
    s.dragAt = s.t;
    setList(false);
  };

  const here = hud.near ? prog.places.find((p) => p.id === hud.near) : null;
  const herePortal = hud.portal && !here;
  return (
    <div ref={box} className="cw-stage" data-touch={touch || undefined} data-photo={photo ? '' : undefined}>
      <canvas ref={canvas} className="cw-canvas" data-on={gl === 'on' || undefined} aria-label="The Avengers compound in 3D: the hangar, the main building and its glass wing, the training center, the lab and the range, and Spider-Man on the lawn" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} onWheel={(e) => sim.current.photo && changePhoto({ dist: sim.current.photo.dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1) })} />
      <div ref={speedRef} className="cw-speed" aria-hidden="true" />
      {gl === 'loading' && <p className="cw-loading">Flying in to the compound…</p>}
      {tourMsg && (
        <p className="cw-tour-msg" aria-live="polite">
          {tourMsg}
        </p>
      )}
      {pack && (
        <div key={pack.n} className="cw-pack" role="status">
          <p className="cw-pack-n">
            Backpack {pack.n} of {PACKS.length} · {pack.where}
          </p>
          <p className="cw-pack-what">{pack.memento}</p>
          <p className="cw-pack-line">“{pack.line}”</p>
        </div>
      )}
      {trick && (
        <p key={trick.n} className={`cw-trick ${trick.cls}`} aria-live="polite">
          {trick.text}
          {trick.combo > 1 ? <b> ×{trick.combo}</b> : null}
        </p>
      )}
      <p ref={styleRef} className="cw-style" aria-live="off" />

      <div className="cw-hud cw-hud-top">
        <div className="cw-brand">
          <p className="cw-eyebrow">The Avengers compound · Upstate New York</p>
          <h1 id="cw-title" className="cw-title">
            Avengers HQ
          </h1>
          <p className="cw-objective" aria-live="polite">
            <span aria-hidden="true">▲</span> {prog.objective}
          </p>
        </div>
        <div className="cw-side">
          <canvas ref={map} className="cw-map" width="150" height="150" aria-hidden="true" />
          <p className="cw-chip cw-stones" aria-label={`${prog.stones} of 6 Infinity Stones won back`}>
            {STONES.map((st) => (
              <i key={st.id} className="stone-dot" data-on={prog.have.includes(st.id) || undefined} style={{ '--glow': st.color }} />
            ))}
            <b>{prog.stones}</b> of 6
          </p>
          <button
            type="button"
            className="cw-chip"
            onClick={() => {
              setList((v) => !v);
              setTuning(false);
            }}
            aria-expanded={list}
          >
            The buildings {!touch && <kbd>M</kbd>}
          </button>
          <button
            type="button"
            className="cw-chip"
            onClick={() => {
              setTuning((v) => !v);
              setList(false);
            }}
            aria-expanded={tuning}
            aria-controls="cw-settings"
          >
            Settings {!touch && <kbd>O</kbd>}
          </button>
          <button type="button" className="cw-chip" onClick={() => photoMode(true)} title="Stop time, put the camera anywhere round him, and save a picture">
            Photo {!touch && <kbd>P</kbd>}
          </button>
          <button type="button" className="cw-chip cw-tour" onClick={toTour} title="Rings round the compound, against the clock: through the first red ring to start">
            Swing tour {tourBest != null && <b>{clock(tourBest)}</b>}
          </button>
          {styleBest > 0 && (
            <p className="cw-chip cw-style-best" title="The most style banked in one flight: flips, twists and perfect releases, one after another, and a landing">
              Best style <b>{styleBest.toLocaleString()}</b>
            </p>
          )}
          <p ref={tourRef} className="cw-chip cw-tour-on" aria-live="off" />
          <p className="cw-chip cw-packs" title="Peter’s backpacks, webbed up round the compound: on the roofs, up the masts, under the bridge. Walk up to one." aria-label={`${found} of ${PACKS.length} backpacks found`}>
            <span aria-hidden="true">🎒</span> <b>{found}</b> of {PACKS.length}
          </p>
          <Players trav={trav} />
        </div>
      </div>

      {bubble && (
        <div ref={bubbleRef} className="cw-bubble" aria-live="polite">
          <div>
            <b>{bubble.name}</b>
            <span>{bubble.line}</span>
          </div>
        </div>
      )}

      {here && (
        <div className="cw-door" style={{ '--cw-accent': here.accent }}>
          <p className="cw-door-sub">{here.where}</p>
          <p className="cw-door-name">{here.name}</p>
          <p className="cw-door-stone" style={{ '--glow': stoneFor(here)?.color ?? here.accent }}>
            {stoneFor(here) && <i className="stone-dot" data-on={here.done || undefined} aria-hidden="true" />}
            {stoneLine(here)}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => enter(here.id)}>
            {here.act} {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}
      {hud.armour && !here && (
        <div className="cw-door" style={{ '--cw-accent': '#ffb347' }}>
          <p className="cw-door-sub">By the workshop’s door</p>
          <p className="cw-door-name">An Iron Man armour</p>
          <p className="cw-door-stone">Tony left one out. It flies: {touch ? 'Up and Down to climb and come down, the stick to fly, Step out to get out' : 'Space up, Shift down, W A S D to fly, E to step out'}.</p>
          <button type="button" className="btn btn-primary" onClick={() => (sim.current.suit = true)}>
            Suit up {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}
      {herePortal && (
        <div className="cw-door cw-door-portal" style={{ '--cw-accent': '#6cc8ff' }}>
          <p className="cw-door-sub">Over the helipad</p>
          <p className="cw-door-name">The portal</p>
          <p className="cw-door-stone">Titan is on the other side, and Thanos with it.</p>
          <button type="button" className="btn btn-primary" onClick={portal}>
            Go through {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}

      {gl === 'on' && hud.suit && <p className="cw-hint">{touch ? 'Hold Up to climb, Down to come down, the stick to fly. Step out gets out of the armour.' : 'Space to climb, Shift to come down, W A S D to fly; it leans into its speed. E steps out of the armour, wherever you are.'}<GuideCue touch={touch} /></p>}
      {gl === 'on' && !hud.moved && !here && !herePortal && !hud.suit && (
        <p className="cw-hint">{touch ? 'Stick to walk. Hold Jump in the air to swing, let go to fly. Zip, Perch, Trick, and jump at walls.' : 'W A S D to walk, Shift to run, Space to jump. Hold Space in the air (or the right mouse button) to swing, let go on the upswing to fly; hold on with nothing to catch for web wings. Shift in the air zips, Q launches to a perch, T throws a flip (or a twist, with a direction held). Jump at a wall to run up it. E at a door, O for the settings.'}<GuideCue touch={touch} /></p>
      )}

      {touch && (
        <div className="cw-hud cw-hud-bottom">
          <div className="cw-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} onLostPointerCapture={onStick} aria-hidden="true">
            <span />
          </div>
          <button
            type="button"
            className="cw-jump"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              audioContext();
              sim.current.jump = true;
              sim.current.touchWeb = true;
            }}
            onPointerUp={() => (sim.current.touchWeb = false)}
            onPointerCancel={() => (sim.current.touchWeb = false)}
            onLostPointerCapture={() => (sim.current.touchWeb = false)}
          >
            {hud.suit ? 'Up' : 'Jump'}
            {!hud.suit && <small>hold: swing</small>}
          </button>
          <div className="cw-acts">
            <button
              type="button"
              className="cw-jump cw-zip"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                audioContext();
                if (sim.current.h.mode === 'suit') sim.current.touchDown = true;
                else sim.current.zip = true;
              }}
              onPointerUp={() => (sim.current.touchDown = false)}
              onPointerCancel={() => (sim.current.touchDown = false)}
              onLostPointerCapture={() => (sim.current.touchDown = false)}
            >
              {hud.suit ? 'Down' : 'Zip'}
            </button>
            <button
              type="button"
              className="cw-jump cw-zip"
              onPointerDown={(e) => {
                e.preventDefault();
                audioContext();
                sim.current.perch = true;
              }}
            >
              Perch
            </button>
            <button
              type="button"
              className="cw-jump cw-zip"
              onPointerDown={(e) => {
                e.preventDefault();
                audioContext();
                if (sim.current.h.mode === 'suit') sim.current.suit = true;
                else sim.current.trick = true;
              }}
            >
              {hud.suit ? 'Step out' : 'Trick'}
            </button>
          </div>
        </div>
      )}

      {photo && <PhotoBar photo={photo} onChange={changePhoto} onSave={() => savePhoto(api.current, canvas.current, sim.current, progRef.current)} onClose={() => photoMode(false)} touch={touch} />}
      {tuning && <Settings id="cw-settings" settings={settings} onChange={changeSettings} onClose={() => setTuning(false)} />}
      {list && (
        <div className="cw-list" role="dialog" aria-label="The buildings on the compound">
          <div className="cw-list-head">
            <p>The compound</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList(false)}>
              Close
            </button>
          </div>
          <ol>
            {prog.places.map((p, i) => (
              <li key={p.id} data-done={p.done || undefined} data-next={p.id === prog.next || undefined} style={{ '--glow': stoneFor(p)?.color ?? p.accent, '--cw-accent': p.accent }}>
                <span className="cw-list-n" aria-hidden="true">
                  {p.done ? '✓' : i + 1}
                </span>
                <div>
                  <p className="cw-list-name">{p.name}</p>
                  <p className="cw-list-sub">
                    {p.where} · {stoneLine(p)}
                  </p>
                </div>
                <div className="cw-list-acts">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => travel(p.id)}>
                    Go there
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => enter(p.id)}>
                    {p.act}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// The settings (rules.js's SETTINGS), from the Settings chip (or O): how the
// view turns, how far back the camera sits, how much a swing helps you
// round, how the camera follows, how much it kicks. Every change is live and
// kept between visits. Not modal: the compound stays playable behind it.
const shown = (r, v) => (r.toggle ? (v ? 'On' : 'Off') : v === 0 ? 'Off' : `${Math.round(v * 100)}%`);
function Settings({ id, settings, onChange, onClose }) {
  return (
    <section id={id} className="cw-list cw-set" role="dialog" aria-label="Settings">
      <div className="cw-list-head">
        <p>Settings</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="cw-set-rows">
        {Object.entries(SETTINGS).map(([k, r]) => {
          const v = settings[k];
          return (
            <label key={k} className="cw-set-row">
              <span className="cw-set-top">
                <span className="cw-list-name">{r.label}</span>
                <output>{shown(r, v)}</output>
              </span>
              {r.toggle ? (
                <input type="checkbox" checked={Boolean(v)} onChange={(e) => onChange({ ...settings, [k]: e.target.checked ? 1 : 0 })} aria-describedby={`${id}-${k}`} />
              ) : (
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={v}
                  style={{ '--fill': `${((v - r.min) / (r.max - r.min)) * 100}%` }}
                  onChange={(e) => onChange({ ...settings, [k]: Number(e.target.value) })}
                  // (dragged with a mouse or a thumb, it lets go of the arrow keys again)
                  onPointerUp={(e) => e.currentTarget.blur()}
                  aria-describedby={`${id}-${k}`}
                />
              )}
              <span id={`${id}-${k}`} className="cw-list-sub">
                {r.hint}
              </span>
            </label>
          );
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...SETTINGS_DEFAULTS })}>
          Back to how it came
        </button>
      </div>
    </section>
  );
}

// Photo mode's bar: the lens and the distance (the drag turns the camera,
// the wheel brings it in), a picture saved, and the way back.
function PhotoBar({ photo, onChange, onSave, onClose, touch }) {
  const row = (label, k, [min, max], step, shown) => (
    <label className="cw-photo-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={photo[k]} style={{ '--fill': `${((photo[k] - min) / (max - min)) * 100}%` }} onChange={(e) => onChange({ [k]: Number(e.target.value) })} onPointerUp={(e) => e.currentTarget.blur()} />
      <output>{shown}</output>
    </label>
  );
  return (
    <section className="cw-photo cw-set" role="dialog" aria-label="Photo mode">
      <p className="cw-photo-title">Photo mode</p>
      <p className="cw-photo-hint">{touch ? 'Drag to move the camera round him.' : 'Drag to move the camera round him, scroll to bring it in, [ and ] for the lens.'}</p>
      {row('Lens', 'fov', PHOTO.fov, 1, `${Math.round(photo.fov)}°`)}
      {row('Distance', 'dist', PHOTO.dist, 0.1, `${photo.dist.toFixed(1)} m`)}
      <div className="cw-photo-acts">
        <button type="button" className="btn btn-primary btn-sm" onClick={onSave}>
          Save the picture
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Back {!touch && <kbd>P</kbd>}
        </button>
      </div>
    </section>
  );
}

// The picture: drawn once more and read off the canvas in the same breath
// (before the browser clears it), then handed over as a PNG.
function savePhoto(a, c, s, p) {
  if (!a || !c || !s.photo) return;
  try {
    a.render({ hero: s.h, travellers: null, camYaw: s.yaw, camPitch: s.pitch, camDist: 7.6, near: null, done: p.done, next: p.next, portal: p.portal, tour: s.tour, found: s.found, photo: s.photo }, 0);
    const url = c.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `avengers-hq-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    sfx('ding');
  } catch (err) {
    if (import.meta.env.DEV) console.error(err);
  }
}

// Other players online here: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as the universe's map has it).
function Players({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="cw-chip" onClick={trav.join} title="Go online, and see everyone else walking the compound as a hologram">
        See other players
      </button>
    );
  return (
    <span className="cw-chip cw-players" data-on="" title="Everyone else online here shows as a hologram: they can’t touch your games, nor you theirs">
      <b>{trav.count}</b> {trav.count === 1 ? 'player' : 'players'} here
    </span>
  );
}

// The map in the corner: the river, the lawn and its drives, the buildings,
// the doors (a stone over each one won back), the portal once it's open, the
// backpacks still to find near you, the swing tour's next ring, and you.
const MAP = { x0: -60, z0: -20, size: 300 };
const PACK_SHOWN = 42; // a backpack shows on the map this near (m)
function drawMap(c, h, prog, others, found = [], tour = null) {
  const g = c?.getContext('2d');
  if (!g) return;
  const k = 150 / MAP.size;
  const at = (x, z) => [(x - MAP.x0) * k, (z - MAP.z0) * k];
  const poly = (pts) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.closePath();
  };
  g.clearRect(0, 0, 150, 150);
  g.save();
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#2f4a2c'; // the woods
  g.fillRect(0, 0, 150, 150);
  g.fillStyle = '#3d6f7a';
  poly(RIVER_W);
  g.fill();
  g.fillStyle = '#7da35a';
  poly(LAWN_W);
  g.fill();
  g.strokeStyle = '#d9dbd2';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(1.2, ROAD_HALF * 2 * k);
  for (const r of ROADS_W) {
    g.beginPath();
    r.forEach(([x, z], i) => (i ? g.lineTo(...at(x, z)) : g.moveTo(...at(x, z))));
    g.stroke();
  }
  g.fillStyle = '#f2f4f6';
  g.strokeStyle = 'rgba(20, 28, 36, 0.55)';
  g.lineWidth = 0.8;
  for (const b of BUILDINGS) {
    poly(b.foot);
    g.fill();
    g.stroke();
  }
  // the doors: a pulsing ring for the next, a dot for the rest, the stone's colour once won
  const pulse = 3.2 + Math.sin(performance.now() / 260) * 1.2;
  for (const p of prog.places) {
    const [x, y] = at(p.x, p.z);
    g.fillStyle = p.done ? stoneFor(p)?.color ?? p.accent : p.accent;
    g.beginPath();
    g.arc(x, y, p.done ? 3.4 : 2.8, 0, Math.PI * 2);
    g.fill();
    if (p.id === prog.next) {
      g.strokeStyle = p.accent;
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(x, y, pulse + 2, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (prog.portal) {
    const [x, y] = at(PORTAL.x, PORTAL.z);
    g.strokeStyle = '#9fdcff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 4 + pulse * 0.4, 0, Math.PI * 2);
    g.stroke();
  }
  // the swing tour: the next ring red (the first, faintly, before a tour), the rest of the course faint
  if (tour) {
    const next = tour.on ? tour.next : 0;
    g.strokeStyle = 'rgba(255, 90, 79, 0.45)';
    g.lineWidth = 1;
    g.beginPath();
    TOUR.forEach((r, i) => (i ? g.lineTo(...at(r.x, r.z)) : g.moveTo(...at(r.x, r.z))));
    if (tour.on) g.stroke();
    const r = TOUR[next];
    const [x, y] = at(r.x, r.z);
    g.fillStyle = tour.on ? '#ff5a4f' : 'rgba(255, 90, 79, 0.7)';
    g.beginPath();
    g.arc(x, y, tour.on ? 3 : 2.4, 0, Math.PI * 2);
    g.fill();
    if (tour.on) {
      g.strokeStyle = '#ff5a4f';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, pulse + 1.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // the backpacks still to find, once you're near one: a white dot, blinking
  if (Math.sin(performance.now() / 180) > -0.3) {
    g.fillStyle = '#ffffff';
    for (const p of PACKS) {
      if (found.includes(p.id) || Math.hypot(p.x - h.x, p.z - h.z) > PACK_SHOWN) continue;
      const [x, y] = at(p.x, p.z);
      g.beginPath();
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  // the others online, pale
  if (others?.length) {
    g.fillStyle = 'rgba(190, 215, 255, 0.95)';
    for (const o of others) {
      if (o.inside) continue;
      const [x, y] = at(o.x, o.z);
      g.beginPath();
      g.arc(x, y, 2.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  // you
  const [cx, cy] = at(h.x, h.z);
  g.save();
  g.translate(cx, cy);
  g.rotate(-h.face + Math.PI / 2);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#1d2f5c';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(200, 220, 240, 0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(75, 75, 73, 0, Math.PI * 2);
  g.stroke();
}

// Without 3D: the compound from the air, its pins opening the games, and the
// buildings as cards.
function Cards({ prog, enter, three, gl, retry }) {
  const ids = PLACES.map((p) => p.id);
  return (
    <div className="shell cw-cards-wrap">
      <p className="eyebrow">The Avengers compound · Upstate New York</p>
      <h1 id="cw-title" className="display hq-steel mt-4 text-[clamp(2.6rem,1.6rem+3.6vw,4.6rem)]">
        Avengers HQ
      </h1>
      <p className="lead mt-4 max-w-[60ch]">Marvel, all of it. Every building on the compound belongs to someone, and each has a game that wins an Infinity Stone back (and Spider-Man has one at the front gate). {prog.objective}</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the compound from the air.' : gl === 'failed' ? 'The 3D compound couldn’t start here, so here it is from the air.' : three.held ? 'The 3D compound isn’t loaded yet, so here it is from the air.' : '3D is switched off, so here’s the compound from the air.'}
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
      <div className="cw-cards-grid mt-8">
        <figure className="m-0">
          <div className="hq-hud">
            <Suspense fallback={<div className="hq-map" aria-hidden="true" />}>
              <CompoundMap spots={ids} titles={prog.places.map((p, i) => `${i + 1}. ${p.name}`)} stones={prog.places.map((p) => (p.done ? stoneFor(p)?.color ?? null : null))} onPick={enter} className="hq-hero-map" />
            </Suspense>
          </div>
          <figcaption className="mt-3 text-sm text-muted">The compound from the air. Pick a pin to go in.</figcaption>
        </figure>
        <ol className="cw-cards">
          {prog.places.map((p, i) => (
            <li key={p.id} data-done={p.done || undefined} style={{ '--glow': stoneFor(p)?.color ?? p.accent }}>
              <p className="cw-list-name">
                {i + 1}. {p.name}
              </p>
              <p className="cw-list-sub">
                {p.where} · {stoneLine(p)}
              </p>
              <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => enter(p.id)}>
                {p.act}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
