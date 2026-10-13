// The game's skeleton at a guest's own size. The site's own cast (Rick,
// Morty, Walt, Jesse) are Meshy figures on 24 joints; Star Wars Battlefront
// II (2017)'s people stand on Walrus_HumanMale's 254 nodes and are moved by
// clips that bind by those names. A guest joins them as the Ewok does in the
// game: a skeleton with the same names and the same rest turns, and its own
// lengths. Here the guest is measured and that skeleton is made; the mesh is
// put on it by ./guest-skin.mjs, and the clips are sized to it by
// ./guest-clips.mjs. Pure: node rows in, node rows out.
//
// A row is { name, parent, translation, rotation, scale }, parents first.
// The guest's joints are read where its file has them (metres over its
// sole), then stood as the game's man stands at rest: the long bones of the
// limbs (upper arm, forearm, thigh, shin) are turned onto the game's, the
// hand with its forearm, and nothing else is turned. Not the trunk, the
// collar or the head (both figures stand upright and face +z, and where a
// rigger put a joint there is a habit, not a posture), and not the foot (its
// sole is flat on the ground in both). Meshy's two sides differ by a few
// degrees where the mesh does not (Morty's right ankle joint sits 4 cm
// behind his left), so a limb's turn is taken from the mean of both sides
// and mirrored: the mesh stays as even as it was made. Each of the game's
// body bones is then put where the guest's own joint came to stand, with the
// game's rest rotation, so a clip's turn of it is the same turn of the
// guest. The game's second neck joint, which Meshy has none for, goes on the
// way from the neck to the head. Fingers and weapon bones keep the game's
// offsets at the hand's size, the face's at the head's, a limb's helpers at
// the limb's; the weapon sockets rest where the game rests them, at the
// model's origin, since every clip says where they are.
//
//   rowsOf(json) → rows: a glTF's nodes, from its default scene down
//   worldsOf(rows) → Map<name, Matrix4>: each node at rest
//   JOINT_MAP(meshyNodes) → Map<Meshy joint, game bone>: the back in the
//     order the file climbs it (never by its joints' names: Meshy calls the
//     lowest Spine02 and the chest Spine), the limbs one for one; the head's
//     two helpers have no counterpart
//   measure(meshyNodes, surface?) → { segments: { thigh, shin, foot,
//     spine: [a, b, c], neck, head, skull, clavicle, upperArm, forearm,
//     hand }, hipsHeight, height, joints: { game name: [x, y, z] } }: metres,
//     both sides' mean; with a surface ({ positions, skinIndex, skinWeight,
//     joints }: the mesh at its bind) the height is the mesh's and the hand
//     is the wrist to its furthest vertex, without one the crown joint's and
//     the game's share of the forearm
//   turnsOf(joints, walrusNodes) → { game bone: Quaternion }: the turn (in
//     the world) that stands each long bone as the game's; a bone not named
//     is not turned
//   fitSkeleton(walrusNodes, measured) → rows: the game's 254 and the head's
//     two helpers (head_end, headfront: the Wardrobe's gear takes its frame
//     from them), hips at the guest's height, soles on the ground
//   legRatio(walrusNodes, fitted) → the guest's hip joints' height over the
//     game's, both at rest: what the clips' travel and height are sized by

import * as THREE from 'three';

export const SIDES = ['Left', 'Right'];
// the game's man's hand, wrist to fingertip at rest, as a share of his forearm
const HAND_OF_FOREARM = 0.71;
// the long bones, each with the joint it points at
const LONG = [['Arm', 'ForeArm'], ['ForeArm', 'Hand'], ['UpLeg', 'Leg'], ['Leg', 'Foot']];
// a guest's joints in the order they hang, each from its parent
const CHAIN = [
  ['Spine', 'Hips'],
  ['Spine1', 'Spine'],
  ['Spine2', 'Spine1'],
  ['Neck', 'Spine2'],
  ['Head', 'Neck'],
  ['head_end', 'Head'],
  ['headfront', 'Head'],
  ...SIDES.flatMap((s) => [
    [`${s}Shoulder`, 'Spine2'],
    [`${s}Arm`, `${s}Shoulder`],
    [`${s}ForeArm`, `${s}Arm`],
    [`${s}Hand`, `${s}ForeArm`],
    [`${s}UpLeg`, 'Hips'],
    [`${s}Leg`, `${s}UpLeg`],
    [`${s}Foot`, `${s}Leg`],
    [`${s}ToeBase`, `${s}Foot`],
  ]),
];

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const mirror = (v) => new THREE.Vector3(-v.x, v.y, v.z);
const placeOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);

