/* global window, document */
// The Shipyard in a browser, at a desk's width and a phone's:
//
//   node scripts/shipyard-check.mjs [--url http://127.0.0.1:5173] [--out lab/shipyard] [--chromium /path]
//
// It starts the dev server (the wallet's dev hook, __universeDebug.economy,
// is a DEV hook) unless --url names one, opens /universe flying the X-wing,
// presses H and waits for the Shipyard (the flight menu's Ship tab, on the
// Hangar's page last used: the Shipyard, as tp-hangar-tab says). At
// 1280 × 720 it shoots desk.webp, checks the showroom drew a ship (the stage
// with its canvas against the stage without it, and the canvas inspector's
// colour entropy), earns credits through the dev hook, stages the Flak burst
// in the list's Secondary, reads the purchase bar's total, applies, and reads
// tp-pilot and tp-universe-loadout back; then, on the X-wing's own hull,
// picks a Quad in Engines: the hull stays Stock ("Stock hull · tuned"), the
// stats change, Apply keeps the X-wing's model and keeps the tune under
// tp-universe-tune (and no garage hull). At 390 × 844, a touch phone, it
// stages a booster, shoots phone.webp and checks Apply is on screen, a
// finger's height, and clear of the menu's tabs. Exit 1 on any miss.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  args[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : argv[++i];
}
const OUT = join(ROOT, typeof args.out === 'string' ? args.out : 'lab/shipyard');

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

