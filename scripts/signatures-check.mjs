/* global window */
// The ships' signatures and the cargo pod in a browser.
//
//   node scripts/signatures-check.mjs [--url http://127.0.0.1:5173] [--out lab/signatures] [--chromium /path]
//
// It starts the dev server unless --url names one, opens /universe flying the
// RV, and checks: the Systems tab's head names the hauler and its lab; four
// iron put in the hold come out as alloys from the lab; the ship shot down
// drops its hold as a pod where it went (tp-market's pod, the hold empty); and
// flown back beside it, E takes it all aboard again. Shots in lab/signatures.
// Exit 1 on any miss.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  args[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : argv[++i];
}
const OUT = join(ROOT, typeof args.out === 'string' ? args.out : 'lab/signatures');

// ── the server: the dev server, as universe-check.mjs starts it ──
const freePort = () =>
  new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
let server = null;
let base = typeof args.url === 'string' ? args.url.replace(/\/$/, '') : null;
if (!base) {
  const port = await freePort();
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  let down = null;
  server.on('exit', (code) => (down ??= `vite exited with ${code}`));
  base = `http://127.0.0.1:${port}`;
  const up = Date.now();
  for (;;) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    if (down || Date.now() - up > 60000) {
      server.kill();
      throw new Error(down ?? 'the dev server never answered');
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

const exe = args.chromium ?? process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
if (!exe) throw new Error('no Chromium (set CHROMIUM=/path/to/chrome)');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
await mkdir(OUT, { recursive: true });
let failed = 0;
const fail = (what) => {
  failed++;
  console.log(`FAIL ${what}`);
};
const pass = (what) => console.log(`ok   ${what}`);



const until = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms, polling: 500 }).then(() => true, () => false);
const held = (page) => page.evaluate(() => window.__universeDebug.market().hold('rv', window.__universeDebug.state.core.hold).goods());
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    localStorage.setItem('tp-intro', '1');
    localStorage.setItem('tp-start', '"universe"');
    localStorage.setItem('tp-quality', 'low');
    localStorage.setItem('tp-universe-ship', '"rv"');
    localStorage.setItem('tp-hangar-tab', 'systems');
    window.__tpKeepFrames = true;
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${base}/?quality=low#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__universeDebug?.state?.model && window.__universeDebug.market?.(), null, { timeout: 300000, polling: 250 });
  await page.locator('canvas').first().click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
  // the Systems tab's head
  await page.locator('.universe-hangar-btn').waitFor({ timeout: 60000 });
  await page.keyboard.press('h');
  const dialog = page.getByRole('dialog', { name: 'Hangar' });
  await dialog.waitFor({ timeout: 60000 });
  await dialog.getByRole('tab', { name: 'Systems' }).click();
  const head = await dialog.locator('.hangar-systems').innerText();
  if (/hauler and cook/i.test(head) && /the lab/i.test(head)) pass('the Systems tab names the hauler and its lab');
  else fail(`the Systems tab's head: ${head.slice(0, 160)}`);
  await page.screenshot({ path: join(OUT, 'systems.png') });
  await page.keyboard.press('Escape');
  // the lab
  await page.evaluate(() => {
    const d = window.__universeDebug;
    d.market().hold('rv', d.state.core.hold).add('iron', 4, { sector: [0, 0, 0], pocket: null });
    d.state.labT = 999;
  });
  if (await until(page, () => window.__universeDebug.market().hold('rv', window.__universeDebug.state.core.hold).count('alloys') > 0, null, 60000)) pass(`the lab refined: ${JSON.stringify(await held(page))}`);
  else fail(`no alloys from the lab: ${JSON.stringify(await held(page))}`);
  // shot down: the pod
  const before = await held(page);
  await page.evaluate(() => window.__universeDebug.hurt(9999));
  if (await until(page, () => Boolean(window.__universeDebug.market().pod()), null, 30000)) {
    const pod = await page.evaluate(() => window.__universeDebug.market().pod());
    const left = await held(page);
    if (left.length === 0 && pod.lots.length) pass(`shot down: the hold's ${before.map((g) => `${g.n} ${g.id}`).join(', ')} in a pod`);
    else fail(`after going down the hold has ${JSON.stringify(left)}, the pod ${JSON.stringify(pod)}`);
  } else fail('no pod after going down');
  await until(page, () => !window.__universeDebug.state.crash && window.__universeDebug.state.ship, null, 60000);
  await page.evaluate(() => {
    const d = window.__universeDebug;
    const p = d.market().pod();
    d.teleport(p.at[0] + 3, p.at[1], p.at[2], 0, 0);
  });
  await page.waitForTimeout(800);
  await page.keyboard.press('e');
  if (await until(page, () => !window.__universeDebug.market().pod(), null, 20000)) pass(`E took the pod aboard: ${JSON.stringify(await held(page))}`);
  else fail(`the pod's still out: ${JSON.stringify(await page.evaluate(() => window.__universeDebug.market().pod()))}`);
  await page.screenshot({ path: join(OUT, 'pod.png') });
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  else pass('no page errors');
  await ctx.close();
} catch (e) {
  fail(String(e.message ?? e));
} finally {
  await browser.close();
  server?.kill();
}
process.exit(failed ? 1 : 0);