export function rowsOf(json) {
  const rows = [];
  const walk = (i, parent) => {
    const n = json.nodes[i];
    rows.push({ name: n.name, parent, translation: n.translation ?? [0, 0, 0], rotation: n.rotation ?? [0, 0, 0, 1], scale: n.scale ?? [1, 1, 1] });
    for (const c of n.children ?? []) walk(c, n.name);
  };
  for (const i of json.scenes[json.scene ?? 0].nodes) walk(i, null);
  return rows;
}

export function worldsOf(rows) {
  const out = new Map();
  const local = new THREE.Matrix4();
  for (const r of rows) {
    local.compose(V(r.translation), new THREE.Quaternion().fromArray(r.rotation), V(r.scale));
    const parent = r.parent == null ? null : out.get(r.parent);
    out.set(r.name, parent ? parent.clone().multiply(local) : local.clone());
  }
  return out;
}

export function JOINT_MAP(meshyNodes) {
  const kids = (name) => meshyNodes.filter((r) => r.parent === name).map((r) => r.name);
  const has = (name) => meshyNodes.some((r) => r.name === name);
  if (!has('Hips')) throw new Error('no Hips joint: is it a Meshy rig?');
  const map = new Map([['Hips', 'Hips']]);
  // the back: from the hips' one child that is not a leg, up to the joint the shoulders hang from
  const up = kids('Hips').filter((n) => !/UpLeg$/.test(n));
  if (up.length !== 1) throw new Error(`the hips have ${up.length} ways up; the map wants one`);
  const back = [up[0]];
  while (kids(back.at(-1)).length === 1) back.push(kids(back.at(-1))[0]);
  if (back.length !== 3) throw new Error(`the back is ${back.length} joints long; the map wants three`);
  back.forEach((n, i) => map.set(n, ['Spine', 'Spine1', 'Spine2'][i]));
  const neck = kids(back[2]).filter((n) => !/Shoulder$/.test(n));
  if (neck.length !== 1) throw new Error(`the chest has ${neck.length} necks; the map wants one`);
  map.set(neck[0], 'Neck');
  // (the head: the neck's child that has children of its own, or its only one)
  const heads = kids(neck[0]);
  const head = heads.find((n) => kids(n).length) ?? heads[0];
  if (!head) throw new Error('no head on the neck');
  map.set(head, 'Head');
  for (const s of SIDES)
    for (const n of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase']) {
      if (!has(s + n)) throw new Error(`no ${s}${n} joint`);
      map.set(s + n, s + n);
    }
  // (in the file's order, so whatever is made from it is the same every time)
  return new Map(meshyNodes.filter((r) => map.has(r.name)).map((r) => [r.name, map.get(r.name)]));
}

