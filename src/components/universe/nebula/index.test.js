import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createNebulae } from './index';
import { GAS } from './shaders';
import { nebulaAtStep, nebulaBudget } from './budget';
import { FOG_NEAR, FORMS, fogLayers } from './rules';
import { LOOK } from '../look';
import { reservedIn } from '../__fixtures__/glsl';

const cam = (p, look, far = 45000) => {
  const c = new THREE.PerspectiveCamera(34, 16 / 9, 0.08, far);
  c.position.set(...p);
  c.lookAt(...look);
  c.updateMatrixWorld(true);
  return c;
};
const made = (tier = 'high') => {
  const parent = new THREE.Group();
  const n = createNebulae({ tier });
  parent.add(n.group);
  return { parent, n };
};
const clouds = (n) => n.group.getObjectByName('nebula-clouds');
const attr = (n, name, i) => {
  const a = clouds(n).geometry.attributes[name];
  return Array.from({ length: a.itemSize }, (_, k) => a.array[i * a.itemSize + k]);
};
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

  it('marches fewer steps at a softer quality step, and as many again at the sharpest', () => {
    const { n } = made('high');
    n.add({ ...VEIL, at: [0, 0, -1500] }); // (within 4 radii: near)
    const c = cam([0, 0, 0], [0, 0, -1]);
    const steps = (level) => {
      if (level !== undefined) n.setLevel(level);
      n.update(c);
      return attr(n, 'aShape', 0)[1];
    };
    expect(steps()).toBe(nebulaBudget('high').nearSteps);
    expect(steps(4)).toBe(nebulaAtStep(nebulaBudget('high'), 4).nearSteps);
    expect(steps(4)).toBeLessThan(nebulaBudget('high').nearSteps);
    expect(steps(0)).toBe(nebulaBudget('high').nearSteps);
    n.dispose();
    expect(() => n.setLevel(2)).not.toThrow();
  });

  it('forgives handles: twice, stale, the same id twice, after dispose', () => {
    const { parent, n } = made();
    const a = n.add(VEIL);
    const b = n.add(VEIL);
    n.update(cam([1e6, 200, -3e5 + 12000], VEIL.at));
    expect(clouds(n).geometry.instanceCount).toBe(1);
    n.remove(a);
    n.remove(a);
    n.remove(12345);
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
    expect(reservedIn('float sample = 1.0;')).toEqual(['sample']); // (the reading finds one when there is one)
    expect(reservedIn(m.vertexShader + m.fragmentShader)).toEqual([]);
  });

  it('fogs you inside, and starts the cloud’s march past the fog', () => {
    const { n } = made('high');
    n.add({ ...VEIL, form: 'cloud', at: [0, 0, -100] });
    n.update(cam([0, 0, 0], [0, 0, -1]));
    expect(n.group.getObjectByName('nebula-fog').visible).toBe(true);
    expect(attr(n, 'aStart', 0)[0]).toBeCloseTo(fogLayers(nebulaBudget('high'), 900).at(-1), 6);
    expect(n.inside([0, 0, 0])).toMatchObject({ id: 'veil' });
    n.update(cam([0, 0, 5000], [0, 0, -1]));
    expect(n.group.getObjectByName('nebula-fog').visible).toBe(false);
    expect(attr(n, 'aStart', 0)[0]).toBe(0);
  });

  it('inside two at once: the deeper one’s fog, both drawn far to near', () => {
    const { n } = made('high');
    n.add({ ...VEIL, id: 'a', form: 'cloud', at: [0, 0, -300] });
    n.add({ ...VEIL, id: 'b', form: 'cloud', at: [0, 0, 600] });
    n.update(cam([0, 0, 0], [0, 0, -1]));
    expect(n.inside([0, 0, 0]).id).toBe('a');
    const all = Array.from({ length: clouds(n).geometry.instanceCount }, (_, i) => i);
    const both = all.filter((i) => attr(n, 'aKind', i)[0] === 0);
    expect(both.map((i) => attr(n, 'aDist', i)[0])).toEqual([600, 300]);
    for (const i of both) expect(attr(n, 'aStart', i)[0]).toBeGreaterThan(0);
  });

  it('marches the other cloud round the eye from just past the ship, its gas not being in the fog', () => {
    const { n } = made('high');
    n.add({ ...VEIL, id: 'a', form: 'cloud', at: [0, 0, -300] });
    n.add({ ...VEIL, id: 'b', form: 'cloud', at: [0, 0, 600] });
    n.update(cam([0, 0, 0], [0, 0, -1]));
    const all = Array.from({ length: clouds(n).geometry.instanceCount }, (_, i) => i);
    const [b, a] = all.filter((i) => attr(n, 'aKind', i)[0] === 0);
    expect(attr(n, 'aStart', a)[0]).toBeCloseTo(fogLayers(nebulaBudget('high'), 900).at(-1), 6);
    expect(attr(n, 'aStart', b)[0]).toBe(FOG_NEAR);
  });

  it('keeps a cloud round the eye behind the ship, in its gas or not', () => {
    // (its whole-screen quad never nearer than the fog's first shell, past
    // the chase camera's ship, so the gas behind the ship isn't drawn over
    // it, even in a shell's hollow middle, where there is no fog)
    const v = clouds(made().n).material.vertexShader;
    expect(v).toContain(`const float CLEAR = ${FOG_NEAR.toFixed(1)};`);
    expect(v).toContain('max(aStart, CLEAR)');
  });

  it('keeps the gas under the bloom, whatever the march', () => {
    // (each step adds its light in proportion to the light it hides, so a
    // cloud's light never passes emit · core / absorb times its brightest colour,
    // a channel at 1 at most)
    const hottest = Math.max(...Object.values(FORMS).map((f) => f.core));
    expect((GAS.emit * hottest) / GAS.absorb).toBeLessThan(LOOK.bloom.threshold);
  });
});
