// The game's Collection (its Characters tab: the Appearance, Emote, Victory
// Pose and Voice Line screens of UI/Customize/Screens/), from its own
// customisation records and the UI metadata that names them:
//
//   collectionRulebook(root, { books, strings, credits }) → collection.json:
//     characters  { [id]: { kind: 'hero' | 'trooper' | 'special', side, era,
//                   name, kit, skins: [skinId…], emotes, poses, voiceLines,
//                   cards: [cardId…] } } a trooper class's skins by faction
//                   (`factions: { rebel | empire | republic | cis: { side,
//                   era, kits, skins } }`)
//     skins       { [id]: { of, name, description, aurebesh, rarity, record,
//                   look, body, _source } }
//     emotes, poses, voiceLines  { [id]: { of, n, name, rarity, ability, _source } }
//     cards       { [id]: { of, n, name, description, rarity, ability, _source } } (the heroes' star cards)
//     labels      the screens' own words the trees leave to run time (LABELS)
//     strings     the English of every key the rows and labels name
//     _skipped    the sequel era's rows, left out (isEra)
//     _missing    a metadata row no record matches, or a record no row names
//
// How a row finds its record: the metadata's `Identifiers` are the online
// catalogue's ids, not any record's (a search of all 83,983 exported
// records finds them only in the metadata itself, and they are no plain
// hash of the record's name or GUID; a record's own `Identifier` is
// djb2-xor of its instance GUID: bf2-re findings/51), so a row is matched by
// its `TelemetryId`, the designers' name: a hero's skin row by the
// appearance's `DebugUnlockId` (`VUR_Luke_Hoth_01`) or one it begins
// (`VUR_Luke_Yavin` → `VUR_Luke_Yavin_01`), among the hero kit's own
// `Appearances`; an emote, pose or voice line by the hero and the number
// its name carries (`Ability Hero Emote Luke 2`, `Anakin - Emote 1`,
// `Darth Vader MvP 3`).
//
// A skin's `body` is the site's crew file whose source mesh sits in the
// skin's record's folder (src/data/modelCredits.json's titles: the crew
// importer names the mesh it cut), else null: the bodies are the roster's
// lane, which reads this table for what is left to import.

import { follow, loadAsset, rootOf, shortName } from './bf2017-ebx.mjs';
import { isSequel } from './bf2017-manifest.mjs';
import { englishOf, hashKey, isEra } from './bf2017-rulebook-ui.mjs';
import { indexOf } from './bf2017-rulebook.mjs';
import { cardEffect } from './bf2017-rulebook-cards.mjs';

export const META = {
  heroSkins: 'UI/Metadata/KitAppearanceUIMetaData',
  trooperSkins: 'UI/Metadata/KitAppearanceSkinUIMetaData',
  specialSkins: 'UI/Metadata/Unlocks/Specials_SkinUIMetaData',
  emotes: 'UI/Metadata/EmotesUIMetaData',
  poses: 'UI/Metadata/VictoryPosesUIMetaData',
  voiceLines: 'UI/Metadata/VoiceLinesUIMetaData',
  characters: 'UI/Metadata/CharacterUIMetaData',
};
// a hero's ability screen (`UI/Metadata/LukeAbilityUIMetaData`); the
// troopers', the specials', the vehicles' and the campaign's are not a hero's
const ABILITY_META = /^UI\/Metadata\/(?!Character|Trooper|Specials|Mount|Vehicle|Weapon|SP)([A-Za-z]+)AbilityUIMetaData$/;
const SLOTS = { PlayerAbilityCategory_Left: 'left', PlayerAbilityCategory_Middle: 'middle', PlayerAbilityCategory_Right: 'right' };
// The Collection's words the screens' trees do not name (the trees fill
// them at run time), by their localisation hashes: EQUIP STAR CARDS,
// EQUIPPED CARDS, REINFORCEMENTS, EQUIPPED, HEROES AND VILLAINS, STAR CARD
export const LABELS = { equipCards: '#D6D01734', equippedCards: '#042C1F72', reinforcements: '#3E94F3E6', equipped: '#AE29E47F', heroesAndVillains: '#6DC433AB', starCard: '#1FBD97EC' };
const SLOT_ORDER = ['left', 'middle', 'right'];
const RARITY = { RarityType_Common: 'common', RarityType_Uncommon: 'uncommon', RarityType_Rare: 'rare', RarityType_Epic: 'epic', RarityType_Legendary: 'legendary' };
export const CLASSES = ['Assault', 'Heavy', 'Officer', 'Specialist'];
// a class kit's era and side → the faction the game's Appearance screen
// files it under (AppearanceFactionsScreen's four cells)
export const FACTIONS = { 'Orig:L': 'rebel', 'Orig:D': 'empire', 'Preq:L': 'republic', 'Preq:D': 'cis' };

