// The 2017 game's heroes on skeletons of their own: Yoda (Yoda_01_Ske, 101
// clips) and General Grievous (GeneralGrievous_01_Ske, 161), brought in from
// the desktop's export (docs/superpowers/plans/2026-10-21-bf-default-C4-kinds-
// from-the-export.md). The saber is one path on the humanoid rig (HANDOFF-
// battlefront.md), so neither fences yet and the roster lists them `soon`
// (galaxy/heroes.js); what the sets give them is what a surface person needs
// to stand, walk, turn, flinch, dodge and fall, from their own clips. Their
// strokes wait for the day an own rig fences. Each row: { skeleton (the
// drop's, by its last part), body (crew/<body>.glb), model (the drop's
// manifest name), set }, as walrusSets/fauna.js's are. Pure.
//
//   OWN_HEROES { rig: { skeleton, body, model, parts?, set } }

export const OWN_HEROES = {
  // (his only walks are in his guard, `_Blocking`: the game moves him no
  // other way, and has no run of his; the menu's and the cinematics' clips
  // left out)
  yoda: {
    skeleton: 'Yoda_01_Ske',
    body: 'yoda',
    model: 'characters/hero/yoda/yoda_01/yoda_01_mesh',
    parts: ['*_robe_skinned_mesh'],
    set: {
      idle: 'L_Yoda_Stand_Idle_01',
      'idle.look': 'L_Yoda_Stand_Idle_Fidget_01',
      walk: 'C_Yoda_Stand_Walk_Blocking_Fwd_01',
      'walk.back': 'C_Yoda_Stand_Walk_Blocking_Bwd_01',
      'walk.left': 'C_Yoda_Stand_Walk_Blocking_Left1_01',
      'walk.right': 'C_Yoda_Stand_Walk_Blocking_Right1_01',
      'turn.left': 'C_Yoda_StandTurn_Left_01',
      'turn.right': 'C_Yoda_StandTurn_Right_01',
      jump: 'A_Yoda_Jump_Fwd_01',
      'hit.chest': 'A_Yoda_Stagger_Bwd_01',
      stagger: 'A_Yoda_Stagger_Bwd_02',
      'dodge.back': 'A_Yoda_Dodge_Back_01',
      'dodge.front': 'A_Yoda_Dodge_Front_01',
      'dodge.left': 'A_Yoda_Dodge_Left_01',
      'dodge.right': 'A_Yoda_Dodge_Right_01',
      die: 'A_Yoda_Defeated_01',
    },
  },
  // (his stand idle is his first fidget loop, 3.5 s: the game's P_ stand is
  // a single frame, and its Add_ idle runs 17.5 s, five times the weight in
  // the pack for a figure standing about)
  grievous: {
    skeleton: 'GeneralGrievous_01_Ske',
    body: 'grievous',
    model: 'characters/hero/generalgrievous/generalgrievous_01/generalgrievous_01_mesh',
    set: {
      idle: 'L_Grievous_Stand_Idle_Fidget_01',
      'idle.look': 'L_Grievous_Stand_Idle_Fidget_02',
      walk: 'C_Grievous_Stand_Walk_Fwd_01',
      'walk.back': 'C_Grievous_Stand_Walk_Bwd_01',
      'walk.left': 'C_Grievous_Stand_Walk_Left1_01',
      'walk.right': 'C_Grievous_Stand_Walk_Right1_01',
      run: 'C_Grievous_Stand_Run_Fwd_03',
      sprint: 'C_Grievous_Stand_Sprint_Fwd_03',
      'turn.left': 'C_Grievous_StandTurn_Left_01',
      'turn.right': 'C_Grievous_StandTurn_Right_01',
      jump: 'A_Grievous_Jump_OnSpot_01',
      'hit.chest': 'A_Grievous_Stagger_Bwd_01',
      'hit.back': 'A_Grievous_Stagger_Fwd_01',
      stagger: 'A_Grievous_Stagger_Bwd_01',
      'dodge.back': 'A_Grievous_Dodge_Back_01',
      'dodge.front': 'A_Grievous_Dodge_Front_01',
      'dodge.left': 'A_Grievous_Dodge_Left_01',
      'dodge.right': 'A_Grievous_Dodge_Right_01',
      die: 'A_Grievous_Defeated_Fwd_02',
    },
  },
};
