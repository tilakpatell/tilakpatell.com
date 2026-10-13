// Instant Action's round from the setup screen's choices: the game's own
// options offered, the rows read, the choices checked, the sim started.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { DEFAULTS, MAX_SIDE, erasFor, optionsFor, roundFor, sideCap, startInstantAction } from './instantAction.js';
import { STEPS } from './ai/botLogicOverhaul.js';
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

describe('the game’s own counts', () => {
  const profile = aiOf(rb).instantAction;

  it('are read with their least, most and starting value', () => {
    expect(profile.InstantActionNumEnemyAI_PC).toMatchObject({ value: 20, min: 0, max: 32, step: 1 });
    expect(profile.InstantActionEnemyHeroCount).toMatchObject({ value: 2, min: 0, max: 4 });
    expect(profile.InstantActionFriendlyReinforcementCount).toMatchObject({ value: 4, min: 0, max: 20 });
    expect(profile.InstantActionEnemyVehicleCount).toMatchObject({ value: 1, min: 0, max: 2 });
  });

  it('a round with them starts where they start: 20 bots a side, 2 heroes, 4 reinforcements, 1 vehicle', () => {
    const r = roundFor(gs, {}, { profile });
    expect(r.bots).toEqual({ [ME]: 20, [THEM]: 20 });
    for (const n of [1, 2]) expect(r.caps[n]).toEqual({ heroes: { max: 4, bots: 2 }, reinforcements: { max: 12, bots: 4 }, vehicles: { bots: 1 } });
    expect(r.sources['size.theirs']).toBe('Gameplay/Profiles/InstantActionParams/InstantActionNumEnemyAI_PC');
    expect(r.scaled).toBe(false);
  });

  it('take a count up to the option’s most and no further', () => {
    expect(roundFor(gs, { reinforcements: { enemyCount: 20 } }, { profile }).caps[THEM].reinforcements).toEqual({ max: 20, bots: 20 });
    expect(() => roundFor(gs, { reinforcements: { enemyCount: 21 } }, { profile })).toThrow(/reinforcements\.enemyCount 21/);
    expect(() => roundFor(gs, { heroes: { friendlyCount: 5 } }, { profile })).toThrow(/heroes\.friendlyCount 5/);
    expect(roundFor(gs, { bots: { enemy: 0, friendly: 32 } }, { profile }).bots).toEqual({ [ME]: 32, [THEM]: 0 });
  });

  it('come down to the machine’s share', () => {
    expect(roundFor(gs, {}, { profile, cap: 8 })).toMatchObject({ bots: { [ME]: 8, [THEM]: 8 }, scaled: true });
  });
});

describe('the machine’s share', () => {
  it('lets a weaker machine draw fewer soldiers a side, the strongest the game’s most', () => {
    expect(sideCap('low')).toBeLessThan(sideCap('mid'));
    expect(sideCap('mid')).toBeLessThan(sideCap('high'));
    expect(sideCap('high')).toBeLessThanOrEqual(sideCap('ultra'));
    expect(sideCap('ultra')).toBe(MAX_SIDE);
    expect(sideCap('no such level')).toBe(sideCap('mid'));
  });

  it('brings a round’s own sizes down to it, and says so', () => {
    const r = roundFor(gs, { difficulty: 'normal' }, { cap: 5 });
    expect(r.bots).toEqual({ [ME]: 5, [THEM]: 5 });
    expect(r.cap).toBe(5);
    expect(r.scaled).toBe(true);
    const full = roundFor(gs, { difficulty: 'normal' }, { cap: MAX_SIDE });
    expect(full.bots).toEqual({ [ME]: 11, [THEM]: 13 });
    expect(full.scaled).toBe(false);
    expect(roundFor(gs, { difficulty: 'normal' }).cap).toBe(MAX_SIDE);
  });

  it('refuses a count asked past it, and offers none past it', () => {
    expect(() => roundFor(gs, { bots: { enemy: 9 } }, { cap: 8 })).toThrow(/bots\.enemy 9 is not a whole number from 1 to 8/);
    expect(roundFor(gs, { bots: { enemy: 8, friendly: 2 } }, { cap: 8 }).bots).toEqual({ [ME]: 2, [THEM]: 8 });
    const opts = optionsFor(gs, { rulebook: rb, level: 'hoth', cap: 8 });
    const of = (id) => opts.find((o) => o.id === id);
    expect(of('bots.enemy')).toMatchObject({ max: 8, default: 8 });
    expect(of('bots.friendly')).toMatchObject({ max: 8, default: 8 });
    expect(optionsFor(gs, { rulebook: rb, level: 'hoth' }).find((o) => o.id === 'bots.enemy').max).toBe(MAX_SIDE);
  });
});