// The names the metadata's telemetry gives a hero, squeezed (lower case, no
// spaces or dashes), → the hero rulebook's id; a class's poses go to the class
const OWNERS = { palpatine: 'emperor', emperor: 'emperor', bobbafett: 'bobafett', vader: 'darthvader', han: 'hansolo', obi: 'obiwan', trooper: 'assault', assault: 'assault', heavy: 'heavy', officer: 'officer', specialist: 'specialist' };
const squeeze = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const ownerOf = (word) => OWNERS[squeeze(word)] ?? squeeze(word);

// A metadata row's owner and number from its telemetry name, else null:
// 'Ability Hero Emote Luke 2', 'Anakin - Emote 1', 'Grievous - Voiceline 1',
// 'Finn- Finn 5', 'Darth Vader MvP 3', 'Trooper MvP 1'
export function telemetryOf(t) {
  const s = String(t ?? '').trim();
  let m = /^Ability Hero Emote (.+?) (\d+)$/i.exec(s);
  if (m) return { owner: ownerOf(m[1]), n: Number(m[2]) };
  m = /^(.+?)\s*-\s*(?:Emote|Voiceline|\S+) (\d+)$/i.exec(s);
  if (m) return { owner: ownerOf(m[1]), n: Number(m[2]) };
  m = /^(.+?) MvP (\d+)$/i.exec(s);
  if (m) return { owner: ownerOf(m[1]), n: Number(m[2]) };
  m = /^Ability Emote The (.+)$/i.exec(s);
  if (m) return { owner: 'trooper', n: null, word: m[1] };
  return null;
}

// a localised string pointer → its key ('#XXXXXXXX'), the key set kept
function keyOf(asset, v, keys) {
  const o = v && typeof v.$ref === 'number' ? asset.objects[v.$ref] : v;
  if (!o || typeof o.StringHash !== 'number' || o.StringHash === 0) return null;
  const k = hashKey(o.StringHash);
  keys.add(k);
  return k;
}

// Every metadata row under an asset (its own `Items`, then the assets it
// lists, each once): [{ asset, row, where }]
export function metaRows(root, name, seen = new Set()) {
  if (seen.has(name.toLowerCase())) return [];
  seen.add(name.toLowerCase());
  const asset = loadAsset(root, name);
  if (!asset) return [];
  const out = [];
  asset.objects.forEach((o, i) => {
    if (o && Array.isArray(o.Identifiers) && typeof o.TelemetryId === 'string' && o.TelemetryId) out.push({ asset, row: o, set: shortName(name), where: `${asset.name ?? name}#${o.$type}.${i}` });
  });
  for (const a of rootOf(asset).Assets ?? []) if (a?.$asset) out.push(...metaRows(root, a.$asset, seen));
  return out;
}

const rarityOf = (r) => RARITY[r.Rarity ?? r.RarityType] ?? null;
const folderOf = (name) => name.slice(0, name.lastIndexOf('/')).toLowerCase();

