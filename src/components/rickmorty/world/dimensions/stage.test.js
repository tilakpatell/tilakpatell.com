import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { stage } from './stage';

// A place built through stage() in Node, as a builder builds it, on a fake
// room kit: the mats painted and toon as plain materials, the portal's swirl
// a material with its uniforms, the cast's models fetched at once and each
// figure made as the cast makes one (none for a kind in `missing`: its model
// didn't load), and the town's kit models never coming (no network here).
// The place's crowd is stood in for (./crowd.js has its own test), its hops
// counted, so the stage's cheer is read off it.
const crowd = vi.hoisted(() => ({ hops: 0 }));
vi.mock('./crowd', () => ({ createCrowd: () => ({ ready: Promise.resolve(), hop: () => (crowd.hops += 1), turn: () => {}, show: () => {}, counts: () => ({}) }) }));
vi.mock('../../../../lib/three/gltf', () => ({ gltfLoader: () => ({ loadAsync: () => new Promise(() => {}) }) }));

const figure = (kind) => ({ kind, group: new THREE.Group(), height: 1.7, update() {}, look() {}, react() {}, play() {}, stop() {} });
function fakeKit(missing) {
  return {
    tier: 'high',
    fit: { tier: 'high' },
    mats: {
      painted: (name, w, h, draw, opts) => Object.assign(new THREE.MeshBasicMaterial(), { name, userData: { tile: opts?.tile ?? 0 } }),
      toon: () => new THREE.MeshBasicMaterial(),
    },
    portal: () => new THREE.ShaderMaterial({ uniforms: { open: { value: 1 }, t: { value: 0 } } }),
    need: async () => {},
    track: (p) => p,
    cast: { make: (kind) => (missing.includes(kind) ? null : figure(kind)), prop: () => null },
  };
}
// (every fetch above settles in microtasks: a turn of the clock, and the cast's in)
const settle = () => new Promise((r) => setTimeout(r, 0));

// a visit: the place staged (`build(S)`: what its builder does before done()),
// Morty at its way in, and what it says through the render state kept
function visit(id, { missing = [], build } = {}) {
  const S = stage(fakeKit(missing), id);
  build?.(S);
  const area = S.done({ fog: [0xffffff, 60, 280] }, () => {});
  const said = [];
  const state = { morty: { x: S.d.arrive.x, z: S.d.arrive.z, y: 0, face: 0, speed: 0, air: false }, done: [], fading: false, emit: (name, e) => said.push([name, e]) };
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(S.d.arrive.x, 3, S.d.arrive.z + 4);
  let t = 0;
  const step = (n = 1, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) area.update((t += dt), dt, state, camera);
  };
  const heard = (name) => said.filter(([n]) => n === name).map(([, e]) => e);
  return { S, area, state, said, step, heard };
}

describe('a place built through stage() in Node, on a fake room kit', () => {
  it('builds the Blood Dome: its room, its world round, its actions, and its people once the cast lands', async () => {
    const v = visit('blooddome', { build: (S) => S.people() });
    expect(v.area.group.children.length).toBeGreaterThan(0);
    expect(Object.keys(v.area.actions)).toEqual(expect.arrayContaining(['calm', 'npcs', 'fire', 'bodies', 'hit', 'hop', 'turn', 'show', 'crowd']));
    v.step();
    expect(v.area.actions.npcs()).toEqual([]);
    await settle();
    v.step();
    expect(v.area.actions.npcs().map((n) => n.id)).toContain('hemorrhage');
  });
});

