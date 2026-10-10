// The galaxy's small creatures, droids and aliens from the game, each on a
// skeleton of its own with the game's clips for it (walrusClips.js's
// OWN_RIGS takes these rows: the own-rig loader, lib/three/ownRig.js, plays
// them as the tauntaun's are): Theed's birds, Mos Eisley's chickens and
// scurriers, Kashyyyk's tachs, Naboo's pelikki and runyips, Endor's
// profoggs, the Gamorrean guard on his bench, the treadwell and the gonk
// in Echo Base, and Pillio's and Felucia's (the shrimp-moths, the sneep,
// the stintarils, the birds and rippers) for those worlds when they come.
// Each row: { skeleton (the drop's, by its last part), body (crew/<body>.glb),
// model (the drop's manifest name, for scripts/bf2017-fauna.mjs), set }.
// A rig with one clip plays it as its idle. Pure.
//
//   FAUNA { rig: { skeleton, body, model, set } }

const idles = (...xs) => (xs.length === 1 ? xs[0] : xs);

export const FAUNA = {
  birdtheed: {
    skeleton: 'BirdTheed_02_Ske',
    body: 'birdtheed',
    model: 'characters/npc/creatures/birdtheed/birdtheed_02/birdtheed_02_b_mesh',
    set: { idle: idles('L_Urusai_Stand_Idle_01', 'L_Urusai_Stand_Idle_02', 'L_Urusai_Stand_Idle_03'), 'idle.look': 'L_Urusai_Stand_Idle_04', walk: 'C_Urusai_Stand_Walk_Fwd_01', run: 'C_Urusai_Stand_Run_Fwd_01', stumble: 'C_Urusai_Stand_Run_Stumble_Fwd_01' },
  },
  chicken: {
    skeleton: 'Chicken_01_Ske',
    body: 'chicken',
    model: 'characters/npc/creatures/chicken/chicken_01/chicken_01_mesh',
    set: { idle: idles('L_Chicken_Stand_Idle_01', 'L_Chicken_Stand_Idle_02', 'L_Chicken_Stand_Idle_03'), 'idle.look': 'L_Chicken_Stand_Idle_04', walk: 'C_Chicken_Stand_Walk_Fwd_01', run: 'C_Chicken_Stand_Run_Fwd_01', 'hit.chest': 'A_Chicken_Stand_Idle_Hit_01', stumble: 'C_Chicken_Stand_Run_Stumble_Fwd_01' },
  },
  scurrier: {
    skeleton: 'Scurrier_01_Ske',
    body: 'scurrier',
    model: 'characters/npc/creatures/scurrier/scurrier_01/scurrier_01_mesh',
    set: { idle: idles('L_Scurrier_Stand_Idle_01', 'L_Scurrier_Stand_Idle_02'), 'idle.look': 'L_Scurrier_Stand_Idle_03', walk: 'C_Scurrier_Stand_Walk_Fwd_01', 'walk.left': 'C_Scurrier_Stand_Walk_Left_01', run: 'C_Scurrier_Stand_Run_Fwd_01', spit: 'C_Scurrier_Stand_Idle_Shoot_01' },
  },
  tach: {
    skeleton: 'Tach_01_Ske',
    body: 'tach',
    model: 'characters/npc/creatures/tach/tach_01/tach_01_mesh',
    set: { idle: idles('L_Tach_Stand_Idle_01', 'L_Tach_Stand_Idle_02'), 'idle.look': 'L_Tach_Stand_Idle_04', walk: 'C_Tach_Stand_Walk_Fwd_01', 'walk.right': 'C_Tach_Stand_Walk_Right_01', run: 'C_Tach_Stand_Run_Fwd_01', 'hit.chest': 'A_Tach_Stand_Idle_Hit_01', stumble: 'C_Tach_Stand_Run_Stumble_01' },
  },
  pelikki: {
    skeleton: 'Pelikki_01_Ske',
    body: 'pelikki',
    model: 'characters/npc/creatures/pelikki/pelikki_01/pelikki_01_mesh',
    set: { idle: 'L_Pelliki_Stand_Idle_01' },
  },
  runyip: {
    skeleton: 'Runyip_01_Ske',
    body: 'runyip',
    model: 'characters/npc/creatures/runyip/runyip_01/runyip_01_mesh',
    set: { idle: 'L_Runyip_Stand_Idle_01', walk: 'C_Runyip_Stand_Walk_Fwd_01', run: 'C_Runyip_Stand_Run_Fwd_01', 'hit.chest': 'A_Runyip_Stand_Hit_01' },
  },
  profogg: {
    skeleton: 'Profogg_01_Ske',
    body: 'profogg',
    model: 'characters/npc/creatures/profogg/profogg_01/profogg_01_mesh',
    // (the game's profogg never stands: its idle is its slowest amble)
    set: { idle: 'C_Profogg_Stand_Walk_Fwd_03', walk: idles('C_Profogg_Stand_Walk_Fwd_01', 'C_Profogg_Stand_Walk_Fwd_02'), run: 'C_Profogg_Stand_Run_Fwd_04', stumble: 'C_Profogg_Stand_Run_Stumble_Fwd_01' },
  },
  sneep: {
    skeleton: 'Sneep_01_Ske',
    body: 'sneep',
    model: 'characters/npc/creatures/sneep/sneep_01/sneep_01_mesh',
    set: { idle: idles('L_Sneep_Stand_Idle_01', 'L_Sneep_Stand_Idle_02'), 'idle.look': 'L_Sneep_Stand_Idle_03', walk: 'C_Sneep_Stand_Walk_Fwd_01', run: 'C_Sneep_Stand_Run_Fwd_01', 'hit.chest': 'A_Sneep_Stand_Idle_Hit_01' },
  },
  stintarils: {
    skeleton: 'Stintarils_01_Ske',
    body: 'stintarils',
    model: 'characters/npc/creatures/stintarils/stintarils_01/stintarils_01_mesh',
    set: { idle: idles('L_Stintarils_Stand_Idle_01', 'L_Stintarils_Stand_Idle_02'), walk: 'C_Stintarils_Stand_Walk_Fwd_01', run: 'C_Stintarils_Stand_Run_Fwd_01', stumble: 'C_Stintarils_Stand_Run_Stumble_01' },
  },
  pillioshrimp: {
    skeleton: 'PillioShrimp_Ske',
    body: 'pillioshrimp',
    model: 'characters/npc/creatures/pillioshrimp/pillioshrimp_01/pillioshrimp_01_mesh',
    set: { idle: idles('PillioScritter_Anchored_Idle', 'PillioScritter_Anchored_Idle_02'), fly: 'PillioScritter_Fly_Idle', walk: 'PillioScritter_Fly_Fwd_01', attack: 'PillioScritter_Fly_Attack_01', die: 'PillioScritter_Fly_Death_01', 'hit.chest': 'PillioScritter_Fly_HitReact_Gadget_01' },
  },
  felbird: {
    skeleton: 'FEL_Bird_01_Ske',
    body: 'felbird',
    model: 'characters/npc/creatures/fel_bird/fel_bird_01/fel_bird_01_mesh',
    set: { idle: idles('L_FEL_Bird_Ground_Idle_01', 'L_FEL_Bird_Ground_Idle_02'), fly: 'L_FEL_Bird_Fly_01', walk: 'L_FEL_Bird_Fly_Flapping_01', 'fly.up': 'L_FEL_Bird_Fly_Up_01', 'fly.down': 'L_FEL_Bird_Fly_Down_01', takeoff: 'L_FEL_Bird_Ground_TakeOff_01' },
  },
  felripper: {
    skeleton: 'FEL_Ripper_Ske',
    body: 'felripper',
    model: 'characters/npc/creatures/fel_ripper/fel_ripper_mesh',
    // (always on the wing)
    set: { idle: 'L_FEL_Ripper_Fly_01', walk: 'L_FEL_Ripper_Fly_01', 'fly.up': 'L_FEL_Ripper_Fly_Up_01', 'fly.down': 'L_FEL_Ripper_Fly_Down_01', 'fly.left': 'L_FEL_Ripper_Fly_Left_01' },
  },
  gamorrean: {
    skeleton: 'LW_GamorreanGuard_01_Ske',
    body: 'gamorreanguard',
    model: 'characters/npc/aliens/gamorreanguard/gamorreanguard_01/lw_gamorreanguard_01_mesh',
    // (sat on the floor: the bench's sitting needs the game's bench under it)
    set: { idle: 'L_Gamorrean_SitOnFloor_01', 'sit.bench': 'L_Gamorrean_SitOnBench_01', shake: 'L_Gamorrean_ShakeBars_01' },
  },
  treadwell: {
    skeleton: 'WED_15SeptoidTreadwell_01_Ske',
    body: 'treadwell',
    model: 'characters/npc/droids/wed_15septoidtreadwell_01/wed_15septoidtreadwell_01_mesh',
    set: { idle: idles('L_SeptoidTreadWell_Stand_Idle_01', 'L_SeptoidTreadWell_Stand_Idle_02', 'L_SeptoidTreadWell_Stand_Idle_03'), walk: 'C_SeptoidTreadWell_Stand_Walk_Fwd_01', run: 'C_SeptoidTreadWell_Stand_Run_Fwd_01', stumble: 'C_SeptoidTreadWell_Stand_Run_Stumble_Fwd_01' },
  },
  gonk: {
    skeleton: 'DroidGonk_01_Ske',
    body: 'gonk',
    model: 'characters/npc/droids/droidgonk/droidgonk_01/droidgonk_01_mesh',
    // (its two idles: the long one its own, the short one a look round)
    set: { idle: 'L_Gonk_Stand_Idle_01', 'idle.look': 'L_Gonk_Stand_Idle_02' },
  },
};
