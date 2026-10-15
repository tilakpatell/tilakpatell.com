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
//     [--frames 90] [--quality low|high]
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
  { id: 'viewer', route: '/invincible', scroll: '#inv-cast', engine: null, canvas: '#inv-cast canvas' },
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
    let s = 0x2f6b1d3 >>> 0;
    // (and seeded again at the target's first frame: what took a number
    // while it loaded, a toast's key, a crowd far off, took as many as the
    // loading's real time let it, and the sparks of its first frames were
    // drawn from wherever that left the sequence)
    window.__fl2seed = (n) => (s = n >>> 0);
    Math.random = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let x = s;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
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
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(new Date(CLOCK.getTime() + 1000));
  await page.goto(`${base}/?quality=${quality}#${t.route}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
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
          // (the page’s time from here is the target’s own: performance.now
          // reads T0 at its first frame, however long the loading took, for
          // what draws by the clock and not by the frames, a pulse or a bob)
          const raw = performance.now.bind(performance);
          let off = 0;
          performance.now = () => raw() + off;
          e.render = function (...a) {
            window.__fl2n++;
            if (window.__fl2n === 1) {
              off = 600000 - raw();
              window.__fl2seed(0x51ed);
            }
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
      await step(counted ? 50 : 25);
    }
  } else {
    const presents = () => page.evaluate((sel) => document.querySelector(sel)?.__presents ?? 0, t.canvas);
    let last = await presents();
    while (counted < FRAMES) {
      if (late()) throw new Error(`${t.id}: stuck at ${counted} frames`);
      await step(counted ? 50 : 25);
      const now = await presents();
      if (now > last) counted++;
      if (counted === 1 && now > last) await page.evaluate(() => window.__fl2seed(0x51ed));
      last = now;
    }
  }
  if (counted !== FRAMES) throw new Error(`${t.id}: ${counted} frames, not ${FRAMES}`);
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
