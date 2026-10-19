// Ricochet from above, the 2D view's rules (spec 2026-10-18-avengers-hq-fix-
// and-hub-design, §8): the room in metres as the SVG's units, the pointer and
// the keys turned into an aim as the 3D game turns them, the preview the 3D
// game draws, the disc on its path, and a controller that steps the room at
// the rules' own fixed step. Pure: no React, no DOM.
import { STEP, newRoom, simulateThrow, stepRoom, throwShield } from './rules';

// every room fits: the 16 × 12 m shell with a margin
export const VIEW = { x: -8.6, y: -6.6, w: 17.2, h: 13.2 };
export const viewBox = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;
// the aim: a key's nudge (Shift for fine), its limit, the drag's dead zone
// round the thrower, and how near him a release throws nothing
export const AIM = { step: 0.012, fine: 0.002, max: 1.55, still: 0.2, cancel: 0.8 };
// how far the preview's last stretch reaches
export const TAIL = 2.6;

const clampAim = (a) => Math.max(-AIM.max, Math.min(AIM.max, a));

// the early rooms preview a bounce more (Ricochet.jsx's assist)
export const assistFor = (index) => index < 3;

// the point under the pointer, in the room's metres (the SVG's meet letterbox inverted)
export function toWorld(rect, clientX, clientY) {
  const s = Math.min(rect.width / VIEW.w, rect.height / VIEW.h);
  const ox = (rect.width - VIEW.w * s) / 2;
  const oy = (rect.height - VIEW.h * s) / 2;
  return [VIEW.x + (clientX - rect.left - ox) / s, VIEW.y + (clientY - rect.top - oy) / s];
}

// the aim from the thrower towards a point: 0 up the room, positive to the
// right, as the 3D's angleAt; null too near him to say
export function aimFromDrag([ox, oz], [px, pz]) {
  if (Math.hypot(px - ox, pz - oz) < AIM.still) return null;
  return clampAim(Math.atan2(px - ox, -(pz - oz)));
}

// the arrow keys (or A and D) nudge the aim, as the 3D game's do; any other key is null
export function keyAim(angle, key, fine = false) {
  const k = String(key).toLowerCase();
  const step = fine ? AIM.fine : AIM.step;
  if (k === 'arrowleft' || k === 'a') return clampAim(angle - step);
  if (k === 'arrowright' || k === 'd') return clampAim(angle + step);
  return null;
}

export function aimWords(angle) {
  const n = Math.round((angle * 180) / Math.PI);
  if (n === 0) return 'straight ahead';
  return n > 0 ? `${n}° right` : `${-n}° left`;
}

// the preview the 3D game draws: the throw's first stretches (three on the
// early rooms, two after), the last cut to TAIL
export function previewPath(room, angle, assist) {
  if (room.phase !== 'aim') return [];
  const { path } = simulateThrow(room, angle);
  const stretches = assist ? 3 : 2;
  const out = [[path[0].x, path[0].z]];
  for (let i = 1; i <= Math.min(path.length - 1, stretches); i++) {
    const a = path[i - 1];
    const b = path[i];
    if (i < stretches) {
      out.push([b.x, b.z]);
      continue;
    }
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const k = len > 0 ? Math.min(len, TAIL) / len : 0;
    out.push([a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k]);
  }
  return out;
}

// where the disc is along its flight
export function discAt(flight) {
  if (!flight) return null;
  const { path, elapsed } = flight;
  for (let i = 1; i < path.length; i++) {
    if (elapsed <= path[i].t) {
      const a = path[i - 1];
      const b = path[i];
      const k = (elapsed - a.t) / Math.max(1e-6, b.t - a.t);
      return [a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k];
    }
  }
  const l = path[path.length - 1];
  return [l.x, l.z];
}

// The 2D view's controller over the real rules: a room entered, aimed by drag
// or keys, thrown, and stepped at the rules' fixed step (never more than 0.05 s
// a frame). It takes no input before a room is entered or after it ends.
export function createFlat(index) {
  let room = newRoom(index);
  let entered = false;
  let angle = 0;
  let dragging = false;
  let acc = 0;
  const isLive = () => entered && (room.phase === 'aim' || room.phase === 'flying');
  const cap = () => room.def.cap;
  const doThrow = () => (isLive() && room.phase === 'aim' ? throwShield(room, angle) : null);
  return {
    get room() {
      return room;
    },
    get angle() {
      return angle;
    },
    get dragging() {
      return dragging;
    },
    get live() {
      return isLive();
    },
    enter(i) {
      room = newRoom(i);
      entered = true;
      angle = 0;
      dragging = false;
      acc = 0;
    },
    aim(a) {
      angle = clampAim(a);
    },
    press(p) {
      if (!isLive()) return;
      dragging = true;
      const a = aimFromDrag(cap(), p);
      if (a != null) angle = a;
    },
    move(p) {
      if (!dragging) return;
      const a = aimFromDrag(cap(), p);
      if (a != null) angle = a;
    },
    // a release on the thrower throws nothing; anywhere else, at the aim
    release(p) {
      if (!dragging) return null;
      dragging = false;
      const [cx, cz] = cap();
      if (!isLive() || Math.hypot(p[0] - cx, p[1] - cz) < AIM.cancel) return null;
      const a = aimFromDrag(cap(), p);
      if (a != null) angle = a;
      return doThrow();
    },
    cancel() {
      dragging = false;
    },
    key(key, { shift = false } = {}) {
      if (!isLive()) return { handled: false, flight: null };
      const a = keyAim(angle, key, shift);
      if (a != null) {
        angle = a;
        return { handled: true, flight: null };
      }
      if (key === ' ' || key === 'Enter') return { handled: true, flight: doThrow() };
      return { handled: false, flight: null };
    },
    throw: doThrow,
    // (a landing ends the frame's steps, so the room's clock at the next throw
    // doesn't hang on the frame rate)
    tick(dt) {
      if (!isLive()) return [];
      acc += Math.min(0.05, dt);
      const events = [];
      while (acc >= STEP - 1e-9) {
        acc -= STEP;
        const ev = stepRoom(room, STEP);
        events.push(...ev);
        if (ev.some((e) => e.type === 'land')) {
          acc = 0;
          break;
        }
      }
      return events;
    },
  };
}
