// What a find is worth to the data bank: its kind's worth × how far from the
// Core it is (1 + 0.08 a sector, to 3.4 at 30: the spec's 0.15 paid exploring
// far out several times anything else, pacing.test.js) × (1 + the region's richness).
// Pure.
//
// WORTH: { [kind]: credits }; SURVEYED: the systems' worth a sector's survey pays
// worthOf(kind, d, richness) → whole credits (0 for a kind that's worth nothing)

export const WORTH = Object.freeze({
  sector: 40,
  system: 25,
  planet: 8,
  moon: 8,
  station: 10,
  derelict: 30,
  outpost: 30,
  relay: 20,
  monolith: 60,
  pulsar: 120,
  magnetar: 120,
  wormhole: 150,
  remnant: 60,
  protostar: 50,
  storm: 30,
  comet: 20,
  field: 10,
  icefield: 10,
  rig: 15,
  fleet: 15,
  shipyard: 25,
  herd: 40,
  swarm: 30,
  debris: 10,
  gargantuan: 400,
});
export const SURVEYED = 10; // (systems' worth)

const distanceK = (d) => 1 + 0.08 * Math.min(30, Math.max(0, Number(d) || 0));
export function worthOf(kind, d = 0, richness = 0) {
  const w = WORTH[kind];
  if (!w) return 0;
  const r = Number.isFinite(richness) ? Math.min(1, Math.max(0, richness)) : 0;
  return Math.round(w * distanceK(d) * (1 + r));
}
