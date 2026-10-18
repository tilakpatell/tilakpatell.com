// The world's input: the keys, by where they are on the keyboard, bound
// while the world is live (a blur or a hidden tab lets go of everything
// held), and looking round by dragging on the canvas. Moved from
// InvWorld.jsx as it was, so that file stays under the size rule; `s` is
// the world's sim, the rest the component's callbacks.
import { typing } from '../../games/pad';
import { toggleGuide } from '../../../lib/palette';
import { onWater } from './flight';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the keys, by where they are on the keyboard
export const CODES = { KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right', Space: 'up', KeyC: 'down', KeyZ: 'down', ShiftLeft: 'boost', ShiftRight: 'boost', ArrowLeft: 'lookL', ArrowRight: 'lookR', ArrowUp: 'lookU', ArrowDown: 'lookD' };

// the keys; returns the unbinding
export function bindKeys(s, { act, cycleTime, startSound, release, abandon, openCard, closeCard, take, cardRef }) {
  const down = (e) => {
    if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = CODES[e.code];
    if (k) {
      e.preventDefault();
      startSound();
      if (k === 'up' && !e.repeat) s.jump = true;
      s.keys.add(k);
      s.moved = true;
      return;
    }
    if ((e.code === 'KeyJ' || e.code === 'KeyF') && !e.repeat) {
      startSound();
      s.punch = true;
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
      if (cardRef.current?.kind === 'abandon') abandon();
      else if (s.mission && !cardRef.current) openCard({ kind: 'abandon', id: s.mission.id });
    } else if (e.key === 'Escape') {
      if (cardRef.current) closeCard();
    }
  };
  const up = (e) => {
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

// looking round: drag on the canvas (`host` is the canvas's box, for a phone's stick on its left)
export function pointerHandlers({ sim, drag, host, startSound }) {
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' && e.clientX < (host.current?.getBoundingClientRect().left ?? 0) + (host.current?.clientWidth ?? 0) * 0.4) return; // the left of a phone's screen is the stick
    startSound();
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
    if (d?.id !== e.pointerId) return;
    // a click (not a drag) with the mouse: a punch
    if (e.pointerType === 'mouse' && e.button === 0 && performance.now() - d.at < 260 && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) sim.current.punch = true;
    drag.current = null;
  };
  return { onPointerDown, onPointerMove, onPointerUp };
}
