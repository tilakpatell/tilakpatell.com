/* global window, document */
// A browser check of the universe nav map (NavMap.jsx). With the dev server
// up (npx vite --port 5173) and Chrome at $CHROME (or /opt/google/chrome):
//   OUT=/tmp/shots [BASE=http://localhost:5173] node scripts/navmap-check.mjs [desktop|phone|minimap|far]
// BASE is where the dev server is. A mode alone takes just its own shots; none runs all four.
// It opens the map, checks the chart (centred on the ship, its sector and
// level, no two names on each other, the wheel, typing in the search, a drag
// from a name, Shift-drag), the labels and the go button, jumps to a wonder
// picked by name (the ship has to be out under the site's jump, which clears
// the world's card from the panel), tries a second jump while the hyperdrive
// charges, flies out to a wonder at super speed with the selection cleared
// under it, then the phone layout (and the phone on its side), the flat
// mini-map and the home teaser, and the ship far out, pinned to the rim.
// Screenshots go to $OUT. Headless Chrome draws in software, slowly: clicks
// go through the DOM, and the waits are long and on what they wait for.
import { chromium } from 'playwright-core';
import { sectorAt } from '../src/lib/space/address.js';
import { shipMarker, shipOnChart } from './lib/navmap.mjs';

const out = process.env.OUT ?? '.';
const only = process.argv[2];
const BASE = process.env.BASE ?? 'http://localhost:5173';
const URL = `${BASE}/?quality=low#/universe`;
const run = (m) => !only || only === m;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/google/chrome/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
// (something seen and worth saying, that isn't a pass or a fail)
const note = (what) => console.log('note', what);

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
  await page.waitForTimeout(2000);
  await page.waitForSelector('.universe-navmap-btn', { state: 'attached', timeout: 120000 });
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
const pickByName = (page, name) => page.evaluate((n) => [...document.querySelectorAll('.navmap-list button')].find((b) => b.textContent.includes(n))?.click(), name);

// the chart: its level, and what it says the ship's sector is (the minus as the chart writes it)
const level = (page, sel = '.navmap-chart') => page.$eval(sel, (c) => c.dataset.level);
const sectorWords = (s) => `Sector ${sectorAt(s.x, s.y ?? 0, s.z).map((n) => String(n).replace('-', '−')).join(', ')} · `;
// (a few frames drawn: what a click or a key set is on the screen by then)
const frames = (page, n = 2) => page.evaluate((k) => new Promise((done) => (function step(i) { return i ? window.requestAnimationFrame(() => step(i - 1)) : done(); })(k)), n);
// what an attribute reads across every match of a selector, and a wait till that changes: a zoom
// changes every range ring's rx on the nav map and the belt's points on the mini-map
const attrs = (page, sel, attr) => page.evaluate(([s, a]) => [...document.querySelectorAll(s)].map((e) => e.getAttribute(a)).join(' '), [sel, attr]);
const changes = (page, sel, attr, was) =>
  page
    .waitForFunction(([s, a, w]) => [...document.querySelectorAll(s)].map((e) => e.getAttribute(a)).join(' ') !== w, [sel, attr, was], { timeout: 30000 })
    .then(() => true, () => false);
const RINGS = ['.navmap-chart .navmap-ring', 'rx'];
// press (a key, a wheel's turn, a tap) till the chart's level is `want`, at most `most` times, each waiting for the zoom
async function zoomTill(page, press, want, { sel = '.navmap-chart', sig = RINGS, most = 12 } = {}) {
  let n = 0;
  while ((await level(page, sel)) !== want && n < most) {
    const was = await attrs(page, ...sig);
    await press();
    n += 1;
    if (!(await changes(page, ...sig, was))) break;
  }
  return { n, level: await level(page, sel) };
}
// a press and a drag by (dx, dy) in `steps` moves, from (x, y); `clickCount` 2 is a double press's second
async function drag(page, [x, y], [dx, dy], { steps = 8, clickCount = 1 } = {}) {
  await page.mouse.move(x, y);
  await page.mouse.down({ clickCount });
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up({ clickCount });
}
// a place's button on the chart that a drag of `dx` from its dot keeps on the chart: its dot (where its li
// sits), the button the very top thing there
const placeToDrag = (page, dx) =>
  page.evaluate((d) => {
    const c = document.querySelector('.navmap-chart').getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    const r = c.width / 2;
    for (const li of document.querySelectorAll('.navmap-places > li[data-id]:not([data-dim])')) {
      const b = li.querySelector('button.navmap-place[aria-pressed]');
      if (!b) continue;
      const { left: x, top: y } = li.getBoundingClientRect();
      if (Math.hypot(x - cx, y - cy) > r - 40 || Math.hypot(x + d - cx, y - cy) > r - 40) continue;
      if (Math.hypot(x - cx, y - cy) < 30) continue; // (not on the ship's own marker)
      if (!b.contains(document.elementFromPoint(x, y))) continue;
      return { id: li.dataset.id, x, y };
    }
    return null;
  }, dx);
