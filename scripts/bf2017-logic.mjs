// The game's logic graphs, every one, as nodes and edges (the gap design's
// lane logic): each blueprint of the export with wires (EventConnections,
// PropertyConnections, LinkConnections) or an interface becomes
// <out>/<asset>.json, `{ asset, type, interface, nodes, edges }`, its ports
// named where the djb2-xor dictionary names them (scripts/lib/bf2017-logic.mjs
// says how the hash was tested). The sequel era's assets are left out.
//
//   node scripts/bf2017-logic.mjs --root <export>/web [--out <export>/web_opt/logic]
//        [--sdk <FrostyEditor>/Profiles/StarWarsIISDK.dll] [--upload-root <dir>] [--only <regex>]
//
//   root         the export's web folder: data.tsv and data/<asset>.json
//   out          where the graphs go (default: <root>/../web_opt/logic), with
//                _index.json (every graph's counts) and _names.json (the hash → name table)
//   sdk          Frosty's generated SDK for the game, whose identifiers (the
//                classes' field names) are the dictionary's last tier; the
//                export's own words come before it and the entities' common ports first
//   upload-root  also copy the files under <upload-root>/logic/ with a
//                list.txt of their paths, for tool/upload_supabase.py --prefix web/
//   only         a regex on the asset name (a fixture run)

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { CORE_NAMES, composeNames, djb2, graphOf, hashesOf, hex, identifiers, isLogic, nameTable, suffixNames } from './lib/bf2017-logic.mjs';
import { isSequel } from './lib/bf2017-manifest.mjs';

const DEFAULT_SDK = 'C:/Users/tilak/Downloads/BF2_Extract/frosty/FrostyEditor/Profiles/StarWarsIISDK.dll';
const WIRED = /"(?:Event|Property|Link)Connections":\[\{|"InterfaceDescriptorData"/;

// the identifiers in Frosty's SDK assembly (its metadata's names, ASCII and UTF-16)
export function sdkNames(path) {
  const out = new Set();
  if (!path || !existsSync(path)) return out;
  const buf = readFileSync(path);
  for (const m of buf.toString('latin1').matchAll(/[A-Za-z_][A-Za-z0-9_]{1,80}/g)) out.add(m[0]);
  for (const m of buf.toString('utf16le').matchAll(/[A-Za-z_][A-Za-z0-9_]{1,80}/g)) out.add(m[0]);
  return out;
}

export function readIndex(root) {
  const rows = [];
  for (const line of readFileSync(join(root, 'data.tsv'), 'utf8').split('\n')) {
    const [name, type, file] = line.trim().split('\t');
    if (name && file) rows.push({ name, type, file });
  }
  return rows;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.root) throw new Error('--root <export>/web is required');
  const root = args.root;
  const out = args.out ?? join(root, '..', 'web_opt', 'logic');
  const only = args.only ? new RegExp(args.only, 'i') : null;
  const rows = readIndex(root);
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));
  const readDoc = (r) => {
    try {
      return readFileSync(join(root, r.file), 'utf8');
    } catch {
      return null;
    }
  };

  // pass 1: which documents are graphs, every hash they hold, the words they spell
  const t0 = Date.now();
  const graphs = [];
  const hashes = new Set();
  const words = new Set();
  let sequel = 0;
  for (const r of rows) {
    if (only && !only.test(r.name)) continue;
    const text = readDoc(r);
    if (!text || !WIRED.test(text)) continue;
    if (isSequel(r.name)) {
      sequel++;
      continue;
    }
    const doc = JSON.parse(text);
    if (!isLogic(doc)) continue;
    graphs.push(r);
    hashesOf(doc, hashes);
    identifiers(doc, words);
  }
  console.log(`${graphs.length} graphs (${sequel} of the sequel era left out), ${hashes.size} hashes, ${words.size} words, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // the dictionary: the core ports, the export's words, the SDK's identifiers
  const sdk = sdkNames(args.sdk ?? DEFAULT_SDK);
  const table = nameTable([CORE_NAMES, [...words], [...sdk]], hashes);
  const strong = new Set([...CORE_NAMES, ...words]);
  const families = suffixNames(hashes, table, strong);
  for (const [h, n] of families) table.set(h, n);
  const composed = composeNames(hashes, table);
  for (const [h, n] of composed) table.set(h, n);
  // the lower-cased test (the shader depots' form), for the record
  const lower = nameTable([[...CORE_NAMES, ...words, ...sdk].map((n) => n.toLowerCase())], hashes);
  console.log(`named ${table.size} of ${hashes.size} hashes (${families.size} by a family's stem, ${composed.size} composed of the mode's words; SDK ${sdk.size} identifiers); lower-cased names ${lower.size}`);

  // pass 2: the graphs
  mkdirSync(out, { recursive: true });
  const cache = new Map();
  const load = (name) => {
    const key = name.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const r = byName.get(key);
    const text = r ? readDoc(r) : null;
    const doc = text ? JSON.parse(text) : null;
    if (cache.size > 64) cache.clear();
    cache.set(key, doc);
    return doc;
  };
  const index = {};
  let named = 0;
  let unnamed = 0;
  let edges = 0;
  const written = [];
  for (const r of graphs) {
    const doc = JSON.parse(readDoc(r));
    const g = graphOf(doc, { names: table, load });
    const rel = `${r.file.replace(/^data\//, '')}`;
    const file = join(out, rel);
    mkdirSync(dirname(file), { recursive: true });
    const { named: n, unnamed: u, ...body } = g;
    writeFileSync(file, JSON.stringify({ ...body, _source: `web/${r.file}` }));
    written.push(rel);
    index[r.name] = { type: g.type, file: rel, nodes: g.nodes.length, edges: g.edges.length, named: n, unnamed: u };
    named += n;
    unnamed += u;
    edges += g.edges.length;
  }
  const names = Object.fromEntries([...table].sort((a, b) => a[0] - b[0]).map(([h, n]) => [hex(h).slice(2), n]));
  const meta = {
    hash: 'djb2-xor (h = ((h << 5) + h) ^ c from 5381, 32-bit) of the name as written, case kept',
    tested: { asWritten: table.size - families.size - composed.size, lowerCased: lower.size, families: families.size, composed: composed.size, hashes: hashes.size },
    graphs: graphs.length,
    edges,
    ports: { named, unnamed },
  };
  writeFileSync(join(out, '_names.json'), JSON.stringify({ ...meta, names }));
  writeFileSync(join(out, '_index.json'), JSON.stringify({ ...meta, assets: index }));
  written.push('_names.json', '_index.json');
  console.log(`wrote ${graphs.length} graphs, ${edges} edges, ports named ${named} of ${named + unnamed} (${((100 * named) / Math.max(1, named + unnamed)).toFixed(1)} %), ${((Date.now() - t0) / 1000).toFixed(1)} s → ${out}`);

  if (args.uploadRoot) {
    const up = args.uploadRoot;
    for (const rel of written) {
      const dst = join(up, 'logic', rel);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(join(out, rel), dst);
    }
    writeFileSync(join(up, 'list.txt'), written.map((rel) => `logic/${rel}`).join('\n') + '\n');
    console.log(`copied ${written.length} files under ${join(up, 'logic')} with list.txt`);
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/bf2017-logic.mjs')) main();

export { djb2 };
