import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { brotliCopy, fillPlan, sendEach, uiDataBrotli, uiDataFiles, uiDataLeftOut, verifyUiData } from './bf2web-ui-files.mjs';

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

  it('leaves out a file of another kind, as the publish contract has it, and names it', () => {
    const root = folder(['notes.txt', 'backdrop/cam5-50mm.exr']);
    expect(uiDataFiles(root)).not.toContain('notes.txt');
    expect(uiDataLeftOut(root)).toEqual(['backdrop/cam5-50mm.exr', 'notes.txt']);
    expect(uiDataLeftOut(folder())).toEqual([]);
  });

  it('a put whose connection is reset is tried again, not the end of the fill (16 Nov: run 43922315104 sent 14 of 18)', async () => {
    const files = [{ path: 'backdrop/cam5-50mm.tone.bin' }, { path: 'backdrop/wide/cam5-50mm.tone.bin' }];
    const sent = [];
    let resets = 1, refusals = 1;
    const put = async (f) => {
      if (f.path.startsWith('backdrop/wide/') && resets-- > 0) throw new TypeError('fetch failed', { cause: new Error('other side closed') });
      if (f.path.startsWith('backdrop/wide/') && refusals-- > 0) return { ok: false, status: 503 };
      sent.push(f.path);
      return { ok: true, status: 200 };
    };
    await sendEach(files, put, { sleep: async () => {} });
    expect(sent).toEqual(['backdrop/cam5-50mm.tone.bin', 'backdrop/wide/cam5-50mm.tone.bin']);
    await expect(sendEach(files, async () => ({ ok: false, status: 403 }), { sleep: async () => {} })).rejects.toThrow(/put backdrop\/cam5-50mm\.tone\.bin: HTTP 403/);
  });

  it('makes a brotli copy of an octet-stream file only (the tone data), and none that would save less than a tenth', async () => {
    expect(['backdrop/cam2-50mm.tone.bin', 'backdrop/wide/cam17-50mm.tone.bin'].every(uiDataBrotli)).toBe(true);
    expect(['screens.json', 'backdrop/backdrop.json', 'backdrop/cam2-50mm.png'].some(uiDataBrotli)).toBe(false);
    // (a grey R10G10B10A2 field, as the tone data is: 0x00300C03-style texels)
    const tone = Buffer.alloc(1 << 18);
    for (let i = 0; i < tone.length; i += 4) { const v = (i >> 10) & 1023; tone.writeUInt32LE(v | (v << 10) | (v << 20), i); }
    const br = await brotliCopy(tone, 5);
    expect(br.length).toBeLessThan(tone.length / 10);
    expect(brotliDecompressSync(br).equals(tone)).toBe(true);
    expect(await brotliCopy(randomBytes(1 << 16), 5)).toBeNull();
  });
});

// (after an upload, before its manifest: r1075-f943c314 went live with its 18 *.tone.bin absent and nothing said so)
describe('verifyUiData: the uploaded ui-data is all in the bucket before the manifest', () => {
  const prefix = 'sites/r1075-test/';
  const local = [{ path: 'screens.json', size: 10 }, { path: 'backdrop/cam2-50mm.png', size: 20 }, { path: 'backdrop/cam2-50mm.tone.bin', size: 30 }, { path: 'backdrop/wide/cam2-50mm.tone.bin', size: 40 }];
  const ok = async () => 200;
  it('passes when every file is there at its size and one of each kind answers', async () => {
    const asked = [];
    const r = await verifyUiData(local, [...local.map((f) => ({ key: f.path, size: f.size })), { key: 'backdrop/cam2-50mm.tone.bin.br', size: 9 }], async (k) => (asked.push(k), 200), prefix);
    expect(r.problems).toEqual([]);
    expect([r.inBucket, r.local]).toEqual([4, 4]);
    expect(r.probed).toEqual(['json', 'png', 'bin']);
    expect(asked).toEqual(['sites/r1075-test/ui-data/screens.json', 'sites/r1075-test/ui-data/backdrop/cam2-50mm.png', 'sites/r1075-test/ui-data/backdrop/cam2-50mm.tone.bin']);
  });
  it('names every file the bucket lacks, as the json/png-only uploader left the tone data out', async () => {
    const r = await verifyUiData(local, local.filter((f) => !f.path.endsWith('.bin')).map((f) => ({ key: f.path, size: f.size })), async (k) => (k.endsWith('.bin') ? 404 : 200), prefix);
    expect(r.problems).toEqual(['missing backdrop/cam2-50mm.tone.bin', 'missing backdrop/wide/cam2-50mm.tone.bin', 'HEAD backdrop/cam2-50mm.tone.bin (the bin probe): 404']);
    expect(r.inBucket).toBe(2);
  });
  it('names a file at another size, and a probe that does not answer 200', async () => {
    const remote = local.map((f) => ({ key: f.path, size: f.path === 'screens.json' ? 11 : f.size }));
    const r = await verifyUiData(local, remote, async (k) => (k.endsWith('.png') ? 503 : 200), prefix);
    expect(r.problems).toEqual(['screens.json: 11 B in the bucket, 10 B here', 'HEAD backdrop/cam2-50mm.png (the png probe): 503']);
  });
  it('an empty folder checks nothing', async () => {
    expect(await verifyUiData([], [], ok, prefix)).toEqual({ problems: [], inBucket: 0, local: 0, probed: [] });
  });
});
