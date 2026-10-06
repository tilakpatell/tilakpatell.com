import { describe, expect, it } from 'vitest';
import { GANDALF, PEAKS } from './layout';
import { BRAWL, DRINK, bash, drink, newBrawl, newDrink, newWatch, periodOf, spot, stepBrawl, stepDrink, stepWatch, windowOf } from './rules';

const run = (step, state, secs, input, dt = 0.05) => {
  const ev = [];
  for (let t = 0; t < secs; t += dt) ev.push(...step(state, dt, input));
  return ev;
};

describe('Théoden King', () => {
  it('sends men at Gandalf, who are thrown back when they reach him, and the work falters', () => {
    const b = newBrawl(2);
    const ev = run(stepBrawl, b, 8).map((e) => e.type);
    expect(ev).toContain('come');
    expect(ev).toContain('reach');
    expect(b.reached).toBeGreaterThan(0);
    expect(b.work).toBeLessThan(8 * BRAWL.work);
  });
  it('is done when the work is done, if the men are kept off', () => {
    const b = newBrawl(2);
    const ev = [];
    for (let t = 0; t < 30 && b.state === 'on'; t += 0.05) {
      ev.push(...stepBrawl(b, 0.05));
      // a guard at Gandalf's side, knocking down whoever comes near
      for (const m of b.men) if (m.state === 'come' && Math.hypot(m.x - GANDALF.x, m.z - GANDALF.z) < 3) {
        b.cool = 0;
        bash(b, { x: GANDALF.x, z: GANDALF.z, face: Math.atan2(-(m.z - GANDALF.z), m.x - GANDALF.x) });
      }
    }
    expect(ev.at(-1)).toEqual({ type: 'done' });
    expect(b.reached).toBe(0);
    expect(b.felled).toBeGreaterThan(3);
  });
  it('knocks down only who is close in front, and needs a moment between swings', () => {
    const b = newBrawl(2);
    b.men.push({ i: 0, x: 1.2, z: 0, state: 'come', downT: 0 }, { i: 1, x: -1.2, z: 0, state: 'come', downT: 0 }, { i: 2, x: 6, z: 0, state: 'come', downT: 0 });
    expect(bash(b, { x: 0, z: 0, face: 0 })).toBe(1);
    expect(b.men.map((m) => m.state)).toEqual(['down', 'come', 'come']);
    expect(bash(b, { x: 0, z: 0, face: Math.PI })).toBe(-1);
  });
});

describe('the drinking game', () => {
  it('swings faster and gives a narrower moment as it goes to your head', () => {
    expect(periodOf(1)).toBeLessThan(periodOf(0));
    expect(windowOf(1)).toBeLessThan(windowOf(0));
  });
  it('drinks at the top of the swing, spills elsewhere, and only once a swing', () => {
    const d = newDrink(3);
    d.k = 1;
    expect(drink(d)).toBe('drank');
    expect(drink(d)).toBe('wait');
    d.ready = true;
    d.k = 0;
    expect(drink(d)).toBe('spilled');
    expect(d.drinks).toBe(1);
    expect(d.legolas).toBe(1);
  });
  it('puts you under the table in the end, around a dozen', () => {
    const d = newDrink(3);
    let r = '';
    for (let i = 0; i < 40 && r !== 'down'; i++) {
      d.k = 1;
      d.ready = true;
      r = drink(d);
    }
    expect(r).toBe('down');
    expect(d.drinks).toBeGreaterThanOrEqual(10);
    expect(d.drinks).toBeLessThanOrEqual(15);
    expect(d.state).toBe('down');
  });
  it('comes to your lips and goes away again', () => {
    const d = newDrink(3);
    const ev = run(stepDrink, d, DRINK.slow * 2).map((e) => e.type);
    expect(ev).toContain('top');
    expect(ev).toContain('away');
  });
});

describe('the beacon', () => {
  it('lights one of the peaks after a while', () => {
    const w = newWatch(4, PEAKS);
    expect(spot(w)).toBe('nothing');
    const ev = run(stepWatch, w, 9, 0);
    expect(ev.find((e) => e.type === 'lit')).toBeTruthy();
    expect(w.lit).not.toBeNull();
  });
  it('is spotted only when you are looking at it', () => {
    const w = newWatch(4, PEAKS);
    w.lit = 2;
    w.look = PEAKS[2].bearing + 0.3;
    expect(spot(w)).toBe('wrong');
    w.look = PEAKS[2].bearing + 0.02;
    expect(spot(w)).toBe('spotted');
  });
  it('turns with the keys, within the mountains', () => {
    const w = newWatch(4, PEAKS);
    run(stepWatch, w, 10, -1);
    expect(w.look).toBeGreaterThan(-0.7);
    expect(w.look).toBeLessThan(-0.5);
  });
});
