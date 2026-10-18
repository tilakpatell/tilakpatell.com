import { describe, expect, it } from 'vitest';
import { LEAN, framing } from './mapFraming';
import { STOPS } from './road';

describe('the hub’s framing', () => {
  it('looks at the middle of the stops’ bounds, leant clear of the page’s title and chips', () => {
    const xs = STOPS.map((s) => s.x);
    const ys = STOPS.map((s) => s.y);
    expect(framing().at).toEqual([(Math.min(...xs) + Math.max(...xs)) / 2 + LEAN[0], (Math.min(...ys) + Math.max(...ys)) / 2 + LEAN[1]]);
  });
  it('gives the hand-drawn stops the hand-set framing’s zoom', () => {
    // the old sheet’s stops, which the hub framed at 3.05
    const old = [
      [186, 196],
      [262, 200],
      [312, 192],
      [388, 176],
      [382, 258],
      [438, 282],
      [486, 346],
      [562, 342],
      [604, 368],
      [596, 432],
      [660, 420],
    ].map(([x, y]) => ({ x, y }));
    expect(framing(old).zoom).toBe(3.05);
  });
  it('stands further off for a taller spread, and keeps every stop in frame', () => {
    const tall = framing([
      { x: 0, y: 0 },
      { x: 100, y: 400 },
    ]);
    const wide = framing([
      { x: 0, y: 0 },
      { x: 400, y: 100 },
    ]);
    expect(tall.zoom).toBeGreaterThan(wide.zoom);
    const f = framing();
    expect(f.zoom).toBeGreaterThan(2.5);
    expect(f.zoom).toBeLessThan(4);
  });
});
