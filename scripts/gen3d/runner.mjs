// A model from your phone: open a GitHub issue labelled `gen3d` and this,
// running on the desktop with the GPU, makes it, opens a pull request with a
// judging sheet, and tells the issue. Title is the model's name; the body
// says what, one field a line (all optional but one of prompt/what/image):
//
//   what: an X-wing starfighter          (what it is, for the credit; the prompt if none)
//   prompt: an X-wing starfighter, …     (FLUX draws the concept picture)
//   image: (attach a picture, or an URL) (the picture to follow; Pixal3D unless faithful: no)
//   front: / left: / back: / right: (a picture each, or attach them in that order: Hunyuan3D multi-view)
//   faces: 24000   tex: 2048   seed: 42   res: 1024   fov: 49   engine: trelliscpp|trellis2
//   faithful: no   bake: no
//
//   node scripts/gen3d/runner.mjs --watch [60]     # poll every 60 s, run each job
//   node scripts/gen3d/runner.mjs --once           # one pass
//
// Jobs run in their own checkout (GEN3D_RUNNER_ROOT, else ../<repo>-gen3d),
// each on a branch gen3d/<name> from origin/main, so this checkout is never
// touched. The judging sheet is committed under docs/gen3d/ so the PR shows it.

import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
export const LABEL = 'gen3d';
export const RUNNING = 'gen3d:running';
export const FAILED = 'gen3d:failed';
const SIDES = ['front', 'left', 'back', 'right'];
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 5298;

export const slug = (s) => s.toLowerCase().replace(/^\s*(gen3d|3d|model)\s*[:-]\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// An issue → a job for make.mjs, or null when it says nothing to make.
export function parseIssue({ number, title, body = '' }) {
  const name = slug(title);
  if (!name) return null;
  const fields = {};
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]?\s*\*{0,2}([a-z]+)\*{0,2}\s*:\s*(.+?)\s*$/i);
    if (m) fields[m[1].toLowerCase()] = m[2];
  }
  // every picture in the body, in order; the sides named by fields (front: URL) or taken in that order
  const urls = [...body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|<img[^>]+src="(https?:\/\/[^"]+)"/gi)].map((m) => m[1] ?? m[2]);
  const isUrl = (u) => /^https?:\/\//.test(u ?? '');
  const named = Object.fromEntries(SIDES.filter((k) => isUrl(fields[k])).map((k) => [k, fields[k]]));
  const sides = Object.keys(named).length ? named : Object.fromEntries(urls.slice(0, SIDES.length).map((u, i) => [SIDES[i], u]));
  const image = sides.front ?? (isUrl(fields.image) ? fields.image : undefined);
  const views = Object.keys(sides).length > 1 ? sides : undefined; // several: Hunyuan3D multi-view
  const what = fields.what ?? fields.prompt ?? title.replace(/^\s*(gen3d|3d|model)\s*[:-]\s*/i, '').trim();
  const prompt = fields.prompt ?? (image ? undefined : what);
  const no = (v) => /^(no|false|off|0)$/i.test(v ?? '');
  const num = (k) => (fields[k] && Number.isFinite(Number(fields[k])) ? Number(fields[k]) : undefined);
  return {
    number,
    name,
    what,
    image,
    views,
    prompt: image ? undefined : prompt,
    faces: num('faces'),
    tex: num('tex'),
    seed: num('seed'),
    res: num('res'),
    fov: num('fov'),
    engine: fields.engine,
    faithful: image ? !no(fields.faithful) : false,
    noBake: no(fields.bake),
  };
}

// The make.mjs command line for a job (the picture, if any, already at `image`).
export function makeArgs(job, image, sides = {}) {
  const a = [job.name];
  if (image) {
    a.push('--image', image);
    for (const [k, f] of Object.entries(sides)) if (k !== 'front') a.push(`--${k}`, f);
  } else a.push('--prompt', job.prompt);
  a.push('--what', job.what);
  for (const k of ['faces', 'tex', 'seed', 'res', 'fov', 'engine']) if (job[k] !== undefined) a.push(`--${k}`, String(job[k]));
  if (image && Object.keys(sides).length <= 1) a.push(job.faithful ? '--faithful' : '--no-faithful'); // make.mjs follows a lone picture with Pixal3D unless told not to
  if (job.noBake) a.push('--no-bake');
  return a;
}

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts }).trim();
const gh = (...args) => sh('gh', args);
const git = (root, ...args) => sh('git', ['-C', root, ...args]);

export function openJobs() {
  const issues = JSON.parse(gh('issue', 'list', '--label', LABEL, '--state', 'open', '--limit', '20', '--json', 'number,title,body,labels'));
  return issues.filter((i) => !i.labels.some((l) => l.name === RUNNING || l.name === FAILED)).map(parseIssue).filter(Boolean);
}

// The repository proper (this may be one of its worktrees).
const mainRepo = () => resolve(git(REPO, 'rev-parse', '--path-format=absolute', '--git-common-dir'), '..');

