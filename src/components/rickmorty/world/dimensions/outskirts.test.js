import { describe, expect, it } from 'vitest';
import { LEVELS, loopProblems, outskirtsOf } from './outskirts';
import { E, N, place } from './place';

// an outdoor place to lay out round: row 0's spot, a person who stands, one
// who wanders, a spot, a solid
const outdoor = () =>
  place(0, {
    id: 'trial',
    name: 'A trial',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    people: [
      { id: 'stander', dx: -10, dz: -10, face: E },
      { id: 'walker', dx: 10, dz: 0, face: N, ai: { wander: [[10, 0], [20, 0], [20, -10]] } },
    ],
    spots: [{ id: 'thing', dx: 0, dz: -15, label: 'A thing', verb: 'Look', r: 1.6 }],
    solids: [{ id: 'crate', dx: -20, dz: 5, w: 2, d: 2 }],
  });
const room = () => place(1, { id: 'hall', name: 'A hall', kind: 'room', deep: 30, wide: 34, ceiling: 8, spots: [{ id: 'desk', dx: 0, dz: -8, label: 'The desk', verb: 'Look' }] });

const TRIS = { 'magdalian-a': 9400, 'plutonian-a': 9300, 'gearperson-a': 9200, 'zigerion': 9400, 'heister-a': 14400, meeseeks: 8300, cop: 3200, 'resortguest-a': 14400 };
const ring = (rows, h = [6, 14]) => ({ styles: ['block', 'tower'], rows, h });
const world = (over = {}) => ({
  edge: { kind: 'rail', h: 1.1 },
  ring: { n: ring(2), e: ring(2), s: ring(1), w: ring(2) },
  far: { n: { styles: ['tower'], h: [40, 80] }, e: { styles: ['tower'], h: [40, 80] }, s: { styles: ['tower'], h: [40, 80] }, w: { styles: ['tower'], h: [40, 80] } },
  vista: 0.26,
  hero: [0, -20],
  crowd: {
    walk: [
      { kinds: ['magdalian-a', 'plutonian-a'], n: { high: 10, mid: 6, low: 3 }, loop: 'street', speed: 1.2 },
      { kinds: ['gearperson-a'], n: { high: 4, mid: 3, low: 1 }, loop: [[-25, 15], [-5, 15], [-5, 20], [-25, 20]], speed: 1 },
    ],
    gather: [{ kinds: ['zigerion', 'heister-a'], n: { high: 12, mid: 8, low: 4 }, at: [0, -38], r: 5, face: 'hero' }],
  },
  fliers: [{ model: 'fedship', n: { high: 3, mid: 2, low: 1 }, y: [40, 70], speed: 18 }],
  ...over,
});
const FOG = 300;
const lay = (d, w, tier = 'high', fogFar = FOG) => outskirtsOf(d, w, { tier, fogFar, tris: TRIS });

// how far a lot's footprint (turned by a quarter turn, or none) stands outside the box
function outside(A, l) {
  const across = Math.abs(Math.sin(l.turn)) > 0.5;
  const hw = (across ? l.d : l.w) / 2;
  const hd = (across ? l.w : l.d) / 2;
  const dx = Math.max(A.x0 - (l.x + hw), l.x - hw - A.x1, 0);
  const dz = Math.max(A.z0 - (l.z + hd), l.z - hd - A.z1, 0);
  return Math.hypot(dx, dz);
}
// the angle off north from the way in to a point
const offNorth = (d, x, z) => Math.abs(Math.atan2(x - d.arrive.x, -(z - d.arrive.z)));

