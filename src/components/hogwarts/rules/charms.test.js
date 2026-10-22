import { describe, expect, it } from 'vitest';
import { CHARMS, burn, charmsBot, gesture, grade, newCharms, press, release, result, stepCharms } from './charms';

const flick = (c, t, hold) => release(press(c, t), t + hold);

describe('the swish and flick', () => {
  it('grades a hold against the beat', () => {
    expect(grade(CHARMS.beat)).toBe('perfect');
    expect(grade(CHARMS.beat + CHARMS.perfect - 0.01)).toBe('perfect');
    expect(grade(CHARMS.beat - CHARMS.good + 0.01)).toBe('good');
    expect(grade(CHARMS.beat + 0.5)).toBe('miss');
    expect(grade(0.1)).toBe('jab');
  });
  it('on the beat lifts the feather, near it a little, off it lets it sink', () => {
    const c = { ...newCharms(), h: 1 };
    expect(flick(c, 0, CHARMS.beat).charms.h).toBeCloseTo(1 + CHARMS.lift.perfect);
    expect(flick(c, 0, CHARMS.beat + 0.18).charms.h).toBeCloseTo(1 + CHARMS.lift.good);
    expect(flick(c, 0, CHARMS.beat + 0.6).charms.h).toBeLessThan(1);
    expect(flick(newCharms(), 0, CHARMS.beat + 0.6).charms.h).toBe(0);
  });
  it('a jab sets the feather on fire, costing five points and the height', () => {
    const r = flick({ ...newCharms(), h: 2 }, 0, 0.08);
    expect(r.grade).toBe('jab');
    expect(r.points).toBe(-CHARMS.burn);
    expect(r.charms.h).toBe(0);
    expect(r.charms.burnt).toBe(1);
    // and so does Incendio at it
    expect(burn(newCharms()).points).toBe(-5);
  });
  it('sinks between flicks, never below the desk', () => {
    const c = stepCharms({ ...newCharms(), h: 1 }, 2);
    expect(c.h).toBeCloseTo(1 - 2 * CHARMS.sink);
    expect(stepCharms(c, 100).h).toBe(0);
  });
  it('a release with no press does nothing', () => {
    expect(release(newCharms(), 3).grade).toBe(null);
  });
});

describe('the pointer', () => {
  const path = (swish, flickUp, across = 120) => {
    const out = [];
    for (let t = 0; t <= swish; t += 0.02) out.push({ x: (t / swish) * across, y: 300, t });
    out.push({ x: across + 4, y: 300 - flickUp, t: swish + 0.08 });
    return out;
  };
  it('reads a swish and a flick up as a hold of the swish’s length', () => {
    const g = gesture(path(0.9, 40));
    expect(g.ok).toBe(true);
    expect(g.jab).toBe(false);
    expect(grade(g.hold)).toBe('perfect');
  });
  it('a poke with no swish is a jab; a swish with no flick is nothing', () => {
    expect(gesture(path(0.1, 40, 10)).jab).toBe(true);
    expect(gesture(path(0.9, 2)).ok).toBe(false);
    expect(gesture([]).ok).toBe(false);
  });
});

describe('the lesson', () => {
  it('the bot keeps the beat and reaches the ceiling in a dozen flicks, for ten points', () => {
    let c = newCharms();
    let t = 0;
    let points = 0;
    while (!c.done && t < 60) {
      const act = charmsBot(c, t);
      if (act === 'press') c = press(c, t);
      else if (act === 'release') {
        const r = release(c, t);
        c = r.charms;
        points += r.points;
      }
      c = stepCharms(c, 1 / 30);
      t += 1 / 30;
    }
    expect(c.done).toBe(true);
    expect(c.flicks).toBeLessThanOrEqual(12);
    expect(c.burnt).toBe(0);
    expect(points).toBe(CHARMS.points);
    expect(result(c)).toEqual({ type: 'lesson', id: 'charms', done: true, points: 10 });
  });
  it('flicking off the beat never gets there', () => {
    let c = newCharms();
    for (let i = 0; i < 50; i++) c = stepCharms(flick(c, i * 2, CHARMS.beat + 0.5).charms, 1);
    expect(c.done).toBe(false);
    expect(result(c)).toBe(null);
  });
});
