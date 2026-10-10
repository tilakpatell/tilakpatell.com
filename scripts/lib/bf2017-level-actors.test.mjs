import { describe, expect, it } from 'vitest';
import { actorsJson, kindOfActor, kindOfVehicle, vehiclesJson } from './bf2017-level-actors.mjs';

const S = Math.SQRT1_2;
const Q = 32767;
// a map as readMap gives it: four actors (an Ewok of three parts, a
// tauntaun, a kullbee the site has no kind for, a skinned shrub), one in a
// lobby sub, and the spawns
const map = {
  name: 'Levels/MP/Fixture_01/Fixture_01',
  subworlds: ['Levels/MP/Fixture_01/Fixture_01', 'Levels/MP/Fixture_01/Lobby', 'Levels/MP/Fixture_01/FantasyBattle'],
  meshes: [
    { file: 'models/characters/npc/creatures/ewok/ewok_01/ewok_01_mesh.glb' },
    { file: 'models/characters/npc/creatures/ewok/ewok_01/ewok_01_fur_mesh.glb' },
    { file: 'models/characters/npc/creatures/tauntaun/tauntaun_01_mesh.glb' },
    { file: 'models/characters/npc/creatures/kullbee/kullbee_01_mesh.glb' },
    { file: 'models/objects/nature/forest/_forestbase/forestbase_shrublarge_01/forestbase_shrublarge_01_skinned_mesh.glb' },
  ],
  groups: [
    { mesh: 0, sub: 2, kind: 'actor', first: 0, count: 1 },
    { mesh: 1, sub: 2, kind: 'actor', first: 1, count: 1 },
    { mesh: 2, sub: 0, kind: 'actor', first: 2, count: 1 },
    { mesh: 3, sub: 0, kind: 'actor', first: 3, count: 1 },
    { mesh: 4, sub: 0, kind: 'actor', first: 4, count: 1 },
    { mesh: 2, sub: 1, kind: 'actor', first: 5, count: 1 },
  ],
  instances: {
    count: 6,
    position: new Float32Array([110, 5, 210, 110, 5, 210, 120, 6, 200, 0, 0, 0, 1, 1, 1, 0, 0, 0]),
    // (the tauntaun a quarter turn about y)
    quaternion: Int16Array.from([0, 0, 0, Q, 0, 0, 0, Q, 0, Math.round(S * Q), 0, Math.round(S * Q), 0, 0, 0, Q, 0, 0, 0, Q, 0, 0, 0, Q]),
    scale: new Float32Array(18).fill(1),
  },
  vehicleSpawns: [
    { blueprint: 'Gameplay/Vehicles/Ground/AT-AT_MP/Vehicle_Ground_AT-AT_MP', sub: 2, position: [140, 4, 260], quaternion: [0, 0, 0, 1] },
    { blueprint: 'Gameplay/Vehicles/Mount/Tauntaun/Mount_Tauntaun', sub: 0, position: [100, 5, 200], quaternion: [0, 0, 0, 1] },
    { blueprint: 'Gameplay/Vehicles/Stationary/E-Web/E-Web', sub: 1, position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
    { blueprint: 'Gameplay/Prefabs/Pickups/ObjectiveBomb/Vehicle_Objective_Bomb', sub: 0, position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
  ],
};
const pack = { origin: [100, 0, 200], yaw: 0, arena: 1024 };
const kinds = new Set(['ewok', 'tauntaun']);

describe('the map’s placed actors', () => {
  it('names a blueprint by the site’s kind, an Ewok once for its three parts', () => {
    expect(kindOfActor('models/characters/npc/creatures/ewok/ewok_01/ewok_01_mesh.glb')).toBe('ewok');
    expect(kindOfActor('models/characters/npc/creatures/ewok/ewok_01/ewok_01_hood_mesh.glb')).toBe(null);
    expect(kindOfActor('models/characters/npc/droids/astromech/r5d4_01/r5d4_01_mesh.glb')).toBe('r5');
  });

  it('stands a tauntaun where the game put it, in the pack’s frame, turned as it was', () => {
    const j = actorsJson(map, pack, { kinds, subs: ['fixture_01', 'fantasybattle'] });
    const t = j.life.find((a) => a.kind === 'tauntaun');
    expect(t.at).toEqual([20, 0]);
    expect(t.face).toBeCloseTo(Math.PI / 2, 3);
    expect(t).toMatchObject({ n: 1, still: true, placed: true });
    expect(j.life.filter((a) => a.kind === 'ewok')).toHaveLength(1);
    // (the lobby's tauntaun is not in the arena's subs)
    expect(j.life).toHaveLength(2);
  });

  it('lists a kind the site lacks and never places it (a kullbee before lane A), and a shrub as the scenery it is', () => {
    const j = actorsJson(map, pack, { kinds, subs: ['fixture_01', 'fantasybattle'] });
    expect(j.life.some((a) => a.kind === 'kullbee')).toBe(false);
    expect(j.unplaced).toEqual([
      { blueprint: 'forestbase_shrublarge_01_skinned', count: 1, why: 'scenery (skinned, wind-bent)' },
      { blueprint: 'kullbee_01', count: 1, why: 'no kind on the site' },
    ]);
  });
});

describe('the map’s vehicle spawns', () => {
  it('a mount is a ride, a walker or a gun a thing, by the catalogue’s kinds', () => {
    expect(kindOfVehicle('Gameplay/Vehicles/Ground/AT-AT_MP/Vehicle_Ground_AT-AT_MP')).toBe('atat');
    expect(kindOfVehicle('Gameplay/Vehicles/Stationary/TurboLaser/V_AntiVehicle_TurboLaser_Automatic')).toBe('turbolaser');
    const j = vehiclesJson(map, pack, { rides: new Set(['tauntaun']), things: new Set(['atat', 'eweb']), subs: ['fixture_01', 'fantasybattle'] });
    expect(j.rides).toEqual([{ kind: 'tauntaun', at: [0, 0], yaw: 0, placed: true }]);
    expect(j.things).toEqual([{ kind: 'atat', at: [40, 60], yaw: 0, placed: true }]);
    expect(j.unplaced).toEqual([{ blueprint: 'Vehicle_Objective_Bomb', count: 1, why: 'no kind on the site' }]);
  });
});
