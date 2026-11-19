// The shipyard's rules: a draft refit, what it costs, what it will fit and
// what can be sold. The yard (shipyard/Shipyard.jsx) edits a draft
// { build, loadout } and nothing is bought or fitted until Apply, which
// checks out every unowned item at once (economy.js's checkout) and then
// fits the changes `diff` lists, in its order. Pure (no React, no
// three.js), tested in Node. The design:
// docs/superpowers/specs/2026-10-08-shipyard-overhaul-design.md, Part 2.
//
// A draft is { build, loadout, tune }: the hull (a garage build, or null for
// the crew's own ship), the parts, and the tune (shipyard/build.js: modules
// on the crew's own ship, kept per crew whichever hull is flown, but only
// flown, checked and bought while the hull is the stock one).
//
// openDraft(live) → draft; setPart, setModule, setHull, rollDraft → draft;
// pasteDraft(draft, code, { unlocked, economy }) → { draft } | { error };
// check(draft, { kind, unlocked, economy }) → { ok, issues, toBuy, total,
//   short, power, capacity, mass }; diff(draft, live) → [{ slot, from, to,
//   module, tune? }]; sellable({ loadouts, hulls, garage, tune, keep }, economy) →
//   [{ item, refund }]; itemOfPart, itemOfModule → catalog.js's item.

import { CATALOG, itemFor, needText } from './catalog';
import { migrateOwned, refundOf } from './economy';
import { SLOTS, STOCK, equip, isOpen, parsePart, partById, statsOf } from './outfit';
import { STOCK_BUILD, TUNE_SLOTS, buildCode, parseBuildCode, readTune, rollBuild } from './shipyard/build';
import { BUILD_SLOTS, isModuleOpen, moduleById } from './shipyard/parts';
import { coreOf } from './ships/tiers';

// The catalogue's item for a part or paint, and for a module (so the view
// never builds a key).
export const itemOfPart = (slot, id) => (slot === 'paint' ? itemFor('paint', 'paint', id) : itemFor('part', slot, id));
export const itemOfModule = (slot, id) => itemFor('module', slot, id);

const copyBuild = (b) => (b ? { ...b } : null);

// A copy of what's flown, to stage changes on.
export const openDraft = (live) => ({ build: copyBuild(live?.build), loadout: { ...(live?.loadout ?? {}) }, tune: { ...(live?.tune ?? {}) } });

// A part or paint staged (an id the slot doesn't have changes nothing).
export function setPart(draft, slot, id) {
  const clean = parsePart(slot, id);
  if (!clean) return draft;
  return { ...draft, loadout: { ...draft.loadout, [slot]: clean } };
}

// A module staged: on the garage build, if the draft flies one. On the
// crew's own ship it's tuning (its model stays, the module's numbers apply),
// and the slot's stock module or a None clears the slot's tune; only the
// hull isn't tunable, so picking one opens a garage build from the stock one.
export function setModule(draft, slot, id) {
  if (!BUILD_SLOTS.includes(slot) || !moduleById(slot, id)) return draft;
  if (draft.build || slot === 'hull') return { ...draft, build: { ...(draft.build ?? STOCK_BUILD), [slot]: id } };
  return { ...draft, tune: readTune({ ...draft.tune, [slot]: id }) };
}

// The stock ship (off) or a garage build (on: the last one kept, or stock's).
export const setHull = (draft, garage, lastBuild = null) => ({ ...draft, build: garage ? { ...(lastBuild ?? STOCK_BUILD) } : null });

// A rolled build: only modules open and owned (ids), as rollBuild picks.
export const rollDraft = (draft, seed, unlocked = [], owned = null) => ({ ...draft, build: rollBuild(seed, unlocked, owned) });

// A build code pasted in: refused when it isn't one, or has a module that
// isn't open or isn't bought (the yard sells modules from its own list, so
// a code is a way to share a ship, not to shop).
export function pasteDraft(draft, code, { unlocked = [], economy = null } = {}) {
  const b = parseBuildCode(code);
  if (!b) return { error: 'Not a build code. They look like GB-021301.k3.' };
  const mods = BUILD_SLOTS.map((slot) => moduleById(slot, b[slot]));
  const shut = mods.find((m) => !isModuleOpen(m, unlocked));
  if (shut) return { error: `That build has the ${shut.name}, which isn’t yours yet. ${shut.hint}.` };
  const unbought = mods.find((m) => {
    const item = itemOfModule(m.slot, m.id);
    return !item?.stock && !economy?.owns(item?.key);
  });
  if (unbought) return { error: `That build has the ${unbought.name}, which you haven’t bought. Stage it from the list first.` };
  return { draft: { ...draft, build: b } };
}

