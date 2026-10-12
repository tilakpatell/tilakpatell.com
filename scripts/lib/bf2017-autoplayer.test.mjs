import { describe, expect, it } from 'vitest';
import { autoPlayerRows } from './bf2017-autoplayer.mjs';

const node = (SettingName, DefaultValue, SettingType = 'GameSettingType_Float') => ({ $type: 'GameSettingNode', SettingName, DefaultValue, SettingType });
const container = {
  objects: [
    { $type: 'GameSettingsContainer' },
    node('AP_BlasterAimNoise_Mode8', '1.5'),
    node('AP_BlasterAimNoise_Mode1', '2,5'),
    node('AP_AimNoiseScale_Mode8', '2'),
    node('AP_AimNoiseScale_Rookie_Mode8', '7'),
    node('AP_LofReactionTimeS', '0.05'),
    node('AP_CombatUseMelee', '0', 'GameSettingType_Bool'),
    node('AP_Waves_PauseTime_Defend_Phase1', '12'),
    node('AP_Waves_PauseTime_Defend_Phase2', '6'),
    node('AP_MaxSpawnsPerUpdate', '1', 'GameSettingType_Int'),
    node('AP_InputScaleYaw ', '1'),
  ],
};

describe('the AutoPlayer rulebook', () => {
  const rows = autoPlayerRows(container);

  it('reads each setting by name with its source, the export’s comma as a point', () => {
    expect(rows.aim.noise.blaster.instantAction).toBe(1.5);
    expect(rows.aim.noise.blaster.instantAction_source).toBe('Online/GameSettingsContainer#GameSettingNode[AP_BlasterAimNoise_Mode8].DefaultValue');
    expect(rows.aim.noise.blaster.supremacy).toBe(2.5);
    expect(rows.aim.scale).toMatchObject({ instantAction: 2, rookie: 7 });
    expect(rows.lof.reaction.default).toBe(0.05);
    expect(rows.melee.on).toBe(false);
    expect(rows.respawn.maxPerUpdate).toBe(1);
  });

  it('reads a phase list in order and trims a name the export wrote with a space', () => {
    expect(rows.waves.pause.defendByPhase.slice(0, 2)).toEqual([12, 6]);
    expect(rows.waves.pause.defendByPhase_source[1]).toMatch(/Phase2\]/);
    expect(rows.aim.inputScale.yaw).toBe(1);
  });

  it('lists what the container lacks instead of failing', () => {
    expect(rows._missing).toContain('AP_LofTimeoutS');
    expect(rows.lof.timeout).toBeUndefined();
  });
});
