import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import hoth from '../light/fixtures/hoth.ve.json';
import { createLayeredGround, weightsFor, heightBlend, layersFor, macroFade, meanTint, planarShare, triplanarWeights, TIER_LAYERS } from './layeredGround.js';

const ground = JSON.parse(readFileSync(new URL('../../../../public/models/galaxy/bf2017/levels/hoth/ground.json', import.meta.url), 'utf8'));

// every map present: a stub texture per layer, the sparkle and the masks
async function stubMaps(THREE, { only = null } = {}) {
  const layers = {};
  for (const l of ground.layers) if (!only || only.includes(l.id)) layers[l.id] = new THREE.Texture();
  return { layers, sparkle: new THREE.Texture(), masks: new THREE.Texture() };
}

describe('the pure parts', () => {
  it('triplanar weights sum to one (Review Focus 4)', () => {
    for (const n of [
      [0, 1, 0],
      [0.7, 0.7, 0],
      [0.3, 0.5, 0.81],
      [-0.9, 0.1, 0.42],
    ]) {
      const w = triplanarWeights(n);
      expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 6);
    }
    expect(triplanarWeights([0, 1, 0])).toEqual([0, 1, 0]);
  });
  it('planar under 30°, triplanar over 40°, the transition over 10° about 35°', () => {
    expect(planarShare(10)).toBe(1);
    expect(planarShare(30)).toBe(1);
    expect(planarShare(35)).toBeCloseTo(0.5);
    expect(planarShare(40)).toBe(0);
    expect(planarShare(60)).toBe(0);
  });
  it('height blending: the mask alone where the heights are flat, sharpened and normalised where they vary (Review Focus 2)', () => {
    const m = [0.5, 0.5, 0, 0];
    const flat = heightBlend(m, [0.5, 0.5, 0.5, 0.5], 4);
    expect(flat[0]).toBeCloseTo(0.5);
    expect(flat[1]).toBeCloseTo(0.5);
    const sharp = heightBlend(m, [0.9, 0.3, 0.5, 0.5], 4);
    expect(sharp[0] + sharp[1] + sharp[2] + sharp[3]).toBeCloseTo(1);
    expect(sharp[0]).toBeGreaterThan(0.95);
    // (no mask, no layer, however high its height)
    expect(heightBlend([1, 0, 0, 0], [0.1, 1, 1, 1], 4)[0]).toBeCloseTo(1);
  });
  it('the macro fade: none at 300 m, whole by the fade’s end, no step between (Review Focus 3)', () => {
    expect(macroFade(50, ground.fade)).toBe(0);
    expect(macroFade(300, ground.fade)).toBe(0);
    expect(macroFade(500, ground.fade)).toBe(1);
    let last = 0;
    for (let d = 300; d <= 450; d += 5) {
      const f = macroFade(d, ground.fade);
      expect(f - last).toBeLessThan(0.06);
      last = f;
    }
  });
  it('the layers a tier draws: four on ultra and high, the two biggest on mid, none on low (Review Focus 5)', () => {
    expect(TIER_LAYERS).toEqual({ ultra: 4, high: 4, mid: 2, low: 0 });
    expect(layersFor(ground, 'ultra').map((l) => l.id)).toEqual(['rocky', 'chunky', 'rough', 'packed']);
    expect(layersFor(ground, 'mid').map((l) => l.id)).toEqual(['chunky', 'packed']);
    expect(layersFor(ground, 'low')).toEqual([]);
  });
  it('the weights a tier draws: the last layer the mask’s remainder, a dropped layer’s ground to the kept layer with the most', () => {
    const all = layersFor(ground, 'ultra');
    // a pure rock pixel: r 1
    expect(weightsFor([1, 0, 0], ground, all)).toEqual({ rocky: 1, chunky: 0, rough: 0, packed: 0 });
    // the open field: nothing in r, g, b
    expect(weightsFor([0, 0, 0], ground, all)).toEqual({ rocky: 0, chunky: 0, rough: 0, packed: 1 });
    // mid draws chunky and packed: the rock's ground goes to the packed snow, never to nothing
    expect(weightsFor([1, 0, 0], ground, layersFor(ground, 'mid'))).toEqual({ chunky: 0, packed: 1 });
    const w = weightsFor([0.2, 0.3, 0.1], ground, layersFor(ground, 'mid'));
    expect(w.chunky).toBeCloseTo(0.3);
    expect(w.packed).toBeCloseTo(0.7);
  });
  it('the far colour is the near colour’s mean, so the fade has no seam', () => {
    const t = meanTint(ground);
    expect(t).toBeGreaterThan(0.9);
    expect(t).toBeLessThan(1.1);
  });
});

