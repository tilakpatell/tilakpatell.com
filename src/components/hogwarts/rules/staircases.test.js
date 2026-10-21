import { describe, expect, it } from 'vitest';
import { EVERY, GALLERIES, LANDINGS, STAIRS, SWING, canSwing, connected, createStairs, endOf, links, route, settled, stepStairs } from './staircases';

// a walker crossing one way at a time (CROSS seconds a stair, about a
// walk’s worth): from `a` to `b` by the shortest way as the stairs stand, the
// schedule swinging stairs as it goes, never the one being walked
const CROSS = 6;
function walk(a, b, seed, limit = 60) {
  let st = createStairs({ seed });
  let at = a;
  let steps = 0;
  const first = st.swings;
  while (at !== b && steps < limit) {
    steps++;
    const way = route(st, at, b)?.[0] ?? null;
    // (on a stair while crossing it; at the landing, waiting, while nothing leads on)
    const on = way?.stair ?? null;
    const ends = st.ends;
    st = stepStairs(st, CROSS, { on });
    if (on) expect(st.swinging?.id).not.toBe(on);
    if (on) expect(st.ends[on]).toBe(ends[on]);
    expect(connected(settled(st))).toBe(true);
    if (way) at = way.to;
  }
  return { at, steps, swings: st.swings - first };
}

describe('the moving staircases', () => {
  it('has eight floors of landings, two a floor, each with somewhere to go', () => {
    expect(LANDINGS).toHaveLength(16);
    expect(new Set(LANDINGS.map((l) => l.floor)).size).toBe(8);
    for (const l of LANDINGS) expect(l.doors.length, l.id).toBeGreaterThan(0);
  });

  it('pivots every stair on a landing and swings its top between two landings above it', () => {
    const ids = new Set(LANDINGS.map((l) => l.id));
    for (const s of STAIRS) {
      expect(ids.has(s.from) && ids.has(s.to) && ids.has(s.alt), s.id).toBe(true);
      expect(s.to).not.toBe(s.alt);
      const f = (id) => Number(id[0]);
      expect(f(s.to)).toBeGreaterThan(f(s.from));
      expect(f(s.alt)).toBeGreaterThan(f(s.from));
    }
  });

  it('starts whole: every landing reachable from every other', () => {
    const st = createStairs();
    expect(connected(st)).toBe(true);
    for (const a of LANDINGS) for (const b of LANDINGS) expect(route(st, a.id, b.id), `${a.id}→${b.id}`).not.toBeNull();
  });

  it('swings a stair on the beat and settles it on its other landing', () => {
    let st = createStairs({ seed: 3 });
    st = stepStairs(st, EVERY - 0.01);
    expect(st.swinging).toBeNull();
    st = stepStairs(st, 0.02);
    expect(st.swinging).not.toBeNull();
    const id = st.swinging.id;
    const was = createStairs({ seed: 3 }).ends[id];
    expect(endOf(st, id)).toBeNull();
    expect(links(st).some((l) => l.stair === id)).toBe(false);
    st = stepStairs(st, SWING);
    expect(st.swinging).toBeNull();
    expect(st.ends[id]).not.toBe(was);
    expect(endOf(st, id)).toBe(STAIRS.find((s) => s.id === id)[st.ends[id]]);
  });

  it('never swings the stair you are on', () => {
    let st = createStairs({ seed: 11 });
    const on = st.order[st.next];
    expect(canSwing(st, on, { on })).toBe(false);
    st = stepStairs(st, EVERY, { on });
    expect(st.swinging?.id).not.toBe(on);
  });

  it('refuses a swing that would strand a landing', () => {
    // a castle without the seventh floor’s corridor: each top landing has one
    // stair up to it, and swinging either leaves the other alone
    const st = createStairs({ galleries: GALLERIES.slice(0, 2) });
    expect(connected(st)).toBe(true);
    expect(canSwing(st, 'e6')).toBe(false);
    expect(canSwing(st, 'w6')).toBe(false);
    // (below the fourth floor’s bridge any stair may go)
    expect(canSwing(st, 'w3')).toBe(true);
    // and the schedule passes over the two, never stranding the top
    let s = st;
    for (let i = 0; i < 300; i++) {
      s = stepStairs(s, 1);
      expect(s.swinging?.id ?? null).not.toBe('e6');
      expect(s.swinging?.id ?? null).not.toBe('w6');
      expect(connected(settled(s), LANDINGS)).toBe(true);
    }
    // and a castle with no fixed way across: two columns of stairs that never meet
    expect(connected(createStairs({ galleries: [] }))).toBe(false);
  });

  it('keeps every landing reachable through a long run of swings, whatever the seed', () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21]) {
      let st = createStairs({ seed });
      let swings = 0;
      for (let i = 0; i < 400; i++) {
        st = stepStairs(st, 1);
        expect(connected(settled(st))).toBe(true);
        if (st.swinging?.t === 0) swings++;
      }
      // (a swing every beat, or near it: the stairs are always moving somewhere)
      expect(swings).toBeGreaterThan(400 / (EVERY + SWING) - 4);
    }
  });

  it('walks every landing to every other in a few crossings, the stairs moving all the while', () => {
    let worst = 0;
    let swings = 0;
    let sum = 0;
    let n = 0;
    for (const seed of [1, 7, 42, 99, 123]) {
      for (const a of LANDINGS)
        for (const b of LANDINGS) {
          if (a.id === b.id) continue;
          const r = walk(a.id, b.id, seed);
          expect(r.at, `${a.id}→${b.id} seed ${seed}`).toBe(b.id);
          worst = Math.max(worst, r.steps);
          swings = Math.max(swings, r.swings);
          sum += r.steps;
          n++;
        }
    }
    // (the ground floor to the top is seven crossings when the stairs keep still)
    expect(sum / n).toBeLessThan(5);
    expect(worst).toBeLessThanOrEqual(20);
    expect(swings).toBeLessThanOrEqual(10);
  });

  it('has the Entrance Hall, the fourth floor and the seventh across without a stair', () => {
    expect(GALLERIES).toEqual([
      ['0w', '0e'],
      ['4w', '4e'],
      ['7w', '7e'],
    ]);
    expect(route(createStairs(), '0w', '0e')).toEqual([{ stair: null, to: '0e' }]);
  });
});
