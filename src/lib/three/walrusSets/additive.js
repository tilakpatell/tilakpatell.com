// The game's additive clips (anims_additive/ in the drop): deltas a figure's
// pose takes on top of whatever it is doing, as the game lays them, an aim
// up, down or round over the walk, a flinch by the side a bolt came in
// from, a lean into a run. Packed under the site's names (scripts/
// bf2017-clips.mjs additive, its clips marked `additive`) and laid by
// lib/three/additiveLayer.js. Pure.
//
//   ADD_SET                  { 'add.<siteName>': gameName | [gameName…] } (named
//                            apart: a figure's full-body hit.head is another clip)
//   AIM_RANGE                { pitch, yaw }: how far a full aim pose turns (rad)
//   additiveFor(pitch, yaw)  → { up, down, left, right } the four aims' weights (pitch + up, yaw + left)
//   hitSide([dx, dz], yaw)   → 'front' | 'back' | 'left' | 'right': where, round a
//                              figure facing `yaw` (+z at 0, +x its left), a hit came from

export const ADD_SET = {
  // the rifle's aims, the stance every 2017 soldier carries by default; the
  // pistol's and the heavy's own over theirs
  'add.aim.up': ['Add_HM_Rifle_Stand_Aim_Up', 'StandAimUp'],
  'add.aim.down': ['Add_HM_Rifle_Stand_Aim_Dwn', 'StandAimDown'],
  'add.aim.left': ['Add_HM_Rifle_Stand_Aim_Left', 'StandAimLeftAdditive'],
  'add.aim.right': ['Add_HM_Rifle_Stand_Aim_Right', 'StandAimRightAdditive'],
  'add.aim.p.up': 'P_Add_HM_Pistol_Stand_AimFwd_Up',
  'add.aim.p.down': 'P_Add_HM_Pistol_Stand_AimFwd_Dn',
  'add.aim.l.up': 'P_Add_HM_Lmg_Stand_AimFwd_Up',
  'add.aim.l.down': 'P_Add_HM_Lmg_Stand_AimFwd_Dn',
  // the hits, by side: a soldier's, the pistol's, a small one, the head's, a blast's
  'add.hit.front': ['Rifle_Stand_HitReact_Front1', 'Add_HM_Rifle_Stand_Hitreact_Front_04'],
  'add.hit.back': ['Rifle_Stand_HitReact_Back1', 'Add_HM_Rifle_Stand_Hitreact_Back_04'],
  'add.hit.left': ['Rifle_Stand_HitReact_Left1', 'Add_HM_Rifle_Stand_Hitreact_Left_04'],
  'add.hit.right': ['Rifle_Stand_HitReact_Right1', 'Add_HM_Rifle_Stand_Hitreact_Right_04'],
  'add.hit.p.front': 'Add_HM_Pistol_Stand_HitReact_Fwd_01',
  'add.hit.p.back': 'Add_HM_Pistol_Stand_HitReact_Bwd_01',
  'add.hit.p.left': 'Add_HM_Pistol_Stand_HitReact_Left_01',
  'add.hit.p.right': 'Add_HM_Pistol_Stand_HitReact_Right_01',
  'add.hit.small.front': 'Hit_Stand_Small_BodyFront1',
  'add.hit.small.back': 'Hit_Stand_Small_BodyBack1',
  'add.hit.small.left': 'Hit_Stand_Small_BodyLeft1',
  'add.hit.small.right': 'Hit_Stand_Small_BodyRight1',
  'add.hit.head': ['HitReact_Additive_Head_Front_v1', 'Hit_Stand_Small_HeadFront1'],
  'add.hit.crouch': 'Rifle_CrouchHitReactionFront2',
  'add.hit.blast.front': 'Rifle_Stand_ExplosionReact_Front1',
  'add.hit.blast.back': 'Rifle_Stand_ExplosionReact_Back1',
  'add.hit.blast.left': 'Rifle_Stand_ExplosionReact_Left1',
  'add.hit.blast.right': 'Rifle_Stand_ExplosionReact_Right1',
  // a lean into the turn while walking and running
  'add.lean.left': 'Lean_Walk_Left',
  'add.lean.right': 'Lean_Walk_Right',
  'add.lean.run.left': 'Lean_Run_Left',
  'add.lean.sprint.left': 'Add_HM_LeanLeftPose_Sprint_01',
  'add.lean.sprint.right': 'Add_HM_LeanRightPose_Sprint_01',
  // a driver's and a rider's: the X-34's lean, turn, bump; the 74-Z's lean
  'add.ride.landspeeder.lean.left': 'X34_LandSpeeder_Driver_Lean_Left',
  'add.ride.landspeeder.lean.right': 'X34_LandSpeeder_Driver_Lean_Right',
  'add.ride.landspeeder.turn.left': 'X34_LandSpeeder_Driver_Turn_Left',
  'add.ride.landspeeder.turn.right': 'X34_LandSpeeder_Driver_Turn_Right',
  'add.ride.landspeeder.hit': 'X34_LandSpeeder_Driver_HitReact_01',
  'add.ride.speederbike.lean.left': 'Add_HM_SpeederBike_OpenSeat_LeanLeft',
  'add.ride.speederbike.lean.right': 'Add_HM_SpeederBike_OpenSeat_LeanRight',
  // the hits on one carrying an anti-armour launcher, a medic's bags, a sidearm in hand
  'add.hit.at.front': 'AT_Stand_HitReact_Front1',
  'add.hit.at.back': 'AT_Stand_HitReact_Back1',
  'add.hit.bags.front': 'Bags_Stand_HitReact_Front1',
  'add.hit.bags.back': 'Bags_Stand_HitReact_Back1',
  'add.hit.hand.front': 'Hand_Stand_HitReact_Front1',
  'add.hit.hand.back': 'Hand_Stand_HitReact_Back1',
  // down the sights, the weapon's sway as the aim moves; suppressed, the flinch in a sprint
  'add.zoom.up': 'WepPoseZoom_Up',
  'add.zoom.down': 'WepPoseZoom_Dwn',
  'add.zoom.left': 'WepPoseZoom_Left',
  'add.zoom.right': 'WepPoseZoom_Right',
  'add.suppressed.left': 'Suppressed_Additive_AssaultSprint_Left',
  'add.suppressed.right': 'Suppressed_Additive_AssaultSprint_Right',
  // a shot's kick through the body, and the reload
  'add.fire.p': 'A_HM_Pistol_Stand_Fire',
  'add.fire.t': ['Add_HM_Rifle_Stand_FireLoop_02', 'Add_HM_Rifle_Stand_FireLoop_03'],
  'add.reload.t': 'A_RepCom_Rifle_Reload_01',
};

// (the game's stance aims are named Up and Left and stand at about these;
// a target further round takes the whole pose and the chest does the rest)
export const AIM_RANGE = { pitch: Math.PI / 3, yaw: Math.PI / 2 };

const share = (v, range) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v / range)) : 0);
export const additiveFor = (pitch, yaw) => ({
  up: share(pitch, AIM_RANGE.pitch),
  down: share(-pitch, AIM_RANGE.pitch),
  left: share(yaw, AIM_RANGE.yaw),
  right: share(-yaw, AIM_RANGE.yaw),
});

export function hitSide(from, yaw = 0) {
  const [dx, dz] = from ?? [0, 0];
  const ahead = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const left = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  if (!(Math.abs(ahead) > 1e-9 || Math.abs(left) > 1e-9)) return 'front';
  if (Math.abs(ahead) >= Math.abs(left)) return ahead >= 0 ? 'front' : 'back';
  return left > 0 ? 'left' : 'right';
}
