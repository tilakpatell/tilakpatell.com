import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../skyStreaks';
import * as nodes from './skyStreaks';
import { STREAKS, laneLinks } from '../skyTraffic';

const seeded = (seed = 9) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('nodes/skyStreaks, the twin of skyStreaks', () => {
  it('exports what skyStreaks exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('draws every streak in one mesh under a node material, with the original’s uniforms and flags', () => {
    const a = glsl.createSkyStreaks({ rand: seeded() });
    const s = nodes.createSkyStreaks({ rand: seeded() });
    expect(s.group.children).toHaveLength(1);
    const mesh = s.group.children[0];
    const was = a.group.children[0];
    expect(mesh.material.isNodeMaterial).toBe(true);
    expect(Object.keys(mesh.material.uniforms).sort()).toEqual(Object.keys(was.material.uniforms).sort());
    for (const k of ['transparent', 'blending', 'depthWrite', 'depthTest', 'side']) expect(mesh.material[k]).toBe(was.material[k]);
    expect(mesh.frustumCulled).toBe(false);
    expect(Object.keys(mesh.geometry.attributes).sort()).toEqual(Object.keys(was.geometry.attributes).sort());
    s.update(1 / 60);
    expect(mesh.visible).toBe(true);
    expect(mesh.geometry.drawRange.count).toBe(0);
    s.setSystem(laneLinks('coruscant'), 60);
    for (let i = 0; i < 300; i++) {
      s.update(1 / 60);
      expect(s.live).toBeGreaterThanOrEqual(STREAKS.min);
      expect(mesh.geometry.drawRange.count).toBe(s.live * 6);
    }
    s.setSystem(laneLinks('dagobah'), 60);
    s.update(1 / 60);
    expect(mesh.geometry.drawRange.count).toBe(0);
    // (the frame code writes the uniforms’ values as it did)
    const r = { getDrawingBufferSize: (v) => v.set(800, 600), getPixelRatio: () => 2 };
    const t = nodes.createSkyStreaks({ renderer: r, rand: seeded() });
    t.setSystem(laneLinks('coruscant'), 60);
    for (let i = 0; i < 600 && !t.live; i++) t.update(1 / 60);
    t.update(1 / 60);
    const u = t.group.children[0].material.uniforms;
    expect(u.uHalf.value).toBeInstanceOf(THREE.Vector2);
    expect(u.uHalf.value.toArray()).toEqual([400, 300]);
    expect(u.uWidth.value).toBeCloseTo(2.6);
    a.dispose();
    s.dispose();
    t.dispose();
  });
});
