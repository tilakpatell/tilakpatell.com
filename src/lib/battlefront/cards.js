// A hero's star cards as modifiers (the hero-kit lane). The Collection's
// book (collection.json) holds each card with its four levels and, where the
// game's records or the design's table say what it changes, an `effect`:
// the kind (the design's T1 to T13), what it is on (an ability, the hero's
// own blaster, the hero), which number, how (`set`, `mul`, `add`) and the
// four values, each with its record. A card is worn at its top rank (the
// game design: everything unlocked), three to a unit, as the store keeps
// them. Pure.
//
// A card that is one of an ability's times sets it: the game's ability
// reloads its timer from the card's bound value outright, so "recharges
// 30 % sooner" is, in the records, a replacement time a level, and those
// four times are what the book holds. A factor made from a card's
// percentage is only ever a `derived:` source in the book.
//
//   MODELLED                 the kinds a card's modifiers are made for; the rest give none (NOTES.md, "Not modelled")
//   CARD_SLOTS, TOP          three cards a unit; the top rank, levels[3]
//   modifiersOf(card, level = TOP) → [{ on, property, op: 'mul' | 'add' | 'set', value, while?: abilityId }]
//     (on: an ability's id, 'primary' the unit's own gun, 'self' the unit; while: only as long as that ability lasts)
//   cardsFor(unitId, picked, rulebook) → [card rows, each with its id]   (the unit's own, at most three, in the picked order)

import BOOK from '../../data/bf2017/collection.json';

export const MODELLED = ['T1', 'T3', 'T5', 'T6', 'T7', 'T9', 'T10'];
// (src/lib/bf2017/collection.js's CARD_SLOTS, the Collection's own: a hero carries three of its nine)
export const CARD_SLOTS = 3;
export const TOP = 3;

export function modifiersOf(card, level = TOP) {
  const e = card?.effect;
  if (!e || !MODELLED.includes(e.type) || !Array.isArray(e.values)) return [];
  const value = e.values[Math.max(0, Math.min(e.values.length - 1, level))];
  if (typeof value !== 'number') return [];
  return [{ on: e.target, property: e.property, op: e.op, value, ...(e.while ? { while: e.while } : {}) }];
}

export function cardsFor(unitId, picked, rulebook = null) {
  const book = rulebook?.collection ?? BOOK;
  const own = new Set(book.characters?.[unitId]?.cards ?? []);
  const out = [];
  if (!Array.isArray(picked)) return out;
  for (const id of picked) {
    if (!own.has(id) || !book.cards?.[id] || out.some((c) => c.id === id)) continue;
    out.push({ id, ...book.cards[id] });
    if (out.length >= CARD_SLOTS) break;
  }
  return out;
}
