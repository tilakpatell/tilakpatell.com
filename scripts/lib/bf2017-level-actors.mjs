// A level's placed creatures, droids and civilians, and its vehicle spawns,
// as the site's rows (lane E0): the map's `actor` groups (skinned figures
// standing in their bind pose: web/maps/README.md) and `vehicleSpawns`,
// named by the site's kinds and put in the pack's frame. A kind the site has
// not got is listed, never placed; the site's actors and placer give them
// life (actors.js's `life` rows, rides.js's `rides`, the placer's `things`).
// Pure.
//
//   kindOfActor(meshFile) → a crew kind | null (a part, or nothing the site has)
//   kindOfVehicle(blueprint) → a ride or catalogue kind | null
//   actorsJson(map, pack, { kinds, subs }) → { life: [{ kind, n, at, face, still, placed }], unplaced }
//   vehiclesJson(map, pack, { rides, things, subs }) → { rides, things, unplaced }
//   frameOf(pack) → (position, quaternion) → { at: [x, z], yaw } | null (beyond the arena)

// the game's mesh (its folder and name) → the site's crew kind
// (crewList.js); an Ewok is three meshes, its fur and hood are its body's
const ACTOR = [
  [/creatures\/ewok\/.*ewok_\d+_mesh\.glb$/, 'ewok'],
  [/creatures\/ewok\//, null],
  [/tauntaun_\d+_mesh\.glb$/, 'tauntaun'],
  [/r5d4_\d+_mesh\.glb$/, 'r5'],
  [/droids\/(r2d2|astromech)/, 'astromech'],
  [/droids\/viper|probedroid/, 'probe'],
];
// (the wind-bent shrubs are skinned for the wind, not alive: scenery)
const SCENERY = /objects\/nature\/.*_skinned/;
// (a destruction stage waiting for its turn: never a figure)
const NEVER = /despawn|leftover|_destruction_|gameplay\/equipment/;

export const kindOfActor = (file) => {
  for (const [re, kind] of ACTOR) if (re.test(file)) return kind;
  return null;
};

// the spawn's blueprint (its last name) → the site's kind
const VEHICLE = [
  [/^Mount_Tauntaun/, 'tauntaun'],
  [/SpeederBike/i, 'speederbike'],
  [/Landspeeder/i, 'landspeeder'],
  [/AT-AT/, 'atat'],
  [/AT-ST/, 'atst'],
  [/AT-TE/, 'atte'],
  [/AT-RT/, 'atrt'],
  [/^E-Web/, 'eweb'],
  [/MarkII/, 'markii'],
  [/TurboLaser/, 'turbolaser'],
  [/Atgar/, 'atgar'],
  [/^DF9/, 'turret'],
  [/AntiAir|AATurret/i, 'aaturret'],
];
const lastName = (p) => String(p).split('/').pop();
export const kindOfVehicle = (blueprint) => {
  const name = lastName(blueprint);
  for (const [re, kind] of VEHICLE) if (re.test(name)) return kind;
  return null;
};

// the game's frame to the pack's: the origin at 0, turned by the pack's yaw
// (as scripts/lib/bf2017-level.mjs's rebase turns the pieces)
export function frameOf(pack) {
  const [ox, , oz] = pack.origin;
  const yaw = pack.yaw ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const arena = pack.arena ?? Infinity;
  const r2 = (v) => Math.round(v * 100) / 100;
  return (p, [qx, qy, qz, qw]) => {
    const x = p[0] - ox;
    const z = p[2] - oz;
    const at = [r2(x * c + z * s), r2(-x * s + z * c)];
    if (Math.abs(at[0]) > arena || Math.abs(at[1]) > arena) return null;
    // (the heading of +z, the game's forward, and the pack's turn on it)
    const heading = Math.atan2(2 * (qx * qz + qw * qy), 1 - 2 * (qx * qx + qy * qy)) + yaw;
    return { at, yaw: Math.round(heading * 1000) / 1000 };
  };
}

const subName = (s) => lastName(s?.name ?? s).toLowerCase();
const tally = (list) =>
  [...list.entries()]
    .map(([blueprint, { count, why }]) => ({ blueprint, count, why }))
    .sort((a, b) => (a.blueprint < b.blueprint ? -1 : 1));
const note = (map, blueprint, why) => map.set(blueprint, { why, count: (map.get(blueprint)?.count ?? 0) + 1 });

export function actorsJson(map, pack, { kinds, subs }) {
  const want = new Set(subs.map((s) => s.toLowerCase()));
  const toPack = frameOf(pack);
  const life = [];
  const unplaced = new Map();
  const Q = map.instances.quaternion instanceof Int16Array ? 1 / 32767 : 1;
  for (const g of map.groups) {
    if (g.kind !== 'actor' || !want.has(subName(map.subworlds[g.sub]))) continue;
    const file = map.meshes[g.mesh].file;
    if (NEVER.test(file)) continue;
    const blueprint = lastName(file).replace(/_mesh\.glb$/, '');
    if (SCENERY.test(file)) {
      for (let i = 0; i < g.count; i++) note(unplaced, blueprint, 'scenery (skinned, wind-bent)');
      continue;
    }
    const kind = kindOfActor(file);
    if (kind === null && /creatures\/ewok\//.test(file)) continue; // (a part of an Ewok)
    for (let k = 0; k < g.count; k++) {
      const i = g.first + k;
      if (!kind || !kinds.has(kind)) {
        note(unplaced, blueprint, 'no kind on the site');
        continue;
      }
      const p = Array.from(map.instances.position.subarray(i * 3, i * 3 + 3));
      const q = Array.from(map.instances.quaternion.subarray(i * 4, i * 4 + 4), (v) => v * Q);
      const f = toPack(p, q);
      if (f) life.push({ kind, n: 1, at: f.at, face: f.yaw, still: true, placed: true });
    }
  }
  return { life, unplaced: tally(unplaced) };
}

export function vehiclesJson(map, pack, { rides, things, subs }) {
  const want = new Set(subs.map((s) => s.toLowerCase()));
  const toPack = frameOf(pack);
  const out = { rides: [], things: [] };
  const unplaced = new Map();
  for (const v of map.vehicleSpawns ?? []) {
    if (!want.has(subName(map.subworlds[v.sub]))) continue;
    const kind = kindOfVehicle(v.blueprint);
    const list = kind && rides.has(kind) ? out.rides : kind && things.has(kind) ? out.things : null;
    if (!list) {
      note(unplaced, lastName(v.blueprint), 'no kind on the site');
      continue;
    }
    const f = toPack(v.position, v.quaternion ?? [0, 0, 0, 1]);
    if (f) list.push({ kind, at: f.at, yaw: f.yaw, placed: true });
  }
  return { ...out, unplaced: tally(unplaced) };
}
