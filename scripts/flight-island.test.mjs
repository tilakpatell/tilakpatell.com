import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check, removal } from './lib/flight-island.mjs';
import { repoTree } from './flight-island.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// The inventory held to the tree on every push: a row that names the flight
// unmarked, a marker that names nothing, or a file the inventory has wrong
// fails here with its line
describe('the flight’s island on this tree', () => {
  const tree = repoTree(ROOT);

  it('has every outside row marked, no marker stale, the inventory right', () => {
    const r = check(tree);
    expect(r.unmarked, 'unmarked references').toEqual([]);
    expect(r.stale, 'markers that name nothing').toEqual([]);
    expect(r.outsideImports, 'imports into the island').toEqual([]);
    expect(r.crossWorld, 'the flight past a face').toEqual([]);
    expect(r.unlisted, 'files with marks the inventory lacks').toEqual([]);
    expect(r.missing, 'inventory rows with no mark').toEqual([]);
    expect(r.counts.rows).toBeGreaterThan(20);
  });

  it('plans a removal that deletes only the island and drops only marked rows', () => {
    const plan = removal(tree, { date: '2026-10-10' });
    expect(plan.delete).toContain('src/pages/Fly.jsx');
    expect(plan.delete.some((f) => f.startsWith('src/components/galaxy/') || f.startsWith('src/components/universe/'))).toBe(false);
    for (const { lines } of plan.dropLines) for (const l of lines) expect(l.text).toBeDefined();
  });

  // (the script reads every file on the island: 7.5 to 7.8 s in a cloud
  // container, over vitest's 5 s; the time is the read's, not a hang)
  it('says ok from the command line', { timeout: 30_000 }, () => {
    expect(execFileSync('node', ['scripts/flight-island.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' })).toMatch(/^ok /);
  });
});
