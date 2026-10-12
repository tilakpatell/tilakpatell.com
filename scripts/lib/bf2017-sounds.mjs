// The Hoth sounds the site plays, named, from the game's sound export
// (bf2-re/findings/36-sound-export.md: 7,674 WAV under web/sounds, one
// manifest line a take; §5 the mapping to the site's names and the game's
// layer gains). Pure: scripts/bf2017-sounds.mjs reads the manifest, plans
// with `planSet`, and encodes with ffmpeg; src/components/battlefront/
// sound/ plays by the names here, through src/data/bf2017/sounds.json.
//
// A row: { asset (the export's name, without the `Sound/` head), takes
// (how many variations to keep, from the first: the game plays one at
// random and never the last three, VariationHistoryCount 3), stereo (the
// music stems and the beds keep two channels; a one-shot is mono), gain
// (the patch's layer amplitude), loop, segment (a multi-segment variation's
// part, 1-based: the loading loop's intro is 1, its loop 2), concat (the
// takes joined into one file: the 3 s quad bed takes make one loop),
// language (a VO line's) }.
//
//   SET: { [name]: row }
//   planSet(rows, set) → [{ name, asset, srcs: [out paths], stereo, gain, loop, concat, seconds, channels }]
//     (rows: the manifest's lines; a name whose asset the manifest lacks is
//     reported in `missing`, never silently dropped)
//   fileOf(name, i) → the site's file name under audio/galaxy/bf2017/

const one = (asset, more = {}) => ({ asset, takes: 1, ...more });
const takes = (asset, n, more = {}) => ({ asset, takes: n, ...more });

// the trooper blasters of Hoth's kits (classes.json: the Imperial E-11, DLT-19, RK-3, DLT-19X; the Rebel A280, RT-97C, DH-17, DLT-20A)
const GUNS = {
  e11: ['Weapons/Blasters/E11/SW02_Weapons_Blasters_E11_Laser_Close_VAR_08', 'Weapons/Blasters/E11/SW02_Weapons_Blasters_E11_Laser_Distant_VAR_06'],
  dlt19: ['Weapons/Blasters/DLT19/SW02_Weapons_Blasters_DLT19_Laser_Close_VAR_02', 'Weapons/Blasters/DLT19/SW02_Weapons_Blasters_DLT19_Laser_Distant_VAR_04'],
  rk3: ['Weapons/Blasters/RK3/SW02_Weapons_Blasters_RK3_Laser_Close_VAR_02', 'Weapons/Blasters/RK3/SW02_Weapons_Blasters_RK3_Laser_Distant_VAR_02'],
  dlt19x: ['Weapons/Blasters/DLT19X/SW02_Weapons_Blaster_DLT19X_Laser_Close_VAR_01', 'Weapons/Blasters/DLT19X/SW02_Weapons_Blaster_DLT19X_Laser_Distant_VAR_01'],
  a280: ['Weapons/Blasters/A280/SW02_Weapons_Blasters_A280_Laser_Close_VAR_01', 'Weapons/Blasters/A280/SW02_Weapons_Blasters_A280_Laser_Distant_VAR_01'],
  rt97c: ['Weapons/Blasters/RT97C/SW02_Weapons_Blasters_RT96C_Laser_Close_VAR_06', 'Weapons/Blasters/RT97C/SW02_Weapons_Blasters_RT96C_Laser_Distant_VAR_03'],
  dh17: ['Weapons/Blasters/DH17/SW02_Weapons_Blasters_DH17_Laser_Close_VAR_03', 'Weapons/Blasters/DH17/SW02_Weapons_Blasters_DH17_Laser_Distant_VAR_01'],
  dlt20a: ['Weapons/Blasters/DLT20A/SW02_Weapons_Blasters_DLT20A_Laser_Close_VAR_03', 'Weapons/Blasters/DLT20A/SW02_Weapons_Blasters_DLT20A_Laser_Distant_VAR_04'],
};
// the master patch's per-shot amplitudes (finding 36 §5): close / distant / HiFi
export const GUN_GAINS = { e11: [0.9, 0.8, 0.2], a280: [0.9, 0.85, 0.25], dlt19: [0.6, 0.7, 0.25], rt97c: [0.6, 0.7, 0.25] };
const gunRows = () =>
  Object.fromEntries(
    Object.entries(GUNS).flatMap(([gun, [close, distant]]) => {
      const [gc, gd] = GUN_GAINS[gun] ?? GUN_GAINS.e11;
      return [
        [`blaster.${gun}.close`, takes(close, 6, { gain: gc })],
        [`blaster.${gun}.distant`, takes(distant, 6, { gain: gd })],
      ];
    }),
  );

