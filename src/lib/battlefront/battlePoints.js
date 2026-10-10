// Battle Points (spec catalogue 4): each soldier's balance, earned by the
// table in `points.json` (a kill, an assist to whoever hurt the target
// lately, a second on a moving objective, damage to the escort, a squad
// spawn on you) and spent at the deploy screen on a reinforcement, a hero
// or a vehicle, within the team's limits. Pure.
//
//   createPoints({ rulebook, teams: { 1: side, 2: side }, bpRate }) → bp
//   earn(bp, id, kind, amount = 1)    hit(bp, target, by, now)    kill(bp, { by, target, now }) → [{ id, kind }]
//   balance(bp, id)    offers(bp, id, team, { out: { heroes, reinforcements } }) → [{ kind, id, cost, affordable, available, why }]
//   canBuy(bp, id, offer)    buy(bp, id, offer) → { ok, why }

import { heroOf, pointsOf, reinforcementOf } from './rulebook.js';

// The window inside which a hit counts toward an assist, by hand (the game as played).
export const ASSIST_WINDOW = 8;

export function createPoints({ rulebook, teams, bpRate = null }) {
  const p = pointsOf(rulebook);
  return { rb: rulebook, table: p, teams, rate: bpRate ?? p.bpRate ?? 1, balances: new Map(), hits: new Map(), earned: new Map() };
}

export const balance = (bp, id) => bp.balances.get(id) ?? 0;
export const earnedBy = (bp, id) => bp.earned.get(id) ?? 0;

export function earn(bp, id, kind, amount = 1) {
  const v = (bp.table.earn[kind] ?? 0) * amount * bp.rate;
  if (!id || !v) return 0;
  bp.balances.set(id, balance(bp, id) + v);
  bp.earned.set(id, earnedBy(bp, id) + v);
  return v;
}

// a hit, remembered for the assists
export function hit(bp, target, by, now) {
  if (!by || by === target) return;
  let m = bp.hits.get(target);
  if (!m) bp.hits.set(target, (m = new Map()));
  m.set(by, now);
}

// a kill: 100 to the killer (more for a hero), 50 to each other who hurt the target inside the window
export function kill(bp, { by, target, now, hero = false }) {
  const out = [];
  if (by && by !== target) {
    earn(bp, by, hero ? 'heroKill' : 'kill');
    out.push({ id: by, kind: hero ? 'heroKill' : 'kill' });
  }
  for (const [who, t] of bp.hits.get(target) ?? []) {
    if (who === by || now - t > ASSIST_WINDOW + 1e-9) continue;
    earn(bp, who, 'assist');
    out.push({ id: who, kind: 'assist' });
  }
  bp.hits.delete(target);
  return out;
}

function costOf(bp, kind, id) {
  const c = bp.table.cost;
  if (kind === 'class') return 0;
  if (kind === 'reinforcement') return c[reinforcementOf(bp.rb, id).kind] ?? 0;
  if (kind === 'hero') return c.heroes[id] ?? c.heroes.default;
  return c.vehicles[id] ?? c.vehicles.default;
}

export function offers(bp, id, team, { out = { heroes: 0, reinforcements: 0 } } = {}) {
  const side = bp.teams[team];
  const have = balance(bp, id);
  const lim = bp.table.limits;
  const list = [];
  const add = (kind, rid, limited) => {
    const cost = costOf(bp, kind, rid);
    const o = { kind, id: rid, cost, affordable: have >= cost, available: true };
    if (limited) {
      o.available = false;
      o.why = 'limit';
    } else if (!o.affordable) o.why = 'points';
    list.push(o);
  };
  for (const c of side.classes) add('class', c, false);
  for (const r of side.reinforcements) add('reinforcement', r, out.reinforcements >= lim.reinforcementsPerTeam);
  for (const h of side.heroes) {
    heroOf(bp.rb, h);
    add('hero', h, out.heroes >= lim.heroesPerTeam);
  }
  // vehicles wait for lane 4: offered at their price, not yet deployable
  for (const v of side.vehicles ?? []) {
    add('vehicle', v, false);
    list.at(-1).available = false;
    list.at(-1).why = 'vehicles';
  }
  return list;
}

export const canBuy = (bp, id, offer) => !!offer && offer.available !== false && balance(bp, id) >= offer.cost;

export function buy(bp, id, offer) {
  if (!offer || offer.available === false) return { ok: false, why: offer?.why ?? 'none' };
  if (balance(bp, id) < offer.cost) return { ok: false, why: 'points' };
  bp.balances.set(id, balance(bp, id) - offer.cost);
  return { ok: true };
}
