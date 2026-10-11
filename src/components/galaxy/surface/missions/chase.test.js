import { describe, expect, it } from 'vitest';
import { createSolids } from '../walker';
import { aimAssist, chaseView, clockOf, firstSolid, hitScout, knockYou, laneHits, newChase, planRoute, scoutAt, starsFor, stepChase } from './chase';

const none = createSolids();

describe('the chase: its route', () => {
  it('runs the waypoints, measured along the way', () => {
    const route = planRoute([[0, 0], [100, 0]], none);
    expect(route.len).toBeCloseTo(100, 0);
    const mid = route.at(route.len / 2);
    expect(mid.x).toBeCloseTo(50, 0);
    expect(mid.z).toBeCloseTo(0, 1);
    expect(Math.hypot(mid.tx, mid.tz)).toBeCloseTo(1, 5);
    expect(mid.tx).toBeCloseTo(1, 3);
  });

  it('keeps clear of a trunk standing on the line', () => {
    const solids = createSolids();
    solids.circle(50, 0, 2);
    const route = planRoute([[0, 0], [100, 0]], solids);
    for (const [x, z] of route.pts) expect(Math.hypot(x - 50, z)).toBeGreaterThanOrEqual(2 + 2.8 - 0.05);
  });

  it('keeps clear even when a waypoint is inside a trunk', () => {
    const solids = createSolids();
    solids.circle(60, 40, 2.5);
    const route = planRoute([[0, 0], [60, 40], [120, 0]], solids);
    for (const [x, z] of route.pts) expect(Math.hypot(x - 60, z - 40)).toBeGreaterThanOrEqual(2.5 + 2.8 - 0.05);
  });

  it('starts and ends where it was asked to', () => {
    const route = planRoute([[3, 4], [40, -20], [90, 10]], none);
    expect(route.pts[0]).toEqual([3, 4]);
    expect(route.pts[route.pts.length - 1]).toEqual([90, 10]);
  });

  it('keeps every scout’s lane clear through a dense forest', () => {
    // a forest as thick as Endor's and more: a trunk every 20 m or so
    const solids = createSolids();
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 700; i++) solids.circle(rand() * 600 - 300, rand() * 600 - 300, 1 + rand() * 1.6);
    const route = planRoute([[-280, -250], [-100, 60], [120, -40], [270, 260]], solids);
    expect(laneHits(route, [-1.3, 1.1, -0.4, 0.8], solids)).toBe(0);
  });

  it('finds how far along it a point beside it is', () => {
    const route = planRoute([[0, 0], [100, 0]], none);
    expect(route.project(37, 6)).toBeGreaterThan(37 - 4);
    expect(route.project(37, 6)).toBeLessThan(37 + 4);
    expect(route.project(-20, 0)).toBe(0);
    expect(route.project(130, 0)).toBeCloseTo(route.len, 5);
  });
});


const MISSION = { scouts: 4, gaps: [34, 48, 62, 76], lanes: [-1.3, 1.1, -0.4, 0.8], speeds: [31, 32.5, 30, 33.5], hp: 3, stars: [45, 60] };
const far = { x: -500, z: 0, vx: 0, vz: 0 }; // you, well out of it
const run = (c, secs, opts = { you: far }, dt = 0.05) => {
  const out = [];
  for (let i = 0; i < Math.round(secs / dt); i++) out.push(...stepChase(c, dt, opts));
  return out;
};
const started = (route, mission = MISSION) => {
  const c = newChase(mission, route);
  run(c, 3.05);
  return c;
};

