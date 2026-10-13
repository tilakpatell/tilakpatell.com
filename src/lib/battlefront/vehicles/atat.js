// The AT-AT (`Vehicle_Ground_AT-AT_MP`) as the game has it (bf2-re finding
// 45, section 4.1), from its row in vehicles.json and its clips: a rail
// walker at the walk clip's own pace, turning no faster than its turning
// cycle, its body following the ground under its three support rays with
// the record's inertia, hit on the record's head and four leg bodies and
// the collider meshes' torso and neck, immortal but for the uplinks'
// windows, its guns where the rig has them. Pure.
//
//   atatOf(rb) → the spec: { id, health, speed, turn, reach, p, i, rays,
//     inertia, guns: [{ id, kind: 'chin' | 'ear', at, row }], seats, head }
//   walkerBody(spec, { at, yaw }) → the walker's state on its rail's start
//   capsulesOf(w, spec) → its hit capsules in the world (w.capsules, reused)
//   followGround(w, spec, heightAt, dt) → w (pitch and roll eased toward the
//     plane through the rays' ground, the record's inertia)
//   muzzleAt(w, spec, gun, headYaw) → [x, y, z]: a barrel in the world
//   headToward(w, spec, at) → the head's yaw toward a point, within HEAD's reach
//   damageState(w) → 0 sound … 3 (PF_VehicleSpawner_AT-AT_MP's fractions)
//   openFor(w, until) / bombingRun(w, share)  (an uplink's work on a walker)

import { vehicleOf } from '../rulebook.js';

export const ATAT_ID = 'Vehicle_Ground_AT-AT_MP';
const DEG = Math.PI / 180;

// The clips' root motion (web/anims.jsonl and the packed clips agree): the
// walk goes 8.5 m in its 200 frames at 30 a second, the turning cycle turns
// its trajectory from −90° to −55° in as long. These are the walker's pace
// and its fastest turn.
export const CLIPS = {
  walk: { travel: 8.5, seconds: 200 / 30, _source: 'web/anims.jsonl#C_ATAT_Stand_Walk_FWD.distance, frames 200 at fps 30' },
  turn: { degrees: 35, seconds: 200 / 30, _source: 'web/anims/atat_ske/c_atat_stand_walk_fwd_turn.glb#AITrajectory.rotation (−90° → −55°)' },
};
export const WALK_SPEED = CLIPS.walk.travel / CLIPS.walk.seconds;
export const TURN_RATE = (CLIPS.turn.degrees * DEG) / CLIPS.turn.seconds;

// `IsVulnerable`'s window on Hoth: the level's logic sets the interface's
// Duration to 50 (two FloatEntityData 50 in Levels/MP/Hoth_01's
// FantasyBattle_Logic, finding 27; the interface's default is 10).
export const VULNERABLE_HOTH = 50;
// What one hit scores while it is open: clamp(damage, 0, 500) (the walker's
// `_Gameplay` layer, finding 45).
export const HIT_SCORE_CAP = 500;
// `PF_VehicleSpawner_AT-AT_MP` compares the health fraction with these for
// the HUD and the commander's lines: hit, half, a quarter.
export const STATES = [0.99, 0.5, 0.25];

// Where its guns are, at the rig's rest (the game's skinned `old/atat_mesh`,
// its bones `LeftGun`, `RightGun` under the chin and `LeftSecGun`,
// `RightSecGun` the ear cannons, in the vehicle's frame: +z ahead, +x its
// left, metres from the middle between its feet), and the head's pivot
// (`NeckRotate`). derived: the rig's bind pose, src/data/bf2017/NOTES.md.
export const RIG = {
  barrels: { 'Left Chin Cannon': [0.884, 14.874, 17.33], 'Right Chin Cannon': [-0.882, 14.874, 17.33], 'Left Ear Cannon': [2.087, 16.142, 13.501], 'Right Ear Cannon': [-2.059, 16.142, 13.501] },
  neck: [0, 16.653, 7.196],
  _source: 'derived: web/models/gameplay/vehicles/ground/at-at/old/atat_mesh.glb bind pose',
};
// How far the head turns toward what it shoots, either way, and how fast:
// the game blends six one-frame aim poses (`A_ATAT_HeadAim_*`) the export
// does not hold, so by hand (NOTES.md).
export const HEAD = { yaw: 40 * DEG, rate: 20 * DEG };

// The hit volumes in the vehicle's frame: the record's keyframed head and
// four leg bodies (`RigidBodyData`, their places), sized and joined by the
// game's collider meshes (`atat_colliders_body_mesh`, `_neck_mesh`,
// `_head_mesh`, in their bones' frames); the legs' width by hand.
// derived: NOTES.md says how.
export const BODY = [
  { part: 'body', a: [0, 17.25, -4.3], b: [0, 17.25, 3.1], r: 4.3 },
  { part: 'neck', a: [0, 16.7, 7.8], b: [0, 16.7, 9.3], r: 1.3 },
  { part: 'head', a: [0, 16.2, 11.6], b: [0, 16.2, 14.5], r: 2.1 },
  { part: 'leg', a: [2.065, 0.6, -5.179], b: [2.065, 12.5, -5.179], r: 1.1 },
  { part: 'leg', a: [-2.065, 0.6, -5.179], b: [-2.065, 12.5, -5.179], r: 1.1 },
  { part: 'leg', a: [2.065, 0.6, 4.933], b: [2.065, 12.5, 4.933], r: 1.1 },
  { part: 'leg', a: [-2.065, 0.6, 4.933], b: [-2.065, 12.5, 4.933], r: 1.1 },
];
// the middle of it all and a sphere that holds every volume, for the bolts' first look
export const REACH = { at: [0, 11, 3], r: 17 };