describe('the options', () => {
  const opts = optionsFor(gs, { rulebook: rb, level: 'hoth' });
  const of = (id) => opts.find((o) => o.id === id);

  it('are the game’s own setup options, in the screen’s order: the enemy’s before the player’s side’s', () => {
    expect(opts.map((o) => o.id)).toEqual([
      'mode', 'level', 'difficulty', 'length',
      'bpRate', 'bots.enemy', 'bots.friendly',
      'heroes.enemyCount', 'heroes.friendlyCount',
      'reinforcements.enemyCount', 'reinforcements.friendlyCount',
      'vehicles.enemyCount', 'vehicles.friendlyCount',
      'heroes.enemy', 'heroes.friendly', 'vehicles.enemy', 'vehicles.friendly', 'allEraHeroes',
      'team', 'era', 'botLogic',
      'overhaul.aim', 'overhaul.reaction', 'overhaul.dodging', 'overhaul.spread',
    ]);
    // (the screen's two headings, and what the game's screen has no row for)
    expect(opts.filter((o) => o.group === 'modifiers').map((o) => o.id)).toEqual(['mode', 'level', 'difficulty', 'length']);
    expect(opts.filter((o) => o.group === 'site').map((o) => o.id)).toEqual(['era', 'botLogic']);
    expect(of('bpRate').group).toBe('advanced');
    expect(of('difficulty').option).toBe('InstantActionDifficulty');
    expect(of('heroes.enemy').option).toBe('InstantActionEnemyHeroes');
    expect(of('bots.enemy').option).toBe('InstantActionNumEnemyAI_PC');
  });

  it('take their defaults and their names from the game’s profile options', () => {
    const ia = aiOf(rb).instantAction;
    // (the screen's first difficulty, its Normal, is the AutoPlayers' Rookie row)
    expect(of('difficulty').default).toBe(of('difficulty').choices[ia.InstantActionDifficulty.default]);
    expect(of('difficulty').default).toBe('rookie');
    // (the items' own names: the difficulty's ids end NORMAL, HARD and EXPERT, and the game's words for them are these)
    expect(of('difficulty').labels).toEqual(['ROOKIE', 'NORMAL', 'EXPERT']);
    expect(of('length').labels).toEqual(['SHORT', 'MEDIUM', 'LONG']);
    expect(of('bpRate').labels).toEqual(['SLOW', 'DEFAULT', 'FAST']);
    expect(of('length').default).toBe('medium');
    expect(of('bpRate').default).toBe('default');
    expect(of('heroes.enemy').default).toBe(true);
    expect(of('allEraHeroes').default).toBe(false);
    // (the counts are the game's own options': their least, most and starting value)
    expect(of('bots.enemy')).toMatchObject({ kind: 'count', min: 0, max: 32, default: 20, source: 'Gameplay/Profiles/InstantActionParams/InstantActionNumEnemyAI_PC' });
    expect(of('bots.friendly')).toMatchObject({ min: 0, max: 32, default: 20 });
    expect(of('heroes.enemyCount')).toMatchObject({ kind: 'count', min: 0, max: 4, default: 2 });
    expect(of('reinforcements.friendlyCount')).toMatchObject({ min: 0, max: 20, default: 4 });
    expect(of('vehicles.enemyCount')).toMatchObject({ min: 0, max: 2, default: 1 });
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

  it('the modes on offer are the world’s, Instant Action’s own first: Hoth’s page offers Supremacy, its second level’s', () => {
    expect(of('mode').choices[0]).toBe('supremacy');
    expect(of('mode').default).toBe('supremacy');
    expect(of('mode').choices).toContain('galacticAssault');
    expect(new Set(of('mode').choices).size).toBe(of('mode').choices.length);
    // (a level whose world holds no Supremacy starts on its own first mode)
    const kamino = optionsFor(gs, { rulebook: rb, level: 'kamino_01' }).find((o) => o.id === 'mode');
    expect(kamino.choices.includes('supremacy') ? kamino.default : kamino.choices[0]).toBe(kamino.default);
  });

  it('the eras on offer are the ones the teams table holds for the level', () => {
    expect(erasFor(rb, 'hoth')).toEqual(['Orig']);
    expect(of('era').choices).toEqual(['Orig']);
    expect(() => startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), mode: 'galacticAssault', era: 'Prequel' })).toThrow(/teams Prequel:hoth_01/);
  });
});

