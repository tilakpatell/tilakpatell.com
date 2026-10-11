import { describe, expect, it } from 'vitest';
import { pictureOf } from '../../lib/three/light/grade.js';
import lightingFile from '../../data/bf2017/maps/hoth.lighting.json';
import { litWith, picturesOf } from './picture.js';
import { entryFor } from './weather.js';

const lighting = lightingFile.rows ?? lightingFile;

describe('the Battlefront world under the record’s picture', () => {
  it('finds every weather’s panorama, gradient, clouds and 33³ LUT over the rulebook’s entry', async () => {
    const pictures = await picturesOf('hoth');
    for (const w of Object.keys(lighting.weathers)) {
      const plain = entryFor(lighting, w);
      // (the rulebook's entry alone names no texture: nothing of the picture is found)
      expect(pictureOf(plain, pictures.weathers[w])?.panorama ?? null, w).toBeNull();
      const { entry, picture } = litWith(pictures, plain, w);
      const pic = pictureOf(entry, picture);
      expect(pic.grade.tonemap, w).toBe('linear');
      expect(pic.grade.bloom.weights, w).toHaveLength(5);
      expect(pic.lut, w).toMatchObject({ size: 33, url: expect.stringMatching(/^\/textures\/galaxy\/bf2017\/light\/hoth\/.+\.lut33\.png$/) });
      expect(pic.panorama.url, w).toMatch(/\.panorama\.ktx2$/);
      expect(pic.gradient.url, w).toMatch(/\.gradient\.ktx2$/);
      expect(pic.cloudShadow.url, w).toMatch(/\.clouds\.ktx2$/);
      // (the rulebook's own numbers stay: its sky's luminance, its bloom)
      expect(entry.record.SkyComponentData[0].LuminanceScale).toBe(plain.record.SkyComponentData[0].LuminanceScale);
    }
  });
  it('lights a level without a picture file as before', async () => {
    const plain = entryFor(lighting, 'sunny');
    expect(await picturesOf('nowhere')).toBeNull();
    expect(litWith(null, plain, 'sunny')).toEqual({ entry: plain, picture: null });
  });
});
