// Test-only: pins what makeSector gave on main, so the middle layer can be
// shown unchanged. Not shipped.
//
// PRINTED → the 25 [sx, sz] the fingerprint covers
// plainSector(sector, { systems?, wonders? }) → today's fields only, bigints
//   as strings, cut to the first systems and wonders when asked
// digest(plain) → hex sha256 of the plain sector's JSON

import { createHash } from "node:crypto";

// (the first five are flight/planets.js's SECTORS, where the seeded planets come from)
export const PRINTED = [
  [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [0, 0], [1, -1], [-1, 1], [-1, -1],
  [2, 0], [0, 2], [-2, 0], [0, -2], [2, -1], [3, -2], [1, 2], [5, 5], [-3, -6],
  [7, -9], [-7, 4], [12, 0], [0, -12], [100, 3], [-40, 17], [250, -250],
];

// (JSON can't hold a bigint, so every one becomes a string)
const plain = (v) =>
  typeof v === "bigint"
    ? String(v)
    : Array.isArray(v)
      ? v.map(plain)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
        : v;

const take = (o, keys) => Object.fromEntries(keys.map((k) => [k, plain(o[k])]));

const PLANET = ["id", "name", "type", "radius", "color", "at", "orbit", "moons", "rings", "seed"];
const SYSTEM = ["id", "i", "name", "designation", "at", "seed", "culture", "star", "faction", "traffic", "hazard"];
const WONDER = ["id", "kind", "name", "at", "size", "seed"];

export function plainSector(sector, { systems, wonders } = {}) {
  return {
    ...take(sector, ["id", "sx", "sz", "seed", "origin"]),
    systems: sector.systems.slice(0, systems).map((s) => ({
      ...take(s, SYSTEM),
      planets: s.planets.map((p) => take(p, PLANET)),
    })),
    wonders: sector.wonders.slice(0, wonders).map((w) => take(w, WONDER)),
    beacons: take(sector.beacons, ["n", "e", "s", "w"]),
  };
}

export const digest = (p) => createHash("sha256").update(JSON.stringify(p)).digest("hex");
