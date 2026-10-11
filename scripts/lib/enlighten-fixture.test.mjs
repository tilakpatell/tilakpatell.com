import { describe, expect, it } from 'vitest';
import { directionalIrradiance } from '../../src/lib/three/light/baked.js';
import { CHART, SIZE, SPAN, fixtureScene, gatherTexel, openIrradiance, skyRadiance, texelToWorld } from './enlighten-fixture.mjs';

const sky = { zenith: [1453.403, 2732.907, 6231.313], horizon: [133.256, 179.571, 303.305], ground: [113.678, 158.67, 272.709] };
const sun = { dir: [0, 1, 0], lux: 128000 };
const scene = fixtureScene();

describe('the fixture atlas’s gather', () => {
  it('the sky: zenith straight up, horizon level, ground below', () => {
    expect(skyRadiance(sky, [0, 1, 0])).toEqual(sky.zenith);
    expect(skyRadiance(sky, [1, 0, 0])).toEqual(sky.horizon);
    expect(skyRadiance(sky, [0, -1, 0])).toBe(sky.ground);
  });
  it('an open texel sees all the sky, and its directions decode back to its irradiance at the up normal', () => {
    const t = gatherTexel(20, 20, scene, sky, sun, 64);
    expect(t.sky).toBe(1);
    const open = openIrradiance(sky, [0, 1, 0], 64);
    for (let c = 0; c < 3; c++) expect(t.irr[c]).toBeCloseTo(open[c], 6);
    const back = directionalIrradiance(t.irr, t.dirs, [0, 1, 0]);
    for (let c = 0; c < 3; c++) expect(back[c]).toBeCloseTo(t.irr[c], 6);
    // (the sky is brighter overhead: a surface tipped toward the horizon gets less)
    expect(directionalIrradiance(t.irr, t.dirs, [1, 0, 0])[2]).toBeLessThan(t.irr[2]);
  });
  it('a texel at a pillar’s foot sees less sky than an open one', () => {
    const foot = gatherTexel(10.6, 0, scene, sky, sun, 64);
    expect(foot.sky).toBeLessThan(0.9);
  });
  it('the chart maps the atlas over SPAN metres at the ground’s centre', () => {
    const [x0, z0] = texelToWorld(0, 0);
    const [x1, z1] = texelToWorld(SIZE - 1, SIZE - 1);
    expect(x1 - x0).toBeCloseTo(SPAN * (1 - 1 / SIZE), 6);
    expect(z0 - z1).toBeCloseTo(SPAN * (1 - 1 / SIZE), 6);
    expect(x0 + x1).toBeCloseTo(0, 6);
    expect(CHART[0]).toBeCloseTo(200 / SPAN, 6);
  });
});
