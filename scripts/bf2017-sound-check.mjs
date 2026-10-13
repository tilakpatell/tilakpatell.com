#!/usr/bin/env node
/* global window, document, requestAnimationFrame, AudioBufferSourceNode, HTMLMediaElement */
// The Battlefront world's sounds in a headless browser, through its dev door
// (window.__battlefront: src/components/battlefront/module.js). The page
// opens Hoth's Galactic Assault on the waiting screen (the loading cue
// plays, the world behind it unheard), presses the screen's Deploy once it
// is ready, then jogs (W), sprints (Shift), crouch-walks (C), fires until
// the rifle overheats and it clears, dies (the death's cues and duck),
// deploys on a squadmate at the line and hunts the nearest enemy for the hit
// and kill cues, stands in the battle for the bed and the far fire, and
// wins; and the script counts what played: the player's own counter by
// name and by kind (`sounds()`), and, apart from it, every
// AudioBufferSourceNode started and every <audio> element played, hooked
// before the page's scripts run. It adds up the bytes of every file asked
// for under /audio/. It fails on a console error, on a 4xx or 5xx under
// /audio/, and when nothing played.
//
//   node scripts/bf2017-sound-check.mjs [--browser <exe>] [--port 5611] [--out docs/superpowers/evidence/bf2017-sound]
//     [--wait 600000] [--ready 300000] [--hunt 150000] [--quality ultra] [--gone | --lost]
//
//   gone   the build told the set has left the checkout (VITE_BF2017_SOUNDS=gone, no bucket): nothing may be asked for
//   lost   every sound file sent to a path that is not there, though the build says it is: asked once, no error
//   (both write check-<mode>.json and stop after a short walk and a burst)
//
// The browser is Edge on the owner's desktop (its path below; CHROMIUM or
// --browser names another), on d3d11 with WebGPU on, autoplay allowed so the
// context runs with no gesture.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const exe = arg('browser', process.env.CHROMIUM ?? EDGE);
const PORT = Number(arg('port', 5611));
const OUT = join(ROOT, arg('out', 'docs/superpowers/evidence/bf2017-sound'));
const WAIT = Number(arg('wait', 600000));
const READY = Number(arg('ready', 300000));
const QUALITY = arg('quality', 'ultra');
const MODE = argv.includes('--gone') ? 'gone' : argv.includes('--lost') ? 'lost' : 'whole';
const ROUTE = '/battlefront/hoth/galacticAssault?gpu=webgpu';
const CLASS = 'd-orig-assault';
const HUNT = Number(arg('hunt', 150000)); // ms the hunt may take
const RANGE = 45; // m: the hunt fires inside this
mkdirSync(OUT, { recursive: true });
if (!existsSync(exe)) {
  console.error(`no browser at ${exe} (--browser names one)`);
  process.exit(2);
}
// (vite.config.js reads it as the checkout's word; set here, it wins)
if (MODE === 'gone') process.env.VITE_BF2017_SOUNDS = 'gone';

