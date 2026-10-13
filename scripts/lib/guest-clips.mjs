// The game's clips at a guest's size. A clip of Star Wars Battlefront II
// (2017) turns some 73 bones and places about ten: the hips over the ground,
// two links of the back, and the sockets a weapon and the hands' targets
// ride in. The turns are the game's and stay so, to the bit: a guest's
// fitted skeleton (./guest-skeleton.mjs) rests with the game's own turns, so
// the same turn of a bone is the same pose. The places are in the metres of
// the game's 1.77 m man, and those are refit, for guests only (the design's
// answer 5, 2026-10-13): played as they are, Morty's hips would ride at a
// man's height over legs two thirds as long, and his gun at a man's reach.
// Pure: a clip and two skeletons in, a clip out; scripts/guest-clips.mjs
// reads and writes the packs.
//
// Each frame, both skeletons are posed with the clip's turns, and:
//   Hips        the guest's hip joints go where the game's are, times the
//               legs' ratio (guest-skeleton.mjs's legRatio): its travel and
//               its height. The ratio alone is right only where thigh, shin
//               and foot are all in it: in the game's sprint it leaves
//               Morty's planted foot 2.1 cm off the ground and Rick's 5.4,
//               in a roll Walt's hands 20 cm under it, and fallen on his
//               back Morty's head 17 cm in it. So the body is
//               then lifted or lowered, by as little and as smoothly as
//               will do (eased, below). Where the game's man's foot is
//               planted (his soles' lowest point within PLANTED of the
//               ground) the guest's is brought within NEAR of it. No vertex
//               of the guest's trunk, pelvis, arms or hands is left more
//               than SINK under the ground (measured on its mesh, skinned
//               at the frame: `probes.mesh`); a hand under a planted foot
//               is met halfway. The head is brought up too, but where the
//               body is down it is let into the ground as far as that
//               leaves the body over it: a guest's head is bigger than the
//               man's and its neck may not be turned, so one of the two is
//               had, and the worse is made smallest. Not the legs: Rick's
//               coat and Walt's trouser cuffs hang from them.
//   a body bone its place less the game's rest, sized as the fitted skeleton
//               sized the bone, on the guest's rest (the back's links hold
//               their rest to a few millimetres in every clip)
//   Wep_Root    where it sat in the game's right hand, it sits in the
//               guest's: the hand's frame is the same turn in both, the
//               game's grip point (GAME_GRIP, the pistol's aim) becomes the
//               guest's own (scripts/guests.json), and what the gun moves
//               about it is sized by the hand. A gun that leaves the hand (a
//               death) goes where the game's goes at the legs' ratio instead,
//               by how far it is from the grip (HELD to LOOSE), so it lands
//               on the ground and not under it.
//   IK_Joint_*  the hands' targets: on the guest's own hands, as far off as
//               the game's are (they are on them)
//   *HandAttach the weapon's place seen from each hand: on the guest's
//               weapon socket, as the game's are on its
//   Wep_Aim, Wep2_Root   the chest's own sockets (the game holds them still
//               in Spine2's frame): sized with the chest
// The clip's recorded travel (`root`) is sized by the legs, and `rootHips`
// is measured on the guest's skeleton as scripts/bf2017-clips.mjs measures
// the game's, so whoever sizes the travel by a figure's hips (galaxy/
// surface/saber.js) finds it already at this body's. A stroke's `contact`
// is a time and stays.
//
//   rigOf(rows) → { root, objs, rest }: a skeleton as objects, at rest
//   posed(rig, clip, t) → rig: its bones where the clip has them at t
//   soleProbes(rows, surface?) → [{ bone, at, radius: 0 }]: each foot's heel,
//     ball and toes' tip on the ground at rest: under the joints, or with a
//     mesh the sole's own rearmost and foremost points
//   lowest(rig, probes) → the lowest probe's height
//   meshOf(rows, surface) → a body's mesh, each vertex told which part it is
//     of (head, trunk, pelvis, arms, hands, legs, feet) by the bone that
//     moves it most
//   meshLows(rig, mesh) → { part: its lowest vertex's height } as the rig is posed
//   refit(clip, walrus, fitted, { grip, probes: { game, guest, mesh } }) → clip
//     (probes: the game's soles, the guest's, and the guest's mesh; with
//     none the hips are sized by the legs' ratio alone)
//   GAME_GRIP, HELD, LOOSE, PLANTED, NEAR, SINK, REST

