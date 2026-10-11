import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { instanceUse, levelRule, ktx2Of, variationsOf } from './bf2017-variations.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/bf2017/variations/${name}.json`, import.meta.url), 'utf8'));
const hoth = { sub: 'Hoth_01', record: fixture('hoth_01.mvdb') };
const content = { sub: 'content', record: fixture('content.mvdb') };
const variations = ['Box_M_01_A_Snow', 'LightWall_S_01_Off', 'LightWall_S_01_Red'].map(fixture);
// the bucket's KTX2s: everything but the snow crate's mask
const listing = (path) => !/t_box_m_01_a_m(__normal)?\.ktx2$/.test(path);

const CRATE = 'objects/props/objectsets/_rebelalliance/box_m_01/box_m_01_a_mesh';
const WALL = 'objects/props/objectsets/_rebelalliance/_lights/lightwall_s_01/lightwall_s_01_mesh';
const SNOW = 'Box_M_01_A_Snow';

describe('ktx2Of', () => {
  it("is the bucket's KTX2 of a game texture, lower case, or null when the listing lacks it", () => {
    expect(ktx2Of('Objects/A/T_X_CS', () => true)).toBe('textures/objects/a/t_x_cs.ktx2');
    expect(ktx2Of('Objects/A/T_X_N', (p) => p.endsWith('__normal.ktx2'))).toBe('textures/objects/a/t_x_n__normal.ktx2');
    expect(ktx2Of('Objects/A/T_X_CS', () => false)).toBe(null);
  });
});

describe('variationsOf', () => {
  const out = variationsOf({ mvdbs: [hoth], variations, listing });

  it("binds a variation's textures by parameter name to the bucket's KTX2", () => {
    const snow = out.meshes[CRATE].variations[SNOW];
    expect(snow.materials[0].textures._CS).toBe('textures/objects/props/objectsets/_rebelalliance/box_m_01/t_box_m_01_a_cs.ktx2');
    expect(snow.hash).toBe(2773463200);
    expect(snow.asset).toBe('Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow');
  });

  it("takes the object variation's shader preset per material", () => {
    expect(out.meshes[CRATE].variations[SNOW].materials[0].shader).toBe('Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_SnowMask_01');
  });

  it('keeps a texture the bucket lacks under `missing`, its slot null, the rest bound (Review Focus 2)', () => {
    const m = out.meshes[CRATE].variations[SNOW].materials[0];
    expect(m.textures._RGB).toBe(null);
    expect(m.missing).toEqual({ _RGB: 'Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/T_Box_M_01_A_M' });
    expect(out.missing).toContain('Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/T_Box_M_01_A_M');
    expect(m.textures._NAM_texcoord0).toMatch(/t_box_m_01_a_nam\.ktx2$/);
  });

  it("reads a variation's vectors, plain-named, as four numbers", () => {
    // (the wall's second material is its lamp)
    const red = out.meshes[WALL].variations.LightWall_S_01_Red.materials;
    expect(red[1].vectors.EmissiveIntensety).toEqual([196608, 0, 0, 1]);
    expect(red[0].vectors).toBeUndefined();
  });

  it("keeps each mesh's default bindings, and the record each came from", () => {
    const def = out.meshes[CRATE].default;
    expect(def[0].textures._CS).toMatch(/t_box_m_01_a_cs\.ktx2$/);
    expect(out.meshes[CRATE]._source.mvdb).toEqual(['levels/mp/hoth_01/hoth_01/MeshVariationDb_Win32']);
    expect(out.meshes[CRATE]._source.variations[SNOW]).toBe('Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow');
  });

  it('counts what it wrote', () => {
    expect(out.counts).toMatchObject({ meshes: 4, withVariations: 2, missingTextures: 1 });
    expect(out.format).toBe(1);
    expect(out.instances).toBe(null);
  });
});

describe('levelRule', () => {
  it('gives a mesh its one variation when no sub-level names its default', () => {
    const out = variationsOf({ mvdbs: [hoth], variations, listing });
    // (the level's own MVDB carries default and snow side by side: the rule
    // reads which defaults the level's sub-levels name apart from it)
    expect(levelRule(out.meshes, new Set())).toMatchObject({ [CRATE]: SNOW });
  });

  it('gives nothing when a sub-level names the default', () => {
    const out = variationsOf({ mvdbs: [hoth, content], variations, listing });
    expect(levelRule(out.meshes, out.usedDefaults)[CRATE]).toBeUndefined();
  });

  it('never picks between two variations without instance hashes (Review Focus 1)', () => {
    const out = variationsOf({ mvdbs: [hoth], variations, listing });
    expect(levelRule(out.meshes, new Set())[WALL]).toBeUndefined();
  });
});

