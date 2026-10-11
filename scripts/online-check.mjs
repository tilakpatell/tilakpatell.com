/* global window, document */
// A browser check of multiplayer across the worlds, on the real relays: two
// visitors (Alpha and Bravo, two browser profiles) go online, open the same
// world, and each should see the other there (the world's "N here" chip goes
// to 1, and the roster says they're "here"); then Bravo moves on to another
// world and Alpha's roster should say where, by name, with Bravo's level
// chip. With the dev server up (npx vite --port 5173; PORT=5174 for another):
//   node scripts/online-check.mjs [/middle-earth/bree /avengers ...] [--then /middle-earth/moria]
//   node scripts/online-check.mjs --universe
// --universe: both fly the universe map instead (Alpha the X-wing, Bravo the
// Falcon); Bravo is put 300 units off Alpha's nose and Alpha's tag for them
// should be the far one (callsign and distance, 12px at least on screen, in
// the tags box, on a phone's width too); Alpha's roster row for Bravo has a
// level chip; then they become allies: the tag goes green and doesn't fade,
// even past where a stranger's is gone; close by it's the full tag with its
// level chip, and with Bravo behind, Alpha's HUD has a green marker at the
// edge with Bravo's callsign.
// or, on the universe map (--ride): Bravo goes far out of Alpha's 3,000
// (online/pilotsRules.js's DRAW), so Alpha has Bravo as a blip on the chart
// alone; Alpha's roster names the region Bravo is in; then Bravo comes in
// beside Alpha, and is a ship again:
//   node scripts/online-check.mjs --ride
// planet flight: begin (scripts/flight-island.mjs removes this block)
// or, the shared world over a planet (--fly, ./lib/fly-check.mjs): two pilots
// on /fly/hoth heard by cell, a turret built in one in the other, kept over
// a reload and shot to nothing, the durable world faked here, and one
// blizzard both see (./lib/storm-check.mjs):
//   node scripts/online-check.mjs --fly
// planet flight: end
// (BASE=http://127.0.0.1:5188/?quality=low# for a dev server elsewhere)
// (behind a proxy: HTTPS_PROXY, and BRIDGE=1 NODE_USE_ENV_PROXY=1 if the
// browser's WebSockets can't get through it)
// RELAY=fake: no public relays at all, but one faked in here for each
// (lib/fake-relays.mjs), which every context is attached to, so it runs with
// no network (CI's Multiplayer job runs it so) and only Alpha and Bravo meet:
// each must see exactly one other pilot. On the public relays anyone else
// online at the time is counted too: there it checks for at least one.
// Headless Chromium draws in software, slowly.
import { chromium } from 'playwright-core';
import { fakeRelays } from './lib/fake-relays.mjs';
import { fakeDurable } from './lib/fake-durable.mjs'; // planet flight
import { flyCheck } from './lib/fly-check.mjs'; // planet flight
import { stormCheck } from './lib/storm-check.mjs'; // planet flight

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const universe = args.includes('--universe');
if (universe) args.splice(args.indexOf('--universe'), 1);
const ride = args.includes('--ride');
if (ride) args.splice(args.indexOf('--ride'), 1);
// a check with pages of its own: no --then, no world to start in
let own = false;
// planet flight: begin
const fly = args.includes('--fly');
if (fly) args.splice(args.indexOf('--fly'), 1);
own ||= fly;
// planet flight: end
const then = universe || ride || own ? null : flag('--then', '/middle-earth/moria');
const out = process.env.OUT ?? null;
const worlds = args.length ? args : ride || own ? [] : ['/middle-earth/bree'];
const BASE = process.env.BASE ?? `http://localhost:${process.env.PORT ?? 5173}/?quality=low#`;
// (behind a proxy, the relays go through it and the dev server doesn't)
// (behind a proxy that re-signs TLS, PROXY_CA_SPKI is its CA's key hash, for
// a browser profile that doesn't trust it yet)
const proxy = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=localhost;127.0.0.1'] : [];
if (process.env.PROXY_CA_SPKI) proxy.push(`--ignore-certificate-errors-spki-list=${process.env.PROXY_CA_SPKI}`, '--disable-http2');
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: [...proxy, '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const relays = process.env.RELAY === 'fake' ? fakeRelays() : null;

const errors = [];
async function visitor(name, ship = null, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(([n, ship]) => {
    window.localStorage.setItem('tp-intro', '1');
    if (ship) window.localStorage.setItem('tp-universe-ship', JSON.stringify(ship));
    window.localStorage.setItem('tp-universe-online', JSON.stringify('on'));
    window.localStorage.setItem('tp-universe-callsign', JSON.stringify(n));
    // (headless Chromium draws in software: load the worlds and play anyway,
    // as someone on a slow machine would choose to)
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.sessionStorage.setItem('tp-gl-anyway', 'true');
  }, [name, ship]);
  // RELAY=fake: the relays faked in here, for every context alike
  if (relays) await relays.attach(ctx);
  // BRIDGE=1: the relays reached from here (Node, which goes through a proxy
  // with NODE_USE_ENV_PROXY=1) rather than from the browser, for a proxy
  // that won't pass a browser's WebSocket upgrade
  else if (process.env.BRIDGE)
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
// the roster's line for a callsign, opened from the corner (a click in the
// page: over the map, a frame comes a second or so apart in software, and
// Playwright waits on two alike to call the button settled)
const press = (loc) => loc.evaluate((el) => el.click(), null, { timeout: 120000 });
async function rosterLine(page, who) {
  const pill = page.locator('.universe-online-pill').first();
  if ((await pill.getAttribute('aria-expanded')) !== 'true') await press(pill);
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

// The dev server warmed first. Vite finds a page's lazily imported
// dependencies as a browser asks for them, and on finding new ones it
// re-bundles and answers "504 (Outdated Optimize Dep)" until it's done,
// which makes the page reload itself; a check whose page reloads midway
// loses its `window.__universeDebug` ("reading 'net'", and "Execution
// context was destroyed" in CI's Multiplayer job, on main itself). So a
// scout, offline and alone, loads the route first and waits for it to be
// up and to stay up, going again if the page went from under it; only then
// do Alpha and Bravo come. A server already warm costs the scout a few
// seconds. WARM=0 skips it.
async function warm(path, ready) {
  if (process.env.WARM === '0' || !path) return;
  const t = Date.now();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    // (a ship chosen, or the map waits at the choice and never has one)
    window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
    window.localStorage.setItem('tp-universe-online', JSON.stringify('off'));
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.sessionStorage.setItem('tp-gl-anyway', 'true');
  });
  const page = await ctx.newPage();
  let up = false;
  try {
    // (four minutes at most: a server that never settles is the run's to
    // report, not the scout's to wait out)
    while (!up && Date.now() - t < 240000) {
      try {
        await page.goto(BASE + path, { timeout: 120000 });
        await page.waitForFunction(ready, null, { timeout: 120000 });
        // (a re-bundle's reload comes a moment after the page is up: give it one)
        await page.waitForTimeout(5000);
        up = await page.evaluate(ready);
      } catch {
        // (the page went from under us: the optimizer's reload; once more)
      }
    }
  } finally {
    await ctx.close().catch(() => {});
  }
  console.log(`${up ? 'ok  ' : 'warn'} warmed ${path} in ${((Date.now() - t) / 1000).toFixed(0)} s${up ? '' : ' (never settled: the run may reload)'}`);
}
if (universe || ride) await warm('/universe', () => typeof window.__universe === 'function' && Boolean(window.__universe().ship));
else if (worlds[0]) await warm(worlds[0], () => Boolean(document.querySelector('canvas')));

const a = await visitor('Alpha', universe || ride ? 'xwing' : null);
// (on the map, Bravo's window small: software drawing is slow, and Bravo's
// poses must come often enough not to go stale on Alpha's screen)
const b = await visitor('Bravo', universe || ride ? 'falcon' : null, universe ? { width: 480, height: 320 } : undefined);
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed++;
};

