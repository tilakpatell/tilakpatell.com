// The game's screens, from its widget trees (the sixth design's lane
// screens; lane 0's bf2017-rulebook-look.mjs flattened the HUD's widgets):
//
//   screensOf(root, { names, era }) → screens.json: every screen's
//     `UIWidgetBlueprint` as its layers' elements ({ id, type, anchor, size,
//     offset, layout, colour, palette, alpha, visible, font, text, align,
//     widget, shape, svg, film, list, binds, children }), the widgets the
//     trees reference (once each, by name: the resolver expands them), the
//     links the screen's cells go to (`GotoUILinkTargetEntityData`), the state
//     groups it reads, and the English of every string it names.
//   shapesOf(root, names) → shapes.json: each `DiceUIVectorShapeAsset` as SVG
//     path data in its own pixels (`LayoutRect`), miter corners as lines,
//     rounded corners as arcs of the record's radius, bevels cut; inner paths
//     beside it (drawn even-odd); the triangulated points' bounds.
//   infoOf(root) → info.json: the modes (`GameModeInformationAsset`, in
//     `GameModesListInformationAsset`'s order), levels and planets, with
//     their names, descriptions and keys.
//   loadingOf(root) → loading.json: the loading screens
//     (`WSUILoadingScreenAsset`: widget, film, load time) and the hints
//     (`TipsBundle`) with the modes, maps and planets they are for.
//
// A string the records name by key is kept by its key (ID_…); one they name
// by hash is '#XXXXXXXX' (the localisation's id). Each rulebook carries the
// English of the strings it names, so the site needs no table to read it.
// The era rule (isEra): a widget, screen, mode, level or planet of the sequel is
// left out and listed in `_skipped`.

