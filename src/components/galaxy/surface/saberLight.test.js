import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SABER_LIGHT, createSaberLight } from './saberLight';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lights = (scene) => scene.children.filter((o) => o.isPointLight);
// (every light under the scene, a group's too: a duellist's blade lights from activity.js's group)
const all = (scene) => {
  const out = [];
  scene.traverse((o) => o.isPointLight && out.push(o));
  return out;
};
const lit = (scene) => all(scene).filter((p) => p.intensity > 0);

describe('a lit blade’s light', () => {
  it('is made on high and ultra, at the build, and never on low or mid', () => {
    for (const tier of ['low', 'mid']) {
      const scene = new THREE.Scene();
      const l = createSaberLight({ scene, color: '#4aa8ff', tier });
      expect(lights(scene)).toHaveLength(0);
      l.update(V(0, 1, 0), V(0, 2, 0), 1, V(0, 1, 3)); // (a no-op)
      l.dispose();
    }
    for (const tier of ['high', 'ultra']) {
      const scene = new THREE.Scene();
      const l = createSaberLight({ scene, color: '#4aa8ff', tier });
      expect(lights(scene)).toHaveLength(1);
      expect(lights(scene)[0].intensity).toBe(0); // (dark till lit: the count of lights never changes, nothing recompiles)
      l.dispose();
    }
  });

  it('sits at the blade’s middle in its colour, as bright as its tier and as lit as the blade', () => {
    const scene = new THREE.Scene();
    const l = createSaberLight({ scene, color: '#ff2020', tier: 'high' });
    const p = lights(scene)[0];
    l.update(V(0, 1, 0), V(0, 2, 0), 1, V(0, 1.5, 4));
    expect(p.position.toArray()).toEqual([0, 1.5, 0]);
    expect(p.color.getHexString()).toBe('ff2020');
    expect(p.intensity).toBeCloseTo(SABER_LIGHT.intensity.high, 6);
    l.update(V(0, 1, 0), V(0, 2, 0), 0.5, V(0, 1.5, 4));
    expect(p.intensity).toBeCloseTo(SABER_LIGHT.intensity.high * 0.5, 6);
    l.update(V(0, 1, 0), V(0, 2, 0), 0, V(0, 1.5, 4));
    expect(p.intensity).toBe(0);
    l.dispose();
  });

  it('goes dark past 12 m from the eye, and comes back', () => {
    const scene = new THREE.Scene();
    const l = createSaberLight({ scene, color: '#4aa8ff', tier: 'ultra' });
    const p = lights(scene)[0];
    l.update(V(0, 1, 0), V(0, 2, 0), 1, V(0, 1.5, SABER_LIGHT.within + 1));
    expect(p.intensity).toBe(0);
    l.update(V(0, 1, 0), V(0, 2, 0), 1, V(0, 1.5, SABER_LIGHT.within - 1));
    expect(p.intensity).toBeCloseTo(SABER_LIGHT.intensity.ultra, 6);
    l.dispose();
  });

  it('takes its light away when it goes', () => {
    const scene = new THREE.Scene();
    const l = createSaberLight({ scene, color: '#4aa8ff', tier: 'high' });
    l.dispose();
    expect(lights(scene)).toHaveLength(0);
  });
});

describe('the blades’ lights together', () => {
  it('are four at most at once (a light costs every lit pixel, near or far), and a fifth comes when one goes', () => {
    const scene = new THREE.Scene();
    const made = Array.from({ length: SABER_LIGHT.most + 1 }, () => createSaberLight({ scene, color: '#4aa8ff', tier: 'high' }));
    expect(lights(scene)).toHaveLength(SABER_LIGHT.most);
    made[0].dispose();
    const next = createSaberLight({ scene, color: '#4aa8ff', tier: 'high' });
    expect(lights(scene)).toHaveLength(SABER_LIGHT.most);
    for (const l of [...made.slice(1), next]) l.dispose();
    expect(lights(scene)).toHaveLength(0);
  });
});

