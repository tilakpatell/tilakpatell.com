// The scripts' way into R2, tried against the real buckets: for each bucket
// named, its first page of keys listed and the first key asked for (a HEAD),
// each request signed as every script signs it (lib/bucket.mjs). The copy
// workflow runs it after the copy (.github/workflows/assets-to-r2.yml), so a
// signing fault shows there and not in a desktop job. One line a bucket;
// exit 1 when any failed. The keys never printed.
//
//   node scripts/bucket-check.mjs <bucket> […]
//
// probe(fetch, bucket) → { ok, keys, first, status, bytes } | { ok: false, error }
//   (an empty bucket listed is ok: the listing's 200 is the signing proved)

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_KEYS, bucketEnv, list, objectUrl } from './lib/bucket.mjs';

export async function probe(fetchImpl, bucket) {
  try {
    const { files } = await list(fetchImpl, bucket, '', { pages: 1 });
    if (!files.length) return { ok: true, keys: 0 };
    const first = files[0];
    const res = await fetchImpl(objectUrl(bucket, first.key), { method: 'HEAD' });
    const bytes = Number(res.headers.get('content-length'));
    return { ok: res.ok && bytes === first.size, keys: files.length, first: first.key, status: res.status, bytes };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  const buckets = process.argv.slice(2);
  if (!buckets.length) {
    console.error('usage: node scripts/bucket-check.mjs <bucket> […]');
    return 2;
  }
  const env = bucketEnv();
  if (!env) {
    console.error(NO_KEYS);
    return 2;
  }
  let bad = 0;
  for (const b of buckets) {
    const r = await probe(env.fetch, b);
    if (!r.ok) bad++;
    console.log(r.error ? `${b}: failed, ${r.error}` : !r.keys ? `${b}: listed, empty` : `${b}: ${r.keys} keys on the first page; ${r.first} HTTP ${r.status}, ${r.bytes} bytes${r.ok ? '' : ' (not the listing’s size)'}`);
  }
  return bad ? 1 : 0;
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
