import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import artMixMetric, { artMix } from './art-mix.mjs';
import { makeContext } from './context.mjs';

const ROOT = fileURLToPath(new URL('./fixtures/art-mix/', import.meta.url));
const FOLDERS = ['mixed', 'mixed/inner', 'scanned', 'skylit', 'gone'].map((folder) => ({ folder, routes: ['/'] }));

describe('art-mix, on a fixture tree', () => {
  it('counts a world that reaches both a scan and a toon ramp, and names the file of each', () => {
    const { value, items } = artMix({ root: ROOT, folders: FOLDERS });
    expect(value).toBe(1);
    expect(items).toEqual([{ folder: 'mixed', scan: 'src/components/mixed/scene.js', ramp: 'src/components/mixed/toon.js' }]);
  });

  it('leaves out a world with a scan only, a ramp under an HDR sky, and a folder that has gone', () => {
    const folders = artMix({ root: ROOT, folders: FOLDERS }).items.map((it) => it.folder);
    expect(folders).not.toContain('scanned');
    expect(folders).not.toContain('skylit');
    expect(folders).not.toContain('mixed/inner'); // (its own entry, reaching neither)
  });

  // (the whole site's imports walked: near four seconds alone, past vitest's
  // five on a runner busy with the rest of the suite)
  it('measures the site in the health table’s shape', async () => {
    const m = await artMixMetric(await makeContext(fileURLToPath(new URL('../..', import.meta.url))));
    expect(m.id).toBe('art-mix');
    expect(m.value).toBe(m.detail.length);
    for (const d of m.detail) expect(d).toMatchObject({ n: 1, file: expect.stringMatching(/^src\/components\//), scan: expect.any(String), ramp: expect.any(String) });
  }, 30000);
});
