// The drop's object library, indexed (scripts/lib/bf2017-library.mjs has
// what goes in and how a row is filed): reads the manifest that
// scripts/bf2017-fetch.mjs fetched and writes src/data/bf2017/library.json,
// one row a placeable object, sorted by name. Lane Z's ledger and the
// library's import read it; the site never loads it whole.
//
//   node scripts/bf2017-library.mjs [--root lab/assets/bf2017] [--tags <blueprint tags JSON>] [--out src/data/bf2017/library.json]
//   node scripts/bf2017-library.mjs --count     (rows by kind and set, nothing written)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { countRows, indexRows } from './lib/bf2017-library.mjs';
import { readManifest } from './lib/bf2017-manifest.mjs';
import { localPath } from './lib/bf2017-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LIBRARY = join(ROOT, 'src', 'data', 'bf2017', 'library.json');

export function readLibrary(file = LIBRARY) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
  const file = localPath(root, 'web/models.jsonl');
  if (!existsSync(file)) {
    console.error(`no manifest at ${file}: node scripts/bf2017-fetch.mjs manifest`);
    process.exit(1);
  }
  const tags = typeof args.tags === 'string' ? JSON.parse(readFileSync(args.tags, 'utf8')) : {};
  const rows = indexRows(readManifest(readFileSync(file, 'utf8')), { tags });
  const { kind, set } = countRows(rows);
  console.log(`${rows.length} rows`);
  console.log(
    Object.entries(kind)
      .map(([k, n]) => `  ${k} ${n}`)
      .join('\n'),
  );
  if (args.count) {
    console.log(
      Object.entries(set)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `  ${k} ${n}`)
        .join('\n'),
    );
  } else {
    const out = resolve(typeof args.out === 'string' ? args.out : LIBRARY);
    mkdirSync(dirname(out), { recursive: true });
    // (one row a line, so a diff names the objects that changed)
    writeFileSync(out, `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);
    console.log(`wrote ${out}`);
  }
}
