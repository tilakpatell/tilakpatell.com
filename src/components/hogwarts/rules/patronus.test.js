import { describe, expect, it } from 'vitest';
import { LINES, PATRONUS, drift, newLesson, tryCast } from './patronus';

const wait = (l, s) => {
  const events = [];
  for (let t = 0; t < s; t += 1 / 30) {
    const r = drift(l, 1 / 30);
    l = r.lesson;
    events.push(...r.events);
  }
  return { l, events };
};

describe('learning the Patronus', () => {
  it('takes on the third try, the first two a mist that holds it back', () => {
    // (out of the wardrobe and a few steps on before the first try)
    let l = wait(newLesson(), 4).l;
    const one = tryCast(l);
    expect(one.learnt).toBe(false);
    expect(one.says).toBe(LINES.tries[0]);
    l = one.lesson;
    const held = wait(l, PATRONUS.hold * 0.9).l;
    expect(held.at).toBe(l.at);
    const two = tryCast(held);
    expect(two.learnt).toBe(false);
    expect(two.lesson.at).toBeGreaterThan(held.at);
    const three = tryCast(two.lesson);
    expect(three.learnt).toBe(true);
    expect(three.lesson.out).toBe(true);
    // (and once it has taken, nothing more to learn)
    expect(tryCast(three.lesson).learnt).toBe(false);
  });

  it('comes on and puts you down if you never try, then comes out again with your tries kept', () => {
    let l = tryCast(newLesson()).lesson;
    const r = wait(l, 30);
    expect(r.events.filter((e) => e.type === 'down').length).toBeGreaterThan(0);
    expect(r.events[0].says).toBe(LINES.down);
    l = r.l;
    expect(l.tries).toBe(1);
    expect(l.at).toBeGreaterThan(PATRONUS.near);
  });

  it('gives you time: the walk from the wardrobe to you is long enough for three tries', () => {
    // (two mists’ holds and the drift between them, at the eight-second cooldown of the spell)
    expect((PATRONUS.start - PATRONUS.near) / PATRONUS.pace + PATRONUS.hold).toBeGreaterThan(8 * 1.2);
  });
});

describe('the Patronus on its cooldown', () => {
  it('can be learnt without going down by someone who casts as soon as the wand is ready', () => {
    // (the spell’s eight seconds between casts, the first a second after it comes out)
    let l = newLesson();
    let downs = 0;
    let next = 1;
    for (let t = 0; t < 40 && !l.learnt; t += 1 / 30) {
      if (t >= next) {
        l = tryCast(l).lesson;
        next = t + 8;
      }
      const r = drift(l, 1 / 30);
      l = r.lesson;
      downs += r.events.length;
    }
    expect(l.learnt).toBe(true);
    expect(downs).toBe(0);
  });
});
