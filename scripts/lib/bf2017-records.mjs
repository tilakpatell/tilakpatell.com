// The 2017 drop's records on disk (EA DICE's Battlefront II): a record by
// its path, as the drop keeps it (`<root>/web/data/<path>.json`) or the
// fetch does (`<root>/data/<path>.json`, or `.json.gz`). Windows' file system
// matches without case, as the parsers do; elsewhere the path's own case is
// tried as given.
//
//   readRecordAt(root) → (path) → record | null
//   indexAt(root) → [{ name, type, path }] (data.tsv: every record's name and type)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

export function readRecordAt(root) {
  return (path) => {
    for (const at of [`web/data/${path}.json`, `data/${path}.json`]) {
      const file = join(root, at);
      if (!existsSync(file)) continue;
      try {
        return JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        return null;
      }
    }
    const gz = join(root, `data/${path}.json.gz`);
    if (existsSync(gz)) return JSON.parse(gunzipSync(readFileSync(gz)).toString('utf8'));
    return null;
  };
}

export function indexAt(root) {
  for (const at of ['web/data.tsv', 'data.tsv']) {
    const file = join(root, at);
    if (!existsSync(file)) continue;
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, type, path] = line.split('\t');
        return { name, type, path };
      });
  }
  throw new Error(`no data.tsv under ${root} (web/data.tsv or data.tsv)`);
}
