// What the desktop's job pipelines share (scripts/gen3d, scripts/voices):
// a job is a GitHub issue with the pipeline's label, made on this machine's
// GPU by the self-hosted Actions runner (.github/workflows/gen3d.yml,
// voices.yml) or by `runner.mjs --watch`. This has the plumbing: gh and git,
// reading an issue's fields, fetching its pictures, waiting for the GPU,
// keeping the machine awake, the runner's checkouts, and the pull request.
// Pure functions are exported for the tests; the rest shells out.
//
// scripts/desktop/README.md says how the whole thing fits together.

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
export const LOCAL = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', 'AppData', 'Local');
// this machine's own state for the runners, outside AppData (below)
export const HOME = process.env.DESKTOP_JOBS_HOME ?? join(homedir(), '.desktop-jobs');

// Where a tool under %LOCALAPPDATA% really is. The Claude desktop app is an
// MSIX package: whatever a session inside it installed under AppData went
// to the package's private copy (AppData\Local\Packages\Claude_…\LocalCache\
// Local), which only the app's own processes see at the usual path. The
// Actions runner, a scheduled task and WSL see the real AppData, so each
// looks in both: the real one first, then any package's copy.
export function localDir(name, base = LOCAL) {
  const real = join(base, name);
  if (existsSync(real)) return real;
  try {
    const pkgs = join(base, 'Packages');
    for (const p of readdirSync(pkgs).filter((d) => /^Claude_/i.test(d))) {
      const boxed = join(pkgs, p, 'LocalCache', 'Local', name);
      if (existsSync(boxed)) return boxed;
    }
  } catch {
    /* no Packages folder: not Windows, or no MSIX apps */
  }
  return real;
}

// in an Actions run, gh acts on the run's repository whatever the directory
if (process.env.GITHUB_REPOSITORY && !process.env.GH_REPO) process.env.GH_REPO = process.env.GITHUB_REPOSITORY;

export const sh = (cmd, args, opts = {}) => String(execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024, ...opts }) ?? '').trim();
// GH_BIN: another gh, such as the contract tests' fake (scripts/ai-e2e/fakes/gh.mjs, run with node)
export const ghCommand = (args) => {
  const bin = process.env.GH_BIN ?? 'gh';
  return /\.m?js$/i.test(bin) ? [process.execPath, [bin, ...args]] : [bin, args];
};
export const gh = (...args) => sh(...ghCommand(args));
export const git = (root, ...args) => sh('git', ['-C', root, ...args]);

// A label or a comment is bookkeeping: its failure is logged, never fatal.
export function quietly(fn, what) {
  try {
    return fn();
  } catch (e) {
    console.warn(`(${what} failed: ${String(e.message ?? e).split('\n')[0]})`);
    return null;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const slug = (s) =>
  String(s ?? '')
    .toLowerCase()
    // a prefix written as one ("gen3d: …", "3D - …"), not a name's own first word ("model-627", which
    // is what ask.mjs writes for "Model 627" and must read back the same)
    .replace(/^\s*(gen3d|3d|model|voices?|audio|lines|motion|clip)(\s*:\s*|\s+-\s+)/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// An issue form's body ("### What it is\n\nan X-wing\n\n### Faces\n\n_No response_")
// as the plain "key: value" lines the runners read, each keyed by its
// heading's first word; anything before the first heading kept as it is.
// A multi-line answer whose lines are themselves "key: value" (voices' lines)
// stays as those lines.
export function normaliseForm(body = '') {
  if (!/^###\s+\S/m.test(body)) return body;
  const [before, ...sections] = body.split(/^###\s+/m);
  const out = before.trim() ? [before.trim()] : [];
  for (const section of sections) {
    const [head, ...rest] = section.split(/\r?\n/);
    const key = head.trim().toLowerCase().match(/[a-z0-9]+/)?.[0] ?? '';
    const value = rest.join('\n').trim();
    if (!value || value === '_No response_') continue;
    const lines = value.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 1 && lines.every((l) => /^\s*[-*]?\s*[a-z][a-z0-9-]*\s*:/i.test(l))) out.push(...lines);
    else if (['more', 'options', 'lines'].includes(key)) out.push(...lines);
    else out.push(`${key}: ${lines.join(' ')}`);
  }
  return out.join('\n');
}

// Every "key: value" in a body, several to a line when they're set apart by
// two spaces or a tab ("faces: 30000  tex: 2048"). Only the keys named split
// a line, so a prompt's own colons stay in the prompt.
export function fields(body = '', keys = []) {
  const out = {};
  const known = keys.length ? new RegExp(`(?:\\s{2,}|\\t)(?=(?:${keys.join('|')})\\s*:)`, 'i') : null;
  for (const line of normaliseForm(body).split(/\r?\n/)) {
    for (const part of known ? line.split(known) : [line]) {
      const m = part.match(/^\s*[-*]?\s*\*{0,2}([a-z][a-z0-9-]*)\*{0,2}\s*:\s*(.+?)\s*$/i);
      if (m && !(m[1].toLowerCase() in out)) out[m[1].toLowerCase()] = m[2];
    }
  }
  return out;
}

// The picture URLs in a body, in order: markdown images, <img> tags, and
// bare links to image files or GitHub attachments.
export function imageUrls(body = '') {
  const urls = [];
  const re = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|<img[^>]+src="(https?:\/\/[^"]+)"/gi;
  for (const m of body.matchAll(re)) urls.push(m[1] ?? m[2]);
  return [...new Set(urls)];
}

// A field's value as one URL: a bare link, or a markdown image or link in it.
export function urlIn(value) {
  if (!value) return undefined;
  const md = value.match(/\]\((https?:\/\/[^\s)]+)\)/) ?? value.match(/src="(https?:\/\/[^"]+)"/);
  if (md) return md[1];
  const bare = value.match(/https?:\/\/\S+/);
  return bare ? bare[0].replace(/[),.;]+$/, '') : undefined;
}

