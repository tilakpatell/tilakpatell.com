import { describe, expect, it } from 'vitest';
import lightingFile from '../../../data/bf2017/maps/hoth.lighting.json';
import { areaDistance, areaVisibility, insideOf, patchRecord, skyShare, visibilities } from './inside.js';

const lighting = lightingFile.rows;
const INTERIOR = 'Levels/Lighting/Hoth/Interior_01/VE_PV_Hoth_Interior_01';
const NO_SUN = 'Lighting/VE/VE_No_Sun';
// (the fuel rooms' box, Default_Lighting's OBBData f724a10e)
const box = { kind: 'box', at: [217.6719, 374.9233, -1770.4879], half: [58.8856, 15.9026, 97.0492] };

describe('the interiors’ proximity blends', () => {
  it('measures the view to a box as the game does: 0 inside, the distance to its nearest face out of it', () => {
    expect(areaDistance(box, [209, 361, -1755])).toBe(0);
    expect(areaDistance(box, [217.6719, 374.9233, -1770.4879 + 97.0492 + 10])).toBeCloseTo(10, 6);
    // (a turned box: its axes in the export's frame, Default_Lighting's 3f294281)
    const turned = {
      kind: 'box',
      at: [0, 0, 0],
      basis: [
        [0.7835, 0, -0.6214],
        [0, 1, 0],
        [0.6214, 0, 0.7835],
      ],
      half: [41.78, 6.037, 45.187],
    };
    expect(areaDistance(turned, [0.6214 * 50, 0, 0.7835 * 50])).toBeCloseTo(50 - 45.187, 2);
  });

  it('ramps a VE in over its ProximityDistance: 1 − d / distance, 0 beyond', () => {
    const area = { proximity: 20, shapes: [box], ves: [{ ve: INTERIOR }] };
    expect(areaVisibility(area, [209, 361, -1755])).toBe(1);
    expect(areaVisibility(area, [217.6719, 374.9233, -1770.4879 + 97.0492 + 5])).toBeCloseTo(0.75, 6);
    expect(areaVisibility(area, [217.6719, 374.9233, -1770.4879 + 97.0492 + 25])).toBe(0);
  });

  it('reads Hoth’s from the rulebook: the interior VE over 20 m and VE_No_Sun over 1 m of the nine boxes, both at reference 0', () => {
    const inside = insideOf(lighting);
    expect(Object.keys(inside.patches).sort()).toEqual([NO_SUN, INTERIOR].sort());
    expect(inside.patches[INTERIOR].reference).toBe(0);
    expect(inside.patches[NO_SUN].reference).toBe(0);
    const near = inside.areas.filter((a) => a.shapes.length === 9);
    expect(near.map((a) => a.proximity).sort((a, b) => a - b)).toEqual([1, 20]);
    // (in the fuel rooms both are whole; at the west mouth, out on the snow, neither)
    expect(visibilities(inside.areas, [209, 361, -1755])).toMatchObject({ [INTERIOR]: 1, [NO_SUN]: 1 });
    expect(visibilities(inside.areas, [178, 357, -1545])).toMatchObject({ [INTERIOR]: 0, [NO_SUN]: 0 });
  });

  it('folds a patch’s fields into the weather’s record by its visibility, and leaves the rest', () => {
    const { patches } = insideOf(lighting);
    const record = { TonemapComponentData: [{ MinEV: 11, MaxEV: 15, ExposureCompensation: 1.5, EV: 10 }], OutdoorLightComponentData: [{ SunIntensity: 128000, SunColor: [1, 0.956, 0.918], SunRotationY: 32.9 }] };
    const half = patchRecord(record, patches, { [INTERIOR]: 0.5, [NO_SUN]: 0 });
    expect(half.TonemapComponentData[0]).toMatchObject({ MinEV: 9.75, MaxEV: 12.75, ExposureCompensation: 1.5, EV: 10 });
    expect(half.OutdoorLightComponentData[0].SunIntensity).toBe(128000);
    const under = patchRecord(record, patches, { [INTERIOR]: 1, [NO_SUN]: 1 });
    expect(under.TonemapComponentData[0]).toMatchObject({ MinEV: 8.5, MaxEV: 10.5 });
    expect(under.OutdoorLightComponentData[0]).toMatchObject({ SunIntensity: 0.001, SunColor: [0, 0, 0], SunRotationY: 32.9 });
    // (the weather's own record untouched)
    expect(record.TonemapComponentData[0].MinEV).toBe(11);
  });

  it('gives the sky the view still has: none where the sun is put out', () => {
    const { patches } = insideOf(lighting);
    expect(skyShare(patches, {})).toBe(1);
    expect(skyShare(patches, { [INTERIOR]: 1, [NO_SUN]: 0.25 })).toBe(0.75);
    expect(skyShare(patches, { [NO_SUN]: 1 })).toBe(0);
  });
});