import * as THREE from 'three';
import { SIDES, legRatio } from './guest-skeleton.mjs';

// Wep_Root in the game's right hand's frame through the pistol's aim
// (P_HM_Pistol_StandIdle_01), metres: guest-clips.test.mjs measures it
export const GAME_GRIP = [0.0868, 0.0335, 0.0311];
// how far from the grip (metres) a gun is still wholly in the hand, and wholly out of it
export const HELD = 0.12;
export const LOOSE = 0.5;
// The ground. The game's man's foot is planted when its lowest point is
// within PLANTED of the ground; the guest's is then held within NEAR of it
// (under the acceptance's 2 cm, with room), and its trunk, pelvis, arms and
// hands are kept from going more than SINK under the ground. The lift that
// does it is eased over EASE frames either side.
export const PLANTED = 0.02;
export const NEAR = 0.015;
export const SINK = 0.01;
// how near the ground the legs' ratio alone must lay the trunk or the pelvis
// for the body to be down. Rick, narrow, lies 5 to 9 cm over it on his side
// by the ratio; a squat or a roll's tuck holds the pelvis 20 cm up and more.
export const REST = 0.1;
// the parts of the mesh kept out of the ground. Not the legs: Rick's coat
// and Walt's trouser cuffs hang from them, and the feet are the soles' business
const KEPT_UP = ['trunk', 'pelvis', 'arms', 'hands'];
const EASE = 2;
const LET_GO = 0.9;

const PATH = { translation: 'position', rotation: 'quaternion' };
const SOCKETS = new Set(['Hips', 'Wep_Root', 'Wep2_Root', 'IK_Joint_LeftHand', 'IK_Joint_RightHand', 'LeftHandAttach', 'RightHandAttach']);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export function rigOf(rows) {
  const root = new THREE.Group();
  const objs = new Map();
  const rest = new Map();
  for (const r of rows) {
    const o = new THREE.Object3D();
    o.name = r.name;
    o.position.fromArray(r.translation);
    o.quaternion.fromArray(r.rotation);
    (r.parent == null ? root : objs.get(r.parent)).add(o);
    objs.set(r.name, o);
    rest.set(r.name, { position: o.position.clone(), quaternion: o.quaternion.clone() });
  }
  root.updateMatrixWorld(true);
  return { root, objs, rest };
}

