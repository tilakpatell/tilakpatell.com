/* global window, document, getComputedStyle, innerHeight, createImageBitmap, OffscreenCanvas, SVGElement, KeyboardEvent, requestAnimationFrame */
// The galaxy map check's shared parts (scripts/galaxy-map-check.mjs runs it; suite.mjs and phone.mjs are its checks): the
// browser, the page and how it's opened, what's measured on the map (names, small text, overlays, the header row), and the
// check's ok/FAIL line.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

export const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const mac = `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = process.env.CHROME ?? (existsSync(mac) ? mac : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
mkdirSync(out, { recursive: true });
export const problems = [];
export const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
export const browser = await chromium.launch({ executablePath: chrome, args });

// the page's side of the check: where things are on the map
const pageHelpers = () => {
  window.__mc = {
    map: () => document.querySelector('.holomap-map')?.getBoundingClientRect(),
    sys: (id) => document.querySelector(`.holomap-name[data-id="${id}"]`)?.closest('li')?.querySelector('.holomap-system') ?? null,
    dot(id) {
      const b = this.sys(id)?.getBoundingClientRect();
      return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null;
    },
    // (the stage's zoom and where it's moved to)
    view() {
      const cs = getComputedStyle(document.querySelector('.holomap-stage'));
      return { k: parseFloat(cs.getPropertyValue('--holomap-k')), x: parseFloat(cs.getPropertyValue('--holomap-vx')), y: parseFloat(cs.getPropertyValue('--holomap-vy')) };
    },
    onView(p, pad = 0.04) {
      const m = this.map();
      return Boolean(p && m && p.x >= m.left + pad * m.width && p.x <= m.right - pad * m.width && p.y >= m.top + pad * m.height && p.y <= m.bottom - pad * m.height);
    },
    picked: () => [...document.querySelectorAll('.holomap-system[aria-pressed="true"]')].map((b) => b.closest('li').querySelector('.holomap-name').dataset.id),
    // (the ones whose dot has nothing over it: a press there lands on the system)
    free() {
      return this.onViewIds().filter((id) => document.elementFromPoint(this.dot(id).x, this.dot(id).y)?.closest('.holomap-system') === this.sys(id));
    },
    // (the map's ids with their dots, on the view only)
    onViewIds() {
      return [...document.querySelectorAll('.holomap-name[data-id]')].map((n) => n.dataset.id).filter((id) => this.onView(this.dot(id), 0.02));
    },
    shown: (el) => Boolean(el) && el.checkVisibility({ visibilityProperty: true }) && el.getBoundingClientRect().width > 0,
  };
};

// a galaxy at Tatooine, flown in an X-wing, the map open
export const open = async (viewport) => {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-3d', 'on');
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-sound', 'off');
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
  });
  await ctx.addInitScript(pageHelpers);
  const page = await ctx.newPage();
  const errors = [];
  let watching = false;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => watching && m.type() === 'error' && !/GPU stall|swiftshader|WebGL|403/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
  await page.goto(`${base}/#/galaxy`, { waitUntil: 'domcontentloaded' });
  await page.locator('text=An X-wing').first().click({ timeout: 180000 });
  await page.waitForFunction(() => typeof window.__galaxy === 'function' && window.__galaxy().system && window.__galaxy().ship && !window.__galaxy().jump, null, { timeout: 180000 });
  const reopen = async () => {
    await page.keyboard.press('m');
    await page.waitForSelector('.holomap', { timeout: 10000 });
    await page.waitForTimeout(700);
  };
  await reopen();
  watching = true;
  return { ctx, page, errors, reopen };
};

export const settle = (page, ms = 550) => page.waitForTimeout(ms); // (the stage's 0.18 s, and the names' placing)
// (till the stage has stopped moving: its box the same twice, 120 ms apart)
export const still = async (page) => {
  let was = '';
  for (let i = 0; i < 30; i++) {
    const now = await page.evaluate(() => JSON.stringify(document.querySelector('.holomap-stage').getBoundingClientRect()));
    if (now === was) return;
    was = now;
    await page.waitForTimeout(120);
  }
};
export const J = (page, fn, arg) => page.evaluate(fn, arg);

