// The Battlefront rulebook’s big records out of the JavaScript chunks (lane
// FL1 of the engine floor, after scripts/library-slice.mjs’s shape).
// src/data/bf2017/ai.json (530 KB), screens.json (756 KB), Hoth’s map and
// lighting (511 KB) and the rulebook’s other records were imported as JSON,
// which the build inlines as a module: the `instantAction` chunk was 2.2 MB
// and `FrontEnd` 860 KB, parsed by the JavaScript parser before
// Battlefront’s first screen. This plugin serves
// each as `virtual:bf2017-<name>`:
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

const RULEBOOK = 'src/lib/battlefront/rulebook.js';
const row = (name, file, readers, fetch = true) => ({ name, specifier: `virtual:bf2017-${name}`, file: `src/data/bf2017/${file}`, readers, whole: true, fetch });

// the three the design names, then the rulebook's other records that only it
// imports (the galaxy imports strings, points, classes, heroes, modes, cameras
// and squads itself, so those stay JSON imports: served here as well, a
// galaxy chunk would carry them twice)
export const RECORDS = [
  row('ai', 'ai.json', [RULEBOOK]),
  row('ui', 'ui.json', [RULEBOOK, 'src/lib/bf2017/ui/index.js'], false),
  row('screens', 'screens.json', ['src/lib/bf2017/ui/screens.js']),
  row('hoth', 'maps/hoth.json', [RULEBOOK]),
  row('hothLighting', 'maps/hoth.lighting.json', [RULEBOOK]),
  row('weapons', 'weapons.json', [RULEBOOK]),
  row('cards', 'cards.json', [RULEBOOK]),
  row('abilities', 'abilities.json', [RULEBOOK]),
  row('kits', 'kits.json', [RULEBOOK]),
  row('teams', 'teams.json', [RULEBOOK]),
  row('vehicles', 'vehicles.json', [RULEBOOK]),
  row('arcade', 'arcade.json', [RULEBOOK]),
  row('reinforcements', 'reinforcements.json', [RULEBOOK]),
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
