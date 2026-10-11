import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FAMILIES, LOOKS, buildBody } from './bodies';
import { surfaceFrag } from './bodyShaders';
import { SKIN_FRAG, skinFile, skinMixAt, withSkin } from './bodySkin';

// each family's surface shader as main drew it before the skins (sha-256,
// first 16 hex): a planet without a skin compiles exactly what it did
const BEFORE = { desert: '0185611de40f9079', ice: '820851ee61b9da98', lush: 'db982e0a1fdda539', city: '80db41e89002c055', lava: '875b46ff53ac017f', gas: '018f8e3653c2342d', moon: '42c5e8c2fd7e0592' };
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// a skin as the import writes one, and a loader that hands back a texture a call
const SKIN = { color: 'textures/galaxy/planets/endor/color', normal: 'textures/galaxy/planets/endor/normal', clouds: 'textures/galaxy/planets/endor/clouds', atmo: '#88aacc', atmoScale: 0.5, tiles: 2, seas: 0.4 };
const fakeLoad = () => {
  const asked = [];
  const load = (url, opts) => {
    const t = new THREE.Texture();
    t.disposed = false;
    t.dispose = () => (t.disposed = true);
    asked.push({ url, opts, t });
    return Promise.resolve(t);
  };
  return { asked, load };
};
const settle = () => new Promise((r) => setTimeout(r, 0));
const CALLS = ['  #ifdef SKIN\n  skin(P, s);\n  #endif\n', '  #ifdef SKIN\n  skinClouds(P, s, thick);\n  #endif\n'];

describe('the surface shader without a skin', () => {
  it('is byte for byte what it was', () => {
    for (const [f, d] of Object.entries(FAMILIES)) expect(hash(surfaceFrag(f, d.slots)), f).toBe(BEFORE[f]);
  });

  it('with one, gains the chunk and its two calls, and nothing else moves', () => {
    const plain = surfaceFrag('lush', FAMILIES.lush.slots);
    const skinned = surfaceFrag('lush', FAMILIES.lush.slots, { skin: true });
    expect(skinned).toContain(SKIN_FRAG);
    for (const c of CALLS) expect(skinned).toContain(c);
    expect(CALLS.reduce((s, c) => s.replace(c, ''), skinned.replace(`${SKIN_FRAG}\n`, ''))).toBe(plain);
    expect(() => withSkin('void main() {}')).toThrow(/moved/);
  });
});

describe('skinMixAt', () => {
  it('is 1 far out, 0 in the air, and eases between', () => {
    expect(skinMixAt(10, 1.06)).toBe(1);
    expect(skinMixAt(1.06 * 1.5, 1.06)).toBe(1);
    expect(skinMixAt(1.06, 1.06)).toBe(0);
    expect(skinMixAt(1.01, 1.06)).toBe(0);
    expect(skinMixAt(1.06 * 1.25, 1.06)).toBeCloseTo(0.5, 5);
  });
});

describe('skinFile', () => {
  it('names the tier’s file, none on low', () => {
    expect(skinFile('a/color', 'mid')).toBe('a/color-mid.webp');
    expect(skinFile('a/color', 'high')).toBe('a/color-high.webp');
    expect(skinFile('a/normal', 'ultra', 'normal')).toBe('a/normal-ultra.ktx2');
    expect(skinFile('a/clouds', 'ultra', 'clouds')).toBe('a/clouds-ultra.webp');
    expect(skinFile('a/rings', 'ultra', 'rings')).toBe('a/rings-mid.webp');
    expect(skinFile('a/color', 'low')).toBeNull();
    expect(skinFile(undefined, 'high')).toBeNull();
  });
});

