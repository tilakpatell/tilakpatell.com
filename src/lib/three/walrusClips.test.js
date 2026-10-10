import { describe, expect, it } from 'vitest';
import { SEQUEL } from '../../../scripts/lib/bf2017-manifest.mjs';
import { HERO_SET, HUMANOID_SET, OWN_RIGS, PACKS, RIG_SET, candidates, resolveGame } from './walrusClips';

const shaped = (map) => {
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === 'string') continue;
    expect(Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string'), k).toBe(true);
  }
};

describe('the site’s clip names on the game’s', () => {
  it('maps a hero’s strokes, their returns and their block onto the game’s own', () => {
    expect(HERO_SET('Luke')['sword.light.a']).toBe('A_Luke_AttackLoop_Strike1');
    expect(HERO_SET('Luke')['sword.light.a.rec']).toEqual(['A_Luke_AttackLoop_Strike1_BackToIdle', 'A_Luke_AttackLoop_Strike1_BackToIdle_02']);
    expect(HERO_SET('Luke')['sword.heavy.a']).toBe('A_Luke_AttackLoop_Strike1_V2');
    expect(HERO_SET('Vader')['sword.block'][0]).toBe('A_Vader_Stand_Block_SwingRight_01');
    expect(HERO_SET('Luke').idle).toContain('L_Luke_Stand_Idle_01');
  });

  it('takes the first spelling the pack has, else the fallback’s, else nothing', () => {
    expect(resolveGame(HERO_SET('Luke'), 'sword.block', (n) => n === 'A_Luke_Block_Stagger_Fwd_02')).toBe('A_Luke_Block_Stagger_Fwd_02');
    expect(resolveGame(HERO_SET('Luke'), 'die.blown', (n) => n === 'A_Luke_Defeated_01')).toBe('A_Luke_Defeated_01');
    expect(resolveGame(HERO_SET('Vader'), 'hit.chest', (n) => n === 'A_Vader_Stagger_Bwd_01')).toBe('A_Vader_Stagger_Bwd_01');
    expect(resolveGame(HUMANOID_SET, 'nope', () => true)).toBe(null);
  });

  it('names the kits’ Force powers by the game’s clips, which the manifest has', () => {
    const want = {
      vader: { 'force.choke': 'A_Vader_ForceChoke_Enter_01', 'force.rage': 'A_Vader_RagePowerUp_01', 'saber.throw': 'A_Vader_Stand_ThrowSaber_FwdFacing_02' },
      maul: { 'force.choke': 'A_Maul_ChokeThrow_Start_01', 'force.rush': 'A_Maul_SpinLeap_01', 'saber.throw': 'A_Maul_SaberThrow_Stand_01' },
      palpatine: { 'force.lightning': 'A_Palpatine_Stand_Beam_Fwd_01', 'force.chain': 'A_Palpatine_Stand_ChainLightning_01' },
      dooku: { 'force.electrocute': 'A_Dooku_Stand_Electrocute_02', 'force.weaken': 'A_Dooku_Stand_ExposeWeakness_02' },
      anakin: { 'force.pull': 'A_Anakin_Ability2_PullMastery_Full', 'force.slam': 'A_Anakin_Ability3_LandingStrike_Land' },
      luke: { 'force.rush': 'A_Luke_Stand_RushAttack_01', 'force.slam': 'A_Luke_Stand_ForceRepulse_02' },
      chewie: { 'force.slam': 'A_Chewbacca_LeapSlam_Exit_01' },
    };
    for (const [pack, names] of Object.entries(want)) for (const [site, game] of Object.entries(names)) expect(candidates(PACKS[pack], site), `${pack} ${site}`).toContain(game);
  });

  it('spells a hero every way the game does (Han is HanSolo and Han)', () => {
    expect(candidates(HERO_SET(['HanSolo', 'Han']), 'die')).toContain('A_Han_Defeated_01');
  });

  it('is names all the way down, and nothing of the sequels', () => {
    shaped(HUMANOID_SET);
    shaped(HERO_SET('Luke'));
    for (const k of Object.keys(PACKS)) for (const s of SEQUEL) expect(k.includes(s), k).toBe(false);
    expect(Object.keys(PACKS)).toContain('humanoid');
    expect(Object.keys(PACKS)).toContain('luke');
  });
});

describe('the own rigs’ sets', () => {
  it('give the B1 what a soldier plays: its idle, walk, run, falls, flinch and aim', () => {
    for (const k of ['idle', 'walk', 'run', 'die.fwd', 'die.back', 'hit.chest', 'aim.rifle']) expect(RIG_SET('b1')[k], k).toBeTruthy();
    expect(RIG_SET('b1').idle).toContain('L_B1_3p1pLoco_StandIdleLoop_01');
  });

  it('give every rig an idle, a walk (but the ones that stay put) and a skeleton of its own, and a pack by its name', () => {
    // (the pelikki on its rock, the Gamorrean on his bench, the gonk: the game gives them no walk)
    const still = new Set(['pelikki', 'gamorrean', 'gonk']);
    for (const [rig, r] of Object.entries(OWN_RIGS)) {
      shaped(r.set);
      expect(r.set.idle, rig).toBeTruthy();
      if (!still.has(rig)) expect(r.set.walk, rig).toBeTruthy();
      expect(r.skeleton, rig).toMatch(/_Ske$/);
      expect(PACKS[rig], rig).toBe(r.set);
    }
    expect(RIG_SET('nobody')).toBe(null);
  });

  it('take in the galaxy’s creatures, droids and aliens, each on its own skeleton', () => {
    for (const rig of ['birdtheed', 'chicken', 'scurrier', 'tach', 'pelikki', 'runyip', 'profogg', 'sneep', 'stintarils', 'pillioshrimp', 'felbird', 'felripper', 'gamorrean', 'treadwell', 'gonk']) expect(RIG_SET(rig)?.idle, rig).toBeTruthy();
    expect(OWN_RIGS.chicken.skeleton).toBe('Chicken_01_Ske');
    expect(RIG_SET('gonk')['idle.look']).toBe('L_Gonk_Stand_Idle_02');
    // (none of the cast left's: lane B's beasts, lane Y's heroes)
    for (const rig of ['dewback', 'bantha', 'eopie', 'ronto', 'jawa', 'aiwha', 'yoda', 'grievous']) expect(OWN_RIGS[rig], rig).toBeUndefined();
  });
});
