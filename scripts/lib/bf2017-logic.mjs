// The game's logic graphs as nodes and edges (the gap design's lane logic).
// A Frostbite blueprint (a LogicPrefabBlueprint, a SpatialPrefabBlueprint, a
// level's SubWorldData …) is a graph: its entities (`Objects`), and three
// lists of wires between them on its root: `EventConnections` (an event out
// of one entity into another's input), `PropertyConnections` (a value) and
// `LinkConnections` (an entity handed to another). A wire names its two ends
// by hash only: `SourceEvent.Id`/`TargetEvent.Id`, `SourceFieldId`/
// `TargetFieldId`, and so does the prefab's own interface
// (`InterfaceDescriptorData`: its fields, input and output events and links).
//
// The hash is djb2-xor (`h = ((h << 5) + h) ^ c` from 5381, 32-bit) of the
// name AS WRITTEN: case kept. Tested on the whole export against the Frosty
// SDK's identifiers: as written, 2,441 distinct hashes and 543,127 of the
// 1,339,321 wire ends named; lower-cased (as the shader depots hash), 257 and
// 3,352, all of them names that are lower case already. So `In` is 00597302,
// `Out` 0b87df4b, `Value` 0d6ef36e (the abilities' `fieldHash` and the map
// reader's `djb` are this hash). A wire to an entity in another asset (a
// level's sub-world wiring its layers) names it `{ $asset, $class }`, the
// class being the entity's `$guid` in that asset.
//
// Pure: documents in, JSON out. scripts/bf2017-logic.mjs reads the export.
//
//   djb2(name)                    → the hash (uint32) of a name as written
//   hex(h)                        → '0x' + 8 hex digits
//   unhashTail(h, tail)           → the hash of the name before `tail` (djb2-xor runs backwards: 33 is odd)
//   CORE_NAMES                    the entities' common ports, preferred where two names share a hash
//   identifiers(doc)              → Set of the identifiers a document spells out (keys, string values, path pieces)
//   nameTable(tiers, wanted?)     → Map(hash → name): tiers in preference order, a name with lower case preferred within one
//   suffixNames(hashes, table)    → Map(hash → name) for `<known name><digits or a letter>` families (In1, In2 …)
//   graphOf(doc, { names, load }) → { asset, type, interface, nodes, edges, named, unnamed }
//   isLogic(doc)                  → true when a document holds wires or an interface

const enc = new TextEncoder();

export function djb2(name) {
  let h = 5381;
  for (const c of enc.encode(String(name))) h = (Math.imul(h, 33) ^ c) >>> 0;
  return h >>> 0;
}

export const hex = (h) => `0x${(Number(h) >>> 0).toString(16).padStart(8, '0')}`;

// 33's inverse mod 2^32 (Newton: x ← x(2 − 33x))
const INV33 = (() => {
  let x = 33;
  for (let i = 0; i < 5; i++) x = Math.imul(x, (2 - Math.imul(33, x)) >>> 0) >>> 0;
  return x >>> 0;
})();

export function unhashTail(h, tail) {
  let x = h >>> 0;
  const bytes = enc.encode(String(tail));
  for (let i = bytes.length - 1; i >= 0; i--) x = Math.imul((x ^ bytes[i]) >>> 0, INV33) >>> 0;
  return x;
}

// The schematics' common ports (entities' events and fields), first in line
// where a shorter, rarer name shares the hash (`In` and `NI` do)
export const CORE_NAMES = [
  'In', 'Out', 'Value', 'Enable', 'Disable', 'Enabled', 'Start', 'Stop', 'Reset', 'Trigger', 'Input', 'Output',
  'OnTrue', 'OnFalse', 'True', 'False', 'Open', 'Close', 'Activate', 'Deactivate', 'Show', 'Hide', 'Set', 'Get',
  'Increment', 'Decrement', 'Finished', 'OnFinished', 'OnStarted', 'Condition', 'Visible', 'Team', 'TeamId',
  'Player', 'Soldier', 'Vehicle', 'Transform', 'Impulse', 'Client', 'Server', 'Play', 'Pause', 'Resume', 'Delay',
  'A', 'B', 'Bool', 'Int', 'Float', 'String', 'Vec3', 'Index', 'Count', 'Time', 'Duration', 'Timer', 'Health',
  'OnDestroyed', 'OnDamaged', 'OnSpawned', 'OnKilled', 'OnEnter', 'OnExit', 'OnEntered', 'OnExited',
  'ValueIfTrue', 'ValueIfFalse', 'DefaultValue', 'InputSelect', 'EntityLink', 'Self', 'Owner', 'Target',
];

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

