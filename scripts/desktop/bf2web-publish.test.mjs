import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CONTRACT } from '../lib/bf2web-site.mjs';
import { readRulebooks, validateEvidence, validateRulebookDigest, verifyExportFiles } from './bf2web-publish.mjs';
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
