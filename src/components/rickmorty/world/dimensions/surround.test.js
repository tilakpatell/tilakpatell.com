import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { at } from '../kit';
import { QUATERNIUS, groundSize, roomFog, surround, wallOpenings } from './surround';
import { place } from './place';

// the room kit as surround draws in it: frames recording their list, the
// tiled batch, the group, what it owns and its ticks
function fakeRoom() {
  const parts = [];
  const tiled = [];
  const ticks = [];
  const owned = [];
  const group = new THREE.Group();
  const frame = (x, z, turn = 0, { y = 0, list = 'solid' } = {}) => {
    const base = at(x, y, z, turn);
    const rec = (geo) => (...a) => (parts.push({ geo, list, a }), f);
    const f = {
      base,
      box: rec('box'),
      cbox: rec('box'),
      cyl: rec('cyl'),
      ball: rec('ball'),
      part: rec('part'),
      glow: (...a) => (parts.push({ geo: 'glow', list: 'glow', a }), f),
      decal: rec('decal'),
      mat: (u, yc, v, ry = 0, sx = 1, sy = sx, sz = sx) => base.clone().multiply(at(u, yc, v, ry, sx, sy, sz)),
    };
    return f;
  };
  const R = {
    id: 'trial',
    group,
    frame,
    fixed: (x, z, turn) => frame(x, z, turn, { list: 'fixed' }),
    tiled: { add: (geo, mat, matrix) => tiled.push({ geo, mat, matrix }) },
    add: (o) => group.add(o),
    own: (...x) => (owned.push(...x), x[0]),
    tick: (fn) => ticks.push(fn),
    noInk: [],
    kit: { mats: { painted: (name, w, h, draw, opts) => ({ name, userData: { tile: opts?.tile ?? 0 } }) } },
  };
  return { R, parts, tiled, ticks, owned, group };
}
// a model as the loaders give it: one textured mesh a metre tall
const model = () => {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshToonMaterial());
  m.name = 'Thing';
  g.add(m);
  return g;
};
function fakeKit({ fail = [] } = {}) {
  const tracked = [];
  const kit = {
    tier: 'high',
    fit: { tier: 'high' },
    need: vi.fn(async (names) => {
      if (names.some((n) => fail.includes(n))) throw new Error('no such model');
    }),
    track: vi.fn((p) => (tracked.push(p), p)),
    cast: { prop: vi.fn((name) => (fail.includes(name) ? null : model())), make: vi.fn(() => null) },
    adopt: vi.fn(),
  };
  const loader = {
    loadAsync: vi.fn(async (url) => {
      if (fail.includes(url)) throw new Error('404');
      const scene = new THREE.Group();
      const node = model();
      node.name = url.includes('rocks') ? 'Rock_Medium_1' : 'Streetlight_Single';
      scene.add(node);
      return { scene };
    }),
  };
  return { kit, loader, tracked };
}

const outdoor = () => place(0, { id: 'trial', name: 'A trial', kind: 'outdoor', deep: 50, wide: 70, spots: [{ id: 'thing', dx: 0, dz: -15, label: 'A thing', verb: 'Look' }] });
const room = () => place(1, { id: 'hall', name: 'A hall', kind: 'room', deep: 30, wide: 34, ceiling: 8 });
const LOOK = { walls: [0xe8d8b8], roofs: [0x8a5a3a], lit: [0xffe08a], trim: 0x5a4a3a };
const laidFor = (d, over = {}) => ({
  reach: 320,
  edge: [{ kind: 'rail', x0: d.area.x0, z0: d.area.z0, x1: d.area.x1, z1: d.area.z0, h: 1.1, see: true }],
  lots: [
    { side: 'n', row: 0, style: 'block', x: d.centre.x - 20, z: d.area.z0 - 14, turn: 0, w: 10, d: 10, h: 12, y: 0 },
    { side: 'n', row: 0, style: 'set', model: '/models/c137/rm/purgecottage.glb', x: d.centre.x + 30, z: d.area.z0 - 14, turn: 0, w: 10, d: 10, h: 7, y: 0 },
  ],
  skyline: [{ x: d.centre.x, z: d.centre.z - 180, w: 16, d: 16, h: 60, style: 'tower' }],
  path: { pts: [[d.arrive.x, d.arrive.z - 1], [d.centre.x, d.centre.z - 20]], w: 3, color: 0xc8b898 },
  props: [
    { model: 'q:Rock_Medium_1', x: d.centre.x + 3, z: d.centre.z, turn: 0, s: 1, h: 0.7 },
    { model: 'q:Rock_Medium_1', x: d.centre.x - 3, z: d.centre.z, turn: 1, s: 1, h: 0.7, edge: true },
  ],
  walkers: [],
  gathers: [],
  lanes: [{ key: 'lane-0', model: '/models/c137/fedship.glb', n: 2, y: 50, from: [d.centre.x - 300, d.centre.z], to: [d.centre.x + 300, d.centre.z], speed: 20 }],
  extents: { 'lane-0': { x: d.centre.x, y: 50, z: d.centre.z, r: 315 } },
  ...over,
});
const ctx = (R, kit, d, loader) => ({ R, d, kit, load: null, loader });
const instances = (g) => g.children.filter((o) => o.isInstancedMesh);

