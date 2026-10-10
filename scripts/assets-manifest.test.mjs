import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assetManifest from './assets-manifest.mjs';
import { hashOf } from './assets-upload.mjs';

function project() {
  const root = mkdtempSync(join(tmpdir(), 'assets-man-'));
  mkdirSync(join(root, 'public/kit'), { recursive: true });
  mkdirSync(join(root, 'src/data'), { recursive: true });
  const buf = Buffer.alloc(70_000, 1);
  writeFileSync(join(root, 'public/kit/a.glb'), buf);
  const manifest = { 'kit/a.glb': { hash: hashOf(buf), bytes: 70_000 }, 'kit/b.glb': { hash: 'ffffffffffff', bytes: 1 } };
  writeFileSync(join(root, 'src/data/assets-manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}
const made = (root, base) => {
  const p = assetManifest();
  p.configResolved({ root, publicDir: join(root, 'public'), env: base ? { VITE_ASSET_BASE: base } : {} });
  return p;
};

describe('the manifest the build bundles', () => {
  it('with a base, holds only the entries whose file on disk has that hash', () => {
    const { root, manifest } = project();
    const out = made(root, 'https://bucket.test').load(join(root, 'src/data/assets-manifest.json'));
    expect(JSON.parse(out)).toEqual({ 'kit/a.glb': manifest['kit/a.glb'] });
  });

  it('without one, is empty, so the bundle carries nothing it will not use', () => {
    const { root } = project();
    expect(made(root, '').load(join(root, 'src/data/assets-manifest.json'))).toBe('{}');
  });

  // (Vite asks with forward slashes on every platform; node's join gives
  // Windows backslashes: a Windows checkout once got '{}' for the manifest
  // and asked the site for every bucket file)
  it('answers the id Vite asks with, forward slashes, on a Windows root too', () => {
    const { root } = project();
    const id = join(root, 'src/data/assets-manifest.json').replace(/\\/g, '/');
    expect(made(root, 'https://bucket.test').load(id)).not.toBeNull();
    expect(made(root, 'https://bucket.test').load(`${id}?import`)).not.toBeNull();
  });

  it('leaves every other file to the other plugins', () => {
    const { root } = project();
    expect(made(root, 'https://bucket.test').load(join(root, 'src/data/modelCredits.json'))).toBeNull();
  });
});

describe('a check’s own manifest', () => {
  it('is read in place of the committed one when ASSET_MANIFEST names it', () => {
    const { root, manifest } = project();
    const other = join(root, 'other.json');
    writeFileSync(other, JSON.stringify({ 'kit/a.glb': manifest['kit/a.glb'] }));
    writeFileSync(join(root, 'src/data/assets-manifest.json'), '{}');
    process.env.ASSET_MANIFEST = other;
    try {
      expect(JSON.parse(made(root, 'https://bucket.test').load(join(root, 'src/data/assets-manifest.json')))).toEqual({ 'kit/a.glb': manifest['kit/a.glb'] });
    } finally {
      delete process.env.ASSET_MANIFEST;
    }
  });
});

describe('the game-derived files the bucket alone holds', () => {
  it('are bundled beside the mirrored ones: absent here taken on their word, edited here dropped', () => {
    const { root, manifest } = project();
    mkdirSync(join(root, 'public/models/galaxy/crew'), { recursive: true });
    writeFileSync(join(root, 'public/models/galaxy/crew/edited.glb'), 'made again');
    writeFileSync(
      join(root, 'src/data/galaxyAssets.json'),
      JSON.stringify({
        'models/galaxy/crew/luke.glb': { hash: 'aaaaaaaaaaaa', bytes: 9, from: 'characters/hero/luke', tier: 'crew' },
        'models/galaxy/crew/edited.glb': { hash: 'bbbbbbbbbbbb', bytes: 3, from: 'x', tier: 'crew' },
      }),
    );
    const out = JSON.parse(made(root, 'https://bucket.test').load(join(root, 'src/data/assets-manifest.json')));
    expect(out).toEqual({ 'kit/a.glb': manifest['kit/a.glb'], 'models/galaxy/crew/luke.glb': { hash: 'aaaaaaaaaaaa', bytes: 9 } });
    // (and without a base, still nothing)
    expect(made(root, '').load(join(root, 'src/data/assets-manifest.json'))).toBe('{}');
  });
});
