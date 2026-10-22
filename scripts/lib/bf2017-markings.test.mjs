import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKINGS, markingsColour, recordFile } from './bf2017-markings.mjs';

// (the game's records as the export has them: the B1's default skin, its body and backpack)
const variation = (...colours) => ({
  name: 'Characters/Markings/D_Preq/Troopers/Default/D_Assault_Preq_01_Default',
  objects: [{ $type: 'ObjectVariation', Name: 'x' }, ...colours.map((c) => ({ $type: 'MeshMaterialVariation', Shader: { VectorParameters: c ? [{ Value: { x: c[0], y: c[1], z: c[2], w: 1 }, ParameterName: 'Color0_Base' }] : [] } }))],
});
const TAN = [0.637596846, 0.5647115, 0.3662526];

describe('the markings colour', () => {
  it('is the one Color0_Base the skin’s variations give, body and backpack alike', () => {
    expect(markingsColour([variation(TAN, TAN, TAN), variation(TAN)])).toEqual([0.637597, 0.564712, 0.366253]);
  });

  it('refuses variations that give none, or give different ones', () => {
    expect(() => markingsColour([variation(null)])).toThrow(/no Color0_Base/);
    expect(() => markingsColour([variation(TAN), variation([0.53, 0.159, 0.092])])).toThrow(/differ/);
  });

  it('is for the droids’ markings preset', () => {
    expect(MARKINGS.test('Shaders/Presets/SS_CharactersPreset_RobotMarkings')).toBe(true);
    expect(MARKINGS.test('Shaders/Presets/SS_CharactersPreset_WalrusMetallic')).toBe(false);
  });
});

describe('a record under the drop’s root', () => {
  const name = 'Characters/Markings/D_Preq/Troopers/Default/D_Assault_Preq_01_Default';
  it('is the bucket’s gzipped JSON where the fetch keeps it', () => {
    const want = join('/r', `data/${name}.json.gz`);
    expect(recordFile('/r', name, (f) => f === want)).toBe(want);
  });

  it('is the export’s plain JSON under web/data where the desktop has it', () => {
    const want = join('/r', `web/data/${name}.json`);
    expect(recordFile('/r', `${name}.json`, (f) => f === want)).toBe(want);
    expect(recordFile('/r', name, () => false)).toBe(null);
  });
});
