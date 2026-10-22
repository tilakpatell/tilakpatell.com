// One file from the 2017 drop's private bucket into lab/assets/bf2017/ (git-
// ignored), in the bucket's own layout, for the scripts that want a file by
// its path rather than a model by its manifest name (bf2017-fetch.mjs does
// those): the levels' probes, the role textures. The keys from the
// environment (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: lib/bucket.mjs),
// never printed; a file already on disk is not fetched again.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NO_KEYS, bucketEnv } from './bucket.mjs';
import { localPath, objectUrl } from './bf2017-paths.mjs';

export async function bucketFile(root, bucketPath) {
  const file = localPath(root, bucketPath);
  if (existsSync(file)) return file;
  const env = bucketEnv();
  if (!env) throw new Error(`${NO_KEYS} (to fetch ${bucketPath})`);
  const res = await env.fetch(objectUrl(env.base, 'bf2017-assets', bucketPath));
  if (!res.ok) throw new Error(`${bucketPath}: missing from the bucket (${res.status})`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
