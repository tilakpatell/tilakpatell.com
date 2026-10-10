/* global window */
// The galaxy surface's landing, timed (scripts/landing-check.mjs --surface):
// a world's page loaded fresh in a fronted tab, its prepare's steps (the
// runtime's 'prepare' events, dev only) timed as they come, the files that
// failed, and how long until the world is on screen. With the dev server up:
//   node scripts/landing-check.mjs --surface hoth [--hero luke] [--limit 25]
//   BASE=http://127.0.0.1:5188 QUALITY=high OUT=docs/superpowers/evidence/bf-flow …
// Exits 1 when the world isn't on screen inside --limit seconds (decision 8
// of the flow design: 25 s with the bucket base, 30 s without, at high, on a
// real graphics chip; SwiftShader in a cloud box is far slower, so there the
// steps are compared, not the seconds: LIMIT=0 reports without failing).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

export async function run(args) {
  const flag = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 ? args.splice(i, 2)[1] : dflt;
  };
  const hero = flag('--hero', null);
  const limit = Number(flag('--limit', process.env.LIMIT ?? 0));
  const ids = args.length ? args : ['hoth'];
  const base = process.env.BASE ?? 'http://127.0.0.1:5188';
  const quality = process.env.QUALITY ?? 'high';
  const out = process.env.OUT ?? null;
  const angle = process.env.ANGLE ?? 'swiftshader';
  if (out) mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', `--use-angle=${angle}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let failed = false;
  for (const id of ids) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript((h) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
      window.sessionStorage.setItem('tp-galaxy-intro', '1');
      window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
      window.localStorage.setItem('tp-galaxy-mode-ask', JSON.stringify('never'));
      if (h) window.localStorage.setItem('tp-galaxy-hero', JSON.stringify({ id: h }));
      // (the prepare's steps as they come, timed from the page's start)
      window.__steps = [];
      const hook = () => {
        const rt = window.__RUNTIME__;
        if (!rt) return void setTimeout(hook, 50);
        rt.events.on('prepare', (e) => {
          const last = window.__steps[window.__steps.length - 1];
          if (last?.step !== e.step) window.__steps.push({ step: e.step, t: performance.now(), value: e.value });
          else last.value = e.value;
        });
      };
      hook();
    }, hero);
    const page = await ctx.newPage();
    await page.bringToFront();
    const missing = [];
    const errors = [];
    page.on('response', (r) => r.status() >= 400 && missing.push(`${r.status()} ${r.url().replace(base, '')}`));
    page.on('requestfailed', (r) => missing.push(`failed ${r.url().replace(base, '')}`));
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => /stood in|didn’t arrive/.test(m.text()) && errors.push(m.text()));
    const t0 = Date.now();
    await page.goto(`${base}/?quality=${quality}&calibrate=off#/galaxy/${id}/surface`, { waitUntil: 'domcontentloaded' });
    // (HIDDEN=1: another tab over it, as a page left behind in the background)
    if (process.env.HIDDEN) await (await ctx.newPage()).bringToFront();
    const on = await page
      .waitForFunction(() => window.__RUNTIME__?.status === 'on', null, { timeout: Number(process.env.DRAW_WAIT ?? 900000), polling: 250 })
      .then(() => true)
      .catch(() => false);
    const secs = (Date.now() - t0) / 1000;
    const steps = await page.evaluate(() => window.__steps);
    const textures = await page.evaluate(() => window.__surfaceScene?.renderer?.info?.memory?.textures ?? null);
    if (textures != null) console.log(`  textures on the chip: ${textures}`);
    const toast = await page.$eval('.surface-toast, [role="alert"]', (el) => el.textContent).catch(() => null);
    console.log(`${id} at ${quality}, ${process.env.VITE_ASSET_BASE || /5189/.test(base) ? 'with' : 'without'} the base: ${on ? 'on screen' : 'NEVER on screen'} after ${secs.toFixed(1)} s`);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const next = steps[i + 1]?.t ?? null;
      console.log(`  ${s.step.padEnd(12)} from ${(s.t / 1000).toFixed(1).padStart(6)} s  for ${next ? ((next - s.t) / 1000).toFixed(1).padStart(6) : '     …'} s  (to ${Math.round(s.value * 100)}%)`);
    }
    if (missing.length) console.log(`  ${missing.length} files missing or failed:\n    ${[...new Set(missing)].slice(0, 12).join('\n    ')}`);
    if (toast) console.log(`  toast: ${toast}`);
    if (errors.length) console.log(`  ${errors.slice(0, 5).join('\n  ')}`);
    if (out) await page.screenshot({ path: `${out}/landing-${id}-${quality}${hero ? `-${hero}` : ''}.png`, timeout: 120000 }).catch(() => {});
    if (!on || (limit && secs > limit)) failed = true;
    await ctx.close();
  }
  await browser.close();
  return failed ? 1 : 0;
}
