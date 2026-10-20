/* global window, document */
// A browser check of Avengers HQ’s addresses (components/avengers/world/links.js):
// each opens its building’s game, cold, and every way back (the button, Esc,
// the browser) closes it without leaving the page. Spec 2026-10-18 §4 and §12;
// every Avengers HQ PR from the links on runs it. With the dev server up
// (npx vite --port 5173 --strictPort):
//   OUT=/tmp/hq-links node scripts/hq-links-check.mjs [--3d]
// Without --3d the games are their simple versions (seconds each, in software
// GL); --3d opens one cold over the compound and builds the compound after it.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { noisy } from './lib/noise.mjs';
import { HQ_HOME, LINKS, linkOf } from '../src/components/avengers/world/links.js';

const BASE = 'http://localhost:5173/?quality=low#';
const OUT = process.env.OUT ?? '.';
const THREE_D = process.argv.includes('--3d');
// (rules.js’ PLACES names: that module imports without extensions, which Node can’t)
const NAME = { stark: 'Tony Stark’s workshop', thor: 'Mjolnir', cap: 'The training center', hawkeye: 'The range', widow: 'Operations', banner: 'Bruce Banner’s lab', spidey: 'The front gate', vault: 'The hangar' };
// the no-3D view’s card for a place, and its way in (PR 5’s board changes these two lines)
const CARD = (id) => `.cw-cards li:nth-child(${LINKS.findIndex((l) => l.id === id) + 1})`;
const PLAY = 'button';

