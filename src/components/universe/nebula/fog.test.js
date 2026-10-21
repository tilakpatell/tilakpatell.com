import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LOOK } from '../look';
import { reservedIn } from '../__fixtures__/glsl';
import { nebulaBudget } from './budget';
import { FOG_NEAR, FORMS, fogLayers } from './rules';
import { FIELD, FOG, SCREEN_RAY } from './shaders';
import { createFog } from './fog';

const row = nebulaBudget('high');
const made = () => createFog({ volume: new THREE.Data3DTexture(new Uint8Array(2), 1, 1, 1), row });
const CLOUD = { centre: [0, 0, -100], r: 700, colours: [new THREE.Color(), new THREE.Color(), new THREE.Color()], seed: [0.1, 0.2, 0.3], form: 0, depth: 0.8 };
const layer = (f, i) => [f.mesh.geometry.attributes.aLayer.getX(i), f.mesh.geometry.attributes.aLayer.getY(i)];

describe('the fog round the ship', () => {
  it('shows its layers far to near, and hides', () => {
    const f = createFog({ volume: new THREE.Data3DTexture(new Uint8Array(2), 1, 1, 1), row: nebulaBudget('high') });
    f.show({ centre: [0, 0, -100], r: 700, colours: [new THREE.Color(), new THREE.Color(), new THREE.Color()], seed: [0.1, 0.2, 0.3], form: 0, depth: 0.8 }, fogLayers(nebulaBudget('high'), 700));
    expect(f.mesh.visible).toBe(true);
    expect(f.mesh.geometry.instanceCount).toBe(4);
    const radii = [0, 1, 2, 3].map((i) => f.mesh.geometry.attributes.aLayer.getX(i));
    expect(radii).toEqual([...radii].sort((a, b) => b - a));
    expect(f.mesh.material.uniforms.uDepth.value).toBe(0.8);
    f.hide();
    expect(f.mesh.visible).toBe(false);
    f.dispose();
  });
  it('starts hidden as the nebula-fog mesh, depth-tested at each layer and drawn after the clouds', () => {
    const f = made();
    expect(f.mesh.name).toBe('nebula-fog');
    expect(f.mesh.visible).toBe(false);
    expect(f.mesh.frustumCulled).toBe(false);
    expect(f.mesh.renderOrder).toBe(-4);
    const m = f.mesh.material;
    expect([m.depthTest, m.depthWrite, m.transparent]).toEqual([true, false, true]);
    // (premultiplied, as the clouds are: its light adds, its alpha dims what’s behind)
    expect([m.blending, m.blendSrc, m.blendDst]).toEqual([THREE.CustomBlending, THREE.OneFactor, THREE.OneMinusSrcAlphaFactor]);
    expect(f.mesh.geometry.attributes.aLayer.count).toBe(row.fog);
    f.dispose();
  });
  it('gives each layer its radius and the thickness to the layer inside it', () => {
    const f = made();
    const L = fogLayers(row, 700);
    f.show(CLOUD, L);
    const n = L.length;
    for (let i = 0; i < n; i++) {
      const k = n - 1 - i; // (drawn far to near: the first instance is the outermost layer)
      expect(layer(f, i)[0]).toBeCloseTo(L[k], 4);
      expect(layer(f, i)[1]).toBeCloseTo(k === 0 ? L[0] : L[k] - L[k - 1], 4);
    }
    expect(layer(f, n - 1)[0]).toBe(FOG_NEAR);
    f.dispose();
  });
  it('shows nothing for a cloud too small to fog the ship (rules.js gives it no layers)', () => {
    const f = made();
    f.show(CLOUD, fogLayers(row, 700));
    f.show({ ...CLOUD, r: 12 }, fogLayers(row, 12));
    expect(f.mesh.visible).toBe(false);
    expect(f.mesh.geometry.instanceCount).toBe(0);
    f.dispose();
  });
  it('takes the cloud’s colours, seed, form and middle into its uniforms', () => {
    const f = made();
    const colours = [new THREE.Color('#5b3fd1'), new THREE.Color('#d14f9a'), new THREE.Color('#3fb7d1')];
    f.show({ ...CLOUD, colours, form: 2, centre: [10, -20, -300] }, fogLayers(row, 700));
    const u = f.mesh.material.uniforms;
    expect(u.uCentre.value.toArray()).toEqual([10, -20, -300]);
    expect(u.uR.value).toBe(700);
    expect([u.uCol0.value, u.uCol1.value, u.uCol2.value].map((c) => c.getHex())).toEqual(colours.map((c) => c.getHex()));
    expect(u.uSeed.value.toArray()).toEqual([0.1, 0.2, 0.3]);
    // (form 2 is the nursery; its numbers are rules.js’s)
    expect(u.uForm.value.toArray()).toEqual([FORMS.nursery.inner, FORMS.nursery.peak, FORMS.nursery.outer, FORMS.nursery.flat]);
    expect(u.uCore.value).toBe(FORMS.nursery.core);
    f.dispose();
  });
  it('is the cloud’s own field seen through the camera’s lens, lit by the ship two units ahead', () => {
    const m = made().mesh.material;
    expect(m.fragmentShader).toContain(FIELD);
    expect(m.vertexShader).toContain(SCREEN_RAY);
    // (the ray is the camera’s own, then turned to the map’s axes, as the clouds’ is)
    expect(m.vertexShader).toMatch(/vView = screenRay\(position\.xy\)/);
    expect(m.vertexShader).toMatch(/vRay = transpose\(mat3\(modelViewMatrix\)\) \* vView/);
    // the ship’s light: a warm white where the ship is in the chase view
    expect(m.fragmentShader).toMatch(/vec3\(0\.0, 0\.0, -2\.0\)/);
    expect(m.fragmentShader).toContain(`${FOG.ABSORB}`);
    expect(FOG.ABSORB).toBe(1.2);
    expect(reservedIn(m.vertexShader + m.fragmentShader)).toEqual([]);
  });
  it('keeps the fog and the ship’s light on it under the bloom’s line', () => {
    // (the layers inside a cloud sum to at most half its radius of gas, so their
    // light stays near its colour at full strength, 1, plus the glow; a nursery’s
    // heart tints brighter but over less of that thickness)
    expect(1 + Math.max(...FOG.GLOW)).toBeLessThan(LOOK.bloom.threshold);
  });
  it('forgives a second dispose and a show after it', () => {
    const f = made();
    f.dispose();
    expect(() => f.dispose()).not.toThrow();
    expect(() => f.show(CLOUD, fogLayers(row, 700))).not.toThrow();
    expect(() => f.hide()).not.toThrow();
  });
});
