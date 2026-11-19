/* global window, document */
// The market in a browser: dock at a generated station, buy a good into the
// hold and sell it back for less.
//
//   node scripts/market-check.mjs [--url http://127.0.0.1:5173] [--out lab/market] [--chromium /path]
//
// It starts the dev server unless --url names one, opens /universe flying the
// RV, goes out past the Core (61,000 east, as the endless check does), waits
// for a station, jumps to it and docks, shuts the Hangar the dock opens, and
// on the place card's Market: earns credits, buys one of the first good, reads
// tp-ships for it in the RV's hold, sells it back, and checks the credits came
// back short of what it cost. Shots in lab/market. Exit 1 on any miss.
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
const OUT = join(ROOT, typeof args.out === 'string' ? args.out : 'lab/market');

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
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    localStorage.setItem('tp-intro', '1');
    localStorage.setItem('tp-start', '"universe"');
    localStorage.setItem('tp-quality', 'low');
    localStorage.setItem('tp-universe-ship', '"rv"');
    window.__tpKeepFrames = true;
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${base}/?quality=low#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__universeDebug?.state?.model, null, { timeout: 300000, polling: 250 });
  await page.evaluate(() => window.__universeDebug.teleport(61000, 0, 0, -Math.PI / 2, 0));
  if (!(await until(page, () => window.__universeDebug.places.stations().length > 0, null, 300000))) throw new Error('no station loaded');
  const st = await page.evaluate(() => window.__universeDebug.places.stations()[0]);
  await page.evaluate((id) => window.__universeDebug.travel(id, 'hyper'), st.id);
  if (await until(page, (id) => window.__universe().docked === id, st.id, 300000)) pass(`docked at ${st.name}`);
  else throw new Error(`never docked at ${st.id}`);
  await until(page, () => Boolean(document.querySelector('.hangar-panel')), null, 30000);
  await page.keyboard.press('Escape');
  await until(page, () => !document.querySelector('.hangar-panel'), null, 30000);
  const marketBox = page.locator('.universe-market');
  if (await marketBox.waitFor({ timeout: 60000 }).then(() => true, () => false)) pass('the place card shows the Market');
  else throw new Error('no Market on the card');
  // (the wallet loads once something asks for it: the Market has, by now)
  await until(page, () => Boolean(window.__universeDebug.economy), null, 60000);
  await page.evaluate(() => window.__universeDebug.economy.earn('warWin', 4));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(OUT, 'market.png') });
  const before = await page.evaluate(() => window.__universeDebug.economy.credits);
  const row = marketBox.locator('li').first();
  const good = await row.getAttribute('data-good');
  await row.getByRole('button', { name: /^Buy/ }).click();
  await until(page, (g) => JSON.stringify(JSON.parse(localStorage.getItem('tp-ships') ?? '{}')).includes(`"good":"${g}"`), good, 5000);
  const held = await page.evaluate(() => JSON.parse(localStorage.getItem('tp-ships') ?? '{}').data?.rv?.hold ?? []);
  if (held.some((l) => l.good === good && l.n === 1)) pass(`one ${good} in the RV's hold`);
  else fail(`the RV's hold: ${JSON.stringify(held)}`);
  const paid = before - (await page.evaluate(() => window.__universeDebug.economy.credits));
  await row.getByRole('button', { name: /^Sell ·/ }).click();
  const after = await page.evaluate(() => window.__universeDebug.economy.credits);
  if (after > before - paid && after < before) pass(`sold back: paid ${paid}, got ${after - (before - paid)}`);
  else fail(`credits ${before} → ${before - paid} → ${after}`);
  await page.screenshot({ path: join(OUT, 'sold.png') });
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
