// Who meets whom: Rapier's collision groups, (memberships << 16) | filter,
// two colliders meeting only when each one's memberships land in the
// other's filter. Bruno Simon's three stay as they were (floor meets
// everything, object meets everything and bumpers, bumper meets objects
// only): bit 1 is his "all", worn by the floor and by everything that
// should meet it. The five new ones: a character (a figure's capsule: the
// floor, objects, other characters, zones; it does not wear his "all" bit,
// the floor's and the object's filters name it instead, so a query for the
// floor and objects, a brain's sight or a bolt's flight, never meets a
// figure's capsule), a hurtbox (a region of a figure, a sensor: meets
// nothing by contact and is found only by the two query groups), a zone
// (a sensor volume: characters), and two groups no collider wears, for
// queries: a projectile's path (the floor, objects, hurtboxes) and a line
// of sight (the floor, objects, characters); and a barrier (a solid only a
// character meets: the game's CharacterCollisionGeometry layer, which
// meets characters and ragdolls alone, bf2-re findings/46's pair table; a
// bolt's flight, a sight and the camera pass it). `filterOf` builds a query's
// groups: every membership, and the named groups in its filter; since
// objects wear the floor's bit, a filter that names the floor admits them
// too (there is no floor-only query). Pure.
//
//   MEMBERS: { [name]: bit }; GROUPS: { [name]: groups }; filterOf(...names) → groups

const ALL = 1;
export const MEMBERS = { floor: ALL, object: 2, bumper: 4, character: 8, hurtbox: 16, zone: 32, projectile: 64, sight: 128, barrier: 256 };
const M = MEMBERS;
const group = (member, filter) => ((member << 16) | filter) >>> 0;

export const GROUPS = {
  floor: group(ALL, ALL | M.character),
  object: group(ALL | M.object, ALL | M.bumper | M.character),
  bumper: group(M.bumper, M.object),
  character: group(M.character, ALL | M.object | M.character | M.zone | M.barrier),
  hurtbox: group(M.hurtbox, M.projectile | M.sight),
  zone: group(M.zone, M.character),
  projectile: group(M.projectile, ALL | M.object | M.hurtbox),
  sight: group(M.sight, ALL | M.object | M.character),
  barrier: group(M.barrier, M.character),
};

export function filterOf(...names) {
  let filter = 0;
  for (const n of names) {
    if (!(n in M)) throw new Error(`physics: no group '${n}'`);
    filter |= M[n];
  }
  return group(0xffff, filter);
}
