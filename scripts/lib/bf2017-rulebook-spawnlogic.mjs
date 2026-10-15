// The spawn logic of a mode's sub-world (maps/<level>.json `spawnLogic`):
// which spawn points and spawn areas are on, read the way the game decides
// it. A spawn record's `Enabled` (AlternateSpawnEntityData,
// SpawnLocationFinderShapeData) is a property connection out of a small
// graph of logic records in the mode's layers, whose leaves are the mode
// prefab's stage ports, other prefabs' outputs (a capture point's owner, a
// charge's IsDestroyed, the escort tracker's lead walker), geometry triggers
// and timers. This reads that graph out of the sub-world's three connection
// lists, pruned to what feeds a spawn record, and the page runs it
// (src/lib/battlefront/spawnLogic.js). bf2-re findings/55 is the worked
// example (Hoth: eight walker steps in stage 1, the gates and the hangar
// points in stage 2, the fuel charges in stage 3).
//
//   spawnLogic(root, dir, sub) → { nodes, inputs, events, enables, trackers, far, unsupported, _source } | null
//   (far: the spawn points the mode prefab links as its far list, the starfighters', which a soldier never takes)
//
// The graph's ids are the map rulebook's own (`<layer>:<object index>`);
// fields and events keep their names where the djb2-xor hash is a known one
// (`In1`, `Out`, `SetTrue`, `A>B` …), else the hash as the export prints it.

import { fieldHash as H } from './bf2017-abilities.mjs';
import { follow, shortName } from './bf2017-ebx.mjs';

const s32 = (h) => h | 0;

// The names the graph's fields and events go by (each the djb2-xor of the name)
const NAMES = ['In', 'Out', 'Value', 'Enabled', 'SetTrue', 'SetFalse', 'Toggle', 'Selected', 'A', 'B', 'Bool', 'Open', 'Close', 'OnTrue', 'OnFalse', 'OnEnter', 'OnLeave', 'Increment', 'Decrement', 'Reset', 'A=B', 'A!=B', 'A<B', 'A<=B', 'A>B', 'A>=B'];
for (let n = 1; n <= 8; n++) NAMES.push(`In${n}`);
for (let n = 0; n < 32; n++) NAMES.push(String(n));
const BY_HASH = new Map(NAMES.map((n) => [H(n), n]));
// The event splitter's and the change listener's ports, whose names the hashes do not give back
const SPLIT_IN = 1723395486;
const SPLIT_OUT = -137490305;
const LISTEN_IN = 1658462601;
const LISTEN_OUT = 526315281;

// The record types the page runs, by their short name in the graph
const KINDS = {
  AndEntityData: 'and',
  OrEntityData: 'or',
  NotEntityData: 'not',
  BoolEntityData: 'bool',
  SyncedBoolEntityData: 'bool',
  EventSplitterEntityData: 'splitter',
  EventSyncEntityData: 'splitter',
  DelayEntityData: 'delay',
  SelectEventEntityData: 'select',
  PropertyChangeListenerEntityData: 'listener',
  GeometryTriggerEntityData: 'trigger',
  EventGateEntityData: 'gate',
  CompareIntEntityData: 'compareInt',
  CompareBoolEntityData: 'compareBool',
  IntEntityData: 'int',
  SpatialPrefabReferenceObjectData: 'prefab',
  LogicPrefabReferenceObjectData: 'prefab',
};
const SPAWNS = new Set(['AlternateSpawnEntityData', 'SpawnLocationFinderShapeData']);
// QA's and the console's: tests and debug commands, never a round's
const IGNORED = /Automation|ConsoleCommandTrigger|WSTestCase|PrintDebugText/i;

