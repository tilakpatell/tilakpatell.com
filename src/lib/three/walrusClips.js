// The clip names the site asks for (the combat rules' strokes, the AI's
// reactions, locomotion) mapped onto Star Wars Battlefront II (2017)'s own
// clips, which a pack (scripts/bf2017-clips.mjs) takes from the game and
// stores under the site's names. A hero's set is its own: its strikes, the
// _V2 strikes as the heavies, every _BackToIdle as a recovery, its block,
// staggers, dodges, dash, jump attack, the Force, its defeat, its walk and
// run; the generic humanoid's is everyone's (the rifle and pistol stances,
// deaths, flinches, dodges). The game spells one thing several ways (Luke's
// Stagger_Front is Vader's Stagger_Fwd; Dooku's returns end _02; Anakin's
// block is a Stand_Idle_Block), so a site name lists every spelling, best
// first, and the first the game has wins. Nothing here is a UAL or Meshy
// clip: a 2017 figure plays the game's (the owner's ruling, 2026-10-10).
// Pure; the names are the game's as web/anims.jsonl lists them.
//
//   HERO_SET(prefix | [prefix…]) → { siteName: gameName | [gameName…] }
//   HUMANOID_SET                 the generic person's
//   candidates(map, name)        → [gameName…] the spellings, best first
//   resolveGame(map, name, has)  → the first game name `has`, else the
//                                  same for CLIP_FALLBACK's stand-in, else null
//   PACKS                        { pack: map } by the site's kind (crewList.js)
//   OWN_RIGS                     { rig: { skeleton, body, set } }: the kinds
//                                on a skeleton of their own (the B1, the B2,
//                                the Ewok, the astromech, the probe, the
//                                tauntaun; the droideka is lane V's walker,
//                                rigSets.js), each pack's clips
//                                taken from that skeleton only (ownRig.js)
//   RIG_SET(rig)                 → its set
//   PACK_OPTS                    { pack: { additive?, skeletons? } } for the
//                                family packs (walrusSets/: stances, the
//                                additive layer, the NPCs', the emotes…)

import { CLIP_FALLBACK } from './walrusRig.js';
import { FAUNA } from './walrusSets/fauna.js';
import { SET_PACKS } from './walrusSets/index.js';

const one = (xs) => (xs.length === 1 ? xs[0] : xs);
const unique = (xs) => [...new Set(xs)];

