// The animation graph's data (src/data/bf2017/animgraph.json): which of the
// game's clips (web/anims.jsonl) each state of a soldier's animation state
// machine plays, per skeleton and per weapon stance, how fast each
// locomotion clip travels (its own AITrajectory, measured by the CLI), where
// a jump clip leaves the ground and lands (its own Hips curve), the numbers
// the machine runs on (the soldier's character physics, the weapons' fire
// and heat, the abilities' times) and the crossfades. The game's own
// animation graphs (its ANT state trees) are not in the export, so the graph
// is authored from the clip names, which follow the game's grammar: a kind
// letter (A an action, C a cycle, L a loop, P a pose, T a transition, Add_
// an additive), the rig (HM the humanoid, B1, B2), the weapon family (Rifle,
// Pistol, Lmg) and the move. Pure: the CLI (scripts/bf2017-animgraph.mjs)
// reads the files and passes in the manifest, the measures and the records.
//
//   STANCES                 { t: 'Rifle', p: 'Pistol', l: 'Lmg' } (walrusSets/stance.js's keys)
//   RIGS                    { rig: { skeletons: RegExp, prefix, stances, packs } }
//   SLOTS                   { slot: { kind, names: [spelling…] | { t, p, l } } }:
//                           a state's clip, its spellings best first (<R> the rig's
//                           prefix, <W> the stance's family)
//   spellings(slot, rig, stance) → [gameName…]
//   pick(anims, slot, rig, stance) → the manifest entry it takes, or null
//   carriersOf(packs, anims) → Map(gameName → [siteName…]): the names the
//                           published packs already carry each game clip under
//   buildGraph({ anims, measure, records, carriers, date }) → the graph
//   graphPacks(graph) → { graph: { siteName: gameName }, 'graph-add': {…} }:
//                           the clips no published pack carries, for bf2017-clips.mjs

import { isSequel } from './bf2017-manifest.mjs';

export const STANCES = { t: 'Rifle', p: 'Pistol', l: 'Lmg' };

export const RIGS = {
  // (the cinematics' skeleton is the humanoid's at the same rest: bf2017-clips.mjs's SKELETONS)
  humanoid: { skeletons: /\/(Walrus_HumanMale|Walrus_NIS_S0800_Skeleton)$/, prefix: 'HM', stances: ['t', 'p', 'l'], packs: ['humanoid', 'npc', 'stance-t', 'stance-p', 'stance-l', 'additive'] },
  b1: { skeletons: /\/D_Assault_Preq_01_Ske$/, prefix: 'B1', stances: ['t'], packs: ['b1'] },
  b2: { skeletons: /\/B2_01_Ske$/, prefix: 'B2', stances: ['t'], packs: ['b2'] },
};

