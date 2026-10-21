// The Instant Action Overhaul V2's rulebook as written (src/data/bf2017/mods/
// iao-v2.json, `node scripts/bf2017-mods.mjs iao-v2 --root <bf2-re>/data/mods`):
// every number with the record it came from, nothing of the sequel era, and
// the deal's addresses read back as the numbers the site's logic was read with.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sequelMod } from './bf2017-mods.mjs';
import { DEAL, OPTIONS, TABLE } from './bf2017-mods-iao.mjs';

const book = JSON.parse(readFileSync(new URL('../../src/data/bf2017/mods/iao-v2.json', import.meta.url), 'utf8'));

// every object that holds a number (or an array of them) and the path to it
function holders(v, path = '', out = []) {
  if (!v || typeof v !== 'object') return out;
  const own = Object.entries(v).filter(([k, x]) => !k.startsWith('_') && (typeof x === 'number' || (Array.isArray(x) && x.some((y) => typeof y === 'number'))));
  if (own.length && !Array.isArray(v)) out.push({ path, v, keys: own.map(([k]) => k) });
  for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) holders(x, `${path}.${k}`, out);
  return out;
}

describe('the Overhaul’s rulebook', () => {
  it('names the mod it was read from', () => {
    expect(book._from).toMatchObject({ mod: 'Instant Action Overhaul V2', version: '2.00c', author: 'Mophead' });
  });

  it('gives every number the record and field it came from', () => {
    const bare = holders(book).filter((h) => !('_source' in h.v) && !('record' in h.v));
    expect(bare.map((h) => `${h.path} (${h.keys.join(', ')})`)).toEqual([]);
    // (a table's sources are one a value: a step with no setting has none, and no value)
    for (const t of Object.values(book.steps))
      for (const s of Object.values(t.settings)) s.values.forEach((x, k) => expect(x === null).toBe(s._source[k] === null));
  });

  it('holds nothing of the sequel era outside the list of what it refused', () => {
    const strings = [];
    const walk = (v, key) => {
      if (key === 'refused' || key === '_from') return;
      if (typeof v === 'string') strings.push(v);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk(book);
    expect(strings.filter((s) => sequelMod(s))).toEqual([]);
    expect(book.refused.length).toBeGreaterThan(0);
    expect(book.kits.some((k) => k.era === 'NewEra')).toBe(false);
  });

  it('has the five steps of its aim, reaction and dodging, the middle by default', () => {
    expect(book.steps.aim.settings.AimNoiseScale.values).toEqual([100, 5, 1, 0.5, 0.125]);
    expect(book.steps.reaction.settings.LofReactionTimeS.values).toEqual([0.5, 0.3, 0.1, 0.05, 0]);
    expect(book.steps.dodging.settings.EvasiveManeuversDodgeRollProbability.values).toEqual([0, 0.01, 0.05, 0.1, 1]);
    for (const k of ['aim', 'reaction', 'dodging']) expect(book.steps[k].default).toBe(2);
    expect(Object.values(OPTIONS)).toEqual(expect.arrayContaining(Object.keys(book.steps)));
  });

  it('has its adaptive difficulty, on by default: ten scales every fifteen seconds', () => {
    expect(book.adaptive).toMatchObject({ option: 'IAIAIAdaptiveDifficulty', default: true, every: 15, lag: 0.1, uniform: true });
    expect(book.adaptive.scales).toHaveLength(10);
  });

  it('has its hub’s squad-spawn probability and the AutoPlayer counts it renames away', () => {
    expect(book.squadSpawn.value).toBe(1);
    expect(book.container.renamed.map((r) => r.name).sort()).toEqual(['AP_Number_of_Bots_Team1_Mode1', 'AP_Number_of_Bots_Team2_Mode1', 'TeamSize_AutoPlayers_Mode8']);
  });

  it('reads each of the deal’s addresses back to the number the site’s logic was read with', () => {
    const was = { hold: 8, startLag: 0.1, every: 25, lag: 0.1, limit: 5, moveRadius: 10, defendRadius: 10, respawn: 6, respawnBefore: 40000 };
    for (const [k, [record, index, field]] of Object.entries(DEAL)) {
      expect(book.botLogic[k]).toEqual({ value: was[k], _source: `${record}#${index}.${field}` });
    }
    expect(book.botLogic.table.entries.join(' ')).toBe('X Y M M Y X M X Y F M M');
    expect(book.botLogic.table._source).toBe(`${TABLE.record}#${TABLE.switch}.OutEvents`);
  });

  it('gives every AI kit of a class on a side and era one Skirmish template', () => {
    for (const era of Object.values(book.kitTemplates))
      for (const side of Object.values(era))
        for (const row of Object.values(side)) {
          expect(row.kits).toBeGreaterThan(0);
          expect(row.tactics).toMatch(/_PvE_Tactics$/);
        }
    expect(book.kitTemplates.Orig.light.heavy).toMatchObject({ template: 'heavy', aiBody: 'StormTrooperAI_Skirmish' });
    expect(book.kitTemplates.Preq.dark.heavy).toMatchObject({ template: 'heavy_separatist', aiBody: 'StormTrooperAI_B1_Skirmish' });
  });
});
