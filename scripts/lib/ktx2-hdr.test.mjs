import * as zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { read } from 'three/examples/jsm/libs/ktx-parse.module.js';
import { ktx2Info } from './ktx2-mips.mjs';
import { ddsInfo, ddsToKtx2, fromHalf, makeDds, toHalf, zstdReady } from './ktx2-hdr.mjs';

// a panorama in small: 8 × 4, four levels, a value over 1 at the sun
const sun = (x, y, l) => (l === 0 && x === 3 && y === 1 ? [24, 20, 16, 1] : [0.25 * (l + 1), 0.5, 0.75, 1]);

describe('a half-float DDS as KTX2', () => {
  it('reads the DX10 header and the legacy one alike', () => {
    expect(ddsInfo(makeDds(8, 4, 4, sun))).toMatchObject({ width: 8, height: 4, levels: 4, offset: 148 });
    expect(ddsInfo(makeDds(8, 4, 1, sun, { dx10: false }))).toMatchObject({ width: 8, height: 4, levels: 1, offset: 128 });
  });

  it('refuses what is not RGBA16F, and a short file', () => {
    const bc6 = makeDds(8, 4, 1, sun);
    bc6.writeUInt32LE(95, 128); // BC6H_UF16
    expect(() => ddsInfo(bc6)).toThrow(/R16G16B16A16_FLOAT/);
    expect(() => ddsToKtx2(makeDds(8, 4, 2, sun).subarray(0, 200))).toThrow(/short/);
    expect(() => ddsInfo(Buffer.alloc(200))).toThrow(/not a DDS/);
  });

  it('writes a KTX2 three reads: RGBA16F, linear, every level, the HDR kept', () => {
    const ktx = ddsToKtx2(makeDds(8, 4, 4, sun));
    const c = read(new Uint8Array(ktx));
    expect(c.vkFormat).toBe(97);
    expect(c.typeSize).toBe(2);
    expect([c.pixelWidth, c.pixelHeight, c.levels.length]).toEqual([8, 4, 4]);
    expect(c.dataFormatDescriptor[0]).toMatchObject({ colorModel: 1, transferFunction: 1, colorPrimaries: 1 });
    expect(c.dataFormatDescriptor[0].samples.map((s) => s.channelType & 0xf)).toEqual([0, 1, 2, 15]);
    const top = Buffer.from(c.levels[0].levelData);
    expect(top.length).toBe(8 * 4 * 8);
    const at = (1 * 8 + 3) * 8;
    expect(fromHalf(top.readUInt16LE(at))).toBe(24);
    expect(c.levels[3].levelData.byteLength).toBe(1 * 1 * 8);
    const info = ktx2Info(ktx);
    expect(info.levelIndex[3].offset).toBeLessThan(info.levelIndex[0].offset); // smallest first
    expect(info.levelIndex.every((l) => l.offset % 8 === 0)).toBe(true);
  });

  it.runIf(zstdReady)('supercompresses with Zstandard, each level whole again when decompressed', () => {
    const plain = read(new Uint8Array(ddsToKtx2(makeDds(8, 4, 4, sun))));
    const z = read(new Uint8Array(ddsToKtx2(makeDds(8, 4, 4, sun), { zstd: true })));
    expect(z.supercompressionScheme).toBe(2);
    for (let l = 0; l < 4; l++) {
      expect(z.levels[l].uncompressedByteLength).toBe(plain.levels[l].levelData.byteLength);
      expect(Buffer.from(zlib.zstdDecompressSync(z.levels[l].levelData)).equals(Buffer.from(plain.levels[l].levelData))).toBe(true);
    }
  });

  it('turns floats to halves and back', () => {
    for (const v of [0, 0.5, 1, 2.5, 24, 1000]) expect(fromHalf(toHalf(v))).toBe(v);
    expect(fromHalf(toHalf(70000))).toBe(Infinity);
  });
});