// a track's numbers as floats (a pack's turns are normalized shorts), kept beside it
const floats = new WeakMap();
function numbers(track) {
  if (!track.normalized) return track.values;
  if (!floats.has(track.values)) floats.set(track.values, Float32Array.from(track.values, (v) => Math.max(v / 32767, -1)));
  return floats.get(track.values);
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
// a track at t: between its keys, the first before its first and the last after its last
function sample(track, t, into) {
  const { times } = track;
  const values = numbers(track);
  const size = track.path === 'rotation' ? 4 : 3;
  let k = 0;
  while (k < times.length - 2 && times[k + 1] <= t) k++;
  const next = Math.min(k + 1, times.length - 1);
  const f = times[next] > times[k] ? Math.min(1, Math.max(0, (t - times[k]) / (times[next] - times[k]))) : 0;
  if (size === 4) into.copy(qa.fromArray(values, k * 4)).slerp(qb.fromArray(values, next * 4), f).normalize();
  else into.fromArray(values, k * 3).lerp(V([values[next * 3], values[next * 3 + 1], values[next * 3 + 2]]), f);
  return into;
}

function atRest(rig) {
  for (const [name, o] of rig.objs) {
    o.position.copy(rig.rest.get(name).position);
    o.quaternion.copy(rig.rest.get(name).quaternion);
  }
}

export function posed(rig, clip, t) {
  atRest(rig);
  for (const track of clip.tracks) {
    const o = rig.objs.get(track.node);
    if (!o) continue;
    if (!PATH[track.path]) throw new Error(`${clip.name}: a ${track.path} track on ${track.node}; a clip turns and places bones, no more`);
    sample(track, t, o[PATH[track.path]]);
  }
  rig.root.updateMatrixWorld(true);
  return rig;
}

const placeOf = (rig, name) => new THREE.Vector3().setFromMatrixPosition(rig.objs.get(name).matrixWorld);

// how near the ground (metres, at rest) a foot's vertex is part of its sole
const SOLE = 0.015;

export function soleProbes(rows, surface = null) {
  const rig = rigOf(rows);
  const out = [];
  const p = new THREE.Vector3();
  for (const s of SIDES) {
    const [foot, toes] = [`${s}Foot`, `${s}ToeBase`];
    for (const bone of [foot, toes]) if (!rig.objs.has(bone)) throw new Error(`no ${bone}: not the game’s skeleton`);
    // the heel under the ankle, the ball under the toes' joint, and the toes' tip
    const marks = [[foot, placeOf(rig, foot)], [toes, placeOf(rig, toes)], [toes, rig.objs.has(`${s}Toe`) ? placeOf(rig, `${s}Toe`) : placeOf(rig, toes)]];
    if (surface) {
      // (on a body with a mesh, the sole's own ends: its rearmost point the foot moves, its foremost the toes move)
      const [f, t] = [surface.joints.indexOf(foot), surface.joints.indexOf(toes)];
      for (let v = 0; v < surface.positions.length / 3; v++) {
        if (p.fromArray(surface.positions, v * 3).y > SOLE) continue;
        let best = 0;
        for (let k = 1; k < 4; k++) if (surface.skinWeight[v * 4 + k] > surface.skinWeight[v * 4 + best]) best = k;
        const j = surface.skinIndex[v * 4 + best];
        if (j === f && p.z < marks[0][1].z) marks[0][1].copy(p);
        if (j === t && p.z > marks[2][1].z) marks[2][1].copy(p);
      }
    }
    for (const [bone, at] of marks) out.push({ bone, at: rig.objs.get(bone).worldToLocal(at.setY(0)).toArray(), radius: 0 });
  }
  return out;
}

const probeAt = new THREE.Vector3();
export function lowest(rig, probes) {
  let y = Infinity;
  for (const probe of probes) y = Math.min(y, rig.objs.get(probe.bone).localToWorld(probeAt.fromArray(probe.at)).y);
  return y;
}
const hipJoints = (rig) => placeOf(rig, 'LeftUpLeg').add(placeOf(rig, 'RightUpLeg')).multiplyScalar(0.5);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The smoothest lift that stays inside each frame's bounds: none at all
// where none is needed, and elsewhere eased over a few frames either side,
// then held to the bounds again, until it settles. (A lift taken frame by
// frame from the lowest point alone puts every foot on the ground and jolts
// the hips 5 to 17 cm between frames of a run: feet.mjs's measure.)
function eased(lo, hi, round, ease) {
  const n = lo.length;
  let c = new Float64Array(n);
  const hold = () => {
    for (let i = 0; i < n; i++) c[i] = Math.min(Math.max(c[i], lo[i]), hi[i]);
  };
  const reach = Math.ceil(ease * 3);
  const weight = [];
  for (let d = -reach; d <= reach; d++) weight.push(Math.exp(-(d * d) / (2 * ease * ease)));
  for (let pass = 0; pass < 60; pass++) {
    hold();
    const next = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let total = 0;
      for (let d = -reach; d <= reach; d++) {
        // (round a cycle's end, or held at a clip's)
        const j = round ? (((i + d) % (n - 1)) + (n - 1)) % (n - 1) : Math.min(n - 1, Math.max(0, i + d));
        sum += c[j] * weight[d + reach];
        total += weight[d + reach];
      }
      // (and let go a little each pass: a lift a fall needed for a moment
      // would otherwise be eased on to the clip's end, and leave the body
      // lying 6 cm over the ground)
      next[i] = (sum / total) * LET_GO;
    }
    c = next;
  }
  hold();
  return c;
}

