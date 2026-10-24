/* global window, document */
// A browser check of the universe nav map (NavMap.jsx). With the dev server
// up (npx vite --port 5173) and Chrome at $CHROME (or /opt/google/chrome):
//   OUT=/tmp/shots node scripts/navmap-check.mjs [desktop|phone|minimap|far]
// (none of them for all four; BASE=http://127.0.0.1:5185 for a server on
// that address). It opens the map, checks the labels and the go button,
// then the chart: the ship in its middle, its sector in the readout, the
// wheel and the keys zooming it (never a minus typed in the search), a drag
// from a place's name moving it with the hand and picking nothing, Back to
// the ship, a Shift-drag tilting it and Look straight down. It jumps to a
// wonder picked by name (__universeDebug.wonders: the ship has to be out
// under the site's jump, which clears the world's card from the panel),
// tries a second jump while the hyperdrive charges, flies out to a wonder at
// super speed with the selection cleared under it, and fits a short window.
// Then the phone layout: the list first, the chart a tap away, its names
// clear of each other, its tools a finger's size, the panel's scroll, a
// wonder's name shown once it's picked, the zoom, and the phone turned
// sideways. `minimap` shoots the flat map (3D off), on a desktop and on a
// phone, and Home's teaser; on the desktop the wonders and moons are on it,
// a pointer that crosses a lesser place's button to a world's dot beside it
// must pick the world, and + zooms it; the phone's must name a place; `far`
// puts the ship two sectors out, shoots the map and drags the ship off it,
// pinned to the rim. Screenshots go to $OUT. Headless Chrome draws in
// software, slowly: clicks go through the DOM, and the waits are long.
import { chromium } from 'playwright-core';
import { jumpGoal, levelOnOpen, meet, sectorWords, shipOnChart, shipSector, within } from './lib/navmap.mjs';
import { keepShot } from './lib/shot-file.mjs';

