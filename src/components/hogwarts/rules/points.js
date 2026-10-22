// The House Cup (the design’s §4.7): every point a house wins or loses, as
// data, and the race for the Cup. Points come in as events, `{ type:
// 'points', house, delta, why }`, from the lessons (Lane E’s), the Snitch,
// the quests (rules/quests.js) and the curfew; a misdeed is one with its
// cost taken off. The other three houses aren’t played, so their points
// run on their own by the week (`rivalsAt`): every house gains a little a
// week from its own students, and the other three gain on top a share of
// what a player who does every quest would win, the leader a little behind
// such a player, so the Cup is there to be won and isn’t given. Which rival
// leads is shuffled by the year. Pure.
//
//   HOUSES, NAMES, TABLE (every gain and loss there is: { id: { delta, why } })
//   FULL (the points a term’s quests are worth), BASE (a house’s own a week), RIVALS (the three shares)
//   newPoints({ house, year }) → { house, year, own: { house: n }, log: [{ house, delta, why }] }
//   apply(points, event) → points: a `{ type: 'points' }` event counted (anything else ignored)
//   misdeed(points, { house, cost, why }) → points: a cost taken off
//   rivalsAt(week, { house, year }) → { house: n } the other three’s own pace by that week
//   totals(points, week) → { house: n } every house’s points that week (never under nought)
//   standings(points, week) → [{ house, name, points, you }] most first
//   winner(points, week) → the house with the most (a tie goes to yours: the hall cheers loudest for it)
//   toastFor(delta, house) → ‘Ten points to Ravenclaw.’ / ‘Twenty points from Slytherin.’
//   words(n) → the number in words, as a teacher says it

import { QUESTS } from './quests';
import { TERM } from './term';

export const HOUSES = ['gryffindor', 'hufflepuff', 'ravenclaw', 'slytherin'];
export const NAMES = { gryffindor: 'Gryffindor', hufflepuff: 'Hufflepuff', ravenclaw: 'Ravenclaw', slytherin: 'Slytherin' };

// Every gain and loss there is (the lessons and the wand give their own
// numbers; these are the rest, and what a lesson is reckoned at)
export const TABLE = {
  common: { delta: 10, why: 'finding your common room unaided' },
  lesson: { delta: 10, why: 'a lesson done well' },
  question: { delta: 5, why: 'a question answered in class' },
  snitch: { delta: 10, why: 'the Snitch caught in a match' },
  duel: { delta: 20, why: 'the duelling club won' },
  willow: { delta: 15, why: 'the library’s book back from the Willow' },
  night: { delta: 20, why: 'the Restricted Section, and back unseen' },
  patronus: { delta: 30, why: 'the dementors driven off the shore' },
  hogsmeade: { delta: 15, why: 'a Hogsmeade weekend' },
  curfew: { delta: -20, why: 'out after curfew' },
  spell: { delta: -10, why: 'a spell cast at a person' },
  cauldron: { delta: -5, why: 'a melted cauldron' },
  feather: { delta: -5, why: 'a feather set on fire' },
  peeves: { delta: -5, why: 'Peeves’s mischief, pinned on you' },
};

// What a term’s quests are worth to the player who does them all, and the
// rivals’ pace: each house’s own students a week, and on top the other
// three’s shares of a full term by the leaving feast (the leader under what
// a player who does every quest wins, the rest further back)
export const FULL = QUESTS.reduce((s, q) => s + q.points, 0);
export const BASE = 16;
export const RIVALS = [0.78, 0.66, 0.55];

export const newPoints = ({ house = 'gryffindor', year = 1 } = {}) => ({ house, year, own: Object.fromEntries(HOUSES.map((h) => [h, 0])), log: [] });

const LOG = 12;
export function apply(points, event) {
  if (event?.type !== 'points' || !HOUSES.includes(event.house) || !Number.isFinite(event.delta) || !event.delta) return points;
  return {
    ...points,
    own: { ...points.own, [event.house]: points.own[event.house] + Math.round(event.delta) },
    log: [...points.log, { house: event.house, delta: Math.round(event.delta), why: event.why ?? null }].slice(-LOG),
  };
}

export const misdeed = (points, { house = points.house, cost = -TABLE.spell.delta, why = TABLE.spell.why } = {}) => apply(points, { type: 'points', house, delta: -Math.abs(cost), why });

// (which of the three rivals leads, by the year: a small seeded shuffle)
function order(house, year) {
  const others = HOUSES.filter((h) => h !== house);
  let a = (Math.imul(year + 11, 2654435761) >>> 0) || 1;
  for (let i = others.length - 1; i > 0; i--) {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    const j = (a >>> 0) % (i + 1);
    [others[i], others[j]] = [others[j], others[i]];
  }
  return others;
}

const weeksIn = (week) => Math.min(TERM.weeks, Math.max(1, week)) - 1;

export function rivalsAt(week, { house = 'gryffindor', year = 1 } = {}) {
  const k = weeksIn(week) / (TERM.weeks - 1);
  const out = {};
  order(house, year).forEach((h, i) => {
    // (a little uneven week to week, never going back)
    const wobble = Math.sin((week + i * 3.1 + year) * 1.7) * 0.03 * k * (1 - k);
    out[h] = Math.round(RIVALS[i] * FULL * Math.max(0, k + wobble));
  });
  return out;
}

export function totals(points, week) {
  const rivals = rivalsAt(week, points);
  const base = BASE * weeksIn(week);
  return Object.fromEntries(HOUSES.map((h) => [h, Math.max(0, base + points.own[h] + (rivals[h] ?? 0))]));
}

export function standings(points, week) {
  const t = totals(points, week);
  return HOUSES.map((h) => ({ house: h, name: NAMES[h], points: t[h], you: h === points.house })).sort((a, b) => b.points - a.points || (b.you ? 1 : 0) - (a.you ? 1 : 0));
}

export const winner = (points, week) => standings(points, week)[0].house;

const ONES = ['nought', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function words(n) {
  const v = Math.abs(Math.round(n));
  if (v < 20) return ONES[v];
  if (v < 100) return TENS[Math.floor(v / 10)] + (v % 10 ? `-${ONES[v % 10]}` : '');
  if (v < 1000) {
    const h = Math.floor(v / 100);
    const rest = v % 100;
    return `${h === 1 ? 'a' : ONES[h]} hundred${rest ? ` and ${words(rest)}` : ''}`;
  }
  return String(v);
}

export function toastFor(delta, house) {
  const n = words(delta);
  const say = n[0].toUpperCase() + n.slice(1);
  const one = Math.abs(delta) === 1 ? 'point' : 'points';
  return `${say} ${one} ${delta < 0 ? 'from' : 'to'} ${NAMES[house] ?? house}.`;
}
