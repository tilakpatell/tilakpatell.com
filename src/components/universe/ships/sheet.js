// What a crew's ship is, as words and numbers for a screen to draw: the
// Hangar's Systems tab (systemRows) and the GUI's pause menu and inventory
// (shipSheet). Pure (no React, DOM or three.js).
//
// LIVE: the systems a tier does something for yet, in SYSTEMS' order (the
//   scanner and the hold join with the exploring and the market; the
//   hyperdrive's range is said once a jump is held to it): only these are sold
// systemRows({ crew, build, economy }) → [{ id, label, tier, mk, value,
//   nextValue (null at Mk V), item (the next tier's, or null), pill (shop.js's
//   pillOf, or null with no wallet or at Mk V; a lock names only what's
//   missing) }]
// signatureLine(crew, build) → { role, line }: the Systems tab's head
// shipSheet({ crew, build, economy, hold, record }) → { ship, role,
//   signature, systems (systemRows'), hold: { used, room, goods }, credits,
//   data (exploration data not yet paid), explored: { sectors, systems,
//   surveyed, furthest } } (the hold and the record are lanes 2 and 3's: empty
//   until they come)

import { needText } from '../catalog';
import { SHIP } from '../ship';
import { capacityOf } from '../outfit';
import { pillOf } from '../shop';
import { readBuild } from '../shipyard/build';
import { MAX_TIER, SYSTEMS, SYSTEM_LABEL, coreStats, profileOf } from './profiles';
import { MK, tierItem, tiersOf } from './tiers';
import { SIGNATURE_LINE } from '../signatures';

export const LIVE = Object.freeze(['engines', 'pulse', 'hyperdrive', 'shields', 'scanner', 'hold', 'reactor']);
const RANGED = true; // (a jump into generated space is held to the hyperdrive's range: explore/route.js)
const HYPER_RECHARGE = 5; // (nav.js's HYPER.recharge: the seconds the stock hyperdrive takes)
const times = (v) => `×${v.toFixed(2)}`;
const seconds = (v) => `${+v.toFixed(1)} s`;

// a system's number at a core, in words a pilot reads
function valueOf(system, core, plant) {
  if (system === 'engines') return times(core.engines);
  if (system === 'pulse') return `${Math.round(SHIP.pulse * core.pulse).toLocaleString('en-GB')} a second`;
  if (system === 'hyperdrive') return RANGED ? `${core.range} sectors, every ${seconds(HYPER_RECHARGE * core.recharge)}` : `a jump every ${seconds(HYPER_RECHARGE * core.recharge)}`;
  if (system === 'shields') return times(core.shields);
  if (system === 'scanner') return core.scanReach === Infinity ? 'the whole sector' : `${Math.round(core.scanReach).toLocaleString('en-GB')} out`;
  if (system === 'hold') return `${core.hold} units`;
  return `${plant + core.reactor} MW`;
}

const rec = (r) => (typeof r?.record === 'function' ? r.record() : r);
const owner = (economy) => (economy ? (key) => economy.owns(key) : null);
const buildOf = (build) => (build ? readBuild(build) : null);

export function systemRows({ crew, build = null, economy = null }) {
  const b = buildOf(build);
  const tiers = tiersOf(owner(economy), crew);
  const core = coreStats(crew, tiers, { build: b });
  const plant = capacityOf(crew, b);
  return SYSTEMS.filter((id) => LIVE.includes(id)).map((id) => {
    const tier = tiers[id];
    const top = tier >= MAX_TIER;
    const next = top ? null : coreStats(crew, { ...tiers, [id]: tier + 1 }, { build: b });
    const item = top ? null : tierItem(crew, id, tier + 1);
    let pill = item && economy ? pillOf(economy, item) : null;
    // (what's missing only: the tier before it is fitted, or it wouldn't be next)
    if (pill?.kind === 'locked' && item.needs.goods) pill = { kind: 'locked', text: needText({ goods: item.needs.goods }) };
    return { id, label: SYSTEM_LABEL[id], tier, mk: MK[tier], value: valueOf(id, core, plant), nextValue: next ? valueOf(id, next, plant) : null, item, pill };
  });
}

// The ship's role and its signature, in words: the Systems tab's head
export function signatureLine(crew, build = null) {
  const p = profileOf(crew, build ? readBuild(build) : null);
  return { role: p.role, line: p.signature ? SIGNATURE_LINE[p.signature] : 'A garage build: no signature of its own.' };
}

export function shipSheet({ crew, build = null, economy = null, hold = null, record = null }) {
  const b = buildOf(build);
  const p = profileOf(crew, b);
  const core = coreStats(crew, tiersOf(owner(economy), crew), { build: b });
  const goods = Array.isArray(hold?.goods) ? hold.goods : [];
  return {
    ship: crew,
    role: p.role,
    signature: p.signature,
    systems: systemRows({ crew, build, economy }),
    hold: { used: goods.reduce((n, g) => n + (g.n ?? 0), 0), room: core.hold, goods },
    credits: economy?.credits ?? 0,
    // (the explorer's record, explore/record.js's: its record() read-out, or the record itself)
    data: rec(record)?.data ?? 0,
    explored: { sectors: rec(record)?.sectors ?? 0, systems: rec(record)?.systems ?? 0, surveyed: rec(record)?.surveyed ?? 0, furthest: rec(record)?.furthest ?? 0 },
  };
}
