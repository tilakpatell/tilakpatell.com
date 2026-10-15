/* global window */
// Lane R2’s sender: a world’s ultra picture drawn by Chromium on this
// machine’s GPU and streamed over WebRTC to a browser at #/stream, the
// input coming back and replayed as real keys and pointer moves. A spike:
// it measures, and the decision is written from its numbers
// (docs/decisions/2026-10-11-the-stream-from-the-desktop.md).
//
//   node scripts/desktop/bf2017-stream.mjs                      # on the desktop: serve, draw, wait for a phone
//   node scripts/desktop/bf2017-stream.mjs --world endor --minutes 20
//   node scripts/desktop/bf2017-stream.mjs --dry --seconds 60   # the cloud: a receiver on this machine too, software GL
//   node scripts/desktop/bf2017-stream.mjs --source game        # the real game’s window, the owner’s copy, running here
//
// It starts the dev server itself (on the LAN, --host) with the stream’s
// environment, opens the world through it, imports the sender half
// (src/components/stream/send.js) into the page, and prints the address a
// phone opens. Signalling is Supabase Realtime broadcast: SUPABASE_URL and
// SUPABASE_ANON_KEY (or their VITE_ names) from the environment only, never
// printed. The receiver sends its numbers back every five seconds; with the
// sender’s own (encoder, frame interval), they go to
// docs/superpowers/evidence/bf2017-picture/r2/<name>.json when it stops.
// Lane W’s workflow runs it as the job `stream` (scripts/desktop/bf2017-<job>.mjs).
//
// Flags: --world <id> (hoth) · --id <stream id> (drawn) · --minutes <n> (30) ·
// --dry · --seconds <n> (dry: 60) · --size 1920x1080 · --fps 60 · --mbps 25 ·
// --angle d3d11|vulkan|metal|swiftshader (d3d11; dry: swiftshader) ·
// --source site|game (site: a world of the site’s; game: the real game’s window on
// this desktop, captured, its input injected through Windows, its frames timed by
// PresentMon when PRESENTMON names the tool) · --window <title> (STAR WARS
// Battlefront II) · --process <exe> (starwarsbattlefrontii.exe) ·
// --quality low|mid|high|ultra (ultra; dry: low) · --path <route> (no world:
// the sender’s test pattern, for the plumbing alone) · --port 5188 · --base <url>
// (a server already up) · --headed · --name <file stem>

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startInjector } from './inject.mjs';
import { frameTimes, startPresentMon } from './presentmon.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = join(REPO, 'docs/superpowers/evidence/bf2017-picture/r2');

