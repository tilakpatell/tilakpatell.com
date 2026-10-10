// The worlds' soldiers' own moves from the game (its AI families, most on the
// cinematics' skeleton, the humanoid's rig): taking cover low and high,
// peeking and firing from it and flinching in it, the start when one has you
// and the stand-down after, the arrivals, the patrol's starts, stops and
// turns, and the officer's hand signals. The surface's behaviours name
// these by their states (surface/hostiles.js's HOSTILE_BODY rows' `clip`,
// ALERT_CLIP); a figure without the pack plays the site's as before. Packed
// as `npc` (scripts/bf2017-clips.mjs npc), loaded with the first soldier
// (walrus.js's packUrls for a kind with no hero pack). None of the
// humanoid pack's names is taken. Pure.
//
//   NPC_SET  { siteName: gameName | [gameName…] }

export const NPC_SET = {
  // in low cover (crouched behind something waist-high): the left-hand
  // side's, the game's default; the high wall's standing
  'cover.low.idle': ['Cover_Left_Crouch_Idle_Search', 'Cover_Left_Crouch_Idle_Search_02'],
  'cover.low.peek': ['Cover_Left_Crouch_PeekOver', 'Cover_Left_Crouch_PeekOut'],
  'cover.low.fire': ['T_HM_Cover_Left_Crouch_FireOver', 'Cover_Right_Crouch_FireOverHedge'],
  'cover.low.into': ['Cover_Left_Crouch_Into', 'Cover_Left_Crouch_Short_Into'],
  'cover.low.out': ['Cover_Left_Crouch_OutToStand', 'Cover_Right_Crouch_OutToStand'],
  'cover.low.flinch': ['Cover_Left_Crouch_Flinch1', 'Cover_Left_Crouch_FireOver_Flinch'],
  'cover.low.suppressed': 'Cover_Left_Crouch_Idle_Suppressed',
  // (the animator's way into and out of the `cover` base: animator.js's .enter and .exit)
  'cover.enter': ['Cover_Left_Crouch_Into', 'Cover_Left_Crouch_Short_Into'],
  'cover.exit': ['Cover_Left_Crouch_OutToStand', 'Cover_Right_Crouch_OutToStand'],
  'cover.high.idle': ['C_HM_Cover_Left_Stand_Idle_Search_02', 'C_HM_Cover_Left_Stand_Idle_Search_03'],
  'cover.high.peek': ['Cover_Left_Stand_PeekOut', 'Cover_Right_Stand_PeekOut'],
  'cover.high.fire': ['Cover_Left_Stand_FireFromHipStepOut', 'Cover_Right_Stand_FireFromHipStepOut'],
  'cover.high.into': ['Cover_Left_Stand_Into', 'Cover_Left_Stand_Short_Into'],
  'cover.high.out': ['Cover_Left_Stand_OutToStand', 'Cover_Right_Stand_OutToStand'],
  'cover.high.flinch': ['Cover_Left_Stand_Flinch1', 'Cover_Right_Stand_Flinch1'],
  'cover.high.suppressed': ['Cover_Left_Stand_Idle_Suppressed', 'Cover_Left_Stand_UnderFire'],
  'cover.high.reload': 'Cover_Right_Stand_Reload',
  'cover.prone': 'Cover_Prone_Idle',
  // awareness: the start when it has you, the look round, the stand-down, the search's turn
  'aware.alert': ['AI_Officer_Trooper_Patrol_React_to_Investigate_Turn_000', 'AI_Officer_Rebel_Patrol_React_to_Investigate_Turn_000'],
  'aware.alert.back': ['AI_Officer_Trooper_Patrol_React_to_Investigate_Turn_180_Left', 'AI_Officer_Rebel_Patrol_React_to_Investigate_Turn_180_Left'],
  'aware.look': ['AI_Rifleman_Trooper_Investigate_InspX_02_look_around', 'AI_Rifleman_Trooper_Investigate_InspX_03_look_around'],
  'aware.relax': ['AI_Officer_Trooper_Investigate_React_to_Patrol_01', 'AI_Officer_Rebel_Investigate_React_to_Patrol_01'],
  'aware.search': ['AI_Officer_Trooper_Patrol_React_to_Search_Turn_000', 'AI_Officer_Rebel_Patrol_React_to_Search_Turn_000'],
  // arriving: dropped in, run in to a stop, the gun brought up
  'spawn.drop': ['Rifle_DropFromHeightLand', 'A_HM_Pistol_DropFromHeightLand_01'],
  'spawn.runin': ['A_HM_Rifle_Run_FwdToStand_01', 'T_HM_Rifle_RunToStand_Fwd_01'],
  'spawn.deploy': ['A_HM_A180_Stand_Deploy_01', 'A_HM_Pistol_Stand_Deploy_01'],
  // the patrol's walk, its start, stop and turns (the officer's, the game's patrol leader)
  'loco.patrol': ['AI_Officer_Trooper_Patrol_Loco_Walking_Fwd_01', 'AI_Officer_Trooper_Patrol_Loco_Walking_Fwd_02'],
  'loco.start': 'AI_Officer_Trooper_Patrol_Loco_Fwd_Start',
  'loco.stop': 'AI_Officer_Trooper_Patrol_Loco_Fwd_Stop',
  'loco.turn.right': 'AI_Officer_Trooper_Patrol_Loco_Walking_Turn_090',
  'loco.turn.back': ['AI_Officer_Trooper_Patrol_Loco_Walking_Turn_180_Left', 'AI_Officer_Trooper_Patrol_Loco_Walking_Turn_180_Right'],
  'loco.turn.left': 'AI_Officer_Trooper_Patrol_Loco_Walking_Turn_270',
  'loco.search.turn': 'AI_Heavy_Trooper_Search_Turn_270',
  // the rifleman's own: a sprint, a jump, a landing
  'ai.rifle.sprint': 'Rifle_Sprint',
  'ai.rifle.jump': ['Rifle_Run_JumpFwd', 'Rifle_JumpStill'],
  'ai.rifle.land': 'Rifle_DropFromHeightLand',
  'ai.rifle.hit': 'Rifle_Sprint_HitReact_Back1',
  // the officer: his hand signals to the squad
  'officer.signal': ['A_RepCom_Rifle_HandSignal_1_01', 'Handsignal_ReadyIdle_RightDownSignal'],
  'officer.attack': ['Handsignal_RunFwd_RightAttackSignal', 'Handsignal_Crouch_RightAttackSignal01'],
  'officer.halt': ['Handsignal_ReadyIdle_LeftDownSignal', 'Handsignal_WalkFwd_LeftStopSignal_To_Crouch'],
  'officer.look': ['Handsignal_WalkFwd_RightLookSignal', 'Handsignal_WalkFwd_LeftLookSignal'],
};