import { deref, follow, isSequel, rootOf, shortName, stringHash } from './bf2017-ebx.mjs';
import { typeOf } from './bf2017-rulebook-look.mjs';

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const v3 = (p) => (p ? [r4(p.x), r4(p.y), r4(p.z)] : null);
const xy = (p, a = 'X', b = 'Y') => (p && typeof p[a] === 'number' ? [r2(p[a]), r2(p[b])] : null);
export const hashKey = (n) => `#${(n >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
const GUIDISH = /^[0-9A-F]{8}-[0-9A-F]{4}-/i;
const asset = (v) => v?.$asset ?? null;
// The era rule: the sequel's names, and its seasons' and act 3's folders
// (S1's Crait, the S9 sequel levels, A3's Resurrection, and "Paintball", the
// sequel's codename that lane M's films leave out too).
export const isEra = (n) => isSequel(n) || /(^|\/)(S1|S9[^/]*|A3)\//i.test(n) || /(^|[/_])A3M\d/i.test(n) || /paintball/i.test(n);

// ── strings ──────────────────────────────────────────────────────────────

// The English of a key ('ID_…') or a hash key ('#XXXXXXXX'), else undefined.
export function englishOf(key, strings) {
  const table = strings?.strings ?? strings ?? {};
  if (!key) return undefined;
  return key.startsWith('#') ? table[key.slice(1)] : table[stringHash(key)];
}

function stringsFor(keys, strings) {
  const out = {};
  for (const k of [...keys].sort()) {
    const t = englishOf(k, strings);
    if (t !== undefined) out[k] = t;
  }
  return out;
}

// A LocalizedStringId / LocalizedString / CheckedLocalizedString's key.
function keyOfString(a, v, keys) {
  const o = v && typeof v.$ref === 'number' ? deref(a, v) : v;
  if (!o) return null;
  let k = null;
  if (o.$type === 'LocalizedStringId' && o.StringHash) k = hashKey(o.StringHash);
  else if (o.Sid) k = o.Sid;
  else if (o.$type === 'LocalizedString' && o.String) return { literal: o.String };
  if (k) keys.add(k);
  return k;
}

// ── screens ──────────────────────────────────────────────────────────────

// The asset's connections, read once: which string feeds which element's
// field, which cell's event goes to which link.
function wiring(a) {
  const r = rootOf(a);
  const idx = (ref) => (ref && typeof ref.$ref === 'number' ? ref.$ref : -1);
  const strings = new Map(); // target object index → [{ field, key }]
  const gotos = new Map(); // source object index → [link]
  for (const c of r.PropertyConnections ?? []) {
    const s = a.objects[idx(c.Source)];
    if (s?.$type === 'CheckedLocalizedStringEntityData' && s.Sid) {
      const t = idx(c.Target);
      if (!strings.has(t)) strings.set(t, []);
      strings.get(t).push({ field: c.TargetField, key: s.Sid });
    }
  }
  const feeds = new Map(); // source object index → the object indices its events reach
  for (const c of r.EventConnections ?? []) {
    if (!feeds.has(idx(c.Source))) feeds.set(idx(c.Source), new Set());
    feeds.get(idx(c.Source)).add(idx(c.Target));
    const t = a.objects[idx(c.Target)];
    if (t?.$type === 'GotoUILinkTargetEntityData' && asset(t.LinkTarget)) {
      const s = idx(c.Source);
      if (!gotos.has(s)) gotos.set(s, []);
      gotos.get(s).push(asset(t.LinkTarget));
    }
  }
  // the widget's interface: a field it takes from outside → the elements it feeds
  const slots = {};
  const iface = deref(a, r.Interface);
  for (const c of r.PropertyConnections ?? []) {
    if (iface && a.objects[idx(c.Source)] === iface) {
      const el = a.objects[idx(c.Target)];
      if (el?.$type === 'TextElementData') (slots[c.SourceField] ??= []).push(elementId(a, idx(c.Target)));
    }
  }
  return { strings, gotos, slots, feeds };
}

function elementId(a, i) {
  const o = a.objects[i];
  const n = o?.InstanceName;
  return n && !GUIDISH.test(n) ? n : `e${i}`;
}

function elementOf(a, i, ctx, w, depth = 0) {
  const o = a.objects[i];
  if (!o || depth > 24) return null;
  const el = { id: elementId(a, i), type: typeOf(o.$type) };
  if (o.Anchor) el.anchor = xy(o.Anchor);
  if (o.Size) el.size = xy(o.Size, 'x', 'y');
  if (o.Offset) el.offset = xy(o.Offset);
  if (o.LayoutMode === 'UILayoutMode_PositionExpansion')
    el.layout = {
      fill: true,
      expansion: [o.Expansion?.X ?? 0, o.Expansion?.Y ?? 0, o.Expansion?.Width ?? 0, o.Expansion?.Height ?? 0].map(r2),
      position: xy(o.Position),
    };
  if (o.Color && (o.Color.x !== 1 || o.Color.y !== 1 || o.Color.z !== 1)) el.colour = v3(o.Color);
  if (typeof o.PaletteIndex === 'number' && o.PaletteIndex) el.palette = o.PaletteIndex;
  if (typeof o.Alpha === 'number' && o.Alpha !== 1) el.alpha = r4(o.Alpha);
  if (o.Visible === false) el.visible = false;
  // (how the box is laid on what is under it; alpha blend, the default, is not written)
  if (typeof o.BlendMode === 'string' && o.BlendMode !== 'WSUIBlendMode_AlphaBlend') el.blend = o.BlendMode.replace(/^WSUIBlendMode_/, '').toLowerCase();
  if (o.$type === 'PaddingContainerData' && o.Padding) el.padding = [o.Padding.PaddingLeft, o.Padding.PaddingTop, o.Padding.PaddingRight, o.Padding.PaddingBottom].map((v) => r2(v ?? 0));
  if (o.$type === 'TextureElementData') {
    // its picture: the Id (the field hash of the texture's short name), and
    // the TextureRef the widget's own mapping gives that Id where the box
    // holds none (`<widget>_automapping`, or a mapping the widget names)
    const id = o.Texture?.Id ?? 0;
    const own = o.Texture?.TextureRef && /[1-9A-F]/i.test(o.Texture.TextureRef) ? o.Texture.TextureRef : null;
    el.texture = {
      id,
      ref: own ?? (id ? mappedRef(ctx.root, a, id) : null),
      uv: [o.UvRect?.x ?? 0, o.UvRect?.y ?? 0, o.UvRect?.z ?? 1, o.UvRect?.w ?? 1].map(r4),
      align:
        String(o.TextureAlignment ?? '')
          .replace(/^UITextureAlignment_/, '')
          .toLowerCase() || 'stretch',
    };
  }
  if (o.$type === 'TextElementData') {
    el.font = asset(o.FontStyle) ? shortName(asset(o.FontStyle)) : null;
    if (typeof o.FontPaletteIndex === 'number' && o.FontPaletteIndex) el.fontPalette = o.FontPaletteIndex;
    if (o.WordWrap) el.wrap = true;
    el.align = [o.HorizontalAlignment, o.VerticalAlignment].map((s) =>
      String(s ?? '')
        .replace(/^UIText(Horizontal|Vertical)Alignment_/, '')
        .toLowerCase(),
    );
    const bound = w.strings.get(i)?.[0]?.key;
    const literal = o.LocalizedString ? keyOfString(a, o.LocalizedString, ctx.keys) : null;
    if (bound) {
      el.text = bound;
      ctx.keys.add(bound);
    } else if (o.StaticStringIdHash) {
      el.text = hashKey(o.StaticStringIdHash);
      ctx.keys.add(el.text);
    } else if (o.LocalizedStringId) el.text = keyOfString(a, o.LocalizedStringId, ctx.keys);
    else if (literal?.literal) el.literal = literal.literal;
    else if (o.Text) el.literal = o.Text;
  }
  const shape = asset(o.Shape);
  if (shape) {
    el.shape = shortName(shape);
    ctx.shapes.add(shape);
  }
  if (asset(o.Image)) el.svg = asset(o.Image).replace(/^UI\/SVG\//, '');
  if (asset(o.Movie)) el.film = shortName(asset(o.Movie));
  if (o.$type === 'RectangleElementData' || o.$type === 'CircleElementData') {
    el.fill =
      String(o.FillMode ?? '')
        .replace(/^WSUIFillMode_/, '')
        .toLowerCase() || null;
    if (o.LineWidth) el.line = o.LineWidth;
    if (o.Radius) el.radius = o.Radius;
  }
  if (o.$type === 'LineElementData' && o.StaticPoints)
    Object.assign(el, {
      points: o.StaticPoints.map((p) => [r2(p.x), r2(p.y)]),
      line: o.LineWidth,
    });
  if (o.$type === 'StackingContainerData')
    el.stack = {
      direction: String(o.Direction ?? '').replace(/^StackingContainerDirection_/, ''),
      spacing: o.Spacing ?? 0,
    };
  if (o.$type === 'UIElementWidgetReferenceEntityData' && asset(o.Blueprint)) {
    const name = asset(o.Blueprint);
    if (isEra(name)) {
      ctx.skipped.add(name);
      return null;
    }
    el.widget = name;
    if (o.UseElementSize) el.useElementSize = true;
    const binds = w.strings.get(i);
    if (binds?.length) {
      el.binds = Object.fromEntries(binds.map((b) => [b.field, b.key]));
      binds.forEach((b) => ctx.keys.add(b.key));
    }
    ctx.want.add(name);
  }
  // a list the game's code fills, one cell a datum, each made from the
  // template (the breadcrumb's crumbs): the page lays it from its own data
  if (o.$type === 'StandardListElementData' && asset(o.CellTemplate) && !isEra(asset(o.CellTemplate))) {
    const template = asset(o.CellTemplate);
    el.dynamic = { template, cellSize: xy(o.CellSize, 'X', 'Y'), spacing: o.Spacing ?? 0, horizontal: Boolean(o.Horizontal), sized: Boolean(o.CellsUseDynamicSize) };
    ctx.want.add(template);
  }
  if (/^Static(Tab)?ListElementData$/.test(o.$type)) {
    // the list's cells are the widget's StaticListCellEntityData components
    // (those whose events go to this list, when any does), in the order the
    // widget lists its components
    el.list = {
      horizontal: Boolean(o.Horizontal),
      spacing: o.Spacing ?? 0,
      cells: [],
    };
    const all = a.objects.map((c, ci) => (c?.$type === 'StaticListCellEntityData' ? ci : -1)).filter((ci) => ci >= 0);
    const mine = all.filter((ci) => w.feeds.get(ci)?.has(i));
    // (cells no event ties to a list go to the widget's first list, once:
    // the export does not say which list holds them)
    const lists = new Set(a.objects.map((x, xi) => (/^Static(Tab)?ListElementData$/.test(x?.$type ?? '') ? xi : -1)).filter((xi) => xi >= 0));
    const loose = all.filter((ci) => ![...(w.feeds.get(ci) ?? [])].some((t) => lists.has(t)));
    const take = mine.length ? mine : w.claimed ? [] : ((w.claimed = true), loose);
    const order = new Map((deref(a, rootOf(a).Object)?.Components ?? []).map((c, k) => [c?.$ref, k]));
    const cells = take.sort((x, y) => (order.get(x) ?? 1e9 + x) - (order.get(y) ?? 1e9 + y));
    cells.forEach((ci) => {
      const c = a.objects[ci];
      const bp = asset(c.Blueprint);
      if (bp && isEra(bp)) return ctx.skipped.add(bp);
      const binds = w.strings.get(ci) ?? [];
      binds.forEach((b) => ctx.keys.add(b.key));
      const links = w.gotos.get(ci) ?? [];
      links.forEach((l) => ctx.links.add(l));
      if (bp) ctx.want.add(bp);
      el.list.cells.push({
        id: c.TelemetryId || `c${ci}`,
        widget: bp,
        binds: Object.fromEntries(binds.map((b) => [b.field, b.key])),
        ...(links[0] ? { link: links[0] } : {}),
      });
    });
  }
  if (Array.isArray(o.Elements)) {
    el.children = o.Elements.filter(Boolean)
      .map((r) => elementOf(a, r.$ref, ctx, w, depth + 1))
      .filter(Boolean);
  }
  return el;
}

// The TextureRef a widget's texture mappings give a texture Id: the
// mappings it names, then its own `<name>_automapping` (the export indexes
// those in lower case), or null.
function mappedRef(root, a, id) {
  if (!root) return null;
  const top = deref(a, rootOf(a)?.Object);
  const names = [...(top?.TextureMappings ?? []).map((m) => m?.$asset).filter(Boolean), `${String(a.name ?? '').toLowerCase()}_automapping`];
  for (const n of names) {
    const m = follow(root, n);
    for (const o of m?.objects ?? []) for (const out of o?.Output ?? []) if (out.Id === id && /[1-9A-F]/i.test(out.TextureRef ?? '')) return out.TextureRef;
  }
  return null;
}

// One widget blueprint: its root's size and layers, its interface slots.
function treeOf(root, name, ctx) {
  const a = follow(root, name);
  if (!a) {
    ctx.missing.add(`widget: ${name}`);
    return null;
  }
  const r = rootOf(a);
  const top = deref(a, r.Object);
  const w = wiring(a);
  const layers = (top?.Layers ?? []).map((l) => deref(a, l)).filter(Boolean);
  const elements = layers.flatMap((l) =>
    (l.Elements ?? [])
      .filter(Boolean)
      .map((e) => elementOf(a, e.$ref, ctx, w))
      .filter(Boolean),
  );
  const links = [];
  w.gotos.forEach((targets, from) => targets.forEach((to) => links.push({ from: elementId(a, from), to })));
  const states = [...new Set(a.objects.filter((o) => o?.$type === 'UIStateValueReaderData' && asset(o.StateGroup)).map((o) => shortName(asset(o.StateGroup))))];
  const out = {
    type: top ? typeOf(top.$type) : null,
    size: xy(top?.Size),
    elements,
  };
  if (Object.keys(w.slots).length) out.slots = w.slots;
  if (links.length) out.links = links;
  if (states.length) out.states = states;
  if (top?.$type === 'NavigationFrameWidgetData')
    out.navigation = String(top.NavigationLevel ?? '')
      .replace(/^NavigationFrameLevel_/, '')
      .toLowerCase();
  links.forEach((l) => ctx.links.add(l.to));
  return out;
}

// The screens the site draws: the front end's, and the in-game ones the
// battle uses (the spawn overlay, the in-game menu, the end of round, the
// scoreboard and the kill card).
// (the Customize screens are the Collection's: the appearances, emotes,
// voice lines, victory poses and star cards, src/data/bf2017/collection.json)
export const SCREEN_GLOB = /^UI\/(Frontend\/Screens\/.+|LoadingScreens\/MPLoadLevel\/.+|InGame\/(Spawn|InGameMenu|EndOfRound|Scoreboard|Death)\/.+|Customize\/Screens\/.+)$/;

// The words the site's front end says that no tree names (the trees fill
// them at run time): the Play screen's tiles, press-start, the outcome and
// the death screen's lines, the map list's title.
export const FRONT_END_KEYS = ['ID_PLAY_SCR_MULTIPLAYER', 'ID_PLAY_SCR_CAMPAIGN', 'ID_PLAY_SCR_SKIRMISH', 'ID_PLAY_SCR_MULTIPLAYER_PLAY', '#19A64FB1', '#615832FF', '#8A053560', '#36B45EAB', '#48A7E354', '#05A0B377', '#73CD3EA7', '#C726953C', '#DFBEEAD5'];

export function screensOf(root, { names, strings = null, depth = 6 } = {}) {
  const ctx = {
    root,
    keys: new Set(FRONT_END_KEYS),
    shapes: new Set(),
    links: new Set(),
    want: new Set(),
    skipped: new Set(),
    missing: new Set(),
  };
  const screens = {};
  const widgets = {};
  for (const n of names) {
    if (isEra(n)) {
      ctx.skipped.add(n);
      continue;
    }
    const t = treeOf(root, n, ctx);
    if (t) screens[n] = t;
  }
  // the widgets the trees reference, breadth first to `depth`
  for (let d = 0; d < depth; d++) {
    const next = [...ctx.want].filter((n) => !(n in widgets) && !(n in screens));
    if (!next.length) break;
    ctx.want.clear();
    for (const n of next) widgets[n] = treeOf(root, n, ctx);
  }
  for (const n of Object.keys(widgets)) if (!widgets[n]) delete widgets[n];
  return {
    screens,
    widgets,
    links: linkTable([...ctx.links], Object.keys(screens)),
    shapes: [...ctx.shapes].map(shortName).sort(),
    strings: stringsFor(ctx.keys, strings),
    _skipped: [...ctx.skipped].sort(),
    _missing: [...ctx.missing].sort(),
  };
}

// A link target → the screen of the same short name (the game pairs them in
// its screen logic prefabs, which the export does not resolve), else null.
export function linkTable(links, screenNames) {
  const byShort = new Map(screenNames.map((n) => [shortName(n).toLowerCase(), n]));
  return Object.fromEntries(
    links
      .filter((l) => !isEra(l))
      .sort()
      .map((l) => [l, byShort.get(shortName(l).toLowerCase()) ?? null]),
  );
}

// ── shapes ───────────────────────────────────────────────────────────────

const fmt = (v) => String(r2(v));
const pt = ([x, y]) => `${fmt(x)} ${fmt(y)}`;

// A closed path of corners as SVG path data: miter corners as lines, rounded
// as an arc of the corner's radius (cut back along both edges, no further
// than half an edge), bevel as the cut without the arc.
export function cornersToPath(corners) {
  const P = corners.map((c) => [c.Position.x, c.Position.y]);
  const n = P.length;
  if (n < 2) return '';
  const parts = [];
  for (let i = 0; i < n; i++) {
    const c = corners[i];
    const p = P[i];
    const kind = String(c.CornerType ?? '').replace(/^DiceUIVectorPathCornerType_/, '');
    const a = P[(i - 1 + n) % n];
    const b = P[(i + 1) % n];
    const da = [a[0] - p[0], a[1] - p[1]];
    const db = [b[0] - p[0], b[1] - p[1]];
    const la = Math.hypot(...da);
    const lb = Math.hypot(...db);
    const r = c.Radius ?? 0;
    if (kind === 'Miter' || !r || !la || !lb || n < 3) {
      parts.push(`${i ? 'L' : 'M'}${pt(p)}`);
      continue;
    }
    const cos = Math.max(-1, Math.min(1, (da[0] * db[0] + da[1] * db[1]) / (la * lb)));
    const theta = Math.acos(cos);
    if (theta < 1e-3 || Math.PI - theta < 1e-3) {
      parts.push(`${i ? 'L' : 'M'}${pt(p)}`);
      continue;
    }
    const tan = Math.tan(theta / 2);
    const cut = Math.min(kind === 'Bevel' ? r : r / tan, la / 2, lb / 2);
    const p1 = [p[0] + (da[0] / la) * cut, p[1] + (da[1] / la) * cut];
    const p2 = [p[0] + (db[0] / lb) * cut, p[1] + (db[1] / lb) * cut];
    parts.push(`${i ? 'L' : 'M'}${pt(p1)}`);
    if (kind === 'Bevel') parts.push(`L${pt(p2)}`);
    else {
      const sweep = da[0] * db[1] - da[1] * db[0] < 0 ? 1 : 0;
      parts.push(`A${fmt(cut * tan)} ${fmt(cut * tan)} 0 0 ${sweep} ${pt(p2)}`);
    }
  }
  return `${parts.join('')}Z`;
}

const STYLE = {
  DiceUIVectorShapeDrawStyle_Filled: 'fill',
  DiceUIVectorShapeDrawStyle_Lines: 'lines',
  DiceUIVectorShapeDrawStyle_Outline: 'outline',
};

export function shapeOf(a) {
  const r = rootOf(a);
  const L = r.LayoutRect ?? { x: 0, y: 0, z: 0, w: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const paths = (r.Shapes ?? []).map((s) => {
    for (const p of s.TriangulatedPoints ?? []) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const style = STYLE[s.DrawStyle] ?? 'fill';
    const corners = s.Path?.Corners ?? [];
    const d = style === 'lines' ? corners.map((c, i) => `${i ? 'L' : 'M'}${pt([c.Position.x, c.Position.y])}`).join('') : cornersToPath(corners);
    const out = { colour: v3(s.Color), alpha: r4(s.Alpha ?? 1), style, d };
    const inner = (s.InnerPaths ?? []).map((p) => cornersToPath(p.Corners ?? [])).filter(Boolean);
    if (inner.length) out.inner = inner;
    if (style !== 'fill' && s.LineWidth) out.line = r2(s.LineWidth);
    if (style !== 'fill' && s.StartCapType)
      out.cap = String(s.StartCapType)
        .replace(/^DiceUIVectorShapeCapType_/, '')
        .toLowerCase();
    return out;
  });
  return {
    rect: [L.x, L.y, L.z, L.w].map(r2),
    paths,
    points: Number.isFinite(minX) ? [minX, minY, maxX, maxY].map(r2) : null,
    _source: `${r.Name}#DiceUIVectorShapeAsset`,
  };
}

