import { describe, expect, it, vi } from 'vitest';
import { createInput } from './input';

// a stand-in for window or an element: listeners by type, fire(type, event)
function fakeTarget(rect = { left: 10, top: 20, width: 200, height: 100 }) {
  const on = new Map();
  return {
    addEventListener: (type, fn) => on.set(type, [...(on.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => on.set(type, (on.get(type) ?? []).filter((f) => f !== fn)),
    fire: (type, e = {}) => (on.get(type) ?? []).forEach((fn) => fn(e)),
    count: () => [...on.values()].reduce((n, fns) => n + fns.length, 0),
    getBoundingClientRect: () => rect,
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
  };
}
const press = (code, extra = {}) => ({ code, key: code, target: {}, repeat: false, metaKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn(), ...extra });

describe('createInput', () => {
  it('holds a key until it is released, and pressed for one sample', () => {
    const win = fakeTarget();
    const input = createInput();
    input.attach({ win, host: fakeTarget() });
    win.fire('keydown', press('KeyW'));
    let s = input.sample(0);
    expect(s.keys.has('KeyW')).toBe(true);
    expect(s.pressed.has('KeyW')).toBe(true);
    s = input.sample(16);
    expect(s.keys.has('KeyW')).toBe(true);
    expect(s.pressed.has('KeyW')).toBe(false);
    win.fire('keydown', press('KeyW', { repeat: true })); // the key repeat: not a new press
    expect(input.sample(32).pressed.has('KeyW')).toBe(false);
    win.fire('keyup', press('KeyW'));
    expect(input.sample(48).keys.size).toBe(0);
  });

  it('ignores typing in a field and modifier combos', () => {
    const win = fakeTarget();
    const input = createInput({ typing: (t) => t?.field === true });
    input.attach({ win, host: fakeTarget() });
    win.fire('keydown', press('KeyW', { target: { field: true } }));
    win.fire('keydown', press('KeyA', { ctrlKey: true }));
    win.fire('keydown', press('KeyS', { metaKey: true }));
    expect(input.sample(0).keys.size).toBe(0);
  });

  it('prevents the default only for a bound key', () => {
    const win = fakeTarget();
    const input = createInput();
    input.attach({ win, host: fakeTarget() });
    input.bind({ fire: ['KeyF'] });
    const f = press('KeyF');
    const z = press('KeyZ');
    win.fire('keydown', f);
    win.fire('keydown', z);
    expect(f.preventDefault).toHaveBeenCalled();
    expect(z.preventDefault).not.toHaveBeenCalled();
    expect(input.sample(0).keys.has('KeyZ')).toBe(true); // still read, for a module that looks at codes
  });

  it('actions and axes come from the bindings', () => {
    const win = fakeTarget();
    const input = createInput();
    input.attach({ win, host: fakeTarget() });
    input.bind({ left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] }, { axes: { turn: ['left', 'right'] } });
    win.fire('keydown', press('ArrowLeft'));
    let s = input.sample(0);
    expect(s.action('left')).toBe(true);
    expect(s.action('right')).toBe(false);
    expect(s.axis('turn')).toBe(-1);
    win.fire('keydown', press('KeyD'));
    s = input.sample(16);
    expect(s.axis('turn')).toBe(0);
    expect(s.axis('nothing')).toBe(0);
    input.unbind();
    expect(input.sample(32).action('left')).toBe(false);
  });

  it('a blur and a detach clear what is held and the stick', () => {
    const win = fakeTarget();
    const host = fakeTarget();
    const input = createInput();
    input.attach({ win, host });
    win.fire('keydown', press('KeyW'));
    win.fire('blur');
    expect(input.sample(0).keys.size).toBe(0);
    win.fire('keydown', press('KeyW'));
    input.setStick(0.5, -0.25);
    expect(input.sample(16).stick).toEqual({ x: 0.5, y: -0.25 });
    input.detach();
    const s = input.sample(32);
    expect(s.keys.size).toBe(0);
    expect(s.stick).toEqual({ x: 0, y: 0 });
    expect(win.count()).toBe(0);
    expect(host.count()).toBe(0);
  });

  it('pad presses are edges for one sample', () => {
    let pad = { a: true, lx: 0.3 };
    const input = createInput({ readPad: () => pad });
    input.attach({ win: fakeTarget(), host: fakeTarget() });
    let s = input.sample(0);
    expect(s.pad.lx).toBe(0.3);
    expect(s.tapped.a).toBe(true);
    s = input.sample(16);
    expect(s.tapped.a).toBeUndefined();
    pad = null;
    s = input.sample(32);
    expect(s.pad).toBe(null);
    expect(s.tapped).toEqual({});
  });

  // (a new Set, objects and two closures a frame were garbage on the
  // runtime's path: the snapshot is the frame's, and no world keeps it)
  it('is one snapshot, refreshed by each sample, with nothing made anew', () => {
    const win = fakeTarget();
    const input = createInput({ readPad: () => null });
    input.attach({ win, host: fakeTarget() });
    input.bind({ go: ['KeyW'] });
    win.fire('keydown', press('KeyW'));
    const a = input.sample(0);
    const { keys, pressed, pointer, stick, action, axis, tapped } = a;
    expect(a.pressed.has('KeyW')).toBe(true);
    const b = input.sample(16);
    expect(b).toBe(a);
    expect(b.keys).toBe(keys);
    expect(b.pointer).toBe(pointer);
    expect(b.stick).toBe(stick);
    expect(b.action).toBe(action);
    expect(b.axis).toBe(axis);
    expect(b.tapped).toBe(tapped);
    expect(b.action('go')).toBe(true);
    expect(b.pressed.has('KeyW')).toBe(false);
    // (the two press sets take turns: the one handed out is never the one filling)
    win.fire('keydown', press('KeyD'));
    expect(b.pressed.has('KeyD')).toBe(false);
    expect(input.sample(32).pressed).toBe(pressed);
    expect(input.sample(48).pressed.has('KeyD')).toBe(false);
  });

  it('the pointer is in the host box, with a drag since the last sample', () => {
    const host = fakeTarget();
    const input = createInput();
    input.attach({ win: fakeTarget(), host });
    host.fire('pointerdown', { clientX: 110, clientY: 70, pointerId: 1, button: 0, currentTarget: host, target: host, pointerType: 'mouse', isPrimary: true });
    let s = input.sample(0);
    expect(s.pointer).toMatchObject({ x: 100, y: 50, down: true, drag: null });
    host.fire('pointermove', { clientX: 120, clientY: 65, pointerId: 1 });
    host.fire('pointermove', { clientX: 125, clientY: 60, pointerId: 1 });
    s = input.sample(16);
    expect(s.pointer).toMatchObject({ x: 115, y: 40, down: true, drag: { dx: 15, dy: -10 } });
    host.fire('pointerup', { clientX: 125, clientY: 60, pointerId: 1 });
    s = input.sample(32);
    expect(s.pointer.down).toBe(false);
    expect(s.pointer.drag).toBe(null);
  });
});