// The crew file each source folder was cut from (the credits' titles name
// the mesh: "Star Wars Battlefront II (2017): characters/hero/luke/luke_hoth_01/luke_hoth_01_mesh")
// (and by what it is, "A snowtrooper" → snowtrooper: the NPC troopers' meshes
// were cut from the NPC folders, not the class's)
export function bodiesOf(credits) {
  const out = new Map();
  out.byName = new Map();
  for (const c of Object.values(credits ?? {})) {
    const m = /^Star Wars Battlefront II \(2017\): (.+)$/.exec(c?.title ?? '');
    const file = /\/crew\/([a-z0-9]+)\.glb$/.exec(c?.file ?? '');
    if (!m || !file) continue;
    const folder = folderOf(m[1]);
    if (!out.has(folder)) out.set(folder, file[1]);
    const what = squeeze(String(c.as ?? '').replace(/^(a|an) /i, ''));
    if (what && !out.byName.has(what)) out.byName.set(what, file[1]);
  }
  return out;
}

// A trooper's look as the game's record: the class's own look for the planet
// (Characters/Dark/D_Heavy_Orig/D_Heavy_Orig_MOS_01/MPVUR_D_Heavy_Orig_MOS_01),
// else the planet's kit's (the Empire's kits on Hoth, Scarif and the Death
// Star all wear D_<Class>_Orig_01, the stormtrooper)
function planetRecord(index, { side, cls, era, code, kit }) {
  const s = `${side}_${cls}_${era}`;
  const re = new RegExp(`^Characters/(Light|Dark)/${s}/${s}_${code}_\\d+/MP?VUR_${s}_${code}_\\d+$`, 'i');
  return [...index.keys()].find((n) => re.test(n) && index.get(n).type === 'VisualUnlockRootAsset') ?? kit ?? null;
}

// A hero's skin rows against its kit's appearances: [[appearance, row | null]].
// The telemetry names the hero as the designers say it (VUR_Dooku_01 for
// VUR_CountDooku_01, VUR_Maul_02 for VUR_DarthMaul_RobotLegs_01, VUR_Leia_ANH
// for VUR_Leia_Princess_01): matched with the hero's long names shortened,
// the same name or one it begins first, then what is left of the hero's
// rows and appearances paired in order (the same count each side, else
// left unmatched)
const ALIASES = [
  [/countdooku/g, 'dooku'],
  [/generalgrievous/g, 'grievous'],
  [/darthmaul/g, 'maul'],
  [/darthvader/g, 'vader'],
  [/hansolo/g, 'han'],
  [/bobafett/g, 'boba'],
];
export function skinKey(name) {
  let s = String(name ?? '')
    .toLowerCase()
    .replace(/^m?p?vur_/, '');
  for (const [re, to] of ALIASES) s = s.replace(re, to);
  return s;
}
export function matchSkins(apps, rows) {
  const keyOfApp = (a) => skinKey(a.id);
  const left = new Set(rows);
  const pairs = apps.map((a) => {
    const k = keyOfApp(a);
    const r = [...left].find((x) => skinKey(x.row.TelemetryId) === k) ?? [...left].find((x) => k.startsWith(`${skinKey(x.row.TelemetryId)}_`)) ?? null;
    if (r) left.delete(r);
    return [a, r];
  });
  // (what is left: the hero's rows by its name's first word, in order)
  const hero = apps.length ? keyOfApp(apps[0]).split('_')[0] : null;
  const rest = [...left].filter((x) => skinKey(x.row.TelemetryId).split('_')[0] === hero).sort((a, b) => (skinKey(a.row.TelemetryId) < skinKey(b.row.TelemetryId) ? -1 : 1));
  const open = pairs.filter(([, r]) => !r);
  if (rest.length && rest.length === open.length) open.forEach((p, i) => (p[1] = rest[i]));
  return pairs;
}

