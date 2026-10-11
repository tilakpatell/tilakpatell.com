// The Battlefront balance runner (spec section 9): the sim headless in Node,
// N times, a line a run and a summary, for the PR body and the hand-off.
//
//   node scripts/battlefront-balance.mjs --skirmish [--runs 10] [--bots 20] [--seconds 180] [--seed 1] [--profile] [--difficulty <name>] [--pve]
//   node scripts/battlefront-balance.mjs --assault [--runs 20] [--bots 20] [--minutes 25] [--seed 1] [--jobs 4]
//
// --skirmish   two teams of bots on Hoth's arena navgrid (fixtures/hothFlat.js), no mode
// --assault    Hoth's Galactic Assault on the same navgrid, bots only, to a result or the minutes;
//              --jobs runs the seeds in that many processes
// --profile    the share of the run spent thinking, stepping bolts and finding paths
// --difficulty the game's difficulty the bots fight at (rookie, normal, medium, expert, default; lib/battlefront/ai/difficulty.js)
// --pve        the Skirmish (Instant Action) bots: their PvE templates, tactics and abilities
// A bot is "stuck" when alive, not in cover or hiding, and standing on one
// spot for 400 steps (20 s): the arena test's rule.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : Number(args[i + 1]);
};
const flag = (name) => args.includes(`--${name}`);
const word = (name) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? null : args[i + 1];
};
const COLUMNS = ['seed', 'winner', 'why', 'stage', 'minutes', 'kills1', 'kills2', 'heroes1', 'heroes2', 'ms'];
const SIDE = { 1: 'Rebels', 2: 'Empire' };

if (!flag('skirmish') && !flag('assault')) {
  console.log('usage: node scripts/battlefront-balance.mjs --skirmish [--runs 10] [--bots 20] [--seconds 180] [--seed 1] [--profile]');
  console.log('       node scripts/battlefront-balance.mjs --assault [--runs 20] [--bots 20] [--minutes 25] [--seed 1] [--jobs 4]');
  process.exit(1);
}

if (flag('assault')) {
  await assault();
  process.exit(0);
}

const runs = opt('runs', 10);
const bots = opt('bots', 20);
const seconds = opt('seconds', 180);
const first = opt('seed', 1);
const difficulty = word('difficulty');
const pve = flag('pve');

// src modules use Vite's extensionless imports and JSON: loaded through Vite
const { createServer } = await import('vite');
const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
try {
  const { loadRulebook } = await vite.ssrLoadModule('/src/lib/battlefront/rulebook.js');
  const { hothFlatNav } = await vite.ssrLoadModule('/src/lib/battlefront/fixtures/hothFlat.js');
  const { runSkirmish } = await vite.ssrLoadModule('/src/lib/battlefront/skirmish.js');
  const { profile } = await vite.ssrLoadModule('/src/lib/battlefront/core.js');
  const rb = loadRulebook();
  const nav = hothFlatNav(rb);
  profile.on = flag('profile');
  const rows = [];
  console.log('seed  kills1  kills2  alive1  alive2  stuck  offNav  ms');
  for (let r = 0; r < runs; r++) {
    const seed = first + r;
    const t = performance.now();
    const out = runSkirmish({ rulebook: rb, nav, seed, bots, seconds, difficulty, pve });
    const ms = Math.round(performance.now() - t);
    rows.push({ seed, ...out, ms });
    console.log([seed, out.kills[1], out.kills[2], out.alive[1], out.alive[2], out.stuck, out.offNav, ms].map((v) => String(v).padEnd(6)).join('  '));
  }
  const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
  const mean = (f) => (sum(f) / rows.length).toFixed(1);
  const wins1 = rows.filter((r) => r.alive[1] > r.alive[2]).length;
  const wins2 = rows.filter((r) => r.alive[2] > r.alive[1]).length;
  console.log(`\n${runs} runs, ${bots} a side, ${seconds} s${difficulty ? `, ${difficulty}` : ''}${pve ? ', the Skirmish bots' : ''}: kills ${mean((r) => r.kills[1])} (Rebels) to ${mean((r) => r.kills[2])} (Empire); more alive at the end: Rebels ${wins1}, Empire ${wins2}, even ${runs - wins1 - wins2}; stuck ${sum((r) => r.stuck)}, off the navgrid ${sum((r) => r.offNav)}; ${mean((r) => r.ms)} ms a run`);
  if (profile.on) {
    const total = sum((r) => r.ms);
    const pct = (v) => `${((100 * v) / total).toFixed(1)} %`;
    console.log(`profile: think ${pct(profile.think)}, bolts.step ${pct(profile.bolts)}, findPath ${pct(profile.path)}`);
  }
} finally {
  await vite.close();
}

