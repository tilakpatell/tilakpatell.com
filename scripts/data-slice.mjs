// The game's big UI records out of the JavaScript chunks (lane FL1 of the
// engine floor, after scripts/library-slice.mjs’s shape). screens.json
// (756 KB) and ui.json were imported as JSON, which the build inlines as a
// module, parsed by the JavaScript parser before a world's first screen.
// This plugin serves each as `virtual:bf2017-<name>`:
//
// - a record whose readers read only some of its keys, as those keys
//   (scripts/lib/data-slice.mjs reads the readers; its test holds RECORDS to
//   them);
// - a record a reader walks or hands on whole (all of them today: each
//   reader takes `.rows` and passes it on), in the client build as the file itself,
//   fetched and parsed as JSON, behind a top-level await, so the chunk that
//   imports it waits on it and every reader still sees a plain object, the
//   same as before. The fetched records start together, from one module
//   (`\0bf2017-records`) the first of them to run imports: rolldown joins
//   a chunk's modules into one scope, so an await in each would have
//   queued ai.json behind the rulebook's chunk and screens.json behind the
//   front end's. In dev, Vitest and SSR (no page to fetch from, and the
//   tests read a record at once) a record is the JSON inline.
// - a record whose row says `fetch: false`, inline everywhere, whole: ui.json,
//   because the worlds' HUD kit reaches it (src/runtime/hud/index.js →
//   Screen.jsx → lib/bf2017/ui/shapes.js → ui/index.js's `css`), so a fetch
//   would hold every world with a HUD, not Battlefront alone. It is fetched
//   once `css` no longer comes from the module that reads the widget trees.
//
// Nothing is committed twice: each load reads the record from disk.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identOf, keysReadBy, sliceFor } from './lib/data-slice.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/+$/, '');

const row = (name, file, readers, fetch = true) => ({ name, specifier: `virtual:bf2017-${name}`, file: `src/data/bf2017/${file}`, readers, whole: true, fetch });

// (the site's own Battlefront game, whose rulebook read the rest, went on 2026-10-29: docs/superpowers/plans/
// 2026-10-29-battlefront-engine-only.md; the worlds' HUD kit reads these two)
export const RECORDS = [
  row('ui', 'ui.json', ['src/lib/bf2017/ui/index.js'], false),
  row('screens', 'screens.json', ['src/lib/bf2017/ui/screens.js']),
];

const PREFIX = '\0bf2017-record:';
const GROUP = '\0bf2017-records';

// the fetched records' requests, all made when the first of them runs
export function groupCode(rows = RECORDS) {
  const fetched = rows.filter((r) => r.whole && r.fetch);
  return `${fetched.map((r) => `import ${r.name}Url from ${JSON.stringify(`/${r.file}?url`)};`).join('\n')}
const get = (file, url) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(\`\${file}: \${r.status} from \${url}\`);
  return r.json();
});
${fetched.map((r) => `export const ${r.name} = get(${JSON.stringify(r.file)}, ${r.name}Url);`).join('\n')}
`;
}

export function recordCode(row, { root = ROOT, fetch = false } = {}) {
  if (row.whole && row.fetch && fetch) return `import { ${row.name} } from ${JSON.stringify(GROUP)};\nexport default await ${row.name};\n`;
  const record = JSON.parse(readFileSync(join(root, row.file), 'utf8'));
  const data = row.whole ? record : sliceFor(record, [...new Set(row.readers.flatMap((f) => {
    const src = readFileSync(join(root, f), 'utf8');
    return keysReadBy(src, identOf(src, row.specifier));
  }))]);
  return `export default ${JSON.stringify(data)};\n`;
}

export default function dataSlice() {
  let build = false;
  return {
    name: 'data-slice',
    configResolved(config) {
      build = config.command === 'build';
    },
    resolveId(source) {
      if (source === GROUP) return GROUP;
      return RECORDS.some((r) => r.specifier === source) ? PREFIX + source : null;
    },
    load(id, options) {
      if (id === GROUP) return groupCode(RECORDS);
      if (!id.startsWith(PREFIX)) return null;
      const row = RECORDS.find((r) => r.specifier === id.slice(PREFIX.length));
      this.addWatchFile?.(join(ROOT, row.file));
      for (const f of row.readers) this.addWatchFile?.(join(ROOT, f));
      return recordCode(row, { root: ROOT, fetch: build && !options?.ssr });
    },
  };
}