// Who may queue work on this machine: the owner and collaborators (an
// issue form adds its label even for a stranger, so the label isn't enough),
// and the workflows' own bot, which only someone with write access can run.
export const TRUSTED = ['OWNER', 'MEMBER', 'COLLABORATOR'];
export const trusted = (issue) => TRUSTED.includes(issue.author_association ?? issue.authorAssociation) || /^github-actions(\[bot\])?$/.test(issue.user?.login ?? issue.author?.login ?? '');

export const repoName = () => process.env.GITHUB_REPOSITORY ?? gh('repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner');

// The open issues with a label, through the REST API (it has author_association).
export function labelled(label, repo = repoName()) {
  const issues = JSON.parse(gh('api', `repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=50`));
  return issues.filter((i) => !i.pull_request).map((i) => ({ ...i, labels: i.labels.map((l) => l.name) }));
}

export function issue(number, repo = repoName()) {
  const i = JSON.parse(gh('api', `repos/${repo}/issues/${number}`));
  return { ...i, labels: i.labels.map((l) => l.name) };
}

// Whether an issue is a job to take now: open, labelled, from someone
// trusted, not running or failed (removing the failed label is the retry).
export function ready(i, { label, running, failed }) {
  if (i.state !== 'open' || !i.labels.includes(label)) return { ok: false, why: `not an open "${label}" issue` };
  if (!trusted(i)) return { ok: false, why: `opened by ${i.user?.login} (${i.author_association}), not the owner or a collaborator` };
  if (i.labels.includes(running)) return { ok: false, why: 'already running' };
  if (i.labels.includes(failed)) return { ok: false, why: `labelled ${failed}: remove the label to try again` };
  return { ok: true };
}

// The link to this Actions run, if this is one.
export const runUrl = () => (process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null);

// A line or more on the Actions run's summary page (nothing outside Actions).
export function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

// The last lines of a log, for an issue comment (the run has the rest).
export const tail = (text, lines = 30) => String(text ?? '').split(/\r?\n/).filter((l) => l.trim()).slice(-lines).join('\n');

// A command run with its output both shown live (the Actions log) and kept
// (for the summary); a timeout ends it and its children.
export function tee(cmd, args, { cwd, env, timeoutMs, input } = {}) {
  return new Promise((done, fail) => {
    const p = spawn(cmd, args, { cwd, env, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    let timedOut = false;
    p.stdout.on('data', (d) => {
      out += d;
      if (out.length > 4e6) out = out.slice(-2e6);
      process.stdout.write(d);
    });
    p.stderr.on('data', (d) => {
      err += d;
      if (err.length > 1e6) err = err.slice(-5e5);
      process.stderr.write(d);
    });
    if (input !== undefined) p.stdin.end(input);
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          kill(p.pid);
        }, timeoutMs)
      : null;
    p.on('error', fail);
    p.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0 && !timedOut) return done({ out, err });
      const e = new Error(timedOut ? `${cmd} ${args[0] ?? ''} timed out after ${Math.round(timeoutMs / 60000)} min` : `${cmd} ${args[0] ?? ''} exited ${code}`);
      Object.assign(e, { out, err, code, timedOut });
      fail(e);
    });
  });
}

