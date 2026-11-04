import { describe, expect, it } from 'vitest';
import { cover } from './flight';
import { OPEN_EASE, easeOpen, sameOpen } from './openPart';

const open = cover({ w: 1280, h: 720, panel: 344, top: 76 });
const shut = cover({ w: 1280, h: 720, top: 76 });

// a quarter of a second's frames at `hz`, from `from` towards `to`
const run = (from, to, hz, ms = 250) => {
  let at = { rect: from, vel: null, done: false };
  const frames = [at.rect];
  for (let i = 0; i < Math.round((ms * hz) / 1000) && !at.done; i++) {
    at = easeOpen(at.rect, at.vel, to, 1 / hz);
    frames.push(at.rect);
  }
  return { at, frames };
};

describe('the open part, eased', () => {
  it('is there within a quarter of a second, at 60 and at 144 Hz', () => {
    for (const hz of [60, 144]) {
      const { at } = run(open, shut, hz, 300);
      expect(at.done).toBe(true);
      expect(at.rect).toEqual(shut);
    }
  });

  it('moves the same at any frame rate', () => {
    const a = run(open, shut, 60, 100).at.rect;
    const b = run(open, shut, 120, 100).at.rect;
    expect(Math.abs(a.sx - b.sx)).toBeLessThan(1);
    expect(Math.abs(a.w - b.w)).toBeLessThan(2);
  });

  it('never overshoots, and never jumps more than a fifth of the way in a frame at 60 Hz', () => {
    const { frames } = run(open, shut, 60, 400);
    const span = shut.sx - open.sx;
    for (let i = 1; i < frames.length; i++) {
      const step = frames[i].sx - frames[i - 1].sx;
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(span / 5);
      expect(frames[i].sx).toBeLessThanOrEqual(shut.sx);
    }
  });

  it('takes a long frame (a tab coming back) without overshooting', () => {
    const at = easeOpen(open, null, shut, 2);
    expect(at.done).toBe(true);
    expect(at.rect).toEqual(shut);
  });

  it('turns smoothly when the goal moves under it', () => {
    let at = easeOpen(open, null, shut, 1 / 60);
    at = easeOpen(at.rect, at.vel, shut, 1 / 60);
    const back = easeOpen(at.rect, at.vel, open, 1 / 60);
    // still going the old way for a frame: no reversal in one step
    expect(back.rect.sx).toBeGreaterThanOrEqual(at.rect.sx - 0.5);
    expect(back.done).toBe(false);
  });

  it('stays put at the goal, and a dt of nothing changes nothing', () => {
    expect(easeOpen(shut, null, shut, 1 / 60)).toMatchObject({ rect: shut, done: true });
    const mid = easeOpen(open, null, shut, 1 / 60);
    expect(easeOpen(mid.rect, mid.vel, shut, 0).rect).toEqual(mid.rect);
    expect(easeOpen(mid.rect, mid.vel, shut, Number.NaN).rect).toEqual(mid.rect);
  });

  it('holds every key cover() gives', () => {
    expect(Object.keys(easeOpen(open, null, shut, 1 / 60).rect).sort()).toEqual(Object.keys(shut).sort());
  });

  it('tells a real change from a sub-pixel one', () => {
    expect(sameOpen(open, { ...open, sx: open.sx + 0.2 })).toBe(true);
    expect(sameOpen(open, shut)).toBe(false);
    expect(sameOpen(null, shut)).toBe(false);
  });

  it('settles at a rate a test can name', () => {
    expect(OPEN_EASE.rate).toBeGreaterThan(15);
    expect(OPEN_EASE.rate).toBeLessThan(40);
  });
});
