import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createLevel, toPack } from './level.js';

const PACK = { origin: [205, 362.3, -1540], yaw: 0, cell: 128, tex: {}, terrain: { near: {}, far: {} } };

// lane L's pieces as fakes: what each was asked, in order
function fakes() {
  const log = [];
  const deps = {
    packOf: async () => PACK,
    imageLayer: async () => ({ type: 'image', near: { data: new Float32Array([2, 2, 2, 2]), w: 2, h: 2, minX: -10, minZ: -10, metresPerPixel: 20 }, far: null }),
    createLevelLoader: () => ({ load: async () => null, dispose() {} }),
    createLevelScene: ({ scene }) => ((deps.into = scene), { setTable: () => log.push('far'), setHorizon() {}, update: (p) => log.push(['scene', ...p]), stats: () => ({ tris: 0, calls: 0, instances: 0 }), dispose() {} }),
    createLevelStream: ({ onFar, onCell, onDrop }) => ({
      update: (p) => {
        log.push(['stream', ...p]);
        onFar(new ArrayBuffer(0));
        onCell('0,0', new ArrayBuffer(32), 'near');
        onDrop('1,0');
      },
      ready: () => true,
      progress: () => 1,
      dispose() {},
    }),
  };
  return { log, deps };
}

describe('the whole map from lane L’s pack', () => {
  it('takes the map frame to the pack’s by the origin, and back', () => {
    expect(toPack(PACK, [215, 0, -1530])).toEqual([10, 10]);
    expect(toPack({ ...PACK, yaw: Math.PI / 2 }, [205, 0, -1530]).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([10, 0]);
  });

  it('draws the pack in a group at its origin, so the export’s frame is the scene’s', async () => {
    const { deps } = fakes();
    const scene = new THREE.Scene();
    const level = createLevel({ scene, tier: 'high', deps, ground: false });
    await level.ready;
    expect(deps.into.position.toArray()).toEqual(PACK.origin);
    expect(deps.into.parent).toBe(scene);
  });

  it('streams round the player in the pack’s frame, the far list first', async () => {
    const { deps, log } = fakes();
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', deps, ground: false });
    level.update([215, 380, -1530]);
    await level.ready;
    expect(log[0]).toEqual(['stream', 10, 10]);
    expect(log[1]).toBe('far');
    expect(log[2]).toEqual(['scene', 10, 10]);
  });

  it('hands the stream’s cells on, with their band, and what it drops', async () => {
    const { deps } = fakes();
    const cells = [];
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', deps, ground: false, onCell: (k, b, band) => cells.push(['add', k, b.byteLength, band]), onDrop: (k) => cells.push(['drop', k]) });
    await level.ready;
    level.update([215, 380, -1530]);
    expect(cells).toEqual([
      ['add', '0,0', 32, 'near'],
      ['drop', '1,0'],
    ]);
    expect(level.pack).toBe(PACK);
    expect(typeof level.loadBin).toBe('function');
  });

  it('reads the nav mask the pack carries, or none', async () => {
    const mask = { cols: 1 };
    const { deps } = fakes();
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', deps: { ...deps, navOf: async (world) => (world === 'hoth' ? mask : null) }, ground: false });
    expect(await level.navOf()).toBe(mask);
    const broken = createLevel({ scene: new THREE.Scene(), tier: 'high', deps: { ...deps, navOf: async () => Promise.reject(new Error('404')) }, ground: false });
    expect(await broken.navOf()).toBeNull();
  });

  it('reads the ground from the image layer, in the export’s heights', async () => {
    const { deps } = fakes();
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', deps, ground: false });
    expect(level.heightAt(205, -1540)).toBe(0);
    await level.ready;
    expect(level.heightAt(205, -1540)).toBeCloseTo(364.3, 5);
  });

  // the passes after lane 5 (the sixth design's picture lane): the game
  // material (Q1), the ground's layers (Q2), the decals (Q4)
  const NODE = { isWebGPURenderer: true, backend: { isWebGLBackend: true } };
  const GROUND = { world: 'hoth', masks: { png: 'ground/masks.png', minX: -1280, minZ: -1280, metresPerPixel: 2, w: 1281, h: 1281 } };
  const DECALS = { format: 1, cell: 128, cells: { '0,0': [{ kind: 'volume', texture: 't' }] }, files: { t: 'tex/decals/t.ktx2' } };
  const enc = (o) => new TextEncoder().encode(JSON.stringify(o)).buffer;
  function passes({ files = {}, recipes = true } = {}) {
    const { deps, log } = fakes();
    const seen = { loader: null, gameMaterials: 0, decals: null, cells: [], drops: [], grounds: [] };
    const pack = { ...PACK, ground: 'ground.json', cells: { '0,0': { bin: 'cells/0_0.bin', draws: [] } } };
    deps.packOf = async () => pack;
    deps.createLevelLoader = (o) => ((seen.loader = o), { load: async () => null, dispose() {} });
    deps.gameMaterials = async () => (seen.gameMaterials++, recipes ? { recipes: { forGlb: () => null, maps: {}, tex: {} }, materialFor: () => null, mapKeys: ['detail'], sun: null } : { recipes: null, materialFor: null });
    deps.bytesOf = () => async (path) => {
      if (files[path]) return enc(files[path]);
      throw new Error(`404 ${path}`);
    };
    deps.createDecals = (o) => ((seen.decals = o), { cell: async (...a) => seen.cells.push(a), drop: (...a) => seen.drops.push(a), dispose() {} });
    deps.attachGround = (o) => (seen.grounds.push(o), { ready: Promise.resolve(), dispose() {} });
    deps.createLevelStream = ({ onFar, onCell, onDrop }) => ({
      update: () => {
        onFar(new ArrayBuffer(0));
        onCell('0,0', new ArrayBuffer(0), 'near');
        onDrop('0,0');
      },
      ready: () => true,
      progress: () => 1,
      dispose() {},
    });
    return { deps, log, seen, pack };
  }

  it('draws a pack without recipes.json in the GLB’s materials, as before', async () => {
    const { deps, seen } = passes({ recipes: false });
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', renderer: NODE, deps, ground: false });
    await level.ready;
    expect(seen.gameMaterials).toBe(1);
    expect(seen.loader.recipes).toBeNull();
    expect(seen.loader.materialFor).toBeNull();
  });

  it('makes the loader with the game material where the pack has recipes, on the node renderer above low', async () => {
    const { deps, seen } = passes();
    const level = createLevel({ scene: new THREE.Scene(), tier: 'mid', renderer: NODE, deps, ground: false });
    await level.ready;
    expect(seen.loader.recipes).not.toBeNull();
    expect(typeof seen.loader.materialFor).toBe('function');
    expect(seen.loader.mapKeys).toEqual(['detail']);
  });

  it('draws low as lane 5 drew it: no recipes asked for, no decals, no layered ground', async () => {
    const { deps, seen } = passes({ files: { 'decals.json': DECALS, 'ground.json': GROUND } });
    const level = createLevel({ scene: new THREE.Scene(), tier: 'low', renderer: NODE, deps, ground: false });
    level.update([215, 380, -1530]);
    await level.ready;
    expect(seen.gameMaterials).toBe(0);
    expect(seen.loader.materialFor ?? null).toBeNull();
    expect(seen.decals).toBeNull();
    expect(seen.grounds).toEqual([]);
  });

  it('asks the decals for each cell the stream brings, in the pack’s group, and drops them with it', async () => {
    const { deps, seen } = passes({ files: { 'decals.json': DECALS } });
    const scene = new THREE.Scene();
    const level = createLevel({ scene, tier: 'high', renderer: NODE, deps, ground: false });
    level.update([215, 380, -1530]);
    await level.ready;
    await Promise.resolve();
    expect(seen.decals.pack).toEqual(DECALS);
    expect(seen.decals.scene).toBe(level.group);
    expect(seen.decals.backend).toBe('nodes-webgl');
    expect(seen.cells).toEqual([[0, 0, []]]);
    expect(seen.drops).toEqual([[0, 0]]);
  });

  it('skips the decals with one line, never an error, for a pack without decals.json', async () => {
    const { deps, seen } = passes();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', renderer: NODE, deps, ground: false });
    level.update([215, 380, -1530]);
    await level.ready;
    expect(seen.decals).toBeNull();
    expect(info.mock.calls.filter((c) => /decals\.json/.test(c.join(' ')))).toHaveLength(1);
    info.mockRestore();
  });

  it('lays the ground’s layers on each of its meshes, the masks read in the map’s frame', async () => {
    const { deps, seen, pack } = passes({ files: { 'ground.json': GROUND } });
    pack.terrain = { near: { min: [-8, -8], size: [3, 3], metresPerPixel: 8 }, far: { min: [-64, -64], size: [3, 3], metresPerPixel: 64 } };
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', renderer: NODE, deps, entry: { name: 'sunny' } });
    await level.ready;
    expect(seen.grounds).toHaveLength(2);
    expect(seen.grounds[0]).toMatchObject({ renderer: NODE, tier: 'high', pack, entry: { name: 'sunny' } });
    const g = JSON.parse(new TextDecoder().decode(await seen.grounds[0].fetchBytes('ground.json')));
    expect(g.masks).toMatchObject({ minX: -1075, minZ: -2820 });
    expect(seen.grounds[0].urlOf('tex/a.ktx2', 'high')).toMatch(/levels\/hoth\/tex\/a\.\d+\.ktx2$/);
  });

  // fidelity lane U's paths, taken as its hand-off says: off unless asked
  it('hands lane U’s batching, bundles and occlusion to the scene when asked, and reads the queries after each frame', async () => {
    const { deps } = fakes();
    let opts = null;
    let read = null;
    deps.createLevelScene = (o) => ((opts = o), { setTable() {}, setHorizon() {}, update() {}, stats: () => ({ tris: 0, calls: 0, instances: 0 }), afterRender: (c) => (read = c), dispose() {} });
    const Bundle = class {};
    const renderer = { isWebGPURenderer: true };
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', renderer, deps, ground: false, batch: { Bundle } });
    await level.ready;
    expect(opts).toMatchObject({ batch: true, Bundle, occlude: renderer });
    level.afterRender('cam');
    expect(read).toBe('cam');
    const plain = fakes();
    let opts2 = null;
    plain.deps.createLevelScene = (o) => ((opts2 = o), { setTable() {}, setHorizon() {}, update() {}, stats: () => ({ tris: 0, calls: 0, instances: 0 }), dispose() {} });
    const off = createLevel({ scene: new THREE.Scene(), tier: 'high', renderer, deps: plain.deps, ground: false });
    await off.ready;
    expect(opts2.batch).toBeFalsy();
    expect(() => off.afterRender('cam')).not.toThrow();
  });

  it('gives the ground’s height in the pack’s own frame, for what draws in its group', async () => {
    const { deps } = fakes();
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', deps, ground: false });
    await level.ready;
    expect(level.packHeightAt(0, 0)).toBeCloseTo(2, 5);
  });
});

