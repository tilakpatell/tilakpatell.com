/* global window, document */
// A browser check of the universe nav map (NavMap.jsx). With the dev server
// up (npx vite --port 5173) and Chrome at $CHROME (or /opt/google/chrome):
//   OUT=/tmp/shots node scripts/navmap-check.mjs [desktop|phone]
// It opens the map, checks the labels and the go button, jumps to a wonder
// (the ship has to be out under the site's jump, which clears the world's
// card from the panel), tries a second jump while the hyperdrive charges,
// flies out to a wonder at super speed with the selection cleared under it,
// then the phone layout: the list first, the chart a tap away, its names
// clear of each other. Screenshots go to $OUT. Headless Chrome draws in
// software, slowly: clicks go through the DOM, and the waits are long.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const only = process.argv[2];
const URL = 'http://localhost:5173/?quality=low#/universe';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/google/chrome/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
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

if (only !== 'phone') {
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
  // a jump to the Citadel (or Ember, if the ship started out by the Citadel), timed on the wall clock
  const start = (await state(page)).ship;
  const [goal, gx, gz] = Math.hypot(start.x - 1755, start.z + 4660) < 600 ? ['Ember', 1080, 4320] : ['The Citadel', 1755, -4660];
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
  // from the Citadel. Software GL is slow, so what's checked is that it's out
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

if (only !== 'desktop') {
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
  await page.context().close();
}

console.log(errors.length ? `page errors: ${JSON.stringify(errors.slice(0, 8))}` : 'no page errors');
console.log(problems.length ? `${problems.length} FAILED` : 'all ok');
await browser.close();
process.exit(problems.length ? 1 : 0);
