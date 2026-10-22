import { describe, expect, it } from 'vitest';
import { NEEDS, PASSES, WALL, newWall, pass, think } from './requirement';

// walking along the corridor at a distance from the wall, a step at a time
function walk(state, xs, d = 1.2) {
  let s = state;
  const events = [];
  for (const x of xs) {
    const r = pass(s, { x, d });
    s = r.state;
    if (r.passed) events.push('pass');
    if (r.opened) events.push('open');
  }
  return { state: s, events };
}
const along = (a, b, step = 0.5) => {
  const out = [];
  for (let x = a; a < b ? x <= b : x >= b; x += a < b ? step : -step) out.push(x);
  return out;
};

describe('the Room of Requirement’s wall', () => {
  it('asks for one of three things, each a room of its own', () => {
    expect(NEEDS.map((n) => n.id)).toEqual(['practise', 'hide', 'quiet']);
    for (const n of NEEDS) {
      expect(n.ask).toMatch(/^A /);
      expect(n.said).not.toMatch(/['"]/);
    }
  });

  it('opens after three passes thinking of something, and not before', () => {
    let s = think(newWall(), 'hide');
    let r = walk(s, along(-6, 6));
    expect(r.events).toEqual(['pass']);
    r = walk(r.state, along(6, -6));
    expect(r.events).toEqual(['pass']);
    expect(r.state.open).toBe(false);
    r = walk(r.state, along(-6, 6));
    expect(r.events).toEqual(['pass', 'open']);
    expect(r.state.open).toBe(true);
    expect(r.state.passes).toBe(PASSES);
  });

  it('counts nothing without a need in mind, or walking far from the wall', () => {
    let r = walk(newWall(), [...along(-6, 6), ...along(6, -6), ...along(-6, 6)]);
    expect(r.events).toEqual([]);
    r = walk(think(newWall(), 'quiet'), [...along(-6, 6), ...along(6, -6), ...along(-6, 6)], WALL.near + 1);
    expect(r.events).toEqual([]);
  });

  it('forgets the count when you walk off to the end of the corridor', () => {
    let r = walk(think(newWall(), 'practise'), along(-6, 6));
    expect(r.state.passes).toBe(1);
    r = walk(r.state, along(6, WALL.away + 1));
    expect(r.state.passes).toBe(0);
  });

  it('starts again when you think of something else', () => {
    let r = walk(think(newWall(), 'practise'), [...along(-6, 6), ...along(6, -6)]);
    expect(r.state.passes).toBe(2);
    const s = think(r.state, 'quiet');
    expect(s.passes).toBe(0);
    expect(s.need).toBe('quiet');
    expect(think(s, 'nothing')).toBe(s);
  });
});