// a vehicle-frame point to the world: turned by the walker's yaw, pitched and rolled on its middle
export function toWorld(w, p, out = [0, 0, 0]) {
  const pitch = w.pitch ?? 0;
  const roll = w.roll ?? 0;
  // (roll about +z, then pitch about +x: nose up is +pitch, the left side up is +roll)
  let [x, y, z] = p;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  [x, y] = [x * cr - y * sr, x * sr + y * cr];
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  [y, z] = [y * cp + z * sp, -y * sp + z * cp];
  const c = Math.cos(w.yaw ?? 0);
  const s = Math.sin(w.yaw ?? 0);
  out[0] = w.at[0] + x * c + z * s;
  out[1] = w.at[1] + y;
  out[2] = w.at[2] - x * s + z * c;
  return out;
}

export function atatOf(rb, id = ATAT_ID) {
  const row = vehicleOf(rb, id);
  const guns = row.weapons
    .filter((wp) => RIG.barrels[wp.name])
    .map((wp) => ({ id: wp.name, kind: /Chin/.test(wp.name) ? 'chin' : 'ear', at: RIG.barrels[wp.name], row: wp }));
  return {
    id: row.id,
    row,
    health: row.health,
    speed: WALK_SPEED * (row.driver?.speedMultiplier ?? 1),
    turn: TURN_RATE,
    reach: row.driver?.reach ?? 15,
    p: row.driver?.p ?? 10,
    i: row.driver?.i ?? 1,
    rays: row.walker?.rays ?? [[6, 0], [-6, 2], [-6, -2]],
    inertia: row.walker?.inertia ?? 0.5,
    guns,
    overheat: row.overheat ?? null,
    seats: row.seats ?? [],
  };
}

export function walkerBody(spec, { at, yaw = 0 }) {
  return { kind: 'walker', vehicle: 'atat', at: [...at], yaw, pitch: 0, roll: 0, hp: spec.health, hpMax: spec.health, alive: true, vulnerable: false, disabled: false, moving: false, yawRate: 0, headYaw: 0, target: null, death: null, capsules: [] };
}

export function capsulesOf(w, spec = null) {
  void spec;
  const list = (w.capsules ??= []);
  BODY.forEach((c, i) => {
    const o = (list[i] ??= { part: c.part, a: [0, 0, 0], b: [0, 0, 0], r: c.r });
    toWorld(w, c.a, o.a);
    toWorld(w, c.b, o.b);
  });
  list.length = BODY.length;
  // (the bolts' first look: one sphere round it all, lib/battlefront/bolts.js)
  w.broad = { at: toWorld(w, REACH.at, w.broad?.at), r: REACH.r };
  return list;
}

// the ground under the rays, as a plane: its pitch (nose up +) and roll (left side up +)
export function groundPlane(w, spec, heightAt) {
  const c = Math.cos(w.yaw ?? 0);
  const s = Math.sin(w.yaw ?? 0);
  const pts = spec.rays.map(([fwd, left]) => {
    const x = w.at[0] + left * c + fwd * s;
    const z = w.at[2] - left * s + fwd * c;
    return [fwd, left, heightAt(x, z)];
  });
  const [p0, p1, p2] = pts;
  // (the front ray against the back two's middle, and the back two against each other)
  const back = [(p1[0] + p2[0]) / 2, (p1[2] + p2[2]) / 2];
  const pitch = Math.atan2(p0[2] - back[1], p0[0] - back[0] || 1);
  const roll = Math.abs(p1[1] - p2[1]) > 1e-6 ? Math.atan2(p1[2] - p2[2], p1[1] - p2[1]) : 0;
  return { pitch, roll };
}

export function followGround(w, spec, heightAt, dt) {
  const g = groundPlane(w, spec, heightAt);
  const k = spec.inertia > 0 ? Math.min(1, dt / spec.inertia) : 1;
  w.pitch = (w.pitch ?? 0) + (g.pitch - (w.pitch ?? 0)) * k;
  w.roll = (w.roll ?? 0) + (g.roll - (w.roll ?? 0)) * k;
  return w;
}

// a barrel in the world: its rest place turned with the head about the neck
export function muzzleAt(w, spec, gun, headYaw = w.headYaw ?? 0) {
  void spec;
  const [nx, , nz] = RIG.neck;
  const dx = gun.at[0] - nx;
  const dz = gun.at[2] - nz;
  const c = Math.cos(headYaw);
  const s = Math.sin(headYaw);
  return toWorld(w, [nx + dx * c + dz * s, gun.at[1], nz - dx * s + dz * c]);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function headToward(w, spec, at) {
  void spec;
  const neck = toWorld(w, RIG.neck);
  const want = wrap(Math.atan2(at[0] - neck[0], at[2] - neck[2]) - (w.yaw ?? 0));
  return Math.max(-HEAD.yaw, Math.min(HEAD.yaw, want));
}

export function damageState(w) {
  if (!w.alive) return 4;
  const f = w.hp / (w.hpMax || 1);
  return f < STATES[2] ? 3 : f < STATES[1] ? 2 : f < STATES[0] ? 1 : 0;
}

export function openFor(w, until) {
  w.vulnerableUntil = Math.max(w.vulnerableUntil ?? -Infinity, until);
}

export function bombingRun(w, share) {
  if (!w.alive) return 0;
  const was = w.hp;
  w.hp = Math.max(0, w.hp - share * w.hpMax);
  return was - w.hp;
}