// -- Galactic Assault --


// one process's seeds, a JSON line a run
async function assaultRuns(seeds, bots, minutes) {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
  try {
    const { loadRulebook } = await vite.ssrLoadModule('/src/lib/battlefront/rulebook.js');
    const { hothFlatNav } = await vite.ssrLoadModule('/src/lib/battlefront/fixtures/hothFlat.js');
    const { runAssault } = await vite.ssrLoadModule('/src/lib/battlefront/assault.js');
    const rb = loadRulebook();
    const nav = hothFlatNav(rb);
    const rows = [];
    for (const seed of seeds) {
      const t = performance.now();
      const r = runAssault({ rulebook: rb, nav, seed, bots, minutes });
      const row = { seed, winner: r.result ? SIDE[r.result.winner] : 'none', why: r.result?.why ?? '-', stage: r.stage, minutes: Math.round(r.minutes * 10) / 10, kills1: r.kills[1], kills2: r.kills[2], heroes1: r.heroes[1], heroes2: r.heroes[2], ms: Math.round(performance.now() - t), stuck: r.stuck, offNav: r.offNav };
      rows.push(row);
      if (flag('json')) console.log(JSON.stringify(row));
    }
    return rows;
  } finally {
    await vite.close();
  }
}

async function assault() {
  const runs = opt('runs', 20);
  const bots = opt('bots', 20);
  const minutes = opt('minutes', 25);
  const first = opt('seed', 1);
  const jobs = Math.max(1, opt('jobs', 1));
  const seeds = Array.from({ length: runs }, (_, i) => first + i);
  if (flag('json')) {
    const only = args.includes('--seeds') ? args[args.indexOf('--seeds') + 1].split(',').map(Number) : seeds;
    await assaultRuns(only, bots, minutes);
    return;
  }
  let rows;
  if (jobs === 1) rows = await assaultRuns(seeds, bots, minutes);
  else {
    const self = fileURLToPath(import.meta.url);
    const lanes = Array.from({ length: jobs }, (_, j) => seeds.filter((_, i) => i % jobs === j)).filter((l) => l.length);
    const outs = await Promise.all(
      lanes.map(
        (lane) =>
          new Promise((done, fail) => {
            const child = spawn(process.execPath, [self, '--assault', '--json', '--seeds', lane.join(','), '--bots', String(bots), '--minutes', String(minutes)], { stdio: ['ignore', 'pipe', 'inherit'] });
            let text = '';
            child.stdout.on('data', (d) => (text += d));
            child.on('exit', (code) => (code ? fail(new Error(`a job failed (${code})`)) : done(text)));
          }),
      ),
    );
    rows = outs.flatMap((t) => t.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  }
  rows.sort((a, b) => a.seed - b.seed);
  console.log(COLUMNS.join('  '));
  for (const r of rows) console.log(COLUMNS.map((c) => String(r[c]).padEnd(c === 'why' ? 10 : 6)).join('  '));
  const attack = rows.filter((r) => r.winner === 'Empire').length;
  const defend = rows.filter((r) => r.winner === 'Rebels').length;
  const mins = rows.map((r) => r.minutes).sort((a, b) => a - b);
  const median = mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2;
  const mean = (f) => (rows.reduce((n, r) => n + f(r), 0) / rows.length).toFixed(1);
  console.log(
    `\n${rows.length} rounds, ${bots} a side: the Empire (attacking) wins ${attack}, the Rebels ${defend}, no result in ${minutes} min ${rows.length - attack - defend}; median ${median} min; kills ${mean((r) => r.kills1)} (Rebels) to ${mean((r) => r.kills2)} (Empire); heroes ${mean((r) => r.heroes1)} to ${mean((r) => r.heroes2)}; stuck ${rows.reduce((n, r) => n + r.stuck, 0)}, off the navgrid ${rows.reduce((n, r) => n + r.offNav, 0)}; ${mean((r) => r.ms)} ms a round`,
  );
}
