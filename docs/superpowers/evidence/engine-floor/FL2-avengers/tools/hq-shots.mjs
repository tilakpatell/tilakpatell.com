/* global window, document, WebGL2RenderingContext */
// The Avengers’ and Invincible’s opening shots, the same frame on every run:
// lane FL2’s parity gate (a repair changes no pixel). Each target is opened
// on Vite’s dev server (the dev hooks are how its frames are counted) with
// the page’s clock installed and stopped and Math.random seeded, so time in
// the page moves only in the 16 ms frames let run here. Frames are let run
// one at a time, the frame guard off (its shaders link in real time); the
// target’s own drawing call (its engine’s `render`, the
// one its page’s frame loop makes each frame) is wrapped as soon as the
// target is there and counted, and the page is shot after exactly
// `--frames` of them: however long the loading took in real time, the game
// is the same number of its own frames in. (The Invincible cast viewer has
// no dev hook on main: its frames are counted as the frames its canvas was
// drawn to, read from WebGL’s draws to the screen.)
//
//   node tools/hq-shots.mjs --out <dir> [--ref origin/main] [--only a,b]
//     [--frames 90] [--quality low|high] [--resume] [--limit 900]
//   node tools/hq-shots.mjs --compare <dirA> <dirB>
//
// --ref serves a worktree of that ref (this checkout’s node_modules linked
// in); without it, this checkout. --compare counts the pixels that differ
// at all between each pair of PNGs of the same name (exit 1 on any).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  args[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : argv[++i];
}
const sharp = (await import('sharp')).default;

if (args.compare) {
  const a = args.compare;
  const b = argv[argv.indexOf(a) + 1];
  let bad = 0;
  for (const name of readdirSync(a).filter((n) => n.endsWith('.png')).sort()) {
    if (!existsSync(join(b, name))) {
      console.log(`${name}: missing in ${b}`);
      bad++;
      continue;
    }
    const [x, y] = await Promise.all([a, b].map((d) => sharp(join(d, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
    if (x.info.width !== y.info.width || x.info.height !== y.info.height) {
      console.log(`${name}: size ${x.info.width}×${x.info.height} against ${y.info.width}×${y.info.height}`);
      bad++;
      continue;
    }
    let off = 0;
    let most = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(x.data[i + c] - y.data[i + c]));
      if (d) off++;
      most = Math.max(most, d);
    }
    console.log(`${name}: ${off} pixels differ${off ? ` (most by ${most}/255)` : ''}`);
    if (off) bad++;
  }
  process.exit(bad ? 1 : 0);
}

const OUT = args.out;
if (!OUT) {
  console.log('usage: node hq-shots.mjs --out <dir> [--ref origin/main] [--only a,b] [--frames 90] [--quality low|high]');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const FRAMES = Number(args.frames) || 90;
const quality = ['low', 'mid', 'high'].includes(args.quality) ? args.quality : 'low';
const CLOCK = new Date('2026-10-15T12:00:00Z');
const VIEWPORT = { width: 1280, height: 800 };
const LIMIT = (Number(args.limit) || 900) * 1000; // ms a target may take, all told (the city is slow in software)

// What each target is: its route, how it is opened, where its engine is
// (an expression run in the page; null: counted by its canvas’s draws).
const PLACES = { repulsor: 'stark', lawn: 'thor', ricochet: 'cap', trickshot: 'hawkeye', widow: 'widow', smash: 'banner', thwip: 'spidey', tesseract: 'vault' };
const TARGETS = [
  { id: 'compound', route: '/avengers', engine: 'window.__HQWORLD__?.api?.engine' },
  ...Object.entries(PLACES).map(([id, place]) => ({ id, route: '/avengers', place, engine: `window.__HQ__?.${id}?.view?.engine` })),
  { id: 'titan', route: '/avengers', scroll: '#thanos', engine: 'window.__HQ__?.titan?.view?.engine' },
  { id: 'invworld', route: '/invincible', engine: 'window.__INVWORLD__?.api?.engine' },
  { id: 'thinkmark', route: '/invincible', scroll: '#inv-game', engine: 'window.__HQ__?.thinkmark?.view?.engine' },
  { id: 'viewer', route: '/invincible', scroll: '#inv-cast', engine: 'window.__HQ__?.viewer?.view?.engine' },
];
const only = typeof args.only === 'string' ? args.only.split(',') : null;
const targets = TARGETS.filter((t) => !only || only.includes(t.id));

async function serve(root, cacheDir) {
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: join(root, 'vite.config.js'), cacheDir, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, join(ROOT, 'node_modules')] } }, logLevel: 'error' });
  await server.listen();
  const { port } = server.httpServer.address();
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() };
}