// every name's width on each frame of a zoom's easing (a key pressed in the page, sampled for 320 ms): the stage and the names'
// counter-scale ease together, so a name keeps its size all the way (the stage's transform alone eased left them at the end
// value's scale from the first frame, and they shrank and then grew back)
export const easedNames = (page, key) =>
  J(
    page,
    async (k) => {
      const names = [...document.querySelectorAll('.holomap-name[data-id]')];
      const widths = names.map(() => []);
      const t0 = performance.now();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      await new Promise((done) => {
        const tick = () => {
          names.forEach((el, i) => widths[i].push(el.getBoundingClientRect().width));
          if (performance.now() - t0 < 320) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      const spread = widths.map((w) => Math.max(...w) - Math.min(...w));
      return { frames: widths[0].length, worst: Math.max(...spread), name: names[spread.indexOf(Math.max(...spread))]?.dataset.id };
    },
    key,
  );
export const hasMap = (page) => page.locator('.holomap').count().then((n) => n > 0);

// the names on view: any two meeting, any over another system's dot, any outside the map
export const namesProblems = (page) =>
  J(page, () => {
    const map = window.__mc.map();
    const tol = 0.5;
    const rows = [...document.querySelectorAll('.holomap-name[data-id]')]
      .map((el) => ({ id: el.dataset.id, r: el.getBoundingClientRect(), d: window.__mc.dot(el.dataset.id) }))
      .filter((n) => n.d.x >= map.left && n.d.x <= map.right && n.d.y >= map.top && n.d.y <= map.bottom);
    const meets = [];
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i].r;
        const b = rows[j].r;
        if (a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol) meets.push(`${rows[i].id}/${rows[j].id}`);
      }
    // (a name over another system's dot: its box, 14 px, is what labelPlace.js keeps names off. Dots on the map only)
    const onMap = (r) => r.left + r.width / 2 >= map.left && r.left + r.width / 2 <= map.right && r.top + r.height / 2 >= map.top && r.top + r.height / 2 <= map.bottom;
    const dots = [];
    for (const el of document.querySelectorAll('.holomap-dot')) {
      const d = el.getBoundingClientRect();
      const owner = el.closest('li').querySelector('.holomap-name').dataset.id;
      if (!onMap(d)) continue;
      for (const n of rows)
        if (n.id !== owner && n.r.left < d.right - tol && d.left < n.r.right - tol && n.r.top < d.bottom - tol && d.top < n.r.bottom - tol) {
          // (how far in: the smaller of the two ways the boxes overlap)
          const depth = Math.min(Math.min(n.r.right, d.right) - Math.max(n.r.left, d.left), Math.min(n.r.bottom, d.bottom) - Math.max(n.r.top, d.top));
          dots.push({ pair: `${n.id}/${owner}`, depth: Math.round(depth * 10) / 10 });
        }
    }
    // (the controls over the map, by what's drawn: the strip's title by its words)
    const textBox = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    const controls = [];
    for (const el of document.querySelectorAll('.holomap-strip-war')) if (window.__mc.shown(el)) controls.push({ what: 'strip', r: textBox(el) });
    const kind = (el) => (el.closest('.holomap-zoom') ? 'zoom' : el.closest('.holomap-layers') ? 'layers' : el.closest('.holomap-legend') ? 'key' : 'strip');
    for (const el of document.querySelectorAll('.holomap-strip-board, .holomap-layers-toggle, .holomap-layers-set button, .holomap-legend-toggle, .holomap-zoom button, .holomap-course-tag')) if (window.__mc.shown(el)) controls.push({ what: el.matches('.holomap-course-tag') ? 'tag' : kind(el), r: el.getBoundingClientRect() });
    const under = [];
    for (const n of rows)
      for (const c of controls) if (n.r.left < c.r.right - 1 && c.r.left < n.r.right - 1 && n.r.top < c.r.bottom - 1 && c.r.top < n.r.bottom - 1) under.push(`${n.id}/${c.what}`);
    const outside = rows.filter(({ r }) => r.left < map.left - tol || r.right > map.right + tol || r.top < map.top - tol || r.bottom > map.bottom + tol).map((n) => n.id);
    return { n: rows.length, meets, outside, under, dots };
  });

// a name over another system's dot: none at all on a desktop window. On a phone Hoth's, Bespin's, Mustafar's and Nevarro's dots are
// a few px apart, and at 360 px no place round Bespin's is clear of them all (an exhaustive search of every place of every name,
// with the controls, finds no better than a 4 px graze when Hoth's name is wide with its star and swords), so a graze no deeper
// than PHONE_GRAZE px is allowed there (and listed with the rest, with how deep each is)
export const PHONE_GRAZE = 5;
export const dotsCheck = (dots, width) => ({
  ok: dots.every((d) => d.depth <= (width <= 560 ? PHONE_GRAZE : 0)),
  text: dots.length ? ` (${dots.slice(0, 6).map((d) => `${d.pair} ${d.depth} px`).join(', ')})` : '',
});

// text in the map under 0.7 rem (11.2 px); the SVG's by what it renders at
export const smallText = (page) =>
  J(page, () => {
    const bad = [];
    for (const el of document.querySelectorAll('.holomap *')) {
      if (el instanceof SVGElement) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim());
      if (!own.length || !el.checkVisibility()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11.19) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${own[0].slice(0, 20)}" ${fs}px`);
    }
    for (const t of document.querySelectorAll('.holomap svg text')) {
      if (!t.checkVisibility()) continue;
      const h = t.getBoundingClientRect().height;
      const m = t.getScreenCTM(); // (its own rotation's in it: the scale is the length of a column)
      const px = parseFloat(getComputedStyle(t).fontSize) * (m ? Math.hypot(m.a, m.b) : 0);
      if (h < 10 || px < 11.19) bad.push(`svg text "${t.textContent.slice(0, 20)}" ${px.toFixed(1)}px, ${h.toFixed(1)} tall`);
    }
    return bad;
  });

