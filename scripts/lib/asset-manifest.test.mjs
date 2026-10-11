import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAME, KEPT, bytesOf, diff, folderOf, freshGalaxy, gameFiles, hashOf, ignoreBlock, onSite, publishedPath, readManifest, wholeFolder, writeManifest } from './asset-manifest.mjs';
import { remotePath } from '../../src/lib/assetPath.js';

const dirs = [];
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), 'asset-manifest-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const put = (dir, path, body) => {
  const abs = join(dir, path);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
};

describe('the published assets’ manifest', () => {
  it('names a file by the first twelve hex of its sha256, as the asset bucket does', () => {
    expect(hashOf(Buffer.from('abc'))).toBe('ba7816bf8f01');
  });

  it('puts a published file at <hash>/<path>, where the service worker and the installer already look', () => {
    expect(publishedPath('/models/galaxy/crew/luke.glb', 'abcdef123456')).toBe('abcdef123456/models/galaxy/crew/luke.glb');
    expect(publishedPath('models/galaxy/crew/luke.glb', 'abcdef123456')).toBe('abcdef123456/models/galaxy/crew/luke.glb');
  });

  it('says what is new, changed, the same and gone', () => {
    const manifest = { a: { hash: '1', bytes: 1 }, c: { hash: '3', bytes: 3 }, d: { hash: '4', bytes: 4 } };
    const files = [
      { path: 'a', hash: '2', bytes: 1 },
      { path: 'b', hash: '5', bytes: 5 },
      { path: 'c', hash: '3', bytes: 3 },
    ];
    const d = diff(manifest, files);
    expect(d.change.map((f) => f.path)).toEqual(['a']);
    expect(d.add.map((f) => f.path)).toEqual(['b']);
    expect(d.same.map((f) => f.path)).toEqual(['c']);
    expect(d.gone).toEqual(['d']);
  });

  it('writes the manifest with its keys sorted, and reads it back (nothing there: empty)', () => {
    const dir = scratch();
    const file = join(dir, 'galaxyAssets.json');
    expect(readManifest(file)).toEqual({});
    writeManifest(file, { 'models/b.glb': { hash: 'b', bytes: 2, from: 'x', tier: 'crew' }, 'models/a.glb': { hash: 'a', bytes: 1, from: 'y', tier: 'surface' } });
    const text = readFileSync(file, 'utf8');
    expect(text.indexOf('models/a.glb')).toBeLessThan(text.indexOf('models/b.glb'));
    expect(text.endsWith('}\n')).toBe(true);
    expect(readManifest(file)['models/a.glb']).toEqual({ hash: 'a', bytes: 1, from: 'y', tier: 'surface' });
  });

  it('rewrites only the marked block of .gitignore, everything outside it byte for byte', () => {
    const before = 'node_modules\n# galaxy assets (published; scripts/assets-publish.mjs)\n/public/old.glb\n# end galaxy assets\n*.local\n';
    expect(ignoreBlock(before, ['models/galaxy/crew/b.glb', 'models/galaxy/crew/a.glb'])).toBe(
      'node_modules\n# galaxy assets (published; scripts/assets-publish.mjs)\n/public/models/galaxy/crew/a.glb\n/public/models/galaxy/crew/b.glb\n# end galaxy assets\n*.local\n',
    );
    // (no block yet: one is added at the end)
    expect(ignoreBlock('a\nb', [])).toBe('a\nb\n\n# galaxy assets (published; scripts/assets-publish.mjs)\n# end galaxy assets\n');
  });

  it('finds the game-derived files by their credit, with every cut beside each and its tier', () => {
    const pub = scratch();
    put(pub, 'models/galaxy/crew/luke.glb', 'luke');
    put(pub, 'models/galaxy/crew/luke.lod1.glb', 'l1');
    put(pub, 'models/galaxy/crew/luke.far.glb', 'far');
    put(pub, 'models/galaxy/surface/hilt.glb', 'hilt');
    put(pub, 'models/galaxy/surface/hilt.ultra.glb', 'hilt ultra');
    put(pub, 'models/galaxy/surface/meshy.glb', 'meshy');
    put(pub, 'models/galaxy/bf2017/clips/humanoid.glb', 'pack');
    put(pub, 'films/bf2017/planet-hoth-01.webm', 'film');
    put(pub, 'films/bf2017/planet-hoth-01.webp', 'poster');
    const credits = {
      'crew-luke': { title: 'Star Wars Battlefront II (2017): characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh', source: GAME, file: '/models/galaxy/crew/luke.glb' },
      'surface-hilt': { title: 'Star Wars Battlefront II (2017): gameplay/hilt_mesh', source: GAME, file: '/models/galaxy/surface/hilt.glb' },
      'surface-meshy': { title: 'A Meshy model', source: 'https://meshy.ai', file: '/models/galaxy/surface/meshy.glb' },
      'surface-gone': { title: 'Star Wars Battlefront II (2017): x', source: GAME, file: '/models/galaxy/surface/gone.glb' },
    };
    const got = gameFiles(credits, pub);
    expect(got.map((f) => [f.path, f.tier, f.from])).toEqual([
      ['films/bf2017/planet-hoth-01.webm', 'film', 'films/bf2017/planet-hoth-01.webm'],
      ['models/galaxy/bf2017/clips/humanoid.glb', 'pack', 'models/galaxy/bf2017/clips/humanoid.glb'],
      ['models/galaxy/crew/luke.far.glb', 'crew', 'characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh'],
      ['models/galaxy/crew/luke.glb', 'crew', 'characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh'],
      ['models/galaxy/crew/luke.lod1.glb', 'crew', 'characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh'],
      ['models/galaxy/surface/hilt.glb', 'surface', 'gameplay/hilt_mesh'],
      ['models/galaxy/surface/hilt.ultra.glb', 'ultra', 'gameplay/hilt_mesh'],
    ]);
    expect(got.find((f) => f.path === 'models/galaxy/crew/luke.glb')).toMatchObject({ bytes: 4, hash: hashOf(Buffer.from('luke')) });
  });

  it('keeps a published entry whose file is not here (a checkout never has them), drops one whose file here has changed', () => {
    const pub = scratch();
    put(pub, 'models/galaxy/crew/same.glb', 'same');
    put(pub, 'models/galaxy/crew/edited.glb', 'edited since');
    const manifest = {
      'models/galaxy/crew/absent.glb': { hash: 'aaaaaaaaaaaa', bytes: 9, from: 'x', tier: 'crew' },
      'models/galaxy/crew/same.glb': { hash: hashOf(Buffer.from('same')), bytes: 4, from: 'x', tier: 'crew' },
      'models/galaxy/crew/edited.glb': { hash: 'bbbbbbbbbbbb', bytes: 6, from: 'x', tier: 'crew' },
    };
    expect(Object.keys(freshGalaxy(manifest, pub)).sort()).toEqual(['models/galaxy/crew/absent.glb', 'models/galaxy/crew/same.glb']);
  });

  it('measures a file on disk when it is there, else by the manifest, else says which is missing', () => {
    const pub = scratch();
    put(pub, 'models/a.glb', 'abc');
    const manifest = { 'models/b.glb': { hash: 'x', bytes: 70 } };
    expect(bytesOf('/models/a.glb', { publicDir: pub, manifest })).toBe(3);
    expect(bytesOf('/models/b.glb', { publicDir: pub, manifest })).toBe(70);
    expect(() => bytesOf('/models/c.glb', { publicDir: pub, manifest })).toThrow(/models\/c\.glb/);
  });

  it('knows a file is the site’s when it is on disk or published, and nowhere else', () => {
    const pub = scratch();
    put(pub, 'models/a.glb', 'abc');
    const manifest = { 'models/b.glb': { hash: 'x', bytes: 70 } };
    expect(onSite('/models/a.glb', { publicDir: pub, manifest })).toBe(true);
    expect(onSite('models/b.glb', { publicDir: pub, manifest })).toBe(true);
    expect(onSite('/models/c.glb', { publicDir: pub, manifest })).toBe(false);
  });

  it('keeps the skeleton and the packs the tests read whole in git, published or not', () => {
    const [kept] = KEPT;
    const text = ignoreBlock('', [kept, 'models/galaxy/bf2017/crew/luke.glb']);
    expect(text).toContain('/public/models/galaxy/bf2017/crew/luke.glb');
    expect(text).not.toContain(`/public/${kept}`);
    expect([...KEPT]).toContain('models/galaxy/bf2017/walrus.glb');
  });
  it('takes a level pack’s cuts and leaves its level.json and README in git', () => {
    const pub = scratch();
    put(pub, 'models/galaxy/bf2017/levels/hoth/level.json', '{}');
    put(pub, 'models/galaxy/bf2017/levels/hoth/README.md', '# hoth');
    put(pub, 'models/galaxy/bf2017/levels/hoth/cells/0_0.bin', 'cell');
    put(pub, 'models/galaxy/bf2017/levels/hoth/base/level.json', '{}');
    put(pub, 'models/galaxy/bf2017/levels/hoth/base/lights.json', '{}');
    // (and its credit, which names its level.json, does not publish it either)
    const got = gameFiles({ 'level-hoth-base': { source: GAME, file: '/models/galaxy/bf2017/levels/hoth/base/level.json' } }, pub).map((f) => f.path);
    expect(got).toEqual(['models/galaxy/bf2017/levels/hoth/base/lights.json', 'models/galaxy/bf2017/levels/hoth/cells/0_0.bin']);
  });
});

