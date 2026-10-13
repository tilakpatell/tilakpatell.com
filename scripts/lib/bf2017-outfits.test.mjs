import { describe, expect, it } from 'vitest';
import { meshesOf, outfitOf, skinName } from './bf2017-outfits.mjs';

// The records as the drop lays them out (MPVUR_D_Heavy_Orig_01's shape, cut
// down): a root with a common skin (no bundle) and three skins; the root's
// bundle with the common skin's parts and a first-person one; a skin with
// its own parts, one a MeshAndVariationPair; a skin of maps alone; and the
// MVDBs that bind each mesh's maps, by default and by variation.
const bp = (path, mesh) => ({ objects: [{ $type: 'ObjectBlueprint', Object: { $ref: 1 } }, { $type: 'MeshProxyEntityData', Mesh: { $asset: mesh, $assetType: 'SkinnedMeshAsset' } }], name: path });
const part = (skin, blueprint, extra = {}) => ({ $type: 'VisualUnlockPartAsset', SkinId: skin, OutObjectBlueprint: blueprint, RenderIn1p: false, ...extra });
const mvdb = (entries) => ({ objects: [{ $type: 'MeshVariationDatabase', Entries: entries }] });
const entry = (mesh, hash, colour) => ({ Mesh: { $asset: mesh }, VariationAssetNameHash: hash, Materials: [{ TextureParameters: [{ ParameterName: 'BaseColor', Value: { $asset: colour } }, { ParameterName: 'Normal', Value: { $asset: `${colour}_NM` } }] }] });
const R = 'Characters/Dark/X/X_01';
const records = {
  [`${R}/MPVUR_X_01`]: {
    name: `${R}/MPVUR_X_01`,
    objects: [
      {
        $type: 'VisualUnlockRootAsset',
        Name: `${R}/MPVUR_X_01`,
        DefaultSkin: 11,
        SelectSkinMethod: 'SelectSkinMethod_Default',
        ThirdPersonBundles: [{ Name: 'x/mpvur_x_01_bpb' }],
        SkinInfos: [
          { Identifier: 10, VisibleInUI: false, ThirdPersonBundle: { Name: '', Parents: [] } },
          { Identifier: 11, VisibleInUI: true, ThirdPersonBundle: { Name: 'x/mpvur_x_01_skin1_default_bpb', Parents: [{ Name: 'x/mpvur_x_01_bpb' }] } },
          { Identifier: 12, VisibleInUI: true, ThirdPersonBundle: { Name: 'x/mpvur_x_01_skin2_sand_bpb', Parents: [{ Name: 'x/mpvur_x_01_bpb' }] } },
          { Identifier: 13, VisibleInUI: true, ThirdPersonBundle: { Name: 'x/mpvur_x_01_skin3_scarif_bpb', Parents: [{ Name: 'x/mpvur_x_01_bpb' }] } },
        ],
      },
    ],
  },
  'x/mpvur_x_01_bpb': { name: 'x/mpvur_x_01_bpb', objects: [{ $type: 'VisualUnlockBlueprintBundle' }, part(10, { $asset: `${R}/Body` }), part(10, { $asset: `${R}/Helmet` }), part(0, { $asset: 'Characters/BodyParts/Gloves_01/Gloves_01' }), part(0, { $asset: `${R}_1p/X_1p_Upperbody` }, { RenderIn1p: true })] },
  'x/mpvur_x_01_bpb/MeshVariationDb_Win32': mvdb([entry('characters/x/body_mesh', 0, 'T_Body_CS'), entry('characters/x/helmet_mesh', 0, 'T_Helmet_CS'), entry('characters/x/helmet_mesh', 777, 'T_Helmet_Sand_CS')]),
  'x/mpvur_x_01_skin1_default_bpb': { objects: [{ $type: 'BlueprintBundle', Blueprint: { $asset: 'x/mpvur_x_01_skin1_default_bpb_dccb' } }] },
  'x/mpvur_x_01_skin1_default_bpb_dccb': { name: 'x/mpvur_x_01_skin1_default_bpb_dccb', objects: [{ $type: 'DataContainerCollectionBlueprint' }, part(11, { $asset: `${R}/Body` }), part(11, { $asset: `${R}/Helmet` }), { $type: 'VisualUnlockSkinAsset', SkinId: 11, DebugUnlockId: 'MPVUR_X_01_Skin1_Default' }] },
  'x/mpvur_x_01_skin2_sand_bpb': { objects: [{ $type: 'BlueprintBundle', Blueprint: { $asset: 'x/mpvur_x_01_skin2_sand_bpb_dccb' } }] },
  'x/mpvur_x_01_skin2_sand_bpb_dccb': {
    name: 'x/mpvur_x_01_skin2_sand_bpb_dccb',
    objects: [{ $type: 'DataContainerCollectionBlueprint' }, part(12, { $asset: `${R}/SandBody` }), part(12, { $ref: 3 }), { $type: 'MeshAndVariationPair', MeshAsset: { $asset: 'characters/x/helmet_mesh', $assetType: 'SkinnedMeshAsset' }, Variation: { $asset: `${R}/Helmet_Sand` } }, { $type: 'VisualUnlockSkinAsset', SkinId: 12, DebugUnlockId: 'MPVUR_X_01_Skin2_Sand' }],
  },
  'x/mpvur_x_01_skin2_sand_bpb/MeshVariationDb_Win32': mvdb([entry('characters/x/sandbody_mesh', 0, 'T_SandBody_CS')]),
  'x/mpvur_x_01_skin3_scarif_bpb': { objects: [{ $type: 'BlueprintBundle', Blueprint: { $asset: 'x/mpvur_x_01_skin3_scarif_bpb_dccb' } }] },
  'x/mpvur_x_01_skin3_scarif_bpb_dccb': { name: 'x/mpvur_x_01_skin3_scarif_bpb_dccb', objects: [{ $type: 'DataContainerCollectionBlueprint' }, { $type: 'VisualUnlockSkinAsset', SkinId: 13, DebugUnlockId: 'MPVUR_X_01_Skin3_Scarif' }] },
  'x/mpvur_x_01_skin3_scarif_bpb/MeshVariationDb_Win32': mvdb([entry('characters/x/body_mesh', 0, 'T_Body_Scarif_CS')]),
  [`${R}/Body`]: bp(`${R}/Body`, 'characters/x/body_mesh'),
  [`${R}/SandBody`]: bp(`${R}/SandBody`, 'characters/x/sandbody_mesh'),
  [`${R}/Helmet`]: bp(`${R}/Helmet`, 'characters/x/helmet_mesh'),
  'Characters/BodyParts/Gloves_01/Gloves_01': bp('Characters/BodyParts/Gloves_01/Gloves_01', 'characters/bodyparts/gloves_01/gloves_01_mesh'),
  [`${R}/Helmet_Sand`]: { objects: [{ $type: 'ObjectVariation', NameHash: 777 }] },
};
const read = (p) => records[p] ?? records[Object.keys(records).find((k) => k.toLowerCase() === String(p).toLowerCase())] ?? null;
const meshes = (skin) => skin.parts.map((p) => p.mesh + (p.variation ? `~${p.variation.split('/').pop()}` : '')).sort();

