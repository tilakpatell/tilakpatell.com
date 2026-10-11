import { describe, expect, it } from 'vitest';
import { CLOUD_EDGE, cloudDensity, cloudShadowNode, cloudTerm, drift, readClouds } from './clouds';
import hoth from './fixtures/hoth.ve.json';

describe('readClouds', () => {
  it('the record’s two layers: Hoth’s 8,192 m at coverage 1 and exponent 1, its 500 m at 0.3 and 8', () => {
    const c = readClouds(hoth.sunny);
    expect(c.layers.map(({ size, coverage, exponent }) => ({ size, coverage, exponent }))).toEqual([
      { size: 8192, coverage: 1, exponent: 1 },
      { size: 500, coverage: 0.3, exponent: 8 },
    ]);
    expect(c.on).toBe(true);
  });
  it('a record with no drift drifts on the wind (Hoth: 5 m/s, toward +Z)', () => {
    const c = readClouds(hoth.sunny);
    expect(c.layers[0].speed[0]).toBeCloseTo(0);
    expect(c.layers[0].speed[1]).toBeCloseTo(5);
    const own = readClouds({ record: { OutdoorLightComponentData: [{ CloudShadowCoverage: 1, 'CloudShadowSpeed.x': 2, 'CloudShadowSpeed.y': -1 }] } });
    expect(own.layers[0].speed).toEqual([2, -1]);
  });
  it('off where every layer’s coverage is 0', () => {
    expect(readClouds({ record: { OutdoorLightComponentData: [{ CloudShadowCoverage: 0, SecondaryCloudShadowCoverage: 0 }] } }).on).toBe(false);
  });
});

describe('the cloud term', () => {
  it('stays in 0…1, is 1 where there is no cloud, darkest under the thickest', () => {
    for (let n = 0; n <= 1; n += 0.05) {
      const d = cloudDensity(n);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
      for (const [cov, exp] of [[1, 1], [0.3, 8]]) {
        const t = cloudTerm(d, cov, exp);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1);
      }
    }
    expect(cloudDensity(CLOUD_EDGE[0])).toBe(0);
    expect(cloudTerm(0, 1, 1)).toBe(1);
    expect(cloudTerm(1, 1, 1)).toBe(0);
    expect(cloudTerm(1, 0.3, 8)).toBeCloseTo(0.7);
    // the exponent thins the secondary layer to its densest cores
    expect(cloudTerm(0.5, 0.3, 8)).toBeGreaterThan(0.99);
  });
  it('drifts with time at the layer’s speed', () => {
    const layer = { speed: [0, 5] };
    expect(drift(layer, 0)).toEqual([0, 0]);
    expect(drift(layer, 10)).toEqual([0, 50]);
  });
});

describe('cloudShadowNode', () => {
  it('a node and its clock; none where the record has no cloud', async () => {
    const c = await cloudShadowNode(hoth.sunny);
    expect(c.node).toBeTruthy();
    c.update(2);
    expect(c.offsets[0].value.y).toBeCloseTo(10);
    expect(await cloudShadowNode({ record: { OutdoorLightComponentData: [{ CloudShadowCoverage: 0, SecondaryCloudShadowCoverage: 0 }] } })).toBe(null);
  });
  it('takes the record’s cloud texture for its first layer (lane Q6), the drift the same', async () => {
    const { Texture } = await import('three/webgpu');
    const plain = await cloudShadowNode(hoth.sunny);
    const painted = await cloudShadowNode(hoth.sunny, null, { texture: new Texture(), offset: [0, 0], rgbm: true });
    expect(painted.node).toBeTruthy();
    expect(painted.node).not.toBe(plain.node);
    expect(painted.layers).toHaveLength(2);
    painted.update(2);
    expect(painted.offsets[0].value.y).toBeCloseTo(10);
  });
});
