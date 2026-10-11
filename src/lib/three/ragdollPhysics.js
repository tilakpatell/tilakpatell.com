// A ragdoll that falls: a Verlet body of points (one at each joint of
// Meshy's skeleton) held together by sticks along the bones, its torso
// braced rigid, its knees and elbows bending only the way they bend, under
// gravity, against whatever the caller says is solid (the floor under each
// point, a wall), with friction where it touches; and the skeleton's bones
// turned each step to lie along their points. A body shot falls the way it
// was pushed, buckles at the knees, lands on the deck, rolls off a ledge or
// over the edge of a chasm, and comes to rest; then it goes still and costs
// nothing. lib/three/ragdoll.js is the springy limbs over a body the caller
// tips over; this is the body itself. Pure three.js maths (no scene), so it
// is tested in Node.
//
//   createBody(points, sticks, { collide, gravity, damping, iterations, radius, radii, friction, hinges })
//     → { pos, prev, n, step(dt), kick(i, v), push(v), settled }
//     points: [{ x, y, z }]; sticks: [{ a, b, len?, min?, stiff? }] (len: the points' distance at the
//     start; min: a share of len it may shorten to, so a stick with min is a limit, not a bone;
//     stiff 0…1); collide(p, r, i) → touching: moves the point p ({ x, y, z }, radius r) out of
//     whatever it is in and says whether it is on something (for friction); hinges: [{ a, m, b,
//     side() → unit }]: the middle point m kept on the `side` of the line from a to b (a knee in
//     front, an elbow behind); radii: a radius a point, else `radius`; settled: still for long
//     enough to stop (step does nothing more)
//   rigRagdoll(bones, { collide, push, speed, velocity, gravity, table }) → { step(dt), settled, point(name), body,
//     names (the bones that are points, in the body's order), indexOf(name) → i | -1 }
//     bones: { name: Bone } on Meshy's skeleton, posed as the body is to fall from (its clip's pose);
//     push: the way it was shot (unit-ish, in the world), speed: how hard (m/s at the chest);
//     velocity: how the whole body was already moving (m/s, in the world);
//     table: which bones are points, for another skeleton (ragdoll2017.js's, the game's fifteen
//     bodies): { torso, limbs, radius: { name: m }, aim: { name: child }, frames: { name: [left,
//     right, low, high] }, parents?: { name: parent } (the sticks' tree, when it is not the
//     skeleton's own: the game's bodies skip the shoulders and the upper spine) }; Meshy's by default

import * as THREE from 'three';

const EPS = 1e-9;
const STILL = 2.5e-4; // metres a step: below it everywhere, a step counts as still
const REST = 40; // still steps in a row that settle a body
const MOST_DT = 1 / 60; // the body steps in steps this long
// A body that has fallen is let come to rest: from CALM seconds on, its
// damping deepens to HUSH by QUIET seconds, so the last tremor of a hinge
// against the floor dies away; by LONGEST it is still, however it lies.
const CALM = 1.2;
const QUIET = 3;
const HUSH = 0.75;
const LONGEST = 6;
const SLACK = 0.04; // metres a hinge may go the wrong way

