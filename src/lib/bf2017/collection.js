// The 2017 game's Collection, for its screens (src/data/bf2017/collection.json,
// scripts/lib/bf2017-rulebook-collection.mjs): who is in it, each one's
// skins, abilities, star cards, emotes, victory poses and voice lines in the
// game's words, and the picks a player keeps. Pure apart from the storage
// it is handed.
//
//   roster() → { heroes: { light: [id…], dark: [id…] }, troopers: [id…], specials: [id…] }
//   character(id) → { id, kind, side, name, … } | null
//   factionsOf(id) → the factions a trooper class has skins in ('rebel', 'empire', 'republic', 'cis')
//   skinsFor(id, { faction }) → [{ id, name, description, aurebesh, rarity, body, stand }]
//   abilitiesFor(id), cardsFor(id), picksFor(id, 'emotes' | 'poses' | 'voiceLines')
//   cardLine(card, level) → its short effect with the level's number in ('8%')
//   say(key) → a key's English (the book's own, else the game's table)
//   stageSpec(id, skinId) → the hero-select stage's figure for that skin, or null
//   portraitOf(id, faction) → its portrait's url (a class's by faction), or null; iconKey(svgAsset)
//   picksOf(store, id, { faction }) → { faction, skin, pose, cards, emotes, voiceLines } with the game's defaults
//   pick(store, id, field, value, { faction }) → the store with that pick (a slot field toggled, SLOTS at most)
//   appearanceOf(store, id, { faction }) → the crew kind the pick wears in the field, or null
//   characterOfOffer(offer) → { id, faction } | null: a deploy offer's character
//   label(name) → one of the screens' run-time words (EQUIP STAR CARDS, REINFORCEMENTS …)
//   readStore(storage), writeStore(storage, store): `bf-collection`, never throwing

import BOOK from '../../data/bf2017/collection.json';
import { bitmap, portrait } from './ui';
import { text } from './strings';

export const STORE_KEY = 'bf-collection';
export const CARD_SLOTS = 3; // (a hero carries three of its nine)
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const FACTIONS = ['rebel', 'empire', 'republic', 'cis'];
export const FACTION_SIDE = { rebel: 'light', empire: 'dark', republic: 'light', cis: 'dark' };
// (the four sides as the game's choose-side tiles name them: CSTile_OT_LightSide_RebelAlliance …)
export const FACTION_NAMES = { rebel: 'REBEL ALLIANCE', empire: 'GALACTIC EMPIRE', republic: 'GALACTIC REPUBLIC', cis: 'SEPARATISTS' };

// a hero's clip pack on the site (galaxy/surface/crewList.js's `pack`s; the
// heroes with none of their own stand in the humanoid's)
export const PACKS = { luke: 'luke', leia: 'leia', hansolo: 'han', chewbacca: 'chewie', lando: 'lando', obiwan: 'obiwan', anakin: 'anakin', bobafett: 'bobafett', bossk: 'bossk', darthvader: 'vader', emperor: 'palpatine', maul: 'maul', dooku: 'dooku' };
export const CREW_DIR = '/models/galaxy/bf2017/crew';
// each one's portrait (UI/Bitmaps/Portraits/Portrait_<name>), a class's by faction
export const PORTRAITS = { luke: 'LukeSkywalker', leia: 'LeiaOrgana', hansolo: 'HanSolo', chewbacca: 'Chewbacca', lando: 'LandoCalrissian', yoda: 'Yoda', obiwan: 'ObiWan', anakin: 'Anakin', darthvader: 'DarthVader', emperor: 'Palpatine', bobafett: 'BobaFett', bossk: 'Bossk', iden: 'IdenVersio', maul: 'DarthMaul', dooku: 'Dooku', grievous: 'Grievous', ARC: 'ARCTrooper', BX: 'BXCommando', CloneCommando: 'CloneCommando', CloneJumpTrooper: 'CloneJetTrooper', Droideka: 'Droideka', WookieWarrior: 'WookieWarrior' };
const FACTION_PORTRAITS = { rebel: 'TH_RebelDuros', empire: 'TH_ImperialOfficer', republic: 'TH_Phase2_SpecialistClone', cis: 'TH_SeparatistDroid' };
export const portraitOf = (id, faction = null) => portrait(C[id]?.kind === 'trooper' ? FACTION_PORTRAITS[faction ?? factionsOf(id)[0]] : PORTRAITS[id]);
// an icon's name in the sprites (the last two parts of its SvgImage's)
export const iconKey = (asset) => (asset ? asset.split('/').slice(-2).join('/') : null);

