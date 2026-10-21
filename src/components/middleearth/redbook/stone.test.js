import { describe, expect, it } from 'vitest';
import { DROP, OPEN, SEEN, newStone, stepStone } from './stone';

const hold = (s, secs, held = true, dt = 0.05) => {
  let x = s;
  const drops = [];
  for (let t = 0; t < secs; t += dt) {
    x = stepStone(x, dt, { held });
    if (x.dropped) drops.push(t);
  }
  return [x, drops];
};

describe('the Palantír', () => {
  it('is smoke at first, and the Eye opens in it within a second or two of looking', () => {
    const [first] = hold(newStone(), 0.1);
    expect(first.held).toBe(true);
    expect(first.eye).toBe(0);
    const [opened] = hold(newStone(), OPEN + 0.2);
    expect(opened.eye).toBe(1);
    expect(OPEN).toBeLessThan(2.5);
  });

  it('grows aware of whoever holds it, and at DROP has seen them: the stone falls, once', () => {
    const [aware] = hold(newStone(), (SEEN + DROP) / 2);
    expect(aware.seen).toBeGreaterThan(0);
    expect(aware.seen).toBeLessThan(1);
    const [x, drops] = hold(newStone(), DROP + 1);
    expect(drops).toHaveLength(1);
    expect(x.held).toBe(false);
    expect(x.rest).toBeGreaterThan(0);
  });

  it('cannot be taken up again straight after it falls', () => {
    const [x] = hold(newStone(), DROP + 0.1);
    const [again] = hold(x, 0.5);
    expect(again.held).toBe(false);
    const [later] = hold(again, 4);
    expect(later.held).toBe(true);
  });

  it('forgets the gaze when put down', () => {
    const [held] = hold(newStone(), 5);
    const [down] = hold(held, 0.1, false);
    expect(down).toMatchObject({ held: false, gaze: 0, eye: 0, seen: 0 });
  });
});
