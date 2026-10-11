// The squads rulebook (squads.json): how the game forms squads and spawns on
// them, and how its HUD lists them. From the shared multiplayer spawn
// manager (`Gameplay/GameModes/Shared/SpawnManager_Shared_MP`: the squad
// size, the deploy wait, the friendly spawn position table), the Galactic
// Assault mode's player count, the squad-spawn killswitches, the string ids
// the squad strip and its block reasons show, and the widget records of the
// squad list (`UI/InGame/Hud/SquadMemberList/*`, placed in
// `DefaultSoldierHudWidget`) and the deploy screen's strip
// (`UI/InGame/Spawn/FastSpawnScreen`). Every number names its record.
//
// The palette picks are the cell's `UIColorPalettePickerEntityData` in the
// record's order (34, 41, 42, 35, 60): which pick feeds which colour is the
// cell's graph (dead / party / anyone else for the name, dead-or-party /
// anyone else for the icon), read by hand from its hashed fields
// (docs/superpowers/evidence/battlefront-lane5b/research-squad.md).
//
//   squadsRow(root, { strings }) → the row

import { loadAsset, objectsOf, resolveStrings, rootOf } from './bf2017-ebx.mjs';
import { indexOf } from './bf2017-rulebook.mjs';

const SPAWN = 'Gameplay/GameModes/Shared/SpawnManager_Shared_MP';
const LIST = 'UI/InGame/Hud/SquadMemberList/SquadMemberList';
const CELL = 'UI/InGame/Hud/SquadMemberList/SquadMemberListCell';
const CONTENT = 'UI/InGame/Hud/SquadMemberList/SquadMemberListContent';
const LOCAL = 'UI/InGame/Hud/SquadMemberList/SquadMemberListLocalPlayer';
const SOLDIER_HUD = 'UI/InGame/Hud/Soldier/Screens/DefaultSoldierHudWidget';
const FAST_SPAWN = 'UI/InGame/Spawn/FastSpawnScreen';
const OPTION = 'Gameplay/Profiles/ui/OptionHUDSquadListVisibility';
const MODE = 'UI/Data/GameModes/PlanetaryBattles';
const BAR = 'UI/Shapes/InGame/HUD/SquadList/SquadListBG';
const KILLSWITCH = /^Online\/Killswitches\/SquadSpawn_InCombat_When(.+)$/;

const BLOCKED = {
  combat: 'ID_SQUAD_SPAWN_BLOCK_REASON_IN_COMBAT',
  oob: 'ID_SQUAD_SPAWN_BLOCK_REASON_OUT_OF_BOUNDS',
  vehicle: 'ID_SQUAD_SPAWN_BLOCK_REASON_IN_VEHICLE',
  none: 'ID_SQUAD_SPAWN_BLOCK_REASON_NO_PLAYER',
  other: 'ID_SQUAD_SPAWN_BLOCK_REASON_OTHER',
  dead: 'ID_HUD_SQUADSPAWN_KILLED',
};
const HQ = { light: 'ID_SPAWN_GROUP_NAME_REBELHQ', dark: 'ID_SPAWN_GROUP_NAME_IMPERIALHQ' };
const FULL = 'ID_SPAWN_TACTICALSQUAD_FULL';
const HINT = 'ID_HINT_GENERAL_03';

const xy = (v) => [v.X ?? v.x, v.Y ?? v.y];
const fontOf = (el) => el?.FontStyle?.$asset?.split('/').pop() ?? null;

function need(root, name) {
  const a = loadAsset(root, name);
  if (!a) throw new Error(`${name}: not in ${root}`);
  return a;
}

const named = (asset, type, instance) => objectsOf(asset, type).find((o) => o.InstanceName === instance) ?? null;

function spawning(root) {
  const a = need(root, SPAWN);
  const t = objectsOf(a, 'TacticalSpawnManagerEntityData')[0];
  const m = objectsOf(a, 'SpawnManagerEntityData')[0];
  const f = objectsOf(a, 'SpawnLocationFinderEntityData')[0];
  const at = (type, field) => `${SPAWN}#${type}.${field}`;
  const i = m.FriendlySpawnPositionTables.findIndex((p) => p.HashPositionTableId === t.HashPositionTableId);
  const table = m.FriendlySpawnPositionTables[i];
  const o = m.FriendlySpawnPositionAttemptOffset;
  return {
    size: t.MaxPlayersPerSquad,
    size_source: at('TacticalSpawnManagerEntityData', 'MaxPlayersPerSquad'),
    maxWait: t.MaxWaitTime,
    maxWait_source: at('TacticalSpawnManagerEntityData', 'MaxWaitTime'),
    maxSpawnWait: t.MaxSpawnWaitTime,
    maxSpawnWait_source: at('TacticalSpawnManagerEntityData', 'MaxSpawnWaitTime'),
    spawnOnFirstPlayer: t.SpawnSquadOnFirstPlayer,
    fallbackToPoint: t.SpawnOnSpawnEntityIfSpawnOnPlayerFails,
    lockKitOnWave: t.LockKitOnPlayerEnterWave,
    // (x to the mate's right, y ahead of the mate, in metres: the first is 3 m behind)
    offsets: table.Positions.map((p) => [p.x, p.y]),
    offsets_source: `${at('SpawnManagerEntityData', `FriendlySpawnPositionTables[${i}].Positions`)} (HashPositionTableId ${t.HashPositionTableId}, TacticalSpawnManagerEntityData's)`,
    attemptOffset: [o.x, o.y, o.z],
    attemptOffset_source: at('SpawnManagerEntityData', 'FriendlySpawnPositionAttemptOffset'),
    attempts: m.FindFriendlySpawnPositionAttemptCount,
    attempts_source: at('SpawnManagerEntityData', 'FindFriendlySpawnPositionAttemptCount'),
    checkRadius: f.SpawnPointCheckRadius,
    checkRadius_source: at('SpawnLocationFinderEntityData', 'SpawnPointCheckRadius'),
    safeEnemyDistance: f.SpawnSafeEnemyDistance,
    safeEnemyDistance_source: at('SpawnLocationFinderEntityData', 'SpawnSafeEnemyDistance'),
  };
}

