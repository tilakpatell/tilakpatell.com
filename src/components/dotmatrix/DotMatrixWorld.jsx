import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import '@fontsource/press-start-2p/400.css';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { use3D } from '../../lib/gpu';
import LoadingVeil from '../worlds/LoadingVeil';
import { throttled } from '../worlds/loadingSteps';
import { local, useFrameLoop, useInView, useMediaQuery } from '../../lib/hooks';
import { capturePointer } from '../../lib/pointer';
import { useVoiced } from '../../lib/useVoiced';
import { readPad, typing } from '../games/pad';
import { useTravellers } from '../middleearth/towns/useTravellers';
import { PALETTES } from './dither';
import { cartInfo, readFound, saveFound, useFound } from './found';
import { CARTRIDGES, COINS, SIGNS, ZOOM, cameraMove, islanderStep, nearAction, newGame, pitchFor, progress, step, talk, walkerAt, WALKERS, warp, zoomTo } from './rules';
import { VOICE } from './voicelines';
import './dotmatrix.css';
import { Exit } from '../../runtime/hud';
import DotMatrixHud from './DotMatrixHud';

// Dot Matrix, the world: walk and jump about a Game Boy island in its four
// greens, find the eight cartridges (each one a project of mine), and play
// the giant Game Boy in the square, which is the real console from the
// emulator's project page, or the giant N64 beside it: a real N64 emulated
// (../n64/), playing the player's own Super Mario 64 ROM, or else the Mario
// 64 tribute (../mario64/), or the giant crafting table east of it, which
// opens the Minecraft tribute (../minecraft/), each full screen over the island. The rules are in ./rules.js, the drawing in
// ./scene.js and ./dither.js; this is the keys, the HUD and the talking.
// Everyone else online on the island shows as a pale ghost with their name
// over them (the Middle-earth towns' travellers, in a room of its own).
// Without 3D, the cartridges are a list and the Game Boy plays on its own.

const GameBoyStage = lazy(() => import('../../stages/GameBoyStage'));
const Mario64 = lazy(() => import('../mario64/Mario64'));
const Minecraft = lazy(() => import('../minecraft/Minecraft'));
const Eaglercraft = lazy(() => import('../eagler/Eaglercraft'));
const N64 = lazy(() => import('../n64/N64'));
const sounds = () => import('./sounds');
const PALETTE = 'tp-dmg-palette';
const MUSIC = 'tp-dmg-music';

const CODES = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'a',
  KeyZ: 'a',
  KeyK: 'a',
  KeyX: 'b',
  KeyF: 'b',
  KeyJ: 'b',
  Enter: 'b',
  NumpadEnter: 'b',
  KeyQ: 'turnL',
  KeyE: 'turnR',
  KeyM: 'menu',
  Equal: 'zoomIn',
  NumpadAdd: 'zoomIn',
  Minus: 'zoomOut',
  NumpadSubtract: 'zoomOut',
};

export default function DotMatrixWorld() {
  const three = use3D();
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const world = three.on && gl !== 'failed' && gl !== 'lost';
  return (
    <section className="dm-world" aria-labelledby="dm-title">
      {world ? <World gl={gl} setGl={setGl} /> : <Cards three={three} gl={gl} retry={() => setGl('loading')} />}
    </section>
  );
}

