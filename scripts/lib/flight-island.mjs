// The planet flight (/fly) as an island: what it is, every row outside it
// that names it, and how it goes. The one place that knows the whole of it,
// so the flight can be kept whole and still be lost in one command
// (docs/superpowers/specs/2026-10-10-planet-flight-removable-island-design.md).
//
// Pure over a tree, never node:fs: `tree` is { files: [repo-relative paths],
// read(file) → text | null }, and apply() adds write(file, text) and
// remove(file). scripts/flight-island.mjs hands it the real one, the test a
// fake.
//
//   check(tree) → { unmarked, stale, outsideImports, crossWorld, unlisted, missing, broken, counts }
//   removal(tree, { date }) → { delete, dropLines, deps, migration, migrationFile, decision, decisionFile, byHand }
//   apply(plan, tree) → the tree as the plan leaves it (files deleted, rows dropped, deps out)
import { dirname, join, normalize } from 'node:path/posix';

export const ISLAND = {
  // everything under these is the flight's
  folders: [
    'src/components/expanse/flight',
    'src/lib/land/flight',
    'src/lib/durable',
    // the remover's own fixture tree goes with it
    'scripts/fixtures/flight-island',
  ],
  // and these files
  files: [
    'src/pages/Fly.jsx',
    'scripts/supabase-seed.mjs',
    'scripts/supabase-seed.test.mjs',
    'scripts/lib/durable-check.mjs',
    'scripts/lib/fly-check.mjs',
    'scripts/lib/storm-check.mjs',
    'scripts/lib/fake-durable.mjs',
    'scripts/lib/fake-durable.test.mjs',
    'scripts/fixtures/planets.json',
    'scripts/flight-expanse-fixture.mjs',
    'scripts/flight-island.mjs',
    'scripts/flight-island.test.mjs',
    'scripts/lib/flight-island.mjs',
    'scripts/lib/flight-island.test.mjs',
    'scripts/twin-parity/cases/flight.js',
    'supabase/migrations/20261009000000_world_entities.sql',
    'supabase/migrations/20261009000100_placement_reads_x_z.sql',
    'supabase/migrations/20261009000200_entity_hits_and_realtime.sql',
    'supabase/migrations/20261009000300_terrain_version.sql',
    'supabase/seed.sql',
    // the dependency's own page: it goes with the dependency (docs/stack/README.md)
    'docs/stack/fastnoise-lite.md',
  ],
  // the flight's alone (@supabase/supabase-js is not: the asset mirror and the
  // Battlefront fetch use it)
  deps: ['fastnoise-lite'],
  marker: 'planet flight',
  // the files outside that carry marked rows, each checked to have one
  rows: [
    '.env.example',
    '.github/workflows/ci.yml',
    'scripts/health.mjs',
    'scripts/online-check.mjs',
    'scripts/perf-probe.mjs',
    'scripts/lib/perf-routes.mjs',
    'scripts/lib/perf-routes.test.mjs',
    'scripts/stack-census.mjs',
    'scripts/supabase-check.mjs',
    'src/App.jsx',
    'src/components/guide/abouts.js',
    'src/components/guide/pages.js',
    'src/components/guide/routes.js',
    'src/components/tour/brief.js',
    'src/components/tour/briefs.js',
    'src/components/universe/universes.js',
    'src/components/universe/universes.test.js',
    'src/components/worlds/looks.js',
    'src/components/worlds/packs.js',
    'src/components/worlds/worlds.js',
    'docs/stack/supabase.md',
  ],
  // what the remover leaves for a hand: prose that names the flight
  docsByHand: [
    'docs/architecture.md: the flight’s paragraphs',
    'docs/stack/supabase.md: the durable world’s prose (its marked rows go)',
    'supabase/README.md: the planets and world_entities sections',
    'docs/health/RULES.md: the flight as the example of a removable world',
    'docs/superpowers/HANDOFF-planet-flight.md: the status, as retired',
  ],
  // what stays whatever happens to the flight (the design's “What stays”):
  // never deleted, and never edited but for a file in `rows` (a prefix
  // matches a path, so a catalogue group's name covers bf2017-<world>.js)
  keep: [
    'src/lib/land/flats.js',
    'src/lib/land/layers.js',
    'src/lib/three',
    'src/runtime',
    'src/lib/net',
    'src/lib/assetBase.js',
    'src/components/galaxy/shared',
    'src/components/universe/shared',
    'scripts/supabase-check.mjs',
    'scripts/conflict-markers.mjs',
    'docs/stack/supabase.md',
    // the Battlefront II (2017) pipeline's: its catalogue groups, models, rigs
    // and sky, and the asset mirror's manifest (the bucket is not in the tree)
    'src/components/galaxy/surface/catalog/bf2017',
    'public/models/galaxy/crew',
    'public/models/galaxy/surface',
    'public/models/galaxy/bf2017',
    'src/lib/three/walrus.js',
    'src/lib/three/ownRig.js',
    'src/lib/three/levelSky.js',
    'src/data/assets-manifest.json',
  ],
};

