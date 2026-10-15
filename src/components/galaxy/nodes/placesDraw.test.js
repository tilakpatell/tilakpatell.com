import { describe, expect, it } from 'vitest';
import * as glsl from '../placesDraw';
import * as nodes from './placesDraw';
import { placesOf } from '../places';
import { systemById } from '../systems';

const glows = (p) => p.group.children[1].geometry.instanceCount;

describe('nodes/placesDraw, the twin of placesDraw', () => {
  it('exports what placesDraw exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('draws every place in two draws: one mesh of the solids, one cloud of glows, node materials with the original’s uniforms and flags', () => {
    const places = placesOf(systemById('tatooine'));
    const a = glsl.createPlaces({ places, sun: [0.5, 0.3, 0.8] });
    const p = nodes.createPlaces({ places, sun: [0.5, 0.3, 0.8] });
    expect(p.group.name).toBe('places');
    expect(p.group.children).toHaveLength(2);
    const [mesh, cloud] = p.group.children;
    const [wasMesh, wasPoints] = a.group.children;
    expect(mesh.isMesh).toBe(true);
    expect(mesh.name).toBe('places-solid');
    expect(cloud.name).toBe('places-glow');
    expect(mesh.material.isNodeMaterial).toBe(true);
    expect(cloud.material.isNodeMaterial).toBe(true);
    for (const k of ['vertexColors', 'roughness', 'metalness', 'flatShading']) expect(mesh.material[k]).toBe(wasMesh.material[k]);
    // (the solids the same, vertex for vertex: the same seeded shapes)
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(Array.from(wasMesh.geometry.attributes.position.array));
    expect(Array.from(mesh.geometry.attributes.color.array)).toEqual(Array.from(wasMesh.geometry.attributes.color.array));
    // (a glow a sprite, the same many, at the same places)
    expect(glows(p)).toBe(wasPoints.geometry.attributes.position.count);
    expect(cloud.count).toBe(glows(p));
    expect(Array.from(cloud.geometry.attributes.aAt.array)).toEqual(Array.from(wasPoints.geometry.attributes.position.array));
    for (const k of ['aColor', 'aSize', 'aPhase', 'aKind']) expect(Array.from(cloud.geometry.attributes[k].array)).toEqual(Array.from(wasPoints.geometry.attributes[k].array));
    expect(Object.keys(cloud.material.uniforms).sort()).toEqual(Object.keys(wasPoints.material.uniforms).sort());
    for (const k of ['transparent', 'blending', 'depthWrite', 'depthTest', 'toneMapped']) expect(cloud.material[k]).toBe(wasPoints.material[k]);
    expect(cloud.frustumCulled).toBe(false);
    p.update(1.5, 1 / 60);
    expect(cloud.material.uniforms.uTime.value).toBe(1.5);
    a.dispose();
    p.dispose();
    expect(p.group.children).toHaveLength(0);
  });

  it('draws fewer glows on a small tier, and the same solids', () => {
    const places = placesOf(systemById('hoth'));
    const big = nodes.createPlaces({ places, sun: [0, 1, 0] });
    const small = nodes.createPlaces({ places, sun: [0, 1, 0], small: true });
    expect(glows(small)).toBeLessThan(glows(big));
    expect(small.group.children[0].geometry.attributes.position.count).toBe(big.group.children[0].geometry.attributes.position.count);
    big.dispose();
    small.dispose();
  });

  it('draws nothing solid for a system with only a nebula, but still its glow', () => {
    const p = nodes.createPlaces({ places: [{ id: 'place-nebula', kind: 'nebula', at: [900, 0, 0], r: 0, reach: 40 }], sun: [0, 1, 0] });
    expect(p.group.children).toHaveLength(2);
    expect(p.group.children[0].geometry.attributes.position.count).toBe(0);
    expect(glows(p)).toBeGreaterThan(50);
    p.dispose();
  });
});