// kind: 'cycle' a locomotion loop (measured, phase-synced), 'loop' a held
// loop, 'once' a one-shot, 'pose' a held pose, 'add' an additive one-shot,
// 'addLoop' an additive loop. `names` either one list for every stance or
// one per stance.
const W = (...xs) => xs;
export const SLOTS = {
  // ── locomotion: stand ──
  'stand.idle': {
    kind: 'loop',
    names: {
      t: W('L_<R>_Stand_Combat_IdleLoop', 'L_<R>_3p1pLoco_StandIdleLoop_01', 'P_<R>_Rifle_StandIdle_01'),
      p: W('L_<R>_Pistol_DeployScreen_Idle_01', 'P_<R>_Pistol_StandIdle_01', 'P_<R>_Rifle_StandIdle_01'),
      l: W('P_<R>_Lmg_StandIdle_01', 'L_<R>_LMG_CollectScreen_Idle_03', 'P_<R>_Rifle_StandIdle_01'),
    },
  },
  'stand.idle.add': { kind: 'addLoop', names: { t: W('Add_<R>_Rifle_StandIdleLoop_01'), p: W('ADD_<R>_Pistol_StandIdleLoop_01', 'Add_<R>_Rifle_StandIdleLoop_01'), l: W('Add_<R>_Rifle_StandIdleLoop_01') } },
  'stand.walk.fwd': { kind: 'cycle', names: W('C_<R>_<W>_Walk_Fwd_01', 'C_<R>_<W>_Walk_Fwd', 'C_<R>_Rifle_Walk_Fwd_01') },
  'stand.walk.back': { kind: 'cycle', names: W('C_<R>_<W>_Walk_Bwd_01', 'C_<R>_<W>_Walk_Bwd', 'C_<R>_Rifle_Walk_Bwd_01') },
  'stand.walk.left': { kind: 'cycle', names: W('C_<R>_<W>_Walk_Left1_01', 'C_<R>_<W>_Walk_Left1', 'C_<R>_Rifle_Walk_Left1_01') },
  'stand.walk.right': { kind: 'cycle', names: W('C_<R>_<W>_Walk_Right1_01', 'C_<R>_<W>_Walk_Right1', 'C_<R>_<W>_Walk_Right2', 'C_<R>_Rifle_Walk_Right1_01') },
  'stand.run.fwd': { kind: 'cycle', names: W('C_<R>_<W>_Run_Fwd_01', 'C_<R>_<W>_Run_Fwd', 'C_<R>_Rifle_Run_Fwd_01') },
  'stand.run.back': { kind: 'cycle', names: W('C_<R>_<W>_Run_Bwd_01', 'C_<R>_<W>_Run_Bwd', 'C_<R>_Rifle_Run_Bwd_01') },
  'stand.run.left': { kind: 'cycle', names: W('C_<R>_<W>_Run_Left1_01', 'C_<R>_<W>_Run_Left1', 'C_<R>_Rifle_Run_Left1_01') },
  'stand.run.right': { kind: 'cycle', names: W('C_<R>_<W>_Run_Right1_01', 'C_<R>_<W>_Run_Right1', 'C_<R>_Rifle_Run_Right1_01') },
  'stand.sprint.fwd': { kind: 'cycle', names: W('C_<R>_<W>_Sprint_Fwd_01', 'C_<R>_<W>_Sprint_Fwd', 'C_<R>_Rifle_Sprint_Fwd_01') },
  'stand.turn.left': { kind: 'loop', names: W('L_<R>_<W>_Stand_TurnLeftSlow90_01', 'L_<R>_Rifle_Stand_TurnLeftSlow90_01', 'L_<R>_<W>_Stand_TurnLeftSlow90_01_v01') },
  'stand.turn.right': { kind: 'loop', names: W('L_<R>_<W>_Stand_TurnRightSlow90_01', 'L_<R>_Rifle_Stand_TurnRightSlow90_01', 'L_<R>_<W>_Stand_TurnRightSlow90_01_v01') },
  'stand.stop': { kind: 'once', names: W('T_<R>_<W>_RunToStand_Fwd_01', 'A_<R>_<W>_Run_FwdToStand_01', 'T_<R>_Rifle_RunToStand_Fwd_01') },
  // ── locomotion: crouch ──
  'crouch.idle': { kind: 'loop', names: W('C_<R>_<W>_Crouch_ZeroSpeed_01', 'C_<R>_Rifle_Crouch_ZeroSpeed_01', 'P_<R>_<W>_CrouchIdle_01', 'P_<R>_Rifle_CrouchIdle_01') },
  'crouch.idle.add': { kind: 'addLoop', names: { t: W('Add_<R>_Rifle_CrouchIdleLoop_01'), p: W('Add_<R>_Pistol_CrouchIdle_01', 'Add_<R>_Rifle_CrouchIdleLoop_01'), l: W('Add_<R>_Rifle_CrouchIdleLoop_01') } },
  'crouch.run.fwd': { kind: 'cycle', names: W('C_<R>_<W>_Crouch_Run_Fwd_01', 'C_<R>_Rifle_Crouch_Run_Fwd_01') },
  'crouch.run.back': { kind: 'cycle', names: W('C_<R>_<W>_Crouch_Run_Bwd_01', 'C_<R>_Rifle_Crouch_Run_Bwd_01') },
  'crouch.run.left': { kind: 'cycle', names: W('C_<R>_<W>_Crouch_Run_Left1_01', 'C_<R>_Rifle_Crouch_Run_Left1_01') },
  'crouch.run.right': { kind: 'cycle', names: W('C_<R>_<W>_Crouch_Run_Right1_01', 'C_<R>_Rifle_Crouch_Run_Right1_01') },
  'crouch.stop': { kind: 'once', names: W('A_<R>_<W>_CrouchRun_to_CrouchIdle_01', 'A_<R>_<W>_CrouchRun_to_CrouchIdle', 'A_<R>_Rifle_CrouchRun_to_CrouchIdle') },
  // ── the air ──
  'air.jump': { kind: 'once', names: W('A_<R>_<W>_Jump_Stand_01', 'A_<R>_<W>_Stand_Jump', 'A_<R>_Rifle_Jump_Stand_01', 'Rifle_JumpStill') },
  'air.jump.run': { kind: 'once', names: W('A_<R>_<W>_Jump_Fwd_Run_LeftFoot_01', 'A_<R>_Rifle_Jump_Fwd_Run_LeftFoot_01', 'Rifle_Run_JumpFwd') },
  'air.jump.sprint': { kind: 'once', names: W('A_<R>_<W>_Jump_Fwd_Sprint_LeftFoot_01', 'A_<R>_Rifle_Jump_Fwd_Sprint_LeftFoot_01') },
  'air.fall': { kind: 'loop', names: W('L_<R>_<W>_Falling_01', 'L_<R>_Rifle_Falling_01', 'L_<R>_<W>_Falling_Low_01', 'L_<R>_Rifle_Falling_Low_01') },
  'air.land.hard': { kind: 'once', names: W('A_<R>_<W>_DropFromHeightLand_01', '<W>_DropFromHeightLand', 'Rifle_DropFromHeightLand') },
  'air.land.light': { kind: 'add', names: W('Add_<R>_<W>_JumpLand_Stand_Light_01', 'Add_<R>_Rifle_JumpLand_Stand_Light_01') },
  'air.land.heavy': { kind: 'add', names: W('Add_<R>_<W>_JumpLand_Stand_Heavy_01', 'Add_<R>_Rifle_JumpLand_Stand_Heavy_01') },
  'air.land.run': { kind: 'add', names: W('ADD_<R>_<W>_Land_Run_Fwd', '<R>_JumpLandFwd', 'JumpLandFwd') },
  // ── the upper body: the gun ──
  'upper.fire': { kind: 'add', names: { t: W('Add_<R>_Rifle_StandFire'), p: W('A_<R>_Pistol_Stand_Fire', 'Add_<R>_Rifle_StandFire'), l: W('Add_<R>_Rifle_Stand_HeavyFire01', 'Add_<R>_Rifle_StandFire') } },
  'upper.fire.crouch': { kind: 'add', names: { t: W('Add_<R>_Rifle_CrouchFire'), p: W('A_<R>_Pistol_Stand_Fire', 'Add_<R>_Rifle_CrouchFire'), l: W('Add_<R>_Rifle_Crouch_HeavyFire01', 'Add_<R>_Rifle_CrouchFire') } },
  'upper.overheat.enter': { kind: 'once', names: W('A_<R>_<W>_Overheat_Enter', 'A_<R>_Rifle_Overheat_Enter') },
  'upper.overheat.loop': { kind: 'loop', names: W('A_<R>_<W>_Overheat_Loop', 'A_<R>_Rifle_Overheat_Loop') },
  'upper.overheat.exit': { kind: 'once', names: W('A_<R>_<W>_Overheat_Exit', 'A_<R>_Rifle_Overheat_Exit') },
  'upper.cool.fail': { kind: 'once', names: W('A_<R>_<W>_Overheat_AC_Fail', 'A_<R>_Rifle_Overheat_AC_Fail') },
  'upper.venting': { kind: 'add', names: W('A_<R>_<W>_Stand_Venting', 'A_<R>_Rifle_Stand_Venting') },
  'upper.raise': { kind: 'once', names: W('A_<R>_<W>_Stand_Deploy_01', 'A_<R>_Rifle_Stand_Deploy_01') },
  // ── one-shots ──
  'once.spawn': { kind: 'once', names: W('A_<R>_<W>_Stand_SpawnIn_01', 'A_<R>_Rifle_Stand_SpawnIn_01') },
  'once.melee.a': { kind: 'once', names: W('A_<R>_<W>_Melee_FirstStrike_01', 'A_<R>_Rifle_Melee_FirstStrike_01') },
  'once.melee.b': { kind: 'once', names: W('A_<R>_<W>_Melee_SecondStrike_01', 'A_<R>_Rifle_Melee_SecondStrike_01') },
  'once.grenade': { kind: 'once', names: W('A_<R>_<W>_QuickThrow_Stand_HG', 'A_<R>_Rifle_QuickThrow_Stand_HG', 'A_<R>_Stand_ThrowHG_Fwd') },
  'once.grenade.crouch': { kind: 'once', names: W('A_<R>_<W>_QuickThrow_Crouch_HG', 'A_<R>_Rifle_QuickThrow_Crouch_HG', 'A_<R>_Crouch_ThrowHG_Fwd') },
  'once.shield': { kind: 'once', names: W('A_<R>_LMG_Stand_Shield_Deploy', 'A_<R>_Lmg_Stand_Shield_Deploy') },
  'once.dodge.front': { kind: 'once', names: W('A_<R>_<W>_Dodge_Front_01', 'A_<R>_Rifle_Dodge_Front_01') },
  'once.dodge.back': { kind: 'once', names: W('A_<R>_<W>_Dodge_Back_01', 'A_<R>_Rifle_Dodge_Back_01') },
  'once.dodge.left': { kind: 'once', names: W('A_<R>_<W>_Dodge_Left_01', 'A_<R>_Rifle_Dodge_Left_01') },
  'once.dodge.right': { kind: 'once', names: W('A_<R>_<W>_Dodge_Right_01', 'A_<R>_Rifle_Dodge_Right_01') },
  // (a hit from the front throws the body back: the Bwd stagger)
  'once.stagger.front': { kind: 'once', names: W('A_<R>_<W>_Stagger_Bwd_01', 'A_<R>_Rifle_Stagger_Bwd_01', 'A_<R>_Stagger_Front_01') },
  'once.stagger.back': { kind: 'once', names: W('A_<R>_<W>_Stagger_Fwd_01', 'A_<R>_<W>_Stagger_Fwd_02', 'A_<R>_Rifle_Stagger_Fwd_01', 'A_<R>_Stagger_Back_01') },
  'once.sprintHit.back': { kind: 'once', names: W('A_<R>_Pistol_Sprint_HitReact_Back_01', 'Rifle_Sprint_HitReact_Back1') },
  'once.sprintHit.front': { kind: 'once', names: W('A_<R>_Pistol_Sprint_HitReact_Front_01') },
  'once.sprintHit.left': { kind: 'once', names: W('A_<R>_Pistol_Sprint_HitReact_Left_01') },
  'once.sprintHit.right': { kind: 'once', names: W('A_<R>_Pistol_Sprint_HitReact_Right_01') },
  // ── hits laid over whatever plays ──
  'add.hit.front': { kind: 'add', names: { t: W('Rifle_Stand_HitReact_Front1', 'Add_<R>_Rifle_Stand_Hitreact_Front_04'), p: W('Add_<R>_Pistol_Stand_HitReact_Fwd_01', 'Rifle_Stand_HitReact_Front1'), l: W('Rifle_Stand_HitReact_Front1') } },
  'add.hit.back': { kind: 'add', names: { t: W('Rifle_Stand_HitReact_Back1', 'Add_<R>_Rifle_Stand_Hitreact_Back_04'), p: W('Add_<R>_Pistol_Stand_HitReact_Bwd_01', 'Rifle_Stand_HitReact_Back1'), l: W('Rifle_Stand_HitReact_Back1') } },
  'add.hit.left': { kind: 'add', names: { t: W('Rifle_Stand_HitReact_Left1', 'Add_<R>_Rifle_Stand_Hitreact_Left_04'), p: W('Add_<R>_Pistol_Stand_HitReact_Left_01', 'Rifle_Stand_HitReact_Left1'), l: W('Rifle_Stand_HitReact_Left1') } },
  'add.hit.right': { kind: 'add', names: { t: W('Rifle_Stand_HitReact_Right1', 'Add_<R>_Rifle_Stand_Hitreact_Right_04'), p: W('Add_<R>_Pistol_Stand_HitReact_Right_01', 'Rifle_Stand_HitReact_Right1'), l: W('Rifle_Stand_HitReact_Right1') } },
  'add.hit.crouch': { kind: 'add', names: W('Rifle_CrouchHitReactionFront2') },
  // ── deaths (the ragdoll takes the body after the lead) ──
  'death.front': { kind: 'once', names: W('A_<R>_Death_Stand_Front_Upperbody_BlasterFire_01', 'A_<R>_Death_Stand_Front_Melee_02', 'A_<R>_Death_Stand_Front_Melee_01', 'A_<R>_Death_Stand_Front_01') },
  'death.back': { kind: 'once', names: W('A_<R>_Death_Stand_Back_Upperbody_BlasterFire_01', 'A_<R>_Death_Stand_Back_Melee_02', 'A_<R>_Death_Stand_Back_Melee_01', 'A_<R>_Death_Stand_Back_01') },
  'death.left': { kind: 'once', names: W('A_<R>_Death_Stand_Left_Upperbody_BlasterFire_01', 'A_<R>_Death_Stand_Left_Melee_01') },
  'death.right': { kind: 'once', names: W('A_<R>_Death_Stand_Right_Upperbody_BlasterFire_01', 'A_<R>_Death_Stand_Right_Melee_02', 'A_<R>_Death_Stand_Right_Melee_01') },
  'death.run.fwd': { kind: 'once', names: W('A_<R>_Death_Stand_Run_Fwd_01') },
  'death.run.left': { kind: 'once', names: W('A_<R>_Death_Stand_Run_Left_01') },
  'death.run.right': { kind: 'once', names: W('A_<R>_Death_Stand_Run_Right_01') },
  'death.blast.front': { kind: 'once', names: W('A_<R>_Death_Stand_Front_Explosion_01') },
  'death.blast.back': { kind: 'once', names: W('A_<R>_Death_Stand_Back_Explosion_01') },
  'death.blast.left': { kind: 'once', names: W('A_<R>_Death_Stand_Left_Explosion_01') },
  'death.blast.right': { kind: 'once', names: W('A_<R>_Death_Stand_Right_Explosion_01') },
};