// The prefab outputs the page knows the meaning of (the prefab, its port, what it is):
// Galactic Assault's stage ports are `base ^ (ord('1') ^ ord(<stage digit>))`, a
// team's three to five in a run (finding 55); the rest were read inside each prefab.
export const GA_PREFAB = 'PF_GameMode_Conquest_Staged';
const PORT_BASE = { 1: 985615985, 2: 985719506 };
export const stagePort = (team, n) => s32((PORT_BASE[team] >>> 0) ^ (49 ^ (48 + n)));
export const STAGE_CHANGED = -474851384;
// the mode prefab's link port holding the far spawn points: the starfighters' (the deploy screen's
// UseFarSpawnPoints), 900 m out over the ground; never a soldier's (Hoth: FantasyBattle_Logic:17, :68, :293, :327)
export const FAR_SPAWNS = -1877245525;
const ROLES = [
  // the escort tracker's lead: the furthest walker's count of waypoint triggers passed (PF_EscortTracker's SelectInt)
  { prefab: /^PF_EscortTracker$/, field: -827789024, role: 'lead' },
  // a capture point's owner is Team2 (PF_CapturePoint's Math: TeamIdToInt(owner) == 2)
  { prefab: /^PF_CapturePoint$/, field: 1132020774, role: 'ownedByTeam2' },
  // an interact objective's charge is spent (PF_Interact_PlanetaryBattle_Core's IsDestroyed)
  { prefab: /^PF_Interact_PlanetaryBattle_/, field: H('IsDestroyed'), role: 'destroyed' },
  // a gate's door was opened at its panel (PF_InteractDoor_Core: the interact button's stopwatch, 1 s within 2 m)
  { prefab: /^PF_InteractGate_/, event: -1157191321, role: 'opened' },
];

const fieldName = (id) => BY_HASH.get(s32(id)) ?? String(s32(id));

// the sub-world's graph: its objects by guid (each connection names its object's layer and guid),
// and its property inputs, event inputs and links by object id; null when it is no sub-world
export function graphOf(root, dir, sub) {
  const subName = `${dir}${sub}`;
  const asset = follow(root, subName);
  const top = asset?.objects?.[0];
  if (!top || top.$type !== 'SubWorldData') return null;
  const byGuid = new Map();
  const assets = new Map();
  const layers = new Set();
  const conns = { prop: top.PropertyConnections ?? [], event: top.EventConnections ?? [], link: top.LinkConnections ?? [] };
  for (const c of [...conns.prop, ...conns.event, ...conns.link]) for (const end of [c.Source, c.Target]) if (end?.$asset) layers.add(end.$asset);
  for (const name of layers) {
    const a = follow(root, name);
    if (!a) continue;
    assets.set(shortName(a.name), a);
    a.objects.forEach((o, i) => {
      if (o?.$guid) byGuid.set(o.$guid, { id: `${shortName(a.name)}:${i}`, layer: shortName(a.name), o });
    });
  }
  const at = (end) => byGuid.get(end?.$class) ?? null;
  const pin = new Map(); // target id → [{ field, src, srcField }]
  const evin = new Map(); // target id → [{ event, src, srcEvent }]
  for (const c of conns.prop) {
    const s = at(c.Source);
    const t = at(c.Target);
    if (!s || !t) continue;
    if (!pin.has(t.id)) pin.set(t.id, []);
    pin.get(t.id).push({ field: c.TargetFieldId, src: s, srcField: c.SourceFieldId });
  }
  for (const c of conns.event) {
    const s = at(c.Source);
    const t = at(c.Target);
    if (!s || !t) continue;
    if (!evin.has(t.id)) evin.set(t.id, []);
    evin.get(t.id).push({ event: c.TargetEvent.Id, src: s, srcEvent: c.SourceEvent.Id });
  }
  const links = new Map(); // source id → [{ t: the target, field: the target's field, from: the source's }]
  for (const c of conns.link) {
    const s = at(c.Source);
    const t = at(c.Target);
    if (s && t) links.set(s.id, [...(links.get(s.id) ?? []), { t, field: c.TargetFieldId, from: c.SourceFieldId }]);
  }
  return { subName, byGuid, assets, pin, evin, links };
}

