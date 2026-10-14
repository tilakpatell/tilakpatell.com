// The front end's logic graphs, evaluated for the four states it draws a
// cell or a tile in (the 2026-10-13 live reverse-engineering pass,
// bf2-re findings/53): a widget's parts are recoloured, thickened and shown
// by small entity graphs, not by its tree. The shared one is
// `UI/Frontend/Prefabs/Helpers/Shared/PF_FrontendStates`: its MathEntity
// picks the state, `enabled ? (focused ? 2 : selected ? 1 : 0) : 3`, and each
// of its outputs is a PropertySelect of four palette pickers (In0..In3 by
// state) or a ConditionalFloat on focused-or-selected. A Play tile feeds it
// its navigation zone's `Focused`; the tile's BasicTileWidget is told
// `Selected` by the tile and turns its outline, its top line and its corners
// by it.
//
//   stateTables(root, asset) → Map(object index → { palette?, alpha?, line?,
//     corners? }): each a four-value array by state (normal, selected,
//     focused, disabled) for every element field the graph sets
//   STATES: the four states' names, in that order
//
// The evaluator reads only what these graphs use: interface constants, the
// zone's and the interface's live inputs, PropertyDefaultValue, Or, And, Not,
// ConditionalFloat/Property, FloatInterpolator (its resting value),
// PropertySelect, UIColorPalettePicker, a MathEntity's select program and a
// prefab reference (evaluated inside the prefab). Anything else is unknown
// and the field keeps its tree value.

import { deref, follow, rootOf } from './bf2017-ebx.mjs';

export const STATES = ['normal', 'selected', 'focused', 'disabled'];

// Frostbite's field hashes (djb2-xor of the name, fieldHash in
// bf2017-abilities.mjs) the graphs connect by
const F = {
  Out: '0x0b87df4b',
  In: '0x00597302',
  Ins: ['0x0b87d372', '0x0b87d373', '0x0b87d370', '0x0b87d371'], // In0..In3
  Value: '0x0d6ef36e',
  DefaultIn: '0x62da2189', // a PropertyDefaultValue's input
  Default: '0x7b256865', // its default
  Condition: '0x6b535a76',
  IfTrue: '0x054de877',
  IfFalse: '0xadcd4b5c',
  CondOut: '0xac996e7a',
  SelectedIndex: '0xb8a0aeb2',
  Color: '0x0ca8c5f8',
  Alpha: '0x0c426471',
  LineWidth: '0x3961a2ad',
  Visible: '0x35bc69ab',
  Focused: '0x7545f808',
  Selected: '0x5da1a10c',
  Enabled: '0x0028a000',
  IsSelected: '0x82c5b716', // a list cell's: the open tab
  IsHovered: '0x6526b298', // an input element's: the pointer over it
  IsEnabled: '0x8a82e5da',
  Corners: { TopLeftCornerRoundness: '0x3e5e959b', TopRightCornerRoundness: '0x3bbd0f20', BottomRightCornerRoundness: '0x2ac2bd24', BottomLeftCornerRoundness: '0x8999f41f' },
};
const SELECT_FN = 193418243; // the math program's select(bool, a, b)

const FLAGS = [
  { focused: false, selected: false, enabled: true },
  { focused: false, selected: true, enabled: true },
  { focused: true, selected: false, enabled: true },
  { focused: false, selected: false, enabled: false },
];

const idx = (ref) => (ref && typeof ref.$ref === 'number' ? ref.$ref : -1);
const hex = (n) => `0x${(n >>> 0).toString(16).padStart(8, '0')}`;

// an interface field's constant ("Float32 4", "Boolean True", "Int32 3")
function constantOf(iface, field) {
  const f = (iface?.Fields ?? []).find((x) => x.Name === field || hex(x.Id) === field);
  const v = String(f?.Value ?? '');
  if (/^Boolean /.test(v)) return v.endsWith('True');
  const n = v.match(/^(?:Float32|Int32|Uint32) (-?[\d.e+-]+)$/);
  return n ? Number(n[1]) : undefined;
}

// one asset's graph: what feeds each object's field
function graphOf(asset, live) {
  const r = rootOf(asset);
  const into = new Map();
  for (const c of r.PropertyConnections ?? []) {
    const t = idx(c.Target);
    if (!into.has(t)) into.set(t, new Map());
    // (a field fed twice: the first connection, as the export lists them)
    if (!into.get(t).has(c.TargetField)) into.get(t).set(c.TargetField, { src: idx(c.Source), field: c.SourceField });
  }
  return { a: asset, iface: deref(asset, r.Interface), into, live };
}

// the math program's value: typed register files, select() the one call
function mathOf(o, input) {
  const regs = { B: [], I: [], F: [] };
  const calls = o.Assembly?.FunctionCalls ?? [];
  let out;
  for (const ins of o.Assembly?.Instructions ?? []) {
    const code = String(ins.Code).replace(/^MathOpCode_/, '');
    if (code === 'InputB') regs.B[ins.Result] = Boolean(input(hex(ins.Param1)));
    else if (code === 'InputI') regs.I[ins.Result] = Number(input(hex(ins.Param1)) ?? 0);
    else if (code === 'InputF') regs.F[ins.Result] = Number(input(hex(ins.Param1)) ?? 0);
    else if (code === 'ConstI') regs.I[ins.Result] = ins.Param1;
    else if (code === 'Func' && ins.Param1 === SELECT_FN) {
      const [c, x, y] = calls[ins.Param2]?.Parameters ?? [];
      regs.I[ins.Result] = regs.B[c] ? regs.I[x] : regs.I[y];
    } else if (code === 'Return') out = ins.Param1 === 2 ? regs.I[ins.Result] : ins.Param1 === 1 ? regs.B[ins.Result] : undefined;
    else return undefined;
  }
  return out;
}

