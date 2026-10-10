import { describe, expect, it } from 'vitest';
import { CHANNELS, composeOverlays, overlayName } from './compose.js';

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
