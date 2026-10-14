import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldHash as H } from './bf2017-abilities.mjs';
import { GATE_ENABLED, GATE_PANEL, LEAVES_ENABLED, ROUTE_DONE, doorOf, gatesOf, interactOf } from './bf2017-rulebook-gates.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const SPLIT_IN = 1723395486;
const SPLIT_OUT = -137490305;

// A fixture level with one interact gate wired as Hoth's are: its panel's
// locator into the panel ports, a Bool on its Enabled set by an EventGate whose
// In is walker A's route done and whose Close is walker B's (through a
// splitter); the gate prefab's door core's button carries the interaction.
function level() {
  const dir = mkdtempSync(join(tmpdir(), 'bf2017-gates-'));
  cpSync(ROOT, dir, { recursive: true });
  const write = (name, json) => {
    const file = join(dir, 'data', `${name}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ name, ...json }));
  };
  const tf = (x, y, z, s = 1) => ({ right: { x: s, y: 0, z: 0 }, up: { x: 0, y: s, z: 0 }, forward: { x: 0, y: 0, z: s }, trans: { x, y, z } });
  const prefab = (name, objects) => write(name, { type: 'SpatialPrefabBlueprint', objects: [{ $type: 'SpatialPrefabBlueprint' }, ...objects] });
  prefab('Gameplay/GameModes/Shared/Interacts/PF_Interact_Button', [
    { $type: 'WorldInteractionEntityData', InteractionMaxDistance: 2, InteractionMaxAngle: 90, InteractionFacingMaxAngle: 360, EnabledTeam: 'TeamNeutral', Transform: tf(0, 0, 0, 2) },
    { $type: 'TransformMultiplierEntityData', In1: tf(0, 0, 0, 3), In2: tf(0, 0, 0) },
    { $type: 'StopWatchEntityData', TriggerOnTime: 1, Multiplier: 1 },
  ]);
  // (the door's run: the gate's interface → the core's → the controller's interpolator and its leaves' slide)
  const DUR = 1350828081;
  const SLIDE = -1015536881;
  const iface = (fields) => ({ $type: 'InterfaceDescriptorData', Fields: fields.map(([Id, Value]) => ({ Id, Value })) });
  const wire = (from, field, to, toField) => ({ Source: { $ref: from }, Target: { $ref: to }, SourceFieldId: field, TargetFieldId: toField });
  write('Gameplay/GameModes/Shared/Doors/PF_AutomaticDoor_Controller', {
    type: 'LogicPrefabBlueprint',
    objects: [
      { $type: 'LogicPrefabBlueprint', PropertyConnections: [wire(3, DUR, 1, H('Duration')), wire(3, SLIDE, 2, 177663)] },
      { $type: 'FloatInterpolatorEntityData', Duration: 1.5, InterpolationType: 'PropertyInterpolationType_Sine', InterpolationMode: 'PropertyInterpolationMode_EaseOut' },
      { $type: 'Vec3BuilderEntityData' },
      iface([[DUR, ''], [SLIDE, '']]),
    ],
  });
  write('Gameplay/GameModes/Shared/Doors/PF_InteractDoor_Core', {
    type: 'SpatialPrefabBlueprint',
    objects: [
      { $type: 'SpatialPrefabBlueprint', PropertyConnections: [wire(3, DUR, 2, DUR), wire(3, SLIDE, 2, SLIDE)] },
      { $type: 'SpatialPrefabReferenceObjectData', Blueprint: { $asset: 'Gameplay/GameModes/Shared/Interacts/PF_Interact_Button' } },
      { $type: 'LogicPrefabReferenceObjectData', Blueprint: { $asset: 'Gameplay/GameModes/Shared/Doors/PF_AutomaticDoor_Controller' } },
      iface([[DUR, ''], [SLIDE, 'Float32 3']]),
    ],
  });
  for (const side of ['Left', 'Right']) {
    write(`Objects/Fixture/Blastdoor_${side}`, { type: 'ObjectBlueprint', objects: [{ $type: 'ObjectBlueprint' }, { $type: 'StaticModelEntityData', Mesh: { $asset: `objects/fixture/blastdoor_${side.toLowerCase()}_mesh` } }] });
  }
  mkdirSync(join(dir, 'web'), { recursive: true });
  writeFileSync(
    join(dir, 'web', 'models.jsonl'),
    [
      { name: 'objects/fixture/blastdoor_right_mesh', min: [-9.12, 0, -0.2], max: [1.018, 6.4, 0.2] },
      { name: 'objects/fixture/blastdoor_left_mesh', min: [-0.997, 0, -0.2], max: [9.12, 6.4, 0.2] },
    ].map((r) => JSON.stringify(r)).join('\n'),
  );
  write('Gameplay/Prefabs/GameModes/Shared/PF_InteractGate_Fixture', {
    type: 'SpatialPrefabBlueprint',
    objects: [
      { $type: 'SpatialPrefabBlueprint', PropertyConnections: [wire(4, -141474857, 1, DUR), wire(4, -141474858, 1, SLIDE)] },
      { $type: 'SpatialPrefabReferenceObjectData', Blueprint: { $asset: 'Gameplay/GameModes/Shared/Doors/PF_InteractDoor_Core' }, BlueprintTransform: tf(0, 0, -4.4) },
      { $type: 'ObjectReferenceObjectData', Blueprint: { $asset: 'Objects/Fixture/Blastdoor_Right' } },
      { $type: 'ObjectReferenceObjectData', Blueprint: { $asset: 'Objects/Fixture/Blastdoor_Left' } },
      iface([[-141474857, 'Float32 70'], [-141474858, 'Float32 8.96']]),
    ],
  });
  const d = 'Levels/MP/Fixture_04';
  const g = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  write(`${d}/FantasyBattle_Logic`, {
    type: 'LayerData',
    objects: [
      { $type: 'LayerData' },
      { $type: 'SpatialPrefabReferenceObjectData', $guid: g(1), Blueprint: { $asset: 'Gameplay/Prefabs/GameModes/Shared/PF_InteractGate_Fixture' }, BlueprintTransform: tf(179.2, 359.04, -1569.28) },
      { $type: 'LocatorEntityData', $guid: g(2), Transform: tf(189.749, 360.6877, -1571.9183) },
      { $type: 'BoolEntityData', $guid: g(3), DefaultValue: false },
      { $type: 'EventGateEntityData', $guid: g(4) },
      { $type: 'FollowWaypointsEntityData', $guid: g(5) },
      { $type: 'FollowWaypointsEntityData', $guid: g(6) },
      { $type: 'EventSplitterEntityData', $guid: g(7) },
      { $type: 'AIWaypointsShapeData', $guid: g(8), Points: [] },
      { $type: 'AIWaypointsShapeData', $guid: g(9), Points: [] },
      // (the leaves' Enabled: a Bool through a SyncedBool, set false a second after walker B is home)
      { $type: 'BoolEntityData', $guid: g(10), DefaultValue: true },
      { $type: 'SyncedBoolEntityData', $guid: g(11) },
      { $type: 'DelayEntityData', $guid: g(12), Delay: 1 },
    ],
  });
  const end = (n) => ({ $asset: `${d}/FantasyBattle_Logic`, $assetType: 'LayerData', $class: g(n) });
  const prop = (s, sf, t, tf2) => ({ Source: end(s), Target: end(t), SourceFieldId: sf, TargetFieldId: tf2 });
  const ev = (s, se, t, te) => ({ Source: end(s), Target: end(t), SourceEvent: { Id: se }, TargetEvent: { Id: te } });
  write(`${d}/FantasyBattle`, {
    type: 'SubWorldData',
    objects: [
      {
        $type: 'SubWorldData',
        PropertyConnections: [prop(2, H('Transform'), 1, GATE_PANEL[0]), prop(2, H('Transform'), 1, GATE_PANEL[1]), prop(3, H('Value'), 1, GATE_ENABLED), prop(10, H('Value'), 11, H('In')), prop(11, H('Out'), 1, LEAVES_ENABLED)],
        EventConnections: [ev(4, H('Out'), 3, H('SetTrue')), ev(5, ROUTE_DONE, 4, H('In')), ev(6, ROUTE_DONE, 7, SPLIT_IN), ev(7, SPLIT_OUT, 4, H('Close')), ev(6, ROUTE_DONE, 12, H('In')), ev(12, H('Out'), 10, H('SetFalse'))],
        LinkConnections: [
          { Source: end(5), Target: end(8), SourceFieldId: 0, TargetFieldId: 0 },
          { Source: end(6), Target: end(9), SourceFieldId: 0, TargetFieldId: 0 },
        ],
      },
    ],
  });
  return { dir, d };
}

describe('the interact gates’ reader', () => {
  const { dir, d } = level();
  const [gate] = gatesOf(dir, `${d}/`, 'FantasyBattle');

  it('finds the gate, its panel where the level’s locator puts it, facing the way the locator faces', () => {
    expect(gate).toMatchObject({ id: 'FantasyBattle_Logic:1', name: 'PF_InteractGate_Fixture', at: [179.2, 359.04, -1569.28], yaw: 0 });
    expect(gate.panel).toEqual({ id: 'FantasyBattle_Logic:2', at: [189.749, 360.6877, -1571.9183], yaw: 0 });
  });

  it('unlocks it with walker A’s route and bars it with walker B’s, through the EventGate and its splitter', () => {
    expect(gate.unlock).toBe('FantasyBattle_Logic:8');
    expect(gate.barredBy).toEqual(['FantasyBattle_Logic:9']);
  });

  it('is blown by walker B’s route a second on: its leaves’ Enabled set false, back through the delay', () => {
    expect(gate.blownBy).toEqual([{ path: 'FantasyBattle_Logic:9', after: 1 }]);
  });

  it('reads the panel’s interaction off the door core’s button: its distance, its transform’s 3× scale, its angle and hold', () => {
    expect(gate.interact).toMatchObject({ distance: 2, scale: 3, angle: 90, hold: 1 });
    expect(gate.interact._source).toMatch(/PF_Interact_Button/);
    expect(interactOf(dir, { $asset: 'Gameplay/GameModes/Shared/Doors/PF_InteractDoor_Core' })).toBeNull();
  });

  it('reads the leaves’ run as the gate sets it through its door core: 70 s and 8.96 m over the controller’s own 1.5 s and the core’s 3 m', () => {
    expect(gate.door).toMatchObject({ seconds: 70, slide: 8.96, curve: 'Sine', mode: 'EaseOut' });
    // (shut, the leaves reach past the gate's middle by their meshes' bounds)
    expect(gate.door.overlap).toBeCloseTo(2.015, 3);
    // (the core alone: its own slide, the controller's own run)
    expect(doorOf(dir, { $asset: 'Gameplay/GameModes/Shared/Doors/PF_InteractDoor_Core' })).toBeNull();
  });

  it('a level with no such sub-world has none', () => {
    expect(gatesOf(ROOT, 'Levels/MP/Hoth_01/', 'FantasyBattle')).toEqual([]);
  });
});
