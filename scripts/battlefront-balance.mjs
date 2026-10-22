// The Battlefront balance runner (spec section 9): the sim headless in Node,
// N times, a line a run and a summary, for the PR body and the hand-off.
//
//   node scripts/battlefront-balance.mjs --skirmish [--runs 10] [--bots 20] [--seconds 180] [--seed 1] [--profile] [--difficulty <name>] [--pve]
//   node scripts/battlefront-balance.mjs --assault [--runs 20] [--bots 20] [--minutes 25] [--seed 1] [--jobs 4]
//   node scripts/battlefront-balance.mjs --mode strike|extraction|ewokhunt|supremacy [--runs 12] [--minutes 25] [--seed 1] [--jobs 4]
//   node scripts/battlefront-balance.mjs --instant game|overhaul [--runs 12] [--bots 20] [--seconds 300] [--seed 2] [--jobs 4]
//
// --skirmish   two teams of bots on Hoth's arena navgrid (fixtures/hothFlat.js), no mode
// --assault    Hoth's Galactic Assault on the same navgrid, bots only, to a result or the minutes;
//              --jobs runs the seeds in that many processes
// --mode       the other modes (lane 6), each on its map's arena (fixtures/modeArena.js: Strike on
//              Naboo_01, Extraction on Jabba's palace, Ewok Hunt on Endor_04, Supremacy on Geonosis_02),
//              the players a side the game's, bots only, to a result or the minutes
// --profile    the share of the run spent thinking, stepping bolts and finding paths
// --difficulty the game's difficulty the bots fight at (rookie, normal, medium, expert, default; lib/battlefront/ai/difficulty.js)
// --pve        the Skirmish (Instant Action) bots: their PvE templates, tactics and abilities
// --instant    an Instant Action round as the page starts one (instantAction.js): Supremacy on Hoth's
//              second level over the arena navgrid, the bots a side asked, the command posts' bot logic
//              the game's or the Overhaul's, to its result or the seconds; a line a seed with the kills,
//              the posts each side held at some time, the share of the living bots with a target and
//              firing (a sample a second: NOTES.md's measured rows, the page's `bots` read headless)
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
const INSTANT_COLUMNS = ['seed', 'kills1', 'kills2', 'held1', 'held2', 'target', 'firing', 'end', 'stuck', 'offNav', 'ms'];
const SIDE = { 1: 'Rebels', 2: 'Empire' };

const MODE = args.includes('--mode') ? { strike: 'strike', extraction: 'extraction', ewokhunt: 'ewokHunt', supremacy: 'supremacy' }[args[args.indexOf('--mode') + 1].toLowerCase()] : null;
if (args.includes('--mode') && !MODE) {
  console.log('--mode: strike, extraction, ewokhunt or supremacy');
  process.exit(1);
}
const INSTANT = word('instant');
if (INSTANT && !['game', 'overhaul'].includes(INSTANT)) {
  console.log('--instant: game or overhaul (the command posts’ bot logic)');
  process.exit(1);
}
if (!flag('skirmish') && !flag('assault') && !MODE && !INSTANT) {
  console.log('usage: node scripts/battlefront-balance.mjs --skirmish [--runs 10] [--bots 20] [--seconds 180] [--seed 1] [--profile]');
  console.log('       node scripts/battlefront-balance.mjs --assault [--runs 20] [--bots 20] [--minutes 25] [--seed 1] [--jobs 4]');
  console.log('       node scripts/battlefront-balance.mjs --instant game|overhaul [--runs 12] [--bots 20] [--seconds 300] [--seed 2] [--jobs 4]');
  process.exit(1);
}

if (INSTANT) {
  await instant();
  process.exit(0);
}