// A command with its output straight through (an engine's progress), ended
// with its children if it runs past `minutes`: a hung engine would
// otherwise hold the GPU and the runner until someone noticed.
export function live(cmd, args, { minutes = 30, name = cmd, cwd, env } = {}) {
  return new Promise((done, fail) => {
    const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      kill(p.pid);
    }, minutes * 60000);
    p.on('error', (e) => {
      clearTimeout(timer);
      fail(new Error(`${name} didn't start: ${e.message}`));
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) fail(new Error(`${name} ran past ${minutes} min and was stopped`));
      else if (code === 0) done();
      else fail(new Error(`${name} exited ${code}`));
    });
  });
}

// A process and everything it started (on Windows, the tree: a node child's
// trellis-cli or wsl.exe would otherwise outlive it).
export function kill(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* gone already */
    }
  }
}

// Free GPU memory in MiB (the most free on any card), or null with no nvidia-smi.
export function gpuFree() {
  try {
    const out = execFileSync('nvidia-smi', ['--query-gpu=memory.free,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    const cards = out.trim().split(/\r?\n/).map((l) => l.split(',').map((n) => Number(n.trim())));
    if (!cards.length || cards.some((c) => c.some((n) => !Number.isFinite(n)))) return null;
    return { free: Math.max(...cards.map((c) => c[0])), total: Math.max(...cards.map((c) => c[1])) };
  } catch {
    return null;
  }
}

// Waits until the GPU has `need` MiB free (another pipeline, a game or a
// long TTS run may hold it); false after `minutes`. No nvidia-smi: true.
export async function waitForGpu(need, { minutes = 45, every = 30, log = console.log } = {}) {
  const deadline = Date.now() + minutes * 60000;
  let said = false;
  for (;;) {
    const g = gpuFree();
    if (!g || g.free >= need) return true;
    if (!said) log(`GPU busy: ${(g.free / 1024).toFixed(1)} of ${(g.total / 1024).toFixed(1)} GB free, this needs ${(need / 1024).toFixed(1)} GB; waiting up to ${minutes} min`);
    said = true;
    if (Date.now() > deadline) return false;
    await sleep(every * 1000);
  }
}

// Keeps Windows from sleeping while a job runs (a PowerShell holding
// SetThreadExecutionState, ended by stop() or by this process ending).
export function keepAwake() {
  if (process.platform !== 'win32') return { stop() {} };
  const ps = `
$sig = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
$k = Add-Type -MemberDefinition $sig -Name Awake -Namespace Desktop -PassThru
[void]$k::SetThreadExecutionState(0x80000041)
$parent = ${process.pid}
while (Get-Process -Id $parent -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 20 }`;
  try {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore', windowsHide: true });
    p.on('error', () => {});
    return { stop: () => kill(p.pid) };
  } catch {
    return { stop() {} };
  }
}

// The repository proper (this may be one of its worktrees). The Actions
// runner's checkout is a sparse, shallow clone of its own, so the runner
// names the real one in DESKTOP_JOBS_REPO (setup-runner.ps1 sets it).
export const mainRepo = () => (process.env.DESKTOP_JOBS_REPO ? resolve(process.env.DESKTOP_JOBS_REPO) : resolve(git(REPO, 'rev-parse', '--path-format=absolute', '--git-common-dir'), '..'));

// A pipeline's own checkout beside the repository (<repo>-gen3d,
// <repo>-voices), made once, where its jobs are made: its branches and its
// dev server never touch the checkout a person works in. `root` overrides.
export function workspace(suffix, root) {
  root = resolve(root ?? `${mainRepo()}-${suffix}`);
  if (root === REPO) return root;
  if (!existsSync(join(root, '.git'))) {
    const base = mainRepo();
    git(base, 'fetch', '-q', 'origin', 'main');
    git(base, 'worktree', 'add', '--detach', root, 'origin/main');
  }
  return root;
}

// A checkout at origin/main, clean (the cache and node_modules, both
// ignored, stay), on a fresh branch when one is named.
export function fresh(root, branch) {
  git(root, 'fetch', '-q', 'origin', 'main');
  git(root, 'reset', '-q', '--hard');
  git(root, 'clean', '-q', '-fd');
  if (branch) git(root, 'checkout', '-q', '-f', '-B', branch, 'origin/main');
  else git(root, 'checkout', '-q', '-f', '--detach', 'origin/main');
}

// node_modules in a checkout, current with its package-lock.json: installed
// again (npm ci --ignore-scripts; README: no C++ toolchain here) when the
// lock has changed since the last install. A junction to another checkout's
// (as the runners once shared) is replaced with its own.
export function deps(root, log = console.log) {
  const lock = join(root, 'package-lock.json');
  if (!existsSync(lock)) return false;
  const nm = join(root, 'node_modules');
  const stamp = join(nm, '.desktop-lock');
  const want = createHash('sha1').update(readFileSync(lock)).digest('hex');
  if (existsSync(nm) && lstatSync(nm).isSymbolicLink()) rmSync(nm);
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === want) return false;
  log(`npm ci in ${root} (package-lock.json changed)`);
  sh(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' });
  mkdirSync(nm, { recursive: true });
  writeFileSync(stamp, want);
  return true;
}

// A junction from one checkout's node_modules to another's (kept for anyone
// running a runner by hand against the main checkout's modules).
export function share(from, to) {
  if (!existsSync(join(to, 'node_modules'))) symlinkSync(join(from, 'node_modules'), join(to, 'node_modules'), 'junction');
}

// The branch's pull request: the open one if there is one (a job made again
// force-pushes to it), else a new one. → its URL.
export function pullRequest(root, { branch, title, body }) {
  const open = JSON.parse(gh('pr', 'list', '--head', branch, '--state', 'open', '--json', 'url', '--limit', '1'));
  if (open.length) {
    quietly(() => gh('pr', 'edit', open[0].url, '--title', title, '--body', body), 'pr edit');
    return open[0].url;
  }
  return sh(...ghCommand(['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body]), { cwd: root });
}

// Pushes a branch, retried (the desktop's network drops; HTTP/1.1 because
// HTTP/2 resets on big pushes from this machine).
export async function push(root, branch, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return git(root, '-c', 'http.version=HTTP/1.1', 'push', '-q', '-f', '-u', 'origin', branch);
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(5000 * i);
    }
  }
}

// What a fetch failure was, in words (Node's "fetch failed" hides the cause).
export const why = (e) => {
  const c = e?.cause;
  return [e?.message, c?.code, c?.message].filter(Boolean).join(': ');
};

// The ways a picture is asked for, in turn when a host says no: as Node
// asks (Fandom's static.wikia serves that and 403s a browser's user agent
// that doesn't act like a browser), then as a browser, then as curl.
const ASKS = [{}, { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5' }, { 'user-agent': 'curl/8.9.1', accept: '*/*' }];

// A picture from a URL, retried, checked to be a picture, written to `out`.
// GitHub attachments get the owner's token when there is one (a private
// repository's need it).
export async function fetchImage(url, out, { tries = 4, timeoutMs = 60000, token = process.env.GH_TOKEN } = {}) {
  let last;
  let ask = 0;
  for (let i = 1; i <= tries + ASKS.length - 1; i++) {
    try {
      const headers = { ...ASKS[ask] };
      if (token && /^https:\/\/(github\.com|[a-z0-9-]+\.githubusercontent\.com)\//.test(url)) headers.authorization = `token ${token}`;
      const r = await fetch(url, { redirect: 'follow', headers, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) {
        last = new Error(`HTTP ${r.status} ${r.statusText}`);
        if ([401, 403].includes(r.status) && ask < ASKS.length - 1) {
          ask++; // refused as it was asked: ask the next way, at once
          continue;
        }
        if (r.status >= 400 && r.status < 500 && r.status !== 429) break; // gone or forbidden: retrying won't help
      } else {
        const buf = Buffer.from(await r.arrayBuffer());
        const type = r.headers.get('content-type') ?? '';
        if (!isImage(buf)) throw new Error(`not a picture (${type || 'no content type'}, ${buf.length} bytes${/html/.test(type) ? ': a web page, not the image itself' : ''})`);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, buf);
        return out;
      }
    } catch (e) {
      last = e;
      if (/not a picture/.test(e.message)) break;
    }
    if (i < tries) await sleep(2000 * 2 ** (i - 1));
  }
  throw new Error(`couldn't fetch the picture ${url}: ${why(last)}`);
}

// PNG, JPEG, GIF, WebP, AVIF/HEIF, BMP, TIFF by their first bytes.
export function isImage(buf) {
  if (!buf || buf.length < 12) return false;
  const hex = buf.subarray(0, 12).toString('hex');
  const ascii = buf.subarray(0, 12).toString('latin1');
  return hex.startsWith('89504e47') || hex.startsWith('ffd8ff') || ascii.startsWith('GIF8') || (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') || ascii.slice(4, 8) === 'ftyp' || ascii.startsWith('BM') || hex.startsWith('49492a00') || hex.startsWith('4d4d002a');
}
