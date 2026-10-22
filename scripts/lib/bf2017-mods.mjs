// A Frosty mod's records, read as the game's are (scripts/lib/bf2017-ebx.mjs):
// the extraction under `bf2-re/data/mods/<mod>/` holds `mod.json` (its
// title, author, version and link), `resources.tsv` (every resource it
// carries) and `ebx/`, one JSON record a file, named by its path where the
// mod replaces a record of the game's and by its GUID where it adds one of
// its own. Nothing of the mod's binaries is read or kept: the rows below are
// numbers, each with the record and field it came from (`_source`,
// `<record>#<object>.<field>`).
//
// A mod's logic is a graph (a LogicPrefabBlueprint): its objects, its
// property connections (a value from one object's field into another's), its
// event connections (one object's output firing another's input) and an
// interface whose fields hold the prefab's constants (`"Float32 0.125"`).
// Fields and events are named by the engine's hash of their name (djb2 with
// xor, kept as a signed 32-bit number: `hashOf('Selected')`), so a reader
// asks for a field by its name hashed. What is read here:
//
//   steps      a SelectEvent whose events are a five-step option's
//              (VeryEasy … VeryHard), its Selected fed by an option's channel,
//              each event firing AutoPlayer settings: the step table of every
//              setting it sets, null where a step fires none
//   spread     SelectFloats feeding an AutoPlayer setting a team, their inputs
//              Float constants picked by an evenly weighted random event,
//              repeated by a delay that fires itself: the scales and period
//   settings   each AutoPlayer setting a graph sets and the constant it is
//              given (an interface field, a Float, a ConditionalFloat)
//   options    the profile options a hub reads, followed down its property
//              connections to the channel property each feeds
//   kits       a soldier kit's faction, class, body and AI body
//   container  the server settings a mod renames or changes against the
//              game's (gameSettings.json)
// Pure: assets in, rows out (the file system is the caller's).
//
//   hashOf(name) → id      graphOf(asset) → graph      fieldValue(text) → number | boolean | string | null
//   valueInto(graph, i) → { value, _source } | null
//   stepTables(graph, name, channels) → [{ option, steps, settings: { [name]: { values, _source } }, _source }]
//   spreadOf(graph, name) → { settings, scales, every, lag, uniform, _source } | null
//   settingRows(graph, name) → [{ setting, value, _source }]
//   optionChannels(graph, optionNames) → Map(channel id → option)
//   kitRow(asset, name) → { kit, side, era, class, gameplay, body, aiBody, _source }
//   containerDiff(asset, name, vanilla) → { renamed, changed, added }
//   sequelMod(name) → bool

import { isSequel } from './bf2017-ebx.mjs';
import { sequelSetting, valueOf } from './bf2017-rulebook-settings.mjs';

// The engine's name hash: djb2 with xor, the export's ids being its signed 32-bit form.
export function hashOf(name) {
  let h = 5381;
  for (const c of name) h = (Math.imul(h, 33) ^ c.charCodeAt(0)) >>> 0;
  return h | 0;
}

// The five steps an option of the mod's offers, in its own words (its SelectEvents' event names).
export const STEP_EVENTS = ['VeryEasy', 'Easy', 'Medium', 'Hard', 'VeryHard'];

// The sequel era in a mod's own short names, beside isSequel's folder names and the settings' own: the
// mod files the new trilogy's kits under `nt/`, names the First Order's Star Destroyer `fosd`, Takodana
// `tako`, Starkiller Base `skb` and the Raddus `mc85`, and its options run words together (`IAIMaxBB8`).
const SEQUEL_MOD = /(^|[/_\-.])(nt|fosd|tako|skb|mc85|crait|newera)([/_\-.]|$)/i;
const SEQUEL_WORDS = new Set(['fo', 'res', 'rey', 'finn', 'phasma', 'kylo', 'bb8', 'bb9e', 'jakku', 'takodana', 'starkiller', 'crait', 'newera']);
const words = (name) => String(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/);
export const sequelMod = (name) => isSequel(name) || sequelSetting(name) || SEQUEL_MOD.test(name) || words(name).some((w) => SEQUEL_WORDS.has(w));

