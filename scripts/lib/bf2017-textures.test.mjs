import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { basisuPath, encodeImage } from '../ktx2.mjs';
import { normalPng, ormPng, parseDerived, unpackKtx2 } from './bf2017-textures.mjs';

const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const png = (size, rgba) => sharp({ create: { width: size, height: size, channels: 4, background: { r: rgba[0], g: rgba[1], b: rgba[2], alpha: rgba[3] / 255 } } }).png().toBuffer();
const pixel = async (buf) => [...(await sharp(buf).ensureAlpha().raw().toBuffer()).subarray(0, 4)];
const hasBasisu = (() => {
  try {
    return existsSync(basisuPath());
  } catch {
    return false;
  }
})();

describe('the 2017 drop’s textures', () => {
  it('reads the manifest’s recipe for the derived maps', () => {
    expect(parseDerived(['normal:A/x_nm', 'orm:A/x_nm:ao=A/x_nm|b;rough=A/x_cs|a;metal='])).toEqual({
      normal: ['A/x_nm'],
      orm: [{ from: 'A/x_nm', ao: { map: 'A/x_nm', ch: 'b' }, rough: { map: 'A/x_cs', ch: 'a' }, metal: null }],
    });
    expect(parseDerived(undefined)).toEqual({ normal: [], orm: [] });
  });

  it('packs occlusion, roughness (from smoothness) and metal as glTF wants them', async () => {
    const maps = { 'A/x_nm': await png(2, [128, 128, 200, 255]), 'A/x_cs': await png(2, [10, 20, 30, 55]) };
    const out = await ormPng({ from: 'A/x_nm', ao: { map: 'A/x_nm', ch: 'b' }, rough: { map: 'A/x_cs', ch: 'a' }, metal: null }, async (m) => maps[m]);
    expect((await pixel(out)).slice(0, 3)).toEqual([200, 200, 0]);
    const plain = await ormPng({ from: 'A/x_nm', ao: null, rough: null, metal: { map: 'A/x_nm', ch: 'r' } }, async (m) => maps[m]);
    expect((await pixel(plain)).slice(0, 3)).toEqual([255, 128, 128]);
  });

  it('keeps a normal’s x and y and rebuilds its z', async () => {
    const [r, g, b, a] = await pixel(await normalPng(await png(2, [128, 128, 7, 9])));
    expect([r, g, a]).toEqual([128, 128, 255]);
    expect(b).toBeGreaterThanOrEqual(254);
    const [, , tilted] = await pixel(await normalPng(await png(2, [255, 128, 7, 9])));
    expect(tilted).toBeLessThan(140);
  });

  it.skipIf(!hasBasisu)(
    'unpacks a KTX2 to one PNG at full size',
    // (basisu is spawned twice, to pack and unpack: a tenth of a second alone,
    // seconds when the whole suite shares the machine)
    { timeout: 20000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'bf2017-tex-'));
      const { ktx2 } = await encodeImage(await png(16, [200, 100, 50, 255]), { role: 'color' });
      const file = join(dir, 'in.ktx2');
      await writeFile(file, ktx2);
      const out = join(dir, 'out');
      const made = await unpackKtx2(file, out);
      const meta = await sharp(made).metadata();
      expect([meta.width, meta.height, meta.channels]).toEqual([16, 16, 4]);
      expect(readdirSync(out)).toEqual(['in.png']);
    },
  );
});


describe('slotOfParameter: a variation database binding’s glTF slot', () => {
  it('reads the colour, normal, packed and emissive slots by the parameter’s name', async () => {
    const { slotOfParameter } = await import('./bf2017-textures.mjs');
    for (const n of ['Color', '_CS', 'CS', 'BaseColor', '_BaseColor', 'CW', '_CA']) expect(slotOfParameter(n), n).toBe('color');
    for (const n of ['NS', '_NAM_texcoord0', '_NAM', 'Normal', '_Normal', 'N', 'NA', '_NA_texcoord0']) expect(slotOfParameter(n), n).toBe('normal');
    for (const n of ['_RGB', 'Mask', 'RSSSAO', 'MSR', 'RM']) expect(slotOfParameter(n), n).toBe('packed');
    for (const n of ['Emissive', '_EM', '_Emissive']) expect(slotOfParameter(n), n).toBe('emissive');
    // (noted, not bound: the Fresnel colour; and anything the table does not know)
    expect(slotOfParameter('F90ColorTexture')).toBe(null);
    expect(slotOfParameter('DetailNS')).toBe(null);
    expect(slotOfParameter('WeatheringMask')).toBe(null);
  });
});
