import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from './lib.mjs';
import { main } from './bf2017-desk.mjs';
import { checkEnv, gateMarkdown, judge, spec, worldsOf } from './bf2017-gate.mjs';

const world = (id, p95, more = {}) => ({ id, p50: p95 / 2, p95, calls: 300, triangles: 2e6, glbMB: 40, loaded: 30, backend: 'webgl', errors: [], ...more });

describe('the gate job', () => {
  it('measures the seventeen Star Wars worlds the high baseline does', () => {
    const ids = worldsOf(REPO);
    expect(ids).toHaveLength(17);
    expect(ids).toEqual(expect.arrayContaining(['hoth', 'endor', 'tatooine', 'scarif']));
  });

  it("runs galaxy-check at ultra on the chip, the webgpu leg asking for WebGPU", () => {
    const e = checkEnv('webgpu', { out: '/o', chrome: 'C:/chrome.exe' }, { PATH: 'x' });
    expect(e).toMatchObject({ QUALITY: 'ultra', ANGLE: 'd3d11', GPU: 'webgpu', CHROME: 'C:/chrome.exe', JSON: '1', OUT: '/o', BUDGET: '1', BASE: 'http://127.0.0.1:5188', PATH: 'x' });
    expect(checkEnv('d3d11', { out: '/o', chrome: 'c' }, {}).GPU).toBeUndefined();
  });

  it('is red for a world over 16.7 ms p95, one that never came up, or one with page errors', () => {
    const rows = judge([world('hoth', 12), world('endor', 21.4), { id: 'bespin', error: 'timed out waiting for the scene' }, world('naboo', 10, { errors: ['TypeError: x'] })]);
    expect(rows.map((r) => r.pass)).toEqual([true, false, false, false]);
    expect(rows[1].over.join()).toMatch(/frame p95 21.4 ms > 16.7/);
    expect(rows[2].over).toEqual(['timed out waiting for the scene']);
    expect(rows[3].over.join()).toMatch(/page error/);
  });

  it('writes a table a leg', () => {
    const md = gateMarkdown({ d3d11: judge([world('hoth', 12), world('endor', 21.4)]) });
    expect(md).toMatch(/### d3d11: 1 of 2 within the ultra row; \*\*over: endor\*\*/);
    expect(md).toMatch(/\| hoth \| webgl \| 6 \| 12 \| 300 \| 2000000 \| 40 \| pass \|/);
  });

  it('dry-runs anywhere', async () => {
    const out = mkdtempSync(join(tmpdir(), 'w-gate-'));
    const r = await main(spec, ['--dry', '--only', 'hoth,endor', '--out', out], { GATE_LEGS: 'd3d11', CHROME: join(out, 'no-chrome') });
    expect(r.items.map((i) => i.name)).toEqual(['hoth', 'endor']);
    expect(r.items[0].legs).toBe('d3d11');
    expect(r.checks[0].ok).toBe(false);
  });
});
