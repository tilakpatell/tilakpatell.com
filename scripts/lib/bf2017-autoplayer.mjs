// The AutoPlayer rulebook (ai.autoplayer.json): the server settings the
// game's bots-as-players run on (bf2-re finding 28 §5–7), read from
// `Online/GameSettingsContainer`'s `GameSettingNode`s by name. An AutoPlayer
// is the bot of Instant Action (Mode8), Co-op (Mode9), Supremacy (Mode1) and
// the server fill: its aim is a tracker plus noise (a weapon class's noise ×
// a difficulty's scale × a side's factor), it fires when its line of fire has
// been clear for a reaction time, and it comes back in waves the server paces.
// Every number names its node. Pure over the container's JSON.
//
//   autoPlayerRows(container) → the rows

const SRC = 'Online/GameSettingsContainer';

// key → setting name; a nested object is a group
const SPEC = {
  aim: {
    noise: {
      blaster: { instantAction: 'AP_BlasterAimNoise_Mode8', coop: 'AP_BlasterAimNoise_Mode9', supremacy: 'AP_BlasterAimNoise_Mode1' },
      lmg: { instantAction: 'AP_LmgAimNoise_Mode8', coop: 'AP_LmgAimNoise_Mode9' },
      shotgun: { instantAction: 'AP_ShotgunAimNoise_Mode8', coop: 'AP_ShotgunAimNoise_Mode9' },
      sniperRifle: { instantAction: 'AP_SniperRifleAimNoise_Mode8', coop: 'AP_SniperRifleAimNoise_Mode9' },
      launcher: { instantAction: 'AP_LauncherAimNoise_Mode8', coop: 'AP_LauncherAimNoise_Mode9' },
    },
    scale: { instantAction: 'AP_AimNoiseScale_Mode8', rookie: 'AP_AimNoiseScale_Rookie_Mode8', normal: 'AP_AimNoiseScale_Normal_Mode8', expert: 'AP_AimNoiseScale_Expert_Mode8', coop: 'AP_AimNoiseScale_Mode9', supremacy: 'AP_AimNoiseScale_Mode1' },
    enemies: { rookie: 'AP_AimNoiseScale_Enemies_Rookie_Mode8', normal: 'AP_AimNoiseScale_Enemies_Normal_Mode8', expert: 'AP_AimNoiseScale_Enemies_Expert_Mode8', coop: 'AP_AimNoiseScale_Enemies_Mode9' },
    friendlies: { rookie: 'AP_AimNoiseScale_Friendlies_Rookie_Mode8', normal: 'AP_AimNoiseScale_Friendlies_Normal_Mode8', expert: 'AP_AimNoiseScale_Friendlies_Expert_Mode8', coop: 'AP_AimNoiseScale_Friendlies_Mode9' },
    vehicle: { rookie: 'AP_VehicleAimNoiseScale_Rookie_Mode8', normal: 'AP_VehicleAimNoiseScale_Normal_Mode8', expert: 'AP_VehicleAimNoiseScale_Expert_Mode8', coop: 'AP_VehicleAimNoiseScale_Coop' },
    lap: 'AP_AimLapTime_Mode8',
    acceleration: 'AP_AimAcceleration_Mode8',
    inputScale: { yaw: 'AP_InputScaleYaw ', pitch: 'AP_InputScalePitch' },
  },
  lof: {
    reaction: { default: 'AP_LofReactionTimeS', rookie: 'AP_LofReactionTimeS_Rookie_Mode8', normal: 'AP_LofReactionTimeS_Normal_Mode8', expert: 'AP_LofReactionTimeS_Expert_Mode8' },
    timeout: 'AP_LofTimeoutS',
    prediction: 'AP_LofPredictionTime',
  },
  tracker: { fov: 'AP_TargetTrackerFieldOfViewDegrees' },
  engage: { distanceScale: { instantAction: 'AP_MaxTargetEngagingDistanceScale_Mode8', coop: 'AP_MaxTargetEngagingDistanceScale_Mode9', supremacy: 'AP_MaxTargetEngagingDistanceScale_Mode1' } },
  evasive: {
    dodgeRoll: { instantAction: 'AP_EvasiveManeuversDodgeRollProbability_Mode8', rookie: 'AP_EvasiveManeuversDodgeRollProbability_Rookie_Mode8', normal: 'AP_EvasiveManeuversDodgeRollProbability_Normal_Mode8', expert: 'AP_EvasiveManeuversDodgeRollProbability_Expert_Mode8', coop: 'AP_EvasiveManeuversDodgeRollProbability_Mode9', supremacy: 'AP_EvasiveManeuversDodgeRollProbability_Mode1' },
    jump: { instantAction: 'AP_EvasiveManeuversJumpProbability_Mode8' },
    invertStrafeMin: { instantAction: 'AP_EvasiveManeuversInvertStrafeDurationMin_Mode8', supremacy: 'AP_EvasiveManeuversInvertStrafeDurationMin_Mode1' },
    invertStrafeMax: { instantAction: 'AP_EvasiveManeuversInvertStrafeDurationMax_Mode8', supremacy: 'AP_EvasiveManeuversInvertStrafeDurationMax_Mode1' },
  },
  melee: { distance: 'AP_MeleeDistanceM', interval: 'AP_MeleeIntervalS', on: 'AP_CombatUseMelee' },
  waves: {
    spawnTime: { attack: 'AP_Waves_SpawnTime_Attack', defend: 'AP_Waves_SpawnTime_Defend', instantAction: 'AP_Waves_SpawnTime_Mode8', intermission: 'AP_Waves_SpawnTime_Intermission_Attack' },
    pause: {
      attack: 'AP_Waves_PauseTime_Attack',
      attackShort: 'AP_Waves_PauseTime_Short_Attack',
      attackMedium: 'AP_Waves_PauseTime_Medium_Attack',
      attackLong: 'AP_Waves_PauseTime_Long_Attack',
      defend: 'AP_Waves_PauseTime_Defend',
      defendByPhase: ['AP_Waves_PauseTime_Defend_Phase1', 'AP_Waves_PauseTime_Defend_Phase2', 'AP_Waves_PauseTime_Defend_Phase3', 'AP_Waves_PauseTime_Defend_Phase4'],
      instantAction: 'AP_Waves_PauseTime_Mode8',
    },
    force: {
      default: 'AP_Waves_ForceSpawnTime',
      attackByPhase: ['AP_Waves_ForceSpawnTime_Attack_Phase1', 'AP_Waves_ForceSpawnTime_Attack_Phase2', 'AP_Waves_ForceSpawnTime_Attack_Phase3', 'AP_Waves_ForceSpawnTime_Attack_Phase4', 'AP_Waves_ForceSpawnTime_Attack_Phase5'],
      defend: 'AP_Waves_ForceSpawnTime_Defend',
      defendByPhase: ['AP_Waves_ForceSpawnTime_Defend_Phase1', 'AP_Waves_ForceSpawnTime_Defend_Phase2', 'AP_Waves_ForceSpawnTime_Defend_Phase3', 'AP_Waves_ForceSpawnTime_Defend_Phase4', 'AP_Waves_ForceSpawnTime_Defend_Phase5'],
    },
    killRatio: {
      attack: ['AP_Waves_KillRatio_1CP_Attack', 'AP_Waves_KillRatio_2CP_Attack', 'AP_Waves_KillRatio_3CP_Attack'],
      defend: ['AP_Waves_KillRatio_1CP_Defend', 'AP_Waves_KillRatio_2CP_Defend', 'AP_Waves_KillRatio_3CP_Defend'],
      delay: 'AP_Waves_KillRatioDelay_Attack',
    },
    heroes: { attack: 'AP_WavesHeroes_PauseTime_Attack' },
  },
  respawn: { delay: 'AP_RespawnDelay_Mode8', initial: 'AP_InitialRespawnDelay_Mode8', spawnDelay: { instantAction: 'AP_Spawn_Delay_Mode8', coop: 'AP_Spawn_Delay_Mode9' }, rate: 'AP_SpawnRate', maxPerUpdate: 'AP_MaxSpawnsPerUpdate', squadSpawn: { instantAction: 'AP_SquadSpawnProbability_Mode8', coop: 'AP_SquadSpawnProbability_Mode9' } },
  teams: {
    instantAction: { bots: 'TeamSize_AutoPlayers_Mode8', botsNormal: 'TeamSize_AutoPlayers_Normal_Mode8', players: 'TeamSize_RealPlayer_Mode8', playersNormal: 'TeamSize_RealPlayer_Normal_Mode8', team1: 'TeamSize1_AP_Mode8', team2: 'TeamSize2_AP_Mode8' },
    coop: { small: 'TeamSizeAP_BotTeam_Small_Mode9', medium: 'TeamSizeAP_BotTeam_Medium_Mode9', large: 'TeamSizeAP_BotTeam_Large_Mode9', human: 'TeamSizeAP_HumanTeam_Mode9' },
    supremacy: { team1: 'AP_Number_of_Bots_Team1_Mode1', team2: 'AP_Number_of_Bots_Team2_Mode1' },
  },
  orphans: { instantAction: 'OrphanTimeSeconds_Mode8', trigger: 'TriggerOrphansTimer_Mode8', attack: 'OrphanTime_Attack_ModeD', defend: 'OrphanTime_Defend_Mode9', retreat: 'OrphanTime_Retreat_Mode9' },
};