// every identifier a document spells out: its keys, its string values that are one
// word, an asset path's pieces (`Gameplay/GameModes/PF_X` → Gameplay, GameModes, PF_X, X)
export function identifiers(doc, out = new Set()) {
  const word = (s) => {
    if (typeof s !== 'string' || !s || s.startsWith('0x')) return;
    if (IDENT.test(s)) {
      out.add(s);
      for (const piece of s.split('_')) if (piece && IDENT.test(piece)) out.add(piece);
      return;
    }
    if (s.includes('/') && s.length < 200) for (const seg of s.split('/')) if (IDENT.test(seg)) word(seg);
  };
  const walk = (v) => {
    if (Array.isArray(v)) for (const x of v) walk(x);
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        word(k);
        walk(x);
      }
    } else word(v);
  };
  walk(doc);
  return out;
}

// tiers: [[names…], …] in preference order. Within one tier a name with lower
// case beats one without (`In` over `NI`), then the shorter. `wanted`, when
// given, keeps only those hashes.
export function nameTable(tiers, wanted = null) {
  const table = new Map();
  const rank = new Map();
  tiers.forEach((tier, t) => {
    for (const n of tier) {
      if (typeof n !== 'string' || !n) continue;
      const h = djb2(n);
      if (wanted && !wanted.has(h)) continue;
      const r = [t, /[a-z]/.test(n) ? 0 : 1, n.length];
      const old = rank.get(h);
      if (!old || r[0] < old[0] || (r[0] === old[0] && (r[1] < old[1] || (r[1] === old[1] && r[2] < old[2])))) {
        table.set(h, n);
        rank.set(h, r);
      }
    }
  });
  return table;
}

const TAILS = [
  ...Array.from({ length: 100 }, (_, i) => String(i)),
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...Array.from({ length: 9 }, (_, i) => `_${i + 1}`),
  ...Array.from({ length: 26 }, (_, i) => `_${String.fromCharCode(65 + i)}`),
];

// A family of ports named <name><n> (In1 … In16, Stage1 … Stage3): an
// unnamed hash whose name less a tail of digits or a letter is a known name.
// Kept only where at least two hashes of the family name the same stem, or
// the stem is one of `strong` (the core and the export's own words), so a
// lone chance hit (2^32 is not so large against a million tries) is not taken.
export function suffixNames(hashes, table, strong = null) {
  const found = new Map();
  const stems = new Map();
  for (const h of hashes) {
    if (table.has(h)) continue;
    for (const tail of TAILS) {
      const stem = table.get(unhashTail(h, tail));
      if (!stem) continue;
      found.set(h, `${stem}${tail}`);
      stems.set(stem, (stems.get(stem) ?? 0) + 1);
      break;
    }
  }
  for (const [h, n] of found) {
    const stem = n.replace(/_?(?:\d+|[A-Z])$/, '');
    if ((stems.get(stem) ?? 0) < 2 && !(strong && strong.has(stem))) found.delete(h);
  }
  return found;
}

