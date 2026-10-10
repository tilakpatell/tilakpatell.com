/* global window */
// A browser check of Heroes vs Villains and Blast (missions/hvv.js,
// blast.js) on a world (/galaxy/:id/surface?mission=hvv | blast): loads the
// page fresh, waits for the scene, then plays each through its dev hooks
// the way the HUD would: the choose card, a side, the deploy card, onto the
// field, a minute of the fight advanced without drawing, a few points to a
// side (HvV: missionDo('score', side)), then the end both ways, a
// screenshot at each step. With the dev server up (npx vite --port 5188):
//   OUT=docs/superpowers/evidence/bf-hvv-blast node scripts/hvv-check.mjs hoth,endor [hvv,blast]
//   SIDE=dark … (HvV's side: light unless said; Blast's is attack, the light), QUALITY=mid …
//   PROXY=$HTTPS_PROXY … (Chromium through a proxy: the 2017 heroes' bodies are the bucket's alone, so the dev
//   server runs with VITE_ASSET_BASE set to it, and a sandbox reaches it through its proxy)
// Exit code 1 on a page error, a console error that isn't a sandbox's
// noise, or a step that didn't take.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const list = process.argv[2] ?? 'hoth';
const modes = (process.argv[3] ?? 'hvv,blast').split(',');
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? 'high';
const hvvSide = process.env.SIDE ?? 'light';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const NOISE = [/WebSocket|wss:\/\/|relay|nostr/i, /net::ERR_|Failed to load resource/i, /SwiftShader|software WebGL|GPU stall|GL Driver Message|Automatic fallback|WebGL: too many errors/i, /AudioContext was not allowed/i, /\[vite\]|preload/i];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, ...(process.env.PROXY ? { proxy: { server: process.env.PROXY, bypass: `127.0.0.1,localhost,${new URL(base).hostname}` } } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
const fail = (id, what) => {
  failed = true;
  console.log(`FAIL ${id}: ${what}`);
};
for (const id of list.split(','))
  for (const mode of modes) {
    const tag = `${id} ${mode}`;
    const side = mode === 'hvv' ? hvvSide : 'attack';
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
      window.sessionStorage.setItem('tp-galaxy-intro', '1');
      window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && !NOISE.some((n) => n.test(m.text())) && errors.push(m.text()));
    const t0 = Date.now();
    await page.goto(`${base}/?quality=${quality}#/galaxy/${id}/surface?mission=${mode}`, { waitUntil: 'domcontentloaded' });
    const view = () => page.evaluate(() => window.__surface?.()?.mission ?? null);
    const shot = (name) => page.screenshot({ path: `${out}/${mode}-${id}-${name}.png`, timeout: 120000 });
    try {
      await page.waitForFunction(() => window.__surface?.()?.mission?.phase === 'choose', null, { timeout: 420000 });
    } catch {
      fail(tag, `timed out waiting for the choose card (${errors[0] ?? 'no errors'})`);
      await ctx.close();
      continue;
    }
    console.log(`${tag}: scene up in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await page.waitForFunction(() => Boolean(window.__surfaceScene?.api?.ground?.stats?.baked), null, { timeout: 150000, polling: 1000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await shot('1-choose');
    if (!(await page.getByRole('dialog', { name: /choose your side/i }).count())) fail(tag, 'no choose card');

    await page.evaluate((s) => window.__surfaceDo('missionDo', 'side', s), side);
    await page.waitForTimeout(1500);
    let v = await view();
    if (!v || v.phase !== 'run' || v.you.side !== side) fail(tag, `side not taken: ${JSON.stringify({ phase: v?.phase, side: v?.you?.side })}`);
    await shot('2-deploy');
    if (!(await page.getByRole('dialog', { name: /deploy/i }).count())) fail(tag, 'no deploy card');
    const spawn = mode === 'blast' ? v.posts.find((p) => p.fixed === side)?.id : null;
    await page.evaluate((p) => window.__surfaceDo('missionDo', 'deploy', p), spawn);
    await page.waitForTimeout(1500);
    v = await view();
    if (!v.you.up) fail(tag, 'not on the field after deploying');
    // (let the figures in, and a few seconds of the field)
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.__surfaceDo('advance', 4));
    await page.waitForTimeout(1500);
    await shot('3-field');

    // a minute of the fight, without drawing it: somebody fell
    const before = v;
    await page.evaluate(() => window.__surfaceDo('advance', 60));
    await page.waitForTimeout(3000);
    v = await view();
    if (!(v.t > before.t + 50)) fail(tag, `the clock didn't move (${before.t} → ${v?.t})`);
    const drawn = await page.evaluate((m) => {
      const g = window.__surfaceScene?.scene?.getObjectByName(m);
      return g ? g.children.filter((o) => o.visible && o.children.some((c) => c.isSprite)).length : 0;
    }, mode);
    if (mode === 'hvv') {
      const fell = v.feed.length > 0 || v.score.light + v.score.dark > 0 || v.fighters.some((f) => !f.up && !f.you);
      if (!fell) fail(tag, 'nobody fell in a minute');
      console.log(`${tag}: after a minute ${v.score.light}–${v.score.dark}, targets ${v.targets.light?.name} and ${v.targets.dark?.name}, ${drawn} heroes drawn, feed ${v.feed.length}`);
      if (drawn < 4) fail(tag, `only ${drawn} heroes drawn`);
      for (let i = 0; i < 3; i++) await page.evaluate((s) => window.__surfaceDo('missionDo', 'score', s), side);
      await page.waitForTimeout(1500);
      v = await view();
      if (v.score[side] < 3) fail(tag, `the dev points didn't land: ${JSON.stringify(v.score)}`);
    } else {
      const k = v.kills.attack + v.kills.defend;
      if (k === 0) fail(tag, 'nobody fell in a minute');
      console.log(`${tag}: after a minute ${v.kills.attack}–${v.kills.defend} kills, ${drawn} soldiers drawn`);
      if (drawn < 4) fail(tag, `only ${drawn} soldiers drawn`);
    }
    // (a view held on the nearest figure drawn, from a few metres off: the fight close to)
    const near = await page.evaluate((m) => {
      const g = window.__surfaceScene?.scene?.getObjectByName(m);
      const you = window.__surface().you;
      const list = g ? g.children.filter((o) => o.visible && o.children.some((c) => c.isSprite)).map((o) => [o.position.x, o.position.z]) : [];
      list.sort((a, b) => Math.hypot(a[0] - you.x, a[1] - you.z) - Math.hypot(b[0] - you.x, b[1] - you.z));
      return list[0] ?? null;
    }, mode);
    if (near) {
      await page.evaluate(([x, z]) => window.__surfaceScene.view([x + 5, 2.2, z + 5], [x, 1.1, z]), near);
      await page.evaluate(() => window.__surfaceDo('advance', 0.4));
      await page.waitForTimeout(1500);
    }
    await shot('4-fight');
    if (near) await page.evaluate(() => window.__surfaceScene.view(null));

    await page.evaluate(() => window.__surfaceDo('missionDo', 'win'));
    await page.waitForTimeout(1200);
    v = await view();
    if (!v.result?.won) fail(tag, 'win did not end it');
    await shot('5-won');
    if (!(await page.getByRole('dialog', { name: /won/i }).count())) fail(tag, 'no result card after the win');
    await page.getByRole('button', { name: 'Again' }).click();
    await page.waitForTimeout(1500);
    v = await view();
    if (v?.phase !== 'choose' || v.result) fail(tag, `Again did not start over: ${v?.phase}`);
    await page.evaluate((s) => window.__surfaceDo('missionDo', 'side', s), side);
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__surfaceDo('missionDo', 'lose'));
    await page.waitForTimeout(1200);
    v = await view();
    if (!v.result || v.result.won) fail(tag, 'lose did not end it');
    await shot('6-lost');
    if (errors.length) fail(tag, `errors: ${errors.slice(0, 3).join(' | ')}`);
    else console.log(`${tag}: ok, no console errors`);
    await ctx.close();
  }
await browser.close();
if (failed) process.exitCode = 1;