const out = process.env.OUT ?? '.';
const only = process.argv[2];
const MODES = ['desktop', 'phone', 'minimap', 'far'];
if (only && !MODES.includes(only)) throw new Error(`no mode ${only}: ${MODES.join(', ')} or none for all`);
const run = (m) => !only || only === m;
const base = process.env.BASE ?? 'http://localhost:5173';
const URL = `${base}/?quality=low#/universe`;
// a page's first load: a cold dev server optimises its dependencies first,
// past Playwright's 30 s
const GOTO = 120000;
// (WebGL through ANGLE's SwiftShader: today's Chromium has none at all under --use-gl=swiftshader)
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/google/chrome/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
// (a console error with where it came from: a failed load's text is the same
// for every file, "Failed to load resource: … 403 (Forbidden)", and only its
// URL tells a font from a chunk)
const listen = (page) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} ${m.location().url}`.trim()));
};

async function open(viewport, ship) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
  await ctx.addInitScript((s) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-tour', '"done"'); // (no tour offer over the shots)
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
    window.localStorage.setItem('tp-universe-drive', '"super"');
  }, ship);
  const page = await ctx.newPage();
  listen(page);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: GOTO });
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
// a frame drawn since the page last changed: software GL takes seconds over
// one, and a shot sooner can show the page as it was before. Two minutes at
// most: a hidden or throttled page draws none, and the check would wait on it
// for ever (the wait looks every 100 ms, not on a frame of the page's own)
const painted = async (page) => {
  await page.evaluate(() => {
    window.__painted = false;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => (window.__painted = true)));
  });
  await page.waitForFunction(() => window.__painted, null, { polling: 100, timeout: 120000 }).catch((e) => {
    throw new Error(`no frame drawn in two minutes: is the page hidden or throttled? (${e.message.split('\n')[0]})`);
  });
};
// a PNG, or a JPEG if that's 1 MB or more (lib/shot-file.mjs: the folder
// made if need be, and no stale shot of the other kind left beside it), of
// the page or of one element on it
const shot = async (page, name, el = page) => {
  await painted(page);
  const png = await el.screenshot({ timeout: 120000 });
  await keepShot({ out, name, png, jpeg: () => el.screenshot({ type: 'jpeg', quality: 80, timeout: 120000 }) });
};
const state = (page) => page.evaluate(() => ({ ...window.__universe(), hash: window.location.hash }));
const navOpen = (page) => page.waitForSelector('.navmap', { timeout: 60000 });
// the names showing on the chart: two that meet, or one past its circle's
// edge (chart/place.js lays them out), in words; null for none
const namesClash = () => {
  const c = document.querySelector('.navmap-chart').getBoundingClientRect();
  const R = c.width / 2;
  // (a name with no room of its own shows only on a hover or a pick, over the rest on purpose)
  const names = [...document.querySelectorAll('.navmap-places .navmap-name')]
    .filter((n) => n.offsetParent)
    .map((n) => [n.textContent, n.getBoundingClientRect()])
    .filter(([, b]) => b.width > 0);
  for (const [t, b] of names) if ([b.left, b.right].some((x) => [b.top, b.bottom].some((y) => Math.hypot(x - c.left - R, y - c.top - R) > R + 1))) return `${t} past the edge`;
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [names[i][1], names[j][1]];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) return `${names[i][0]} on ${names[j][0]}`;
    }
  return null;
};
const pickByName = (page, name) => page.evaluate((n) => [...document.querySelectorAll('.navmap-list button')].find((b) => b.textContent.includes(n))?.click(), name);
// the chart as it's drawn: its circle's box and the ship marker's, its level,
// whether it's tilted, whether the ship's pinned to the rim, and the readout
const chartNow = (page) =>
  page.evaluate(() => {
    const r = (el) => {
      const b = el?.getBoundingClientRect();
      return b ? { left: b.left, top: b.top, width: b.width, height: b.height } : null;
    };
    const c = document.querySelector('.navmap-chart');
    const s = document.querySelector('.navmap-ship');
    return { chart: r(c), ship: r(s), level: c?.dataset.level ?? null, pitched: Boolean(c?.hasAttribute('data-pitched')), edge: Boolean(s?.hasAttribute('data-edge')), readout: document.querySelector('.navmap-readout')?.textContent ?? null };
  });
const mid = (b) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
// how far the ship's marker is from a point on the chart, given as px from its middle
const shipOff = (c, [dx, dy] = [0, 0]) => (c.ship && c.chart ? Math.hypot(mid(c.ship).x - mid(c.chart).x - dx, mid(c.ship).y - mid(c.chart).y - dy) : Infinity);
const px = (n) => (Number.isFinite(n) ? `${n.toFixed(1)} px` : 'no marker');
// a chart tool's aria-disabled ('true', or null for one that works), or 'missing'
const tool = (page, id) => page.evaluate((t) => document.querySelector(`.navmap-tools [data-tool="${t}"]`)?.getAttribute('aria-disabled') ?? (document.querySelector(`.navmap-tools [data-tool="${t}"]`) ? null : 'missing'), id);
const levelNow = (page) => page.evaluate(() => document.querySelector('.navmap-chart')?.dataset.level ?? null);
// a drag with the mouse, from one point to another in steps, then a frame
const drag = async (page, from, to, steps = 8) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps });
  await page.mouse.up();
  await painted(page);
};
// what a touch screen gets from the nav map's (pointer: coarse) rules: the
// same rules with their media query off, as Chromium won't emulate the
// pointer (galaxy-map-check/lib.mjs's asTouch does the same for its zoom)
const asTouch = (page) =>
  page.evaluate(() => {
    const css = [];
    for (const sheet of document.styleSheets) {
      let rules = [];
      try {
        rules = [...sheet.cssRules];
      } catch {
        continue; // (a sheet from another origin)
      }
      for (const r of rules) if (r.cssText.includes('pointer: coarse') && r.cssText.includes('.navmap')) css.push(r.cssText.replaceAll('(pointer: coarse)', '(min-width: 0px)'));
    }
    const el = document.createElement('style');
    el.textContent = css.join('\n');
    document.head.append(el);
    return css.length;
  });
// the boxes of the map's frame, body, stage, chart, bar, readout, side panel
// and each tool, and the window's size
const layout = (page) =>
  page.evaluate(() => {
    const r = (el) => {
      const b = el?.getBoundingClientRect();
      return b ? { left: b.left, top: b.top, width: b.width, height: b.height } : null;
    };
    const one = (s) => r(document.querySelector(s));
    const readout = document.querySelector('.navmap-readout');
    return {
      view: { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
      frame: one('.navmap-frame'),
      body: one('.navmap-body'),
      stage: one('.navmap-stage'),
      chart: one('.navmap-chart'),
      bar: one('.navmap-bar'),
      readout: r(readout),
      readoutShown: Boolean(readout?.offsetParent) && readout.getBoundingClientRect().height > 0,
      side: one('.navmap-side'),
      tools: [...document.querySelectorAll('.navmap-tools button')].map((b) => ({ id: b.dataset.tool, ...r(b) })),
    };
  });
// what of the map runs off the window or out of its own box at this size, in words; [] for none
const offScreen = (l) =>
  [
    ['the frame', l.frame, l.view],
    ['the chart', l.chart, l.view],
    ['the bar', l.bar, l.view],
    ['the bar', l.bar, l.frame],
    ['the stage', l.stage, l.body],
  ]
    .filter(([, a, b]) => !a || !b || !within(a, b))
    .map(([what, a, b]) => `${what} (${a ? `${Math.round(a.top)}–${Math.round(a.top + a.height)}` : 'missing'} in ${b ? Math.round(b.height) : '?'})`)
    .concat(l.side && l.side.top >= 0 && l.side.top < l.view.height ? [] : [`the side panel’s top (${l.side ? Math.round(l.side.top) : 'missing'})`]);

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

  // the chart, on open: the ship in its middle, at the level its sector
  // opens on, its sector in the readout (all from the ship where the scene
  // says it is: a start can be anywhere)
  const wonders = await page.evaluate(() => window.__universeDebug.wonders.map(({ name, at, reach }) => ({ name, at: [...at], reach })));
  const ship0 = (await state(page)).ship;
  const open0 = await chartNow(page);
  check(shipOff(open0) <= 3, `on open the ship’s marker is in the middle of the chart (${px(shipOff(open0))} off)`);
  const level0 = levelOnOpen(ship0, wonders.find((w) => w.name === 'The Citadel'));
  check(open0.level === level0, `the chart opens at the ${level0} level (${open0.level})`);
  check(Boolean(open0.readout?.startsWith(sectorWords(ship0))), `the readout starts “${sectorWords(ship0)}” (${open0.readout})`);
  // a Shift-drag up tilts it (at the zoom it opens on, where the places
  // stand on their stems; 240 px, a third of the way to side-on, so the
  // shot shows it), and “Look straight down” puts it back
  const centre = mid(open0.chart);
  await page.keyboard.down('Shift');
  await drag(page, [centre.x - 60, centre.y + 120], [centre.x - 60, centre.y - 120]);
  await page.keyboard.up('Shift');
  const tilted = await chartNow(page);
  check(tilted.pitched && (await tool(page, 'flat')) === null, `a Shift-drag up tilts the chart, and “Look straight down” is there to press (pitched ${tilted.pitched})`);
  await shot(page, '15-tilted');
  await click(page, '.navmap-tools [data-tool="flat"]');
  await painted(page);
  check(!(await chartNow(page)).pitched && (await tool(page, 'flat')) === 'true', '“Look straight down” flattens it');
  // the wheel over the middle zooms it in to a star system, a turn at a time
  await page.mouse.move(centre.x, centre.y);
  let turns = 0;
  while ((await levelNow(page)) !== 'system' && turns < 12) {
    await page.mouse.wheel(0, -400);
    await painted(page);
    turns++;
  }
  check((await levelNow(page)) === 'system', `the wheel zooms the chart in to a system (${turns} turns)`);
  // a minus typed in the search is the field's: the chart keeps its zoom
  // (one pressed outside it, next, takes it back out)
  await page.focus('.navmap-search input');
  await page.keyboard.type('-');
  await painted(page);
  const typed = await page.inputValue('.navmap-search input');
  check(typed === '-' && (await levelNow(page)) === 'system', `a minus typed in “Find a place…” goes in the field and doesn’t zoom (“${typed}”, ${await levelNow(page)})`);
  await page.fill('.navmap-search input', '');
  await page.evaluate(() => document.activeElement?.blur());
  let minus = 0;
  while ((await levelNow(page)) !== 'neighbourhood' && minus < 4) {
    await page.keyboard.press('-');
    await painted(page);
    minus++;
  }
  check((await levelNow(page)) === 'neighbourhood', `− zooms it back out to the neighbourhood (${minus} ${minus === 1 ? 'press' : 'presses'})`);
  // a drag that starts on a place's name moves the chart with the hand, and
  // never picks the place or sends the ship
  const name = await page.evaluate(() => {
    const c = document.querySelector('.navmap-chart').getBoundingClientRect();
    const R = c.width / 2;
    for (const li of document.querySelectorAll('.navmap-places > li')) {
      const b = li.querySelector('button.navmap-place[aria-pressed]');
      const { left: x, top: y } = li.getBoundingClientRect(); // (the li is the place's point: 0 by 0)
      if (!b || Math.hypot(x - c.left - R, y - c.top - R) < 40 || Math.hypot(x + 120 - c.left - R, y - c.top - R) > R - 30) continue;
      if (document.elementFromPoint(x, y)?.closest('li') === li) return { id: li.dataset.id, x, y, pressed: b.getAttribute('aria-pressed') };
    }
    return null;
  });
  check(Boolean(name), 'there’s a place’s button on the chart to drag from');
  if (name) {
    const auto = (await state(page)).auto;
    await drag(page, [name.x, name.y], [name.x + 120, name.y]);
    const dragged = await chartNow(page);
    check(shipOff(dragged, [120, 0]) <= 6, `a drag 120 px right from ${name.id}’s name takes the ship 120 px right with it (${px(shipOff(dragged, [120, 0]))} off)`);
    const pressed = await page.evaluate((id) => document.querySelector(`.navmap-places > li[data-id="${id}"] button`)?.getAttribute('aria-pressed') ?? null, name.id);
    const sent = (await state(page)).auto;
    check(pressed === name.pressed && sent === auto, `the drag picks nothing and sends the ship nowhere (pressed ${pressed}, autopilot ${sent})`);
    check((await tool(page, 'ship')) === null, '“Back to the ship” is there to press once the chart’s moved');
    await click(page, '.navmap-tools [data-tool="ship"]');
    await painted(page);
    const back = await chartNow(page);
    check(shipOff(back) <= 3 && (await tool(page, 'ship')) === 'true', `“Back to the ship” puts it back in the middle (${px(shipOff(back))} off)`);
  }
  // (the map shut and opened again: the shots and the jump from the chart as it opens)
  await page.keyboard.press('Escape');
  await page.waitForSelector('.navmap', { state: 'detached', timeout: 60000 });
  await page.keyboard.press('m');
  await navOpen(page);

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
  // a jump to a wonder in the main sector, picked by name and found where
  // the scene has it (Ember, or Halcyon if the ship started out by Ember),
  // timed on the wall clock
  const start = (await state(page)).ship;
  const jump = jumpGoal(wonders, start);
  if (!jump) throw new Error(`neither of the jump's wonders is in __universeDebug.wonders (${wonders.map((w) => w.name).join(', ')})`);
  const { name: goal, gx, gz, near } = jump;
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
  // on the first frame past the flash, not how many seconds that took here.
  // A frame's time is when it began, its rAF timestamp: the scene's clock
  // reads that or later as it steps, and a frame here can take seconds to
  // draw, so the time this runs at can be past the flash in a frame the
  // scene stepped before it)
  await page.evaluate(
    ([x, z]) => {
      window.__jumpLog = [];
      const tick = (ts) => {
        const s = window.__universeDebug.state;
        window.__jumpLog.push([ts / 1000, s.jump?.at ?? null, s.ship ? Math.hypot(s.ship.x - x, s.ship.z - z) : null]);
        if (window.__jumpLog.length < 3000) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    },
    [gx, gz],
  );
  await click(page, '.navmap-go');
  // (till the ship's there and the site's jump has played: the ship comes
  // round to face the wonder before it jumps, and the jump is loaded when
  // it's first asked for, so in software GL each can take many slow frames)
  const jumpUp = () => page.evaluate(() => Boolean(document.querySelector('.hyperspace-canvas, canvas[class*="hyper"]')));
  let overlay = false;
  let there = false;
  for (const until = Date.now() + 360000; Date.now() < until && !(there && overlay); ) {
    const seen = await jumpUp();
    if (seen && !overlay) await shot(page, '3-jumping');
    overlay ||= seen;
    const s = await state(page);
    there ||= Boolean(s.ship && Math.hypot(s.ship.x - gx, s.ship.z - gz) < near);
    if (!(there && overlay)) await page.waitForTimeout(250);
  }
  check(overlay, 'the site’s jump plays over the map');
  // (and is over, so the shots after it are of the map, not the jump)
  await page.waitForFunction(() => !document.querySelector('.hyperspace-canvas, canvas[class*="hyper"]'), null, { polling: 250, timeout: 120000 }).catch(() => {});
  const timing = await page.evaluate((n) => {
    const log = window.__jumpLog;
    const due = log.find((r) => Number.isFinite(r[1]))?.[1]; // (coming round to it, the jump isn't due yet: its at is Infinity)
    const i = log.findIndex((r) => r[2] !== null && r[2] < n);
    if (due === undefined || i < 1) return null;
    return { late: log[i][0] - due, frame: log[i][0] - log[i - 1][0], before: log[i - 1][0] - due };
  }, near);
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
  // a short window: the chart and its bar still fit in the frame, the side panel beside them
  await page.setViewportSize({ width: 1280, height: 500 });
  await painted(page);
  const short = offScreen(await layout(page));
  check(!short.length, `at 1280 × 500 the chart, its bar and the side panel are all on the screen${short.length ? ` (${short.join(', ')})` : ''}`);
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
  // (said, not checked: how many of the places on the phone's chart have their names showing)
  const named = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('.navmap-places > li')];
    const shows = lis.filter((li) => li.querySelector('.navmap-name')?.offsetParent).map((li) => li.querySelector('.navmap-name').textContent);
    return `${shows.length} of ${lis.length} (${shows.join(', ')})`;
  });
  console.log('    names showing on the phone’s chart:', named);
  // a finger's tools: each 44 px or more, inside the frame, clear of the
  // others and of the readout, and the readout shown
  const coarse = await asTouch(page);
  await painted(page);
  const bar = await layout(page);
  const badTools = bar.tools.filter((t, i) => t.width < 44 || t.height < 44 || !within(t, bar.frame) || bar.tools.some((o, j) => j !== i && meet(t, o)) || (bar.readout && meet(t, bar.readout)));
  const sizes = bar.tools.map((t) => `${t.id} ${Math.round(t.width)}×${Math.round(t.height)}`).join(', ');
  check(coarse > 0 && bar.tools.length > 0 && !badTools.length, `on a phone each chart tool is 44 px or more, inside the frame and clear of the others and the readout (${sizes}${badTools.length ? `; not ${badTools.map((t) => t.id).join(', ')}` : ''})`);
  check(bar.readoutShown, 'the readout shows on a phone');
  // the side panel under the chart scrolls (when there's more in it than shows)
  const scroll = await page.evaluate(() => {
    const s = document.querySelector('.navmap-side');
    const { scrollHeight: tall, clientHeight: shows } = s;
    if (tall <= shows) return { tall, shows, moved: null };
    s.scrollTop = 200;
    const moved = s.scrollTop;
    s.scrollTop = 0;
    return { tall, shows, moved };
  });
  check(scroll.moved === null || scroll.moved > 0, `the side panel under the chart scrolls (${JSON.stringify(scroll)})`);
  // a wonder with no room for its name on the phone's chart: hidden, till it's picked from the list
  const quiet = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.navmap-places > li[data-kind="wonder"]')].find((l) => !l.querySelector('.navmap-name').offsetParent);
    return li ? { id: li.dataset.id, name: li.querySelector('.navmap-name').textContent } : null;
  });
  check(Boolean(quiet), `a wonder on the phone’s chart has its name hidden (${quiet?.name ?? 'none'})`);
  if (quiet) {
    const mode = (m) => page.evaluate((w) => [...document.querySelectorAll('.navmap-modes button')].find((b) => b.textContent.includes(w))?.click(), m);
    await mode('List');
    await click(page, '.navmap-back').catch(() => {});
    await pickByName(page, quiet.name);
    await mode('Chart');
    await painted(page);
    const shown = await page.evaluate((id) => {
      const li = document.querySelector(`.navmap-places > li[data-id="${id}"]`);
      const n = li?.querySelector('.navmap-name');
      return Boolean(li?.hasAttribute('data-pick') && n?.offsetParent && n.getBoundingClientRect().width > 0);
    }, quiet.id);
    check(shown, `${quiet.name}’s name shows on the chart once it’s picked from the list`);
  }
  // a tap on zoom in zooms it, to the next level in a few
  const from = await levelNow(page);
  let taps = 0;
  while ((await levelNow(page)) === from && taps < 10) {
    const b = (await layout(page)).tools.find((t) => t.id === 'in');
    await page.touchscreen.tap(b.left + b.width / 2, b.top + b.height / 2);
    await painted(page);
    taps++;
  }
  check((await levelNow(page)) !== from, `tapping zoom in takes the chart from the ${from} level to the ${await levelNow(page)} (${taps} ${taps === 1 ? 'tap' : 'taps'})`);
  await shot(page, '14-phone-zoomed');
  // the phone turned sideways, the map open: all of it still on the screen
  await page.setViewportSize({ width: 844, height: 390 });
  await painted(page);
  const sideways = offScreen(await layout(page));
  check(!sideways.length, `turned sideways (844 × 390), the frame, the chart, its bar and the side panel’s top are all on the screen${sideways.length ? ` (${sideways.join(', ')})` : ''}`);
  await shot(page, '17-phone-sideways');
  await page.context().close();
}

