import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCrowd } from './crowd';
import { loopLengths } from './crowdPose';

// a cast figure that isn't rigged, as kit.cast.prop gives it: a group
// holding one textured mesh (a box 1 m tall), the cast's own material
const castMaterial = () => {
  const m = new THREE.MeshToonMaterial({ map: new THREE.Texture() });
  m.dispose = vi.fn();
  return m;
};
function propOf(h) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.3).translate(0, 0.5, 0), castMaterial());
  mesh.scale.setScalar(h);
  g.add(mesh);
  return g;
}
// a rigged figure, as kit.cast.make gives it: its model under its body,
// one skinned mesh on two bones, and its idle clip
function figureOf() {
  const geo = new THREE.BoxGeometry(0.4, 1, 0.4, 1, 2, 1).translate(0, 0.5, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [1, 0, 0, 0]).flat(), 4));
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  const mesh = new THREE.SkinnedMesh(geo, castMaterial());
  const model = new THREE.Group();
  model.add(hips, mesh);
  model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([hips]));
  const body = new THREE.Group().add(model);
  const idle = new THREE.AnimationClip('idle', 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 0.02, 0])]);
  return { body, act: { idle: { getClip: () => idle } }, release: vi.fn() };
}
// a light copy as the Citadel's crowd files hold one
const copyLoader = () => ({
  loadAsync: vi.fn(async () => {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 0.3), castMaterial()));
    return { scene };
  }),
});

function fakes({ missing = [] } = {}) {
  const asked = [];
  const tracked = [];
  const kit = {
    need: vi.fn(async (names) => asked.push(...names)),
    track: vi.fn((p) => (tracked.push(p), p)),
    cast: {
      prop: vi.fn((name, h) => (missing.includes(name) ? null : propOf(h))),
      make: vi.fn((kind) => (missing.includes(kind) ? null : figureOf())),
    },
    adopt: vi.fn(),
  };
  const owned = [];
  const ticks = [];
  const group = new THREE.Group();
  const R = { group, add: (o) => group.add(o), own: (...x) => (owned.push(...x), x[0]), tick: (fn) => ticks.push(fn) };
  return { kit, R, owned, ticks, asked, tracked };
}

const LOOP = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const laid = (over = {}) => ({
  walkers: [{ key: 'walk-0', kinds: ['magdalian-a', 'plutonian-a'], n: 6, loop: LOOP, speed: 1.2, out: false }],
  gathers: [{ key: 'gather-0', kinds: ['crowd:cop'], n: 5, at: [30, 30], r: 3, face: [30, 0], block: null, until: null, after: null, when: null, out: false }],
  extents: { 'walk-0': { x: 5, y: 1, z: 5, r: 10 }, 'gather-0': { x: 30, y: 1, z: 30, r: 6 } },
  ...over,
});
const instances = (R) => R.group.children.filter((o) => o.isInstancedMesh);
const at = (mesh, i) => {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
};
const tick = (ticks, t, state = { done: [] }) => ticks.forEach((fn) => fn(t, 1 / 60, state, null));

