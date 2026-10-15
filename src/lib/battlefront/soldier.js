// A soldier from a class row (spec catalogue 1): its health and regen, its
// stance, its gun, its abilities (the roll among them) and an affector
// stack over all of it; the walk speeds from the game's character physics
// (`OnGroundStateData`: stand 3.8 m/s, sprint × 1.57, crouch 2.5) and the
// pose heights (stand 1.7, crouch 1.15); and a capsule per body part with
// the game's radii (`DefaultSoldierBoneCollision`), laid on a simple
// skeleton by stance since the sim poses no bones. Pure.
//
//   newSoldier(classRow, { id, team, at, yaw, rand, bot, weapon, abilities }) → s
//   bodyOf(row) → { stand, crouch, chest, eye } metres (a row's `body`, the soldier's where it has none)
//   capsulesOf(s) → [{ part, a, b, r }]    hurt(s, { damage, part, from, by, now }) → 'hurt' | 'down' | null
//   tick(s, dt, now)    speedOf(s) → m/s    move(s, dir, dt, nav) → metres moved    stanceOf(s)

import bones from '../../data/bf2017/physics/bones.json';
import physics from '../../data/bf2017/physics/soldier.json';
import { ROLL, createAbilities, tick as tickAbilities } from './abilities.js';
import { createStack, resolve, tick as tickStack } from './affectors.js';
import { heightAt, walkable } from './nav.js';
import { meshMove } from './meshNav.js';
import { createGun, tick as tickGun } from './weapons.js';

const BODY = physics.rows[physics.default];
const GROUND = BODY.states.onGround.poses;
const POSES = BODY.poses;
const SET = bones.sets.find((s) => s.id === 'defaultsoldierbonecollision');
const radiusOf = (bone, k = 0) => SET.bones.filter((b) => b.bone === bone)[k].radius;
const lengthOf = (bone) => SET.bones.find((b) => b.bone === bone).length;

// No damage multiplier by bone is in the bone collision data (lane 0 and P2
// read it whole): the head's, the game's headshot rule by observation.
export const HEAD_MULTIPLIER = 1.5;
// `SoldierEntityData.TimeForCorpse` (4.5 s on the soldier blueprints the
// design's survey read; no rulebook carries it yet): dying to gone.
export const TIME_FOR_CORPSE = 4.5;
// The roll's travel: its ability gives the 0.1 s it takes to trigger, not
// how far it carries. The game's by observation.
export const ROLL_TIME = 0.6;
export const ROLL_SPEED = 5;

export function newSoldier(cls, { id, team, at, yaw = 0, rand = Math.random, bot = true, weapon = null, abilities = [ROLL] }) {
  const s = {
    id,
    team,
    kind: 'soldier',
    bot,
    cls,
    body: bodyOf(cls),
    at: [...at],
    yaw,
    vel: [0, 0, 0],
    hp: cls.health,
    hpMax: cls.health,
    state: 'stand',
    stance: 'stand',
    moving: false,
    sprint: false,
    gun: weapon ? createGun(weapon, { rand }) : null,
    weapon,
    // (a human's press that cannot act yet is held half a second; a bot's is its brain's to make again: abilities.js)
    abilities: createAbilities(abilities, { rand, hold: !bot }),
    stack: createStack(),
    lastHurt: -Infinity,
    lastBy: null,
    suppressed: 0,
    alive: true,
    diedAt: null,
    rollUntil: 0,
    rollDir: [0, 0],
  };
  return s;
}

export const stanceOf = (s) => (s.state === 'roll' ? 'roll' : s.stance);

