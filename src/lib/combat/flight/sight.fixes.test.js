import { describe, expect, it } from 'vitest';
import { aimAngles, dirTo } from './targeting';
import { createSight } from './sight';
import { DT, T, feed, fresh, ship } from './fixtures/fight';

describe('the T ring', () => {
  const [a, b, c] = [T('a', 0, 0, -20), T('b', 5, 0, -20), T('c', -9, 0, -20)];
  const facing = (t) => ({ ...ship, heading: aimAngles(dirTo(ship, t.at)).heading });
  const press = (st, sight, s) => ((st.cycle = 1), sight.update(s, [a, b, c], DT, feed()), st.lock.id);
  const start = () => {
    const st = fresh();
    const sight = createSight(st);
    sight.update(ship, [a, b, c], DT, feed());
    return [st, sight, [st.lock.id, press(st, sight, ship)]]; // (the ring a, b, c; the lock b)
  };

  it.each([0.3, 3, 10])('keeps the ring between presses %s s apart', (gap) => {
    const [st, sight, ids] = start();
    for (const t of [b, c]) {
      for (let s = 0; s < gap; s += DT) sight.update(facing(t), [a, b, c], DT, feed());
      ids.push(press(st, sight, facing(t)));
    }
    expect(ids).toEqual(['a', 'b', 'c', 'a']);
  });

  it('starts the ring again when the lock is written from outside, or lost', () => {
    const after = (cut) => {
      const [st, sight] = start();
      cut(st, sight);
      sight.update(facing(b), [a, b, c], DT, feed());
      return press(st, sight, facing(b)); // (round the nose afresh: b, a, c)
    };
    expect(after((st) => (st.lock = { id: 'b', out: 0, manual: true }))).toBe('a'); // (a tap, a pose or a check)
    expect(after((st, sight) => sight.update(facing(b), [], DT, feed()))).toBe('a'); // (lost)
  });
});
