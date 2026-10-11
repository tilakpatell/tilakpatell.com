import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { djb2, hashName, namesFrom, resolveDepot, resolveHashes } from './bf2017-shader-names.mjs';

const depot = JSON.parse(readFileSync(new URL('../fixtures/bf2017/depots/stardestroyer_floorplatform.json', import.meta.url), 'utf8'));

describe('hashName', () => {
  it('is djb2-xor of the lower-cased name, eight hex digits', () => {
    expect(hashName('vec')).toBe('0b877b75');
    expect(hashName('Boolean')).toBe('87d71101');
    expect(hashName('smoothness')).toBe('dd4eafac');
  });

  it('hashes lower case: the case of a name never matters, the raw hash does differ', () => {
    expect(hashName('boolean')).toBe(hashName('Boolean'));
    expect(hashName('Smoothness')).toBe(hashName('smoothness'));
    // (the depots' type hashes are raw case: Vec, not vec)
    expect(djb2('Vec')).toBe('0b87fa95');
    expect(djb2('Boolean')).not.toBe(hashName('Boolean'));
  });

  it("names a variation the mesh variation database's way", () => {
    // (Hoth's MVDB: Box_M_01_A_Snow's VariationAssetNameHash 2773463200)
    expect(parseInt(hashName('Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow'), 16)).toBe(2773463200);
  });
});

describe('namesFrom', () => {
  it("takes the dump's keys, the variations' parameter names and the presets' parameters", () => {
    const names = namesFrom({
      materials: [
        {
          materials: [
            {
              textures: { _CS: 'a' },
              vectors: { GlobalTilingDetailmap: [1, 1, 0, 0] },
              bools: { Lit: true },
            },
          ],
        },
      ],
      variations: [
        {
          objects: [
            {
              Shader: {
                VectorParameters: [{ ParameterName: 'PaintColour' }],
                BoolParameters: [{ ParameterName: 'ESB_PanelEnable' }],
              },
            },
          ],
        },
      ],
      presets: [{ objects: [{ Parameters: [{ Name: 'DetailTiling' }] }] }],
    });
    expect([...names].sort()).toEqual(['DetailTiling', 'ESB_PanelEnable', 'GlobalTilingDetailmap', 'Lit', 'PaintColour', '_CS']);
  });
});

describe('resolveDepot', () => {
  const names = new Set(['GlobalTilingDetailmap', 'Smoothness', 'DetailTiling', 'PaintColour']);

  it("names a row's parameters, their types and a Vec's four floats", () => {
    const r = resolveDepot([depot], names);
    const tiling = r.params.find((p) => p.name === 'GlobalTilingDetailmap');
    expect(tiling).toEqual({
      name: 'GlobalTilingDetailmap',
      type: 'Vec',
      value: [6, 3, 0, 0],
    });
    expect(r.params.find((p) => p.name === 'Smoothness').value[0]).toBeCloseTo(0.5);
    expect(r.resolved).toBe(3);
  });

  it('leaves an unknown hash as the hash, never a guess, and counts it', () => {
    const r = resolveDepot([depot], names);
    const unknown = r.params.find((p) => !p.name);
    expect(unknown).toEqual({ hash: '4667cc35', type: 'Boolean', value: '01' });
    expect(r.unresolved).toEqual({ '4667cc35': 1 });
  });
});

describe('resolveHashes', () => {
  it('maps numeric hashes to the names that make them', () => {
    const m = resolveHashes(['Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow']);
    expect(m.get(2773463200)).toBe('Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow');
  });
});