// What a reference to the flight looks like. The route is /fly where a
// quote, a space, a bracket or a regex's backslash opens it, so
// '/universe/fly' and a clip called fly-you-fools are not it.
export const NAMES = [
  /expanse\/flight/,
  /land\/flight/,
  /lib\/durable/,
  /pages\/Fly\b/,
  /(?:^|[\s'"`(\\])\/fly\b/,
  // online-check.mjs's flag for the shared world's check
  /(?:^|[\s'"`(])--fly\b/,
  /fastnoise-lite/,
  /world_entities/,
  /__FLIGHT__/,
  /flight-island/,
  /\b(?:fly-check|storm-check|fake-durable|durable-check|supabase-seed|flight-expanse-fixture)\b/,
];

// where references are looked for: the code and config, not the docs (docs
// are history, and the remover never rewrites them), not what a run writes.
// The stack pages are the exception: docs/stack/stack.test.js holds the
// paths they name to the tree, so their flight rows are marked and go too
const SCANNED = /\.(?:js|jsx|mjs|cjs|json|ya?ml|sql|toml|html|css)$|(?:^|\/)\.env\.example$|^docs\/stack\/[^/]+\.md$/;
const UNSCANNED = [/^docs\/(?!stack\/[^/]+\.md$)/, /^\.claude\//, /^\.agents\//, /^lab\//, /^public\//, /^dist\//, /^node_modules\//, /^src\/data\/health\//, /^package-lock\.json$/, /^(?!docs\/stack\/).*\.md$/];

const DEP_LISTS = ['package.json', 'docs/stack/README.md'];
const under = (file, dir) => file === dir || file.startsWith(`${dir}/`);
const kept = (file, island) => island.keep.some((k) => under(file, k) || (!k.endsWith('/') && file.startsWith(k)));
export const inIsland = (file, island = ISLAND) => island.files.includes(file) || island.folders.some((d) => under(file, d));
const scanned = (file) => SCANNED.test(file) && !UNSCANNED.some((re) => re.test(file));

export const referencesIn = (text) =>
  text.split('\n').flatMap((line, i) => (NAMES.some((re) => re.test(line)) ? [{ line: i + 1, text: line }] : []));

// (': end' ends at a word's end, so ': ending' is not one)
const markers = (marker) => ({ begin: markRe(marker, ': begin\\b'), end: markRe(marker, ': end\\b'), row: markRe(marker, '(?!: (?:begin|end)\\b)\\b') });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// a marker is a comment: // planet flight, # planet flight, {/* planet flight */},
// -- planet flight or, in Markdown, <!-- planet flight -->
const markRe = (marker, tail = '') => new RegExp(`(?:\\/\\/|#|\\/\\*|--)\\s*${esc(marker)}${tail}`);

// The marked spans of a file: [{ from, to }] (0-based, inclusive), a single
// row or a begin…end block. An unclosed begin marks to the file's end, and
// shows as stale if nothing in it names the flight.
export function markedSpans(lines, marker = ISLAND.marker) {
  const { begin, end, row } = markers(marker);
  const spans = [];
  for (let i = 0; i < lines.length; i++) {
    if (begin.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !end.test(lines[j])) j++;
      spans.push({ from: i, to: Math.min(j, lines.length - 1), block: true });
      i = j;
    } else if (row.test(lines[i])) spans.push({ from: i, to: i, block: false });
  }
  return spans;
}

// a begin with no end, or an end with no begin: a block that would run to
// the file's end, or a row the remover would not drop. check() fails on each
export function brokenMarks(lines, marker = ISLAND.marker) {
  const { begin, end } = markers(marker);
  const out = [];
  let open = -1;
  lines.forEach((line, i) => {
    if (begin.test(line)) {
      if (open >= 0) out.push(open);
      open = i;
    } else if (end.test(line)) {
      if (open < 0) out.push(i);
      open = -1;
    }
  });
  if (open >= 0) out.push(open);
  return out.sort((a, b) => a - b);
}

export const isMarked = (lines, i, marker = ISLAND.marker) => markedSpans(lines, marker).some((s) => i >= s.from && i <= s.to);

// The names a marked row binds (import Fly …, import { PACK as fly } …,
// const Fly = … at the module's top level): a marked row that uses one is a
// reference, and an unmarked row's code that uses one would be left naming
// nothing (its comments may say the word)
function bindings(lines, spans) {
  const out = new Set();
  for (const { from, to } of spans)
    for (const line of lines.slice(from, to + 1)) {
      const m = line.match(/^\s*import\s+(\w+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\b/) ?? line.match(/^(?:export\s+)?(?:const|let)\s+(\w+)\s*=/);
      if (!m) continue;
      if (m[1]) out.add(m[1]);
      for (const part of (m[2] ?? '').split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop();
        if (name) out.add(name);
      }
    }
  return out;
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)(['"`])([^'"`\n]+)\1/g;
const specifiers = (line) => [...line.matchAll(SPECIFIER)].map((m) => m[2]);
const resolved = (file, spec) => (spec.startsWith('.') ? normalize(join(dirname(file), spec)) : spec);

// what may import the island from outside it: the router mounts the page, and
// the packs list names each world's pack
const MAY_IMPORT = ['src/App.jsx', 'src/components/worlds/packs.js'];
const ISLAND_PATH = /^src\/(?:components\/expanse\/flight|lib\/land\/flight|lib\/durable|pages\/Fly)(?:[/.]|$)/;
// the flight reads the galaxy and the universe through their shared faces
// alone, and its pure layer reads no component or page
const CROSS = [
  { from: /^src\/components\/expanse\/flight\//, to: /^src\/components\/(?:galaxy|universe)\/(?!shared\/)/ },
  { from: /^src\/lib\//, to: /^src\/(?:components|pages)\// },
];

export function check(tree, island = ISLAND) {
  const unmarked = [];
  const stale = [];
  const outsideImports = [];
  const crossWorld = [];
  const broken = [];
  const withMarks = new Set();
  let rows = 0;
  let references = 0;
  const islandFiles = tree.files.filter((f) => inIsland(f, island));
  for (const file of tree.files) {
    if (!scanned(file)) continue;
    const text = tree.read(file);
    if (text == null) continue;
    const lines = text.split('\n');
    if (inIsland(file, island)) {
      lines.forEach((line, i) => {
        for (const spec of specifiers(line)) {
          const to = resolved(file, spec);
          if (CROSS.some((c) => c.from.test(file) && c.to.test(to))) crossWorld.push({ file, line: i + 1, text: line.trim() });
        }
      });
      continue;
    }
    const spans = markedSpans(lines, island.marker);
    for (const i of brokenMarks(lines, island.marker)) broken.push({ file, line: i + 1, text: lines[i].trim() });
    if (spans.length) withMarks.add(file);
    rows += spans.length;
    const bound = bindings(lines, spans);
    const boundIn = (line) => [...bound].some((b) => new RegExp(`(?<![\\w$.])${esc(b)}(?![\\w$])`).test(line));
    const codeOf = (line) => (/^\s*(?:\/\/|\*|\/\*|#|<!--)/.test(line) ? '' : line.replace(/\s\/\/.*$/, ''));
    const names = (line) => NAMES.some((re) => re.test(line)) || boundIn(line);
    const covered = new Set();
    for (const s of spans) {
      const body = lines.slice(s.from, s.to + 1);
      if (!body.some(names)) stale.push({ file, line: s.from + 1, text: lines[s.from].trim() });
      for (let i = s.from; i <= s.to; i++) covered.add(i);
    }
    lines.forEach((line, i) => {
      if (!NAMES.some((re) => re.test(line))) {
        if (boundIn(codeOf(line)) && !covered.has(i)) unmarked.push({ file, line: i + 1, text: line.trim() });
        return;
      }
      references++;
      // a dependency of the island's is named in package.json and the stack
      // census's table: it goes as a dep, and the census rewrites its row
      if (DEP_LISTS.includes(file) && island.deps.some((d) => line.includes(d))) return;
      if (!covered.has(i)) unmarked.push({ file, line: i + 1, text: line.trim() });
      if (file.startsWith('src/') && !MAY_IMPORT.includes(file))
        for (const spec of specifiers(line)) if (ISLAND_PATH.test(resolved(file, spec))) outsideImports.push({ file, line: i + 1, text: line.trim() });
    });
  }
  const unlisted = [...withMarks].filter((f) => !island.rows.includes(f)).sort();
  const missing = island.rows.filter((f) => !withMarks.has(f));
  return { unmarked, stale, outsideImports, crossWorld, unlisted, missing, broken, counts: { files: islandFiles.length, rows, references } };
}

export const clean = (r) => ['unmarked', 'stale', 'outsideImports', 'crossWorld', 'unlisted', 'missing', 'broken'].every((k) => r[k].length === 0);

// The migration that takes the flight's tables out of the project: its
// tables, their functions and triggers, its realtime line. The asset buckets
// are not the flight's and stay.
export const MIGRATION = `-- The planet flight retired (scripts/flight-island.mjs --remove): its tables,
-- their functions and the realtime publication's line. Nothing else in the
-- project is the flight's: the asset buckets stay.
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'world_entities') then
    alter publication supabase_realtime drop table public.world_entities;
  end if;
end $$;

drop function if exists public.get_entities_in_bounding_box(text, double precision, double precision, double precision, double precision, timestamptz);
drop function if exists public.damage_entity(uuid, integer);
drop table if exists public.entity_hits;
drop table if exists public.world_entities;
drop table if exists public.pois;
drop table if exists public.planets;
drop function if exists public.check_placement();
drop function if exists public.touch_updated_at();
`;

const decisionText = (date) => `# The planet flight retired

Date: ${date}.

## Context

The planet flight (\`/fly\`: the chunked ground, its life, landmarks, map and shared world) was kept whole as an island beside the Battlefront II (2017) pipeline, and made removable in one move (docs/superpowers/specs/2026-10-10-planet-flight-removable-island-design.md).

## Decision

It is removed: \`node scripts/flight-island.mjs --remove\` deleted its folders and files, dropped every row marked \`planet flight\`, took \`fastnoise-lite\` out of the dependencies and wrote the migration that drops its tables.

## What stays

The galaxy's and the universe's \`shared/\` faces, \`lib/land/flats.js\` and \`layers.js\`, the surfaces' material, the kit's pools, the chunk grid, the cells, the asset mirror, \`@supabase/supabase-js\` and the Supabase project with its buckets. The specs, plans and hand-offs that built the flight stay as history.

## By hand

Apply the migration to the project. Then the prose the remover does not touch: ${ISLAND.docsByHand.join('; ')}.
`;

export function removal(tree, { date = '2026-01-01', island = ISLAND } = {}) {
  const del = tree.files.filter((f) => inIsland(f, island) && !kept(f, island)).sort();
  const dropLines = [];
  for (const file of tree.files) {
    if (inIsland(file, island) || !scanned(file) || (kept(file, island) && !island.rows.includes(file))) continue;
    const text = tree.read(file);
    if (text == null) continue;
    const lines = text.split('\n');
    const spans = markedSpans(lines, island.marker);
    if (!spans.length) continue;
    const drop = spans.flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, k) => ({ line: s.from + k + 1, text: lines[s.from + k] })));
    dropLines.push({ file, lines: drop });
  }
  const stamp = date.replaceAll('-', '');
  return {
    delete: del,
    dropLines,
    deps: [...island.deps],
    migration: MIGRATION,
    migrationFile: `supabase/migrations/${stamp}000000_drop_planet_flight.sql`,
    decision: decisionText(date),
    decisionFile: `docs/decisions/${date}-planet-flight-retired.md`,
    byHand: [...island.docsByHand],
  };
}

// package.json without the island's dependencies, its own layout kept
export function withoutDeps(text, deps) {
  const pkg = JSON.parse(text);
  for (const k of ['dependencies', 'devDependencies', 'optionalDependencies']) for (const d of deps) if (pkg[k]) delete pkg[k][d];
  const indent = text.match(/^\{\n(\s+)"/)?.[1] ?? '  ';
  return `${JSON.stringify(pkg, null, indent)}${text.endsWith('\n') ? '\n' : ''}`;
}

export function apply(plan, tree) {
  for (const f of plan.delete) tree.remove(f);
  for (const { file, lines } of plan.dropLines) {
    const gone = new Set(lines.map((l) => l.line - 1));
    tree.write(file, tree.read(file).split('\n').filter((_, i) => !gone.has(i)).join('\n'));
  }
  if (plan.deps.length && tree.read('package.json') != null) tree.write('package.json', withoutDeps(tree.read('package.json'), plan.deps));
  tree.write(plan.migrationFile, plan.migration);
  tree.write(plan.decisionFile, plan.decision);
  return tree;
}
