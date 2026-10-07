/* global window */
// The universe map's characters and hunters on the AI toolkit, checked in a
// browser: a nemesis (Vader) brought in through the dev hook and watched
// for half a minute while you fly a straight line (it should see you, orbit,
// pass, and say its lines without an error), then a pack of five Imperials
// (some of them should take a flank or a block while they wait for a run,
// one at most on your tail, the pack's nerve read), and the director's
// intensity rising with the hits you take. Headless Chromium on the dev
// server (software WebGL on Linux), as scripts/universe-war-check.mjs does.
// The page runs with ?ai=1&seed=4121 (the AI's hook on, the visit's streams
// pinned), and after the pack the brains' cost is printed (the schedules'
// frame: `ai: { ms, thought, skipped, worst }`, the characters' and the
// hunters' together) and fails over 2 ms; on any problem the decisions they
// made are saved as lab/ai-trace-<time>.json for the report.
//
//   node scripts/universe-npc-check.mjs [crew=xwing] [quality=high]
// BASE set (a dev server already up) it uses that; CHROME is the Chromium to
// use (the Playwright one by default).

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'docs/superpowers/shots';
const SEED = 4121;
const AI_MS = 2.0; // the brains' share of a frame, at most (the design's `high` budget)
const crew = process.argv[2] ?? 'xwing';
const quality = process.argv[3] ?? 'high';
const nemesisOf = { xwing: 'vader', falcon: 'vader', cruiser: 'tammy', rv: 'tuco' };
const factionOf = { xwing: 'empire', falcon: 'empire', cruiser: 'federation', rv: 'cartel' };
mkdirSync(out, { recursive: true });

