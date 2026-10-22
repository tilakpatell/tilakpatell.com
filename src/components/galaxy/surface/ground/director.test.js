import { describe, expect, test } from 'vitest';
import { E, SITE, kit } from './fixtures/site';
import { turfsOf } from './turf';
import { CALM, RAID, REINFORCE, TOAST, createDirector } from './director';

const F = { ...E, control: 0.5, front: true };
const turfs = turfsOf(SITE, F, kit);
const pad = turfs.find((t) => t.id === 'pad');
// a population stand-in: who's dead, who's made, and what's sent in
const popOf = () => {
  const dead = new Set();
  const soldiers = new Map();
  const sent = [];
  return { dead, soldiers, sent, isDead: (id) => dead.has(id), cellOf: (x, z) => `${Math.floor(x / 48)},${Math.floor(z / 48)}`, reinforce: (key, specs) => sent.push({ key, specs }) };
};
const far = { x: 2000, z: 2000 };
const run = (d, secs, ctx, dt = 1) => {
  const out = [];
  for (let t = 0; t < secs; t += dt) out.push(...d.update(dt, ctx));
  return out;
};

describe('the director', () => {
  test('the numbers are the spec’s', () => {
    expect(RAID).toBe(150);
    expect(REINFORCE).toBe(120);
    expect(TOAST).toBe(12);
  });
  test('a raid is staged at the front on schedule, and not before', () => {
    const d = createDirector({ turfs, effects: F, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    const before = run(d, RAID / 0.5 - 2, { you: far, population });
    expect(before.filter((e) => e.type === 'raid')).toHaveLength(0);
    const after = run(d, 4, { you: far, population });
    const raid = after.find((e) => e.type === 'raid');
    expect(raid.side).toBe('rebel');
    expect(population.sent).toHaveLength(1);
    const { specs } = population.sent[0];
    expect(specs).toHaveLength(4);
    for (const s of specs) expect(s).toMatchObject({ side: 'rebel', role: 'raid' });
    // (sent at an owner post of the pad's turf)
    expect(pad.posts).toContainEqual(specs[0].home);
    expect(specs[0].beat).toEqual([specs[0].home]);
  });
  test('a quiet world has no raids', () => {
    const quiet = { ...E, control: 0.5 };
    const d = createDirector({ turfs: turfsOf(SITE, quiet, kit), effects: quiet, tier: 'high', rand: () => 0.5 });
    expect(run(d, 1000, { you: far, population: popOf() }).filter((e) => e.type === 'raid')).toHaveLength(0);
  });
  test('no raid while two fights run near you', () => {
    const d = createDirector({ turfs, effects: F, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    const fighting = (id, squad, x) => [id, { id, squad, side: 'empire', alive: true, target: 'x', b: { x, z: 0 } }];
    population.soldiers = new Map([fighting('a', 'q1', 0), fighting('b', 'q2', 10)]);
    const events = run(d, RAID * 3, { you: { x: 0, z: 0 }, population });
    expect(events.filter((e) => e.type === 'raid')).toHaveLength(0);
    expect(d.fights).toBe(2);
  });
  test('a post is lost when its holders are down, and held again once its reinforcement walks in from another post', () => {
    const d = createDirector({ turfs, effects: F, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    const key = 'pad:p0';
    population.dead.add('pad:p0:0').add('pad:p0:1');
    const lost = run(d, 1, { you: far, population });
    expect(lost.find((e) => e.type === 'post-lost')).toMatchObject({ side: 'rebel' });
    expect(d.posts.get(key).holder).toBe('rebel');
    const waited = run(d, REINFORCE / 0.5 + 2, { you: far, population });
    expect(waited.filter((e) => e.type === 'post-held')).toHaveLength(0);
    const sent = population.sent.find((s) => s.specs[0].home === pad.posts[0]);
    expect(sent).toBeTruthy();
    const from = sent.specs[0].at;
    // (walked, not placed: they start at another of the turf's posts)
    expect(Math.min(...pad.posts.slice(1).map((p) => Math.hypot(p[0] - from[0], p[1] - from[1])))).toBeLessThan(4);
    // they walk in
    for (const s of sent.specs) population.soldiers.set(s.id, { ...s, alive: true, b: { x: pad.posts[0][0], z: pad.posts[0][1] } });
    const held = run(d, 1, { you: far, population });
    expect(held.find((e) => e.type === 'post-held')).toBeTruthy();
    expect(d.posts.get(key).holder).toBe('empire');
  });
  test('reinforcement is never sent in within 60 m of you', () => {
    const d = createDirector({ turfs, effects: F, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    population.dead.add('pad:p0:0').add('pad:p0:1');
    const near = { x: pad.posts[1][0], z: pad.posts[1][1] };
    run(d, REINFORCE * 3, { you: near, population });
    expect(population.sent.filter((s) => s.specs[0].home === pad.posts[0])).toHaveLength(0);
    run(d, 2, { you: far, population });
    expect(population.sent.filter((s) => s.specs[0].home === pad.posts[0])).toHaveLength(1);
  });
  test('every post of a turf lost and you by its middle: its reinforcement comes from out past you, never waits for ever', () => {
    const d = createDirector({ turfs, effects: F, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    for (let i = 0; i < pad.posts.length; i++) population.dead.add(`pad:p${i}:0`).add(`pad:p${i}:1`);
    const you = { x: pad.at[0] + 10, z: pad.at[1] };
    run(d, REINFORCE * 3, { you, population });
    const sent = population.sent.filter((s) => s.specs[0].home === pad.posts[0]);
    expect(sent).toHaveLength(1);
    const from = sent[0].specs[0].at;
    expect(Math.hypot(from[0] - you.x, from[1] - you.z)).toBeGreaterThanOrEqual(60);
  });
  test('seen on an enemy-held world: a hunt, then calm once nobody has had you for a while', () => {
    const hostile = { ...F, side: 'rebel', front: false };
    const d = createDirector({ turfs: turfsOf(SITE, hostile, kit), effects: hostile, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    const beat = [[10, 10], [20, 10]];
    population.soldiers = new Map([['p', { id: 'p', side: 'empire', role: 'patrol', alive: true, beat, b: { x: 10, z: 10 } }]]);
    const you = { x: 30, z: 30 };
    const hunt = run(d, 1, { you, population, seen: true });
    expect(hunt.find((e) => e.type === 'hunt')).toBeTruthy();
    expect(population.soldiers.get('p').beat).toEqual([[30, 30]]);
    const calm = run(d, CALM + 1, { you, population, seen: false });
    expect(calm.find((e) => e.type === 'calm')).toBeTruthy();
    expect(population.soldiers.get('p').beat).toBe(beat);
  });
  test('a near miss on you starts no hunt', () => {
    const hostile = { ...F, side: 'rebel', front: false };
    const d = createDirector({ turfs: turfsOf(SITE, hostile, kit), effects: hostile, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    population.soldiers = new Map([['p', { id: 'p', side: 'empire', role: 'patrol', alive: true, beat: [[0, 0]], b: { x: 0, z: 0 } }]]);
    const events = run(d, 5, { you: { x: 5, z: 5 }, population, seen: false, bolts: [{ type: 'near', target: 'you' }] });
    expect(events.filter((e) => e.type === 'hunt')).toHaveLength(0);
  });
  test('the toasts: a line at most every 12 s', () => {
    const d = createDirector({ turfs, effects: F, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    population.dead.add('pad:p0:0').add('pad:p0:1').add('pad:p1:0').add('pad:p1:1');
    const events = run(d, 1, { you: far, population });
    const lost = events.filter((e) => e.type === 'post-lost');
    expect(lost).toHaveLength(2);
    expect(lost.filter((e) => e.text)).toHaveLength(1);
    expect(lost[0].text).toMatch(/post/);
  });
});

describe('the director over water', () => {
  test('a raid staged across a channel puts nobody in the water', async () => {
    const { createPopulation } = await import('./population');
    const wet = ([x]) => !(x > 150 && x < 200);
    const pad = { id: 'pad', at: [0, 0], r: 90, holder: 'owner', side: 'empire', war: 'gcw', posts: [[26, 0], [-13, 22], [-13, -22]], beats: [] };
    const far = { id: 'far', at: [300, 0], r: 110, holder: 'other', side: 'rebel', war: 'gcw', posts: [[223, 0]], beats: [] };
    const effects = { ...F, control: 0.5 };
    const population = createPopulation({ site: SITE, turfs: [pad, far], effects, tier: 'high', seed: 3, rand: () => 0.5, standable: wet });
    const d = createDirector({ turfs: [pad, far], effects, tier: 'high', rand: () => 0.5 });
    const you = { x: 170, z: 0 };
    const made = [];
    const events = [];
    for (let t = 0; t < RAID * 2 + 5; t += 1) {
      made.push(...population.update({ x: you.x, z: you.z, heading: null }).make);
      events.push(...d.update(1, { you, population }));
    }
    expect(events.find((e) => e.type === 'raid')).toBeTruthy();
    const raiders = made.filter((s) => s.role === 'raid');
    expect(raiders.length).toBeGreaterThan(0);
    for (const s of raiders) expect(wet([s.b.x, s.b.z]), s.id).toBe(true);
  });
});

describe('the director over a long visit', () => {
  test('the patrols that met are forgotten after a while', () => {
    const d = createDirector({ turfs, effects: F, tier: 'high', rand: () => 0.5 });
    const population = popOf();
    for (let k = 0; k < 100; k++) {
      population.soldiers = new Map([
        [`a${k}`, { id: `a${k}`, squad: `A${k}`, side: 'empire', role: 'patrol', alive: true, b: { x: 0, z: 0 } }],
        [`b${k}`, { id: `b${k}`, squad: `B${k}`, side: 'rebel', role: 'patrol', alive: true, b: { x: 10, z: 0 } }],
      ]);
      d.update(10, { you: far, population });
    }
    expect(d.sizes().met).toBeLessThanOrEqual(10);
  });
});
