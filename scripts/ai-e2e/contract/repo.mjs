// What a contract test runs a pipeline in: a temporary folder with its own
// cache, output root and runner home, every fake switched on, and (for the
// runners) a temporary repository with a bare origin beside it, so
// branches, pushes and `fresh()` run as they do on the desktop.
//
//   const box = sandbox({ judge: 'judge-good.json' })
//   box.make(['x-wing', '--image', ref, '--what', 'an X-wing'])   → { status, out, err }
//   const repo = box.repo()                                        → { root, origin }
//   box.runner('gen3d', ['--issue', '1'])                          → { status, out, err }
//   box.gh() → every gh call's argv;  box.fakes() → every fake's { tool, argv }

import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const FAKES = join(REPO, 'scripts', 'ai-e2e', 'fakes');

// What a run on the Actions runner would see that a test must not act on:
// its summary, its artifacts folder, the run's link in comments.
const OUTSIDE = /^(GITHUB_|RUNNER_|GH_|JOB_ISSUE$|CHROME$|BASE$|GEN3D_|VOICES_|MOTION_|DESKTOP_)/;

// A child process, its output kept; a promise, so a test can serve a
// picture from this process while the pipeline fetches it.
export function run(cmd, args, { cwd = REPO, env, timeoutMs = 60000 } = {}) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => p.kill(), timeoutMs);
    p.on('close', (status) => {
      clearTimeout(timer);
      done({ status, out, err });
    });
  });
}

export function sandbox({ judge = 'judge-good.json', env: extra = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-e2e-contract-'));
  const paths = { dir, cache: join(dir, 'cache'), out: join(dir, 'out'), home: join(dir, 'home'), gh: join(dir, 'gh'), judge: join(dir, 'judge', 'script.json'), fakeLog: join(dir, 'fakes.jsonl'), ghLog: join(dir, 'gh.json') };
  for (const d of [paths.cache, join(paths.out, 'public', 'games'), paths.home, paths.gh, dirname(paths.judge)]) mkdirSync(d, { recursive: true });
  copyFileSync(join(REPO, 'public', 'games', 'credits.json'), join(paths.out, 'public', 'games', 'credits.json'));
  if (judge) copyFileSync(join(FIXTURES, judge), paths.judge);
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !OUTSIDE.test(k)));
  const env = {
    ...base,
    GEN3D_ENGINE: 'fake',
    GEN3D_PICTURE: 'fake',
    GEN3D_JUDGE: 'fake',
    GEN3D_JUDGE_SCRIPT: paths.judge,
    GEN3D_SHEET: 'fake',
    GEN3D_CACHE: paths.cache,
    GEN3D_OUT: paths.out,
    GEN3D_FAKE_LOG: paths.fakeLog,
    BLENDER: join(FAKES, 'blender.mjs'),
    GH_BIN: join(FAKES, 'gh.mjs'),
    GH_LOG: paths.ghLog,
    GH_FIXTURES: paths.gh,
    GITHUB_REPOSITORY: 'owner/site',
    DESKTOP_JOBS_HOME: paths.home,
    GEN3D_VRAM_MIB: '1',
    VOICES_VRAM_MIB: '1',
    // a fresh CI machine has no git identity, and the runner commits
    GIT_AUTHOR_NAME: 'contract test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'contract test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
    ...extra,
  };
  const lines = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const box = {
    ...paths,
    env,
    root: REPO,
    make: (args, more = {}) => run(process.execPath, [join(box.root, 'scripts', 'gen3d', 'make.mjs'), ...args], { cwd: box.root, env: { ...env, ...more } }),
    runner: (pipeline, args, more = {}) => run(process.execPath, [join(box.root, 'scripts', pipeline, 'runner.mjs'), ...args], { cwd: box.root, env: { ...env, ...more } }),
    gh: () => (existsSync(paths.ghLog) ? JSON.parse(readFileSync(paths.ghLog, 'utf8')) : []),
    fakes: (tool) => lines(paths.fakeLog).filter((c) => !tool || c.tool === tool),
    judged: () => (existsSync(join(dirname(paths.judge), 'calls.json')) ? JSON.parse(readFileSync(join(dirname(paths.judge), 'calls.json'), 'utf8')) : []),
    fixture: (name, value) => writeFileSync(join(paths.gh, `${name}.json`), JSON.stringify(value)),
    // a repository of the pipelines' own files, with a bare origin, for the runners
    // `extra`: { 'path in the repository': 'a folder to copy there' }, such as a fixture src/ tree
    repo(files = ['scripts/gen3d', 'scripts/glb-shot.mjs', 'scripts/desktop', 'scripts/voices', 'scripts/ai-e2e/fakes', 'src/lib/voiced.js', 'src/lib/audio.js', 'src/lib/speech.js', 'public/games/credits.json'], extra = {}) {
      const root = join(dir, 'repo');
      const origin = join(dir, 'origin.git');
      mkdirSync(root, { recursive: true });
      // (not this machine's caches, references or exported lines: a runner makes its own)
      for (const f of files) cpSync(join(REPO, f), join(root, f), { recursive: true, filter: (s) => !/[\\/](cache|__pycache__|refs|lines\.json)([\\/]|$)/.test(s) });
      for (const [to, from] of Object.entries(extra)) cpSync(from, join(root, to), { recursive: true });
      writeFileSync(join(root, '.gitignore'), 'node_modules\nscripts/gen3d/cache/\nscripts/voices/cache/\nscripts/voices/lines.json\n__pycache__\n');
      // the real modules, borrowed: the pipeline's imports resolve as they would in the repository
      symlinkSync(join(REPO, 'node_modules'), join(root, 'node_modules'), 'junction');
      const git = (...a) => execFileSync('git', a, { cwd: root, env, stdio: 'pipe' });
      execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin], { env, stdio: 'pipe' });
      git('init', '-q', '-b', 'main');
      git('config', 'core.autocrlf', 'false');
      git('add', '-A');
      git('commit', '-q', '-m', 'the site, in brief');
      git('remote', 'add', 'origin', origin);
      git('push', '-q', 'origin', 'main');
      box.root = root;
      env.GEN3D_RUNNER_ROOT = root;
      env.VOICES_RUNNER_ROOT = root;
      // the runner commits into the repository, so its models land there
      env.GEN3D_OUT = root;
      return { root, origin, git: (...a) => String(execFileSync('git', a, { cwd: root, env, encoding: 'utf8' })).trim(), originGit: (...a) => String(execFileSync('git', ['--git-dir', origin, ...a], { env, encoding: 'utf8' })).trim() };
    },
  };
  return box;
}

// The fixtures folder over HTTP on a free port, for the issues' picture
// links: the runner fetches them as it would from GitHub, without leaving
// this machine. → { base, close }
export async function serveFixtures(dir = FIXTURES) {
  const server = createServer((req, res) => {
    const file = join(dir, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': file.endsWith('.png') ? 'image/png' : 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

// An issue as the REST API gives it, from a fixture body with {{BASE}} filled in.
export const issue = (number, title, file, base, more = {}) => ({
  number,
  title,
  state: 'open',
  body: readFileSync(join(FIXTURES, file), 'utf8').replaceAll('{{BASE}}', base),
  labels: [{ name: 'gen3d' }],
  author_association: 'OWNER',
  user: { login: 'owner' },
  ...more,
});