describe('createLayeredGround', () => {
  it('a node material: 4 detail + 2 triplanar + 1 sparkle + 1 mask samples on ultra and high', async () => {
    const three = await loadThree();
    for (const tier of ['ultra', 'high']) {
      const g = createLayeredGround({ ground, maps: await stubMaps(three.THREE), tier, three, entry: hoth.sunny });
      expect(g.material.isNodeMaterial).toBe(true);
      expect(g.material.colorNode).toBeTruthy();
      expect(g.material.normalNode).toBeTruthy();
      expect(g.material.roughnessNode).toBeTruthy();
      expect(g.material.emissiveNode).toBeTruthy();
      expect(g.samples).toEqual({ detail: 4, triplanar: 2, sparkle: 1, mask: 1 });
      g.dispose();
    }
  });
  it('mid draws two layers, no triplanar and no sparkle; low the macro only', async () => {
    const three = await loadThree();
    const mid = createLayeredGround({ ground, maps: await stubMaps(three.THREE), tier: 'mid', three, entry: hoth.sunny });
    expect(mid.samples).toEqual({ detail: 2, triplanar: 0, sparkle: 0, mask: 1 });
    const low = createLayeredGround({ ground, maps: await stubMaps(three.THREE), tier: 'low', three, entry: hoth.sunny });
    expect(low.samples).toEqual({ detail: 0, triplanar: 0, sparkle: 0, mask: 0 });
    expect(low.material.normalNode).toBe(null);
  });
  it('a layer whose map has not landed draws its mask’s roughness and colour without detail', async () => {
    const three = await loadThree();
    const g = createLayeredGround({ ground, maps: await stubMaps(three.THREE, { only: ['packed'] }), tier: 'ultra', three, entry: hoth.sunny });
    expect(g.samples.detail).toBe(1);
    expect(g.samples.triplanar).toBe(0);
    const none = createLayeredGround({ ground, maps: { layers: {}, sparkle: null, masks: new three.THREE.Texture() }, tier: 'ultra', three, entry: hoth.sunny });
    expect(none.samples).toEqual({ detail: 0, triplanar: 0, sparkle: 0, mask: 1 });
    expect(none.material.roughnessNode).toBeTruthy();
  });
  it('the sun’s direction is a uniform the light stack moves', async () => {
    const three = await loadThree();
    const g = createLayeredGround({ ground, maps: await stubMaps(three.THREE), tier: 'ultra', three, entry: hoth.sunny });
    g.setSun([0, 1, 0]);
    expect(g.uniforms.sun.value.y).toBe(1);
    g.update({ position: { x: 0, y: 2, z: 0 } });
  });
});

describe('what a tier fetches (review: low and mid fetched maps they never draw)', () => {
  it('low fetches no masks, no layer maps, no sparkle; mid its two layers and the masks; ultra and high all', async () => {
    const { mapsFor } = await import('./layeredGround.js');
    expect(mapsFor(ground, 'low')).toEqual({ masks: false, layers: [], sparkle: false });
    expect(mapsFor(ground, 'mid')).toEqual({ masks: true, layers: ['chunky', 'packed'], sparkle: false });
    expect(mapsFor(ground, 'high')).toEqual({ masks: true, layers: ['rocky', 'chunky', 'rough', 'packed'], sparkle: true });
    expect(mapsFor(ground, 'ultra').sparkle).toBe(true);
  });
  it('attachLayeredGround on low fetches ground.json alone', async () => {
    const { attachLayeredGround } = await import('./layeredGround.js');
    const calls = [];
    const fetchBytes = async (p) => {
      calls.push(p);
      if (p === 'ground.json') return new TextEncoder().encode(JSON.stringify(ground)).buffer;
      throw new Error('404');
    };
    const three = await loadThree();
    const mesh = new three.THREE.Mesh(new three.THREE.PlaneGeometry(), new three.THREE.MeshBasicMaterial());
    const g = attachLayeredGround({ mesh, renderer: null, pack: { ground: 'ground.json' }, tier: 'low', fetchBytes, urlOf: (p) => p });
    await g.ready;
    expect(calls).toEqual(['ground.json']);
    expect(mesh.material.name).toBe('layered-ground:hoth');
    g.dispose();
  });
});
