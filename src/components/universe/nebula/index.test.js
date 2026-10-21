import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LOOK } from '../look';
import { reservedIn } from '../__fixtures__/glsl';
import { nebulaBudget } from './budget';
import { FORMS } from './rules';
import { GAS, SCREEN_RAY, screenRay } from './shaders';
import { createNebulae } from './index';

const cam = (p, look, far = 45000) => {
  const c = new THREE.PerspectiveCamera(34, 16 / 9, 0.08, far);
  c.position.set(...p); c.lookAt(...look); c.updateMatrixWorld(true);
  return c;
};
const made = (tier = 'high') => { const parent = new THREE.Group(); const n = createNebulae({ tier }); parent.add(n.group); return { parent, n }; };
const clouds = (n) => n.group.getObjectByName('nebula-clouds');
const attr = (n, name, i) => { const a = clouds(n).geometry.attributes[name]; return Array.from({ length: a.itemSize }, (_, k) => a.array[i * a.itemSize + k]); };
const VEIL = { id: 'veil', at: [1e6, 200, -3e5], r: 900, colors: ['#5b3fd1', '#d14f9a', '#3fb7d1'], seed: 7n, form: 'shell' };

describe('the nebulae’s renderer', () => {
  it('starts with nothing drawn and every material already made', () => {
    const { n } = made();
    expect(n.group.name).toBe('nebulae');
    expect(clouds(n).visible).toBe(false);
    expect(n.group.getObjectByName('nebula-fog')).toBeTruthy();
    n.update(cam([0, 0, 0], [0, 0, -1]));
    expect(clouds(n).visible).toBe(false);
  });
  it('draws an added nebula round the camera, in one draw', () => {
    const { n } = made();
    n.add(VEIL);
    const eye = [1e6, 200, -3e5 + 12000];
    n.update(cam(eye, VEIL.at));
    expect(clouds(n).visible).toBe(true);
    expect(clouds(n).geometry.instanceCount).toBe(1);
    expect(clouds(n).position.toArray()).toEqual(eye);
    attr(n, 'aCentre', 0).forEach((v, i) => expect(v).toBeCloseTo(VEIL.at[i] - eye[i], 2));
    expect(attr(n, 'aRadius', 0)[0]).toBeCloseTo(900, 3);
  });
  it('keeps it where it is when the camera moves 5,000 sideways', () => {
    const { n } = made();
    n.add(VEIL);
    for (const dx of [0, 5000]) {
      const eye = [1e6 + dx, 200, -3e5 + 20000];
      n.update(cam(eye, [eye[0], 200, -3e5]));
      attr(n, 'aCentre', 0).forEach((v, i) => expect(eye[i] + v).toBeCloseTo(VEIL.at[i], 1));
    }
  });
  it('puts one past the far plane inside it, at its true angle', () => {
    const { n } = made();
    n.add({ ...VEIL, at: [0, 0, -300000] });
    n.update(cam([0, 0, 0], [0, 0, -1]));
    const c = attr(n, 'aCentre', 0);
    expect(Math.hypot(...c)).toBeLessThanOrEqual(45000 * 0.98 + 1e-6);
    expect(attr(n, 'aRadius', 0)[0] / Math.hypot(...c)).toBeCloseTo(900 / 300000, 8); // (float32 attributes)
    expect(attr(n, 'aDist', 0)[0]).toBeCloseTo(300000, 1);
  });
  it('on foot under a day sky, sits behind the dome', () => {
    const { n } = made();
    n.add({ ...VEIL, at: [0, 0, -20000] });
    n.update(cam([0, 0, 0], [0, 0, -1], 31.5)); // (landings/sky.js: SKY_R 30, seenTo 31.5)
    expect(Math.hypot(...attr(n, 'aCentre', 0))).toBeGreaterThan(30);
  });
  it('leaves out what is behind the camera', () => {
    const { n } = made();
    n.add({ ...VEIL, at: [0, 0, 20000] });
    n.update(cam([0, 0, 0], [0, 0, -1]));
    expect(clouds(n).visible).toBe(false);
  });
  it('draws the nearest, at most the tier’s count, far to near, only the nearest in detail', () => {
    const { n } = made('low');
    for (let i = 0; i < 20; i++) n.add({ ...VEIL, id: `n${i}`, at: [0, 0, -1000 - i * 3000], r: 400 }); // (the nearest within 4 radii: near)
    n.update(cam([0, 0, 0], [0, 0, -1]));
    const k = clouds(n).geometry.instanceCount;
    const clouds8 = Array.from({ length: k }, (_, i) => i).filter((i) => attr(n, 'aKind', i)[0] === 0); // (its young stars are the other instances)
    expect(clouds8).toHaveLength(nebulaBudget('low').drawn);
    const d = clouds8.map((i) => attr(n, 'aDist', i)[0]);
    expect(d).toEqual([...d].sort((a, b) => b - a));
    expect(clouds8.filter((i) => attr(n, 'aDetail', i)[0] > 0)).toHaveLength(nebulaBudget('low').nearMax);
  });
  it('gives a near nebula its young stars, and a far one none', () => {
    const { n } = made('high');
    n.add({ ...VEIL, at: [0, 0, -1500] });
    n.update(cam([0, 0, 0], [0, 0, -1]));
    expect(clouds(n).geometry.instanceCount).toBe(1 + nebulaBudget('high').stars);
    n.update(cam([0, 0, 60000], [0, 0, -1]));
    expect(clouds(n).geometry.instanceCount).toBe(1);
  });
  it('forgives handles: twice, stale, the same id twice, after dispose', () => {
    const { parent, n } = made();
    const a = n.add(VEIL), b = n.add(VEIL);
    n.update(cam([1e6, 200, -3e5 + 12000], VEIL.at));
    expect(clouds(n).geometry.instanceCount).toBe(1);
    n.remove(a); n.remove(a); n.remove(12345);
    n.update(cam([1e6, 200, -3e5 + 12000], VEIL.at));
    expect(clouds(n).visible).toBe(true);
    n.remove(b);
    n.update(cam([1e6, 200, -3e5 + 12000], VEIL.at));
    expect(clouds(n).visible).toBe(false);
    n.dispose();
    expect(parent.children).toHaveLength(0);
    expect(() => n.remove(b)).not.toThrow();
    expect(() => n.update(cam([0, 0, 0], [0, 0, -1]))).not.toThrow();
  });
  it('refuses what can’t be drawn, at add', () => {
    expect(() => made().n.add({ id: 'x', at: [0, NaN, 0], r: 5, seed: 1 })).toThrow(TypeError);
  });
  it('takes its forms’ numbers from rules.js, and names nothing reserved', () => {
    const m = clouds(made().n).material;
    expect(m.uniforms.uForms.value.map((v) => v.toArray())).toEqual(['cloud', 'shell', 'nursery'].map((f) => [FORMS[f].inner, FORMS[f].peak, FORMS[f].outer, FORMS[f].flat]));
    expect(reservedIn(m.vertexShader + m.fragmentShader)).toEqual([]);
  });

  // (beyond the plan’s list: the check above has to be able to fail, the
  // bloom’s line is a number, and inside() is rules.js’s insideOf)
  it('would catch a reserved name', () => {
    expect(reservedIn('float sample = 1.0; vec3 tint;')).toEqual(['sample']);
  });
  it('keeps the gas, even at a nursery’s heart, under the bloom', () => {
    const m = clouds(made().n).material;
    expect(m.uniforms.uCore.value).toEqual(['cloud', 'shell', 'nursery'].map((f) => FORMS[f].core));
    // (light over a thick cloud tends to EMIT / ABSORB × the heart × a full-strength colour)
    expect((GAS.EMIT / GAS.ABSORB) * Math.max(...m.uniforms.uCore.value)).toBeLessThan(LOOK.bloom.threshold);
  });
  it('is never culled for which way its quad winds, and draws in one pass', () => {
    // (a transparent two-sided material is drawn twice unless it’s forced single)
    const m = clouds(made().n).material;
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.forceSinglePass).toBe(true);
  });
  it('says which nebula a point is inside, and how deep', () => {
    const { n } = made();
    const h = n.add({ ...VEIL, form: 'cloud', at: [0, 0, -100] });
    expect(n.inside([0, 0, 0])).toMatchObject({ id: 'veil' });
    expect(n.inside([0, 0, 5000])).toBeNull();
    n.remove(h);
    expect(n.inside([0, 0, 0])).toBeNull();
  });
  it('never lets a handle from one renderer remove another’s cloud', () => {
    const a = made().n, b = made().n;
    const stale = a.add(VEIL);
    a.dispose();
    b.add(VEIL);
    b.remove(stale);
    b.update(cam([1e6, 200, -3e5 + 12000], VEIL.at));
    expect(clouds(b).visible).toBe(true);
  });
  it('casts the inside ray through the lens as the camera has it, nav and side panel and all', () => {
    // (scene.js’s measure(): a 380 px panel and the 68 px nav on 1600 × 900)
    const c = cam([10, 20, 30], [400, -50, -1000]);
    c.setViewOffset(1600, 900, 190, 34, 1600, 900);
    c.updateProjectionMatrix();
    const e = c.projectionMatrix.elements;
    expect(Math.abs(e[8]) > 0.1 && Math.abs(e[9]) > 0.01).toBe(true); // (the shift is there)
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0.3, -0.7]]) {
      const want = new THREE.Vector3(x, y, 0.5).unproject(c).applyMatrix4(c.matrixWorldInverse);
      const ray = screenRay([x, y], e);
      expect(ray[2]).toBe(-1);
      expect(ray[0]).toBeCloseTo(want.x / -want.z, 9);
      expect(ray[1]).toBeCloseTo(want.y / -want.z, 9);
    }
    // (without the shift the ray is the field of view’s own, the old uTan;
    // with it, another ray: the two only agree on a camera with none)
    const plain = cam([10, 20, 30], [400, -50, -1000]).projectionMatrix.elements;
    const tan = Math.tan((34 / 2) * (Math.PI / 180));
    expect(screenRay([1, 1], plain)[0]).toBeCloseTo(tan * (16 / 9), 9);
    expect(screenRay([1, 1], plain)[1]).toBeCloseTo(tan, 9);
    expect(Math.abs(screenRay([1, 1], e)[0] - screenRay([1, 1], plain)[0])).toBeGreaterThan(0.1);
    // the shader draws it from the same lines, for a cloud the camera is in
    const m = clouds(made().n).material;
    expect(SCREEN_RAY).toMatch(/\(ndc \+ vec2\(projectionMatrix\[2\]\[0\], projectionMatrix\[2\]\[1\]\)\) \/ vec2\(projectionMatrix\[0\]\[0\], projectionMatrix\[1\]\[1\]\)/);
    expect(m.vertexShader).toContain(SCREEN_RAY);
    expect(m.vertexShader).toMatch(/transpose\(mat3\(modelViewMatrix\)\) \* screenRay\(position\.xy\)/);
    expect(m.uniforms.uTan).toBeUndefined();
  });
});