// the aims the upper body lays by pitch and yaw: the published additive
// pack's (walrusSets/additive.js), its stance's own where it has them
export const AIMS = { t: '', p: 'p.', l: 'l.' };

const ADDITIVE = new Set(['add', 'addLoop']);

export function spellings(slot, rig, stance) {
  const s = SLOTS[slot];
  if (!s) return [];
  const list = Array.isArray(s.names) ? s.names : (s.names[stance] ?? s.names.t ?? []);
  const pre = RIGS[rig]?.prefix ?? 'HM';
  const fam = STANCES[stance] ?? 'Rifle';
  return [...new Set(list.map((n) => n.replaceAll('<R>', pre).replaceAll('<W>', fam)))];
}

// a clip by name, exactly, else ignoring case (the drop spells LMG and Lmg both)
function entryOf(anims, name) {
  const hit = anims.get(name);
  if (hit) return hit;
  const low = name.toLowerCase();
  for (const [n, e] of anims) if (n.toLowerCase() === low) return e;
  return null;
}

export function pick(anims, slot, rig, stance) {
  const additive = ADDITIVE.has(SLOTS[slot]?.kind);
  for (const n of spellings(slot, rig, stance)) {
    const e = entryOf(anims, n);
    if (!e || isSequel(e.name)) continue;
    if (!RIGS[rig].skeletons.test(e.skeleton ?? '')) continue;
    if (Boolean(e.additive) !== additive) continue;
    // (a one-frame pose is a held pose only where the slot wants one)
    if (!(e.frames > 1) && SLOTS[slot].kind !== 'loop' && SLOTS[slot].kind !== 'pose') continue;
    return e;
  }
  return null;
}

