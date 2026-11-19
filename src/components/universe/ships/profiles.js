// The four crews' ships, each with a character of its own, and the seven
// core systems every ship has, Mk I to Mk V. A system's tier multiplies that
// ship's own Mk I, so the X-wing is still the dogfighter at Mk V and the RV
// still the hauler. Mk I is today's ship within 15 %, so a new visitor flies
// much as before. The design: docs/superpowers/specs/2026-11-18-ships-market-
// exploration-design.md, section 1. Pure (no React, DOM or three.js).
//
// SYSTEMS, SYSTEM_LABEL, MAX_TIER, LADDER, PROFILES
// profileOf(kind, build) → the crew's profile, or the neutral one for a
//   garage build flown in its place, or a kind it doesn't know
// coreStats(kind, tiers = {}, { build }) → { engines, agility, pulse,
//   shields, recharge (multipliers on today's: recharge on the hyperdrive's
//   5 s), scanReach (map units; Infinity is the whole sector), scanEvery (s),
//   hold (units), range (sectors), reactor (MW added), signature (or null) }

export const SYSTEMS = ['engines', 'pulse', 'hyperdrive', 'shields', 'scanner', 'hold', 'reactor'];
export const SYSTEM_LABEL = {
  engines: 'Engines',
  pulse: 'Pulse drive',
  hyperdrive: 'Hyperdrive',
  shields: 'Shields',
  scanner: 'Scanner',
  hold: 'Cargo hold',
  reactor: 'Reactor',
};
export const MAX_TIER = 5;

// each system's ladder, Mk I to Mk V, on the ship's own Mk I (the range
// and the reactor are rows of each ship's own, below)
export const LADDER = Object.freeze({
  engines: [1, 1.08, 1.16, 1.24, 1.32],
  pulse: [1, 1.4, 2, 2.83, 4],
  shields: [1, 1.2, 1.4, 1.65, 2],
  hold: [1, 1.6, 2.4, 3.6, 5],
  recharge: [1, 0.9, 0.8, 0.7, 0.6],
  scanReach: [10000, 25000, Infinity, Infinity, Infinity],
});
const REACTOR = [0, 1, 2, 3, 5];

const profile = (id, role, mk1, range, reactor = REACTOR, signature = id) => Object.freeze({ id, role, mk1: Object.freeze(mk1), range: Object.freeze(range), reactor: Object.freeze(reactor), signature });

// (recharge as today's 5 s share: the Falcon's 4.5 s is 0.9)
export const PROFILES = Object.freeze({
  xwing: profile('xwing', 'Fighter', { engines: 1.1, agility: 1.12, pulse: 0.95, shields: 1, scan: 1, scanEvery: 8, hold: 6, recharge: 1 }, [2, 4, 8, 14, 24]),
  falcon: profile('falcon', 'Smuggler and runner', { engines: 1, agility: 0.9, pulse: 1.1, shields: 1.1, scan: 1, scanEvery: 8, hold: 12, recharge: 0.9 }, [3, 6, 12, 22, 40], [0, 1, 2, 4, 6]),
  cruiser: profile('cruiser', 'Explorer and scientist', { engines: 1, agility: 1, pulse: 1, shields: 0.9, scan: 1.25, scanEvery: 6, hold: 10, recharge: 0.8 }, [2, 4, 8, 16, 32]),
  rv: profile('rv', 'Hauler and cook', { engines: 0.88, agility: 0.88, pulse: 0.95, shields: 1.15, scan: 0.9, scanEvery: 9, hold: 16, recharge: 1.1 }, [2, 4, 7, 13, 24], [0, 1, 3, 5, 8]),
  // (a garage build in a crew's place: today's numbers, its own plant, no signature)
  neutral: profile('neutral', 'Garage build', { engines: 1, agility: 1, pulse: 1, shields: 1, scan: 1, scanEvery: 8, hold: 10, recharge: 1 }, [2, 4, 8, 16, 32], REACTOR, null),
});

export const profileOf = (kind, build = null) => (!build && typeof kind === 'string' && Object.hasOwn(PROFILES, kind) ? PROFILES[kind] : PROFILES.neutral);

// a tier from anything: a whole number held to 1…MAX_TIER, 1 for junk
const tierIn = (v) => (Number.isFinite(v) ? Math.min(MAX_TIER, Math.max(1, Math.floor(v))) : 1);

export function coreStats(kind, tiers = {}, { build = null } = {}) {
  const p = profileOf(kind, build);
  const t = (system) => tierIn(tiers?.[system]) - 1;
  return {
    engines: p.mk1.engines * LADDER.engines[t('engines')],
    agility: p.mk1.agility,
    pulse: p.mk1.pulse * LADDER.pulse[t('pulse')],
    shields: p.mk1.shields * LADDER.shields[t('shields')],
    scanReach: p.mk1.scan * LADDER.scanReach[t('scanner')],
    scanEvery: p.mk1.scanEvery,
    hold: Math.round(p.mk1.hold * LADDER.hold[t('hold')]),
    range: p.range[t('hyperdrive')],
    recharge: p.mk1.recharge * LADDER.recharge[t('hyperdrive')],
    reactor: p.reactor[t('reactor')],
    signature: p.signature,
  };
}
