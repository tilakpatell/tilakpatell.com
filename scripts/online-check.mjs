/* global window, document */
// A browser check of multiplayer across the worlds, on the real relays: two
// visitors (Alpha and Bravo, two browser profiles) go online, open the same
// world, and each should see the other there (the world's "N here" chip goes
// to 1, and the roster says they're "here"); then Bravo moves on to another
// world and Alpha's roster should say where, by name. With the dev server up
// (npx vite --port 5173):
//   node scripts/online-check.mjs [/middle-earth/bree /avengers ...] [--then /middle-earth/moria]
// (behind a proxy: HTTPS_PROXY, and BRIDGE=1 NODE_USE_ENV_PROXY=1 if the
// browser's WebSockets can't get through it)
// The relays are public, so anyone else online at the time is counted too:
// it checks for at least one. Headless Chromium draws in software, slowly.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const then = flag('--then', '/middle-earth/moria');
const out = process.env.OUT ?? null;
const worlds = args.length ? args : ['/middle-earth/bree'];
const BASE = 'http://localhost:5173/?quality=low#';
// (behind a proxy, the relays go through it and the dev server doesn't)
// (behind a proxy that re-signs TLS, PROXY_CA_SPKI is its CA's key hash, for
// a browser profile that doesn't trust it yet)
const proxy = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=localhost;127.0.0.1'] : [];
if (process.env.PROXY_CA_SPKI) proxy.push(`--ignore-certificate-errors-spki-list=${process.env.PROXY_CA_SPKI}`, '--disable-http2');
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: [...proxy, '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

const errors = [];
async function visitor(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((n) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-universe-online', JSON.stringify('on'));
    window.localStorage.setItem('tp-universe-callsign', JSON.stringify(n));
    // (headless Chromium draws in software: load the worlds and play anyway,
    // as someone on a slow machine would choose to)
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.sessionStorage.setItem('tp-gl-anyway', 'true');
  }, name);
  // BRIDGE=1: the relays reached from here (Node, which goes through a proxy
  // with NODE_USE_ENV_PROXY=1) rather than from the browser, for a proxy
  // that won't pass a browser's WebSocket upgrade
  if (process.env.BRIDGE)
    await ctx.routeWebSocket(/^wss:\/\//, (ws) => {
      const up = new WebSocket(ws.url());
      const waiting = [];
      up.onopen = () => waiting.splice(0).forEach((m) => up.send(m));
      up.onmessage = (e) => typeof e.data === 'string' && ws.send(e.data);
      up.onclose = () => ws.close();
      up.onerror = () => ws.close();
      ws.onMessage((m) => (up.readyState === 1 ? up.send(m) : waiting.push(m)));
      ws.onClose(() => up.close());
    });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  return page;
}

// the number on the world's chip ("1 traveller here", "2 other Mortys here",
// "3 listeners here"), or null: any element reading "<n> … here" outside the
// site's online corner (whose "· 1 here" is the page's, not the world's)
const chip = (page) =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('span, p, b, div, button')) {
      if (el.closest('.universe-online')) continue;
      const m = /^(\d+)\s*(?:other\s+)?[a-z’']+\s+here$/i.exec(el.textContent.trim());
      if (m) return Number(m[1]);
    }
    return null;
  });
// a world whose 3D waits to be asked for (the office's, the music room's),
// or that puts you in it only once you start (the Caribbean's voyage, and
// on a slow graphics chip, its "play anyway"): ask,
// whenever the button's there
// (a click in the page itself: the game's buttons sit below the fold of a
// canvas Playwright never counts as settled)
const start = (page) =>
  page
    .evaluate(() => [...document.querySelectorAll('button')].find((b) => /^(Load the |Weigh anchor|Play anyway)/.test(b.textContent.trim()))?.click())
    .catch(() => {});
// the roster's line for a callsign, opened from the corner
async function rosterLine(page, who) {
  const pill = page.locator('.universe-online-pill').first();
  if ((await pill.getAttribute('aria-expanded')) !== 'true') await pill.click();
  const line = page.locator('.universe-online-pilot', { hasText: who }).first();
  await line.waitFor({ timeout: 60000 });
  return (await line.textContent()).replace(/\s+/g, ' ').trim();
}
const waitFor = async (fn, ms, what) => {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t > ms) throw new Error(`timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
};

const a = await visitor('Alpha');
const b = await visitor('Bravo');
let failed = 0;
for (const w of worlds) {
  await Promise.all([a.goto(BASE + w), b.goto(BASE + w)]);
  try {
    const n = await waitFor(async () => {
      await Promise.all([start(a), start(b)]);
      const [x, y] = [await chip(a), await chip(b)];
      return x >= 1 && y >= 1 ? [x, y] : null;
    }, 150000, `${w}: each sees the other`);
    const pointers = await a.locator('.presence-pilot').count();
    console.log(`ok   ${w}: chips ${n.join(' / ')}, page pointers drawn: ${pointers}`);
    if (pointers) {
      failed++;
      console.log(`FAIL ${w}: page pointers over the world`);
    }
    if (out) await a.screenshot({ path: `${out}/online${w.replace(/\//g, '-')}.png` });
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
    // what each saw: the corner, any "here" chip, the world's buttons
    for (const [who, p] of [['Alpha', a], ['Bravo', b]]) {
      const seen = await p
        .evaluate(() => ({
          corner: document.querySelector('.universe-online-pill')?.textContent ?? null,
          here: [...document.querySelectorAll('[data-on], button')].map((el) => el.textContent.trim()).filter((t) => /here|other|online/i.test(t)).slice(0, 6),
          buttons: [...document.querySelectorAll('button')].map((el) => el.textContent.trim()).filter(Boolean).slice(0, 12),
        }))
        .catch((err) => ({ error: String(err) }));
      console.log(`     ${who}: ${JSON.stringify(seen)}`);
      if (out) await p.screenshot({ path: `${out}/fail${w.replace(/\//g, '-')}-${who}.png` }).catch(() => {});
    }
  }
}
if (then) {
  try {
    await b.goto(BASE + then);
    const line = await waitFor(async () => {
      const l = await rosterLine(a, 'Bravo').catch(() => '');
      return l.includes('here') ? null : l || null;
    }, 90000, `roster names where Bravo went (${then})`);
    console.log(`ok   roster: ${line}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
  }
}
console.log(`errors: ${JSON.stringify(errors.slice(0, 10))}`);
console.log(failed ? `${failed} FAILED` : 'ALL OK');
await browser.close();
process.exit(failed ? 1 : 0);
