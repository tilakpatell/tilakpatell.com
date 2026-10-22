import { describe, expect, it } from 'vitest';
import { SEQUEL, cutsFor, fullCuts, isActThree, isSequel, partsOf, readManifest } from './bf2017-manifest.mjs';

const VADER = 'characters/hero/darthvader/darthvader_01/darthvader_01_mesh';
const HILT = 'gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh';
const chain = (tris) => tris.map((triangles, lod) => ({ lod, file: `web/models/x_lod${lod}.glb`, vertices: triangles, triangles, bytes: triangles * 40 }));
const TEXT = [
  { name: VADER, joints: 250, lods: chain([31042, 18642, 7520, 3575, 1061, 337]) },
  { name: HILT, lods: chain([920]) },
  { name: 'characters/hero/darthvader/darthvader_01/darthvader_01_cape_mesh', lods: chain([2000, 900]) },
  { name: 'characters/heads/heads_x/heads_x_01/heads_x_01_mesh', lods: chain([1500, 700]) },
]
  .map((e) => JSON.stringify(e))
  .join('\n\n');

describe('the 2017 manifest', () => {
  const m = readManifest(TEXT);

  it('reads one model a line, by name', () => {
    expect(m.size).toBe(4);
    expect(m.get(VADER).joints).toBe(250);
  });

  it('picks the cuts from the LOD chain', () => {
    const c = cutsFor(m.get(VADER));
    expect(c.plain.lod).toBe(2);
    expect(c.lod1.lod).toBe(4);
    expect(c.ultra).toBe(null);
    expect(cutsFor(m.get(VADER), { ultra: true }).ultra.lod).toBe(0);
    const d = cutsFor(m.get(VADER), { plainMax: 8000, lod1Max: 4000 });
    expect(d.plain.lod).toBe(2);
    expect(d.lod1.lod).toBe(3);
  });

  it('gives a one-LOD model its only cut, with no light or ultra one', () => {
    const c = cutsFor(m.get(HILT), { ultra: true });
    expect(c.plain.lod).toBe(0);
    expect(c.lod1).toBe(null);
    expect(c.ultra).toBe(null);
  });

  it('takes the last LOD when none is under the plain budget', () => {
    expect(cutsFor(m.get(VADER), { plainMax: 100 }).plain.lod).toBe(5);
  });

  it('picks the full-fidelity cuts: LOD0, the first under 1,500 and the last under 700', () => {
    const c = fullCuts(m.get(VADER));
    expect(c.plain.lod).toBe(0);
    expect(c.lod1.lod).toBe(4);
    expect(c.far.lod).toBe(5);
    // (a chain whose last cut is the light one has no far cut of its own)
    expect(fullCuts({ lods: chain([20000, 6000, 1400]) }).far).toBe(null);
    expect(fullCuts({ lods: chain([20000, 6000, 1400]) }).lod1.lod).toBe(2);
    // (nothing under 1,500: the lightest after LOD0)
    expect(fullCuts({ lods: chain([34814, 16890, 7890, 3589]) }).lod1.lod).toBe(3);
    const one = fullCuts(m.get(HILT));
    expect([one.plain.lod, one.lod1, one.far]).toEqual([0, null, null]);
  });

  it('finds the parts beside a model, never the model itself', () => {
    expect(partsOf(m, VADER, ['*_cape_mesh']).map((e) => e.name)).toEqual(['characters/hero/darthvader/darthvader_01/darthvader_01_cape_mesh']);
    expect(partsOf(m, VADER, ['*']).map((e) => e.name)).toEqual(['characters/hero/darthvader/darthvader_01/darthvader_01_cape_mesh']);
  });

  it('takes a part named in full from any folder (a hero’s head is under characters/heads/)', () => {
    const head = 'characters/heads/heads_x/heads_x_01/heads_x_01_mesh';
    expect(partsOf(m, VADER, [head]).map((e) => e.name)).toEqual([head]);
    expect(partsOf(m, VADER, ['*_cape_mesh', head]).map((e) => e.name)).toEqual(['characters/hero/darthvader/darthvader_01/darthvader_01_cape_mesh', head]);
    // (a full name the manifest hasn't is a typo: a hero would come out headless)
    expect(() => partsOf(m, VADER, ['characters/heads/nobody_mesh'])).toThrow(/nobody_mesh/);
  });

  it('knows the sequel era by its folders', () => {
    expect(isSequel('characters/hero/kyloren/kyloren_01/kyloren_01_mesh')).toBe(true);
    expect(isSequel('characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh')).toBe(false);
    expect(isSequel('gameplay/vehicles/air/xwing_t70/x')).toBe(true);
    expect(isSequel('gameplay/vehicles/air/xwing_t65/x')).toBe(false);
    expect(isSequel('Characters/Hero/KyloRen/x')).toBe(true);
    expect(SEQUEL).toContain('jump_cop');
    // (the drop's sequel-era troopers sit under d_assault_newera and the like)
    expect(isSequel('characters/dark/d_assault_newera/d_assault_newera_01/d_assault_newera_01_mesh')).toBe(true);
    expect(isSequel('characters/dark/d_assault_orig/d_assault_orig_ho_01/d_assault_orig_ho_01_mesh')).toBe(false);
  });

  it('knows the sequel era by its team, faction, level and hero names', () => {
    expect(isSequel('Gameplay/Teams/MP/NewEra/Team_Light_NewEra_JA')).toBe(true);
    expect(isSequel('S1/Gameplay/Kits/Hero/Finn/Kit/Kit_Hero_Finn')).toBe(true);
    expect(isSequel('Gameplay/Kits/Hero/BB8/Kit/Kit_Hero_BB8')).toBe(true);
    expect(isSequel('Gameplay/Kits/Hero/BB9E/Kit/Kit_Hero_BB9E')).toBe(true);
    expect(isSequel('S1/Gameplay/Kits/Hero/Phasma/Kit/Kit_Hero_Phasma')).toBe(true);
    expect(isSequel('Gameplay/Kits/Hero/Rey/Kit_Hero_Rey')).toBe(true);
    expect(isSequel('Levels/MP/Crait_01/Crait_01')).toBe(true);
    expect(isSequel('Gameplay/Kits/Hero/Luke/Kit_Hero_Luke')).toBe(false);
    expect(isSequel('Gameplay/Kits/Hero/DarthVader/Kit_Hero_DarthVader')).toBe(false);
    expect(isSequel('Gameplay/Kits/MP/Assault/Kit_L_Assault_Orig_HO')).toBe(false);
  });

  it('knows the campaign’s third act, which is the sequel era’s, by its folders', () => {
    expect(isActThree('a3/characters/hero/iden/act3/iden_act3_01/iden_act3_01_mesh')).toBe(true);
    expect(isActThree('characters/hero/iden/act3/iden_act3_01/iden_act3_01_1p_mesh')).toBe(true);
    expect(isActThree('A3_Levels/SP/x')).toBe(true);
    expect(isActThree('characters/hero/iden/act1/iden_act1_01/iden_act1_01_mesh')).toBe(false);
    expect(isActThree('characters/hero/iden/act2/iden_act2_01/iden_act2_01_mesh')).toBe(false);
    // (a whole segment, or its first word: a name that merely holds the letters is not the act)
    expect(isActThree('characters/npc/humans/ba3x/ba3x_01_mesh')).toBe(false);
  });
});