// ── On the universe map: the tags ──
// Bravo put `dist` units off Alpha's nose, both held still
const placeBravo = async (dist) => {
  const at = await a.evaluate(() => ({ ...window.__universeDebug.state.ship }));
  await a.evaluate(() => Object.assign(window.__universeDebug.state.ship, { speed: 0, pitch: 0 }));
  await b.evaluate(
    ([at, dist]) => Object.assign(window.__universeDebug.state.ship, { x: at.x - Math.sin(at.heading) * dist, y: at.y, z: at.z - Math.cos(at.heading) * dist, heading: at.heading, pitch: 0, speed: 0 }),
    [at, dist],
  );
};
// Alpha's tag for Bravo, as drawn: its mode, text, level, the type's size on
// screen (the font times the tag's scale) and whether it's inside the tags box
const tagOf = (page, who) =>
  page.evaluate((who) => {
    const tag = [...document.querySelectorAll('.universe-tag[data-on]')].find((t) => t.querySelector('b')?.textContent === who);
    if (!tag) return null;
    const box = tag.parentElement.getBoundingClientRect();
    const r = tag.getBoundingClientRect();
    const scale = Number(/scale\(([\d.]+)\)/.exec(tag.style.transform)?.[1] ?? 1);
    const font = parseFloat(window.getComputedStyle(tag.querySelector('b')).fontSize);
    const shown = (sel) => window.getComputedStyle(tag.querySelector(sel)).display !== 'none';
    return {
      mode: tag.dataset.mode,
      relation: tag.dataset.relation,
      level: shown('em') ? tag.querySelector('em').textContent : null,
      dist: tag.querySelector('small').textContent,
      px: +(font * scale).toFixed(2),
      opacity: window.getComputedStyle(tag).opacity,
      inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5,
    };
  }, who);
