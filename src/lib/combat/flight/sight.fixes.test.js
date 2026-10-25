import { describe, expect, it } from 'vitest';
import { aimAngles, dirTo } from './targeting';
import { WEAPONS } from '../../arms/ship';
import { createSight, shotReach } from './sight';
import { DT, T, feed, fresh, ship, v } from './fixtures/fight';

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

describe('the selected weapon', () => {
  const lone = (o, z, vel) => {
    const st = fresh();
    const sight = createSight(st);
    sight.update(ship, [T('a', 0, 0, z, vel)], DT, o);
    return [st, sight];
  };
  it('reads a weapon’s shot speed and life, adding the ship’s forward speed', () => {
    expect([shotReach(WEAPONS.spread, { ...ship, speed: 3.3 }), shotReach(WEAPONS.darkmatter, { ...ship, speed: -2 })]).toEqual([{ speed: 57.3, life: 0.4675 }, { speed: 22.8, life: 2.04 }]);
  });
  it('never calls the spread hot past 0.4675 s; leads dark matter 1.79 s to a hunter 30 out at 6', () => {
    const o = shotReach(WEAPONS.spread, ship, feed());
    const hot = [];
    for (let d = 10; d <= 60; d += 0.5) if (lone(o, -d)[0].hot) hot.push(lone(o, -d)[0].lead.t);
    expect([hot.length, Math.max(...hot) <= 0.4675, lone(feed(), -26)[0].hot]).toEqual([31, true, true]); // (10 to 25 out; the blaster's 26)
    const [st, sight] = lone(shotReach(WEAPONS.darkmatter, ship, feed()), -30, v(0, 0, -6));
    expect([st.lead.t, st.lead.z].map((n) => n.toFixed(9))).toEqual(['1.785714286', '-40.714285714']);
    expect([sight.inReach(), sight.nudge(ship, { turn: 0, climb: 0 }, 1) !== null]).toEqual([true, true]);
  });
  it('is hot by Force Focus’s help at 0.25 rad, assist 2.5, never on a pilot', () => {
    const hotOn = (more) => {
      const st = fresh();
      // (as powers.aim: Focus's 2.5 onto the game's ships, never a pilot)
      createSight(st).update(ship, [{ ...T('a', -20 * Math.sin(0.25), 0, -20 * Math.cos(0.25)), ...more }], DT, feed({ help: () => ({ assist: st.lockTarget?.peer ? 1 : 2.5 }) }));
      return st.hot;
    };
    expect([hotOn({}), hotOn({ peer: 'x' })]).toEqual([true, false]);
  });
  it('follows a weapon changed between two frames', () => {
    // (review focus 3: R, 1 2 3 or a refit mid-fight; the next frame reads the new reach)
    const st = fresh();
    const sight = createSight(st);
    const a = [T('a', 0, 0, -40)];
    const o = shotReach(WEAPONS.darkmatter, ship, feed());
    sight.update(ship, a, DT, o);
    expect(sight.inReach()).toBe(true);
    shotReach(WEAPONS.spread, ship, o);
    sight.update(ship, a, DT, o);
    expect([sight.inReach(), st.hot]).toEqual([false, false]);
  });
});