export function shapesOf(root, names) {
  const shapes = {};
  const missing = [];
  for (const n of names) {
    if (isEra(n)) continue;
    const a = follow(root, n);
    if (!a) missing.push(`shape: ${n}`);
    else shapes[shortName(n)] = shapeOf(a);
  }
  return { shapes, _missing: missing };
}

// ── modes, levels, planets ───────────────────────────────────────────────

function modeRow(root, name, keys) {
  const a = follow(root, name);
  if (!a) return null;
  const r = rootOf(a);
  const lv = (r.Levels ?? []).map(asset).filter(Boolean);
  return {
    id: r.GameModeId,
    asset: name,
    name: keyOfString(a, r.GameModeName, keys),
    description: keyOfString(a, r.Description, keys),
    aurebesh: r.AurebeshGameModeName || null,
    players: r.NumberOfPlayers ?? null,
    levels: lv.filter((l) => !isEra(l)).map(shortName),
    refused: lv.filter(isSequel).map(shortName),
    tile: r.GridImage || null,
    large: Boolean(r.LargeGameTile),
    vehicles: Boolean(r.HasVehicles),
    heroes: Boolean(r.HasHeroes),
    complexity:
      String(r.Complexity ?? '')
        .replace(/^GameModeInformationComplexity_/, '')
        .toLowerCase() || null,
    _source: `${name}#GameModeInformationAsset`,
  };
}

