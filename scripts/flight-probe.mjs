/* global window, document */
// What a shot does, checked in a browser, against a dev server already up
// (the scenes' DEV hooks; scripts/lib/flight-probes.mjs puts things where
// they're wanted):
//
//   node scripts/flight-probe.mjs <scenario> [--line 0|1|2] [--expect clear] [--shot dir] [--url http://127.0.0.1:5188]
//
//   order         one shot of a line (--line: 0 the blaster, 1 the secondary,
//                 2 the ordnance) through a hunter, the Citadel and a rock in
//                 a line: the hunter takes it; without it, the Citadel, not
//                 the rock; out past the Citadel, the rock
//   crash         a torpedo and a bolt, then into the sun: what's in flight
//                 then and three frames on (--expect clear: nothing left)
//   galaxy-bolt   the galaxy: a bolt at a TIE dead ahead takes it
//   unique-pilots the galaxy: the Blue sky cluster at a TIE, never asking the
//                 other pilots
//   galaxy-capital the galaxy: a bolt at a Star Destroyer's shield part takes it
//   reach         seismic charges picked: the lead pip on at 6 out, off at 12
//   tap           a tap on a character in front of a planet locks on to it, by hand
//   threats       a character on you, 20 behind: its threat arrow, and no lock
//
// Each finding is a line, `ok   …` or `FAIL …`; the exit code is how many
// FAILs. A Chromium: CHROMIUM (CHROME for the galaxy's), else the
// container's.
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { LOCK_SPOT, lockSpot, pageScript } from './lib/flight-probes.mjs';

const argv = process.argv.slice(2);
const scenario = argv[0];
const flag = (k, d = null) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : (argv[i + 1] ?? true);
};
const url = String(flag('url', 'http://127.0.0.1:5188')).replace(/\/$/, '');
const line = Number(flag('line', 0));
const shotDir = flag('shot') ? resolve(flag('shot')) : null;
const SCENARIOS = ['order', 'crash', 'galaxy-bolt', 'unique-pilots', 'galaxy-capital', 'reach', 'tap', 'threats'];
if (!SCENARIOS.includes(scenario)) throw new Error(`usage: flight-probe.mjs <${SCENARIOS.join('|')}> [--line 0|1|2] [--expect clear] [--shot dir] [--url …]`);

let failed = 0;
const say = (ok, what) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};
if (shotDir) await mkdir(shotDir, { recursive: true });
const shoot = async (page, name) => shotDir && page.screenshot({ path: join(shotDir, `${name}.png`) });

