// Tier 5, the vision judge still judges right: vlm.mjs's judge() over a
// labelled set of sheets (sheets/labels.json: what each is meant to be and
// the band a fair score falls in), and its pick() over pick sets (four
// candidates, one of them the thing). A judge that drifts with an engine
// update is the quietest failure in the pipeline: good models remade for
// ever, or bad ones shipped.
//
//   node scripts/ai-e2e/evals/vision.mjs                  every backend reachable here (Claude Code, Qwen3-VL)
//   node scripts/ai-e2e/evals/vision.mjs --backend qwen   one (fake: the self-test, against fixtures/)
//   evaluate({ sheets, picks }) → { backend, judge: { n, accuracy, mae, confusion, rows }, pick: { n, right, accuracy, rows } }
//
// Writes results/<date>-vision.json (AI_RESULTS for elsewhere) and exits 1
// when a backend is under its line.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// The lines each backend must stay above. Claude is the judge that gates a
// reseed, so it's held hardest; Qwen3-VL-8B is a note, not a veto (make.mjs),
// and is known to misjudge a right model now and then. pick() chooses the
// concept picture a model is made from: four in five right is the least
// that beats drawing one picture and hoping.
export const LINES = { claude: { judge: 0.85, pick: 0.8 }, qwen: { judge: 0.7, pick: 0.8 }, fake: { judge: 0, pick: 0 } };

const mid = ([lo, hi]) => (lo + hi) / 2;
// a sheet is labelled good when its band sits at or above the middle of the scale, bad when at or below it
const kind = ([lo, hi]) => (lo >= 5 ? 'good' : hi <= 6 ? 'bad' : 'either');

export async function evaluate({ sheets = join(HERE, 'sheets'), picks = join(HERE, 'pick-sets') } = {}) {
  const vlm = await import('../../gen3d/vlm.mjs');
  const backend = vlm.which();
  if (!backend) throw new Error('no vision judge reachable here (scripts/gen3d/README.md: The model’s eyes)');
  // the judge's server stopped however this ends: left running it holds the GPU
  // (the first night's real run waited 20 minutes behind one, and gave up)
  process.once('exit', () => vlm.stop());
  try {
    return await judgeAll(vlm, backend, sheets, picks);
  } finally {
    vlm.stop();
  }
}

// a sheet or a pick the judge couldn't answer (a timeout, a reply with no
// JSON) is wrong, with why, and the rest are still asked
async function judgeAll(vlm, backend, sheets, picks) {
  const labels = JSON.parse(readFileSync(join(sheets, 'labels.json'), 'utf8'));
  const rows = [];
  for (const [sheet, l] of Object.entries(labels)) {
    try {
      const v = await vlm.judge(l.what, join(sheets, sheet));
      rows.push({ sheet, what: l.what, band: l.score, score: v.score, inBand: v.score >= l.score[0] && v.score <= l.score[1], problems: v.problems });
    } catch (e) {
      rows.push({ sheet, what: l.what, band: l.score, score: null, inBand: false, error: String(e.message ?? e).slice(0, 300) });
    }
  }
  const confusion = { good: { good: 0, bad: 0 }, bad: { good: 0, bad: 0 } };
  const answered = rows.filter((r) => r.score != null);
  for (const r of answered) {
    const k = kind(r.band);
    if (k !== 'either') confusion[k][r.score >= 7 ? 'good' : 'bad'] += 1;
  }
  // (the error over the sheets it answered; the ones it didn't are wrong in `accuracy` and counted in `unanswered`)
  const judge = { n: rows.length, accuracy: rows.filter((r) => r.inBand).length / rows.length, mae: answered.length ? answered.reduce((s, r) => s + Math.abs(r.score - mid(r.band)), 0) / answered.length : null, unanswered: rows.length - answered.length, confusion, rows };
  const sets = existsSync(join(picks, 'labels.json')) ? JSON.parse(readFileSync(join(picks, 'labels.json'), 'utf8')) : {};
  const picked = [];
  for (const [set, l] of Object.entries(sets)) {
    const files = readdirSync(join(picks, set)).filter((f) => /\.(png|webp|jpe?g)$/i.test(f)).sort();
    try {
      const p = await vlm.pick(l.what, files.map((f) => join(picks, set, f)));
      picked.push({ set, what: l.what, chose: files[p.best], right: l.right, scores: p.scores.map((s) => s.score) });
    } catch (e) {
      picked.push({ set, what: l.what, chose: null, right: l.right, error: String(e.message ?? e).slice(0, 300) });
    }
  }
  const right = picked.filter((p) => p.chose === p.right).length;
  return { backend, judge, pick: { n: picked.length, right, accuracy: picked.length ? right / picked.length : 1, rows: picked } };
}

