// Adopts a bf2-web build for Hoth (docs/decisions/2026-10-28-bf2web-pipeline.md): reads the private bucket's
// sites/, holds each build newer than the one play.json names to the contract (scripts/lib/bf2web-site.mjs: its
// manifest, every file uploaded at its size, the play page's hooks, the nine rulebooks) and names the newest that
// passes in src/data/bf2web/play.json, with what its programs ask of a visitor's GPU (needs: the site sends to the
// engine only a GPU that has it, lib/bf2web/engineSupport). A build that fails is said, with why: that is a change in bf2-web the site
// hasn't caught up with, for a person to look at; nothing is guessed round it.
//
//   node --env-file=.env.local scripts/bf2web-adopt.mjs [--build <id>] [--check]
//     (no --build: the newest good build of bf2-web's main, main-<sha8>, newer than play.json's; a build from a
//     branch or a worktree is only ever played by name)   --check: say, write nothing
// Exit 0 when a build was adopted or nothing newer is there (GITHUB_OUTPUT gets adopted=<id>, empty for none),
// 1 when the build asked for fails, or every newer one does.

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from './lib/bf2web-r2.mjs';
import { MAIN_BUILD, SHARED_UI, adopted, contractProblems, hookProblems, missingFiles, newest, programNeeds, uiDataFor } from './lib/bf2web-site.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAY = join(ROOT, 'src/data/bf2web/play.json');
const args = process.argv.slice(2);
const option = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const asked = option('--build');
const check = args.includes('--check');
const output = (k, v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);

const r2 = open();
const play = JSON.parse(readFileSync(PLAY, 'utf8'));

// one build, whole: its manifest against the contract, its files, its page's hooks, its rulebooks
async function examine(id) {
  const prefix = `sites/${id}/`;
  const manifest = await r2.json(prefix + 'manifest.json');
  if (!manifest) return { id, created: null, problems: ['no manifest.json: not uploaded, or not finished'] };
  const problems = contractProblems(manifest);
  if (!problems.length) {
    problems.push(...missingFiles(manifest, prefix, await r2.files(prefix)));
    problems.push(...hookProblems(await r2.text(prefix + 'runtime/world-play.mjs')));
  }
  const ui = uiDataFor(id, await r2.files(prefix + 'ui-data/'), await r2.files(SHARED_UI));
  problems.push(...ui.problems);
  return { id, created: manifest.created ?? null, manifest, uiData: ui.uiData, problems };
}

// what the programs the build draws (its pipeline cache, pipelines.json) ask of the GPU; null when it has no programs
async function needsOf(id) {
  const prefix = `sites/${id}/`;
  const [cooked, programs, pipelines] = await Promise.all(['cooked-programs.json', 'programs.json', 'pipelines.json'].map((f) => r2.json(prefix + f)));
  if (!cooked && !programs) return null;
  const used = Array.isArray(pipelines) ? new Set(pipelines.map((p) => p.name)) : null;
  return programNeeds([...(cooked ?? []), ...(programs ?? [])], used);
}

const say = (b) => console.log(`${b.id}${b.created ? ` (${b.created})` : ''}: ${b.problems.length ? `refused\n  - ${b.problems.join('\n  - ')}` : 'good'}`);

let chosen = null;
if (asked) {
  const b = await examine(asked);
  say(b);
  if (b.problems.length) process.exit(1);
  chosen = b;
} else {
  const current = play.build ? { id: play.build, created: (await r2.json(`sites/${play.build}/manifest.json`))?.created ?? null } : null;
  const all = (await r2.folders('sites/')).map((f) => f.slice('sites/'.length, -1)).filter((id) => id !== play.build);
  const ids = all.filter((id) => MAIN_BUILD.test(id));
  const others = all.filter((id) => !MAIN_BUILD.test(id));
  if (others.length) console.log(`not bf2-web's main, so played only when named: ${others.join(', ')}`);
  // (each build's manifest first, for its date; only the newer ones are examined whole)
  const dated = await Promise.all(ids.map(async (id) => ({ id, created: (await r2.json(`sites/${id}/manifest.json`))?.created ?? null })));
  const newer = dated.filter((d) => d.created && (!current?.created || Date.parse(d.created) > Date.parse(current.created)));
  const examined = [];
  for (const d of newer.sort((a, b) => Date.parse(b.created) - Date.parse(a.created))) {
    const b = await examine(d.id);
    say(b);
    examined.push(b);
    if (!b.problems.length) break;
  }
  const id = newest(examined, current);
  if (!id) {
    console.log(newer.length ? 'no newer build passes: Hoth stays on ' + play.build : `nothing newer than ${play.build ?? 'none'}`);
    output('adopted', '');
    process.exit(newer.length ? 1 : 0);
  }
  chosen = examined.find((b) => b.id === id);
}

const needs = await needsOf(chosen.id);
const next = adopted(play, chosen.id, chosen.manifest, chosen.uiData, needs);
if (needs) console.log('its GPU needs:', JSON.stringify(needs));
if (check) console.log('--check: play.json would name', chosen.id, `(${next.mb} MB, rulebooks ${next.uiData})`);
else {
  writeFileSync(PLAY, JSON.stringify(next, null, 2) + '\n');
  console.log('play.json names', chosen.id, `(${next.mb} MB, rulebooks ${next.uiData})`);
}
output('adopted', check ? '' : chosen.id);