describe('the nearest blades light, not the first made', () => {
  // the eye 3 m behind a blade at the origin; a blade's middle at (x, 1.5, 0): 3.0, 3.6, 5.0, 6.7 and 8.5 m off at x 0, 2, 4, 6, 8
  const eye = V(0, 1.6, -3);
  const at = (l, x, k = 1) => l.update(V(x, 1, 0), V(x, 2, 0), k, eye);

  it('four far duellists made first never keep yours dark', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group(); // (activity.js's, in the scene)
    scene.add(group);
    const far = Array.from({ length: SABER_LIGHT.most }, () => createSaberLight({ scene: group, color: '#ff2020', tier: 'high' }));
    far.forEach((l, i) => at(l, 40 + i));
    const yours = createSaberLight({ scene, color: '#20ff20', tier: 'high' });
    at(yours, 0);
    expect(all(scene)).toHaveLength(SABER_LIGHT.most); // (still four: the count never changes as one goes from blade to blade)
    expect(lit(scene)).toHaveLength(1);
    expect(lit(scene)[0].color.getHexString()).toBe('20ff20');
    expect(lit(scene)[0].position.toArray()).toEqual([0, 1.5, 0]);
    expect(lit(scene)[0].intensity).toBeCloseTo(SABER_LIGHT.intensity.high, 6);
    for (const l of [...far, yours]) l.dispose();
    expect(all(scene)).toHaveLength(0);
  });

  it('one made while four are out (a hero swapped in before the old one goes) gets one when it is among the nearest', () => {
    const scene = new THREE.Scene();
    const old = Array.from({ length: SABER_LIGHT.most }, () => createSaberLight({ scene, tier: 'high' }));
    old.forEach((l, i) => at(l, 2 + 2 * i));
    const next = createSaberLight({ scene, color: '#20ff20', tier: 'high' });
    old[0].dispose();
    at(next, 0);
    expect(all(scene)).toHaveLength(SABER_LIGHT.most);
    expect(lit(scene).map((p) => p.color.getHexString())).toContain('20ff20');
    for (const l of [...old.slice(1), next]) l.dispose();
  });

  it('five lit within reach: the nearest four, whichever is updated first; one holding keeps it till another is SABER_LIGHT.hold nearer; out past 12 m or put out, it hands it on', () => {
    const scene = new THREE.Scene();
    const xs = [0, 2, 4, 6, 8];
    const ks = [1, 1, 1, 1, 1];
    const five = xs.map(() => createSaberLight({ scene, tier: 'high' }));
    // (the far ones first; each blade's place is from the others' last update, so a light handed on is lit a frame on)
    const frame = () => [4, 3, 2, 1, 0].forEach((i) => at(five[i], xs[i], ks[i]));
    const on = () => lit(scene).map((p) => p.position.x).sort((a, b) => a - b);
    frame();
    expect(on()).toEqual([0, 2, 4, 6]);
    xs[4] = 5.5; // (6.27 m: nearer than the fourth's 6.71, not by SABER_LIGHT.hold)
    frame();
    expect(on()).toEqual([0, 2, 4, 6]);
    xs[4] = 4.5; // (5.41 m: by more)
    frame();
    expect(on()).toEqual([0, 2, 4, 4.5]);
    xs[0] = SABER_LIGHT.within + 20; // (yours walked off)
    frame();
    frame();
    expect(on()).toEqual([2, 4, 4.5, 6]);
    ks[1] = 0; // (put out)
    frame();
    frame();
    expect(on()).toEqual([4, 4.5, 6]);
    expect(all(scene)).toHaveLength(SABER_LIGHT.most);
    for (const l of five) l.dispose();
    expect(all(scene)).toHaveLength(0);
  });

  // (a duellist taken by a show, a peer riding: its saber is never updated
  // again till it goes, and keeps the distance it had)
  it('one no update reaches any more, without a light, never keeps a live one dark while a light sits free', () => {
    const scene = new THREE.Scene();
    const xs = [0, 2, 4, 6, 8];
    const five = xs.map(() => createSaberLight({ scene, tier: 'high' }));
    const on = () => lit(scene).map((p) => p.position.x).sort((a, b) => a - b);
    [4, 3, 2, 1, 0].forEach((i) => at(five[i], xs[i]));
    expect(on()).toEqual([0, 2, 4, 6]);
    // (the fifth, 8.5 m off and no light, stops; two step back past it, still within reach: 9.5 and 10.4 m)
    xs[2] = 9;
    xs[3] = 10;
    const frame = () => [3, 2, 1, 0].forEach((i) => at(five[i], xs[i]));
    frame();
    frame();
    expect(on()).toEqual([0, 2, 9, 10]);
    for (const l of five) l.dispose();
  });

  // (put away to ride, taken by a show: its saber lets its light go)
  it('one gone dark lets its light go, to the next nearest', () => {
    const scene = new THREE.Scene();
    const xs = [0, 2, 4, 6, 8];
    const five = xs.map(() => createSaberLight({ scene, tier: 'high' }));
    const on = () => lit(scene).map((p) => p.position.x).sort((a, b) => a - b);
    five.forEach((l, i) => at(l, xs[i]));
    expect(on()).toEqual([0, 2, 4, 6]);
    five[0].dark();
    expect(on()).toEqual([2, 4, 6]);
    [1, 2, 3, 4].forEach((i) => at(five[i], xs[i]));
    expect(on()).toEqual([2, 4, 6, 8]);
    for (const l of five) l.dispose();
  });
});