export function measure(meshyNodes, surface = null) {
  const map = JOINT_MAP(meshyNodes);
  const worlds = worldsOf(meshyNodes);
  const filed = new Map([...map].map(([from, to]) => [to, placeOf(worlds.get(from))]));
  for (const n of ['head_end', 'headfront']) if (worlds.has(n)) filed.set(n, placeOf(worlds.get(n)));
  if (!filed.has('head_end')) throw new Error('no head_end joint: the head’s size is read from it');
  let sole = 0;
  let top = filed.get('head_end').y;
  const reach = { Left: 0, Right: 0 };
  if (surface) {
    sole = Infinity;
    top = -Infinity;
    const hands = SIDES.map((s) => surface.joints.indexOf([...map].find(([, to]) => to === `${s}Hand`)[0]));
    const p = new THREE.Vector3();
    for (let v = 0; v < surface.positions.length / 3; v++) {
      p.fromArray(surface.positions, v * 3);
      sole = Math.min(sole, p.y);
      top = Math.max(top, p.y);
      for (let k = 0; k < 4; k++) {
        const side = hands.indexOf(surface.skinIndex[v * 4 + k]);
        if (side < 0 || surface.skinWeight[v * 4 + k] < 0.5) continue;
        reach[SIDES[side]] = Math.max(reach[SIDES[side]], p.distanceTo(filed.get(`${SIDES[side]}Hand`)));
      }
    }
  }
  const len = (a, b) => filed.get(b).distanceTo(filed.get(a));
  const both = (a, b) => (len(`Left${a}`, `Left${b}`) + len(`Right${a}`, `Right${b}`)) / 2;
  const forearm = both('ForeArm', 'Hand');
  const reached = SIDES.map((s) => reach[s]).filter((r) => r > 0);
  const joints = {};
  for (const [name, at] of filed) joints[name] = [at.x, at.y - sole, at.z];
  return {
    segments: {
      thigh: both('UpLeg', 'Leg'),
      shin: both('Leg', 'Foot'),
      foot: both('Foot', 'ToeBase'),
      spine: [len('Hips', 'Spine'), len('Spine', 'Spine1'), len('Spine1', 'Spine2')],
      neck: len('Spine2', 'Neck'),
      head: len('Neck', 'Head'),
      skull: len('Head', 'head_end'),
      clavicle: both('Shoulder', 'Arm'),
      upperArm: both('Arm', 'ForeArm'),
      forearm,
      hand: reached.length ? reached.reduce((s, r) => s + r, 0) / reached.length : forearm * HAND_OF_FOREARM,
    },
    hipsHeight: joints.Hips[1],
    height: top - sole,
    joints,
  };
}

export function turnsOf(joints, walrusNodes) {
  const game = worldsOf(walrusNodes);
  const turns = {};
  for (const [bone, to] of LONG) {
    const own = (s) => V(joints[s + to]).sub(V(joints[s + bone])).normalize();
    // (the mean of the two sides, the right one seen in a mirror)
    const mean = own('Left').add(mirror(own('Right'))).normalize();
    for (const s of SIDES) {
      const want = placeOf(game.get(s + to)).sub(placeOf(game.get(s + bone))).normalize();
      turns[s + bone] = new THREE.Quaternion().setFromUnitVectors(s === 'Left' ? mean : mirror(mean), want);
    }
  }
  for (const s of SIDES) turns[`${s}Hand`] = turns[`${s}ForeArm`].clone();
  return turns;
}

const hipJoints = (worlds) => placeOf(worlds.get('LeftUpLeg')).add(placeOf(worlds.get('RightUpLeg'))).multiplyScalar(0.5);

export function legRatio(walrusNodes, fitted) {
  return hipJoints(worldsOf(fitted)).y / hipJoints(worldsOf(walrusNodes)).y;
}

// whose size a node that is not one of the guest's joints takes: its nearest
// ancestor among these
const SIZED_BY = (name) => {
  if (/^(Left|Right)Hand$/.test(name) || name === 'Wep_Root' || name === 'Wep2_Root') return 'hand';
  if (name === 'Head') return 'skull';
  if (name === 'Neck' || name === 'Neck1') return 'head';
  if (/^(Left|Right)ForeArm$/.test(name)) return 'forearm';
  if (/^(Left|Right)Arm$/.test(name)) return 'upperArm';
  if (/^(Left|Right)Shoulder$/.test(name)) return 'clavicle';
  if (/^(Left|Right)UpLeg$/.test(name)) return 'thigh';
  if (/^(Left|Right)Leg$/.test(name)) return 'shin';
  if (/^(Left|Right)(Foot|ToeBase)$/.test(name)) return 'foot';
  if (name === 'Spine2') return 'chest';
  if (name === 'Spine1') return 'spine1';
  if (name === 'Spine') return 'spine';
  if (name === 'Hips') return 'pelvis';
  // (Reference, AITrajectory: the game's cameras and trajectory stay the game's)
  return name === 'Reference' || name === 'AITrajectory' ? 'one' : null;
};

