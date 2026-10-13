import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from './lib.mjs';
import { main } from './bf2017-desk.mjs';
import { bucketPath, hdrSource, lightRecords, peakOf, sitePath, skies, spec, texconvArgs, withIndex } from './bf2017-panoramas.mjs';
import { makeDds } from '../lib/ktx2-hdr.mjs';

const records = {
  hoth: { weathers: { sunny: { sky: { panorama: 'L/Hoth/T_Hoth_Sunny_02_C', gradient: 'L/Hoth/T_Hoth_Sunny_02_Fog_C' } }, interior: { sky: { panorama: 'L/Hoth/T_Hoth_Sunny_02_C' } } } },
  endor: { weathers: { night: { sky: { panorama: 'L/Kashyyyk/T_Kashyyyk_Night_01_C' } } } },
  kashyyyk: { weathers: { night: { sky: { panorama: 'L/Kashyyyk/T_Kashyyyk_Night_01_C' } } } },
  frontend: { weathers: { sunny: { sky: { panorama: 'shaders/T_DefaultBlack_C', gradient: 'shaders/T_DefaultBlack_C' } } } },
};

// A key, by its shape: a JWT's header and payload (the three letters every
// one begins with are not enough: the plan holds the test's own folder,
// whose random name spelled them once, /tmp/w-pan-meyJHn, and failed CI),
// or one of Supabase's own names. (In halves: the guard in assets-upload.test.mjs.)
const KEY = new RegExp(['ey' + 'J[\\w-]{10,}\\.[\\w-]{10,}', 'service' + '_role', 'sb_' + 'secret'].join('|'));

describe('a key’s shape', () => {
  it('is a JWT’s header and payload or a Supabase name, never three letters of a folder’s name', () => {
    expect('/tmp/w-pan-meyJHn/no-export/web/textures.jsonl').not.toMatch(KEY);
    expect(`${'ey' + 'J'}${'a'.repeat(20)}.${'b'.repeat(40)}.${'c'.repeat(20)}`).toMatch(KEY);
    expect(`a ${'service' + '_role'} key`).toMatch(KEY);
    expect(`${'sb_' + 'secret'}_x`).toMatch(KEY);
  });
});

describe('the panoramas job', () => {
  it('lists each sky once, with every world and weather that names it, the placeholder left out', () => {
    const s = skies(records);
    expect(s.map((i) => [i.kind, i.slug])).toEqual([
      ['panorama', 't_hoth_sunny_02_c'],
      ['panorama', 't_kashyyyk_night_01_c'],
      ['gradient', 't_hoth_sunny_02_fog_c'],
    ]);
    expect(s[0].uses).toEqual(['hoth/sunny', 'hoth/interior']);
    expect(s[1].worlds).toEqual(['endor', 'kashyyyk']);
  });

  it('makes a panorama at ultra and high, a gradient at its own size', () => {
    const index = [
      { name: 'L/Hoth/T_Hoth_Sunny_02_C', file: 'textures/l/hoth/t_hoth_sunny_02_c.png', width: 8192, height: 2048, format: 'BC6U_FLOAT' },
      { name: 'L/Hoth/T_Hoth_Sunny_02_Fog_C', file: 'textures/l/hoth/t_hoth_sunny_02_fog_c.png', width: 512, height: 256, format: 'BC6U_FLOAT' },
    ];
    const [pan, , grad] = withIndex(skies(records), index);
    expect(pan.out.map((o) => o.width)).toEqual([4096, 2048]);
    expect(pan.native).toBe('8192×2048');
    expect(grad.out).toEqual([{ tier: 'all', width: 512, height: 256 }]);
    expect(withIndex(skies(records), null)[1].file).toBe(null);
  });

  it('finds the HDR source by the export path, a .dds first', () => {
    const there = new Set([join('/x/raw', 'textures/a/t_c.hdr'), join('/x/web', 'textures/a/t_c.dds')]);
    expect(hdrSource('textures/a/t_c.png', ['/x/raw', '/x/web'], (p) => there.has(p))).toBe(join('/x/raw', 'textures/a/t_c.hdr'));
    expect(hdrSource('textures/a/t_d.png', ['/x/raw'], (p) => there.has(p))).toBe(null);
    expect(hdrSource(null, ['/x'])).toBe(null);
  });

  it("asks texconv for half floats, the size and every mip; names the bucket's and the site's files", () => {
    expect(texconvArgs('C:/e/raw/t.dds', 'C:/tmp', { width: 4096, height: 1024 })).toEqual(['-nologo', '-y', '-ft', 'dds', '-f', 'R16G16B16A16_FLOAT', '-w', '4096', '-h', '1024', '-m', '0', '-o', 'C:/tmp', 'C:/e/raw/t.dds']);
    expect(bucketPath('textures/levels/lighting/hoth/t_hoth_sunny_02_c.png', 4096)).toBe('hdr/textures/levels/lighting/hoth/t_hoth_sunny_02_c.4096.ktx2');
    expect(sitePath('t_hoth_sunny_02_c', 2048)).toBe('textures/galaxy/bf2017/hdr/t_hoth_sunny_02_c.2048.ktx2');
  });

  it('measures the peak over white that proves a copy HDR', () => {
    expect(peakOf(makeDds(4, 2, 1, (x) => (x === 2 ? [18.5, 3, 1, 1] : [0.5, 0.5, 0.5, 1])), 148)).toBe(18.5);
  });

  it("reads every light record in the repository: fifteen skies' panoramas", () => {
    const s = skies(lightRecords(REPO));
    expect(s.filter((i) => i.kind === 'panorama').length).toBeGreaterThanOrEqual(15);
    expect(s.every((i) => !/default/i.test(i.name))).toBe(true);
  });

  it('dry-runs anywhere: the plan from the repository, nothing made', async () => {
    const out = mkdtempSync(join(tmpdir(), 'w-pan-'));
    const r = await main(spec, ['--dry', '--only', 'hoth', '--out', out], { BF2_EXPORT: join(out, 'no-export') });
    expect(r.dry).toBe(true);
    expect(r.items.length).toBeGreaterThanOrEqual(3);
    expect(r.checks.find((c) => c.name === 'the export').ok).toBe(false);
    const plan = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
    expect(plan._source).toMatch(/--dry/);
    expect(JSON.stringify(plan)).not.toMatch(KEY); // never a key
  });
});
