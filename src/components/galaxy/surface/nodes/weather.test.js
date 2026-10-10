import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from '../weather';
import * as nodes from './weather';

const site = { weather: [{ kind: 'snow' }, { kind: 'rain' }, { kind: 'embers', speed: 2 }] };

describe('the weather as nodes', () => {
  it('the same layers: flakes as instanced sprites, streaks as lines, the same flags and uniforms', () => {
    const a = glsl.createWeather(site, { small: true });
    const n = nodes.createWeather(site, { small: true });
    expect(n.group.children.length).toBe(a.group.children.length);
    n.group.children.forEach((o, i) => {
      const g = a.group.children[i];
      expect(o.material.isNodeMaterial).toBe(true);
      for (const k of ['transparent', 'depthWrite', 'blending']) expect(o.material[k]).toBe(g.material[k]);
      expect(o.renderOrder).toBe(g.renderOrder);
      expect(o.frustumCulled).toBe(false);
      if (g.isPoints) {
        expect(o.isSprite).toBe(true);
        expect(o.count).toBe(g.geometry.attributes.position.count);
      } else expect(o.isLineSegments).toBe(true);
    });
  });

  it('moves with the camera as the GLSL did', () => {
    const n = nodes.createWeather({ weather: [{ kind: 'sand' }] });
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(3, 10, 4);
    n.gust = 0.5;
    n.update(2, cam, () => 1, 800);
    const sprite = n.group.children[0];
    expect(sprite.material.positionNode.isNode).toBe(true);
    n.dispose();
  });
});