describe('a duel whose duellist never stood (his model didn’t load)', () => {
  it('cast.make returns null for hemorrhage: hunt(true) after the cast lands emits one note, after the ring’s line', async () => {
    const v = visit('blooddome', { missing: ['hemorrhage'], build: (S) => S.people() });
    await settle();
    v.step();
    expect(v.area.actions.npcs().map((n) => n.id)).not.toContain('hemorrhage');
    v.S.hunt(true); // (the ring's fight: ./blooddome.js)
    v.step(30);
    expect(v.heard('note')).toEqual([{ area: 'blooddome', text: 'Hemorrhage didn’t load: reload the page for the fight.', after: true }]);
  });

  it('checks a fight called while the cast is on its way once it lands: Evil Rick’s, the last pod freed', async () => {
    const v = visit('evilrick', { missing: ['evilrick'], build: (S) => S.people() });
    v.S.hunt(true); // (./evilrick.js's collected)
    v.step(5);
    expect(v.heard('note')).toEqual([]);
    await settle();
    v.step(5);
    expect(v.heard('note')).toEqual([{ area: 'evilrick', text: 'Evil Rick didn’t load: reload the page for the fight.', after: true }]);
  });

  it('says nothing when he stood (he comes), once the duel’s won, or once Morty’s left', async () => {
    const stood = visit('blooddome', { build: (S) => S.people() });
    await settle();
    stood.S.hunt(true);
    stood.step(5);
    expect(stood.heard('note')).toEqual([]);
    expect(stood.area.actions.npcs().filter((n) => n.hunting).map((n) => n.id)).toEqual(['hemorrhage']);

    const won = visit('evilrick', { missing: ['evilrick'], build: (S) => S.people() });
    won.state.done = ['evilrick'];
    await settle();
    won.S.hunt(true);
    won.step(5);
    expect(won.heard('note')).toEqual([]);

    const left = visit('blooddome', { missing: ['hemorrhage'], build: (S) => S.people() });
    left.S.hunt(true);
    left.area.actions.calm();
    await settle();
    left.step(5);
    expect(left.heard('note')).toEqual([]);
  });
});

describe('Heist-Con’s crew gate (the stage’s `collected`)', () => {
  it('holds the job till the crew’s in: the plan or a booth before it gives the `before` note, collected makes the sequence ready, the plan then starts it', () => {
    const v = visit('heistcon');
    const sq = v.S.d.sequence;
    v.step();
    v.area.actions['sequence-start']();
    v.step();
    v.area.actions[`sequence-${sq.items[0]}`]();
    v.step();
    expect(v.heard('note').map((e) => e.text)).toEqual([sq.before, sq.before]);
    expect(v.area.actions.sequence()).toMatchObject({ phase: 'idle', ready: false });
    v.area.actions.collected();
    v.step();
    expect(v.area.actions.sequence()).toMatchObject({ phase: 'idle', ready: true });
    // (a booth now says only that the job hasn't started)
    v.area.actions[`sequence-${sq.items[0]}`]();
    v.step();
    expect(v.heard('note').map((e) => e.text)).toEqual([sq.before, sq.before, sq.early]);
    v.area.actions['sequence-start']();
    v.step();
    expect(v.area.actions.sequence().phase).toBe('run');
    expect(v.heard('spotted').map((e) => e.text)).toEqual([sq.spotted]);
    expect(v.heard('note')).toHaveLength(3);
  });
});

describe('a catch in the update the job’s won in (../news.js hears the win through its fade)', () => {
  it('says the catch first, then the win: the people step before the place’s game', async () => {
    const v = visit('heistcon', { build: (S) => S.people() });
    await settle();
    v.step();
    v.area.actions.collected();
    v.step();
    v.area.actions['sequence-start']();
    v.step();
    const { order } = v.area.actions.sequence();
    for (const id of order.slice(0, -1)) {
      v.area.actions[`sequence-${id}`]();
      v.step();
    }
    v.step(15);
    const cat = v.area.actions.npcs().find((n) => n.id === 'heister-b1');
    expect(cat.hunting).toBe(true);
    // (Morty in her reach, and the last booth lifted, in the one update)
    Object.assign(v.state.morty, { x: cat.x + 0.6, z: cat.z });
    v.said.length = 0;
    v.area.actions[`sequence-${order.at(-1)}`]();
    v.step();
    expect(v.said.map(([n, e]) => [n, e.who ?? e.task])).toEqual([
      ['caught', 'heister-b1'],
      ['done', 'heistcon'],
    ]);
  });
});

