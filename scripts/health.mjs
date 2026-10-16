// The codebase's health in numbers, each one a module in scripts/health/,
// and the ratchet that keeps them from rising (docs/health/budgets.json).
// Design: docs/superpowers/specs/2026-10-06-codebase-health-design.md.
//
//   node scripts/health.mjs                 # measure, print the table, write src/data/health/latest.json
//   node scripts/health.mjs --check         # exit 1 when a metric is over its budget (CI runs this); leaves latest.json
//   node scripts/health.mjs --ratchet       # lower the budgets to today's numbers, append to history.jsonl
//   node scripts/health.mjs --only big-files,todo-notes --json
//
// Fast by design: no browser, no network. Only the bundle metrics (to come)
// read dist/, and --skip build leaves them out.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext } from './health/context.mjs';
import { check, describe, ratchet } from './health/ratchet.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUDGETS = join(ROOT, 'docs/health/budgets.json');
const LATEST = join(ROOT, 'src/data/health/latest.json');
const HISTORY = join(ROOT, 'src/data/health/history.jsonl');

// one module per metric; the order is the order of the table
export const METRICS = ['big-files', 'boundary-breaks', 'cycles', 'lint-disables', 'todo-notes', 'kbd-styles', 'hud-kit', 'stack-pages', 'glsl-sites', 'renderers', 'loops', 'client-json-kb', 'doc-binaries', 'art-mix'];

const args = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const valueOf = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > 0 && !process.argv[i + 1]?.startsWith('--') ? process.argv[i + 1] : null;
};
const only = (valueOf('--only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export async function measure(root = ROOT, ids = METRICS) {
  const ctx = await makeContext(root);
  const out = [];
  for (const id of ids) {
    const { default: run } = await import(`./health/${id}.mjs`);
    out.push(await run(ctx));
  }
  return out;
}

function table(metrics, budgets) {
  const rows = metrics.map((m) => {
    const b = budgets[m.id];
    const flag = typeof b === 'number' ? (m.value > b ? 'OVER' : 'ok') : 'unbudgeted';
    return [m.id, String(m.value), m.unit, typeof b === 'number' ? String(b) : '-', flag, m.detail.slice(0, 3).map((d) => `${d.file} (${d.n})`).join(', ')];
  });
  const head = ['metric', 'value', 'unit', 'budget', '', 'worst'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => c.padEnd(w[i])).join('  ').trimEnd();
  return [line(head), ...rows.map(line)].join('\n');
}

function markdown(metrics, budgets) {
  const rows = metrics.map((m) => {
    const b = budgets[m.id];
    const flag = typeof b === 'number' ? (m.value > b ? '🔴 over' : '🟢') : '⚪ unbudgeted';
    return `| \`${m.id}\` | ${m.value} ${m.unit} | ${typeof b === 'number' ? b : '-'} | ${flag} | ${m.detail.slice(0, 3).map((d) => `\`${d.file}\` ${d.n}`).join('<br>')} |`;
  });
  return ['### Codebase health', '', '| metric | value | budget | | worst |', '| --- | --- | --- | --- | --- |', ...rows, ''].join('\n');
}

async function main() {
  const ids = only.length ? only : METRICS;
  const metrics = await measure(ROOT, ids);
  const budgets = JSON.parse(await readFile(BUDGETS, 'utf8').catch(() => '{}'));
  const sha = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch { return null; } })();
  const date = new Date().toISOString().slice(0, 10);

  if (args.has('--json')) console.log(JSON.stringify({ date, sha, metrics }, null, 2));
  else console.log(table(metrics, budgets));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown(metrics, budgets));

  // the snapshot is the measuring run's: a `--check` (CI's, and every lane's
  // before its PR) leaves it, so two branches that both checked never meet
  // in a merge conflict over the one generated file
  if (!only.length && !args.has('--check')) {
    await mkdir(join(ROOT, 'src/data/health'), { recursive: true });
    const latest = { date, sha, metrics: Object.fromEntries(metrics.map((m) => [m.id, { value: m.value, unit: m.unit, label: m.label, detail: m.detail }])) };
    await writeFile(LATEST, `${JSON.stringify(latest, null, 2)}\n`);
  }

  if (args.has('--ratchet')) {
    if (only.length) throw new Error('--ratchet needs every metric; drop --only');
    const next = ratchet(metrics, budgets);
    await writeFile(BUDGETS, `${JSON.stringify(next, null, 2)}\n`);
    const pr = valueOf('--pr');
    await appendFile(HISTORY, `${JSON.stringify({ date, sha, pr: pr ? Number(pr) : null, metrics: Object.fromEntries(metrics.map((m) => [m.id, m.value])) })}\n`);
    console.log(`\nbudgets: ${Object.entries(next).map(([k, v]) => `${k} ${budgets[k] ?? '-'} → ${v}`).join(', ')}`);
  }

  if (args.has('--check')) {
    // the pass/fail checks run after the budgets, each exiting non-zero on a failure
    const gates = [];
    const over = check(metrics, budgets);
    if (over.length) {
      console.error(`\nover budget:\n${describe(over)}\n\nA repair brings the number back; a reason in the commit message raises the budget (docs/health/README.md).`);
      process.exit(1);
    }
    console.log('\nwithin budget');
    // a gate, not a metric: every row outside the flight that names it is marked
    gates.push([process.execPath, [fileURLToPath(new URL('./flight-island.mjs', import.meta.url)), '--check']]); // planet flight
    for (const [cmd, argv] of gates) execFileSync(cmd, argv, { stdio: 'inherit' });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
