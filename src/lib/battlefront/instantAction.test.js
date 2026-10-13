// Instant Action's round from the setup screen's choices: the game's own
// options offered, the rows read, the choices checked, the sim started.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { DEFAULTS, MAX_SIDE, erasFor, optionsFor, roundFor, startInstantAction } from './instantAction.js';
import { MODES } from './modes/index.js';
import { aiOf, loadRulebook } from './rulebook.js';
import { step } from './sim.js';

const rb = loadRulebook();
const ME = DEFAULTS.team;
const THEM = 3 - ME;

describe('the round', () => {
  it('reads the sides, the length and the rate from the Mode8 rows', () => {
    const r = roundFor(gs, { mode: 'galacticAssault', difficulty: 'normal' });
    expect(r.bots).toEqual({ [ME]: gs.settings.TeamSize_RealPlayer_Normal_Mode8 - 1, [THEM]: gs.settings.TeamSize_AutoPlayers_Normal_Mode8 });
    expect(r.tickets).toBe(100);
    expect(r.bleed).toBe(1);
    expect(r.bpRate).toBe(1);
    expect(r.sources['size.theirs']).toBe('TeamSize_AutoPlayers_Normal_Mode8');
    expect(Object.values(r.sources)).not.toContain('hand');
  });

  it('a short round has half the reinforcements and twice the bleed, a long one twice and half', () => {
    expect(roundFor(gs, { length: 'short' })).toMatchObject({ tickets: 50, bleed: 2 });
    expect(roundFor(gs, { length: 'long' })).toMatchObject({ tickets: 200, bleed: 0.5 });
    expect(roundFor(gs, { bpRate: 'fast' }).bpRate).toBe(2);
    expect(roundFor(gs, { bpRate: 'slow' }).bpRate).toBe(0.5);
  });

  it('the screen’s medium length is the rows’ Normal, under either name', () => {
    expect(roundFor(gs, { length: 'medium' })).toMatchObject({ length: 'medium', tickets: 100, bleed: 1 });
    expect(roundFor(gs, { length: 'normal' })).toMatchObject({ length: 'medium', tickets: 100 });
    expect(roundFor(gs, { length: 'medium' }).sources.tickets).toBe('ConquestMaxTickets_Normal_Mode8');
  });

  it('the bots facing the player aim on the Enemies row, the bots beside them on the Friendlies', () => {
    const r = roundFor(gs, { difficulty: 'rookie', team: 1 });
    expect(r.ap[2].sources.sideScale).toBe('AP_AimNoiseScale_Enemies_Rookie_Mode8');
    expect(r.ap[1].sources.sideScale).toBe('AP_AimNoiseScale_Friendlies_Rookie_Mode8');
    expect(r.ap[2].noiseScale).toBe(7);
    expect(roundFor(gs, { difficulty: 'expert' }).ap[1].lofReaction).toBe(0.025);
  });

  it('each side’s heroes, reinforcements and vehicles are the rows’ counts', () => {
    const on = roundFor(gs, {});
    for (const n of [1, 2]) expect(on.caps[n]).toEqual({ heroes: { max: 4, bots: 3 }, reinforcements: { max: 12, bots: 10 }, vehicles: { bots: 2 } });
  });

  it('the enemy’s heroes off leaves the player’s side its own', () => {
    const r = roundFor(gs, { heroes: { enemy: false } });
    expect(r.caps[THEM].heroes).toEqual({ max: 0, bots: 0 });
    expect(r.caps[ME].heroes).toEqual({ max: 4, bots: 3 });
    const v = roundFor(gs, { vehicles: { friendly: false } });
    expect(v.caps[ME].vehicles).toEqual({ bots: 0 });
    expect(v.caps[THEM].vehicles).toEqual({ bots: 2 });
  });

  it('a count asked for is that side’s bots’, never past what the side may have out', () => {
    const r = roundFor(gs, { heroes: { enemyCount: 1, friendlyCount: 4 }, reinforcements: { enemyCount: 0, friendlyCount: 5 }, vehicles: { enemyCount: 1 } });
    expect(r.caps[THEM].heroes).toEqual({ max: 4, bots: 1 });
    expect(r.caps[ME].heroes).toEqual({ max: 4, bots: 4 });
    expect(r.caps[THEM].reinforcements).toEqual({ max: 0, bots: 0 });
    expect(r.caps[ME].reinforcements).toEqual({ max: 12, bots: 5 });
    expect(r.caps[THEM].vehicles).toEqual({ bots: 1 });
    expect(() => roundFor(gs, { heroes: { enemyCount: 5 } })).toThrow(/heroes\.enemyCount 5/);
    expect(() => roundFor(gs, { reinforcements: { friendlyCount: -1 } })).toThrow(/reinforcements\.friendlyCount/);
  });

  it('a bare switch sets both sides, as the first screen sent it', () => {
    const off = roundFor(gs, { heroes: false, vehicles: false, reinforcements: false });
    for (const n of [1, 2]) expect(off.caps[n]).toEqual({ heroes: { max: 0, bots: 0 }, reinforcements: { max: 0, bots: 0 }, vehicles: { bots: 0 } });
  });

  it('Supremacy runs the command posts’ waves, the other modes the objective waves by side and phase', () => {
    const cp = roundFor(gs, { mode: 'supremacy' });
    expect(cp.waves[1].soldiers).toMatchObject({ spawn: 15, pause: 30 });
    expect(cp.wavesBy).toBeNull();
    const ga = roundFor(gs, { mode: 'galacticAssault' });
    expect(ga.waves[2].sources['soldiers.spawn']).toBe('AP_Waves_SpawnTime_Attack');
    expect(ga.waves[1].sources['soldiers.spawn']).toBe('AP_Waves_SpawnTime_Defend');
    expect(ga.wavesBy.attack).toHaveLength(5);
    // (the defence comes back faster as it loses ground)
    expect(ga.wavesBy.defend[0].soldiers.pause).toBe(12);
    expect(ga.wavesBy.defend[2].soldiers.pause).toBe(3);
  });

  it('a count asked for replaces the row, and a choice that is not one is refused', () => {
    expect(roundFor(gs, { bots: { friendly: 3, enemy: 20 } }).bots).toEqual({ [ME]: 3, [THEM]: 20 });
    expect(() => roundFor(gs, { bots: { enemy: 0 } })).toThrow(/bots\.enemy/);
    expect(() => roundFor(gs, { bots: { friendly: MAX_SIDE + 1 } })).toThrow(/bots\.friendly/);
    expect(() => roundFor(gs, { difficulty: 'hard' })).toThrow(/difficulty hard/);
    expect(() => roundFor(gs, { mode: 'blast' })).toThrow(/mode blast/);
  });

  it('with no settings every number is the hand value and says so', () => {
    const r = roundFor({}, {});
    expect(r.tickets).toBe(100);
    expect(r.bots).toEqual({ [ME]: 11, [THEM]: 13 });
    expect(new Set(Object.values(r.sources))).toEqual(new Set(['hand']));
  });
});

