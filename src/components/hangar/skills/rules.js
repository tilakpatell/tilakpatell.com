// The skill tree's rules (tree.js has the nodes): the points the whole site
// gives (a point a level past the first, a point a Legend rank past the
// last level, a point every five achievements, Battlefront's left out and
// fifty at most), whether a node can be taken, the nodes a save keeps,
// what the nodes taken do, and what a reset costs. Pure, tested.
//
//   LEGEND, ADDERS
//   legendRank(xp) → 0…10
//   pointsOf({ level, xp, achievements }) → { levels, legend, deeds, earned }
//   maxPoints(countable) → the most there is, with `countable` achievements to earn
//   treeCost() → 60
//   keyMet(key, achievements) → boolean
//   canTake(nodes, id, { earned, achievements }) → { ok, why: null | 'unknown' | 'taken' | 'soon' | 'parent' | 'key' | 'points' }
//   readSkills(raw, { earned, achievements }) → the ids kept, in the order taken
//   withTaken(saved, id) → the save with a node taken on its end (the save as it
//     was, not as read now: what the points can't hold today waits for them)
//   effectsOf(nodes) → fx (adders 0 and multipliers 1 where nothing's taken; carry: the crews' powers any ship may carry;
//     arms: the unique weapons opened, lib/arms's ids)
//   canCarry(fx, crew, powersCrew) → boolean
//   resetCost(resets) → credits

import { BATTLEFRONT, KEYS, NODES } from './tree';

export const LEGEND = { from: 11000, every: 3000, most: 10 };
const LEVEL_POINTS = 10; // (levels 2 to 11)
const DEEDS = { per: 5, most: 50 };
export const ADDERS = ['boost', 'accel', 'cruise', 'agility', 'level', 'ammo', 'shots'];
const MULTIPLIERS = ['regen', 'armor', 'cadence', 'reload', 'homing', 'life', 'jump', 'health', 'heal', 'spread', 'heat', 'cool', 'damage', 'powerCool', 'powerDur', 'charge', 'pickup', 'bigPunch'];
const RESET = 500;

export const legendRank = (xp) => (Number.isFinite(xp) && xp >= LEGEND.from + LEGEND.every ? Math.min(LEGEND.most, Math.floor((xp - LEGEND.from) / LEGEND.every)) : 0);

export function pointsOf({ level = 1, xp = 0, achievements = [] } = {}) {
  const levels = Math.max(0, Math.min(LEVEL_POINTS, (Number.isInteger(level) ? level : 1) - 1));
  const legend = legendRank(xp);
  const counted = new Set((Array.isArray(achievements) ? achievements : []).filter((id) => typeof id === 'string' && !BATTLEFRONT.includes(id)));
  const deeds = Math.min(DEEDS.most, Math.floor(counted.size / DEEDS.per));
  return { levels, legend, deeds, earned: levels + legend + deeds };
}

export const maxPoints = (countable) => LEVEL_POINTS + LEGEND.most + Math.min(DEEDS.most, Math.floor(countable / DEEDS.per));
export const treeCost = () => Object.values(NODES).reduce((s, n) => s + n.cost, 0);
export const keyMet = (key, achievements) => !key || (KEYS[key] ?? []).some((id) => achievements?.includes(id));
const spentOf = (nodes) => nodes.reduce((s, id) => s + (NODES[id]?.cost ?? 0), 0);
const parentMet = (nodes, n) => n.row === 1 || nodes.some((id) => NODES[id]?.branch === n.branch && NODES[id].row === n.row - 1);

export function canTake(nodes, id, { earned = 0, achievements = [] } = {}) {
  const n = NODES[id];
  if (!n) return { ok: false, why: 'unknown' };
  if (nodes.includes(id)) return { ok: false, why: 'taken' };
  if (n.soon) return { ok: false, why: 'soon' };
  if (!parentMet(nodes, n)) return { ok: false, why: 'parent' };
  if (!keyMet(n.key, achievements)) return { ok: false, why: 'key' };
  if (spentOf(nodes) + n.cost > earned) return { ok: false, why: 'points' };
  return { ok: true, why: null };
}

export function readSkills(raw, ctx) {
  let v = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const asked = Array.isArray(v?.nodes) ? v.nodes : [];
  const kept = [];
  for (const id of asked) if (typeof id === 'string' && canTake(kept, id, ctx).ok) kept.push(id);
  return kept;
}

export const withTaken = (saved, id) => {
  const list = Array.isArray(saved) ? saved : [];
  return list.includes(id) ? list : [...list, id];
};

export function effectsOf(nodes) {
  const fx = { carry: [], arms: [] };
  for (const k of ADDERS) fx[k] = 0;
  for (const k of MULTIPLIERS) fx[k] = 1;
  for (const id of Array.isArray(nodes) ? nodes : []) {
    const n = NODES[id];
    if (!n) continue;
    for (const [k, v] of Object.entries(n.does)) {
      if (ADDERS.includes(k)) fx[k] += v;
      else if (MULTIPLIERS.includes(k)) fx[k] *= v;
    }
    if (n.borrows && !fx.carry.includes(n.borrows)) fx.carry.push(n.borrows);
    if (n.arms && !fx.arms.includes(n.arms)) fx.arms.push(n.arms);
  }
  return fx;
}

export const canCarry = (fx, crew, powersCrew) => crew === powersCrew || Boolean(fx?.carry?.includes(powersCrew));
export const resetCost = (resets) => (Number.isInteger(resets) && resets > 0 ? RESET : 0);
