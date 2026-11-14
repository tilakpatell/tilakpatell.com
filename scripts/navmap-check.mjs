/* global window, document */
// A browser check of the universe nav map (NavMap.jsx). With the dev server
// up (npx vite --port 5173) and Chrome at $CHROME (or /opt/google/chrome):
//   OUT=/tmp/shots node scripts/navmap-check.mjs [desktop|phone|minimap|far]
// The chart (universe/chart/): it opens on the ship, the wheel and − zoom
// it, typing in the search doesn't, a drag from a place's name moves it and
// picks nothing, a Shift-drag tilts it; far out the ship is still on it.
// (BASE says which server, http://localhost:5173 by default; CHROME or
// CHROMIUM which browser)
// It opens the map, checks the labels and the go button, jumps to a wonder
// (the ship has to be out under the site's jump, which clears the world's
// card from the panel), tries a second jump while the hyperdrive charges,
// flies out to a wonder at super speed with the selection cleared under it,
// then the phone layout: the list first, the chart a tap away, its names
// clear of each other. Screenshots go to $OUT. Headless Chrome draws in
// software, slowly: clicks go through the DOM, and the waits are long.
import { chromium } from 'playwright-core';
import { shipFromMiddle, shipOnChart, sectorWords } from './lib/navmap.mjs';

const out = process.env.OUT ?? '.';
const only = process.argv[2];
const BASE = (process.env.BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const URL = `${BASE}/?quality=low#/universe`;
const run = (m) => !only || only === m;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? process.env.CHROMIUM ?? '/opt/google/chrome/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};

async function open(viewport, ship) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
  await ctx.addInitScript((s) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
    window.localStorage.setItem('tp-universe-drive', '"super"');
  }, ship);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 120000 });
  await page.waitForSelector('.universe-navmap-btn', { timeout: 400000 }); // (once the shaders are in: minutes in software GL)
  await page.waitForTimeout(2000);
  return page;
}
const click = (page, sel, nth = 0) =>
  page.evaluate(
    ([s, n]) => {
      const el = document.querySelectorAll(s)[n];
      if (!el) throw new Error(`nothing at ${s}`);
      el.click();
    },
    [sel, nth],
  );
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 });
const state = (page) => page.evaluate(() => ({ ...window.__universe(), hash: window.location.hash }));
const navOpen = (page) => page.waitForSelector('.navmap', { timeout: 60000 });
// the names showing on the chart: two that meet, or one past its circle's
// edge (chartLabels.js lays them out), in words; null for none
const namesClash = () => {
  const c = document.querySelector('.navmap-chart').getBoundingClientRect();
  const R = c.width / 2;
  // (a name with no room of its own shows only on a hover or a pick, over the rest on purpose)
  const names = [...document.querySelectorAll('.navmap-places .navmap-name:not([data-off])')].filter((n) => n.offsetParent).map((n) => [n.textContent, n.getBoundingClientRect()]);
  for (const [t, b] of names) if ([b.left, b.right].some((x) => [b.top, b.bottom].some((y) => Math.hypot(x - c.left - R, y - c.top - R) > R + 1))) return `${t} past the edge`;
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [names[i][1], names[j][1]];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) return `${names[i][0]} on ${names[j][0]}`;
    }
  return null;
};
const pickByName = (page, name) => page.evaluate((n) => [...document.querySelectorAll('.navmap-list button')].find((b) => b.textContent.includes(n))?.click(), name);

