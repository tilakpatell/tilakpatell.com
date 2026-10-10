// The game's drivers, riders, crews and gadgets on the humanoid: the X-34
// landspeeder's driver, the 74-Z speeder bike's (and the BARC's) rider, the
// troops sat in the AAL and the Lambda waiting to deploy, a turret's
// gunner, the bags and the gadgets, the poses down a weapon's sights.
// Packed as `vehicles` (scripts/bf2017-clips.mjs vehicles), taken by the
// figure when it gets on something (surface/scene.js's seatOn, through
// walrusStance.js's takePack); the additive ones (a driver's lean and
// turn, the hits on a figure carrying bags or an anti-armour launcher, the
// sights' sway) are walrusSets/additive.js's. Pure.
//
//   VEHICLE_SET  { siteName: gameName | [gameName…] }
//   rideClip(kind) → 'ride.<kind>' for a ride the set has, else null

export const VEHICLE_SET = {
  // the X-34: its driver in the left of the cockpit, the passenger beside
  'ride.landspeeder': ['X34_LandSpeeder_Driver_Idle', 'X34_LandSpeeder_Driver_Pose'],
  'ride.landspeeder.passenger': 'X34_LandSpeeder_Passenger_Pose',
  'ride.landspeeder.die': 'X34_LandSpeeder_Driver_Death',
  // the 74-Z: its rider low over the bars, faster at speed, getting on, going off it
  'ride.speederbike': ['L_HM_SpeederBike_Driver_Idle_02', 'SpeederBikeDriver_Idle_01'],
  'ride.speederbike.fast': 'L_HM_SpeederBike_Driver_Idle_Fast_02',
  'ride.speederbike.enter': 'A_HM_SpeederBike_Driver_Stand_Enter_Left',
  'ride.speederbike.look': 'A_HM_SpeederBike_AI_Driving_Idle_Gun_Looking',
  'ride.speederbike.die': ['A_HM_SpeederBike_Driver_Death', 'A_HM_SpeederBike_Driver_Death_02'],
  'ride.speederbike.away': 'SpeederBikeDriver_AwayDriver1_01',
  'ride.barc': 'L_HM_SpeederBARC_Driver_Idle_02',
  // sat in a transport, then out of it (the AAL's and the Lambda's spots)
  'deploy.aal': 'Deploy_AAL_Spot_Left1',
  'deploy.aal.wait': 'Deploy_AAL_Spot_Left1_Loop',
  'deploy.aal.right': 'Deploy_AAL_Spot_Right1',
  'deploy.lambda': 'LW_Deploy_Lambda_Spot_Left1_01',
  'deploy.lambda.wait': 'LW_Deploy_Lambda_Spot_Left1_Loop_01',
  // a turret's gunner
  'gunner.idle': 'Gunner_Face_Idle_01',
  'gunner.fire': 'Gunner_Face_Fire_01',
  // the anti-armour launcher's run back, and the gadgets' vault
  'at.run.back': 'AT_RunBwd',
  'at.vault': 'AT_VaultHigh3P_RightArm',
  'bags.vault': 'Bags_VaultHigh3P_RightArm',
  'hand.jump': 'Hand_Run_JumpFwd',
};

export const rideClip = (kind) => (VEHICLE_SET[`ride.${kind}`] ? `ride.${kind}` : null);
