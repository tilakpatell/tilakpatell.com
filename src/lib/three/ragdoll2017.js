// The dead fall as the game's fifteen bodies: a ragdoll.json row
// (WSEACharacterPhysicsComponentData and its blueprint: the hips, spine,
// head, upper arms, forearms, hands, thighs, shins and feet, each with its
// parent, mass and capsule; MaxImpulse, ImpulseLifetime) laid over a figure
// on the game's skeleton (lane 1's heroes) through ragdollPhysics.js's
// Verlet body: a point at each body's bone, sticks along the bodies' tree
// (the game's, which skips the shoulders and the upper spine), the torso
// braced, the knees and elbows hinged as the Meshy table has them, each
// point as wide as its body's capsule.
//
// The game caps what a body takes: MaxImpulse (N·s) over ImpulseLifetime
// (s). So a kick here spends from that allowance (whole again a lifetime
// after it was spent, at an even rate), and the velocity it gives is what
// is left of it over the body's whole mass: a figure caught by two blasts
// in one frame is not thrown twice as far.
//
//   ragdollOf(book, id) → a row with its bodies (a row that shares another's,
//     `bodiesOf`, gets that one's; a partial row, the trooper's) | null
//   rig2017(bones, row, { collide, push, speed, velocity, gravity }) →
//     rigRagdoll's { step(dt), settled, point(name), body } and kick(impulse
//     [x, y, z] N·s) → the impulse taken, centre() → [x, y, z], mass
//     (push and speed as rigRagdoll's, the speed held under maxImpulse / mass)
//     kickAt(bone, impulse [x, y, z] N·s) → taken: the same allowance, given
//     to that bone's point alone (n·J/M there, so the whole body's centre
//     still moves at J/M: the points weigh alike in the Verlet body), the
//     bone a body's (else nothing is taken); momentum() → Σ mᵢ|vᵢ| (kg·m/s,
//     each body's mass at its point's speed); with `settle` (the row's
//     SettleMomentum unless given) the body is settled, and stops, once its
//     momentum is under it after CALM seconds since it was last kicked
//   floorCollide(floorAt) → collide(p, r): floorAt(x, z, y) → the height
//     under a point (a number, or { y }, or null for none): a physics world's
//     floorAt when there is one, the surface's height function when not

import { rigRagdoll } from './ragdollPhysics';

const TORSO = ['Hips', 'Spine', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg'];
const AIM = { LeftArm: 'LeftForeArm', RightArm: 'RightForeArm', LeftForeArm: 'LeftHand', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', RightUpLeg: 'RightLeg', LeftLeg: 'LeftFoot', RightLeg: 'RightFoot' };
const FRAMES = { Hips: ['LeftUpLeg', 'RightUpLeg', 'Hips', 'Spine'], Spine: ['LeftArm', 'RightArm', 'Spine', 'Head'] };
const THINNEST = 0.04; // m: no point narrower (a hand's box is 4 cm thick)
const FALLBACK = 'stormtroopershared';
const SUB = 1 / 60; // s: ragdollPhysics' step (a point's velocity is its last step's move over it)
const CALM = 1.2; // s after the last kick before SettleMomentum may stop it (ragdollPhysics' CALM)

export function ragdollOf(book, id) {
  const rows = book?.rows ?? [];
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  if (row.partial && id !== FALLBACK) {
    const human = ragdollOf(book, FALLBACK);
    return human ? { ...row, bodies: human.bodies } : null;
  }
  if (row.bodies) return row;
  const shared = rows.find((r) => r.id === row.bodiesOf);
  return shared?.bodies ? { ...row, bodies: shared.bodies } : null;
}

export function floorCollide(floorAt) {
  return (p, r) => {
    const f = floorAt(p.x, p.z, p.y);
    const h = typeof f === 'number' ? f : (f?.y ?? null);
    if (h === null || !Number.isFinite(h)) return false;
    if (p.y - r < h) {
      p.y = h + r;
      return true;
    }
    return p.y - r < h + 0.005;
  };
}

export function rig2017(bones, row, { collide = null, push = { x: 0, y: 0, z: 0 }, speed = 2, velocity = null, gravity = -9.8, settle = row?.settleMomentum ?? 0 } = {}) {
  const bodies = (row?.bodies ?? []).filter((b) => bones[b.bone]);
  const mass = bodies.reduce((s, b) => s + (b.mass ?? 0), 0) || 80;
  const most = row?.maxImpulse > 0 ? row.maxImpulse : Infinity;
  const life = row?.impulseLifetime > 0 ? row.impulseLifetime : 0;
  const names = new Set(bodies.map((b) => b.bone));
  const table = {
    torso: TORSO.filter((n) => names.has(n)),
    limbs: bodies.map((b) => b.bone).filter((n) => !TORSO.includes(n)),
    radius: Object.fromEntries(bodies.map((b) => [b.bone, Math.max(THINNEST, b.radius ?? 0.06)])),
    aim: AIM,
    frames: FRAMES,
    parents: Object.fromEntries(bodies.map((b) => [b.bone, b.parent])),
  };
  const capped = Math.min(speed, most / mass);
  const rag = rigRagdoll(bones, { collide, push, speed: capped, velocity, gravity, table });
  let spent = Math.min(most, capped * mass); // (the push it fell by came out of the allowance)
  const step0 = rag.step;
  // each point's body mass, for the momentum
  const masses = rag.names.map((n) => bodies.find((b) => b.bone === n)?.mass ?? 0);
  let age = 0; // s since the last kick
  rag.mass = mass;
  rag.momentum = () => {
    const { pos, prev } = rag.body;
    let sum = 0;
    for (let i = 0; i < masses.length; i++) sum += masses[i] * Math.hypot(pos[i * 3] - prev[i * 3], pos[i * 3 + 1] - prev[i * 3 + 1], pos[i * 3 + 2] - prev[i * 3 + 2]);
    return sum / SUB;
  };
  rag.step = (dt) => {
    if (life > 0 && dt > 0) spent = Math.max(0, spent - (most / life) * dt);
    if (rag.body.settled) return;
    step0(dt);
    age += dt > 0 ? dt : 0;
    if (settle > 0 && age >= CALM && rag.momentum() < settle) rag.body.settled = true;
  };
  // what of an impulse the allowance lets through, as a fraction of it
  const spend = (impulse) => {
    const j = Math.hypot(impulse[0], impulse[1], impulse[2]);
    const take = Math.min(j, Math.max(0, most - spent));
    if (!(take > 0)) return 0;
    spent += take;
    age = 0;
    return take;
  };
  rag.kick = (impulse) => {
    const take = spend(impulse);
    if (!take) return 0;
    const k = take / Math.hypot(impulse[0], impulse[1], impulse[2]) / mass;
    rag.body.push({ x: impulse[0] * k, y: impulse[1] * k, z: impulse[2] * k });
    return take;
  };
  rag.kickAt = (bone, impulse) => {
    const i = rag.indexOf(bone);
    if (i < 0) return 0;
    const take = spend(impulse);
    if (!take) return 0;
    const k = (take / Math.hypot(impulse[0], impulse[1], impulse[2]) / mass) * rag.body.n;
    rag.body.kick(i, { x: impulse[0] * k, y: impulse[1] * k, z: impulse[2] * k });
    return take;
  };
  rag.centre = () => {
    const p = rag.point('Spine') ?? rag.point('Hips');
    return p ? [p.x, p.y, p.z] : null;
  };
  return rag;
}
