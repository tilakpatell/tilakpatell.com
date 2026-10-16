import { describe, expect, it } from 'vitest';
import { LOW_LAMPS, POINT_FALLBACK, POINT_POOL, appendLights, cellOf, cellsNear, createPlacedLights, lampPool, lightsFor, lumensToCandela, screenArea } from './placed';

describe('lumensToCandela', () => {
  it('a 1,000 lm sphere is 79.6 cd; a 1,000 lm 60° cone 1,188 cd', () => {
    expect(lumensToCandela(1000, 'point')).toBeCloseTo(79.6, 1);
    expect(lumensToCandela(1000, 'spot', Math.PI / 3)).toBeCloseTo(1188, 0);
  });
});

describe('cells', () => {
  it('bins by 128 m, negatives below zero', () => {
    expect(cellOf([10, 5, 300])).toBe('0,2');
    expect(cellOf([-1, 0, -129])).toBe('-1,-2');
    expect(cellsNear([10, 0, 10])).toHaveLength(9);
    expect(cellsNear([10, 0, 10])).toContain('-1,1');
  });
});

// 300 lamps on a 30 × 10 grid, 4 m apart, round a camera at the origin
const grid = () => {
  const cells = {};
  for (let ix = 0; ix < 30; ix++) {
    for (let iz = 0; iz < 10; iz++) {
      const pos = [(ix - 15) * 40, 2, (iz - 5) * 40];
      (cells[cellOf(pos)] ??= []).push({ kind: 'point', pos, range: 8, candela: 80, color: [1, 1, 1] });
    }
  }
  return { cells };
};
const camera = { position: [0, 2, 0], fov: 60 };

describe('lightsFor', () => {
  it('keeps the near ones first, culls the far and fades the band', () => {
    const json = grid();
    const all = Object.keys(json.cells);
    const picked = lightsFor(json, all, camera, { max: 1024 });
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThan(300);
    for (let i = 1; i < picked.length; i++) expect(picked[i].area).toBeLessThanOrEqual(picked[i - 1].area);
    // the nearest is the one the camera stands by
    const first = json.cells[picked[0].cell][picked[0].i];
    expect(Math.hypot(first.pos[0], first.pos[2])).toBeLessThan(1);
    expect(picked[0].weight).toBe(1);
    // the band between the cull and the fade area is faded, nothing under the cull is kept
    const band = picked.filter((p) => p.weight < 1);
    expect(band.length).toBeGreaterThan(0);
    for (const p of band) expect(p.area).toBeLessThan(0.01);
    for (const p of picked) expect(p.area).toBeGreaterThan(0.005);
    // a light out of reach of the cull: 8 m of reach at 400 m
    expect(screenArea({ pos: [400, 2, 0], range: 8 }, camera)).toBeLessThan(0.005);
  });
  it('takes at most max, the best', () => {
    const json = grid();
    const ten = lightsFor(json, Object.keys(json.cells), camera, { max: 10 });
    expect(ten).toHaveLength(10);
    expect(ten[9].area).toBeGreaterThanOrEqual(lightsFor(json, Object.keys(json.cells), camera, { max: 11 })[10].area);
  });
});

const sceneStub = () => {
  const kids = [];
  return { kids, add: (o) => kids.push(o) };
};