// The game-mode words the designers' own port names are made of (their names
// are in no record: `OnStartPhase2`, `MaxReinforcements`, `Phase1Bonus`).
export const VOCAB = (
  'Stage Phase Team Teams Attacker Attackers Attacking Defender Defenders Defending Active Enabled Enable Disable Disabled ' +
  'Objective Objectives Spawn Spawns Spawned Spawning Area Areas Is Has Time Timer Timers Ticket Tickets Reinforcement ' +
  'Reinforcements Escort Escorted Capture Captured Capturing Point Points Bomb Bombs Armed Arm Disarmed Completed Complete ' +
  'Done Start Started End Ended Win Won Lose Lost Overtime Count Max Min Current Index On Off In Out Set Get Reset Round Game ' +
  'Mode GameMode Conquest Staged Final Last First Next Previous Progress Destroyed Destroy Damage Damaged Health Vehicle ' +
  'Vehicles Walker Walkers Hero Heroes Uplink Uplinks Gate Gates Door Doors Hangar Open Opened Close Closed Lock Locked ' +
  'Unlock Unlocked Text Message Show Hide Visible UI Hud Music Sound VO Intro Outro Cinematic Camera Fail Failed Success ' +
  'Victory Defeat Outcome Winner Winning Losing Event Events Trigger Triggered Value Values Int Float Bool String Total ' +
  'Remaining Left Bonus Extra Add Added Remove Removed Delay Duration Length Seconds Rate Speed Number Num Tick Stop Pause ' +
  'Paused Resume Running Wait Ready Pre Post Begin Finish Finished Init Player Players Bot Bots AI Spectator Local Server ' +
  'Client Synced Score Kill Kills Death Deaths Reward Battle Planetary FantasyBattle Escape Fuel Depot Base Zone Zones ' +
  'Volume Sector Location Position Target Targets Owner Neutral Empire Rebel Rebels Republic Separatist Separatists Light ' +
  'Dark Side Team1 Team2 Primary Secondary Optional Bleed Drain Of To For And Or Not The At By With From Changed Change ' +
  'Update Updated Name Id Type Should Can Use Allow Allowed Block Blocked Force Forced Auto Default Override OnStart OnEnd ' +
  'OnStop OnComplete OnCompleted OnFinished OnChanged IsActive Stage1 Stage2 Stage3 Stage4 Stage5 Phase1 Phase2 Phase3 ' +
  'Phase4 Phase5 Attack Defend Hold Push Advance Retreat Fallback Front Line Frontline Ship Ships Transport Shield Shields ' +
  'Generator Generators Turret Turrets Cannon Ion Interact Interacted Carry Carrier Pickup Drop Dropped Plant Planted Defuse ' +
  'Defused Explode Exploded Explosion Countdown Clock Elapsed Expired Expire Limit Limits Threshold Percent Ratio Multiplier'
).split(' ');

const COMPOSE_TAILS = [
  ...Array.from({ length: 10 }, (_, i) => String(i)),
  ...Array.from({ length: 10 }, (_, i) => `_${i}`),
  'Team1', 'Team2', '_Team1', '_Team2',
];

// The designers' names: one or two VOCAB words, alone or as a family's stem
// (`<words><digit>`, `_<digit>`, `Team1`, `Team2`; a family is two hashes or
// more under different tails). Two words keep the chance of a false name low:
// 2^32 against the words' 85 thousand pairs and the hashes left (a three-word
// name is not tried: it makes several a run).
export function composeNames(hashes, table, vocab = VOCAB) {
  const words = [...new Set(vocab)];
  const left = [...hashes].filter((h) => !table.has(h));
  const plain = new Set(left);
  const stems = new Map();
  for (const h of left) {
    for (const t of COMPOSE_TAILS) {
      const s = unhashTail(h, t);
      if (!stems.has(s)) stems.set(s, []);
      stems.get(s).push([h, t]);
    }
  }
  for (const [s, v] of stems) if (new Set(v.map((x) => x[1])).size < 2) stems.delete(s);
  const found = new Map();
  const step = (h, w) => {
    for (const c of enc.encode(w)) h = (Math.imul(h, 33) ^ c) >>> 0;
    return h >>> 0;
  };
  const take = (h, name) => {
    if (plain.has(h) && !found.has(h)) found.set(h, name);
    const fam = stems.get(h);
    if (fam) for (const [m, t] of fam) if (!found.has(m)) found.set(m, `${name}${t}`);
  };
  for (const a of words) {
    const ha = step(5381, a);
    take(ha, a);
    for (const b of words) take(step(ha, b), a + b);
  }
  return found;
}

