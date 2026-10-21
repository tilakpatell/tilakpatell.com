import { describe, expect, it } from 'vitest';
import { blocksSight, worldProblems } from './worldRules';
import { E, N, S, place } from './place';

// a place with a hunter, a lookout and a named person, a spot, and a block
const fixture = () =>
  place(0, {
    id: 'trial',
    name: 'A trial',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    people: [{ id: 'boss', who: 'gearhead', dx: 0, dz: -15, face: S }],
    extras: [
      { kind: 'gromflomite', dx: 10, dz: -10, face: N, ai: { hunt: { speed: 3, catchR: 1 } } },
      { kind: 'magdalian-a', dx: -10, dz: -10, face: N, ai: { lookout: true } },
      { kind: 'plutonian-a', dx: -20, dz: 0, face: E },
    ],
    spots: [{ id: 'thing', dx: 0, dz: -12, label: 'A thing', verb: 'Look' }],
  });
const room = () => place(1, { id: 'hall', name: 'A hall', kind: 'room', deep: 30, wide: 34, ceiling: 8 });
// (each light: the heavy rule, a heavy kind at most twice, has a test of its own)
const TRIS = { 'zigerion': 9377, 'gearperson-b': 9227, 'gromflomite': 8356, 'magdalian-a': 9382, 'gearhead': 9000, 'crowd:cop': 3208 };
const opts = { tris: TRIS, tasks: ['squanch', 'wedding'], blocks: [{ id: 'pen', dx: -20, dz: 15, w: 6, d: 4, h: 1 }] };
const ok = { look: {}, crowd: { walk: [{ kinds: ['zigerion'], n: { high: 4, mid: 2, low: 1 }, loop: [[-25, 15], [-5, 15], [-5, 20], [-25, 20]] }] } };
const problems = (w, d = fixture()) => worldProblems(d, w, opts);

