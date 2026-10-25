import { describe, expect, it } from 'vitest';
import { AIM, nose } from './targeting';
import { TRACK_AFTER_SHOT, createSight } from './sight';
import { DT, T, feed, fight, fresh, ship } from './fixtures/fight';

const atLeast = (seen, min) => Object.entries(min).forEach(([k, n]) => expect(seen[k], k).toBeGreaterThanOrEqual(n)); // (the fight took every branch)

describe('the sight', () => {
  it('matches each map’s old lock block, nudge, aim and lean frame for frame through a 30 s fight', () => {
    expect(TRACK_AFTER_SHOT).toBe(1500);
    atLeast(fight('universe'), { ticks: 5, hot: 50, nudges: 500, followed: 100, unfollowed: 1 });
    atLeast(fight('galaxy'), { ticks: 5, hot: 50, nudges: 500, followed: 100 });
  });

  it('locks and ticks once, in reach up to the bolt’s life, reading help after lockTarget and only in reach', () => {
    const st = fresh();
    const sight = createSight(st);
    const a = T('a', 0, 0, -20);
    const saw = [];
    const o = feed({ help: () => saw.push(st.lockTarget) && { assist: 1 } });
    expect(sight.update(ship, [a], DT, o)).toBe(true);
    expect(st).toMatchObject({ lock: { id: 'a', out: 0 }, cycle: 0, trackable: true, lead: { x: 0, y: 0, z: -20, t: 1 / 3 }, hot: true });
    expect(saw[0]).toBe(a);
    expect(sight.update(ship, [T('a', 0, 0, -55)], DT, o)).toBe(false); // (the same id: no tick)
    expect(st.lead.t).toBeCloseTo(0.9166666666666666, 12);
    expect([st.hot, sight.inReach(), sight.nudge(ship, { turn: 0, climb: 0 }, 1), saw.length]).toEqual([false, false, null, 1]);
    const dir = nose(ship);
    expect(sight.aim(dir, ship, 1)).toBe(dir);
    sight.update(ship, [T('a', 0, 0, -51)], DT, o);
    expect([st.lead.t, st.hot, sight.inReach()]).toEqual([AIM.life, true, true]);
    expect(sight.update(ship, [], DT, o)).toBe(false);
    expect([st.lock, st.lockTarget, st.lead, st.hot, st.trackable]).toEqual([null, null, null, false, false]);
  });

  it('finds an id among the ungated foes, then the lock’s own list', () => {
    const sight = createSight(fresh());
    const [a, p, rock] = [T('a', 0, 0, -20), T('p', 5, 0, -20), T('rock', 0, 5, -30)];
    const cands = [a, p];
    sight.update(ship, cands, DT, feed({ foes: [a, rock] }));
    expect([sight.find('rock'), sight.find('p'), sight.find('zz'), sight.find(null)]).toEqual([rock, p, null, null]);
    sight.update(ship, cands, DT, feed());
    expect(sight.cands).toBe(cands);
    expect(sight.foes).toBe(cands);
    expect(sight.find('rock')).toBeNull();
  });

  it('picks the nearest target in front under a tap', () => {
    const project = (x, y, z, out) => Object.assign(out, { x: 400 + x * 10, y: 300 - y * 10, z: -z });
    const sight = createSight(fresh());
    sight.update(ship, [T('c', 0, 0, 20), T('d', 0, 0, -0.3), T('a', 0, 0, -20), T('b', 3, 0, -20)], DT, feed());
    // (c behind and d at depth 0.3, never; 415 a tie, the first; 480 is 50 px off b)
    expect([400, 425, 415, 480].map((x) => sight.pickAt(x, 300, project))).toEqual(['a', 'b', 'a', null]);
    expect(sight.pickAt(480, 300, project, 60)).toBe('b');
  });

  it('holds through a still frame and a 0.05 s spike, and runs with nothing to lock and no hunters', () => {
    // (review focus 1 and 4: a frozen frame, a tab come back, reduced motion)
    const st = fresh();
    const sight = createSight(st);
    const o = feed({ tracks: () => false });
    const a = () => T('a', 0, 0, -20, { x: 4, y: 0, z: 0 });
    sight.update(ship, [a()], DT, o);
    for (const dt of [0, 0.05, 0]) {
      sight.update(ship, [a()], dt, o);
      expect(st.lock.id).toBe('a');
      expect([st.lead.x, st.lead.y, st.lead.z, st.lead.t].every(Number.isFinite)).toBe(true);
    }
    expect(() => sight.update(ship, [], 0.05, o)).not.toThrow();
    expect([st.lock, st.hot, st.trackable, sight.find('a')]).toEqual([null, false, false, null]);
  });
});
