// ADD-ONLY upload of named export files to the asset bucket, for the bf2web.yml `assets` stage on the desktop runner (which has
// the files locally; the R2 keys exist only as this repo's Actions secrets). 12 Nov 2026: the Equip Cards screen showed black
// cards for seven heroes because 63 card PNGs were never in bf2017-assets (also on r1069).
//
//   node scripts/desktop/bf2web-assets.mjs --root <dir> --list <file> [--bucket bf2017-assets] [--prefix web/] [--dry]
//
//   root    the folder the list's paths are under (the export's web/ folder on the desktop)
//   list    the paths, one a line, relative to root (scripts/desktop/assets/*.txt)
//
// Every key is asked first (a HEAD, signed as every script signs it): only a 404 is sent; a key the bucket holds is skipped
// WHATEVER its size (bucket-put.mjs would re-send a size mismatch: here nothing is ever overwritten); any other answer (an
// error, a 403) stops the run before a single PUT. A listed file missing on disk stops it too. The sends are bucket-put.mjs's
// putAll (four at a time, retried); each sent key is asked again afterwards and must answer 200 at the file's size.
// Prints "ASSETS uploaded N · skipped M (already in the bucket) · failed K"; exit 1 on any failure, 2 on usage.
//
// addOnly({ root, items, pool, fetch, bucket, log }) → { uploaded, skipped, failed: [{ key, error }], sent: [key] }

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../lib/args.mjs';
import { NO_KEYS, bucketEnv, objectUrl } from '../lib/bucket.mjs';
import { createPool } from '../lib/pool.mjs';
import { plan, putAll } from '../bucket-put.mjs';

export async function addOnly({ root, items, pool, fetch, bucket, log = console.log }) {
  const out = { uploaded: 0, skipped: 0, failed: [], sent: [] };
  const missingOnDisk = items.filter(({ path }) => !existsSync(join(root, path)));
  if (missingOnDisk.length) {
    out.failed.push(...missingOnDisk.map(({ key }) => ({ key, error: 'not on disk' })));
    return out;
  }
  const heads = await Promise.all(items.map(async (it) => ({ it, h: await pool.run({ url: objectUrl(bucket, it.key), method: 'HEAD', fetch }) })));
  const unknown = heads.filter(({ h }) => h.status !== 'missing' && h.status !== 'fetched');
  if (unknown.length) {
    out.failed.push(...unknown.map(({ it, h }) => ({ key: it.key, error: `HEAD ${h.http ?? ''} ${h.error ?? h.status}`.trim() })));
    return out;
  }
  const absent = heads.filter(({ h }) => h.status === 'missing').map(({ it }) => it);
  out.skipped = heads.length - absent.length;
  for (const { it } of heads.filter(({ h }) => h.status === 'fetched')) log(`  skip ${it.key} (already in the bucket)`);
  if (!absent.length) return out;
  const r = await putAll({ root, items: absent, pool, fetch, bucket, log });
  out.failed.push(...r.failed.map(({ path, error }) => ({ key: absent.find((x) => x.path === path)?.key ?? path, error })));
  // each sent key asked again: 200 at the file's size
  const failedPaths = new Set(r.failed.map(({ path }) => path));
  for (const it of absent.filter(({ path }) => !failedPaths.has(path))) {
    const h = await pool.run({ url: objectUrl(bucket, it.key), method: 'HEAD', fetch });
    const bytes = statSync(join(root, it.path)).size;
    if (h.status === 'fetched' && Number(h.headers.get('content-length')) === bytes) {
      out.uploaded++;
      out.sent.push(it.key);
    } else out.failed.push({ key: it.key, error: `after the PUT the HEAD answered ${h.status} ${h.http ?? ''} ${h.headers?.get?.('content-length') ?? ''} (file ${bytes})` });
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.root !== 'string' || typeof args.list !== 'string') {
    console.error('usage: node scripts/desktop/bf2web-assets.mjs --root <dir> --list <file> [--bucket bf2017-assets] [--prefix web/] [--dry]');
    return 2;
  }
  const root = resolve(args.root);
  const bucket = typeof args.bucket === 'string' ? args.bucket : 'bf2017-assets';
  const items = plan(readFileSync(args.list, 'utf8').split('\n'), typeof args.prefix === 'string' ? args.prefix : 'web/');
  console.log(`${items.length} files listed for ${bucket} (add-only: a key the bucket holds is never sent)`);
  if (args.dry) {
    for (const i of items) console.log(`  listed ${i.key}${existsSync(join(root, i.path)) ? '' : '  (NOT ON DISK)'}`);
    return 0;
  }
  const env = bucketEnv();
  if (!env) {
    console.error(NO_KEYS);
    return 2;
  }
  const r = await addOnly({ root, items, pool: createPool({ size: 4 }), fetch: env.fetch, bucket });
  for (const f of r.failed) console.log(`  FAILED ${f.key}: ${f.error}`);
  console.log(`ASSETS uploaded ${r.uploaded} · skipped ${r.skipped} (already in the bucket) · failed ${r.failed.length}`);
  return r.failed.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e.message);
      process.exit(1);
    },
  );
}