export function createBody(points, sticks = [], { collide = null, gravity = -9.8, damping = 0.992, iterations = 8, radius = 0.06, radii = null, friction = 0.55, hinges = [] } = {}) {
  const n = points.length;
  const pos = new Float64Array(n * 3);
  const prev = new Float64Array(n * 3);
  points.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3);
    prev.set([p.x, p.y, p.z], i * 3);
  });
  const dist = (i, j) => Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]);
  const S = sticks.map((s) => {
    const len = s.len ?? dist(s.a, s.b);
    return { a: s.a, b: s.b, len, lo: s.min !== undefined ? len * s.min : len, stiff: s.stiff ?? 1 };
  });
  const r = Array.from({ length: n }, (_, i) => radii?.[i] ?? radius);
  const ground = new Uint8Array(n);
  const p = { x: 0, y: 0, z: 0 };
  let quiet = 0;
  let age = 0;
  let owed = 0; // seconds not yet stepped
  const body = {
    pos,
    prev,
    n,
    settled: false,
    // a velocity (m/s) given to one point, by moving where it was last
    // (a kick wakes it, and gives it its time to fall again)
    kick(i, v, dt = MOST_DT) {
      age = 0;
      prev[i * 3] -= v.x * dt;
      prev[i * 3 + 1] -= v.y * dt;
      prev[i * 3 + 2] -= v.z * dt;
      body.settled = false;
      quiet = 0;
    },
    push(v, dt = MOST_DT) {
      for (let i = 0; i < n; i++) body.kick(i, v, dt);
    },
    // (a fixed step, however long the frame: Verlet keeps its velocity as the last step's
    // move, so a step of another length would change how fast everything goes)
    step(dt) {
      if (body.settled || !(dt > 0)) return;
      owed = Math.min(owed + dt, 0.1);
      while (owed >= MOST_DT && !body.settled) {
        substep(MOST_DT);
        owed -= MOST_DT;
      }
    },
  };

  function solveStick(st) {
    const { a, b } = st;
    const dx = pos[b * 3] - pos[a * 3];
    const dy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const dz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const d = Math.hypot(dx, dy, dz);
    if (d < EPS) return;
    const want = d > st.len ? st.len : d < st.lo ? st.lo : d;
    if (want === d) return;
    const k = ((d - want) / d) * 0.5 * st.stiff;
    pos[a * 3] += dx * k;
    pos[a * 3 + 1] += dy * k;
    pos[a * 3 + 2] += dz * k;
    pos[b * 3] -= dx * k;
    pos[b * 3 + 1] -= dy * k;
    pos[b * 3 + 2] -= dz * k;
  }

  function solveHinge(hg) {
    const side = hg.side();
    if (!side) return;
    const { a, m, b } = hg;
    const abx = pos[b * 3] - pos[a * 3];
    const aby = pos[b * 3 + 1] - pos[a * 3 + 1];
    const abz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const ab2 = abx * abx + aby * aby + abz * abz;
    if (ab2 < EPS) return;
    const amx = pos[m * 3] - pos[a * 3];
    const amy = pos[m * 3 + 1] - pos[a * 3 + 1];
    const amz = pos[m * 3 + 2] - pos[a * 3 + 2];
    const t = (amx * abx + amy * aby + amz * abz) / ab2;
    // the middle's way out from the line, and how much of it is the wrong way
    const ox = amx - abx * t;
    const oy = amy - aby * t;
    const oz = amz - abz * t;
    // (a few centimetres the wrong way are let be: a straight leg lying on the deck has its knee
    // lifted by the floor that much, and righting it would fight the floor for ever)
    const wrong = ox * side.x + oy * side.y + oz * side.z + SLACK;
    if (wrong >= 0) return;
    pos[m * 3] -= side.x * wrong;
    pos[m * 3 + 1] -= side.y * wrong;
    pos[m * 3 + 2] -= side.z * wrong;
  }

  function substep(h) {
    let most = 0;
    age += h;
    const calm = Math.min(1, Math.max(0, (age - CALM) / (QUIET - CALM)));
    const damp = damping + (HUSH - damping) * calm;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      let vx = (pos[o] - prev[o]) * damp;
      const vy = (pos[o + 1] - prev[o + 1]) * damp;
      let vz = (pos[o + 2] - prev[o + 2]) * damp;
      // what touched last step drags along whatever it lies on
      if (ground[i]) {
        vx *= 1 - friction;
        vz *= 1 - friction;
      }
      prev[o] = pos[o];
      prev[o + 1] = pos[o + 1];
      prev[o + 2] = pos[o + 2];
      pos[o] += vx;
      pos[o + 1] += vy + gravity * h * h;
      pos[o + 2] += vz;
    }
    for (let it = 0; it < iterations; it++) {
      for (const st of S) solveStick(st);
      for (const hg of hinges) solveHinge(hg);
      if (collide) {
        for (let i = 0; i < n; i++) {
          const o = i * 3;
          p.x = pos[o];
          p.y = pos[o + 1];
          p.z = pos[o + 2];
          ground[i] = collide(p, r[i], i) ? 1 : 0;
          pos[o] = p.x;
          pos[o + 1] = p.y;
          pos[o + 2] = p.z;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      most = Math.max(most, Math.abs(pos[o] - prev[o]), Math.abs(pos[o + 1] - prev[o + 1]), Math.abs(pos[o + 2] - prev[o + 2]));
    }
    quiet = most < STILL ? quiet + 1 : 0;
    if (quiet >= REST || age >= LONGEST) body.settled = true;
  }
  return body;
}

// ── over a skeleton ──