if (universe) {
  await Promise.all([a.goto(BASE + '/universe'), b.goto(BASE + '/universe')]);
  try {
    for (const p of [a, b]) await p.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
    await waitFor(() => a.evaluate(() => [...(window.__universeDebug.net()?.peers.values() ?? [])].some((p) => p.name === 'Bravo' && p.snaps.length)), 120000, 'Alpha hears Bravo on the map');
    console.log('ok   Alpha hears Bravo on the map');
    // (on the fake relay there's nobody else: each sees exactly one other pilot)
    if (relays) {
      const named = (p) => p.evaluate(() => [...(window.__universeDebug.net()?.peers.values() ?? [])].filter((q) => q.name).map((q) => q.name));
      const seen = await waitFor(async () => {
        const [x, y] = [await named(a), await named(b)];
        return x.length && y.length ? [x, y] : null;
      }, 60000, 'each sees the other');
      check(seen[0].join() === 'Bravo' && seen[1].join() === 'Alpha', `exactly one other pilot each: Alpha sees ${JSON.stringify(seen[0])}, Bravo ${JSON.stringify(seen[1])}`);
    }
    await placeBravo(300);
    const far = await waitFor(async () => {
      await placeBravo(300);
      const t = await tagOf(a, 'Bravo');
      return t?.mode === 'far' ? t : null;
    }, 150000, 'the far tag');
    check(/^\d(\.\d)? ?k?m$|^\d+ m$/.test(far.dist) && far.px >= 12 && far.inside && far.level === null, `far tag at 300 units: ${JSON.stringify(far)}`);
    if (out) await a.screenshot({ path: `${out}/tags-far.png`, timeout: 120000 });
    await a.setViewportSize({ width: 360, height: 740 });
    const phone = await waitFor(async () => {
      await placeBravo(300);
      const t = await tagOf(a, 'Bravo');
      return t?.mode === 'far' ? t : null;
    }, 150000, 'the far tag on a phone');
    check(phone.px >= 12 && phone.inside, `far tag on a phone: ${JSON.stringify(phone)}`);
    if (out) await a.screenshot({ path: `${out}/tags-phone.png`, timeout: 120000 });
    await a.setViewportSize({ width: 1280, height: 800 });

    // the roster: Bravo's row, with a level chip and the line of whose side
    const row = a.locator('.universe-online-pilot', { hasText: 'Bravo' }).first();
    await rosterLine(a, 'Bravo');
    const lv = await row.locator('.universe-online-lv').textContent();
    check(/^Lv \d+$/.test(lv), `roster row: ${JSON.stringify((await row.textContent()).replace(/\s+/g, ' ').trim())}, chip ${JSON.stringify(lv)}, relation ${await row.getAttribute('data-relation')}`);
    // the record from your own row, and back
    await press(a.locator('.universe-online-me button', { hasText: 'Record' }));
    const record = await a.locator('.universe-record h3').textContent({ timeout: 120000 }).catch(() => null);
    check(record === 'Flight record', `the record opens from the roster (${record})`);
    await press(a.locator('.universe-record-back')).catch(() => {});

    // allies: Alpha asks, Bravo accepts
    const ids = await Promise.all([a, b].map((p) => p.evaluate(() => window.__universeDebug.net().selfId)));
    await a.evaluate((id) => window.__universeDebug.net().ally(id, 'ask'), ids[1]);
    await waitFor(() => b.evaluate((id) => window.__universeDebug.net().peers.get(id)?.ally === 'got', ids[0]), 60000, 'Bravo is asked');
    await b.evaluate((id) => window.__universeDebug.net().ally(id, 'accept'), ids[0]);
    await waitFor(() => a.evaluate((id) => window.__universeDebug.net().peers.get(id)?.ally === 'ally', ids[1]), 60000, 'Alpha and Bravo are allies');
    console.log('ok   allies');
    // (Bravo isn't always quite where put: the second one is checked to be
    // past TAG.far, 600 units, where a stranger's tag is gone)
    const km = (t) => (/ km$/.test(t.dist) ? parseFloat(t.dist) : parseFloat(t.dist) / 1000);
    for (const [dist, past] of [[300, 0], [1000, 6]]) {
      const t = await waitFor(async () => {
        await placeBravo(dist);
        const t = await tagOf(a, 'Bravo');
        return t?.relation === 'ally' && t.mode === 'far' && km(t) > past ? t : null;
      }, 150000, `the ally's tag at ${dist}`);
      check(t.opacity === '1' && t.px >= 12 && t.inside, `ally's tag at ${dist} units: ${JSON.stringify(t)}`);
    }
    // (put 20 off a kilometre away, Bravo comes in over a few frames as his
    // poses arrive, and his tag passes through the near band that shows a
    // distance, 40 to 140 units, on its way: it's read once he's in)
    const near = await waitFor(async () => {
      await placeBravo(20);
      const t = await tagOf(a, 'Bravo');
      return t?.mode === 'near' && t.dist === '' ? t : null;
    }, 150000, 'the near tag, Bravo in from where he was');
    check(/^Lv \d+$/.test(near.level ?? '') && near.dist === '', `near tag at 20 units: ${JSON.stringify(near)}`);
    if (out) await a.screenshot({ path: `${out}/tags-near.png`, timeout: 120000 });
    const mate = await waitFor(async () => {
      await placeBravo(-60);
      return a.evaluate(() => [...document.querySelectorAll('.universe-mate[data-on]')].map((m) => ({ name: m.textContent, off: m.hasAttribute('data-off') })).find((m) => m.name === 'Bravo') ?? null);
    }, 150000, 'the ally behind, marked at the edge');
    check(mate.off, `ally behind: ${JSON.stringify(mate)}`);
    if (out) await a.screenshot({ path: `${out}/mate.png`, timeout: 120000 });
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
    // what Alpha had: its ship, Bravo's last pose, the tags
    const seen = await a
      .evaluate(() => {
        const d = window.__universeDebug;
        const bravo = [...(d.net()?.peers.values() ?? [])].find((p) => p.name === 'Bravo');
        return { ship: d.state.ship, bravo: bravo?.pose ?? null, quietMs: bravo?.pose ? Math.round(window.performance.now() - bravo.pose.at) : null, where: bravo?.where, tags: [...document.querySelectorAll('.universe-tag')].map((t) => ({ on: t.hasAttribute('data-on'), text: t.textContent, mode: t.dataset.mode })) };
      })
      .catch((err) => ({ error: String(err) }));
    console.log(`     Alpha: ${JSON.stringify(seen)}`);
    if (out) await a.screenshot({ path: `${out}/fail-universe.png` }).catch(() => {});
  }
}