// the strip, layers, key and zoom buttons shown, any two meeting
export const overlayProblems = (page) =>
  J(page, () => {
    // (each by what's drawn: the strip's title is as wide as its column, the layers' box wider than its chips)
    const textBox = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    const boxes = [];
    for (const el of document.querySelectorAll('.holomap-strip-war')) if (window.__mc.shown(el)) boxes.push({ name: 'strip', r: textBox(el) });
    const parts = { strip: '.holomap-strip-board', layers: '.holomap-layers-toggle, .holomap-layers-set button', key: '.holomap-legend-toggle, .holomap-legend-panel', zoom: '.holomap-zoom button' };
    for (const [name, sel] of Object.entries(parts)) for (const el of document.querySelectorAll(sel)) if (window.__mc.shown(el)) boxes.push({ name, r: el.getBoundingClientRect() });
    const meets = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.name !== b.name && a.r.left < b.r.right - 1 && b.r.left < a.r.right - 1 && a.r.top < b.r.bottom - 1 && b.r.top < a.r.bottom - 1) meets.push(`${a.name}/${b.name}`);
      }
    return meets;
  });

// the mean step between neighbouring pixels of a PNG: how sharp its lines are
export const edgeEnergy = (page, png) =>
  J(
    page,
    async (b64) => {
      const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]));
      const g = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
      g.drawImage(bmp, 0, 0);
      const { data, width, height } = g.getImageData(0, 0, bmp.width, bmp.height);
      let sum = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width - 1; x++) {
          const i = (y * width + x) * 4;
          sum += Math.abs(data[i + 4] + data[i + 5] + data[i + 6] - data[i] - data[i + 1] - data[i + 2]);
        }
      return sum / (width - 1) / height / 3;
    },
    png.toString('base64'),
  );

// what a touch screen gets from the zoom buttons' (pointer: coarse) rules (44, 40 or 36 px by the map's width): the same
// rules with their media query off, as Chromium won't emulate the pointer
export const asTouch = (page) =>
  J(page, () => {
    const css = [];
    for (const sheet of document.styleSheets) {
      let rules = [];
      try {
        rules = [...sheet.cssRules];
      } catch {
        continue; // (a sheet from another origin)
      }
      for (const r of rules) if (r.cssText.includes('pointer: coarse') && r.cssText.includes('.holomap-zoom')) css.push(r.cssText.replaceAll('(pointer: coarse)', '(min-width: 0px)'));
    }
    const el = document.createElement('style');
    el.textContent = css.join('\n');
    document.head.append(el);
    return css.length;
  });