// part, the bone it takes its radius from, and where on a body of the pose's height it lies (fractions, metres to the side, forward)
function skeleton(H) {
  const head = radiusOf('Head');
  const len = lengthOf('Head');
  return [
    ['head', [0, H - head - len, 0], [0, H - head, 0], head],
    ['chest', [0, 0.62 * H, 0], [0, 0.78 * H, 0], radiusOf('Spine', 0)],
    ['hips', [0, 0.45 * H, 0], [0, 0.58 * H, 0], radiusOf('Spine', 1)],
    ['armL', [0.22, 0.8 * H, 0], [0.12, 0.62 * H, 0.35], radiusOf('LeftArm')],
    ['armR', [-0.22, 0.8 * H, 0], [-0.12, 0.62 * H, 0.35], radiusOf('RightArm')],
    ['legL', [0.1, 0.48 * H, 0], [0.1, radiusOf('LeftUpLeg'), 0], radiusOf('LeftUpLeg')],
    ['legR', [-0.1, 0.48 * H, 0], [-0.1, radiusOf('RightUpLeg'), 0], radiusOf('RightUpLeg')],
  ];
}

// A unit's body, metres: how tall it stands and crouches, the height a
// player's aim leaves it from (the page's 1.4 m, by hand) and its eye. A row
// with no `body` is the soldier's (DefaultSoldierPhysics); a row's `body`
// (a hero's physics row, hero.js; a guest's own height) gives what it has
// and takes the rest in the soldier's proportions to its `stand`.
export const AIM_HEIGHT = 1.4;
const SOLDIER = { stand: POSES.stand.height, crouch: POSES.crouch.height, chest: AIM_HEIGHT, eye: POSES.stand.eye[1] };

export function bodyOf(row) {
  const b = row?.body;
  if (!b) return { ...SOLDIER };
  const stand = b.stand ?? SOLDIER.stand;
  const k = stand / SOLDIER.stand;
  return { stand, crouch: b.crouch ?? SOLDIER.crouch * k, chest: b.chest ?? SOLDIER.chest * k, eye: b.eye ?? SOLDIER.eye * k };
}

// (a skeleton a height, made once)
const SKELETONS = new Map();
const skeletonOf = (H) => {
  if (!SKELETONS.has(H)) SKELETONS.set(H, skeleton(H));
  return SKELETONS.get(H);
};
const low = (s) => s.stance === 'crouch';

export function capsulesOf(s, out = []) {
  const c = Math.cos(s.yaw);
  const n = Math.sin(s.yaw);
  const place = (p) => [s.at[0] + p[0] * c + p[2] * n, s.at[1] + p[1], s.at[2] - p[0] * n + p[2] * c];
  const body = s.body ?? SOLDIER;
  const parts = skeletonOf(low(s) || s.state === 'roll' ? body.crouch : body.stand);
  out.length = parts.length;
  for (let i = 0; i < parts.length; i++) {
    const [part, a, b, r] = parts[i];
    out[i] = { part, a: place(a), b: place(b), r };
  }
  return out;
}

// the chest's middle, where a bot aims and a line of sight is drawn to
export const chestOf = (s) => [s.at[0], s.at[1] + (low(s) ? (s.body ?? SOLDIER).crouch : (s.body ?? SOLDIER).stand) * 0.7, s.at[2]];
// (crouched, the soldier's eye is its record's; a body of its own brings its eye down as far as it crouches)
const eyeLow = (s) => (s.cls?.body ? (s.body.eye * s.body.crouch) / s.body.stand : POSES.crouch.eye[1]);
export const eyeOf = (s) => [s.at[0], s.at[1] + (low(s) ? eyeLow(s) : (s.body ?? SOLDIER).eye), s.at[2]];

export function hurt(s, { damage, part = 'chest', by = null, now = 0 }) {
  if (!s.alive) return null;
  const head = part === 'head' ? HEAD_MULTIPLIER : 1;
  const dealt = damage * head * resolve(s.stack, 'ArmorMultiplier', 1);
  s.hp = Math.max(0, s.hp - dealt);
  s.lastHurt = now;
  s.lastBy = by;
  if (s.hp > 0) return 'hurt';
  s.alive = false;
  s.state = 'dying';
  s.diedAt = now;
  s.moving = false;
  return 'down';
}

