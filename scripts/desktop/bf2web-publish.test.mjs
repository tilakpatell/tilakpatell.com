import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CONTRACT } from '../lib/bf2web-site.mjs';
import { publishedRulebook, readRulebooks, validateEvidence, validateRulebookDigest, verifyExportFiles, verifyPublishedRulebooks } from './bf2web-publish.mjs';
import { brotliCompressSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deviationLines, finishedReceipt } from '../lib/bf2web-deviations.mjs';
import { CASES, RULED, runCase } from '../lib/bf2web-deviations.cases.mjs';

const sha = 'a'.repeat(40), site = '/completed/site';
const fixture = () => ({
  site, sha,
  manifest: { schema: CONTRACT.schema, run: { commit: sha }, entries: CONTRACT.files.map((path) => ({ path, bytes: 1, sha256: 'b'.repeat(64) })) },
  build: { schema: 'bf2-play-site-build/1', passed: true, commit: sha, out: site,
    steps: ['prepare', 'physics', 'world', 'export', 'verify', 'direct-check'].map((name) => ({ name, ok: true })) },
  direct: { schema: 'play-site-direct/1', passed: true, site, exceptions: [], checks: Array.from({ length: 5 }, () => ({ ok: true })) },
});

describe('publishing an existing verified desktop build', () => {
  it('accepts the complete matching evidence', () => expect(validateEvidence(fixture())).toBe(true));
  it.each(['build', 'export'])('refuses a different %s commit', (which) => {
    const f = fixture(); if (which === 'build') f.build.commit = 'c'.repeat(40); else f.manifest.run.commit = 'c'.repeat(40);
    expect(() => validateEvidence(f)).toThrow(/commit differs/);
  });
  it('refuses evidence from a different directory', () => {
    const f = fixture(); f.direct.site = '/another/site'; expect(() => validateEvidence(f)).toThrow(/another export/);
  });
  it('refuses failed or missing hardware checks', () => {
    const f = fixture(); f.build.steps.pop(); expect(() => validateEvidence(f)).toThrow(/hardware check/);
    const g = fixture(); g.direct.checks[0].ok = false; expect(() => validateEvidence(g)).toThrow(/direct check/);
  });
  it('refuses a diagnostic overlay and invalid manifest', () => {
    const f = fixture(); f.manifest.validationOverlay = {}; expect(() => validateEvidence(f)).toThrow(/diagnostic overlay/);
    const g = fixture(); g.manifest.entries[0].path = '../outside'; expect(() => validateEvidence(g)).toThrow(/unsafe path/);
  });
  it('holds the actual local bytes to the checked manifest before any upload', () => {
    const root = mkdtempSync(join(tmpdir(), 'bf2-publish-'));
    try {
      const bytes = Buffer.from('checked'), file = join(root, 'index.html'); writeFileSync(file, bytes);
      const manifest = { entries: [{ path: 'index.html', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }] };
      expect(verifyExportFiles(root, manifest)).toBe(1);
      writeFileSync(file, 'changed'); expect(() => verifyExportFiles(root, manifest)).toThrow(/bytes changed/);
      manifest.entries[0].path = '..\\outside'; expect(() => verifyExportFiles(root, manifest)).toThrow(/backslash/);
    } finally {
      expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
      rmSync(root, { recursive: true });
    }
  });
  it('pins the menu backdrop in its folder, and only JSON is parsed', () => {
    const root = mkdtempSync(join(tmpdir(), 'bf2-backdrop-'));
    try {
      for (const name of CONTRACT.rulebooks) writeFileSync(join(root, name), '{}');
      mkdirSync(join(root, 'backdrop'));
      writeFileSync(join(root, 'backdrop', 'backdrop.json'), '{"cameras":{}}');
      writeFileSync(join(root, 'backdrop', 'cam7-38mm.png'), 'not json');
      writeFileSync(join(root, 'notes.txt'), 'left out');
      const paths = readRulebooks(root).entries.map((entry) => entry.path);
      expect(paths).toContain('backdrop/backdrop.json');
      expect(paths).toContain('backdrop/cam7-38mm.png');
      expect(paths).not.toContain('notes.txt');
    } finally {
      expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
      rmSync(root, { recursive: true });
    }
  });
  it('pins every rulebook byte, including extra JSON used by the frontend', () => {
    const root = mkdtempSync(join(tmpdir(), 'bf2-rulebooks-'));
    try {
      for (const name of [...CONTRACT.rulebooks, 'ingame.json']) writeFileSync(join(root, name), '{}');
      const original = readRulebooks(root);
      expect(original.entries).toHaveLength(CONTRACT.rulebooks.length + 1);
      expect(() => validateRulebookDigest(original, original.sha256)).not.toThrow();
      writeFileSync(join(root, 'ingame.json'), '{"changed":true}');
      expect(() => validateRulebookDigest(readRulebooks(root), original.sha256)).toThrow(/digest/);
      expect(() => validateRulebookDigest(original)).toThrow(/digest/);
    } finally {
      expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
      rmSync(root, { recursive: true });
    }
  });
});