const pressedOf = (page, id) => page.getAttribute(`.navmap-places > li[data-id="${id}"] button.navmap-place`, 'aria-pressed');
const trip = async (page) => {
  const s = await state(page);
  return `${s.auto ?? '-'}/${s.jump?.id ?? '-'}`;
};
const tool = (page, name) => page.locator(`.navmap-tools button[aria-label="${name}"]`);
// the ship's marker at a spot (px from the chart's middle), waited for: on the next commits after a drag or a click
const shipNear = (page, [dx, dy], within) =>
  page
    .waitForFunction(
      ([x, y, w]) => {
        const c = document.querySelector('.navmap-chart')?.getBoundingClientRect();
        const m = document.querySelector('.navmap-chart .navmap-ship')?.getScreenCTM();
        return c && m && Math.hypot(m.e - (c.left + c.width / 2 + x), m.f - (c.top + c.height / 2 + y)) <= w;
      },
      [dx, dy, within],
      { timeout: 30000 },
    )
    .then(() => true, () => false);
const off = (at, [dx, dy] = [0, 0]) => Math.hypot(at.x - (at.cx + dx), at.y - (at.cy + dy));

// The chart's own steps on the desktop: opening on the ship, the names, the
// wheel, the search's keys, a drag from a name, Shift-drag.
async function chartSteps(page) {
  // on open: the ship in the middle, the chart's level by where it is, its sector under the circle
  const ship = (await state(page)).ship;
  const inCurve = await page.evaluate(async (s) => (await import('/src/components/universe/layout.js')).mapSectorOf(s.x, s.y ?? 0, s.z) === 'rickmorty', ship);
  const at = await shipMarker(page);
  check(at.drawn && off(at) <= 3, `the chart opens on the ship, in its middle (${off(at).toFixed(1)} px off)`);
  const lv = await level(page);
  check(lv === (inCurve ? 'system' : 'neighbourhood'), `it opens on the ${inCurve ? 'system' : 'neighbourhood'} level (${lv})`);
  check(at.readout?.startsWith(sectorWords(ship)), `the bar says the ship’s sector (“${at.readout}”, for ${sectorWords(ship).trim()})`);

  // no two names on each other
  const meet = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.navmap-chart .navmap-name')].map((n) => ({ t: n.textContent, b: n.getBoundingClientRect() })).filter((n) => n.b.width > 0);
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const pairs = [];
    names.forEach((a, i) => names.slice(i + 1).forEach((b) => hit(a.b, b.b) && pairs.push(`${a.t} / ${b.t}`)));
    return { n: names.length, pairs };
  });
  check(meet.n > 0 && meet.pairs.length === 0, `no two of the ${meet.n} names on the chart meet${meet.pairs.length ? ` (${meet.pairs.join('; ')})` : ''}`);

  // the wheel zooms in about the middle, to a system
  const c = await shipMarker(page);
  await page.mouse.move(c.cx, c.cy);
  const wheel = await zoomTill(page, () => page.mouse.wheel(0, -400), 'system');
  check(wheel.level === 'system', `the wheel zooms in to a system (${wheel.n} turns, ${wheel.level})`);

  // typing in the search: − and 0 are the field's, not the chart's (one − would take it back out of the system)
  const before = { level: await level(page), rings: await attrs(page, ...RINGS), at: await shipMarker(page) };
  await page.focus('.navmap-search input');
  await page.keyboard.type('-0');
  await page.waitForFunction(() => document.querySelector('.navmap-search input')?.value === '-0', null, { timeout: 30000 }).catch(() => null);
  await frames(page);
  const typed = { value: await page.inputValue('.navmap-search input'), level: await level(page), rings: await attrs(page, ...RINGS), at: await shipMarker(page) };
  check(typed.value.includes('-') && typed.value.includes('0'), `typed into “Find a place…”, − and 0 go into the field (“${typed.value}”)`);
  check(typed.level === before.level && typed.rings === before.rings, `typing − and 0 doesn’t zoom (${before.level} → ${typed.level})`);
  check(Math.hypot(typed.at.x - before.at.x, typed.at.y - before.at.y) <= 1, 'typing 0 doesn’t move the ship on the chart');
  await page.fill('.navmap-search input', '');
  await page.focus('.navmap-close');

  // − (the key) back out to the neighbourhood
  const minus = await zoomTill(page, () => page.keyboard.press('-'), 'neighbourhood');
  check(minus.level === 'neighbourhood', `− zooms back out to the neighbourhood (${minus.n} presses, ${minus.level})`);

  // a drag that starts on a name pans the chart with the hand: never a pick, never a trip
  const from = await placeToDrag(page, 120);
  check(Boolean(from), `a place’s name to drag from (${from?.id})`);
  if (from) {
    const was = { pressed: await pressedOf(page, from.id), trip: await trip(page) };
    await drag(page, [from.x, from.y], [120, 0]);
    await shipNear(page, [120, 0], 6);
    const moved = await shipMarker(page);
    check(off(moved, [120, 0]) <= 6, `a drag of 120 px from ${from.id}’s name takes the ship 120 px right with the hand (${off(moved, [120, 0]).toFixed(1)} px off)`);
    check((await pressedOf(page, from.id)) === was.pressed && (await trip(page)) === was.trip, `the drag doesn’t pick ${from.id} or send the ship (pressed ${was.pressed}, trip ${await trip(page)})`);
    // two quick drags from the same name: a double press, and still no trip
    const again = await placeToDrag(page, 40);
    if (again) {
      const was2 = { pressed: await pressedOf(page, again.id), trip: await trip(page) };
      await drag(page, [again.x, again.y], [40, 0], { steps: 2 });
      const twice = await page.evaluate((id) => {
        const li = document.querySelector(`.navmap-places > li[data-id="${id}"]`);
        const b = li?.getBoundingClientRect();
        return b && { x: b.left, y: b.top };
      }, again.id);
      if (twice) await drag(page, [twice.x, twice.y], [40, 0], { steps: 2, clickCount: 2 });
      await frames(page);
      check(Boolean(twice) && (await pressedOf(page, again.id)) === was2.pressed && (await trip(page)) === was2.trip, `a double press dragged from ${again.id}’s name doesn’t pick it or send the ship (trip ${await trip(page)})`);
    } else note('no name left on the chart for the double-press drag');
    const back = tool(page, 'Back to the ship');
    check((await back.getAttribute('aria-disabled')) === null, '“Back to the ship” is on once the chart’s been moved');
    await back.click({ timeout: 60000 });
    await shipNear(page, [0, 0], 3);
    const home = await shipMarker(page);
    check(off(home) <= 3, `“Back to the ship” puts it back in the middle (${off(home).toFixed(1)} px off)`);
  }

  // Shift-drag tilts the chart; “Look straight down” lays it flat again
  const m = await shipMarker(page);
  await page.keyboard.down('Shift');
  await drag(page, [m.cx, m.cy + 60], [0, -120]);
  await page.keyboard.up('Shift');
  await page.waitForSelector('.navmap-chart[data-pitched]', { state: 'attached', timeout: 30000 }).catch(() => null);
  const flat = tool(page, 'Look straight down');
  check(Boolean(await page.$('.navmap-chart[data-pitched]')) && (await flat.getAttribute('aria-disabled')) === null, 'a Shift-drag of 120 px up tilts the chart, and “Look straight down” is on');
  await shot(page, '15-tilted');
  await flat.click({ timeout: 60000 });
  await page.waitForSelector('.navmap-chart:not([data-pitched])', { state: 'attached', timeout: 30000 }).catch(() => null);
  check(!(await page.$('.navmap-chart[data-pitched]')), '“Look straight down” lays it flat');
}