// Which site names the published packs already carry a game clip under:
// each pack's site name takes the first spelling the drop has on the pack's
// skeleton (bf2017-clips.mjs's makePack does the same), so a graph state
// that wants that clip plays it from the pack the figure has already
// loaded. packs: { pack: { set: { site: game | [game…] }, skeletons: RegExp, additive } }
export function carriersOf(packs, anims) {
  const out = new Map();
  for (const [, p] of Object.entries(packs)) {
    for (const [site, spell] of Object.entries(p.set)) {
      for (const g of [].concat(spell)) {
        const e = entryOf(anims, g);
        if (!e || !p.skeletons.test(e.skeleton ?? '') || Boolean(e.additive) !== Boolean(p.additive)) continue;
        if (!out.has(e.name)) out.set(e.name, []);
        out.get(e.name).push(site);
        break;
      }
    }
  }
  return out;
}

// the graph pack a clip no published pack carries goes in: the additive
// ones together, every stance's deaths, sprint hits and the shield together
// (graph, loaded with the body), the rest by stance (graph-t, -p, -l, loaded
// with the stance as walrusSets/stance.js's are), so a figure fetches its
// own weapon's clips only
const SHARED = /^(death\.|once\.sprintHit\.|once\.shield)/;
export const packOf = (slot, stance, additive) => (additive ? 'graph-add' : SHARED.test(slot) ? 'graph' : `graph-${stance}`);
export const GRAPH_PACKS = ['graph', 'graph-t', 'graph-p', 'graph-l', 'graph-add'];

