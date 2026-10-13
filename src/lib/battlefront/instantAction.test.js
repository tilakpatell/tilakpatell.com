// Instant Action's round from the setup screen's choices: the rows read, the
// choices checked, the sim started.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { DEFAULTS, MAX_SIDE, erasFor, optionsFor, roundFor, startInstantAction } from './instantAction.js';
import { MODES } from './modes/index.js';
import { loadRulebook } from './rulebook.js';
import { step } from './sim.js';

const rb = loadRulebook();

describe('the round', () => {
  it('reads the sides, the length and the rate from the Mode8 rows', () => {
    const r = roundFor(gs, { mode: 'galacticAssault' });
    expect(r.bots).toEqual({ 2: gs.settings.TeamSize_RealPlayer_Normal_Mode8 - 1, 1: gs.settings.TeamSize_AutoPlayers_Normal_Mode8 });
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

  it('the bots facing the player aim on the Enemies row, the bots beside them on the Friendlies', () => {
    const r = roundFor(gs, { difficulty: 'rookie', team: 1 });
    expect(r.ap[2].sources.sideScale).toBe('AP_AimNoiseScale_Enemies_Rookie_Mode8');
    expect(r.ap[1].sources.sideScale).toBe('AP_AimNoiseScale_Friendlies_Rookie_Mode8');
    expect(r.ap[2].noiseScale).toBe(7);
    expect(roundFor(gs, { difficulty: 'expert' }).ap[1].lofReaction).toBe(0.025);
  });

  it('heroes, reinforcements and vehicles off leave none out', () => {
    const on = roundFor(gs, {});
    expect(on.caps[1]).toEqual({ heroes: { max: 4, bots: 3 }, reinforcements: { max: 12, bots: 10 }, vehicles: { bots: 2 } });
    const off = roundFor(gs, { heroes: false, vehicles: false, reinforcements: false });
    for (const n of [1, 2]) expect(off.caps[n]).toEqual({ heroes: { max: 0, bots: 0 }, reinforcements: { max: 0, bots: 0 }, vehicles: { bots: 0 } });
  });

  it('Supremacy runs the command posts’ waves, the other modes the objective waves by side', () => {
    expect(roundFor(gs, { mode: 'supremacy' }).waves[1].soldiers).toMatchObject({ spawn: 15, pause: 30 });
    const ga = roundFor(gs, { mode: 'galacticAssault' });
    expect(ga.waves[2].sources['soldiers.spawn']).toBe('AP_Waves_SpawnTime_Attack');
    expect(ga.waves[1].sources['soldiers.spawn']).toBe('AP_Waves_SpawnTime_Defend');
  });

  it('a count asked for replaces the row, and one out of range is refused', () => {
    expect(roundFor(gs, { bots: { friendly: 3, enemy: 20 } }).bots).toEqual({ 2: 3, 1: 20 });
    expect(() => roundFor(gs, { bots: { enemy: 0 } })).toThrow(/bots\.enemy/);
    expect(() => roundFor(gs, { bots: { friendly: MAX_SIDE + 1 } })).toThrow(/bots\.friendly/);
    expect(() => roundFor(gs, { difficulty: 'hard' })).toThrow(/difficulty hard/);
    expect(() => roundFor(gs, { mode: 'blast' })).toThrow(/mode blast/);
  });

  it('with no settings every number is the hand value and says so', () => {
    const r = roundFor({}, {});
    expect(r.tickets).toBe(100);
    expect(r.bots).toEqual({ 2: 11, 1: 13 });
    expect(new Set(Object.values(r.sources))).toEqual(new Set(['hand']));
  });
});

describe('the options', () => {
  it('every option’s default is a choice the round takes', () => {
    const opts = optionsFor(gs, { rulebook: rb, level: 'hoth' });
    const choice = {};
    for (const o of opts) {
      if (o.kind === 'choice') expect(o.choices).toContain(o.default);
      if (o.kind === 'count') expect(o.default).toBeGreaterThanOrEqual(o.min);
      const [a, b] = o.id.split('.');
      if (b) (choice[a] ??= {})[b] = o.default;
      else choice[a] = o.default;
    }
    expect(opts.map((o) => o.id)).toEqual(['mode', 'era', 'team', 'difficulty', 'length', 'bpRate', 'heroes', 'reinforcements', 'vehicles', 'bots.friendly', 'bots.enemy']);
    expect(() => roundFor(gs, choice)).not.toThrow();
    expect(opts.find((o) => o.id === 'mode').choices.every((m) => MODES.includes(m))).toBe(true);
  });

  it('the eras on offer are the ones the teams table holds for the level', () => {
    expect(erasFor(rb, 'hoth')).toEqual(['Orig']);
    expect(optionsFor(gs, { rulebook: rb, level: 'hoth' }).find((o) => o.id === 'era').choices).toEqual(['Orig']);
    expect(() => startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), mode: 'galacticAssault', era: 'Prequel' })).toThrow(/teams Prequel:hoth_01/);
  });
});

describe('the start', () => {
  it('makes the sim the round asks for: AutoPlayers on each side, the difficulty, the rate', () => {
    const { sim, round } = startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), seed: 4, level: 'hoth', mode: 'galacticAssault', difficulty: 'expert', bpRate: 'fast', bots: { friendly: 4, enemy: 6 } });
    const bots = [...sim.entities.values()].filter((e) => e.bot);
    expect(bots.filter((e) => e.team === DEFAULTS.team)).toHaveLength(4);
    expect(bots.filter((e) => e.team !== DEFAULTS.team)).toHaveLength(6);
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
