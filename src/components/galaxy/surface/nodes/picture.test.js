import { describe, expect, it } from 'vitest';
import { PICTURES, pictureFor } from './picture';
import { pictureOf } from '../../../../lib/three/light/grade';

describe('a world’s picture', () => {
  it('Hoth’s: the weather’s record, its textures by the site’s paths, the level’s lamps', async () => {
    const pic = await pictureFor('hoth', null, { url: (p) => p });
    expect(pic.weather).toBe('sunny');
    expect(pic.record.TonemapComponentData).toHaveLength(1);
    expect(pic.record.OutdoorLightComponentData[0]).toBeTruthy();
    expect(pic.panorama.url).toBe('/textures/galaxy/bf2017/light/hoth/sunny.panorama.ktx2');
    expect(pic.lut).toEqual({ url: '/textures/galaxy/bf2017/light/hoth/sunny.lut.png', size: 17 });
    expect(Object.keys(pic.lights.cells).length).toBeGreaterThan(0);
    // what grade.js makes of it: the record's tone map and the textures
    const p = pictureOf({ record: pic.record, name: pic.name }, pic);
    expect(p.grade.tonemap).toBe('linear');
    expect(p.panorama.url).toBe(pic.panorama.url);
  });

  it('another weather by name; a world without a picture, none', async () => {
    expect((await pictureFor('hoth', 'sunset', { url: (p) => p })).panorama.url).toContain('sunset');
    expect(await pictureFor('tatooine')).toBe(null);
    expect(Object.keys(PICTURES)).toEqual(['hoth']);
  });
});
