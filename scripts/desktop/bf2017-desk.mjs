// What lane W's desktop jobs share (the picture-everywhere design, §7:
// docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md).
// Each job is a script beside this one, `bf2017-<job>.mjs`, run by
// .github/workflows/bf2017-desktop.yml on the self-hosted runner
// [self-hosted, gpu] from the Actions tab, or by hand on the desktop:
//
//   node scripts/desktop/bf2017-<job>.mjs [--dry] [--only a,b] [--limit N] [--no-pr] [--out <dir>]
//
//   dry      the plan only: what the job would make, from the repository's
//            own data, and what the machine has of what it needs. Nothing
//            is encoded, uploaded, committed or pushed. It runs anywhere
//            (a cloud session, CI), which is how its plumbing is proved.
//   only     the job's items whose name has one of these words in it
//   limit    the first N items (a first run on the owner's desktop)
//   no-pr    make it in this checkout and stop (by hand, to look first)
//   out      where a dry run writes its plan (default: the system's temp)
//
// A real run takes its own checkout beside the repository (<repo>-bf2017,
// as gen3d takes <repo>-gen3d), on a fresh branch from origin/main, makes
// the job there, writes its evidence under docs/superpowers/evidence/
// bf2017-picture/, and opens (or updates) one pull request, as the gen3d
// jobs do (lib.mjs: workspace, fresh, push, pullRequest).
//
// The export and its tools live on the desktop, never in this repository:
// BF2_EXPORT (default ~/Downloads/BF2_Extract) holds web/, web_opt/, tool/
// (ktx2_encode.py, bf2export), maps_work/ and logs/. What it makes goes to
// the private bucket bf2017-assets on R2 through scripts/bucket-put.mjs
// (the export's tool/upload_supabase.py sent it to Supabase until
// 2026-10-21). The bucket's keys are the runner's .env (R2_ACCESS_KEY_ID and
// R2_SECRET_ACCESS_KEY), never the repository's, never printed.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { keysOf } from '../lib/bucket.mjs';
import { REPO, deps, fresh, git, keepAwake, pullRequest, push, summary, waitForGpu, workspace } from './lib.mjs';

export const JOBS = ['panoramas', 'atlases', 'textures', 'uastc', 'depots', 'gate'];
export const EVIDENCE = 'docs/superpowers/evidence/bf2017-picture';
export const evidenceDir = (job) => `${EVIDENCE}/${job === 'gate' ? 'gate' : `w/${job}`}`;

// Where the export, its tools and the encoders are on this machine.
export function desk(env = process.env) {
  const root = resolve(env.BF2_EXPORT ?? join(env.USERPROFILE ?? homedir(), 'Downloads', 'BF2_Extract'));
  return {
    root,
    web: join(root, 'web'),
    webOpt: join(root, 'web_opt'),
    tool: join(root, 'tool'),
    mapsWork: join(root, 'maps_work'),
    logs: join(root, 'logs'),
    python: env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'),
    texconv: env.TEXCONV ?? 'texconv',
    chrome: env.CHROME ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'),
  };
}

// The bucket's keys, as present or not: the values never leave this function
// but into a child's environment (childEnv).
export function keyState(env = process.env) {
  return { key: Boolean(keysOf(env)) };
}

// The environment a child gets: every script and the uploader read the same
// two names (lib/bucket.mjs), so the runner's is passed as it is.
export function childEnv(env = process.env) {
  return { ...env };
}

// The uploader's arguments for a list of files under the export's web_opt/:
// each to bf2017-assets under web/, recorded in web_opt/upload_state.tsv
// → [script, …args], for step(process.execPath, …)
export const uploadArgs = (d, list) => [join(REPO, 'scripts', 'bucket-put.mjs'), '--root', d.webOpt, '--list', list, '--bucket', 'bf2017-assets', '--prefix', 'web/'];

