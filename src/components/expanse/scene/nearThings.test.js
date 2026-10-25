import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { spaceId } from '../../../lib/space/address';
import { fullSector } from '../gen/space';
import { UNIVERSE, rngOf } from '../gen/seed';
import { THING_KINDS, THING_NEAR } from '../gen/things';
import { HAND } from './fixtures/hand';
import { realAt } from './levels';
import { createNearThings, pickNear } from './nearThings';
import { WONDER, WONDER_SPECK } from './specks';

const KIND = Object.fromEntries(THING_KINDS.map((k, i) => [k.kind, i]));
const LOOK = Object.fromEntries(THING_KINDS.map((k) => [k.kind, k.look]));
// a sector made by hand, its middle at `origin`: lattice things where they're
// given (from the middle), and any extras and wonders
function handSector(list, { origin = [600000, 0, 0], extras = {}, wonders = [] } = {}) {
  return {
    id: 'E:5,0',
    sx: 5,
    sy: 0,
    sz: 0,
    seed: 1n,
    origin,
    systems: [],
    wonders,
    things: {
      count: list.length,
      slot: Uint16Array.from(list.map((t) => t.slot)),
      kind: Uint8Array.from(list.map((t) => KIND[t.kind])),
      at: Float32Array.from(list.flatMap((t) => t.at)),
      size: Float32Array.from(list.map((t) => t.size)),
    },
    extras,
    beacons: {},
  };
}
const abs = (sector, at) => at.map((v, k) => v + sector.origin[k]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idOf = (slot) => spaceId([5, 0, 0], { wonder: 64 + slot });

// four things round the middle: two in, one just out, one far in for its size
const FOUR = [
  { slot: 10, kind: 'rock', size: 100, at: [0, 0, 790] }, // 790 < 800: in
  { slot: 11, kind: 'ice', size: 50, at: [-410, 0, 0] }, // 410 > 400: out
  { slot: 12, kind: 'derelict', size: 60, at: [0, 470, 0] }, // 470 < 480: in
  { slot: 13, kind: 'rogue', size: 200, at: [1500, 0, 0] }, // 1,500 < 1,600: in
];

// a body builder's camera, anywhere
const camera = new THREE.PerspectiveCamera();
const meshesOf = (group) => {
  const out = [];
  group.traverse((o) => o.isMesh && out.push(o));
  return out;
};
const visibleMeshes = (group) => {
  const out = [];
  group.traverseVisible((o) => o.isMesh && out.push(o));
  return out;
};
const instanceAt = (mesh, k) => {
  mesh.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(k, m);
  const local = new THREE.Vector3().setFromMatrixPosition(m);
  const scale = new THREE.Vector3().setFromMatrixScale(m);
  return { local, scale, world: local.clone().add(mesh.position) };
};

describe('things near the camera, picked', () => {
  it('picks the lattice things within THING_NEAR of their sizes, nearest first, as rows of their kind and look', () => {
    const sector = handSector(FOUR);
    const rows = pickNear([sector], sector.origin);
    expect(rows.map((r) => r.id)).toEqual([idOf(12), idOf(10), idOf(13)]);
    for (const row of rows) {
      const t = FOUR.find((one) => idOf(one.slot) === row.id);
      expect(row.kind).toBe(t.kind);
      expect(row.at).toEqual(abs(sector, t.at));
      expect(row.size).toBe(t.size);
      expect(row.look).toBe(LOOK[t.kind]);
      expect(row.near).toBe(THING_NEAR * t.size);
      expect(row.sector).toBe(sector);
    }
  });

  it('keeps the nearest it may: none past max', () => {
    const sector = handSector(FOUR);
    expect(pickNear([sector], sector.origin, { max: 2 }).map((r) => r.id)).toEqual([idOf(12), idOf(10)]);
    expect(pickNear([sector], sector.origin, { max: 0 })).toEqual([]);
    // (a tie to the lower id, whichever sector it's in)
    const twin = handSector([{ slot: 20, kind: 'rock', size: 100, at: [0, 0, -790] }]);
    expect(pickNear([twin, sector], sector.origin, { max: 2 }).map((r) => r.id)).toEqual([idOf(12), idOf(10)]);
  });

  it('measures from the camera, however far out', () => {
    const sector = handSector(FOUR, { origin: [1e9, -2e8, 3e9] });
    const cam = [1e9 + 1, -2e8, 3e9];
    expect(pickNear([sector], cam).map((r) => r.id)).toEqual([idOf(12), idOf(10), idOf(13)]);
    expect(pickNear([sector], [1e9 + 1500, -2e8 + 10, 3e9]).map((r) => r.id)).toEqual([idOf(13)]);
  });

  it('finds one wherever it is, inside the sector’s cube or put outside it by its kind', () => {
    const sector = handSector([
      { slot: 0, kind: 'rock', size: 40, at: [59990, -59990, 59990] },
      { slot: 1, kind: 'rogue', size: 120, at: [75000, 0, 0] }, // (moved out past its face)
    ]);
    expect(pickNear([sector], abs(sector, [59900, -59950, 59950])).map((r) => r.id)).toEqual([idOf(0)]);
    expect(pickNear([sector], abs(sector, [74500, 300, 0])).map((r) => r.id)).toEqual([idOf(1)]);
    expect(pickNear([sector], abs(sector, [70000, 0, 0]))).toEqual([]);
  });

  it('finds what a look at every thing of a real sector would, and nothing else', () => {
    const sector = fullSector(UNIVERSE, 1, 0, 0);
    const t = sector.things;
    const rng = rngOf(21n);
    const thingAt = (i) => abs(sector, [t.at[i * 3], t.at[i * 3 + 1], t.at[i * 3 + 2]]);
    let found = 0;
    for (let n = 0; n < 200; n++) {
      // round a thing (most of the time), or anywhere in the sector or past its faces
      const i = Math.floor(rng() * t.count);
      const cam = n % 4 ? thingAt(i).map((v) => v + (rng() * 2 - 1) * 600) : sector.origin.map((v) => v + (rng() * 2 - 1) * 64000);
      const want = [];
      for (let j = 0; j < t.count; j++) {
        const d = dist(thingAt(j), cam);
        if (d < THING_NEAR * t.size[j]) want.push([d, spaceId([1, 0, 0], { wonder: 64 + t.slot[j] })]);
      }
      want.sort((a, b) => a[0] - b[0]);
      const got = pickNear([sector], cam).map((r) => r.id);
      expect(got, `${cam}`).toEqual(want.map((w) => w[1]));
      found += got.length;
    }
    expect(found).toBeGreaterThan(50);
  });

  it('picks a sector’s extras by their kind’s look, or their own for a kind the table hasn’t', () => {
    const sector = handSector([], {
      extras: {
        field: [
          { kind: 'ice', at: [600200, 0, 0], size: 30, id: 'E:5,0:w3' }, // (200 < 240: in)
          { kind: 'shard', at: [600000, 50, 0], size: 10, id: 'E:5,0:w4', look: { color: '#123456', lit: false } },
          { kind: 'rock', at: [600000, 0, 900], size: 100, id: 'E:5,0:w5' }, // (900 > 800: out)
        ],
      },
    });
    const rows = pickNear([sector], sector.origin);
    expect(rows.map((r) => [r.id, r.kind, r.size, r.near])).toEqual([
      ['E:5,0:w4', 'shard', 10, 80],
      ['E:5,0:w3', 'ice', 30, 240],
    ]);
    expect(rows[0].look).toEqual({ color: '#123456', lit: false });
    expect(rows[1].look).toBe(LOOK.ice);
    expect(rows[1].at).toEqual([600200, 0, 0]);
  });

  it('picks a wonder where its ball is real, as its speck has it, as its ball, and never a nebula', () => {
    const sector = { ...HAND, things: { count: 0 } };
    for (const w of HAND.wonders) {
      const real = realAt({ r: w.size * WONDER_SPECK });
      const near = (k) => pickNear([sector], [w.at[0], w.at[1] + k * real, w.at[2]]).filter((r) => r.id === w.id);
      if (w.kind === 'nebula') {
        expect(near(0.01)).toEqual([]);
        continue;
      }
      const [row] = near(0.95);
      expect(row, w.kind).toBeTruthy();
      const look = WONDER[w.kind];
      expect(row.kind).toBe(w.kind);
      expect(row.at).toEqual(w.at);
      expect(row.size).toBeCloseTo(w.size * look.r, 9);
      expect(row.near).toBe(real);
      expect(row.look).toEqual({ color: look.dark ?? look.color, lit: false });
      expect(near(1.05), w.kind).toEqual([]);
    }
  });

  it('gives the same row for the same thing from frame to frame, into the list it’s given', () => {
    const sector = handSector(FOUR);
    const out = [];
    const a = pickNear([sector], sector.origin, { out });
    expect(a).toBe(out);
    const ids = a.map((r) => r);
    const b = pickNear([sector], abs(sector, [0, 10, 0]), { out });
    expect(b).toBe(out);
    expect(b).toEqual(ids);
    b.forEach((row, i) => expect(row).toBe(ids[i]));
  });
});

describe('near things, drawn', () => {
  const rowsOf = (sector, cam = sector.origin) => pickNear([sector], cam);

  it('draws each look’s things as one ball mesh, instanced, each where it is and its size, in small numbers however far out', () => {
    const sector = handSector([...FOUR, { slot: 14, kind: 'rock', size: 80, at: [0, -600, 0] }], { origin: [1e9, -2e8, 3e9] });
    const rows = rowsOf(sector);
    expect(rows.filter((r) => r.kind === 'rock')).toHaveLength(2);
    const group = new THREE.Group();
    const near = createNearThings(group);
    near.update(rows, camera, 0);
    const shown = visibleMeshes(group);
    expect(shown.every((m) => m.isInstancedMesh)).toBe(true);
    expect(shown.map((m) => m.count).sort()).toEqual([1, 1, 2]);
    for (const mesh of shown) {
      const mine = rows.filter((r) => mesh.material.color.equals(new THREE.Color(r.look.color)));
      expect(mine).toHaveLength(mesh.count);
      expect(mesh.material.isMeshStandardMaterial).toBe(true);
      mine.forEach((row, k) => {
        const { local, scale, world } = instanceAt(mesh, k);
        expect(local.length()).toBeLessThan(10000);
        world.toArray().forEach((v, j) => expect(v).toBeCloseTo(row.at[j], 3));
        scale.toArray().forEach((v) => expect(v).toBeCloseTo(row.size, 6));
      });
    }
    near.dispose();
  });

  it('draws a wonder’s ball as it always was: its colour, unlit and not tone-mapped, its size', () => {
    const sector = { ...HAND, things: { count: 0 } };
    const w = HAND.wonders.find((one) => one.kind === 'derelict');
    const [row] = rowsOf(sector, [w.at[0], w.at[1] + 100, w.at[2]]);
    const group = new THREE.Group();
    const near = createNearThings(group);
    near.update([row], camera, 0);
    const [mesh] = visibleMeshes(group);
    expect(mesh.material.isMeshBasicMaterial).toBe(true);
    expect(mesh.material.toneMapped).toBe(false);
    expect(mesh.material.color.getHexString()).toBe(WONDER.derelict.dark.slice(1));
    expect(instanceAt(mesh, 0).scale.x).toBeCloseTo(w.size * WONDER.derelict.r, 6);
    near.dispose();
  });

  it('hands a kind with a drawer exactly its rows, every frame once it has had some, and draws none of them as a ball', () => {
    const sector = handSector([...FOUR, { slot: 15, kind: 'ice', size: 50, at: [0, 0, -300] }]);
    const rows = rowsOf(sector);
    const ice = rows.filter((r) => r.kind === 'ice');
    expect(ice).toHaveLength(1);
    const made = [];
    const drawers = {
      ice(group, ctx) {
        const d = { group, ctx, calls: [], disposed: false, update: (r, cam, t) => d.calls.push([[...r], cam, t]), dispose: () => (d.disposed = true) };
        made.push(d);
        return d;
      },
    };
    const group = new THREE.Group();
    const near = createNearThings(group, { drawers });
    near.update(rows, camera, 3);
    expect(made).toHaveLength(1);
    expect(made[0].group).toBe(group);
    expect(made[0].ctx.kind).toBe('ice');
    expect(made[0].calls).toEqual([[ice, camera, 3]]);
    made[0].calls[0][0].forEach((r, i) => expect(r).toBe(ice[i]));
    // no ball holds it
    const balls = visibleMeshes(group);
    expect(balls.reduce((n, m) => n + m.count, 0)).toBe(rows.length - ice.length);
    expect(balls.some((m) => m.material.color.equals(new THREE.Color(LOOK.ice.color)))).toBe(false);
    // and once it has, it's told each frame, none too, so it can hide
    near.update(rows.filter((r) => r.kind !== 'ice'), camera, 4);
    expect(made[0].calls.at(-1)).toEqual([[], camera, 4]);
    expect(made).toHaveLength(1);
    near.dispose();
    expect(made[0].disposed).toBe(true);
  });

  it('shows no mesh with nothing near, so it costs no draw call', () => {
    const group = new THREE.Group();
    const near = createNearThings(group);
    expect(visibleMeshes(group)).toEqual([]);
    near.update([], camera, 0);
    expect(visibleMeshes(group)).toEqual([]);
    const sector = handSector(FOUR);
    near.update(rowsOf(sector), camera, 0);
    expect(visibleMeshes(group).length).toBeGreaterThan(0);
    near.update([], camera, 0);
    expect(visibleMeshes(group)).toEqual([]);
    for (const m of meshesOf(group)) expect(m.count).toBe(0);
    near.dispose();
  });

  it('lends each near thing as a solid, its size, in one array kept from frame to frame', () => {
    const sector = handSector(FOUR);
    const rows = rowsOf(sector);
    const group = new THREE.Group();
    const near = createNearThings(group, { drawers: { rogue: () => ({ update() {}, dispose() {} }) } });
    const solids = near.solids();
    expect(solids).toEqual([]);
    near.update(rows, camera, 0);
    expect(near.solids()).toBe(solids);
    expect(solids).toEqual(rows.map((r) => ({ id: r.id, at: r.at, r: r.size, reach: r.size * 1.2 })));
    const first = solids[0];
    near.update(rows, camera, 0);
    expect(near.solids()[0]).toBe(first);
    near.update([], camera, 0);
    expect(solids).toEqual([]);
    near.dispose();
  });

  it('readies each mesh it makes once, through prepare, and draws it, and says its things are drawn, only once that’s done', async () => {
    const sector = handSector(FOUR);
    const rows = rowsOf(sector);
    const asked = [];
    let done = null;
    const ready = new Promise((resolve) => (done = resolve));
    const prepare = (o, alive) => {
      asked.push([o, alive()]);
      return ready;
    };
    const group = new THREE.Group();
    const near = createNearThings(group, { prepare });
    near.update(rows, camera, 0);
    // (the balls of every look it knows, made at once)
    const balls = meshesOf(group);
    expect(asked.map((a) => a[0]).sort((a, b) => a.id - b.id)).toEqual(balls.sort((a, b) => a.id - b.id));
    expect(asked.every((a) => a[1])).toBe(true);
    expect(visibleMeshes(group)).toEqual([]);
    expect([...near.shown()]).toEqual([]);
    expect(near.solids()).toHaveLength(rows.length);
    done();
    await ready;
    near.update(rows, camera, 0);
    expect(visibleMeshes(group).length).toBe(3);
    expect([...near.shown()].sort()).toEqual(rows.map((r) => r.id).sort());
    near.update(rows, camera, 0);
    expect(asked).toHaveLength(balls.length);
    near.dispose();
  });

  it('counts a drawer’s things as drawn, unless it says it isn’t ready', () => {
    const sector = handSector(FOUR);
    const rows = rowsOf(sector);
    let ready = false;
    const drawers = { rock: () => ({ update() {}, ready: () => ready, dispose() {} }), derelict: () => ({ update() {}, dispose() {} }) };
    const near = createNearThings(new THREE.Group(), { drawers });
    near.update(rows, camera, 0);
    expect([...near.shown()].sort()).toEqual([idOf(12), idOf(13)]);
    ready = true;
    near.update(rows, camera, 0);
    expect([...near.shown()].sort()).toEqual([idOf(10), idOf(12), idOf(13)]);
    near.dispose();
  });

  it('lets everything go on dispose, down to an empty group, its readying told it’s no longer wanted', () => {
    const alive = [];
    const group = new THREE.Group();
    const near = createNearThings(group, { prepare: (o, a) => (alive.push(a), new Promise(() => {})) });
    near.update(rowsOf(handSector(FOUR)), camera, 0);
    expect(alive.every((a) => a())).toBe(true);
    near.dispose();
    expect(group.children).toHaveLength(0);
    expect(alive.length).toBeGreaterThan(0);
    expect(alive.some((a) => a())).toBe(false);
    expect(near.solids()).toEqual([]);
  });
});
