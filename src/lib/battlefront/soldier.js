// A soldier from a class row (spec catalogue 1): its health and regen, its
// stance, its gun, its abilities (the roll among them) and an affector
// stack over all of it; the walk speeds from the game's character physics
// (`OnGroundStateData`: stand 3.8 m/s, sprint × 1.57, crouch 2.5) and the
// pose heights (stand 1.7, crouch 1.15); and a capsule per body part with
// the game's radii (`DefaultSoldierBoneCollision`), laid on a simple
// skeleton by stance since the sim poses no bones. Pure.
//
//   newSoldier(classRow, { id, team, at, yaw, rand, bot, weapon, abilities }) → s
//   capsulesOf(s) → [{ part, a, b, r }]    hurt(s, { damage, part, from, by, now }) → 'hurt' | 'down' | null
//   tick(s, dt, now)    speedOf(s) → m/s    move(s, dir, dt, nav) → metres moved    stanceOf(s)

import bones from '../../data/bf2017/physics/bones.json';
import physics from '../../data/bf2017/physics/soldier.json';
import { ROLL, createAbilities, tick as tickAbilities } from './abilities.js';
import { createStack, resolve, tick as tickStack } from './affectors.js';
import { heightAt, walkable } from './nav.js';
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
    abilities: createAbilities(abilities, { rand }),
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

const SKELETON = { stand: skeleton(POSES.stand.height), crouch: skeleton(POSES.crouch.height) };

export function capsulesOf(s, out = []) {
  const c = Math.cos(s.yaw);
  const n = Math.sin(s.yaw);
  const place = (p) => [s.at[0] + p[0] * c + p[2] * n, s.at[1] + p[1], s.at[2] - p[0] * n + p[2] * c];
  const parts = SKELETON[s.stance === 'crouch' || s.state === 'roll' ? 'crouch' : 'stand'];
  out.length = parts.length;
  for (let i = 0; i < parts.length; i++) {
    const [part, a, b, r] = parts[i];
    out[i] = { part, a: place(a), b: place(b), r };
  }
  return out;
}

// the chest's middle, where a bot aims and a line of sight is drawn to
export const chestOf = (s) => [s.at[0], s.at[1] + (s.stance === 'crouch' ? POSES.crouch.height : POSES.stand.height) * 0.7, s.at[2]];
export const eyeOf = (s) => [s.at[0], s.at[1] + (s.stance === 'crouch' ? POSES.crouch.eye[1] : POSES.stand.eye[1]), s.at[2]];

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
  if (s.state === 'roll') return ROLL_SPEED;
  const pose = s.stance === 'crouch' ? GROUND.crouch : GROUND.stand;
  const sprint = s.sprint && pose.sprintMultiplier > 0 ? pose.sprintMultiplier : 1;
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
  s.rollUntil = now + ROLL_TIME;
  s.rollDir = [...dir];
}

// a step along dir (a unit [x, z]) at the soldier's speed, sliding along what blocks it
export function move(s, dir, dt, nav) {
  const step = speedOf(s) * dt;
  const len = Math.hypot(dir[0], dir[1]);
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
    s.at[1] = heightAt(nav, x, z);
    s.vel[0] = mx / dt;
    s.vel[2] = mz / dt;
    s.moving = true;
    return Math.hypot(mx, mz);
  }
  s.moving = false;
  s.vel[0] = s.vel[2] = 0;
  return 0;
}