describe('the outskirts of an outdoor place', () => {
  it('lays the ring of buildings from 8 m past the edge, and nothing over 1.4 m within 7 m of it', () => {
    const d = outdoor();
    const L = lay(d, world());
    expect(L.lots.length).toBeGreaterThan(0);
    for (const l of L.lots) expect(outside(d.area, l), `${l.side} ${l.row}`).toBeGreaterThanOrEqual(8 - 1e-9);
    const rocks = lay(d, world({ edge: { kind: 'rocks', h: 0.9 } })).props;
    expect(rocks.length).toBeGreaterThan(0);
    for (const p of rocks) if (outside(d.area, { ...p, w: 0, d: 0, turn: 0 }) > 0) expect(p.h).toBeLessThanOrEqual(1.4);
  });

  it('turns every building to face in, and steps each row up behind the one before', () => {
    const d = outdoor();
    const L = lay(d, world());
    const facing = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 };
    for (const l of L.lots) expect(l.turn).toBeCloseTo(facing[l.side], 9);
    const north = L.lots.filter((l) => l.side === 'n');
    const y0 = Math.max(...north.filter((l) => l.row === 0).map((l) => l.y));
    const y1 = Math.min(...north.filter((l) => l.row === 1).map((l) => l.y));
    expect(y1).toBeGreaterThan(y0);
  });

  it('keeps the vista open: nothing in the ring or the skyline within its angle of north from the way in', () => {
    const d = outdoor();
    const L = lay(d, world());
    for (const l of [...L.lots, ...L.skyline]) expect(offNorth(d, l.x, l.z)).toBeGreaterThanOrEqual(0.26);
  });

  it('stands the skyline from 100 m to 0.8 of the fog’s far edge, each tower 2.5 times the ring’s tallest at least', () => {
    const d = outdoor();
    const L = lay(d, world());
    expect(L.skyline.length).toBeGreaterThan(0);
    const tallest = Math.max(...L.lots.map((l) => l.h + l.y));
    for (const s of L.skyline) {
      const r = Math.hypot(s.x - d.centre.x, s.z - d.centre.z);
      expect(r).toBeGreaterThanOrEqual(100);
      expect(r).toBeLessThanOrEqual(0.8 * FOG);
      expect(s.h).toBeGreaterThanOrEqual(2.5 * tallest - 1e-9);
    }
  });

  it('lays a forecourt: a path from the way in to the hero, and low props along it clear of everything', () => {
    const d = outdoor();
    const L = lay(d, world({ forecourt: { path: { w: 3 }, props: [{ model: 'quaternius:Rock_Medium_1', h: 0.7, n: 6 }, { model: 'quaternius:Streetlight_Single', h: 5.6, n: 4 }] } }));
    expect(L.path.pts[0]).toEqual([d.arrive.x, d.arrive.z - 1]);
    expect(L.path.pts[1]).toEqual([d.centre.x, d.centre.z - 20]);
    const inside = L.props.filter((p) => !p.edge);
    expect(inside.length).toBeGreaterThan(4);
    for (const p of inside) {
      // (low enough to see over, so a prop in the box is never in the camera's way)
      expect(p.h).toBeLessThanOrEqual(1.2);
      expect(Math.hypot(p.x - d.arrive.x, p.z - d.arrive.z)).toBeGreaterThanOrEqual(1.5);
      for (const s of d.hotspots) expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeGreaterThanOrEqual(s.r);
      for (const q of d.people) expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(1);
    }
    // a room has no forecourt
    expect(lay(room(), world({ forecourt: { path: { w: 3 }, props: [{ model: 'x', n: 3 }] } })).path).toBeNull();
  });

  it('runs the ground out past the fog', () => {
    expect(lay(outdoor(), world()).reach).toBe(FOG + 20);
    expect(lay(outdoor(), world(), 'high', 240).reach).toBe(260);
  });

  it('draws the edge all the way round with no gap, a run along each side', () => {
    const d = outdoor();
    const L = lay(d, world());
    const A = d.area;
    const along = { n: 0, s: 0, e: 0, w: 0 };
    for (const r of L.edge) {
      expect(r.h).toBeLessThanOrEqual(1.4);
      if (r.z0 === A.z0 && r.z1 === A.z0) along.n += Math.abs(r.x1 - r.x0);
      if (r.z0 === A.z1 && r.z1 === A.z1) along.s += Math.abs(r.x1 - r.x0);
      if (r.x0 === A.x1 && r.x1 === A.x1) along.e += Math.abs(r.z1 - r.z0);
      if (r.x0 === A.x0 && r.x1 === A.x0) along.w += Math.abs(r.z1 - r.z0);
    }
    expect(along).toEqual({ n: 70, s: 70, e: 50, w: 50 });
  });

  it('keeps a solid edge low and a see-through one under the camera', () => {
    const d = outdoor();
    expect(Math.max(...lay(d, world({ edge: { kind: 'wall', h: 2 } })).edge.map((r) => r.h))).toBe(0.9);
    expect(Math.max(...lay(d, world({ edge: { kind: 'fence', h: 3 } })).edge.map((r) => r.h))).toBe(1.4);
  });

  it('sets a rocky or bushy edge as clusters every few metres round the box, corners and all', () => {
    const d = outdoor();
    const L = lay(d, world({ edge: { kind: 'rocks', models: ['quaternius:Rock_Medium_1'] } }));
    expect(L.edge).toEqual([]);
    const rocks = L.props.filter((p) => p.edge);
    const A = d.area;
    // every metre of the perimeter has a cluster within 3 m
    for (let x = A.x0; x <= A.x1; x += 1) for (const z of [A.z0, A.z1]) expect(Math.min(...rocks.map((r) => Math.hypot(r.x - x, r.z - z)))).toBeLessThan(5);
    for (let z = A.z0; z <= A.z1; z += 1) for (const x of [A.x0, A.x1]) expect(Math.min(...rocks.map((r) => Math.hypot(r.x - x, r.z - z)))).toBeLessThan(5);
    // and none inside the box
    for (const r of rocks) expect(r.x <= A.x0 || r.x >= A.x1 || r.z <= A.z0 || r.z >= A.z1).toBe(true);
  });

  it('leaves a side with no ring or skyline empty', () => {
    const d = outdoor();
    const L = lay(d, world({ ring: { n: null, e: ring(2), s: null, w: ring(2) }, far: { n: null, e: { styles: ['tower'], h: [40, 80] }, s: null, w: null } }));
    expect(L.lots.some((l) => l.side === 'n' || l.side === 's')).toBe(false);
    for (const s of L.skyline) expect(s.x).toBeGreaterThan(d.centre.x);
  });

  it('stands a place’s own set piece at most twice, 40 m apart, in the first row, and none on low', () => {
    const d = outdoor();
    const w = world({ ring: { n: { ...ring(2), sets: [{ model: '/models/c137/rm/purgecottage.glb', h: 7, n: 3 }] }, e: ring(2), s: ring(1), w: ring(2) } });
    const sets = lay(d, w).lots.filter((l) => l.model);
    expect(sets.length).toBe(2);
    for (const s of sets) expect(s.row).toBe(0);
    expect(Math.hypot(sets[0].x - sets[1].x, sets[0].z - sets[1].z)).toBeGreaterThanOrEqual(40);
    expect(lay(d, w, 'low').lots.some((l) => l.model)).toBe(false);
  });

  it('counts what it lays by the level: lots, skyline, traffic and the crowd’s triangles and kinds', () => {
    const d = outdoor();
    for (const tier of ['high', 'mid', 'low']) {
      const L = lay(d, world(), tier);
      const row = LEVELS[tier];
      expect(L.lots.length).toBeLessThanOrEqual(row.near);
      expect(L.skyline.length).toBeLessThanOrEqual(row.far);
      expect(L.lanes.reduce((a, l) => a + l.n, 0)).toBeLessThanOrEqual(row.traffic);
      const crowd = [...L.walkers, ...L.gathers];
      const tris = crowd.reduce((a, c) => a + c.n * Math.max(...c.kinds.map((k) => TRIS[k])), 0);
      expect(tris, tier).toBeLessThanOrEqual(row.crowd);
      expect(new Set(crowd.flatMap((c) => c.kinds)).size).toBeLessThanOrEqual(row.kinds);
    }
    // more on a stronger device
    expect(lay(d, world(), 'high').lots.length).toBeGreaterThan(lay(d, world(), 'low').lots.length);
  });

  it('lays a place the same every time', () => {
    expect(lay(outdoor(), world())).toEqual(lay(outdoor(), world()));
  });

  it('walks the street walkers in the strip between the edge and the first row', () => {
    const d = outdoor();
    const L = lay(d, world());
    const street = L.walkers.find((w) => w.kinds.includes('magdalian-a'));
    for (const [x, z] of street.loop) {
      const gap = outside(d.area, { x, z, w: 0, d: 0, turn: 0 });
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeLessThanOrEqual(6);
    }
  });

  it('turns a gathering to the hero, and holds every pose of the crowd in its extent', () => {
    const d = outdoor();
    const L = lay(d, world());
    const g = L.gathers[0];
    expect(g.face).toEqual([d.centre.x, d.centre.z - 20]);
    for (const c of [...L.walkers, ...L.gathers]) {
      const e = L.extents[c.key];
      const pts = c.loop ?? [c.at];
      for (const [x, z] of pts) expect(Math.hypot(x - e.x, z - e.z) + (c.r ?? 0)).toBeLessThanOrEqual(e.r);
      expect(e.r).toBeGreaterThan(2);
    }
  });

  it('flies the traffic across the sky from out past the fog to out past it again, so it comes and goes unseen', () => {
    const d = outdoor();
    const L = lay(d, world());
    expect(L.lanes).toHaveLength(1);
    const l = L.lanes[0];
    expect(l.model).toBe('fedship');
    expect(l.y).toBeGreaterThanOrEqual(40);
    expect(l.y).toBeLessThanOrEqual(70);
    for (const [x, z] of [l.from, l.to]) expect(Math.hypot(x - d.centre.x, z - d.centre.z)).toBeGreaterThan(FOG);
    // straight across, through the place's sky
    expect(Math.hypot((l.from[0] + l.to[0]) / 2 - d.centre.x, (l.from[1] + l.to[1]) / 2 - d.centre.z)).toBeLessThan(1e-6);
  });
});

