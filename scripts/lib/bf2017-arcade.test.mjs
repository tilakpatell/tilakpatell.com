import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arcadeRulebook } from './bf2017-arcade.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

describe('the Arcade from the Skirmish records', () => {
  const books = { heroes: { maul: { id: 'maul', kit: 'Gameplay/Kits/Hero/Maul/Kit_Hero_Maul' } } };
  const a = arcadeRulebook(ROOT, { books });

  it('reads a scenario’s two teams, their eras, heroes and specials', () => {
    const s = a.scenarios.scenario_07;
    expect(s.light).toMatchObject({ team: 'Gameplay/Teams/MP/Preq/Team_Light_Skirmish_Preq_THEE', side: 'light', era: 'Preq' });
    expect(s.dark).toMatchObject({ side: 'dark', era: 'Preq', heroes: ['maul'] });
    expect(s.dark.specials).toHaveLength(1);
    expect(s.planets).toEqual([]);
  });

  it('refuses a scenario with a sequel-era side', () => {
    expect(a.scenarios.scenario_10).toBeUndefined();
    expect(a.refused).toContain('scenario_10');
  });

  it('reads the settings screen’s parameters, their choices and defaults, in the screen’s order', () => {
    expect(Object.keys(a.params)).toHaveLength(22);
    expect(a.params.Team1AISize).toMatchObject({ values: [0, 2, 4, 8, 10, 15, 20], float: false, defaultIndex: 0, default: 0 });
    expect(a.params.TimeLimit).toMatchObject({ float: true, values: [3, 10, 20, 40, 60, 90, 120, 180, 240, 300, 600] });
    expect(a.params.Difficulty).toMatchObject({ values: [1, 2, 3], defaultIndex: 2, default: 3 });
    expect(a.base.slice(0, 3)).toEqual(['TimeLimit', 'TimeLimitCoop', 'Team1AISize']);
  });

  it('reads the bots’ names, and refuses the First Order’s', () => {
    expect(a.bots.Empire.names).toEqual(expect.arrayContaining(['TK-610', 'TK-118', 'TK-709']));
    expect(a.bots.FirstOrder).toBeUndefined();
    expect(checkSources(a)).toEqual([]);
  });
});
