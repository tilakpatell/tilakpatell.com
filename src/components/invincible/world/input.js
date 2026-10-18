// The world's controls (split out of ./InvWorld.jsx as a repair): the keys,
// the mouse and touch on the canvas, and each frame's reading of them and
// of a pad.

import { readPad, typing } from '../../games/pad';
import { toggleGuide } from '../../../lib/palette';
import { onWater } from './flight';
import { CARD_MS } from './events';

// the keys, by where they are on the keyboard
const CODES = { KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right', Space: 'up', KeyC: 'down', KeyZ: 'down', ShiftLeft: 'boost', ShiftRight: 'boost', ArrowLeft: 'lookL', ArrowRight: 'lookR', ArrowUp: 'lookU', ArrowDown: 'lookD' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The keys: held ones into `s.keys` (by CODES), the rest acted on; a blur
// or a hidden tab lets go of everything. Returns what unbinds them.
export function bindInput(s, h) {
  const { startSound, act, cycleTime, take, abandon, openCard, closeCard, card, release } = h;
  const down = (e) => {
    if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = CODES[e.code];
    if (k) {
      e.preventDefault();
      startSound();
      if (k === 'up' && !e.repeat) s.jump = true;
      // (C pressed on the ground, foes about: his ground pound, ./brawl.js)
      if (k === 'down' && !e.repeat) s.poundPress = true;
      s.keys.add(k);
      s.moved = true;
      return;
    }
    if ((e.code === 'KeyJ' || e.code === 'KeyF') && !e.repeat) {
      // (a tap punches; held, it grabs, and let go, it throws: ./brawl.js)
      startSound();
      s.punch = true;
      s.fist = true;
    } else if (e.code === 'KeyE' || e.key === 'Enter') {
      if (!(e.target instanceof HTMLButtonElement)) act();
    } else if (e.code === 'KeyT') cycleTime();
    // (H was the world's own list of keys: it's the site's guide now, which ? opens too)
    else if (e.code === 'KeyH') toggleGuide();
    else if (e.code === 'KeyR' && !e.repeat) {
      // a call to take first; else, hanging at the water, let go of it
      if (s.call && !s.mission) take();
      else if (onWater(s.h, s.world)) s.free = true;
    }
    else if (e.code === 'KeyQ' && !e.repeat) {
      // a mission called off: asked first, on its card
      if (card()?.kind === 'abandon') abandon();
      else if (s.mission && !card()) openCard({ kind: 'abandon', id: s.mission.id });
    } else if (e.key === 'Escape') {
      if (card()) closeCard();
    }
  };
  const up = (e) => {
    if (e.code === 'KeyJ' || e.code === 'KeyF') s.fist = false;
    const k = CODES[e.code];
    if (k) s.keys.delete(k);
    if (!e.shiftKey) s.keys.delete('boost');
  };
  const hidden = () => document.hidden && release();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', hidden);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', release);
    document.removeEventListener('visibilitychange', hidden);
    release();
  };
}

// Looking round: a drag on the canvas turns the camera; a click with the
// mouse (not a drag) is a punch. `host` is the canvas's box (on a phone its
// left part is the stick's), `drag` the ref the gesture is kept in.
export function pointerLook({ sim, drag, host, startSound }) {
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' && e.clientX < (host.current?.getBoundingClientRect().left ?? 0) + (host.current?.clientWidth ?? 0) * 0.4) return; // the left of a phone's screen is the stick
    startSound();
    // (the mouse's button held is the punch key held: a grab, ./brawl.js)
    if (e.pointerType === 'mouse' && e.button === 0) sim.current.fist = true;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const s = sim.current;
    const k = e.pointerType === 'touch' ? 0.007 : 0.0045;
    s.yaw -= (e.clientX - d.x) * k;
    s.pitch = clamp(s.pitch - (e.clientY - d.y) * k, -1.35, 1.25);
    s.dragAt = s.t;
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (e.pointerType === 'mouse') sim.current.fist = false;
    if (d?.id !== e.pointerId) return;
    // a click (not a drag) with the mouse: a punch
    if (e.pointerType === 'mouse' && e.button === 0 && performance.now() - d.at < 260 && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) sim.current.punch = true;
    drag.current = null;
  };
  return { onPointerDown, onPointerMove, onPointerUp };
}

// This frame's controls, from the keys held, the touch stick and buttons and
// a pad: the camera (arrows, the right stick, a mission card's swing) and
// what flying is asked for (./flight.js's input).
export function readControls(s, dt, { act, cycleTime }) {
  const k = s.keys;
  const pad = readPad();
  const before = s.padBefore ?? {};
  const pressed = (b) => pad?.[b] && !before[b];
  s.padBefore = pad ?? {};

  // the camera: arrows, a pad's right stick
  const lookX = (k.has('lookR') ? 1 : 0) - (k.has('lookL') ? 1 : 0) + (pad?.rx ?? 0);
  const lookY = (k.has('lookU') ? 1 : 0) - (k.has('lookD') ? 1 : 0) - (pad?.ry ?? 0);
  if (lookX || lookY) {
    s.yaw -= lookX * 2.2 * dt;
    s.pitch = clamp(s.pitch + lookY * 1.6 * dt, -1.35, 1.25);
    s.dragAt = s.t;
  }
  // a mission's title card: the camera's one swing round him meanwhile
  if (s.swing) {
    const k = (s.t - s.swing.t0) / (CARD_MS / 1000);
    if (k >= 1) s.swing = null;
    else {
      s.yaw = s.swing.yaw0 + k * Math.PI * 2;
      s.dragAt = s.t;
    }
  }
  let fwd = (k.has('fwd') ? 1 : 0) - (k.has('back') ? 1 : 0) - s.stick.y - (pad?.ly ?? 0);
  let side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + s.stick.x + (pad?.lx ?? 0);
  fwd = clamp(fwd, -1, 1);
  side = clamp(side, -1, 1);
  const upKey = k.has('up') || s.touchUp || Boolean(pad?.a || pad?.rb);
  const downKey = k.has('down') || s.touchDown || Boolean(pad?.b || pad?.lb);
  const boost = k.has('boost') || s.touchBoost || Boolean(pad?.rt || (pad?.rtv ?? 0) > 0.4);
  if (pressed('a')) s.jump = true;
  if (pressed('x')) s.punch = true;
  if (pressed('y')) act();
  if (pressed('start')) cycleTime();
  const look = [Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch)];
  // the jump through its press (./flight.js): a moment early or late still goes
  if (s.jump) s.press.press();
  let input = { fwd, side, up: upKey ? 1 : 0, down: downKey ? 1 : 0, boost, run: boost, jump: s.jump, look, press: s.press, free: s.free };
  if (s.intro) {
    // the drop: straight down, flat out, the camera above him, until the ground stops him
    input = { fwd: 0, side: 0, up: 0, down: 1, boost: true, run: false, jump: false, look };
    s.pitch = -0.32;
    s.dragAt = s.t;
    if (s.h.mode === 'ground') s.intro = false;
  }
  return { input, look };
}