// the map drawn flat, with 3D off: its own context, as the universe never
// starts here, so there is no __universe for open() to wait on
async function openFlat(viewport) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-tour', '"done"');
    window.localStorage.setItem('tp-3d', 'off'); // (as it is, not JSON: lib/gpu.js reads it raw)
  });
  const page = await ctx.newPage();
  listen(page);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: GOTO });
  return { ctx, page, flat: await page.waitForSelector('.universe-flat .minimap', { timeout: 120000 }) };
}
if (run('minimap')) {
  const { ctx, page, flat } = await openFlat({ width: 1280, height: 800 });
  await shot(page, '11-minimap-flat', flat);
  // a pointer that crosses a lesser place's button on its way to a world's dot
  // beside it (its 44 px round over the dot), and clicks there, picks the
  // world: a hover lifts no button
  await page.waitForSelector('.universe-flat .minimap li[data-id]', { state: 'attached', timeout: 60000 });
  // the wonders and the moons on it too, and the orbit rings that matched nothing gone
  const flatMarks = await page.evaluate(() => ({ ids: [...document.querySelectorAll('.universe-flat .minimap [data-id]')].map((e) => e.dataset.id), rings: document.querySelectorAll('.universe-flat .minimap-orbit').length }));
  const missing = ['aurelia', 'veil', 'squanch'].filter((id) => !flatMarks.ids.includes(id));
  check(!missing.length && flatMarks.rings === 0, `the flat map has Aurelia, The Veil and a moon, Squanch, and no orbit rings (${missing.length ? `missing ${missing.join(', ')}; ` : ''}${flatMarks.rings} rings)`);
  const pair = await page.evaluate(() => {
    const root = document.querySelector('.universe-flat .minimap');
    const lis = [...root.querySelectorAll('li[data-id]')];
    const dots = [...root.querySelectorAll('g.minimap-planet')].map((g) => g.lastElementChild.getBoundingClientRect());
    const at = lis.map((li, i) => ({ id: li.dataset.id, kind: li.dataset.kind, x: dots[i].left + dots[i].width / 2, y: dots[i].top + dots[i].height / 2 }));
    const own = (id, x, y) => document.elementFromPoint(x, y)?.closest('li[data-id]')?.dataset.id === id;
    for (const w of at.filter((p) => p.kind === 'world' && own(p.id, p.x, p.y)))
      for (const l of at.filter((p) => p.kind !== 'world' && Math.abs(p.x - w.x) < 22 && Math.abs(p.y - w.y) < 22)) {
        // (a point of the lesser one's round that's its own, from its far side in)
        const far = Math.hypot(l.x - w.x, l.y - w.y) || 1;
        for (let r = 20; r >= 0; r -= 4) {
          const from = [l.x + ((l.x - w.x) * r) / far, l.y + ((l.y - w.y) * r) / far];
          if (own(l.id, ...from)) return { world: w.id, lesser: l.id, from, to: [w.x, w.y] };
        }
      }
    return null;
  });
  check(Boolean(pair), 'the flat map has a world with a lesser place’s button beside its dot');
  if (pair) {
    await page.mouse.move(...pair.from);
    await page.mouse.move(...pair.to, { steps: 6 });
    await page.mouse.down();
    await page.mouse.up();
    const picked = () => page.evaluate(() => document.querySelector('.universe-flat .minimap').dataset.selected ?? null);
    await page.waitForFunction(() => document.querySelector('.universe-flat .minimap').dataset.selected, null, { timeout: 30000 }).catch(() => {});
    check((await picked()) === pair.world, `a pointer over ${pair.lesser}, then a click on ${pair.world}’s dot beside it, picks ${pair.world} (${await picked()})`);
  }
  // + with the focus inside it zooms it, to the next level in a few
  const flatLevel = () => page.evaluate(() => document.querySelector('.universe-flat .minimap').dataset.level);
  await page.focus('.universe-flat .minimap-hit[tabindex="0"]');
  const flat0 = await flatLevel();
  let plus = 0;
  while ((await flatLevel()) === flat0 && plus < 8) {
    await page.keyboard.press('+');
    await painted(page);
    plus++;
  }
  check((await flatLevel()) !== flat0, `+ with the focus on the flat map zooms it from the ${flat0} level to the ${await flatLevel()} (${plus} ${plus === 1 ? 'press' : 'presses'})`);
  // Home's teaser, at the foot of the page: its section mounts only as it
  // nears the screen, so scroll down a screen at a time till it's there
  await page.goto(`${base}/#/home`, { waitUntil: 'domcontentloaded', timeout: GOTO });
  await page.waitForFunction(
    () => {
      const teaser = document.querySelector('.minimap-teaser');
      if (teaser) teaser.scrollIntoView({ block: 'center' });
      else window.scrollBy(0, window.innerHeight * 0.8);
      return Boolean(teaser);
    },
    null,
    { polling: 300, timeout: 120000 },
  );
  const teaser = await page.waitForSelector('.minimap-teaser .minimap-hit', { timeout: 60000 }).then(() => page.$('.minimap-teaser'));
  await shot(page, '12-minimap-teaser', teaser);
  // (the fandoms' worlds alone: no station, wonder or moon)
  const teaserKinds = await page.evaluate(() => [...document.querySelectorAll('.minimap-teaser [data-id]')].map((e) => [e.dataset.id, e.dataset.kind]));
  const notWorlds = teaserKinds.filter(([, k]) => k !== 'world').map(([id]) => id);
  check(teaserKinds.length > 0 && !notWorlds.length, `Home’s teaser has only worlds on it (${teaserKinds.length}${notWorlds.length ? `; not worlds: ${notWorlds.join(', ')}` : ''})`);
  await ctx.close();
  // the whole map on a phone, in a box 342 px across
  const phone = await openFlat({ width: 390, height: 844 });
  await shot(phone.page, '18-phone-minimap-flat', phone.flat);
  // (a world's name may lie over a lesser place's dot there: without it, none had room)
  const named = await phone.page.evaluate(() => [...document.querySelectorAll('.universe-flat li[data-id]:not([data-quiet])')].map((li) => li.dataset.id));
  check(named.length > 0, `the flat map on a phone names a place at its opening zoom (${named.join(', ')})`);
  await phone.ctx.close();
}

