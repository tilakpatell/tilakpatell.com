import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createNpcs } from './npc';
import { lineHold } from './living';

// A figure as the cast makes one, with what npc.js asks of it written down
function figure({ calls = true } = {}) {
  const group = new THREE.Group();
  const log = { update: [], react: [], look: [], play: [], stop: 0 };
  const c = {
    kind: 'gromflomite',
    group,
    height: 1.8,
    update: (t, move, hit, opts) => log.update.push({ t, move, opts }),
    play: (name, opts) => {
      log.play.push([name, opts]);
      return Promise.resolve(true);
    },
    stop: () => log.stop++,
    log,
  };
  if (calls) {
    c.react = (event, ctx) => {
      log.react.push([event, ctx]);
      return { clip: event };
    };
    c.look = (target) => log.look.push(target ? { x: target.x, z: target.z } : null);
  }
  return c;
}

const AREA = { x0: -60, x1: 60, z0: -60, z1: 60 };
// `s` seconds of frames, Morty wherever `at(t)` puts him; what was emitted
function run(N, list, s, at, { t0 = 0, talk = null, dt = 1 / 60 } = {}) {
  const events = [];
  let t = t0;
  for (let i = 0; i < Math.round(s / dt); i++) {
    t += dt;
    const m = at(t);
    const state = { morty: { face: 0, speed: 0, ...m }, done: [], emit: (name, e) => events.push([name, e]), talk: typeof talk === 'function' ? talk(t) : talk };
    for (const n of list) N.step(n, t, dt, state);
  }
  return { events, t };
}
const last = (c) => c.log.update.at(-1);
const reacts = (c, event) => c.log.react.filter(([e]) => e === event);

describe('a hunter’s body', () => {
  it('runs at Morty on the ground it really covers, its eyes on him', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { hunt: { speed: 4, catchR: 1.1, always: true } } });
    run(N, [n], 1, () => ({ x: 20, z: 0 }));
    const u = last(c);
    expect(u.move).toBeCloseTo(1, 6); // (as it always was)
    expect(u.opts.motion.speed).toBeGreaterThan(3.6);
    expect(u.opts.motion.speed).toBeLessThan(4.4);
    expect(Math.abs(u.opts.motion.side)).toBeLessThan(0.3);
    expect(u.opts.dt).toBeCloseTo(1 / 60, 9);
    const seen = c.log.look.at(-1);
    expect(seen.x).toBeCloseTo(20, 6);
    expect(seen.z).toBeCloseTo(0, 6);
  });

  it('looks about for him with its head once it’s lost him, then gives up', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { hunt: { speed: 3, catchR: 1.1, near: 6, lose: 12 } } });
    const { t } = run(N, [n], 0.5, () => ({ x: 5, z: 0 }));
    expect(n.hunting).toBe(true);
    c.log.look.length = 0;
    const r = run(N, [n], 3, () => ({ x: 40, z: 30 }), { t0: t });
    expect(n.hunting).toBe(false);
    const g = c.group.position;
    const dirs = c.log.look.filter(Boolean).map((p) => Math.atan2(p.x - g.x, p.z - g.z));
    expect(dirs.length).toBeGreaterThan(100);
    expect(Math.max(...dirs) - Math.min(...dirs)).toBeGreaterThan(1);
    run(N, [n], 4, () => ({ x: 40, z: 30 }), { t0: r.t });
    expect(c.log.look.at(-1)).toBe(null);
  });

  it('tells RmWorld what it always told it, and shows it: seen, then caught', () => {
    const N = createNpcs({ id: 'x', area: AREA, words: { caught: 'Got you.', spotted: 'There!' } });
    const c = figure();
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { hunt: { speed: 3, catchR: 1.1, near: 6 } }, id: 'guard' });
    const { events } = run(N, [n], 4, () => ({ x: 3, z: 0 }));
    expect(events[0]).toEqual(['spotted', { area: 'x', who: 'guard', text: 'There!' }]);
    expect(events.some(([name, e]) => name === 'caught' && e.text === 'Got you.' && e.who === 'guard')).toBe(true);
    expect(reacts(c, 'alert').length).toBe(1);
    expect(reacts(c, 'caught').length).toBeGreaterThan(0);
    expect(reacts(c, 'greet').length).toBe(0); // (a hunter doesn't wave)
  });
});