describe('instanceUse', () => {
  const groups = [
    { mesh: 0, sub: 0, kind: 'static', count: 3, offset: 0 },
    { mesh: 1, sub: 0, kind: 'static', count: 2, offset: 3 },
    { mesh: 1, sub: 0, kind: 'object', count: 1, offset: 5 },
  ];
  const meshes = [{ file: `models/${CRATE}.glb` }, { file: `models/${WALL}.glb` }];
  const members = {
    0: [
      { MeshAsset: { $asset: WALL }, InstanceCount: 2, InstanceObjectVariation: [71403881, 71417493] },
      { MeshAsset: { $asset: CRATE }, InstanceCount: 3, InstanceObjectVariation: [2773463200, 2773463200, 2773463200] },
    ],
  };
  const names = new Map([
    [2773463200, SNOW],
    [71403881, 'LightWall_S_01_Off'],
    [71417493, 'LightWall_S_01_Red'],
  ]);

  it("gives each static group its member's per-instance variations, matched by mesh and count", () => {
    const r = instanceUse({ groups, meshes, members, names });
    expect(r.instances).toEqual([
      [0, SNOW],
      [1, ['LightWall_S_01_Off', 'LightWall_S_01_Red']],
    ]);
  });

  it('says per mesh which variation its instances use, and when they disagree', () => {
    const r = instanceUse({ groups, meshes, members, names });
    expect(r.byMesh[CRATE]).toEqual({ [SNOW]: 3 });
    expect(r.byMesh[WALL]).toEqual({ LightWall_S_01_Off: 1, LightWall_S_01_Red: 1 });
  });

  it('counts an instance with hash 0 as the default', () => {
    const r = instanceUse({ groups: groups.slice(0, 1), meshes, members: { 0: [{ MeshAsset: { $asset: CRATE }, InstanceCount: 3, InstanceObjectVariation: [0, 2773463200, 0] }] }, names });
    expect(r.byMesh[CRATE]).toEqual({ default: 2, [SNOW]: 1 });
  });
});

describe('variationsOf with instance use', () => {
  it('applies a variation every instance of the mesh uses; a mixed mesh gets none', () => {
    const use = { [CRATE]: { [SNOW]: 3 }, [WALL]: { LightWall_S_01_Off: 1, LightWall_S_01_Red: 1 } };
    const out = variationsOf({ mvdbs: [hoth, content], variations, listing, use });
    expect(out.meshes[CRATE]).toMatchObject({ use: SNOW, by: 'instances' });
    expect(out.meshes[WALL]).toMatchObject({ use: null, by: 'mixed', uses: { LightWall_S_01_Off: 1, LightWall_S_01_Red: 1 } });
    expect(out.counts).toMatchObject({ byInstances: 1, mixed: 1 });
  });

  it('falls back to the level rule for a mesh no instance names', () => {
    const out = variationsOf({ mvdbs: [hoth], variations, listing, use: {} });
    expect(out.meshes[CRATE]).toMatchObject({ use: SNOW, by: 'rule' });
    expect(out.counts.byRule).toBe(1);
  });
});

describe('meshBindings', () => {
  it("gives each of a mesh's materials its default bindings as glTF slots, by the database's parameter names", async () => {
    const { meshBindings } = await import('./bf2017-variations.mjs');
    const b = meshBindings([hoth.record], CRATE);
    expect(b[0]).toEqual([
      { slot: 'color', name: 'Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/T_Box_M_01_A_CS', parameter: '_CS' },
      { slot: 'normal', name: 'Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/T_Box_M_01_A_NAM', parameter: '_NAM_texcoord0' },
    ]);
    expect(b[1]).toEqual([{ slot: 'color', name: 'ToBeDeleted_TempInTransition/Objects/Props/_CommonTextures/T_Glass_01_CS', parameter: 'CS' }]);
    expect(meshBindings([hoth.record], 'nothing/here')).toBe(null);
  });
});