function World({ gl, setGl }) {
  const [prep, setPrep] = useState({ value: 0, step: 'load' }); // (how far it's got sending itself to the graphics chip)
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [box, inView] = useInView({ rootMargin: '0px', threshold: 0.3 });
  const canvas = useRef(null);
  const stage = useRef(null);
  const api = useRef(null);
  const sim = useRef(null);
  const { unlock } = useAchievements();
  if (!sim.current) sim.current = { g: newGame({ found: readFound() }), keys: new Set(), pressed: new Set(), stick: { x: 0, y: 0 }, touchA: false, yaw: 0, yawTo: 0, dist: ZOOM.start, distTo: ZOOM.start, pinch: null, padBefore: {}, moved: false, warp: null, music: null, started: false, others: [], eased: {} };
  // what the scene draws from: the game, where the camera stands, and who else is here
  const view = () => ({ game: sim.current.g, yaw: sim.current.yaw, dist: sim.current.dist, pitch: pitchFor(sim.current.dist), travellers: sim.current.others });
  // the other islanders online (middleearth/towns/useTravellers), and their names over the canvas
  const trav = useTravellers('dotmatrix', gl === 'on', { motion: true });
  const [others, setOthers] = useState([]);
  const names = useRef({});
  const othersKey = useRef('');
  const [palette, setPalette] = useState(() => (PALETTES[local.get(PALETTE, 'dmg')] ? local.get(PALETTE, 'dmg') : 'dmg'));
  const [musicOn, setMusicOn] = useState(() => local.get(MUSIC, true) !== false);
  const [hud, setHud] = useState(() => ({ hearts: 3, coins: 0, found: sim.current.g.found.size, near: null }));
  const [dialog, setDialog] = useState(null); // { title, text, link, kind, who }
  // a villager's words in their own voice, where it's been made (lib/voiced.js)
  useVoiced(dialog?.kind === 'talk' ? VOICE[dialog.who] : null, dialog?.text);
  const [shown, setShown] = useState(0); // letters of the dialog typed so far
  const [list, setList] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [n64, setN64] = useState(false); // what's over the island: false | 'emu' (the N64's emulator) | 'tribute' (Mario 64's) | 'minecraft' (the game, behind the password) | 'mc-tribute' (the Minecraft tribute)
  const [banner, setBanner] = useState(null);
  const [moved, setMoved] = useState(false);
  const dialogRef = useRef(null);
  dialogRef.current = dialog ? { ...dialog, done: shown >= dialog.text.length } : null;
  const queue = useRef([]); // dialogs waiting their turn
  const open = useRef(false); // (known at once, before React draws it)

  const say = useCallback((d) => {
    if (open.current) queue.current.push(d);
    else {
      open.current = true;
      setShown(0);
      setDialog(d);
    }
  }, []);
  const closeDialog = useCallback(() => {
    const next = queue.current.shift() ?? null;
    open.current = Boolean(next);
    setShown(0);
    setDialog(next);
  }, []);

  // the dialog types itself out, a letter at a time, blipping
  useEffect(() => {
    if (!dialog) return undefined;
    if (shown >= dialog.text.length) return undefined;
    const id = setTimeout(() => {
      setShown((n) => Math.min(dialog.text.length, n + 2));
      if (shown % 6 === 0) sounds().then((s) => s.blip());
    }, 22);
    return () => clearTimeout(id);
  }, [dialog, shown]);

  // the world: made once
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      const a = api.current;
      if (!c || !a) return;
      const r = c.getBoundingClientRect();
      a.resize(Math.round(r.width), Math.round(r.height));
      stage.current?.style.setProperty('--dm-px', `${a.info.px}px`);
    };
    import('./scene')
      .then(({ createDotMatrix }) => {
        if (dead || !canvas.current) return null;
        return createDotMatrix(canvas.current, { onLost: () => !dead && setGl('lost') });
      })
      .then(async (a) => {
        if (!a) return;
        if (dead) return a.dispose();
        api.current = a;
        a.setPalette(palette);
        fit();
        // everything on the graphics chip before the island's shown, behind the loading screen
        await a.prepare(view(), throttled(setPrep), () => !dead);
        if (dead) return undefined;
        if (import.meta.env.DEV) window.__DMG__ = { api: a, sim: sim.current }; // for the QA scripts
        setGl('on');
        return undefined;
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
      s.music?.stop();
      s.music = null;
      api.current?.dispose();
      api.current = null;
    };
    // (the palette is applied by its own effect below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setGl]);

  // the wheel zooms (a native listener: React's is passive, and the page
  // must not scroll under it)
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const onWheel = (e) => {
      if (!api.current) return;
      e.preventDefault();
      sim.current.distTo = zoomTo(sim.current.distTo, Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0022));
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    api.current?.setPalette(palette);
    local.set(PALETTE, palette);
    const el = stage.current;
    if (el) PALETTES[palette].shades.forEach((c, i) => el.style.setProperty(`--dm-${i}`, c));
  }, [palette, gl]);

  // (the island stops drawing while a console is being played)
  const live = gl === 'on' && inView && !playing && !n64;

  // the tune: once you've pressed something, while the world's on screen
  const startMusic = useCallback(() => {
    const s = sim.current;
    s.started = true;
    if (!musicOn || s.music) return;
    sounds().then((x) => {
      if (!s.music && sim.current === s && musicOn) s.music = x.music();
    });
  }, [musicOn]);
  useEffect(() => {
    const s = sim.current;
    local.set(MUSIC, musicOn);
    if (live && musicOn && s.started) startMusic();
    if (!live || !musicOn) {
      s.music?.stop();
      s.music = null;
    }
  }, [live, musicOn, startMusic]);

  // keys, while the world's on screen
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = CODES[e.code];
      if (!k) {
        if (e.key === 'Escape' && dialogRef.current) closeDialog();
        else if (e.key === 'Escape') setList(false);
        return;
      }
      // a focused button takes its own Enter and Space
      if ((e.code === 'Enter' || e.code === 'Space') && e.target instanceof HTMLButtonElement) return;
      if (e.target instanceof HTMLAnchorElement && e.code === 'Enter') return;
      e.preventDefault();
      audioContext();
      if (!s.started) startMusic();
      if (k === 'menu') {
        if (!e.repeat) setList((v) => !v);
        return;
      }
      if (!e.repeat) s.pressed.add(k);
      s.keys.add(k);
    };
    const up = (e) => {
      const k = CODES[e.code];
      if (k) s.keys.delete(k);
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
  }, [live, closeDialog, startMusic]);

  // Escape puts the Game Boy down (and the way back has the focus, as the
  // console's dialog opens)
  useEffect(() => {
    if (!playing) return undefined;
    stage.current?.querySelector('.dm-play-x')?.focus();
    const down = (e) => e.key === 'Escape' && setPlaying(false);
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [playing]);

  // the N64 fills the screen, and the page under it holds still; the
  // emulator's card leaves on Esc, and the tribute takes Esc itself (it
  // pauses, and leaves from its title or pause menu)
  const closeN64 = useCallback(() => setN64(false), []);
  const tribute = useCallback(() => setN64('tribute'), []);
  useEffect(() => {
    if (!n64) return undefined;
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = was;
    };
  }, [n64]);

  // drag the world to turn the camera; two fingers pinch to zoom
  const drag = useRef(null);
  const fingers = useRef(new Map());
  const spread = () => {
    const [a, b] = [...fingers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    capturePointer(e);
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size === 2) {
      sim.current.pinch = spread();
      drag.current = null;
    } else drag.current = { x: e.clientX, id: e.pointerId };
    audioContext();
    if (!sim.current.started) startMusic();
  };
  const onPointerMove = (e) => {
    const f = fingers.current.get(e.pointerId);
    if (f) {
      f.x = e.clientX;
      f.y = e.clientY;
    }
    const s = sim.current;
    if (fingers.current.size >= 2 && s.pinch) {
      const now = spread();
      if (now > 1) s.distTo = zoomTo(s.distTo, s.pinch / now);
      s.pinch = now;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    s.yawTo -= (e.clientX - d.x) * 0.008;
    d.x = e.clientX;
  };
  const onPointerUp = (e) => {
    fingers.current.delete(e.pointerId);
    sim.current.pinch = null;
    drag.current = null;
  };

  // the touch D-pad: anywhere on it, the way from its middle
  const padRef = useRef(null);
  const onPad = (e) => {
    const el = padRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y);
    const k = m > 1 ? 1 / m : 1;
    sim.current.stick = { x: x * k, y: y * k };
  };
  const padUp = () => {
    sim.current.stick = { x: 0, y: 0 };
  };
  const button = (k) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      capturePointer(e);
      audioContext();
      const s = sim.current;
      if (!s.started) startMusic();
      s.pressed.add(k);
      if (k === 'a') s.touchA = true;
    },
    onPointerUp: () => k === 'a' && (sim.current.touchA = false),
    onPointerCancel: () => k === 'a' && (sim.current.touchA = false),
    onLostPointerCapture: () => k === 'a' && (sim.current.touchA = false),
    onContextMenu: (e) => e.preventDefault(),
  });

  // ── what the B button does ──
  const act = useCallback(() => {
    const s = sim.current;
    const near = nearAction(s.g);
    if (!near) return;
    if (near.kind === 'sign') {
      const sign = SIGNS.find((x) => x.id === near.id);
      say({ kind: 'sign', title: sign.title, text: sign.text });
    } else if (near.kind === 'talk') {
      const said = talk(s.g, near.id);
      if (said) say({ kind: 'talk', who: near.id, title: said.name, text: said.text });
    } else if (near.kind === 'gameboy') {
      s.keys.clear();
      setPlaying(true);
    } else if (near.kind === 'n64') {
      s.keys.clear();
      s.stick = { x: 0, y: 0 };
      setN64('emu');
    } else if (near.kind === 'craft') {
      s.keys.clear();
      s.stick = { x: 0, y: 0 };
      setN64('minecraft');
    } else if (near.kind === 'pipe') {
      s.warp = { id: near.id, t: 0, done: false };
      api.current?.fx('warp', { dir: -1 });
      sounds().then((x) => x.warp());
    }
  }, [say]);

  const foundCart = useCallback(
    (id) => {
      const s = sim.current;
      const found = [...s.g.found];
      saveFound(found);
      const info = cartInfo(id);
      say({ kind: 'cart', kicker: `Cartridge ${found.length} of ${CARTRIDGES.length}`, title: info.title, text: info.text, link: info.link });
      if (found.length === CARTRIDGES.length) {
        unlock('fullset');
        say({ kind: 'done', title: 'A full set', text: 'All eight cartridges, and every one of them something I built. Thanks for playing. The giant Game Boy in the square still has three more games on it.' });
        setTimeout(() => sounds().then((x) => x.fullSet()), 1300);
      }
    },
    [say, unlock],
  );

  // ── every frame ──
  const hudKey = useRef('');
  useFrameLoop((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const s = sim.current;
    const g = s.g;
    const dt = Math.min(0.05, ms / 1000);
    const pad = readPad();
    const before = s.padBefore;
    const tapped = (b) => Boolean(pad?.[b] && !before[b]);
    s.padBefore = pad ?? {};
    const pressA = s.pressed.has('a') || tapped('a');
    const pressB = s.pressed.has('b') || tapped('b') || tapped('x');
    const turnL = s.pressed.has('turnL') || tapped('lb');
    const turnR = s.pressed.has('turnR') || tapped('rb');
    if (tapped('start') || tapped('y')) setList((v) => !v);
    if (s.pressed.has('zoomIn')) s.distTo = zoomTo(s.distTo, 0.8);
    if (s.pressed.has('zoomOut')) s.distTo = zoomTo(s.distTo, 1.25);
    s.pressed.clear();

    // the camera turns an eighth at a time, or with the right stick, and
    // comes in and out with the wheel, a pinch, + and -, or the triggers
    if (turnL) s.yawTo -= Math.PI / 4;
    if (turnR) s.yawTo += Math.PI / 4;
    if (pad && Math.abs(pad.rx) > 0) s.yawTo -= pad.rx * dt * 2.4;
    if (pad && (pad.ltv || pad.rtv)) s.distTo = zoomTo(s.distTo, Math.exp((pad.ltv - pad.rtv) * dt * 1.6));
    s.yaw += (s.yawTo - s.yaw) * (1 - Math.exp(-8 * dt));
    s.dist += (s.distTo - s.dist) * (1 - Math.exp(-6 * dt));

    // talking: the world waits
    if (dialogRef.current) {
      if (pressA || pressB) {
        if (!dialogRef.current.done) setShown(dialogRef.current.text.length);
        else closeDialog();
      }
      a.render(view(), 0);
      return;
    }

    // down a pipe and up another: in, fade, across, out
    if (s.warp) {
      s.warp.t += dt;
      const w = s.warp;
      a.fade = w.t < 0.45 ? w.t / 0.45 : Math.max(0, 1 - (w.t - 0.55) / 0.4);
      if (!w.done && w.t >= 0.5) {
        w.done = true;
        warp(g, w.id);
        a.fx('warp', { dir: 1 });
      }
      if (w.t >= 0.95) {
        s.warp = null;
        a.fade = 0;
      }
      a.render(view(), ms);
      return;
    }

    const held = (k) => s.keys.has(k);
    let fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0) - s.stick.y;
    let side = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + s.stick.x;
    if (pad) {
      fwd -= pad.ly + (pad.down ? 1 : 0) - (pad.up ? 1 : 0);
      side += pad.lx + (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
    }
    const mv = cameraMove(s.yaw, Math.max(-1, Math.min(1, fwd)), Math.max(-1, Math.min(1, side)));
    if (!s.moved && Math.hypot(mv.x, mv.z) > 0.2) {
      s.moved = true;
      setMoved(true);
    }
    const jump = held('a') || s.touchA || Boolean(pad?.a);
    const n = Math.max(1, Math.ceil(dt * 60 - 0.01));
    const was = { x: g.hero.x, y: g.hero.y, z: g.hero.z };
    const events = [];
    for (let i = 0; i < n; i++) events.push(...step(g, { x: mv.x, z: mv.z, jump, jumped: pressA && i === 0 }, dt / n));

    for (const e of events) {
      const h = g.hero;
      if (e.type === 'jump') sounds().then((x) => x.jump());
      else if (e.type === 'land' && e.speed > 0.16) a.fx('land', { at: h });
      else if (e.type === 'bump') {
        a.fx('bump', e);
        sounds().then((x) => x.bump());
      } else if (e.type === 'block') {
        a.fx('block', e);
        sounds().then((x) => (e.gives === 'heart' ? x.heart() : x.coin()));
      } else if (e.type === 'coin') {
        const c = COINS.find((x) => x.id === e.id);
        a.fx('coin', { at: c });
        sounds().then((x) => x.coin());
      } else if (e.type === 'coinheart') {
        a.fx('coinheart', { at: h });
        sounds().then((x) => x.heart());
        setBanner('A heart back');
        setTimeout(() => setBanner(null), 1600);
      } else if (e.type === 'allcoins') {
        a.fx('allcoins', { at: h });
        unlock('pocketful');
        say({ kind: 'done', title: 'Every coin', text: 'That’s all of them, every last coin on the island. Spend them on another go on the Game Boy.' });
        setTimeout(() => sounds().then((x) => x.fullSet()), 400);
      } else if (e.type === 'cart') {
        const c = CARTRIDGES.find((x) => x.id === e.id);
        a.fx('cart', { at: { x: c.at[0], y: c.at[1], z: c.at[2] } });
        sounds().then((x) => x.cartridge());
        foundCart(e.id);
      } else if (e.type === 'stomp') {
        const w = WALKERS.find((x) => x.id === e.id);
        a.fx('stomp', { at: walkerAt(w, g.t) });
        sounds().then((x) => x.stomp());
      } else if (e.type === 'hurt') {
        a.fx('hurt', { at: h });
        sounds().then((x) => x.hurt());
      } else if (e.type === 'over') {
        a.fx('hurt', { at: h });
        sounds().then((x) => x.over());
        setBanner('Game over');
        setTimeout(() => setBanner(null), 2000);
      } else if (e.type === 'splash') {
        a.fx('splash', { at: was });
        sounds().then((x) => x.splash());
      }
    }
    if (pressB) act();

    // the other islanders: where you are to them, where they are, and their names
    const tv = trav.ref.current;
    tv?.pose(islanderStep(g.hero));
    s.others = tv ? tv.list() : [];
    const ok = s.others.map((o) => `${o.id}:${o.name}`).join('|');
    if (ok !== othersKey.current) {
      othersKey.current = ok;
      setOthers(s.others.map((o) => ({ id: o.id, name: o.name })));
    }
    const ease = 1 - Math.exp(-dt * 9);
    for (const o of s.others) {
      const e = s.eased[o.id] ?? (s.eased[o.id] = { x: o.x, y: o.y ?? 0, z: o.z });
      if (Math.hypot(o.x - e.x, o.z - e.z) > 6) Object.assign(e, { x: o.x, z: o.z, y: o.y ?? 0 });
      e.x += (o.x - e.x) * ease;
      e.z += (o.z - e.z) * ease;
      e.y += ((o.y ?? 0) - e.y) * ease;
      const el = names.current[o.id];
      if (!el) continue;
      const at = a.screenOf(e.x, e.y + 1.25, e.z);
      el.style.opacity = at.on ? '1' : '0';
      el.style.transform = `translate(${at.x.toFixed(0)}px, ${at.y.toFixed(0)}px) translate(-50%, -100%)`;
    }
    for (const id of Object.keys(s.eased)) if (!s.others.some((o) => o.id === id)) delete s.eased[id];

    const near = nearAction(g);
    const p = progress(g);
    const key = `${g.hearts}|${p.coins}|${p.found}|${near?.kind}:${near?.id}`;
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ hearts: g.hearts, coins: p.coins, found: p.found, near });
    }
    a.render(view(), ms);
  }, live);

  const prompt = hud.near && !dialog ? { sign: 'Read', talk: 'Talk', gameboy: 'Play the Game Boy', n64: 'Play the N64', craft: 'Play Minecraft', pipe: 'Go down the pipe' }[hud.near.kind] : null;

  return (
    <div ref={box}>
      <div ref={stage} className="dm-stage" data-tour="cartridges" data-palette={palette} data-on={gl === 'on' || undefined}>
        <canvas ref={canvas} className="dm-canvas" data-on={gl === 'on' || undefined} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="Dot Matrix island, in 3D. Walk with the arrow keys or WASD, jump with Space, talk, read and play with X, turn the camera with Q and E, zoom with the wheel or + and -." role="img" />
        <div className="dm-lcd" aria-hidden="true" />
        <div className="dm-names" aria-hidden="true">
          {others.map((o) => (
            <span key={o.id} ref={(el) => (names.current[o.id] = el)} className="dm-name">
              {o.name}
            </span>
          ))}
        </div>
        <LoadingVeil shown={gl === 'loading'} progress={prep.value} step={prep.step} title="Dot Matrix island" line="Loading the island…" />

        <DotMatrixHud touch={touch} gl={gl} hud={hud} sim={sim} palette={palette} setPalette={setPalette} musicOn={musicOn} setMusicOn={setMusicOn} trav={trav} list={list} setList={setList} banner={banner} moved={moved} prompt={prompt} act={act} dialog={dialog} shown={shown} setShown={setShown} closeDialog={closeDialog} padRef={padRef} onPad={onPad} padUp={padUp} button={button} />

        {playing && (
          <div className="dm-play" role="dialog" aria-modal="true" aria-label="The Game Boy">
            <div className="dm-play-inner">
              <Exit className="dm-chip dm-play-x" label="Back to the island" onLeave={() => setPlaying(false)} touch={touch} />
              <Suspense fallback={<p className="dm-loading">Switching on…</p>}>
                <GameBoyStage />
              </Suspense>
            </div>
          </div>
        )}
      </div>
      {/* (on the page's body: the island's section is a layer under the nav) */}
      {n64 &&
        createPortal(
          <Suspense fallback={<div className="dm-n64-wait" role="status">Switching on…</div>}>
            {n64 === 'minecraft' ? <Eaglercraft mode="overlay" onExit={closeN64} onTribute={() => setN64('mc-tribute')} /> : n64 === 'mc-tribute' ? <Minecraft mode="overlay" onExit={closeN64} /> : n64 === 'tribute' ? <Mario64 mode="overlay" onExit={closeN64} /> : <N64 mode="overlay" onExit={closeN64} onTribute={tribute} />}
          </Suspense>,
          document.body,
        )}
    </div>
  );
}

function Cards({ three, gl, retry }) {
  const found = useFound();
  return (
    <div className="shell dm-cards-wrap">
      <h1 id="dm-title" className="title">
        Dot Matrix
      </h1>
      <p className="lead mt-4 max-w-[60ch]">A Game Boy island drawn in four shades of green, with eight cartridges hidden on it: each one a project of mine.</p>
      {three.can && (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          {gl === 'lost' ? 'The graphics chip reset, so here’s the island as a list.' : gl === 'failed' ? 'The 3D island couldn’t start here, so here it is as a list.' : three.held ? 'The 3D island isn’t loaded yet, so here it is as a list.' : '3D is switched off, so here’s the island as a list.'}
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
      <ul className="dm-cards">
        {CARTRIDGES.map((c) => {
          const info = cartInfo(c.id);
          return (
            <li key={c.id} data-got={found.includes(c.id) || undefined}>
              <Link to={info.link}>{info.title}</Link>
              <p>{info.text}</p>
              <p className="dm-where">{c.where}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-10">
        <Suspense fallback={null}>
          <GameBoyStage />
        </Suspense>
      </div>
    </div>
  );
}
