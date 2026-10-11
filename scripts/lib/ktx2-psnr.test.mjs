import { describe, expect, it } from 'vitest';
import { masterRgba, psnr } from './ktx2-psnr.mjs';

describe('PSNR against a master', () => {
  it('is infinite for the same picture, and falls as the error grows', () => {
    const a = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
    expect(psnr(a, a)).toBe(Infinity);
    const off1 = a.map((v, i) => (i % 4 === 3 ? v : v + 1));
    const off4 = a.map((v, i) => (i % 4 === 3 ? v : v + 4));
    expect(psnr(a, off1)).toBe(48.13);
    expect(psnr(a, off4)).toBeLessThan(psnr(a, off1));
    expect(() => psnr(a, a.subarray(0, 4))).toThrow(/sizes differ/);
  });

  it('ignores alpha (a colour map keeps its smoothness there)', () => {
    const a = new Uint8Array([10, 20, 30, 0]);
    expect(psnr(a, new Uint8Array([10, 20, 30, 255]))).toBe(Infinity);
  });

  it('sizes the master to the copy it is held against', async () => {
    const { default: sharp } = await import('sharp');
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 100, b: 50 } } }).png().toBuffer();
    const rgba = await masterRgba(png, 4, 4);
    expect(rgba.length).toBe(4 * 4 * 4);
    expect([...rgba.subarray(0, 4)]).toEqual([200, 100, 50, 255]);
  });
});

describe('a KTX2 decoded', () => {
  it("reads a pack's map as RGBA8 at its size", async () => {
    const { readFileSync } = await import('node:fs');
    const { decodeKtx2 } = await import('./ktx2-psnr.mjs');
    // (one of SB_Kamino's maps, 566 bytes, kept beside the test: the packs' binaries are published, not in git)
    const k = await decodeKtx2(readFileSync(new URL('./fixtures/t_baseplastic_white_01_nam__normal.128.ktx2', import.meta.url)));
    expect([k.width, k.height]).toEqual([128, 128]);
    expect(k.rgba.length).toBe(128 * 128 * 4);
  });
});
