// The Instant Action setup screen's logic, with nothing drawn: its rows in
// the game's order with the game's own words, a row stepped, a count set,
// the defaults, the sides.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { optionsFor, roundFor } from './instantAction.js';
import { defaultsOf, rowsFor, setCount, sidesOf, step } from './instantActionForm.js';
import { loadRulebook } from './rulebook.js';

const rb = loadRulebook();
const schema = optionsFor(gs, { rulebook: rb, level: 'hoth' });
const start = defaultsOf(schema);
const row = (options, id) => rowsFor(schema, options).find((r) => r.id === id);

describe('the defaults', () => {
  it('are every row’s own, nested as the round takes them', () => {
    expect(start).toMatchObject({ mode: 'supremacy', level: 'hoth', difficulty: 'rookie', length: 'medium', bpRate: 'default', team: 2, botLogic: 'game' });
    expect(start.bots).toEqual({ enemy: 20, friendly: 20 });
    expect(start.heroes).toEqual({ enemyCount: 2, friendlyCount: 2, enemy: true, friendly: true });
    expect(start.overhaul).toEqual({ aim: 'medium', reaction: 'medium', dodging: 'medium', spread: true });
    expect(() => roundFor(gs, start, { profile: rb.ai.instantAction })).not.toThrow();
  });

  it('are a fresh object each time', () => {
    const a = defaultsOf(schema);
    a.bots.enemy = 3;
    expect(defaultsOf(schema).bots.enemy).toBe(20);
  });
});

describe('the rows', () => {
  const rows = rowsFor(schema, start);

  it('are the screen’s, in its order, under its two headings and then the site’s own', () => {
    expect(rows.filter((r) => r.group === 'modifiers').map((r) => r.label)).toEqual(['MODE', 'LOCATION', 'AI DIFFICULTY', 'ROUND LENGTH']);
    expect(rows.filter((r) => r.group === 'advanced').map((r) => r.label)).toEqual([
      'BATTLE POINTS',
      'ENEMY AI COUNT', 'FRIENDLY AI COUNT',
      'ENEMY HERO COUNT', 'FRIENDLY HERO COUNT',
      'ENEMY REINFORCEMENT COUNT', 'FRIENDLY REINFORCEMENT COUNT',
      'ENEMY VEHICLE COUNT', 'FRIENDLY VEHICLE COUNT',
      'ENEMY HEROES', 'FRIENDLY HEROES', 'ENEMY VEHICLES', 'FRIENDLY VEHICLES', 'ENABLE HEROES FROM ANY ERA',
    ]);
    expect(rows.map((r) => r.group).filter((g, i, a) => a.indexOf(g) === i)).toEqual(['modifiers', 'advanced', 'faction', 'site', 'overhaul']);
  });

  it('say which the game’s own screen lists', () => {
    expect(rows.filter((r) => r.listed).map((r) => r.label)).toEqual([
      'MODE', 'LOCATION', 'AI DIFFICULTY', 'ROUND LENGTH', 'BATTLE POINTS',
      'ENEMY AI COUNT', 'FRIENDLY AI COUNT', 'ENEMY HERO COUNT', 'FRIENDLY HERO COUNT',
      'ENEMY REINFORCEMENT COUNT', 'FRIENDLY REINFORCEMENT COUNT', 'ENEMY VEHICLE COUNT', 'FRIENDLY VEHICLE COUNT',
    ]);
    expect(row(start, 'heroes.enemy').listed).toBe(false);
    expect(row(start, 'era').listed).toBe(false);
  });

  it('show what each is set to in the game’s words: a choice’s name, a number, ON or OFF', () => {
    expect(row(start, 'mode')).toMatchObject({ kind: 'choice', text: 'SUPREMACY', value: 'supremacy' });
    expect(row(start, 'level')).toMatchObject({ kind: 'choice', text: 'HOTH', value: 'hoth', choices: ['hoth'] });
    expect(row(start, 'difficulty').text).toBe('ROOKIE');
    expect(row(start, 'length').text).toBe('MEDIUM');
    expect(row(start, 'bpRate').text).toBe('DEFAULT');
    expect(row(start, 'bots.enemy')).toMatchObject({ kind: 'count', text: '20', value: 20, min: 0, max: 32 });
    expect(row(start, 'heroes.enemy')).toMatchObject({ kind: 'toggle', text: 'ON', value: true });
    expect(row(start, 'allEraHeroes').text).toBe('OFF');
  });

  it('carry the game’s help line for the row, or none where it holds none', () => {
    expect(row(start, 'mode').help).toBe('Select gamemode.');
    expect(row(start, 'length').help).toBe('Choose between short, medium and long matches.');
    expect(row(start, 'bots.enemy').help).toBe('Maximum number of enemy AI. This will affect performance.');
    expect(row(start, 'heroes.friendly').help).toBeNull();
  });

  it('say which the world acts on today: not the vehicles, nor the heroes of every era', () => {
    expect(rows.filter((r) => !r.acts).map((r) => r.id)).toEqual(['vehicles.enemyCount', 'vehicles.friendlyCount', 'vehicles.enemy', 'vehicles.friendly', 'allEraHeroes', 'overhaul.aim', 'overhaul.reaction', 'overhaul.dodging', 'overhaul.spread']);
  });

  it('the Overhaul’s rows act once its logic is the round’s, on command posts alone', () => {
    const on = { ...start, botLogic: 'overhaul' };
    expect(row(on, 'overhaul.aim').acts).toBe(true);
    expect(row(on, 'botLogic')).toMatchObject({ acts: true, text: 'OVERHAUL' });
    const elsewhere = { ...on, mode: 'galacticAssault' };
    expect(row(elsewhere, 'overhaul.aim').acts).toBe(false);
    expect(row(elsewhere, 'botLogic').acts).toBe(false);
  });

  it('a choice that is not one of the row’s shows as it is, and is not acted on by this', () => {
    expect(row({ ...start, difficulty: 'harder' }, 'difficulty').text).toBe('HARDER');
  });
});

