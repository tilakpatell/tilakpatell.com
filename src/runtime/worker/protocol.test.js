import { describe, expect, it } from 'vitest';
import { createInput } from '../input';
import { CALLS, MESSAGES, mergeInput, packInput, unpackInput } from './protocol';

// a stand-in for window or the host box (input.test.js's, cut down)
function fakeTarget(rect = { left: 10, top: 20, width: 200, height: 100 }) {
  const on = new Map();
  return {
    addEventListener: (type, fn) => on.set(type, [...(on.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => on.set(type, (on.get(type) ?? []).filter((f) => f !== fn)),
    fire: (type, e = {}) => (on.get(type) ?? []).forEach((fn) => fn(e)),
    getBoundingClientRect: () => rect,
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
  };
}
const key = (code) => ({ code, target: {}, repeat: false, metaKey: false, ctrlKey: false, altKey: false, preventDefault: () => {} });
const PAD = { lx: 0.5, ly: -0.25, rx: 0, ry: 0, a: true, b: false, x: false, y: false, lb: false, rb: false, lt: false, rt: false, ltv: 0, rtv: 0 };
const BINDS = [{ left: ['KeyA'], right: ['KeyD'], jump: ['Space'] }, { axes: { turn: ['left', 'right'] } }];

// a page snapshot with two keys held, one of them pressed this frame, a
// pointer dragged and a pad: what the host packs and the worker unpacks
function pageSnapshot() {
  const win = fakeTarget();
  const host = fakeTarget();
  const input = createInput({ readPad: () => PAD, typing: () => false, capture: false });
  input.attach({ win, host });
  input.bind(...BINDS);
  win.fire('keydown', key('KeyD'));
  input.sample(); // (KeyD pressed in an earlier frame: held, not pressed, now)
  win.fire('keydown', key('Space'));
  host.fire('pointerdown', { pointerId: 1, clientX: 30, clientY: 40, target: host });
  host.fire('pointermove', { pointerId: 1, clientX: 45, clientY: 38, target: host });
  input.setStick(0.3, -0.6);
  return input.sample();
}

describe('the worker protocol', () => {
  it('names every message once, up and down', () => {
    const up = Object.values(MESSAGES.up);
    const down = Object.values(MESSAGES.down);
    expect(new Set(up).size).toBe(up.length);
    expect(new Set(down).size).toBe(down.length);
    for (const t of ['init', 'input', 'resize', 'visible', 'quality', 'call', 'result']) expect(up.includes(t) || down.includes(t)).toBe(true);
    for (const t of ['ready', 'event', 'hud', 'frame', 'lost']) expect(down).toContain(t);
  });

  it('packs a snapshot into what structured clone carries: no Set, no function', () => {
    const packed = packInput(pageSnapshot());
    const walk = (v) => {
      expect(v instanceof Set).toBe(false);
      expect(typeof v).not.toBe('function');
      if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(packed);
    expect(structuredClone(packed)).toEqual(packed);
  });

  it('gives back the snapshot the page sampled', () => {
    const snap = pageSnapshot();
    const back = unpackInput(structuredClone(packInput(snap)), { actions: BINDS[0], axes: BINDS[1].axes });
    expect(back.keys).toEqual(snap.keys);
    expect(back.pressed).toEqual(snap.pressed);
    expect(back.keys).toBeInstanceOf(Set);
    expect(back.pressed.has('Space')).toBe(true);
    expect(back.pressed.has('KeyD')).toBe(false);
    expect(back.pointer).toEqual(snap.pointer);
    expect(back.pointer.drag).toEqual({ dx: 15, dy: -2 });
    expect(back.pad).toEqual(snap.pad);
    expect(back.tapped).toEqual(snap.tapped);
    expect(back.stick).toEqual(snap.stick);
    for (const name of ['left', 'right', 'jump', 'nothing']) expect(back.action(name)).toBe(snap.action(name));
    expect(back.axis('turn')).toBe(snap.axis('turn'));
    expect(back.axis('turn')).toBe(1);
  });

  it('keeps a press and a drag that land between two of the worker’s frames', () => {
    // (the page samples on its own beat; the worker may draw once for two of
    // them, and a press seen only in the first must not be lost)
    const a = packInput({ keys: new Set(['Space']), pressed: new Set(['Space']), pad: null, tapped: { a: true }, pointer: { x: 1, y: 1, down: true, drag: { dx: 3, dy: 1 } }, stick: { x: 0, y: 0 } });
    const b = packInput({ keys: new Set(['KeyW']), pressed: new Set(['KeyW']), pad: null, tapped: {}, pointer: { x: 4, y: 2, down: true, drag: { dx: 2, dy: -4 } }, stick: { x: 1, y: 0 } });
    const merged = mergeInput(a, b);
    expect(merged.keys).toEqual(['KeyW']); // (held is what's held now)
    expect(merged.pressed.sort()).toEqual(['KeyW', 'Space']);
    expect(merged.tapped).toEqual({ a: true });
    expect(merged.pointer).toEqual({ x: 4, y: 2, down: true, drag: { dx: 5, dy: -3 } });
    expect(merged.stick).toEqual({ x: 1, y: 0 });
    expect(mergeInput(null, b)).toEqual(b);
  });

  it('lets the worker call only the page’s services it names', () => {
    expect(CALLS).toContain('saves.set');
    expect(CALLS).toContain('store.get');
    expect(CALLS).not.toContain('saves.watch'); // (a callback cannot cross)
  });
});
