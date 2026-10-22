/* global window, document */
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
//
// GROUND=1 checks each world's ground war instead (no mission: the
// galaxy's surface as you land on it): your oath sworn against the world's
// holder, so its garrison is yours to fight; you set down by the pad's first
// post; then a minute advanced a second at a time. It passes when someone
// fights within 60 s (a soldier with a target) and nobody is stuck (a
// soldier walking, by its mode, that has gone under a metre in ten seconds;
// and none its brain says has failed to move for ten). A world on the
// game's own level (Hoth: galaxy/gameLevels.js) has no galaxy surface: its
// soldiers are the Battlefront world's bots, and the check says so.
//   GROUND=1 node scripts/assault-check.mjs hoth,geonosis,scarif,endor
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
const prepare = async (ctx) =>
  ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.localStorage.setItem('tp-software', JSON.stringify('on'));
  });

// the modes a soldier walks in (the fight's, fight.js; its post's and beat's)
const WALKING = new Set(['advance', 'close', 'flank', 'back', 'patrol']);
const STUCK = 10; // seconds walking under a metre that make a soldier stuck
const BRAINS = 120; // metres round you inside which soldiers are stepped (ground/groundScene.js)

async function groundPass(id) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await prepare(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !NOISE.some((n) => n.test(m.text())) && errors.push(m.text()));
  const url = `${base}/?quality=${quality}#/galaxy/${id}/surface`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 300000 });
  // (the game's own level: the address goes to the Battlefront world's menu)
  const up = () => page.waitForFunction(() => Boolean(window.__surfaceScene?.groundWar) || window.location.hash.includes('/battlefront'), null, { timeout: 240000 });
  try {
    await up();
  } catch {
    fail(id, `the surface never came up (${errors[0] ?? 'no errors'})`);
    return ctx.close();
  }
  if (await page.evaluate(() => window.location.hash.includes('/battlefront'))) {
    console.log(`${id}: the game's own level, so the Battlefront world's: its soldiers are that world's bots, on the brain already (src/lib/battlefront/ai/bots.js)`);
    return ctx.close();
  }
  // sworn against whoever holds it, then the world again
  const sworn = await page.evaluate(async (sys) => {
    const al = await import('/src/components/galaxy/allegiance.js');
    const war = await import('/src/components/galaxy/siteWar.js');
    const sides = await import('/src/components/galaxy/sides.js');
    const a = al.readAllegiance(window.localStorage.getItem(al.SIDE_KEY));
    const e = war.groundEffects(sys, a, Date.now());
    const side = e?.owner ? sides.otherSide(e.owner) : null;
    if (!side) return { owner: e?.owner ?? null, side: null };
    window.localStorage.setItem(al.SIDE_KEY, JSON.stringify(al.swear(a, side)));
    return { owner: e.owner, side, war: e.war };
  }, id);
  if (!sworn.side) {
    console.log(`${id}: held by ${sworn.owner ?? 'nobody'}, whom nobody swears against: no garrison to fight`);
    return ctx.close();
  }
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 300000 });
  try {
    await up();
  } catch {
    fail(id, `the surface never came up again (${errors[0] ?? 'no errors'})`);
    return ctx.close();
  }
  await page.waitForFunction(() => (window.__surfaceScene?.groundWar?.posts?.length ?? 0) > 0, null, { timeout: 60000 }).catch(() => {});
  // (the world on: the veil gone, the scene the runtime's, so `advance` steps it. A level whose pack
  // holds a step (a file the bucket lacks) offers "Go in anyway" after a while: taken, as a player would)
  let held = null;
  for (let k = 0; k < 120; k++) {
    if (await page.evaluate(() => Boolean(window.__surface?.()))) break;
    held = await page.evaluate(() => document.querySelector('.loading-veil')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null);
    const skip = page.locator('.loading-veil-skip');
    if (await skip.count()) await skip.first().click().catch(() => {});
    await page.waitForTimeout(2000);
  }
  if (!(await page.evaluate(() => Boolean(window.__surface?.())))) {
    fail(id, `the world never came on (the veil: ${held ?? 'none'})`);
    return ctx.close();
  }
  if (held) console.log(`${id}: went in past the veil (${held})`);
  // (down from the ship once the landing has begun: out of it, where the post's holders face)
  await page.waitForFunction(() => ['landing', 'out', 'walk'].includes(window.__surfaceScene?.you?.()?.phase), null, { timeout: 240000, polling: 500 }).catch(() => {});
  // (the landing played out to its end, so it doesn't set you back by the ship once you're put down)
  for (let k = 0; k < 90 && (await page.evaluate(() => window.__surfaceScene.you().phase)) !== 'walk'; k++) await page.evaluate(() => window.__surfaceDo('advance', 1));
  // (a spot the holders of one of its posts face, not far over or under them (the soldiers'
  // line is walker.js's lineClear, flat: the ground hides nobody, but a rock between does, whatever
  // the heights), clear of the world's solids and with a clear line to them)
  const at = await page.evaluate(async () => {
    const s = window.__surfaceScene;
    const { lineClear, pushOut } = await import('/src/components/galaxy/surface/walker.js');
    const owner = s.groundWar.turfs[0]?.side;
    const why = { posts: 0, height: 0, inside: 0, line: 0 };
    for (const turf of s.groundWar.turfs.filter((t) => t.side === owner))
      for (const post of turf.posts ?? []) {
        why.posts += 1;
        const near = s.solidsNear(post[0], post[1], 60);
        const solids = { near: () => near };
        const h = s.heightAt(post[0], post[1]);
        // (the holders face out from their turf's middle: the bearings across their sight first)
        const out = Math.atan2(post[0] - turf.at[0], post[1] - turf.at[1]);
        const ways = Array.from({ length: 9 }, (_, k) => out + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI) / 8);
        // (nearer last: on a world of cliffs and mesas, Geonosis, the post's own ledge may be the only ground about its height)
        for (const r of [18, 25, 32, 12, 40, 8, 5])
          for (const a of ways) {
            const p = [post[0] + Math.sin(a) * r, post[1] + Math.cos(a) * r];
            // (from just ahead of the post: its own sandbags are behind the holders, not between)
            const eye = { x: post[0] + Math.sin(a) * 1.5, z: post[1] + Math.cos(a) * 1.5 };
            const g = s.heightAt(p[0], p[1]);
            if (Math.abs(g - h) > 12 && ++why.height) continue;
            // (a solid under you, a ledge's top you stand on, or one over your head, is no wall: walker.js's top and base)
            const walls = (o) => !(o.top != null && o.top <= g + 0.6) && !(o.base != null && o.base >= g + 2);
            if (near.some((o) => walls(o) && pushOut(o, p[0], p[1], 0.6)) && ++why.inside) continue;
            if (!lineClear(solids, eye, { x: p[0], z: p[1] }) && ++why.line) continue;
            s.put(p[0], p[1]);
            return { p, post, r };
          }
      }
    return { why };
  });
  if (!at.p) {
    fail(id, `held by ${sworn.owner}, but no post of its has a spot in its holders' line on ground about their own (${JSON.stringify(at.why)})`);
    return ctx.close();
  }
  await page.evaluate(() => window.__surfaceDo('advance', 0.5));
  const now = await page.evaluate(() => window.__surfaceScene.you());
  if (now.phase !== 'walk' || Math.hypot(now.x - at.p[0], now.z - at.p[1]) > 4) {
    fail(id, `not on foot where set down (${now.phase} at [${Math.round(now.x)}, ${Math.round(now.z)}])`);
    return ctx.close();
  }
  console.log(`${id}: held by ${sworn.owner} (${sworn.war}), sworn ${sworn.side}; set down at [${at.p.map(Math.round)}], ${at.r} m from its post at [${at.post.map(Math.round)}], in its holders' sight and line`);
  const seen = new Map(); // id → [{ t, at, mode }]
  let fight = null;
  let atYou = null;
  let most = 0;
  let stuck = new Set();
  let brainStuck = new Set();
  let ms = 0;
  for (let t = 1; t <= 60; t++) {
    await page.evaluate(() => window.__surfaceDo('advance', 1));
    const { rows, you } = await page.evaluate(() => ({ rows: window.__surfaceScene.groundWar.debug(), you: window.__surfaceScene.you() }));
    ms = await page.evaluate(() => window.__surfaceScene.groundWar.ms);
    most = Math.max(most, rows.length);
    // (GROUND_DEBUG=1: what the nearest believe of you, now and then)
    if (process.env.GROUND_DEBUG && t % 10 === 1)
      console.log(JSON.stringify(await page.evaluate((y) => {
        const g = window.__surfaceScene.groundWar;
        const near = g.debug().sort((a, b) => Math.hypot(a.at[0] - y.x, a.at[1] - y.z) - Math.hypot(b.at[0] - y.x, b.at[1] - y.z)).slice(0, 2);
        return { t: window.__surface?.()?.t ?? null, near: near.map((r) => ({ id: r.id, mode: r.mode, at: r.at, probe: g.probe?.(r.id) })) };
      }, you)));
    for (const r of rows) {
      if (r.down) continue;
      // (only those being stepped, inside the brains' reach of you: groundScene.js's BRAINS; the rest stand as they were left)
      if (Math.hypot(r.at[0] - you.x, r.at[1] - you.z) > BRAINS) {
        seen.delete(r.id);
        continue;
      }
      if (r.target && fight === null) fight = t;
      if (r.target === 'you' && atYou === null) atYou = t;
      if ((r.stuck ?? 0) >= STUCK) brainStuck.add(r.id);
      const h = seen.get(r.id) ?? [];
      h.push({ t, at: r.at, mode: r.mode });
      seen.set(r.id, h);
      const last = h.slice(-STUCK - 1);
      if (last.length > STUCK && last.every((p) => WALKING.has(p.mode)) && Math.hypot(last[0].at[0] - r.at[0], last[0].at[1] - r.at[1]) < 1) stuck.add(r.id);
    }
  }
  // (what the brains cost, where the ground war has them: groundScene.js's brains())
  const brains = await page.evaluate(() => window.__surfaceScene.groundWar.brains?.() ?? null);
  const modes = {};
  for (const h of seen.values()) for (const p of h) modes[p.mode] = (modes[p.mode] ?? 0) + 1;
  console.log(`${id}: ${most} soldiers at most; first fight at ${fight ?? '-'} s, first at you at ${atYou ?? '-'} s; stuck ${stuck.size} (walking under a metre in ${STUCK} s)${brainStuck.size ? `, ${brainStuck.size} by their brains` : ''}; the war's update ${ms.toFixed(2)} ms${brains?.loaded ? ` (the brains: ${brains.thinks} thinks ${brains.think} ms, ${brains.acts} steps ${brains.act} ms; the navgrid built ${brains.nav?.builds} times, the last in ${brains.nav?.ms} ms over frames, ${brains.nav?.worst} ms at most in one; ${brains.difficulty})` : ''}; modes ${Object.entries(modes)
    .sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `${m} ${n}`)
    .join(', ')}`);
  if (fight === null || fight > 60) fail(id, 'nobody fought within a minute of landing');
  if (stuck.size || brainStuck.size) fail(id, `stuck: ${[...new Set([...stuck, ...brainStuck])].slice(0, 6).join(', ')}`);
  if (errors.length) fail(id, `errors: ${errors.slice(0, 3).join(' | ')}`);
  await page.screenshot({ path: `${out}/ground-${id}.png`, timeout: SHOT_WAIT }).catch(() => {});
  return ctx.close();
}

if (process.env.GROUND) {
  for (const id of list.split(',')) await groundPass(id);
  await browser.close();
  if (failed) process.exitCode = 1;
  process.exit();
}

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