// what a touch screen gets from the chart tools' (pointer: coarse) rules: the same rules with their media
// query off, as Chromium won't emulate the pointer (galaxy-map-check/lib.mjs's asTouch, for the nav map)
const asTouch = (page, needle) =>
  page.evaluate((n) => {
    const css = [];
    for (const sheet of document.styleSheets) {
      let rules = [];
      try {
        rules = [...sheet.cssRules];
      } catch {
        continue; // (a sheet from another origin)
      }
      for (const r of rules) if (r.cssText.includes('pointer: coarse') && r.cssText.includes(n)) css.push(r.cssText.replaceAll('(pointer: coarse)', '(min-width: 0px)'));
    }
    const el = document.createElement('style');
    el.textContent = css.join('\n');
    document.head.append(el);
    return css.length;
  }, needle);

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
  // the list isn't squashed under the key hints
  const squashed = await page.evaluate(() => {
    const keys = document.querySelector('.navmap-keys')?.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.navmap-list li')].map((li) => li.getBoundingClientRect());
    return Boolean(keys && keys.height && rows.some((r) => r.bottom > keys.top + 1 && r.top < keys.bottom - 1));
  });
  check(!squashed, 'the place list doesn’t run under the key hints');
  await chartSteps(page);

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
  // a jump to a main-sector wonder picked by name (the first the ship didn't start by), timed on the wall clock
  const start = (await state(page)).ship;
  const wonders = await page.evaluate(() => window.__universeDebug.wonders);
  const gap = (s, w) => Math.hypot(s.x - w.at[0], (s.y ?? 0) - w.at[1], s.z - w.at[2]);
  const wonder = ['Ember', 'Halcyon'].map((n) => wonders.find((w) => w.name === n)).find((w) => w && gap(start, w) > w.reach + 600);
  if (!wonder) throw new Error(`no wonder to jump to (${JSON.stringify(wonders.map((w) => w.name))})`);
  const goal = wonder.name;
  const near = wonder.reach + 600; // (out at it: the jump parks the ship just past its reach)
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
    ([[x, y, z], n]) => {
      window.__jumpLog = [];
      const tick = () => {
        const s = window.__universeDebug.state;
        const d = s.ship ? Math.hypot(s.ship.x - x, s.ship.y - y, s.ship.z - z) : null;
        window.__jumpLog.push([performance.now() / 1000, s.jump?.at ?? null, d, d !== null && d < n]);
        if (window.__jumpLog.length < 3000) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    },
    [wonder.at, near],
  );
  await click(page, '.navmap-go');
  let overlay = false;
  for (let i = 0; i < 80; i++) {
    overlay ||= await page.evaluate(() => Boolean(document.querySelector('.hyperspace-canvas, canvas[class*="hyper"]')));
    const s = await state(page);
    if (s.ship && gap(s.ship, wonder) < near) break;
    if (i === 2) await shot(page, '3-jumping');
    await page.waitForTimeout(250);
  }
  check(overlay, 'the site’s jump plays over the map');
  const timing = await page.evaluate(() => {
    const log = window.__jumpLog;
    const due = log.find((r) => r[1] !== null)?.[1];
    const i = log.findIndex((r) => r[3]);
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
  // (a phone's coarse pointer: the chart tools at 44 px)
  const coarse = await asTouch(page, '.navmap-tool');
  await page.waitForTimeout(800);
  await shot(page, '9-phone-navmap');
  const fits = await page.evaluate(() => {
    const f = document.querySelector('.navmap-frame').getBoundingClientRect();
    const c = document.querySelector('.navmap-chart').getBoundingClientRect();
    const s = document.querySelector('.navmap-side').getBoundingClientRect();
    return { frame: f.right <= window.innerWidth + 1 && f.bottom <= window.innerHeight + 1, chart: c.width > 200, side: s.height > 150 && s.top >= c.bottom - 1 };
  });
  check(fits.frame && fits.chart && fits.side, `on a phone the chart sits over the list, all on the screen (${JSON.stringify(fits)})`);
  await pickByName(page, 'Earth');
  await page.waitForTimeout(1500);
  await shot(page, '10-phone-picked');
  await click(page, '.navmap-back');
  await page.waitForSelector('.navmap-list', { timeout: 30000 });

  // the bar under the chart: its tools a thumb's size, clear of each other and of the readout
  const bar = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const frame = r(document.querySelector('.navmap-frame'));
    const ro = document.querySelector('.navmap-readout');
    const rb = ro && r(ro);
    const bs = [...document.querySelectorAll('.navmap-tools button')].map(r);
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return {
      sizes: bs.map((b) => `${Math.round(b.width)}×${Math.round(b.height)}`).join(' '),
      big: bs.length > 0 && bs.every((b) => b.width >= 43.99 && b.height >= 43.99),
      inside: bs.every((b) => b.left >= frame.left && b.right <= frame.right && b.top >= frame.top && b.bottom <= frame.bottom),
      apart: bs.every((a, i) => bs.every((b, j) => i === j || !hit(a, b))),
      clear: Boolean(rb) && bs.every((b) => !hit(b, rb)),
      readout: Boolean(rb && rb.width > 0 && rb.height > 0 && rb.top >= 0 && rb.bottom <= window.innerHeight && window.getComputedStyle(ro).visibility === 'visible'),
      text: ro?.textContent ?? null,
    };
  });
  check(coarse > 0 && bar.big, `each chart tool is at least 44 × 44 on a touch screen (${bar.sizes}; ${coarse} coarse rules)`);
  check(bar.inside && bar.apart && bar.clear, `the tools are inside the frame, clear of each other and of the readout (${JSON.stringify({ inside: bar.inside, apart: bar.apart, clear: bar.clear })})`);
  check(bar.readout, `the readout shows under the chart (“${bar.text}”)`);
  // the side panel scrolls
  const scroll = await page.evaluate(() => {
    const s = document.querySelector('.navmap-side');
    const can = s.scrollHeight > s.clientHeight;
    s.scrollTop = 200;
    const top = s.scrollTop;
    s.scrollTop = 0;
    return { can, top, h: s.clientHeight, all: s.scrollHeight };
  });
  check(!scroll.can || scroll.top > 0, `the side panel scrolls (${scroll.all} px in ${scroll.h}, scrolled to ${scroll.top})`);
  // a wonder's name is off the phone's chart till it's picked from the list
  const wonder = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.navmap-places > li[data-kind="wonder"]')].find((l) => l.querySelector('.navmap-place[aria-label]'));
    const shown = [...document.querySelectorAll('.navmap-places > li[data-kind="wonder"] .navmap-name')].filter((n) => n.getBoundingClientRect().width > 0).length;
    return li && { id: li.dataset.id, name: li.querySelector('.navmap-place').getAttribute('aria-label').split(',')[0], shown };
  });
  check(Boolean(wonder) && wonder.shown === 0, `the wonders on the phone’s chart have no names showing (${wonder?.shown ?? 'no wonder on the chart'})`);
  if (wonder) {
    await pickByName(page, wonder.name);
    const named = await page
      .waitForFunction((id) => document.querySelector(`.navmap-places > li[data-id="${id}"] .navmap-name`)?.getBoundingClientRect().width > 0, wonder.id, { timeout: 30000 })
      .then(() => true, () => false);
    const others = await page.evaluate((id) => [...document.querySelectorAll(`.navmap-places > li[data-kind="wonder"]:not([data-id="${id}"]) .navmap-name`)].filter((n) => n.getBoundingClientRect().width > 0).length, wonder.id);
    check(named && others === 0, `picked from the list, ${wonder.name}’s name shows, and only its (${others} others)`);
  }
  // a tap on zoom in zooms
  const was = await level(page);
  const tapped = await zoomTill(page, () => tool(page, 'Zoom in').tap({ timeout: 60000 }), was === 'system' ? 'neighbourhood' : 'system');
  check(tapped.level !== was, `tapping zoom in changes the chart’s level (${was} → ${tapped.level}, ${tapped.n} taps)`);
  await shot(page, '14-phone-zoomed');

  // the phone on its side, the map still open: everything on the screen
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.innerWidth === 844 && window.innerHeight === 390, null, { timeout: 30000 });
  await frames(page);
  const side = await page.evaluate(() => {
    const [w, h] = [window.innerWidth, window.innerHeight];
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const on = (b) => Boolean(b && b.width > 0 && b.height > 0 && b.left >= -1 && b.top >= -1 && b.right <= w + 1 && b.bottom <= h + 1);
    const s = r('.navmap-side');
    const fmt = (b) => b && [b.left, b.top, b.right, b.bottom].map(Math.round).join(',');
    return { frame: on(r('.navmap-frame')), chart: on(r('.navmap-chart')), bar: on(r('.navmap-bar')), top: Boolean(s && s.top >= -1 && s.top < h && s.left >= -1 && s.right <= w + 1), boxes: ['.navmap-frame', '.navmap-chart', '.navmap-bar', '.navmap-side'].map((q) => `${q} ${fmt(r(q))}`).join('; ') };
  });
  check(side.frame && side.chart && side.bar && side.top, `on its side (844 × 390) the frame, the chart, its bar and the side panel’s top are on the screen (${side.boxes})`);
  await shot(page, '17-phone-sideways');
  await page.context().close();
}

