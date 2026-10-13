import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bodiesOf, collectionRulebook, lookOf, matchSkins, skinKey, telemetryOf } from './bf2017-rulebook-collection.mjs';

const ref = (i) => ({ $ref: i });
const at = (name, type = 'X') => ({ $asset: name, $assetType: type });
const str = (hash) => ({ $type: 'LocalizedStringId', StringHash: hash });

// A small export: Luke's kit with two looks, his ability screen with one
// ability and one star card, a pose and an emote, and the assault class's
// skin rows with its Hoth kit.
function exportRoot() {
  const root = mkdtempSync(join(tmpdir(), 'bf-collection-'));
  const rows = [];
  const put = (name, type, objects) => {
    const file = join(root, 'data', `${name}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ name, type, guid: '00000000-0000-0000-0000-000000000000', root: 0, objects }));
    rows.push([name, type, `data/${name}.json`, 1].join('\t'));
  };
  put('Gameplay/Kits/Hero/Luke/Kit_Hero_Luke', 'WSSoldierCustomizationKitAsset', [
    { $type: 'WSSoldierCustomizationKitAsset', Gameplay: at('Gameplay/Kits/Hero/Luke/GP_Hero_Luke'), Appearances: [at('Characters/Hero/Luke/Luke_ROTJ_01/VUR_Luke_ROTJ_01'), at('Characters/Hero/Luke/Luke_Yavin_01/VUR_Luke_Yavin_01')] },
  ]);
  put('Gameplay/Kits/Hero/KyloRen/Kit_Hero_KyloRen', 'WSSoldierCustomizationKitAsset', [{ $type: 'WSSoldierCustomizationKitAsset', Appearances: [] }]);
  put('Characters/Hero/Luke/Luke_ROTJ_01/VUR_Luke_ROTJ_01', 'VisualUnlockRootAsset', [{ $type: 'VisualUnlockRootAsset', DebugUnlockId: 'VUR_Luke_ROTJ_01' }]);
  put('Characters/Hero/Luke/Luke_Yavin_01/VUR_Luke_Yavin_01', 'VisualUnlockRootAsset', [{ $type: 'VisualUnlockRootAsset', DebugUnlockId: 'VUR_Luke_Yavin_01' }]);
  put('Gameplay/Kits/Hero/Luke/GP_Hero_Luke', 'WSSoldierCustomizationGameplayAsset', [
    { $type: 'WSSoldierCustomizationGameplayAsset', Abilities: ref(1) },
    { $type: 'PlayerAbilityCustomization', AllAbilities: ref(2), AdditionalAbilities: [at('Gameplay/Kits/Hero/Luke/StarCards/StarCard_Luke_1_RushImmunity')] },
    { $type: 'PlayerAbilityCollection', Abilities: [at('Gameplay/Kits/Hero/Luke/Ability_Luke_ForcePush'), at('Gameplay/Equipment/VictoryPoses/Heroes/Pose_HeroVictoryPose_Hero_Luke_MvP1')] },
  ]);
  put('UI/Metadata/KitAppearanceUIMetaData', 'UIMetaDataAsset', [
    { $type: 'UIMetaDataAsset', Items: [ref(1), ref(2)], Assets: [] },
    { $type: 'UICharacterKitAppearanceMetaData', NameLocalizedStringId: ref(3), AurebeshName: 'JEDI', Rarity: 'RarityType_Common', Identifiers: [1], TelemetryId: 'VUR_Luke_ROTJ_01' },
    { $type: 'UICharacterKitAppearanceMetaData', NameLocalizedStringId: ref(4), AurebeshName: 'YAVIN CEREMONY', Rarity: 'RarityType_Epic', Identifiers: [2], TelemetryId: 'VUR_Luke_Yavin' },
    str(0x10),
    str(0x11),
  ]);
  put('UI/Metadata/LukeAbilityUIMetaData', 'UIMetaDataAsset', [
    { $type: 'UIMetaDataAsset', Items: [] },
    { $type: 'UIPlayerAbilityMetaData', NameLocalizedStringId: ref(4), SvgImage: at('UI/SVG/Customize/Heroes/Luke/Abilities/Luke_Ability_03'), Category: 'PlayerAbilityCategory_Left', Rarity: 'RarityType_Common', HasStarCardData: false, Identifiers: [3], TelemetryId: 'Ability - Force Push' },
    { $type: 'UIPlayerAbilityMetaData', NameLocalizedStringId: ref(4), Category: 'PlayerAbilityCategory_Left', HasStarCardData: false, Identifiers: [4], TelemetryId: 'Ability - Force Push SP' },
    { $type: 'UIPlayerAbilityMetaData', NameLocalizedStringId: ref(5), ModifierIcon: at('UI/SVG/Customize/Heroes/Luke/Card/Luke_Card_01'), StarCardData: ref(6), Category: 'PlayerAbilityCategory_Passive', Rarity: 'RarityType_Common', HasStarCardData: true, Identifiers: [5, 6], TelemetryId: 'Star Card - Luke - Star Card 1' },
    str(0x20),
    str(0x21),
    { $type: 'UIStarCardMetaData', Image3D: at('UI/Bitmaps/Frontend/Cards/Card_Images/Characters/LukeSkywalker/Card_LukeSkywalker_01_Mid'), ModifiersMetaData: [{ $type: 'UIStarCardModifierMetaData', StatParams: { Arg0: 8, Arg1: 10, Arg2: 12, Arg3: 15 }, IsPercent: true }] },
  ]);
  put('UI/Metadata/EmotesUIMetaData', 'UIMetaDataAsset', [
    { $type: 'UIMetaDataAsset', Items: [] },
    { $type: 'UIEmoteMetaData', NameLocalizedStringId: ref(3), RarityType: 'RarityType_Rare', Identifiers: [7], TelemetryId: 'Ability Hero Emote Luke 1' },
    { $type: 'UIEmoteMetaData', NameLocalizedStringId: ref(3), RarityType: 'RarityType_Common', Identifiers: [8], TelemetryId: 'Ability Emote The not the droids' },
    str(0x30),
  ]);
  put('UI/Metadata/VictoryPosesUIMetaData', 'UIMetaDataAsset', [
    { $type: 'UIMetaDataAsset', Items: [] },
    { $type: 'UIPlayerAbilityMetaData', NameLocalizedStringId: ref(3), Rarity: 'RarityType_Rare', Identifiers: [9], TelemetryId: 'Luke MvP 1' },
    { $type: 'UIPlayerAbilityMetaData', NameLocalizedStringId: ref(3), Rarity: 'RarityType_Common', Identifiers: [10], TelemetryId: 'Trooper MvP 1' },
    str(0x40),
  ]);
  put('UI/Metadata/VoiceLinesUIMetaData', 'UIMetaDataAsset', [{ $type: 'UIMetaDataAsset', Items: [] }]);
  put('UI/Metadata/KitAppearanceSkinUIMetaData', 'UIMetaDataAsset', [{ $type: 'UIMetaDataAsset', Items: [], Assets: [at('UI/MetaData/Unlocks/Assault_Orig_SkinUIMetaData')] }]);
  put('UI/MetaData/Unlocks/Assault_Orig_SkinUIMetaData', 'UIMetaDataAsset', [
    { $type: 'UIMetaDataAsset', Items: [] },
    { $type: 'UICharacterKitAppearanceSkinMetaData', NameLocalizedStringId: ref(3), AurebeshName: 'SNOWTROOPER', Rarity: 'RarityType_Rare', Identifiers: [11], TelemetryId: 'Assault_SnowTrooper' },
    { $type: 'UICharacterKitAppearanceSkinMetaData', NameLocalizedStringId: ref(3), AurebeshName: 'NIKTO REBEL 01', Rarity: 'RarityType_Rare', Identifiers: [12], TelemetryId: 'Assault_Orig_Nikto' },
    str(0x50),
  ]);
  put('Gameplay/Kits/MP/Assault/Kit_D_Assault_Orig_HO', 'WSSoldierCustomizationKitAsset', [{ $type: 'WSSoldierCustomizationKitAsset', Appearances: [at('Characters/Dark/D_Assault_Orig/D_Assault_Orig_HO_01/MPVUR_D_Assault_Orig_HO_01')] }]);
  writeFileSync(join(root, 'data.tsv'), `${rows.join('\n')}\n`);
  return root;
}

const STRINGS = { strings: { '00000010': 'JEDI', '00000011': 'YAVIN CEREMONY', '00000020': 'PUSH', '00000021': 'RUSH IMMUNITY', '00000030': 'NOT THE DROIDS', '00000040': 'I AM READY', '00000050': 'SNOWTROOPER' } };
const CREDITS = {
  'bf2017-luke': { title: 'Star Wars Battlefront II (2017): characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh', file: '/models/galaxy/bf2017/crew/luke.glb' },
  'bf2017-snowtrooper': { title: 'Star Wars Battlefront II (2017): characters/dark/d_assault_orig/d_assault_orig_ho_01/d_assault_orig_ho_01_mesh', file: '/models/galaxy/bf2017/crew/snowtrooper.glb' },
};

describe('the telemetry names', () => {
  it('reads the owner and the number from each of the game’s spellings', () => {
    expect(telemetryOf('Ability Hero Emote Luke 2')).toEqual({ owner: 'luke', n: 2 });
    expect(telemetryOf('Anakin - Emote 1')).toEqual({ owner: 'anakin', n: 1 });
    expect(telemetryOf('Grievous - Voiceline 1')).toEqual({ owner: 'grievous', n: 1 });
    expect(telemetryOf('Darth Vader MvP 3')).toEqual({ owner: 'darthvader', n: 3 });
    expect(telemetryOf('Ability Hero Emote Palpatine 4')).toEqual({ owner: 'emperor', n: 4 });
    expect(telemetryOf('Trooper MvP 1')).toEqual({ owner: 'assault', n: 1 });
    expect(telemetryOf('Ability Emote The Rancor')).toEqual({ owner: 'trooper', n: null, word: 'Rancor' });
    expect(telemetryOf('Ability Emote Example Left')).toBeNull();
  });
});

describe('the skins', () => {
  it('pairs a hero’s looks with its rows by the designers’ names, then what is left in order', () => {
    const row = (t) => ({ row: { TelemetryId: t }, where: t });
    const apps = ['VUR_DarthMaul_01', 'VUR_DarthMaul_RobotLegs_01'].map((id) => ({ id }));
    const pairs = matchSkins(apps, [row('VUR_Maul_02'), row('VUR_Maul_01'), row('VUR_Luke_ROTJ_01')]);
    expect(pairs.map(([a, r]) => [a.id, r?.where])).toEqual([
      ['VUR_DarthMaul_01', 'VUR_Maul_01'],
      ['VUR_DarthMaul_RobotLegs_01', 'VUR_Maul_02'],
    ]);
    expect(skinKey('VUR_CountDooku_02')).toBe('dooku_02');
    expect(skinKey('MPVUR_L_Assault_Orig_HO_01')).toBe('l_assault_orig_ho_01');
  });

  it('reads a trooper skin’s look: a planet’s armour, a legion, a head', () => {
    expect(lookOf('Assault_SnowTrooper', 'SNOWTROOPER')).toEqual({ planet: 'HO' });
    expect(lookOf('Heay_Orig_Shoretrooper', 'SHORETROOPER')).toEqual({ planet: 'SCAR' });
    expect(lookOf('Assault_212_Desert_P1', '212TH RECON DIVISION')).toEqual({ legion: '212', phase: 1 });
    expect(lookOf('Assault_Preq_501', '501ST LEGION')).toEqual({ legion: '501' });
    expect(lookOf('Assault_Orig_Nikto', 'NIKTO REBEL 01')).toEqual({ head: 'Nikto' });
    expect(lookOf('Assault_PlanetDefault', 'DEFAULT APPEARANCE')).toEqual({ planet: 'default' });
  });

  it('finds the crew file cut from a folder by the credits’ titles', () => {
    expect(bodiesOf(CREDITS).get('characters/hero/luke/luke_rotj_01')).toBe('luke');
  });
});

describe('the collection rulebook', () => {
  const book = collectionRulebook(exportRoot(), { strings: STRINGS, credits: CREDITS, books: { heroes: { luke: { side: 'light', name: 'ID_CHAR_LUKE' } } } });

  it('gives a hero its looks with the game’s names, rarities and the site’s bodies', () => {
    const luke = book.characters.luke;
    expect(luke).toMatchObject({ kind: 'hero', side: 'light', skins: ['VUR_Luke_ROTJ_01', 'VUR_Luke_Yavin_01'] });
    expect(book.skins.VUR_Luke_ROTJ_01).toMatchObject({ of: 'luke', name: '#00000010', rarity: 'common', body: 'luke' });
    expect(book.skins.VUR_Luke_Yavin_01).toMatchObject({ name: '#00000011', rarity: 'epic', aurebesh: 'YAVIN CEREMONY', body: null });
    expect(book.strings['#00000011']).toBe('YAVIN CEREMONY');
    expect(book._missing).toEqual([]);
    expect(book._skipped).toContain('Gameplay/Kits/Hero/KyloRen/Kit_Hero_KyloRen');
  });

  it('gives a hero its abilities and star cards from its ability screen, the campaign’s left out', () => {
    expect(book.characters.luke.abilities).toEqual(['luke.left']);
    expect(book.abilities['luke.left']).toMatchObject({ slot: 'left', name: '#00000020', icon: 'UI/SVG/Customize/Heroes/Luke/Abilities/Luke_Ability_03' });
    expect(book.characters.luke.cards).toEqual(['luke.1']);
    expect(book.cards['luke.1']).toMatchObject({ n: 1, name: '#00000021', levels: [8, 10, 12, 15], percent: true, ability: 'StarCard_Luke_1_RushImmunity', image: 'UI/Bitmaps/Frontend/Cards/Card_Images/Characters/LukeSkywalker/Card_LukeSkywalker_01_Mid' });
  });

  it('files the emotes and poses by owner, a hero’s pose with its own ability', () => {
    expect(book.characters.luke.emotes).toEqual(['luke.1']);
    expect(book.characters.luke.poses).toEqual(['luke.1']);
    expect(book.poses['luke.1']).toMatchObject({ rarity: 'rare', ability: 'Pose_HeroVictoryPose_Hero_Luke_MvP1' });
    expect(book.characters.assault.emotes).toEqual(['trooper.notthedroids']);
    expect(book.characters.assault.poses).toEqual(['assault.1']);
  });

  it('files a trooper class’s skins by faction, a planet’s look with its kit’s record and body', () => {
    const a = book.characters.assault;
    expect(a.factions.empire.skins).toEqual(['assault.empire.snowtrooper']);
    expect(a.factions.rebel.skins).toEqual(['assault.rebel.nikto']);
    expect(book.skins['assault.empire.snowtrooper']).toMatchObject({ look: { planet: 'HO' }, record: 'Characters/Dark/D_Assault_Orig/D_Assault_Orig_HO_01/MPVUR_D_Assault_Orig_HO_01', body: 'snowtrooper', rarity: 'rare' });
    expect(book.skins['assault.rebel.nikto']).toMatchObject({ look: { head: 'Nikto' }, body: null });
  });
});