async function shoot(browser, base, t) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await ctx.addInitScript((q) => {
    const set = (k, v) => window.localStorage.setItem(k, v);
    set('tp-intro', '1');
    set('tp-3d', '"on"');
    set('tp-sound', 'off');
    set('tp-worlds', '"load"');
    set('tp-software', '"on"');
    set('tp-tour', 'skipped');
    set('tp-quality', JSON.stringify(q));
    // (a seeded Math.random: scatter, sparks and crowds the same each run)
    // A sequence for each file in the code that asks: what one caller takes never moves another's numbers, so a
    // game's rain, built from where the loading had left one shared
    // sequence, is the same however many numbers the loading took first
    // (three's ids for every object made, a toast's key, a crowd far off).
    const sites = new Map(); // site → its state
    const hash = (str) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
      return h >>> 0;
    };
    let salt = 0;
    const next = (site) => {
      let st = sites.get(site) ?? (hash(site) ^ salt) >>> 0;
      st = (st + 0x6d2b79f5) >>> 0;
      sites.set(site, st);
      let x = st;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    // (and every sequence started again before each frame until the
    // target's first: what took numbers while it loaded took as many as the
    // loading's real time let it)
    window.__fl2sites = () => [...sites.keys()].map((k) => `${k} ${counts.get(k)}`).sort();
    const counts = new Map();
    window.__fl2seed = (n) => {
      salt = n >>> 0;
      sites.clear();
    };
    window.__fl2calls = [];
    Math.random = () => {
      const limit = Error.stackTraceLimit;
      Error.stackTraceLimit = 3;
      const stack = new Error().stack;
      Error.stackTraceLimit = limit;
      // (where it was asked from, as the same on any server: no host, no
      // query, no dependency cache's folder)
      // (the file alone, not its line: a file's lines move by one with an
      // import rewritten, and its own calls come in the same order anyway)
      const frame = (stack.split('\n')[2] ?? '').trim();
      const site = (frame.match(/\(?((?:https?:\/\/[^/]+)?\/[^?:)\s]+)/)?.[1] ?? frame).replace(/https?:\/\/[^/]+/, '').replace(/\/@fs\/.*?\/deps\//, '/deps/');
      if (window.__fl2trace) window.__fl2calls.push(site);
      counts.set(site, (counts.get(site) ?? 0) + 1);
      return next(site);
    };
    // draws to a canvas’s own buffer (no framebuffer bound), counted per canvas
    const P = WebGL2RenderingContext.prototype;
    const bind = P.bindFramebuffer;
    P.bindFramebuffer = function (target, fb) {
      if (target === this.FRAMEBUFFER || target === this.DRAW_FRAMEBUFFER) this.__fb = fb;
      return bind.call(this, target, fb);
    };
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const f = P[name];
      P[name] = function (...a) {
        if (!this.__fb && this.canvas) this.canvas.__presents = (this.canvas.__presents ?? 0) + 1;
        return f.apply(this, a);
      };
    }
  }, quality);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  // what's on its way over the network: a frame waits for it to land, so
  // a model or a picture arriving mid-game arrives at the same frame each
  // run (a figure's pose runs from when it's in)
  const inflight = new Set();
  page.on('request', (r) => inflight.add(r));
  for (const ev of ['requestfinished', 'requestfailed']) page.on(ev, (r) => inflight.delete(r));
  const quiet = async () => {
    const t0 = Date.now();
    let calm = 0;
    while (calm < 3 && Date.now() - t0 < 30000) {
      await page.waitForTimeout(50);
      calm = inflight.size ? 0 : calm + 1;
    }
  };
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(new Date(CLOCK.getTime() + 1000));
  await page.goto(`${base}/?quality=${quality}#${t.route}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  // The page's time, as its frames and performance.now read it, is put at
  // T0 by the target's first frame (__fl2align): however many frames the
  // loading took, what moves by the clock (a pulse, the rain, a bob) is
  // where it was on every run from the next.
  await page.evaluate(() => {
    const raw = performance.now.bind(performance);
    const rawRaf = window.requestAnimationFrame.bind(window);
    let off = 0;
    performance.now = () => raw() + off;
    window.requestAnimationFrame = (cb) => rawRaf((t) => cb(t + off));
    window.__fl2align = (t0) => (off = t0 - raw());
  });
  // The frame guard (lib/three/frameGuard) is off: it holds a material back
  // until its shader has linked on the chip, in the chip's real time, so
  // which frame a material first shows in differed run to run on main
  // itself. Off, each frame is drawn whole, as three alone draws it.
  const step = async (wait = 25) => {
    await page.evaluate(() => window.__tpGuardOff?.());
    await page.clock.runFor(16);
    await page.waitForTimeout(wait);
  };
  const started = Date.now();
  const late = () => Date.now() - started > LIMIT;
  // a game behind a door: the compound first, then in
  if (t.place) {
    while (!(await page.evaluate(() => Boolean(window.__HQWORLD__?.enter)))) {
      if (late()) throw new Error(`${t.id}: the compound never came up`);
      await step();
    }
    await page.evaluate((p) => window.__HQWORLD__.enter(p), t.place);
  }
  if (t.scroll) {
    // (wait for the section, then put it in the middle of the screen)
    while (!(await page.evaluate((sel) => Boolean(document.querySelector(sel)), t.scroll))) {
      if (late()) throw new Error(`${t.id}: no ${t.scroll}`);
      await step();
    }
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), t.scroll);
  }
  // count the target’s frames from its first
  let counted = 0;
  if (t.engine) {
    for (;;) {
      const wrapped = await page.evaluate((expr) => {
        const e = (0, eval)(expr);
        if (!e?.render) return false;
        if (!e.__fl2) {
          const f = e.render;
          window.__fl2n = 0;
          window.__fl2times = [];
          e.render = function (...a) {
            window.__fl2n++;
            // (the page's time put at T0 by its first frame: the frames after
            // read it from there, whatever phase the loading left it at)
            if (window.__fl2n === 1) window.__fl2align(600000);
            if (window.__fl2times.length < 12) window.__fl2times.push(Math.round(performance.now()));
            return f.apply(this, a);
          };
          e.__fl2 = true;
        }
        return true;
      }, t.engine);
      if (wrapped) break;
      if (late()) throw new Error(`${t.id}: its engine never came up`);
      await step();
    }
    let dated = false;
    for (;;) {
      counted = await page.evaluate(() => window.__fl2n);
      if (process.env.SHOTS_DEBUG) console.log(`  ${t.id} step: frames ${counted}, held back ${await page.evaluate(() => window.__tpGuardPending?.() ?? '?')}`);
      // (and the date, from the first frame on)
      if (counted && !dated) {
        dated = true;
        await page.clock.setSystemTime(new Date(CLOCK.getTime() + 600000));
      }
      if (counted >= FRAMES) break;
      if (late()) throw new Error(`${t.id}: stuck at ${counted} frames`);
      // (seeded again before each frame until its first, so the first draws
      // from the same place whatever the loading took)
      await quiet();
      // (before its first frame, the real time for whatever it loaded to
      // land: a figure parsed, its pictures decoded, so it's in by frame one)
      if (!counted) await page.waitForTimeout(3000).then(quiet);
      if (process.env.SHOTS_SITES && !counted) console.log(`  sites ${t.id}:\n    ${(await page.evaluate(() => window.__fl2sites())).join('\n    ')}`);
      if (!counted) await page.evaluate(() => window.__fl2seed(0x51ed));
      if (process.env.SHOTS_TRACE) console.log(`  trace ${t.id} between: ` + (await page.evaluate(() => { const c = window.__fl2calls.join(' | '); window.__fl2trace = true; window.__fl2calls = []; return c; })));
      await step(counted ? 50 : 25);
      if (process.env.SHOTS_TRACE) console.log(`  trace ${t.id} frame ${counted}: ` + (await page.evaluate(() => { const c = window.__fl2calls.join(' | '); window.__fl2calls = []; return c; })));
    }
  } else {
    // (from the moment it's shown: the figure in, its screen faded up)
    while (!(await page.evaluate((sel) => Boolean(document.querySelector(sel)), t.ready))) {
      if (late()) throw new Error(`${t.id}: never shown`);
      await step();
    }
    const presents = () => page.evaluate((sel) => document.querySelector(sel)?.__presents ?? 0, t.canvas);
    let last = await presents();
    while (counted < FRAMES) {
      if (late()) throw new Error(`${t.id}: stuck at ${counted} frames`);
      await quiet();
      // (before its first frame, the real time for whatever it loaded to
      // land: a figure parsed, its pictures decoded, so it's in by frame one)
      if (!counted) await page.waitForTimeout(3000).then(quiet);
      if (process.env.SHOTS_SITES && !counted) console.log(`  sites ${t.id}:\n    ${(await page.evaluate(() => window.__fl2sites())).join('\n    ')}`);
      if (!counted) await page.evaluate(() => window.__fl2seed(0x51ed));
      await step(counted ? 50 : 25);
      const now = await presents();
      if (now > last) counted++;
      last = now;
    }
  }
  if (counted !== FRAMES) throw new Error(`${t.id}: ${counted} frames, not ${FRAMES}`);
  if (process.env.SHOTS_EVAL) console.log(`  eval ${t.id}: ${await page.evaluate((x) => JSON.stringify((0, eval)(x)), process.env.SHOTS_EVAL)}`);
  if (process.env.SHOTS_TRACE) console.log(`  times ${t.id}: ${await page.evaluate(() => JSON.stringify(window.__fl2times ?? null))}`);
  await page.waitForTimeout(300);
  const file = join(OUT, `${t.id}.png`);
  await page.screenshot({ path: file, type: 'png', animations: 'disabled', caret: 'hide', timeout: 120000 });
  await ctx.close();
  return { file, errors };
}

const { findChromium, launchArgs } = await import(join(ROOT, 'scripts/lib/chromium.mjs'));
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: findChromium(), args: [...launchArgs({ angle: 'swiftshader', webgpu: false }), '--js-flags=--max-old-space-size=4096'] });
let wt = null;
let server = null;
const report = { ref: args.ref ?? 'this checkout', quality, frames: FRAMES, clock: CLOCK.toISOString(), targets: {} };
try {
  let root = ROOT;
  if (args.ref) {
    wt = mkdtempSync(join(tmpdir(), 'hq-shots-'));
    rmSync(wt, { recursive: true, force: true });
    execFileSync('git', ['worktree', 'add', '--detach', wt, args.ref], { cwd: ROOT, stdio: 'ignore' });
    symlinkSync(join(ROOT, 'node_modules'), join(wt, 'node_modules'), 'junction');
    root = wt;
    report.sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: wt }).toString().trim();
  } else report.sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
  server = await serve(root, join(tmpdir(), `hq-shots-vite-${report.sha}`));
  for (const t of targets) {
    const t0 = Date.now();
    // (--resume: a target already shot in --out is kept, for a run cut short)
    if (args.resume && existsSync(join(OUT, `${t.id}.png`))) {
      console.log(`${t.id}: kept`);
      continue;
    }
    try {
      const r = await shoot(browser, server.base, t);
      report.targets[t.id] = { ok: true, seconds: Math.round((Date.now() - t0) / 1000), errors: r.errors };
      console.log(`${t.id}: shot (${report.targets[t.id].seconds} s)${r.errors.length ? `; ${r.errors.join('; ')}` : ''}`);
    } catch (err) {
      report.targets[t.id] = { ok: false, why: String(err.message ?? err) };
      console.log(`${t.id}: FAILED ${err.message ?? err}`);
    }
  }
} finally {
  writeFileSync(join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await server?.close();
  await browser.close();
  if (wt) {
    unlinkSync(join(wt, 'node_modules'));
    execFileSync('git', ['worktree', 'remove', '--force', wt], { cwd: ROOT, stdio: 'ignore' });
  }
}