if (run('desktop')) {
  const page = await open({ width: 1440, height: 900 }, 'falcon');
  await click(page, '.universe-navmap-btn');
  await navOpen(page);
  await page.waitForTimeout(800);
  await shot(page, '1-navmap');
  // the labels that used to sit on their neighbours
  const boxes = await page.evaluate(() => {
    const box = (label) => [...document.querySelectorAll('.navmap-place')].find((b) => b.getAttribute('aria-label')?.startsWith(label))?.querySelector('.navmap-name').getBoundingClientRect();
    const r = (b) => b && { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom };
    return { maw: r(box('The Maw')), carib: r(box('The Caribbean')), glacia: r(box('Glacia')), gate: r(box('A galaxy far')) };
  });
  const overlap = (a, b) => a && b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  check(!overlap(boxes.maw, boxes.carib), 'The Maw’s name clear of The Caribbean’s');
  check(!overlap(boxes.glacia, boxes.gate), 'Glacia’s name clear of the galaxy gate’s');
  const clash = await page.evaluate(namesClash);
  check(!clash, `no two names on the chart meet, and none runs off it${clash ? ` (${clash})` : ''}`);
  // the list isn't squashed under the key hints
  const squashed = await page.evaluate(() => {
    const keys = document.querySelector('.navmap-keys')?.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.navmap-list li')].map((li) => li.getBoundingClientRect());
    return Boolean(keys && keys.height && rows.some((r) => r.bottom > keys.top + 1 && r.top < keys.bottom - 1));
  });
  check(!squashed, 'the place list doesn’t run under the key hints');

  // the chart: on the ship, at the neighbourhood's zoom (a system's in the Curve), its sector and height under it
  const level = () => page.$eval('.navmap-chart', (e) => e.dataset.level);
  const pitched = () => page.$eval('.navmap-chart', (e) => e.hasAttribute('data-pitched'));
  const near = async (dx, dy, px) => {
    const m = await shipFromMiddle(page);
    return Boolean(m) && Math.hypot(m[0] - dx, m[1] - dy) <= px;
  };
  const until = async (ok, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      if (await ok()) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  const opened = (await state(page)).ship;
  const inCurve = Math.hypot(opened.x, opened.z + 66000) <= 6000;
  check(await until(() => near(0, 0, 3)), 'the chart opens on the ship, in its middle');
  check((await level()) === (inCurve ? 'system' : 'neighbourhood'), `it opens at the ${inCurve ? 'system' : 'neighbourhood'}’s zoom (${await level()})`);
  const readoutNow = await page.textContent('.navmap-readout');
  check(readoutNow.startsWith(sectorWords(opened)), `the readout says the ship’s sector and height (${readoutNow})`);
  const c = await page.$eval('.navmap-chart', (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y);
  let turns = 0;
  while ((await level()) !== 'system' && turns++ < 12) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(200);
  }
  check((await level()) === 'system', `the wheel zooms in to a system (${turns} turns)`);
  for (let i = 0; i < 12 && (await level()) === 'system'; i++) {
    await page.keyboard.press('-');
    await page.waitForTimeout(450);
  }
  check((await level()) === 'neighbourhood', '− zooms back out');
  const was = await level();
  await page.focus('.navmap-search input');
  await page.keyboard.type('-');
  await page.waitForTimeout(500);
  check((await level()) === was && (await page.inputValue('.navmap-search input')) === '-', 'a minus typed in the search goes in the search, not the zoom');
  await page.fill('.navmap-search input', '');
  await page.waitForTimeout(400);
  // a drag begun on a place's name moves the chart with the hand, and picks nothing
  const from = await page.evaluate(() => {
    const c = document.querySelector('.navmap-chart').getBoundingClientRect();
    const b = [...document.querySelectorAll('.navmap-place[aria-label]')].map((e) => [e, e.getBoundingClientRect()]).find(([, r]) => r.width && Math.hypot(r.left - c.left - c.width / 2, r.top - c.top - c.height / 2) < c.width * 0.3);
    return b && { x: b[1].left + b[1].width / 2, y: b[1].top + b[1].height / 2, label: b[0].getAttribute('aria-label'), pressed: b[0].getAttribute('aria-pressed') };
  });
  const autoBefore = (await state(page)).auto;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + i * 15, from.y);
  await page.mouse.up();
  await page.waitForTimeout(600);
  check(await near(120, 0, 6), `a drag of 120 px moves the ship’s marker 120 px with it (${JSON.stringify(await shipFromMiddle(page))})`);
  const pressedAfter = await page.evaluate((l) => document.querySelector(`.navmap-place[aria-label="${l}"]`)?.getAttribute('aria-pressed'), from.label);
  check(pressedAfter === from.pressed && (await state(page)).auto === autoBefore, `the drag from ${from.label.split(',')[0]} picked nothing and sent the ship nowhere`);
  const toShip = '.navmap-tools button[aria-label="Back to the ship"]';
  check((await page.getAttribute(toShip, 'aria-disabled')) === null, '“Back to the ship” wakes up');
  await page.click(toShip);
  check(await until(() => near(0, 0, 3)), 'and takes the chart back to the ship');
  // a Shift-drag tilts it, and Look straight down puts it back
  await page.keyboard.down('Shift');
  await page.mouse.move(c.x, c.y + 100);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(c.x, c.y + 100 - i * 15);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(600);
  const flatBtn = '.navmap-tools button[aria-label="Look straight down"]';
  check((await pitched()) && (await page.getAttribute(flatBtn, 'aria-disabled')) === null, 'a Shift-drag tilts the chart');
  await shot(page, '15-tilted');
  await page.click(flatBtn);
  check(await until(async () => !(await pitched())), 'Look straight down flattens it again');

  // a world: the go button says how
  await pickByName(page, 'Avengers HQ');
  await page.waitForTimeout(1500);
  check((await page.textContent('.navmap-go')).includes('Race to Avengers HQ'), 'the go button reads “Race to Avengers HQ”');
  const times = await page.$$eval('.navmap-drive-time', (els) => els.map((e) => e.textContent));
  check(times.every((t) => /s$/.test(t)), `a trip time for every drive (${times.join(', ')})`);
  await shot(page, '2-picked');

  // the URL picks Marvel first, so the panel has a world's card to lose
  await page.evaluate(() => (window.location.hash = '#/universe/marvel'));
  await page.waitForTimeout(3000);
  // a jump to Ember (or Glacia, if the ship started out by Ember), timed on the wall clock: main-sector wonders, their
  // places read from the scene (the Citadel moved to the Rick and Morty sector, and a hard-coded place went stale with it)
  const start = (await state(page)).ship;
  const wonder = (name) => page.evaluate((n) => window.__universeDebug.wonders.find((w) => w.name === n)?.at ?? null, name);
  const ember = await wonder('Ember');
  const glacia = await wonder('Glacia');
  check(Boolean(ember && glacia), 'Ember and Glacia are among the wonders');
  const [goal, gx, gz] = ember && Math.hypot(start.x - ember[0], start.z - ember[2]) >= 600 ? ['Ember', ember[0], ember[2]] : ['Glacia', glacia[0], glacia[2]];
  await click(page, '.navmap-close');
  await page.waitForTimeout(500);
  await page.keyboard.press('m');
  await navOpen(page);
  await click(page, '.navmap-back').catch(() => {});
  await pickByName(page, goal);
  await page.waitForTimeout(800);
  await click(page, '.navmap-drive[data-drive="hyper"]');
  await page.waitForTimeout(300);
  check((await page.textContent('.navmap-go')).includes(`Jump to ${goal}`), `the go button reads “Jump to ${goal}”`);
  // (every frame, in the page: when the jump was due and how far the ship is
  // from the wonder. Software GL is slow, so what's checked is that it's out
  // on the first frame past the flash, not how many seconds that took here)
  await page.evaluate(
    ([x, z]) => {
      window.__jumpLog = [];
      const tick = () => {
        const s = window.__universeDebug.state;
        window.__jumpLog.push([performance.now() / 1000, s.jump?.at ?? null, s.ship ? Math.hypot(s.ship.x - x, s.ship.z - z) : null]);
        if (window.__jumpLog.length < 3000) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    },
    [gx, gz],
  );
  await click(page, '.navmap-go');
  let overlay = false;
  for (let i = 0; i < 80; i++) {
    overlay ||= await page.evaluate(() => Boolean(document.querySelector('.hyperspace-canvas, canvas[class*="hyper"]')));
    const s = await state(page);
    if (s.ship && Math.hypot(s.ship.x - gx, s.ship.z - gz) < 800) break;
    if (i === 2) await shot(page, '3-jumping');
    await page.waitForTimeout(250);
  }
  check(overlay, 'the site’s jump plays over the map');
  const timing = await page.evaluate(() => {
    const log = window.__jumpLog;
    const due = log.find((r) => r[1] !== null)?.[1];
    const i = log.findIndex((r) => r[2] !== null && r[2] < 800);
    if (due === undefined || i < 1) return null;
    return { late: log[i][0] - due, frame: log[i][0] - log[i - 1][0], before: log[i - 1][0] - due };
  });
  check(timing && timing.before < 0.05 && timing.late <= timing.frame + 0.05, `the ship’s out at ${goal} on the first frame past the flash (${JSON.stringify(timing)})`);
  const after = await state(page);
  check(after.hash === '#/universe', `the world’s card is cleared from the panel (${after.hash})`);
  check(Boolean(await page.$('.universe-panel .universe-title')), 'the panel’s back to the map’s own');
  await page.waitForTimeout(2500);
  await shot(page, '4-after-jump');

  // straight away again: the hyperdrive's charging, so it goes at super speed
  // (as if it had only just jumped: here the frames are slow enough for it to charge meanwhile)
  await page.evaluate(() => (window.__universeDebug.state.hyperAt = performance.now() / 1000 + 60)); // (a minute to go: the frames here are slow)
  await page.keyboard.press('m');
  await navOpen(page);
  await page.waitForTimeout(600);
  const status = await page.textContent('.navmap-status');
  check(new RegExp(`At ${goal}`).test(status) && /charging/.test(status), `the map says where you are and that the drive's charging (${status.replace(/\s+/g, ' ').trim()})`);
  await pickByName(page, 'Aurelia');
  await page.waitForTimeout(800);
  check(Boolean(await page.$('.navmap-note')) && (await page.textContent('.navmap-go')).includes('Race to Aurelia'), 'with the drive charging, it says so and goes at super speed');
  await shot(page, '5-charging');
  await click(page, '.navmap-go');
  await page.waitForTimeout(4000);
  const going = await state(page);
  check(going.auto === 'aurelia', `still on its way out to Aurelia with the selection cleared (${going.auto})`);
  await shot(page, '6-super-to-aurelia');

  // the home system, and Escape
  await page.keyboard.press('m');
  await navOpen(page);
  await click(page, '.navmap-views button', 1);
  await page.waitForTimeout(500);
  await shot(page, '7-home-system');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  check((await page.$('.navmap')) === null, 'Escape closes the map');
  await page.context().close();
}

if (run('phone')) {
  const page = await open({ width: 390, height: 844 }, 'xwing');
  await shot(page, '8-phone-map');
  const btn = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const b = r('.universe-navmap-btn');
    const others = ['.universe-settings-btn', '.universe-hangar-btn', '.online-pill, [class*="online"] button'].map(r).filter(Boolean);
    return { b: b && { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom, w: window.innerWidth }, hits: others.filter((o) => b && o.left < b.right && b.left < o.right && o.top < b.bottom && b.top < o.bottom).length };
  });
  check(btn.b && btn.b.x1 <= btn.b.w && btn.hits === 0, 'the map button fits on a phone, clear of the settings, the hangar and the pilots');
  await click(page, '.universe-navmap-btn');
  await navOpen(page);
  await page.waitForTimeout(800);
  await shot(page, '9-phone-navmap');
  // the list first: every place a row a finger can take, the frame on the screen
  const list = await page.evaluate(() => {
    const f = document.querySelector('.navmap-frame').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.navmap-list button')].map((b) => b.getBoundingClientRect().height);
    return { mode: document.querySelector('.navmap').dataset.mode, frame: f.right <= window.innerWidth + 1 && f.bottom <= window.innerHeight + 1, chart: Boolean(document.querySelector('.navmap-chart').offsetParent), rows: rows.length, low: Math.min(...rows) };
  });
  check(list.mode === 'list' && list.frame && !list.chart && list.low >= 44, `on a phone it opens on the list, every row 44 px or more (${JSON.stringify(list)})`);
  // a place picked from it: its go button on the screen, however far down the card goes
  await pickByName(page, 'Earth');
  await page.waitForTimeout(1500);
  const inView = () =>
    page.evaluate(() => {
      const b = document.querySelector('.navmap-go').getBoundingClientRect();
      return b.top >= 0 && b.bottom <= window.innerHeight;
    });
  check(await inView(), 'the go button’s on the screen');
  await shot(page, '10-phone-picked');
  // the chart, a tap away: over the panel, its names clear of each other and of its edge
  await page.evaluate(() => [...document.querySelectorAll('.navmap-modes button')].find((b) => b.textContent.includes('Chart'))?.click());
  await page.waitForTimeout(1200);
  const chart = await page.evaluate(() => {
    const c = document.querySelector('.navmap-chart').getBoundingClientRect();
    const s = document.querySelector('.navmap-side').getBoundingClientRect();
    return { chart: c.width > 300, side: s.top >= c.bottom - 1 && s.bottom <= window.innerHeight + 1 };
  });
  check(chart.chart && chart.side, `the chart sits over the panel, all on the screen (${JSON.stringify(chart)})`);
  const phoneClash = await page.evaluate(namesClash);
  check(!phoneClash, `on a phone too, no two names meet${phoneClash ? ` (${phoneClash})` : ''}`);
  check(await inView(), 'with the chart up, the go button’s still on the screen');
  await shot(page, '11-phone-chart');
  // the chart's tools to a finger (Chromium won't emulate a coarse pointer: its rules, with the query off)
  await page.evaluate(() => {
    const css = [];
    for (const sheet of document.styleSheets) {
      let rules = [];
      try {
        rules = [...sheet.cssRules];
      } catch {
        continue;
      }
      for (const r of rules) if (r.cssText.includes('pointer: coarse') && r.cssText.includes('navmap-tool')) css.push(r.cssText.replaceAll('(pointer: coarse)', '(min-width: 0px)'));
    }
    const el = document.createElement('style');
    el.textContent = css.join('\n');
    document.head.append(el);
  });
  await page.waitForTimeout(300);
  const fit = await page.evaluate(() => {
    const f = document.querySelector('.navmap-frame').getBoundingClientRect();
    const r = document.querySelector('.navmap-readout').getBoundingClientRect();
    const tools = [...document.querySelectorAll('.navmap-tools button')].map((b) => b.getBoundingClientRect());
    const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    return {
      big: tools.every((t) => t.width >= 44 && t.height >= 44),
      inside: tools.every((t) => t.left >= f.left && t.right <= f.right && t.bottom <= f.bottom),
      apart: tools.every((t, i) => tools.every((u, j) => i === j || !meet(t, u))) && tools.every((t) => !meet(t, r)),
      readout: r.width > 0 && r.height > 0,
    };
  });
  check(fit.big && fit.inside && fit.apart && fit.readout, `on a phone, the chart’s tools are 44 px, on the frame, clear of each other and of the readout (${JSON.stringify(fit)})`);
  const scrolls = await page.evaluate(() => {
    const s = document.querySelector('.navmap-side');
    if (s.scrollHeight <= s.clientHeight) return true;
    s.scrollTop = 200;
    return s.scrollTop > 0;
  });
  check(scrolls, 'the side panel scrolls');
  const before = await page.$eval('.navmap-chart', (e) => e.dataset.level);
  let taps = 0;
  while ((await page.$eval('.navmap-chart', (e) => e.dataset.level)) === before && taps++ < 10) {
    await page.tap('.navmap-tools button[aria-label="Zoom in"]');
    await page.waitForTimeout(500);
  }
  check((await page.$eval('.navmap-chart', (e) => e.dataset.level)) !== before, `tapping Zoom in zooms the chart in to a system (${taps} taps)`);
  await shot(page, '17-phone-zoomed');
  // turned on its side, the frame, the chart, its bar and the side panel's top stay on the screen
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1200);
  const side = await page.evaluate(() => {
    const on = (s) => {
      const b = document.querySelector(s)?.getBoundingClientRect();
      return Boolean(b) && b.left >= -1 && b.top >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1;
    };
    const top = document.querySelector('.navmap-side').getBoundingClientRect();
    return { frame: on('.navmap-frame'), chart: on('.navmap-chart'), bar: on('.navmap-bar'), side: top.top >= 0 && top.top < window.innerHeight };
  });
  check(Object.values(side).every(Boolean), `turned on its side, all of the chart is on the screen (${JSON.stringify(side)})`);
  await shot(page, '18-phone-sideways');
  await page.context().close();
}

