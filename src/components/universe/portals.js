// The portals between the map's sectors (layout.js's SECTORS), as plain
// numbers: tested in Node, flown by scene.js, drawn by sectorPortals.js.
//
// A portal is a wonder (deep.js, kind 'portal', not solid) with `leadsTo`:
// { sector, exit }, the sector it opens on and the portal it comes out of
// there. Fly into one (the ship's path passes within its radius of its
// middle) and it's a transit: the ship comes out by the other end, a few
// radii off it on the heading it went in on (so it flies on away from it),
// level, at half the speed (no more than the boost: it comes out flying,
// not on the pulse drive). One beside the Rick and Morty planet goes to the
// Rick and Morty sector, by the Citadel; the one there comes home.
//
// PORTALS → the portal wonders
// portalById(id) → one, or null
// portalHit(a, b) → the portal the step from a to b ({ x, y, z }) went into, or null
// exitSpot(id, heading) → { x, y, z, heading }: where a ship comes out of
//   portal `id`'s far end, clear of anything solid
// transit(ship, id) → { ship, sector, exit }: the ship through portal `id`

import { WONDERS } from './deep';
import { SHIP, SOLIDS, forward } from './ship';
import { sectorOf } from './layout';

export const PORTALS = WONDERS.filter((w) => w.kind === 'portal');
const BY_ID = new Map(PORTALS.map((p) => [p.id, p]));
export const portalById = (id) => BY_ID.get(id) ?? null;

// how far from the far end's middle the ship comes out, in its radii
export const OUT = 3;
// how much clear of anything solid that spot has to be, past its reach
const CLEAR = 6;

// (how close the segment a → b comes to c, squared)
function nearest2(a, b, c) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const l2 = dx * dx + dy * dy + dz * dz;
  const k = l2 > 1e-12 ? Math.max(0, Math.min(1, ((c[0] - a.x) * dx + (c[1] - a.y) * dy + (c[2] - a.z) * dz) / l2)) : 1;
  const x = a.x + dx * k - c[0];
  const y = a.y + dy * k - c[1];
  const z = a.z + dz * k - c[2];
  return x * x + y * y + z * z;
}

export function portalHit(a, b) {
  if (!a || !b) return null;
  for (const p of PORTALS) if (nearest2(a, b, p.at) < p.r * p.r) return p.id;
  return null;
}

export function exitSpot(id, heading = 0) {
  const p = portalById(id);
  const out = portalById(p?.leadsTo?.exit);
  if (!out) return null;
  // the way it was going, or round to the nearest way that's clear
  for (let i = 0; i < 24; i++) {
    const h = heading + Math.ceil(i / 2) * (i % 2 ? 1 : -1) * ((Math.PI * 2) / 24);
    const [fx, fz] = forward(h);
    const x = out.at[0] + fx * out.r * OUT;
    const y = out.at[1];
    const z = out.at[2] + fz * out.r * OUT;
    if (SOLIDS.every((o) => Math.hypot(x - o.at[0], y - o.at[1], z - o.at[2]) > o.reach + CLEAR)) return { x, y, z, heading: h };
  }
  const [fx, fz] = forward(heading);
  return { x: out.at[0] + fx * out.r * OUT, y: out.at[1], z: out.at[2] + fz * out.r * OUT, heading };
}

export function transit(ship, id) {
  const p = portalById(id);
  const at = exitSpot(id, ship.heading);
  if (!p || !at) return null;
  return {
    ship: { ...ship, ...at, speed: Math.min(ship.speed * 0.5, SHIP.boost), vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, edge: false },
    sector: sectorOf(at.x, at.y, at.z),
    exit: p.leadsTo.exit,
  };
}
