import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { readInstances, writeInstances } from '../../../lib/level/instances.js';
import { MODES, createLevel } from './level.js';

const ORIGIN = [205, 362.3, -1540];
const pack = (world) => ({
  world,
  origin: ORIGIN,
  yaw: 0,
  cell: 128,
  tex: {},
  meshes: [{ name: 'models/leaf_mesh.glb', glb: ['meshes/leaf.lod0.glb'] }, { name: 'models/crate_mesh.glb', glb: ['meshes/crate.lod0.glb'] }],
  far: { draws: [{ mesh: 0, mirrored: false, offset: 0, count: 1 }, { mesh: 1, mirrored: false, offset: 1, count: 1 }] },
  cells: {},
});
// the part's far table: a leaf at (4, 0, 2) and a crate at (6, 0, 2), in the pack's frame
const table = writeInstances({ count: 2, position: Float32Array.from([4, 0, 2, 6, 0, 2]), quaternion: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1]), scale: Float32Array.from([1, 1, 1, 1, 1, 1]) });
const MODE = { doors: [{ id: 'door', leaves: [{ side: 'left', mesh: 'models/leaf_mesh.glb', at: [4, 0, 2], slide: [1, 0, 0] }] }], gates: [], props: [], boxes: [] };

function fakes() {
  const asked = [];
  const tables = {};
  const cells = [];
  const deps = {
    packOf: async (world) => (asked.push(world), pack(world)),
    modeOf: async (world) => (world === 'hoth/ga' ? MODE : null),
    imageLayer: async () => null,
    createLevelLoader: () => ({ load: async (p) => ({ scene: new THREE.Group(), path: p }), dispose() {} }),
    createLevelScene: ({ pack: p }) => ({ setTable: (bin) => (tables[p.world] = readInstances(bin).count), setHorizon() {}, update() {}, stats: () => ({ tris: 1, calls: 1, instances: 1 }), dispose() {} }),
    createLevelStream: ({ pack: p, onFar, onCell }) => ({
      update: () => {
        if (tables[p.world] !== undefined) return;
        onFar(table);
        onCell('0,0', new ArrayBuffer(0), 'near');
      },
      ready: () => true,
      progress: () => 1,
      dispose() {},
    }),
  };
  return { asked, tables, cells, deps };
}

describe('the level’s mode part', () => {
  it('is Galactic Assault’s on Hoth', () => {
    expect(MODES.hoth.galacticAssault).toBe('ga');
  });

  it('streams with the level when its mode is played, its cells handed on as the mode’s', async () => {
    const { asked, tables, deps } = fakes();
    const parts = [];
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', ground: false, mode: 'galacticAssault', deps, onCell: (k, b, band, part) => parts.push(part ?? 'outside') });
    await level.ready;
    level.update([215, 380, -1530]);
    expect(asked.sort()).toEqual(['hoth', 'hoth/base', 'hoth/ga']);
    expect(parts.sort()).toEqual(['inside', 'mode', 'outside']);
    // (the outside's and the interior's tables whole, the part's without its door's leaf)
    expect(tables).toEqual({ hoth: 2, 'hoth/base': 2, 'hoth/ga': 1 });
    const part = level.modePart;
    expect(part.mode).toBe(MODE);
    const rows = await part.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mesh: 0, position: [4, 0, 2], is: { kind: 'leaf', id: 'door' } });
    expect(part.pack.far.draws).toEqual([{ mesh: 1, mirrored: false, offset: 0, count: 1 }]);
    expect(level.stats().tris).toBe(3);
    level.dispose();
  });

  it('is not there for another mode, nor on a level without one', async () => {
    const { asked, deps } = fakes();
    const level = createLevel({ scene: new THREE.Scene(), tier: 'high', ground: false, mode: 'hvv', deps });
    await level.ready;
    expect(asked.sort()).toEqual(['hoth', 'hoth/base']);
    expect(level.modePart).toBeNull();
    const other = createLevel({ scene: new THREE.Scene(), tier: 'high', ground: false, world: 'endor', inside: null, mode: 'galacticAssault', deps });
    await other.ready;
    expect(other.modePart).toBeNull();
  });
});
