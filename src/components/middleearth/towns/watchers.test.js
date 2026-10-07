import { describe, expect, it } from 'vitest';
import { seeded } from '../../../lib/seeded';
import { makeWalker } from './walker';
import { newWatchers, stepWatchers, watcherSees } from './watchers';

const OPTS = { sight: 8, cone: 0.6, smell: 1.6, hear: 2.5, ringSight: 30, alert: 0.5, chase: 4, patrol: 1.5, giveUp: 8, leash: 12, catch: 0.8, look: 1.2 };
const hobbit = (x, z, o = {}) => ({ x, z, face: 0, speed: 0, running: false, ...o });
// a watcher standing at the origin looking east (+x)
const eastward = () => ({ id: 0, x: 0, z: 0, face: 0, look: 0, mode: 'patrol', t: 0, wait: 9, leg: 1, unseen: 0 });
const house = { kind: 'box', x: 3, z: 0, w: 2, d: 3 };

describe('what a watcher sees', () => {
  it('sees ahead in its cone, not behind it or off to the side', () => {
    expect(watcherSees(eastward(), hobbit(5, 0), OPTS)).toBe(true);
    expect(watcherSees(eastward(), hobbit(-5, 0), OPTS)).toBe(false);
    expect(watcherSees(eastward(), hobbit(1, 5), OPTS)).toBe(false);
    expect(watcherSees(eastward(), hobbit(9, 0), OPTS)).toBe(false);
  });
  it('does not see through a house', () => {
    expect(watcherSees(eastward(), hobbit(5, 0), OPTS, { colliders: [house] })).toBe(false);
  });
  it('smells you close by through a wall, and sees the Ring from afar through anything', () => {
    const wall = [[0.7, -3, 0.7, 3]];
    expect(watcherSees(eastward(), hobbit(1.2, 0), OPTS, { walls: wall })).toBe(true);
    expect(watcherSees(eastward(), hobbit(-20, 0), OPTS, { colliders: [house], ring: true })).toBe(true);
  });
  it('hears you running close behind, if nothing is between', () => {
    expect(watcherSees(eastward(), hobbit(-2, 0, { running: true }), OPTS)).toBe(true);
    expect(watcherSees(eastward(), hobbit(-2, 0), OPTS)).toBe(false);
  });
});

describe('a watch', () => {
  const run = (ws, h, s, world) => {
    const ev = [];
    for (let t = 0; t < s; t += 1 / 30) ev.push(...stepWatchers(ws, typeof h === 'function' ? h() : h, 1 / 30, OPTS, world));
    return ev;
  };

  it('walks its round, corner to corner', () => {
    const ws = newWatchers([[[0, 0], [6, 0]]]);
    let far = 0;
    for (let t = 0; t < 8; t += 1 / 30) {
      stepWatchers(ws, hobbit(0, 40), 1 / 30, OPTS);
      far = Math.max(far, ws.list[0].x);
    }
    expect(far).toBeGreaterThan(5.8);
    // and turned back for the first corner after looking about at the second
    expect(ws.list[0].x).toBeLessThan(far - 1);
  });

  it('sees you, takes a moment, then gives chase and catches you', () => {
    const ws = newWatchers([[[0, 0], [10, 0]]]);
    ws.list[0].wait = 0;
    const ev = run(ws, hobbit(5, 0), 4);
    const types = ev.map((e) => e.type);
    expect(types[0]).toBe('seen');
    expect(types).toContain('caught');
    expect(ws.list[0].mode).not.toBe('patrol');
  });

  it('loses you once you are out of reach', () => {
    const ws = newWatchers([[[0, 0], [10, 0]]]);
    Object.assign(ws.list[0], { mode: 'chase', t: 0 });
    const ev = run(ws, hobbit(30, 0), 1);
    expect(ev.map((e) => e.type)).toContain('lost');
    expect(ws.list[0].mode).toBe('back');
  });

  it('notices nothing while the watch is off', () => {
    const ws = newWatchers([[[0, 0], [10, 0]]]);
    ws.list[0].wait = 0;
    expect(run(ws, hobbit(4, 0), 2, { active: false })).toEqual([]);
  });

  it('chases round a house, not through it', () => {
    const walls = makeWalker({ radius: 50, colliders: [house] });
    const ws = newWatchers([[[0, 0], [0, 1]]]);
    Object.assign(ws.list[0], { mode: 'chase', t: 0 });
    for (let i = 0; i < 90; i++) {
      stepWatchers(ws, hobbit(6, 0), 1 / 30, { ...OPTS, giveUp: 99 }, { colliders: [house], ring: true, push: (x, z) => walls.push(x, z, 0.4) });
      const w = ws.list[0];
      expect(Math.abs(w.x - house.x) < house.w / 2 && Math.abs(w.z - house.z) < house.d / 2).toBe(false);
    }
  });
});