describe('the world round a place', () => {
  it('draws its edge, its ring, its skyline and its path into the room kit, before it builds', () => {
    const d = outdoor();
    const { R, parts, tiled } = fakeRoom();
    const { kit, loader } = fakeKit();
    surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d));
    // the rail: posts and rails along the north edge
    expect(parts.filter((p) => p.list === 'fixed' && p.geo === 'cyl').length).toBeGreaterThan(10);
    // the block's and the tower's walls of windows
    expect(tiled.length).toBeGreaterThanOrEqual(2);
    // and nothing that casts a shadow: the outskirts are all in the fixed list
    expect(parts.some((p) => p.list === 'solid')).toBe(false);
  });

  it('paints a lot with a look of its own in its own colours (a stand’s concrete under a city’s night)', () => {
    const d = outdoor();
    const { R, tiled } = fakeRoom();
    const { kit, loader } = fakeKit();
    const pale = { walls: [0xb8b4ac], roofs: [0x8a867e], lit: [0xffe24a], trim: 0x6a665e };
    surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d, { lots: [{ side: null, row: null, style: 'block', x: d.centre.x, z: d.area.z0 - 30, turn: 0, w: 10, d: 10, h: 10, y: 0, look: pale }], skyline: [], edge: [] }));
    expect(tiled.length).toBeGreaterThan(0);
    for (const t of tiled) expect(t.mat.name).toMatch(/b8b4ac/);
  });

  it('tracks every load, so the place isn’t ready till it’s all stood', async () => {
    const d = outdoor();
    const { R } = fakeRoom();
    const { kit, loader, tracked } = fakeKit();
    const s = surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d));
    expect(tracked).toContain(s.ready);
    await s.ready;
  });

  it('stands its set pieces, its props and its traffic as instances, one mesh a part, as many as laid', async () => {
    const d = outdoor();
    const { R, group } = fakeRoom();
    const { kit, loader } = fakeKit();
    await surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d)).ready;
    const counts = instances(group).map((m) => [m.userData.surround, m.count]);
    expect(counts).toEqual(expect.arrayContaining([['/models/c137/rm/purgecottage.glb', 1], ['q:Rock_Medium_1', 2], ['/models/c137/fedship.glb', 2]]));
    expect(kit.need).toHaveBeenCalledWith(['/models/c137/rm/purgecottage.glb'], { clips: [] });
    expect(loader.loadAsync).toHaveBeenCalledWith('/models/quaternius/nature/rocks.glb');
  });

  it('stands each prop at the height it’s laid at, whatever height its model stands', async () => {
    const d = outdoor();
    const { R, group } = fakeRoom();
    const { kit, loader } = fakeKit();
    await surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d, { props: [{ model: 'q:Rock_Medium_1', x: d.centre.x, z: d.centre.z, turn: 0, s: 1, h: 1.4 }], lots: [], lanes: [] })).ready;
    const [rock] = instances(group).filter((m) => m.userData.surround === 'q:Rock_Medium_1');
    rock.computeBoundingBox();
    // (the rock's model stands 0.7 m in the kit: laid at 1.4, it stands twice that)
    expect(rock.boundingBox.max.y - rock.boundingBox.min.y).toBeCloseTo(1.4, 2);
  });

  it('flies its traffic along its lanes at their height', async () => {
    const d = outdoor();
    const { R, group, ticks } = fakeRoom();
    const { kit, loader } = fakeKit();
    await surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d)).ready;
    const [ship] = instances(group).filter((m) => m.userData.surround === '/models/c137/fedship.glb');
    const where = () => {
      const m = new THREE.Matrix4();
      ship.getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixPosition(m);
    };
    ticks.forEach((fn) => fn(3, 1 / 60, { done: [] }, null));
    const a = where();
    expect(a.y).toBeGreaterThanOrEqual(50);
    expect(Math.abs(a.z - d.centre.z)).toBeLessThan(2);
    ticks.forEach((fn) => fn(4, 1 / 60, { done: [] }, null));
    expect(where().x - a.x).toBeCloseTo(20, 0);
  });

  it('leaves the place standing when a load fails', async () => {
    const d = outdoor();
    const { R, group } = fakeRoom();
    const { kit, loader } = fakeKit({ fail: ['/models/c137/rm/purgecottage.glb', '/models/quaternius/nature/rocks.glb'] });
    const s = surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d));
    await expect(s.ready).resolves.toBeDefined();
    expect(instances(group).map((m) => m.userData.surround)).toEqual(['/models/c137/fedship.glb']);
  });

  it('casts no shadow from anything it stands but the place’s own pieces', async () => {
    const d = room();
    const { R, group } = fakeRoom();
    const { kit, loader } = fakeKit();
    await surround(ctx(R, kit, d, loader), { look: LOOK, outside: 'ground' }, laidFor(d, { edge: [] })).ready;
    for (const m of instances(group)) expect(m.castShadow).toBe(false);
  });

  it('stands a place’s own pieces with their shadows, each at the height it’s laid at, and turns those that spin', async () => {
    const d = outdoor();
    const { R, group, ticks } = fakeRoom();
    const { kit, loader } = fakeKit();
    const WELL = '/models/c137/rm/purgewell.glb';
    const COG = '/models/c137/rm/sm/gearcog.glb';
    const pieces = [
      { model: WELL, piece: true, x: d.centre.x + 4, z: d.centre.z, turn: 0, w: 0, d: 0, h: 2.8, y: 0, spin: 0 },
      { model: WELL, piece: true, x: d.centre.x - 4, z: d.centre.z, turn: 0, w: 0, d: 0, h: 5.6, y: 0, spin: 0 },
      { model: COG, piece: true, x: d.centre.x, z: d.centre.z - 30, turn: 0, w: 0, d: 0, h: 1.8, y: 10, spin: 0.5 },
    ];
    await surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d, { lots: pieces, lanes: [], props: [] })).ready;
    const [well] = instances(group).filter((m) => m.userData.surround === WELL);
    expect(well.castShadow).toBe(true);
    const tall = (i) => {
      const m = new THREE.Matrix4();
      well.getMatrixAt(i, m);
      return new THREE.Vector3().setFromMatrixScale(m).y;
    };
    // (the model stands a metre tall: laid at 2.8 and 5.6, the second twice the first)
    expect(tall(1) / tall(0)).toBeCloseTo(2, 5);
    const [cog] = instances(group).filter((m) => m.userData.surround === COG);
    const turnOf = () => {
      const m = new THREE.Matrix4();
      cog.getMatrixAt(0, m);
      const [p, q] = [new THREE.Vector3(), new THREE.Quaternion()];
      m.decompose(p, q, new THREE.Vector3());
      return [new THREE.Euler().setFromQuaternion(q).y, p.y];
    };
    ticks.forEach((fn) => fn(0, 1 / 60, { done: [] }, null));
    const [a, y] = turnOf();
    expect(y).toBeCloseTo(10, 5);
    ticks.forEach((fn) => fn(1, 1 / 60, { done: [] }, null));
    expect(turnOf()[0] - a).toBeCloseTo(0.5, 5);
  });

  it('lays the ground round a room with a world outside, and stars round one looking out on space', () => {
    const d = room();
    const a = fakeRoom();
    surround(ctx(a.R, fakeKit().kit, d, fakeKit().loader), { look: LOOK, outside: 'ground', ground: 0x6a8a4a }, laidFor(d, { edge: [] }));
    // four strips round the walls, under the floor's height
    expect(a.parts.filter((p) => p.list === 'fixed' && p.geo === 'box' && p.a[0] === 0x6a8a4a)).toHaveLength(4);
    const b = fakeRoom();
    surround(ctx(b.R, fakeKit().kit, d, fakeKit().loader), { look: LOOK, outside: 'space' }, laidFor(d, { edge: [], lots: [], skyline: [], path: null, props: [] }));
    const stars = b.group.children.find((o) => o.isMesh && o.material?.isMeshBasicMaterial && o.material.side === THREE.BackSide);
    expect(stars).toBeTruthy();
    expect(stars.material.fog).toBe(false);
    expect(b.parts.some((p) => p.geo === 'box' && p.list === 'fixed' && p.a[2] === 0 && p.a[1] === 0 && p.a[0] === 0x6a8a4a)).toBe(false);
  });

  it('gives the place its crowd’s doings: a hop, a turn, and how many stand', async () => {
    const d = outdoor();
    const { R } = fakeRoom();
    const { kit, loader } = fakeKit();
    const s = surround(ctx(R, kit, d, loader), { look: LOOK }, laidFor(d));
    expect(Object.keys(s.actions)).toEqual(expect.arrayContaining(['hop', 'turn', 'crowd']));
    s.actions.hop();
    s.actions.turn([0, 0]);
    expect(s.actions.crowd()).toEqual({});
  });
});