// ── the universe map, as universe-check.mjs opens it, at low ──
async function openUniverse() {
  const exe = process.env.CHROMIUM ?? ['/opt/pw-browsers/chromium'].find(existsSync);
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-quality', 'low');
    window.localStorage.setItem('tp-universe-ship', '"falcon"');
    window.localStorage.setItem('tp-sound', 'off');
    window.__tpKeepFrames = true;
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.goto(`${url}/?quality=low#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship && window.__universeDebug?.state?.model, null, { timeout: 300000, polling: 250 });
  await page.waitForFunction(() => window.__universeDebug.renderer.domElement.parentElement?.dataset.gl === 'on', null, { timeout: 600000, polling: 500 });
  await page.addScriptTag({ content: pageScript() });
  return { browser, page, errors };
}

// ── the galaxy, as galaxy-hud-check opens it ──
async function openGalaxy() {
  process.env.BASE = url;
  process.env.CHROME ??= process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
  const { open } = await import('./galaxy-hud-check/lib.mjs');
  const { browser } = await import('./galaxy-map-check/lib.mjs');
  const { page, errors } = await open({ width: 1440, height: 900 });
  await page.addScriptTag({ content: pageScript() });
  return { browser, page, errors };
}

// the trigger held (state.fireBtn) a frame at a time until `done` (a page
// function) says so, 20 frames at most; then let go and three more
const fireUntil = (page, done) =>
  page.evaluate(async (src) => {
    const d = window.__universeDebug;
    const u = window.__universe();
    const enough = new Function(`return (${src})()`);
    for (let i = 0; i < 20 && !enough(); i++) {
      d.state.fireBtn = true;
      await u.frames(1);
    }
    d.state.fireBtn = false;
    await u.frames(3);
    return [...window.__takers];
  }, done.toString());

async function order(page) {
  const kills = () => page.evaluate(() => window.__universeDebug.state.kills ?? null);
  const stage = async (opts, want, not) => {
    await page.evaluate((o) => window.__fp.stack(o), { ...opts, line });
    await page.evaluate(() => window.__fp.recordTakers());
    const k0 = await kills();
    const takers = await fireUntil(page, () => window.__takers.length > 0);
    const k1 = await kills();
    const dk = k0 === null || k1 === null ? 0 : k1 - k0;
    say(takers[0] === want && !takers.includes(not ?? '-'), `line ${line}: ${want} first${not ? `, no ${not}` : ''} (${takers.join(', ') || 'none'}; kills +${dk})`);
    return { k0, dk };
  };
  const first = await stage({}, 'hunter');
  await stage({ hunter: false }, 'citadel', 'rock');
  await stage({ from: 300, hunter: false }, 'rock');
  if (line === 2) {
    if (first.k0 === null) say(true, 'no state.kills yet');
    else say(first.dk === 1, `one torpedo kill counts once (+${first.dk})`);
  }
}

async function crash(page) {
  const r = await page.evaluate(async () => {
    const d = window.__universeDebug;
    const u = window.__universe();
    const pull = async (n) => {
      d.arms().select(n);
      await new Promise((ok) => setTimeout(ok, 800));
      d.state.fireBtn = true;
      await u.frames(2);
      d.state.fireBtn = false;
    };
    await pull(2);
    await pull(0);
    window.__fp.intoTheSun();
    let before = window.__fp.inFlight();
    const t = performance.now();
    while (!window.__universe().crash && performance.now() - t < 20000) {
      before = window.__fp.inFlight();
      await u.frames(1);
    }
    const at = window.__fp.inFlight();
    await u.frames(3);
    return { crashed: Boolean(window.__universe().crash), before, at, later: window.__fp.inFlight() };
  });
  say(r.crashed, 'the ship went into the sun');
  say(r.before.rounds + r.before.bolts > 0, `in flight just before: rounds ${r.before.rounds}, bolts ${r.before.bolts}`);
  console.log(`     at the crash: rounds ${r.at.rounds}, bolts ${r.at.bolts}; three frames on: rounds ${r.later.rounds}, bolts ${r.later.bolts}`);
  if (flag('expect') === 'clear') say(r.later.rounds === 0 && r.later.bolts === 0, `nothing left once the crash began (rounds ${r.later.rounds}, bolts ${r.later.bolts})`);
}

// a TIE 6 ahead in the galaxy, still, its id
const galaxyTarget = (page) =>
  page.evaluate(() => {
    const d = window.__galaxyDebug;
    d.pin({});
    d.ram(6);
    const b = d.hunters.bodies.at(-1);
    Object.assign(b.vel, { x: 0, y: 0, z: 0 });
    window.__fp.freeze('__galaxyDebug');
    window.__fp.recordTakers('__galaxyDebug');
    return b.id;
  });

async function galaxyBolt(page) {
  await galaxyTarget(page);
  await page.evaluate(() => window.__galaxyDebug.arms().select(0));
  let takers = [];
  // (held 6 s at most: a page drawn in software under load is slow to fire)
  for (let i = 0; i < 60 && !takers.length; i++) {
    takers = await page.evaluate(() => ((window.__galaxyDebug.state.fireBtn = true), [...window.__takers]));
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => (window.__galaxyDebug.state.fireBtn = false));
  say(takers[0] === 'hunter', `the galaxy's bolt: the hunter takes it (${takers.join(', ') || 'none'})`);
}

async function uniquePilots(page) {
  const id = await galaxyTarget(page);
  const fitted = await page.evaluate(() => window.__fp.fitUnique('__galaxyDebug', 'crystal'));
  await page.evaluate((i) => (window.__galaxyDebug.state.lock = { id: i, out: 0, manual: true }), id);
  // (held till the hunters are asked, 6 s at most: in software the lock takes a moment to come)
  for (let i = 0; i < 60 && !(await page.evaluate(() => ((window.__galaxyDebug.state.fireBtn = true), window.__asked.hunter > 0))); i++) await page.waitForTimeout(100);
  await page.evaluate(() => (window.__galaxyDebug.state.fireBtn = false));
  await page.waitForTimeout(3000);
  const asked = await page.evaluate(() => ({ ...window.__asked }));
  say(asked.hunter >= 1, `the Blue sky cluster asked the hunters (${asked.hunter}; fitted ${fitted})`);
  say(asked.pilot === 0, `and never the other pilots (${asked.pilot})`);
}

// a Star Destroyer brought in and the hunters held still, the ship pinned
// 20 out on +x of its first shield part, nose on; line 0 held 3 s: what of
// it the bolts hit (again from −x while no part has been hit in 20 s). (The
// page draws about a frame a second in software with the destroyer here,
// and a bolt takes some frames to fly 20 out.)
async function galaxyCapital(page) {
  const ready = await page.evaluate(() => {
    const d = window.__galaxyDebug;
    if (!d.pieces) return 'no set pieces';
    d.pin({});
    window.__fp.freeze('__galaxyDebug');
    return d.pieces.destroyer(d.state.ship, 'destroyer') ? 'ready' : 'no destroyer';
  });
  if (ready !== 'ready') return say(false, `the galaxy's capital ship (${ready})`);
  await page.waitForFunction(() => window.__galaxyDebug.pieces.destroyerHere && window.__galaxyDebug.pieces.targets.length > 0, null, { timeout: 60000 });
  await page.evaluate(() => {
    const d = window.__galaxyDebug;
    const p = d.pieces;
    window.__capHits = [];
    d.arms().select(0);
    if (p.hit.recorded) return;
    const real = p.hit;
    const f = (...a) => {
      const r = real.apply(p, a);
      if (r) window.__capHits.push(r.type);
      return r;
    };
    f.recorded = true;
    p.hit = f;
  });
  let types = [];
  for (const side of [1, -1]) {
    await page.evaluate((k) => {
      const d = window.__galaxyDebug;
      const at = d.pieces.targets[0].at;
      d.pin({ x: at.x + k * 20, y: at.y, z: at.z, heading: (k * Math.PI) / 2, pitch: 0 });
      d.state.fireBtn = true;
    }, side);
    await page.waitForTimeout(3000);
    await page.evaluate(() => (window.__galaxyDebug.state.fireBtn = false));
    for (let i = 0; i < 40 && !types.includes('part'); i++) {
      await page.waitForTimeout(500);
      types = await page.evaluate(() => [...window.__capHits]);
    }
    if (types.includes('part')) break;
  }
  await shoot(page, 'galaxy-capital');
  say(types.includes('part'), `the galaxy's bolt at the capital ship: a shield part takes it (${types.join(', ') || 'nothing hit'})`);
}

async function reach(page) {
  const fitted = await page.evaluate(async () => {
    await window.__universe().pose('rickmorty');
    return window.__fp.fitUnique('__universeDebug', 'seismic');
  });
  say(fitted === 'seismic', `seismic charges picked (${fitted})`);
  for (const [ahead, on] of [[6, true], [12, false]]) {
    const ship = await page.evaluate(() => {
      window.__universeDebug.hunters.clear();
      return window.__universeDebug.state.ship;
    });
    await page.evaluate((at) => window.__fp.forceLock(at), lockSpot(ship, { ...LOCK_SPOT, ahead }));
    await page.evaluate(() => window.__universe().frames(3));
    const lit = await page.evaluate(() => Boolean(document.querySelector('.universe-lead[data-on]')));
    await shoot(page, `reach-${ahead}`);
    say(lit === on, `seismic's lead pip ${on ? 'on' : 'off'} at ${ahead} out (${lit ? 'on' : 'off'})`);
  }
}

// Darth Vader held 12 ahead, in front of Middle-earth: where the bracket
// drew him, a tap, his lock cleared first (the planet's behind him)
async function tap(page) {
  const at = await page.evaluate(async () => {
    const d = window.__universeDebug;
    const u = window.__universe();
    await u.pose('middleearth');
    d.hunters?.clear();
    d.meetNpc('vader');
    const n = d.npcs;
    if (!n.update.stopped) {
      const real = n.update;
      const still = (dt, ...rest) => real.call(n, 0, ...rest);
      still.stopped = true;
      n.update = still;
    }
    const t = n.targets.at(-1);
    if (!t) return null;
    const s = d.state.ship;
    Object.assign(t.at, { x: s.x - Math.sin(s.heading) * 12, y: s.y, z: s.z - Math.cos(s.heading) * 12 });
    await u.frames(3);
    const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(document.querySelector('.universe-lock')?.style.transform ?? '');
    d.state.lock = null;
    await u.frames(1);
    return m ? { id: t.id, x: Number(m[1]), y: Number(m[2]) } : { id: t.id, x: null };
  });
  if (!at || at.x === null) return say(false, `a character to tap (${at ? 'no bracket drawn on him' : 'no character'})`);
  await page.mouse.click(at.x, at.y);
  await page.evaluate(() => window.__universe().frames(2));
  const got = await page.evaluate(() => ({ lock: window.__universe().lock ?? null, manual: Boolean(window.__universeDebug.state.lock?.manual) }));
  await shoot(page, 'tap');
  say(got.lock === at.id && got.manual, `a tap on Vader in front of the planet locks on to him, by hand (${got.lock ?? 'no lock'}${got.manual ? ', by hand' : ': not by hand, the planet took the tap'})`);
}

// Darth Vader held 20 behind at the far rim, the hunters gone: his threat
// arrow (he's on you), and no lock (he's behind)
async function threats(page) {
  const got = await page.evaluate(async () => {
    const d = window.__universeDebug;
    const u = window.__universe();
    await u.pose('far-rim');
    d.hunters?.clear();
    d.meetNpc('vader');
    const n = d.npcs;
    if (!n.update.stopped) {
      const real = n.update;
      const still = (dt, ...rest) => real.call(n, 0, ...rest);
      still.stopped = true;
      n.update = still;
    }
    const t = n.targets.at(-1);
    if (!t) return null;
    const s = d.state.ship;
    Object.assign(t.at, { x: s.x + Math.sin(s.heading) * 20, y: s.y, z: s.z + Math.cos(s.heading) * 20 });
    d.state.lock = null;
    await u.frames(3);
    return { arrows: document.querySelectorAll('.universe-threat[data-on]').length, lock: u.lock ?? null };
  });
  await shoot(page, 'threats');
  if (!got) return say(false, 'a character behind (no character)');
  say(got.arrows === 1 && got.lock === null, `Vader 20 behind: one threat arrow, no lock (${got.arrows} arrow${got.arrows === 1 ? '' : 's'}, ${got.lock === null ? 'no lock' : `locked on ${got.lock}`})`);
}

const galaxy = scenario === 'galaxy-bolt' || scenario === 'unique-pilots' || scenario === 'galaxy-capital';
const { browser, page, errors } = galaxy ? await openGalaxy() : await openUniverse();
try {
  if (scenario === 'order') await order(page);
  if (scenario === 'crash') await crash(page);
  if (scenario === 'galaxy-bolt') await galaxyBolt(page);
  if (scenario === 'unique-pilots') await uniquePilots(page);
  if (scenario === 'galaxy-capital') await galaxyCapital(page);
  if (scenario === 'reach') await reach(page);
  if (scenario === 'tap') await tap(page);
  if (scenario === 'threats') await threats(page);
} catch (e) {
  say(false, `${scenario}: ${String(e.message ?? e).split('\n')[0]}`);
}
say(errors.length === 0, `no page errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`);
await browser.close();
process.exit(failed);