describe('a watch on the toolkit', () => {
  const SLOW = { ...OPTS, far: 2, suspicious: 0.5, search: 10, giveUp: 99, leash: 50 };
  const run = (ws, h, s, opts, world) => {
    const ev = [];
    for (let t = 0; t < s; t += 1 / 30) ev.push(...stepWatchers(ws, typeof h === 'function' ? h(t) : h, 1 / 30, opts, typeof world === 'function' ? world(t) : world));
    return ev;
  };
  const gone = hobbit(-100, 0);

  it('an old option table runs as before: seen at once, no suspicion, no search', () => {
    expect(OPTS.far).toBeUndefined();
    const ws = newWatchers([[[0, 0], [10, 0]]]);
    ws.list[0].wait = 0;
    const ev = run(ws, hobbit(7, 0), 0.5, OPTS);
    expect(ev[0]?.type).toBe('seen');
    expect(ev.some((e) => e.type === 'suspicious' || e.type === 'searching')).toBe(false);
    Object.assign(ws.list[0], { mode: 'chase', t: 0 });
    const lost = run(ws, hobbit(40, 0), 1, OPTS);
    expect(lost.map((e) => e.type)).toContain('lost');
    expect(ws.list[0].mode).toBe('back');
  });

  it('far off in its cone it takes longer to be seen than up close', () => {
    // (walking its round, so it looks steadily ahead; up close, a smell is at once)
    const seenAt = (x) => {
      const ws = newWatchers([[[0, 0], [20, 0]]]);
      ws.list[0].wait = 0;
      let when = null;
      for (let t = 0; t < 6 && when === null; t += 1 / 30) if (stepWatchers(ws, hobbit(x, 0), 1 / 30, SLOW).some((e) => e.type === 'seen')) when = t;
      return when ?? 99;
    };
    expect(seenAt(1)).toBeLessThan(0.3);
    expect(seenAt(7)).toBeGreaterThan(0.8);
    expect(seenAt(7)).toBeGreaterThan(seenAt(4) + 0.25);
  });

  it('half seen, it walks over to look, and goes back to its round', () => {
    // you at the edge of its sight for a second, then gone
    const ws = newWatchers([[[0, 0], [2, 0]]]);
    ws.list[0].wait = 0;
    let furthest = 0;
    const ev = [];
    for (let t = 0; t < 14; t += 1 / 30) {
      ev.push(...stepWatchers(ws, t < 1 ? hobbit(7, 0) : gone, 1 / 30, SLOW));
      furthest = Math.max(furthest, ws.list[0].x);
    }
    const types = ev.map((e) => e.type);
    expect(types).toContain('suspicious');
    expect(types).not.toContain('seen');
    expect(furthest).toBeGreaterThan(5); // (it went over to look)
    expect(ws.list[0].mode).toBe('patrol');
  });

  it('lost round a corner, it goes to where you were, searches the corners, and goes back', () => {
    const ws = newWatchers([[[0, 0], [10, 0], [10, 10]]]);
    Object.assign(ws.list[0], { mode: 'chase', t: 0 });
    // a wall drops between you at half a second (you've gone round a corner), you move on behind it, and then you're away
    const you = (t) => (t < 0.5 ? hobbit(6, 0) : t < 2.5 ? hobbit(6, 20) : gone);
    const world = (t) => ({ walls: t > 0.5 ? [[4, -6, 4, 6]] : [] });
    const goals = [];
    let searchingAt = null;
    const ev = [];
    for (let t = 0; t < 30; t += 1 / 30) {
      const out = stepWatchers(ws, you(t), 1 / 30, { ...SLOW, search: 40 }, world(t));
      ev.push(...out);
      if (ws.list[0].mode === 'search') {
        if (searchingAt === null) searchingAt = t;
        if (ws.list[0].goal) goals.push(ws.list[0].goal.join(','));
      }
    }
    const types = ev.map((e) => e.type);
    expect(types).toContain('lost');
    expect(types).toContain('searching');
    expect(types).not.toContain('caught');
    // lost once out of sight a moment, not at once
    expect(searchingAt).toBeGreaterThan(0.5 + 1.4);
    // where it last had you first (the truth, the moment it still knew), then a corner of its round
    const distinct = [...new Set(goals)];
    expect(distinct.length).toBeGreaterThanOrEqual(2);
    expect(distinct[0]).toBe('6,20');
    expect(['10,0', '10,10', '0,0']).toContain(distinct[1]);
  });

  it('two watchers split the search, and one that sees you again gives chase', () => {
    const ws = newWatchers([[[0, 0], [10, 0]], [[0, 4], [10, 4], [10, 14]]]);
    for (const w of ws.list) Object.assign(w, { mode: 'chase', t: 0 });
    const you = (t) => (t < 0.3 ? hobbit(6, 2) : t < 2.3 ? hobbit(6, 25) : gone);
    const world = (t) => ({ walls: t > 0.3 ? [[4, -6, 4, 20]] : [] });
    let split = false;
    for (let t = 0; t < 30 && !split; t += 1 / 30) {
      stepWatchers(ws, you(t), 1 / 30, { ...SLOW, search: 40 }, world(t));
      const [a, b] = ws.list;
      if (a.mode === 'search' && b.mode === 'search' && a.goal && b.goal && a.goal.join() !== b.goal.join()) split = true;
    }
    expect(split).toBe(true);
    // you under one's nose again: it has you
    const ev = run(ws, hobbit(ws.list[0].x + 1, ws.list[0].z), 1, { ...SLOW, search: 40 }, {});
    expect(ev.map((e) => e.type)).toContain('seen');
  });

  it('the search is seeded: two towns with one seed search the same spots', () => {
    // the same chase lost round the same corner, in two towns made with one seed
    const town = (seed) => {
      const ws = newWatchers([[[0, 0], [10, 0]], [[0, 4], [10, 4], [10, 14]]], { rand: seeded(seed) });
      for (const w of ws.list) Object.assign(w, { mode: 'chase', t: 0 });
      const you = (t) => (t < 0.3 ? hobbit(6, 2) : t < 2.3 ? hobbit(6, 25) : gone);
      const world = (t) => ({ walls: t > 0.3 ? [[4, -6, 4, 20]] : [] });
      const trace = [];
      for (let t = 0; t < 20; t += 1 / 30) {
        stepWatchers(ws, you(t), 1 / 30, { ...SLOW, search: 6 }, world(t));
        trace.push(ws.list.map((w) => `${w.mode} ${w.goal?.join() ?? '-'} ${w.x.toFixed(3)},${w.z.toFixed(3)}`).join(' | '));
      }
      return trace;
    };
    const a = town(7);
    expect(a.some((line) => line.includes('search'))).toBe(true);
    expect(town(7)).toEqual(a);
    // (and it's the seed that does it: another seed leaves the search at other moments)
    expect(town(8)).not.toEqual(a);
  });

  it('the Ring shows you through anything, at once', () => {
    const ws = newWatchers([[[0, 0], [10, 0]]]);
    ws.list[0].wait = 0;
    const ev = run(ws, hobbit(-20, 0), 0.3, SLOW, { colliders: [house], ring: true });
    expect(ev[0]?.type).toBe('seen');
  });
});