// the name a clip no published pack carries plays under: the graph's packs'
// (an additive one's under add., which lib/three/additiveLayer.js lays)
export const graphName = (game, additive) => `${additive ? 'add.' : ''}g.${game}`;

const round = (x, n = 3) => (Number.isFinite(x) ? +x.toFixed(n) : null);

// whether a slot's clip is measured (its travel, or its take-off and landing)
export const needsMeasure = (slot) => SLOTS[slot]?.kind === 'cycle' || slot.startsWith('air.jump');

// A jump clip's take-off and landing from its own Hips height (the clips
// jump in place: the height is the physics', the clip the body's crouch,
// push, tuck and the landing's give): `absorb` the deepest dip in the clip's
// later part (the landing taken in the knees), `land` the highest the hips
// are in the 0.4 s before it (the legs reaching for the ground: touch-down),
// `settle` the first time after the dip the hips are back within 3 cm of
// where the clip ends. rows: [[t, y]…]
export function jumpMarkers(rows) {
  if (!rows?.length) return null;
  const end = rows[rows.length - 1][0];
  const late = rows.filter(([t]) => t >= 0.45 * end);
  if (!late.length) return null;
  const absorb = late.reduce((a, b) => (b[1] < a[1] ? b : a));
  const before = rows.filter(([t]) => t >= absorb[0] - 0.4 && t <= absorb[0]);
  const land = before.reduce((a, b) => (b[1] > a[1] ? b : a));
  const yEnd = rows[rows.length - 1][1];
  const settle = rows.find(([t, y]) => t > absorb[0] && Math.abs(y - yEnd) < 0.03) ?? rows[rows.length - 1];
  return { land: round(land[0]), absorb: round(absorb[0]), settle: round(settle[0]) };
}

