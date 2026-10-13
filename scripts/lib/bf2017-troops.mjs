// The troops' roster from the 2017 game's records (EA DICE's Battlefront II):
// every multiplayer class kit of the Original and Prequel eras by side and
// planet (`Gameplay/Kits/MP/<Class>/Kit_<L|D>_<Class>_<Era>_<Planet>`, and
// Geonosis's under `S5_1/`), the kit the game's own bots wear there (the
// AI kits: `S7_2/Gameplay/Kits/AI/<Class>/OT/Kit_<S>_<Class>_OT_AP[-Variant]
// [-PLANET]` for the Empire and the Rebels, `…/AI/<Class>/Kit_D_<Class>_Preq
// [_PLANET]_AP…` for the Separatists, `…/AP/<Class>/Kit_L_<Class>_Preq_<PLANET>
// _AP[_PHA_0n]…` for the Republic: on Hoth the bots are snowtroopers where
// you are a stormtrooper), the reinforcements (`Gameplay/Kits/Specials/<X>/
// Kit_Special_<X>`), each kit's appearance (its VisualUnlockRootAsset) read
// whole (lib/bf2017-outfits.mjs: skins and the meshes each wears), and which
// of the site's bodies (src/components/battlefront/figures/figures.js's
// BODIES, imported by scripts/bf2017-import.mjs --outfit) wears each skin:
// `body` when its meshes and variations are the skin's, `stand` when its
// meshes alone are. Sequel-era kits are refused (lib/bf2017-manifest.mjs's
// isSequel and the kit names' `NewEra`). Pure: `read(path)` reads a record.
//
//   mpKitOf(name) → { side, cls, era, planet } | null
//   aiKitOf(name) → { side, cls, era, planet | null, variant, phase } | null
//   specialOf(name) → { id } | null
//   PLANET (an AI kit's planet word → the multiplayer kits' code)
//   roster({ names, read, bodies }) → { classes, specials, outfits, wear, bodies, missing }
//   wearOf(roster, planet, classId, who = 'bots') → body | null

import { isSequel } from './bf2017-manifest.mjs';
import { outfitOf } from './bf2017-outfits.mjs';

export const PLANET = { HOTH: 'HO', ENDOR: 'EN', YAV: 'YA', SCAR: 'SCAR', MOS: 'MOS', DS: 'DS', GEO: 'GEO', KAM: 'KAM', KASH: 'KASH', THEE: 'THEE', FEL: 'FEL' };
const CLASSES = ['Assault', 'Heavy', 'Officer', 'Specialist'];
const SIDE = { L: 'light', D: 'dark' };
const sequel = (name) => /newera|_nt_|\/nt\//i.test(name) || isSequel(name);

export function mpKitOf(name) {
  const m = /(?:^|\/)Gameplay\/Kits\/MP\/(Assault|Heavy|Officer|Specialist)\/Kit_([LD])_\1_(Orig|Preq)_([A-Z]+)$/.exec(String(name));
  if (!m || sequel(name)) return null;
  return { side: SIDE[m[2]], cls: m[1].toLowerCase(), era: m[3], planet: m[4] };
}

