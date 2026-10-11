// Build an asset manifest: walk a directory of built assets and emit the
// index the runtime streams from (see src/runtime/manifest.js) — canonical,
// forward-slash ids (so a Windows build and a POSIX build produce the same
// keys, the backslash-id bug), byte sizes for budgeting the boot slice, and a
// short content hash per file for cache-busting immutable objects.
//
// Uploading the objects and rows to the bucket is a separate step that needs
// the project's keys; this script only writes the JSON index.
//
//   node scripts/build-manifest.mjs <dir> [--out manifest.json]
//
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalId, kindForPath } from '../src/runtime/manifest.js';

export const hashBytes = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

export async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

export async function rowFor(file, root) {
  const buf = await readFile(file);
  const id = canonicalId(relative(root, file).split(sep).join('/'));
  return { id, path: id, bytes: buf.length, hash: hashBytes(buf), kind: kindForPath(id) };
}

// Build the manifest for a directory. Files that are not a known asset kind
// (no gltf/texture/audio extension) are skipped. `tier(row)` may assign a
// load tier per row; by default every row is left at the driver's 'lazy'.
export async function buildManifest(root, { tier = null } = {}) {
  const files = (await walk(root)).sort();
  const assets = [];
  for (const file of files) {
    const row = await rowFor(file, root);
    if (!row.kind) continue;
    if (tier) {
      const t = tier(row);
      if (t) row.tier = t;
    }
    assets.push(row);
  }
  return { version: 1, generatedAt: new Date().toISOString(), count: assets.length, assets };
}

async function main(argv) {
  const args = argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('usage: node scripts/build-manifest.mjs <dir> [--out manifest.json]');
    process.exitCode = 1;
    return;
  }
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : join(dir, 'manifest.json');
  const manifest = await buildManifest(dir);
  await writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest: ${manifest.count} assets -> ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv);
}