// A cycle's travel from its trajectory's first and last places: m/s, and
// the way it goes against the figure's facing (radians, 0 ahead, + to the
// figure's left: the game's +x). rows: [[t, x, z]…]
export function travelOf(rows) {
  if (!rows || rows.length < 2) return null;
  const [t0, x0, z0] = rows[0];
  const [t1, x1, z1] = rows[rows.length - 1];
  const d = Math.hypot(x1 - x0, z1 - z0);
  if (!(t1 > t0) || d < 0.05) return { speed: 0, heading: 0 };
  return { speed: d / (t1 - t0), heading: Math.atan2(x1 - x0, z1 - z0) };
}

// one state's clip as the graph lists it: the game's name, what a figure
// plays it as (the published packs' names first, then the graph pack's),
// its length, and for a cycle its travel (m/s, and the way, radians, +
// to the figure's left), for a jump where it leaves the ground and lands
function clipRow(e, slot, carriers, measure) {
  const additive = Boolean(e.additive);
  const own = (carriers.get(e.name) ?? []).filter((n) => additive === n.startsWith('add.'));
  const row = { game: e.name, play: [...own, graphName(e.name, additive)], duration: round(e.duration), kind: SLOTS[slot].kind };
  const m = needsMeasure(slot) ? (measure?.(e) ?? null) : null;
  if (SLOTS[slot].kind === 'cycle' && m?.speed != null) {
    row.speed = round(m.speed);
    row.heading = round(m.heading);
  }
  if (slot.startsWith('air.jump') && m?.markers) row.markers = m.markers;
  return row;
}