export function spawnLogic(root, dir, sub) {
  const graph = graphOf(root, dir, sub);
  if (!graph) return null;
  const { subName, byGuid, assets, pin, evin, links } = graph;

  // the spawn records of the mode's layers that something switches
  const prefix = `${sub}_`.toLowerCase();
  const records = [...byGuid.values()].filter((e) => SPAWNS.has(e.o.$type) && e.layer.toLowerCase().startsWith(prefix) && !IGNORED.test(e.layer));
  const enables = {};
  const want = [];
  for (const r of records) {
    const into = (pin.get(r.id) ?? []).find((p) => s32(p.field) === H('Enabled'));
    if (!into) continue;
    enables[r.id] = `${into.src.id}.${fieldName(into.srcField)}`;
    want.push(into.src);
  }
  if (!want.length) return null;

  // back from the records over property and event inputs, stopping at prefabs
  const nodes = {};
  const inputs = {};
  const events = {};
  const unsupported = new Set();
  const seen = new Set();
  const roleOf = (e, { field, event }) => {
    const name = shortName(e.o.Blueprint?.$asset ?? '');
    if (name === GA_PREFAB) {
      if (field != null) for (const t of [1, 2]) for (let n = 1; n <= 9; n++) if (s32(field) === stagePort(t, n)) return { role: 'stage', team: t, stage: n };
      if (event != null && s32(event) === STAGE_CHANGED) return { role: 'stageChanged' };
    }
    const r = ROLES.find((x) => x.prefab.test(name) && (field != null ? s32(x.field ?? NaN) === s32(field) : s32(x.event ?? NaN) === s32(event)));
    return r ? { role: r.role } : null;
  };
  const stack = [...want];
  while (stack.length) {
    const e = stack.pop();
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const kind = KINDS[e.o.$type];
    if (IGNORED.test(e.layer) || IGNORED.test(e.o.$type) || IGNORED.test(e.o.Blueprint?.$asset ?? '')) {
      nodes[e.id] = { type: 'ignored', record: e.o.$type };
      continue;
    }
    if (!kind) {
      unsupported.add(e.o.$type);
      nodes[e.id] = { type: 'unsupported', record: e.o.$type };
      continue;
    }
    if (kind === 'prefab') {
      nodes[e.id] ??= nodeOf(kind, e, links);
      continue;
    }
    nodes[e.id] = nodeOf(kind, e, links);
    for (const p of pin.get(e.id) ?? []) {
      const name = kind === 'listener' && s32(p.field) === LISTEN_IN ? 'In' : fieldName(p.field);
      (inputs[e.id] ??= {})[name] = `${p.src.id}.${outName(p.src, p.srcField)}`;
      if (KINDS[p.src.o.$type] === 'prefab') noteRole(nodes, p.src, roleOf(p.src, { field: p.srcField }), { field: outName(p.src, p.srcField) });
      stack.push(p.src);
    }
    for (const v of evin.get(e.id) ?? []) {
      const from = `${v.src.id}.${outEvent(v.src, v.srcEvent)}`;
      const to = `${e.id}.${inEvent(kind, v.event)}`;
      if (!(events[from] ??= []).includes(to)) events[from].push(to);
      if (KINDS[v.src.o.$type] === 'prefab') noteRole(nodes, v.src, roleOf(v.src, { event: v.srcEvent }), { event: outEvent(v.src, v.srcEvent) });
      stack.push(v.src);
    }
  }
  // the escort trackers' walkers: which waypoint triggers count for which walker
  const trackers = {};
  for (const [id, n] of Object.entries(nodes)) if (n.type === 'prefab' && n.name === 'PF_EscortTracker') trackers[id] = escortTracker(assets, evin, links, id);
  // (the far spawn points: what the mode prefab links into its far list)
  const far = [];
  for (const e of byGuid.values()) {
    if (shortName(e.o.Blueprint?.$asset ?? '') !== GA_PREFAB || !e.layer.toLowerCase().startsWith(prefix)) continue;
    for (const l of links.get(e.id) ?? []) if (s32(l.from) === FAR_SPAWNS && !far.includes(l.t.id)) far.push(l.t.id);
  }
  far.sort();
  return { nodes, inputs, events, enables, trackers, far, unsupported: [...unsupported].sort(), _source: `${subName}#PropertyConnections+EventConnections+LinkConnections (back from each spawn record's Enabled)` };
}