// The trooper skins' looks (by hand, from the kits' planet codes and the
// head folders, Characters/Heads/Heads_<Name>): a planet's armour, a clone
// legion, a rebel's head or species, a droid's paint
const PLANET_WORDS = [
  [/snow ?trooper/i, 'HO'],
  [/scar+if+|shore ?trooper/i, 'SCAR'],
  [/sand ?trooper/i, 'MOS'],
  [/scout ?trooper/i, 'EN'],
  [/(default)?stormtrooper/i, 'DS'],
];
export function lookOf(telemetry, aurebesh) {
  const t = String(telemetry ?? '');
  for (const [re, planet] of PLANET_WORDS) if (re.test(t) || re.test(aurebesh ?? '')) return { planet };
  const legion = /_(\d{2,3}|CGuard|Theed|Jungle|Kashyyyk|Navy|Desert)(?:_(?:Scout|Desert))?(?:_P([012]))?$/i.exec(t);
  if (legion) return { legion: legion[1], ...(legion[2] ? { phase: Number(legion[2]) } : {}) };
  const head = /_(Orig|NewEra|Preq)_([A-Za-z]+)$/.exec(t);
  if (head) return { head: head[2] };
  if (/PlanetDefault|_Default$|Default$/.test(t)) return { planet: 'default' };
  return null;
}