export function speedOf(s) {
  if (s.state === 'roll') return s.cls?.roll?.speed ?? ROLL_SPEED;
  // a hero's own drive (heroKit.json): its pace whatever the stance, the Blocking drive's while its saber is up
  const d = s.cls?.drive;
  if (d) {
    const row = s.blocking && s.cls.blockDrive ? s.cls.blockDrive : d;
    return resolve(s.stack, 'speed', row.speed * (s.sprint && !s.blocking ? row.sprint : 1));
  }
  const pose = s.stance === 'crouch' ? GROUND.crouch : GROUND.stand;
  // (an ability's AbilitySprintSpeedMultiplier, the vanguard's and infiltration's 1.3, on the sprint alone)
  const sprint = s.sprint && pose.sprintMultiplier > 0 ? pose.sprintMultiplier * resolve(s.stack, 'sprint', 1) : 1;
  return resolve(s.stack, 'speed', pose.velocity * sprint);
}

export function tick(s, dt, now) {
  tickStack(s.stack, now);
  if (!s.alive) {
    if (s.state === 'dying' && now - s.diedAt >= TIME_FOR_CORPSE - 1e-9) s.state = 'down';
    return [];
  }
  const r = s.cls.regen;
  if (r && now - s.lastHurt >= r.delay) s.hp = Math.min(s.hpMax, s.hp + r.rate * dt);
  if (s.gun) tickGun(s.gun, dt, now);
  if (s.state === 'roll' && now >= s.rollUntil) s.state = s.stance;
  return tickAbilities(s.abilities, dt, now);
}

export function roll(s, dir, now) {
  s.state = 'roll';
  s.rollUntil = now + (s.cls?.roll?.time ?? ROLL_TIME);
  s.rollDir = [...dir];
}

// a hero's drive by the way it moves against the way it faces: ahead at its
// speed, backward at `back` of it, sideways at `strafe` (DriveWithInput's
// scaling f/b/l/r), between them by the angle's square; a trooper's 1
function driveScale(s, dir, len) {
  const d = s.cls?.drive;
  if (!d || s.state === 'roll' || len < 1e-9) return 1;
  const row = s.blocking && s.cls.blockDrive ? s.cls.blockDrive : d;
  const f = (dir[0] * Math.sin(s.yaw) + dir[1] * Math.cos(s.yaw)) / len;
  const f2 = f * f;
  return f2 * (f >= 0 ? 1 : (row.back ?? 1)) + (1 - f2) * (row.strafe ?? 1);
}

// a step along dir (a unit [x, z]) at the soldier's speed, sliding along what blocks it: on the level's
// navmesh where the battle has one and the soldier stands on it (meshNav.js), else on the navgrid
export function move(s, dir, dt, nav) {
  if (nav?.mesh) {
    const m = meshMove(s, dir, dt, nav, speedOf(s));
    if (m !== null) return m;
  }
  const len = Math.hypot(dir[0], dir[1]);
  const step = speedOf(s) * dt * driveScale(s, dir, len);
  if (!s.alive || len < 1e-9 || step <= 0) {
    s.moving = false;
    s.vel[0] = s.vel[2] = 0;
    return 0;
  }
  const dx = (dir[0] / len) * step;
  const dz = (dir[1] / len) * step;
  const tries = [
    [dx, dz],
    [dx, 0],
    [0, dz],
  ];
  for (const [mx, mz] of tries) {
    if (Math.abs(mx) + Math.abs(mz) < 1e-9) continue;
    const x = s.at[0] + mx;
    const z = s.at[2] + mz;
    if (!walkable(nav, x, z)) continue;
    s.at[0] = x;
    s.at[2] = z;
    // (a hero off the ground keeps its height: heroKit.js's jump)
    if (!s.hero?.air) s.at[1] = heightAt(nav, x, z);
    s.vel[0] = mx / dt;
    s.vel[2] = mz / dt;
    s.moving = true;
    return Math.hypot(mx, mz);
  }
  s.moving = false;
  s.vel[0] = s.vel[2] = 0;
  return 0;
}