export function refit(clip, walrus, fitted, { grip = GAME_GRIP, probes = null, near = NEAR, ease = EASE } = {}) {
  const game = rigOf(walrus);
  const guest = rigOf(fitted);
  const k = legRatio(walrus, fitted);
  const size = (name) => {
    const g = game.rest.get(name).position.length();
    return g > 1e-6 ? guest.rest.get(name).position.length() / g : 1;
  };
  const hand = size('RightHandMiddle1');
  const chest = size('Wep_Aim');
  const places = clip.tracks.map((t, i) => (t.path === 'translation' && guest.objs.has(t.node) ? i : -1)).filter((i) => i >= 0);
  const keyed = new Set(places.map((i) => clip.tracks[i].node));
  // every frame the clip has: its longest track's times (the pack's tracks are on one grid, or two keys)
  const times = clip.tracks.reduce((a, t) => (t.times.length > a.length ? t.times : a), clip.tracks[0].times);
  const out = new Map(places.map((i) => [i, new Float32Array(times.length * 3)]));

  const world = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const set = (name, at) => {
    const o = guest.objs.get(name);
    o.position.copy(o.parent.worldToLocal(world.copy(at)));
    o.updateWorldMatrix(false, true);
  };
  // both bodies at a frame: the game's as the clip has it, the guest's with
  // the same turns and its hip joints at the legs' ratio of the game's, `lift` higher
  const body = (f, lift) => {
    posed(game, clip, times[f]);
    atRest(guest);
    for (const t of clip.tracks) {
      const o = guest.objs.get(t.node);
      const from = game.objs.get(t.node);
      if (!o || !from) continue;
      if (t.path === 'rotation') o.quaternion.copy(from.quaternion);
      else if (t.node === 'Wep2_Root') o.position.copy(from.position).multiplyScalar(chest);
      else if (!SOCKETS.has(t.node)) o.position.copy(from.position).sub(game.rest.get(t.node).position).multiplyScalar(size(t.node)).add(guest.rest.get(t.node).position);
    }
    guest.root.updateMatrixWorld(true);
    const move = hipJoints(game).multiplyScalar(k).sub(hipJoints(guest));
    move.y += lift;
    set('Hips', placeOf(guest, 'Hips').add(move));
  };
  // how much higher each frame, so the guest's feet meet the ground where the game's do
  let lifts = new Float64Array(times.length);
  if (probes) {
    const lo = [];
    const hi = [];
    const seen = [];
    for (let f = 0; f < times.length; f++) {
      body(f, 0);
      const theirs = lowest(game, probes.game);
      const planted = Math.abs(theirs) <= PLANTED;
      const soles = lowest(guest, probes.guest);
      // what must come up: a sole no deeper than the game's own digs at this
      // size (its sprint drives the toes 7 cm under at each push), a planted
      // one within `near`, and no vertex of the trunk, the pelvis, an arm
      // or a hand more than SINK under
      let up = Math.max(-soles + Math.min(-SINK, k * theirs), planted ? -soles - near : -Infinity);
      // what must stay down: a planted sole
      const down = planted ? -soles + near : Infinity;
      let low = soles;
      if (probes.mesh) {
        const lows = meshLows(guest, probes.mesh);
        for (const part of KEPT_UP) {
          up = Math.max(up, -lows[part] - SINK);
          low = Math.min(low, lows[part]);
        }
        // The head comes up too, but not at any price. A guest's head is
        // bigger than the man's (Morty's twice, Rick's with 8 cm of hair
        // each way) and its neck turns as his does, so where the body is
        // down (its trunk or pelvis within REST of the ground by the legs'
        // ratio alone) the head cannot lie flat beside it: it is let into
        // the ground as far as that leaves the body over it, the worse of
        // the two made smallest.
        const lying = Math.min(lows.trunk, lows.pelvis);
        const head = -lows.head - SINK;
        const rest = -lying + near;
        up = Math.max(up, lying <= REST && head > rest ? (head + rest) / 2 : head);
        low = Math.min(low, lows.head);
      }
      // (and a roll's hand under a planted foot the same: as far in the ground as the foot is over it)
      if (up > down) up = (up + down) / 2;
      lo.push(up);
      hi.push(Math.max(up, down));
      seen.push([low, placeOf(guest, 'Hips').y]);
    }
    // (a cycle, its last frame its first again, is eased round its end)
    const round = times.length > 2 && seen[0].every((y, i) => Math.abs(y - seen.at(-1)[i]) < 1e-3);
    lifts = eased(lo, hi, round, ease);
  }
  for (let f = 0; f < times.length; f++) {
    body(f, lifts[f]);

    // the weapon: in the right hand's frame while it is held, in the world's once it has left
    const turn = game.objs.get('RightHand').getWorldQuaternion(q);
    if (keyed.has('Wep_Root')) {
      const about = placeOf(game, 'Wep_Root').sub(placeOf(game, 'RightHand')).applyQuaternion(turn.clone().invert()).sub(V(GAME_GRIP));
      const held = 1 - smooth(HELD, LOOSE, about.length());
      const inHand = about.multiplyScalar(hand).add(V(grip)).applyQuaternion(turn).add(placeOf(guest, 'RightHand'));
      set('Wep_Root', placeOf(game, 'Wep_Root').multiplyScalar(k).lerp(inHand, held));
    }
    for (const s of SIDES) if (keyed.has(`IK_Joint_${s}Hand`)) set(`IK_Joint_${s}Hand`, placeOf(game, `IK_Joint_${s}Hand`).sub(placeOf(game, `${s}Hand`)).add(placeOf(guest, `${s}Hand`)));
    for (const s of SIDES) if (keyed.has(`${s}HandAttach`)) set(`${s}HandAttach`, placeOf(game, `${s}HandAttach`).sub(placeOf(game, 'Wep_Root')).add(placeOf(guest, 'Wep_Root')));

    for (const [i, values] of out) guest.objs.get(clip.tracks[i].node).position.toArray(values, f * 3);
  }

  const tracks = clip.tracks.map((t, i) => {
    if (!out.has(i)) return t;
    const values = out.get(i);
    // (a place that never moves is two keys, as the packs have them)
    let still = true;
    for (let v = 3; v < values.length && still; v++) still = Math.abs(values[v] - values[v % 3]) < 1e-7;
    if (still && times.length > 2) return { ...t, times: Float32Array.of(times[0], times[times.length - 1]), values: Float32Array.of(values[0], values[1], values[2], values[0], values[1], values[2]) };
    return { ...t, times, values };
  });
  const extras = { ...clip.extras };
  if (extras.root) extras.root = extras.root.map(([t, x, z]) => [t, +(x * k).toFixed(4), +(z * k).toFixed(4)]);
  if (extras.rootHips != null) {
    atRest(guest);
    guest.root.updateMatrixWorld(true);
    extras.rootHips = +(placeOf(guest, 'Hips').y - Math.min(placeOf(guest, 'LeftToeBase').y, placeOf(guest, 'RightToeBase').y)).toFixed(4);
  }
  return { ...clip, tracks, extras };
}