function hud(root) {
  const list = need(root, LIST);
  const stack = objectsOf(list, 'StackingContainerData')[0];
  const rows = objectsOf(list, 'StandardListElementData')[0];
  const content = need(root, CONTENT);
  const name = named(content, 'TextElementData', 'PlayerName');
  const local = named(content, 'TextElementData', 'LocalPlayerName');
  const icon = named(content, 'WSUIContainerEntityData', 'IconContainer');
  const pin = named(content, 'VectorShapeElementData', 'SquadIconBG');
  const svg = named(content, 'SvgElementData', 'ClassIcon');
  const bar = rootOf(need(root, BAR));
  const solid = bar.Shapes[0].Path.Corners.filter((c) => c.Alpha === 1).reduce((n, c) => Math.max(n, c.Position.x), 0);
  const picks = objectsOf(need(root, CELL), 'UIColorPalettePickerEntityData').map((p) => p.PaletteIndex);
  const localPicks = objectsOf(need(root, LOCAL), 'UIColorPalettePickerEntityData').map((p) => p.PaletteIndex);
  const soldier = need(root, SOLDIER_HUD);
  const place = objectsOf(soldier, 'StackingContainerData').find((s) => (s.Elements ?? []).some((e) => e && soldier.objects[e.$ref]?.InstanceName === 'Squad Member List'));
  const radar = place.Elements.map((e) => soldier.objects[e.$ref]).find((o) => o?.InstanceName === 'Radar');
  const option = rootOf(need(root, OPTION)).Items.map((i) => i.DisplayName);
  return {
    place: { anchor: xy(place.Anchor), offset: xy(place.Offset), spacing: place.Spacing, radar: xy(radar.Size), reversed: place.ReverseDirection, _source: `${SOLDIER_HUD}#StackingContainerData (Radar, Squad Member List)` },
    size: xy(stack.Size),
    size_source: `${LIST}#StackingContainerData.Size`,
    row: xy(rows.CellSize),
    row_source: `${LIST}#StandardListElementData.CellSize`,
    maxRows: rows.MaxRows,
    maxRows_source: `${LIST}#StandardListElementData.MaxRows`,
    name: { offset: xy(name.Offset), font: fontOf(name), localFont: fontOf(local), _source: `${CONTENT}#TextElementData PlayerName, LocalPlayerName` },
    icon: { box: xy(icon.Size)[0], pin: xy(pin.Size)[0], svg: xy(svg.Size)[0], _source: `${CONTENT}#IconContainer, SquadIconBG, ClassIcon .Size` },
    bar: { width: bar.LayoutRect.z, height: bar.LayoutRect.w, solidTo: solid, _source: `${BAR}#DiceUIVectorShapeAsset (LayoutRect, the corners at alpha 1)` },
    palette: { dead: picks[0], party: picks[1], other: picks[2], iconDead: picks[3], icon: picks[4], local: localPicks[0], localIcon: localPicks[1], _source: `${CELL}#UIColorPalettePickerEntityData, ${LOCAL}#UIColorPalettePickerEntityData (in order)` },
    option,
  };
}

function deployStrip(root) {
  const a = need(root, FAST_SPAWN);
  const outer = named(a, 'StackingContainerData', 'SpawnPoints');
  const cells = named(a, 'StandardListElementData', 'FastSpawnList');
  return {
    anchor: xy(outer.Anchor),
    offset: xy(outer.Offset),
    size: xy(outer.Size),
    _source: `${FAST_SPAWN}#StackingContainerData SpawnPoints`,
    cell: xy(cells.CellSize),
    cell_source: `${FAST_SPAWN}#StandardListElementData FastSpawnList.CellSize`,
    maxRows: cells.MaxRows,
    maxRows_source: `${FAST_SPAWN}#StandardListElementData FastSpawnList.MaxRows`,
  };
}

export function squadsRow(root, { strings = null } = {}) {
  const spawn = spawning(root);
  const players = rootOf(need(root, MODE)).NumberOfPlayers;
  // the squads' names: the strings' group letters, in order, while the table has them
  const names = [];
  for (let c = 65; c <= 90; c++) {
    const id = `ID_SPAWN_GROUP_NAME_${String.fromCharCode(c)}`;
    if (!strings || !Object.keys(resolveStrings([id], strings)).length) break;
    names.push(id);
  }
  const inCombat = [...indexOf(root).keys()].map((n) => n.match(KILLSWITCH)?.[1]).filter(Boolean).sort();
  const ids = [...names, ...Object.values(HQ), ...Object.values(BLOCKED), FULL, HINT];
  return {
    ...spawn,
    players,
    players_source: `${MODE}#GameModeInformationAsset.NumberOfPlayers`,
    squadsATeam: players / 2 / spawn.size,
    squadsATeam_source: `derived: ${MODE}#NumberOfPlayers / 2 / size`,
    names,
    hq: HQ,
    blocked: BLOCKED,
    full: FULL,
    hint: HINT,
    inCombat,
    strings: strings ? resolveStrings(ids, strings) : {},
    hud: hud(root),
    deploy: deployStrip(root),
  };
}
