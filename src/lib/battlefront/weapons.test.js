import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded.js';
import { loadRulebook, weaponOf } from './rulebook.js';
import { HAND_DAMAGE, WINDOW_STEP, coolBar, coolPress, createGun, damageAt, dispersionFor, fire, tick, vent } from './weapons.js';

const rb = loadRulebook();
const A280C = weaponOf(rb, 'a280c');
const gun = () => createGun(A280C, { rand: seeded(3) });

// overheat a gun and come back the time the bar reads `b`
function overheated(b) {
  const g = gun();
  let now = 0;
  while (g.state === 'ready') {
    fire(g, now);
    now += 60 / A280C.firing.burstsPerMinute;
  }
  return { g, at: g.cooling.at + (1 - b) * A280C.heat.penalty };
}

describe('guns', () => {
  it('fires a burst of three at the rate of fire, then waits for the next burst', () => {
    const g = gun();
    const shots = fire(g, 0);
    expect(shots).toHaveLength(A280C.firing.burst);
    expect(shots[1].at - shots[0].at).toBeCloseTo(60 / A280C.firing.rof, 9);
    expect(fire(g, 0.05)).toBeNull();
    expect(fire(g, 60 / A280C.firing.burstsPerMinute)).toHaveLength(3);
  });

  it('fires one shot an interval on an automatic', () => {
    const g = createGun(weaponOf(rb, 'e11'), { rand: seeded(1) });
    expect(fire(g, 0)).toHaveLength(1);
    expect(fire(g, 0.1)).toBeNull();
    expect(fire(g, 0.2)).toHaveLength(1);
  });

  it('overheats at exactly the threshold after 24 bolts', () => {
    const g = gun();
    let n = 0;
    let now = 0;
    while (g.state === 'ready') {
      n += fire(g, now)?.length ?? 0;
      now += 1;
    }
    expect(n).toBe(24);
    expect(g.heat).toBeGreaterThanOrEqual(A280C.heat.threshold);
    expect(g.state).toBe('overheated');
    expect(fire(g, now)).toBeNull();
  });

  it('times active cooling on the bar: the window, its inclusive edge, the super window and a miss', () => {
    for (const [b, want] of [
      [0.7, 'success'],
      [0.65, 'success'],
      [0.35, 'super'],
      [0.9, 'fail'],
    ]) {
      const { g, at } = overheated(b);
      expect(coolBar(g, at)).toBeCloseTo(b, 9);
      expect(coolPress(g, at)).toBe(want);
    }
  });

  it('adds the failure penalty and resets the window on a miss', () => {
    const { g, at } = overheated(0.9);
    const until = g.until;
    coolPress(g, at);
    expect(g.until).toBeCloseTo(until + A280C.heat.cooling.failurePenalty, 9);
    expect(g.cooling.window).toEqual(A280C.heat.cooling.window);
  });

  it('narrows the next window by a step after a success', () => {
    const { g, at } = overheated(0.7);
    coolPress(g, at);
    tick(g, A280C.heat.cooling.successPenalty, at + A280C.heat.cooling.successPenalty);
    expect(g.state).toBe('ready');
    expect(g.heat).toBe(0);
    let now = at + 1;
    while (g.state === 'ready') {
      fire(g, now);
      now += 1;
    }
    expect(g.cooling.window[0]).toBe(A280C.heat.cooling.window[0]);
    expect(g.cooling.window[1]).toBeCloseTo(A280C.heat.cooling.window[1] + WINDOW_STEP, 9);
  });

  it('serves the penalty and the vent when nobody presses', () => {
    const { g } = overheated(1);
    const t0 = g.cooling.at;
    tick(g, A280C.heat.penalty, t0 + A280C.heat.penalty);
    expect(g.state).toBe('venting');
    tick(g, A280C.heat.cooling.vent, t0 + A280C.heat.penalty + A280C.heat.cooling.vent);
    expect(g.state).toBe('ready');
    expect(g.heat).toBe(0);
  });

  it('cools between bursts and vents by hand above the minimum heat', () => {
    const g = gun();
    fire(g, 0);
    const h = g.heat;
    tick(g, 0.2, 0.2);
    expect(g.heat).toBe(h);
    tick(g, 0.2, 1);
    expect(g.heat).toBeCloseTo(h - A280C.heat.dropPerSecond * 0.2, 9);
    expect(vent(g, 1)).toBe(false);
    fire(g, 2);
    fire(g, 3);
    fire(g, 4);
    expect(vent(g, 4)).toBe(true);
    tick(g, 1, 5);
    expect(g.heat).toBe(0);
  });

  it('opens the cone by stance and by shot, in radians', () => {
    const g = gun();
    expect(dispersionFor(g, 'stand', false)).toBe(0);
    expect(dispersionFor(g, 'crouch', false)).toBeCloseTo((0.1 * Math.PI) / 180, 9);
    expect(dispersionFor(g, 'stand', true)).toBeCloseTo((0.5 * Math.PI) / 180, 9);
    for (let i = 0; i < 4; i++) fire(g, i);
    // ten shots of 0.08°: the stand cone's 0.8° cap
    expect(g.spread).toBeCloseTo(0.8, 9);
    expect(dispersionFor(g, 'stand', false)).toBeCloseTo((0.8 * Math.PI) / 180, 9);
  });

  it('falls off with range', () => {
    expect(damageAt(A280C, 0)).toBe(A280C.damage.start);
    expect(damageAt(A280C, 30)).toBeCloseTo((A280C.damage.start + A280C.damage.end) / 2, 9);
    expect(damageAt(A280C, A280C.damage.endDistance + 10)).toBe(A280C.damage.end);
    expect(damageAt(weaponOf(rb, 'bowv2'), 10)).toBe(HAND_DAMAGE.special);
  });
});