export function collectionRulebook(root, { books = {}, strings = null, credits = {} } = {}) {
  const index = indexOf(root);
  const keys = new Set();
  const skipped = [];
  const missing = [];
  const bodies = bodiesOf(credits);
  const out = { characters: {}, skins: {}, abilities: {}, cards: {}, emotes: {}, poses: {}, voiceLines: {} };
  const named = (asset, r) => ({ name: keyOf(asset, r.NameLocalizedStringId, keys), ...(r.DescriptionLocalizedStringId ? { description: keyOf(asset, r.DescriptionLocalizedStringId, keys) } : {}) });

  // ── the heroes ──
  const records = new Map();
  const heroSkinRows = metaRows(root, META.heroSkins);
  const used = new Set();
  const heroKits = [...index.keys()].filter((n) => /^Gameplay\/Kits\/Hero\/[^/]+\/(Kits?\/)?Kit_Hero_[^/]+$/.test(n) && index.get(n).type === 'WSSoldierCustomizationKitAsset');
  for (const kitName of heroKits.sort()) {
    const id = kitName.split('/')[3].toLowerCase();
    if (isEra(kitName) || isSequel(kitName)) {
      skipped.push(kitName);
      continue;
    }
    const kit = follow(root, kitName);
    if (!kit) continue;
    const book = books.heroes?.[id] ?? null;
    const row = { kind: 'hero', side: book?.side ?? null, name: book?.name ?? `ID_CHAR_${id.toUpperCase()}`, kit: kitName, skins: [], abilities: [], cards: [], emotes: [], poses: [], voiceLines: [] };
    const apps = [];
    let sequelApps = 0;
    for (const app of rootOf(kit).Appearances ?? []) {
      // (the sequel's looks a hero kept, Palpatine's EP9 robes, are left out)
      if (isSequel(app.$asset)) {
        skipped.push(app.$asset);
        sequelApps++;
        continue;
      }
      const rec = follow(root, app);
      if (!rec) missing.push(`appearance: ${app.$asset}`);
      else apps.push({ app, rec, id: String(rootOf(rec).DebugUnlockId ?? shortName(app.$asset)) });
    }
    const pairs = matchSkins(apps, heroSkinRows.filter((r) => !used.has(r.where)));
    const hero = apps.length ? skinKey(apps[0].id).split('_')[0] : null;
    for (const [{ app, id: skinId }, meta] of pairs) {
      if (meta) used.add(meta.where);
      else missing.push(`skin row: ${app.$asset}`);
      out.skins[skinId] = {
        of: id,
        ...(meta ? named(meta.asset, meta.row) : { name: null }),
        aurebesh: meta?.row.AurebeshName?.trim() || null,
        rarity: meta ? rarityOf(meta.row) : null,
        record: app.$asset,
        body: bodies.get(folderOf(app.$asset)) ?? null,
        _source: meta ? meta.where : `${kitName}#WSSoldierCustomizationKitAsset.Appearances`,
      };
      row.skins.push(skinId);
    }
    // (a row of the hero's left over where a sequel look was left out: that look's)
    if (sequelApps) for (const r of heroSkinRows) if (!used.has(r.where) && skinKey(r.row.TelemetryId).split('_')[0] === hero) (used.add(r.where), skipped.push(`skin row: ${r.row.TelemetryId}`));
    // the star cards: the gameplay asset's additional abilities, in their numbers' order
    const gp = follow(root, rootOf(kit).Gameplay);
    const abilities = gp ? gameplayAbilities(gp) : [];
    row.cards = abilities.filter((a) => /\/StarCards\/StarCard_/.test(a)).sort((a, b) => cardNumber(a) - cardNumber(b)).map(shortName);
    row.poses = abilities.filter((a) => /\/VictoryPoses\//.test(a)).map(shortName).sort();
    // (the hero's records by name, for what its cards change: its cards' own, and every ability a card may hold a time of)
    records.set(id, { cards: abilities.filter((a) => /\/StarCards\/StarCard_/.test(a)), abilities: [...new Set([...abilities, ...(gp ? defaultAbilities(gp) : [])])].filter((a) => !/\/(StarCards|VictoryPoses|Emotes|VoiceLines)\//.test(a)) });
    out.characters[id] = row;
  }
  // (a hero's row no appearance took; the troopers' default rows here are
  // the class screens', which read their kits' own)
  const heroKeys = new Set(Object.values(out.skins).map((s) => skinKey(shortName(s.record)).split('_')[0]));
  for (const r of heroSkinRows) if (!used.has(r.where) && !isSequel(r.row.TelemetryId) && heroKeys.has(skinKey(r.row.TelemetryId).split('_')[0])) missing.push(`no appearance for ${r.row.TelemetryId} (${r.where})`);

  // ── the emotes, poses and voice lines, by owner and number ──
  for (const [book, name] of [['emotes', META.emotes], ['poses', META.poses], ['voiceLines', META.voiceLines]]) {
    for (const r of metaRows(root, name)) {
      const t = telemetryOf(r.row.TelemetryId);
      if (!t) continue;
      if (isSequel(t.owner) || /^(bb8|bb9e|finn|phasma|rey|kylo|kyloren)$/.test(t.owner)) {
        skipped.push(`${book}: ${r.row.TelemetryId}`);
        continue;
      }
      const owner = out.characters[t.owner] ? t.owner : t.owner === 'trooper' || CLASSES.some((c) => c.toLowerCase() === t.owner) ? t.owner : null;
      if (!owner) {
        missing.push(`${book} owner: ${r.row.TelemetryId}`);
        continue;
      }
      const id = t.n != null ? `${owner}.${t.n}` : `${owner}.${squeeze(t.word)}`;
      if (out[book][id]) continue; // (Han's first is listed twice)
      // (a hero's pose is an ability of its own, Pose_HeroVictoryPose_Hero_<Hero>_MvP<n>)
      const pose = book === 'poses' ? (out.characters[owner]?.poses ?? []).find((p) => Number(/(\d+)$/.exec(p)?.[1]) === t.n) ?? null : null;
      out[book][id] = { of: owner, n: t.n, ...named(r.asset, r.row), rarity: rarityOf(r.row), ...(pose ? { ability: pose } : {}), _source: r.where };
    }
  }
  const byOwner = (book, owner) =>
    Object.entries(out[book])
      .filter(([, x]) => x.of === owner)
      .sort((a, b) => (a[1].n ?? 0) - (b[1].n ?? 0) || (a[0] < b[0] ? -1 : 1))
      .map(([id]) => id);
  for (const [id, ch] of Object.entries(out.characters)) for (const book of ['emotes', 'poses', 'voiceLines']) ch[book] = byOwner(book, id);

  // ── the heroes' abilities and star cards, as their ability screens name
  // them (`UI/Metadata/<Hero>AbilityUIMetaData`: the name, the text, the
  // icon, a card's art and its four levels; a campaign row, `… SP`, left out) ──
  for (const name of [...index.keys()].filter((n) => ABILITY_META.test(n)).sort()) {
    const owner = ownerOf(ABILITY_META.exec(name)[1]);
    const ch = out.characters[owner];
    if (!ch || ch.kind !== 'hero') continue;
    const asset = loadAsset(root, name);
    const at = (v) => (v && typeof v.$ref === 'number' ? asset.objects[v.$ref] : null);
    const kept = { abilities: [], cards: [] };
    asset.objects.forEach((r, i) => {
      if (r?.$type !== 'UIPlayerAbilityMetaData' || / ?SP$|- SP$/.test(r.TelemetryId ?? '')) return;
      const where = `${name}#UIPlayerAbilityMetaData.${i}`;
      const base = { of: owner, ...named(asset, r), ...(r.ShortEffectLocalizedStringId ? { short: keyOf(asset, r.ShortEffectLocalizedStringId, keys) } : {}), rarity: rarityOf(r), icon: r.SvgImage?.$asset ?? null };
      // ('Star Card - Luke - Star Card 1', 'Star Card 7 - Raw Strength')
      const card = /^Star Card - .+? - Star Card (\d+)$/i.exec(r.TelemetryId ?? '') ?? /^Star Card (\d+)\s*-/i.exec(r.TelemetryId ?? '');
      if (card && r.HasStarCardData) {
        const n = Number(card[1]);
        const data = at(r.StarCardData);
        const mod = at(data?.ModifiersMetaData?.[0]) ?? data?.ModifiersMetaData?.[0] ?? null;
        const p = mod?.StatParams ?? null;
        out.cards[`${owner}.${n}`] = {
          ...base,
          n,
          art: r.ModifierIcon?.$asset ?? null,
          image: data?.Image3D?.$asset ?? data?.Image2D?.$asset ?? null,
          levels: p ? [p.Arg0, p.Arg1, p.Arg2, p.Arg3] : null,
          ...(mod?.ScalingUnitLocalizedStringId ? { unit: keyOf(asset, mod.ScalingUnitLocalizedStringId, keys) } : {}),
          ...(mod ? { percent: Boolean(mod.IsPercent) } : {}),
          ability: ch.cards.find((c) => cardNumber(c) === n) ?? null,
          _source: where,
        };
        kept.cards.push(`${owner}.${n}`);
        return;
      }
      const slot = SLOTS[r.Category];
      if (!slot) return;
      const aid = `${owner}.${slot}`;
      out.abilities[aid] = { ...base, slot, _source: where };
      kept.abilities.push(aid);
    });
    ch.abilities = kept.abilities.sort((a, b) => SLOT_ORDER.indexOf(out.abilities[a].slot) - SLOT_ORDER.indexOf(out.abilities[b].slot));
    for (const c of ch.cards) if (!kept.cards.includes(`${owner}.${cardNumber(c)}`)) missing.push(`card row: ${c}`);
    ch.cards = kept.cards.sort((a, b) => out.cards[a].n - out.cards[b].n);
  }

  // ── what each card changes, where its records or the design's table say (bf2017-rulebook-cards.mjs) ──
  for (const [id, card] of Object.entries(out.cards)) {
    const rec = records.get(card.of);
    const name = rec?.cards.find((n) => shortName(n) === card.ability) ?? null;
    const effect = name ? cardEffect(root, id, card, { name, abilities: rec.abilities }) : null;
    if (effect) card.effect = effect;
  }

  // ── the trooper classes, by faction ──
  const trooperRows = metaRows(root, META.trooperSkins);
  for (const cls of CLASSES) {
    const id = cls.toLowerCase();
    const row = { kind: 'trooper', name: `ID_CLASS_${cls.toUpperCase()}`, factions: {}, emotes: [], poses: [], voiceLines: [] };
    for (const [key, faction] of Object.entries(FACTIONS)) {
      const [era, side] = key.split(':');
      const kits = [...index.keys()].filter((n) => new RegExp(`^Gameplay/Kits/MP/${cls}/Kit_${side}_${cls}_${era}_[A-Z]+$`).test(n)).sort();
      const planetOf = (code) => kits.find((k) => k.endsWith(`_${code}`)) ?? null;
      const skins = [];
      for (const r of trooperRows) {
        const set = r.set.toLowerCase();
        const t = r.row.TelemetryId;
        if (isSequel(set) || /newera/i.test(set) || /newera/i.test(t)) continue;
        // (the game's own typo: `Heay_Orig_Shoretrooper` is the heavy's)
        const prefix = new RegExp(`^(${cls}${cls === 'Heavy' ? '|Heay' : ''})_`, 'i');
        const inSet = set.startsWith(`${id}_`) || (set.startsWith('droid_b1') && faction === 'cis');
        if (!inSet || !prefix.test(t)) continue;
        // (the clones' looks by phase, <Class>_PHA_Preq, replaced the class's first legion set)
        if (set === `${id}_preq_skinuimetadata` && trooperRows.some((x) => x.set.toLowerCase() === `${id}_pha_preq_skinuimetadata`)) continue;
        if (rowSide(set, t, r.row.AurebeshName) !== side || rowEra(set) !== era) continue;
        const look = set.startsWith('droid_b1') ? { paint: t.replace(prefix, '') } : lookOf(t, r.row.AurebeshName);
        const kit = look?.planet && look.planet !== 'default' ? planetOf(look.planet) : null;
        const kitAsset = kit ? follow(root, kit) : null;
        const app = kit ? planetRecord(index, { side, cls, era, code: look.planet, kit: rootOf(kitAsset ?? { objects: [{}], root: 0 }).Appearances?.[0]?.$asset }) : null;
        const skinId = `${id}.${faction}.${squeeze(t.replace(prefix, '').replace(/^(Orig|Preq)_/i, ''))}`;
        // (the armour's name, the row's or its telemetry's: SNOWTROOPER, ScoutTrooper)
        const armour = squeeze(/(snow|shore|sand|scout|storm)\s*trooper/i.exec(`${r.row.AurebeshName} ${t}`)?.[0] ?? '');
        const body = (app ? bodies.get(folderOf(app)) : null) ?? (armour ? bodies.byName?.get(armour) : null) ?? null;
        // (a stand-in where the site has the kind but not the look: a rebel's
        // body under any rebel's head, a clone's under any legion's paint)
        const stand = body
          ? null
          : look?.head
            ? (bodies.byName?.get(side === 'L' ? 'rebeltrooper' : cls === 'Officer' ? 'imperialofficer' : '') ?? null)
            : look?.legion
              ? (bodies.byName?.get(look.phase === 1 ? 'clonetrooperphasei' : 'clonetrooperphaseii') ?? null)
              : null;
        out.skins[skinId] = {
          of: id,
          faction,
          ...named(r.asset, r.row),
          aurebesh: r.row.AurebeshName?.trim() || null,
          rarity: rarityOf(r.row),
          set: r.set,
          look,
          record: app,
          body,
          ...(stand ? { stand } : {}),
          _source: r.where,
          ...(look ? {} : { _look: 'hand: no planet, legion or head in its name' }),
        };
        skins.push(skinId);
      }
      // (the class's default look first, as the game equips it: DEFAULT APPEARANCE)
      const isDefault = (sid) => out.skins[sid].aurebesh === 'DEFAULT APPEARANCE' || out.skins[sid].look?.planet === 'default';
      skins.sort((a, b) => Number(isDefault(b)) - Number(isDefault(a)));
      row.factions[faction] = { side: side === 'L' ? 'light' : 'dark', era: era.toLowerCase(), kits, skins };
    }
    out.characters[id] = row;
  }
  // the troopers' shared emotes (the class rows list them all), their poses by class
  const shared = Object.keys(out.emotes).filter((e) => out.emotes[e].of === 'trooper');
  for (const cls of CLASSES) {
    const ch = out.characters[cls.toLowerCase()];
    ch.emotes = shared.slice().sort();
    ch.poses = Object.entries(out.poses)
      .filter(([, p]) => p.of === cls.toLowerCase())
      .sort((a, b) => a[1].n - b[1].n)
      .map(([pid]) => pid);
  }

  // ── the reinforcements' skins ──
  const SPECIALS = { BX: 'BX', ImperialJumpTrooper: 'JumpTrooper', CloneJetTrooper: 'CloneJumpTrooper', ARCTrooper: 'ARC', CloneCommando: 'CloneCommando', Wookiee: 'WookieWarrior', Droideka: 'Droideka' };
  for (const r of metaRows(root, META.specialSkins)) {
    const m = /^([A-Za-z]+)\s*-\s*(.+)$/.exec(r.row.TelemetryId);
    const sid = m && SPECIALS[m[1]];
    if (!sid) continue;
    const kitName = [...index.keys()].find((n) => new RegExp(`^Gameplay/Kits/Specials/${sid}/Kit_Special_[^/]+$`, 'i').test(n)) ?? null;
    const book = books.reinforcements?.[sid] ?? null;
    const ch = (out.characters[sid] ??= { kind: 'special', side: book?.side ?? null, name: null, kit: kitName, skins: [] });
    const skinId = `${sid}.${squeeze(m[2])}`;
    out.skins[skinId] = { of: sid, ...named(r.asset, r.row), aurebesh: r.row.AurebeshName?.trim() || null, rarity: rarityOf(r.row), set: r.set, record: null, body: null, _source: r.where };
    ch.skins.push(skinId);
  }

  // ── every one's name and words, as the game's character screen gives them
  // (`UI/Metadata/CharacterUIMetaData`, by its telemetry: 'Luke',
  // 'Obi-Wan', 'Hansolo', 'ARC Trooper', 'Clone Jumptrooper aka Jet Trooper') ──
  const people = metaRows(root, META.characters);
  for (const [id, ch] of Object.entries(out.characters)) {
    const k = squeeze(id);
    const r = people.find((x) => squeeze(x.row.TelemetryId) === k) ?? people.find((x) => squeeze(x.row.TelemetryId).startsWith(k));
    if (!r) {
      missing.push(`character row: ${id}`);
      continue;
    }
    ch.name = keyOf(r.asset, r.row.NameUpperLocalizedStringId, keys) ?? keyOf(r.asset, r.row.NameLocalizedStringId, keys) ?? ch.name;
    const about = keyOf(r.asset, r.row.DescriptionLocalizedStringId, keys);
    if (about) ch.description = about;
    ch._name = r.where;
  }

  out.labels = { ...LABELS };
  for (const k of Object.values(LABELS)) keys.add(k);
  out.strings = {};
  for (const k of [...keys].sort()) {
    const t = englishOf(k, strings);
    if (t !== undefined) out.strings[k] = t.replace(/�/g, '’');
  }
  out._skipped = [...new Set(skipped)].sort();
  out._missing = [...new Set(missing)].sort();
  return out;
}

// the abilities a gameplay asset holds (its customisation's all, then its additional)
function gameplayAbilities(gp) {
  const r = rootOf(gp);
  const at = (v) => (v && typeof v.$ref === 'number' ? gp.objects[v.$ref] : v);
  const custom = at(r.Abilities);
  const all = at(custom?.AllAbilities);
  return [...(all?.Abilities ?? []), ...(custom?.AdditionalAbilities ?? [])].map((a) => a?.$asset).filter(Boolean);
}
// the abilities a kit starts with: its three, its primary, its dodge
function defaultAbilities(gp) {
  const at = (v) => (v && typeof v.$ref === 'number' ? gp.objects[v.$ref] : v);
  return (at(rootOf(gp).Abilities)?.DefaultAbilities ?? []).map((a) => a?.$asset).filter(Boolean);
}
const cardNumber = (name) => Number(/StarCard_[^_/]+_(\d+)/.exec(name)?.[1] ?? 0);

// which side a trooper skin row is: the set's own (a B1's is the droids'),
// else its name (REBEL, IMPERIAL, a trooper's armour)
function rowSide(set, telemetry, aurebesh) {
  if (/^droid_b1/.test(set)) return 'D';
  if (/preq/.test(set)) return 'L';
  const a = `${telemetry} ${aurebesh ?? ''}`;
  if (/rebel/i.test(a)) return 'L';
  return 'D';
}
const rowEra = (set) => (/preq/.test(set) ? 'Preq' : /orig/.test(set) ? 'Orig' : null);