describe('a place’s crowd', () => {
  it('stands each kind of each walker and gathering as one instanced mesh, copies dealt round its kinds', async () => {
    const { kit, R } = fakes();
    const crowd = createCrowd(kit, R, laid(), { loader: copyLoader() });
    await crowd.ready;
    const meshes = instances(R);
    expect(meshes.map((m) => m.count).sort()).toEqual([3, 3, 5]);
    // (each kind fetched through the cast, its model's name, nothing it doesn't need)
    expect(kit.need).toHaveBeenCalledWith(['magdalian-a'], { clips: [] });
    expect(kit.need).toHaveBeenCalledWith(['plutonian-a'], { clips: [] });
  });

  it('is tracked, so the place isn’t ready till it’s stood', async () => {
    const { kit, R, tracked } = fakes();
    const crowd = createCrowd(kit, R, laid(), { loader: copyLoader() });
    expect(tracked).toContain(crowd.ready);
  });

  it('casts no shadow, draws no line, and is in the house look', async () => {
    const { kit, R } = fakes();
    await createCrowd(kit, R, laid(), { loader: copyLoader() }).ready;
    for (const m of instances(R)) {
      expect(m.castShadow).toBe(false);
      expect(m.receiveShadow).toBe(true);
      expect(kit.adopt).toHaveBeenCalledWith(m);
    }
    expect(R.group.children.every((o) => o.isInstancedMesh)).toBe(true);
  });

  it('paints each kind afresh and frees only what it made, never the cast’s', async () => {
    const { kit, R, owned } = fakes();
    await createCrowd(kit, R, laid(), { loader: copyLoader() }).ready;
    for (const m of instances(R)) {
      expect(m.material.isMeshToonMaterial).toBe(true);
      expect(owned).toContain(m.material);
      expect(owned).toContain(m.geometry);
      expect(owned).toContain(m);
    }
    // the cast's materials are its own: never in the crowd's keeping
    const castMats = kit.cast.prop.mock.results.map((r) => r.value.children[0].material);
    for (const c of castMats) expect(owned).not.toContain(c);
  });

  it('breathes only a gathering, never a walker (a moving copy’s breath would jitter)', async () => {
    const { kit, R } = fakes();
    await createCrowd(kit, R, laid(), { loader: copyLoader() }).ready;
    const keys = instances(R).map((m) => [m.userData.crowd, m.material.customProgramCacheKey?.() ?? null]);
    for (const [key, prog] of keys) expect(prog === 'crowd-breath').toBe(key.startsWith('gather'));
  });

  it('walks its walkers round their loops, on the ground, bobbing', async () => {
    const { kit, R, ticks } = fakes();
    await createCrowd(kit, R, laid(), { loader: copyLoader() }).ready;
    const { lengths } = loopLengths(LOOP);
    expect(lengths).toEqual([10, 10, 10, 10]);
    const walkers = instances(R).filter((m) => m.userData.crowd === 'walk-0');
    for (const t of [0, 3.3, 17]) {
      tick(ticks, t);
      for (const m of walkers)
        for (let i = 0; i < m.count; i++) {
          const p = at(m, i);
          const onSide = Math.min(Math.abs(p.z), Math.abs(p.x - 10), Math.abs(p.z - 10), Math.abs(p.x));
          expect(onSide).toBeLessThan(1e-6);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThan(0.06);
        }
    }
    // they move
    const before = at(walkers[0], 0);
    tick(ticks, 20);
    expect(at(walkers[0], 0).distanceTo(before)).toBeGreaterThan(0.1);
  });

  it('stands a gathering in its disc, and hops it on the beat, settling after', async () => {
    const { kit, R, ticks } = fakes();
    const crowd = createCrowd(kit, R, laid(), { loader: copyLoader() });
    await crowd.ready;
    const [g] = instances(R).filter((m) => m.userData.crowd === 'gather-0');
    tick(ticks, 10);
    for (let i = 0; i < g.count; i++) {
      const p = at(g, i);
      expect(Math.hypot(p.x - 30, p.z - 30)).toBeLessThanOrEqual(3);
      expect(p.y).toBe(0);
    }
    crowd.hop();
    tick(ticks, 10.3);
    expect(at(g, 0).y).toBeGreaterThan(0.05);
    tick(ticks, 12);
    expect(at(g, 0).y).toBe(0);
  });

  it('stands a gathering up where it’s raised, along its row if it has one, and hops it on its own beat', async () => {
    const { kit, R, ticks } = fakes();
    const g0 = { ...laid().gathers[0], y: 3.2, row: 8, beat: 1.5, at: [0, 0], face: [0, -20] };
    await createCrowd(kit, R, laid({ gathers: [g0], extents: { ...laid().extents, 'gather-0': { x: 0, y: 4, z: 0, r: 8 } } }), { loader: copyLoader() }).ready;
    const [g] = instances(R).filter((m) => m.userData.crowd === 'gather-0');
    tick(ticks, 0.75);
    for (let i = 0; i < g.count; i++) {
      const p = at(g, i);
      expect(p.y).toBeGreaterThanOrEqual(3.2);
      // along the row, across the way to what they watch
      expect(Math.abs(p.z)).toBeLessThan(0.25);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(4);
    }
    // on its beat, with no one asking
    let top = 0;
    for (let t = 1.5; t < 2.1; t += 0.05) {
      tick(ticks, t);
      top = Math.max(top, at(g, 0).y - 3.2);
    }
    expect(top).toBeGreaterThan(0.05);
  });

  it('packs a small gathering close, as a group, not thin across its whole disc or row', async () => {
    const { kit, R, ticks } = fakes();
    const few = [
      { ...laid().gathers[0], key: 'gather-0', n: 4, r: 6 },
      { ...laid().gathers[0], key: 'gather-1', n: 4, row: 20, at: [60, 30], face: [60, 0] },
    ];
    await createCrowd(kit, R, laid({ gathers: few, extents: { ...laid().extents, 'gather-1': { x: 60, y: 1, z: 30, r: 12 } } }), { loader: copyLoader() }).ready;
    tick(ticks, 1);
    const [disc] = instances(R).filter((m) => m.userData.crowd === 'gather-0');
    const [row] = instances(R).filter((m) => m.userData.crowd === 'gather-1');
    for (let i = 0; i < 4; i++) expect(Math.hypot(at(disc, i).x - 30, at(disc, i).z - 30)).toBeLessThan(2.5);
    for (let i = 0; i < 4; i++) expect(Math.abs(at(row, i).x - 60)).toBeLessThan(3);
  });

  it('turns a gathering to look at someone, and back', async () => {
    const { kit, R, ticks } = fakes();
    const crowd = createCrowd(kit, R, laid(), { loader: copyLoader() });
    await crowd.ready;
    const [g] = instances(R).filter((m) => m.userData.crowd === 'gather-0');
    const yawOf = () => {
      const m = new THREE.Matrix4();
      g.getMatrixAt(0, m);
      return new THREE.Euler().setFromRotationMatrix(m, 'YXZ').y;
    };
    tick(ticks, 1);
    const watching = yawOf();
    crowd.turn([60, 30]);
    tick(ticks, 1.1);
    expect(Math.abs(yawOf() - watching)).toBeGreaterThan(0.5);
    crowd.turn(null);
    tick(ticks, 1.2);
    expect(yawOf()).toBeCloseTo(watching, 6);
  });

  it('follows someone it watches as they move, but not every step: from a quarter metre on', async () => {
    const { kit, R, ticks } = fakes();
    const crowd = createCrowd(kit, R, laid(), { loader: copyLoader() });
    await crowd.ready;
    const [g] = instances(R).filter((m) => m.userData.crowd === 'gather-0');
    const yawOf = () => {
      const m = new THREE.Matrix4();
      g.getMatrixAt(0, m);
      return new THREE.Euler().setFromRotationMatrix(m, 'YXZ').y;
    };
    crowd.turn([60, 30]);
    tick(ticks, 1);
    const a = yawOf();
    crowd.turn([60.1, 30]);
    tick(ticks, 1.1);
    expect(yawOf()).toBe(a);
    crowd.turn([30, -40]);
    tick(ticks, 1.2);
    expect(Math.abs(yawOf() - a)).toBeGreaterThan(0.3);
  });

  it('goes and comes with the story, and as the place says', async () => {
    const { kit, R, ticks } = fakes();
    const crowd = createCrowd(kit, R, laid({ gathers: [{ ...laid().gathers[0], until: 'squanch' }] }), { loader: copyLoader() });
    await crowd.ready;
    const [g] = instances(R).filter((m) => m.userData.crowd === 'gather-0');
    tick(ticks, 1, { done: [] });
    expect(g.visible).toBe(true);
    tick(ticks, 2, { done: ['squanch'] });
    expect(g.visible).toBe(false);
    tick(ticks, 3, { done: [] });
    crowd.show('gather-0', false);
    tick(ticks, 4, { done: [] });
    expect(g.visible).toBe(false);
  });

  it('goes all at once as the place says (a raid scatters the guests), and comes back', async () => {
    const { kit, R, ticks } = fakes();
    const crowd = createCrowd(kit, R, laid(), { loader: copyLoader() });
    await crowd.ready;
    crowd.show('all', false);
    tick(ticks, 1, { done: [] });
    expect(instances(R).length).toBeGreaterThan(1);
    for (const m of instances(R)) expect(m.visible, m.userData.crowd).toBe(false);
    crowd.show('all', true);
    tick(ticks, 2, { done: [] });
    for (const m of instances(R)) expect(m.visible, m.userData.crowd).toBe(true);
  });

  it('holds each mesh to the bounds its layout gives, so a walker never pops out of view', async () => {
    const { kit, R } = fakes();
    await createCrowd(kit, R, laid(), { loader: copyLoader() }).ready;
    for (const m of instances(R)) {
      const e = laid().extents[m.userData.crowd];
      expect(m.boundingSphere.center.toArray()).toEqual([e.x, e.y, e.z]);
      expect(m.boundingSphere.radius).toBe(e.r);
    }
  });

  it('stands a rigged kind in its idle, as plain geometry at its height', async () => {
    const { kit, R } = fakes();
    await createCrowd(kit, R, laid({ walkers: [{ key: 'walk-0', kinds: ['meeseeks'], n: 3, loop: LOOP, speed: 1, out: false }], gathers: [] }), { loader: copyLoader() }).ready;
    expect(kit.need).toHaveBeenCalledWith(['meeseeks'], { clips: ['idle', 'walk', 'run'] });
    const [m] = instances(R);
    expect(m.geometry.attributes.skinIndex).toBeUndefined();
    m.geometry.computeBoundingBox();
    expect(m.geometry.boundingBox.min.y).toBeCloseTo(0, 5);
    expect(m.geometry.boundingBox.max.y).toBeGreaterThan(1);
    // (the figure made to stand it, let go)
    expect(kit.cast.make.mock.results[0].value.release).toHaveBeenCalled();
  });

  it('leaves out a kind that won’t load, and stands the rest', async () => {
    const { kit, R } = fakes({ missing: ['plutonian-a'] });
    await createCrowd(kit, R, laid(), { loader: copyLoader() }).ready;
    expect(instances(R).map((m) => m.count).sort()).toEqual([3, 5]);
  });
});
