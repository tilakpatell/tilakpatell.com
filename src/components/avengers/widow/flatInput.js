// Infiltration from above, the 2D view's rules (spec 2026-10-18-avengers-hq-
// fix-and-hub-design, §8): the grid a tile to a unit (a tile's centre is its
// whole coordinates), a tap or a key turned into her turn, the step ahead
// foreseen on the real rules without taking it, and the lasers' lines and
// states. Pure: no React, no DOM.
import { DIRS, act, biteTargets, cloneState, laserOn, solid } from './rules';

export const viewBoxOf = (def) => `-0.5 -0.5 ${def.w} ${def.h}`;

// the tile under the pointer (the SVG's meet letterbox inverted), or null off the grid
export function tileFromPoint(rect, clientX, clientY, def) {
  const s = Math.min(rect.width / def.w, rect.height / def.h);
  const ox = (rect.width - def.w * s) / 2;
  const oy = (rect.height - def.h * s) / 2;
  const x = Math.floor((clientX - rect.left - ox) / s);
  const y = Math.floor((clientY - rect.top - oy) / s);
  return x >= 0 && y >= 0 && x < def.w && y < def.h ? { x, y } : null;
}

// which way a neighbouring tile is from her, or null
export const dirTo = (s, x, y) => Object.keys(DIRS).find((d) => DIRS[d][0] === x - s.px && DIRS[d][1] === y - s.py) ?? null;

// her turn tried on a copy: does it get her caught, bump a guard, or win?
export function foresee(s, action) {
  const trial = cloneState(s);
  const ev = act(trial, action);
  return { danger: trial.phase === 'caught', bump: ev[0]?.type === 'bump', won: trial.phase === 'won' };
}

export const KEY_DIRS = { arrowup: 'N', w: 'N', arrowdown: 'S', s: 'S', arrowleft: 'W', a: 'W', arrowright: 'E', d: 'E' };

// nothing armed by a first tap, and the Widow's Bite not raised
export const IDLE = Object.freeze({ armed: null, biting: false });

// what a tile asks of her: a bite on a guard in reach while the Bite is
// raised, a wait on her own tile, a step to a neighbour, or nothing
export function actionAt(s, input, tile) {
  if (!tile) return null;
  if (input.biting) {
    const bt = biteTargets(s).find((b) => b.guard.x === tile.x && b.guard.y === tile.y);
    return bt ? { type: 'bite', dir: bt.dir } : null;
  }
  if (tile.x === s.px && tile.y === s.py) return { type: 'wait' };
  const dir = dirTo(s, tile.x, tile.y);
  return dir ? { type: 'move', dir } : null;
}

// A click does it at once; on touch the first tap shows it and the second does it.
export function tapInput(s, input, tile, { touch = false } = {}) {
  const action = s.phase === 'play' ? actionAt(s, input, tile) : null;
  if (!action) return { input: { ...input, armed: null }, action: null };
  if (touch && !(input.armed && input.armed.x === tile.x && input.armed.y === tile.y)) return { input: { ...input, armed: { x: tile.x, y: tile.y } }, action: null };
  return { input: IDLE, action };
}

export function keyInput(s, input, key) {
  const k = String(key).toLowerCase();
  const dir = KEY_DIRS[k];
  if (dir) return input.biting ? { input: IDLE, action: { type: 'bite', dir }, handled: true } : { input: IDLE, action: { type: 'move', dir }, handled: true };
  if (k === ' ' || k === '.' || k === 'enter') return { input: IDLE, action: { type: 'wait' }, handled: true };
  if (k === 'e' || k === 'b') return { input: biteTargets(s).length ? { ...input, armed: null, biting: !input.biting } : input, action: null, handled: true };
  if (k === 'escape' && input.biting) return { input: { ...input, biting: false }, action: null, handled: true };
  return { input, action: null, handled: false };
}

// a laser's line across its tiles, half a tile past each end
export function laserLine(def, l) {
  const [x0, y0] = l.cells[0];
  const along = l.along ?? (solid(def, x0 - 1, y0) && solid(def, x0 + 1, y0) ? 'x' : 'y');
  const xs = l.cells.map((c) => c[0]);
  const ys = l.cells.map((c) => c[1]);
  return along === 'x'
    ? [
        [Math.min(...xs) - 0.5, y0],
        [Math.max(...xs) + 0.5, y0],
      ]
    : [
        [x0, Math.min(...ys) - 0.5],
        [x0, Math.max(...ys) + 0.5],
      ];
}

// on now, coming on next turn (a warning), or off
export const laserState = (def, id, t) => (laserOn(def, id, t) ? 'on' : laserOn(def, id, t + 1) ? 'warn' : 'off');