describe('a soldier’s outfit from its records', () => {
  const o = outfitOf(read, `${R}/MPVUR_X_01`);

  it('names its skins, the default and how one is picked', () => {
    expect(o.skins.map((s) => [s.name, s.default, s.ui])).toEqual([
      ['default', true, true],
      ['sand', false, true],
      ['scarif', false, true],
    ]);
    expect(o.pick).toBe('default');
    expect(o.missing).toEqual([]);
  });

  it('dresses each skin in its own parts and the ones every skin wears, never a first-person part', () => {
    const [def, sand, scarif] = o.skins;
    expect(meshes(def)).toEqual(['characters/bodyparts/gloves_01/gloves_01_mesh', 'characters/x/body_mesh', 'characters/x/helmet_mesh']);
    // (a part that is a mesh in a variation: the sand skin's helmet)
    expect(meshes(sand)).toEqual(['characters/bodyparts/gloves_01/gloves_01_mesh', 'characters/x/helmet_mesh~Helmet_Sand', 'characters/x/sandbody_mesh']);
    // (a skin of maps alone wears the common skin's parts)
    expect(meshes(scarif)).toEqual(meshes(def));
  });

  it('binds each mesh’s maps as the skin’s databases do: its own over the root’s, a variation by its hash', () => {
    const [def, sand, scarif] = o.skins;
    const colour = (s, mesh) => s.maps[mesh]?.[0].find((t) => t.parameter === 'BaseColor')?.texture;
    expect(colour(def, 'characters/x/body_mesh')).toBe('T_Body_CS');
    expect(colour(scarif, 'characters/x/body_mesh')).toBe('T_Body_Scarif_CS');
    expect(colour(sand, 'characters/x/helmet_mesh')).toBe('T_Helmet_Sand_CS');
    expect(colour(sand, 'characters/x/sandbody_mesh')).toBe('T_SandBody_CS');
  });

  it('takes a default that is the common skin as a skin of its own', () => {
    const common = { ...records, [`${R}/MPVUR_X_01`]: { ...records[`${R}/MPVUR_X_01`], objects: [{ ...records[`${R}/MPVUR_X_01`].objects[0], DefaultSkin: 10 }] } };
    const c = outfitOf((p) => common[p] ?? read(p), `${R}/MPVUR_X_01`);
    expect(c.skins[0]).toMatchObject({ name: 'common', default: true, ui: false });
    expect(meshes(c.skins[0])).toEqual(meshes(o.skins[0]));
  });

  it('is null for a record that is no outfit', () => {
    expect(outfitOf(read, 'nothing')).toBe(null);
  });
});

describe('the outfit readers', () => {
  it('finds a blueprint’s meshes through its references', () => {
    expect(meshesOf(records[`${R}/Body`])).toEqual(['characters/x/body_mesh']);
  });
  it('names a skin by its unlock id', () => {
    expect(skinName('MPVUR_D_Assault_Orig_01_Skin2_Hoth')).toBe('hoth');
    expect(skinName('MPVUR_L_Assault_Orig_HO_01_Skin1_Hakan')).toBe('hakan');
    expect(skinName('nothing')).toBe(null);
  });
});