export function HERO_SET(prefix) {
  const ps = [].concat(prefix);
  // every prefix through every pattern, in pattern order
  const all = (...pats) => one(unique(pats.flatMap((p) => ps.map((h) => p.replaceAll('<H>', h)))));
  const map = {
    idle: all('L_<H>_Stand_Idle_01', 'L_<H>_Stand_IdleLoop_01', 'L_<H>_StandIdle_01', 'L_<H>_Stand_Idle_02', 'P_<H>_Stand_Idle_01'),
    walk: all('C_<H>_Stand_Walk_Fwd_01', 'C_<H>_Stand_TinySteps_01'),
    run: all('C_<H>_Stand_Run_Fwd_04', 'C_<H>_Stand_Run_Fwd_03', 'C_<H>_Stand_Run_Fwd_02', 'C_<H>_Stand_Run_Fwd_01'),
    sprint: all('C_<H>_Stand_Sprint_Fwd', 'C_<H>_Stand_Sprint_Fwd_01', 'C_<H>_Stand_Sprint_Fwd_03', 'C_<H>_Stand_Sprint_Fwd_2'),
    'walk.back': all('C_<H>_Stand_Walk_Bwd_01'),
    'walk.left': all('C_<H>_Stand_Walk_Left1_01'),
    'walk.right': all('C_<H>_Stand_Walk_Right1_01'),
    'turn.left': all('C_<H>_StandTurn_Left_01', 'C_<H>_Stand_Turn_Left_01', 'C_<H>_StandTurn_Left'),
    'turn.right': all('C_<H>_StandTurn_Right_01', 'C_<H>_Stand_Turn_Right_01', 'C_<H>_StandTurn_Right'),
    // the block: a swing up across where the hero has one, else the parry's stagger, else the held guard
    'sword.block': all('A_<H>_Stand_Block_SwingRight_01', 'A_<H>_Stand_Idle_Block_SwingRight_01', 'A_<H>_Stand_Block_SwingRight_02', 'A_<H>_Stand_BlockSaber_Right_01', 'A_<H>_Stand_Block_Right_01', 'A_<H>_Block_Stagger_Fwd_01', 'A_<H>_Block_Stagger_01', 'A_<H>_Block_Stagger_Fwd_02', 'L_<H>_Stand_Idle_Block_01'),
    'sword.block.left': all('A_<H>_Stand_Block_SwingLeft_01', 'A_<H>_Stand_Idle_Block_SwingLeft_01', 'A_<H>_Stand_BlockSaber_Left_01'),
    'sword.blocked': all('A_<H>_LightAttack_Blocked_01', 'A_<H>_Block_Stagger_Fwd_01', 'A_<H>_Block_Stagger_01', 'A_<H>_Block_Stagger_Fwd_02'),
    'sword.dash': all('A_<H>_Stand_SaberDash_01', 'A_<H>_Dash_Exit_02'),
    'sword.aerial.a': all('A_<H>_Jump_SaberAttack_Light_FH_01', 'A_<H>_Jump_SaberAttack_Light_FH_01_01'),
    'sword.pound': all('A_<H>_Stand_ForceRepulse_02'),
    'force.push': all('A_<H>_Stand_ForceAttack_Push_01', 'A_<H>_ForcePush_01'),
    // the kits' Force powers (surface/abilityRules.js's CLIPS_OF): Vader's
    // choke and Maul's choke-throw, Anakin's pull, the slam and the rush,
    // the Emperor's beam, chain and electrocute (Dooku's spelt _02),
    // Vader's rage, Dooku's exposed weakness, and the saber thrown
    'force.choke': all('A_<H>_ForceChoke_Enter_01', 'A_<H>_ChokeThrow_Start_01'),
    'force.pull': all('A_<H>_Ability2_PullMastery_Full'),
    'force.slam': all('A_<H>_Ability3_LandingStrike_Land', 'A_<H>_Stand_ForceRepulse_02'),
    'force.rush': all('A_<H>_Stand_RushAttack_01', 'A_<H>_SpinLeap_01', 'A_<H>_Stand_SaberDash_01', 'A_<H>_Dash_Exit_02'),
    'force.lightning': all('A_<H>_Stand_Beam_Fwd_01'),
    'force.chain': all('A_<H>_Stand_ChainLightning_01'),
    'force.electrocute': all('A_<H>_Stand_Electrocute_01', 'A_<H>_Stand_Electrocute_02'),
    'force.rage': all('A_<H>_RagePowerUp_01'),
    'force.weaken': all('A_<H>_Stand_ExposeWeakness_02'),
    'saber.throw': all('A_<H>_Stand_ThrowSaber_FwdFacing_02', 'A_<H>_SaberThrow_Stand_01'),
    'dodge.back': all('A_<H>_Dodge_Back_01'),
    'dodge.front': all('A_<H>_Dodge_Front_01'),
    'dodge.left': all('A_<H>_Dodge_Left_01'),
    'dodge.right': all('A_<H>_Dodge_Right_01'),
    // (hit from the front: Luke's Stagger_Front is the others' Stagger_Bwd, a step back)
    'hit.chest': all('A_<H>_Stagger_Front_01', 'A_<H>_Stagger_Bwd_01'),
    'hit.head': all('A_<H>_Stagger_Front_02', 'A_<H>_Stagger_Bwd_02'),
    'hit.back': all('A_<H>_Stagger_Back_01', 'A_<H>_Stagger_Fwd_01'),
    die: all('A_<H>_Defeated_01', 'A_<H>_Defeated_Fwd_01'),
    'die.fwd': all('A_<H>_Defeated_Fwd_01', 'A_<H>_Defeated_01'),
    jump: all('A_<H>_Jump_Fwd_03', 'A_<H>_Jump_Fwd_01', 'A_<H>_Jump_Fwd_02', 'L_<H>_Jump_Fwd_02', 'L_<H>_Jump_Fwd_01'),
  };
  // the six strikes as the stance's strokes, the _V2 strikes as the heavies,
  // and each one's way back to the guard as its `.rec`
  const strokes = { 'sword.light.a': 1, 'sword.light.b': 2, 'sword.light.c': 3, 'sword.a': 4, 'sword.b': 5, 'sword.uppercut': 6 };
  const heavies = { 'sword.heavy.a': 1, 'sword.heavy.b': 2, 'sword.heavy.c': 3, 'sword.heavy.d': 4 };
  for (const [site, i] of Object.entries(strokes)) {
    map[site] = all(`A_<H>_AttackLoop_Strike${i}`);
    map[`${site}.rec`] = all(`A_<H>_AttackLoop_Strike${i}_BackToIdle`, `A_<H>_AttackLoop_Strike${i}_BackToIdle_02`);
  }
  for (const [site, i] of Object.entries(heavies)) {
    map[site] = all(`A_<H>_AttackLoop_Strike${i}_V2`);
    // (Luke's fourth is spelt with a trailing ' 1')
    map[`${site}.rec`] = all(`A_<H>_AttackLoop_Strike${i}_V2_BackToIdle`, `A_<H>_AttackLoop_Strike${i}_V2_BackToIdle_02`, `A_<H>_AttackLoop_Strike${i}_V2_BackToIdle 1`);
  }
  return map;
}

