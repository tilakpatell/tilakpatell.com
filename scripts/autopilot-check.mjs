/* global window, document */
// Everything that must be green before the autopilot (.claude/skills/autopilot)
// merges a change, in one command: lint, the tests, the build, a look at the
// bundle, then the pages themselves in headless Chromium (software WebGL),
// which must load without a page error or a console error that isn't known
// noise, and draw a canvas where there's 3D. With --shots it also takes the
// screenshots for the ship's log.
//
//   node scripts/autopilot-check.mjs [--routes /avengers,/galaxy/hoth/surface] [--shots 0012]
//     [--before] [--skip lint,test,build,smoke] [--only smoke] [--phone] [--viewport 844x390] [--quality high|mid|low]
//     [--settle 8000] [--chromium /path/to/chrome]
//
// The core pages are always checked; --routes adds the ones a change touched
// (the first two are the ones photographed). Screenshots go to
// public/changes/<id>-a.webp and -b.webp, 960 × 600; with --before, the first
// route's goes to <id>-before.webp instead (shoot it on main before the
// change, so the log shows the two side by side). Exit code 1 on any failure.
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOISE, freePort } from './lib/noise.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CORE = ['/', '/home', '/experience', '/projects', '/travel', '/contact', '/resume', '/terminal', '/changes'];
// the pages that draw in 3D as they open: the front door's universe map, and
// every world (WORLD_MB in src/components/worlds/worlds.js, read from the
// file itself: that module imports without extensions, which Node can't)
const WORLDS = [...(await readFile(join(ROOT, 'src/components/worlds/worlds.js'), 'utf8')).matchAll(/^\s*'(\/[^']+)':\s*\d+/gm)].map((m) => m[1]);
const THREE_D = ['/', '/universe', ...WORLDS];
// pages inside a world that are text, not 3D: the galaxy's mission briefings
// (an opening crawl and the objectives; the live ones send you on to a world)
const FLAT = [/^\/galaxy\/[^/]+\/mission$/];
// (NOISE, the console errors a sandbox or a software renderer always
// produces and that mean nothing, is scripts/lib/noise.mjs's, shared with
// the AI render tier)

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const key = argv[i].slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[key] = true;
  else args[key] = argv[++i];
}
const list = (s) => (typeof s === 'string' ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const only = list(args.only);
const skip = list(args.skip);
const runs = (step) => (only.length ? only.includes(step) : !skip.includes(step));
const routes = [...new Set([...CORE, ...list(args.routes)])];
const toShoot = list(args.routes).slice(0, 2);
const shots = typeof args.shots === 'string' ? args.shots.padStart(4, '0') : null;
const before = Boolean(args.before);
const phone = Boolean(args.phone);
// (--viewport 844x390: the page at that size, its shots not resized; with --phone, touch too)
const sized = typeof args.viewport === 'string' ? args.viewport.split('x').map(Number) : null;
const quality = ['high', 'mid', 'low'].includes(args.quality) ? args.quality : 'high';
const settle = Number(args.settle) || 8000;
if (shots && !toShoot.length) console.log('note: --shots without --routes photographs nothing; say which routes changed');
if (args.routes === true || args.shots === true) console.log('note: --routes and --shots take a value (--routes /a,/b --shots 0012)');

const problems = [];
const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
const head = (s) => console.log(`\n── ${s} (${since()})`);
const fmt = (b) => `${(b / 1024).toFixed(0)} kB`;

function step(name, cmd, cmdArgs) {
  if (!runs(name)) return;
  head(name);
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    problems.push(`${name} failed`);
    console.log(`\nFAIL ${name}. Fix that first.`);
    finish();
  }
}
function finish() {
  head('result');
  if (problems.length) {
    for (const p of problems) console.log(`FAIL ${p}`);
    process.exit(1);
  }
  console.log('ok   everything green');
  process.exit(0);
}

step('lint', 'npx', ['eslint', '.']);
step('test', 'npx', ['vitest', 'run']);
step('build', 'npx', ['vite', 'build']);