describe('a row stepped', () => {
  it('a choice goes to the next and wraps as the game’s does', () => {
    expect(step(schema, start, 'difficulty', 1).difficulty).toBe('normal');
    expect(step(schema, start, 'difficulty', -1).difficulty).toBe('expert');
    expect(step(schema, { ...start, difficulty: 'expert' }, 'difficulty', 1).difficulty).toBe('rookie');
    expect(step(schema, start, 'level', 1).level).toBe('hoth');
  });

  it('a count goes one up or down and stops at its least and its most', () => {
    expect(step(schema, start, 'bots.enemy', 1).bots.enemy).toBe(21);
    expect(step(schema, start, 'bots.enemy', -1).bots.enemy).toBe(19);
    const most = setCount(schema, start, 'bots.enemy', 32);
    expect(step(schema, most, 'bots.enemy', 1).bots.enemy).toBe(32);
    const least = setCount(schema, start, 'heroes.enemyCount', 0);
    expect(step(schema, least, 'heroes.enemyCount', -1).heroes.enemyCount).toBe(0);
  });

  it('a switch flips either way', () => {
    expect(step(schema, start, 'heroes.enemy', 1).heroes.enemy).toBe(false);
    expect(step(schema, step(schema, start, 'heroes.enemy', -1), 'heroes.enemy', -1).heroes.enemy).toBe(true);
  });

  it('leaves the options it was given as they were, and every other row', () => {
    const next = step(schema, start, 'bots.enemy', 1);
    expect(start.bots.enemy).toBe(20);
    expect(next.bots.friendly).toBe(20);
    expect(next.heroes).toEqual(start.heroes);
    expect(next).not.toBe(start);
  });

  it('a row that is not one changes nothing', () => {
    expect(step(schema, start, 'nothing', 1)).toEqual(start);
  });
});

describe('a count set', () => {
  it('is the slider’s number, whole, inside the row’s least and most', () => {
    expect(setCount(schema, start, 'bots.friendly', 7).bots.friendly).toBe(7);
    expect(setCount(schema, start, 'bots.friendly', 7.6).bots.friendly).toBe(8);
    expect(setCount(schema, start, 'bots.friendly', 99).bots.friendly).toBe(32);
    expect(setCount(schema, start, 'bots.friendly', -4).bots.friendly).toBe(0);
    expect(setCount(schema, start, 'difficulty', 2)).toEqual(start);
  });

  it('stops at the machine’s share where the options were made for one', () => {
    const small = optionsFor(gs, { rulebook: rb, level: 'hoth', cap: 8 });
    expect(defaultsOf(small).bots).toEqual({ enemy: 8, friendly: 8 });
    expect(setCount(small, defaultsOf(small), 'bots.enemy', 20).bots.enemy).toBe(8);
    expect(rowsFor(small, defaultsOf(small)).find((r) => r.id === 'bots.enemy').max).toBe(8);
  });
});

describe('the sides', () => {
  it('are what Change Faction steps through, the chosen one marked', () => {
    expect(sidesOf(schema, start)).toEqual([{ team: 1, chosen: false }, { team: 2, chosen: true }]);
    const other = step(schema, start, 'team', 1);
    expect(other.team).toBe(1);
    expect(sidesOf(schema, other).find((s) => s.chosen).team).toBe(1);
    expect(step(schema, other, 'team', 1).team).toBe(2);
  });
});

describe('every round the rows can make', () => {
  it('is one the round takes: each row stepped through all it offers', () => {
    for (const o of schema) {
      let at = start;
      const n = o.kind === 'choice' ? o.choices.length : o.kind === 'toggle' ? 2 : 3;
      for (let k = 0; k < n; k++) {
        at = step(schema, at, o.id, 1);
        expect(() => roundFor(gs, at, { profile: rb.ai.instantAction })).not.toThrow();
      }
    }
  });
});