// everyone's: a person with a rifle or a pistol, on the generic set
export const HUMANOID_SET = {
  idle: ['L_Luke_Stand_Unarmed_Idle_01', 'AI_Officer_Trooper_Patrol_Twitch_01'],
  walk: ['C_HM_Rifle_Walk_Fwd_01', 'Loco_Unarmed_WalkFwd_V2'],
  run: ['C_HM_Rifle_Run_Fwd_01', 'Loco_Unarmed_Stand_Run_Fwd'],
  sprint: ['C_HM_Rifle_Sprint_Fwd_01', 'Loco_Unarmed_SprintFwd_V2'],
  'walk.back': 'C_HM_Rifle_Walk_Bwd_01',
  'walk.left': 'C_HM_Rifle_Walk_Left1_01',
  'walk.right': 'C_HM_Rifle_Walk_Right1_01',
  'turn.left': 'L_HM_Pistol_Stand_TurnLeftSlow90_01',
  'turn.right': 'L_HM_Pistol_Stand_TurnRightSlow90_01',
  crouch: 'A_HM_Rifle_Stand_to_Crouch_01',
  'crouch.run': 'C_HM_Rifle_Crouch_Run_Fwd_01',
  jump: ['A_HM_Pistol_Stand_Jump', 'Rifle_JumpStill'],
  'aim.pistol': 'P_HM_Pistol_StandIdle_01',
  'aim.rifle': 'P_HM_Rifle_StandIdle_01',
  'hit.chest': ['Stand_Combat_Flinch01', 'A_HM_Rifle_Stagger_Bwd_01'],
  'hit.head': ['Stand_Combat_Flinch02', 'A_HM_Rifle_Stagger_Bwd_02'],
  'hit.back': ['Stand_Combat_Flinch03', 'A_HM_Rifle_Stagger_Fwd_01'],
  stagger: 'A_HM_Rifle_Stagger_Bwd_01',
  die: ['A_HM_Death_Stand_Front_Melee_02', 'A_HM_Death_Stand_Run_Fwd_01'],
  'die.fwd': ['A_HM_Death_Stand_Front_Melee_02', 'A_HM_Death_Stand_Run_Fwd_01'],
  'die.back': 'A_HM_Death_Stand_Back_Melee_02',
  'die.blown': ['SP_3p_Death_Explode_Back_01', 'A_HM_Death_Stand_Back_Melee_02'],
  'dodge.back': 'A_HM_Rifle_Dodge_Back_01',
  'dodge.front': 'A_HM_Rifle_Dodge_Front_01',
  'dodge.left': 'A_HM_Rifle_Dodge_Left_01',
  'dodge.right': 'A_HM_Rifle_Dodge_Right_01',
  talk: 'LW_ST1_TalkToSpyLoop_01',
  'melee.rifle': 'A_HM_Rifle_Melee_FirstStrike_01',
  // (phase 2: the troopers' and the people's, from the game's own sets; the
  // end-of-round victories and the P_ stances are single-frame poses, kept out)
  'idle.patrol': ['AI_Officer_Trooper_Patrol_Twitch_01', 'AI_Officer_Trooper_Patrol_Twitch_02'],
  'look.around': 'AI_Rifleman_Trooper_Investigate_InspX_03_look_around',
  'look.ground': 'AI_Rifleman_Trooper_Investigate_InspX_01_look_at_ground',
  // a greeting: the game has one, the hero's emote on the shared rig
  wave: 'E_Luke_04_Greetings',
};

