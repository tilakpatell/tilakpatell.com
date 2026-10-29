import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CONTRACT } from '../lib/bf2web-site.mjs';
import { readRulebooks, validateEvidence, validateRulebookDigest, verifyExportFiles } from './bf2web-publish.mjs';

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
