// How two pilots stand to each other, and what a pilot's factions say of
// them, as plain rules over what came in the hello (protocol.js reads `f`
// into factions: every field an id from a list we already have, or null).
// Pure, tested in Node; pilots.js colours the tags by it and Online.jsx
// writes the roster's line with it.
//
// factions: { side (sides.js: whose universe their ship is from), standing
//   ({ law, civil, outlaw } standing.js level names, or null each: with
//   that side), war, oath (galaxy/sides.js: the side they swore to in the
//   war they fight in), rank (galaxy/ranks.js: on the oath's side) }
// relation(me, peer) → 'ally' | 'friend' | 'foe' | 'none' (each { ally,
//   factions }: me.ally, whether they're your ally; the peer as the client
//   has them, an ally or a mate in your party: mates.js's isMate, so the two
//   read alike on the tags and in the roster); factionText(factions)
//   → 'Rebellion · Captain · Wanted by the Empire', or ''; factionsFrom(side,
//   marks) → your own factions, from the side your ship is from (sides.js's
//   sideOf, which the caller asks: the universe's data stays out of the
//   roster's download) and the wallet's marks (EconomyProvider.jsx's marks()).

import { SIDES as WAR_SIDES, warOfSide } from '../../galaxy/sides';
import { RANKS } from '../../galaxy/ranks';
import { WHO } from '../standing';
import { isMate } from './mates';

export const NO_FACTIONS = Object.freeze({ side: null, standing: null, war: null, oath: null, rank: null });

const isAlly = (a) => a === true || a === 'ally';

export function relation(me, peer) {
  if (isAlly(me?.ally) || isMate(peer)) return 'ally';
  const a = me?.factions ?? NO_FACTIONS;
  const b = peer?.factions ?? NO_FACTIONS;
  // (two sides of different wars aren't fighting each other)
  if (a.oath && b.oath && a.oath !== b.oath && warOfSide(a.oath) === warOfSide(b.oath)) return 'foe';
  const sameSide = Boolean(a.side) && a.side === b.side;
  if (sameSide && b.standing?.law === 'wanted') return 'foe';
  if (a.oath && a.oath === b.oath) return 'friend';
  if (sameSide && a.standing?.law === 'trusted' && b.standing?.law === 'trusted') return 'friend';
  return 'none';
}

// one standing a line has room for: the one that matters most to whoever
// meets them, the law's word first
const TELLING = [
  ['law', 'wanted', 'Wanted by'],
  ['outlaw', 'friend', 'Friend to'],
  ['law', 'trusted', 'Trusted by'],
  ['civil', 'hero', 'Hero to'],
  ['civil', 'feared', 'Feared by'],
  ['law', 'suspect', 'Suspected by'],
];

export function factionText(factions) {
  if (!factions) return '';
  const out = [];
  const side = WAR_SIDES[factions.oath];
  if (side) {
    out.push(side.short);
    const rank = RANKS[side.id]?.find((r) => r.id === factions.rank);
    if (rank) out.push(rank.name);
  }
  const who = WHO[factions.side];
  const said = who && factions.standing ? TELLING.find(([axis, level]) => factions.standing[axis] === level) : null;
  if (said) out.push(`${said[2]} ${who[said[0]]}`);
  return out.join(' · ');
}

export function factionsFrom(side, marks) {
  const oath = marks?.oath ?? null;
  return { side: side ?? null, standing: (side && marks?.standing?.[side]) || null, war: oath?.war ?? null, oath: oath?.side ?? null, rank: oath?.rank ?? null };
}
