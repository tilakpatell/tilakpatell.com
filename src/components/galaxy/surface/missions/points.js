// The Battle Points of a galactic assault (./assault.js keeps yours,
// AssaultHud.jsx spends them on its spawn screen): what a deed earns, and
// what the spawn screen offers at what price, as Star Wars Battlefront II
// (2017) has them. The prices are the game's record (src/data/bf2017/
// points.json: Online/BattlepointCostData, a level's own Galactic Assault
// table where it has one, else the default list); what a deed earns is by
// hand there, as the game is played. Pure, so it's tested. The Battlefront
// world's own (lib/battlefront/battlePoints.js) reads the whole rulebook,
// which the galaxy's chunk doesn't carry: this reads the one table.
//
//   EARN                           what a deed earns: { kill, assist, objectiveTick, heroKill, squadSpawn, capture, … }
//   priceOf(kind, id, { system })  an offer's price: a class nothing, a hero by heroes.js's id (the game's own for them looked up), an enforcer by its body or the game's unit
//   offersFor({ mission, side, system, points }) → the spawn screen's list, in order: the four classes, the side's enforcer, then its heroes:
//                                  [{ kind ('class' | 'enforcer' | 'hero'), id, heroId (heroes.js's: who you deploy as), name, icon (a URL), cost, affordable, body? (a trooper's crew kind), gun? }]
//   canAfford(points, offer)       on the whole points you have (whole(points): a second's shares add up to a hair under a point)
//   earnFor(b, what, amount = 1)   yours, in a battle: EARN[what] × amount onto b.you.points (a second in a post pays a share of a tick)
//   onObjective(b, p)              whether the post you're in pays its tick: your side's taking it, or holding it with the enemy inside
//   sideIdOf(mission, side)        the map's side ('attack' | 'defend') as sides.js names it

import POINTS from '../../../../data/bf2017/points.json';
import { SIDES } from '../../sides';
import { heroById } from '../../heroes';
import { gameName } from '../../../../lib/bf2017/strings';
import { CLASSES, enforcersFor, troopersFor } from '../troopers';

const COST = POINTS.cost;

// (the game's, as the export has them by hand; and one of this battle's
// own, by hand too: the game pays for an objective over time, its
// objectiveTick, and this pays as well the moment a post falls with you in it)
export const EARN = { ...Object.fromEntries(Object.entries(POINTS.earn).filter(([, v]) => typeof v === 'number')), capture: 200 };

// heroes.js's ids where the game's price list names them otherwise
const GAME_HERO = { chewie: 'chewbacca', han: 'hansolo', vader: 'darthvader', palpatine: 'emperor' };
// an enforcer's body as the game's unit: the death trooper and the Wookiee
// warrior in its unit list, the super battle droid (B2) among its others;
// and B2's price by hand, should an export lose its row (the death trooper's)
const UNIT = { deathtrooper: 'DeathTrooper', wookiee: 'WookieWarrior', superdroid: 'B2' };
const HAND = { B2: 1500 };

export function priceOf(kind, id, { system = null } = {}) {
  if (kind === 'class') return 0;
  if (kind === 'hero') return COST.heroes[GAME_HERO[id] ?? id] ?? COST.heroes.default;
  const unit = UNIT[id] ?? id;
  // (the level's own table, a world's first level: hoth → hoth_01; a world the game has no row for takes the default list)
  const level = system ? COST.byMode?.galacticAssault?.[`${system}_01`] : null;
  return level?.units?.[unit] ?? COST.units[unit] ?? COST.other?.[unit] ?? HAND[unit] ?? 0;
}

export const whole = (points) => Math.floor((points ?? 0) + 1e-6);
export const canAfford = (points, offer) => Boolean(offer) && whole(points) >= (offer.cost ?? 0);

// (assault.js's warSideOf, the other way round, which this can't import:
// assault.js imports this. The maps call the Rebellion 'rebels'.)
const WAR_ID = { rebels: 'rebel' };
export const sideIdOf = (mission, side) => {
  const id = mission?.sides?.[side]?.id ?? side ?? null;
  return WAR_ID[id] ?? id;
};

// The heroes each war offers, by hand: the Clone Wars' on its worlds (the
// Republic's and the Separatists'), the Galactic Civil War's on the rest
// (the Remnant War has none of its own in the game). A side gets those of
// its lean; a hero still `soon` isn't offered, nor anyone from elsewhere.
const WAR_HEROES = {
  clone: ['obiwan', 'anakin', 'maul', 'dooku'],
  gcw: ['luke', 'leia', 'han', 'chewie', 'lando', 'vader', 'palpatine', 'bobafett', 'bossk'],
};
const CLONE_WARS = new Set(['republic', 'separatists']);
// (the game's spawn screen marks an enforcer and a hero so, whoever they are)
const ICONS = '/battlefront/icons/UI/SVG/Classes';
export const ENFORCER_ICON = `${ICONS}/Class_Enforcer.svg`;
export const HERO_ICON = `${ICONS}/Hero_Icon_01.svg`;

export function offersFor({ mission = null, side, system = mission?.system ?? null, points = 0 }) {
  const id = sideIdOf(mission, side);
  if (!SIDES[id] || SIDES[id].stance === 'hutt') return [];
  const lean = SIDES[id].stance === 'light' ? 'light' : 'dark';
  const out = [];
  const add = (o) => out.push({ ...o, affordable: canAfford(points, o) });
  for (const t of troopersFor(id, system)) {
    const c = CLASSES.find((x) => x.cls === t.trooper.cls);
    add({ kind: 'class', id: t.id, heroId: t.id, name: c.name, icon: c.icon, cost: 0, body: t.trooper.kind, gun: t.weapon });
  }
  for (const t of enforcersFor(id)) add({ kind: 'enforcer', id: t.id, heroId: t.id, name: t.name, icon: ENFORCER_ICON, cost: priceOf('enforcer', t.trooper.kind, { system }), body: t.trooper.kind, gun: t.weapon });
  for (const h of WAR_HEROES[CLONE_WARS.has(id) ? 'clone' : 'gcw']) {
    const row = heroById(h);
    if (!row || row.soon || row.side === 'elsewhere' || row.lean !== lean) continue;
    add({ kind: 'hero', id: h, heroId: h, name: gameName(`hero:${h}`, row.name), icon: HERO_ICON, cost: priceOf('hero', h) });
  }
  return out;
}

export function earnFor(b, what, amount = 1) {
  const v = (EARN[what] ?? 0) * amount;
  b.you.points = (b.you.points ?? 0) + v;
  return v;
}

export function onObjective(b, p) {
  const me = b.you.side;
  const opp = me === 'attack' ? 'defend' : 'attack';
  if (p.owner === me) return p.inside[opp] > 0;
  if (p.owner === null) return p.taking === me;
  return p.inside[me] > p.inside[opp];
}
