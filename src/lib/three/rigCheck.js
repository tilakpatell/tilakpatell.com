// Whether a rig or a clip fits the code that animates it, on names alone (no
// three, no file): so a figure that would stand in a T-pose, or a clip with
// a track for a bone the figures lack, is found when it's committed
// (scripts/rig-check.mjs, over every GLB the worlds load) and not when a
// visitor sees it. And the one place each family's bones are named, so the
// layers and the stride work on any of them, not only Meshy's.
//
//   ROLES, plain(name)   what each part is called, rig by rig, and a bone's
//     name without its rig's prefix or a download's number (rig.js's, which
//     rig.js is to import from here: this module loads in Node, rig.js doesn't)
//   FAMILIES   the families named: 'meshy', 'mixamo', 'unreal', 'cc', 'highmoon'
//   checkRig(boneNames) → { family, roles: { [role]: name | null }, toes, missing: [role] }
//   checkClip(trackNames, boneNames) → { resolved: [track], unresolved: [track], root }
//     (root: the bone whose translation is the hips', by role; null if none)
//   hipsOf(clip, hipsNode) → the hips' height a clip was made on: its
//     userData.hips, else the bake's extras.hips, else the Hips node's rest
//     y; noted on the clip so retarget and every caller read one number
//   rolesFor(family) → { [role]: name }   each role's bone on that family's
//     rig, named as three binds it (GLTFLoader drops a name's ':' and '.')
//   masksFor(family) → { upper, lower }   the bones each animation layer may
//     move on that family's rig (the lower turns the hips, never moves them)

// what each part is called, rig by rig: Meshy and Mixamo, Unreal, Character
// Creator, High Moon Studios' Transformers (War for Cybertron, Fall of
// Cybertron: L_Arm02_Shoulder_XB and the like) and the Transformers: Prime
// game's (Humerus.l, Thigh.l). Each role's names in order of preference.
export const ROLES = {
  armL: ['leftarm', 'upperarm_l', 'l_upperarm', 'l_arm02_shoulder_xb', 'humerus.l', 'bicep.l'],
  foreL: ['leftforearm', 'lowerarm_l', 'l_forearm', 'l_arm03_elbow_xb', 'hand.l', 'arm.l'],
  handL: ['lefthand', 'hand_l', 'l_hand', 'l_arm04_hand_xb', 'palm.l'],
  armR: ['rightarm', 'upperarm_r', 'r_upperarm', 'r_arm02_shoulder_xb', 'humerus.r', 'bicep.r'],
  foreR: ['rightforearm', 'lowerarm_r', 'r_forearm', 'r_arm03_elbow_xb', 'hand.r', 'arm.r'],
  handR: ['righthand', 'hand_r', 'r_hand', 'r_arm04_hand_xb', 'palm.r'],
  thighL: ['leftupleg', 'thigh_l', 'l_thigh', 'l_leg01_thigh_xb', 'thigh.l'],
  calfL: ['leftleg', 'calf_l', 'l_calf', 'l_leg02_knee_xb', 'leg.l'],
  footL: ['leftfoot', 'foot_l', 'l_foot', 'l_leg03_ankle_xb', 'foot.l'],
  toeL: ['lefttoebase', 'ball_l', 'l_toebase', 'l_leg04_toes_xl2'],
  thighR: ['rightupleg', 'thigh_r', 'r_thigh', 'r_leg01_thigh_xb', 'thigh.r'],
  calfR: ['rightleg', 'calf_r', 'r_calf', 'r_leg02_knee_xb', 'leg.r'],
  footR: ['rightfoot', 'foot_r', 'r_foot', 'r_leg03_ankle_xb', 'foot.r'],
  toeR: ['righttoebase', 'ball_r', 'r_toebase', 'r_leg04_toes_xl2'],
  head: ['head', 'c_spine04_head_xb'],
  hips: ['hips', 'hip', 'pelvis', 'c_spine00_hips_xb', 'hipcon'], // (Character Creator's hip holds both the spine and the pelvis)
};

// a bone's name without its rig's prefix or the number a download appended
export const plain = (n) =>
  n
    .replace(/^mixamorig:?/i, '')
    .replace(/^CC_Base_/i, '')
    .replace(/_\d+$/, '')
    .toLowerCase();

