import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshManifest, hashOf, manifestOf, planUpload, r2Bucket, readManifest, remoteFiles, run, writeManifest } from './assets-upload.mjs';
import { ENDPOINT } from './lib/bucket.mjs';

const SCRIPT = fileURLToPath(new URL('./assets-upload.mjs', import.meta.url));
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const bytes = (n, fill = 1) => Buffer.alloc(n, fill);
// a checkout in a temp folder: two files big enough to go, and three that stay
function tree() {
  const root = mkdtempSync(join(tmpdir(), 'assets-up-'));
  const put = (path, buf) => {
    mkdirSync(join(root, 'public', path, '..'), { recursive: true });
    writeFileSync(join(root, 'public', path), buf);
  };
  put('kit/big.glb', bytes(70_000, 1));
  put('hq/tex/rock.jpg', bytes(90_000, 2));
  put('kit/small.glb', bytes(1_000, 3)); // under 64 KB: stays
  put('kit/kit.json', bytes(70_000, 4)); // not a heavy kind: stays
  put('textures/big.jpg', bytes(70_000, 5)); // not in the list: stays
  return root;
}

// the bucket as run() asks of it (r2Bucket's face), over a Map
function fakeBucket(keys = []) {
  const objects = new Map(keys.map((k) => [k, 'model/gltf-binary']));
  const calls = { upload: [], remove: [] };
  return {
    objects,
    calls,
    keys: async () => [...objects.keys()],
    async upload(key, body, type) {
      calls.upload.push({ key, bytes: body.length, type });
      objects.set(key, type);
    },
    async remove(list) {
      calls.remove.push(...list);
      for (const k of list) objects.delete(k);
    },
  };
}