describe('the options', () => {
  const opts = optionsFor(gs, { rulebook: rb, level: 'hoth' });
  const of = (id) => opts.find((o) => o.id === id);

  it('are the game’s own setup options, in the screen’s order', () => {
    expect(opts.map((o) => o.id)).toEqual([
      'mode', 'era', 'team', 'difficulty', 'length', 'bpRate', 'allEraHeroes',
      'bots.friendly', 'bots.enemy',
      'heroes.friendly', 'heroes.friendlyCount', 'heroes.enemy', 'heroes.enemyCount',
      'reinforcements.friendlyCount', 'reinforcements.enemyCount',
      'vehicles.friendly', 'vehicles.friendlyCount', 'vehicles.enemy', 'vehicles.enemyCount',
    ]);
    expect(of('difficulty').option).toBe('InstantActionDifficulty');
    expect(of('heroes.enemy').option).toBe('InstantActionEnemyHeroes');
    expect(of('bots.enemy').option).toBe('InstantActionNumEnemyAI_PC');
  });

  it('take their defaults and their names from the game’s profile options', () => {
    const ia = aiOf(rb).instantAction;
    // (the screen's first difficulty, its Normal, is the AutoPlayers' Rookie row)
    expect(of('difficulty').default).toBe(of('difficulty').choices[ia.InstantActionDifficulty.default]);
    expect(of('difficulty').default).toBe('rookie');
    expect(of('difficulty').labels).toEqual(ia.InstantActionDifficulty.items.map((id) => rb.strings[id] ?? id));
    expect(of('length').default).toBe('medium');
    expect(of('bpRate').default).toBe('default');
    expect(of('heroes.enemy').default).toBe(true);
    expect(of('allEraHeroes').default).toBe(false);
    expect(of('heroes.enemyCount')).toMatchObject({ kind: 'count', min: 0, max: 4, default: 3 });
    expect(of('reinforcements.friendlyCount')).toMatchObject({ min: 0, max: 12, default: 10 });
  });

  it('every option’s default is a choice the round takes', () => {
    const choice = {};
    for (const o of opts) {
      if (o.kind === 'choice') expect(o.choices).toContain(o.default);
      if (o.kind === 'count') expect(o.default).toBeGreaterThanOrEqual(o.min);
      const [a, b] = o.id.split('.');
      if (b) (choice[a] ??= {})[b] = o.default;
      else choice[a] = o.default;
    }
    expect(() => roundFor(gs, choice)).not.toThrow();
    expect(of('mode').choices.every((m) => MODES.includes(m))).toBe(true);
  });

  it('the eras on offer are the ones the teams table holds for the level', () => {
    expect(erasFor(rb, 'hoth')).toEqual(['Orig']);
    expect(of('era').choices).toEqual(['Orig']);
    expect(() => startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), mode: 'galacticAssault', era: 'Prequel' })).toThrow(/teams Prequel:hoth_01/);
  });
});

describe('the start', () => {
  it('makes the sim the round asks for: AutoPlayers on each side, the difficulty, the rate', () => {
    const { sim, round } = startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), seed: 4, level: 'hoth', mode: 'galacticAssault', difficulty: 'expert', bpRate: 'fast', bots: { friendly: 4, enemy: 6 } });
    const bots = [...sim.entities.values()].filter((e) => e.bot);
    expect(bots.filter((e) => e.team === ME)).toHaveLength(4);
    expect(bots.filter((e) => e.team === THEM)).toHaveLength(6);
    expect(sim.pve).toBe(false);
    expect(sim.difficulty.key).toBe('multiplayer:expert');
    expect(sim.bp.rate).toBe(2);
    expect(sim.instantAction).toBe(round);
    // (the round runs)
    for (let i = 0; i < 40; i++) step(sim, []);
    expect(sim.time).toBeGreaterThan(1.9);
  });

  it('one seed, one round', () => {
    const run = () => {
      const { sim } = startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), seed: 9, mode: 'galacticAssault', bots: { friendly: 3, enemy: 3 } });
      for (let i = 0; i < 60; i++) step(sim, []);
      return [...sim.entities.values()].map((e) => [e.id, e.at.map((v) => Math.round(v * 1000) / 1000)]);
    };
    expect(run()).toEqual(run());
  });
});
