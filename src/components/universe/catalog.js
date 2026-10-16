// The catalogue: what everything in the hangar costs, and what it needs
// before it can be bought. outfit.js's parts, shipyard/parts.js's modules and
// paint.js's paints stay the source of what each one is; this is the source
// of what each one costs, so a new part there is priced here without a line
// of its own. The design: docs/superpowers/specs/2026-10-07-multiplayer-economy-design.md,
// Part 2.
//
// An item: { key, id, kind ('part' | 'module' | 'paint'), slot, name, price
// (credits), needs, from, stock }. needs is any of { achievement (an id in
// Achievements.jsx), level (economy.js's, 2…11), standing: { side (sides.js),
// axis, level (standing.js's level names) }, rank: { side (galaxy/sides.js),
// id (galaxy/ranks.js) } }. from is the universe an item belongs to
// ('starwars', 'rickmorty', 'breakingbad', 'galaxy', or null for anyone's),
// for the shop to group by. Stock is free, needs nothing and is always
// owned. The key is the kind, slot and id together: an id alone isn't
// enough ('portal' is a booster and a paint both).
//
// Pure data, tested in Node: economy.js sells by it and Hangar.jsx shows it.

import { ACHIEVEMENTS } from '../Achievements';
import { SIDES as WAR_SIDES } from '../galaxy/sides';
import { RANKS } from '../galaxy/ranks';
import { PARTS, STOCK } from './outfit';
import { PAINTS } from './paint';
import { WEAPONS, burstOf, rackOf } from './weaponTable';
import { BUILD_SLOTS, modulesFor } from './shipyard/parts';
import { WHO } from './standing';

// Prices by how much an item does, as a share added on to the ship as it
// comes (a booster's 0.25 more boost is about 400): the smallest band at or
// past the share is the price. Nothing that isn't stock is under 100, and
// nothing is over 1500, so the best fit is a few evenings, not a month.
export const BANDS = [
  { upTo: 0.05, price: 100 },
  { upTo: 0.2, price: 200 },
  { upTo: 0.3, price: 400 },
  { upTo: 0.5, price: 700 },
  { upTo: 0.8, price: 1000 },
  { upTo: 1.2, price: 1250 },
  { upTo: Infinity, price: 1500 },
];
const PAINT_PRICE = 150;
const PLANT_SHARE = 600 / 1600; // a megawatt more plant than the stock hull's is worth 600, as a share
const bandOf = (share) => BANDS.find((b) => share <= b.upTo).price;

// What a part does, as one share: the flying shares as they are (levelling
// at half, it being the least felt), and the guns and shields by how much
// better they do against the factory's; a secondary by what a burst lands
// a second against the stock scatter's, an ordnance rack by its rounds a
// second against the stock torpedoes'.
function partShare(p) {
  let share = (p.boost ?? 0) + (p.accel ?? 0) + (p.cruise ?? 0) + (p.agility ?? 0) + (p.level ?? 0) / 2;
  if (p.cadence || p.punch) share += (p.punch ?? 1) / (p.cadence ?? 1) - 1;
  if (p.armor) share += 1 / p.armor - 1;
  if (p.regen) share += p.regen - 1;
  if (p.delay) share += (5 - p.delay) / 5;
  const w = p.weapon && p.id !== STOCK ? WEAPONS[p.weapon] : null;
  if (w?.line === 'secondary') share += burstOf(w) / burstOf(WEAPONS.spread) - 1;
  if (w?.line === 'ordnance') share += rackOf(w) / rackOf(WEAPONS.heavy) - 1;
  return share;
}
const STOCK_PLANT = modulesFor('hull')[0].does.plant;
const moduleShare = (m) => partShare(m.does) + (m.does.plant ? (m.does.plant - STOCK_PLANT) * PLANT_SHARE : 0);

