/* global window, requestAnimationFrame */
// A browser check of Starfighter Assault over a world (lane A of the flow
// design: docs/superpowers/plans/2026-10-10-bf-flow-laneA-starfighter.md),
// on the galaxy's flight page: /galaxy/<system>?battle=starfighter. It
// waits for the level's battle in place of the war's (warfront.js's info:
// `laid.kind` 'starfighter') and its pack (spaceLevel.js) to come in, puts
// the ship at the stages file's camera (behind the Star Destroyer, facing
// the MC80), and then:
// - one whole frame's renderer counts, held to the quality level's row of
//   the budget table (src/lib/budgets.js: draw calls and triangles);
// - the MC80 in frame: the pixels in a box round where its hull projects,
//   with the pack drawn and then hidden, must differ (the game's own ship
//   drawn there);
// - the stage line and the battle's objectives, and no console error.
// With the dev server up (npx vite --port 5188) and Chromium where
// Playwright keeps it:
//   OUT=/tmp/shots node scripts/starfighter-check.mjs [endor] [mid]
//   PHASE_WAIT=1500000 … (a level pack in software GL takes minutes)
//   SIDE=rebel … (the side to fly for; the attacker's, the Empire's, otherwise)
//   (any system with one: `node scripts/starfighter-check.mjs kamino mid`, in its own area)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { budget } from '../src/lib/budgets.js';

const [system = 'endor', quality = process.env.QUALITY ?? 'mid'] = process.argv.slice(2);
const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const wait = Number(process.env.PHASE_WAIT ?? 600000);
const side = process.env.SIDE ?? '';
mkdirSync(out, { recursive: true });

let failed = 0;
const ok = (good, what) => {
  if (!good) failed++;
  console.log(good ? 'ok  ' : 'FAIL', what);
};

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));
const t0 = Date.now();
await page.goto(`${base}/?quality=${quality}&calibrate=off#/galaxy/${system}?battle=starfighter${side ? `&side=${side}` : ''}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__galaxyDebug?.war?.info?.laid?.kind === 'starfighter', null, { timeout: wait, polling: 1000 });
console.log(`the level's battle in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const info = await page.evaluate(() => {
  const w = window.__galaxyDebug.war;
  return { laid: w.info.laid, team: w.info.team, stage: w.info.stage, objectives: w.info.objectives.length, capitals: w.battle.capitals.map((c) => ({ kind: c.kind, team: c.team, at: [c.pos.x, c.pos.y, c.pos.z] })) };
});
ok(info.laid.kind === 'starfighter' && info.stage?.index === 0, `the battle is the level's: stage ${info.stage?.index + 1} of ${info.stage?.count}, ${info.stage?.title}, ${info.objectives} objectives, flying for team ${info.team}`);
ok(info.capitals.length > 2, `its ships: ${info.capitals.map((c) => c.kind).join(', ')}`);
// (a level fought in an area of its own: inside its dome, in its storm)
const area = await page.evaluate(() => {
  const a = window.__galaxyDebug.scene.getObjectByName('level-area');
  return a ? { at: a.position.toArray() } : null;
});
if (area) ok(true, `its own area at ${area.at.map((x) => x.toFixed(0)).join(', ')}`);

// the pack in (its cells and its meshes round the camera)
await page.waitForFunction(() => window.__RUNTIME__?.status !== 'loading', null, { timeout: wait, polling: 2000 }).catch(() => {});
// the ship at the stages' camera: behind the Star Destroyer, facing the MC80
// (put there again before it's measured: a minute of loading and it's drifted)
const place = () =>
  page.evaluate(() => {
    const { state, war } = window.__galaxyDebug;
    const caps = war.battle.capitals;
    // (the attacker's flagship and the defender's: the Star Destroyer and the MC80 at Endor)
    const isd = caps.find((c) => c.team === war.battle.attacker && c.role === 'flagship').pos;
    const mc = caps.find((c) => c.team === war.battle.defender && c.role === 'flagship').pos;
    const dx = mc.x - isd.x;
    const dz = mc.z - isd.z;
    const l = Math.hypot(dx, dz);
    const p = { x: isd.x - (dx / l) * 22, y: isd.y + 6, z: isd.z - (dz / l) * 22 };
    const heading = Math.atan2(-(mc.x - p.x), -(mc.z - p.z));
    // (and turned on 0.3: the chase camera rides above the ship, and this brings the MC80 into the middle of the frame, measured)
    const pitch = Math.atan2(mc.y - p.y, Math.hypot(mc.x - p.x, mc.z - p.z)) + 0.3;
    const pose = { ...p, heading, pitch, bank: 0 };
    if (window.__galaxyDebug.pin) window.__galaxyDebug.pin(pose);
    else state.ship = { ...state.ship, ...pose, speed: 0 };
    return pose;
  });