describe('a local’s body', () => {
  const local = (N, c, extra = {}) => N.add(c, { x: 0, z: 0, face: 0, ai: { watch: 8, bark: { r: 4, every: 14, lines: ['Oh, hey, Morty. Brad’s around somewhere.'] }, ...extra }, id: 'jessica' });

  it('waves the first time he comes up, and again only once he’s been well away', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    const n = local(N, c);
    let r = run(N, [n], 2, () => ({ x: 20, z: 0 }));
    expect(reacts(c, 'greet').length).toBe(0);
    r = run(N, [n], 3, (t) => ({ x: Math.max(5, 20 - (t - r.t) * 8), z: 0 }), { t0: r.t });
    const greets = reacts(c, 'greet');
    expect(greets.length).toBe(1);
    expect(greets[0][1].target.x).toBeLessThan(6); // (as he comes within six metres)
    expect(greets[0][1].target.x).toBeGreaterThan(5);
    r = run(N, [n], 2, () => ({ x: 7, z: 0 }), { t0: r.t }); // (still about: no more)
    expect(reacts(c, 'greet').length).toBe(1);
    r = run(N, [n], 1, () => ({ x: 30, z: 0 }), { t0: r.t });
    run(N, [n], 1, () => ({ x: 5, z: 0 }), { t0: r.t + 30 });
    expect(reacts(c, 'greet').length).toBe(2);
  });

  it('talks with its hands for as long as its bark takes to say', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    const n = local(N, c);
    const { events } = run(N, [n], 1, () => ({ x: 3, z: 0 }));
    const bark = events.find(([name]) => name === 'bark');
    expect(bark[1]).toEqual({ area: 'x', who: 'jessica', text: 'Oh, hey, Morty. Brad’s around somewhere.' });
    const says = reacts(c, 'say');
    expect(says.length).toBe(1);
    expect(says[0][1].hold).toBeCloseTo(lineHold(bark[1].text), 6);
    expect(says[0][1].target.x).toBeCloseTo(3, 6);
  });

  it('turns its head and talks with its hands when Morty talks to it, once a word', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { watch: 3 }, id: 'krombopulos' });
    const talk = { id: 'krombopulos', n: 4, hold: 2.5 };
    let r = run(N, [n], 1, () => ({ x: 1.5, z: 0.5 }), { talk });
    expect(reacts(c, 'say').length).toBe(1);
    expect(reacts(c, 'say')[0][1]).toMatchObject({ hold: 2.5 });
    r = run(N, [n], 1, () => ({ x: 1.5, z: 0.5 }), { t0: r.t, talk: { ...talk, id: 'someone-else', n: 5 } });
    run(N, [n], 1, () => ({ x: 1.5, z: 0.5 }), { t0: r.t, talk: { ...talk, n: 6 } });
    expect(reacts(c, 'say').length).toBe(2);
  });
});

describe('a walker’s body', () => {
  it('walks round Morty standing in its way, and still gets where it’s going', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { wander: [[10, 0], [0, 0]], speed: 1.1, pause: 30 } });
    let closest = Infinity;
    let reached = false;
    for (let i = 0; i < 60 * 14; i++) {
      run(N, [n], 1 / 60, () => ({ x: 5, z: 0 }), { t0: i / 60 });
      const p = c.group.position;
      closest = Math.min(closest, Math.hypot(p.x - 5, p.z));
      if (Math.hypot(p.x - 10, p.z) < 0.5) reached = true;
    }
    expect(closest).toBeGreaterThan(0.6);
    expect(reached).toBe(true);
  });

  it('walks round whoever else stands in its way, as the place says', () => {
    const N = createNpcs({ id: 'x', area: AREA, others: () => [{ x: 5, z: 0, r: 0.3 }] });
    const c = figure();
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { wander: [[10, 0], [0, 0]], speed: 1.1, pause: 30 } });
    let closest = Infinity;
    for (let i = 0; i < 60 * 14; i++) {
      run(N, [n], 1 / 60, () => ({ x: 40, z: 40 }), { t0: i / 60 });
      closest = Math.min(closest, Math.hypot(c.group.position.x - 5, c.group.position.z));
    }
    expect(closest).toBeGreaterThan(0.5);
    expect(c.group.position.x).toBeGreaterThan(9.5);
  });

  it('steps out of the way of Morty walking at it', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    // (stood at its stop a long while, Morty coming straight down its x)
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { wander: [[0, 0], [0, 0.01]], speed: 1.1, pause: 60 } });
    const r = run(N, [n], 1, () => ({ x: 8, z: 0 }));
    expect(Math.abs(c.group.position.z)).toBeLessThan(0.05);
    run(N, [n], 3, (t) => ({ x: 8 - (t - 1) * 2.5, z: 0, face: Math.PI, speed: 2.5 }), { t0: r.t });
    expect(Math.abs(c.group.position.z)).toBeGreaterThan(0.6);
  });

  it('paces its feet to how fast it really walks, its turns eased', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { wander: [[10, 0], [0, 0]], speed: 0.9, pause: 2 } });
    run(N, [n], 3, () => ({ x: 40, z: 40 }));
    const u = last(c);
    expect(u.opts.motion.speed).toBeGreaterThan(0.75);
    expect(u.opts.motion.speed).toBeLessThan(1.05);
    expect(u.move).toBeCloseTo(Math.min(0.5, 0.9 / 2.4), 6); // (as it always was)
  });
});

