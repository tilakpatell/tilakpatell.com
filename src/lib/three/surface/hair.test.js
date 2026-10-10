import { beforeAll, describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { headMaterial, hairMaterial, melaninColor, surfaceMaterial, tipWeight } from './hair.js';

describe('melaninColor', () => {
  it('no melanin is white; eumelanin darkens blue first; pheomelanin reddens', () => {
    expect(melaninColor(0, 0)).toEqual([1, 1, 1]);
    const dark = melaninColor(1, 0);
    expect(dark[0]).toBeCloseTo(Math.exp(-0.419 * 8 * 0.5), 6);
    expect(dark[2]).toBeCloseTo(Math.exp(-1.37 * 8 * 0.5), 6);
    // (Hask's hair, MelaninXY 0.342, 0.105: a dark brown, red over blue)
    const [r, g, b] = melaninColor(0.34191441535949707, 0.10461648553609848);
    expect(r).toBeCloseTo(0.5214, 3);
    expect(r > g && g > b).toBe(true);
  });
});

describe('tipWeight', () => {
  it('rises from min to max along v', () => {
    expect(tipWeight(0.2, 0.5, 1)).toBe(0);
    expect(tipWeight(0.75, 0.5, 1)).toBe(0.5);
    expect(tipWeight(1, 0.5, 1)).toBe(1);
    // (min and max equal: a step)
    expect(tipWeight(0.6, 0.5, 0.5)).toBe(1);
  });
});

describe('hairMaterial and headMaterial', () => {
  let three;
  beforeAll(async () => {
    three = await loadThree();
  });
  const glb = () => new three.THREE.MeshStandardMaterial({ map: new three.THREE.Texture() });
  const HAIR = { family: 'hair', maps: { hairStrand: 'S' }, params: { hair: { melanin: [0.34, 0.1], melaninOn: true, tip: [0.01, 0.01, 0.01], tipMin: 0.5, tipMax: 1, smoothness: 0.6 }, alphaTest: true, alphaCutoff: 0.5, doubleSided: true } };
  const HEAD = { family: 'head', maps: { sss: 'R' }, params: { alphaTest: false, doubleSided: false } };

  it('hair: melanin, the tip tint and two Kajiya-Kay lobes; the GLB on low', () => {
    const m = hairMaterial(HAIR, { glb: glb(), hairStrand: new three.THREE.Texture() }, { tier: 'ultra', three });
    expect([...m.userData.game.features].sort()).toEqual(['alphaTest', 'doubleSided', 'kajiyaKay', 'melanin', 'tipTint']);
    expect(m.colorNode).toBeTruthy();
    expect(m.emissiveNode).toBeTruthy();
    expect(hairMaterial(HAIR, { glb: glb() }, { tier: 'low', three }).userData.game.features).toEqual([]);
  });

  it('head: the scattering mask as a wrapped diffuse, the reflectance from red', () => {
    const m = headMaterial(HEAD, { glb: glb(), sss: new three.THREE.Texture() }, { tier: 'high', three });
    expect([...m.userData.game.features].sort()).toEqual(['reflectance', 'scatter']);
    expect(headMaterial(HEAD, { glb: glb(), sss: null }, { tier: 'high', three }).userData.game.features).toEqual([]);
  });
});

describe('surfaceMaterial', () => {
  it('takes hair to hairMaterial, a head to headMaterial, the rest to the game material', async () => {
    const three = await loadThree();
    const glb = () => new three.THREE.MeshStandardMaterial();
    const T = () => new three.THREE.Texture();
    const of = (recipe, maps) => surfaceMaterial(recipe, { glb: glb(), ...maps }, { tier: 'ultra', three }).userData.game.features;
    expect(of({ family: 'hair', maps: {}, params: {} }, {})).toContain('kajiyaKay');
    expect(of({ family: 'head', maps: { sss: 'R' }, params: {} }, { sss: T() })).toContain('scatter');
    expect(of({ family: 'props', maps: { detail: 'D' }, params: { detail: { tiling: [2, 2] } } }, { detail: T() })).toEqual(['detail']);
  });
});
