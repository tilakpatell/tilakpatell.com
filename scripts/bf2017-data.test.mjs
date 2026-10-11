import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULEBOOKS, fileOf, plan, run } from './bf2017-data.mjs';

const ROOT = join(import.meta.dirname, 'fixtures', 'bf2017', 'data');

describe('the data CLI', () => {
  it('plans every rulebook in dependency order', () => {
    const p = plan(['all', '--root', 'x', '--level', 'hoth_01']);
    expect(p.steps).toEqual(RULEBOOKS);
    expect(p.steps.indexOf('teams')).toBeLessThan(p.steps.indexOf('weapons'));
    expect(p.steps.indexOf('map')).toBeLessThan(p.steps.indexOf('strings'));
    expect(p.steps.at(-1)).toBe('strings');
    expect(p).toMatchObject({ root: 'x', level: 'hoth_01', era: 'Orig', out: 'src/data/bf2017', dry: false });
  });

  it('plans one rulebook, and what it needs first', () => {
    expect(plan(['weapons', '--root', 'x']).steps).toEqual(['teams', 'classes', 'heroes', 'reinforcements', 'weapons']);
    expect(plan(['map', '--root', 'x', '--dry']).dry).toBe(true);
    expect(() => plan(['nope', '--root', 'x'])).toThrow(/nope/);
    expect(() => plan(['all'])).toThrow(/--root/);
  });

  it('names each rulebook’s file by its level', () => {
    expect(fileOf('map', 'hoth_01')).toBe('maps/hoth.json');
    expect(fileOf('lighting', 'hoth_01')).toBe('maps/hoth.lighting.json');
    expect(fileOf('weapons', 'hoth_01')).toBe('weapons.json');
    expect(fileOf('aiNames', 'hoth_01')).toBe('ai.names.json');
    expect(fileOf('aiCreatures', 'hoth_01')).toBe('ai.creatures.json');
    expect(fileOf('aiSquadron', 'hoth_01')).toBe('ai.squadron.json');
  });

  it('a dry run writes nothing and still counts', () => {
    const written = [];
    const counts = run(plan(['all', '--root', ROOT, '--dry']), { write: (f) => written.push(f), log: () => {}, copy: () => ({ icons: 0, fonts: 0, missing: [] }) });
    expect(written).toEqual([]);
    expect(counts.teams.rows).toBe(1);
    expect(counts.teams.refused).toBeGreaterThan(0);
    expect(counts.weapons.rows).toBeGreaterThan(0);
    expect(counts.map.rows).toBeGreaterThan(0);
  });

  it('a run writes each rulebook with where it came from', () => {
    const written = {};
    run(plan(['all', '--root', ROOT]), { write: (f, j) => (written[f] = j), log: () => {}, copy: () => ({ icons: 0, fonts: 0, missing: [] }) });
    expect(Object.keys(written)).toContain('weapons.json');
    expect(Object.keys(written)).toContain('maps/hoth.json');
    expect(written['weapons.json']._from).toMatchObject({ export: 'build 489592' });
    expect(written['weapons.json']._from.root).toMatch(/^[0-9a-f]{40}$/);
    expect(written['weapons.json'].rows.a280c.firing.rof).toBe(600);
    expect(written['strings.json'].rows.ID_FANTASYBATTLES_HOTH_FUEL_SILO).toBe('FUEL PIPES');
  });

  it('logs each record a row could not be built from, once', () => {
    const lines = [];
    run(plan(['all', '--root', ROOT, '--dry']), { write: () => {}, log: (l) => lines.push(l), copy: () => ({ icons: 0, fonts: 0, missing: [] }) });
    const luke = lines.filter((l) => /missing: .*Kit_Hero_Luke$/.test(l));
    expect(luke).toHaveLength(1);
  });
});
