/* global window */
// Exploring in a browser: a sector charted on the way in, the scan on Z, a
// long jump going in hops, and the data sold at a station.
//
//   node scripts/explore-check.mjs [--url http://127.0.0.1:5173] [--out lab/explore] [--chromium /path]
//
// It starts the dev server unless --url names one, opens /universe flying the
// cruiser (its jump range two sectors at Mk I), goes out past the Core (61,000
// east, the endless check's spot) and waits for the sector to be charted in
// tp-explore; beside the nearest system presses Z and reads the data banked; asks for a jump to a station
// eight or nine sectors further and checks it goes as hop 1 of 4 or more; then docks at the
// nearest station and checks the bank was sold for credits. Shots in
// lab/explore. Exit 1 on any miss.
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
const OUT = join(ROOT, typeof args.out === 'string' ? args.out : 'lab/explore');

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
const record = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tp-explore') ?? '{}').data ?? null);
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    localStorage.setItem('tp-intro', '1');
    localStorage.setItem('tp-start', '"universe"');
    localStorage.setItem('tp-quality', 'low');
    localStorage.setItem('tp-universe-ship', '"cruiser"');
    window.__tpKeepFrames = true;
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${base}/?quality=low#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__universeDebug?.state?.model && window.__universeDebug.economy, null, { timeout: 300000, polling: 250 });
  await page.evaluate(() => window.__universeDebug.teleport(181000, 0, 0, -Math.PI / 2, 0));
  if (await until(page, () => Object.keys(JSON.parse(localStorage.getItem('tp-explore') ?? '{}').data?.charted ?? {}).length > 0, null, 300000)) pass(`charted: ${Object.keys((await record(page))?.charted ?? {}).join(' ')}`);
  else fail('no sector charted on the way in');
  if (!(await until(page, () => window.__universeDebug.places.stations().length > 0, null, 300000))) throw new Error('no station loaded');
  await page.locator('canvas').first().click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
  // (beside the nearest system: the cruiser's Mk I scanner reaches 12,500)
  await page.evaluate(() => {
    const d = window.__universeDebug;
    const s = d.state.ship;
    const sys = d.expanse.nearestSystem([s.x, s.y, s.z]);
    const at = sys?.at ?? sys?.system?.at;
    if (at) d.teleport(at[0] + 3000, at[1] + 800, at[2], Math.PI / 2, 0);
  });
  await page.waitForTimeout(1500);
  const before = (await record(page))?.data ?? 0;
  await page.keyboard.press('z');
  if (await until(page, (b) => (JSON.parse(localStorage.getItem('tp-explore') ?? '{}').data?.data ?? 0) > b, before, 20000)) pass(`the scan banked ${(await record(page)).data - before} data`);
  else fail(`the scan banked nothing (note: ${await page.evaluate(() => window.__universeDebug.state.note?.text)})`);
  await page.screenshot({ path: join(OUT, 'scan.png') });
  // a hop: a jump to a system eight sectors on is past the cruiser's two
  const far = 'E:10,0:0';
  await page.evaluate((id) => window.__universeDebug.travel(id, 'hyper'), far);
  if (await until(page, () => Boolean(window.__universeDebug.state.hop), null, 120000)) {
    const hop = await page.evaluate(() => ({ ...window.__universeDebug.state.hop }));
    if (hop.k === 1 && hop.n >= 4) pass(`the long jump goes as hop ${hop.k} of ${hop.n}`);
    else fail(`the hop reads ${JSON.stringify(hop)}`);
  } else fail(`no hop for ${far} (note: ${await page.evaluate(() => window.__universeDebug.state.note?.text)})`);
  // called off, then docked at the nearest station: the bank sold
  await page.evaluate(() => {
    const d = window.__universeDebug;
    d.state.hop = null;
    d.state.jump = null;
    d.state.auto = null;
  });
  await page.evaluate(() => window.__universeDebug.teleport(181000, 0, 0, -Math.PI / 2, 0));
  await until(page, () => window.__universeDebug.places.stations().length > 0, null, 300000);
  const st = await page.evaluate(() => window.__universeDebug.places.stations()[0]);
  const credits = await page.evaluate(() => window.__universeDebug.economy.credits);
  const banked = (await record(page))?.data ?? 0;
  await page.evaluate((id) => window.__universeDebug.travel(id, 'hyper'), st.id);
  if (await until(page, (id) => window.__universe().docked === id, st.id, 300000)) pass(`docked at ${st.name}`);
  else fail(`never docked at ${st.id}`);
  await until(page, (c) => window.__universeDebug.economy.credits > c, credits, 30000);
  const after = await page.evaluate(() => window.__universeDebug.economy.credits);
  const left = (await record(page))?.data ?? 0;
  if (banked > 0 && after > credits && left === 0) pass(`the bank's ${banked} data sold for ${after - credits} credits`);
  else fail(`bank ${banked} → ${left}, credits ${credits} → ${after}`);
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