// a node's value: its DefaultValue, a float with the export's comma, a bool, an int
function valueOf(node) {
  const v = String(node.DefaultValue ?? '').trim().replace(',', '.');
  if (node.SettingType === 'GameSettingType_Bool') return v === '1' || v.toLowerCase() === 'true';
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

export function autoPlayerRows(container) {
  const nodes = new Map();
  for (const o of container.objects ?? []) if (o?.$type === 'GameSettingNode') nodes.set(String(o.SettingName).trim(), o);
  const missing = [];
  const read = (name) => {
    const node = nodes.get(name.trim());
    if (!node) {
      missing.push(name);
      return undefined;
    }
    return valueOf(node);
  };
  const walk = (spec) => {
    const out = {};
    for (const [key, v] of Object.entries(spec)) {
      if (Array.isArray(v)) {
        out[key] = v.map(read);
        out[`${key}_source`] = v.map((n) => `${SRC}#GameSettingNode[${n.trim()}].DefaultValue`);
      } else if (typeof v === 'object') out[key] = walk(v);
      else {
        out[key] = read(v);
        out[`${key}_source`] = `${SRC}#GameSettingNode[${v.trim()}].DefaultValue`;
      }
    }
    return out;
  };
  const rows = walk(SPEC);
  rows._missing = missing;
  return rows;
}
