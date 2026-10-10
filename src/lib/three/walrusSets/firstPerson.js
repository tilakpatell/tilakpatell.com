// The game's first-person clips (its Walrus_HumanMale_1p skeleton: the
// humanoid's own bones by the same names, with three spine helpers the
// body hasn't, whose channels the pack leaves out), the arms' poses for
// each weapon class as walrusSets/stance.js keys them: held at ease, in a
// sprint, down the sights, a melee strike, the reload, the gun brought up,
// the death. Packed as `1p` (scripts/bf2017-clips.mjs 1p) and laid on the
// upper body while you see out of your own eyes (lib/three/firstPerson.js).
// Pure.
//
//   FP_SET                      { 'fp.<key>.<name>' | 'fp.<name>': gameName | [gameName…] }
//   fpClip(set|clips, key, name) → the stance's own, else the rifle's, else null

const BY = {
  p: { idle: ['P_1p_ST_DL44_IdlePose', '1p_Pistol_Standard_IdlePose'], sprint: 'P_1p_ST_DL44_SprintPose', aim: 'P_1p_ST_DL44_ZoomPose', melee: 'A_1p_DL44_Melee', deploy: ['A_1p_ST_DL44_Deploy', 'A_1p_ST_DL44_Deploy_02'] },
  t: { idle: ['P_1p_E11_IdlePose', '1p_Rifle_Standard_IdlePose'], sprint: 'P_1p_E11_SprintPose', aim: ['P_1p_E11_ZoomPose_02', 'P_1p_E11D_ZoomPose_01'], melee: 'A_1p_Rifle_Melee_FirstStrike_01', deploy: 'A_1p_E11D_Deploy', reload: 'A_1p_E11_ReloadClipEmpty' },
  l: { idle: ['P_1p_ST_DLT19_IdlePose', '1p_LMG_Standard_IdlePose'], sprint: 'P_1p_ST_DLT19_SprintPose', aim: 'A_1p_ST_DLT19_ZoomIn', melee: 'A_1p_ST_DLT19_Melee', deploy: 'A_1p_DLT19x_Deploy' },
};

export const FP_SET = {
  ...Object.fromEntries(Object.entries(BY).flatMap(([k, row]) => Object.entries(row).map(([n, g]) => [`fp.${k}.${n}`, g]))),
  'fp.melee.b': 'A_1p_Rifle_Melee_SecondStrike_01',
  'fp.dodge': 'A_1p_Rifle_Dodge_Left_01',
  'fp.die': ['Death1P_Stand_Left', 'Death1P_Stand_Right'],
};

export function fpClip(clips, key, name) {
  const has = (n) => Boolean(clips?.[n]);
  return [`fp.${key}.${name}`, `fp.t.${name}`, `fp.${name}`].find(has) ?? null;
}