// The ruled-deviations route (../lib/bf2web-deviations.mjs): byte-identical with bf2-web's tools/gates/release-deviations.mjs,
// which gate-all reads for its receipt precondition; bf2-web's tools/gates/release-deviations.test.mjs pins the same digests and
// runs the same case table. Digests over LF-normalised text (core.autocrlf checkouts hold CRLF in the working tree).
const PINNED = { module: '9922f80d9a11fc98cb7cc74d99cbf1ca2d9c0d36ecd621cca502551c7b750b51', cases: '4e29a0f8b00d9cfcf098740be2699ce6ba327ac4952acff9ce5c1c58ea30fe06' };
const libDigest = (name) => createHash('sha256').update(readFileSync(fileURLToPath(new URL(`../lib/${name}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
describe('publishing a build with ruled deviations', () => {
  it('runs the copy pinned in both repos', () => {
    expect(libDigest('bf2web-deviations.mjs')).toBe(PINNED.module);
    expect(libDigest('bf2web-deviations.cases.mjs')).toBe(PINNED.cases);
  });
  it.each(CASES.map((c) => [c.name, c]))('%s', (_, c) => {
    const r = runCase(finishedReceipt, c);
    if (c.refuses) { expect(r.finished).toBe(false); expect(r.reason).toMatch(c.refuses); }
    else { expect(r.finished).toBe(true); expect(r.deviations.flatMap((d) => d.lines)).toEqual(c.lines); expect(deviationLines(r)).toHaveLength(c.lines.length); }
  });
  const failed = (receipt) => { const f = fixture(); f.build.passed = false; f.build.steps.push({ name: 'solutions-gate', ok: false }); return { ...f, receipt }; };
  it('passes a passed:false build only with a finished receipt', () => {
    expect(validateEvidence(failed({ finished: true, file: 'release-deviations-1071-aaaaaaaa.json', deviations: [{ step: 'solutions-gate', lines: [RULED] }] }))).toBe(true);
  });
  it('refuses a passed:false build with the receipt\'s reason, or with none', () => {
    expect(() => validateEvidence(failed({ finished: false, reason: 'failed steps not listed in x: verify', deviations: [] }))).toThrow(/the build did not pass: failed steps not listed in x: verify/);
    expect(() => validateEvidence(failed(undefined))).toThrow(/the build did not pass/);
  });
  it('a clean build needs no receipt, and a required step that failed still refuses', () => {
    expect(validateEvidence(fixture())).toBe(true);
    const f = failed({ finished: true, deviations: [] }); f.build.steps.find((s) => s.name === 'verify').ok = false;
    expect(() => validateEvidence(f)).toThrow(/hardware check/);
  });
});

// r1076's publish (run 44671253799, 19 Nov): the bucket's ui-data held the uploader's brotli copies of the 18 *.tone.bin
// (<path>.br), which matched no local path, so a correct upload was refused as 'the published rulebook selection differs'.
describe('the published ui-data selection', () => {
  const prefix = 'sites/r1/ui-data/';
  const tone = Buffer.alloc(4096, 7), json = Buffer.from('{"a":1}');
  const hash = (b) => createHash('sha256').update(b).digest('hex');
  const entries = [{ path: 'backdrop/cam2.tone.bin', bytes: tone.length, sha256: hash(tone) }, { path: 'info.json', bytes: json.length, sha256: hash(json) }];
  const store = (objects) => ({ objects: Object.entries(objects).map(([k, body]) => ({ key: prefix + k, size: body.length })),
    get: async (key) => (key.slice(prefix.length) in objects ? { body: new Uint8Array(objects[key.slice(prefix.length)]) } : null) });
  it('maps a key to its rulebook, and a .br of a .bin to that .bin', () => {
    expect(publishedRulebook(entries, prefix, prefix + 'info.json')).toEqual({ entry: entries[1], brotli: false });
    expect(publishedRulebook(entries, prefix, prefix + 'backdrop/cam2.tone.bin.br')).toEqual({ entry: entries[0], brotli: true });
    expect(publishedRulebook(entries, prefix, prefix + 'info.json.br')).toBe(null);
    expect(publishedRulebook(entries, prefix, prefix + 'stray.bin.br')).toBe(null);
    expect(publishedRulebook(entries, prefix, 'sites/other/ui-data/info.json')).toBe(null);
  });
  it('accepts the files and the brotli copy of a .bin whose decoded bytes are that rulebook', async () => {
    const s = store({ 'backdrop/cam2.tone.bin': tone, 'backdrop/cam2.tone.bin.br': brotliCompressSync(tone), 'info.json': json });
    await expect(verifyPublishedRulebooks(entries, prefix, s.objects, s.get)).resolves.toBe(undefined);
  });
  it('refuses a brotli copy that decodes to other bytes, or does not decode', async () => {
    const other = store({ 'backdrop/cam2.tone.bin.br': brotliCompressSync(Buffer.alloc(4096, 8)) });
    await expect(verifyPublishedRulebooks(entries, prefix, other.objects, other.get)).rejects.toThrow(/published rulebook bytes differ/);
    const junk = store({ 'backdrop/cam2.tone.bin.br': Buffer.from('not brotli at all') });
    await expect(verifyPublishedRulebooks(entries, prefix, junk.objects, junk.get)).rejects.toThrow(/published rulebook bytes differ/);
  });
  it('still refuses a stray object, a .br of a json, and a file at another size', async () => {
    for (const objects of [{ 'stray.json': json }, { 'info.json.br': brotliCompressSync(json) }, { 'info.json': Buffer.from('{"a":12}') }]) {
      const s = store(objects);
      await expect(verifyPublishedRulebooks(entries, prefix, s.objects, s.get)).rejects.toThrow(/the published rulebook selection differs/);
    }
  });
});
