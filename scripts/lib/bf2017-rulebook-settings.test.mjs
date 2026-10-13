import { describe, expect, it } from 'vitest';
import { botLogicFrom, sequelSetting, settingsFrom, valueOf } from './bf2017-rulebook-settings.mjs';

const node = (SettingName, SettingType, DefaultValue, kids = [], extra = {}) => ({ $type: 'GameSettingNode', SettingName, SettingType: `GameSettingType_${SettingType}`, DefaultValue, LowerBound: '', UpperBound: '', GameSettings: kids.map(($ref) => ({ $ref })), ...extra });

// a container cut to the shape of Online/GameSettingsContainer: a group, its rows, the oddities
const CONTAINER = {
  root: 0,
  objects: [
    { $type: 'GameSettingsContainer', GameSettings: [{ $ref: 1 }, { $ref: 6 }] },
    node('***PvE***', 'Int', '', [2, 3, 4, 5]),
    node('AP_AimNoiseScale_Mode8', 'Float', '2'),
    node('AP_BlasterAimNoise_Mode1', 'Float', '2,5'),
    node('AP_CombatUseMelee', 'Bool', 'True'),
    node('AP_InputScaleYaw ', 'Float', '1', [], { LowerBound: '0', UpperBound: '4' }),
    node('GS_StatsDProvider_URL', 'String', '127.0.0.1:8125'),
    node('gp_hero_rey_Price_Mode8', 'Int', '6000'),
    node('Attack_Phase1_Enemy_VehicleCount_TAKO', 'Int', '0'),
  ],
};

describe('the game settings', () => {
  it('reads each value as its type, the comma as a point', () => {
    expect(valueOf('GameSettingType_Float', '2,5')).toBe(2.5);
    expect(valueOf('GameSettingType_Int', '13')).toBe(13);
    expect(valueOf('GameSettingType_Bool', 'True')).toBe(true);
    expect(valueOf('GameSettingType_Bool', '0')).toBe(false);
    expect(valueOf('GameSettingType_Float', '')).toBe(null);
  });

  it('keeps the rows by trimmed name under their group, leaving out the addresses, the headers and the sequel era', () => {
    const { settings, groups, bounds } = settingsFrom(CONTAINER);
    expect(settings).toEqual({ AP_AimNoiseScale_Mode8: 2, AP_BlasterAimNoise_Mode1: 2.5, AP_CombatUseMelee: true, AP_InputScaleYaw: 1 });
    expect(groups.PvE).toEqual(['AP_AimNoiseScale_Mode8', 'AP_BlasterAimNoise_Mode1', 'AP_CombatUseMelee', 'AP_InputScaleYaw']);
    expect(bounds.AP_InputScaleYaw).toEqual([0, 4]);
  });

  it('knows the settings’ own short names for the sequel era', () => {
    for (const n of ['gp_vehicle_fo_atst_Price', '!APVehicleSpawn_Enabled_Attack_TAKO', 'BB8StaminaDrainSpeed', 'gp_hero_finn_Price_Mode8']) expect(sequelSetting(n)).toBe(true);
    for (const n of ['AP_Waves_ForceSpawnTime', 'Attack_Phase1_Enemy_VehicleCount_HO', 'TeamSize_AutoPlayers_Mode8', 'AP_AimNoiseScale_Rookie_Mode8']) expect(sequelSetting(n)).toBe(false);
  });
});

describe('the bot logic', () => {
  it('lists the splits, the objectives and the timers with where each sits', () => {
    const asset = {
      objects: [
        { $type: 'RandomMultiEventEntityData', RandomEventWeight: [60, 20, 20], UniformDistribution: false },
        { $type: 'AutoPlayerDefendObjectiveEntityData', DefendAreaRadius: 10, MoveMode: 'AutoPlayerMoveMode_Defensive', DefendCurrentPosition: false, UseRandomPathSpread: true, IsTargetReachedAsSoonAsEnteringTargetArea: true, UseObjectiveTeleport: true, UseStuckEscapeProcedure: true },
        { $type: 'AutoPlayerFollowObjectiveEntityData', FollowPositionRadius: 5, FollowTimeoutSeconds: -1, ActivelyPatrolFollowPlayerPosition: true, MoveMode: 'AutoPlayerMoveMode_Passive' },
        { $type: 'CoolDownGateEntityData', CoolDownTime: 20 },
        { $type: 'PrintDebugTextEntityData', Text: 'Randomize_CP1_Triggered' },
      ],
    };
    const b = botLogicFrom(asset, 'X');
    expect(b.splits).toEqual([{ weights: [60, 20, 20], uniform: false, _source: 'X#0' }]);
    expect(b.defend[0]).toMatchObject({ radius: 10, moveMode: 'Defensive', spread: true, stuckEscape: true, _source: 'X#1' });
    expect(b.follow[0]).toMatchObject({ radius: 5, timeout: -1, patrol: true, moveMode: 'Passive' });
    expect(b.coolDowns).toEqual([{ seconds: 20, _source: 'X#3' }]);
    expect(b.debug).toEqual(['Randomize_CP1']);
  });
});
