import { describe, expect, it } from 'vitest';
import { fieldHash as H } from './bf2017-abilities.mjs';
import { CONTROLLER, PORT, T, boxesOf, fieldValue, mul, quatOf, readMode, valueAt } from './bf2017-level-mode.mjs';

// A sub-world cut down to what the reading takes: one layer with a double door (its prefab, its core, the
// controller), a Delay that opens it, a vehicle spawner's wreck, a static group's member, and a wall
const CORE = 'Gameplay/GameModes/Shared/Doors/PF_AutomaticDoor_Core';
const OUT = 1111; // (the core's field it hands the left leaf's blend out on)
const F_DUR = 2001;
const F_SLIDE = 2002;
const TEAM = H('TeamId');
const TURN = { right: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 1, y: 0, z: 0 } };
const at = (x, y, z, turn = {}) => ({ right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 }, ...turn, trans: { x, y, z } });
const ref = (i) => ({ $ref: i });
const asset = (name, objects, root = 0) => ({ name, root, objects });
const blueprint = (name, mesh) => asset(name, [{ $type: 'ObjectBlueprint', Object: ref(1) }, { $type: 'StaticModelEntityData', Mesh: { $asset: mesh } }]);
const end = (layer, guid) => ({ $asset: layer, $class: guid });
const RECORDS = {
  'L/Sub': asset('L/Sub', [
    {
      $type: 'SubWorldData',
      Objects: [ref(1)],
      PropertyConnections: [{ Source: ref(2), SourceFieldId: 5, Target: end('L/Sub_Logic', 'g-door'), TargetFieldId: TEAM }],
      EventConnections: [{ Source: end('L/Sub_Logic', 'g-delay'), SourceEvent: { Id: 9 }, Target: end('L/Sub_Logic', 'g-door'), TargetEvent: { Id: H('OpenDoor') } }],
    },
    { $type: 'LayerReferenceObjectData', Blueprint: { $asset: 'L/Sub_Logic' } },
    { $type: 'InterfaceDescriptorData', Fields: [{ Id: 5, Value: 'TeamId Team1' }] },
    { $type: 'StaticModelGroupEntityData', MemberDatas: [{ MemberType: { $asset: 'O/Static' }, InstanceCount: 1 }] },
  ]),
  'L/Sub_Logic': asset('L/Sub_Logic', [
    { $type: 'LayerData', Objects: [ref(1), ref(2), ref(3)] },
    { $type: 'SpatialPrefabReferenceObjectData', $guid: 'g-door', Blueprint: { $asset: 'P/PF_AutomaticDoubleDoor_Test' }, BlueprintTransform: at(10, 0, 0, TURN) },
    { $type: 'DelayEntityData', $guid: 'g-delay', Delay: 10 },
    { $type: 'SpatialPrefabReferenceObjectData', $guid: 'g-wreck', Blueprint: { $asset: 'P/PF_VehicleSpawner-Test' }, BlueprintTransform: at(30, 0, 0) },
  ]),
  'P/PF_AutomaticDoubleDoor_Test': asset('P/PF_AutomaticDoubleDoor_Test', [
    {
      $type: 'SpatialPrefabBlueprint',
      Objects: [ref(1), ref(2), ref(4)],
      PropertyConnections: [
        { Source: ref(3), SourceFieldId: F_DUR, Target: ref(1), TargetFieldId: PORT.duration },
        { Source: ref(3), SourceFieldId: F_SLIDE, Target: ref(1), TargetFieldId: PORT.slideLeft },
        { Source: ref(3), SourceFieldId: TEAM, Target: ref(1), TargetFieldId: TEAM },
        { Source: ref(1), SourceFieldId: OUT, Target: ref(2), TargetFieldId: H('Transform') },
      ],
      LinkConnections: [{ Source: ref(1), SourceFieldId: 1, Target: ref(4), TargetFieldId: 0 }],
    },
    { $type: 'LogicPrefabReferenceObjectData', Blueprint: { $asset: CORE } },
    { $type: 'ObjectReferenceObjectData', Blueprint: { $asset: 'O/Leaf' }, BlueprintTransform: at(0, 0, 0) },
    { $type: 'InterfaceDescriptorData', Fields: [{ Id: F_DUR, Value: 'Float32 1' }, { Id: F_SLIDE, Value: 'Float32 1.98' }, { Id: TEAM, Value: 'TeamId TeamNeutral' }] },
    { $type: 'OBBData', Transform: at(0, 1.44, 0), HalfExtents: { x: 3.84, y: 1.44, z: 5.12 } },
  ]),
  [CORE]: asset(CORE, [
    {
      $type: 'LogicPrefabBlueprint',
      Objects: [ref(1)],
      PropertyConnections: [
        { Source: ref(2), SourceFieldId: PORT.duration, Target: ref(1), TargetFieldId: PORT.duration },
        { Source: ref(2), SourceFieldId: PORT.slideLeft, Target: ref(1), TargetFieldId: PORT.slideLeft },
        { Source: ref(1), SourceFieldId: PORT.leftLeaf, Target: ref(2), TargetFieldId: OUT },
      ],
    },
    { $type: 'LogicPrefabReferenceObjectData', Blueprint: { $asset: CONTROLLER } },
    { $type: 'InterfaceDescriptorData', Fields: [] },
  ]),
  [CONTROLLER]: asset(CONTROLLER, [
    { $type: 'LogicPrefabBlueprint', Objects: [] },
    { $type: 'FloatInterpolatorEntityData', InterpolationType: 'PropertyInterpolationType_Sine', InterpolationMode: 'PropertyInterpolationMode_EaseOut', Duration: 1.5 },
    { $type: 'GeometryTriggerEntityData', Include: 'ATAll', TeamOfAllies: 'Team1' },
    { $type: 'InterfaceDescriptorData', Fields: [{ Id: PORT.axisX, Value: 'Boolean True' }] },
  ]),
  'P/PF_VehicleSpawner-Test': asset('P/PF_VehicleSpawner-Test', [
    { $type: 'SpatialPrefabBlueprint', Objects: [ref(1)], PropertyConnections: [{ Source: ref(2), SourceFieldId: H('Value'), Target: ref(1), TargetFieldId: H('Enabled') }] },
    { $type: 'ObjectReferenceObjectData', Blueprint: { $asset: 'O/Wreck' }, BlueprintTransform: at(0, 0, 0) },
    { $type: 'BoolEntityData', DefaultValue: false },
  ]),
  'O/Leaf': blueprint('O/Leaf', 'o/leaf_mesh'),
  'O/Wreck': blueprint('O/Wreck', 'o/wreck_mesh'),
  'O/Static': blueprint('O/Static', 'o/static_mesh'),
  'L/Sub_Collision': asset('L/Sub_Collision', [
    { $type: 'LayerData', Objects: [] },
    { $type: 'OBBCollisionEntityData', HalfExtents: { x: 2, y: 1, z: 0.5 }, Transform: at(5, 1, 5), CollisionLayer: 'RigidBodyCollisionLayer_CharacterCollisionGeometryLayer', Enabled: true },
    { $type: 'SphereCollisionEntityData', Position: { x: 1, y: 2, z: 3 }, Radius: 3, CollisionLayer: 'RigidBodyCollisionLayer_StaticLayer', Enabled: true },
  ]),
};
const load = (name) => RECORDS[name] ?? null;
const place = (mesh, x, y, z, turn) => ({ mesh: `models/${mesh}.glb`, world: T(at(x, y, z, turn)) });

