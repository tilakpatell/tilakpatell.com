// A 2017 figure's stance by the weapon it holds: the game's humanoid moves
// one way with a pistol, another with a rifle, another with a heavy
// repeater, and the drop has each as its own family (`C_HM_Pistol_*`,
// `C_HM_Rifle_*`, `C_HM_Lmg_*` on the humanoid and the cinematics' skeleton,
// the same rig). (The game's one-letter prefixes are its clip kinds, not the
// weapons': A an action, C a cycle, L a loop, P a pose, T a transition.) A
// stance's clips are packed under `stance.<key>.<name>` (scripts/
// bf2017-clips.mjs stance-p, stance-t, stance-l) and laid over the figure's
// base names when it takes that weapon up (footScene's gameFigure, through
// animator.js's restance). Pure.
//
//   STANCE_KEYS                    ['p', 't', 'l']: the pistol, the two-handed rifle, the heavy (long) gun
//   STANCE_SET(key)                → { 'stance.<key>.<name>': gameName | [gameName…] }
//   weaponClassOf(gun)             → 'pistol' | 'rifle' | 'long' | 'heavy' | 'bowcaster' | null (gunplay.js's GUNS ids)
//   stanceFor(weaponClass)         → 'p' | 't' | 'l' | 'humanoid' (the humanoid set as it is)
//   stanceClips(clips, key)        → { baseName: clip } the stance's clips by the names they stand in for

export const STANCE_KEYS = ['p', 't', 'l'];
const FAMILY = { p: 'Pistol', t: 'Rifle', l: 'Lmg' };

// the base names a stance stands in for, each the game's spellings best first
// (<W> the family; the cinematics' skeleton spells a few without the _01)
const NAMES = {
  idle: { p: ['L_HM_Pistol_DeployScreen_Idle_01', 'P_HM_Pistol_StandIdle_01'], t: ['L_HM_Stand_Combat_IdleLoop', 'P_HM_Rifle_StandIdle_01'], l: ['P_HM_Lmg_StandIdle_01', 'L_HM_LMG_CollectScreen_Idle_03'] },
  aim: ['P_HM_<W>_StandIdle_01'],
  walk: ['C_HM_<W>_Walk_Fwd_01', 'C_HM_<W>_Walk_Fwd'],
  run: ['C_HM_<W>_Run_Fwd_01', 'C_HM_<W>_Run_Fwd'],
  sprint: ['C_HM_<W>_Sprint_Fwd_01', 'C_HM_<W>_Sprint_Fwd'],
  'walk.back': ['C_HM_<W>_Walk_Bwd_01', 'C_HM_<W>_Walk_Bwd'],
  'walk.left': ['C_HM_<W>_Walk_Left1_01', 'C_HM_<W>_Walk_Left1'],
  'walk.right': ['C_HM_<W>_Walk_Right1_01', 'C_HM_<W>_Walk_Right1'],
  'run.back': ['C_HM_<W>_Run_Bwd_01', 'C_HM_<W>_Run_Bwd'],
  'run.left': ['C_HM_<W>_Run_Left1_01', 'C_HM_<W>_Run_Left1'],
  'run.right': ['C_HM_<W>_Run_Right1_01', 'C_HM_<W>_Run_Right1'],
  'turn.left': ['L_HM_<W>_Stand_TurnLeftSlow90_01'],
  'turn.right': ['L_HM_<W>_Stand_TurnRightSlow90_01'],
  'turn.back': ['T_HM_<W>_Stand_Turn180Left'],
  crouch: ['P_HM_<W>_CrouchIdle_01', 'A_HM_<W>_Stand_to_Crouch_01', 'A_HM_<W>_Stand_To_Crouch'],
  'crouch.run': ['C_HM_<W>_Crouch_Run_Fwd_01', 'C_HM_DualPistol_Crouch_Run_Fwd_01'],
  stop: ['A_HM_<W>_Run_FwdToStand_01', 'A_HM_<W>_Run_FwdToStand', 'T_HM_<W>_RunToStand_Fwd_01'],
  // (the heavy's and the rifle's crouch run are one family in the drop: the heavy takes the rifle's)
};

export function STANCE_SET(key) {
  const w = FAMILY[key];
  if (!w) return {};
  const out = {};
  for (const [name, spell] of Object.entries(NAMES)) {
    const list = Array.isArray(spell) ? spell.map((s) => s.replaceAll('<W>', w)) : spell[key];
    // (the heavy's crouch run: the rifle's)
    if (key === 'l' && name === 'crouch.run') list.push('C_HM_Rifle_Crouch_Run_Fwd_01');
    out[`stance.${key}.${name}`] = list.length === 1 ? list[0] : list;
  }
  return out;
}

// the site's guns (universe/gunplay.js's GUNS) by the game's classes: a
// one-handed blaster a pistol, the bowcaster its own, the DLT-19 the heavy,
// the sniper's the long; the rest rifles; the saber and the cartoon guns none
const CLASS = {
  blaster: 'pistol',
  pistol: 'pistol',
  revolver: 'pistol',
  coppistol: 'pistol',
  westar: 'pistol',
  laser: 'pistol',
  portal: 'pistol',
  freeze: 'pistol',
  shrink: 'pistol',
  bowcaster: 'bowcaster',
  rifle: 'rifle',
  a280: 'rifle',
  e11: 'rifle',
  dc15: 'rifle',
  e5: 'rifle',
  ee3: 'rifle',
  shotgun: 'rifle',
  smg: 'rifle',
  sniper: 'long',
  dlt19: 'heavy',
};
export const weaponClassOf = (gun) => CLASS[gun] ?? null;

const STANCE = { pistol: 'p', rifle: 't', bowcaster: 't', long: 't', heavy: 'l' };
export const stanceFor = (weaponClass) => STANCE[weaponClass] ?? 'humanoid';

export function stanceClips(clips, key) {
  const pre = `stance.${key}.`;
  const out = {};
  for (const [name, clip] of clips instanceof Map ? clips : Object.entries(clips ?? {})) if (name.startsWith(pre)) out[name.slice(pre.length)] = clip;
  return out;
}