export function args(argv = process.argv.slice(2)) {
  const has = (f) => argv.includes(f);
  const val = (f) => (has(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const only = (val('--only') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const limit = Number(val('--limit')) || 0;
  return { dry: has('--dry'), only, limit, noPr: has('--no-pr'), out: val('--out') ?? null };
}

// The plan's items cut down by --only and --limit (each item has a `name`).
export function pick(items, { only = [], limit = 0 } = {}) {
  const kept = only.length ? items.filter((i) => only.some((w) => String(i.name).toLowerCase().includes(w))) : items;
  return limit ? kept.slice(0, limit) : kept;
}

// Is a command on PATH?
export function onPath(cmd) {
  if (!cmd) return false;
  if (/[\\/]/.test(cmd)) return existsSync(cmd);
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

// What a job needs of this machine, checked: [{ name, ok, detail, fix }].
// A need is { name, file } (a path that must exist), { name, cmd } (on
// PATH), or { name, keys: true } (the bucket's keys in the environment).
export function preflight(needs, env = process.env, { exists = existsSync, which = onPath } = {}) {
  return needs.map((n) => {
    if (n.keys) {
      const ok = keyState(env).key;
      return { name: n.name, ok, detail: `R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY ${ok ? 'set' : 'missing'}`, fix: ok ? undefined : n.fix };
    }
    const ok = n.file ? exists(n.file) : which(n.cmd);
    return { name: n.name, ok, detail: n.file ?? n.cmd, fix: ok ? undefined : n.fix };
  });
}

// The plan and the checks as the run's summary (markdown, for the Actions
// summary and the evidence).
export function planMarkdown(job, { dry, items, checks, notes = [], columns }) {
  const lines = [`## bf2017 ${job}${dry ? ' (dry run: nothing made)' : ''}`, ''];
  for (const n of notes) lines.push(`- ${n}`);
  if (notes.length) lines.push('');
  lines.push('| needs | ok | detail |', '| --- | --- | --- |');
  for (const c of checks) lines.push(`| ${c.name} | ${c.ok ? 'yes' : '**no**'} | ${c.detail}${c.fix ? `; fix: ${c.fix}` : ''} |`);
  lines.push('', `${items.length} item${items.length === 1 ? '' : 's'}.`);
  if (items.length && columns) {
    lines.push('', `| ${columns.join(' | ')} |`, `| ${columns.map(() => '---').join(' | ')} |`);
    for (const i of items.slice(0, 40)) lines.push(`| ${columns.map((c) => String(i[c] ?? '')).join(' | ')} |`);
    if (items.length > 40) lines.push(`| … ${items.length - 40} more | ${columns.slice(1).map(() => '').join(' | ')} |`);
  }
  return lines.join('\n');
}

const writeJson = (file, data) => {
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
};

// Today, for branch names and the evidence: 2026-10-11.
export const today = (d = new Date()) => d.toISOString().slice(0, 10);

// A job's command line. `spec` is the job:
//   { job, title, vram (MiB of the GPU it waits for; 0 for none), needs(d) → [need], plan({ root, d, env }) → { items, notes? }, columns,
//     run(items, { root, d, env, log }) → { files: [repo paths changed], report: markdown, failed? } }
// A dry run prints the plan and the checks and writes plan.json to --out.
// A real run stops before anything when a need is missing, makes the items
// in the job's checkout, and opens the pull request when files changed.
export async function main(spec, argv = process.argv.slice(2), env = process.env) {
  const a = args(argv);
  const d = desk(env);
  const log = (m) => console.log(`${new Date().toLocaleTimeString('en-GB')} ${m}`);
  const checks = preflight(spec.needs(d), env);
  if (a.dry) {
    const plan = await spec.plan({ root: REPO, d, env, dry: true });
    const items = pick(plan.items, a);
    const md = planMarkdown(spec.job, { dry: true, items, checks, notes: plan.notes, columns: spec.columns });
    console.log(md);
    summary(md);
    const out = resolve(a.out ?? join(tmpdir(), `bf2017-${spec.job}-dry`));
    writeJson(join(out, 'plan.json'), { _source: `scripts/desktop/bf2017-${spec.job}.mjs --dry: the plan from the repository's data, the checks of this machine`, job: spec.job, dry: true, at: new Date().toISOString(), items, notes: plan.notes ?? [], checks });
    console.log(`\nplan → ${join(out, 'plan.json')}`);
    return { dry: true, items, checks };
  }
  const missing = checks.filter((c) => !c.ok);
  if (missing.length) {
    const md = planMarkdown(spec.job, { dry: false, items: [], checks });
    console.log(md);
    summary(md);
    throw new Error(`missing on this machine: ${missing.map((c) => c.name).join(', ')} (node scripts/desktop/doctor.mjs says how to fix each)`);
  }
  if (spec.vram && !(await waitForGpu(spec.vram, { minutes: Number(env.DESKTOP_GPU_WAIT_MINUTES ?? 45), log }))) throw new Error(`the GPU is busy (${spec.job} wants ${Math.round(spec.vram / 1024)} GB free): run it again when it is free`);
  const awake = keepAwake();
  try {
    return await makeIn(spec, a, d, env, checks, log);
  } finally {
    awake.stop();
  }
}

async function makeIn(spec, a, d, env, checks, log) {
  const branch = `desktop/bf2017-${spec.job}-${today()}`;
  const root = a.noPr ? REPO : workspace('bf2017');
  if (!a.noPr) {
    fresh(root, branch);
    deps(root, log);
  }
  const plan = await spec.plan({ root, d, env, dry: false });
  const items = pick(plan.items, a);
  log(`${spec.job}: ${items.length} item(s) in ${root}`);
  const made = await spec.run(items, { root, d, env: childEnv(env), log });
  const md = [planMarkdown(spec.job, { dry: false, items, checks, notes: plan.notes, columns: spec.columns }), '', made.report ?? ''].join('\n');
  summary(md);
  mkdirSync(join(root, evidenceDir(spec.job)), { recursive: true });
  writeFileSync(join(root, evidenceDir(spec.job), 'README.md'), `${md}\n`);
  if (a.noPr) {
    console.log(md);
    if (made.failed) process.exitCode = 1;
    return made;
  }
  // (only what the job names: a path it didn't make is left out, and what
  // else a script touched in the checkout stays out of the commit)
  const files = [...new Set([...(made.files ?? []), evidenceDir(spec.job)])].filter((f) => existsSync(join(root, f)));
  git(root, 'add', '-A', '--', ...files);
  if (!git(root, 'diff', '--cached', '--name-only')) {
    log('nothing changed: no pull request');
    return made;
  }
  git(root, 'commit', '-q', '-m', `${spec.title}: the desktop's run of ${today()}`, '-m', `Made on the owner's desktop by scripts/desktop/bf2017-${spec.job}.mjs (.github/workflows/bf2017-desktop.yml).`);
  await push(root, branch);
  const pr = pullRequest(root, { branch, title: `${spec.title} (the desktop, ${today()})`, body: `${md}\n\n_Made on the owner's desktop by \`scripts/desktop/bf2017-${spec.job}.mjs\`._` });
  log(`→ ${pr}`);
  summary(`\nPull request: ${pr}`);
  if (made.failed) process.exitCode = 1;
  return { ...made, pr };
}

// The export's texture index (web/textures.jsonl: name, file, width,
// height, format, srgb), on the desktop from the export, elsewhere from the
// bucket's copy in lab/assets/bf2017/ (scripts/lib/bf2017-bucket.mjs) when
// a session has fetched it; null when neither is there.
export function textureIndexFile(d, root = REPO) {
  return [join(d.web, 'textures.jsonl'), join(root, 'lab/assets/bf2017/web/textures.jsonl')].find((f) => existsSync(f)) ?? null;
}

// A file of JSON lines, read whole.
export const jsonLines = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

// A job script's entry: main(), a failure said in a line (and in the run's
// summary) with exit 1 rather than a stack.
export function runCli(spec) {
  return main(spec).catch((e) => {
    console.error(`bf2017 ${spec.job}: ${e.message}`);
    summary(`- **bf2017 ${spec.job} failed**: ${e.message}`);
    process.exitCode = 1;
  });
}

// A child run with its output shown live; throws with the command's name on a non-zero exit.
export function step(cmd, argv, { cwd, env, log = console.log } = {}) {
  log(`$ ${[cmd, ...argv].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`);
  execFileSync(cmd, argv, { cwd, env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
}

// The export's encoder's class for a texture (lane D's rule, web_optimize.py's):
// a derived normal → normal, a derived ORM → attrib, colour (sRGB by the
// index or the format, or listed in web_opt/ktx2_color.txt) → color, else attrib.
export function encodeClass(t, colourSet = new Set()) {
  const f = String(t.file ?? '').toLowerCase();
  if (f.includes('__normal')) return 'normal';
  if (f.includes('__orm_')) return 'attrib';
  if (t.srgb || /_SRGB$/i.test(t.format ?? '') || colourSet.has(f) || colourSet.has(String(t.name ?? '').toLowerCase())) return 'color';
  return 'attrib';
}

export const ktxOf = (file) => file.replace(/\.png$/i, '.ktx2');

// Encode a list of the export's textures with its own encoder and send the
// KTX2 to the bucket, as lane D's pass did:
//   python tool/ktx2_encode.py --list <tsv> --max N --workers W --tmp web_opt/_ktxtmp
//   node scripts/bucket-put.mjs --root web_opt --list <txt> --bucket bf2017-assets --prefix web/
// `rows`: index rows ({ name, file, srgb, format }). → { made: [row], failed: [row] }
export function encodeAndUpload(rows, { d, env, log, list, max = 2048, workers = 14, extra = [] }) {
  const colourFile = join(d.webOpt, 'ktx2_color.txt');
  const colours = new Set(existsSync(colourFile) ? readFileSync(colourFile, 'utf8').split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter(Boolean) : []);
  const tsv = join(d.webOpt, `_${list}_list.tsv`);
  writeFileSync(tsv, `${rows.map((t) => `${join(d.web, t.file)}\t${encodeClass(t, colours)}`).join('\n')}\n`);
  try {
    step(d.python, [join(d.tool, 'ktx2_encode.py'), '--list', tsv, '--max', String(max), '--workers', String(workers), '--tmp', join(d.webOpt, '_ktxtmp'), ...extra], { env, log });
  } catch (e) {
    // (the encoder exits 1 for one failed file; what landed is counted below)
    log(`ktx2_encode.py: ${e.message.split('\n')[0]}`);
  }
  const made = rows.filter((t) => existsSync(join(d.webOpt, ktxOf(t.file))));
  const failed = rows.filter((t) => !made.includes(t));
  if (made.length) {
    const up = join(d.webOpt, `_${list}_upload.txt`);
    writeFileSync(up, `${made.map((t) => ktxOf(t.file)).join('\n')}\n`);
    step(process.execPath, uploadArgs(d, up), { env, log });
  }
  return { made, failed };
}

// The coverage ledger again from the uploader's own record (no key: the
// export's web_opt/upload_state.tsv is the listing), so the PR carries the
// rows that moved; then its check, said in the report (red is the owner's to read).
export function ledgerAgain(root, d, { env, log }) {
  step(process.execPath, ['scripts/bf2017-coverage.mjs', '--root', d.webOpt], { cwd: root, env, log });
  try {
    step(process.execPath, ['scripts/bf2017-coverage.mjs', '--check'], { cwd: root, env, log });
    return 'The coverage check passes on the new ledger.';
  } catch {
    return '**The coverage check fails on the new ledger**: rows that moved need an owner in `scripts/lib/bf2017-owners.mjs` (the log lists the first twenty).';
  }
}

// What the doctor checks for these jobs (scripts/desktop/doctor.mjs, group
// bf2017): none is needed by gen3d, voices or motion, so a missing one is a
// "no" with its fix, never a red doctor. → [{ name, ok, detail, fix }]
export function bf2017Checks(env = process.env, io = {}) {
  const d = desk(env);
  return preflight(
    [
      { name: 'the export (BF2_EXPORT)', file: d.root, fix: 'set BF2_EXPORT in the runner\'s .env to the export folder (default ~\\Downloads\\BF2_Extract)' },
      { name: "the export's texture index", file: join(d.web, 'textures.jsonl'), fix: 'the export writes web/textures.jsonl' },
      { name: "the export's encoder (tool/ktx2_encode.py)", file: join(d.tool, 'ktx2_encode.py'), fix: 'the export keeps its tools in tool/' },
      { name: 'the exporter (tool/bf2export.csproj)', file: join(d.tool, 'bf2export.csproj'), fix: 'the exporter, on Frosty\'s SDK, in the export\'s tool/' },
      { name: "the uploader's record (web_opt/upload_state.tsv)", file: join(d.webOpt, 'upload_state.tsv'), fix: "written by the uploader's first run (scripts/bucket-put.mjs)" },
      { name: 'the depot probe (maps_work/shaderdepots.jsonl)', file: join(d.mapsWork, 'shaderdepots.jsonl'), fix: "the exporter's depot probe writes it" },
      { name: 'python', cmd: d.python, fix: 'Python 3 on PATH (or set PYTHON)' },
      { name: 'texconv (BC6H to half floats)', cmd: d.texconv, fix: 'winget install Microsoft.DirectXTex, or set TEXCONV' },
      { name: 'toktx (UASTC)', cmd: env.TOKTX ?? 'toktx', fix: 'winget install KhronosGroup.KTX-Software, or set TOKTX' },
      { name: 'ffmpeg', cmd: 'ffmpeg', fix: 'winget install Gyan.FFmpeg' },
      { name: "the bucket's keys", keys: true, fix: "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (R2's S3 keys) in the runner's .env (~\\actions-runner\\.env), then restart the runner" },
      { name: 'Chrome (the gate)', file: d.chrome, fix: 'install Google Chrome, or set CHROME' },
    ],
    env,
    io,
  );
}

// Does that Chrome give WebGPU an adapter on this machine's chip? (the
// gate's webgpu leg). Uses the repository's own Playwright when it's
// installed; → { ok, detail }
export async function webgpuCheck(chrome, root = REPO) {
  let chromium;
  try {
    ({ chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright-core/index.mjs')).href));
  } catch {
    return { ok: false, detail: 'not checked: no playwright-core in this checkout (the gate checks it when it runs)' };
  }
  let browser;
  try {
    browser = await chromium.launch({ executablePath: chrome, args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'], timeout: 30000 });
    const page = await browser.newPage();
    const info = await page.evaluate(async () => {
      const a = await navigator.gpu?.requestAdapter();
      if (!a) return null;
      const i = a.info ?? (await a.requestAdapterInfo?.());
      return [i?.vendor, i?.architecture, i?.description].filter(Boolean).join(' ') || 'an adapter';
    });
    return info ? { ok: true, detail: `WebGPU: ${info}` } : { ok: false, detail: 'no WebGPU adapter in headless Chrome' };
  } catch (e) {
    return { ok: false, detail: `Chrome would not start: ${String(e.message).split('\n')[0]}` };
  } finally {
    await browser?.close();
  }
}
