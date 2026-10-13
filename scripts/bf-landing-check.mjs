#!/usr/bin/env node
/* global window, document, requestAnimationFrame, MutationObserver */
// The way into the Battlefront world, walked and timed in a headless
// browser (the 2026-10-13 design, docs/superpowers/specs/
// 2026-10-13-hoth-landing-game-menu-design.md, its Checks): an address,
// the mark to wait for, then any marks to click and wait for in turn.
//
//   node scripts/bf-landing-check.mjs --url "#/battlefront/hoth?from=/galaxy/hoth" --until "[data-bf-stage=menu]"
//     [--then "<selector to click> => <selector to wait for>"]…   (in order)
//       ("key:Escape => <selector>" presses a key instead of clicking)
//     [--deny "<regex>"]       a request whose address matches fails the run (the surface world's files)
//     [--shot out.png]         a picture once the last mark is there
//     [--base http://127.0.0.1:5431] [--size 2560x1440] [--wait 240000]
//
// It prints one JSON line: { url, finalUrl, steps: [{ mark, ms }], ms,
// longestTaskMs, gapsOver100, p95GapMs, worlds, loads, denied, errors }. `ms` is
// from the address to the last mark; each step's `ms` is from the step
// before it. `longestTaskMs` and the gaps between frames are the main
// thread's, over the whole run (the profiler is never on: it makes gaps
// of its own). `worlds` is how many canvases were put in a world's box:
// one world for a visit is 1; `loads` is how many times the page loaded
// (1: it never loaded again under the player). It exits 1 on a denied request or a page
// error; the times are reported, not gated.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const one = (name, d = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : d;
};
const many = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const base = one('base', 'http://127.0.0.1:5431');
// (in Git Bash on Windows, run with MSYS_NO_PATHCONV=1: it rewrites an argument that looks like a path)
const url = one('url', '#/battlefront/hoth').replace(/^(?!\/)/, '/');
const until = one('until', '[data-bf-stage]');
const thens = many('then').map((t) => t.split('=>').map((x) => x.trim()));
const deny = one('deny') ? new RegExp(one('deny')) : null;
const shot = one('shot');
const [w, h] = one('size', '2560x1440').split('x').map(Number);
const WAIT = Number(one('wait', 240000));
const exe = process.env.CHROME ?? (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  localStorage.setItem('tp-intro', '1');
  localStorage.setItem('tp-start', '"universe"');
  localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.__check = { tasks: [], gaps: [], worlds: 0 };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__check.tasks.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  } catch {
    // (no long-task entries in this browser: the frames' gaps still tell)
  }
  let last = performance.now();
  const tick = (t) => {
    if (t - last > 50) window.__check.gaps.push(Math.round(t - last));
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) if (n.nodeName === 'CANVAS' && n.parentElement?.classList.contains('world-host')) window.__check.worlds++;
  }).observe(document, { childList: true, subtree: true });
});
const page = await ctx.newPage();
const errors = [];
const denied = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
let loads = 0;
page.on('load', () => loads++);
page.on('request', (r) => deny && deny.test(r.url()) && denied.push(r.url().slice(0, 200)));

const steps = [];
const t0 = Date.now();
let at = t0;
const mark = async (selector) => {
  // (attached, not visible: a screen's own box is empty where its parts are put at the body's end)
  await page.waitForSelector(selector, { state: 'attached', timeout: WAIT });
  steps.push({ mark: selector, ms: Date.now() - at });
  at = Date.now();
};
let failed = null;
try {
  await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  await mark(until);
  for (const [click, next] of thens) {
    if (click.startsWith('key:')) await page.keyboard.press(click.slice(4));
    else await page.click(click, { timeout: WAIT });
    await mark(next ?? click);
  }
} catch (e) {
  failed = String(e).split('\n')[0].slice(0, 240);
}
const ms = Date.now() - t0;
if (shot) await page.screenshot({ path: shot }).catch(() => {});
// (a page that loaded again has lost its counts: `loads` says so)
const seen = (await page.evaluate(() => window.__check).catch(() => null)) ?? { tasks: [], gaps: [], worlds: 0 };
const finalUrl = page.url().replace(base, '');
await browser.close();
const gaps = [...seen.gaps].sort((a, b) => a - b);
const report = {
  url,
  finalUrl,
  steps,
  ms,
  longestTaskMs: Math.max(0, ...seen.tasks),
  gapsOver100: gaps.filter((g) => g > 100).length,
  p95GapMs: gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.95))] : 0,
  longestGapMs: gaps.at(-1) ?? 0,
  worlds: seen.worlds,
  loads,
  denied: [...new Set(denied)].slice(0, 8),
  errors: [...new Set(failed ? [failed, ...errors] : errors)].slice(0, 8),
};
console.log(JSON.stringify(report));
process.exit(report.denied.length || report.errors.length ? 1 : 0);
