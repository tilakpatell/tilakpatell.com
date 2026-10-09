import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, prefersReducedMotion, useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { readPad, typing } from '../../games/pad';
import { keyDown, keyUp, moveOf } from '../../middleearth/towns/keys';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import { SOUL_HALVES, earnedStones, hasEarned } from '../hq/stones';
import { createImpacts } from '../../../lib/impact';
import { ARMOUR, HERO_R, PACKS, PLACES, START, SUIT, TOUR, behindYaw, cameraMove, floorAt, lapAt, linesFor, nearCast, newPhoto, readPhoto, nearPack, nearPlace, newHero, newTour, outside, placeById, progress, readLap, readSettings, recordLap, jumpPress, stepHero, stepTour, underPortal, walkable } from './rules';
import { useAchievements } from '../../Achievements';
import './world.css';
import '../../../styles/lazy/avengers.css';
import CompoundHud from './CompoundHud';
import { drawMap } from './map';
import { fitCanvas } from '../../../runtime/hud';
import { clock, stoneFor, stoneLine } from './labels';
import { useVoiced } from '../../../lib/useVoiced';
import { sayVoiced } from '../../../lib/voiced';
import LoadingVeil from '../../worlds/LoadingVeil';
import { throttled } from '../../worlds/loadingSteps';

// The Avengers compound, the world: walk about the compound as Spider-Man,
// and go into the buildings to play their games. Anyone else online here
// shows as a hologram (as in the Middle-earth towns). The rules are in
// ./rules.js, the drawing in ./scene.js; this is the walking, the HUD and the
// doors. Each game opens over the page (./Place.jsx); leave it and you're
// back outside its door. Without 3D, the compound is the drawing from the
// air, and its pins open the games.