// the canvas inspector's colour entropy (as universe-check.mjs sums it)
function entropy({ data, width, height }) {
  const buckets = new Map();
  let n = 0;
  for (let y = 0; y < height; y += 2)
    for (let x = 0; x < width; x += 2) {
      const o = (y * width + x) * 4;
      const key = `${data[o] >> 4},${data[o + 1] >> 4},${data[o + 2] >> 4}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
      n++;
    }
  let e = 0;
  for (const c of buckets.values()) e -= (c / n) * Math.log2(c / n);
  return Number(e.toFixed(2));
}
const pixels = async (png) => {
  const { data, info } = await sharp(png).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};
// how far two shots of the same box are apart, 0…255 on average
const apart = (a, b) => {
  let d = 0;
  for (let i = 0; i < a.data.length; i += 4) d += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
  return d / (a.data.length / 4) / 3;
};

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

// (the shipyard's list: back to its front door if a category's open, then into one)
async function openSlot(yard, slot) {
  if (await yard.locator('.yl-back').count()) await yard.locator('.yl-back').click();
  await yard.locator(`.yl-cat[data-slot="${slot}"]`).click();
}

async function open(viewport, { mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => {
    localStorage.setItem('tp-intro', '1');
    localStorage.setItem('tp-start', '"universe"');
    localStorage.setItem('tp-quality', 'low');
    localStorage.setItem('tp-universe-ship', '"xwing"');
    localStorage.setItem('tp-hangar-tab', '"shipyard"');
    window.__tpKeepFrames = true;
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${base}/?quality=low#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__universeDebug?.state?.model, null, { timeout: 300000, polling: 250 });
  await page.waitForTimeout(1500);
  await page.locator('canvas').first().click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
  // (H opens the flight menu on the Hangar's page, once the HUD that listens for it is up: a moment after the ship)
  const yard = page.locator('.yz');
  for (let i = 0; i < 8 && !(await yard.count()); i++) {
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('h');
    await page.waitForTimeout(2000);
  }
  await yard.waitFor({ timeout: 60000 });
  await page.waitForTimeout(8000); // (the showroom's first frames, in software, and the real ship's model over its stand-in)
  return { ctx, page, yard, errors };
}

try {
  // ── the desk ──
  {
    const { ctx, page, yard, errors } = await open({ width: 1280, height: 720 });
    pass('H opens the Shipyard');
    await sharp(await page.screenshot()).webp({ quality: 82 }).toFile(join(OUT, 'desk.webp'));
    const stage = page.locator('.yard-stage');
    const withShip = await pixels(await stage.screenshot());
    await page.addStyleTag({ content: '.yard-canvas { visibility: hidden !important; }' });
    const without = await pixels(await stage.screenshot());
    await page.addStyleTag({ content: '.yard-canvas { visibility: visible !important; }' });
    const e = entropy(withShip);
    const d = apart(withShip, without);
    report.desk = { entropy: e, drawn: Number(d.toFixed(2)) };
    if (d > 0.4 && e > 1) pass(`the showroom drew a ship (entropy ${e} bits, ${d.toFixed(2)} off the empty stage)`);
    else fail(`the showroom looks empty (entropy ${e}, ${d.toFixed(2)} off the empty stage)`);

    // credits, then the Flak burst staged (level 4: ten war wins' xp)
    await page.evaluate(() => window.__universeDebug.economy.earn('warWin', 10));
    await openSlot(yard, 'secondary');
    await yard.locator('.yl-row', { hasText: 'Flak burst' }).click();
    const total = await yard.locator('.yc-total b').innerText();
    report.total = total;
    if (/\d[\d,]* ¢/.test(total) && !/^0 ¢$/.test(total)) pass(`the bar says ${total}`);
    else fail(`the bar's total reads "${total}"`);
    const apply = yard.getByRole('button', { name: 'Apply and launch' });
    if (await apply.isEnabled()) pass('Apply is ready');
    else fail(`Apply is disabled: ${await yard.locator('.yc-issue').innerText().catch(() => '')}`);
    await apply.click();
    // (the wallet writes half a second after a change: economy.js's SAVE_AFTER)
    await page
      .waitForFunction(() => (JSON.parse(localStorage.getItem('tp-pilot') ?? '{}').data?.owned ?? []).includes('part:secondary:flak'), null, { timeout: 5000, polling: 200 })
      .catch(() => {});
    const saved = await page.evaluate(() => ({ pilot: JSON.parse(localStorage.getItem('tp-pilot') ?? 'null'), loadout: JSON.parse(localStorage.getItem('tp-universe-loadout') ?? 'null') }));
    const pilot = saved.pilot?.data ?? saved.pilot; // (saves.js keeps it as { v, data })
    report.owned = pilot?.owned;
    if (pilot?.owned?.includes('part:secondary:flak')) pass('tp-pilot owns part:secondary:flak');
    else fail(`tp-pilot doesn't own the flak: ${JSON.stringify(pilot?.owned)}`);
    const l = saved.loadout?.data ?? saved.loadout;
    if (l?.xwing?.secondary === 'flak') pass('tp-universe-loadout flies the flak on the X-wing');
    else fail(`tp-universe-loadout's X-wing: ${JSON.stringify(l?.xwing)}`);
    if (!(await yard.isVisible().catch(() => false))) pass('Apply and launch closed the yard');
    else fail('the yard stayed open after Apply');
    const arms = await page.evaluate(() => {
      const a = window.__universeDebug.arms();
      a.select(1);
      return a.id;
    });
    if (arms === 'flak') pass('the armoury fires the flak on line 2');
    else fail(`the armoury's line 2 is ${arms}`);
    // ── a module on the crew's own ship: tuning, not a garage build ──
    await page.evaluate(() => window.__universeDebug.economy.earn('warWin', 10));
    const was = await page.evaluate(() => ({ ...window.__universeDebug.state.stats }));
    await page.keyboard.press('h');
    await yard.waitFor({ timeout: 60000 });
    await openSlot(yard, 'engines');
    const hint = await yard.locator('.yl-quiet').first().innerText();
    if (/tunes it: its numbers, not its looks/.test(hint)) pass('Engines says a module tunes the crew’s own ship');
    else fail(`Engines' hint reads "${hint}"`);
    await yard.locator('.yl-row', { hasText: 'Quad' }).click();
    const caption = await yard.locator('.yard-caption').innerText();
    if (/Stock hull · tuned/.test(caption)) pass(`the caption reads "${caption.split(' · ').slice(1).join(' · ')}"`);
    else fail(`the caption reads "${caption}"`);
    await sharp(await page.screenshot()).webp({ quality: 82 }).toFile(join(OUT, 'tune.webp'));
    await yard.getByRole('button', { name: 'Apply and launch' }).click();
    await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem('tp-universe-tune') ?? 'null')), null, { timeout: 5000, polling: 200 }).catch(() => {});
    const tuned = await page.evaluate(() => {
      const kept = (k) => {
        const v = JSON.parse(localStorage.getItem(k) ?? 'null');
        return v?.data ?? v;
      };
      const s = window.__universeDebug.state;
      return { tune: kept('tp-universe-tune'), hull: kept('tp-universe-hull'), kind: s.kind, build: s.build, garageModel: Boolean(s.model?.build), stats: { ...s.stats } };
    });
    report.tune = tuned;
    if (tuned.tune?.xwing?.engines === 'quad') pass('tp-universe-tune keeps the Quad on the X-wing');
    else fail(`tp-universe-tune: ${JSON.stringify(tuned.tune)}`);
    if (!tuned.hull?.xwing && !tuned.build && !tuned.garageModel) pass('the hull is still Stock: no garage build kept or flown');
    else fail(`the hull changed: ${JSON.stringify({ hull: tuned.hull, build: tuned.build, garageModel: tuned.garageModel })}`);
    if (tuned.kind === 'xwing') pass('Apply kept the X-wing’s model');
    else fail(`the ship is ${tuned.kind}`);
    if (tuned.stats.accel > was.accel) pass(`the stats changed (acceleration ${was.accel.toFixed(2)} → ${tuned.stats.accel.toFixed(2)})`);
    else fail(`the stats didn't change: ${was.accel} → ${tuned.stats.accel}`);
    if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }

  // ── the phone ──
  {
    const { ctx, page, yard, errors } = await open({ width: 390, height: 844 }, { mobile: true });
    // (staged, the bar rides along the foot of the menu's scroll)
    await openSlot(yard, 'booster');
    await yard.locator('.yl-row', { hasText: 'Twin solid boosters' }).click();
    await page.waitForTimeout(500);
    await sharp(await page.screenshot()).webp({ quality: 82 }).toFile(join(OUT, 'phone.webp'));
    const tabs = await page.evaluate(() => document.querySelector('.hud-pause-tabs')?.getBoundingClientRect().top ?? 844);
    const box = await yard.getByRole('button', { name: 'Apply and launch' }).boundingBox();
    report.phone = { tabs, apply: box };
    if (box && box.y >= 0 && box.y + box.height <= tabs && box.x >= 0 && box.x + box.width <= 390 && box.height >= 44) pass(`Apply is on screen, clear of the menu's tabs (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)})`);
    else fail(`Apply is off screen or under the tabs: ${JSON.stringify(box)} (tabs at ${tabs})`);
    const stage = await page.locator('.yard-stage').boundingBox();
    if (stage && stage.height >= 160 && stage.y + stage.height <= box.y) pass(`the showroom's in sight over it (${Math.round(stage.height)} px tall)`);
    else fail(`the showroom's off screen or under the bar: ${JSON.stringify(stage)}`);
    if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
} catch (e) {
  fail(String(e?.stack ?? e));
} finally {
  await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server?.kill();
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