// A body's mesh as its skeleton is posed, for measuring what the probes
// only stand for: each vertex where linear blend skinning puts it (the
// mesh is bound at the skeleton's rest), and the lowest of them in each
// part of the body, a part being the vertices one group of bones moves most.
const PARTS = {
  head: /^(Head|Neck|Neck1)$/,
  trunk: /^(Spine|Spine1|Spine2|(Left|Right)Shoulder)$/,
  pelvis: /^Hips$/,
  arms: /^(Left|Right)(Arm|ForeArm)$/,
  hands: /^(Left|Right)Hand$/,
  legs: /^(Left|Right)(UpLeg|Leg)$/,
  feet: /^(Left|Right)(Foot|ToeBase)$/,
};

export function meshOf(rows, surface) {
  const rig = rigOf(rows);
  const names = Object.keys(PARTS);
  const count = surface.positions.length / 3;
  const part = new Int8Array(count).fill(-1);
  const used = new Set();
  for (let v = 0; v < count; v++) {
    let best = 0;
    for (let k = 0; k < 4; k++) {
      if (surface.skinWeight[v * 4 + k] > 0) used.add(surface.skinIndex[v * 4 + k]);
      if (surface.skinWeight[v * 4 + k] > surface.skinWeight[v * 4 + best]) best = k;
    }
    part[v] = names.findIndex((n) => PARTS[n].test(surface.joints[surface.skinIndex[v * 4 + best]]));
  }
  // (each joint's rest, undone: a vertex is carried by where its joint has gone since)
  const undo = new Map([...used].map((j) => [j, rig.objs.get(surface.joints[j]).matrixWorld.clone().invert()]));
  return { surface, names, part, undo };
}

const carried = new THREE.Matrix4();
export function meshLows(rig, mesh) {
  const { surface, names, part, undo } = mesh;
  // the height a joint gives a vertex: the second row of where it has gone × its rest undone
  const rowY = new Map();
  for (const [j, inverse] of undo) {
    const e = carried.multiplyMatrices(rig.objs.get(surface.joints[j]).matrixWorld, inverse).elements;
    rowY.set(j, [e[1], e[5], e[9], e[13]]);
  }
  const lows = names.map(() => Infinity);
  const p = surface.positions;
  for (let v = 0; v < part.length; v++) {
    if (part[v] < 0) continue;
    let y = 0;
    for (let k = 0; k < 4; k++) {
      const w = surface.skinWeight[v * 4 + k];
      if (!(w > 0)) continue;
      const r = rowY.get(surface.skinIndex[v * 4 + k]);
      y += w * (r[0] * p[v * 3] + r[1] * p[v * 3 + 1] + r[2] * p[v * 3 + 2] + r[3]);
    }
    if (y < lows[part[v]]) lows[part[v]] = y;
  }
  return Object.fromEntries(names.map((n, i) => [n, lows[i]]));
}