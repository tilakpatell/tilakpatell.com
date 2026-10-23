import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import siteHashes, { MANIFEST, pictureHashes } from './site-hashes.mjs';
import { hashOf } from './assets-upload.mjs';

function project({ bucket = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'site-hashes-'));
  for (const d of ['public/textures/universe', 'public/cc0/rock', 'public/hdri', 'public/models', 'src/data']) mkdirSync(join(root, d), { recursive: true });
  const put = (p, body) => writeFileSync(join(root, 'public', p), body);
  put('textures/universe/earth.webp', 'earth');
  put('textures/universe/notes.md', 'not a picture');
  put('cc0/rock/albedo.webp', 'rock');
  put('hdri/sky.hdr', 'sky');
  put('models/ship.glb', 'a model');
  writeFileSync(join(root, MANIFEST), '{}');
  writeFileSync(join(root, 'src/data/assets-manifest.json'), JSON.stringify(bucket));
  return root;
}
const made = (root, { command = 'build', base = '' } = {}) => {
  const p = siteHashes();
  p.configResolved({ root, publicDir: join(root, 'public'), command, env: base ? { VITE_ASSET_BASE: base } : {} });
  return p;
};
const resolveCtx = (root) => ({ resolve: async () => ({ id: join(root, MANIFEST) }) });

describe('the worlds’ pictures under their hash', () => {
  it('hashes every picture in the pictures’ folders, and nothing else', () => {
    const root = project();
    expect(pictureHashes(join(root, 'public'))).toEqual({
      'cc0/rock/albedo.webp': hashOf(Buffer.from('rock')),
      'hdri/sky.hdr': hashOf(Buffer.from('sky')),
      'textures/universe/earth.webp': hashOf(Buffer.from('earth')),
    });
  });

  it('leaves out what the bucket holds, which is a year there already', () => {
    const root = project({ bucket: { 'cc0/rock/albedo.webp': { hash: hashOf(Buffer.from('rock')), bytes: 4 } } });
    expect(Object.keys(pictureHashes(join(root, 'public'), { skip: { 'cc0/rock/albedo.webp': {} } }))).not.toContain('cc0/rock/albedo.webp');
  });

  it('gives the build the hashes as one JSON.parse, and the development server nothing', async () => {
    const root = project();
    const p = made(root);
    const id = await p.resolveId.call(resolveCtx(root), '../data/site-hashes.json', join(root, 'src/lib/assetBase.js'), {});
    expect(id).toBeTruthy();
    const code = p.load(id);
    expect(code).toMatch(/^export default JSON\.parse\(/);
    expect(JSON.parse(JSON.parse(code.slice('export default JSON.parse('.length, -2)))['textures/universe/earth.webp']).toBe(hashOf(Buffer.from('earth')));
    const dev = made(root, { command: 'serve' });
    expect(await dev.resolveId.call(resolveCtx(root), '../data/site-hashes.json', join(root, 'src/lib/assetBase.js'), {})).toBeNull();
  });

  it('copies each picture under its hash beside the build’s files', () => {
    const root = project();
    const p = made(root);
    const dist = join(root, 'dist');
    p.writeBundle({ dir: dist });
    const h = hashOf(Buffer.from('earth'));
    expect(readFileSync(join(dist, 'h', h, 'textures/universe/earth.webp'), 'utf8')).toBe('earth');
    expect(existsSync(join(dist, 'h', hashOf(Buffer.from('a model')), 'models/ship.glb'))).toBe(false);
  });
});
