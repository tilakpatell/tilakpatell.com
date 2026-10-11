import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from './bf2017-desk.mjs';
import { shapeOf, shares, spec, survey } from './bf2017-depots.mjs';

describe('the depots job', () => {
  it("reads a probe row's shape, and names the keys of one the reader can't take", () => {
    expect(shapeOf({ blocks: [{ params: [{ hash: 'a1', type: 'float', value: 1 }] }, { params: [] }] })).toEqual({ ok: true, blocks: 2, keys: null });
    expect(shapeOf({ blocks: [{ params: [{ nameHash: 'a1' }] }] }).ok).toBe(true);
    expect(shapeOf({ Blocks: [{ Params: [] }] })).toEqual({ ok: false, blocks: 0, keys: { row: ['Blocks'], block: [], param: [] } });
    expect(shapeOf({ blocks: [{ parameters: [{ h: 1 }] }] }).keys.block).toEqual(['parameters']);
  });

  it('surveys a probe file: rows, blocks, the first bad row', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'w-dep-'));
    const file = join(dir, 'shaderdepots.jsonl');
    writeFileSync(file, `${JSON.stringify({ blocks: [{ params: [] }, { params: [] }] })}\n\n${JSON.stringify({ blocks: [{ params: [{ hash: 'x' }] }] })}\n${JSON.stringify({ shader: 1 })}\n`);
    expect(await survey(file)).toEqual({ rows: 3, blocks: 3, bad: { row: 3, keys: { row: ['shader'], block: [], param: [] } } });
  });

  it('says the share of all and of the rest, the per-block constants set apart', () => {
    // the design session's run: 2,339,665 entries, 173,321 resolved, nine constants in all 216,497 blocks
    const unresolved = Object.fromEntries([...Array.from({ length: 9 }, (_, i) => [`c${i}`, 216497]), ['x0', 72623], ['x1', 72623], ['x2', 72625]]); // (the rest of the unresolved, 217,871, over three hashes)
    const s = shares({ depots: { params: 2339665, resolved: 173321 }, unresolved }, 216497);
    expect(s).toMatchObject({ all: 7.4, constants: 9, constantEntries: 1948473, rest: 391192, ofRest: 44.3, unresolvedHashes: 3 });
    expect(shares({}, 0)).toMatchObject({ all: null, ofRest: null });
  });

  it('dry-runs anywhere', async () => {
    const out = mkdtempSync(join(tmpdir(), 'w-dep-'));
    const r = await main(spec, ['--dry', '--out', out], { BF2_EXPORT: join(out, 'none') });
    expect(r.items).toHaveLength(1);
    expect(r.checks[0].ok).toBe(false);
  });
});