describe('the blocks a crowd stands in', () => {
  it('draws each as the rail, the barrier or the box it says, round its edge, no taller than it is', () => {
    const d = outdoor();
    const { R, parts } = fakeRoom();
    const blocks = [
      { id: 'pit', dx: -10, dz: 10, w: 12, d: 6, h: 1.1, draw: 'barrier' },
      { id: 'dais', dx: 10, dz: 10, w: 4, d: 2, h: 0.6, draw: 'box' },
      { id: 'quiet', dx: 0, dz: 0, w: 2, d: 2, h: 1, draw: 'none' },
    ];
    surround({ R, d, kit: fakeKit().kit, loader: fakeKit().loader, blocks }, { look: LOOK }, laidFor(d, { edge: [], lots: [], skyline: [], path: null, props: [], lanes: [] }));
    // the barrier round the pit: boards on all four sides
    const boards = parts.filter((p) => p.list === 'fixed' && p.geo === 'box');
    expect(boards.length).toBeGreaterThan(8);
    // the dais a box of its own size, standing on the ground
    expect(parts.some((p) => p.geo === 'box' && p.a[4] === 4 && p.a[5] === 0.6 && p.a[6] === 2)).toBe(true);
  });
});

describe('the walls, the ground and the fog a world asks of the stage', () => {
  it('cuts a room’s windows in the wall they’re on, where they are along it', () => {
    const d = room();
    const w = { windows: [{ wall: 'n', from: -10, to: 6, y0: 0.8, h: 4, mullion: 2 }, { wall: 'e', from: -4, to: 4, y0: 1, h: 3 }] };
    const n = wallOpenings(w, 'n', d);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ c: d.centre.x - 2, w: 16, y0: 0.8, y1: 4.8 });
    expect(typeof n[0].draw).toBe('function');
    expect(wallOpenings(w, 'e', d)[0]).toMatchObject({ c: d.centre.z, w: 8 });
    expect(wallOpenings(w, 's', d)).toEqual([]);
    expect(wallOpenings(null, 'n', d)).toEqual([]);
  });

  it('runs the ground out to the outskirts’ reach, never smaller than the box and 260 m', () => {
    const d = outdoor();
    expect(groundSize(d, 320)).toEqual([640, 640]);
    expect(groundSize(d, 50)).toEqual([70 + 260, 50 + 260]);
    expect(groundSize(d, null)).toEqual([70 + 260, 50 + 260]);
  });

  it('fogs a room’s outside only past the room, in the outside’s own sky', () => {
    const d = room();
    const diagonal = Math.hypot(34, 30);
    const fog = roomFog(d, { outside: 'ground', sky: { top: 0x112233, low: 0xaabbcc } }, 320);
    expect(fog[0]).toBe(0xaabbcc);
    expect(fog[1]).toBeGreaterThan(diagonal);
    expect(fog[2]).toBe(300);
    expect(roomFog(d, { outside: 'space' }, 320)).toBeNull();
    expect(roomFog(d, { outside: null }, 320)).toBeNull();
  });
});

describe('the Quaternius models a world may stand', () => {
  it('are where the kit’s manifest says, at its heights', () => {
    const manifest = JSON.parse(readFileSync('public/models/quaternius/manifest.json', 'utf8'));
    for (const [node, [url, tall]] of Object.entries(QUATERNIUS)) {
      expect(manifest[node], node).toBeTruthy();
      expect(manifest[node].url, node).toBe(url);
      expect(tall, node).toBeCloseTo(manifest[node].metres[1], 1);
    }
  });
});