const { chromium } = await import('playwright-core');
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ executablePath: exe, args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((quality) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', JSON.stringify('universe'));
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
  window.localStorage.setItem('tp-quality', quality);
  // the independent counter: every buffer source started, every <audio> played, and which still play
  const hook = { buffers: 0, elements: 0, elementUrls: [] };
  const els = [];
  const short = (el) => String(el.currentSrc || el.src).replace(/^.*\/audio\//, '/audio/');
  window.__audioHook = hook;
  window.__audioPlaying = () => els.filter((el) => !el.paused && !el.ended).map(short);
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    hook.buffers += 1;
    return start.apply(this, a);
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    if (this.tagName === 'AUDIO') {
      hook.elements += 1;
      hook.elementUrls.push(short(this));
      if (!els.includes(this)) els.push(this);
    }
    return play.apply(this, a);
  };
}, QUALITY);
const page = await ctx.newPage();
const errors = [];
const missing = [];
const asked = new Map(); // the file → its bytes, as the server said
const SOUND = /\/audio\/galaxy\/bf2017[^/]*\//;
if (MODE === 'lost') await page.route(SOUND, (route) => route.continue({ url: route.request().url().replace('/audio/galaxy/bf2017/', '/audio/galaxy/bf2017-lost/') }));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => {
  const url = r.url();
  if (!/\/audio\//.test(url)) return;
  const file = url.replace(/^.*\/audio\//, '/audio/');
  const h = r.headers();
  // (a stem is streamed in ranges: the whole file's size is the range's total)
  const bytes = Number(/\/(\d+)$/.exec(h['content-range'] ?? '')?.[1] ?? h['content-length'] ?? 0);
  asked.set(file, { bytes: Math.max(asked.get(file)?.bytes ?? 0, bytes), status: r.status(), type: h['content-type'] ?? '' });
  if (r.status() >= 400) missing.push({ url: file, status: r.status() });
});
const frames = (n) => page.evaluate((k) => new Promise((done) => {
  let left = k;
  const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const door = (action, x) => page.evaluate(([a, v]) => window.__battlefront.do(a, v), [action, x]);
const sounds = () => page.evaluate(() => window.__battlefront?.sounds?.() ?? null);
const hook = () => page.evaluate(() => ({ ...window.__audioHook, playing: window.__audioPlaying() }));
const me = () => page.evaluate(() => {
  const p = window.__battlefront.view().player;
  return p && { state: p.state, at: p.at, yaw: p.yaw, heat: p.heat, overheated: p.overheated, hp: p.hp, team: p.team };
});
const phase = async (more = {}) => ({ sounds: await sounds(), hook: await hook(), ...more });
const moved = (a, b) => (a && b ? Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) * 100) / 100 : null);
// the aim, kept in the page every frame (a look sent from here would lag a running
// target by metres): the nearest living enemy soldier, the player's view turned to
// its chest; `window.__aim` says who and how far, null with nobody to face
const aiming = (on) => page.evaluate((go) => {
  window.__aimOn = go;
  if (!go || window.__aimLoop) return;
  window.__aimLoop = true;
  const tick = () => {
    if (!window.__aimOn || !window.__battlefront) {
      window.__aimLoop = false;
      window.__aim = null;
      return;
    }
    const v = window.__battlefront.view();
    const p = v.player;
    let best = null;
    if (p?.state === 'alive') {
      for (const e of v.entities) {
        if (e.kind !== 'soldier' || !e.alive || e.team === p.team) continue;
        const d = Math.hypot(e.at[0] - p.at[0], e.at[2] - p.at[2]);
        if (!best || d < best.dist) best = { id: e.id, dist: d, at: e.at };
      }
    }
    // (yaw 0 faces +Z, the aim is (sin yaw, cos yaw); the chest to just under the chest)
    if (best) window.__battlefront.do('look', { yaw: Math.atan2(best.at[0] - p.at[0], best.at[2] - p.at[2]), pitch: Math.atan2(best.at[1] - p.at[1] - 0.2, Math.max(1, best.dist)) });
    window.__aim = best && { id: best.id, dist: best.dist };
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, on);
const target = () => page.evaluate(() => window.__aim ?? null);
const hold = async (keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
};
const alive = async () => {
  const p = await me();
  if (p?.state === 'alive') return true;
  // (down: the corpse time, then the spawn screen; the door deploys the next life)
  for (let i = 0; i < 40; i++) {
    if ((await door('deploy', { classId: CLASS }))?.ok) return true;
    await page.waitForTimeout(250);
  }
  return false;
};

const out = { route: ROUTE, mode: MODE, quality: QUALITY, browser: exe, errors, missing, phases: {} };
const t0 = Date.now();
try {
  await page.goto(`${base}/#${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  for (const until = Date.now() + WAIT; ; ) {
    const failed = errors.find((e) => /3D failed|device.*lost/i.test(e));
    if (failed) throw new Error(failed.split('\n')[0]);
    if (await page.evaluate(() => Boolean(window.__battlefront?.view))) break;
    if (Date.now() > until) throw new Error('the world never came up');
    await page.waitForTimeout(1000);
  }
  out.backend = await door('gpu');
  out.upMs = Date.now() - t0;
  if (MODE !== 'whole') {
    // the set gone or lost: a short life, and nothing may be said about it
    await page.waitForTimeout(3000);
    out.deploy = await door('deploy', { classId: CLASS });
    await page.mouse.click(640, 360);
    const from = (await me())?.at;
    await hold(['KeyW'], 3000);
    await page.mouse.down();
    await page.waitForTimeout(2000);
    await page.mouse.up();
    out.phases.short = await phase({ moved: moved(from, (await me())?.at) });
  } else {
    // the loading screen: the loading cue's intro, then its loop; the world behind it unheard
    await page.waitForTimeout(6000);
    out.phases.waiting = await phase({ parked: await page.evaluate(() => window.__battlefront.view().parked) });
    await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
    out.loadedMs = Date.now() - t0;
    const ready = await page
      .waitForSelector('[data-bf-stage="spawn"]', { timeout: READY })
      .then(() => true)
      .catch(() => false);
    out.readyMs = Date.now() - t0;
    out.phases.ready = await phase({ ready });
    if (ready) {
      // the spawn screen's own Deploy: the wipe, the world's deploy at its swap, the cue faded out
      await page.click('.bf-spawn-screen-cell[data-kind="class"]');
      await page.waitForFunction(() => window.__battlefront.view().parked === false && window.__battlefront.view().player?.state === 'alive', null, { timeout: 20000, polling: 100 });
      out.deploy = { ok: true, by: 'the spawn screen' };
    } else {
      out.deploy = { ...(await door('deploy', { classId: CLASS })), by: 'the dev door (the screen was not ready in time: its cue plays on)' };
    }
    await page.waitForTimeout(2500);
    out.phases.deployed = await phase();
    // (the canvas takes the look and the mouse)
    await page.mouse.click(640, 360);
    await frames(10);

    // the feet: a jog, a sprint, a crouched walk
    const feet = {};
    for (const [name, keys, ms] of [['jog', ['KeyW'], 4000], ['sprint', ['ShiftLeft', 'KeyW'], 3500], ['crouch', ['KeyC', 'KeyW'], 4000]]) {
      await alive();
      const from = (await me())?.at;
      const before = (await sounds())?.played ?? {};
      await hold(keys, ms);
      const after = await sounds();
      feet[name] = { moved: moved(from, (await me())?.at), seconds: ms / 1000, steps: Object.fromEntries(Object.entries(after.played).filter(([n]) => /^(step|cloth)\./.test(n)).map(([n, c]) => [n, c - (before[n] ?? 0)]).filter(([, c]) => c > 0)), suppressed: after.suppressed };
    }
    out.phases.walked = await phase({ feet });

    // the rifle: held until it overheats, then let clear
    await alive();
    await page.mouse.move(640, 360);
    await page.mouse.down();
    let overheated = false;
    for (let i = 0; i < 60 && !overheated; i++) {
      await page.waitForTimeout(200);
      overheated = Boolean((await me())?.overheated);
    }
    await page.mouse.up();
    let cleared = false;
    for (let i = 0; i < 60 && overheated && !cleared; i++) {
      await page.waitForTimeout(200);
      cleared = !(await me())?.overheated;
    }
    await page.waitForTimeout(500);
    out.phases.fired = await phase({ overheated, cleared });

    // the hunt, for the hit and kill cues. The spawn is hundreds of metres from the
    // line, so the next life is the game's squad spawn: down (the death's cues and
    // duck), then deployed on the squadmate nearest an enemy. From there: face the
    // nearest enemy, sprint to within range (the keys held, the look turned as it
    // moves), fire in bursts, until a hit and a kill have been heard.
    await alive();
    await door('die');
    await page.waitForTimeout(2500);
    out.phases.died = await phase({ state: (await me())?.state });
    await page.waitForFunction(() => window.__battlefront.view().deploy.open, null, { timeout: 30000, polling: 250 });
    const mate = await page.evaluate(() => {
      const v = window.__battlefront.view();
      const mine = v.deploy.team;
      const foes = v.entities.filter((e) => e.kind === 'soldier' && e.alive && e.team !== mine);
      let best = null;
      for (const s of v.deploy.spawns) {
        if (s.kind !== 'mate' || s.blocked) continue;
        const m = v.entities.find((e) => e.id === s.id);
        if (!m) continue;
        const d = Math.min(Infinity, ...foes.map((f) => Math.hypot(f.at[0] - m.at[0], f.at[2] - m.at[2])));
        if (!best || d < best.foe) best = { id: s.id, foe: Math.round(d) };
      }
      return best;
    });
    if (mate) await door('spawn', mate.id);
    const again = await door('deploy', { classId: CLASS });
    await page.waitForTimeout(500);
    const hunt = { mate, deploy: again, looks: 0, first: null, nearest: null, bursts: 0, deaths: 0, moved: 0 };
    let last = (await me())?.at ?? null;
    await aiming(true);
    let running = false;
    const run = async (on) => {
      if (on === running) return;
      running = on;
      for (const k of on ? ['ShiftLeft', 'KeyW'] : ['KeyW', 'ShiftLeft']) await page.keyboard[on ? 'down' : 'up'](k);
    };
    for (const until = Date.now() + HUNT; Date.now() < until; ) {
      if ((await me())?.state !== 'alive') {
        hunt.deaths += 1;
        if (!(await alive())) break;
      }
      const t = await target();
      if (!t) {
        await page.waitForTimeout(500);
        continue;
      }
      hunt.first ??= Math.round(t.dist);
      hunt.nearest = Math.min(hunt.nearest ?? Infinity, Math.round(t.dist));
      const here = (await me())?.at ?? null;
      hunt.moved += moved(last, here) ?? 0;
      last = here;
      hunt.looks += 1;
      if (t.dist > RANGE) {
        await run(true);
        await page.waitForTimeout(200);
      } else {
        await run(false);
        await page.mouse.down();
        await page.waitForTimeout(600);
        await page.mouse.up();
        await page.waitForTimeout(250);
        hunt.bursts += 1;
      }
      const s = await sounds();
      if ((s.played['hit.kill'] ?? 0) >= 1 && (s.played['hit.hit'] ?? 0) >= 1) break;
    }
    await run(false);
    await aiming(false);
    hunt.moved = Math.round(hunt.moved);
    out.phases.hunted = await phase({ hunt });

    // the battle round the player: the bed's one-shots, the far fire
    await alive();
    await page.waitForTimeout(8000);
    out.phases.battle = await phase();
    await door('win');
    await page.waitForTimeout(3000);
    out.phases.won = await phase();
    await page.screenshot({ path: join(OUT, 'end-of-round.png') });
    out.view = await page.evaluate(() => {
      const v = window.__battlefront.view();
      return { player: v.player && { state: v.player.state, heat: v.player.heat, overheated: v.player.overheated, weapon: v.player.weapon }, stage: v.mode?.stageName, result: v.mode?.result, entities: v.entities?.length, weather: v.weather, waiting: Boolean(document.querySelector('[data-bf-stage="loading"], [data-bf-stage="spawn"]')) };
    });
  }
} catch (e) {
  out.failed = String(e).split('\n')[0];
}
out.seconds = Math.round((Date.now() - t0) / 1000);
out.audioRequests = Object.fromEntries([...asked].sort(([a], [b]) => (a < b ? -1 : 1)));
const game = [...asked].filter(([f]) => SOUND.test(f));
const bytesOf = (rows) => rows.reduce((s, [, r]) => s + r.bytes, 0);
const last = Object.values(out.phases).at(-1) ?? null;
out.summary = last && {
  kinds: last.sounds?.kinds ?? {},
  starts: last.sounds?.starts ?? 0,
  names: Object.keys(last.sounds?.played ?? {}).length,
  late: last.sounds?.late ?? 0,
  failed: last.sounds?.failed ?? 0,
  missing: last.sounds?.missing ?? 0,
  absent: last.sounds?.absent ?? 0,
  asleep: last.sounds?.asleep ?? 0,
  suppressed: last.sounds?.suppressed ?? 0,
  buffers: last.sounds?.buffers ?? 0,
  hookBuffers: last.hook?.buffers ?? 0,
  hookElements: last.hook?.elements ?? 0,
  files: game.length,
  bytes: bytesOf(game),
  stemFiles: game.filter(([f]) => /\/music-/.test(f)).length,
  stemBytes: bytesOf(game.filter(([f]) => /\/music-/.test(f))),
  statuses: Object.fromEntries([...new Set(game.map(([, r]) => r.status))].map((s) => [s, game.filter(([, r]) => r.status === s).length])),
  notFound: missing.length,
  errors: errors.length,
};
writeFileSync(join(OUT, MODE === 'whole' ? 'check.json' : `check-${MODE}.json`), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ mode: MODE, summary: out.summary, played: last?.sounds?.played ?? null, deploy: out.deploy ?? null, failed: out.failed ?? null, errors: errors.slice(0, 5), missing: missing.slice(0, 5) }, null, 2));
await browser.close();
await server.close();
// (the set gone: nothing asked and nothing said; lost: asked, never found, no buffer started, nothing said; whole: it played)
const quiet = !out.failed && !errors.length;
const ok = MODE === 'gone' ? quiet && game.length === 0 : MODE === 'lost' ? quiet && (out.summary?.hookBuffers ?? 0) === 0 : quiet && !missing.length && (out.summary?.starts ?? 0) > 0;
process.exit(ok ? 0 : 1);
