// The shipyard's list's model (YardList.jsx draws it): a slot's rows, said
// the same way whichever kind of thing it holds (a part, a build's module, a
// stock ship's tune), the front door's groups, which row is staged and which
// flown, and the word on a row's right. Pure, tested.
//
//   rowsFor(slot, unlocked, tuning, ship, economy) → [{ id, name, module, open, hint, blurb, does, mass, power, paint, item }]
//     (a part opens at its level as well as by its achievement: yardRules.js's partOpen, and its lock's
//     sentence is lockHint's, bare, for the card to say as "Locked. …")
//   GROUPS: [[name, slots]] the front door's, a game garage's sort
//   idsIn(slot, draft, live) → { isBuild, tuning, staged, flown }
//   statusOf(row, pill, ids) → { kind: 'locked'|'fitted'|'staged'|'flown'|'owned'|'price'|'short', text }
// On the crew's own ship the build's slots after the hull offer tuning: the
// slot's own module (and a None) are one row, "As it came", that clears it.

import { STOCK, isOpen, partEffects, partsFor } from '../outfit';
import { BUILD_SLOTS, isModuleOpen, modulesFor } from './parts';
import { STOCK_BUILD, isStockModule } from './build';
import { itemOfModule, itemOfPart, lockHint, partOpen } from '../yardRules';

const cr = (n) => `${n.toLocaleString('en-GB')} ¢`;
const DOES = { boost: 'Boost', accel: 'Acceleration', cruise: 'Cruise', agility: 'Agility', level: 'Self-levelling' };
const moduleEffects = (m) => [
  ...(m.does.plant ? [`${m.does.plant} MW plant`] : []),
  ...Object.entries(m.does)
    .filter(([k, v]) => k !== 'plant' && v)
    .map(([k, v]) => `${DOES[k]} ${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`),
];
const moduleRows = (slot, unlocked) =>
  modulesFor(slot).map((m) => ({ id: m.id, name: m.name, module: true, open: isModuleOpen(m, unlocked), hint: m.hint, blurb: m.blurb, does: moduleEffects(m), mass: m.mass, power: m.power, item: itemOfModule(slot, m.id) }));
// the tune's rows: the ship as it came (staging the slot's stock module, which clears the tune), then each module that isn't the slot's stock or a None
const AS_IT_CAME = { name: 'As it came', module: true, open: true, hint: null, blurb: 'The crew’s own ship, as it came.', does: [], mass: 0, power: 0, item: null };
const tuneRows = (slot, unlocked) => [{ ...AS_IT_CAME, id: STOCK_BUILD[slot] }, ...moduleRows(slot, unlocked).filter((r) => !isStockModule(slot, r.id))];

// a row's model: whichever kind of thing the slot holds, said the same way
export function rowsFor(slot, unlocked, tuning, ship, economy = null) {
  if (tuning) return tuneRows(slot, unlocked);
  if (BUILD_SLOTS.includes(slot)) return moduleRows(slot, unlocked);
  return partsFor(slot).map((p) => ({
    id: p.id,
    name: p.name,
    module: false,
    open: slot === 'paint' ? isOpen(p, unlocked) : partOpen(p, unlocked, economy),
    hint: slot === 'paint' ? p.hint : lockHint(p, itemOfPart(slot, p.id)),
    blurb: p.blurb,
    does: slot === 'paint' ? [] : partEffects(p, ship),
    mass: p.mass ?? 0,
    power: p.power ?? 0,
    paint: slot === 'paint' ? p : null,
    item: itemOfPart(slot, p.id),
  }));
}

// the front door's groups, as a game garage sorts them
export const GROUPS = [
  ['Looks', ['paint']],
  ['Performance', ['booster', 'thrusters', 'shields', 'fins']],
  ['Weapons', ['guns', 'secondary', 'ordnance']],
  ['Frame', BUILD_SLOTS],
];

// what's staged and what's flown in a slot, by id
export function idsIn(slot, draft, live) {
  const isBuild = BUILD_SLOTS.includes(slot);
  const tuning = isBuild && slot !== 'hull' && !draft.build;
  const staged = isBuild ? (tuning ? (draft.tune?.[slot] ?? STOCK_BUILD[slot]) : (draft.build ?? null)?.[slot]) : (draft.loadout[slot] ?? STOCK);
  const flown = isBuild ? (live?.build ? live.build[slot] : slot === 'hull' ? null : (live?.tune?.[slot] ?? STOCK_BUILD[slot])) : (live?.loadout?.[slot] ?? STOCK);
  return { isBuild, tuning, staged, flown };
}

// a row's word on the right: what it is to you now
export function statusOf(r, pill, { staged, flown }) {
  if (!r.open || pill?.kind === 'locked') return { kind: 'locked', text: 'Locked' };
  if (flown === r.id && staged === r.id) return { kind: 'fitted', text: 'Fitted' };
  if (staged === r.id) return { kind: 'staged', text: pill?.kind === 'buy' ? cr(r.item.price) : 'Staged' };
  if (flown === r.id) return { kind: 'flown', text: 'Flying' };
  if (!pill) return { kind: 'owned', text: 'Free' };
  if (pill.kind === 'buy') return { kind: 'price', text: cr(r.item.price) };
  if (pill.kind === 'short') return { kind: 'short', text: cr(r.item.price) };
  return { kind: 'owned', text: pill.text };
}