describe('a mode part read from its sub-world', () => {
  const instances = [place('o/leaf_mesh', 10, 0, 0, TURN), place('o/wreck_mesh', 30, 0, 0), place('o/static_mesh', 50, 0, 0), place('o/ghost_mesh', 99, 0, 0)];
  const mode = readMode(load, { sub: 'L/Sub', instances, origin: [0, 0, 0], layers: ['L/Sub_Collision'] });

  it('a door: its team from the level, its duration and slide through its prefab, its axis the controller’s, its leaf and box', () => {
    expect(mode.controller).toMatchObject({ curve: 'Sine', mode: 'EaseOut', duration: 1.5, triggers: [{ include: 'ATAll', allies: 1 }] });
    expect(mode.doors).toHaveLength(1);
    const [d] = mode.doors;
    expect(d).toMatchObject({ id: 'Sub_Logic:1', team: 1, duration: 1, axis: 'x', bothTeams: false });
    // (the leaf's own X axis, turned with the door to −z: the slide −1.98 m along z)
    expect(d.leaves).toEqual([{ side: 'left', mesh: 'models/o/leaf_mesh.glb', at: [10, 0, 0], slide: [0, 0, -1.98] }]);
    expect(d.trigger.at).toEqual([10, 1.44, 0]);
    expect(d.trigger.half).toEqual([3.84, 1.44, 5.12]);
    expect(d.opens).toEqual([{ from: 'Sub_Logic:2', type: 'DelayEntityData', delay: 10 }]);
  });

  it('a wreck: its switch, a Bool that starts off; a static group’s member stands; the rest unmatched', () => {
    const w = mode.props.find((p) => p.id === 'Sub_Logic:3');
    expect(w.kind).toBe('wreck');
    expect(w.parts).toEqual([{ switch: { field: 'Enabled', from: 'BoolEntityData', start: false, in: 'PF_VehicleSpawner-Test:1' }, instances: [{ mesh: 'models/o/wreck_mesh.glb', at: [30, 0, 0] }] }]);
    expect(mode.statics).toEqual([{ mesh: 'models/o/static_mesh.glb', instances: [{ mesh: 'models/o/static_mesh.glb', at: [50, 0, 0] }], _source: 'Sub#StaticModelGroupEntityData[3] (Static ×1)' }]);
    expect(mode.unmatched.map((u) => u.mesh)).toEqual(['models/o/ghost_mesh.glb']);
  });

  it('the walls: an OBB for soldiers only, a sphere for all', () => {
    expect(mode.boxes).toEqual([
      { at: [5, 1, 5], half: [2, 1, 0.5], rotation: [0, 0, 0, 1], layer: 'character', _source: 'L/Sub_Collision#OBBCollisionEntityData[1]' },
      { at: [1, 2, 3], radius: 3, layer: 'static', _source: 'L/Sub_Collision#SphereCollisionEntityData[2]' },
    ]);
    expect(boxesOf(null)).toEqual([]);
  });
});

describe('the transforms and values', () => {
  it('turns a child by its parent, local first', () => {
    const parent = T(at(10, 0, 0, TURN));
    expect(mul(T(at(1, 0, 0)), parent).t).toEqual([10, 0, -1]);
    expect(quatOf(parent).map((v) => Math.round(v * 1e4) / 1e4)).toEqual([0, 0.7071, 0, 0.7071]);
  });

  it('reads an interface field’s written value', () => {
    expect([fieldValue('Float32 1.5'), fieldValue('Boolean True'), fieldValue('TeamId Team2'), fieldValue('TeamId TeamNeutral'), fieldValue('')]).toEqual([1.5, true, 2, 0, undefined]);
  });

  it('a field at the end of a chain of prefabs: the last connection in, else the default', () => {
    const chain = [{ asset: 'P/PF_AutomaticDoubleDoor_Test', index: 1 }, { asset: CORE, index: 1 }, { asset: CONTROLLER, index: 1 }];
    expect(valueAt(load, chain, PORT.duration)).toBe(1);
    expect(valueAt(load, chain, PORT.duration, (f) => (f === F_DUR ? 70 : undefined))).toBe(70);
    expect(valueAt(load, chain, PORT.axisX)).toBe(true);
  });
});