export function fitSkeleton(walrusNodes, measured) {
  const game = worldsOf(walrusNodes);
  const gameAt = (n) => placeOf(game.get(n));
  const own = (n) => V(measured.joints[n]);
  const turns = turnsOf(measured.joints, walrusNodes);
  const still = new THREE.Quaternion();

  // the guest's joints stood as the game's man stands: each from its parent,
  // by its own offset, turned as its parent is turned
  const stood = new Map([['Hips', own('Hips')]]);
  for (const [name, parent] of CHAIN) {
    if (!measured.joints[name]) continue;
    stood.set(name, own(name).sub(own(parent)).applyQuaternion(turns[parent] ?? still).add(stood.get(parent)));
  }
  // on the ground (a foot is not turned: its ankle as high over the sole as
  // the file has it), on the figure's middle, and as far before the origin
  // as the game's hips are at this size
  const soles = SIDES.map((s) => stood.get(`${s}Foot`).y - own(`${s}Foot`).y);
  const hips = stood.get('LeftUpLeg').clone().add(stood.get('RightUpLeg')).multiplyScalar(0.5);
  const gameHips = hipJoints(game);
  const lift = -(soles[0] + soles[1]) / 2;
  const k = (hips.y + lift) / gameHips.y;
  const shift = new THREE.Vector3(-hips.x, lift, k * gameHips.z - hips.z);
  for (const at of stood.values()) at.add(shift);
  // (the game's second neck joint, at its share of the way)
  const necks = [gameAt('Neck'), gameAt('Neck1'), gameAt('Head')];
  const share = necks[1].distanceTo(necks[0]) / (necks[1].distanceTo(necks[0]) + necks[2].distanceTo(necks[1]));
  stood.set('Neck1', stood.get('Neck').clone().lerp(stood.get('Head'), share));

  const g = measured.segments;
  const both = (a, b) => (gameAt(`Left${b}`).distanceTo(gameAt(`Left${a}`)) + gameAt(`Right${b}`).distanceTo(gameAt(`Right${a}`))) / 2;
  const half = (at, a) => Math.abs(at(`Left${a}`).x - at(`Right${a}`).x) / 2;
  const sizes = {
    one: 1,
    hand: g.hand / gameAt('LeftHandMiddle4').distanceTo(gameAt('LeftHand')),
    skull: g.skull / gameAt('HeadEnd').distanceTo(gameAt('Head')),
    head: g.head / gameAt('Head').distanceTo(gameAt('Neck')),
    forearm: g.forearm / both('ForeArm', 'Hand'),
    upperArm: g.upperArm / both('Arm', 'ForeArm'),
    clavicle: g.clavicle / both('Shoulder', 'Arm'),
    thigh: g.thigh / both('UpLeg', 'Leg'),
    shin: g.shin / both('Leg', 'Foot'),
    foot: g.foot / both('Foot', 'ToeBase'),
    chest: half((n) => stood.get(n), 'Arm') / half(gameAt, 'Arm'),
    spine1: g.spine[1] / gameAt('Spine1').distanceTo(gameAt('Spine')),
    spine: g.spine[0] / gameAt('Spine').distanceTo(gameAt('Hips')),
    pelvis: half((n) => stood.get(n), 'UpLeg') / half(gameAt, 'UpLeg'),
  };

  const worlds = new Map();
  const sizedBy = new Map(); // a node → the size its children take
  const rows = [];
  const put = (name, parent, rotation, at, offset) => {
    const up = parent == null ? null : worlds.get(parent);
    // (where it is to stand, brought into its parent's frame; or its offset there as it is)
    const t = at ? (up ? at.clone().applyMatrix4(up.clone().invert()) : at.clone()) : offset;
    const local = new THREE.Matrix4().compose(t, new THREE.Quaternion().fromArray(rotation), new THREE.Vector3(1, 1, 1));
    worlds.set(name, up ? up.clone().multiply(local) : local);
    rows.push({ name, parent, translation: t.toArray(), rotation: [...rotation], scale: [1, 1, 1] });
  };
  for (const r of walrusNodes) {
    if (r.scale.some((s) => Math.abs(s - 1) > 1e-6)) throw new Error(`${r.name} is scaled in the game’s skeleton`);
    const size = sizes[sizedBy.get(r.parent) ?? 'one'];
    sizedBy.set(r.name, SIZED_BY(r.name) ?? sizedBy.get(r.parent) ?? 'one');
    if (stood.has(r.name)) put(r.name, r.parent, r.rotation, stood.get(r.name));
    else if (r.name === 'Wep_Root' || r.name === 'Wep2_Root') put(r.name, r.parent, r.rotation, gameAt(r.name));
    else put(r.name, r.parent, r.rotation, null, V(r.translation).multiplyScalar(size));
  }
  for (const n of ['head_end', 'headfront']) if (stood.has(n)) put(n, 'Head', [0, 0, 0, 1], stood.get(n));
  return rows;
}
