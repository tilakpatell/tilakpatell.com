import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFog } from './fog';
import { nebulaBudget } from './budget';
import { fogLayers } from './rules';
import { NEBULA_FIELD } from './shaders';
import { reservedIn } from '../__fixtures__/glsl';

const made = (row = nebulaBudget('high')) => {
  const volume = new THREE.Data3DTexture(new Uint8Array(2), 1, 1, 1);
  return { volume, f: createFog({ volume, row }) };
};
const CLOUD = { centre: [0, 0, -100], r: 700, colours: [new THREE.Color(), new THREE.Color(), new THREE.Color()], seed: [0.1, 0.2, 0.3], form: 0, depth: 0.8 };

describe('the fog round the ship', () => {
  it('shows its layers far to near, and hides', () => {
    const { f } = made();
    f.show(CLOUD, fogLayers(nebulaBudget('high'), 700));
    expect(f.mesh.visible).toBe(true);
    expect(f.mesh.geometry.instanceCount).toBe(4);
    const radii = [0, 1, 2, 3].map((i) => f.mesh.geometry.attributes.aLayer.getX(i));
    expect(radii).toEqual([...radii].sort((a, b) => b - a));
    expect(f.mesh.material.uniforms.uDepth.value).toBe(0.8);
    f.hide();
    expect(f.mesh.visible).toBe(false);
    f.dispose();
  });

  it('stands in for the stretch the march skips, no more and no less', () => {
    // (each layer holds the gas from the one inside it out to itself, so
    // together they hold the eye's first stretch, and the cloud's march
    // starts where they end)
    const { f } = made();
    const layers = fogLayers(nebulaBudget('high'), 700);
    f.show(CLOUD, layers);
    const a = f.mesh.geometry.attributes.aLayer;
    const thick = [0, 1, 2, 3].map((i) => a.getY(i));
    for (const t of thick) expect(t).toBeGreaterThan(0);
    expect(thick.reduce((s, t) => s + t, 0)).toBeCloseTo(layers.at(-1), 3);
    expect(a.getX(3)).toBe(layers[0]);
    expect(a.getY(3)).toBe(layers[0]);
  });

  it('takes the cloud it is in: its middle, size, colours, seed and form', () => {
    const { f } = made();
    const colours = ['#ff0000', '#00ff00', '#0000ff'].map((c) => new THREE.Color(c));
    f.show({ ...CLOUD, centre: [10, -20, 30], r: 900, colours, seed: [0.4, 0.5, 0.6], form: 2 }, fogLayers(nebulaBudget('high'), 900));
    const u = f.mesh.material.uniforms;
    expect(u.uCentre.value.toArray()).toEqual([10, -20, 30]);
    expect(u.uRadius.value).toBe(900);
    expect(u.uColours.value.map((c) => c.getHex())).toEqual([0xff0000, 0x00ff00, 0x0000ff]);
    expect(u.uSeed.value.toArray()).toEqual([0.4, 0.5, 0.6]);
    expect(u.uCore.value).toBeGreaterThan(1); // (2, the nursery: a hot heart)
  });

  it('is one draw, made hidden at the start and drawn after the clouds', () => {
    const { f } = made(nebulaBudget('low'));
    expect(f.mesh.name).toBe('nebula-fog');
    expect(f.mesh.visible).toBe(false);
    expect(f.mesh.renderOrder).toBe(-4);
    expect(f.mesh.material.depthTest).toBe(true);
    expect(f.mesh.material.depthWrite).toBe(false);
    f.show(CLOUD, fogLayers(nebulaBudget('low'), 700));
    expect(f.mesh.geometry.instanceCount).toBe(nebulaBudget('low').fog);
  });

  it('reads the clouds’ own field, and names nothing reserved', () => {
    const m = made().f.mesh.material;
    expect(m.fragmentShader).toContain(NEBULA_FIELD);
    expect(reservedIn(m.vertexShader + m.fragmentShader)).toEqual([]);
  });

  it('frees what it made and leaves the volume it was lent', () => {
    const { f, volume } = made();
    let freed = 0;
    volume.addEventListener('dispose', () => (freed += 1));
    f.dispose();
    f.dispose();
    expect(freed).toBe(0);
    expect(() => f.hide()).not.toThrow();
  });
});