describe('the chase: the scouts and how it ends', () => {
  const long = planRoute([[0, 0], [2000, 0]], none);

  it('counts down from three, then goes, and nobody moves before it does', () => {
    const c = newChase(MISSION, long);
    expect(c.phase).toBe('count');
    const at = c.scouts.map((s) => s.s);
    const evs = run(c, 3.05);
    expect(evs.filter((e) => e.type === 'count' || e.type === 'go')).toEqual([{ type: 'count', n: 2 }, { type: 'count', n: 1 }, { type: 'go' }]);
    expect(c.phase).toBe('run');
    expect(c.scouts.map((s) => s.s)).toEqual(at);
  });

  it('sends the scouts off along the route at their own speeds', () => {
    const c = started(long);
    const was = c.scouts.map((s) => s.s);
    run(c, 1);
    c.scouts.forEach((s, i) => expect(s.s - was[i]).toBeCloseTo(MISSION.speeds[i], 0));
  });

  it('loses when a scout reaches the end of the route, and then stops', () => {
    const c = started(planRoute([[0, 0], [200, 0]], none));
    const evs = run(c, 8);
    const end = evs.filter((e) => e.type === 'escaped' || e.type === 'lost');
    expect(end.map((e) => e.type)).toEqual(['escaped', 'lost']);
    expect(c.phase).toBe('lost');
    expect(run(c, 1)).toEqual([]);
  });

  it('brings down a scout shoved off its line into a tree', () => {
    const solids = createSolids();
    solids.circle(150, 4.4, 1.5);
    const route = planRoute([[0, 0], [400, 0]], solids);
    const c = started(route, { ...MISSION, scouts: 1, gaps: [100], lanes: [0.6], speeds: [30] });
    run(c, 1.2, { you: far, solids });
    c.scouts[0].vOff = 14; // as a hard shove would
    const evs = run(c, 1.5, { you: far, solids });
    expect(evs).toContainEqual({ type: 'down', id: 0, how: 'tree' });
    expect(evs).toContainEqual({ type: 'won' });
  });

  it('never brings down a scout riding its own line, even brushing bark', () => {
    const solids = createSolids();
    const route = planRoute([[0, 0], [400, 0]], createSolids());
    solids.circle(150, 2.2, 1.5); // put there after the route was planned: it overlaps the lane
    const c = started(route, { ...MISSION, scouts: 1, gaps: [100], lanes: [0.6], speeds: [30] });
    const evs = run(c, 3, { you: far, solids });
    expect(evs.filter((e) => e.type === 'down')).toEqual([]);
  });

  it('leaves a downed scout heading the way it was going', () => {
    const route = planRoute([[0, 0], [0, 500]], none); // due +z: heading 0
    const c = started(route, { ...MISSION, scouts: 1, gaps: [100], lanes: [0], speeds: [30] });
    for (let k = 0; k < 3; k++) hitScout(c, 0);
    expect(c.scouts[0].down).toBe(true);
    expect(scoutAt(c, 0).yaw).toBeCloseTo(0, 5);
    const east = started(planRoute([[0, 0], [500, 0]], none), { ...MISSION, scouts: 1, gaps: [100], lanes: [0], speeds: [30] });
    for (let k = 0; k < 3; k++) hitScout(east, 0);
    expect(scoutAt(east, 0).yaw).toBeCloseTo(Math.PI / 2, 5);
  });

  it('takes three hits to bring one down, and a fourth does nothing', () => {
    const c = started(long);
    expect(hitScout(c, 0)).toEqual([]);
    expect(hitScout(c, 0)).toEqual([]);
    expect(hitScout(c, 0)).toEqual([{ type: 'down', id: 0, how: 'shot' }]);
    expect(hitScout(c, 0)).toEqual([]);
    expect(chaseView(c).left).toBe(3);
  });

  it('wins once, when the last one is down', () => {
    const c = started(long);
    const evs = [];
    for (const s of c.scouts) for (let k = 0; k < 3; k++) evs.push(...hitScout(c, s.id));
    expect(evs.filter((e) => e.type === 'won')).toHaveLength(1);
    expect(c.phase).toBe('won');
    expect(run(c, 1)).toEqual([]);
  });

  it('keeps them going when you overtake them', () => {
    const c = started(long);
    const was = c.scouts[0].s;
    run(c, 1, { you: { x: was + 300, z: 0, vx: 50, vz: 0 } });
    expect(c.scouts[0].s - was).toBeGreaterThan(MISSION.speeds[0]);
  });

  it('eases off when you have fallen far behind', () => {
    const c = started(long);
    run(c, 10);
    const was = c.scouts[0].s;
    run(c, 1, { you: { x: was - 300, z: 0, vx: 0, vz: 0 } });
    expect(c.scouts[0].s - was).toBeLessThan(MISSION.speeds[0]);
  });

  it('comes out the same from one long frame as from many short ones', () => {
    const a = started(long);
    const b = started(long);
    stepChase(a, 1, { you: far });
    run(b, 1);
    a.scouts.forEach((s, i) => {
      expect(Number.isFinite(s.s)).toBe(true);
      expect(s.s).toBeCloseTo(b.scouts[i].s, 6);
      expect(s.off).toBeCloseTo(b.scouts[i].off, 6);
    });
  });

  it('starts every chase afresh', () => {
    const a = newChase(MISSION, long);
    const b = newChase(MISSION, long);
    a.scouts[0].hp = 0;
    a.scouts[0].lane = 9;
    expect(b.scouts[0].hp).toBe(3);
    expect(b.scouts[0].lane).toBe(-1.3);
    expect(MISSION.lanes[0]).toBe(-1.3);
  });

  it('shoves a scout you ride into, and pushes you back', () => {
    const c = started(long, { ...MISSION, scouts: 1, gaps: [100], lanes: [0], speeds: [30] });
    const p = scoutAt(c, 0);
    const you = { x: p.x, z: p.z - 1.0, vx: 30, vz: 8 }; // alongside, on its left (it's heading +x), steering into it
    const evs = stepChase(c, 0.02, { you });
    const bump = evs.find((e) => e.type === 'bump');
    expect(bump?.id).toBe(0);
    expect(bump.push[1]).toBeLessThan(0);
    expect(c.scouts[0].vOff).toBeGreaterThan(5);
  });

  it('has a scout fire back when you’re on its tail, not from far off', () => {
    const near = started(long, { ...MISSION, scouts: 1, gaps: [100], lanes: [0], speeds: [30] });
    const shots = [];
    for (let i = 0; i < 60; i++) shots.push(...stepChase(near, 0.05, { you: { x: near.scouts[0].s - 30, z: 0, vx: 30, vz: 0 } }));
    expect(shots.some((e) => e.type === 'shoot' && e.id === 0)).toBe(true);
    const away = started(long, { ...MISSION, scouts: 1, gaps: [100], lanes: [0], speeds: [30] });
    const none2 = [];
    for (let i = 0; i < 60; i++) none2.push(...stepChase(away, 0.05, { you: { x: away.scouts[0].s - 100, z: 0, vx: 30, vz: 0 } }));
    expect(none2.some((e) => e.type === 'shoot')).toBe(false);
  });

  it('holds you a moment after a crash', () => {
    const c = started(long);
    knockYou(c);
    expect(c.stall).toBeCloseTo(1.6, 5);
    run(c, 2);
    expect(c.stall).toBe(0);
  });

  it('says how far the leading scout has to go', () => {
    const c = started(planRoute([[0, 0], [1000, 0]], none));
    const v = chaseView(c);
    expect(v).toMatchObject({ phase: 'run', left: 4, total: 4 });
    expect(v.lead).toBeCloseTo(76 / 1000, 2);
  });
});