// a node's own settings, as the page runs it
function nodeOf(kind, e, links) {
  const o = e.o;
  switch (kind) {
    case 'and':
    case 'or':
      return { type: kind, n: Number(o.InputCount ?? 2) };
    case 'not':
      return { type: kind, value: Boolean(o.In) };
    case 'bool':
      return { type: kind, value: Boolean(o.DefaultValue) };
    case 'splitter':
      return { type: kind, once: Boolean(o.RunOnce) };
    case 'delay':
      return { type: kind, seconds: Number(o.Delay ?? 0), once: Boolean(o.RunOnce), dedupe: Boolean(o.RemoveDuplicateEvents) };
    case 'select':
      return { type: kind, value: Number(o.Selected ?? 0) };
    case 'listener':
      return { type: kind };
    case 'trigger':
      return { type: kind, shapes: (links.get(e.id) ?? []).map((l) => l.t.id), allies: Number(String(o.TeamOfAllies ?? '').replace(/^Team/, '')) || 0, include: String(o.Include ?? ''), once: Boolean(o.RunOnce), enabled: o.Enabled !== false };
    case 'gate':
      return { type: kind, open: o.Default !== false };
    case 'compareInt':
      return { type: kind, a: Number(o.A ?? 0), b: Number(o.B ?? 0), onChange: Boolean(o.TriggerOnPropertyChange) };
    case 'compareBool':
      return { type: kind, value: Boolean(o.Bool), onChange: Boolean(o.TriggerOnPropertyChange) };
    case 'int':
      return { type: kind, value: Number(o.DefaultValue ?? 0), step: Number(o.IncDecValue ?? 1) };
    case 'prefab':
      return { type: kind, name: shortName(o.Blueprint?.$asset ?? ''), roles: {} };
    default:
      return { type: kind };
  }
}

// a prefab's port the graph reads, with what the page knows it to mean
function noteRole(nodes, e, role, { field, event }) {
  const n = nodes[e.id] ?? (nodes[e.id] = nodeOf('prefab', e, new Map()));
  const key = field ?? event;
  if (!(key in n.roles)) n.roles[key] = role ?? null;
}

// a source's output field or event by name: a splitter's out is `Out`, a listener's `Changed`
const outName = (src, id) => fieldName(id);
function outEvent(src, id) {
  const kind = KINDS[src.o.$type];
  if (kind === 'splitter' && s32(id) === SPLIT_OUT) return 'Out';
  if (kind === 'listener' && s32(id) === LISTEN_OUT) return 'Changed';
  return fieldName(id);
}
function inEvent(kind, id) {
  if (kind === 'splitter' && s32(id) === SPLIT_IN) return 'In';
  return fieldName(id);
}

// PF_EscortTracker's inputs: each walker's waypoint triggers (WaypointTriggerEntityData,
// linked to its path's waypoint by the VehicleWaypointData's SchematicsNameHash) and
// each walker's spawner's OnDestroyed. Its two input events are walker 0's and walker 1's.
const TRACK_REACHED = [-1834234587, -1834234586];
const TRACK_LOST = [-682359818, -682359819];
function escortTracker(assets, evin, links, id) {
  const walkers = [0, 1].map(() => ({ path: null, at: [], spawner: null }));
  for (const v of evin.get(id) ?? []) {
    const k = TRACK_REACHED.indexOf(s32(v.event));
    const lost = TRACK_LOST.indexOf(s32(v.event));
    if (lost >= 0) walkers[lost].spawner = v.src.id;
    if (k < 0 || v.src.o.$type !== 'WaypointTriggerEntityData') continue;
    for (const { t: path, field } of links.get(v.src.id) ?? []) {
      if (path.o.$type !== 'AIWaypointsShapeData') continue;
      // the waypoint the trigger names: the one whose SchematicsNameHash its link carries
      const objects = assets.get(path.layer)?.objects ?? [];
      const idx = (path.o.Waypoints ?? []).findIndex((r) => r && s32(objects[r.$ref]?.SchematicsNameHash ?? NaN) === s32(field));
      walkers[k].path = path.id;
      if (idx >= 0 && !walkers[k].at.includes(idx)) walkers[k].at.push(idx);
    }
  }
  for (const w of walkers) w.at.sort((a, b) => a - b);
  return { walkers, _source: 'the WaypointTriggerEntityData linked into each walker’s path (its waypoint by SchematicsNameHash) and wired into the tracker’s two Reached inputs' };
}
