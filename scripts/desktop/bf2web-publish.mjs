// Publish a completed desktop build without repeating its GPU run. The original
// build and direct-check reports, commit, directory and every exported digest must
// agree before the existing uploader can write anything. Adoption still runs the
// hosted contract, browser smoke and site checks in bf2web.yml.
import { appendFileSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractProblems, rulebookProblems } from '../lib/bf2web-site.mjs';
import { REPO } from './lib.mjs';

const need = (ok, reason) => { if (!ok) throw new Error(`bf2web-publish: ${reason}`); };
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const samePath = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  (process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b));
const REQUIRED_STEPS = ['prepare', 'physics', 'world', 'export', 'verify', 'direct-check'];

export function validateEvidence({ site, sha, manifest, build, direct }) {
  need(/^[0-9a-f]{40}$/.test(sha ?? ''), 'a full engine commit is required');
  need(build?.schema === 'bf2-play-site-build/1' && build.passed === true, 'the build did not pass');
  need(build.commit === sha && manifest?.run?.commit === sha, 'the requested commit differs from the build or export');
  need(samePath(site, build.out) && samePath(site, direct?.site), 'the reports belong to another export directory');
  need(!manifest.validationOverlay, 'a diagnostic overlay is not a completed build');
  need(Array.isArray(build.steps) && REQUIRED_STEPS.every((name) => {
    const rows = build.steps.filter((step) => step.name === name);
    return rows.length === 1 && rows[0].ok === true;
  }), 'a required build or hardware check is absent or failed');
  need(direct?.schema === 'play-site-direct/1' && direct.passed === true && !direct.error &&
    Array.isArray(direct.exceptions) && direct.exceptions.length === 0 &&
    Array.isArray(direct.checks) && direct.checks.length >= 5 && direct.checks.every((check) => check.ok === true),
  'the original direct check did not pass');
  const problems = contractProblems(manifest);
  need(problems.length === 0, problems.join('; '));
  return true;
}

export function verifyExportFiles(site, manifest) {
  const root = realpathSync(site);
  for (const entry of manifest.entries) {
    need(!entry.path.includes('\\'), 'an export path contains a backslash');
    const file = realpathSync(join(root, entry.path)), rel = relative(root, file);
    need(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'an export file escapes its directory');
    const bytes = readFileSync(file);
    need(bytes.length === entry.bytes && digest(bytes) === entry.sha256, `export bytes changed: ${entry.path}`);
  }
  return manifest.entries.length;
}

export function readRulebooks(directory) {
  const entries = readdirSync(directory).filter((name) => name.endsWith('.json')).sort().map((path) => {
    const bytes = readFileSync(join(directory, path));
    JSON.parse(bytes.toString('utf8'));
    return { path, bytes: bytes.length, sha256: digest(bytes) };
  });
  const problems = rulebookProblems(entries.map((entry) => ({ key: entry.path })));
  need(problems.length === 0, problems.join('; '));
  return { entries, sha256: digest(JSON.stringify(entries)) };
}

export function validateRulebookDigest(rulebooks, expected) {
  need(/^[0-9a-f]{64}$/.test(expected ?? '') && rulebooks.sha256 === expected, 'the rulebook digest is absent or changed');
}

export async function publish(argv, env = process.env) {
  const option = (name) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : null;
  const site = option('--site'), id = option('--build'), sha = option('--sha'), ui = option('--ui-data');
  need(site && isAbsolute(site) && ui && isAbsolute(ui) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id ?? ''),
    '--site and --ui-data must be absolute paths, with a named --build');
  const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
  const manifestFile = join(site, 'manifest.json'), manifest = read(manifestFile);
  const build = read(`${site}.build.json`), direct = read(join(`${site}.direct-check`, 'play-site-direct-report.json'));
  validateEvidence({ site, sha, manifest, build, direct });
  const files = verifyExportFiles(site, manifest);
  const rulebooks = readRulebooks(ui), expectedUi = option('--ui-sha256');
  if (expectedUi || !argv.includes('--check')) validateRulebookDigest(rulebooks, expectedUi);
  console.log(`${id}: completed build ${sha}, ${files} files verified; original GPU direct check passed`);
  console.log(`rulebooks: ${rulebooks.entries.length} files, SHA-256 ${rulebooks.sha256}`);
  if (argv.includes('--check')) return { id, files, rulebooks, checked: true };

  const { open } = await import('../lib/bf2web-r2.mjs');
  const r2 = open(env), existing = await r2.text(`sites/${id}/manifest.json`);
  need(!existing || digest(Buffer.from(existing)) === digest(readFileSync(manifestFile)), 'that build name already holds a different manifest');
  const prefix = `sites/${id}/ui-data/`;
  for (const previous of await r2.files(prefix)) {
    const entry = rulebooks.entries.find((row) => prefix + row.path === previous.key);
    need(entry && entry.bytes === previous.size, 'the published rulebook selection differs');
    const object = await r2.binding.get(previous.key);
    need(object && digest(object.body) === entry.sha256, 'published rulebook bytes differ');
  }
  execFileSync(process.execPath, ['scripts/bf2web-upload.mjs', site, '--build', id, '--ui-data', ui], { cwd: REPO, env, stdio: 'inherit' });
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `build=${id}\nmade=published\n`);
  return { id, files, rulebooks, checked: true, published: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await publish(process.argv.slice(2)).catch((error) => {
  console.error(error.message); process.exitCode = 1;
});