const SNOW = 'Characters/Shared/Footsteps/Snow/1P/SW01_Characters_Shared_Footsteps_Snow_1P_';
const CLOTH = 'Characters/Stormtrooper/Foley/1P/SW01_Characters_Stormtrooper_Foley_Clothes_1P_';
const HOTH = 'Planets/Hoth/Shared/Ambience/';
const OVER = 'Weapons/Overheat/';
const vo = (side, path, more = {}) => one(`VO/MP/Battles/Hoth/${side}/${path}`, { language: 'English', ...more });

export const SET = {
  ...gunRows(),
  'blaster.hifi': takes('Weapons/Blasters/Shared/HiFi/SW01_Weapons_Blasters_Shared_HiFi_VAR_02', 8, { gain: 0.2 }),
  // the master patch's outdoor tails: the field's noise close and far (the 300 m+ layer) and its reflection
  'blaster.noise.close': takes('Weapons/Blasters/Shared/Noise/Field/SW02_Weapons_Blasters_Shared_Noise_Field_Close_VAR_08', 6, { gain: 0.5 }),
  'blaster.noise.distant': takes('Weapons/Blasters/Shared/Noise/Field/SW02_Weapons_Blasters_Shared_Noise_Field_Distant_VAR_04', 6, { gain: 0.6 }),
  'blaster.reflection': takes('Weapons/Blasters/Shared/Reflection/Field/SW02_Weapons_Blasters_Shared_Reflection_Field_VAR_03', 4, { gain: 0.35 }),
  'blaster.passby': takes('Weapons/Projectiles/BlasterRifles/SW01_Weapons_Projectiles_BlasterRifles_PassBy_Close_VAR_02', 8, { gain: 0.7 }),
  // the snow set by speed, the jump and the landing, a scuff
  'step.walk': takes(`${SNOW}Walk_VAR_02`, 8),
  'step.jog': takes(`${SNOW}Jog_VAR_02`, 8),
  'step.sprint': takes(`${SNOW}Sprint_VAR_02`, 8),
  'step.jump': takes(`${SNOW}Jump_VAR_01`, 4),
  'step.land': takes(`${SNOW}Land_VAR_01`, 4),
  'step.scuff': takes(`${SNOW}Scuff_VAR_02`, 4),
  // the armour's cloth (the Stormtrooper configuration: Jump at 0.5)
  'cloth.crouchDown': takes(`${CLOTH}CrouchDown_VAR_02`, 4, { gain: 0.8 }),
  'cloth.crouchUp': takes(`${CLOTH}CrouchUp_VAR_02`, 4, { gain: 0.8 }),
  'cloth.jump': takes(`${CLOTH}Jump_VAR_03`, 4, { gain: 0.5 }),
  'cloth.land': takes(`${CLOTH}Land_VAR_02`, 4, { gain: 0.8 }),
  // the 3P death: the scream and the fall (Loudness 92, pitch 0.9–1.1)
  'death.scream': takes('Characters/Shared/Emotes/Male/DeathScreams/SW01_Characters_Shared_Emotes_Male_DeathScreams_001', 8, { gain: 0.9 }),
  'death.fall': takes('Characters/Stormtrooper/Foley/SW02_Characters_Stormtrooper_Foley_BodyFall_VAR_01', 4, { gain: 0.9 }),
  // the hit and kill cues (UX: non-positional)
  'hit.hit': takes('UX/Damage/Received/Bullet/SW02_UX_Damage_Received_Bullet_Hit_VAR_03', 6, { gain: 0.6 }),
  'hit.first': takes('UX/Damage/Received/Bullet/SW02_UX_Damage_Received_Bullet_FirstHit_VAR_02', 2, { gain: 0.5 }),
  'hit.killed': takes('UX/Damage/Received/Bullet/SW02_UX_Damage_Recieved_Bullet_Killed_VAR_05', 4, { gain: 0.7 }),
  'hit.kill': one('UX/Shared/Kill/SW02_UX_Shared_Kill_Confirmation_UI_Add_Short_VAR_02', { gain: 0.8 }),
  // the overheat set
  'overheat.warning': takes(`${OVER}SW02_Weapons_Overheat_Warning_VAR_05`, 5, { gain: 0.7 }),
  'overheat.overheated': takes(`${OVER}SW02_Weapons_Overheat_Overheated_VAR_03`, 4, { gain: 0.8 }),
  'overheat.reset': takes(`${OVER}SW02_Weapons_Overheat_Reset_VAR_08`, 4, { gain: 0.7 }),
  'overheat.manual': takes(`${OVER}SW02_Weapons_Overheat_ManualCooling_VAR_04`, 4, { gain: 0.7 }),
  'overheat.coolSuccess': takes(`${OVER}SW02_Weapons_OverheatActiveCoolingSuccess_VAR_01`, 4, { gain: 0.8 }),
  'overheat.coolFail': takes(`${OVER}SW01_Weapons_OverheatActiveCoolingFail_VAR_06`, 4, { gain: 0.8 }),
  // the four Orig kits' abilities (classes.json: assault, heavy, officer, specialist)
  'ability.thermal.click': one('Weapons/Grenades/ThermalDetonator/SW01_Weapons_Grenades_ThermalDetonator_Click_01'),
  'ability.thermal.beeps': one('Weapons/Grenades/ThermalDetonator/SW01_Weapons_Grenades_ThermalDetonator_Beeps_01'),
  'ability.grenade.bounce': takes('Weapons/Grenades/Bounce/SW01_Weapons_Grenades_Bounce_Dirt_VAR_03', 4, { gain: 0.7 }),
  'ability.explosion.close': takes('Destruction/Explosions/Modular/Small/Ambience/SW02_Destruction_Explosions_Modular_Small_Ambience_Close_VAR_01', 4),
  'ability.explosion.reflection': takes('Destruction/Explosions/Modular/Small/Reflection/SW02_Destruction_Explosions_Modular_Small_Reflection_Field_VAR_01', 2, { gain: 0.6 }),
  'ability.vanguard.start': takes('Gadgets/HunterMode/SW02_Gadgets_HunterMode_Start_VAR_02', 3),
  'ability.vanguard.stop': takes('Gadgets/HunterMode/SW02_Gadgets_HunterMode_Stop_VAR_02', 3),
  'ability.vanguard.shot': takes('Weapons/Blasters/ScatterGun/SW02_Weapons_Blaster_ScatterGun_Laser_Close_VAR_01', 3, { gain: 0.9 }),
  'ability.vanguard.pump': takes('Gadgets/HunterMode/SW02_Gadgets_HunterMode_ScatterGun_PumpAction_VAR_01', 3),
  'ability.scanDart.shot': takes('Weapons/Blasters/ScanDart/SW02_Weapons_Blasters_ScanDart_Laser_Close_VAR_04', 3, { gain: 0.9 }),
  'ability.scanDart.ping': takes('Gadgets/ScanPing/SW02_Gadgets_ScanDartPing_VAR_01', 3, { gain: 0.7 }),
  'ability.impact.beep': one('Weapons/Grenades/ImpactGrenade/SW01_Weapons_Grenades_ImpactGrenade_Beep_01'),
  'ability.sentry.start': takes('Weapons/Blasters/Z6RotaryBlaster/SW02_Blasters_Z6RotaryBlaster_Start_Short_VAR_01', 2),
  'ability.sentry.stop': one('Weapons/Blasters/Z6RotaryBlaster/SW02_Blasters_Z6RotaryBlaster_Stop_03'),
  'ability.sentry.shot': takes('Weapons/Blasters/Z6RotaryBlaster/SW02_Blasters_Z6RotaryBlaster_Laser_Close_VAR_01', 4, { gain: 0.8 }),
  'ability.shield.start': takes('Gadgets/BurstShield/SW02_Gadgets_BurstShield_Start_VAR_01', 2),
  'ability.shield.loop': one('Gadgets/BurstShield/SW02_Gadgets_BurstShield_Loop_01', { loop: true, gain: 0.5 }),
  'ability.shield.stop': takes('Gadgets/BurstShield/SW01_Gadgets_BurstShield_Stop_VAR_02', 2),
  'ability.shield.hit': takes('Gadgets/BurstShield/Impacts/SW01_Gadgets_BurstShield_Impacts_Hit_VAR_01', 4, { gain: 0.7 }),
  'ability.splitter.split': takes('Gadgets/GrenadeSplitter/SW02_Gadgets_GrenadeSplitter_Split_VAR_02', 2),
  'ability.command.start': one('Gadgets/BattleCommand/SW02_Gadgets_BattleCommand_VAR_08'),
  'ability.turret.chargeUp': takes('Gadgets/Sentry/SW02_Gadgets_Sentry_Deploy_ChargeUp_VAR_07', 2),
  'ability.turret.stop': takes('Gadgets/Sentry/SW02_Gadgets_Sentry_Deploy_DeActivate_VAR_01', 2),
  'ability.turret.beep': one('Gadgets/AutoTurretAntiInfantry/SW01_Gadgets_AutoTurretAntiInfantry_InfantryBeep_01'),
  'ability.turret.detonation': one('UX/Abilities/SW02_UX_Abilities_TurretDetonation_01'),
  'ability.shock.beep': one('Weapons/Grenades/Shock/SW02_Weapons_Grenades_Shock_Beep_01'),
  'ability.shock.charge': one('Weapons/Grenades/Shock/SW02_Weapons_Grenades_Shock_Charge_01'),
  'ability.shock.loop': one('Gadgets/ShockGrenade/SW02_Gadgets_ShockGrenade_Groundeffect_Loop_01', { segment: 2, loop: true, gain: 0.6 }),
  'ability.infiltration.start': takes('Gadgets/Infiltration/SW02_Gadgets_Infiltration_Start_VAR_02', 2),
  'ability.infiltration.stop': takes('Gadgets/Infiltration/SW02_Gadgets_Infiltration_Stop_VAR_01', 2),
  'ability.error': one('UX/Abilities/SW02_UX_Abilities_Error_07', { gain: 0.6 }),
  // the Hoth bed: the snowfield's quad loop (eight 3 s takes joined, the
  // front pair kept), the cave's, and the nine one-shots of finding 26
  'ambience.bed': takes(`${HOTH}SW02_Planets_Hoth_Shared_Ambience_SoundArea_HothSnow_302_309_319_321_02`, 8, { stereo: true, concat: true, loop: true, gain: 0.5 }),
  'ambience.cave': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_SoundArea_Cave_Snow_01`, 4, { stereo: true, concat: true, loop: true, gain: 0.5 }),
  'ambience.wind.moleWind': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_BigWorld_Wind_SnowMoleWind_VAR_02`, 3, { gain: 0.6 }),
  'ambience.wind.gusts': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_BigWorld_Wind_SnowGusts_VAR_01`, 3, { gain: 0.6 }),
  'ambience.wind.flutters': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_BigWorld_Wind_SnowFlutters_VAR_01`, 2, { gain: 0.5 }),
  'ambience.wind.wisps': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_BigWorld_Wind_SnowWisps_VAR_01`, 2, { gain: 0.5 }),
  'ambience.alien.rayboo': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_BigWorld_Alien_Rayboo_VAR_02`, 2, { gain: 0.5 }),
  'ambience.alien.wampa': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_BigWorld_Alien_Wampa_VAR_01`, 2, { gain: 0.5 }),
  'ambience.alien.beluga': takes(`${HOTH}SW02_Planets_Hoth_Shared_Ambience_BigWorld_Alien_BelugaRoar_VAR_01`, 2, { gain: 0.5 }),
  'ambience.alien.skuaCalls': takes(`${HOTH}SW02_Planets_Hoth_Shared_Ambience_BigWorld_Alien_SkuaCalls_VAR_01`, 2, { gain: 0.5 }),
  'ambience.alien.skuaRoar': takes(`${HOTH}SW02_Planets_Hoth_Shared_Ambience_BigWorld_Alien_SkuaRoar_VAR_01`, 2, { gain: 0.5 }),
  'ambience.ice.cracks': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_BigWorld_Ice_Cracks_VAR_01`, 2, { gain: 0.5 }),
  'ambience.ice.pings': takes(`${HOTH}SW01_Planets_Hoth_Shared_Ambience_BigWorld_Ice_Pings_VAR_01`, 3, { gain: 0.4 }),
  // the music: the Hoth loading intro and loop, the MP stems, the tension, the end of round
  'music.loading.intro': one('Music/Loading/Hoth/SW02_Music_Loading_Hoth_Loop_01_VAR', { stereo: true, segment: 1 }),
  'music.loading.loop': one('Music/Loading/Hoth/SW02_Music_Loading_Hoth_Loop_01_VAR', { stereo: true, segment: 2, loop: true }),
  'music.medium': { asset: ['Music/MP/Continuous/MediumIntensity/SW02_Music_MP_Continuous_MediumIntensity_23', 'Music/MP/Continuous/MediumIntensity/SW02_Music_MP_Continuous_MediumIntensity_05'], takes: 1, stereo: true },
  'music.high': { asset: ['Music/MP/Continuous/HighIntensity/SW02_Music_MP_Continuous_HighIntensity_07', 'Music/MP/Continuous/HighIntensity/SW02_Music_MP_Continuous_HighIntensity_03'], takes: 1, stereo: true },
  'music.tension.intro': one('Music/MP/Tension/SW02_Music_MP_Tension_Intro_01', { stereo: true }),
  'music.tension.loop': one('Music/MP/Tension/SW02_Music_MP_Tension_6chLoop_02', { stereo: true, segment: 2, loop: true }),
  'music.eor.win': one('Music/MP/EOR/SW02_Music_MP_EOR_Win_01', { stereo: true }),
  'music.eor.lose': one('Music/MP/EOR/SW02_Music_MP_EOR_Lose_01', { stereo: true }),
  'music.eor.draw': one('Music/MP/EOR/SW02_Music_MP_EOR_Draw_01', { stereo: true }),
  'music.sting.victory': one('UX/EOR/SW02_UX_EOR_Victory_02', { stereo: true }),
  'music.sting.defeat': one('UX/EOR/SW02_UX_EOR_Defeat_02', { stereo: true }),
  // a handful of the commanders' lines, by the objective event they answer (English takes)
  'vo.imperial.uplinkActivate': vo('Imperial', 'IntSeq1/IntA/SW02_VO_MP_Battles_Hoth_Imperial_IntSeq1_IntA_Activate', { takes: 2 }),
  'vo.imperial.uplinkDeactivate': vo('Imperial', 'IntSeq1/IntA/SW02_VO_MP_Battles_Hoth_Imperial_IntSeq1_IntA_DeActivate', { takes: 2 }),
  'vo.imperial.timeLow': vo('Imperial', 'IntSeq1/IntA/SW02_VO_MP_Battles_Hoth_Imperial_IntSeq1_IntA_TimeLow'),
  'vo.imperial.capping': vo('Imperial', 'CPSeq1/CP1/SW02_VO_MP_Battles_Hoth_Imperial_CPSeq1_CP1_Capping', { takes: 2 }),
  'vo.imperial.captured': vo('Imperial', 'CPSeq1/CP1/SW02_VO_MP_Battles_Hoth_Imperial_CPSeq1_CP1_Captured1Left'),
  'vo.imperial.walkerDamaged': vo('Imperial', 'WlkSeq1/SW02_VO_MP_Battles_Hoth_Imperial_WlkSeq1_WlkDmg1Left', { takes: 2 }),
  'vo.imperial.walkerDown': vo('Imperial', 'WlkSeq1/SW02_VO_MP_Battles_Hoth_Imperial_WlkSeq1_WlkDestroy1Left'),
  'vo.rebellion.uplinkActivate': vo('Rebellion', 'IntSeq1/IntA/SW02_VO_MP_Battles_Hoth_Rebellion_IntSeq1_IntA_Activate', { takes: 2 }),
  'vo.rebellion.uplinkDeactivate': vo('Rebellion', 'IntSeq1/IntA/SW02_VO_MP_Battles_Hoth_Rebellion_IntSeq1_IntA_DeActivate', { takes: 2 }),
  'vo.rebellion.timeLow': vo('Rebellion', 'IntSeq1/IntA/SW02_VO_MP_Battles_Hoth_Rebellion_IntSeq1_IntA_TimeLow'),
  'vo.rebellion.capping': vo('Rebellion', 'CPSeq1/CP1/SW02_VO_MP_Battles_Hoth_Rebellion_CPSeq1_CP1_Capping', { takes: 2 }),
  'vo.rebellion.captured': vo('Rebellion', 'CPSeq1/CP1/SW02_VO_MP_Battles_Hoth_Rebellion_CPSeq1_CP1_Captured1Left'),
  'vo.rebellion.walkerDamaged': vo('Rebellion', 'WlkSeq1/SW02_VO_MP_Battles_Hoth_Rebellion_WlkSeq1_WlkDmg1Left', { takes: 2 }),
  'vo.rebellion.walkerDown': vo('Rebellion', 'WlkSeq1/SW02_VO_MP_Battles_Hoth_Rebellion_WlkSeq1_WlkDestroy1Left'),
};