function valueOf(root, g, i, field, flags, depth = 0) {
  if (depth > 48) return undefined;
  const o = g.a.objects[i];
  if (!o) return undefined;
  const live = g.live(o, field, flags);
  if (live !== undefined) return live;
  const input = (f) => {
    const c = g.into.get(i)?.get(f);
    return c ? valueOf(root, g, c.src, c.field, flags, depth + 1) : undefined;
  };
  if (o === g.iface) return constantOf(o, field);
  switch (o.$type) {
    case 'PropertyDefaultValueEntityData':
      return input(F.DefaultIn) ?? input(F.Default);
    case 'OrEntityData':
      return F.Ins.some((f) => input(f) === true);
    case 'AndEntityData':
      return F.Ins.filter((f) => g.into.get(i)?.has(f)).every((f) => input(f) === true);
    case 'NotEntityData':
      return !input(F.In);
    case 'ConditionalFloatEntityData':
    case 'ConditionalPropertyEntityData': {
      const c = input(F.Condition) ?? o.Condition;
      return c ? (input(F.IfTrue) ?? o.ValueIfTrue) : (input(F.IfFalse) ?? o.ValueIfFalse);
    }
    case 'FloatInterpolatorEntityData':
      return input(F.In) ?? o.In;
    case 'PropertySelectEntityData': {
      const at = input(F.SelectedIndex) ?? o.SelectedIndex ?? 0;
      return input(F.Ins[at]);
    }
    case 'UIColorPalettePickerEntityData':
      return field === F.Color ? { palette: o.PaletteIndex } : undefined;
    case 'MathEntityData':
      return mathOf(o, input);
    case 'LogicPrefabReferenceObjectData': {
      const p = follow(root, o.Blueprint);
      if (!p) return undefined;
      // (inside the prefab, its interface's inputs are what this asset feeds the reference)
      const inner = graphOf(p, (po, pf) => (po === inner.iface ? input(pf) : undefined));
      const c = [...inner.into.entries()].find(([t]) => p.objects[t] === inner.iface)?.[1]?.get(field);
      return c ? valueOf(root, inner, c.src, c.field, flags, depth + 1) : undefined;
    }
    default:
      return undefined;
  }
}

// what the live state sets: a zone's focus; a list cell's IsSelected (the
// open tab) and IsEnabled, its pointer's IsHovered (the focus: the site's
// keyboard focus draws as the game's hover), its pad's input nothing (the
// pad's focus is the same focus); a widget interface's Focused/Selected (the
// tile tells its BasicTileWidget `Selected` from its zone's focus) and Enabled
function liveOf(iface) {
  return (o, field, flags) => {
    if (o.$type === 'NavigatableElementZoneEntityData' && field === F.Focused) return flags.focused;
    if (o.$type === 'InputElementData' && field === F.IsHovered) return flags.focused;
    if (o.$type === 'UIInputControlEntityData') return false;
    if (/^Static(Tab)?ListCellWidgetData$/.test(o.$type) || o === iface) {
      if (field === F.IsSelected) return flags.selected;
      if (field === F.IsEnabled) return flags.enabled;
      if (o !== iface) return false;
    }
    if (o !== iface) return undefined;
    if (field === F.Focused) return flags.focused;
    if (field === F.Selected) return flags.focused || flags.selected;
    if (field === F.Enabled) return flags.enabled;
    return undefined;
  };
}

const KEYS = [
  ['palette', F.Color],
  ['visible', F.Visible],
  ['alpha', F.Alpha],
  ['line', F.LineWidth],
  ...Object.entries(F.Corners).map(([k, f]) => [k, f]),
];
const ELEMENT = /ElementData$|^UIElementWidgetReferenceEntityData$/;

export function stateTables(root, asset) {
  const r = rootOf(asset);
  const g = graphOf(asset, liveOf(deref(asset, r.Interface)));
  const out = new Map();
  for (const [t, fields] of g.into) {
    const el = asset.objects[t];
    if (!el || !ELEMENT.test(el.$type)) continue;
    const row = {};
    for (const [key, f] of KEYS) {
      const c = fields.get(f);
      if (!c) continue;
      const vals = FLAGS.map((flags) => valueOf(root, g, c.src, c.field, flags));
      if (vals.some((v) => v === undefined)) continue;
      const flat = key === 'palette' ? vals.map((v) => v?.palette) : key === 'visible' ? vals.map((v) => (typeof v === 'boolean' ? v : undefined)) : vals.map(Number);
      if (flat.some((v) => v === undefined || Number.isNaN(v))) continue;
      // (a field the state never changes is the tree's own, set once)
      if (flat.every((v) => v === flat[0]) && key !== 'palette') continue;
      row[key] = flat;
    }
    if (Object.keys(row).length) out.set(t, row);
  }
  return out;
}