// a blaster hero's own: the game gives them abilities and a defeat, and
// they walk on the humanoid set
const gunHero = (prefix) => {
  const h = HERO_SET(prefix);
  return { die: h.die, 'die.fwd': h['die.fwd'], 'dodge.left': h['dodge.left'], 'dodge.right': h['dodge.right'] };
};

export const candidates = (map, name) => [].concat(map[name] ?? []);

export function resolveGame(map, name, has) {
  for (const n of [name, CLIP_FALLBACK[name]].filter(Boolean)) {
    const hit = candidates(map, n).find(has);
    if (hit) return hit;
  }
  return null;
}

// The own rigs' sets, from the game's clips on each (web/anims.jsonl). The
// end-of-round victories and most P_ aims are one-frame poses in the drop,
// so they are not used; a site name the rig has nothing for falls back as
// walrusRig.js's CLIP_FALLBACK says, else the figure keeps its idle.
const DROID = (r, { dodges = true } = {}) => ({
  walk: `C_${r}_Rifle_Walk_Fwd_01`,
  run: `C_${r}_Rifle_Run_Fwd_01`,
  sprint: `C_${r}_Rifle_Sprint_Fwd_01`,
  'walk.back': `C_${r}_Rifle_Walk_Bwd_01`,
  'walk.left': `C_${r}_Rifle_Walk_Left1_01`,
  'walk.right': `C_${r}_Rifle_Walk_Right1_01`,
  'turn.left': [`L_${r}_Rifle_Stand_TurnLeftSlow90_01`, `L_${r}_Rifle_Stand_TurnLeftSlow90_01_v01`],
  'turn.right': [`L_${r}_Rifle_Stand_TurnRightSlow90_01`, `L_${r}_Rifle_Stand_TurnRightSlow90_01_v01`],
  'crouch.run': `C_${r}_Rifle_Crouch_Run_Fwd_01`,
  die: `A_${r}_Death_Stand_Front_Melee_01`,
  'die.fwd': `A_${r}_Death_Stand_Front_Melee_01`,
  'die.back': `A_${r}_Death_Stand_Back_Melee_01`,
  'die.blown': `A_${r}_Death_Stand_Back_Explosion_01`,
  // (the B2's: the B1 has no dodge and no rifle butt in the drop)
  ...(dodges
    ? {
        'dodge.back': `A_${r}_Dodge_Back_01`,
        'dodge.front': `A_${r}_Dodge_Front_01`,
        'dodge.left': `A_${r}_Dodge_Left_01`,
        'dodge.right': `A_${r}_Dodge_Right_01`,
        'melee.rifle': `A_${r}_Melee_FirstStrike_01`,
      }
    : {}),
});
export const OWN_RIGS = {
  b1: {
    skeleton: 'D_Assault_Preq_01_Ske',
    body: 'battledroid',
    set: {
      ...DROID('B1', { dodges: false }),
      idle: ['L_B1_3p1pLoco_StandIdleLoop_01', 'CIN_B1_StandIdle_01'],
      'idle.patrol': 'MTT_B1_Deploy_Stand_Idle_01',
      'aim.rifle': 'C_B1_Combat_Stand_WalkAim_Fwd',
      'hit.chest': 'A_B1_Stagger_Bwd_01',
      'hit.head': 'A_B1_Stagger_Bwd_02',
      'hit.back': 'A_B1_Stagger_Fwd_01',
      stagger: 'A_B1_Stagger_Bwd_01',
      talk: 'LW_B1_1_TalkToSpyLoop_01',
    },
  },
  b2: {
    skeleton: 'B2_01_Ske',
    body: 'superdroid',
    set: {
      ...DROID('B2'),
      // (the drop's B2 stand idle is empty: the menu's idle stands in)
      idle: 'UI_FrontEnd_B2_Hands_MainMenu_01',
      'hit.chest': 'A_B2_Stagger_Front_01',
      'hit.head': 'A_B2_Stagger_Front_02',
      'hit.back': 'A_B2_Stagger_Back_01',
      stagger: 'A_B2_Stagger_Front_01',
      deploy: 'A_B2_Rifle_Stand_Deploy_01',
    },
  },
  ewok: {
    skeleton: 'Ewok_01_Ske',
    body: 'ewok',
    set: {
      idle: ['L_Ewok_Stand_Idle_01', 'L_Ewok_Stand_Idle_02'],
      'idle.look': 'L_Ewok_Stand_Idle_03',
      walk: 'C_Ewok_Stand_Walk_Fwd_01',
      run: ['C_Ewok_Stand_Run_Fwd_01', 'C_Ewok_Run_Fwd_01'],
      sprint: 'C_Ewok_Stand_Sprint_Fwd_01',
      'walk.back': 'C_Ewok_Walk_Bwd_01',
      'walk.left': 'C_Ewok_Walk_Left1_01',
      'walk.right': 'C_Ewok_Walk_Right1_01',
      crouch: 'L_Ewok_Crouch_01',
      jump: 'A_Ewok_Jump_Stand_01',
      'hit.chest': 'A_Ewok_Stagger_Bwd_01',
      'hit.back': 'A_Ewok_Stagger_Fwd_01',
      'dodge.back': 'A_Ewok_Dodge_Back_01',
      'dodge.front': 'A_Ewok_Dodge_Front_01',
      'dodge.left': 'A_Ewok_Dodge_Left_01',
      'dodge.right': 'A_Ewok_Dodge_Right_01',
      die: 'A_Ewok_Stand_Death_Front_01',
      'die.fwd': 'A_Ewok_Stand_Death_Front_01',
      'die.back': 'A_Ewok_Stand_Death_Back_01',
      'melee.a': 'A_Ewok_SpearAttack_01',
      'melee.b': 'A_Ewok_SpearAttack_02',
      cheer: 'E_Ewok_The_Ewok_Victory_01',
      taunt: 'E_Ewok_The_Taunt_01',
      horn: 'A_Ewok_BlowHorn_01',
      throw: 'A_Ewok_Throw_02',
    },
  },
  astromech: {
    skeleton: 'Astromech_01_Ske',
    body: 'astromech',
    set: {
      idle: 'L_LW_Astromech_Stand_Idle_01_LW',
      walk: ['C_LW_Astromech_Stand_Walk_Fwd_01_LW', 'C_AstromechR2_Walk_Fwd_01'],
      run: 'C_LW_Astromech_Stand_Run_Fwd_01',
      'walk.left': 'C_LW_Astromech_Stand_Walk_Fwd_Left_01',
      'hit.chest': 'A_AstromechR2_ForcePushed_01',
      die: 'A_AstromechR2_Stand_Death_01',
      'die.fwd': 'A_AstromechR2_Stand_Death_01',
      'die.back': 'A_AstromechR2_Stand_Death_01',
    },
  },
  probe: {
    skeleton: 'Viper_01_Ske',
    body: 'probe',
    set: {
      idle: ['C_ViperDroid_Stand_Idle_01', 'C_ViperDroid_Stand_Idle_02'],
      walk: 'C_ViperDroid_Stand_Walk_Fwd_01',
      run: 'C_ViperDroid_Stand_Run_Fwd_01',
      'walk.left': 'C_ViperDroid_Stand_Walk_Fwd_Left_01',
      'hit.chest': 'C_ViperDroid_Stand_Idle_Hit_01',
    },
  },
  tauntaun: {
    skeleton: 'Tauntaun_01_Ske',
    body: 'tauntaun',
    set: {
      idle: ['L_TaunTaun_Stand_Idle_01', 'L_TaunTaun_Stand_Idle_02', 'L_Tauntaun_idle_02'],
      'idle.look': ['L_TaunTaun_Stand_Idle_03', 'L_TaunTaun_Stand_Idle_04'],
      walk: 'C_Tauntaun_Walk_Fwd_01',
      run: 'C_Tauntaun_Run_Fwd_01',
      sprint: 'C_Tauntaun_Sprint_Fwd_01',
      jump: 'A_Tauntaun_Jump_Run_Fwd_01',
      'hit.chest': 'A_TaunTaun_Stand_Idle_Hit_02',
      die: 'A_Tauntaun_Death_Stand_02',
      'die.fwd': 'A_Tauntaun_Death_Stand_02',
      'die.back': 'A_Tauntaun_Death_Stand_03',
      'melee.a': 'A_Tauntaun_Attack_HeadButt_02',
    },
  },
};
// (and the galaxy's small creatures, droids and aliens: walrusSets/fauna.js)
for (const [rig, row] of Object.entries(FAUNA)) OWN_RIGS[rig] = { skeleton: row.skeleton, body: row.body, set: row.set };
export const RIG_SET = (rig) => OWN_RIGS[rig]?.set ?? null;