describe('a skinned body', () => {
  const look = { ...LOOKS.endor, skin: SKIN };

  it('loads its maps on high and none on low, and frees each with the body', async () => {
    const hi = fakeLoad();
    const b = buildBody(look, { r: 30, tier: 'high', load: hi.load });
    await settle();
    expect(hi.asked.map((a) => [a.url, a.opts.color])).toEqual([
      ['/textures/galaxy/planets/endor/color-high.webp', true],
      ['/textures/galaxy/planets/endor/normal-high.webp', false],
      ['/textures/galaxy/planets/endor/clouds-high.webp', false],
    ]);
    const mat = b.group.children[0].material;
    expect(Object.keys(mat.defines)).toEqual(expect.arrayContaining(['SKIN', 'SKIN_NORMAL', 'SKIN_CLOUDS', 'SKIN_SEAS']));
    expect(mat.uniforms.uSkinColor.value).toBe(hi.asked[0].t);
    // (round the planet, not over the poles)
    expect([hi.asked[0].t.wrapS, hi.asked[0].t.wrapT]).toEqual([THREE.RepeatWrapping, THREE.ClampToEdgeWrapping]);
    expect(mat.uniforms.uSkinK.value.toArray()).toEqual([2, 1, 1, 0.4]);
    b.dispose();
    expect(hi.asked.every((a) => a.t.disposed)).toBe(true);

    const lo = fakeLoad();
    const l = buildBody(look, { r: 30, tier: 'low', load: lo.load });
    await settle();
    expect(lo.asked).toEqual([]);
    expect(l.group.children[0].material.defines.SKIN).toBeUndefined();
    l.dispose();
  });

  it('wraps once round by default, as the game does', async () => {
    const { load } = fakeLoad();
    const b = buildBody({ ...LOOKS.bespin, skin: { color: 'b/color' } }, { r: 30, tier: 'ultra', load });
    const u = b.group.children[0].material.uniforms;
    expect([u.uSkinK.value.x, u.uSkinC.value.x]).toEqual([1, 1]);
    b.dispose();
  });

  it('shows from orbit and gives way in the air, its air’s colour with it', async () => {
    const { load } = fakeLoad();
    const b = buildBody(look, { r: 30, tier: 'ultra', load });
    const u = b.group.children[0].material.uniforms;
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 300);
    b.update(1, camera);
    expect(u.uSkinMix.value).toBe(0); // (nothing until the colour is in)
    await settle();
    b.update(2, camera);
    expect(u.uSkinMix.value).toBe(1);
    expect(u.uAtmo.value.getHexString()).toBe('88aacc');
    expect(u.uAtmoP.value.z).toBeCloseTo(LOOKS.endor.atmo.density * 0.5, 6);
    camera.position.set(0, 0, 30.5);
    b.update(3, camera);
    expect(u.uSkinMix.value).toBe(0);
    expect(u.uAtmo.value.getHexString()).toBe(new THREE.Color(LOOKS.endor.atmo.color).getHexString());
    expect(u.uAtmoP.value.z).toBe(LOOKS.endor.atmo.density);
    b.dispose();
  });

  it('frees a map that lands after the body is gone', async () => {
    const { asked, load } = fakeLoad();
    const b = buildBody(look, { r: 30, tier: 'high', load });
    b.dispose();
    await settle();
    expect(asked.length).toBe(3);
    expect(asked.every((a) => a.t.disposed)).toBe(true);
  });

  it('draws rings alone, the ground left procedural, once their strip is in', async () => {
    const { asked, load } = fakeLoad();
    const b = buildBody({ ...LOOKS.geonosis, skin: { rings: 'x/rings', ringsAt: [1.35, 2.3] } }, { r: 30, tier: 'high', load });
    expect(b.reach).toBeCloseTo(30 * 2.3, 6);
    expect(b.group.children[0].material.defines.SKIN).toBeUndefined();
    await settle();
    expect(asked.map((a) => a.url)).toEqual(['/x/rings-mid.webp']);
    const ring = b.group.children.find((c) => c.geometry?.type === 'RingGeometry');
    expect(ring.visible).toBe(true);
    expect(ring.material.map).toBe(asked[0].t);
    // (across the strip: inner edge to outer; down it: the way round)
    const uv = ring.geometry.attributes.uv;
    expect([uv.getX(0), uv.getX(129), uv.getY(128)]).toEqual([0, 1, 8]);
    b.dispose();
    expect(asked.every((a) => a.t.disposed)).toBe(true);
  });

  it('a body with no skin asks for nothing', async () => {
    const { asked, load } = fakeLoad();
    buildBody('mustafar', { r: 30, tier: 'ultra', load }).dispose();
    await settle();
    expect(asked).toEqual([]);
  });
});