const TORSO = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg'];
const LIMBS = ['Head', 'head_end', 'LeftForeArm', 'LeftHand', 'RightForeArm', 'RightHand', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightLeg', 'RightFoot', 'RightToeBase'];
const RADIUS = { Hips: 0.13, Spine02: 0.13, Spine01: 0.14, Spine: 0.14, neck: 0.08, Head: 0.11, head_end: 0.1, LeftShoulder: 0.1, RightShoulder: 0.1, LeftArm: 0.07, RightArm: 0.07, LeftUpLeg: 0.09, RightUpLeg: 0.09, LeftLeg: 0.07, RightLeg: 0.07 };
// each bone the point it aims at: a bone's turn follows the line to it
const AIM = { Spine02: 'Spine01', Spine01: 'Spine', neck: 'Head', Head: 'head_end', LeftShoulder: 'LeftArm', RightShoulder: 'RightArm', LeftArm: 'LeftForeArm', RightArm: 'RightForeArm', LeftForeArm: 'LeftHand', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', RightUpLeg: 'RightLeg', LeftLeg: 'LeftFoot', RightLeg: 'RightFoot', LeftFoot: 'LeftToeBase', RightFoot: 'RightToeBase' };
// and the two the hips and the chest take their whole turn from: across (left to right) and up
const FRAMES = { Hips: ['LeftUpLeg', 'RightUpLeg', 'Hips', 'Spine01'], Spine: ['LeftArm', 'RightArm', 'Spine', 'neck'] };
export const MESHY = { torso: TORSO, limbs: LIMBS, radius: RADIUS, aim: AIM, frames: FRAMES };

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();

function basis(across, up, out) {
  const x = across.clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, up).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return out.setFromRotationMatrix(_m.makeBasis(x, y, z));
}

export function rigRagdoll(bones, { collide = null, push = { x: 0, y: 0, z: 0 }, speed = 2, velocity = null, gravity = -9.8, table = MESHY } = {}) {
  const { torso: TORSO, limbs: LIMBS, radius: RADIUS, aim: AIM, frames: FRAMES, parents = null } = table;
  const names = [...TORSO, ...LIMBS].filter((n) => bones[n]);
  const index = new Map(names.map((n, i) => [n, i]));
  const root = bones.Hips;
  let top = root;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  const start = names.map((n) => bones[n].getWorldPosition(new THREE.Vector3()));
  const sticks = [];
  // along each bone, from its parent's point
  for (const n of names) {
    const parent = parents ? parents[n] : bones[n].parent?.isBone ? bones[n].parent.name : null;
    if (parent && index.has(parent)) sticks.push({ a: index.get(parent), b: index.get(n) });
  }
  // the torso braced rigid: every pair of its points
  const torso = TORSO.filter((n) => index.has(n)).map((n) => index.get(n));
  for (let i = 0; i < torso.length; i++) for (let j = i + 1; j < torso.length; j++) sticks.push({ a: torso[i], b: torso[j] });
  // the head kept from lolling right round, and no limb folding flat
  const at = (n) => index.get(n);
  if (index.has('Head') && index.has('Spine')) sticks.push({ a: at('Spine'), b: at('Head'), min: 0.85 });
  for (const s of ['Left', 'Right']) {
    if (index.has(`${s}UpLeg`) && index.has(`${s}Foot`)) sticks.push({ a: at(`${s}UpLeg`), b: at(`${s}Foot`), min: 0.45 });
    if (index.has(`${s}Arm`) && index.has(`${s}Hand`)) sticks.push({ a: at(`${s}Arm`), b: at(`${s}Hand`), min: 0.3 });
  }
  // the body's forward from its torso (a knee bends forward, an elbow back)
  const forward = new THREE.Vector3();
  const across = new THREE.Vector3();
  const upward = new THREE.Vector3();
  const back = new THREE.Vector3();
  let body = null;
  const pt = (i, out) => out.set(body.pos[i * 3], body.pos[i * 3 + 1], body.pos[i * 3 + 2]);
  const facing = () => {
    pt(at('RightUpLeg'), across).sub(pt(at('LeftUpLeg'), _a));
    pt(at('Spine'), upward).sub(pt(at('Hips'), _a));
    // (Meshy's figures face +z with their left on +x, so across runs −x: forward is up × across)
    forward.crossVectors(upward, across).normalize();
    back.copy(forward).negate();
  };
  const hinges = [];
  if (index.has('LeftUpLeg') && index.has('RightUpLeg') && index.has('Spine'))
    for (const s of ['Left', 'Right']) {
      if (index.has(`${s}Leg`) && index.has(`${s}Foot`)) hinges.push({ a: at(`${s}UpLeg`), m: at(`${s}Leg`), b: at(`${s}Foot`), side: () => forward });
      if (index.has(`${s}ForeArm`) && index.has(`${s}Hand`)) hinges.push({ a: at(`${s}Arm`), m: at(`${s}ForeArm`), b: at(`${s}Hand`), side: () => back });
    }
  body = createBody(
    start.map((v) => ({ x: v.x, y: v.y, z: v.z })),
    sticks,
    { collide, gravity, hinges, radii: names.map((n) => RADIUS[n] ?? 0.05) },
  );
  // the knees' and elbows' way, worked out before each step's constraints
  const step0 = body.step;
  body.step = (dt) => {
    facing();
    step0(dt);
  };
  // moving as it was, and the shot's push through the chest more than the feet
  const v = velocity ?? { x: 0, y: 0, z: 0 };
  const pl = Math.hypot(push.x, push.y, push.z) || 1;
  names.forEach((n, i) => {
    const k = n.includes('Foot') || n.includes('Toe') ? 0.2 : n.includes('Leg') ? 0.5 : 1;
    body.kick(i, { x: v.x + (push.x / pl) * speed * k, y: v.y + 0.15 * speed * k, z: v.z + (push.z / pl) * speed * k });
  });

  // the bones as they stood, in the world, for each one's turn since
  const restQ = new Map();
  for (const n of Object.keys(bones)) restQ.set(n, bones[n].getWorldQuaternion(new THREE.Quaternion()));
  const frame0 = {};
  for (const [n, [l, r, lo, hi]] of Object.entries(FRAMES)) {
    if (![l, r, lo, hi].every((x) => index.has(x))) continue;
    frame0[n] = basis(start[at(r)].clone().sub(start[at(l)]), start[at(hi)].clone().sub(start[at(lo)]), new THREE.Quaternion());
  }
  // the bones top down (a parent's world turn is set before its children's)
  const order = [];
  const walk = (b) => {
    if (!b.isBone) return;
    order.push(b);
    for (const c of b.children) walk(c);
  };
  walk(root);
  const turn = new Map(); // bone name → its world turn since it stood

  function pose() {
    turn.clear();
    for (const b of order) {
      const n = b.name;
      const parentTurn = turn.get(b.parent?.name) ?? null;
      let R;
      if (frame0[n]) {
        const [l, r, lo, hi] = FRAMES[n];
        R = basis(pt(at(r), _a).sub(pt(at(l), _b)).clone(), pt(at(hi), _a).sub(pt(at(lo), _b)).clone(), new THREE.Quaternion()).multiply(_q.copy(frame0[n]).invert());
      } else if (AIM[n] && index.has(n) && index.has(AIM[n])) {
        // the line to its child as it was, carried round by its parent, turned onto the line now
        const was = start[at(AIM[n])].clone().sub(start[at(n)]);
        if (parentTurn) was.applyQuaternion(parentTurn);
        const now = pt(at(AIM[n]), _a).sub(pt(at(n), _b));
        R = new THREE.Quaternion().setFromUnitVectors(was.normalize(), now.normalize());
        if (parentTurn) R.multiply(parentTurn);
      } else R = parentTurn ? parentTurn.clone() : new THREE.Quaternion();
      turn.set(n, R);
      // the world turn it wants, made its own under its parent's as they now are
      const want = _q.copy(R).multiply(restQ.get(n));
      b.parent.getWorldQuaternion(_pq);
      b.quaternion.copy(_pq.invert().multiply(want));
      if (b === root) b.position.copy(b.parent.worldToLocal(pt(at('Hips'), _a)));
      b.updateMatrixWorld(true);
    }
  }

  const rag = {
    body,
    names,
    indexOf: (name) => index.get(name) ?? -1,
    get settled() {
      return body.settled;
    },
    step(dt) {
      if (body.settled) return;
      body.step(dt);
      pose();
    },
    point(name) {
      const i = index.get(name);
      return i === undefined ? null : { x: body.pos[i * 3], y: body.pos[i * 3 + 1], z: body.pos[i * 3 + 2] };
    },
  };
  return rag;
}