describe('the rows’ words', () => {
  const opts = optionsFor(gs, { rulebook: rb, level: 'hoth' });
  const of = (id) => opts.find((o) => o.id === id);

  it('are the game’s own for its rows: the title and the help line under the list', () => {
    expect(of('mode')).toMatchObject({ label: 'MODE', help: 'Select gamemode.' });
    expect(of('difficulty')).toMatchObject({ label: 'AI DIFFICULTY', help: 'Change the difficulty of combat to your preferred setting.' });
    expect(of('length')).toMatchObject({ label: 'ROUND LENGTH', help: 'Choose between short, medium and long matches.' });
    expect(of('bpRate')).toMatchObject({ label: 'BATTLE POINTS', help: 'Set the rate of earning Battle Points.' });
    expect(of('bots.enemy')).toMatchObject({ label: 'ENEMY AI COUNT', help: 'Maximum number of enemy AI. This will affect performance.' });
    expect(of('reinforcements.friendlyCount').label).toBe('FRIENDLY REINFORCEMENT COUNT');
    expect(of('allEraHeroes')).toMatchObject({ label: 'ENABLE HEROES FROM ANY ERA', help: 'Enable the use of heroes from any Star Wars era' });
    // (the table holds no help line for the two friendly switches)
    expect(of('heroes.friendly')).toMatchObject({ label: 'FRIENDLY HEROES', help: null });
    for (const o of opts) expect(typeof o.label).toBe('string');
  });

  it('a switch’s two words are the game’s OFF and ON; a mode’s name is the game’s for it', () => {
    expect(of('heroes.enemy').labels).toEqual(['OFF', 'ON']);
    expect(of('mode').labels[of('mode').choices.indexOf('supremacy')]).toBe('SUPREMACY');
    expect(of('mode').labels[of('mode').choices.indexOf('galacticAssault')]).toBe('GALACTIC ASSAULT');
  });

  it('the location is a row of one choice, the page’s level by its world’s name', () => {
    expect(of('level')).toMatchObject({ group: 'modifiers', kind: 'choice', choices: ['hoth'], labels: ['HOTH'], default: 'hoth', label: 'LOCATION', help: 'Set the map to play.', option: 'InstantActionLevelToPlay' });
  });

  it('say what the sim does not act on yet, and what a row waits on', () => {
    expect(opts.filter((o) => o.carried).map((o) => o.id)).toEqual(['vehicles.enemyCount', 'vehicles.friendlyCount', 'vehicles.enemy', 'vehicles.friendly', 'allEraHeroes']);
    expect(of('botLogic').when).toEqual({ mode: 'supremacy' });
    expect(of('overhaul.spread').when).toEqual({ mode: 'supremacy', botLogic: 'overhaul' });
    expect(of('difficulty').when).toBeUndefined();
  });

  it('take the profile’s words where it holds them, whatever the site would have said', () => {
    const ia = rb.ai.instantAction;
    const told = { ...rb, ai: { ...rb.ai, instantAction: { ...ia, InstantActionBPRate: { ...ia.InstantActionBPRate, title: { text: 'THE GAME’S WORD' }, help: { text: 'Its line.' } } } } };
    expect(optionsFor(gs, { rulebook: told, level: 'hoth' }).find((o) => o.id === 'bpRate')).toMatchObject({ label: 'THE GAME’S WORD', help: 'Its line.' });
  });

  it('with no rulebook every row still has a name, the site’s own', () => {
    for (const o of optionsFor(gs)) expect(o.label.length).toBeGreaterThan(0);
  });
});