describe('a figure in shapes', () => {
  it('goes about its business without looks or reactions to call', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure({ calls: false });
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { watch: 8, bark: { r: 4, lines: ['Hi.'] }, wander: [[4, 0], [0, 0]] } });
    expect(() => run(N, [n], 3, () => ({ x: 2, z: 0, speed: 2 }), { talk: { id: n.id, n: 1, hold: 2 } })).not.toThrow();
  });
});

describe('a place settling', () => {
  it('puts everyone home, their heads ahead and their feet still', () => {
    const N = createNpcs({ id: 'x', area: AREA });
    const c = figure();
    const n = N.add(c, { x: 0, z: 0, face: 0, ai: { hunt: { speed: 4, catchR: 1.1, always: true } } });
    run(N, [n], 1, () => ({ x: 20, z: 0 }));
    N.calm();
    expect(c.log.look.at(-1)).toBe(null);
    run(N, [n], 1 / 60, () => ({ x: 20, z: 0 }), { t0: 5 });
    expect(last(c).opts.motion.speed).toBeLessThan(1); // (put back home: no stride across the room)
  });
});

describe('a lookout (the vat’s buyers, turned by ./games/freeze.js)', () => {
  // a Gromflomite facing west, Morty's way
  const lookout = () => {
    const N = createNpcs({ id: 'vat', area: AREA });
    const c = figure();
    c.group.rotation.y = Math.PI + Math.PI / 2;
    const n = N.add(c, { x: 0, z: 0, face: Math.PI, ai: { watch: 8, lookout: true, bark: { r: 5, every: 1, lines: ['Where is the crystal, Sanchez?'] } }, id: 'g' });
    return { N, c, n };
  };
  const off = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const barks = (events) => events.filter(([name]) => name === 'bark');

  it('turns its back on the room while it’s told away, its head off Morty, with no word', () => {
    const { N, c, n } = lookout();
    N.lookout('away');
    const { events } = run(N, [n], 3, () => ({ x: -3, z: 0 }));
    expect(off(c.group.rotation.y, Math.PI + Math.PI + Math.PI / 2)).toBeLessThan(0.05);
    expect(c.log.look.filter(Boolean)).toEqual([]);
    expect(barks(events)).toEqual([]);
    expect(reacts(c, 'greet')).toEqual([]);
  });

  it('faces Morty with its head on him while it’s told to look', () => {
    const { N, c, n } = lookout();
    N.lookout('look');
    run(N, [n], 3, () => ({ x: 0, z: 3 }));
    expect(off(c.group.rotation.y, -Math.PI / 2 + Math.PI / 2)).toBeLessThan(0.05);
    expect(c.log.look.at(-1)).toEqual({ x: 0, z: 3 });
  });

  it('starts at him, once, when it’s seen him move', () => {
    const { N, c, n } = lookout();
    N.lookout('seen');
    run(N, [n], 2, () => ({ x: 0, z: 3 }));
    expect(reacts(c, 'alert')).toHaveLength(1);
  });

  it('watches as it always did when it’s told nothing, and once calmed', () => {
    const plain = lookout();
    const { events } = run(plain.N, [plain.n], 3, () => ({ x: 0, z: 3 }));
    expect(off(plain.c.group.rotation.y, 0)).toBeLessThan(0.05);
    expect(barks(events).length).toBeGreaterThan(0);
    const calmed = lookout();
    calmed.N.lookout('away');
    calmed.N.calm();
    const after = run(calmed.N, [calmed.n], 3, () => ({ x: 0, z: 3 }));
    expect(off(calmed.c.group.rotation.y, 0)).toBeLessThan(0.05);
    expect(barks(after.events).length).toBeGreaterThan(0);
  });
});
