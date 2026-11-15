/* global window */
// The endless universe flown in a browser, on a fixed route, checking what
// can't be checked in Node: that generated space comes in round the ship in
// every direction with nothing popping, that the old rim and a sector's face
// are crossed without a seam, that a generated system is built whole as the
// ship comes in, and that the ship climbs 50,000 straight up and is never
// turned back.
//
//   node scripts/universe-endless-check.mjs [--quality mid|low] [--url http://127.0.0.1:5173]
//
// Steps, each waited for on a condition, never a time: `start` (the default
// start with a ship), `old-rim` (from inside where the rim was to past it, on
// the pulse drive), `boundary` (across x = 60,000, till the new face is in),
// `system` (into the nearest generated system, till it's built whole) and
// `climb` (up to 50,000 above home, a few thousand a step), `gargantuan` (to
// 15,000 past the edge of the nearest, till its mesh is built) and a sweep of
// every kind of thing drawn near (lane 4a's), each from inside its reach till
// its drawer shows it. Each records the
// pops (the far layer's: a disc from nothing to whole in a frame), the
// Expanse's own time a frame, the draw calls and triangles, the places within
// 9,000 and the nearest (generated, and the site's own stations, worlds and
// wonders), and the page's errors.
//
// Exit 1 on a pop over 4 px, an error, a step that never arrives, fewer than
// three places within 9,000 or none within 6,000 (the spec's numbers), or the
// ship pushed back down on the climb. The Expanse's time is printed, not
// judged: headless Chromium draws in software here, so it says little of a
// real chip (its budget is universe/budget.js's `expanseMs`).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChromium } from './lib/chromium.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const QUALITY = arg('quality', 'mid');
const freePort = () =>
  new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });

let server = null;
let base = arg('url', null)?.replace(/\/$/, '') ?? null;
if (!base) {
  const port = await freePort();
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = `http://127.0.0.1:${port}`;
  const up = Date.now();
  for (;;) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    if (Date.now() - up > 60000) throw new Error('the dev server never answered');
    await new Promise((r) => setTimeout(r, 300));
  }
}

const exe = findChromium() ?? ['/opt/pw-browsers/chromium'].find(existsSync);
if (!exe) throw new Error('no Chromium (set CHROMIUM=/path/to/chrome)');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-quality', q);
  window.localStorage.setItem('tp-universe-ship', '"falcon"');
  window.__tpKeepFrames = true;
}, QUALITY);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

let failed = 0;
const fail = (what) => {
  failed++;
  console.log(`FAIL ${what}`);
};
const until = (fn, arg, timeout = 240000) =>
  page
    .waitForFunction(fn, arg, { timeout, polling: 500 })
    .then(() => true)
    .catch(() => false);
const read = () =>
  page.evaluate(() => {
    const d = window.__universeDebug;
    const ex = d.expanse;
    const s = d.state.ship;
    const here = s ? [s.x, s.y, s.z] : [0, 0, 0];
    // (the places round the ship: the generated ones, and the site's own, its stations, worlds and wonders)
    const around = ex.around(here, 9000);
    const own = [...d.planets.map((p) => p.group.position.toArray()), ...d.wonders.map((w) => w.at)];
    for (const p of own) {
      const dist = Math.hypot(p[0] - here[0], p[1] - here[1], p[2] - here[2]);
      if (dist <= 9000) around.count++;
      around.nearest = Math.min(around.nearest, dist);
    }
    return { at: here.map(Math.round), sector: ex.sector(), loaded: ex.loaded().length, built: [...ex.built()], workMs: +ex.workMs().toFixed(2), discs: d.farStars.discs.count(), calls: d.renderer.info.render.calls, tris: d.renderer.info.render.triangles, around, pops: d.farStars.pops() };
  });
const step = async (name, go, arrived, arg) => {
  await page.evaluate(() => window.__universeDebug.farStars.pops()); // (counted from here)
  if (go) await page.evaluate(go, arg);
  const ok = await until(arrived);
  if (!ok) return fail(`${name}: never arrived`);
  await page.waitForTimeout(1500);
  const r = await read();
  console.log(`${name.padEnd(9)} ${JSON.stringify(r)}`);
  if (r.pops.px > 4) fail(`${name}: a pop of ${Math.round(r.pops.px)} px`);
  if (r.around.count < 3) fail(`${name}: ${r.around.count} places within 9,000 (want 3)`);
  if (r.around.nearest > 6000) fail(`${name}: the nearest place is ${Math.round(r.around.nearest)} off (want 6,000 or less)`);
  return r;
};