if (run('minimap')) {
  // the flat map (3D off) and the home page's teaser: no __universe here, so no open()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-3d', 'off');
    window.localStorage.setItem('tp-intro', '1');
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const flat = await page.waitForSelector('.universe-flat .minimap', { timeout: 120000 });
  await flat.screenshot({ path: `${out}/11-minimap-flat.png`, timeout: 120000 });
  // the chart's marks: a wonder, a nebula and a moon on it, and no orbit rings
  const on = await page.evaluate(() => {
    const m = document.querySelector('.universe-flat .minimap');
    return { ids: ['aurelia', 'veil', 'squanch'].filter((id) => m.querySelector(`[data-id="${id}"]`)), orbits: m.querySelectorAll('.minimap-orbit').length };
  });
  check(on.ids.length === 3 && on.orbits === 0, `the flat map has Aurelia, the Veil and the Squanch moon, and no orbit rings (${on.ids.join(', ')}; ${on.orbits} rings)`);
  // what sits under the tools row (bottom right)
  const under = await page.evaluate(() => {
    const m = document.querySelector('.universe-flat .minimap');
    const t = m.querySelector('.minimap-tools')?.getBoundingClientRect();
    if (!t) return null;
    return [...m.querySelectorAll('.minimap-item')].filter((li) => {
      const b = li.querySelector('.minimap-hit').getBoundingClientRect();
      return b.width > 0 && b.left < t.right && t.left < b.right && b.top < t.bottom && t.top < b.bottom;
    }).map((li) => li.dataset.id);
  });
  note(`the flat map’s tools row (bottom right) is over ${under?.length ? under.join(', ') : 'no place'}`);
  // + with the focus on a place zooms it (the place nearest the middle, which stays on as it zooms)
  const focusMiddle = () =>
    page.evaluate(() => {
      const m = document.querySelector('.universe-flat .minimap');
      if (m.contains(document.activeElement) && document.activeElement !== m) return;
      const b = m.getBoundingClientRect();
      const [cx, cy] = [b.left + b.width / 2, b.top + (b.height * 142) / 300];
      const lis = [...m.querySelectorAll('.minimap-item')].sort((p, q) => {
        const d = (li) => Math.hypot(li.getBoundingClientRect().left - cx, li.getBoundingClientRect().top - cy);
        return d(p) - d(q);
      });
      lis[0]?.querySelector('.minimap-hit')?.focus();
    });
  const flatLevel = await level(page, '.universe-flat .minimap');
  const plus = await zoomTill(
    page,
    async () => {
      await focusMiddle();
      await page.keyboard.press('+');
    },
    flatLevel === 'system' ? 'neighbourhood' : 'system',
    { sel: '.universe-flat .minimap', sig: ['.universe-flat .minimap-svg polyline', 'points'] },
  );
  check(plus.level !== flatLevel, `+ with the focus in the flat map zooms it (${flatLevel} → ${plus.level}, ${plus.n} presses)`);
  await page.evaluate(() => (window.location.hash = '#/home'));
  // the section mounts only when scrolled near, so scroll down a screen at a time until it's there
  await page.waitForFunction(
    () => {
      if (document.querySelector('.minimap-teaser')) return true;
      window.scrollBy(0, window.innerHeight * 0.8);
      return false;
    },
    null,
    { timeout: 120000, polling: 'raf' },
  );
  const teaser = await page.waitForSelector('.minimap-teaser', { timeout: 120000 });
  await teaser.scrollIntoViewIfNeeded();
  await teaser.screenshot({ path: `${out}/12-minimap-teaser.png`, timeout: 120000 });
  check(true, 'the flat mini-map and the home teaser both drew');
  const worlds = await page.evaluate(() => [...document.querySelectorAll('.minimap-teaser [data-id]')].map((e) => [e.dataset.id, e.dataset.kind]));
  const odd = worlds.filter(([, k]) => k !== 'world');
  check(worlds.length > 0 && odd.length === 0, `the teaser has only worlds (${worlds.length}${odd.length ? `; not: ${odd.map(([id]) => id).join(', ')}` : ''})`);
  await ctx.close();
}