let server = null;
let base = process.env.BASE;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { host: '127.0.0.1', port: 5294, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  base = 'http://127.0.0.1:5294';
}
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? chromium.executablePath(), args });
const errors = [];
const problems = [];
let page = null;
let threw = null;
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((s) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-sound', 'off');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
  }, crew);
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader|WebGL/i.test(m.text()) && errors.push(m.text()));
  await page.goto(`${base}/?quality=${quality}&ai=1&seed=${SEED}#/universe`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: '.universe-panel { display: none !important; }' });
  const dbg = (fn, arg) => page.evaluate(fn, arg);
  // out in the open, flying straight and level
  await dbg(() => {
    const d = window.__universeDebug;
    const s = d.state;
    s.auto = null;
    s.shield = 100;
    s.ship = { ...s.ship, x: 0, y: 40, z: 320, heading: 0, pitch: 0, bank: 0, speed: 8, vy: 0 };
  });
  // the nemesis, brought in
  const id = nemesisOf[crew];
  const came = await dbg((who) => Boolean(window.__universeDebug.meetNpc(who)), id);
  check(came, `${id} comes in`);
  // (software WebGL runs the scene at a few frames a second, so the loops
  // go by the scene's own clock: SIM seconds of it, however long that takes)
  const SIM = 45;
  const clock = () => dbg(() => window.__universeDebug.state.clock);
  const t0 = await clock();
  const seen = { modes: new Set(), sees: 0, guessed: 0, frames: 0, said: new Set() };
  for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(400);
    const r = await dbg(() => {
      const d = window.__universeDebug;
      d.state.shield = Math.max(d.state.shield, 60); // (not shot down while we look)
      d.state.ship.speed = 8;
      const m = d.npcs.live[0];
      return m ? { mode: m.mind.mode ?? null, phase: m.mind.phase ?? null, sees: m.sees, guessed: Boolean(m.you?.guessed), said: [...m.said], hp: m.hp, intensity: d.director.intensity, clock: d.state.clock } : null;
    });
    if (!r) break;
    if (r.clock - t0 > SIM) break;
    seen.frames += 1;
    seen.modes.add(r.mode);
    if (r.sees) seen.sees += 1;
    if (r.guessed) seen.guessed += 1;
    for (const k of r.said) seen.said.add(k);
    seen.intensity = r.intensity;
  }
  console.log('nemesis:', JSON.stringify({ modes: [...seen.modes], sees: seen.sees, of: seen.frames, guessed: seen.guessed, said: [...seen.said], intensity: seen.intensity, simSeconds: Math.round((await clock()) - t0) }));
  check(seen.frames > 20, 'it stays and fights a while');
  check(seen.sees > seen.frames * 0.8, 'it sees you out in the open');
  check(seen.modes.has('orbit') && seen.modes.has('pass'), 'it orbits and passes');
  check(seen.said.has('hello') || seen.said.has('again'), 'it has a word for you');
  await page.screenshot({ path: `${out}/unpc-nemesis.png`, timeout: 90000 });
  // a pack of five: roles while they wait, one on your tail at most, nerve
  await dbg((f) => {
    const d = window.__universeDebug;
    d.npcs.clear();
    d.hunters.pack(f, d.state.ship, { size: 5, ace: false });
  }, factionOf[crew]);
  const t1 = await clock();
  const pack = { roles: new Set(), tailMax: 0, nerves: new Set(), frames: 0, sees: 0, intensity: 0 };
  for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(400);
    const r = await dbg(() => {
      const d = window.__universeDebug;
      d.state.shield = Math.max(d.state.shield, 60);
      d.state.ship.speed = 12;
      const p = d.hunters.packs[0];
      return p ? { roles: p.roles, modes: p.modes, nerve: p.nerve, sees: p.sees, intensity: d.director.intensity, clock: d.state.clock } : null;
    });
    if (!r) break;
    if (r.clock - t1 > SIM) break;
    pack.frames += 1;
    for (const role of r.roles) pack.roles.add(role);
    pack.tailMax = Math.max(pack.tailMax, r.modes.filter((m) => m === 'tail').length);
    pack.nerves.add(r.nerve);
    if (r.sees.some(Boolean)) pack.sees += 1;
    pack.intensity = Math.max(pack.intensity, r.intensity);
  }
  console.log('pack:', JSON.stringify({ roles: [...pack.roles], tailMax: pack.tailMax, nerves: [...pack.nerves], frames: pack.frames, sees: pack.sees, intensity: pack.intensity, simSeconds: Math.round((await clock()) - t1) }));
  check(pack.frames > 20, 'the pack stays on you a while');
  check(pack.roles.has('flank') || pack.roles.has('block'), 'a hunter waiting for a run flanks or blocks');
  check(pack.tailMax <= 1, 'one on your tail at most');
  check(pack.sees > pack.frames * 0.8, 'they see you out in the open');
  check(pack.intensity > 0, 'the director’s intensity rose with the fight');
  await page.screenshot({ path: `${out}/unpc-pack.png`, timeout: 90000 });
  // what the brains cost: the schedules' last frame, the characters' and the hunters' together
  const ai = await dbg(() => {
    const a = window.__universeDebug.ai;
    if (!a) return null;
    const s = a.stats();
    return { ms: +s.ms.toFixed(3), thought: s.thought, skipped: s.skipped, worst: s.worst && { id: s.worst.id, ms: +s.worst.ms.toFixed(3) }, agents: s.agents, hunters: Boolean(a.hunters) };
  });
  console.log('ai:', JSON.stringify(ai));
  check(Boolean(ai), 'the brains’ schedule and trace are on the debug hook');
  check(Boolean(ai?.hunters), 'and the hunters’ beside them');
  check(Boolean(ai) && ai.ms <= AI_MS, `the brains take ${AI_MS} ms of a frame at most`);
} catch (e) {
  threw = e;
  throw e;
} finally {
  // on any problem, what they decided goes to lab/ for the report
  if ((problems.length || errors.length || threw) && page) {
    try {
      const dump = await page.evaluate((seed) => {
        const a = window.__universeDebug?.ai;
        return a ? { seed, at: window.__universeDebug.state?.clock ?? null, stats: a.stats(), npcs: a.trace.export(), hunters: a.hunters?.trace?.export() ?? null } : null;
      }, SEED);
      if (dump) {
        mkdirSync('lab', { recursive: true });
        const file = `lab/ai-trace-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        writeFileSync(file, JSON.stringify(dump));
        console.log('trace saved:', file);
      } else console.log('trace not saved: no __universeDebug.ai on the page');
    } catch (e) {
      console.log('trace not saved:', String(e).split('\n')[0]);
    }
  }
  await browser.close();
  await server?.close();
}
check(errors.length === 0, `no errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
console.log(problems.length ? `\n${problems.length} problem(s)` : '\neverything green');
process.exit(problems.length ? 1 : 0);