export const isLogic = (doc) =>
  (doc?.objects ?? []).some(
    (o) => o && (o.EventConnections?.length || o.PropertyConnections?.length || o.LinkConnections?.length || o.$type === 'InterfaceDescriptorData'),
  );

// the parts of an entity's record kept on its node
const SKIP = new Set(['$type', '$guid', 'Flags', 'RenderingOverrides', 'LocalPlayerId', 'StreamRealm', 'SubRealm', 'PersistenceSetting', 'EventConnections', 'PropertyConnections', 'LinkConnections', 'Objects', 'Schematics', 'Interface', 'ObjectVariation']);
const HASHED = /(?:Hash|Hashes|HashedInput)$/;
const r3 = (x) => Math.round(x * 1000) / 1000;

function propValue(v, depth, nameOf) {
  if (v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.length > 64 ? { count: v.length } : v.map((x) => propValue(x, depth + 1, nameOf));
  if ('$asset' in v) return v.$asset;
  if ('$ref' in v) return `#${v.$ref}`;
  if (v.trans && v.right) return [r3(v.trans.x), r3(v.trans.y), r3(v.trans.z)];
  if ('x' in v && 'y' in v && 'z' in v && Object.keys(v).length <= 4) return Object.values(v).map((x) => (typeof x === 'number' ? r3(x) : x));
  if (depth > 3) return '…';
  return propsOf(v, depth + 1, nameOf);
}

function propsOf(o, depth, nameOf) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (SKIP.has(k) || v == null || v === '') continue;
    if (HASHED.test(k) && (typeof v === 'number' || (Array.isArray(v) && v.every((x) => typeof x === 'number')))) {
      out[k] = Array.isArray(v) ? v.map(nameOf) : nameOf(v);
      continue;
    }
    // a wire's hash inside a record (an IntToEvent's EventHash, a Watergate input's Hash)
    out[k] = propValue(v, depth, nameOf);
  }
  if (o.Code === 'MathOpCode_InputI' || o.Code === 'MathOpCode_InputF' || o.Code === 'MathOpCode_InputB') out.Param1 = nameOf(o.Param1);
  return out;
}

const shortAsset = (name) => String(name).split('/').pop();