// Whether a whole draft can go on, and what it costs: a locked part or
// module is an issue whatever the wallet says; the plant must run it all;
// every unowned item is in toBuy, their sum the total, and what the credits
// don't cover is short (an issue of its own). ok: no issues.
export function check(draft, { kind, unlocked = [], economy = null } = {}) {
  const { loadout, build } = draft;
  const tune = draft.tune ?? {};
  const issues = [];
  const toBuy = [];
  const lockText = (thing, item) => `Locked. ${thing.hint ?? needText(item?.needs)}.`;
  const consider = (slot, id, thing, open, item) => {
    if (!item || item.stock) return;
    if (!open) return issues.push({ slot, id, why: 'locked', text: lockText(thing, item) });
    if (!economy || economy.owns(item.key)) return;
    const why = economy.canBuy(item).why;
    if (why?.startsWith('locked:')) return issues.push({ slot, id, why: 'locked', text: `Locked. ${needText(item.needs)}.` });
    toBuy.push(item);
  };
  // (the modules flown: a build's, or on the stock ship the tune's)
  for (const slot of build ? BUILD_SLOTS : TUNE_SLOTS) {
    const m = moduleById(slot, (build ?? tune)[slot]);
    if (m) consider(slot, m.id, m, isModuleOpen(m, unlocked), itemOfModule(slot, m.id));
  }
  for (const slot of SLOTS) {
    const id = loadout[slot] ?? STOCK;
    if (id === STOCK) continue;
    const p = partById(slot, id);
    consider(slot, id, p, isOpen(p, unlocked), itemOfPart(slot, id));
  }
  const s = statsOf(kind, loadout, build, tune, undefined, coreOf(economy, kind, build)); // (with the reactor's tier the wallet owns)
  if (s.power > s.capacity) issues.push({ slot: null, id: null, why: 'power', text: `Not enough power: ${Math.round((s.power - s.capacity) * 10) / 10} MW short.` });
  const total = toBuy.reduce((n, item) => n + item.price, 0);
  const short = economy ? Math.max(0, total - economy.credits) : 0;
  // (the wallet loads after the page: until it's there, nothing can be bought)
  if (!economy) issues.push({ slot: null, id: null, why: 'unowned', text: 'The shop’s still opening.' });
  if (short > 0) issues.push({ slot: null, id: null, why: 'short', text: `Short ${short} ¢.` });
  return { ok: issues.length === 0, issues, toBuy, total, short, power: s.power, capacity: s.capacity, mass: s.mass };
}

// What Apply will do, in the order it's done: the build first (the hull
// decides the plant), then the tune (the stock ship's, so only while it's
// the hull), then the parts, those that draw less first, so every fit along
// the way is one the plant can run if the whole draft is. What hasn't
// changed is left out. A switch between the stock ship and a garage build is
// { slot: 'build', from, to: 'stock' | 'garage' }; a tune change is
// { slot, from, to, module: true, tune: true } with null for the ship as it came.
export function diff(draft, live) {
  const out = [];
  const was = live?.build ?? null;
  const now = draft.build ?? null;
  if (Boolean(was) !== Boolean(now)) out.push({ slot: 'build', from: was ? 'garage' : 'stock', to: now ? 'garage' : 'stock', module: true });
  if (now)
    for (const slot of BUILD_SLOTS) {
      const from = (was ?? STOCK_BUILD)[slot];
      if (now[slot] !== from) out.push({ slot, from, to: now[slot], module: true });
    }
  else
    for (const slot of TUNE_SLOTS) {
      const from = live?.tune?.[slot] ?? null;
      const to = draft.tune?.[slot] ?? null;
      if (from !== to) out.push({ slot, from, to, module: true, tune: true });
    }
  const draw = (slot, id) => partById(slot, id)?.power ?? 0;
  const parts = [];
  for (const slot of SLOTS) {
    const from = live?.loadout?.[slot] ?? STOCK;
    const to = draft.loadout?.[slot] ?? STOCK;
    if (from !== to) parts.push({ slot, from, to, module: false, by: draw(slot, to) - draw(slot, from) });
  }
  parts.sort((a, b) => a.by - b.by); // (stable: same draw keeps SLOTS' order)
  return [...out, ...parts.map(({ slot, from, to, module }) => ({ slot, from, to, module }))];
}

