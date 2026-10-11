import { describe, expect, it } from 'vitest';
import NAMES from '../../../data/bf2017/ai.names.json';
import { factionOf, nameFor, namesFor } from './names.js';
import { loadRulebook } from '../rulebook.js';
import { createSim, view } from '../sim.js';
import { hothFlatNav } from '../fixtures/hothFlat.js';

describe('the bots’ names, from the game’s lists', () => {
  it('twenty Empire pilots on a space battle are the TK list, none twice', () => {
    const taken = new Set();
    const got = Array.from({ length: 20 }, () => nameFor('empire', 'spaceBattles', 7, taken));
    expect(new Set(got).size).toBe(20);
    expect(new Set(got)).toEqual(new Set(NAMES.rows.empire.spaceBattles.names));
    expect(got.every((n) => /^TK-\d+$/.test(n))).toBe(true);
  });

  it('shuffles the list by the seed, the same seed the same order', () => {
    const a = namesFor('rebels', 'skirmish', 3, 5);
    expect(namesFor('rebels', 'skirmish', 3, 5)).toEqual(a);
    expect(namesFor('rebels', 'skirmish', 4, 5)).not.toEqual(a);
  });

  it('a faction with no list for the mode takes its Skirmish list, the game’s ground bots’ own', () => {
    expect(NAMES.rows.empire.galacticAssault).toBeUndefined();
    const n = nameFor('empire', 'galacticAssault', 1, new Set());
    expect(NAMES.rows.empire.skirmish.names).toContain(n);
  });

  it('numbers a name once the list runs out, and knows the teams’ factions', () => {
    const taken = new Set(NAMES.rows.separatists.spaceBattles.names);
    expect(nameFor('separatists', 'spaceBattles', 1, taken)).toMatch(/^R0-\w+ 2$/);
    expect(factionOf({ faction: 'Faction_Light_Orig' }, 'Orig')).toBe('rebels');
    expect(factionOf({ faction: 'Faction_Dark_Orig' }, 'Orig')).toBe('empire');
    expect(factionOf({ faction: 'Faction_Light_CW' }, 'CW')).toBe('republic');
    expect(factionOf({ faction: 'Faction_Dark_CW' }, 'CW')).toBe('separatists');
  });

  it('names every bot in a battle, none twice, the Empire’s from its list, and the view carries them', () => {
    const rb = loadRulebook();
    const sim = createSim({ rulebook: rb, nav: hothFlatNav(rb), seed: 1, bots: { 1: 8, 2: 8 } });
    const bots = [...sim.entities.values()].filter((e) => e.bot);
    expect(new Set(bots.map((b) => b.name)).size).toBe(16);
    for (const b of bots.filter((x) => x.team === 2)) expect(NAMES.rows.empire.skirmish.names).toContain(b.name);
    for (const b of bots.filter((x) => x.team === 1)) expect(NAMES.rows.rebels.skirmish.names).toContain(b.name);
    expect(view(sim).entities.find((e) => e.id === bots[0].id).name).toBe(bots[0].name);
  });
});