// the ship two sectors out, and the map opened on it
if (run('far')) {
  const page = await open({ width: 1440, height: 900 }, 'falcon');
  await page.evaluate(() => {
    const s = window.__universeDebug.state;
    s.ship = { ...s.ship, x: 250000, y: 1000, z: 0, speed: 0 };
  });
  await page.waitForFunction(() => window.__universe().ship?.x > 200000, null, { timeout: 120000 });
  await page.keyboard.press('m');
  await navOpen(page);
  await page.waitForSelector('.navmap-chart', { timeout: 60000 });
  await shot(page, '13-far-ship');
  // (before the chart's own projection, the map left it off out here)
  const ship = (await state(page)).ship;
  const far = await shipOnChart(page);
  check(far.drawn && far.inside, `two sectors out, the ship’s marker is on the chart, inside its circle (${JSON.stringify(far)})`);
  const [sx] = shipSector(ship);
  check(sx >= 2 && Boolean(far.readout?.startsWith(sectorWords(ship))), `the readout says the ship’s sector, ${sx} out (${far.readout})`);
  // the chart dragged off it: the ship's marker pinned to the rim, still inside the circle
  const m = mid((await chartNow(page)).chart);
  let drags = 0;
  while (!(await chartNow(page)).edge && drags < 3) {
    await drag(page, [m.x + 200, m.y], [m.x - 200, m.y], 10);
    drags++;
  }
  const pinned = await shipOnChart(page);
  check(pinned.edge && pinned.inside, `dragged ${drags * 400} px left, the ship’s marker is pinned to the rim, inside the circle (${JSON.stringify(pinned)})`);
  await shot(page, '16-far-ship-pinned');
  await page.context().close();
}

// (how many, and each different one: a page load repeats its own, and a cap could hide another)
console.log(errors.length ? `page errors: ${errors.length}, ${JSON.stringify([...new Set(errors)])}` : 'no page errors');
console.log(problems.length ? `${problems.length} FAILED` : 'all ok');
await browser.close();
process.exit(problems.length ? 1 : 0);