// the header row (the title, the era chips, the Films summary, the find field, the close button), measured: any two meeting,
// any outside the frame; the text by its words' box, not its column's
const headerProblems = (page) =>
  J(page, () => {
    const frame = document.querySelector('.holomap-frame').getBoundingClientRect();
    const textBox = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    const parts = [];
    const add = (name, el, r = el?.getBoundingClientRect()) => {
      if (window.__mc.shown(el)) parts.push({ name, r });
    };
    add('kicker', document.querySelector('.holomap-kicker'), textBox(document.querySelector('.holomap-kicker')));
    add('title', document.querySelector('.holomap-title'), textBox(document.querySelector('.holomap-title')));
    add('find', document.querySelector('.holomap-find input'));
    add('close', document.querySelector('.holomap-close'));
    document.querySelectorAll('.holomap-eras > button').forEach((b, i) => add(`era ${i}`, b));
    add('films', document.querySelector('.holomap-filmpick summary'));
    const meets = [];
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i].r;
        const b = parts[j].r;
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) meets.push(`${parts[i].name}/${parts[j].name}`);
      }
    const outside = parts.filter(({ r }) => r.left < frame.left - 0.5 || r.right > frame.right + 0.5 || r.top < frame.top - 0.5 || r.bottom > innerHeight + 0.5).map((p) => p.name);
    // (the close button beside the title, not wrapped onto a row of its own)
    const close = parts.find((p) => p.name === 'close')?.r;
    const title = parts.find((p) => p.name === 'title')?.r;
    return { n: parts.length, meets, outside, closeBeside: Boolean(close && title && close.top < title.bottom && close.bottom > parts.find((p) => p.name === 'kicker').r.top) };
  });

// the header's, and the Films panel's behaviour: a transient popover that may cover the map's controls while it's open, and a
// press on the map outside it shuts it, with the zoom buttons then there to be pressed (the press lands on each button)
export const headerAndFilms = async (page, say) => {
  const h = await headerProblems(page);
  say(h.n >= 8, `the header row: ${h.n} parts measured`);
  say(h.meets.length === 0, `the header row's parts (title, era chips, Films, find, close) meet nowhere${h.meets.length ? ` (${h.meets.join(', ')})` : ''}`);
  say(h.outside.length === 0, `and all are inside the frame${h.outside.length ? ` (${h.outside.join(', ')})` : ''}`);
  say(h.closeBeside, 'and the close button is on the title\'s row, not wrapped onto one of its own');
  await page.locator('.holomap-filmpick summary').click();
  const opened = await J(page, () => {
    const p = document.querySelector('.holomap-films').getBoundingClientRect();
    const covered = [...document.querySelectorAll('.holomap-zoom button')].filter((b) => {
      const r = b.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button') !== b;
    }).length;
    // (a place on the map outside the panel where a press lands on nothing but the map)
    const m = window.__mc.map();
    let at = null;
    for (let fy = 0.97; fy > 0.4 && !at; fy -= 0.03)
      for (let fx = 0.55; fx < 0.96 && !at; fx += 0.05) {
        const x = m.left + fx * m.width;
        const y = m.top + fy * m.height;
        if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) continue;
        const e = document.elementFromPoint(x, y);
        if (e && e.closest('.holomap-map') && !e.closest('button, a, summary, .holomap-strip, .holomap-legend, .holomap-layers, .holomap-zoom, .holomap-system')) at = { x, y };
      }
    return { open: document.querySelector('details.holomap-filmpick').open, covered, at };
  });
  say(opened.open && opened.at !== null, `the Films panel opens, and there's a place on the map outside it to press (it covers ${opened.covered} of the 3 zoom buttons while open)`);
  if (opened.at) await page.mouse.click(opened.at.x, opened.at.y);
  await page.waitForTimeout(250);
  const after = await J(page, () => ({
    open: document.querySelector('details.holomap-filmpick').open,
    reachable: [...document.querySelectorAll('.holomap-zoom button')].map((b) => {
      const r = b.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button') === b;
    }),
  }));
  say(!after.open, 'a press on the map outside the Films panel shuts it');
  say(after.reachable.length === 3 && after.reachable.every(Boolean), `and a press at each zoom button's middle then lands on it (${after.reachable.filter(Boolean).length} of ${after.reachable.length})`);
};