describe('the asset upload', () => {
  it('names a file by the first twelve hex of its sha256', () => {
    expect(hashOf(Buffer.from('abc'))).toBe('ba7816bf8f01');
  });

  it('takes the heavy kinds under the listed folders, 64 KB and over, and nothing else', () => {
    const files = remoteFiles(join(tree(), 'public'));
    expect(files.map((f) => f.path)).toEqual(['hq/tex/rock.jpg', 'kit/big.glb']);
    expect(files[1]).toEqual({ path: 'kit/big.glb', bytes: 70_000, hash: hashOf(bytes(70_000, 1)) });
  });

  it('uploads only what the bucket lacks and prunes only what nothing names', () => {
    const files = [
      { path: 'kit/a.glb', hash: 'aaaaaaaaaaaa', bytes: 1 },
      { path: 'kit/b.glb', hash: 'bbbbbbbbbbbb', bytes: 2 },
    ];
    const plan = planUpload(files, ['aaaaaaaaaaaa/kit/a.glb', '000000000000/kit/a.glb', 'cccccccccccc/kit/c.glb']);
    expect(plan.upload.map((f) => f.path)).toEqual(['kit/b.glb']);
    expect(plan.keep.map((f) => f.path)).toEqual(['kit/a.glb']);
    expect(plan.prune).toEqual(['000000000000/kit/a.glb', 'cccccccccccc/kit/c.glb']);
  });

  it('writes the manifest sorted and reads it back the same', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'assets-man-')), 'm.json');
    const m = manifestOf([
      { path: 'kit/b.glb', hash: 'bbbbbbbbbbbb', bytes: 2 },
      { path: 'hq/a.jpg', hash: 'aaaaaaaaaaaa', bytes: 1 },
    ]);
    writeManifest(file, m);
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')))).toEqual(['hq/a.jpg', 'kit/b.glb']);
    expect(readManifest(file)).toEqual({ 'hq/a.jpg': { hash: 'aaaaaaaaaaaa', bytes: 1 }, 'kit/b.glb': { hash: 'bbbbbbbbbbbb', bytes: 2 } });
    expect(readManifest(join(tmpdir(), 'no-such-manifest.json'))).toEqual({});
  });

  it('keeps for the build only the entries whose file on disk still has that hash', () => {
    const pub = join(tree(), 'public');
    const m = {
      'kit/big.glb': { hash: hashOf(bytes(70_000, 1)), bytes: 70_000 },
      'hq/tex/rock.jpg': { hash: 'ffffffffffff', bytes: 90_000 }, // changed since its upload
      'kit/gone.glb': { hash: 'eeeeeeeeeeee', bytes: 9 }, // deleted since
    };
    expect(freshManifest(m, pub)).toEqual({ 'kit/big.glb': m['kit/big.glb'] });
  });

  it('uploads the new, never a key the bucket holds, writes the manifest, and prunes only when asked', async () => {
    const root = tree();
    const big = hashOf(bytes(70_000, 1));
    const bucket = fakeBucket([`${big}/kit/big.glb`, '000000000000/kit/old.glb']);
    const said = [];
    const code = await run({ root, argv: [], env: {}, bucket, log: (s) => said.push(s) });
    expect(code).toBe(0);
    expect(bucket.calls.upload).toEqual([{ key: `${hashOf(bytes(90_000, 2))}/hq/tex/rock.jpg`, bytes: 90_000, type: 'image/jpeg' }]);
    expect(bucket.calls.remove).toEqual([]);
    expect(Object.keys(readManifest(join(root, 'src/data/assets-manifest.json')))).toEqual(['hq/tex/rock.jpg', 'kit/big.glb']);
    expect(said.join('\n')).toMatch(/remote: 2 files, 0\.2 MB/);
    expect(said.join('\n')).toMatch(/local: 3 files/);

    await run({ root, argv: ['--prune'], env: {}, bucket, deployed: {}, log: () => {} });
    expect(bucket.calls.remove).toEqual(['000000000000/kit/old.glb']);
  });

  it('never prunes a game-derived file the publish put in the same bucket', async () => {
    const root = tree();
    const big = hashOf(bytes(70_000, 1));
    const rock = hashOf(bytes(90_000, 2));
    mkdirSync(join(root, 'src/data'), { recursive: true });
    writeFileSync(join(root, 'src/data/galaxyAssets.json'), JSON.stringify({ 'models/galaxy/crew/luke.glb': { hash: 'dddddddddddd', bytes: 5, from: 'x', tier: 'crew' } }));
    const bucket = fakeBucket([`${big}/kit/big.glb`, `${rock}/hq/tex/rock.jpg`, 'dddddddddddd/models/galaxy/crew/luke.glb', '000000000000/kit/old.glb']);
    await run({ root, argv: ['--prune'], env: {}, bucket, deployed: {}, log: () => {} });
    expect(bucket.calls.remove).toEqual(['000000000000/kit/old.glb']);
  });

  it('never prunes what the deployed manifest still names', () => {
    const files = [{ path: 'kit/a.glb', hash: 'aaaaaaaaaaaa', bytes: 1 }];
    const deployed = { 'kit/a.glb': { hash: '000000000000', bytes: 1 } };
    expect(planUpload(files, ['000000000000/kit/a.glb', 'cccccccccccc/kit/c.glb'], deployed).prune).toEqual(['cccccccccccc/kit/c.glb']);
  });

  it('refuses to prune in a run that uploaded, or with no files on disk, or without the deployed manifest', async () => {
    const said = [];
    const log = (s) => said.push(s);
    const root = tree();
    const bucket = fakeBucket(['000000000000/kit/old.glb']);
    await run({ root, argv: ['--prune'], env: {}, bucket, deployed: {}, log });
    expect(bucket.calls.upload.length).toBe(2);
    expect(bucket.calls.remove).toEqual([]);
    expect(said.join('\n')).toMatch(/not pruning: this run uploaded/);

    const empty = mkdtempSync(join(tmpdir(), 'assets-empty-'));
    const full = fakeBucket(['aaaaaaaaaaaa/kit/a.glb']);
    await run({ root: empty, argv: ['--prune'], env: {}, bucket: full, deployed: {}, log });
    expect(full.calls.remove).toEqual([]);
    expect(said.join('\n')).toMatch(/not pruning: no files on disk/);

    const again = fakeBucket([...bucket.objects.keys()]);
    await run({ root, argv: ['--prune'], env: {}, bucket: again, deployed: null, log });
    expect(again.calls.remove).toEqual([]);
    expect(said.join('\n')).toMatch(/not pruning: no deployed manifest/);
  });

  it('on R2: lists every key, puts each with its type and a year’s cache, and deletes a prune one by one', async () => {
    const asked = [];
    const fetch = async (url, init = {}) => {
      asked.push([init.method ?? 'GET', url, init.headers]);
      return new Response(url.includes('list-type') ? '<ListBucketResult><Contents><Key>abc/kit/a.glb</Key><Size>3</Size></Contents><IsTruncated>false</IsTruncated></ListBucketResult>' : null);
    };
    const b = r2Bucket(fetch);
    expect(await b.keys()).toEqual(['abc/kit/a.glb']);
    await b.upload('def/kit/b.glb', Buffer.from('x'), 'model/gltf-binary');
    await b.remove(['abc/kit/a.glb', 'ghi/kit/c.glb']);
    expect(asked.slice(1).map(([m, u]) => [m, u])).toEqual([
      ['PUT', `${ENDPOINT}/tilak-assets/def/kit/b.glb`],
      ['DELETE', `${ENDPOINT}/tilak-assets/abc/kit/a.glb`],
      ['DELETE', `${ENDPOINT}/tilak-assets/ghi/kit/c.glb`],
    ]);
    expect(asked[1][2]).toEqual({ 'content-type': 'model/gltf-binary', 'cache-control': 'public, max-age=31536000, immutable' });
  });

  it('with --dry, uploads nothing and writes nothing', async () => {
    const root = tree();
    const bucket = fakeBucket();
    expect(await run({ root, argv: ['--dry', '--prune'], env: {}, bucket, log: () => {} })).toBe(0);
    expect(bucket.calls.upload).toEqual([]);
    expect(bucket.calls.remove).toEqual([]);
    expect(readManifest(join(root, 'src/data/assets-manifest.json'))).toEqual({});
  });

  it('refuses to run in CI, before it reads any key', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--dry'], { env: { PATH: process.env.PATH, CI: 'true' }, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/owner’s shell/);
  });

  it('without the key in the shell, says what to set and exits 2', () => {
    const r = spawnSync(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/R2_ACCESS_KEY_ID/);
  });

  it('no tracked file or workflow holds a secret key or its role', () => {
    // (spelt in halves, so this file is not its own match; git grep reads the
    // tracked text files, binaries skipped, fast enough for the full run)
    const words = ['sb_' + 'secret_', 'service' + '_role'];
    const run = spawnSync('git', ['grep', '-l', '-I', '-F', ...words.flatMap((w) => ['-e', w])], { cwd: ROOT, encoding: 'utf8' });
    // (exit 1: nothing found; 0: found; anything else: git itself failed)
    expect(run.status, run.stderr).not.toBe(128);
    expect(run.stdout.split('\n').filter(Boolean)).toEqual([]);
    expect(execFileSync('git', ['ls-files', '.github/workflows'], { cwd: ROOT, encoding: 'utf8' })).toMatch(/deploy\.yml/);
    // (a git grep over every tracked file: well under a second alone, past
    // vitest's 5 s default when the full run has the machine busy)
  }, 30000);
});
