import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillPlan, uiDataFiles } from './bf2web-ui-files.mjs';

// a build's ui-data as the live r1074-a2d368b1's is laid out: rulebooks, the backdrop manifest, stills and their tone data, the wide set
function folder(extra = []) {
  const root = mkdtempSync(join(tmpdir(), 'ui-data-'));
  for (const f of ['screens.json', 'modes.json', 'backdrop/backdrop.json', 'backdrop/cam2-50mm.png', 'backdrop/cam2-50mm.tone.bin',
    'backdrop/collection-r57-50mm.png', 'backdrop/collection-r57-50mm.tone.bin', 'backdrop/wide/cam17-50mm.png', 'backdrop/wide/cam17-50mm.tone.bin', ...extra]) {
    mkdirSync(join(root, f, '..'), { recursive: true });
    writeFileSync(join(root, f), f);
  }
  return root;
}

describe('a build\'s ui-data files that go up', () => {
  it('sends every file the page reads, the backdrop tone data among them (16 Nov: every *.tone.bin was a 404 on live)', () => {
    const files = uiDataFiles(folder());
    expect(files).toEqual([
      'backdrop/backdrop.json', 'backdrop/cam2-50mm.png', 'backdrop/cam2-50mm.tone.bin', 'backdrop/collection-r57-50mm.png',
      'backdrop/collection-r57-50mm.tone.bin', 'backdrop/wide/cam17-50mm.png', 'backdrop/wide/cam17-50mm.tone.bin', 'modes.json', 'screens.json',
    ]);
    // (each still the page shows has its tone data with it)
    for (const still of files.filter((f) => f.endsWith('.png') && f.startsWith('backdrop/'))) expect(files).toContain(still.replace(/\.png$/, '.tone.bin'));
  });

  it('fills a published build: sends only what its prefix lacks, and refuses another build\'s folder', () => {
    const local = [{ path: 'screens.json', size: 10 }, { path: 'backdrop/cam2-50mm.png', size: 900 }, { path: 'backdrop/cam2-50mm.tone.bin', size: 64 }];
    // (live r1074-a2d368b1: the .json and .png went up, the .tone.bin did not)
    const plan = fillPlan(local, [{ key: 'screens.json', size: 10 }, { key: 'backdrop/cam2-50mm.png', size: 900 }]);
    expect(plan.missing.map((f) => f.path)).toEqual(['backdrop/cam2-50mm.tone.bin']);
    expect(plan.mismatched).toEqual([]);
    expect(fillPlan(local, [{ key: 'backdrop/cam2-50mm.png', size: 901 }]).mismatched.map((f) => f.path)).toEqual(['backdrop/cam2-50mm.png']);
    expect(fillPlan(local, local.map((f) => ({ key: f.path, size: f.size }))).missing).toEqual([]);
  });

  it('refuses a file of a kind it does not send, by name, rather than leaving it behind', () => {
    expect(() => uiDataFiles(folder(['backdrop/cam5-50mm.exr']))).toThrow(/ui-data file of a kind not uploaded: backdrop\/cam5-50mm\.exr/);
  });
});
