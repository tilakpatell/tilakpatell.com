import { describe, expect, it } from 'vitest';
import { DRAG, createGesture } from './gesture';

const R = { left: 0, top: 0, width: 600, height: 600 };

describe('gesture', () => {
  it('a drag pans by the share of the box it moved, and swallows the click it ends with', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    expect(g.move(1, 303, 300, R)).toBeNull(); // (under DRAG: still a click)
    const m = g.move(1, 360, 300, R);
    expect(m.pan[0]).toBeCloseTo(60 / 600);
    expect(m.pan[1]).toBeCloseTo(0);
    g.up(1);
    expect(g.takeClick()).toBe(true);
    expect(g.takeClick()).toBe(false);
  });
  it('a press that barely moves is a click', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    expect(g.move(1, 302, 301, R)).toBeNull();
    g.up(1);
    expect(g.takeClick()).toBe(false);
  });
  it('two fingers pinch about their middle', () => {
    const g = createGesture();
    g.down(1, 200, 300, R);
    g.down(2, 400, 300, R);
    const m = g.move(2, 500, 300, R);
    expect(m.zoom).toBeCloseTo(300 / 200);
    expect(m.u).toBeCloseTo(0.5);
    expect(m.w).toBeCloseTo(0.5);
    g.up(2);
    g.up(1);
    expect(g.takeClick()).toBe(true); // (a pinch never picks a system)
  });
  it('the finger left after a pinch pans from where it is, not from where it first went down', () => {
    const g = createGesture();
    g.down(1, 200, 300, R);
    g.down(2, 400, 300, R);
    g.move(1, 100, 300, R); // (finger 1 travelled 100 px in the pinch)
    g.up(2);
    expect(g.move(1, 101, 300, R)).toBeNull(); // (1 px: nothing yet, and no jump back to the first press)
    const m = g.move(1, 131, 300, R);
    expect(m.pan[0]).toBeCloseTo(31 / 600);
    g.up(1);
    expect(g.takeClick()).toBe(true);
  });
  it('a move of exactly DRAG px is a pan; a hair less is still a click', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    expect(g.move(1, 300 + DRAG - 0.1, 300, R)).toBeNull();
    const m = g.move(1, 300 + DRAG, 300, R);
    expect(m.pan[0]).toBeCloseTo(DRAG / 600);
    const h = createGesture();
    h.down(1, 300, 300, R);
    expect(h.move(1, 300, 300 + DRAG, R).pan[1]).toBeCloseTo(DRAG / 600); // (exactly DRAG, straight down)
  });
  it('three fingers: when one lifts, the two left pinch from where they are, not from the old pair', () => {
    const g = createGesture();
    g.down(1, 200, 300, R);
    g.down(2, 400, 300, R);
    g.down(3, 300, 100, R);
    expect(g.move(3, 310, 100, R)).toBeNull(); // (three down: nothing to do yet, and no pan from the first press)
    g.up(1);
    const m = g.move(2, 410, 300, R);
    expect(m.zoom).toBeCloseTo(Math.hypot(410 - 310, 300 - 100) / Math.hypot(400 - 310, 300 - 100));
    expect(m.u).toBeCloseTo((400 + 310) / 2 / 600); // (about the middle of the two left)
    expect(m.w).toBeCloseTo((300 + 100) / 2 / 600);
    g.up(2);
    g.up(3);
    expect(g.takeClick()).toBe(true);
  });
  it('a pointer it never saw going up changes nothing', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    g.move(1, 340, 300, R); // (dragging)
    g.up(9);
    const m = g.move(1, 350, 300, R);
    expect(m.pan[0]).toBeCloseTo(10 / 600);
  });
  it('a cancelled press forgets itself', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    g.cancel(1);
    expect(g.move(1, 400, 300, R)).toBeNull();
  });
  it('knows whether a pointer is down, so a passing mouse needs no measuring', () => {
    const g = createGesture();
    expect(g.active).toBe(false);
    g.down(1, 300, 300, R);
    expect(g.active).toBe(true);
    g.down(2, 340, 300, R);
    g.up(1);
    expect(g.active).toBe(true);
    g.up(2);
    expect(g.active).toBe(false);
    g.down(3, 10, 10, R);
    g.cancel(3);
    expect(g.active).toBe(false);
  });
});