for (const w of universe ? [] : worlds) {
  await Promise.all([a.goto(BASE + w), b.goto(BASE + w)]);
  try {
    const n = await waitFor(async () => {
      await Promise.all([start(a), start(b)]);
      const [x, y] = [await chip(a), await chip(b)];
      return x >= 1 && y >= 1 ? [x, y] : null;
    }, 150000, `${w}: each sees the other`);
    const pointers = await a.locator('.presence-pilot').count();
    console.log(`ok   ${w}: chips ${n.join(' / ')}, page pointers drawn: ${pointers}`);
    // (on the fake relay there's nobody else: exactly one each)
    if (relays) check(n[0] === 1 && n[1] === 1, `${w}: exactly one other traveller each (${n.join(' / ')})`);
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
    const lv = await a.locator('.universe-online-pilot', { hasText: 'Bravo' }).first().locator('.universe-online-lv').textContent();
    check(/^Lv \d+$/.test(lv), `Bravo's row has a level chip (${lv})`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
  }
}
if (ride) {
  try {
    await Promise.all([a.goto(BASE + '/universe'), b.goto(BASE + '/universe')]);
    await Promise.all([a, b].map((p) => p.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 240000 })));
    // how Alpha draws Bravo: 'ship' or 'blip' (pilots.js's chart)
    const modeOf = () => a.evaluate(() => window.__universeDebug.pilots.chart.find((p) => p.name === 'Bravo')?.mode ?? null);
    console.log(`ok   Alpha sees Bravo on the map: ${await waitFor(modeOf, 150000, 'Alpha sees Bravo on the map')}`);
    // Bravo out at the world furthest from the middle of the map
    const far = await b.evaluate(async () => {
      const L = await import('/src/components/universe/layout.js');
      const id = L.ORDER.reduce((x, y) => (Math.hypot(L.POSITIONS[y][0], L.POSITIONS[y][2]) > Math.hypot(L.POSITIONS[x][0], L.POSITIONS[x][2]) ? y : x));
      const [x, y, z] = L.POSITIONS[id];
      const st = window.__universeDebug.state;
      st.auto = null;
      Object.assign(st.ship, { x: x + L.REACH[id] * 3, y, z, speed: 0 });
      return id;
    });
    console.log(`ok   Bravo out by ${far}: ${await waitFor(async () => ((await modeOf()) === 'blip' ? 'a blip' : null), 120000, 'Bravo far off is a blip')}`);
    if (out) await a.screenshot({ path: `${out}/online-far.png` });
    const line = await waitFor(async () => {
      const l = await rosterLine(a, 'Bravo').catch(() => '');
      return l.includes('here') ? null : l || null;
    }, 90000, `roster names where Bravo went (${then})`);
    console.log(`ok   roster: ${line}`);
    const lv = await a.locator('.universe-online-pilot', { hasText: 'Bravo' }).first().locator('.universe-online-lv').textContent();
    check(/^Lv \d+$/.test(lv), `Bravo's row has a level chip (${lv})`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
  }
}
if (ride) {
  try {
    await Promise.all([a.goto(BASE + '/universe'), b.goto(BASE + '/universe')]);
    await Promise.all([a, b].map((p) => p.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 240000 })));
    // how Alpha draws Bravo: 'ship', 'streak' or 'blip' (pilots.js's chart)
    const modeOf = () => a.evaluate(() => window.__universeDebug.pilots.chart.find((p) => p.name === 'Bravo')?.mode ?? null);
    console.log(`ok   Alpha sees Bravo on the map: ${await waitFor(modeOf, 150000, 'Alpha sees Bravo on the map')}`);
    // Bravo on the trunk whose middle is furthest from the middle of the map, halfway along
    const lane = await b.evaluate(async () => {
      const H = await import('/src/components/universe/hyperlanes.js');
      const R = await import('/src/components/universe/ride.js');
      const { bezier } = await import('/src/components/universe/lanes.js');
      const mid = (l) => bezier(H.carriageway(l, 'out'), 0.5);
      const lane = H.LANES.filter((l) => l.tier === 'trunk').sort((x, y) => Math.hypot(mid(y)[0], mid(y)[2]) - Math.hypot(mid(x)[0], mid(x)[2]))[0];
      const st = window.__universeDebug.state;
      st.auto = null;
      st.ride = { lane, way: 'out', s: 0.5, off: [0, 0], speed: 1500, from: 1500, age: 5, back: 0, strain: 0, bank: 0 };
      Object.assign(st.ship, R.poseOf(st.ride));
      return lane.id;
    });
    console.log(`ok   Bravo rides ${lane}: ${await waitFor(async () => ((await modeOf()) === 'streak' ? 'a streak' : null), 120000, 'Bravo riding far off is a streak')}`);
    if (out) await a.screenshot({ path: `${out}/online-streak.png` });
    const line = await waitFor(async () => {
      const l = await rosterLine(a, 'Bravo').catch(() => '');
      return /Universe · /.test(l) ? l : null;
    }, 60000, 'the roster names Bravo’s region');
    console.log(`ok   roster: ${line}`);
    // in beside Alpha
    const near = await a.evaluate(() => {
      const s = window.__universeDebug.state.ship;
      return [s.x + 40, s.y, s.z + 40];
    });
    await b.evaluate(([x, y, z]) => {
      const st = window.__universeDebug.state;
      Object.assign(st.ship, { x, y, z, speed: 0 });
    }, near);
    console.log(`ok   Bravo beside Alpha: ${await waitFor(async () => ((await modeOf()) === 'ship' ? 'a ship' : null), 120000, 'Bravo near is a ship')}`);
    if (out) await a.screenshot({ path: `${out}/online-ship.png` });
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
  }
}
// planet flight: begin
if (fly) {
  try {
    const n = await flyCheck({ a, b, relays, durable: fakeDurable(), base: BASE, check, waitFor });
    console.log(`fly: ${JSON.stringify(n)}`);
    // (and one event, the same in both: ./lib/storm-check.mjs)
    console.log(`storm: ${JSON.stringify(await stormCheck({ a, b, check, waitFor }))}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
  }
}
// planet flight: end
console.log(`errors: ${JSON.stringify(errors.slice(0, 10))}`);
console.log(failed ? `${failed} FAILED` : 'ALL OK');
await browser.close();
process.exit(failed ? 1 : 0);