if (run('far')) {
  const page = await open({ width: 1440, height: 900 }, 'falcon');
  await page.evaluate(() => {
    const d = window.__universeDebug.state;
    d.ship = { ...d.ship, x: 250000, y: 1000, z: 0, speed: 0 };
  });
  await page.waitForFunction(() => window.__universe().ship.x > 200000, null, { timeout: 120000 });
  await page.keyboard.press('m');
  await navOpen(page);
  await page.waitForFunction(() => document.querySelectorAll('.navmap-place').length > 0, null, { timeout: 60000 });
  await shot(page, '13-far-ship');
  const far = await shipOnChart(page);
  const ship = (await state(page)).ship;
  check(far.drawn && far.inside, `the ship far out is on the chart, inside its circle (${JSON.stringify({ drawn: far.drawn, inside: far.inside })})`);
  check(sectorAt(ship.x, ship.y, ship.z)[0] >= 2 && far.readout?.startsWith(sectorWords(ship)), `the bar says its sector (“${far.readout}”)`);
  // drag the chart away from it till the marker's pinned to the rim
  for (let i = 0; i < 3 && !(await page.$('.navmap-ship[data-edge]')); i++) {
    const c = await shipMarker(page);
    await drag(page, [c.cx + 200, c.cy], [-400, 0]);
    await page.waitForSelector('.navmap-ship[data-edge]', { state: 'attached', timeout: 30000 }).catch(() => null);
  }
  const pinned = await shipMarker(page);
  // (the arrow and its halo's widest ping, 16 × 1.6 chart units, all inside the circle)
  const whole = await page.evaluate(() => {
    const c = document.querySelector('.navmap-chart').getBoundingClientRect();
    const [cx, cy, r] = [c.left + c.width / 2, c.top + c.height / 2, c.width / 2];
    const g = document.querySelector('.navmap-chart .navmap-ship');
    const m = g.getScreenCTM();
    const b = g.querySelector('path').getBoundingClientRect();
    const corners = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]];
    const halo = 16 * 1.6 * Math.hypot(m.a, m.b);
    return { arrow: Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy))), halo: Math.hypot(m.e - cx, m.f - cy) + halo, r };
  });
  check(pinned.edge && pinned.inside, `dragged away, the ship’s marker is pinned to the rim, inside the circle (${off(pinned).toFixed(0)} of ${pinned.r.toFixed(0)} px out)`);
  check(whole.arrow <= whole.r && whole.halo <= whole.r, `the pinned marker’s arrow and halo are wholly in the circle (${whole.arrow.toFixed(0)} and ${whole.halo.toFixed(0)} of ${whole.r.toFixed(0)} px)`);
  await shot(page, '16-far-ship-pinned');
  await page.context().close();
}

console.log(errors.length ? `page errors: ${JSON.stringify(errors.slice(0, 8))}` : 'no page errors');
console.log(problems.length ? `${problems.length} FAILED` : 'all ok');
await browser.close();
process.exit(problems.length ? 1 : 0);
