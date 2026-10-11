import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
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
});