describe('createPlacedLights', () => {
  it('the pool never grows: 2,000 lights asked, 1,024 lit, the scene’s children the same', async () => {
    const scene = sceneStub();
    const renderer = { isWebGPURenderer: true, backend: { isWebGPUBackend: true }, lighting: 'base' };
    const placed = await createPlacedLights(scene, renderer);
    expect(placed.clustered).toBe(true);
    expect(renderer.lighting.maxLights).toBe(POINT_POOL);
    const group = scene.kids[0];
    const n = group.children.length;
    const many = Array.from({ length: 2000 }, (_, i) => ({ kind: 'point', pos: [i, 0, 0], candela: 10, range: 5 }));
    expect(placed.set(many)).toBe(POINT_POOL);
    expect(group.children.length).toBe(n);
    expect(placed.set(many.slice(0, 3))).toBe(3);
    expect(placed.pools.points[3].intensity).toBe(0);
    expect(group.children.length).toBe(n);
    placed.dispose();
    expect(renderer.lighting).toBe('base');
  });
  // (the pool is 1,040 lights in the scene graph, still but for the few the
  // frame moves: their matrices are made where they are moved, not
  // recomposed every frame, which was a fifth of Battlefront's graph's)
  it('keeps its lights’ matrices still, made again only for a light it moves', async () => {
    const placed = await createPlacedLights(sceneStub(), { isWebGPURenderer: true, backend: { isWebGPUBackend: true } }, { points: 4, spots: 2 });
    const all = [...placed.pools.points, ...placed.pools.spots, ...placed.pools.spots.map((s) => s.target)];
    expect(all.every((l) => l.matrixAutoUpdate === false)).toBe(true);
    placed.set([
      { kind: 'point', pos: [3, 2, 1], candela: 10, range: 5 },
      { kind: 'spot', pos: [0, 5, 0], dir: [0, -1, 0], candela: 10, range: 9 },
    ]);
    expect(placed.pools.points[0].matrix.elements.slice(12, 15)).toEqual([3, 2, 1]);
    expect(placed.pools.spots[0].matrix.elements.slice(12, 15)).toEqual([0, 5, 0]);
    expect(placed.pools.spots[0].target.matrix.elements.slice(12, 15)).toEqual([0, 4, 0]);
    expect(placed.pools.points[0].matrixWorldNeedsUpdate).toBe(true);
    // (one moved nowhere is not made again)
    placed.pools.points[1].matrixWorldNeedsUpdate = false;
    placed.set([{ kind: 'point', pos: [3, 2, 1], candela: 10, range: 5 }]);
    expect(placed.pools.points[1].matrixWorldNeedsUpdate).toBe(false);
  });
  it('spots go to their own pool, cone and penumbra from the record', async () => {
    const placed = await createPlacedLights(sceneStub(), { isWebGPURenderer: true, backend: { isWebGPUBackend: true } }, { points: 4 });
    placed.set([{ kind: 'spot', pos: [0, 5, 0], dir: [0, -1, 0], cone: [Math.PI / 6, Math.PI / 3], candela: 1188, range: 20, color: [1, 0.9, 0.8] }]);
    const s = placed.pools.spots[0];
    expect(s.angle).toBeCloseTo(Math.PI / 6);
    expect(s.penumbra).toBeCloseTo(0.5);
    expect(s.intensity).toBe(1188);
    expect(s.target.position.y).toBe(4);
    expect(placed.pools.spots).toHaveLength(16);
  });
  it('on the node renderer over WebGL 2 the points are the fallback pool, unclustered', async () => {
    const renderer = { isWebGPURenderer: true, backend: { isWebGLBackend: true }, lighting: 'base' };
    const placed = await createPlacedLights(sceneStub(), renderer);
    expect(placed.clustered).toBe(false);
    expect(placed.pools.points).toHaveLength(POINT_FALLBACK);
    expect(renderer.lighting).toBe('base');
  });
  it('update(camera) fills the pools from the cells round the camera', async () => {
    const placed = await createPlacedLights(sceneStub(), null, { points: 8, spots: 0, source: grid() });
    expect(placed.update(camera)).toBe(8);
  });
});

describe('particle lights (the GPU-first design’s N5)', () => {
  const pt = (tag) => ({ kind: 'point', pos: [0, 0, 0], candela: 10, range: 3, tag });
  it('go after the placed lights, oldest first, and the newest are dropped past the cap, never a placed one (Review Focus 5)', () => {
    const placed = [pt('a'), pt('b'), pt('c')];
    const particle = [pt('old'), pt('mid'), pt('new')];
    expect(appendLights(placed, particle, 5).map((l) => l.tag)).toEqual(['a', 'b', 'c', 'old', 'mid']);
    expect(appendLights(placed, particle, 3).map((l) => l.tag)).toEqual(['a', 'b', 'c']);
    expect(appendLights(placed, particle, 2).map((l) => l.tag)).toEqual(['a', 'b']);
    expect(appendLights(placed, [], 9)).toHaveLength(3);
  });
  it('a spot among the particle lights is not one: only points join the cluster', () => {
    expect(appendLights([], [{ kind: 'spot', pos: [0, 0, 0] }, pt('p')], 4).map((l) => l.tag)).toEqual(['p']);
  });
  it('update(camera, extra) lights the placed first and the particles in what is left of the pool', async () => {
    const placed = await createPlacedLights(sceneStub(), null, { points: 80, spots: 0, source: grid() });
    // (the lamps round the camera, fewer than the pool: the sparks get the rest)
    const lamps = placed.update(camera);
    expect(lamps).toBeGreaterThan(0);
    expect(lamps).toBeLessThan(80);
    const sparks = Array.from({ length: 50 }, (_, i) => ({ kind: 'point', pos: [i, 1, 0], candela: 99, range: 2, color: [1, 0.6, 0.2] }));
    expect(placed.update(camera, sparks)).toBe(Math.min(80, lamps + 50));
    expect(placed.pools.points.filter((l) => l.intensity === 99)).toHaveLength(Math.min(50, 80 - lamps));
    // (the oldest spark first after the lamps)
    expect(placed.pools.points[lamps].position.x).toBe(0);
    expect(placed.update(camera)).toBe(lamps);
  });
});

// (Low is the floor: without clustering every lit pixel walks the whole
// pool, 64 points and 16 spots, so Low's is the nearest few)
describe('the lamps a tier draws', () => {
  it('is the nearest 8 points and 2 spots at Low, the video setting’s nearest pool, or the backend’s own', () => {
    expect(LOW_LAMPS).toEqual({ points: 8, spots: 2 });
    expect(lampPool('low', { localLights: 'all' })).toEqual(LOW_LAMPS);
    expect(lampPool('high', { localLights: 'nearest' })).toEqual({ points: POINT_FALLBACK });
    expect(lampPool('high', { localLights: 'all' })).toEqual({});
    expect(lampPool('ultra', null)).toEqual({});
  });
});
