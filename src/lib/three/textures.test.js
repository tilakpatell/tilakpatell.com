import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { anisotropyFor, fitSize, fitTexture, imageBitmapOk, mipsOver, variant } from './textures';

describe('fitting a map under a ceiling', () => {
  it('halves until the longer side fits, keeping the shape', () => {
    expect(fitSize(2048, 2048, 1024)).toEqual({ width: 1024, height: 1024 });
    expect(fitSize(2048, 1024, 512)).toEqual({ width: 512, height: 256 });
    expect(fitSize(4096, 2048, 1024)).toEqual({ width: 1024, height: 512 });
  });
  it('leaves a map that already fits alone', () => {
    expect(fitSize(1024, 1024, 1024)).toBe(null);
    expect(fitSize(512, 256, 4096)).toBe(null);
    expect(fitSize(0, 0, 512)).toBe(null);
  });
  it('counts the mip levels a compressed map must lose', () => {
    const levels = [4096, 2048, 1024, 512, 256].map((s) => ({ width: s, height: s }));
    expect(mipsOver(levels, 1024)).toBe(2);
    expect(mipsOver(levels, 8192)).toBe(0);
    // (never the last level: a map too big at its smallest keeps that)
    expect(mipsOver(levels, 64)).toBe(4);
    expect(mipsOver([], 512)).toBe(0);
  });
});

describe('fitting a compressed texture by dropping its top levels', () => {
  it('starts it at the first level that fits', () => {
    const levels = [2048, 1024, 512].map((s) => ({ data: new Uint8Array(4), width: s, height: s }));
    const t = new THREE.CompressedTexture(levels, 2048, 2048);
    expect(fitTexture(t, 1024)).toBe(true);
    expect(t.mipmaps.map((m) => m.width)).toEqual([1024, 512]);
    expect(t.image).toMatchObject({ width: 1024, height: 1024 });
    expect(fitTexture(t, 1024)).toBe(false);
  });
});

describe('anisotropy from the budget', () => {
  it('asks for the tier’s, no more than the chip has', () => {
    expect(anisotropyFor(16, 16)).toBe(16);
    expect(anisotropyFor(8, 16)).toBe(8);
    expect(anisotropyFor(16, 4)).toBe(4);
  });
  it('never asks for less than 1, and copes with a chip that reports nothing', () => {
    expect(anisotropyFor(1, 16)).toBe(1);
    expect(anisotropyFor(0, 16)).toBe(16);
    expect(anisotropyFor(undefined, 8)).toBe(8);
    expect(anisotropyFor(16, 0)).toBe(1);
    expect(anisotropyFor(16, NaN)).toBe(1);
  });
});

describe('the smaller file for a smaller tier', () => {
  it('puts the suffix before the extension', () => {
    expect(variant('/textures/earth/day.webp', '-sm', true)).toBe('/textures/earth/day-sm.webp');
    expect(variant('/hq/tex/grass/color.webp', '-512')).toBe('/hq/tex/grass/color-512.webp');
  });
  it('keeps a query or hash where it is', () => {
    expect(variant('/t/day.webp?v=3', '-sm')).toBe('/t/day-sm.webp?v=3');
  });
  it('leaves a file alone when the big one is wanted', () => {
    expect(variant('/t/day.webp', '-sm', false)).toBe('/t/day.webp');
  });
  it('copes with a dot in a folder name and no extension', () => {
    expect(variant('/v1.2/day', '-sm')).toBe('/v1.2/day-sm');
  });
});

describe('decoding off the main thread', () => {
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  const SAFARI16 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15';
  const SAFARI17 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
  const FF90 = 'Mozilla/5.0 (X11; Linux x86_64; rv:90.0) Gecko/20100101 Firefox/90.0';
  const FF120 = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
  it('uses it in Chrome, recent Safari and recent Firefox', () => {
    expect(imageBitmapOk(CHROME, true)).toBe(true);
    expect(imageBitmapOk(SAFARI17, true)).toBe(true);
    expect(imageBitmapOk(FF120, true)).toBe(true);
  });
  it('keeps to the plain loader where the browser gets it wrong, or lacks it', () => {
    expect(imageBitmapOk(SAFARI16, true)).toBe(false);
    expect(imageBitmapOk(FF90, true)).toBe(false);
    expect(imageBitmapOk(CHROME, false)).toBe(false);
  });
});
