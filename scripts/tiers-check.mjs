/* global window */
// The ship's tiers in a browser: the Hangar's Systems tab, a tier bought, and
// the scene flying on it.
//
//   node scripts/tiers-check.mjs [--url http://127.0.0.1:5173] [--out lab/tiers] [--chromium /path]
//
// It starts the dev server (the wallet's dev hook, __universeDebug.economy,
// is a DEV hook) unless --url names one, opens /universe flying the X-wing,
// reads its Mk I pulse drive off __universeDebug.core() (285: its own 0.95 of
// the old 300), earns credits, presses H and opens the Systems tab: seven
// rows, Pulse drive Mk II for 600 credits, bought, and the scene's pulse
// drive is then 399 and tp-pilot owns tier:xwing:pulse:2. At 390 × 844 the
// tab's rows fit the phone's width. Shots in lab/tiers. Exit 1 on any miss.
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
const OUT = join(ROOT, typeof args.out === 'string' ? args.out : 'lab/tiers');

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
const report = {};

async function open(viewport, { mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => {
    localStorage.setItem('tp-intro', '1');
    localStorage.setItem('tp-start', '"universe"');
    localStorage.setItem('tp-quality', 'low');
    localStorage.setItem('tp-universe-ship', '"xwing"');
    localStorage.setItem('tp-hangar-tab', 'systems');
    window.__tpKeepFrames = true;
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${base}/?quality=low#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__universeDebug?.state?.model, null, { timeout: 300000, polling: 250 });
  await page.waitForTimeout(1500);
  await page.locator('canvas').first().click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
  await page.locator('.universe-hangar-btn').waitFor({ timeout: 60000 });
  return { ctx, page, errors };
}
const hangar = async (page) => {
  await page.keyboard.press('h');
  const dialog = page.getByRole('dialog', { name: 'Hangar' });
  await dialog.waitFor({ timeout: 60000 });
  await dialog.getByRole('tab', { name: 'Systems' }).click();
  await dialog.locator('.hangar-systems').waitFor({ timeout: 30000 });
  return dialog;
};

try {
  {
    const { ctx, page, errors } = await open({ width: 1280, height: 720 });
    const before = await page.evaluate(() => window.__universeDebug.core());
    // the X-wing's own Mk I: its pulse drive 0.95 of the old 300
    if (Math.abs(before.pulse - 285) < 0.5) pass(`the X-wing's Mk I pulse drive is ${before.pulse}`);
    else fail(`the X-wing's Mk I pulse drive is ${before.pulse}, not 285`);
    await page.evaluate(() => window.__universeDebug.economy.earn('warWin', 4));
    const dialog = await hangar(page);
    const rows = await dialog.locator('.hangar-systems li').count();
    if (rows === 7) pass('the Systems tab lists the seven systems');
    else fail(`the Systems tab lists ${rows} systems`);
    await page.screenshot({ path: join(OUT, 'desk.png') });
    const buy = dialog.locator('li[data-system="pulse"] button');
    const label = await buy.innerText();
    if (/Pulse drive Mk II · 600 ¢/.test(label)) pass(`its pulse drive offers "${label}"`);
    else fail(`its pulse drive's button reads "${label}"`);
    await buy.click();
    await page.waitForFunction(() => Math.abs(window.__universeDebug.core().pulse - 399) < 0.5, null, { timeout: 10000, polling: 200 }).catch(() => {});
    const after = await page.evaluate(() => window.__universeDebug.core());
    if (Math.abs(after.pulse - 399) < 0.5 && after.tiers.pulse === 2) pass(`bought: the pulse drive is Mk II, ${after.pulse} a second`);
    else fail(`after buying, the pulse drive is ${after.pulse} at tier ${after.tiers.pulse}`);
    const tier = await dialog.locator('li[data-system="pulse"]').getAttribute('data-tier');
    if (tier === '2') pass('the row says Mk II');
    else fail(`the row's tier is ${tier}`);
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('tp-pilot') ?? '{}').data?.owned ?? []).includes('tier:xwing:pulse:2'), null, { timeout: 5000, polling: 200 }).catch(() => {});
    const owned = await page.evaluate(() => JSON.parse(localStorage.getItem('tp-pilot') ?? '{}').data?.owned ?? []);
    if (owned.includes('tier:xwing:pulse:2')) pass('tp-pilot owns tier:xwing:pulse:2');
    else fail(`tp-pilot owns ${JSON.stringify(owned)}`);
    const mk4 = await dialog.locator('li[data-system="engines"] button').innerText();
    report.engines = mk4;
    if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
    else pass('no page errors');
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ width: 390, height: 844 }, { mobile: true });
    const dialog = await hangar(page);
    await page.screenshot({ path: join(OUT, 'phone.png') });
    const box = await dialog.locator('li[data-system="reactor"]').boundingBox();
    if (box && box.x >= 0 && box.x + box.width <= 390 + 1) pass('a row fits a phone’s width');
    else fail(`the reactor's row is at ${JSON.stringify(box)}`);
    if (errors.length) fail(`page errors on a phone: ${errors.join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
console.log(JSON.stringify(report));
process.exit(failed ? 1 : 0);