// with 3D off: the flat map is the whole map; and Home's teaser
if (run('minimap')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-3d', 'off'); // (raw, not JSON: lib/gpu.js)
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/#/universe`, { waitUntil: 'domcontentloaded' });
  const flat = await page.waitForSelector('.universe-flat .minimap', { timeout: 120000 });
  await flat.screenshot({ path: `${out}/12-minimap-flat.png` });
  const has = await page.evaluate(() => ['aurelia', 'veil', 'squanch'].map((id) => Boolean(document.querySelector(`.universe-flat li[data-id="${id}"]`))));
  if (has.length) {
    check(has.every(Boolean), `the flat map has the wonders and the Curve’s worlds (${has})`);
    check(!(await page.$('.minimap-orbit')), 'and no orbit rings that match nothing');
    const lv = () => page.$eval('.universe-flat .minimap', (e) => e.dataset.level);
    const was = await lv();
    await page.focus('.universe-flat .minimap-hit[tabindex="0"]');
    for (let i = 0; i < 6 && (await lv()) === was; i++) {
      await page.keyboard.press('+');
      await page.waitForTimeout(400);
    }
    check((await lv()) !== was, `+ zooms the flat map (${was} → ${await lv()})`);
  }
  await page.goto(`${BASE}/#/home`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main', { timeout: 60000 });
  let teaser = null;
  for (let i = 0; i < 40 && !teaser; i++) {
    await page.mouse.wheel(0, 900);
    teaser = await page.waitForSelector('.minimap-teaser', { timeout: 500 }).catch(() => null);
  }
  check(Boolean(teaser), 'Home’s teaser map is there');
  if (teaser) {
    await teaser.scrollIntoViewIfNeeded();
    await teaser.screenshot({ path: `${out}/13-minimap-teaser.png` });
    const others = await page.evaluate(() => [...document.querySelectorAll('.minimap-teaser li[data-id]')].map((li) => li.dataset.id).filter((id) => ['aurelia', 'veil', 'home', 'squanch'].includes(id)));
    check(!others.length, `the teaser keeps to the worlds (${others})`);
  }
  await ctx.close();
}

// the ship far out in the Expanse, two sectors and more from home
if (run('far')) {
  const page = await open({ width: 1440, height: 900 }, 'falcon');
  await page.evaluate(() => {
    const s = window.__universeDebug.state;
    s.ship = { ...s.ship, x: 250000, y: 1000, z: 0, speed: 0 };
  });
  await page.waitForFunction(() => window.__universe().ship?.x > 200000, null, { timeout: 60000 });
  await page.keyboard.press('m');
  await navOpen(page);
  await page.waitForTimeout(800);
  await shot(page, '14-far-ship');
  const far = await shipOnChart(page);
  const at = (await state(page)).ship;
  check(far.drawn && far.inside, `the ship is on the chart, far out (${JSON.stringify(far)})`);
  check(far.readout?.startsWith(sectorWords(at)) && Math.round(at.x / 120000) >= 2, `its sector, two and more out (${far.readout})`);
  // dragged off it, it stays on the chart, pinned to the rim
  const c = await page.$eval('.navmap-chart', (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  for (let i = 0; i < 3 && !(await page.$('.navmap-ship[data-edge]')); i++) {
    await page.mouse.move(c.x + 200, c.y);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(c.x + 200 - k * 50, c.y);
    await page.mouse.up();
    await page.waitForTimeout(600);
  }
  const pinned = await shipOnChart(page);
  check(pinned.edge && pinned.inside, `dragged away, the ship is pinned to the chart’s rim (${JSON.stringify(pinned)})`);
  await shot(page, '16-far-ship-pinned');
  await page.context().close();
}

console.log(errors.length ? `page errors: ${JSON.stringify(errors.slice(0, 8))}` : 'no page errors');
console.log(problems.length ? `${problems.length} FAILED` : 'all ok');
await browser.close();
process.exit(problems.length ? 1 : 0);