export const GUN_IDS = Object.keys(GUNS);

// the site's file for a name's take: `blaster-e11-close-01.mp3`
export const fileOf = (name, i) => `${name.replace(/\./g, '-')}-${String(i + 1).padStart(2, '0')}.mp3`;

// A take's source file for a row: the whole variation, or one segment of it.
const srcOf = (line, row) => (row.segment ? line.segmentOuts?.[row.segment - 1] : line.out) ?? null;

export function planSet(rows, set = SET) {
  const byAsset = new Map();
  for (const l of rows) {
    const key = l.asset.replace(/^Sound\//, '');
    if (!byAsset.has(key)) byAsset.set(key, []);
    byAsset.get(key).push(l);
  }
  const plan = [];
  const missing = [];
  for (const [name, row] of Object.entries(set)) {
    const assets = Array.isArray(row.asset) ? row.asset : [row.asset];
    const srcs = [];
    let seconds = 0;
    let channels = 1;
    for (const asset of assets) {
      const lines = (byAsset.get(asset) ?? []).filter((l) => l.status === 'wav' && (!row.language || l.language === row.language)).sort((a, b) => a.variation - b.variation);
      if (!lines.length) {
        missing.push({ name, asset });
        continue;
      }
      for (const l of lines.slice(0, row.takes)) {
        const src = srcOf(l, row);
        if (!src) {
          missing.push({ name, asset: `${asset} (segment ${row.segment})` });
          continue;
        }
        srcs.push(src);
        seconds += row.segment ? (l.segmentLengths?.[row.segment - 1] ?? 0) : l.duration;
        channels = Math.max(channels, l.channels ?? 1);
      }
    }
    if (!srcs.length) continue;
    plan.push({ name, asset: assets[0], srcs, stereo: Boolean(row.stereo), gain: row.gain ?? 1, loop: Boolean(row.loop), concat: Boolean(row.concat), seconds: Math.round(seconds * 100) / 100, channels });
  }
  return { plan, missing };
}