// An interface field's text as its value: "Float32 0.125", "Int32 27", "Boolean True"; "" is unset
export function fieldValue(text) {
  const m = /^(\w+)\s+(.*)$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const [, type, raw] = m;
  if (/^Boolean$/i.test(type)) return /^true$/i.test(raw);
  if (/^(Float|Int|UInt)\d*$/i.test(type)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}

// A logic prefab as a graph: its objects, its interface's index and fields, its connections by index
export function graphOf(asset) {
  const objects = asset.objects;
  const root = objects[asset.root] ?? {};
  const ref = (r) => (r && typeof r.$ref === 'number' ? r.$ref : null);
  const iface = objects.findIndex((o) => o?.$type === 'InterfaceDescriptorData');
  const fields = new Map((objects[iface]?.Fields ?? []).map((f) => [f.Id, f]));
  const props = (root.PropertyConnections ?? []).map((c) => ({ from: ref(c.Source), fromField: c.SourceFieldId, to: ref(c.Target), toField: c.TargetFieldId }));
  const events = (root.EventConnections ?? []).map((c) => ({ from: ref(c.Source), event: c.SourceEvent?.Id, to: ref(c.Target), toEvent: c.TargetEvent?.Id }));
  return { objects, iface, fields, props, events };
}

const typeOf = (g, i) => g.objects[i]?.$type ?? null;
const hex = (id) => `0x${(id >>> 0).toString(16).padStart(8, '0')}`;
const SETTING = 'AutoPlayerSettingsEntityData';

// The constant a value field is given: an interface field's, a Float's, Int's or Bool's own, a
// ConditionalFloat's two; null where it is worked out in the graph
export function valueInto(g, i, name = '') {
  const into = g.props.filter((c) => c.to === i);
  for (const c of into) {
    if (c.from === g.iface) {
      const f = g.fields.get(c.fromField);
      if (f) return { value: fieldValue(f.Value), _source: `${name}#${g.iface}.Fields[${hex(c.fromField)}]` };
    }
    const o = g.objects[c.from];
    if (/^(Float|Int|Bool)EntityData$/.test(o?.$type ?? '')) return { value: o.DefaultValue, _source: `${name}#${c.from}.DefaultValue` };
    if (o?.$type === 'ConditionalFloatEntityData') return { value: { ifTrue: o.ValueIfTrue, ifFalse: o.ValueIfFalse }, _source: `${name}#${c.from}.ValueIfTrue|ValueIfFalse` };
  }
  return null;
}

// The step tables a graph holds: each SelectEvent of the five steps, the option feeding it (by the
// channel property its Selected reads: `channels`, optionChannels's map) and what each step sets
export function stepTables(g, name, channels = new Map()) {
  const out = [];
  g.objects.forEach((o, i) => {
    if (o?.$type !== 'SelectEventEntityData' || (o.Events ?? []).join() !== STEP_EVENTS.join()) return;
    const feed = g.props.find((c) => c.to === i && c.toField === hashOf('Selected'));
    const settings = {};
    STEP_EVENTS.forEach((step, k) => {
      for (const c of g.events.filter((e) => e.from === i && e.event === hashOf(step) && typeOf(g, e.to) === SETTING)) {
        const setting = g.objects[c.to].Choice?.Name;
        const v = valueInto(g, c.to, name);
        settings[setting] ??= { values: STEP_EVENTS.map(() => null), _source: STEP_EVENTS.map(() => null) };
        settings[setting].values[k] = v ? v.value : null;
        settings[setting]._source[k] = v ? v._source : `${name}#${c.to}`;
      }
    });
    if (!Object.keys(settings).length) return;
    out.push({ option: feed ? (channels.get(feed.fromField) ?? hex(feed.fromField)) : null, steps: [...STEP_EVENTS], settings, _source: `${name}#${i}.Events` });
  });
  return out;
}

// The spread: SelectFloats feeding AutoPlayer settings, their inputs the scales in their order, picked
// by a random event (`uniform`: evenly), the pick repeated by a delay that fires itself (`every`) and the
// settings set a delay after (`lag`)
export function spreadOf(g, name) {
  const selects = g.objects.map((o, i) => (o?.$type === 'SelectFloatEntityData' ? i : -1)).filter((i) => i >= 0);
  const fed = selects.map((i) => ({ i, to: g.props.filter((c) => c.from === i && typeOf(g, c.to) === SETTING).map((c) => c.to) })).filter((s) => s.to.length);
  if (!fed.length) return null;
  const first = fed[0].i;
  const scales = (g.objects[first].Inputs ?? []).map((input) => {
    const c = g.props.find((p) => p.to === first && p.toField === hashOf(input));
    const o = c ? g.objects[c.from] : null;
    return o?.$type === 'FloatEntityData' ? { value: o.DefaultValue, _source: `${name}#${c.from}.DefaultValue` } : null;
  });
  // (every select reads the same constants, in the same order: the spread is one table)
  for (const { i } of fed.slice(1)) for (const [k, input] of (g.objects[i].Inputs ?? []).entries()) {
    const c = g.props.find((p) => p.to === i && p.toField === hashOf(input));
    if (!c || g.objects[c.from]?.DefaultValue !== scales[k]?.value) throw new Error(`${name}#${i}: its input ${input} is not the first select's`);
  }
  const random = g.objects.findIndex((o, i) => o?.$type === 'RandomMultiEventEntityData' && g.events.some((e) => e.from === i && e.to === first));
  const loop = g.objects.findIndex((o, i) => o?.$type === 'DelayEntityData' && g.events.some((e) => e.from === i && e.to === i));
  const settingsAt = fed.flatMap((s) => s.to);
  const lag = g.objects.findIndex((o, i) => o?.$type === 'DelayEntityData' && i !== loop && g.events.some((e) => e.from === i && settingsAt.includes(e.to)));
  return {
    settings: settingsAt.map((t) => g.objects[t].Choice?.Name),
    scales: scales.map((s) => s?.value ?? null),
    every: loop >= 0 ? g.objects[loop].Delay : null,
    lag: lag >= 0 ? g.objects[lag].Delay : 0,
    uniform: random >= 0 ? Boolean(g.objects[random].UniformDistribution) : null,
    _source: {
      scales: scales.map((s) => s?._source ?? null),
      every: loop >= 0 ? `${name}#${loop}.Delay` : null,
      lag: lag >= 0 ? `${name}#${lag}.Delay` : null,
      uniform: random >= 0 ? `${name}#${random}.UniformDistribution` : null,
      settings: settingsAt.map((t) => `${name}#${t}.Choice`),
    },
  };
}

// Every AutoPlayer setting a graph sets with a constant, in the graph's order
export function settingRows(g, name) {
  const rows = [];
  g.objects.forEach((o, i) => {
    if (o?.$type !== SETTING) return;
    const v = valueInto(g, i, name);
    if (v) rows.push({ setting: o.Choice?.Name, value: v.value, _source: v._source, at: `${name}#${i}` });
  });
  return rows;
}

// The options a hub reads (GetProfileOption, its option by the record's GUID), each followed down its
// property connections to the channel property it lands on; `optionNames`: GUID → the option's UniqueId
export function optionChannels(g, optionNames) {
  const out = new Map();
  g.objects.forEach((o, i) => {
    if (o?.$type !== 'GetProfileOptionEntityData') return;
    const option = optionNames.get(o.OptionData?.$asset);
    if (!option) return;
    const seen = new Set([i]);
    let frontier = [i];
    for (let depth = 0; depth < 8 && frontier.length; depth++) {
      const next = [];
      for (const k of frontier)
        for (const c of g.props.filter((p) => p.from === k)) {
          if (typeOf(g, c.to) === 'SchematicChannelEntityData') out.set(c.toField, option);
          else if (!seen.has(c.to)) {
            seen.add(c.to);
            next.push(c.to);
          }
        }
      frontier = next;
    }
  });
  return out;
}

// A soldier kit: its faction's side and era, the class its gameplay asset is named for, its body and the
// body it has when the game spawns it as an AI soldier
export function kitRow(asset, name) {
  const k = asset.objects[asset.root];
  if (k?.$type !== 'WSSoldierCustomizationKitAsset') return null;
  const faction = k.WSFaction?.$asset ?? '';
  const f = /Faction_(Light|Dark)_(\w+)$/.exec(faction);
  const gameplay = k.Gameplay?.$asset ?? null;
  const cls = gameplay ? (/GP_(Assault|Heavy|Officer|Specialist|Hero)_/i.exec(gameplay.slice(gameplay.lastIndexOf('/') + 1))?.[1] ?? null) : null;
  return {
    kit: k.Name ?? name,
    side: f ? f[1].toLowerCase() : null,
    era: f ? f[2] : null,
    class: cls ? cls.toLowerCase() : null,
    gameplay,
    body: k.Blueprint?.$asset ?? null,
    aiBody: k.AIBlueprint?.$asset ?? null,
    _source: `${name}#${asset.root}.WSFaction|Gameplay|Blueprint|AIBlueprint`,
  };
}

// The server settings a mod's container renames, changes or adds against the game's: a renamed row is one
// whose name is the game's with a word after it, which the game, asking by name, no longer finds
export function containerDiff(asset, name, vanilla) {
  const nodes = [];
  asset.objects.forEach((o, i) => {
    if (o?.$type !== 'GameSettingNode') return;
    const n = String(o.SettingName ?? '').trim();
    const v = valueOf(o.SettingType, o.DefaultValue);
    if (n && v !== null && v !== '' && !/^GS_\w*URL$/.test(n) && !sequelMod(n)) nodes.push({ name: n, value: v, _source: `${name}#${i}.DefaultValue` });
  });
  const mine = new Set(nodes.map((r) => r.name));
  const renamed = [];
  const changed = [];
  const added = [];
  for (const r of nodes) {
    if (r.name in vanilla) {
      if (vanilla[r.name] !== r.value) changed.push({ name: r.name, value: r.value, game: vanilla[r.name], _source: r._source });
      continue;
    }
    const base = r.name.split(' ')[0];
    if (base !== r.name && base in vanilla && !mine.has(base)) renamed.push({ name: base, as: r.name, value: r.value, game: vanilla[base], _source: r._source });
    else added.push({ name: r.name, value: r.value, _source: r._source });
  }
  return { renamed, changed, added };
}
