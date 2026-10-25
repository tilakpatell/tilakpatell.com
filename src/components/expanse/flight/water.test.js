import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWater } from './water';
import { PLANETS, planetSpecOf } from './planets';
import { WATER_LOOKS, waterColourOf } from '../../../lib/land/flight/planetTables';

const sheetOf = (spec) => createWater(new THREE.Scene(), spec);

describe('a planet’s water sheet', () => {
  it('is drawn in the colour the pure tables say, for every one of the fifty with water', () => {
    let n = 0;
    for (const { id } of PLANETS) {
      const spec = planetSpecOf(id);
      const sheet = sheetOf(spec);
      if (!sheet) continue;
      n++;
      expect(`#${sheet.mesh.material.color.getHexString()}`, id).toBe(waterColourOf(spec.water, spec.palette.accent));
      expect(sheet.mesh.material.roughness, id).toBe(WATER_LOOKS[spec.water.kind].roughness);
      sheet.dispose();
    }
    expect(n).toBeGreaterThanOrEqual(8);
  });

  it('wears a generated planet’s own sea, not its kind’s', () => {
    const spec = { id: 'e:3,-2:1:0', palette: { accent: '#80c0a0' }, water: { kind: 'sea', level: 0, colour: '#2a6a9a' } };
    const sheet = sheetOf(spec);
    const hex = `#${sheet.mesh.material.color.getHexString()}`;
    expect(hex).toBe(waterColourOf(spec.water, spec.palette.accent));
    expect(hex).not.toBe(waterColourOf({ kind: 'sea', level: 0 }, spec.palette.accent));
    sheet.dispose();
  });

  it('has none where there’s no water, or none it draws', () => {
    expect(sheetOf({ palette: { accent: '#ffffff' }, water: null })).toBeNull();
    expect(sheetOf({ palette: { accent: '#ffffff' }, water: { kind: 'clouds', level: -380 } })).toBeNull();
  });
});
