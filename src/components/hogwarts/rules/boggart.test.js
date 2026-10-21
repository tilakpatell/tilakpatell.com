import { describe, expect, it } from 'vitest';
import { BOGGART, JOKES, SAYS, THINGS, again, boggartBot, choices, choose, current, newBoggart, result } from './boggart';

describe('the boggart', () => {
  it('comes out as each of the three things once, in a seeded order', () => {
    const b = newBoggart({ seed: 4 });
    expect([...b.order].sort()).toEqual(THINGS.map((t) => t.id).sort());
    expect(newBoggart({ seed: 4 })).toEqual(b);
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => newBoggart({ seed }).order.join()));
    expect(orders.size).toBeGreaterThan(1);
  });
  it('offers three jokes each time: exactly one meant for what is out, one for each of the others', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let b = newBoggart({ seed });
      while (current(b)) {
        const on = choices(b);
        expect(on).toHaveLength(3);
        expect(new Set(on.map((j) => j.for))).toEqual(new Set(THINGS.map((t) => t.id)));
        b = choose(b, boggartBot(b)).boggart;
      }
    }
  });
  it('has three jokes for each thing, in the site’s words', () => {
    for (const t of THINGS) expect(JOKES.filter((j) => j.for === t.id)).toHaveLength(3);
    for (const j of JOKES) {
      expect(j.text).toMatch(/\.$/);
      expect(j.text).not.toMatch(/'/);
    }
  });
  it('a right joke laughs it off and the next comes out; the last finishes the lesson', () => {
    let b = newBoggart({ seed: 2 });
    const first = current(b).id;
    let r = choose(b, boggartBot(b));
    expect(r.right).toBe(true);
    expect(current(r.boggart).id).not.toBe(first);
    b = r.boggart;
    b = choose(b, boggartBot(b)).boggart;
    expect(result(b)).toBe(null);
    r = choose(b, boggartBot(b));
    expect(r.says).toContain(SAYS.done);
    expect(result(r.boggart)).toEqual({ type: 'lesson', id: 'boggart', done: true, points: BOGGART.points });
  });
  it('a wrong joke brings it a step closer, and three steps back you out of the room', () => {
    let b = newBoggart({ seed: 6 });
    const wrong = () => choices(b).find((j) => j.for !== current(b).id).id;
    for (let i = 1; i <= BOGGART.steps; i++) {
      const r = choose(b, wrong());
      expect(r.right).toBe(false);
      b = r.boggart;
      expect(b.steps).toBe(i);
    }
    expect(b.fled).toBe(true);
    expect(current(b)).toBe(null);
    // in again, from the same thing, and the bot sees it off
    b = again(b);
    expect(current(b)).toBeTruthy();
    while (current(b)) b = choose(b, boggartBot(b)).boggart;
    expect(result(b).done).toBe(true);
  });
  it('ignores a joke that isn’t on offer', () => {
    const b = newBoggart({ seed: 1 });
    const off = JOKES.find((j) => !b.offers[0].includes(j.id)).id;
    expect(choose(b, off)).toEqual({ boggart: b, right: false, says: null });
  });
});