describe('the Overhaul’s logic', () => {
  const opts = optionsFor(gs, { rulebook: rb, level: 'hoth' });
  const of = (id) => opts.find((o) => o.id === id);
  const ask = (overhaul) => roundFor(gs, { mode: 'supremacy', botLogic: 'overhaul', ...(overhaul ? { overhaul } : {}) });

  it('is the site’s own choice, and the game’s logic unless asked', () => {
    expect(of('botLogic')).toMatchObject({ group: 'site', kind: 'choice', choices: ['game', 'overhaul'], default: 'game', source: 'hand' });
    expect(roundFor(gs, { mode: 'supremacy' }).botLogic).toMatchObject({ kind: 'game', radius: 8 });
  });

  it('has the mod’s rows: three of its five steps, and its spread', () => {
    expect(opts.filter((o) => o.group === 'overhaul').map((o) => o.id)).toEqual(['overhaul.aim', 'overhaul.reaction', 'overhaul.dodging', 'overhaul.spread']);
    expect(STEPS).toEqual(['veryEasy', 'easy', 'medium', 'hard', 'veryHard']);
    for (const id of ['overhaul.aim', 'overhaul.reaction', 'overhaul.dodging']) expect(of(id)).toMatchObject({ kind: 'choice', choices: STEPS, default: 'medium' });
    expect(of('overhaul.spread')).toMatchObject({ kind: 'toggle', default: true });
  });

  it('asked for, the round carries the mod’s numbers: its radius, its six seconds, its middle steps', () => {
    const r = ask();
    expect(r.botLogic).toEqual({ kind: 'overhaul', radius: 10, spread: true });
    for (const team of [1, 2]) {
      expect(r.waves[team].soldiers).toMatchObject({ pause: 0, delay: 6 });
      // (the mod's own scale in place of the rows': 1, and no row by side: the spread is the side's)
      expect(r.ap[team]).toMatchObject({ noiseScale: 1, sideScale: 1, fov: 110, lofReaction: 0.1, dodgeRoll: 0.05 });
    }
  });

  it('a step asked for is the mod’s table’s', () => {
    const r = ask({ aim: 'veryHard', reaction: 'veryEasy', dodging: 'hard', spread: false });
    expect(r.ap[1]).toMatchObject({ noiseScale: 0.125, fov: 180, lofReaction: 0.5, dodgeRoll: 0.1 });
    expect(r.ap[2]).toMatchObject({ noiseScale: 0.125, fov: 180, lofReaction: 0.5, dodgeRoll: 0.1 });
    expect(r.botLogic.spread).toBe(false);
    expect(ask({ aim: 'veryEasy' }).ap[1]).toMatchObject({ noiseScale: 100, fov: 40 });
    // (the mod holds a field of view for Hard and never applies it: the rows' own stays)
    expect(ask({ aim: 'hard' }).ap[1].noiseScale).toBe(0.5);
    expect(ask({ aim: 'hard' }).ap[1].fov).toBe(roundFor(gs, { mode: 'supremacy' }).ap[1].fov);
  });

  it('a logic or a step that is not one is refused', () => {
    expect(() => roundFor(gs, { mode: 'supremacy', botLogic: 'mine' })).toThrow(/botLogic mine/);
    expect(() => ask({ aim: 'harder' })).toThrow(/overhaul.aim harder/);
    expect(() => ask({ spread: 'yes' })).toThrow(/overhaul.spread/);
  });

  it('is the command posts’ alone: an objective mode’s round is as it was', () => {
    const r = roundFor(gs, { mode: 'galacticAssault', botLogic: 'overhaul', overhaul: { aim: 'veryHard' } });
    expect(r.botLogic).toBeNull();
    expect(r.ap).toEqual(roundFor(gs, { mode: 'galacticAssault' }).ap);
    expect(r.wavesBy).toEqual(roundFor(gs, { mode: 'galacticAssault' }).wavesBy);
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