export function parseArgs(argv) {
  const o = { world: 'hoth', id: null, minutes: 30, dry: false, seconds: 60, width: 1920, height: 1080, fps: 60, mbps: 25, angle: null, port: 5188, base: null, headed: false, name: null, quality: null, path: null, source: 'site', window: 'STAR WARS Battlefront II', process: 'starwarsbattlefrontii.exe' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--dry') o.dry = true;
    else if (a === '--headed') o.headed = true;
    else if (a === '--world') o.world = next();
    else if (a === '--id') o.id = next();
    else if (a === '--minutes') o.minutes = Number(next());
    else if (a === '--seconds') o.seconds = Number(next());
    else if (a === '--fps') o.fps = Number(next());
    else if (a === '--mbps') o.mbps = Number(next());
    else if (a === '--angle') o.angle = next();
    else if (a === '--port') o.port = Number(next());
    else if (a === '--base') o.base = next();
    else if (a === '--name') o.name = next();
    else if (a === '--quality') o.quality = next();
    else if (a === '--path') o.path = next();
    else if (a === '--source') o.source = next();
    else if (a === '--window') o.window = next();
    else if (a === '--process') o.process = next();
    else if (a === '--size') {
      const m = /^(\d+)x(\d+)$/.exec(next() ?? '');
      if (!m) throw new Error('--size is WIDTHxHEIGHT');
      [o.width, o.height] = [Number(m[1]), Number(m[2])];
    } else throw new Error(`unknown flag ${a}`);
  }
  if (!/^[a-z0-9-]+$/.test(o.world)) throw new Error('--world is a galaxy world id');
  o.angle ??= o.dry ? 'swiftshader' : 'd3d11';
  // the dry run’s picture is not the point: software GL at ultra draws a
  // frame in seconds, too few to time anything by, so it runs at low
  o.quality ??= o.dry ? 'low' : 'ultra';
  if (!['site', 'game'].includes(o.source)) throw new Error('--source is site or game');
  if (o.source === 'game') {
    // the game’s window is the owner’s desktop’s; the dry run rehearses the
    // same capture on a stand-in tab of that title, the game never in the cloud
    if (!o.window || /[\r\n"<>&]/.test(o.window)) throw new Error('--window is the game window’s title');
    if (!o.dry) o.headed = true;
  }
  if (o.path != null && !/^\/[a-z0-9/-]*$/.test(o.path)) throw new Error('--path is a route, like /stream-plumbing');
  if (!['low', 'mid', 'high', 'ultra'].includes(o.quality)) throw new Error('--quality is low, mid, high or ultra');
  return o;
}

// the stream’s keys from the environment, under either name; never printed
export function streamEnv(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('set SUPABASE_URL and SUPABASE_ANON_KEY (the project’s public anon key) in the environment');
  return { url, key };
}

// the addresses a phone on this network can open
export function lanAddresses(nets = networkInterfaces()) {
  return Object.values(nets)
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

export const receiverPath = (id, where = 'lan') => `/#/stream?id=${id}${where === 'internet' ? '&where=internet' : ''}`;

const BUTTONS = ['left', 'middle', 'right'];
// one input from the data channel as Playwright’s calls: real events, as a
// player’s own keyboard and mouse would make them
export function replayCalls(e, { width, height }) {
  if (e.t === 'key') return [[e.down ? 'keyboard.down' : 'keyboard.up', e.code]];
  if (e.t === 'pointer') {
    const at = ['mouse.move', Math.round(e.x * width), Math.round(e.y * height)];
    if (e.kind === 'move') return [at];
    if (e.kind === 'wheel') return [at, ['mouse.wheel', 0, e.dy ?? 0]];
    return [at, [e.kind === 'down' ? 'mouse.down' : 'mouse.up', { button: BUTTONS[e.button] ?? 'left' }]];
  }
  return [];
}

const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1))];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`nothing answered at ${url}`);
}

