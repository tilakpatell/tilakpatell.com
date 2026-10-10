// The 2017 game's icons, by the game's name or by the site's: a sprite a
// family under /ui/bf2017/ (scripts/bf2017-ui.mjs), the table
// src/data/bf2017/icons.json { [game name]: [family, symbol id] }.
//
// icon(name) → { sprite, id, href } | null: name is a game icon's
//   ('Weapons/Weapons_E-11') or one of the site's (ICON_FOR's keys:
//   'weapon:rifle', 'ability:lukePush', 'hero:vader', 'class:heavy',
//   'side:dark', 'vehicle:speeder'); null when the game has no such icon, so
//   the caller draws its own glyph
// ICON_FOR: the site's things → the game's icon of the same thing

import TABLE from '../../data/bf2017/icons.json';

export const ICONS = TABLE.rows;

export const ICON_FOR = {
  // the guns (weaponRules.js) the game has
  'weapon:blaster': 'Weapons/Weapons_DL-44',
  'weapon:rifle': 'Weapons/Weapons_E-11',
  'weapon:a280': 'Weapons/Weapons_A280',
  'weapon:dlt19': 'Weapons/Weapons_DLT-19',
  'weapon:ee3': 'Weapons/Weapons_EE-3',
  'weapon:dc15': 'Weapons/Weapons_DC-15A',
  'weapon:e5': 'Weapons/Weapons_E-5',
  'weapon:bowcaster': 'Weapons/Weapons_Bowcaster',
  // a hero's own weapon (heroes.js's ids)
  'hero:luke': 'Weapons/Weapons_LukeLightsaber',
  'hero:vader': 'Weapons/Weapons_VaderLightSaber',
  'hero:maul': 'Weapons/Weapons_MaulLightsaber',
  'hero:dooku': 'Weapons/Weapons_DookuLightsaber',
  'hero:obiwan': 'Weapons/Weapons_ObiWanLightsaber',
  'hero:anakin': 'Weapons/Weapons_AnakinLightsaber',
  'hero:palpatine': 'Weapons/Weapons_EmperorForceLightning',
  'hero:yoda': 'Weapons/Weapons_YodaLightSaber',
  'hero:han': 'Weapons/Weapons_DL-44',
  'hero:leia': 'Weapons/Weapons_Defender',
  'hero:chewie': 'Weapons/Weapons_Bowcaster',
  'hero:bobafett': 'Weapons/Weapons_EE-3',
  'hero:lando': 'Weapons/Weapons_LandoX-8NightSniper',
  'hero:bossk': 'Weapons/Weapons_Relby',
  // the heroes' abilities (abilityRules.js) by the game's slot: its
  // heroes.json lists them left, middle, right, which its icons number 01 to 03
  'ability:lukePush': 'Abilities/Luke_Ability_01',
  'ability:lukeRepulse': 'Abilities/Luke_Ability_02',
  'ability:leiaDetonator': 'Abilities/Leia_Ability_01',
  'ability:hanDetonator': 'Abilities/Han_Ability_01',
  'ability:hanSharpshooter': 'Abilities/Han_Ability_02',
  'ability:chewieBowcaster': 'Abilities/Chewbacca_Ability_02',
  'ability:chewieLeap': 'Abilities/Chewbacca_Ability_03',
  'ability:bobaRocket': 'Abilities/BobaFett_Ability_01',
  'ability:obiwanPush': 'Abilities/ObiWan_Ability_01',
  'ability:obiwanRush': 'Abilities/ObiWan_Ability_03',
  'ability:anakinPull': 'Abilities/Anakin_Ability_01',
  'ability:anakinImpact': 'Abilities/Anakin_Ability_02',
  'ability:vaderRage': 'Abilities/Vader_Ability_02',
  'ability:vaderChoke': 'Abilities/Vader_Ability_03',
  'ability:palpatineChain': 'Abilities/Palpatine_Ability_01',
  'ability:palpatineLightning': 'Abilities/Palpatine_Ability_03',
  'ability:maulChoke': 'Abilities/Maul_Ability_02',
  'ability:maulSpin': 'Abilities/Maul_Ability_03',
  'ability:dookuStun': 'Abilities/Dooku_Ability_01',
  'ability:dookuWeaken': 'Abilities/Dooku_Ability_03',
  'ability:landoSharpShot': 'Abilities/Lando_Ability_02',
  'ability:bosskGrenade': 'Abilities/Bosk_Ability_01',
  'ability:detonator': 'TrooperAbilityIcons/SC_Troopers_12_ThermalDetonator',
  'ability:medpack': 'Shared/PassiveAbility_Health',
  // the classes, the sides, the vehicles
  'class:assault': 'Classes/Class_Troopers_Assault_01',
  'class:heavy': 'Classes/Class_Troopers_Heavy_01',
  'class:officer': 'Classes/Class_Troopers_Officer_01',
  'class:specialist': 'Classes/Class_Troopers_Specialist_01',
  'class:hero': 'Classes/Class_Hero_Melee',
  'side:light': 'Factions/Icon_RebelAlliance',
  'side:dark': 'Factions/Icon_GalacticEmpire',
  'side:republic': 'Factions/Icon_GalacticRepublic',
  'side:separatists': 'Factions/Icon_Separatists',
  'vehicle:speeder': 'Speeders/Icon_74-Z_SpeederBike',
  'vehicle:snowspeeder': 'Speeders/Icon_T-47_AirSpeeder',
  'vehicle:landspeeder': 'Speeders/Icon_X-34_LandSpeeder',
  'vehicle:turret': 'StationaryWeapons/Icon_StationaryGroundTurret',
  'points': 'Shared/battle_points',
};

export function icon(name, { icons = ICONS, map = ICON_FOR } = {}) {
  const row = icons[map[name] ?? name];
  if (!row) return null;
  const [family, id] = row;
  const sprite = `/ui/bf2017/${family}.svg`;
  return { sprite, id, href: `${sprite}#${id}` };
}