describe('a world record’s rules', () => {
  it('passes a record that keeps them', () => {
    expect(problems(ok)).toEqual([]);
  });

  it('knows every crowd kind: in the cast or one of the light copies, and counted', () => {
    expect(problems({ crowd: { walk: [{ ...ok.crowd.walk[0], kinds: ['nobody'] }] } })).toEqual([expect.stringMatching(/nobody/)]);
    expect(problems({ crowd: { walk: [{ ...ok.crowd.walk[0], kinds: ['zeep'] }] } })).toEqual([expect.stringMatching(/zeep.*triangles/)]);
  });

  it('puts no copy of a hunter, a lookout or a named person in the box', () => {
    for (const k of ['gromflomite', 'magdalian-a']) expect(problems({ crowd: { walk: [{ ...ok.crowd.walk[0], kinds: [k] }] } }), k).toEqual([expect.stringMatching(new RegExp(k))]);
    // a named person's kind gathered in the box
    expect(problems({ crowd: { gather: [{ kinds: ['gearhead'], n: { high: 2 }, at: [-20, 15], r: 1.5, block: 'pen' }] } })).toEqual([expect.stringMatching(/gearhead/)]);
  });

  it('lets a hunter’s kind stand 7 m beyond the edge, a named person’s 30 m, and not nearer', () => {
    const gather = (kinds, at) => ({ crowd: { gather: [{ kinds, n: { high: 4 }, at, r: 2 }] } });
    expect(problems(gather(['gromflomite'], [0, -25 - 10]))).toEqual([]);
    expect(problems(gather(['gromflomite'], [0, -25 - 4]))).toEqual([expect.stringMatching(/gromflomite/)]);
    // (the street's walkers go round 4 m out: too near for a hunter's kind)
    expect(problems({ crowd: { walk: [{ kinds: ['gromflomite'], n: { high: 4 }, loop: 'street' }] } })).toEqual([expect.stringMatching(/gromflomite/)]);
    expect(problems(gather(['gearhead'], [0, -25 - 32]))).toEqual([]);
    expect(problems(gather(['gearhead'], [0, -25 - 12]))).toEqual([expect.stringMatching(/gearhead/)]);
  });

  it('lets a room’s hunters’ kinds stand outside its walls, behind the glass', () => {
    const d = room();
    expect(worldProblems(d, { outside: 'ground', crowd: { gather: [{ kinds: ['gromflomite'], n: { high: 4 }, at: [0, -15 - 10], r: 2 }] } }, opts)).toEqual([]);
  });

  it('keeps a walker’s loop in the box off everything there', () => {
    expect(problems({ crowd: { walk: [{ kinds: ['zigerion'], n: { high: 2 }, loop: [[-5, -12], [5, -12]] }] } })).toEqual([expect.stringMatching(/thing/)]);
  });

  it('stands a gathering on its block, and only on a block that’s there', () => {
    const on = { crowd: { gather: [{ kinds: ['zigerion'], n: { high: 6 }, at: [-20, 15], r: 1.5, block: 'pen' }] } };
    expect(problems(on)).toEqual([]);
    expect(problems({ crowd: { gather: [{ ...on.crowd.gather[0], r: 4 }] } })).toEqual([expect.stringMatching(/off its block/)]);
    expect(problems({ crowd: { gather: [{ ...on.crowd.gather[0], block: 'nowhere' }] } })).toEqual([expect.stringMatching(/nowhere/)]);
    // a gathering in the box with no block: Morty would walk through people standing still
    expect(problems({ crowd: { gather: [{ ...on.crowd.gather[0], block: null }] } })).toEqual([expect.stringMatching(/block/)]);
  });

  it('stands a gathering on one of the place’s own solids too (a walkway, a stage)', () => {
    const d = place(0, { id: 'deck', name: 'A deck', kind: 'room', deep: 30, wide: 34, ceiling: 9, solids: [{ id: 'walkway', dx: 0, dz: -12, w: 30, d: 4 }] });
    const on = { crowd: { gather: [{ kinds: ['zigerion'], n: { high: 6 }, at: [0, -12], row: 20, y: 3.2, block: 'walkway' }] } };
    expect(worldProblems(d, on, opts)).toEqual([]);
    expect(worldProblems(d, { crowd: { gather: [{ ...on.crowd.gather[0], row: 34 }] } }, opts)).toEqual([expect.stringMatching(/off its block/)]);
  });

  it('stands the stands round an outdoor place beyond the edge', () => {
    const stand = { at: [55, 0], w: 30, d: 12, h: 6, rows: 3, face: [0, 0], kinds: ['zigerion'], n: { high: 10 } };
    expect(problems({ stands: [stand] })).toEqual([]);
    expect(problems({ stands: [{ ...stand, at: [44, 0] }] })).toEqual([expect.stringMatching(/stand/)]);
    expect(problems({ stands: [{ ...stand, kinds: ['gearhead'] }] })).toEqual([expect.stringMatching(/gearhead/)]);
  });

  it('stands a landmark beyond the edge, or outside a room’s walls', () => {
    const lm = { at: [0, -50], style: 'hut', w: 20, d: 14, h: 12 };
    expect(problems({ landmarks: [lm] })).toEqual([]);
    expect(problems({ landmarks: [{ ...lm, at: [0, -30] }] })).toEqual([expect.stringMatching(/landmark/)]);
    expect(problems({ landmarks: [{ ...lm, style: 'castle' }] })).toEqual([expect.stringMatching(/castle/)]);
    // (one high in the sky over the box is over everyone's head)
    expect(problems({ landmarks: [{ ...lm, at: [0, 0], y: 40 }] })).toEqual([]);
  });

  it('names only the kit’s models for its props, its scatter and its edge', () => {
    expect(problems({ scatter: [{ model: 'q:CommonTree_3', n: { high: 4 } }], forecourt: { props: [{ model: 'q:Rock_Medium_1', n: 2 }] }, edge: { kind: 'rocks', models: ['q:Rock_Medium_2'] } })).toEqual([]);
    expect(problems({ scatter: [{ model: 'q:Palm', n: { high: 4 } }] })).toEqual([expect.stringMatching(/Palm/)]);
    expect(problems({ edge: { kind: 'rocks', models: ['rock'] } })).toEqual([expect.stringMatching(/rock/)]);
  });

  it('gates a crowd only on tasks there are', () => {
    expect(problems({ crowd: { walk: [{ ...ok.crowd.walk[0], until: 'squanch' }] } })).toEqual([]);
    expect(problems({ crowd: { walk: [{ ...ok.crowd.walk[0], after: 'nothing' }] } })).toEqual([expect.stringMatching(/nothing/)]);
  });

  it('cuts a window only in its wall, under the ceiling', () => {
    const d = room();
    const w = (o) => worldProblems(d, { outside: 'ground', windows: [{ wall: 'n', from: -5, to: 5, y0: 1, h: 3, ...o }] }, opts);
    expect(w({})).toEqual([]);
    expect(w({ wall: 'up' })).toEqual([expect.stringMatching(/wall/)]);
    expect(w({ from: -20, to: 5 })).toEqual([expect.stringMatching(/off its wall/)]);
    expect(w({ h: 9 })).toEqual([expect.stringMatching(/ceiling/)]);
    // an outdoor place has no windows
    expect(problems({ windows: [{ wall: 'n', from: -5, to: 5, y0: 1, h: 3 }] })).toEqual([expect.stringMatching(/outdoor/)]);
  });

  it('never flies a family’s own vehicle, and stands a set piece at most twice', () => {
    expect(problems({ fliers: [{ model: '/models/c137/rm/jerry-ship.glb', n: { high: 1 } }] })).toEqual([expect.stringMatching(/jerry-ship/)]);
    expect(problems({ ring: { n: { styles: ['block'], sets: [{ model: '/models/c137/rm/purgecottage.glb', h: 7, n: 3 }] } } })).toEqual([expect.stringMatching(/twice/)]);
    expect(problems({ ring: { n: { styles: ['block'], sets: [{ model: '/models/c137/rm/spacebeth-ship.glb', h: 3, n: 1 }] } } })).toEqual([expect.stringMatching(/spacebeth-ship/)]);
  });

  it('stands a place’s own pieces from the set pieces’ models only, none a family’s own vehicle, and none on a spot', () => {
    const piece = (o) => problems({ pieces: [{ h: 6, ...o }] });
    expect(piece({ model: '/models/c137/rm/purgecottage.glb', at: [20, 10] })).toEqual([]);
    expect(piece({ model: '/models/c137/rm/dirlycar.glb', at: [20, 10] })).toEqual([expect.stringMatching(/dirlycar/)]);
    expect(piece({ model: 'q:Rock_Medium_1', at: [20, 10] })).toEqual([expect.stringMatching(/set pieces/)]);
    // (the spot `thing` is at [0, -12]: a piece over it hides it)
    expect(piece({ model: '/models/c137/rm/purgewell.glb', at: [0, -11] })).toEqual([expect.stringMatching(/thing/)]);
  });

  it('hangs a planet or a moon only in a room looking out on space, no wider than a fifth of the sky', () => {
    const planet = { bearing: 90, up: 2, size: 7, color: 0x4a6ac8 };
    expect(worldProblems(room(), { outside: 'space', bodies: [planet] }, opts)).toEqual([]);
    expect(worldProblems(room(), { outside: 'ground', bodies: [planet] }, opts)).toEqual([expect.stringMatching(/space/)]);
    expect(problems({ bodies: [planet] })).toEqual([expect.stringMatching(/space/)]);
    expect(worldProblems(room(), { outside: 'space', bodies: [{ ...planet, size: 40 }] }, opts)).toEqual([expect.stringMatching(/wide/)]);
  });

  it('stands a heavy figure (over 25k triangles: Zeep, Birdperson) at most twice in a place, on any level', () => {
    const heavy = { ...TRIS, zeep: 41082 };
    const zeeps = (n) => worldProblems(fixture(), { crowd: { gather: [{ kinds: ['zeep'], n, at: [0, -40], r: 2, face: [0, 0] }] } }, { ...opts, tris: heavy });
    expect(zeeps({ high: 2, mid: 2, low: 0 })).toEqual([]);
    expect(zeeps({ high: 3, mid: 2, low: 0 })).toEqual([expect.stringMatching(/zeep.*twice/)]);
  });

  it('lets a piece stand by its own spot (the siren by its pull), and only its own', () => {
    const piece = (o) => problems({ pieces: [{ model: '/models/c137/rm/purgesiren.glb', h: 6.9, at: [0, -13.4], ...o }] });
    expect(piece({ own: 'thing' })).toEqual([]);
    expect(piece({})).toEqual([expect.stringMatching(/thing/)]);
    expect(piece({ own: 'nothing' })).toEqual([expect.stringMatching(/nothing/), expect.stringMatching(/thing/)]);
  });
});

describe('a sight line', () => {
  const laid = { lots: [{ x: 0, z: -60, w: 10, d: 10, h: 20, y: 0, turn: 0 }], skyline: [] };
  it('is blocked by a building it passes through, below the building’s top', () => {
    expect(blocksSight(laid, [0, 1.6, 0], [0, 15, -120])).toBe(true);
  });
  it('clears a building it passes over or beside', () => {
    expect(blocksSight(laid, [0, 1.6, 0], [0, 80, -120])).toBe(false);
    expect(blocksSight(laid, [0, 1.6, 0], [40, 15, -120])).toBe(false);
  });
});
