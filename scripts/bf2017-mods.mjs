// A mod's records → its rulebook (the Battlefront-by-default design, decision
// 8): what a mod extracted on the owner's machine does to the game, as rows
// with the record and field each number came from, as bf2017-data.mjs does
// for the game's own. Nothing of the mod's binaries is read or written: its
// records are the extraction's JSON (bf2-re's `data/mods/<mod>/ebx/`), and the
// rulebook keeps numbers and names only.
//
//   node scripts/bf2017-mods.mjs <mod> --root <bf2-re>/data/mods [--out src/data/bf2017/mods] [--dry]
//   node scripts/bf2017-mods.mjs fixture <mod> <record> [--root …]   a record cut to what a test reads,
//          into scripts/fixtures/bf2017/mods/<mod>/ (the step tables', the spread's, a kit's)
//
// The mods it knows (MODS): iao-v2, the Instant Action Overhaul V2
// (scripts/lib/bf2017-mods-iao.mjs). The game's own rulebooks it reads beside
// (src/data/bf2017/gameSettings.json for what the mod changes, ai.json for the
// templates a kit's AI body plays) are the repository's.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { cutAsset } from './lib/bf2017-ebx.mjs';
import { iaoRulebook } from './lib/bf2017-mods-iao.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MODS = { 'iao-v2': iaoRulebook };

// every record under the mod's ebx/, by its name (its path there, lower case, without .json)
function recordsOf(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.json')) out.push({ name: relative(dir, p).split(sep).join('/').slice(0, -5).toLowerCase(), path: p });
    }
  };
  walk(dir);
  return out;
}

export function modRulebook(mod, root) {
  const read = MODS[mod];
  if (!read) throw new Error(`${mod}: not a mod this script reads (${Object.keys(MODS).join(', ')})`);
  const dir = join(root, mod);
  const ebx = join(dir, 'ebx');
  if (!existsSync(ebx)) throw new Error(`${ebx}: no extraction`);
  const files = recordsOf(ebx);
  const byName = new Map(files.map((f) => [f.name, f.path]));
  const cache = new Map();
  const load = (name) => {
    const key = String(name).toLowerCase();
    if (!cache.has(key)) cache.set(key, byName.has(key) ? JSON.parse(readFileSync(byName.get(key), 'utf8')) : null);
    return cache.get(key);
  };
  const list = () => files.map((f) => ({ name: f.name, text: readFileSync(f.path, 'utf8') }));
  const vanilla = JSON.parse(readFileSync(join(ROOT, 'src/data/bf2017/gameSettings.json'), 'utf8')).settings;
  const ai = JSON.parse(readFileSync(join(ROOT, 'src/data/bf2017/ai.json'), 'utf8')).rows;
  const info = existsSync(join(dir, 'mod.json')) ? JSON.parse(readFileSync(join(dir, 'mod.json'), 'utf8')) : {};
  const book = read({ load, list, vanilla, ai });
  return {
    _from: { mod: info.title ?? mod, version: info.version ?? null, author: info.author ?? null, link: info.link ?? null, file: info.file ?? null, gameVersion: info.gameVersion ?? null, records: files.length, date: new Date().toISOString().slice(0, 10) },
    ...book,
  };
}

// A record cut for a fixture: its root and the objects a reader follows (the logic's own; a kit is whole),
// the root's connections cut to those between what is kept and to the fields the readers ask for
export function fixtureOf(asset) {
  if (asset.type !== 'LogicPrefabBlueprint') return asset;
  const keep = (o) => /^(SelectEvent|SelectFloat|Float|RandomMultiEvent|Delay|AutoPlayerSettings|SchematicChannel|InterfaceDescriptor|EventSplitter)/.test(o?.$type ?? '');
  const cut = cutAsset(asset, keep);
  const root = cut.objects[cut.root];
  const both = (c) => c.Source && c.Target;
  const event = (e) => (e ? { Id: e.Id } : e);
  cut.objects[cut.root] = {
    $type: root.$type,
    Name: root.Name,
    PropertyConnections: (root.PropertyConnections ?? []).filter(both).map((c) => ({ Source: c.Source, Target: c.Target, SourceFieldId: c.SourceFieldId, TargetFieldId: c.TargetFieldId })),
    EventConnections: (root.EventConnections ?? []).filter(both).map((c) => ({ Source: c.Source, Target: c.Target, SourceEvent: event(c.SourceEvent), TargetEvent: event(c.TargetEvent) })),
  };
  return cut;
}

async function main(argv) {
  const args = parseArgs(argv);
  const root = typeof args.root === 'string' ? args.root : 'C:/Users/tilak/source/repos/bf2-re/data/mods';
  if (args._[0] === 'fixture') {
    const [, mod, record] = args._;
    const file = join(root, mod, 'ebx', `${record}.json`);
    const cut = fixtureOf(JSON.parse(readFileSync(file, 'utf8')));
    const to = join(ROOT, 'scripts/fixtures/bf2017/mods', mod, `${record.replace(/\//g, '_')}.json`);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, JSON.stringify(cut) + '\n');
    console.log(`${to}: ${cut.objects.length} objects`);
    return;
  }
  const mod = args._[0];
  if (!mod) throw new Error('usage: node scripts/bf2017-mods.mjs <mod> --root <bf2-re>/data/mods [--out src/data/bf2017/mods] [--dry]');
  const t = performance.now();
  const book = modRulebook(mod, root);
  const s = book.steps;
  console.log(`${mod}: ${book._from.records} records; ${Object.keys(s).length} step options (${Object.keys(s).join(', ')}); adaptive ${book.adaptive?.scales.length} scales every ${book.adaptive?.every} s; ${book.autoPlayers?.rows.length} hub settings (squad spawn ${book.squadSpawn.value}); ${book.container.renamed.length} settings renamed, ${book.container.changed.length} changed; ${book.records.length} AutoPlayer records kept; ${book.kits.length} AI kits; ${book.refused.length} sequel-era names refused; ${Math.round(performance.now() - t)} ms`);
  if (args.dry) return;
  const out = join(ROOT, typeof args.out === 'string' ? args.out : 'src/data/bf2017/mods');
  mkdirSync(out, { recursive: true });
  // (on one line, as the game's rulebooks are, and under 64 KB: the bots' logic imports it, and a record
  // over that the build would inline is counted against `client-json-kb`, docs/health/RULES.md)
  const text = JSON.stringify(book) + '\n';
  if (text.length > 64 * 1024) throw new Error(`${mod}.json would be ${Math.round(text.length / 1024)} KB: over the 64 KB a statically imported record may be`);
  writeFileSync(join(out, `${mod}.json`), text);
  console.log(`wrote ${relative(ROOT, join(out, `${mod}.json`))}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