// The new things to earn in each universe, priced and locked by hand (data
// only: each a paint, or a part drawn as another of its slot is).
const NEW = {
  'paint:paint:rebel': { price: 300, from: 'galaxy', needs: { rank: { side: 'rebel', id: 'flight-cadet' } } },
  'paint:paint:imperial': { price: 300, from: 'galaxy', needs: { rank: { side: 'empire', id: 'ensign' } } },
  'paint:paint:redsquadron': { price: 600, from: 'galaxy', needs: { rank: { side: 'rebel', id: 'flight-leader' } } },
  'paint:paint:citadel': { price: 500, from: 'rickmorty', needs: { standing: { side: 'rickmorty', axis: 'law', level: 'trusted' } } },
  'paint:paint:pollos': { price: 500, from: 'breakingbad', needs: { standing: { side: 'breakingbad', axis: 'civil', level: 'hero' } } },
  'paint:paint:huttgold': { price: 1200, from: 'galaxy', needs: { level: 8 } },
  'part:guns:incom': { price: 900, from: 'starwars', needs: { achievement: 'rebels' } },
  'part:fins:council': { price: 700, from: 'rickmorty', needs: { level: 5 } },
  'part:thrusters:vamonos': { price: 450, from: 'breakingbad', needs: { level: 3 } },
  'part:secondary:flak': { needs: { level: 4 } },
  'part:ordnance:missiles': { needs: { level: 3 } },
  // (the ion burst lands no more a second than the scatter, and the Mk II
  // less than the stock rack: what they're worth is the harder hit, so
  // they're priced by hand, as the incom part is)
  'part:secondary:ion': { price: 700, from: 'starwars' },
  'part:ordnance:mk2': { price: 900, from: 'starwars' },
};

export const keyOf = (kind, slot, id) => `${kind}:${slot}:${id}`;

const entry = (kind, slot, it, stock, price) => {
  const key = keyOf(kind, slot, it.id);
  const own = NEW[key];
  const needs = { ...(it.achievement ? { achievement: it.achievement } : {}), ...(own?.needs ?? {}) };
  return { key, id: it.id, kind, slot, name: it.name, price: stock ? 0 : (own?.price ?? price), needs: stock ? {} : needs, from: own?.from ?? null, stock };
};

// (a module is stock when it's the stock build's, or nothing at all: taking a part off is free)
const stockModules = new Set(BUILD_SLOTS.map((slot) => keyOf('module', slot, modulesFor(slot)[0].id)));
const ITEMS = [
  ...PARTS.map((p) => entry('part', p.slot, p, p.id === STOCK, bandOf(partShare(p)))),
  ...BUILD_SLOTS.flatMap((slot) => modulesFor(slot).map((m) => entry('module', slot, m, m.id === 'none' || stockModules.has(keyOf('module', slot, m.id)), bandOf(moduleShare(m))))),
  ...PAINTS.map((p) => entry('paint', 'paint', p, p.id === STOCK, PAINT_PRICE)),
];

export const CATALOG = Object.freeze(Object.fromEntries(ITEMS.map((item) => [item.key, Object.freeze(item)])));

// The item for a part, module or paint, or null for an id it doesn't know.
export const itemFor = (kind, slot, id) => (Object.hasOwn(CATALOG, keyOf(kind, slot, id)) ? CATALOG[keyOf(kind, slot, id)] : null);

// The price by key, or by a bare id when only one item has it (null otherwise).
export function priceOf(keyOrId) {
  if (Object.hasOwn(CATALOG, keyOrId)) return CATALOG[keyOrId].price;
  const found = ITEMS.filter((item) => item.id === keyOrId);
  return found.length === 1 ? found[0].price : null;
}

// what being at each standing level is, as the start of a sentence
const STANDING_VERB = { trusted: 'be trusted by', hero: 'be a hero to', friend: 'be a friend to', suspect: 'be a suspect to', wanted: 'be wanted by', feared: 'be feared by' };
const an = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

function needSentences(needs) {
  const out = [];
  if (needs.achievement) out.push(`earn “${ACHIEVEMENTS[needs.achievement]?.name ?? 'an achievement'}”`);
  if (needs.level) out.push(`reach level ${needs.level}`);
  if (needs.standing) {
    const { side, axis, level } = needs.standing;
    out.push(`${STANDING_VERB[level] ?? 'stand well with'} ${WHO[side]?.[axis] ?? 'them'}`);
  }
  if (needs.rank) {
    const ladder = RANKS[needs.rank.side] ?? [];
    const rank = ladder.find((r) => r.id === needs.rank.id);
    const side = `the ${WAR_SIDES[needs.rank.side]?.short ?? 'side'}`;
    // the first rank is anyone's who swears: say so, rather than name a rank nobody earns
    out.push(rank && rank !== ladder[0] ? `fly as ${an(rank.name)} ${rank.name} for ${side}` : `swear to ${side} in the galaxy`);
  }
  return out;
}

// The hangar's sentence for what a lock needs: 'Reach level 5', 'Be
// trusted by the Federation', or two of them joined ('Reach level 3 and be
// trusted by the Empire'); '' for nothing.
export function needText(needs) {
  const s = needSentences(needs ?? {}).join(' and ');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}
