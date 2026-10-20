import { describe, expect, it } from 'vitest';
import { createKitScatter } from './kitScatter';
import { loadKit } from './kitNodes';
import { MANIFEST, fakeLoad } from './kit.fixture';

const scatterOf = (opts = {}) => {
  const kits = new Map();
  const kitFor = (tint, pack) => {
    const id = `${pack ?? 'naturemega'}|${JSON.stringify(tint)}`;
    if (!kits.has(id)) kits.set(id, loadKit('naturemega', { load: fakeLoad(), manifest: MANIFEST, tint }));
    return kits.get(id);
  };
  return { scatter: createKitScatter({ kitFor, ...opts }), kits };
};
const at = (model, x, z = 0, more = {}) => ({ model, x, y: 0, z, yaw: 0, scale: 1, ...more });

describe('createKitScatter', () => {
  it('hands each key’s items to a pool a model, and takes them back when the key goes', async () => {
    const { scatter } = scatterOf();
    await scatter.set('a', [at('Birch_1', 0), at('Birch_1', 5), at('Fern_1', 2)]);
    await scatter.set('b', [at('Fern_1', 9)]);
    expect(scatter.stats).toEqual({ pools: 2, total: 4 });
    scatter.free('a');
    await new Promise((r) => setTimeout(r, 0));
    expect(scatter.stats.total).toBe(1);
    expect(scatter.group.children).toHaveLength(2);
    scatter.dispose();
  });

  it('lets a later set for a key stand in for an earlier one, and moves a set along z', async () => {
    const { scatter } = scatterOf();
    await scatter.set('a', [at('Birch_1', 0), at('Fern_1', 1)]);
    await scatter.set('a', [at('Rock_1', 0)], 100);
    await new Promise((r) => setTimeout(r, 0));
    expect(scatter.stats).toEqual({ pools: 3, total: 1 });
    scatter.dispose();
  });

  it('leaves out a model the kit hasn’t, and a tint is its own pool', async () => {
    const { scatter, kits } = scatterOf();
    await scatter.set('a', [at('Nothing_1', 0), at('Fern_1', 0), at('Fern_1', 3, 0, { tint: { Leaves: '#ff0000' } })]);
    expect(scatter.stats).toEqual({ pools: 2, total: 2 });
    expect(kits.size).toBe(2);
    scatter.dispose();
  });

  it('casts the sun’s shadow from the trees and rocks only, and none on low', async () => {
    const shadowed = async (tier) => {
      const { scatter } = scatterOf({ tier });
      await scatter.set('a', [at('Birch_1', 0), at('Fern_1', 0), at('Rock_1', 0)]);
      await scatter.ready;
      const casting = new Set();
      scatter.group.traverse((o) => o.isInstancedMesh && o.castShadow && casting.add(o.name.split(':')[0]));
      scatter.dispose();
      return [...casting].sort();
    };
    expect(await shadowed('high')).toEqual(['Birch_1', 'Rock_1']);
    expect(await shadowed('low')).toEqual([]);
  });
});
