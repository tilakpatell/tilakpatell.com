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
//   picksOf(store, id) → { skin, emote, pose, voiceLine, cards } with the game's defaults
//   pick(store, id, field, value) → the store with that pick (cards: one toggled, three at most)
//   appearanceOf(store, id) → the crew kind the pick wears in the field, or null
//   readStore(storage), writeStore(storage, store): `bf-collection`, never throwing

import BOOK from '../../data/bf2017/collection.json';
import { bitmap, portrait } from './ui';
import { text } from './strings';

export const STORE_KEY = 'bf-collection';
export const CARD_SLOTS = 3; // (a hero carries three of its nine)
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const FACTIONS = ['rebel', 'empire', 'republic', 'cis'];
export const FACTION_SIDE = { rebel: 'light', empire: 'dark', republic: 'light', cis: 'dark' };

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

export function say(key) {
  if (!key) return '';
  return BOOK.strings[key] ?? text(key);
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
  return c ? { id, ...c, title: say(c.name) || id } : null;
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

export function picksOf(store, id, { faction = null } = {}) {
  const own = store?.[id] ?? {};
  const skins = skinsFor(id, { faction: faction ?? own.faction ?? null });
  return {
    faction: C[id]?.kind === 'trooper' ? (faction ?? own.faction ?? factionsOf(id)[0] ?? null) : null,
    skin: skins.some((s) => s.id === own.skin) ? own.skin : (skins[0]?.id ?? null),
    emote: own.emote ?? null,
    pose: own.pose ?? picksFor(id, 'poses')[0]?.id ?? null,
    voiceLine: own.voiceLine ?? null,
    cards: (own.cards ?? []).filter((k) => C[id]?.cards?.includes(k)).slice(0, CARD_SLOTS),
  };
}

export function pick(store, id, field, value) {
  const was = store?.[id] ?? {};
  let next;
  if (field === 'cards') {
    const cards = was.cards ?? [];
    next = cards.includes(value) ? cards.filter((k) => k !== value) : cards.length < CARD_SLOTS ? [...cards, value] : cards;
  } else next = value;
  return { ...(store ?? {}), [id]: { ...was, [field]: next } };
}

export function appearanceOf(store, id) {
  const p = picksOf(store, id);
  const s = p.skin ? skinRow(p.skin) : null;
  return s?.body ?? s?.stand ?? null;
}

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