describe('a stand round a place', () => {
  const stand = { at: [55, 0], w: 30, d: 12, h: 6, rows: 3, face: [0, 0], kinds: ['zigerion'], n: { high: 30, mid: 18, low: 6 } };
  it('is a lot of seats facing what it watches, its people in rows up its steps', () => {
    const d = outdoor();
    const L = lay(d, world({ stands: [stand] }));
    const seats = L.lots.filter((l) => l.style === 'stand');
    expect(seats).toHaveLength(1);
    const s = seats[0];
    expect(s).toMatchObject({ x: d.centre.x + 55, z: d.centre.z, w: 30, d: 12, h: 6, steps: 3, y: 0 });
    // (facing west, back at the box)
    expect(s.turn).toBeCloseTo(-Math.PI / 2, 9);
    const rows = L.gathers.filter((g) => g.key.startsWith('stand-0'));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.y)).toEqual([2, 4, 6]);
    // each row further back than the one before, along the stand, inside it
    expect(rows[0].at[0]).toBeLessThan(rows[1].at[0]);
    for (const r of rows) {
      expect(r.row).toBeGreaterThan(20);
      expect(Math.abs(r.at[0] - s.x)).toBeLessThanOrEqual(6);
      expect(r.face).toEqual([d.centre.x, d.centre.z]);
    }
    expect(rows.reduce((a, r) => a + r.n, 0)).toBeLessThanOrEqual(30);
  });
  it('takes its people from the crowd’s allowance, with the rest', () => {
    const d = outdoor();
    for (const tier of ['high', 'mid', 'low']) {
      const L = lay(d, world({ stands: [{ ...stand, n: { high: 90, mid: 90, low: 90 } }] }), tier);
      const tris = [...L.walkers, ...L.gathers].reduce((a, c) => a + c.n * Math.max(...c.kinds.map((k) => TRIS[k])), 0);
      expect(tris).toBeLessThanOrEqual(LEVELS[tier].crowd);
    }
  });
  it('keeps a gathering’s height, its row, and its beat', () => {
    const d = outdoor();
    const L = lay(d, world({ crowd: { gather: [{ kinds: ['zigerion'], n: { high: 6 }, at: [0, -38], row: 8, y: 3.2, beat: 1.2, face: 'hero' }] } }));
    expect(L.gathers[0]).toMatchObject({ y: 3.2, row: 8, beat: 1.2 });
  });
});