export const PACKS = {
  ...Object.fromEntries(Object.entries(OWN_RIGS).map(([rig, r]) => [rig, r.set])),
  humanoid: HUMANOID_SET,
  luke: HERO_SET('Luke'),
  vader: HERO_SET('Vader'),
  obiwan: HERO_SET('ObiWan'),
  anakin: HERO_SET('Anakin'),
  maul: HERO_SET('Maul'),
  dooku: HERO_SET('Dooku'),
  palpatine: HERO_SET('Palpatine'),
  chewie: { ...gunHero('Chewbacca'), 'melee.a': 'A_Chewbacca_Melee_FirstStrike_01', 'melee.b': 'A_Chewbacca_Melee_SecondStrike_01', 'force.slam': 'A_Chewbacca_LeapSlam_Exit_01' },
  bobafett: gunHero(['Boba', 'Bobafett']),
  bossk: { ...gunHero('Bossk'), 'melee.a': 'A_Bossk_Melee_01' },
  han: gunHero(['HanSolo', 'Han']),
  leia: gunHero('Leia'),
  lando: gunHero('Lando'),
  ...Object.fromEntries(Object.entries(SET_PACKS).map(([k, p]) => [k, p.set])),
};

// how a pack is taken from the drop: { additive?, skeletons? } (walrusSets/index.js)
export const PACK_OPTS = Object.fromEntries(Object.entries(SET_PACKS).map(([k, p]) => [k, p.opts ?? {}]));
