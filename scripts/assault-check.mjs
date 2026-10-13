/* global window */
// A browser check of a galactic assault (missions/assault.js) on a world
// (/galaxy/:id/surface?mission=assault): loads the page fresh, waits for the
// scene, then plays the battle through its dev hooks the way the HUD would:
// the choose card, a side, the deploy card, a post, a minute of the fight
// advanced without drawing, then the end both ways (win, its win key in
// the galaxy war's tally, then Again,
// then lose), a screenshot at each step, and the view at each read back to
// make sure the rules moved. With the dev server up (npx vite --port 5188)
// and Chromium where Playwright keeps it:
//   OUT=/tmp/shots node scripts/assault-check.mjs hoth,geonosis
//   SIDE=attack … (the side you fight for: defend unless said), QUALITY=mid …
// Exit code 1 on a page error, a console error that isn't a sandbox's
// noise, or a step that didn't take.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const list = process.argv[2] ?? 'hoth';
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? 'high';
const side = process.env.SIDE ?? 'defend';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
// (a screenshot's wait: a whole level's frame in software GL takes over a minute, as galaxy-check's SHOT_WAIT knows)
const SHOT_WAIT = Number(process.env.SHOT_WAIT ?? 120000);
const NOISE = [/WebSocket|wss:\/\/|relay|nostr/i, /net::ERR_|Failed to load resource/i, /SwiftShader|software WebGL|GPU stall|GL Driver Message|Automatic fallback|WebGL: too many errors/i, /AudioContext was not allowed/i, /\[vite\]|preload/i];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
const fail = (id, what) => {
  failed = true;
  console.log(`FAIL ${id}: ${what}`);
};
for (const id of list.split(',')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
    window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking: a software GL is slow, and that's the point)
    window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !NOISE.some((n) => n.test(m.text())) && errors.push(m.text()));
  const t0 = Date.now();
  await page.goto(`${base}/?quality=${quality}#/galaxy/${id}/surface?mission=assault`, { waitUntil: 'domcontentloaded' });
  const view = () => page.evaluate(() => window.__surface?.()?.mission ?? null);
  const shot = (name) => page.screenshot({ path: `${out}/assault-${id}-${name}.png`, timeout: SHOT_WAIT });
  try {
    await page.waitForFunction(() => window.__surface?.()?.mission?.phase === 'choose', null, { timeout: 240000 });
  } catch {
    fail(id, `timed out waiting for the battle's choose card (${errors[0] ?? 'no errors'})`);
    await ctx.close();
    continue;
  }
  console.log(`${id}: scene up in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  // (the ground's light baked first, where there's a ground to bake)
  await page.waitForFunction(() => Boolean(window.__surfaceScene?.api?.ground?.stats?.baked), null, { timeout: 150000, polling: 1000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await shot('1-choose');
  if (!(await page.getByRole('dialog', { name: /choose your side/i }).count())) fail(id, 'no choose card');

  // a side
  await page.evaluate((s) => window.__surfaceDo('missionDo', 'side', s), side);
  await page.waitForTimeout(1500);
  let v = await view();
  if (!v) {
    // (the page went away under us: the dev server reloaded it for an edit, most likely)
    fail(id, 'the scene was gone after choosing a side (an edit reloaded the page?)');
    await ctx.close();
    continue;
  }
  if (v.phase !== 'run' || v.you.side !== side) fail(id, `side not taken: ${JSON.stringify({ phase: v.phase, side: v.you?.side })}`);
  await shot('2-deploy');
  if (!(await page.getByRole('dialog', { name: /deploy/i }).count())) fail(id, 'no deploy card');

  // onto the field at the first post that'll have you
  const post = v.posts.find((p) => p.can);
  if (!post) fail(id, 'nowhere to deploy');
  else {
    const tickets = v.tickets[side];
    await page.evaluate((p) => window.__surfaceDo('missionDo', 'deploy', p), post.id);
    await page.waitForTimeout(1200);
    v = await view();
    if (!v.you.up) fail(id, 'not on the field after deploying');
    if (v.tickets[side] !== tickets - 1) fail(id, `deploying cost ${tickets - v.tickets[side]} tickets, not one`);
    const you = await page.evaluate(() => window.__surface().you);
    if (Math.hypot(you.x - post.at?.[0], you.z - post.at?.[1]) > 30 && post.at) fail(id, 'deployed somewhere else');
  }
  // a minute of the fight, without drawing it, then a look: the soldiers
  // walked (their bodies moved), and the armies met (a post's meter moved,
  // or somebody fell: a ticket spent, a line in the feed)
  const where = () =>
    page.evaluate(() => {
      const g = window.__surfaceScene?.scene?.getObjectByName('assault');
      // (a soldier's holder has its chevron and its figure; a post's its column and rings)
      const bodies = g ? g.children.filter((o) => o.children.some((c) => c.isSprite)) : [];
      return { all: g?.children.length ?? 0, drawn: bodies.filter((o) => o.visible).length, at: bodies.map((o) => [+o.position.x.toFixed(1), +o.position.z.toFixed(1)]) };
    });
  const before = await page.evaluate(() => window.__surface().mission);
  const was = await where();
  await page.evaluate(() => window.__surfaceDo('advance', 60));
  await page.waitForTimeout(3000);
  await shot('3-fight');
  v = await view();
  const now = await where();
  if (!(v.t > before.t + 50)) fail(id, `the clock didn't move (${before.t} → ${v?.t})`);
  const walked = now.at.filter((p, i) => was.at[i] && Math.hypot(p[0] - was.at[i][0], p[1] - was.at[i][1]) > 5).length;
  if (walked < 4) fail(id, `only ${walked} soldiers walked in a minute`);
  const met = v.posts.some((p, i) => p.meter !== before.posts[i].meter || p.owner !== before.posts[i].owner) || v.feed.length > 0 || v.tickets.attack !== before.tickets.attack || v.tickets.defend !== before.tickets.defend;
  if (!met) fail(id, 'the armies never met in a minute: no post moved, nobody fell');
  console.log(`${id}: after a minute, phase ${v.phaseIndex + 1}, tickets ${v.tickets.attack}/${v.tickets.defend}, feed ${v.feed.length}, ${walked} soldiers walked, ${now.drawn} of ${now.at.length} drawn, posts ${v.posts.map((p) => `${p.letter || '◆'}:${p.owner?.[0] ?? '-'}${p.meter.toFixed(2)}`).join(' ')}`);
  if (now.drawn < 4) fail(id, `only ${now.drawn} soldiers drawn`);

  // the end, both ways
  await page.evaluate(() => window.__surfaceDo('missionDo', 'win'));
  await page.waitForTimeout(1200);
  v = await view();
  if (!v.result?.won) fail(id, 'win did not end it');
  await shot('4-won');
  if (!(await page.getByRole('dialog', { name: /won/i }).count())) fail(id, 'no result card after the win');
  // and the win's the galaxy's war's: a win key in the tally, for the side fought for
  const tally = await page.evaluate(() => window.localStorage.getItem('tp-gcw') ?? '');
  await page.waitForTimeout(1800); // (the tally's kept a moment after it changes)
  const kept = await page.evaluate(() => window.localStorage.getItem('tp-gcw') ?? '');
  if (!/"win:[a-z]+:/.test(kept || tally)) fail(id, `the win didn't reach the war's tally: ${(kept || tally).slice(0, 120)}`);
  else console.log(`${id}: the win is in the war's tally`);
  await page.getByRole('button', { name: 'Again' }).click();
  await page.waitForTimeout(1500);
  v = await view();
  if (v?.phase !== 'choose' || v.result) fail(id, `Again did not start over: ${v?.phase}`);
  await page.evaluate((s) => window.__surfaceDo('missionDo', 'side', s), side);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__surfaceDo('missionDo', 'lose'));
  await page.waitForTimeout(1200);
  v = await view();
  if (!v.result || v.result.won) fail(id, 'lose did not end it');
  await shot('5-lost');
  if (errors.length) fail(id, `errors: ${errors.slice(0, 3).join(' | ')}`);
  else console.log(`${id}: ok, no console errors`);
  await ctx.close();
}
await browser.close();
if (failed) process.exitCode = 1;