// a node's name as three binds it (PropertyBinding.sanitizeNodeName): a
// clip's track finds its bone by this, so two names that sanitise alike bind
const bound = (n) => n.replace(/\s/g, '_').replace(/[[\].:/]/g, '');

// Each family's bones by role, the spine from the hips up to the neck, the
// shoulders, and any bone the lower layer also owns: the layers need more
// than the roles (the spine is the upper body's). High Moon's spine between
// the hips and the head isn't known by name here (no figure is committed),
// so its upper layer is the head and the arms.
const side = (l, r) => ({ L: l, R: r });
const RIGS = {
  meshy: {
    names: { hips: 'Hips', head: 'Head', arm: side('LeftArm', 'RightArm'), fore: side('LeftForeArm', 'RightForeArm'), hand: side('LeftHand', 'RightHand'), thigh: side('LeftUpLeg', 'RightUpLeg'), calf: side('LeftLeg', 'RightLeg'), foot: side('LeftFoot', 'RightFoot'), toe: side('LeftToeBase', 'RightToeBase') },
    spine: ['Spine02', 'Spine01', 'Spine', 'neck'],
    shoulder: side('LeftShoulder', 'RightShoulder'),
  },
  unreal: {
    names: { hips: 'pelvis', head: 'head', arm: side('upperarm_l', 'upperarm_r'), fore: side('lowerarm_l', 'lowerarm_r'), hand: side('hand_l', 'hand_r'), thigh: side('thigh_l', 'thigh_r'), calf: side('calf_l', 'calf_r'), foot: side('foot_l', 'foot_r'), toe: side('ball_l', 'ball_r') },
    spine: ['spine_01', 'spine_02', 'spine_03', 'neck_01'],
    shoulder: side('clavicle_l', 'clavicle_r'),
  },
  cc: {
    names: { hips: 'CC_Base_Hip', head: 'CC_Base_Head', arm: side('CC_Base_L_Upperarm', 'CC_Base_R_Upperarm'), fore: side('CC_Base_L_Forearm', 'CC_Base_R_Forearm'), hand: side('CC_Base_L_Hand', 'CC_Base_R_Hand'), thigh: side('CC_Base_L_Thigh', 'CC_Base_R_Thigh'), calf: side('CC_Base_L_Calf', 'CC_Base_R_Calf'), foot: side('CC_Base_L_Foot', 'CC_Base_R_Foot'), toe: side('CC_Base_L_ToeBase', 'CC_Base_R_ToeBase') },
    spine: ['CC_Base_Waist', 'CC_Base_Spine01', 'CC_Base_Spine02', 'CC_Base_NeckTwist01', 'CC_Base_NeckTwist02'],
    shoulder: side('CC_Base_L_Clavicle', 'CC_Base_R_Clavicle'),
    lower: ['CC_Base_Pelvis'], // (the legs hang from it, under the hip)
  },
  highmoon: {
    names: { hips: 'C_Spine00_Hips_XB', head: 'C_Spine04_Head_XB', arm: side('L_Arm02_Shoulder_XB', 'R_Arm02_Shoulder_XB'), fore: side('L_Arm03_Elbow_XB', 'R_Arm03_Elbow_XB'), hand: side('L_Arm04_Hand_XB', 'R_Arm04_Hand_XB'), thigh: side('L_Leg01_Thigh_XB', 'R_Leg01_Thigh_XB'), calf: side('L_Leg02_Knee_XB', 'R_Leg02_Knee_XB'), foot: side('L_Leg03_Ankle_XB', 'R_Leg03_Ankle_XB'), toe: side('L_Leg04_Toes_XL2', 'R_Leg04_Toes_XL2') },
    spine: [],
    shoulder: side(null, null),
  },
};
// Mixamo's is Meshy's skeleton by name, but for its prefix and its spine
const mixamo = (n) => (n ? `mixamorig${n}` : n);
RIGS.mixamo = {
  names: Object.fromEntries(Object.entries(RIGS.meshy.names).map(([k, v]) => [k, typeof v === 'string' ? mixamo(v) : side(mixamo(v.L), mixamo(v.R))])),
  spine: ['Spine', 'Spine1', 'Spine2', 'Neck'].map(mixamo),
  shoulder: side(mixamo('LeftShoulder'), mixamo('RightShoulder')),
};

