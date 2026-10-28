#!/usr/bin/env node
// bf2-web's own answers, for the site's port of its game logic to hold to
// (docs/decisions/2026-10-28-hoth-on-bf2-web.md). bf2-web's port-side C++ is
// plain and deterministic, and each module has a CPU driver its gate builds
// native and wasm32 and compares byte for byte; this builds the same drivers
// native with the host's compiler, runs the scenarios bf2-web's gate runs, and
// writes the script and the driver's records into
// src/lib/battlefront/bf2web/fixtures/<module>.json, which the module's test
// replays through the JavaScript and compares number for number. The fixtures
// are committed, so the tests need neither bf2-web nor a compiler; run this
// again when bf2-web's module changes.
//
//   node scripts/bf2web-golden.mjs [--bf2web <checkout>] [--only <module>] [--cxx g++]
//   (BF2WEB_ROOT and HOST_CXX work too; the checkout defaults to ../bf2-web)

import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { MODULES } from './lib/bf2web-scenarios.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = join(ROOT, 'src/lib/battlefront/bf2web/fixtures');

const args = parseArgs(process.argv.slice(2));
const bf2web = resolve(args.bf2web ?? process.env.BF2WEB_ROOT ?? join(ROOT, '..', 'bf2-web'));
const cxx = args.cxx ?? process.env.HOST_CXX ?? 'g++';
const webPort = join(bf2web, 'WebPort');

const run = (program, argv, opts = {}) => {
  const r = spawnSync(program, argv, { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${program} ${argv.slice(0, 3).join(' ')}…: exit ${r.status}\n${(r.stderr || r.stdout || '').slice(0, 2000)}`);
  return r.stdout;
};
const commit = run('git', ['-C', bf2web, 'rev-parse', 'HEAD']).trim();
const work = await mkdtemp(join(tmpdir(), 'bf2web-golden-'));
await mkdir(OUT, { recursive: true });

for (const [name, mod] of Object.entries(MODULES)) {
  if (args.only && args.only !== name) continue;
  const exe = join(work, `${name}-driver`);
  // -ffp-contract=off: no fused multiply-adds, as bf2-web's deterministic flags (and JavaScript) have it
  run(cxx, ['-std=c++17', '-O2', '-ffp-contract=off', ...mod.sources.map((s) => join(webPort, s)), '-o', exe]);
  const scenarios = {};
  const parse = (text) => text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  // a named driver takes the scenario's name and prints its records; a scripted one reads a script and writes a file
  const named = mod.named ? Object.fromEntries(mod.named.map((n) => [n, [n]])) : await mod.scenarios({ webPort, site: ROOT });
  // a driver that reads an input before its script (the nav package) is handed it first
  const before = mod.prepare ? await mod.prepare({ work, write: writeFile }) : [];
  for (const [scenario, lines] of Object.entries(named)) {
    if (mod.named) {
      scenarios[scenario] = { script: lines, records: parse(run(exe, lines, { cwd: webPort })) };
      continue;
    }
    const script = join(work, `${name}.${scenario}.txt`);
    const output = join(work, `${name}.${scenario}.jsonl`);
    await writeFile(script, lines.join('\n') + '\n');
    run(exe, [...before, script, output], { cwd: webPort });
    scenarios[scenario] = { script: lines, records: parse(await readFile(output, 'utf8')) };
  }
  const fixture = { from: { repo: 'tilakpatell/bf2-web', commit, sources: mod.sources, gate: mod.gate }, scenarios };
  await writeFile(join(OUT, `${name}.json`), JSON.stringify(fixture) + '\n');
  console.log(`${name}: ${Object.keys(scenarios).length} scenarios, ${Object.values(scenarios).reduce((n, s) => n + s.records.length, 0)} records`);
}