try {
  await page.goto(`${base}/?quality=${QUALITY}#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (!(await until(() => typeof window.__universe === 'function' && window.__universe().ship && window.__universeDebug?.state?.model, null, 300000))) throw new Error('the map never came up');
  const loaded27 = () => window.__universeDebug.expanse.loaded().length >= 27;
  await step('start', null, loaded27);
  await step('old-rim', () => window.__universeDebug.teleport(47000, 0, 0, -Math.PI / 2, 0), () => window.__universeDebug.state.ship.x >= 46000 && window.__universeDebug.expanse.loaded().length >= 27);
  await page.evaluate(() => window.__universeDebug.teleport(53000, 0, 0, -Math.PI / 2, 0));
  await step('boundary', () => window.__universeDebug.teleport(61000, 0, 0, -Math.PI / 2, 0), () => window.__universeDebug.expanse.sector() === 'E:1,0' && window.__universeDebug.expanse.loaded().length >= 27);
  await step(
    'system',
    () => {
      const d = window.__universeDebug;
      const s = d.state.ship;
      const n = d.expanse.nearestSystem([s.x, s.y, s.z]);
      const a = n.system.at;
      d.teleport(a[0], a[1] + n.system.reach * 0.3, a[2] + n.system.reach * 0.8, 0, -0.25);
    },
    () => window.__universeDebug.expanse.built().size > 0,
  );
  // the climb: 5,000 at a time, never pushed back down
  let lowest = Infinity;
  for (let y = 5000; y <= 50000; y += 5000) {
    await page.evaluate((y) => window.__universeDebug.teleport(0, y, 3000, 0, 0.6), y);
    await page.waitForTimeout(400);
    const at = await page.evaluate(() => window.__universeDebug.state.ship.y);
    if (at < y - 50) lowest = Math.min(lowest, at - y);
  }
  if (lowest < 0) fail(`climb: pushed back down by ${Math.round(-lowest)}`);
  await step('climb', null, loaded27);
  // a gargantuan (lane 4a's): the nearest in the 3 × 3 × 3, from 15,000 past its edge, till its mesh is up
  const giant = await page.evaluate(() => {
    const s = window.__universeDebug.state.ship;
    let best = null;
    for (const sec of window.__universeDebug.expanse.sectors().values())
      for (const g of [...(sec.extras?.gargantuan ?? []), ...(sec.extras?.arrival ?? [])]) {
        const d = Math.hypot(g.at[0] - s.x, g.at[1] - s.y, g.at[2] - s.z);
        if (!best || d < best.d) best = { id: g.id, kind: g.kind, at: g.at, size: g.size, d };
      }
    return best;
  });
  if (!giant) fail('gargantuan: none in the 3 × 3 × 3');
  else {
    const shown = (id) => {
      let on = false;
      window.__universeDebug.scene.traverse((o) => {
        if (o.name === `gargantuan:${id}` && o.visible) on = true;
      });
      return on;
    };
    const r = await step(
      'gargantuan',
      (g) => window.__universeDebug.teleport(g.at[0], g.at[1], g.at[2] + g.size + 15000, 0, 0),
      () => window.__universeDebug.expanse.loaded().length >= 27,
      giant,
    );
    if (r && !(await until(shown, giant.id, 120000))) fail(`gargantuan: ${giant.kind} ${giant.id} never built near`);
    else if (r) console.log(`          ${giant.kind} ${giant.id} built, ${Math.round(giant.d)} off at the start`);
  }
  // every kind of thing drawn near (lane 4a's dev sweep): the nearest of each in the 3 × 3 × 3, from
  // inside its reach, till its drawer shows it. (The lattice's kinds in THING_KINDS' order.)
  const LATTICE = ['rock', 'ice', 'derelict', 'rogue', 'outpost', 'beacon', 'relay', 'monolith'];
  const KINDS = ['outpost', 'beacon', 'relay', 'monolith', 'comet', 'field', 'icefield', 'rig', 'debris', 'fleet', 'shipyard', 'storm', 'herd', 'swarm', 'pulsar', 'magnetar', 'protostar', 'wormhole'];
  for (const kind of KINDS) {
    const spot = await page.evaluate(
      ([kind, lattice]) => {
        const s = window.__universeDebug.state.ship;
        const k = lattice.indexOf(kind);
        // (where a mover is now: gen/paths.js's pathAt, restated, on the shared clock)
        const t = Date.now() / 1000;
        const frac = (x) => x - Math.floor(x);
        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const now = (r) => {
          const p = r.path;
          if (!p) return r.at;
          if (p.type === 'kepler') {
            const M = 2 * Math.PI * (frac(t / p.period) + p.phase);
            let E = M + p.e * Math.sin(M);
            for (let i = 0; i < 30; i++) E -= (E - p.e * Math.sin(E) - M) / (1 - p.e * Math.cos(E));
            const a = p.q / (1 - p.e);
            const x = a * (Math.cos(E) - p.e);
            const y = a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
            const side = cross(p.normal, p.peri);
            return [0, 1, 2].map((i) => p.focus[i] + x * p.peri[i] + y * side[i]);
          }
          const th = 2 * Math.PI * frac(p.revs * frac(t / 65536) + p.phase);
          const side = cross(p.normal, p.ref);
          return [0, 1, 2].map((i) => p.centre[i] + Math.cos(th) * p.radius * p.ref[i] + Math.sin(th) * p.radius * side[i]);
        };
        let best = null;
        const take = (at, size, reach) => {
          const d = Math.hypot(at[0] - s.x, at[1] - s.y, at[2] - s.z);
          if (!best || d < best.d) best = { at, size, reach, d };
        };
        for (const sec of window.__universeDebug.expanse.sectors().values()) {
          if (k >= 0) {
            const t = sec.things;
            for (let i = 0; i < t.count; i++) if (t.kind[i] === k) take([0, 1, 2].map((a) => sec.origin[a] + t.at[i * 3 + a]), t.size[i], 30 * t.size[i]);
          } else for (const rows of Object.values(sec.extras ?? {})) for (const r of rows) if (r.kind === kind) take(now(r), r.size, 8 * r.size);
        }
        return best;
      },
      [kind, LATTICE],
    );
    if (!spot) {
      console.log(`kind      ${kind}: none in the 3 × 3 × 3`);
      continue;
    }
    await page.evaluate((p) => window.__universeDebug.teleport(p.at[0], p.at[1], p.at[2] + Math.max(p.size * 2.5, p.reach * 0.4), 0, 0), spot);
    const drawn = await until(
      (kind) => {
        let n = 0;
        window.__universeDebug.scene.traverse((o) => {
          if (o.name?.startsWith(`things:${kind}:`) && o.visible) n += o.count ?? 1;
        });
        return n > 0;
      },
      kind,
      90000,
    );
    console.log(`kind      ${kind.padEnd(9)} ${drawn ? 'drawn' : 'NOT drawn'}`);
    if (!drawn) fail(`kind: ${kind} never drawn near`);
  }
  // what you can do (lane 4a's): E at a debris field salvages it; an ion storm drains the shields
  const nearest = (kind) =>
    page.evaluate((kind) => {
      const s = window.__universeDebug.state.ship;
      let best = null;
      for (const sec of window.__universeDebug.expanse.sectors().values())
        for (const r of sec.extras?.[kind] ?? []) {
          const d = Math.hypot(r.at[0] - s.x, r.at[1] - s.y, r.at[2] - s.z);
          if (!best || d < best.d) best = { at: r.at, size: r.size, path: r.path ?? null, d };
        }
      return best;
    }, kind);
  const debris = await nearest('debris');
  if (debris) {
    await page.evaluate((p) => window.__universeDebug.teleport(p.at[0], p.at[1], p.at[2], 0, 0), debris);
    const said = await until(() => /^E: /.test(window.__universeDebug.state.note?.text ?? ''), null, 60000);
    await page.keyboard.press('e');
    const done = said && (await until(() => /^Salvaged /.test(window.__universeDebug.state.note?.text ?? ''), null, 30000));
    console.log(`act       salvage ${done ? 'ok' : 'NOT done'}`);
    if (!done) fail('act: E at debris never salvaged it');
  }
  const storm = await nearest('storm');
  if (storm) {
    // (its middle on its loop now, as the sweep works it out; the drain is 4 a second)
    await page.evaluate((p) => {
      const q = p.path;
      const fr = (x) => x - Math.floor(x);
      const th = 2 * Math.PI * fr(q.revs * fr(Date.now() / 1000 / 65536) + q.phase);
      const side = [q.normal[1] * q.ref[2] - q.normal[2] * q.ref[1], q.normal[2] * q.ref[0] - q.normal[0] * q.ref[2], q.normal[0] * q.ref[1] - q.normal[1] * q.ref[0]];
      const c = [0, 1, 2].map((i) => q.centre[i] + Math.cos(th) * q.radius * q.ref[i] + Math.sin(th) * q.radius * side[i]);
      window.__universeDebug.state.shield = 100;
      window.__universeDebug.teleport(c[0], c[1], c[2], 0, 0);
    }, storm);
    const drained = await until(() => window.__universeDebug.state.shield < 99, null, 60000);
    console.log(`act       storm drain ${drained ? 'ok' : 'NOT seen'}`);
    if (!drained) fail('act: an ion storm never drained the shields');
  }
} catch (e) {
  fail(String(e.message ?? e));
} finally {
  if (errors.length) fail(`errors: ${JSON.stringify(errors.slice(0, 8))}`);
  await browser.close();
  server?.kill();
}
console.log(failed ? `${failed} failed` : 'ok');
process.exit(failed ? 1 : 0);