// ── the bundle ──
if (runs('build') || runs('bundle')) {
  head('bundle');
  const dir = join(ROOT, 'dist/assets');
  const names = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith('.js'));
  if (!names.length) {
    problems.push('no dist/assets to measure (build first)');
  } else {
    const sizes = await Promise.all(names.map(async (n) => ({ n, b: (await stat(join(dir, n))).size })));
    sizes.sort((a, b) => b.b - a.b);
    const total = sizes.reduce((s, f) => s + f.b, 0);
    const entry = sizes.find((f) => /^index-/.test(f.n));
    console.log(`total JS ${fmt(total)} in ${sizes.length} chunks; entry ${entry ? fmt(entry.b) : '?'}`);
    for (const f of sizes.slice(0, 8)) console.log(`  ${fmt(f.b).padStart(8)}  ${f.n}`);
    // against the last change's numbers
    const logDir = join(ROOT, 'src/data/changes');
    const entries = await Promise.all((await readdir(logDir).catch(() => [])).filter((n) => /^\d{4}\.json$/.test(n)).map(async (n) => JSON.parse(await readFile(join(logDir, n), 'utf8'))));
    const last = entries.filter((e) => e.measured?.js).sort((a, b) => b.id - a.id)[0];
    if (last) {
      const d = total - last.measured.js;
      const pct = (d / last.measured.js) * 100;
      console.log(`since change #${last.id}: ${d >= 0 ? '+' : ''}${fmt(d)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`);
      if (pct > 2) console.log('note: more than 2% bigger. Say why in the entry, or make it lazy.');
    }
  }
}

// ── the pages ──
if (runs('smoke')) {
  head('smoke');
  if (!existsSync(join(ROOT, 'dist/index.html'))) {
    problems.push('no dist/ to serve (build first)');
    finish();
  }
  const { chromium } = await import('playwright-core');
  const sharp = (await import('sharp')).default;
  const port = await freePort();
  // vite found as node finds it: a worktree has no node_modules of its own
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  let serverDown = null;
  server.on('error', (e) => (serverDown = e.message));
  server.on('exit', (code) => (serverDown ??= `vite preview exited with ${code}`));
  const base = `http://127.0.0.1:${port}`;
  const up = Date.now();
  for (;;) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    if (serverDown || Date.now() - up > 30000) {
      server.kill();
      problems.push(serverDown ?? 'vite preview never answered');
      finish();
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  const exe = args.chromium ?? process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
  if (!exe) {
    server.kill();
    problems.push('no Chromium (set CHROMIUM=/path/to/chrome)');
    finish();
  }
  const GATE = /Walk the tribute/;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
  const viewport = sized ? { width: sized[0], height: sized[1] } : phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  if (shots) await mkdir(join(ROOT, 'public/changes'), { recursive: true });
  let letter = 0;
  for (const route of routes) {
    const threeD = THREE_D.some((p) => route === p || route.startsWith(`${p}/`)) && !FLAT.some((re) => re.test(route));
    const ctx = await browser.newContext({ viewport, hasTouch: phone, deviceScaleFactor: 1 });
    await ctx.addInitScript((q) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-quality', q);
    }, quality);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (!NOISE.some((n) => n.test(text))) errors.push(`console: ${text.slice(0, 300)}`);
    });
    const started = Date.now();
    let note = '';
    try {
      await page.goto(`${base}/#${route}`, { waitUntil: 'load', timeout: 120000 });
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      let canvas = true;
      // (a world behind a gate with a way through for everyone: Minecraft's password, past to the tribute)
      if (threeD) await page.getByRole('button', { name: GATE }).click({ timeout: 3000 }).catch(() => {});
      if (threeD) canvas = await page.waitForSelector('canvas', { timeout: 90000, state: 'attached' }).then(() => true, () => false);
      if (!canvas) errors.push('no canvas: the 3D never started');
      await page.waitForTimeout(threeD ? settle : 1500);
      const text = await page.evaluate(() => document.body.innerText);
      if (/This page didn’t load\.|Something went wrong/.test(text)) errors.push('the error boundary showed');
      if (/This isn’t the page you’re looking for\./.test(text)) errors.push('404: no route (a stale dist/? build first)');
      if (text.trim().length < 20) errors.push('the page is empty');
      if (shots && toShoot.includes(route) && letter < (before ? 1 : 2)) {
        const png = await page.screenshot({ type: 'png', timeout: 120000 });
        const name = `${shots}-${before ? 'before' : 'ab'[letter]}.webp`;
        letter++;
        await writeFile(join(ROOT, 'public/changes', name), await (sized ? sharp(png) : sharp(png).resize(960, 600, { fit: 'cover', position: 'top' })).webp({ quality: 78 }).toBuffer());
        note = ` → public/changes/${name}`;
      }
    } catch (e) {
      errors.push(`didn't load: ${String(e.message ?? e).split('\n')[0]}`);
    }
    await ctx.close();
    const took = `${((Date.now() - started) / 1000).toFixed(0)}s`;
    if (errors.length) {
      console.log(`FAIL ${route} (${took})${note}`);
      for (const e of [...new Set(errors)].slice(0, 6)) console.log(`     ${e}`);
      problems.push(`${route}: ${[...new Set(errors)][0]}`);
    } else console.log(`ok   ${route} (${took})${note}`);
  }
  await browser.close();
  server.kill();
}

finish();
