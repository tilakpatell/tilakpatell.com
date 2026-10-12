import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { basisuPath, encodeImage } from '../ktx2.mjs';
import { normalPng, ormPng, parseDerived, specularFactorOf, unpackKtx2, weaponMaterial } from './bf2017-textures.mjs';

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
      orm: [{ from: 'A/x_nm', ao: { map: 'A/x_nm', ch: 'b' }, rough: { map: 'A/x_cs', ch: 'a' }, metal: null, rebuild: false }],
    });
    expect(parseDerived(['orm:A/x_nam:ao=A/x_nam|a;metal=A/x_rgb|g;rebuild']).orm[0]).toMatchObject({ metal: { map: 'A/x_rgb', ch: 'g' }, rebuild: true });
    expect(parseDerived(undefined)).toEqual({ normal: [], orm: [] });
  });

  it('knows a Walrus weapon preset: no occlusion, the game’s reflectance 0.5, the uploader’s channels kept', () => {
    // (the game's shader: metal = NAM.b, smoothness = CS.a, reflectance 0.5, no occlusion;
    // the _Mask gates the weathering only: bf2-re findings/18-textures.md)
    for (const s of ['Shaders/Presets/Walrus/SS_WeaponsPreset', 'Shaders/Presets/Walrus/SS_WeaponsPreset_Alpha', 'Shaders/Presets/Walrus/SS_WeaponsPreset_TransparentDepth', 'Shaders/Presets/Walrus/SS_WeaponPreset_Transparancy']) expect(weaponMaterial(s), s).toEqual({ reflectance: 0.5, occlusion: false });
    for (const s of ['Shaders/presets/SS_CharactersPreset_MSRAO', 'Shaders/Presets/SS_PropsPreset', '', undefined]) expect(weaponMaterial(s), String(s)).toBe(null);
    // the uploader's recipe for a weapon is the game's: nothing is marked to rebuild
    const [e11] = parseDerived(['orm:Gameplay/Equipment/Rifles/E11/T_E11_NAM:ao=Gameplay/Equipment/Rifles/E11/T_E11_NAM|a;rough=Gameplay/Equipment/Rifles/E11/T_E11_CS|a;metal=Gameplay/Equipment/Rifles/E11/T_E11_NAM|b']).orm;
    expect(e11).toMatchObject({ metal: { map: 'Gameplay/Equipment/Rifles/E11/T_E11_NAM', ch: 'b' }, rough: { map: 'Gameplay/Equipment/Rifles/E11/T_E11_CS', ch: 'a' }, rebuild: false });
  });

  it('turns Frostbite’s reflectance into glTF’s specular factor', () => {
    // F0 = 0.16·r² against glTF's 0.04: a weapon's 0.5 is the default, 0.25 a quarter of it, above 0.5 clamped
    expect(specularFactorOf(0.5)).toBe(1);
    expect(specularFactorOf(0.25)).toBeCloseTo(0.25, 6);
    expect(specularFactorOf(0.4)).toBeCloseTo(0.64, 6);
    expect(specularFactorOf(1)).toBe(1);
    expect(specularFactorOf(0)).toBe(0);
  });

  it('packs occlusion, roughness (from smoothness) and metal as glTF wants them', async () => {
    const maps = { 'A/x_nm': await png(2, [128, 128, 200, 255]), 'A/x_cs': await png(2, [10, 20, 30, 55]) };
    const out = await ormPng({ from: 'A/x_nm', ao: { map: 'A/x_nm', ch: 'b' }, rough: { map: 'A/x_cs', ch: 'a' }, metal: null }, async (m) => maps[m]);
    expect((await pixel(out)).slice(0, 3)).toEqual([200, 200, 0]);
    const plain = await ormPng({ from: 'A/x_nm', ao: null, rough: null, metal: { map: 'A/x_nm', ch: 'r' } }, async (m) => maps[m]);
    expect((await pixel(plain)).slice(0, 3)).toEqual([255, 128, 128]);
  });

  it('builds an ORM marked rebuild from its sources before the uploader’s own PNG', async () => {
    const { mkdir } = await import('node:fs/promises');
    const { resolveImage } = await import('./bf2017-textures.mjs');
    const root = await mkdtemp(join(tmpdir(), 'bf2017-orm-'));
    const dir = join(root, 'web', 'textures', 'a');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'x_nam.png'), await png(2, [128, 128, 7, 255]));
    await writeFile(join(dir, 'x_cs.png'), await png(2, [50, 50, 50, 55]));
    await writeFile(join(dir, 'x_rgb.png'), await png(2, [0, 230, 0, 255]));
    await writeFile(join(dir, 'x_nam__orm_ab12.png'), await png(2, [255, 200, 7, 255]));
    const at = 'web/textures/a/x_nam__orm_ab12.ktx2';
    const stale = 'orm:A/x_nam:ao=A/x_nam|a;rough=A/x_cs|a;metal=A/x_nam|b';
    const own = await resolveImage(at, { root, derived: [stale], unpackDir: join(root, 'unpacked') });
    expect(own.from).toBe('x_nam__orm_ab12.png');
    expect((await pixel(own.png)).slice(0, 3)).toEqual([255, 200, 7]);
    // (a recipe of the site's own, marked rebuild, wins over the uploader's PNG)
    const rebuilt = [stale, 'orm:A/x_nam:ao=A/x_nam|a;rough=A/x_cs|a;metal=A/x_rgb|g;rebuild'];
    const mended = await resolveImage(at, { root, derived: rebuilt, unpackDir: join(root, 'unpacked') });
    expect(mended.from).toBe('x_nam.png + x_cs.png + x_rgb.png (orm, rebuilt)');
    expect((await pixel(mended.png)).slice(0, 3)).toEqual([255, 200, 230]);
    // (the export's own GLBs name the derived map as the uploader's PNG)
    const asPng = await resolveImage(at.replace(/\.ktx2$/, '.png'), { root, derived: rebuilt, unpackDir: join(root, 'unpacked') });
    expect((await pixel(asPng.png)).slice(0, 3)).toEqual([255, 200, 230]);
    // a map not on disk: the uploader's own PNG, else its recipe, as before
    const gone = [stale, 'orm:A/x_nam:ao=A/x_nam|a;rough=A/x_cs|a;metal=A/x_missing|g;rebuild'];
    expect((await resolveImage(at, { root, derived: gone, unpackDir: join(root, 'unpacked') })).from).toBe('x_nam__orm_ab12.png');
    const { rm } = await import('node:fs/promises');
    await rm(join(dir, 'x_nam__orm_ab12.png'));
    const fromSources = await resolveImage(at, { root, derived: gone, unpackDir: join(root, 'unpacked') });
    expect(fromSources.from).toBe('x_nam.png + x_cs.png (orm)');
    expect((await pixel(fromSources.png)).slice(0, 3)).toEqual([255, 200, 7]);
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
