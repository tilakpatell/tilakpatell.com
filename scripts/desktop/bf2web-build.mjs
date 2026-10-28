// bf2-web's play site, built on the desktop for the site (docs/decisions/2026-10-28-bf2web-pipeline.md): the one
// machine with the engine drop, the retail install, the cooked inputs and a real GPU. For bf2-web's main (or a
// commit asked for) it makes build main-<sha8> unless the bucket has it already: a worktree of the desktop's bf2-web
// checkout at that commit, bf2-web's own entry point there (WebPort/deploy/build-play-site.mjs: the World build by
// its checked-in recipe, the scene, the export and the play-flow check on this GPU, so a build that doesn't play a
// round isn't uploaded), the front end's rulebooks from the export, the upload (scripts/bf2web-upload.mjs: what the
// last build has is copied in R2, not sent) and the engine's private release. The site adopts it after
// (scripts/bf2web-adopt.mjs, on GitHub's runner).
//
//   node scripts/desktop/bf2web-build.mjs [--sha <commit>] [--dry]
//   env (the runner's .env): BF2WEB_REPO, the desktop's bf2-web checkout; BF2_EXPORT (default ~/Downloads/BF2_Extract),
//     whose web/ the rulebooks are read from; R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY
// GITHUB_OUTPUT gets build=<id> and made=yes|already.
//
//   buildId(sha)   steps({ sha, id, repo, tree, site, ui, web }) → [{ name, cmd, args, cwd, optional? }]  (pure)

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO } from './lib.mjs';

export const ENTRY = 'WebPort/deploy/build-play-site.mjs';
export const buildId = (sha) => {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`not a commit: ${sha}`);
  return `main-${sha.slice(0, 8)}`;
};

export function steps({ sha, id, repo, tree, site, ui, web }) {
  return [
    { name: 'the worktree', cmd: 'git', args: ['-C', repo, 'worktree', 'add', '--force', '--detach', tree, sha], cwd: repo, skipIf: tree },
    { name: 'the build (bf2-web’s entry point)', cmd: 'node', args: [ENTRY, '--out', site, '--commit', sha], cwd: tree },
    { name: 'the site checked against its manifest', cmd: 'node', args: ['WebPort/tools/export-play-site.mjs', 'verify', site], cwd: tree },
    { name: 'the front end’s rulebooks', cmd: 'node', args: ['WebPort/frontend/tools/extract.mjs', '--root', web, '--out', ui], cwd: tree },
    { name: 'the upload', cmd: 'node', args: ['scripts/bf2web-upload.mjs', site, '--build', id, '--ui-data', ui], cwd: REPO },
    { name: 'the engine’s private release', cmd: 'node', args: ['WebPort/deploy/publish-release.mjs', '--tag', `engine-${id}`, '--target', sha, '--site', site], cwd: tree, optional: true },
  ];
}

async function main(argv, env) {
  const option = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const repo = env.BF2WEB_REPO ? resolve(env.BF2WEB_REPO) : null;
  const web = join(resolve(env.BF2_EXPORT ?? join(env.USERPROFILE ?? homedir(), 'Downloads', 'BF2_Extract')), 'web');
  const missing = [
    !repo || !existsSync(join(repo, '.git')) ? "BF2WEB_REPO in the runner's .env: the desktop's bf2-web checkout" : null,
    !existsSync(web) ? `BF2_EXPORT in the runner's .env: the export folder whose web/ holds data/ (looked in ${web})` : null,
    !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY ? 'R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (the workflow passes them)' : null,
  ].filter(Boolean);
  if (missing.length) throw new Error(`the desktop needs:\n  - ${missing.join('\n  - ')}`);
  const git = (...a) => String(execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' })).trim();
  git('fetch', '--quiet', 'origin', 'main');
  // (a commit asked for comes from the Actions tab or bf2-web's dispatch: hex only, so git never reads it as an option)
  const asked = option('--sha');
  if (asked && !/^[0-9a-f]{7,40}$/.test(asked)) throw new Error(`not a commit: ${asked}`);
  const sha = git('rev-parse', '--verify', `${asked ?? 'origin/main'}^{commit}`);
  const id = buildId(sha);
  const output = (k, v) => env.GITHUB_OUTPUT && appendFileSync(env.GITHUB_OUTPUT, `${k}=${v}\n`);
  const { open } = await import('../lib/bf2web-r2.mjs');
  if (await open(env).text(`sites/${id}/manifest.json`)) {
    console.log(`${id}: in the bucket already`);
    output('build', id);
    output('made', 'already');
    return;
  }
  const home = join(env.DESKTOP_JOBS_HOME ?? join(homedir(), '.desktop-jobs'), 'bf2web');
  mkdirSync(home, { recursive: true });
  const tree = join(home, id);
  const plan = steps({ sha, id, repo, tree, site: join(home, `${id}-site`), ui: join(home, `${id}-ui-data`), web });
  if (argv.includes('--dry')) {
    for (const s of plan) console.log(`${s.name}: ${s.cmd} ${s.args.join(' ')}  (in ${s.cwd})`);
    return;
  }
  for (const s of plan) {
    if (s.skipIf && existsSync(s.skipIf)) continue;
    if (s.args[0] === ENTRY && !existsSync(join(tree, ENTRY)))
      throw new Error(`bf2-web at ${sha.slice(0, 8)} has no ${ENTRY}: the entry point that builds a play site by its checked-in recipe (docs/decisions/2026-10-28-bf2web-pipeline.md)`);
    console.log(`== ${s.name}`);
    try {
      execFileSync(s.cmd, s.args, { cwd: s.cwd, stdio: 'inherit', env });
    } catch (error) {
      if (!s.optional) throw new Error(`${s.name} failed (exit ${error.status ?? '?'})`);
      console.log(`(${s.name} failed, exit ${error.status ?? '?'}: the build stands without it)`);
    }
  }
  output('build', id);
  output('made', 'yes');
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