const C = BOOK.characters;
const ORDER = ['luke', 'leia', 'hansolo', 'chewbacca', 'lando', 'yoda', 'obiwan', 'anakin', 'darthvader', 'emperor', 'bobafett', 'bossk', 'iden', 'maul', 'dooku', 'grievous'];
const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

// (the game's text spells "fl" and "fi" with their ligatures, which the
// site's open text face has no glyph for: Deﬂecting would read "De ecting")
const LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };
const plain = (s) => s.replace(/[ﬀ-ﬄ]/g, (c) => LIGATURES[c]);

export function say(key) {
  if (!key) return '';
  return plain(BOOK.strings[key] ?? text(key));
}

export function roster() {
  const ids = Object.keys(C);
  const heroes = ids.filter((id) => C[id].kind === 'hero').sort((a, b) => rank(a) - rank(b));
  return {
    heroes: { light: heroes.filter((id) => C[id].side === 'light'), dark: heroes.filter((id) => C[id].side !== 'light') },
    troopers: ['assault', 'heavy', 'officer', 'specialist'].filter((id) => C[id]),
    specials: ids.filter((id) => C[id].kind === 'special'),
  };
}

export function character(id) {
  const c = C[id];
  return c ? { id, ...c, title: say(c.name) || id, about: say(c.description) } : null;
}

export const factionsOf = (id) => FACTIONS.filter((f) => C[id]?.factions?.[f]?.skins?.length);

const skinRow = (id) => {
  const s = BOOK.skins[id];
  return s ? { id, name: say(s.name) || s.aurebesh || id, description: say(s.description), aurebesh: s.aurebesh, rarity: s.rarity ?? 'common', body: s.body ?? null, stand: s.stand ?? null, look: s.look ?? null, faction: s.faction ?? null } : null;
};

export function skinsFor(id, { faction = null } = {}) {
  const c = C[id];
  if (!c) return [];
  const ids = c.kind === 'trooper' ? (c.factions?.[faction ?? factionsOf(id)[0]]?.skins ?? []) : (c.skins ?? []);
  return ids.map(skinRow).filter(Boolean);
}

export const abilitiesFor = (id) =>
  (C[id]?.abilities ?? [])
    .map((a) => BOOK.abilities[a] && { id: a, ...BOOK.abilities[a], name: say(BOOK.abilities[a].name), description: say(BOOK.abilities[a].description) })
    .filter(Boolean);

export const cardsFor = (id) =>
  (C[id]?.cards ?? [])
    .map((k) => {
      const c = BOOK.cards[k];
      return c && { id: k, ...c, name: say(c.name), description: say(c.description), short: say(c.short), unit: say(c.unit), art: bitmap(c.image) };
    })
    .filter(Boolean);

// a card's short effect with a level's number in it ({0:s} → '12%')
export function cardLine(card, level = 0) {
  const v = card?.levels?.[Math.max(0, Math.min(3, level))];
  const line = card?.short || card?.description || '';
  if (v == null) return line.replace(/\{0(:s)?\}/g, '').replace(/\s+/g, ' ').trim();
  return line.replace(/\{0(:s)?\}/g, `${v}${card.percent ? '%' : ''}`);
}