function levelRow(root, name, keys) {
  const a = follow(root, name);
  if (!a) return null;
  const r = rootOf(a);
  const overrides = {};
  for (const o of r.LevelDescriptionOverrides ?? []) if (o.GameModeId) overrides[o.GameModeId] ??= keyOfString(a, o.LevelDescription, keys);
  const aur = keyOfString(a, r.LevelAurebesh, keys);
  return {
    key: r.Key,
    asset: name,
    name: keyOfString(a, r.LevelName, keys),
    description: keyOfString(a, r.LevelDescription, keys),
    overrides,
    aurebesh: aur?.literal ?? aur ?? null,
    planet: asset(r.Planet) ? shortName(asset(r.Planet)) : null,
    levelId: r.LevelId || null,
    tile: r.GridImage || null,
    loading: r.LoadingScreenImage || null,
    _source: `${name}#LevelInformationAsset`,
  };
}

function planetRow(root, name, keys) {
  const a = follow(root, name);
  if (!a) return null;
  const r = rootOf(a);
  return {
    id: shortName(name),
    asset: name,
    name: keyOfString(a, r.PlanetName, keys),
    index: r.PlanetIndex ?? null,
    _source: `${name}#PlanetInformationAsset`,
  };
}

export function infoOf(root, { index, strings = null, list = 'UI/Data/GameModes/GameModes' } = {}) {
  const keys = new Set();
  const names = (type) => [...index.entries()].filter(([, e]) => e.type === type).map(([n]) => n);
  const la = follow(root, list);
  const order = (la ? (rootOf(la).GameModes ?? []) : []).map(asset).filter(Boolean);
  const skipped = new Set();
  const modes = {};
  const allModes = [...new Set([...order, ...names('GameModeInformationAsset').filter((n) => /\/GameModes\//.test(n))])];
  for (const n of allModes) {
    if (isEra(n)) {
      skipped.add(n);
      continue;
    }
    const row = modeRow(root, n, keys);
    if (row) modes[row.id] = row;
  }
  const levels = {};
  const planets = {};
  for (const n of names('LevelInformationAsset').filter((x) => /\/GameModes\/Levels\//.test(x))) {
    if (isEra(n)) {
      skipped.add(n);
      continue;
    }
    const row = levelRow(root, n, keys);
    if (row && !isEra(row.levelId ?? '')) levels[shortName(n)] = row;
    else if (row) skipped.add(n);
  }
  for (const n of names('PlanetInformationAsset').filter((x) => /\/GameModes\/Planets\//.test(x))) {
    if (isEra(n)) {
      skipped.add(n);
      continue;
    }
    const row = planetRow(root, n, keys);
    if (row) planets[row.id] = row;
  }
  // (a mode lists only the levels the era rule keeps)
  const refusedShort = new Set([...skipped].map(shortName));
  for (const m of Object.values(modes)) {
    const gone = m.levels.filter((l) => !levels[l] && refusedShort.has(l));
    m.levels = m.levels.filter((l) => !gone.includes(l));
    m.refused = [...m.refused, ...gone].sort();
  }
  const strs = new Set([...keys].filter((k) => typeof k === 'string'));
  return {
    order: order
      .filter((n) => !isEra(n))
      .map((n) => modes[Object.keys(modes).find((id) => modes[id].asset === n)]?.id)
      .filter(Boolean),
    modes,
    levels,
    planets,
    strings: stringsFor(strs, strings),
    _skipped: [...skipped].sort(),
  };
}

// ── loading screens and hints ────────────────────────────────────────────

// (a hint about the sequel's people and places, by its words)
const SEQUEL_TEXT = /\b(first order|resistance|kylo|rey|finn|phasma|bb-8|bb-9e|starkiller|jakku|crait|takodana|poe|black one|tie silencer)\b/i;

export function loadingOf(root, { index, strings = null } = {}) {
  const keys = new Set();
  const names = (type) => [...index.entries()].filter(([, e]) => e.type === type).map(([n]) => n);
  const skipped = [];
  const screens = {};
  for (const n of names('WSUILoadingScreenAsset')) {
    if (isEra(n)) {
      skipped.push(n);
      continue;
    }
    const a = follow(root, n);
    if (!a) continue;
    const r = rootOf(a);
    const level = shortName(n).match(/^MPLoadLevel(.+?)Asset$/)?.[1] ?? null;
    screens[shortName(n)] = {
      asset: n,
      level,
      widget: asset(r.WidgetData),
      film: asset(r.Movie) ? shortName(asset(r.Movie)) : null,
      intro: asset(r.IntroMovie) ? shortName(asset(r.IntroMovie)) : null,
      loadTime: r.TotalLoadTime ?? null,
      bar: Boolean(r.UseLoadingBar),
      _source: `${n}#WSUILoadingScreenAsset`,
    };
  }
  const hints = {};
  for (const n of names('TipsBundle')) {
    if (isEra(n)) {
      skipped.push(n);
      continue;
    }
    const a = follow(root, n);
    if (!a) continue;
    const r = rootOf(a);
    const filter = { modes: [], maps: [], planets: [] };
    for (const f of (r.Filters ?? []).map((x) => deref(a, x)).filter(Boolean)) {
      if (f.$type === 'GameModeTipFilter') filter.modes.push(...(f.GameModes ?? []).map(asset).filter(Boolean).map(shortName));
      if (f.$type === 'MapTipFilter') filter.maps.push(...(f.Maps ?? []).map(asset).filter(Boolean).map(shortName));
      if (f.$type === 'PlanetTipFilter') filter.planets.push(...(f.Planets ?? []).map(asset).filter(Boolean).map(shortName));
    }
    const tips = (r.Tips ?? []).map((x) => deref(a, x)?.TextSid).filter((k) => k && !SEQUEL_TEXT.test(englishOf(k, strings) ?? ''));
    tips.forEach((k) => keys.add(k));
    hints[shortName(n)] = {
      tips,
      sub: (r.SubBundles ?? [])
        .map(asset)
        .filter((s) => s && !isEra(s))
        .map(shortName),
      ...(filter.modes.length || filter.maps.length || filter.planets.length ? { filter } : {}),
      ...(r.Enabled === false ? { enabled: false } : {}),
    };
  }
  return {
    screens,
    hints,
    strings: stringsFor(keys, strings),
    _skipped: skipped.sort(),
  };
}