// What can be sold: each owned item, not stock, fitted on no crew (in no
// saved loadout, hull, garage build or tune) and not one the yard keeps
// (`keep`: keys, the draft's own), with what it pays back.
export function sellable({ loadouts = {}, hulls = {}, garage = {}, tune = {}, keep = [] } = {}, economy = null) {
  if (!economy) return [];
  const tuned = Object.values(tune ?? {}).flatMap((t) => Object.entries(readTune(t)).map(([slot, id]) => itemOfModule(slot, id)?.key).filter(Boolean));
  const fitted = new Set([...migrateOwned({ loadouts, hulls, garage }), ...tuned, ...keep]);
  const out = [];
  for (const key of economy.owned) {
    const item = Object.hasOwn(CATALOG, key) ? CATALOG[key] : null;
    if (!item || item.stock || fitted.has(key)) continue;
    out.push({ item, refund: refundOf(item) });
  }
  return out;
}

// Fitting a checked-out draft: each part change in diff's order on the
// loadout flown, through outfit.js's equip (which refuses a part that's
// locked or that the plant can't run), on the draft's build or tune. → { ok: true,
// loadout (flown), saved (what to keep: `saved` with each change in, so a
// part a smaller plant took off still comes back on a bigger one) } or
// { ok: false, why, slot }: the first refusal, and nothing's to be kept.
export function fitDraft(kind, draft, changes, { saved = {}, unlocked = [], core = null } = {}) {
  let loadout = { ...draft.loadout };
  for (const slot of SLOTS) loadout[slot] = STOCK; // (from bare, so only what equip allows goes on)
  const keep = { ...saved };
  const parts = changes.filter((c) => !c.module);
  // what isn't changing goes on first, then the changes in their order
  const order = [...SLOTS.filter((slot) => !parts.some((c) => c.slot === slot)).map((slot) => ({ slot, to: draft.loadout[slot] ?? STOCK })), ...parts];
  for (const { slot, to } of order) {
    if (to === STOCK) continue;
    const r = equip(kind, loadout, slot, to, unlocked, draft.build, draft.tune, core);
    if (!r.ok) return { ok: false, why: r.reason, slot };
    loadout = r.loadout;
  }
  for (const c of parts) keep[c.slot] = c.to;
  return { ok: true, loadout, saved: keep };
}

// The catalogue keys of everything a draft holds that isn't stock, owned or
// not: kept from the Sell list while it's staged (selling one would only
// put it back on the bill at full price).
export function draftKeys(draft) {
  const out = [];
  for (const slot of SLOTS) {
    const item = (draft.loadout[slot] ?? STOCK) !== STOCK ? itemOfPart(slot, draft.loadout[slot]) : null;
    if (item && !item.stock) out.push(item.key);
  }
  for (const slot of draft.build ? BUILD_SLOTS : TUNE_SLOTS) {
    const item = itemOfModule(slot, (draft.build ?? draft.tune ?? {})[slot]);
    if (item && !item.stock) out.push(item.key);
  }
  return out;
}

// What the yard calls the hull a draft flies: the garage build and its code,
// or the crew's own ship, said to be tuned once any module is on it.
export const hullName = (draft) => (draft.build ? `Garage build ${buildCode(draft.build)}` : Object.keys(draft.tune ?? {}).length ? 'Stock hull · tuned' : 'Stock hull');

// What the panel says when a garage build flies in place of the crew's own
// ship (`craft`: crews.js's ship, 'An X-wing'), so the iconic ship is never
// gone without a word; null on the stock hull.
export function hullLine(build, craft = '') {
  if (!build) return null;
  const code = buildCode(build);
  return craft
    ? `Flying garage build ${code} in place of ${craft[0].toLowerCase()}${craft.slice(1)}. Pick Stock in the shipyard’s Hull to fly it again.`
    : `Flying garage build ${code}. Pick Stock in the shipyard’s Hull to fly the crew’s own ship again.`;
}