// the hero abilities' clips: the hero packs' own names (walrusClips.js's
// HERO_SET), by what the ability does (hand: the records name the ability's
// asset, not its animation; CLIPS_OF in surface/abilityRules.js reads them
// the same way)
export const HERO_ABILITY_CLIPS = [
  [/ForcePush|AllOutPush/i, ['force.push']],
  [/ForceRepulse|HeroicImpact|LandingStrike/i, ['force.slam', 'sword.pound']],
  [/PullDominance|ForcePull/i, ['force.pull', 'force.push']],
  [/ForceChoke/i, ['force.choke']],
  [/FocusRage|Rage/i, ['force.rage']],
  [/SaberThrow/i, ['saber.throw']],
  [/ChainLightning/i, ['force.chain', 'force.electrocute']],
  [/Electrocute/i, ['force.electrocute', 'force.lightning']],
  [/LightningStun|Lightning/i, ['force.lightning', 'force.electrocute']],
  [/ExposeWeakness/i, ['force.weaken']],
  [/Dash|Rush|SpinAttack|ImpassionateStrike|ThrustSurge|ClawRush/i, ['force.rush', 'sword.dash']],
];
// the soldiers' class abilities by what the body does (hand, as above)
export const ABILITY_KINDS = [
  [/Grenade|ThermalDetonator|Detonator|Imploder|Dioxis/i, 'grenade'],
  [/CombatShield|BubbleShield|Fortify|Droid_Shield/i, 'shield'],
  [/Vanguard|Sharpshoot|SharpShot|Bowcaster|ScanDart|Ping|Pulse_Cannon|RocketLauncher|Rocket/i, 'fire'],
  [/Sentry|BlasterTurret|ExplosiveTraps|Disruptor/i, 'raise'],
];
const HERO_OF = { Luke: 'luke', Vader: 'vader', DarthVader: 'vader', ObiWan: 'obiwan', Anakin: 'anakin', Maul: 'maul', DarthMaul: 'maul', Dooku: 'dooku', Emperor: 'palpatine', Palpatine: 'palpatine', Chewbacca: 'chewie', BobaFett: 'bobafett', Bossk: 'bossk', HanSolo: 'han', Leia: 'leia', Lando: 'lando' };
export function heroOfAbility(id) {
  const m = /^(?:Default)?Ability_([A-Za-z]+?)_/.exec(id);
  return m ? (HERO_OF[m[1]] ?? null) : null;
}

export function abilityRow(id, row, heroSets) {
  const out = { id, activation: row?.activation ?? null, active: row?.active ?? null, slot: row?.slot ?? null };
  const hero = heroOfAbility(id);
  const forces = HERO_ABILITY_CLIPS.find(([re]) => re.test(id))?.[1] ?? null;
  if (hero && forces && heroSets[hero]) {
    const has = forces.filter((n) => heroSets[hero][n]);
    if (has.length) return { ...out, kind: 'hero', hero, play: has };
  }
  const kind = ABILITY_KINDS.find(([re]) => re.test(id))?.[1] ?? null;
  return kind ? { ...out, kind } : { ...out, kind: null };
}