export const FAMILIES = ['meshy', 'mixamo', 'unreal', 'cc', 'highmoon'];

// which family a rig's names say it is (its prefix, else its naming
// scheme); null for a rig ROLES has no family for
const UNREAL = new Set(['pelvis', 'upperarm_l', 'lowerarm_l', 'thigh_l', 'calf_l', 'ball_l']);
const MESHY = new Set(['hips', 'leftarm', 'leftforearm', 'leftupleg', 'leftleg', 'lefttoebase']);
function familyOf(names) {
  if (names.some((n) => /^mixamorig/i.test(n))) return 'mixamo';
  if (names.some((n) => /^CC_Base_/i.test(n))) return 'cc';
  const p = names.map(plain);
  if (p.some((n) => /_x[bl]\d?$/.test(n))) return 'highmoon';
  if (p.some((n) => UNREAL.has(n))) return 'unreal';
  if (p.some((n) => MESHY.has(n))) return 'meshy';
  return null;
}

// each role's bone among `names`, as rig.js's findBones picks it (the first
// name by plain() wins, then the role's names in order)
function rolesIn(names) {
  const byPlain = new Map();
  for (const n of names) {
    const k = plain(n);
    if (!byPlain.has(k)) byPlain.set(k, n);
  }
  const roles = {};
  for (const [role, list] of Object.entries(ROLES)) roles[role] = list.map((n) => byPlain.get(n)).find((n) => n != null) ?? null;
  return roles;
}

export function checkRig(boneNames = []) {
  const names = [...boneNames].filter((n) => typeof n === 'string');
  const roles = rolesIn(names);
  return {
    family: familyOf(names),
    roles,
    toes: Boolean(roles.toeL && roles.toeR),
    missing: Object.keys(ROLES).filter((r) => !roles[r]),
  };
}

// a track's bone and property: the property after the last dot, as a bone's
// own name may hold one (Humerus.l)
const split = (t) => {
  const i = t.lastIndexOf('.');
  return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i + 1)];
};
const TRANSFORM = new Set(['position', 'quaternion', 'scale']);

export function checkClip(trackNames = [], boneNames = []) {
  const bones = new Set(boneNames.map(bound));
  const resolved = [];
  const unresolved = [];
  const moved = []; // the bones the clip moves (a translation track)
  for (const t of trackNames) {
    const [bone, prop] = split(t);
    if (!TRANSFORM.has(prop)) continue; // (a morph's weights bind to a mesh, not a bone)
    (bones.has(bound(bone)) ? resolved : unresolved).push(t);
    if (prop === 'position') moved.push(bone);
  }
  return { resolved, unresolved, root: rolesIn(moved).hips };
}

export function hipsOf(clip, hipsNode) {
  const u = clip?.userData;
  const y = u?.hips ?? u?.extras?.hips ?? hipsNode?.position?.y ?? null;
  if (u && y != null && u.hips == null) u.hips = y;
  return y;
}

export function rolesFor(family) {
  const rig = RIGS[family];
  const out = {};
  for (const role of Object.keys(ROLES)) {
    const m = /^(.*)([LR])$/.exec(role);
    const v = rig ? (m ? rig.names[m[1]]?.[m[2]] : rig.names[role]) : null;
    out[role] = v ?? null;
  }
  return out;
}

export function masksFor(family) {
  const rig = RIGS[family];
  if (!rig) return { upper: [], lower: [] };
  const r = rolesFor(family);
  const keep = (list) => list.filter(Boolean);
  return {
    upper: keep([...rig.spine, r.head, rig.shoulder.L, r.armL, r.foreL, r.handL, rig.shoulder.R, r.armR, r.foreR, r.handR]),
    lower: keep([r.hips, ...(rig.lower ?? []), r.thighL, r.calfL, r.footL, r.toeL, r.thighR, r.calfR, r.footR, r.toeR]),
  };
}