export function aiKitOf(name) {
  const s = String(name);
  if (sequel(s) || !/^S7_2\/Gameplay\/Kits\/A[IP]\//.test(s)) return null;
  const leaf = s.split('/').pop();
  // the Original era's: Kit_D_Assault_OT_AP-Vanguard-HOTH, Kit_L_Heavy_OT_AP-HOTH, Kit_D_Heavy_OT_AP
  let m = /^Kit_([LD])_(Assault|Heavy|Officer|Specialist)_OT_AP(?:-([A-Za-z]+))?(?:-([A-Z]+))?$/.exec(leaf);
  if (m) {
    // (one word after AP is the planet when it is one, else the variant)
    let [variant, planet] = [m[3] ?? null, m[4] ?? null];
    if (variant && !planet && PLANET[variant]) [variant, planet] = [null, variant];
    return { side: SIDE[m[1]], cls: m[2].toLowerCase(), era: 'Orig', planet: planet ? (PLANET[planet] ?? planet) : null, variant, phase: null };
  }
  // the Prequel era's: Kit_D_Assault_Preq_GEO_AP-Vanguard, Kit_D_Assault_Preq_AP-AcidLauncher, Kit_L_Assault_Preq_KAM_AP_PHA_01-Vanguard
  m = /^Kit_([LD])_(Assault|Heavy|Officer|Specialist)_Preq(?:_([A-Z]+))?_AP(?:_PHA_0?(\d))?(?:-([A-Za-z]+))?$/.exec(leaf);
  if (m) return { side: SIDE[m[1]], cls: m[2].toLowerCase(), era: 'Preq', planet: m[3] ? (PLANET[m[3]] ?? m[3]) : null, variant: m[5] ?? null, phase: m[4] ? Number(m[4]) : null };
  return null;
}

export function specialOf(name) {
  const m = /^Gameplay\/Kits\/Specials\/([A-Za-z0-9]+)\/Kit_Special_\1$/.exec(String(name));
  if (!m || sequel(name) || /^(FirstOrder|Resistance|Flametrooper|Gunner|BermudaCop|JumpCop)/.test(m[1])) return null;
  return { id: m[1] };
}

const appearanceOf = (read, kit) => read(kit)?.objects?.[0]?.Appearances?.[0]?.$asset ?? null;
// a skin's meshes, each with its variation and the colour maps its variation
// databases bind: 'mesh', 'mesh~variation', 'mesh#t_colour+t_colour'
const COLOUR = /^(BaseColor|Color|ColorSmoothness)$/i;
const colours = (mats) => (mats ?? []).map((list) => list.find((t) => COLOUR.test(t.parameter))?.texture.split('/').pop().toLowerCase() ?? '-').join('+');
const sig = (parts, maps = {}) =>
  parts
    .map((p) => {
      const c = maps[p.mesh] ? colours(maps[p.mesh]) : '';
      return `${p.mesh}${p.variation ? `~${p.variation.split('/').pop().toLowerCase()}` : ''}${c ? `#${c}` : ''}`;
    })
    .sort();
const meshesOnly = (list) => [...new Set(list.map((p) => p.split(/[~#]/)[0]))].sort();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// roster: names (every record's name in data.tsv), read, bodies ({ kind: { record, skin } | { parts: [mesh] } })
export function roster({ names, read, bodies = {} }) {
  const missing = new Set();
  const outfits = {};
  const take = (record) => {
    if (!record || outfits[record] !== undefined) return record;
    const o = outfitOf(read, record);
    if (!o) {
      missing.add(record);
      outfits[record] = null;
      return record;
    }
    for (const m of o.missing) missing.add(m);
    outfits[record] = { pick: o.pick, skins: o.skins.map((s) => ({ name: s.name, ui: s.ui, default: s.default, parts: sig(s.parts, s.maps) })) };
    return record;
  };
  // the bodies' own parts: from their record's skin, or as given
  const bodyParts = {};
  for (const [kind, b] of Object.entries(bodies)) {
    if (b.parts) bodyParts[kind] = [...b.parts].map((p) => p.toLowerCase()).sort();
    else {
      take(b.record);
      const skin = outfits[b.record]?.skins.find((s) => (b.skin ? s.name === b.skin : s.default));
      if (skin) bodyParts[kind] = skin.parts;
      else missing.add(`${b.record}#${b.skin ?? 'default'}`);
    }
  }
  const classes = {};
  const ai = [];
  const specials = {};
  for (const name of names) {
    const mp = mpKitOf(name);
    if (mp) {
      const id = `${mp.side[0]}-${mp.era.toLowerCase()}-${mp.cls}`;
      const row = (classes[id] ??= { side: mp.side, era: mp.era, cls: mp.cls, planets: {} });
      row.planets[mp.planet] = { kit: name, player: take(appearanceOf(read, name)), bots: null, botKits: [] };
      continue;
    }
    const k = aiKitOf(name);
    if (k) {
      ai.push({ name, ...k });
      continue;
    }
    const sp = specialOf(name);
    if (sp) {
      const kit = read(name)?.objects?.[0];
      specials[sp.id] = { kit: name, side: kit?.WSFaction?.$asset ? (/Dark/i.test(kit.WSFaction.$asset) ? 'dark' : 'light') : null, record: take(appearanceOf(read, name)) };
    }
  }
  // the bots' kits: each planet's own, else the class's kit with no planet
  for (const [id, row] of Object.entries(classes)) {
    const mine = ai.filter((k) => `${k.side[0]}-${k.era.toLowerCase()}-${k.cls}` === id);
    for (const [planet, p] of Object.entries(row.planets)) {
      const here = mine.filter((k) => k.planet === planet);
      const kits = here.length ? here : mine.filter((k) => k.planet === null);
      p.botKits = kits.map((k) => k.name).sort();
      const records = [...new Set(kits.map((k) => appearanceOf(read, k.name)).filter(Boolean))];
      p.bots = records.length ? take(records.sort()[0]) : p.player;
      if (records.length > 1) p.botRecords = records.map(take);
    }
  }
  // which body wears each skin
  for (const o of Object.values(outfits)) {
    if (!o) continue;
    for (const s of o.skins) {
      s.body = Object.keys(bodyParts).find((k) => same(bodyParts[k], s.parts)) ?? null;
      s.stand = s.body ? null : (Object.keys(bodyParts).find((k) => same(meshesOnly(bodyParts[k]), meshesOnly(s.parts))) ?? null);
    }
  }
  const out = { classes, specials, outfits, wear: {}, bodies: Object.fromEntries(Object.entries(bodies).map(([k, b]) => [k, { ...b, parts: bodyParts[k] ?? null }])), missing: [...missing].sort() };
  // the body each class wears on each planet: you in the kit's own outfit, the bots in theirs
  for (const [id, row] of Object.entries(classes))
    for (const planet of Object.keys(row.planets)) {
      const w = { player: wearOf(out, planet, id, 'player'), bots: wearOf(out, planet, id, 'bots') };
      if (w.player || w.bots) (out.wear[planet] ??= {})[id] = w;
    }
  return out;
}

// the body a class wears on a planet: the default skin's, else (a skin picked
// at random: a Rebel's head) the first skin that has one
export function wearOf(r, planet, classId, who = 'bots') {
  const record = r.classes[classId]?.planets?.[planet]?.[who];
  const o = record ? r.outfits[record] : null;
  if (!o) return null;
  const order = [...o.skins.filter((s) => s.default), ...o.skins.filter((s) => !s.default && s.ui)];
  return order.find((s) => s.body)?.body ?? null;
}