// One graph: nodes { id, type, props, asset? } and edges { kind, source,
// sourceField, target, targetField, realm? , flags? }. A node in another
// asset is `<that asset's last path piece>:<index>` (NOTES.md's
// `FantasyBattle_Logic:123`), with `asset` its full name; `load(name)` gives
// that asset's document (null leaves the node as `<piece>#<guid>`).
export function graphOf(doc, { names = new Map(), load = () => null } = {}) {
  const objects = doc.objects ?? [];
  const root = objects[doc.root ?? 0] ?? {};
  let named = 0;
  let unnamed = 0;
  const nameOf = (h) => {
    const n = names.get(Number(h) >>> 0);
    return n ?? hex(h);
  };
  const port = (h) => {
    if (h == null) return null;
    const n = names.get(Number(h) >>> 0);
    if (n) named++;
    else unnamed++;
    return n ?? hex(h);
  };

  const nodes = new Map();
  const guidIndex = new Map(); // asset (lower) → Map(guid → index)
  const foreign = (asset) => {
    const key = asset.toLowerCase();
    if (!guidIndex.has(key)) {
      const d = load(asset);
      const m = new Map();
      (d?.objects ?? []).forEach((o, i) => o?.$guid && m.set(o.$guid.toLowerCase(), i));
      guidIndex.set(key, { doc: d, m });
    }
    return guidIndex.get(key);
  };
  const addLocal = (i) => {
    const id = String(i);
    if (!nodes.has(id) && objects[i]) nodes.set(id, { id, type: objects[i].$type, props: propsOf(objects[i], 0, nameOf) });
    return id;
  };
  const nodeOf = (ref) => {
    if (!ref) return null;
    if ('$ref' in ref) return addLocal(ref.$ref);
    if (ref.$asset && ref.$asset.toLowerCase() === String(doc.name).toLowerCase()) {
      const i = objects.findIndex((o) => o?.$guid?.toLowerCase() === String(ref.$class).toLowerCase());
      if (i >= 0) return addLocal(i);
    }
    if (ref.$asset) {
      const { doc: d, m } = foreign(ref.$asset);
      const i = m.get(String(ref.$class).toLowerCase());
      const id = i == null ? `${shortAsset(ref.$asset)}#${ref.$class}` : `${shortAsset(ref.$asset)}:${i}`;
      if (!nodes.has(id)) {
        const o = i == null ? null : d.objects[i];
        nodes.set(id, { id, type: o?.$type ?? ref.$assetType ?? null, asset: ref.$asset, props: o ? propsOf(o, 0, nameOf) : {} });
      }
      return id;
    }
    return null;
  };

  // the blueprint's own entities, whether wired or not
  for (const r of root.Objects ?? []) if (r && '$ref' in r) addLocal(r.$ref);

  const edges = [];
  objects.forEach((o) => {
    if (!o) return;
    for (const c of o.EventConnections ?? []) {
      edges.push({ kind: 'event', source: nodeOf(c.Source), sourceField: port(c.SourceEvent?.Id), target: nodeOf(c.Target), targetField: port(c.TargetEvent?.Id), realm: String(c.TargetType ?? '').replace(/^EventConnectionTargetType_/, '') || undefined });
    }
    for (const c of o.PropertyConnections ?? []) {
      edges.push({ kind: 'property', source: nodeOf(c.Source), sourceField: port(c.SourceFieldId), target: nodeOf(c.Target), targetField: port(c.TargetFieldId), flags: c.Flags });
    }
    for (const c of o.LinkConnections ?? []) {
      edges.push({ kind: 'link', source: nodeOf(c.Source), sourceField: c.SourceFieldId ? port(c.SourceFieldId) : null, target: nodeOf(c.Target), targetField: c.TargetFieldId ? port(c.TargetFieldId) : null });
    }
  });

  let iface = null;
  const ifIndex = root.Interface?.$ref ?? objects.findIndex((o) => o?.$type === 'InterfaceDescriptorData');
  const io = ifIndex >= 0 ? objects[ifIndex] : null;
  if (io) {
    const list = (k) => (io[k] ?? []).map((e) => port(e.Id));
    iface = {
      node: String(ifIndex),
      fields: (io.Fields ?? []).map((f) => ({ name: port(f.Id), access: String(f.AccessType ?? '').replace(/^FieldAccessType_/, ''), ...(f.Value ? { value: f.Value } : {}), ...(f.ValueRef ? { valueRef: propValue(f.ValueRef, 0, nameOf) } : {}) })),
      inEvents: list('InputEvents'),
      outEvents: list('OutputEvents'),
      inLinks: list('InputLinks'),
      outLinks: list('OutputLinks'),
    };
    addLocal(ifIndex);
  }

  return { asset: doc.name, type: doc.type ?? root.$type, interface: iface, nodes: [...nodes.values()], edges, named, unnamed };
}

// every hash a document's wires and interface name (for the dictionary pass)
export function hashesOf(doc, out = new Set()) {
  for (const o of doc.objects ?? []) {
    if (!o) continue;
    for (const c of o.EventConnections ?? []) out.add(c.SourceEvent?.Id >>> 0).add(c.TargetEvent?.Id >>> 0);
    for (const c of o.PropertyConnections ?? []) out.add(c.SourceFieldId >>> 0).add(c.TargetFieldId >>> 0);
    for (const c of o.LinkConnections ?? []) out.add(c.SourceFieldId >>> 0).add(c.TargetFieldId >>> 0);
    if (o.$type === 'InterfaceDescriptorData') for (const k of ['Fields', 'InputEvents', 'OutputEvents', 'InputLinks', 'OutputLinks']) for (const f of o[k] ?? []) out.add(f.Id >>> 0);
  }
  out.delete(0);
  return out;
}
