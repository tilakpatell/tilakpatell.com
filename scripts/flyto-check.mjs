/* global window, document */
// A browser check of flying to another pilot (universe/pilotGoal.js, the
// scene's `pilot:<id>`), on the real relays: two visitors (Alpha and Bravo,
// two browser profiles) go online on the universe map, each with a ship.
// Bravo parks at a world; Alpha opens the roster and presses “Fly to” on
// Bravo, and within 90 s Alpha's ship should be within 8 units of Bravo's
// (window.__universeDebug's state.ship, and pilots.pose(Bravo's id)), the
// HUD saying “With Bravo”. Then a second run: Alpha jumps away, flies to
// Bravo again, and Bravo goes offline mid-trip: Alpha's autopilot should
// stop, the HUD say “Bravo has gone”, and no console error come up.
// With --galaxy, the same in a galaxy system (/galaxy/yavin, or --system),
// through window.__galaxyDebug. With the dev server up (npx vite --port 5173):
//   node scripts/flyto-check.mjs [--galaxy] [--system yavin]
// --fake checks the scene's side alone, with no relays: one visitor,
// offline, and a made-up pilot (“Fakey”) whose pose the page's own
// pilots.pose hands the scene, moving; the trip to them, re-aimed and
// ended within 8; on the hyperdrive, out behind them as they are at the
// flash; in the other sector, by the portal (on the universe map); and
// their pose gone mid-trip: the autopilot off, the goal gone, the HUD
// saying so, no error. The roster's button and the relays aren't in it.
// PORT=5175 for a dev server on another port. Behind a proxy: HTTPS_PROXY,
// and BRIDGE=1 NODE_USE_ENV_PROXY=1 if the browser's WebSockets can't get
// through it (scripts/online-check.mjs has the same). RELAY=fake runs it
// with no network: the relays faked in here (lib/fake-relays.mjs), each
// context attached to them. The relays are public: anyone else online at
// the time is ignored, by callsign.
import { chromium } from 'playwright-core';
import { fakeRelays } from './lib/fake-relays.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const galaxy = args.includes('--galaxy');
const fake = args.includes('--fake');
const system = flag('--system', 'yavin');
const out = process.env.OUT ?? null;
const PORT = process.env.PORT ?? '5173';
const BASE = `http://localhost:${PORT}/?quality=low#`;
const PATH = galaxy ? `/galaxy/${system}` : '/universe';
const DEBUG = galaxy ? '__galaxyDebug' : '__universeDebug';
// (tagged per run, so a pilot from an earlier run still in the relays' memory isn't the one flown to)
const tag = Math.random().toString(36).slice(2, 5).toUpperCase();
const ALPHA = `Alpha${tag}`;
const BRAVO = `Bravo${tag}`;
const proxy = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=localhost;127.0.0.1'] : [];
if (process.env.PROXY_CA_SPKI) proxy.push(`--ignore-certificate-errors-spki-list=${process.env.PROXY_CA_SPKI}`, '--disable-http2');
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: [...proxy, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const relays = process.env.RELAY === 'fake' ? fakeRelays() : null;

const errors = [];
let failed = 0;
const ok = (good, what) => {
  if (!good) failed++;
  console.log(good ? 'ok  ' : 'FAIL', what);
};
async function visitor(name, ship, viewport) {
  // (small: two pages drawing in software at once, each sending its pose a
  // frame at a time; a pose that doesn't come for STALE_MS is a pilot gone)
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(
    ([n, s]) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-tour', '"skipped"'); // (the site tour's offer would sit over the roster)
      window.localStorage.setItem('tp-universe-online', JSON.stringify('on'));
      window.localStorage.setItem('tp-universe-callsign', JSON.stringify(n));
      window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
      window.localStorage.setItem('tp-universe-drive', JSON.stringify('super'));
      window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D without the gate's asking: software GL is slow)
      window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
      window.sessionStorage.setItem('tp-gl-anyway', 'true');
      window.sessionStorage.setItem('tp-galaxy-intro', '1'); // (the galaxy's “long time ago” seen)
      // every line the HUD shows, kept (a note is up for a few seconds of the wall's time)
      window.__hud = [];
      const keep = () => {
        const t = document.querySelector('.universe-prompt, .galaxy-note')?.textContent;
        if (t && window.__hud.at(-1) !== t) window.__hud.push(t);
      };
      new window.MutationObserver(keep).observe(document, { childList: true, subtree: true, characterData: true });
    },
    [name, ship],
  );
  // RELAY=fake: the relays faked in here, for every context alike
  if (relays) await relays.attach(ctx);
  // BRIDGE=1: the relays reached from Node (through the proxy with
  // NODE_USE_ENV_PROXY=1) rather than from the browser
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
const waitFor = async (fn, ms, what) => {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t > ms) throw new Error(`timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
};
// the scene's handle, once its ship is flying
const ready = (page) => page.waitForFunction((d) => window[d]?.state?.ship && window[d].net?.(), DEBUG, { timeout: 240000, polling: 500 });
const selfId = (page) => page.evaluate((d) => window[d].net()?.selfId ?? null, DEBUG);
// what Alpha has of the trip: its ship, Bravo's pose, the autopilot's goal, the HUD's line
const trip = (page, id) =>
  page.evaluate(
    ([d, id]) => {
      const g = window[d];
      const s = g.state.ship;
      const p = g.pilots.pose(id);
      return {
        dist: s && p ? Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) : null,
        pilot: g.state.auto?.pilot ?? null,
        auto: g.state.auto?.id ?? null,
        goal: Boolean(g.state.auto?.space?.goals?.[`pilot:${id}`]),
        hud: window.__hud.join(' | '),
        ship: s && { x: +s.x.toFixed(1), y: +s.y.toFixed(1), z: +s.z.toFixed(1), speed: +s.speed.toFixed(1) },
        bravo: p && { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) },
        // (and why it mightn't go: mid-jump, crashed, diving in, on foot)
        jump: g.state.jump?.id ?? null,
        crash: Boolean(g.state.crash),
        dive: Boolean(g.state.dive),
        foot: g.foot?.phase ?? null,
      };
    },
    [DEBUG, id],
  );
// a button by its name (the roster's “Fly to <name>”, “Go offline”), the
// roster opened from the corner first; clicked in the page itself (a canvas
// drawing in software never counts as settled for Playwright's own click)
const press = (page, label) =>
  waitFor(
    () =>
      page.evaluate((label) => {
        const pill = document.querySelector('.universe-online-pill');
        if (pill?.getAttribute('aria-expanded') !== 'true') pill?.click();
        const b = [...document.querySelectorAll('.universe-online-card button')].find((el) => (el.getAttribute('aria-label') ?? el.textContent.trim()) === label);
        b?.click();
        return Boolean(b);
      }, label),
    90000,
    `the button “${label}”`,
  );
// a place to sit still at: a jump there (or, in a system, wherever it is, stopped)
const park = (page, where) =>
  page.evaluate(
    ([d, where]) => {
      const g = window[d];
      if (where && g.travel) return g.travel(where, 'hyper');
      g.state.auto = null;
      return true;
    },
    [DEBUG, galaxy ? null : where],
  );


// ── --fake: the scene alone, with a made-up pilot ──
if (fake) {
  const page = await visitor('Solo', 'xwing', { width: 640, height: 400 });
  await page.addInitScript(() => window.localStorage.setItem('tp-universe-online', JSON.stringify('off')));
  try {
    await page.goto(BASE + PATH);
    await page.waitForFunction((d) => window[d]?.state?.ship, DEBUG, { timeout: 240000, polling: 500 });
    await page.waitForTimeout(3000);
    // Fakey: `ahead` units ahead of the ship, drifting on at `v` units a second
    // of the wall's time, or gone; the scene asks pilots.pose for them
    const place = (ahead, v = 0.4, dx = 0, dz = 0) =>
      page.evaluate(
        ([d, ahead, v, dx, dz]) => {
          const g = window[d];
          const s = g.state.ship;
          g.state.auto = null;
          g.state.ship = { ...s, speed: 0, vy: 0 };
          const h = s.heading + 0.6;
          const f = { x: s.x - Math.sin(s.heading) * ahead + dx, y: s.y, z: s.z - Math.cos(s.heading) * ahead + dz, heading: h, t0: performance.now(), v, gone: false };
          window.__fakey = f;
          if (!g.pilots.__real) {
            g.pilots.__real = g.pilots.pose;
            g.pilots.pose = (id) => {
              const p = window.__fakey;
              if (id !== 'fake' || !p || p.gone) return g.pilots.__real(id);
              const t = (performance.now() - p.t0) / 1000;
              return { x: p.x - Math.sin(p.heading) * p.v * t, y: p.y, z: p.z - Math.cos(p.heading) * p.v * t, heading: p.heading, name: 'Fakey' };
            };
          }
          return true;
        },
        [DEBUG, ahead, v, dx, dz],
      );
    // (asked till it goes: a ship just out of hyperspace into the system can't set off yet)
    const go = (drive) =>
      waitFor(() => page.evaluate(([d, drive, galaxy]) => (galaxy ? window[d].flyTo('fake') : window[d].travel('pilot:fake', drive)), [DEBUG, drive, galaxy]), 60000, 'the trip to go').catch(() => false);
    const look = () =>
      page.evaluate((d) => {
        const g = window[d];
        const s = g.state.ship;
        const p = g.pilots.pose('fake');
        return {
          dist: p ? Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) : null,
          auto: g.state.auto?.id ?? null,
          pilot: g.state.auto?.pilot ?? null,
          park: g.state.auto?.park ? [g.state.auto.park.x, g.state.auto.park.z].map((n) => +n.toFixed(2)) : null,
          goal: Boolean(g.state.auto?.space?.goals?.['pilot:fake']),
          then: g.state.then?.id ?? null,
          jump: g.state.jump?.id ?? null,
          hud: window.__hud.join(' | '),
        };
      }, DEBUG);

    // the trip: re-aimed as Fakey drifts, and over within 8 of them
    await place(galaxy ? 45 : 60, 0.15); // (slow: software GL's frames come slowly, the scene's clock goes by them, and Fakey drifts by the wall's)
    ok(await go('super'), 'the scene takes a trip to pilot:fake');
    const first = await look();
    ok(first.pilot === 'fake' && first.goal, `state.auto is { id: ${first.auto}, pilot: ${first.pilot} } with their goal in its space`);
    const parks = new Set();
    const there = await waitFor(async () => {
      const r = await look();
      if (r.park) parks.add(r.park.join());
      return r.dist !== null && r.dist <= 8 && !r.auto ? r : null;
    }, 180000, 'within 8 of Fakey').catch(async (e) => (ok(false, `${e.message}: ${JSON.stringify(await look())}`), null));
    if (there) {
      ok(parks.size > 1, `the park re-aimed as they moved (${parks.size} parks seen)`);
      ok(true, `within ${there.dist.toFixed(1)} of Fakey, the autopilot off`);
      ok(there.hud.includes('With Fakey'), `the HUD says “${there.hud}”`);
    }

    if (!galaxy) {
      // on the hyperdrive: out behind them as they are at the flash
      await page.waitForTimeout(11000); // (the hyperdrive charging since any jump before)
      await place(300, 0.15); // (slow, as above: the check reads it a while after the flash)
      await page.evaluate(() => (window.__hud = []));
      ok(await go('hyper'), 'a jump to Fakey');
      const jumped = await waitFor(async () => {
        const r = await look();
        return !r.jump && r.hud ? r : null;
      }, 120000, 'out of the jump').catch(async (e) => (ok(false, `${e.message}: ${JSON.stringify(await look())}`), null));
      if (jumped) ok(jumped.dist !== null && jumped.dist < 8.5 && jumped.hud.includes('With Fakey'), `out of the jump ${jumped.dist?.toFixed(1)} from Fakey (they drift on slowly), the HUD “${jumped.hud}”`);

      // in the other sector: by the portal, Fakey still the trip's end
      await place(0, 0, 0, -40000 - (await page.evaluate((d) => window[d].state.ship.z, DEBUG)) + 300);
      ok(await go('super'), 'a trip to Fakey in the other sector');
      const r = await look();
      ok(r.auto === 'rmportal' && r.then === 'pilot:fake', `it goes by the portal first (auto ${r.auto}, then ${r.then})`);
      await page.evaluate((d) => window[d].state && (window[d].state.auto = null, window[d].state.then = null), DEBUG);
    }

    // gone mid-trip: the autopilot off, their goal gone, the HUD says so, no error
    // (far enough off that super speed is still on its way a second in)
    await place(galaxy ? 90 : 1500);
    await page.evaluate(() => (window.__hud = []));
    ok(await go('super'), 'a trip to Fakey again');
    await page.waitForTimeout(galaxy ? 3000 : 1000);
    const mid = await look();
    ok(mid.pilot === 'fake', `under way (${JSON.stringify(mid)})`);
    const before = errors.length;
    await page.evaluate(() => (window.__fakey.gone = true));
    const gone = await waitFor(async () => {
      const r = await look();
      return r.hud.includes('has gone') ? r : null;
    }, 60000, 'the HUD says Fakey has gone').catch(async (e) => (ok(false, `${e.message}: ${JSON.stringify(await look())}`), null));
    if (gone) {
      ok(true, `the HUD says “${gone.hud}”`);
      ok(!gone.auto && !gone.pilot && !gone.goal, `the autopilot stopped and the goal's gone (auto ${gone.auto})`);
    }
    await page.waitForTimeout(3000);
    ok(errors.length === before, `no console error as they went (${errors.slice(before).join(' | ') || 'none'})`);
    if (out) await page.screenshot({ path: `${out}/flyto-fake${galaxy ? '-galaxy' : ''}.png` });
  } catch (e) {
    ok(false, e.message);
  }
  console.log(`errors: ${JSON.stringify(errors.slice(0, 10))}`);
  console.log(failed ? `${failed} FAILED` : 'ALL OK');
  await browser.close();
  process.exit(failed ? 1 : 0);
}