describe('a whole level’s pack, published as one folder (lane G2)', () => {
  const W = 'models/galaxy/bf2017/levels/hoth/game/hoth_01/';
  const pack = () => {
    const pub = scratch();
    put(pub, `${W}level.json`, '{"whole":true}\n');
    put(pub, `${W}README.md`, '# hoth_01\n');
    put(pub, `${W}cells/0_0.bin`, 'cell');
    put(pub, `${W}nav.bin`, 'nav');
    put(pub, 'models/galaxy/bf2017/levels/hoth/cells/0_0.bin', 'roam');
    return pub;
  };

  it('is one row for the folder: its files, their bytes, one hash over them all, held by its level.json', () => {
    const pub = pack();
    const f = wholeFolder(pub, W);
    expect(f.path).toBe(W);
    expect(f.files.map((x) => x.path.slice(W.length))).toEqual(['README.md', 'cells/0_0.bin', 'level.json', 'nav.bin']);
    expect(f.row).toMatchObject({ files: 4, bytes: 15 + 10 + 4 + 3, tier: 'whole', check: { file: 'level.json', bytes: 15, hash: hashOf(Buffer.from('{"whole":true}\n')) } });
    // (a file changed is a new folder)
    put(pub, `${W}nav.bin`, 'nav2');
    expect(wholeFolder(pub, W).row.hash).not.toBe(f.row.hash);
    expect(() => wholeFolder(pub, 'models/galaxy/bf2017/levels/hoth/game/none/')).toThrow(/level\.json/);
  });

  it('is never in the per-file publish: the roam pack’s files are, the whole pack’s are not', () => {
    const got = gameFiles({}, pack()).map((f) => f.path);
    expect(got).toEqual(['models/galaxy/bf2017/levels/hoth/cells/0_0.bin']);
  });

  it('sends a file under it to the folder’s hash, and finds the row a file is under', () => {
    const manifest = { [W]: { hash: 'abcdef123456', bytes: 32 }, 'kit/crate.glb': { hash: 'aaaaaaaaaaaa', bytes: 1 } };
    expect(remotePath(`/${W}cells/0_0.bin`, 'https://cdn.test/b', manifest)).toBe(`https://cdn.test/b/abcdef123456/${W}cells/0_0.bin`);
    expect(remotePath('/kit/crate.glb', 'https://cdn.test/b', manifest)).toBe('https://cdn.test/b/aaaaaaaaaaaa/kit/crate.glb');
    expect(remotePath('/models/galaxy/bf2017/levels/hoth/level.json', 'https://cdn.test/b', manifest)).toBe('/models/galaxy/bf2017/levels/hoth/level.json');
    expect(folderOf(manifest, `${W}tex/a.512.ktx2`)).toBe(manifest[W]);
    expect(onSite(`${W}tex/a.512.ktx2`, { publicDir: scratch(), manifest })).toBe(true);
  });

  it('hides the folder from git but its level.json and README, and a build drops it when its level.json was made again', () => {
    const text = ignoreBlock('', [W, 'models/x.glb']);
    expect(text).toContain(`/public/${W}*\n!/public/${W}level.json\n!/public/${W}README.md`);
    expect(text).toContain('/public/models/x.glb');
    const pub = pack();
    const row = wholeFolder(pub, W).row;
    expect(Object.keys(freshGalaxy({ [W]: row }, pub))).toEqual([W]);
    put(pub, `${W}level.json`, '{"whole":true,"again":1}\n');
    expect(Object.keys(freshGalaxy({ [W]: row }, pub))).toEqual([]);
    // (and a checkout without the folder takes the manifest's word)
    expect(Object.keys(freshGalaxy({ [W]: row }, scratch()))).toEqual([W]);
  });
});
