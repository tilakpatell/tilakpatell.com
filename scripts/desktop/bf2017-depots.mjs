// Lane W's `depots` job (the picture-everywhere design, §7; the plan's task
// 6): the shader depots' probe on the desktop (maps_work/shaderdepots.jsonl,
// not in the bucket) resolved against the dictionary of names, and the
// share written into src/data/bf2017/shaderParams.json by the colour lane's
// own script:
//
//   node scripts/bf2017-shader-names.mjs --depots <export>/maps_work/shaderdepots.jsonl
//
// Before it runs, the probe's rows are read for their shape (the reader
// takes { blocks: [{ params: [{ hash, type, value }] }] }; the hand-off
// warns the probe may name its keys otherwise) and its blocks counted. After,
// the share is said two ways: of every entry, and of the entries left once
// the per-block engine constants are set apart (a hash in every block: nine
// of them on 2026-10-11, 1,948,473 of 2,339,665 entries, which put the share
// at 44.3 % of the rest where it is 7.4 % of all; HANDOFF-bf2017.md).
//
//   node scripts/desktop/bf2017-depots.mjs [--dry] [--no-pr]

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { runCli, step } from './bf2017-desk.mjs';

export const OUT = 'src/data/bf2017/shaderParams.json';
const probeFile = (d) => join(d.mapsWork, 'shaderdepots.jsonl');

// A probe row's shape: { ok, blocks, params, keys } (keys: the row's own,
// and its first block's and first parameter's, when they are not the reader's).
export function shapeOf(row) {
  const blocks = Array.isArray(row?.blocks) ? row.blocks : null;
  const first = blocks?.[0];
  const params = Array.isArray(first?.params) ? first.params : null;
  const p = params?.[0];
  const ok = Boolean(blocks && (!first || params) && (!p || ('hash' in p || 'nameHash' in p)));
  return { ok, blocks: blocks?.length ?? 0, keys: ok ? null : { row: Object.keys(row ?? {}), block: Object.keys(first ?? {}), param: Object.keys(p ?? {}) } };
}

// The probe read through once: its rows, blocks, and the first row whose shape the reader can't take.
export async function survey(file) {
  let rows = 0;
  let blocks = 0;
  let bad = null;
  for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const s = shapeOf(JSON.parse(line));
    rows++;
    blocks += s.blocks;
    if (!s.ok && !bad) bad = { row: rows, keys: s.keys };
  }
  return { rows, blocks, bad };
}

// The share two ways, from shaderParams.json's depot result and the block count.
export function shares(result, blocks) {
  const total = result.depots?.params ?? 0;
  const resolved = result.depots?.resolved ?? 0;
  const constants = Object.entries(result.unresolved ?? {}).filter(([, n]) => blocks && n >= blocks);
  const constantEntries = constants.reduce((n, [, c]) => n + c, 0);
  const rest = total - constantEntries;
  const pct = (a, b) => (b ? Number(((a / b) * 100).toFixed(1)) : null);
  return { total, resolved, all: pct(resolved, total), constants: constants.length, constantEntries, rest, ofRest: pct(resolved, rest), unresolvedHashes: Object.keys(result.unresolved ?? {}).length - constants.length };
}

export const spec = {
  job: 'depots',
  title: 'The shader depots resolved',
  vram: 0,
  columns: ['name', 'file'],
  needs: (d) => [
    { name: 'the depot probe', file: probeFile(d), fix: "the exporter's depot probe writes maps_work/shaderdepots.jsonl (tool/bf2export.csproj)" },
    { name: "the bucket's keys", keys: true, fix: "SUPABASE_URL and SUPABASE_SERVICE_KEY in the runner's .env (the dictionary's records come from the bucket)" },
  ],
  async plan({ d }) {
    const file = probeFile(d);
    return {
      items: [{ name: 'shaderdepots', file }],
      notes: [existsSync(file) ? `the probe is at ${file}` : `no probe here (${file}): it is the desktop's`, `writes ${OUT} through scripts/bf2017-shader-names.mjs --depots`],
    };
  },
  async run(items, { root, d, env, log }) {
    const file = probeFile(d);
    const s = await survey(file);
    log(`probe: ${s.rows} rows, ${s.blocks} blocks`);
    if (s.bad) throw new Error(`row ${s.bad.row} of the probe is not in the reader's shape ({ blocks: [{ params: [{ hash, type, value }] }] }): its keys are ${JSON.stringify(s.bad.keys)}; rename them in the probe or in scripts/lib/bf2017-shader-names.mjs's resolveDepot`);
    step(process.execPath, ['scripts/bf2017-shader-names.mjs', '--depots', file], { cwd: root, env, log });
    const result = JSON.parse(readFileSync(join(root, OUT), 'utf8'));
    const sh = shares(result, s.blocks);
    const dir = join(root, 'docs/superpowers/evidence/bf2017-picture/w/depots');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'share.json'), `${JSON.stringify({ _source: `scripts/desktop/bf2017-depots.mjs on the owner's desktop: ${OUT}'s depot result over the probe's ${s.rows} rows and ${s.blocks} blocks; a constant is a hash in every block`, at: new Date().toISOString(), rows: s.rows, blocks: s.blocks, ...sh }, null, 1)}\n`);
    const report = `${sh.resolved.toLocaleString('en-GB')} of ${sh.total.toLocaleString('en-GB')} entries resolve (${sh.all} %); with the ${sh.constants} per-block constants (${sh.constantEntries.toLocaleString('en-GB')} entries) set apart, ${sh.ofRest} % of ${sh.rest.toLocaleString('en-GB')}. ${sh.unresolvedHashes.toLocaleString('en-GB')} hashes stay unresolved.`;
    return { files: [OUT], report };
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await runCli(spec);