describe('a landmark and a scatter round a place', () => {
  it('stands a landmark where the record says, facing the place, whatever the vista or the level', () => {
    const d = outdoor();
    for (const tier of ['high', 'low']) {
      const L = lay(d, world({ landmarks: [{ at: [0, -60], style: 'hut', w: 20, d: 14, h: 12 }] }), tier);
      const m = L.lots.filter((l) => l.landmark);
      expect(m).toHaveLength(1);
      expect(m[0]).toMatchObject({ style: 'hut', x: d.centre.x, z: d.centre.z - 60, w: 20, d: 14, h: 12, y: 0 });
      expect(m[0].turn).toBeCloseTo(0, 9);
    }
  });
  it('scatters its models out round the place, as many as the level says, clear of the box and the buildings', () => {
    const d = outdoor();
    const w = world({ scatter: [{ model: 'q:CommonTree_3', h: 9.4, n: { high: 30, mid: 15, low: 6 }, r: [20, 130] }] });
    for (const [tier, n] of [['high', 30], ['mid', 15], ['low', 6]]) {
      const L = lay(d, w, tier);
      const trees = L.props.filter((p) => p.model === 'q:CommonTree_3');
      expect(trees, tier).toHaveLength(n);
      for (const t of trees) {
        expect(outside(d.area, { ...t, w: 0, d: 0, turn: 0 })).toBeGreaterThanOrEqual(8);
        expect(Math.hypot(t.x - d.centre.x, t.z - d.centre.z)).toBeLessThanOrEqual(130);
        expect(t.h).toBe(9.4);
        for (const l of L.lots) {
          const across = Math.abs(Math.sin(l.turn)) > 0.5;
          const inX = Math.abs(t.x - l.x) < (across ? l.d : l.w) / 2 + 1;
          const inZ = Math.abs(t.z - l.z) < (across ? l.w : l.d) / 2 + 1;
          expect(inX && inZ).toBe(false);
        }
      }
    }
  });
});

