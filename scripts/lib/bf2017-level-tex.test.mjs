import { describe, expect, it } from 'vitest';
import { bucketPathOf, texGaps, textureDirs } from './bf2017-level-tex.mjs';

// A far LOD of Theed's building facades as the pack has it: its stand-in
// materials (M_LowerLods_01, simplewindow) wear the facade's atlas, which the
// bucket had not got when the pack was built, so level.json has no row for it
const facade = {
  materials: [
    { name: 'M_LowerLods_01', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 1 } }, extras: { shader: 'Shaders/Presets/Walrus/SS_PropsPreset_Simple', textures: { _BaseColor: 'textures/objects/architecture/naboo/textures/t_nab_01_a_combined_01_cs.png' } } },
    { name: 'simplewindow', pbrMetallicRoughness: { baseColorTexture: { index: 0 } }, extras: { shader: 'Objects/Architecture/Naboo/Shaders/SS_BuildingWindows_Simple_01', textures: { _BaseColor: 'textures/objects/architecture/naboo/textures/t_nab_01_a_combined_01_cs.png' } } },
  ],
  textures: [{ extensions: { KHR_texture_basisu: { source: 0 } } }, { extensions: { KHR_texture_basisu: { source: 1 } } }],
  images: [
    { uri: '../tex/t_nab_01_a_combined_01_cs.ktx2', mimeType: 'image/ktx2' },
    { uri: '../tex/t_nab_01_a_combined_01_cs__orm_04e5dd3e.ktx2', mimeType: 'image/ktx2' },
  ],
};
const brick = { materials: [{ name: 'M_Brick', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }], textures: [{ source: 0 }], images: [{ uri: '../tex/t_naboo_bricks_05_cs.ktx2' }] };
const meshes = [
  { name: 'models/objects/architecture/naboo/o_nab_buildingfacades/o_nab_building_01_a_combined_01_mesh.glb', radius: 13.55, glb: [null, 'meshes/facade.lod1.glb', 'meshes/facade.lod3.glb'] },
  { name: 'models/x/small_mesh.glb', radius: 1.5, glb: ['meshes/small.lod0.glb'] },
  { name: 'models/x/brick_mesh.glb', radius: 4, glb: ['meshes/brick.lod0.glb'] },
  { name: 'models/x/gone_mesh.glb', radius: 40, glb: [null, null] },
];
const glbs = { 'meshes/facade.lod1.glb': facade, 'meshes/facade.lod3.glb': facade, 'meshes/small.lod0.glb': facade, 'meshes/brick.lod0.glb': brick };
const tex = { t_naboo_bricks_05_cs: { low: 256, mid: 512, high: 512, srgb: true } };

describe('texGaps', () => {
  it('finds the far LODs’ facade atlas the pack has no row for, worn by M_LowerLods_01 and simplewindow, at its biggest wearer’s radius', () => {
    const gaps = texGaps(meshes, (p) => glbs[p], tex);
    expect([...gaps.keys()].sort()).toEqual(['t_nab_01_a_combined_01_cs', 't_nab_01_a_combined_01_cs__orm_04e5dd3e']);
    const g = gaps.get('t_nab_01_a_combined_01_cs');
    expect(g.radius).toBe(13.55);
    expect(g.materials).toEqual(['M_LowerLods_01', 'simplewindow']);
    // (where the GLB's own material says its source map was)
    expect(g.dirs).toEqual(['textures/objects/architecture/naboo/textures']);
  });

  it('a texture the pack has a row for is no gap, and a mesh the pack left out names nothing', () => {
    const gaps = texGaps(meshes, (p) => glbs[p], tex);
    expect(gaps.has('t_naboo_bricks_05_cs')).toBe(false);
    expect(texGaps([meshes[3]], () => facade, {}).size).toBe(0);
  });
});

describe('bucketPathOf', () => {
  const index = textureDirs([
    { name: 'Objects/Architecture/Naboo/Textures/T_NAB_01_A_Combined_01_CS', file: 'textures/objects/architecture/naboo/textures/t_nab_01_a_combined_01_cs.png' },
    { name: 'Other/T_NAB_01_A_Combined_01_CS', file: 'textures/other/t_nab_01_a_combined_01_cs.png' },
    { name: 'Objects/Architecture/Naboo/Textures/T_Lonely_CS', file: 'textures/objects/architecture/naboo/textures/t_lonely_cs.png' },
  ]);

  it('a map and its derived ORM are the KTX2s beside the source map the GLB names', () => {
    const dirs = ['textures/objects/architecture/naboo/textures'];
    expect(bucketPathOf('t_nab_01_a_combined_01_cs', dirs, index)).toBe('textures/objects/architecture/naboo/textures/t_nab_01_a_combined_01_cs.ktx2');
    expect(bucketPathOf('t_nab_01_a_combined_01_cs__orm_04e5dd3e', dirs, index)).toBe('textures/objects/architecture/naboo/textures/t_nab_01_a_combined_01_cs__orm_04e5dd3e.ktx2');
  });

  it('without the GLB’s word, the index’s one folder; two folders and no word is no guess', () => {
    expect(bucketPathOf('t_lonely_cs', [], index)).toBe('textures/objects/architecture/naboo/textures/t_lonely_cs.ktx2');
    expect(bucketPathOf('t_nab_01_a_combined_01_cs', [], index)).toBeNull();
    expect(bucketPathOf('t_nowhere_cs', [], index)).toBeNull();
  });
});
