// Rick's portal gun, fired from any ship in flight, as plain numbers:
// tested in Node, flown by scene.js, drawn by gunPortalFx.js. A green bolt
// goes out of the nose, a portal splats open on the line the ship's flying,
// far enough ahead to fly into at the speed it's going, and holds a while
// before it shuts. Flown through, it's a portal: from anywhere at home it
// opens on Rick's dimension, the Central Finite Curve, coming out beside one
// of its worlds, nose on it, the Citadel off beyond it; from the Curve it
// opens on home (portals.js's transit), out beside the C-137 planet and
// facing it.
//
// GUN → its numbers (map units, seconds)
// CROSS → a Rick portal flown into (the gun's, or a sector's), as the page
//   plays it: his portal jump over the map (jumps/PortalJump.jsx) from `from`
//   ms along its timeline, where the goo fills the view (the scene drew the
//   portal opening and the flight in), and the ship out the far side under
//   its flash; `most` seconds on, out whatever the page says
// gunSpot(ship) → { at: [x, y, z], normal }: where it opens and which way it faces
// gunOpen(age, shut?) → 0…1, how open it is `age` seconds after the shot
//   (shut: the age it was told to close at, the ship through)
// gunHit(a, b, spot, age) → the step a → b went through it while it was open
// worldSpot(id) → { x, y, z, heading }: where coming out shows you world `id`
// gunTransit(ship, rand?) → { via, out: { ship, sector, exit, world? } }: the
//   sector portal it stands in for, and the ship out the other side

import { POSITIONS, REACH, inSector, sectorOf } from './layout';
import { portalById, transit } from './portals';
import { SHIP, headingTo, noseOf } from './ship';
import { MOONS } from './universes';
import { WONDERS } from './deep';

// the Curve's sun (deep.js), that lights its worlds
const SUN_AT = WONDERS.find((w) => w.id === 'curvesun').at;

export const GUN = {
  r: 1.1, // the portal's radius (the cruiser's 0.26 long: the show's portal swallows it with room)
  near: 6, // how close ahead it opens, at the least
  lead: 1.6, // seconds of flying ahead of the ship it opens
  far: 420, // and the furthest (on the pulse drive, still a green speck to aim at)
  bolt: 0.22, // the bolt's flight out to it
  open: 0.45, // its splat open
  close: 0.35, // its shutting
  life: 9, // how long it's there, the shutting included
  cool: 2.5, // between shots
  catch: 1.3, // how far out of its rim a ship still goes in (a forgiving aim), in radii
  shown: 5, // how far out from the world it shows you a portal into the Curve puts you, in its radii
};

// (from: the jump's portal as tall as the screen and closing in, 0.29 s short of its flash: jumps/timing.js's portalAt)
export const CROSS = { from: 880, most: 2.5 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function gunSpot(ship) {
  const n = noseOf(ship);
  const d = Math.min(GUN.far, Math.max(GUN.near, Math.abs(ship.speed || 0) * GUN.lead));
  return { at: [ship.x + n[0] * d, ship.y + n[1] * d, ship.z + n[2] * d], normal: n };
}

export function gunOpen(age, shut = null) {
  const a = age - GUN.bolt;
  if (a <= 0 || age >= GUN.life) return 0;
  // the splat: quick, a touch past round, back
  const k = clamp01(a / GUN.open);
  const grow = k < 1 ? 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.12 : 1;
  const end = shut == null ? GUN.life - GUN.close : Math.min(shut, GUN.life - GUN.close);
  const going = clamp01((age - end) / GUN.close);
  return Math.max(0, Math.min(1.12, grow) * (1 - going ** 2));
}

// (how close the segment a → b comes to c, squared)
function nearest2(a, b, c) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const l2 = dx * dx + dy * dy + dz * dz;
  const k = l2 > 1e-12 ? clamp01(((c[0] - a.x) * dx + (c[1] - a.y) * dy + (c[2] - a.z) * dz) / l2) : 1;
  const x = a.x + dx * k - c[0];
  const y = a.y + dy * k - c[1];
  const z = a.z + dz * k - c[2];
  return x * x + y * y + z * z;
}

export function gunHit(a, b, spot, age) {
  if (!a || !b || !spot || gunOpen(age) < 0.6) return false;
  const reach = GUN.r * GUN.catch;
  return nearest2(a, b, spot.at) < reach * reach;
}

// where a portal into the Curve puts you to show you world `id`: out on its
// day side (the Curve's sun at your back, a little to one side, away from
// the Citadel), a little above, nose on it, clear of what goes round it
// (Gear World's cogs, Charon)
export function worldSpot(id) {
  const u = MOONS.find((m) => m.id === id);
  const at = POSITIONS[id];
  const flat = (to) => {
    const l = Math.hypot(to[0] - at[0], to[2] - at[2]) || 1;
    return [(to[0] - at[0]) / l, (to[2] - at[2]) / l];
  };
  const sun = flat(SUN_AT);
  const citadel = flat(inSector('rickmorty', [0, 0, 0]));
  // between the sun and away from the Citadel: its day side, the sun at your back and a little to one side
  const mx = sun[0] * 0.8 - citadel[0] * 0.5;
  const mz = sun[1] * 0.8 - citadel[1] * 0.5;
  const ml = Math.hypot(mx, mz) || 1;
  const rx = mx / ml;
  const rz = mz / ml;
  const d = Math.max(u.size * GUN.shown, REACH[id] + 6);
  const x = at[0] + rx * d;
  const y = at[1] + u.size * 0.6;
  const z = at[2] + rz * d;
  return { x, y, z, heading: headingTo(at[0] - x, at[2] - z) };
}

export function gunTransit(ship, rand = Math.random) {
  const home = sectorOf(ship.x, ship.y, ship.z) !== 'rickmorty';
  if (home) {
    // into Rick's dimension: out beside one of its worlds, coming out slowly
    const world = MOONS[Math.min(MOONS.length - 1, Math.floor(rand() * MOONS.length))].id;
    const spot = worldSpot(world);
    const speed = Math.min(Math.abs(ship.speed || 0) * 0.5, SHIP.cruise * 0.5);
    return {
      via: 'rmportal',
      out: { ship: { ...ship, ...spot, speed, vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, edge: false }, sector: 'rickmorty', exit: 'rmportal-back', world, label: MOONS.find((m) => m.id === world).label },
    };
  }
  // home: out of the portal by the C-137 planet, facing it
  const via = 'rmportal-back';
  const exit = portalById(portalById(via).leadsTo.exit);
  const look = POSITIONS.rickmorty;
  const heading = headingTo(look[0] - exit.at[0], look[2] - exit.at[2]);
  return { via, out: transit({ ...ship, heading, pitch: 0, bank: 0 }, via) };
}
