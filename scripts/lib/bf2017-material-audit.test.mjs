import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auditPack } from './bf2017-material-audit.mjs';
import { entriesOf, variationsOf } from './bf2017-variations.mjs';

// the variation writer's fixture: Hoth_01's MVDB trimmed to the snow crate
// and the icicles, the crate's variation record, their materials.jsonl rows
const FIX = JSON.parse(readFileSync(new URL('../fixtures/bf2017/variations/hoth-crate.json', import.meta.url), 'utf8'));
const CRATE = 'objects/props/objectsets/_rebelalliance/box_m_01/box_m_01_a_mesh';
const ICICLE = 'objects/nature/arctic/arcticice/arcticice_iceicles_01/arcticice_iceicles_04_mesh';
const SLUGS = ['t_box_m_01_a_cs', 't_box_m_01_a_nam__normal', 't_box_m_01_a_nam__orm_67a0539c', 't_glass_01_cs', 't_glass_01_cs__orm_08c3d535'];
const mvdbs = [{ path: 'data/Levels/MP/Hoth_01/Hoth_01/MeshVariationDb_Win32.json', record: FIX.mvdb }];
const materials = new Map(FIX.materials.map((r) => [r.mesh, r]));
const entries = entriesOf(mvdbs);
const variations = variationsOf({ mvdbs, records: [FIX.snow], materials, slugs: SLUGS, meshes: [CRATE, ICICLE] });
const meshes = [
  { key: ICICLE, mats: 1 },
  { key: CRATE, mats: 3 },
  { key: 'objects/elsewhere/rock_mesh', mats: 1 },
];
const byState = (rows) => Object.fromEntries(rows.map((r) => [`${r.mesh.split('/').pop()}#${r.material}`, r.state]));

describe('the material audit', () => {
  it('says per drawn material whether it is bound as the game binds it', () => {
    const out = auditPack({ meshes, entries, materials, variations: { ...variations, rule: {} } });
    expect(byState(out.rows)).toEqual({
      'arcticice_iceicles_04_mesh#0': 'bound',
      // (the crate has a variation the level's rule did not choose)
      'box_m_01_a_mesh#0': 'default-only',
      'box_m_01_a_mesh#1': 'default-only',
      'box_m_01_a_mesh#2': 'default-only',
      'rock_mesh#0': 'no-entry',
    });
    expect(out.counts).toEqual({ bound: 1, 'default-only': 3, 'missing-texture': 0, unbound: 0, 'no-entry': 1 });
    expect(out.share).toBeCloseTo(1 / 5);
  });

  it('counts a chosen variation whose map the pack lacks as missing, naming it', () => {
    const out = auditPack({ meshes, entries, materials, variations });
    const rows = out.rows.filter((r) => r.mesh === CRATE);
    expect(rows.map((r) => r.state)).toEqual(['missing-texture', 'bound', 'missing-texture']);
    expect(rows[0].variation).toBe('Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow');
    expect(rows[0].slots).toEqual(['_RGB']);
    expect(rows[2].slots).toEqual(['DestructionRGBA']);
  });

  it('names a slot the GLB binds to another map than the database’s', () => {
    const other = new Map(materials);
    const row = structuredClone(materials.get(CRATE));
    row.materials[0].textures._CS = 'Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/T_Box_M_01_B_CS';
    other.set(CRATE, row);
    const out = auditPack({ meshes: [{ key: CRATE, mats: 1 }], entries, materials: other, variations: { ...variations, rule: {}, meshes: {} } });
    expect(out.rows[0]).toMatchObject({ state: 'unbound', slots: ['_CS'] });
  });
});