mkdirSync(OUT, { recursive: true });
const chrome =
  process.env.CHROMIUM ??
  readdirSync('/opt/pw-browsers')
    .filter((n) => /^chromium-\d+$/.test(n))
    .map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`)
    .find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};

async function fresh({ stones = [], three = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
  await ctx.addInitScript(
    ([s, t]) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-worlds', '"load"');
      window.localStorage.setItem('tp-software', '"on"');
      window.localStorage.setItem('tp-quality', '"low"');
      // raw, as lib/gpu.js setMode3D stores it: a JSON string reads as auto, which is 3D on here
      window.localStorage.setItem('tp-3d', t ? 'on' : 'off');
      window.localStorage.setItem('tp-hq-stones', JSON.stringify(s));
    },
    [stones, three],
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(false, `page error: ${e}`));
  page.on('console', (m) => m.type() === 'error' && !noisy(m.text()) && check(false, `console: ${m.text().slice(0, 160)}`));
  return page;
}

const at = (page) =>
  page.evaluate(() => {
    const dialog = document.querySelector('.cw-place');
    const label = dialog && document.getElementById(dialog.getAttribute('aria-labelledby'));
    return { hash: window.location.hash, idx: window.history.state?.idx, length: window.history.length, y: window.scrollY, open: !!dialog, title: label?.textContent?.trim() ?? null };
  });

// (and the title, when one is named: a navigation is a transition, so the game
// before stays on screen until the next one's code has loaded)
async function until(page, hash, open, ms = 20000, title = null) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const a = await at(page);
    if (a.hash === hash && a.open === open && (title === null || a.title === title)) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

const backButton = (page) => page.locator('.cw-place button').filter({ hasText: /^\s*Back/ }).first();

async function openFromCard(page, id) {
  await page.goto(BASE + HQ_HOME, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(CARD(id), { timeout: 60000 });
  await page.locator(CARD(id)).scrollIntoViewIfNeeded();
  await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), CARD(id));
  await page.waitForTimeout(300);
  const before = await at(page);
  await page.locator(`${CARD(id)} ${PLAY}`).first().click();
  const opened = await until(page, linkOf(id).replace(/^/, '#'), true);
  return { before, opened };
}

if (!THREE_D) {
  // cold: every address opens its game at once, and Esc puts the compound in its place
  for (const [i, l] of LINKS.entries()) {
    const page = await fresh();
    await page.goto(BASE + linkOf(l.id), { waitUntil: 'domcontentloaded' });
    const opened = await until(page, `#${linkOf(l.id)}`, true, 60000);
    const a = await at(page);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    check(opened && a.title === NAME[l.id] && theme === 'stark', `cold ${linkOf(l.id)} opens “${NAME[l.id]}” in Stark’s colours (got “${a.title}”, ${theme})`);
    if (!i) await page.screenshot({ path: `${OUT}/hq-links-cold.png` });
    await page.keyboard.press('Escape');
    const closed = await until(page, '#/avengers', false);
    const b = await at(page);
    check(closed && b.length === a.length && b.idx === a.idx, `cold ${l.slug}: Esc replaces the game with /avengers`);
    await page.context().close();
  }

  // door: a card pushes the address; the browser’s Back, Esc and the button each go back in the page
  {
    const page = await fresh();
    const { before, opened } = await openFromCard(page, 'cap');
    const a = await at(page);
    check(opened && a.idx === before.idx + 1 && a.length === before.length + 1 && Math.abs(a.y - before.y) <= 4, 'door: the card pushes /avengers/training and keeps the scroll');
    for (const [how, act] of [
      ['the browser’s Back', () => page.goBack()],
      ['Esc', () => page.keyboard.press('Escape')],
      ['the Back button', () => backButton(page).click()],
    ]) {
      await act();
      const closed = await until(page, '#/avengers', false);
      const b = await at(page);
      check(closed && b.idx === before.idx && Math.abs(b.y - before.y) <= 4, `door: ${how} goes back in the page`);
      await page.locator(`${CARD('cap')} ${PLAY}`).first().click();
      await until(page, '#/avengers/training', true);
    }
    await page.context().close();
  }

  // double-esc: two Escs before the address moves go back once, not off the page
  {
    const page = await fresh();
    const { before } = await openFromCard(page, 'cap');
    await page.evaluate(() => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await page.waitForTimeout(1000);
    const b = await at(page);
    check(b.hash === '#/avengers' && !b.open && b.idx === before.idx, `double-esc: one step back (at ${b.hash}, idx ${b.idx} of ${before.idx})`);
    await page.context().close();
  }

  // reload: a game opened from a door opens again at once, and Esc returns to the entry behind it
  {
    const page = await fresh();
    const { before } = await openFromCard(page, 'cap');
    await page.reload({ waitUntil: 'domcontentloaded' });
    const opened = await until(page, '#/avengers/training', true, 60000);
    const a = await at(page);
    check(opened && a.title === NAME.cap, 'reload: the game opens again');
    await page.keyboard.press('Escape');
    const closed = await until(page, '#/avengers', false);
    const b = await at(page);
    check(closed && b.idx === before.idx, 'reload: Esc returns to the /avengers entry behind it');
    await page.context().close();
  }

  // stones: a half won (no tp:stones event) shows once the game is left by the browser’s Back
  {
    const page = await fresh();
    await openFromCard(page, 'hawkeye');
    await page.evaluate(() => window.localStorage.setItem('tp-hq-stones', '["soul-clint"]'));
    await page.goBack();
    await until(page, '#/avengers', false);
    let shown = false;
    for (let i = 0; i < 20 && !shown; i++) {
      shown = /Clint’s half of the Soul Stone: won/.test(await page.locator(CARD('hawkeye')).innerText());
      if (!shown) await page.waitForTimeout(100);
    }
    check(shown, 'stones: a half won shows on the card after the browser’s Back');
    await page.context().close();
  }

  // unknown: an address that is no building is the compound
  {
    const page = await fresh();
    await page.goto(`${BASE}/avengers/nowhere`, { waitUntil: 'domcontentloaded' });
    const back = await until(page, '#/avengers', false, 30000);
    await page.waitForTimeout(1000);
    const a = await at(page);
    check(back && !a.open, 'unknown: /avengers/nowhere becomes /avengers');
    await page.context().close();
  }

  // toy: the hangar’s simple version opens the portal only with the Space Stone
  {
    let page = await fresh();
    await page.goto(BASE + linkOf('vault'), { waitUntil: 'domcontentloaded' });
    await until(page, '#/avengers/hangar', true, 60000);
    const space = page.locator('.cw-place button').filter({ hasText: /^\s*Space\s*$/ }).first();
    const disabled = await space.isDisabled();
    const text = await page.locator('.cw-place').innerText();
    check(disabled && /won in the 3D game/.test(text), 'toy: without the Space Stone the portal stays shut');
    await page.context().close();
    page = await fresh({ stones: ['space'] });
    await page.goto(BASE + linkOf('vault'), { waitUntil: 'domcontentloaded' });
    await until(page, '#/avengers/hangar', true, 60000);
    await page.locator('.cw-place button').filter({ hasText: /^\s*Space\s*$/ }).first().click();
    const closed = await until(page, '#/avengers', false);
    let top = null;
    for (let i = 0; i < 50; i++) {
      top = await page.evaluate(() => document.getElementById('thanos')?.getBoundingClientRect().top ?? null);
      if (top !== null && top >= -8 && top <= 120) break;
      await page.waitForTimeout(100);
    }
    check(closed && top !== null && top >= -8 && top <= 120, `toy: with it, the portal takes you to Titan (its top at ${top})`);
    await page.context().close();
  }

  // palette: each game is a Worlds row at its own address; one picked from the palette closes to the compound
  const groupOf = (page, id) =>
    page.evaluate((x) => {
      let li = document.getElementById(x)?.closest('li');
      while (li) {
        const g = li.querySelector('.palette-group');
        if (g) return g.textContent.trim();
        li = li.previousElementSibling;
      }
      return null;
    }, id);
  {
    const page = await fresh();
    await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palette-list', { timeout: 20000 });
    await page.keyboard.type('ricochet');
    await page.waitForTimeout(400);
    const picked = await page.evaluate(() => document.getElementById('pal-w-av-training')?.getAttribute('aria-selected'));
    check(picked === 'true' && (await groupOf(page, 'pal-w-av-training')) === 'Worlds', 'palette: “ricochet” picks Avengers HQ · Ricochet, under Worlds');
    await page.screenshot({ path: `${OUT}/hq-links-palette.png` });
    await page.keyboard.press('Enter');
    const opened = await until(page, '#/avengers/training', true, 60000);
    const a = await at(page);
    check(opened && a.title === NAME.cap, 'palette: Enter opens the training center’s game');
    await page.keyboard.press('Escape');
    const closed = await until(page, '#/avengers', false);
    check(closed && (await at(page)).length === a.length, 'palette: Esc replaces the game with /avengers');
    await page.goBack();
    await page.waitForTimeout(800);
    check((await at(page)).hash === '#/home', 'palette: the browser’s Back returns to /home');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palette-list', { timeout: 20000 });
    await page.keyboard.type('avengers hq');
    await page.waitForTimeout(400);
    check((await page.$('#pal-w-av')) !== null && (await groupOf(page, 'pal-w-av')) === 'Worlds', 'palette: “avengers hq” lists the compound under Worlds');
    await page.context().close();
  }

  // jump: from one game to another through the palette, then Esc puts the compound in its place
  {
    const page = await fresh();
    await openFromCard(page, 'cap');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palette-list', { timeout: 20000 });
    await page.keyboard.type('thwip');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    const opened = await until(page, '#/avengers/gate', true, 60000, NAME.spidey);
    check(opened, 'jump: the palette opens the gate’s game in place of the training center’s');
    await page.keyboard.press('Escape');
    check(await until(page, '#/avengers', false), 'jump: Esc puts the compound in its place');
    await page.context().close();
  }
} else {
  const page = await fresh({ three: true });
  // 3d-cold: the game opens at once, before the compound is built; the compound builds when it closes
  await page.goto(BASE + linkOf('spidey'), { waitUntil: 'domcontentloaded' });
  const opened = await until(page, '#/avengers/gate', true, 30000);
  const built = await page.evaluate(() => !!document.querySelector('.cw-canvas[data-on]'));
  check(opened && !built, '3d-cold: the gate’s game opens before the compound is built');
  const n = (await at(page)).length;
  await backButton(page).click();
  const closed = await until(page, '#/avengers', false);
  check(closed && (await at(page)).length === n, '3d-cold: Back replaces the game with /avengers');
  const up = await page.waitForSelector('.cw-canvas[data-on]', { timeout: 240000 }).then(
    () => true,
    () => false,
  );
  check(up, '3d-cold: the compound builds once the game closes');
  await page.screenshot({ path: `${OUT}/hq-links-3d.png` });
  // 3d-hook: the dev hook pushes the address, and Back leaves him outside the gate
  const i0 = (await at(page)).idx;
  await page.evaluate(() => window.__HQWORLD__.enter('spidey'));
  const hooked = await until(page, '#/avengers/gate', true);
  check(hooked && (await at(page)).idx === i0 + 1, '3d-hook: __HQWORLD__.enter pushes /avengers/gate');
  await page.goBack();
  const left = await until(page, '#/avengers', false);
  check(left && (await at(page)).idx === i0, '3d-hook: Back pops to /avengers');
  const near = await page.waitForFunction(() => window.__HQWORLD__?.sim?.near === 'spidey', null, { timeout: 120000 }).then(
    () => true,
    () => false,
  );
  check(near, '3d-hook: he is back outside the gate');
  await page.context().close();
}

await browser.close();
console.log(problems.length ? `${problems.length} problems` : 'all ok');
process.exit(problems.length ? 1 : 0);