function serve(port, env) {
  const vite = spawn(process.execPath, [join(REPO, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort', '--host'], {
    cwd: REPO,
    env: { ...process.env, VITE_SUPABASE_URL: env.url, VITE_SUPABASE_ANON_KEY: env.key },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  return vite;
}

const LOCAL_STATE = () => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
};

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const env = streamEnv();
  const { chromium } = await import('playwright-core');
  const id = o.id ?? (await import('../../src/lib/stream/protocol.js').catch(() => null))?.streamId?.() ?? Math.random().toString(36).slice(2, 18);
  const base = o.base ?? `http://127.0.0.1:${o.port}`;
  const vite = o.base ? null : serve(o.port, env);
  const stop = [];
  process.on('exit', () => vite?.kill());
  try {
    await waitFor(base);
    const chrome = process.env.CHROME ?? (o.dry ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    // a proxy (the cloud’s) for the signalling only: given as Chromium’s own
    // flags, since Playwright’s proxy option sends loopback through it too
    const proxy = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost'] : null;
    const launch = (args = []) =>
      chromium.launch({
        ...(chrome ? { executablePath: chrome } : { channel: 'chrome' }),
        headless: !o.headed,
        args: [...(proxy ?? []), '--use-gl=angle', `--use-angle=${o.angle}`, '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', ...(o.angle === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : []), ...args],
      });
    // the LAN’s own addresses as candidates: a phone can’t resolve the .local names Chromium hides them behind
    // the game’s window picked without a dialog, and the page kept drawing
    // while the game has the front (an occluded page is otherwise throttled)
    const gameFlags = o.source === 'game' ? [o.dry ? `--auto-select-tab-capture-source-by-title=${o.window}` : `--auto-select-desktop-capture-source=${o.window}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] : [];
    const browser = await launch(['--disable-features=WebRtcHideLocalIpsWithMdns', ...gameFlags]);
    stop.push(() => browser.close());
    const ctx = await browser.newContext({ viewport: { width: o.width, height: o.height }, ignoreHTTPSErrors: Boolean(proxy) });
    await ctx.addInitScript(LOCAL_STATE);
    if (o.source === 'game' && o.dry) {
      // the stand-in: a tab with the game window’s title and a moving picture
      const standIn = await ctx.newPage();
      await standIn.setContent(`<title>${o.window}</title><body style="margin:0;background:#000"><canvas id="c" width="${o.width}" height="${o.height}" style="width:100vw;height:100vh"></canvas><script>const g=c.getContext('2d');(function f(t){g.fillStyle='hsl('+(t/10%360)+' 60% 45%)';g.fillRect(0,0,c.width,c.height);g.fillStyle='#fff';g.fillRect((t/3)%c.width,c.height/3,c.width/16,c.height/3);requestAnimationFrame(f)})(0)</script>`);
    }
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));

    const reports = [];
    const replayed = { key: 0, pointer: 0, ping: 0 };
    let chain = Promise.resolve();
    const hops = [];
    // the game’s input goes into its window through Windows’ SendInput
    const injector = o.source === 'game' ? startInjector({ log: (m) => errors.push(m) }) : null;
    if (o.source === 'game' && !injector) console.log('no input injection off Windows: the game will be watched, not played');
    if (injector) stop.push(async () => injector.stop());
    await page.exposeFunction('__streamInput', (e) => {
      if (e.t === 'report') return void reports.push({ at: new Date().toISOString(), ...e });
      replayed[e.t] = (replayed[e.t] ?? 0) + 1;
      const at = performance.now();
      chain = chain
        .then(async () => {
          if (e.t === 'ping') await page.evaluate((n) => window.__stream?.stamp(n), e.n);
          if (o.source === 'game') injector?.send(e);
          else for (const [call, ...args] of replayCalls(e, o)) {
            const [obj, fn] = call.split('.');
            await page[obj][fn](...args);
          }
          // the replay’s own hop, from the binding to the page having it
          hops.push(performance.now() - at);
          if (hops.length > 2000) hops.shift();
        })
        .catch(() => {});
    });

    const t0 = Date.now();
    const game = o.source === 'game';
    // the game’s sender page draws nothing of its own: any page of the site hosts it
    await page.goto(`${base}/?quality=${o.quality}&calibrate=off#${game ? '/stream-send' : (o.path ?? `/galaxy/${o.world}/surface`)}`, { waitUntil: 'domcontentloaded' });
    const ready = !game && !o.path && (await page.waitForFunction(() => Boolean(window.__surfaceScene?.renderer), null, { timeout: o.dry ? 240000 : 120000 }).then(() => true, () => false));
    // and shown: a world is prepared out of sight, its canvas made only when
    // the runtime says 'on' (galaxy-check.mjs waits the same)
    const shown = ready && (await page.waitForFunction(() => !window.__RUNTIME__ || window.__RUNTIME__.status === 'on', null, { timeout: o.dry ? 600000 : 180000, polling: 1000 }).then(() => true, () => false));
    const loadS = Math.round((Date.now() - t0) / 100) / 10;
    console.log(game ? `capturing the window “${o.window}”` : o.path ? `${o.path} open: no world, the test pattern` : shown ? `${o.world} up in ${loadS} s` : `${o.world} not up after ${loadS} s; streaming what the page draws`);
    const backend = await page.evaluate(() => window.__RUNTIME__?.backend ?? window.__surfaceScene?.renderer?.backend?.constructor?.name ?? null).catch(() => null);
    await page.evaluate(async (opts) => {
      const m = await import('/src/components/stream/send.js');
      await m.startSender(opts);
    }, { url: env.url, key: env.key, id, width: o.width, height: o.height, fps: o.fps, maxMbps: o.mbps, source: game ? 'display' : 'page' });
    // the game’s own frame times through PresentMon, when the owner has it (PRESENTMON)
    const pmOut = join(tmpdir(), `r2-presentmon-${id}.csv`);
    const pm = game ? startPresentMon({ process: o.process, out: pmOut }) : null;
    if (pm) stop.push(async () => pm.stop());

    const lan = lanAddresses();
    console.log(`stream ${id} waiting`);
    for (const a of lan) console.log(`  on this network: http://${a}:${o.port}${receiverPath(id)}`);
    console.log(`  over the internet: the deployed site’s ${receiverPath(id, 'internet')} (a build with the Supabase environment)`);

    let receiver = null;
    if (o.dry) {
      const rb = await launch(['--disable-features=WebRtcHideLocalIpsWithMdns']);
      stop.push(() => rb.close());
      const rctx = await rb.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: Boolean(proxy) });
      await rctx.addInitScript(LOCAL_STATE);
      receiver = await rctx.newPage();
      receiver.on('pageerror', (e) => errors.push(`receiver: ${String(e).slice(0, 300)}`));
      await receiver.goto(`${base}${receiverPath(id)}`, { waitUntil: 'domcontentloaded' });
    }

    const until = Date.now() + (o.dry ? o.seconds * 1000 : o.minutes * 60000);
    let pressed = false;
    while (Date.now() < until) {
      await sleep(5000);
      const s = await page.evaluate(() => window.__stream?.stats()).catch(() => null);
      const last = reports.at(-1);
      console.log(`${s?.connection ?? '…'} · encoder ${s?.encoder ?? '…'} ${s?.codec ?? ''} ${s?.size ?? ''} · encode ${s?.encodeMs ?? '…'} ms · frame p95 ${s?.frameMs?.p95?.toFixed?.(1) ?? '…'} ms` + (last ? ` · receiver p95 ${last.latency.p95 ?? '…'} ms, ${last.mbps.mean ?? '…'} Mbit/s` : ''));
      // the dry run proves the input channel: a held key, replayed on the sender
      if (receiver && s?.connection === 'connected' && !pressed) {
        pressed = true;
        await receiver.keyboard.down('KeyW');
        await sleep(800);
        await receiver.keyboard.up('KeyW');
      }
    }

    const sender = await page.evaluate(() => window.__stream?.stats()).catch(() => null);
    const senderLog = await page.evaluate(() => window.__stream?.state.log.slice(-40)).catch(() => []);
    let rx = null;
    if (receiver) {
      rx = await receiver.evaluate(() => window.__streamReceiver && { numbers: window.__streamReceiver.numbers(), raw: window.__streamReceiver.raw() }).catch(() => null);
      mkdirSync(OUT, { recursive: true });
      await receiver.screenshot({ path: join(OUT, `${o.name ?? 'dryrun-cloud'}.jpg`), type: 'jpeg', quality: 60 }).catch(() => {});
    }
    // the game’s frames: PresentMon stopped, its file summed and dropped
    let gameFrame = null;
    if (pm) {
      pm.stop();
      await sleep(1500);
      if (existsSync(pmOut)) {
        gameFrame = frameTimes(readFileSync(pmOut, 'utf8'));
        rmSync(pmOut, { force: true });
      }
    }
    const result = {
      when: new Date().toISOString(),
      kind: o.dry ? 'cloud dry run: plumbing only' : 'desktop run',
      source: o.source,
      world: game || o.path ? null : o.world,
      window: game ? o.window : null,
      path: o.path,
      ready: shown,
      loadS,
      backend,
      angle: o.angle,
      quality: o.quality,
      asked: { width: o.width, height: o.height, fps: o.fps, maxMbps: o.mbps },
      sender,
      gameFrame,
      replayed,
      replayHopMs: hops.length ? { n: hops.length, p50: Math.round(pct(hops, 0.5) * 10) / 10, p95: Math.round(pct(hops, 0.95) * 10) / 10 } : null,
      receiver: rx?.numbers ?? reports.at(-1) ?? null,
      reports: reports.slice(-24),
      latencies: rx?.raw.latencies ?? null,
      samples: rx?.raw.samples ?? null,
      senderLog,
      errors: errors.slice(0, 20),
      _source: {
        sender: 'send.js stats(): the outbound video’s RTCStats (encoderImplementation, totalEncodeTime ÷ framesEncoded) and requestAnimationFrame intervals on the sending page',
        receiver: 'receive.js numbers(): inbound video RTCStats deltas each second (stats.js rates) and the frame stamp’s input-to-picture times (stamp.js), p50 and p95 by nearest rank',
        gameFrame: 'PresentMon’s per-frame times for --process (MsBetweenPresents or FrameTime), p50 and p95 by nearest rank; null without PRESENTMON',
        replayHopMs: 'performance.now() from the binding call to the replayed call resolving, in this script',
        replayed: 'the inputs that reached this script over the data channel and were replayed with Playwright (keys, pointer moves, pings)',
        loadS: 'from page.goto to window.__surfaceScene.renderer',
      },
    };
    mkdirSync(OUT, { recursive: true });
    const file = join(OUT, `${o.name ?? (o.dry ? 'dryrun-cloud' : `desktop-${new Date().toISOString().slice(0, 10)}`)}.json`);
    writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
    console.log(`wrote ${file.slice(REPO.length + 1)}`);
  } finally {
    for (const f of stop.reverse()) await f().catch(() => {});
    vite?.kill();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
