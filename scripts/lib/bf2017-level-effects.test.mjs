import { describe, expect, it } from 'vitest';
import { effectsJson } from './bf2017-level-effects.mjs';

const subworlds = ['Levels/MP/Hoth_01/Hoth_01', 'Levels/MP/Hoth_01/Lobby', 'Levels/MP/Hoth_01/Content', 'Levels/MP/Endor_01/Foggy'];
const extras = {
  effects: [
    { effect: 'FX/Ambient/_MP/Hoth/FX_AmbHoth_TerrainBlowingSnow_CamProx', sub: 2, autoStart: false, position: [150.5, 358.8, -1522], quaternion: [0, 0, 0, 1] },
    { effect: 'FX/Frontend/Nowhere/FX_ThinSmoke_Spawn_01', sub: 1, autoStart: true, position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
    { effect: 'FX/Ambient/Fog', sub: 3, position: [205, 362, -1540], quaternion: [0, 0, 0, 1] },
    { effect: 'FX/BG/FX_BG_SnowWind_XL', sub: 0, autoStart: true, position: [-1757.9, 471, -2330], quaternion: [0, 1, 0, 0] },
  ],
};
const pack = { origin: [205, 362.3, -1540], yaw: 0, cell: 128, arena: 1024 };

describe('the map’s effect spawns', () => {
  it('keeps the playable map’s, in the pack’s frame and by cell, and leaves the lobby’s, the fog’s and the far ones', () => {
    const j = effectsJson(extras, pack, { subworlds });
    expect(j).toEqual([{ name: 'FX/Ambient/_MP/Hoth/FX_AmbHoth_TerrainBlowingSnow_CamProx', position: [-54.5, -3.5, 18], quaternion: [0, 0, 0, 1], cell: '-1,0', auto: false }]);
  });
});