if (flag('assault') || MODE) {
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
const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
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
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
  try {
    const { loadRulebook } = await vite.ssrLoadModule('/src/lib/battlefront/rulebook.js');
    const { hothFlatNav } = await vite.ssrLoadModule('/src/lib/battlefront/fixtures/hothFlat.js');
    const { modeArena } = await vite.ssrLoadModule('/src/lib/battlefront/fixtures/modeArena.js');
    const { runAssault } = await vite.ssrLoadModule('/src/lib/battlefront/assault.js');
    const rb = loadRulebook();
    const arena = MODE ? modeArena(rb, MODE) : { rulebook: rb, nav: hothFlatNav(rb), level: 'hoth', teams: null, bots };
    const rows = [];
    for (const seed of seeds) {
      const t = performance.now();
      const r = runAssault({ ...arena, seed, minutes, mode: MODE ?? 'galacticAssault' });
      const row = { seed, winner: r.result ? (r.result.winner ? SIDE[r.result.winner] : 'draw') : 'none', why: r.result?.why ?? '-', stage: r.stage, minutes: Math.round(r.minutes * 10) / 10, kills1: r.kills[1], kills2: r.kills[2], heroes1: r.heroes[1], heroes2: r.heroes[2], ms: Math.round(performance.now() - t), stuck: r.stuck, offNav: r.offNav, attack: SIDE[r.sim.ga.rounds?.[0]?.attack ?? r.sim.ga.attack] };
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
            const child = spawn(process.execPath, [self, ...(MODE ? ['--mode', MODE] : ['--assault']), '--json', '--seeds', lane.join(','), '--bots', String(bots), '--minutes', String(minutes)], { stdio: ['ignore', 'pipe', 'inherit'] });
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
  if (MODE) return modeSummary(rows, minutes);
  const attack = rows.filter((r) => r.winner === 'Empire').length;
  const defend = rows.filter((r) => r.winner === 'Rebels').length;
  const mins = rows.map((r) => r.minutes).sort((a, b) => a - b);
  const median = mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2;
  const mean = (f) => (rows.reduce((n, r) => n + f(r), 0) / rows.length).toFixed(1);
  console.log(
    `\n${rows.length} rounds, ${bots} a side: the Empire (attacking) wins ${attack}, the Rebels ${defend}, no result in ${minutes} min ${rows.length - attack - defend}; median ${median} min; kills ${mean((r) => r.kills1)} (Rebels) to ${mean((r) => r.kills2)} (Empire); heroes ${mean((r) => r.heroes1)} to ${mean((r) => r.heroes2)}; stuck ${rows.reduce((n, r) => n + r.stuck, 0)}, off the navgrid ${rows.reduce((n, r) => n + r.offNav, 0)}; ${mean((r) => r.ms)} ms a round`,
  );
}

// a mode's table's last line: who won how, how long, the kills, stuck and off
function modeSummary(rows, minutes) {
  const mins = rows.map((r) => r.minutes).sort((a, b) => a - b);
  const median = Math.round((mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2) * 100) / 100;
  const count = (f) => rows.filter(f).length;
  const why = [...new Set(rows.map((r) => `${r.winner} ${r.why}`))].map((k) => `${k} ${count((r) => `${r.winner} ${r.why}` === k)}`).join(', ');
  const mean = (f) => (rows.reduce((n, r) => n + f(r), 0) / rows.length).toFixed(1);
  console.log(`\n${rows.length} rounds of ${MODE} (the ${rows[0]?.attack} attack first): ${why}; no result in ${minutes} min ${count((r) => r.winner === 'none')}; median ${median} min; kills ${mean((r) => r.kills1)} (Rebels) to ${mean((r) => r.kills2)} (Empire); stuck ${rows.reduce((n, r) => n + r.stuck, 0)}, off the navgrid ${rows.reduce((n, r) => n + r.offNav, 0)}; ${mean((r) => r.ms)} ms a round`);
}

// -- Instant Action --

// one process's seeds of Instant Action rounds, a JSON line a run
async function instantRuns(seeds, bots, seconds) {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
  try {
    const { loadLevel, loadRulebook, teamsFor } = await vite.ssrLoadModule('/src/lib/battlefront/rulebook.js');
    const { hothFlatNav } = await vite.ssrLoadModule('/src/lib/battlefront/fixtures/hothFlat.js');
    const { startInstantAction } = await vite.ssrLoadModule('/src/lib/battlefront/instantAction.js');
    const { step } = await vite.ssrLoadModule('/src/lib/battlefront/sim.js');
    const { STUCK_STEPS } = await vite.ssrLoadModule('/src/lib/battlefront/skirmish.js');
    const { STEP } = await vite.ssrLoadModule('/src/lib/battlefront/core.js');
    const { walkable } = await vite.ssrLoadModule('/src/lib/battlefront/nav.js');
    const gs = (await vite.ssrLoadModule('/src/data/bf2017/gameSettings.json')).default;
    const rb = loadRulebook();
    await loadLevel('hoth_02');
    const nav = hothFlatNav(rb);
    const sides = teamsFor(rb, 'hoth');
    const rows = [];
    for (const seed of seeds) {
      const t = performance.now();
      const { sim } = startInstantAction({ rulebook: rb, gs, nav, seed, level: 'hoth_02', mode: 'supremacy', botLogic: INSTANT, teams: { 1: sides.light, 2: sides.dark }, bots: { friendly: bots, enemy: bots } });
      const held = { 1: new Set(), 2: new Set() };
      const still = new Map();
      const stuck = new Set();
      let offNav = 0;
      let samples = 0;
      let targeted = 0;
      let firing = 0;
      const steps = Math.round(seconds / STEP);
      let i = 1;
      for (; i <= steps && !sim.ga.result; i++) {
        step(sim, []);
        sim.ga.objectives.forEach((o, k) => {
          const team = o.owner === 'attack' ? sim.ga.attack : o.owner === 'defend' ? 3 - sim.ga.attack : 0;
          if (team) held[team].add(k);
        });
        for (const e of sim.entities.values()) {
          if (!e.alive || e.kind !== 'soldier') continue;
          const was = still.get(e.id);
          if (was && was.x === e.at[0] && was.z === e.at[2]) {
            if (e.brain?.intent?.mode === 'cover' || e.brain?.intent?.mode === 'hide') was.n = 0;
            else if (++was.n >= STUCK_STEPS) stuck.add(e.id);
          } else still.set(e.id, { x: e.at[0], z: e.at[2], n: 0 });
          if (i % 100 === 0 && !walkable(nav, e.at[0], e.at[2])) offNav++;
          // (a sample a second of the living bots: a target, and a shot in the last fifth of a second, as the page's `bots` reads them)
          if (i % Math.round(1 / STEP) === 0 && e.bot) {
            samples++;
            if (e.brain?.target) targeted++;
            if (e.gun && sim.time - e.gun.lastShot < 0.2) firing++;
          }
        }
      }
      const pct = (n) => Math.round((1000 * n) / Math.max(1, samples)) / 10;
      const row = { seed, kills1: sim.score[1].kills, kills2: sim.score[2].kills, held1: held[1].size, held2: held[2].size, target: pct(targeted), firing: pct(firing), end: Math.round(sim.time), stuck: stuck.size, offNav, ms: Math.round(performance.now() - t) };
      rows.push(row);
      if (flag('json')) console.log(JSON.stringify(row));
    }
    return rows;
  } finally {
    await vite.close();
  }
}

async function instant() {
  const runs = opt('runs', 12);
  const bots = opt('bots', 20);
  const seconds = opt('seconds', 300);
  const first = opt('seed', 2);
  const jobs = Math.max(1, opt('jobs', 1));
  const seeds = Array.from({ length: runs }, (_, i) => first + i);
  if (flag('json')) {
    const only = args.includes('--seeds') ? args[args.indexOf('--seeds') + 1].split(',').map(Number) : seeds;
    await instantRuns(only, bots, seconds);
    return;
  }
  let rows;
  if (jobs === 1) rows = await instantRuns(seeds, bots, seconds);
  else {
    const self = fileURLToPath(import.meta.url);
    const lanes = Array.from({ length: jobs }, (_, j) => seeds.filter((_, i) => i % jobs === j)).filter((l) => l.length);
    const outs = await Promise.all(
      lanes.map(
        (lane) =>
          new Promise((done, fail) => {
            const child = spawn(process.execPath, [self, '--instant', INSTANT, '--json', '--seeds', lane.join(','), '--bots', String(bots), '--seconds', String(seconds)], { stdio: ['ignore', 'pipe', 'inherit'] });
            let text = '';
            child.stdout.on('data', (d) => (text += d));
            child.on('exit', (code) => (code ? fail(new Error(`a job failed (${code})`)) : done(text)));
          }),
      ),
    );
    rows = outs.flatMap((t) => t.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  }
  rows.sort((a, b) => a.seed - b.seed);
  console.log(INSTANT_COLUMNS.join('  '));
  for (const r of rows) console.log(INSTANT_COLUMNS.map((c) => String(r[c]).padEnd(6)).join('  '));
  const mean = (f) => (rows.reduce((n, r) => n + f(r), 0) / rows.length).toFixed(1);
  const sd = (f) => Math.sqrt(rows.reduce((n, r) => n + (f(r) - Number(mean(f))) ** 2, 0) / Math.max(1, rows.length - 1)).toFixed(1);
  console.log(
    `\n${rows.length} Instant Action rounds of Supremacy on hoth_02, ${bots} a side, ${seconds} s, the ${INSTANT === 'overhaul' ? 'Overhaul’s' : 'game’s'} bot logic: kills ${mean((r) => r.kills1 + r.kills2)} ± ${sd((r) => r.kills1 + r.kills2)} a round (${mean((r) => r.kills1)} Rebels, ${mean((r) => r.kills2)} Empire); posts held at some time ${mean((r) => r.held1)} and ${mean((r) => r.held2)} of 5; a target ${mean((r) => r.target)} %, firing ${mean((r) => r.firing)} %; ended ${rows.filter((r) => r.end < seconds).length} early; stuck ${rows.reduce((n, r) => n + r.stuck, 0)}, off the navgrid ${rows.reduce((n, r) => n + r.offNav, 0)}; ${mean((r) => r.ms)} ms a round`,
  );
}