// The graph. anims: Map(name → manifest entry); measure(entry) → { speed,
// heading, markers } | null; records: { physics (soldier.json's default
// row), weapons (weapons.json), abilities (abilities.json), heroSets
// ({ hero: HERO_SET }), stanceOf (weapon id → 't' | 'p' | 'l') };
// carriers: carriersOf's map
export function buildGraph({ anims, measure = null, records, carriers = new Map(), date = null }) {
  const phys = records.physics;
  const stand = phys.states.onGround.poses.stand;
  const crouch = phys.states.onGround.poses.crouch;
  const src = (field) => `Gameplay/Characters/DefaultSoldierPhysics#${field}`;
  const numbers = {
    walk: stand.velocity,
    walk_source: src('OnGroundStateData.PoseInfo[Stand].Velocity'),
    sprint: stand.sprintMultiplier,
    sprint_source: src('OnGroundStateData.PoseInfo[Stand].SprintMultiplier'),
    crouch: crouch.velocity,
    crouch_source: src('OnGroundStateData.PoseInfo[Crouch].Velocity'),
    back: stand.back,
    back_source: src('OnGroundStateData.PoseInfo[Stand].VelocityBackward'),
    side: stand.left,
    side_source: src('OnGroundStateData.PoseInfo[Stand].VelocityLeft'),
    jumpHeight: phys.states.jump.jumpHeight,
    jumpHeight_source: src('JumpStateData.JumpHeight'),
    radius: phys.radius,
    radius_source: src('CharacterPhysicsData.PhysicalRadius'),
    height: phys.poses.stand.height,
    height_source: src('CharacterPoseData[Stand].Height'),
    crouchHeight: phys.poses.crouch.height,
    crouchHeight_source: src('CharacterPoseData[Crouch].Height'),
    step: phys.poses.stand.step,
    step_source: src('CharacterPoseData[Stand].StepHeight'),
    toCrouch: phys.poses.stand.transitions.crouch,
    toCrouch_source: src('CharacterPoseData[Stand].PoseTransitionTimes[Crouch]'),
    toStand: phys.poses.crouch.transitions.stand,
    toStand_source: src('CharacterPoseData[Crouch].PoseTransitionTimes[Stand]'),
    // (hand: Frostbite's world gravity; the soldier's records carry none)
    gravity: 9.81,
    gravity_source: 'hand',
    // (hand: figures/ragdolls.js's LEAD, the death clip's lead before the ragdoll)
    ragdollLead: 0.2,
    ragdollLead_source: 'hand',
  };
  // crossfades, s (hand, but the pose change's, which is the record's)
  const fade = { loco: 0.25, state: 0.15, onceIn: 0.1, onceOut: 0.2, upperIn: 0.12, upperOut: 0.2, crouch: numbers.toCrouch, stand: numbers.toStand, land: 0.15, death: 0.08, _source: 'hand, but crouch and stand: the pose transition times' };

  const skeletons = {};
  const packs = { graph: {}, 'graph-t': {}, 'graph-p': {}, 'graph-l': {}, 'graph-add': {} };
  const missing = [];
  for (const [rig, R] of Object.entries(RIGS)) {
    const stances = {};
    for (const st of R.stances) {
      const states = {};
      for (const slot of Object.keys(SLOTS)) {
        const e = pick(anims, slot, rig, st);
        if (!e) {
          missing.push(`${rig}.${st}.${slot}`);
          continue;
        }
        const row = clipRow(e, slot, carriers, measure);
        states[slot] = row;
        // (the humanoid's are packed; the droids' graphs list their own packs' names)
        if (rig === 'humanoid' && !(carriers.get(e.name) ?? []).some((n) => Boolean(e.additive) === n.startsWith('add.'))) packs[packOf(slot, st, e.additive)][graphName(e.name, e.additive)] = e.name;
      }
      stances[st] = { family: STANCES[st], aim: AIMS[st], states };
    }
    skeletons[rig] = { skeletons: R.skeletons.source, prefix: R.prefix, stances };
  }

  // the weapons: their stance, the time between shots, the heat's times
  const weapons = {};
  for (const [id, w] of Object.entries(records.weapons ?? {})) {
    const rof = w.firing?.rof ?? null;
    weapons[id] = {
      stance: records.stanceOf?.(id) ?? 't',
      interval: rof ? round(60 / rof, 4) : null,
      burst: w.firing?.burst ?? null,
      overheat: w.heat?.penalty ?? null,
      vent: w.heat?.cooling?.vent ?? null,
      raise: w.firing?.deploy ?? null,
      _source: `${w.blueprint ?? id}: WeaponFiringData.RateOfFire, OverheatConfig.OverHeatPenaltyTime, the active cooling's vent, WeaponFiringData.DeployTime`,
    };
  }
  const abilities = {};
  for (const [id, row] of Object.entries(records.abilities ?? {})) {
    const a = abilityRow(id, row, records.heroSets ?? {});
    if (a.kind) abilities[id] = a;
  }
  return {
    _from: `web/anims.jsonl (${anims.size} clips) by name, each locomotion clip's travel from its own AITrajectory and each jump's take-off and landing from its own Hips; the numbers from physics/soldier.json, weapons.json and abilities.json${date ? `; ${date}` : ''}`,
    _note: "The game's animation graphs (its ANT trees) are not in the export: the states, their blending and their triggers are authored here from the clips' names (src/data/bf2017/NOTES.md, 'The animation graph').",
    numbers,
    fade,
    skeletons,
    weapons,
    abilities,
    packs,
    missing,
  };
}

export const graphPacks = (graph) => graph.packs;
