import { describe, expect, it } from 'vitest';
import { aiKitOf, mpKitOf, roster, specialOf, wearOf } from './bf2017-troops.mjs';

describe('the kits’ names', () => {
  it('reads a class kit: side, class, era, planet; never the sequel’s', () => {
    expect(mpKitOf('Gameplay/Kits/MP/Assault/Kit_D_Assault_Orig_HO')).toEqual({ side: 'dark', cls: 'assault', era: 'Orig', planet: 'HO' });
    expect(mpKitOf('S5_1/Gameplay/Kits/MP/Heavy/Kit_L_Heavy_Preq_GEO')).toEqual({ side: 'light', cls: 'heavy', era: 'Preq', planet: 'GEO' });
    expect(mpKitOf('Gameplay/Kits/MP/Assault/Kit_D_Assault_NewEra_JA')).toBe(null);
    expect(mpKitOf('Gameplay/Kits/MP/Assault/Kit_L_Assault_Orig_YA_SkirmishHologram')).toBe(null);
  });

  it('reads the game’s bots’ kits, each era’s way', () => {
    expect(aiKitOf('S7_2/Gameplay/Kits/AI/Assault/OT/Kit_D_Assault_OT_AP-Vanguard-HOTH')).toMatchObject({ side: 'dark', cls: 'assault', era: 'Orig', planet: 'HO', variant: 'Vanguard' });
    expect(aiKitOf('S7_2/Gameplay/Kits/AI/Heavy/OT/Kit_L_Heavy_OT_AP-HOTH')).toMatchObject({ planet: 'HO', variant: null });
    expect(aiKitOf('S7_2/Gameplay/Kits/AI/Heavy/OT/Kit_D_Heavy_OT_AP')).toMatchObject({ planet: null, variant: null });
    expect(aiKitOf('S7_2/Gameplay/Kits/AI/Assault/Kit_D_Assault_Preq_KASH_AP-Vanguard')).toMatchObject({ side: 'dark', era: 'Preq', planet: 'KASH', variant: 'Vanguard' });
    expect(aiKitOf('S7_2/Gameplay/Kits/AP/Assault/Kit_L_Assault_Preq_KAM_AP_PHA_01-Vanguard')).toMatchObject({ side: 'light', era: 'Preq', planet: 'KAM', phase: 1 });
    expect(aiKitOf('S7_2/Gameplay/Kits/AI/Assault/NT/Kit_D_Assault_NT_AP')).toBe(null);
  });

  it('reads a reinforcement’s kit, the sequel’s refused', () => {
    expect(specialOf('Gameplay/Kits/Specials/JumpTrooper/Kit_Special_JumpTrooper')).toEqual({ id: 'JumpTrooper' });
    expect(specialOf('Gameplay/Kits/Specials/ResistanceJumpTrooper/Kit_Special_ResistanceJumpTrooper')).toBe(null);
    expect(specialOf('Gameplay/Kits/Specials/EwokRebel/Kit_Special_EwokRebel-AP')).toBe(null);
  });
});

// a kit, an outfit of one look, a blueprint
const kit = (app, faction = 'Gameplay/Factions/MP/Faction_Dark_Orig') => ({ objects: [{ $type: 'WSSoldierCustomizationKitAsset', Appearances: [{ $asset: app }], WSFaction: { $asset: faction } }] });
const look = (bundle) => ({ objects: [{ $type: 'VisualUnlockRootAsset', DefaultSkin: 0, ThirdPersonBundles: [{ Name: bundle }], SkinInfos: [] }] });
const bundle = (...bps) => ({ objects: [{ $type: 'VisualUnlockBlueprintBundle' }, ...bps.map((b) => ({ $type: 'VisualUnlockPartAsset', SkinId: 0, OutObjectBlueprint: { $asset: b } }))] });
const bp = (mesh) => ({ objects: [{ $type: 'ObjectBlueprint', Object: { $ref: 1 } }, { $type: 'MeshProxyEntityData', Mesh: { $asset: mesh, $assetType: 'SkinnedMeshAsset' } }] });
const records = {
  'Gameplay/Kits/MP/Assault/Kit_D_Assault_Orig_HO': kit('C/Storm'),
  'Gameplay/Kits/MP/Assault/Kit_D_Assault_Orig_EN': kit('C/Storm'),
  'S7_2/Gameplay/Kits/AI/Assault/OT/Kit_D_Assault_OT_AP-Vanguard-HOTH': kit('C/Snow'),
  'Gameplay/Kits/Specials/DeathTrooper/Kit_Special_DeathTrooper': kit('C/Death'),
  'C/Storm': look('c/storm_bpb'),
  'c/storm_bpb': bundle('C/StormBody'),
  'C/StormBody': bp('m/storm_mesh'),
  'C/Snow': look('c/snow_bpb'),
  'c/snow_bpb': bundle('C/SnowBody', 'C/Cape'),
  'C/SnowBody': bp('m/snow_mesh'),
  // (the snow outfit's maps: a body known by its meshes alone is not its own)
  'c/snow_bpb/MeshVariationDb_Win32': { objects: [{ $type: 'MeshVariationDatabase', Entries: [{ Mesh: { $asset: 'm/snow_mesh' }, VariationAssetNameHash: 0, Materials: [{ TextureParameters: [{ ParameterName: 'BaseColor', Value: { $asset: 'T/T_Snow_CS' } }] }] }] }] },
  'C/Cape': bp('m/cape_mesh'),
  'C/Death': look('c/death_bpb'),
  'c/death_bpb': bundle('C/DeathBody'),
  'C/DeathBody': bp('m/death_mesh'),
};
const read = (p) => records[p] ?? null;

describe('the roster', () => {
  const r = roster({ names: Object.keys(records), read, bodies: { stormtrooper: { record: 'C/Storm' }, snowtrooper: { parts: ['m/snow_mesh', 'm/cape_mesh'] }, deathtrooper: { record: 'C/Death' } } });

  it('holds each class by planet: your outfit, the bots’ and their kits', () => {
    expect(r.classes['d-orig-assault'].planets.HO).toMatchObject({ player: 'C/Storm', bots: 'C/Snow', botKits: ['S7_2/Gameplay/Kits/AI/Assault/OT/Kit_D_Assault_OT_AP-Vanguard-HOTH'] });
    // (a planet without the bots' own kit: the bots wear the class kit's)
    expect(r.classes['d-orig-assault'].planets.EN.bots).toBe('C/Storm');
    expect(r.specials.DeathTrooper).toMatchObject({ side: 'dark', record: 'C/Death' });
  });

  it('says which body wears a skin: its own meshes and maps, or the same meshes to stand in', () => {
    expect(r.outfits['C/Storm'].skins[0].body).toBe('stormtrooper');
    // (a body known by its meshes alone stands in, it is not the skin's own)
    expect(r.outfits['C/Snow'].skins[0]).toMatchObject({ body: null, stand: 'snowtrooper' });
    expect(r.missing).toEqual([]);
  });

  it('wears on each planet the bodies it has', () => {
    expect(r.wear.HO['d-orig-assault']).toEqual({ player: 'stormtrooper', bots: null });
    expect(wearOf(r, 'EN', 'd-orig-assault', 'bots')).toBe('stormtrooper');
    expect(wearOf(r, 'XX', 'd-orig-assault')).toBe(null);
  });
});