describe('the stage’s climb (Fantasy World’s Stair Goblins)', () => {
  const tread = (d, i) => d.solids.find((s) => s.id === d.climb.stairs[i].steps[0]);
  const onTread = (v, l) => Object.assign(v.state.morty, { x: l.x, z: l.z, y: l.top, air: false });

  it('steps climbing() on Morty’s own position and poses a stair that stood: on its tread through its bite, he’s bitten', () => {
    const goblin = new THREE.Group();
    const v = visit('fantasy', { build: (S) => S.climb({ stairs: { [S.d.climb.stairs[0].id]: goblin } }) });
    const l = tread(v.S.d, 0);
    onTread(v, l);
    let low = 1;
    for (let i = 0; i < 100 && v.area.actions.climb().phase !== 'lost'; i++) {
      v.step(1, 0.05);
      low = Math.min(low, goblin.scale.y);
    }
    v.step(4, 0.05); // (the bite seen through, the game stood at its loss)
    low = Math.min(low, goblin.scale.y);
    expect(v.area.actions.climb()).toMatchObject({ phase: 'lost', on: l.id });
    expect(v.heard('caught').map((e) => e.text)).toEqual([v.S.d.climb.lost]);
    expect(low).toBeLessThan(0.95); // (the bite's snap down)
  });

  it('poses only the figures that stood: a stair whose figure never did is tame, and he stands on its tread through its bite', () => {
    const goblin = new THREE.Group();
    const v = visit('fantasy', { build: (S) => S.climb({ stairs: { [S.d.climb.stairs[1].id]: goblin } }) });
    const l = tread(v.S.d, 0);
    onTread(v, l);
    v.step(100, 0.05);
    expect(v.area.actions.climb()).toMatchObject({ phase: 'run', on: l.id });
    expect(v.area.actions.climb().t).toBeCloseTo(5, 5);
    expect(v.heard('caught')).toEqual([]);
    expect(goblin.userData.rest).toEqual({ ry: 0, s: 1 }); // (the one that stood, posed from its rest)
  });

  it('skips the climb once its task’s done: no bite on a tread, and the stairs sway at rest', () => {
    const goblin = new THREE.Group();
    const v = visit('fantasy', { build: (S) => S.climb({ stairs: { [S.d.climb.stairs[0].id]: goblin } }) });
    v.state.done = [v.S.d.climb.task];
    onTread(v, tread(v.S.d, 0));
    const turns = new Set();
    for (let i = 0; i < 100; i++) {
      v.step(1, 0.05);
      turns.add(goblin.rotation.y.toFixed(3));
    }
    expect(v.heard('caught')).toEqual([]);
    expect(v.area.actions.climb()).toMatchObject({ phase: 'idle', t: 0 });
    expect(goblin.scale.y).toBe(1);
    expect(turns.size).toBeGreaterThan(10); // (a slow sway)
  });
});

describe('the crowd’s cheer (the stage’s world round)', () => {
  it('hops the crowd on the beat from the frame its game’s task is done, and not for a task done before the visit', () => {
    crowd.hops = 0;
    const v = visit('blooddome');
    v.step(3);
    expect(crowd.hops).toBe(0);
    v.state.done = ['blooddome'];
    v.step();
    expect(crowd.hops).toBe(1);
    v.step(35, 0.1); // (a hop a beat, 1.5 s, for 6 s)
    expect(crowd.hops).toBe(3);
    v.step(60, 0.1);
    expect(crowd.hops).toBe(5);

    crowd.hops = 0;
    const back = visit('blooddome');
    back.state.done = ['blooddome'];
    back.step(60, 0.1);
    expect(crowd.hops).toBe(0);
  });
});
