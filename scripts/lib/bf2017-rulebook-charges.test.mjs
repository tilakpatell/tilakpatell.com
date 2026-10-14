import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldHash as H } from './bf2017-abilities.mjs';
import { CHARGE_LOCATOR, DETONATED, chargeRules, chargesOf } from './bf2017-rulebook-charges.mjs';

// The charge's four prefabs are the game's own in the fixtures (PF_Interact_PlanetaryBattle_Bomb, _Core,
// PF_Interact_Keypad, PF_Interact_Button), with Online/BattlepointCostData; the level is a fixture's.
const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const BOMB = { $asset: 'Gameplay/GameModes/Shared/Interacts/PF_Interact_PlanetaryBattle_Bomb' };

// one charge in a fixture level wired as Hoth's :131 is: its locator, its Enabled, its ObjectiveName, its
// detonated event into an EventAndGate of 3
function level() {
  const dir = mkdtempSync(join(tmpdir(), 'bf2017-charges-'));
  cpSync(ROOT, dir, { recursive: true });
  const write = (name, json) => {
    const file = join(dir, 'data', `${name}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ name, ...json }));
  };
  const tf = (x, y, z, f = [0, 0, 1]) => ({ right: { x: f[2], y: 0, z: -f[0] }, up: { x: 0, y: 1, z: 0 }, forward: { x: f[0], y: 0, z: f[2] }, trans: { x, y, z } });
  const d = 'Levels/MP/Fixture_05';
  const g = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  write(`${d}/FantasyBattle_Logic`, {
    type: 'LayerData',
    objects: [
      { $type: 'LayerData' },
      { $type: 'SpatialPrefabReferenceObjectData', $guid: g(1), Blueprint: BOMB, BlueprintTransform: tf(208.9051, 359.1815, -1762.3536, [0.9557539, 0, 0.2941666]) },
      { $type: 'LocatorEntityData', $guid: g(2), Transform: tf(208.6533, 360.918, -1762.4757) },
      { $type: 'BoolEntityData', $guid: g(3), DefaultValue: false },
      { $type: 'CheckedLocalizedStringEntityData', $guid: g(4), Sid: 'ID_FANTASYBATTLES_HOTH_FUEL_DEPOT' },
      { $type: 'EventAndGateEntityData', $guid: g(5), EventCount: 3 },
    ],
  });
  const end = (n) => ({ $asset: `${d}/FantasyBattle_Logic`, $assetType: 'LayerData', $class: g(n) });
  const prop = (s, sf, t, tf2) => ({ Source: end(s), Target: end(t), SourceFieldId: sf, TargetFieldId: tf2 });
  write(`${d}/FantasyBattle`, {
    type: 'SubWorldData',
    objects: [
      {
        $type: 'SubWorldData',
        PropertyConnections: [prop(2, 1925266716, 1, CHARGE_LOCATOR), prop(3, H('Value'), 1, H('Enabled')), prop(4, H('LocalizedString'), 1, H('ObjectiveName'))],
        EventConnections: [{ Source: end(1), Target: end(5), SourceEvent: { Id: DETONATED }, TargetEvent: { Id: H('In2') } }],
      },
    ],
  });
  return { dir, d };
}

describe('the fuel charges’ reader', () => {
  const R = chargeRules(ROOT, BOMB);

  it('reads the keypad’s reach over the button’s own: 1 m on its 3× transform, from any side, one at a time, a let-go starting over', () => {
    expect(R.interact).toMatchObject({ distance: 1, scale: 3, angle: 360, facing: 360, one: true, keep: false });
    expect(R.interact.fast).toEqual({ factor: 0.5, abilities: [3290040204, 3157191067], _source: expect.stringMatching(/WSRemotePlayerAbilityState/) });
  });

  it('gives the arm to the core’s Team2 and the defuse to the other', () => {
    expect(R.teams).toMatchObject({ arm: 2, defuse: 1 });
  });

  it('reads the holds and the fuse out of the cost table through the core’s selects', () => {
    expect(R.arm).toMatchObject({ hold: 2, by: 'attack', setting: 'GLOBAL_BOMB_INTERACT_TIME_OFF' });
    expect(R.defuse).toMatchObject({ hold: 3, by: 'defend', setting: 'GLOBAL_BOMB_INTERACT_TIME_ON' });
    expect(R.fuse).toMatchObject({ seconds: 45, setting: 'GLOBAL_BOMB_DETONATE_TIME', multiplier: 1, pausedWhileHeld: true, resumes: true, resetOnDefuse: true, warn: 1.33 });
    expect(R.fuse._source).toMatch(/StopWatchEntityData\.125/);
  });

  it('reads the delays: the keypad 5 s after the charge, 0.1 s from a hold to its event, the markers’ 5 s and 3 s', () => {
    expect(R.live.seconds).toBe(5);
    expect(R.settle.seconds).toBe(0.1);
    expect(R.marker).toMatchObject({ blast: 5, linger: 3 });
  });

  it('places the keypad in the level by the charge’s own transform, and reads its locator, switch, name and round', () => {
    const { dir, d } = level();
    const [c] = chargesOf(dir, `${d}/`, 'FantasyBattle');
    expect(c).toMatchObject({ id: 'FantasyBattle_Logic:1', label: 'ID_FANTASYBATTLES_HOTH_FUEL_DEPOT', enabledBy: 'FantasyBattle_Logic:3', charge: { id: 'FantasyBattle_Logic:2' } });
    expect(c.keypad.at[0]).toBeCloseTo(208.78, 2);
    expect(c.keypad.at[1]).toBeCloseTo(360.7621, 3);
    expect(c.keypad.at[2]).toBeCloseTo(-1762.3922, 2);
    expect(c.win).toMatchObject({ gate: 'FantasyBattle_Logic:5', of: 3 });
    expect(c.arm.hold).toBe(2);
  });
});