const a = await visitor(ALPHA, 'xwing', { width: 640, height: 400 });
const b = await visitor(BRAVO, 'falcon', { width: 320, height: 240 });
try {
  await Promise.all([a.goto(BASE + PATH), b.goto(BASE + PATH)]);
  await Promise.all([ready(a), ready(b)]);
  const bravoId = await waitFor(() => selfId(b), 60000, 'Bravo online');
  // Bravo parked at a world (and Alpha somewhere else near it), still
  await park(b, 'home');
  await park(a, 'resume');
  await a.waitForTimeout(8000);
  const seen = await waitFor(async () => {
    const r = await trip(a, bravoId);
    return r.dist !== null ? r : null;
  }, 120000, 'Alpha sees Bravo flying');
  ok(true, `Alpha sees ${BRAVO} (${bravoId.slice(0, 8)}…), ${seen.dist.toFixed(0)} units off`);
  // (Alpha put 40 units behind Bravo, side on, so the trip is a short one:
  // in software a frame can take a second, and the scene's clock goes by frames)
  const near = await a.evaluate(
    ([d, id]) => {
      const g = window[d];
      const p = g.pilots.pose(id);
      if (!p) return false;
      g.state.ship = { ...g.state.ship, x: p.x + Math.sin(p.heading) * 40, y: p.y, z: p.z + Math.cos(p.heading) * 40, heading: p.heading + Math.PI / 2, speed: 0, vy: 0 };
      return true;
    },
    [DEBUG, bravoId],
  );
  if (near) console.log('note Alpha put 40 units behind Bravo');

  // 1. Fly to: there within 90 s. (On public relays a pilot's poses can stop
  // coming for longer than STALE_MS while they're still online, and the trip
  // then rightly ends with “has gone”: that's said, and it's tried again, up
  // to three times. `gaps` counts the seconds Alpha had no pose for Bravo)
  let there = null;
  for (let attempt = 1; attempt <= 3 && !there; attempt++) {
    await a.evaluate(() => (window.__hud = []));
    await press(a, `Fly to ${BRAVO}`);
    const t0 = Date.now();
    let gaps = 0;
    let started = false;
    const end = await waitFor(async () => {
      const r = await trip(a, bravoId);
      if (r.dist === null) gaps++;
      if (r.pilot === bravoId) started = true;
      if (r.dist !== null && r.dist <= 8 && !r.auto) return { ...r, how: 'there' };
      if (r.hud.includes('has gone')) return { ...r, how: 'lost' };
      return null;
    }, 90000, 'Alpha within 8 of Bravo').catch(async (e) => ({ ...(await trip(a, bravoId)), how: e.message }));
    const s = ((Date.now() - t0) / 1000).toFixed(0);
    if (end.how === 'there') {
      there = end;
      ok(started, `attempt ${attempt}: the autopilot took Alpha to ${BRAVO} (state.auto.pilot was Bravo's id)`);
      ok(true, `attempt ${attempt}: within ${end.dist.toFixed(1)} units of ${BRAVO} in ${s} s, the autopilot off (${gaps} s without Bravo's pose)`);
      ok(end.hud.includes(`With ${BRAVO}`), `the HUD says “${end.hud}”`);
    } else console.log(`note attempt ${attempt}: ${end.how} after ${s} s (started ${started}, ${gaps} s without Bravo's pose): ${JSON.stringify(end)}`);
  }
  if (!there) ok(false, `Alpha never got within 8 of ${BRAVO} in three tries`);
  if (out) await a.screenshot({ path: `${out}/flyto-there.png` });

  // 2. Bravo goes offline mid-trip
  if (!galaxy) await waitFor(async () => park(a, 'projects'), 30000, 'Alpha jumps away');
  else
    await a.evaluate((d) => {
      const g = window[d];
      g.state.ship = { ...g.state.ship, x: g.state.ship.x + 160, speed: 0 };
    }, DEBUG);
  await a.waitForTimeout(6000);
  await a.evaluate(() => (window.__hud = []));
  await press(a, `Fly to ${BRAVO}`);
  await waitFor(async () => (await trip(a, bravoId)).pilot === bravoId, 30000, 'on the way to Bravo again');
  await a.waitForTimeout(2500);
  const before = errors.length;
  await press(b, 'Go offline');
  const gone = await waitFor(async () => {
    const r = await trip(a, bravoId);
    return r.hud.includes('has gone') ? r : null;
  }, 30000, 'the HUD says Bravo has gone').catch(async (e) => (ok(false, `${e.message}: ${JSON.stringify(await trip(a, bravoId))}`), null));
  if (gone) {
    ok(true, `the HUD says “${gone.hud}”`);
    ok(!gone.auto && !gone.pilot && !gone.goal, `the autopilot stopped and the goal's gone (auto ${gone.auto})`);
  }
  await a.waitForTimeout(3000);
  ok(errors.length === before, `no console error as Bravo went (${errors.slice(before).join(' | ') || 'none'})`);
  if (out) await a.screenshot({ path: `${out}/flyto-gone.png` });
} catch (e) {
  ok(false, e.message);
  // what each had: the link's status and who's in the room, and its own ship
  for (const [who, p] of [[ALPHA, a], [BRAVO, b]]) {
    const seen = await p
      .evaluate((d) => {
        const g = window[d];
        const net = g?.net?.();
        return {
          status: net?.snapshot?.().status ?? null,
          peers: [...(net?.peers?.values() ?? [])].map((q) => ({ id: q.id.slice(0, 8), name: q.name, where: q.where, kind: q.kind, snaps: q.snaps?.length ?? 0 })),
          ship: g?.state?.ship && { x: Math.round(g.state.ship.x), z: Math.round(g.state.ship.z) },
          auto: g?.state?.auto?.id ?? null,
          jump: g?.state?.jump?.id ?? null,
        };
      }, DEBUG)
      .catch((err) => ({ error: String(err) }));
    console.log(`     ${who}: ${JSON.stringify(seen)}`);
  }
  if (out) await a.screenshot({ path: `${out}/flyto-fail.png` }).catch(() => {});
}
console.log(`errors: ${JSON.stringify(errors.slice(0, 10))}`);
console.log(failed ? `${failed} FAILED` : 'ALL OK');
await browser.close();
process.exit(failed ? 1 : 0);