const Place = lazy(() => import('./Place'));
const CompoundMap = lazy(() => import('../Compound'));
const clip = (id, o) => import('../../../lib/clips').then((c) => c.playClip(id, o)).catch(() => null);
const sfx = (name) => import('../../../lib/sfx').then((s) => s[name]?.()).catch(() => null);
// a landing's thunk by how hard (lib/impact.js's law, from where it used to
// start to a fall off the main building's roof), over a floor so every one
// it played is still heard
const LANDING = createImpacts({ threshold: 14, full: 34, gap: 0.08 });
const thunkBy = (impact) => {
  const r = LANDING.hit(impact, 'land');
  if (r) import('../../../lib/sfx').then((s) => s.play('thunk', { gain: 0.35 + 0.65 * r.gain, pitch: r.pitch })).catch(() => null);
};
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
// the lines the site has the films' own recordings of (lib/clips)
const SPOKEN = { 'Hulk smash!': 'hulkSmash', 'Puny god.': 'punyGod' };
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
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  // other players online here, as holograms (middleearth/towns/useTravellers)
  const trav = useTravellers('avengers', gl === 'on', ROOM);
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.25 });
  const canvas = useRef(null);
  const map = useRef(null);
  // the map's canvas, as many pixels as the screen has under it (sharp on a
  // 2× screen, and at a phone's 96 px): fitted when its box changes, not
  // every frame; drawn in 150ths of its width, whatever its size
  const mapBox = useRef(null);
  useEffect(() => {
    const c = map.current;
    if (!c) return undefined;
    const fit = () => {
      // (hidden, as in photo mode, it keeps the last fit)
      const b = fitCanvas(c, 150);
      if (b) mapBox.current = b;
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, []);
  const sim = useRef(null);
  if (!sim.current) {
    const kept = local.get(AT, null);
    // (where he was last time: on the lawn, or up on a roof)
    const ky = Number.isFinite(kept?.y) ? kept.y : 0;
    const ok = kept && Number.isFinite(kept.x) && Number.isFinite(kept.z) && floorAt(kept.x, kept.z, ky) === ky && walkable(kept.x, kept.z, HERO_R, ky);
    const h = newHero(ok ? { ...kept, y: ky } : START);
    sim.current = { h, keys: new Set(), stick: { x: 0, y: 0 }, yaw: behindYaw(h.face), pitch: 0.2, dragAt: -1e9, near: null, portal: false, talk: null, say: null, frame: 0, moved: false, t: 0, jump: false, press: jumpPress(), zip: false, perch: false, trick: false, suit: false, photo: null, armour: false, touchDown: false, mouseWeb: false, touchWeb: false, padBefore: null, tour: newTour(Number.isFinite(local.get(TOUR_BEST, null)) ? local.get(TOUR_BEST, null) : null), found: readFound(), lap: readLap(local.get(TOUR_LAP, null)), rec: null };
  }
  const progRef = useRef(prog);
  progRef.current = prog;
  const [hud, setHud] = useState({ near: null, portal: false, moved: false, armour: false, suit: false });
  const hudKey = useRef('');
  const [bubble, setBubble] = useState(null);
  // what they say, in their own voice where it's been made (the lines with a clip of their own play that)
  useVoiced(bubble?.id, bubble && !SPOKEN[bubble.line] ? bubble.line : null);
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
        // everything on the graphics chip before it's shown (its shaders, its
        // pictures, one draw), behind the loading screen
        await a.prepare?.(throttled(setPrep), { alive: () => !dead });
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
    // the jump through its press (./rules.js): a moment early or late still goes
    if (s.jump) s.press.press();
    s.h = stepHero(s.h, { x: mv.x, z: mv.z, run, press: s.press, web, zip: s.zip, perch: s.perch, trick: s.trick, suit: s.suit, assist: set.assist }, dt);
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
      sayVoiced('peter', pk.line); // what Peter says about it, in his own voice where it's been made (lib/voiced.js)
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
      else if (e.type === 'land' && e.impact > 14) thunkBy(e.impact);
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
        // (and the line to the drawing, for the gesture they say it with)
        s.say = { id: talk, line };
        if (SPOKEN[line]) clip(SPOKEN[line], { voice: true }); // (a voice, on the floor: lib/speech.js)
      } else {
        setBubble(null);
        s.say = null;
      }
    }

    // other players: where you are to them, and where they are; and, while
    // a tour's on, the ghost of your best lap, drawn as they are
    const tv = trav.ref.current;
    tv?.pose(s.h);
    let others = tv ? tv.list() : null;
    const ghost = s.tour.on && s.lap ? lapAt(s.lap, s.tour.t) : null;
    if (ghost) others = [...(others ?? []), { id: 'best-lap', name: `Your best · ${clock(s.tour.best ?? 0)}`, ...ghost, moving: ghost.speed > 0.4, inside: false, ring: false }];
    try {
      a.render({ hero: s.h, travellers: others, camYaw: s.yaw, camPitch: s.pitch, camDist: (touch ? 8.4 : 7.6) * set.camera, shake: set.shake, near: s.near, done: p.done, next: p.next, portal: p.portal, tour: s.tour, found: s.found, say: s.say, move: { mx: mv.x, mz: mv.z, len: Math.hypot(mv.x, mv.z) } }, ms * fast);
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
    if (++s.frame % 4 === 0) drawMap(map.current, mapBox.current, s.h, p, others, s.found, s.tour);
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

  // the touch stick (the HUD kit's: one thumb at a time, from where it went down)
  const onStick = (x, y) => (sim.current.stick = { x, y });

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

  return (
    <div ref={box} className="cw-stage" data-touch={touch || undefined} data-photo={photo ? '' : undefined}>
      <canvas ref={canvas} className="cw-canvas" data-on={gl === 'on' || undefined} aria-label="The Avengers compound in 3D: the hangar, the main building and its glass wing, the training center, the lab and the range, and Spider-Man on the lawn" role="img" onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerCancel={onPointer} onContextMenu={(e) => e.preventDefault()} onWheel={(e) => sim.current.photo && changePhoto({ dist: sim.current.photo.dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1) })} />
      <div ref={speedRef} className="cw-speed" aria-hidden="true" />
      <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Flying in to the compound" />
      <CompoundHud touch={touch} gl={gl} prog={prog} hud={hud} sim={sim} enter={enter} portal={portal} trav={trav} list={list} setList={setList} tuning={tuning} setTuning={setTuning} photo={photo} photoMode={photoMode} changePhoto={changePhoto} onSavePhoto={() => savePhoto(api.current, canvas.current, sim.current, progRef.current)} settings={settings} changeSettings={changeSettings} tourMsg={tourMsg} pack={pack} trick={trick} styleRef={styleRef} tourRef={tourRef} map={map} bubble={bubble} bubbleRef={bubbleRef} tourBest={tourBest} styleBest={styleBest} found={found} toTour={toTour} travel={travel} onStick={onStick} />
    </div>
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