describe('the chase: aiming and scoring', () => {
  const targets = [{ x: 3, y: 0, z: 40 }, { x: -1, y: 0, z: 40 }, { x: 30, y: 0, z: 30 }];
  it('turns a shot onto the target nearest the line of fire', () => {
    const d = aimAssist([0, 0, 0], [0, 0, 1], targets);
    const l = Math.hypot(-1, 40);
    expect(d[0]).toBeCloseTo(-1 / l, 5);
    expect(d[2]).toBeCloseTo(40 / l, 5);
  });
  it('leaves it alone outside the cone, out of range or behind', () => {
    expect(aimAssist([0, 0, 0], [0, 0, 1], [{ x: 30, y: 0, z: 30 }])).toBeNull();
    expect(aimAssist([0, 0, 0], [0, 0, 1], [{ x: 0, y: 0, z: 120 }])).toBeNull();
    expect(aimAssist([0, 0, 0], [0, 0, 1], [{ x: 0, y: 0, z: -10 }])).toBeNull();
  });
  it('stops a shot at the first trunk in its way', () => {
    const solids = createSolids();
    solids.circle(30, 0, 2);
    solids.circle(60, 0, 2);
    expect(firstSolid(0, 0, 1, 0, solids, 90)).toBeCloseTo(28, 5);
    expect(firstSolid(0, 5, 1, 0, solids, 90)).toBeNull();
    expect(firstSolid(0, 0, -1, 0, solids, 90)).toBeNull();
    expect(firstSolid(0, 0, 1, 0, solids, 20)).toBeNull();
  });
  it('reads the clock in minutes and tenths, never 60 seconds', () => {
    expect(clockOf(0)).toBe('0:00.0');
    expect(clockOf(9.04)).toBe('0:09.0');
    expect(clockOf(59.96)).toBe('1:00.0');
    expect(clockOf(75.25)).toBe('1:15.3');
  });
  it('gives stars by the time it took', () => {
    expect(starsFor(MISSION, 40)).toBe(3);
    expect(starsFor(MISSION, 50)).toBe(2);
    expect(starsFor(MISSION, 70)).toBe(1);
  });
});

describe('the missions on the surface', () => {
  // (every chase laid out and its scouts placed: 5.0–6.1 s in a loaded cloud
  // container, over vitest’s 5 s, so the allowance says so rather than the
  // test being quieted)
  it('gives every chase’s scouts a gap, a lane and a speed', { timeout: 30_000 }, async () => {
    const { MISSIONS } = await import('./index');
    for (const [system, list] of Object.entries(MISSIONS))
      for (const m of Object.values(list)) {
        expect(m.system).toBe(system);
        if (m.kind !== 'chase') continue;
        for (const k of ['gaps', 'lanes', 'speeds']) expect(m[k], `${m.id} ${k}`).toHaveLength(m.scouts);
        expect(m.waypoints.length).toBeGreaterThanOrEqual(2);
        expect(m.stars[0]).toBeLessThan(m.stars[1]);
      }
    // (the first test here pays the missions index's import, 7.5 to 7.8 s in a
    // cloud container, over vitest's 5 s: given 30 s as the flight island's test is)
  }, 30000);
  it('only puts a mission on a world you can land on', async () => {
    const { MISSIONS } = await import('./index');
    const { siteOf } = await import('../sites');
    for (const system of Object.keys(MISSIONS)) expect(siteOf(system), system).toBeTruthy();
  });
  it('finds a mission by its world and id, and nothing else', async () => {
    const { missionOf } = await import('./index');
    expect(missionOf('endor', 'chase')?.kind).toBe('chase');
    expect(missionOf('endor', 'nope')).toBeNull();
    expect(missionOf('hoth', 'chase')).toBeNull();
    expect(missionOf(undefined, undefined)).toBeNull();
  });
  it('has the Endor chase run from the scouts’ camp to the bunker, a good way round', async () => {
    const { missionOf } = await import('./index');
    const m = missionOf('endor', 'chase');
    const route = planRoute(m.waypoints, none);
    expect(route.len).toBeGreaterThan(1000);
    expect(route.pts[0]).toEqual([60, 250]);
  });
});
