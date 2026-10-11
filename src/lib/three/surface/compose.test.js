import { describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { setMipBias } from '../mipBias.js';
import { CHANNELS, SPECULAR_AA, biasedTexture, composeOverlays, mipBiasUniform, overlayName, specularAA, specularAAValue } from './compose.js';

describe('composeOverlays', () => {
  const base = { color: 'c0', roughness: 'r0', metalness: 'm0', normal: 'n0', emissive: 'e0' };

  it('a contributor returning nothing leaves the base', () => {
    expect(composeOverlays(base, [() => undefined, () => ({})], {})).toEqual(base);
  });

  it('each returned channel replaces the running value, in order', () => {
    const a = () => ({ color: 'ca', roughness: 'ra' });
    const b = (ctx) => ({ color: `mix(${ctx.color})` });
    const out = composeOverlays(base, [a, b], { uv: 'uv' });
    expect(out).toEqual({ ...base, color: 'mix(ca)', roughness: 'ra' });
  });

  it('hands each contributor the context and the running channels', () => {
    const seen = [];
    composeOverlays(base, [(ctx) => (seen.push(ctx), { metalness: 'm1' }), (ctx) => (seen.push(ctx), null)], { uv: 'uv', params: { a: 1 } });
    expect(seen[0]).toMatchObject({ uv: 'uv', params: { a: 1 }, metalness: 'm0' });
    expect(seen[1].metalness).toBe('m1');
  });

  it('ignores keys that are not channels', () => {
    expect(composeOverlays(base, [() => ({ junk: 1, opacity: 'o' })], {})).toEqual(base);
    expect(CHANNELS).toEqual(['color', 'roughness', 'metalness', 'normal', 'emissive']);
  });

  it('names an overlay by its overlayName, else its function name', () => {
    function snowOverlay() {}
    const named = Object.assign(() => ({}), { overlayName: 'terrainBlend' });
    expect(overlayName(snowOverlay)).toBe('snowOverlay');
    expect(overlayName(named)).toBe('terrainBlend');
    expect(overlayName(() => ({}))).toBe('overlay');
  });
});

describe('the picture’s two nodes (GPU-first lane N2)', () => {
  it('widens roughness by the shaded normal’s variance (Kaplanyan and Hoffman, Filament’s 0.15 and 0.2)', () => {
    expect(SPECULAR_AA).toMatchObject({ variance: 0.15, threshold: 0.2, floor: 0.045 });
    expect(SPECULAR_AA._source).toMatch(/Filament/);
    // roughness 0.1 at |dn/dx|² + |dn/dy|² of 0.5: the kernel min(2 × 0.15 × 0.5, 0.2) = 0.15,
    // α = 0.1² = 0.01, √(α² + 0.15) = 0.3874, perceptual √ of it = 0.6224
    expect(specularAAValue(0.1, 0.5)).toBeCloseTo(Math.sqrt(Math.sqrt(0.0001 + 0.15)), 6);
    expect(specularAAValue(0.1, 0.5)).toBeCloseTo(0.6224, 4);
    // (the kernel stops at the threshold: a seam's normal jump never makes it rougher than that)
    expect(specularAAValue(0.1, 100)).toBeCloseTo(Math.sqrt(Math.sqrt(0.0001 + 0.2)), 6);
  });
  it('floors roughness at 0.045, leaves a flat surface’s roughness as it is, and never passes 1', () => {
    expect(specularAAValue(0, 0)).toBe(0.045);
    expect(specularAAValue(0.6, 0)).toBeCloseTo(0.6, 9);
    expect(specularAAValue(1, 100)).toBe(1);
  });
  it('builds both as nodes on the tsl it is given, and reads the shared mip bias', async () => {
    const { tsl, THREE } = await loadThree();
    const r = specularAA(tsl, tsl.normalView, tsl.float(0.3));
    expect(r.isNode).toBe(true);
    const sample = biasedTexture(tsl);
    const t = new THREE.Texture();
    const node = sample(t, tsl.uv());
    expect(node.isTextureNode).toBe(true);
    expect(node.biasNode).toBeTruthy();
    // (one uniform for every material, following lib/three/mipBias)
    const u = mipBiasUniform(tsl);
    expect(mipBiasUniform(tsl)).toBe(u);
    setMipBias(-1.5);
    expect(u.value).toBe(-1.5);
    setMipBias(0);
    expect(u.value).toBe(0);
  });
});