// The runner's own checkout of the repository, beside the main one, made once; node_modules shared with this checkout.
export function workspace(root = process.env.GEN3D_RUNNER_ROOT ?? `${mainRepo()}-gen3d`) {
  if (resolve(root) === REPO) return root; // run from its own checkout (the scheduled task does): nothing to make
  if (!existsSync(join(root, '.git'))) {
    git(REPO, 'fetch', '-q', 'origin', 'main');
    git(REPO, 'worktree', 'add', '--detach', root, 'origin/main');
  }
  if (!existsSync(join(root, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(root, 'node_modules'), 'junction');
  return root;
}

async function fetchImage(url, out) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return out;
}

// A dev server on the job's checkout, for the judging sheet's renders.
function serve(root) {
  const p = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), root, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  const ready = (async () => {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) return;
      } catch {
        /* not yet */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('the dev server for the judging sheet did not come up');
  })();
  return { ready, stop: () => p.kill() };
}

export async function runJob(job, root, log = console.log) {
  const branch = `gen3d/${job.name}`;
  log(`#${job.number} ${job.name}: ${job.image ? `from a picture${job.faithful ? ' (Pixal3D)' : ''}` : `"${job.prompt}"`}`);
  gh('issue', 'edit', String(job.number), '--add-label', RUNNING);
  const server = existsSync(process.env.CHROME ?? EDGE) ? serve(root) : null;
  try {
    git(root, 'fetch', '-q', 'origin', 'main');
    git(root, 'checkout', '-q', '-B', branch, 'origin/main');
    const cache = join(root, 'scripts', 'gen3d', 'cache', job.name);
    mkdirSync(cache, { recursive: true });
    const image = job.image ? await fetchImage(job.image, join(cache, 'from-issue.png')) : null;
    const sides = {};
    for (const [k, u] of Object.entries(job.views ?? {})) sides[k] = k === 'front' ? image : await fetchImage(u, join(cache, `from-issue-${k}.png`));
    if (server) await server.ready;
    const out = sh(process.execPath, [join(root, 'scripts', 'gen3d', 'make.mjs'), ...makeArgs(job, image, sides)], {
      cwd: root,
      env: { ...process.env, CHROME: process.env.CHROME ?? EDGE, BASE: `http://127.0.0.1:${PORT}` },
      maxBuffer: 64 * 1024 * 1024,
    });
    const stats = out.split('\n').filter((l) => l.startsWith(`[${job.name}]`)).join('\n'); // make.mjs's own lines, not the engines' chatter
    const sheet = join(cache, 'sheet.png');
    const files = [`public/models/gen3d/${job.name}.glb`, 'public/games/credits.json'];
    if (existsSync(sheet)) {
      mkdirSync(join(root, 'docs', 'gen3d'), { recursive: true });
      copyFileSync(sheet, join(root, 'docs', 'gen3d', `${job.name}.png`));
      files.push(`docs/gen3d/${job.name}.png`);
    }
    git(root, 'add', ...files);
    git(root, '-c', 'core.safecrlf=false', 'commit', '-q', '-m', `${job.what}: a 3D model made from issue #${job.number}\n\n${stats}\n\nCo-Authored-By: gen3d runner <noreply@tilakpatell.com>`);
    git(root, '-c', 'http.version=HTTP/1.1', 'push', '-q', '-f', '-u', 'origin', branch);
    const repo = gh('repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner');
    const picture = existsSync(sheet) ? `\n\n![${job.name}, raw and web](https://raw.githubusercontent.com/${repo}/${branch}/docs/gen3d/${job.name}.png)` : '';
    const body = `From issue #${job.number}: ${job.what}.\n\n\`\`\`\n${stats}\n\`\`\`${picture}\n\nThe model is \`public/models/gen3d/${job.name}.glb\`, credited in \`credits.json\`; wiring it into a scene is a separate change.`;
    const pr = gh('pr', 'create', '--base', 'main', '--head', branch, '--title', `${job.what}, made by the gen3d runner`, '--body', body);
    gh('issue', 'comment', String(job.number), '--body', `Made: ${pr}\n\n\`\`\`\n${stats}\n\`\`\``);
    gh('issue', 'close', String(job.number), '--reason', 'completed');
    log(`#${job.number} → ${pr}`);
    return pr;
  } catch (e) {
    gh('issue', 'edit', String(job.number), '--add-label', FAILED);
    gh('issue', 'comment', String(job.number), '--body', `Failed:\n\n\`\`\`\n${String(e.message ?? e).slice(0, 3000)}\n\`\`\`\n\nFix the issue and remove the \`${FAILED}\` label to try again.`);
    log(`#${job.number} failed: ${e.message}`);
    return null;
  } finally {
    gh('issue', 'edit', String(job.number), '--remove-label', RUNNING);
    server?.stop();
  }
}

export async function pass(root = workspace(), log = console.log) {
  const jobs = openJobs();
  for (const job of jobs) await runJob(job, root, log);
  return jobs.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--watch');
  const every = i >= 0 ? Number(args[i + 1] ?? 60) || 60 : null;
  const root = workspace();
  console.log(`gen3d runner: jobs are open issues labelled "${LABEL}", made in ${root}${every ? `, every ${every}s` : ''}`);
  do {
    try {
      const n = await pass(root);
      if (n) console.log(`${new Date().toLocaleTimeString()}: ${n} job(s) done`);
    } catch (e) {
      console.error(`${new Date().toLocaleTimeString()}: ${e.message}`);
    }
    if (every) await new Promise((r) => setTimeout(r, every * 1000));
  } while (every);
}
