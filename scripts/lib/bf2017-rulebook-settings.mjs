// The server's game settings and the Instant Action bot logic (gameSettings.json):
// the numbers the game's AutoPlayers (the bots of Instant Action, Co-op,
// Supremacy and the server fill: bf2-re finding 28) run on, and the mode
// tables beside them.
//
//   Online/GameSettingsContainer (GameSettingsContainer) a tree of
//       GameSettingNode { SettingName, SettingType Float|Int|Bool|String,
//       DefaultValue (text: "0.25", "2,5" with a comma for one row, "True"),
//       LowerBound, UpperBound, GameSettings[] (the children: a node with
//       children and no value is a group, its name the group's) }: 936 named
//       rows (AP_* the AutoPlayers', TeamSize*, *_Mode8 Instant Action's, the
//       waves, the hero and vehicle counts by planet and phase …)
//   Gameplay/GameModes/Mode8/Prefabs/Mode8_BotLogic_AttackObjectives
//       (LogicPrefabBlueprint) Instant Action's bot logic: its weighted
//       random splits (RandomMultiEventEntityData.RandomEventWeight), its
//       objectives (AutoPlayerDefendObjectiveEntityData,
//       AutoPlayerFollowObjectiveEntityData), its delays and cool-downs
//
// A setting is kept as its value (a number, a boolean, a string) by its name
// (trimmed: one name ends in a space), with the group it sits under; the
// server's address rows (GS_*_URL) and the empty group headers are left out,
// and so is every row of the sequel era (`isSequel`, and the settings' own
// short forms: Takodana's `_TAKO`, the First Order's `FO_`, BB-8's and BB-9E's
// stamina rows).
// The graph's wiring (which split sends a bot where) is read by hand in
// src/lib/battlefront/ai/botLogic.js (NOTES.md, "The AutoPlayers").

import { isSequel, loadAsset, rootOf } from './bf2017-ebx.mjs';

// the settings' own names for the sequel era, beside isSequel's folder names
const SEQUEL_SETTING = /(^|[_!])(tako|fo)([_-]|$)|^bb(8|9e)/i;
export const sequelSetting = (name) => isSequel(name) || SEQUEL_SETTING.test(name);

export const SETTINGS = 'Online/GameSettingsContainer';
const BOT_LOGIC = { mode8: 'Gameplay/GameModes/Mode8/Prefabs/Mode8_BotLogic_AttackObjectives' };

// A setting's text as its type: "2,5" is 2.5 (the one comma the export holds)
export function valueOf(type, text) {
  const t = String(text ?? '').trim();
  if (type === 'GameSettingType_Bool') return t === '' ? null : /^(1|true)$/i.test(t);
  if (type === 'GameSettingType_Float' || type === 'GameSettingType_Int') {
    if (t === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return t;
}

// The settings by name, from the container's tree: { settings, groups, bounds }
export function settingsFrom(asset) {
  const objects = asset.objects;
  const settings = {};
  const groups = {};
  const bounds = {};
  const seen = new Set();
  const walk = (i, path) => {
    if (seen.has(i)) return;
    seen.add(i);
    const o = objects[i];
    if (!o) return;
    const kids = (o.GameSettings ?? []).map((r) => r?.$ref).filter((r) => typeof r === 'number');
    const name = String(o.SettingName ?? '').trim();
    const value = o.$type === 'GameSettingNode' ? valueOf(o.SettingType, o.DefaultValue) : null;
    const group = kids.length && (value === null || value === '') ? name.replace(/^\W+|\W+$/g, '') : null;
    if (o.$type === 'GameSettingNode' && name && value !== null && value !== '' && !/^GS_\w*URL$/.test(name) && !sequelSetting(name)) {
      settings[name] = value;
      if (path) (groups[path] ??= []).push(name);
      const lo = valueOf(o.SettingType, o.LowerBound);
      const hi = valueOf(o.SettingType, o.UpperBound);
      if (typeof lo === 'number' || typeof hi === 'number') bounds[name] = [typeof lo === 'number' ? lo : null, typeof hi === 'number' ? hi : null];
    }
    const next = group ? (path ? `${path}/${group}` : group) : path;
    for (const k of kids) walk(k, next);
  };
  walk(asset.root ?? 0, '');
  // (a node the tree never reaches is kept too, ungrouped)
  objects.forEach((_, i) => walk(i, ''));
  return { settings, groups, bounds };
}

const vec = (v) => (v && typeof v === 'object' ? [v.x ?? 0, v.y ?? 0, v.z ?? 0] : null);

// A bot logic prefab's data: its splits, objectives, delays and cool-downs, each with its object index
export function botLogicFrom(asset, name) {
  const at = (o) => `${name}#${asset.objects.indexOf(o)}`;
  const of = (type) => asset.objects.filter((o) => o?.$type === type);
  return {
    splits: of('RandomMultiEventEntityData').map((o) => ({ weights: o.RandomEventWeight ?? [], uniform: Boolean(o.UniformDistribution), _source: at(o) })),
    defend: of('AutoPlayerDefendObjectiveEntityData').map((o) => ({ radius: o.DefendAreaRadius, moveMode: String(o.MoveMode ?? '').replace('AutoPlayerMoveMode_', ''), currentPosition: Boolean(o.DefendCurrentPosition), spread: Boolean(o.UseRandomPathSpread), reachedOnEntering: Boolean(o.IsTargetReachedAsSoonAsEnteringTargetArea), teleport: Boolean(o.AllowTeleport), objectiveTeleport: Boolean(o.UseObjectiveTeleport), stuckEscape: Boolean(o.UseStuckEscapeProcedure), secondary: Boolean(o.AllowSecondaryObjectives), _source: at(o) })),
    follow: of('AutoPlayerFollowObjectiveEntityData').map((o) => ({ radius: o.FollowPositionRadius, timeout: o.FollowTimeoutSeconds, until: vec(o.FollowUntilPosition), untilTolerance: o.FollowUntilPositionToleranceMeters, patrol: Boolean(o.ActivelyPatrolFollowPlayerPosition), breadCrumbs: Boolean(o.UseBreadCrumbsPathFollowing), moveMode: String(o.MoveMode ?? '').replace('AutoPlayerMoveMode_', ''), _source: at(o) })),
    delays: of('DelayEntityData').map((o) => ({ seconds: o.Delay, once: Boolean(o.RunOnce), _source: at(o) })),
    coolDowns: of('CoolDownGateEntityData').map((o) => ({ seconds: o.CoolDownTime, _source: at(o) })),
    randomInts: of('RandomIntEntityData').map((o) => ({ start: o.Start, count: o.Count, _source: at(o) })),
    debug: of('PrintDebugTextEntityData').map((o) => String(o.Text ?? '').replace(/_Triggered$/, '')).filter(Boolean),
    commands: of('ConsoleCommandTriggerEntityData').map((o) => o.CommandName),
  };
}

export function settingsRulebook(root) {
  const asset = loadAsset(root, SETTINGS);
  if (!asset) throw new Error(`${SETTINGS}: not in ${root}`);
  const { settings, groups, bounds } = settingsFrom(asset);
  const botLogic = {};
  const missing = [];
  for (const [id, name] of Object.entries(BOT_LOGIC)) {
    const a = loadAsset(root, name);
    if (a) botLogic[id] = botLogicFrom(a, name);
    else missing.push(name);
  }
  return { settings, groups, bounds, botLogic, _source: `${SETTINGS}#${rootOf(asset).$type}.GameSettings`, missing };
}
