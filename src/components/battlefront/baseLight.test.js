import { describe, expect, it } from 'vitest';
import lightingFile from '../../data/bf2017/maps/hoth.lighting.json';
import pictures from '../../data/bf2017/light/hoth.picture.json';
import { levelLightOf, lutFor } from './baseLight.js';
import { lampRows } from './weather.js';

const lighting = lightingFile.rows;
const bytes = (o) => new TextEncoder().encode(JSON.stringify(o)).buffer;

describe('the level’s light beyond its weather', () => {
  it('draws the lighting prefabs’ lamps beside the layers’ own, the bounce’s only left out', async () => {
    expect(lampRows(lighting).length).toBe(lighting.lights.length + lighting.prefabs.reduce((n, p) => n + (lighting.prefabLights[p.name]?.length ?? 0), 0));
    const { lights } = await levelLightOf({ lighting });
    const n = Object.values(lights.cells).reduce((a, c) => a + c.length, 0);
    expect(n).toBe(480);
  });

  it('names the interior grade’s LUT from the picture manifest by the patch’s own', () => {
    const { inside } = { inside: { patches: { a: { components: { ColorCorrection: { HdrColorGradingLut: 'Levels/Lighting/Hoth/Interior_01/T_CC_Hoth_Interior_01' } } } } } };
    expect(lutFor(pictures, inside)).toEqual({ url: 'textures/galaxy/bf2017/light/hoth/interior.lut33.png', size: 33 });
    expect(lutFor(pictures, { patches: {} })).toBeNull();
  });

  it('takes the interior pack’s reflection volumes into the export’s frame, its cubes by face', async () => {
    const asked = [];
    const inner = {
      pack: { origin: [205, 362.296875, -1540], yaw: 0 },
      loadBin: async (p) => {
        asked.push(p);
        if (p === 'probes.json') return bytes({ probes: [{ id: '9c323d00', faces: 'probes/9c323d00', centre: [-27.1, 0.67, -77.04], axes: [[16.66, 0, 0], [0, 5.56, 0], [0, 0, 47.36]], horizon: [133, 150, 212] }] });
        return new ArrayBuffer(4);
      },
    };
    const got = await levelLightOf({ lighting, pictures, level: { inner, pack: inner.pack, loadBin: inner.loadBin }, deps: { loadHdr: (faces) => ({ faces: faces.length }) } });
    expect(got.volumes).toHaveLength(1);
    expect(got.volumes[0].min.map((v) => Math.round(v))).toEqual([161, 357, -1664]);
    expect(got.volumes[0].max.map((v) => Math.round(v))).toEqual([195, 369, -1570]);
    expect(await got.loadCube(got.volumes[0])).toEqual({ faces: 6 });
    expect(asked).toContain('probes/9c323d00.px.hdr');
    expect(got.inside.lut.size).toBe(33);
    // (the volumetrics only where asked)
    expect(got.volumetrics).toBeNull();
  });
});