export const picksFor = (id, book) =>
  (C[id]?.[book] ?? [])
    .map((k) => BOOK[book]?.[k] && { id: k, n: BOOK[book][k].n, name: say(BOOK[book][k].name) || k, rarity: BOOK[book][k].rarity ?? 'common' })
    .filter(Boolean);

// the figure the hero-select stage shows for a skin: its body, else its stand-in
export function stageSpec(id, skinId) {
  const s = skinRow(skinId) ?? skinsFor(id)[0];
  const kind = s?.body ?? s?.stand;
  if (!kind) return null;
  return { name: s.name, rig: 'walrus', src: { url: `${CREW_DIR}/${kind}.glb` }, pack: PACKS[id] ?? null, kind };
}

// ── the picks ──
// (kept by character, a trooper class's by faction too: `assault.empire`,
// as the game keeps a class's look for each side it fights on; the cards,
// emotes and voice lines are slots the game fills that many of: three
// cards, four emotes and four voice lines on the commo rose, one pose)

export const SLOTS = { cards: CARD_SLOTS, emotes: 4, voiceLines: 4 };
export const keyOf = (id, faction = null) => (C[id]?.kind === 'trooper' ? `${id}.${faction ?? factionsOf(id)[0]}` : id);

export function picksOf(store, id, { faction = null } = {}) {
  const f = C[id]?.kind === 'trooper' ? (faction ?? factionsOf(id)[0] ?? null) : null;
  const own = store?.[keyOf(id, f)] ?? {};
  const skins = skinsFor(id, { faction: f });
  const kept = (field) => {
    const have = new Set(field === 'cards' ? (C[id]?.cards ?? []) : (C[id]?.[field] ?? []));
    return (own[field] ?? []).filter((k) => have.has(k)).slice(0, SLOTS[field]);
  };
  return {
    faction: f,
    skin: skins.some((s) => s.id === own.skin) ? own.skin : (skins[0]?.id ?? null),
    pose: own.pose ?? picksFor(id, 'poses')[0]?.id ?? null,
    cards: kept('cards'),
    emotes: kept('emotes'),
    voiceLines: kept('voiceLines'),
  };
}

export function pick(store, id, field, value, { faction = null } = {}) {
  const key = keyOf(id, faction);
  const was = store?.[key] ?? {};
  let next = value;
  if (SLOTS[field]) {
    const have = was[field] ?? [];
    next = have.includes(value) ? have.filter((k) => k !== value) : have.length < SLOTS[field] ? [...have, value] : have;
  }
  return { ...(store ?? {}), [key]: { ...was, [field]: next } };
}

export function appearanceOf(store, id, { faction = null } = {}) {
  const p = picksOf(store, id, { faction });
  const s = p.skin ? skinRow(p.skin) : null;
  return s?.body ?? s?.stand ?? null;
}

// a deploy screen's offer → its Collection character and faction: a class's
// id ('l-orig-assault', the rulebook's), a hero's or a reinforcement's id
const ERA_SIDE = { 'l-orig': 'rebel', 'd-orig': 'empire', 'l-preq': 'republic', 'd-preq': 'cis' };
export function characterOfOffer(o) {
  if (!o?.id) return null;
  const m = /^([ld]-(?:orig|preq))-([a-z]+)$/.exec(o.id);
  if (m && C[m[2]]) return { id: m[2], faction: ERA_SIDE[m[1]] };
  const id = Object.keys(C).find((k) => k.toLowerCase() === String(o.id).toLowerCase());
  return id ? { id, faction: null } : null;
}

// the words the screens' trees leave to run time (collection.json's labels)
export const label = (name) => say(BOOK.labels?.[name]);

export function readStore(storage) {
  try {
    const raw = storage?.getItem(STORE_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function writeStore(storage, store) {
  try {
    storage?.setItem(STORE_KEY, JSON.stringify(store ?? {}));
    return true;
  } catch {
    return false;
  }
}
