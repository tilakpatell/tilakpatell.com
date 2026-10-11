import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLSL_POOL, createLevelLights, lightScale } from './levelLights';

const json = {
  cell: 128,
  cells: {
    '0,0': [
      { kind: 'point', pos: [2, 1, 2], color: [1, 0.5, 0.2], candela: 1000, range: 8 },
      { kind: 'point', pos: [60, 1, 60], color: [1, 1, 1], candela: 1000, range: 8 },
      { kind: 'spot', pos: [3, 3, 3], color: [1, 1, 1], candela: 1000, range: 8, cone: [0.4, 0.8], dir: [0, -1, 0] },
    ],
  },
};

describe('the level’s placed lights on the classic renderer', () => {
  it('scales the game’s units by the record’s exposure', () => {
    expect(lightScale({ main: 'sunny', weathers: { sunny: { tonemap: { compensation: 1.5, maxEV: 15 } } } })).toBeCloseTo(2 ** 1.5 / (1.2 * 2 ** 15), 9);
  });

  it('fills a pool of three with the nearest points, none on low', async () => {
    const scene = new THREE.Scene();
    expect(await createLevelLights({ scene, renderer: {}, json, tier: 'low' })).toBe(null);
    const l = await createLevelLights({ scene, renderer: {}, json, tier: 'high', scale: 0.01 });
    expect(scene.children).toHaveLength(GLSL_POOL);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    expect(l.update(camera)).toBe(2);
    expect(scene.children[0].intensity).toBeCloseTo(10, 5);
    expect(scene.children[0].color.g).toBeCloseTo(0.5, 5);
    expect(scene.children[2].intensity).toBe(0);
    l.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