describe('the outskirts of a room', () => {
  const w = world({ edge: null, outside: 'ground', windows: [{ wall: 'n', from: -10, to: 10, y0: 1, h: 4 }] });
  it('has no edge (its walls are its edge), and its buildings stand outside its walls', () => {
    const d = room();
    const L = lay(d, w);
    expect(L.edge).toEqual([]);
    for (const l of L.lots) expect(outside(d.area, l)).toBeGreaterThanOrEqual(8 - 1e-9);
  });
  it('takes half a place’s crowd allowance and traffic, and on low none outside', () => {
    const d = room();
    const tris = (x) => [...x.walkers, ...x.gathers].reduce((a, c) => a + c.n * Math.max(...c.kinds.map((k) => TRIS[k])), 0);
    for (const tier of ['high', 'mid', 'low']) expect(tris(lay(d, w, tier)), tier).toBeLessThanOrEqual(LEVELS[tier].crowd / 2);
    // (a queue inside it keeps its heads where they fit)
    const queue = world({ crowd: { gather: [{ kinds: ['zigerion'], n: { high: 12, mid: 8, low: 4 }, at: [-10, 5], r: 3 }] } });
    expect(lay(d, { ...queue, outside: 'ground' }).gathers[0].n).toBe(12);
    const low = lay(d, w, 'low');
    expect(low.lanes).toEqual([]);
    expect(low.walkers.filter((c) => c.loop === 'street' || c.out).length).toBe(0);
  });
  it('looking out on space has no buildings and no skyline, only traffic', () => {
    const L = lay(room(), { ...w, outside: 'space' });
    expect(L.lots).toEqual([]);
    expect(L.skyline).toEqual([]);
    expect(L.lanes.length).toBe(1);
  });
  it('with no outside lays nothing outside', () => {
    const L = lay(room(), { ...w, outside: null, windows: [] });
    expect(L.lots).toEqual([]);
    expect(L.skyline).toEqual([]);
    expect(L.lanes).toEqual([]);
  });
});

describe('a walker’s loop in the box', () => {
  it('is clear when it keeps off everything', () => {
    expect(loopProblems(outdoor(), [[-25, 15], [-5, 15], [-5, 20], [-25, 20]])).toEqual([]);
  });
  it('keeps 1 m off solids, people and their ways round, and 2 m off spots, the way in and the portal', () => {
    const d = outdoor();
    expect(loopProblems(d, [[-25, 5], [-15, 5]])).toEqual([expect.stringMatching(/crate/)]);
    expect(loopProblems(d, [[-15, -10], [-5, -10]])).toEqual([expect.stringMatching(/stander/)]);
    expect(loopProblems(d, [[15, 5], [15, -15]])).toEqual([expect.stringMatching(/walker/)]);
    expect(loopProblems(d, [[-5, -15], [5, -15]])).toEqual([expect.stringMatching(/thing/)]);
    const inZ = d.arrive.z - d.centre.z;
    expect(loopProblems(d, [[-5, inZ], [5, inZ]])).toEqual(expect.arrayContaining([expect.stringMatching(/way in/)]));
  });
  it('stays inside the box', () => {
    expect(loopProblems(outdoor(), [[-25, 15], [-40, 15]])).toEqual([expect.stringMatching(/outside/)]);
  });
});
