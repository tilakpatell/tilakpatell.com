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
// (ktx2_encode.py, upload_supabase.py, bf2export), maps_work/ and logs/.
// The bucket's keys are the runner's .env (SUPABASE_URL and
// SUPABASE_SERVICE_KEY, or SUPA_KEY), never the repository's, never printed.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { REPO, deps, fresh, git, pullRequest, push, summary, workspace } from './lib.mjs';

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
  const key = env.SUPABASE_SERVICE_KEY || env.SUPA_KEY || env.BF2017_KEY;
  const project = env.SUPABASE_PROJECT ?? env.SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
  return { url: Boolean(env.SUPABASE_URL), key: Boolean(key), project };
}

// The environment a child gets: the site's scripts read SUPA_KEY and the
// desktop's uploader SUPABASE_SERVICE_KEY; the runner's .env may set either.
export function childEnv(env = process.env) {
  const key = env.SUPABASE_SERVICE_KEY || env.SUPA_KEY || env.BF2017_KEY;
  return key ? { ...env, SUPA_KEY: env.SUPA_KEY || key, SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY || key } : { ...env };
}

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
      const k = keyState(env);
      const ok = k.url && k.key;
      return { name: n.name, ok, detail: `SUPABASE_URL ${k.url ? 'set' : 'missing'}, key ${k.key ? 'set' : 'missing'}`, fix: ok ? undefined : n.fix };
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

export const writeJson = (file, data) => {
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
};

// Today, for branch names and the evidence: 2026-10-11.
export const today = (d = new Date()) => d.toISOString().slice(0, 10);

// A job's command line. `spec` is the job:
//   { job, title, needs(d) → [need], plan({ root, d, env }) → { items, notes? }, columns,
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
  const files = [...new Set([...(made.files ?? []), evidenceDir(spec.job)])];
  git(root, 'add', '-A', '--', ...files);
  if (!git(root, 'status', '--porcelain')) {
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