const pose = await place();
// (the meshes the camera's place wants, fetched and decoded: a software GL's minutes)
const settle = Date.now();
let last = -1;
while (Date.now() - settle < wait) {
  await page.waitForTimeout(10000);
  const n = await page.evaluate(() => window.__galaxyDebug.scene.children.find((o) => o.name.startsWith('level-sb_'))?.children[0]?.children.length ?? 0);
  if (n === last && n > 0) break;
  last = n;
}
console.log(`the pack's draws settled in ${((Date.now() - settle) / 1000).toFixed(0)} s (${last} groups)`);
await place();
await page.waitForTimeout(4000);

const frame = () =>
  page.evaluate(
    () =>
      new Promise((done) => {
        const renderer = window.__galaxyDebug.renderer;
        const i = renderer.info;
        const was = i.autoReset;
        i.autoReset = false;
        let n = 0;
        const times = [];
        let t = performance.now();
        const tick = (now) => {
          window.__RUNTIME__?.invalidate();
          times.push(now - t);
          t = now;
          const f = { calls: i.render.calls, triangles: i.render.triangles };
          i.reset();
          if (++n < 4) requestAnimationFrame(tick);
          else {
            i.autoReset = was;
            done({ ...f, ms: times.slice(1) });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
const row = budget(quality);
const f = await frame();
ok(f.calls <= row.calls, `draw calls ${f.calls} (the ${quality} row: ${row.calls})`);
ok(f.triangles <= row.tris, `triangles ${(f.triangles / 1e6).toFixed(2)}M (the ${quality} row: ${(row.tris / 1e6).toFixed(1)}M)`);
console.log(`frame times in software GL: ${f.ms.map((x) => x.toFixed(0)).join(', ')} ms`);
await page.screenshot({ path: `${out}/starfighter-${system}-${quality}.png` });

// the MC80 in frame, drawn by the pack: its box's pixels with and without the pack
const box = await page.evaluate(() => {
  const { camera, war, THREE } = window.__galaxyDebug;
  const mc = war.battle.capitals.find((c) => c.team === war.battle.defender && c.role === 'flagship');
  const v = new THREE.Vector3(mc.pos.x, mc.pos.y, mc.pos.z).project(camera);
  return { x: Math.round(((v.x + 1) / 2) * 1280), y: Math.round(((1 - v.y) / 2) * 720), in: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1 };
});
ok(box.in, `the MC80 projects into the frame at ${box.x}, ${box.y}`);
const clip = { x: Math.min(1280 - 160, Math.max(0, box.x - 80)), y: Math.min(720 - 100, Math.max(0, box.y - 50)), width: 160, height: 100 };
// (the canvas alone: the header, the HUD and its clock hidden, so only the drawing can differ)
await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
await page.waitForTimeout(1500);
const withPack = await page.screenshot({ clip });
await page.evaluate(() => {
  window.__galaxyDebug.scene.children.find((o) => o.name.startsWith('level-sb_')).visible = false;
  window.__RUNTIME__?.invalidate();
});
await page.waitForTimeout(3000);
const without = await page.screenshot({ clip });
await page.evaluate(() => {
  window.__galaxyDebug.scene.children.find((o) => o.name.startsWith('level-sb_')).visible = true;
});
const differ = Buffer.compare(withPack, without) !== 0;
if (area) {
  const fog = await page.evaluate(() => (window.__galaxyDebug.scene.fog?.isFogExp2 ? window.__galaxyDebug.scene.fog.density : null));
  const sky = await page.evaluate(() => window.__galaxyDebug.state.enclosed);
  // (a space level's area, Fondor's or the droid battleship's, has no fog: its star field alone)
  const space = await page.evaluate(() => !window.__galaxyDebug.scene.getObjectByName('level-area-sea'));
  ok((space || fog !== null) && sky, space ? `inside the area: the level's star field round it, the galaxy's sky and names shut out` : `inside the area: its storm's fog on (density ${fog}), the galaxy's sky and names shut out`);
}
ok(differ, `the pack's flagship is drawn where the battle's is (its box ${differ ? 'changes' : 'is the same'} without the pack)`);
writeFileSync(`${out}/starfighter-${system}-${quality}-mc80.png`, withPack);
writeFileSync(`${out}/starfighter-${system}-${quality}-mc80-without.png`, without);
ok(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
writeFileSync(`${out}/starfighter-${system}-${quality}.json`, JSON.stringify({ system, quality, pose, info, frame: f, box, errors }, null, 2));
await browser.close();
process.exit(failed ? 1 : 0);