// What fell short of the backend's line, in words; none means it passes.
export function passes(r) {
  const line = LINES[r.backend] ?? LINES.qwen;
  const out = [];
  if (r.judge.accuracy < line.judge) out.push(`judge ${Math.round(r.judge.accuracy * 100)}% in band, under ${line.judge * 100}%`);
  if (r.pick.accuracy < line.pick) out.push(`pick ${Math.round(r.pick.accuracy * 100)}% right, under ${line.pick * 100}%`);
  return out;
}

const resultsDir = () => process.env.AI_RESULTS ?? join(HERE, '..', 'results');
export const today = () => new Date().toISOString().slice(0, 10);

// The backends this machine can reach: Claude Code when it's logged in, Qwen3-VL when its files are here.
async function reachable() {
  const vlm = await import('../../gen3d/vlm.mjs');
  const out = [];
  if (vlm.claudeCode()) out.push('claude');
  if (existsSync(vlm.LLAMA.exe) && existsSync(vlm.LLAMA.model)) out.push('qwen');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--backend');
  const one = at > 0 ? process.argv[at + 1] : null;
  let results;
  if (one) {
    // one backend in this process: vlm.mjs picks its backend once, from GEN3D_JUDGE
    if (one === 'qwen' || one === 'fake') process.env.GEN3D_JUDGE = one;
    const fixtures = one === 'fake' ? { sheets: join(HERE, 'fixtures', 'sheets'), picks: join(HERE, 'fixtures', 'pick-sets') } : {};
    if (one === 'fake' && !process.env.GEN3D_JUDGE_SCRIPT) throw new Error('--backend fake needs GEN3D_JUDGE_SCRIPT (evals/fixtures/judge.json, copied somewhere it may write calls.json)');
    results = [await evaluate(fixtures)];
    if (process.env.VISION_ONE_OUT) {
      writeFileSync(process.env.VISION_ONE_OUT, JSON.stringify(results[0]));
      process.exit(0);
    }
  } else {
    // each backend in a process of its own, so neither sees the other's choice
    results = [];
    for (const b of await reachable()) {
      const tmp = join(resultsDir(), `.vision-${b}.json`);
      mkdirSync(resultsDir(), { recursive: true });
      execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--backend', b], { stdio: 'inherit', env: { ...process.env, VISION_ONE_OUT: tmp } });
      results.push(JSON.parse(readFileSync(tmp, 'utf8')));
    }
    if (!results.length) throw new Error('no vision judge reachable here: neither Claude Code (logged in) nor Qwen3-VL (scripts/gen3d/README.md)');
  }
  const short = results.flatMap((r) => passes(r).map((p) => `${r.backend}: ${p}`));
  const file = join(resultsDir(), `${today()}-vision.json`);
  mkdirSync(resultsDir(), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ tier: 'evals', name: 'vision', ok: short.length === 0, short, lines: LINES, results }, null, 1)}\n`);
  for (const r of results) console.log(`${r.backend}: judge ${Math.round(r.judge.accuracy * 100)}% in band (MAE ${r.judge.mae?.toFixed(2) ?? '-'}${r.judge.unanswered ? `, ${r.judge.unanswered} unanswered` : ''}), pick ${r.pick.right}/${r.pick.n}`);
  console.log(short.length ? `under the line: ${short.join('; ')}` : 'every judge above its line');
  console.log(file);
  process.exit(short.length ? 1 : 0);
}
