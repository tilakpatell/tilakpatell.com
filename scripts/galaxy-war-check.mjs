/* global window, requestAnimationFrame */
// A browser check of the galaxy's wars (galaxy/gcw.js, warfront.js,
// battles.js; the war table on the holotable). With the dev server up (npx
// vite --port 5188):
//   OUT=/tmp/shots SIDE=empire KIND=blockade node scripts/galaxy-war-check.mjs [system] [quality]
// It swears to SIDE (the Rebellion unless it's said; its war is the one
// fought) through the page's dev hook, finds that war's battle on now (the
// major order's, unless a system's named), drops in there (KIND: a battle of
// that kind forced there instead, battles.js's BATTLE_KINDS), checks the
// battle's at its planet and you're in it on your side's team, looks at it
// from a few places, downs one of the other side's fighters and (attacking)
// takes the objectives down with the battle's own hit() (as your shots
// would), checks the war's tally counted it for your side, and opens the war
// table with your oath on it: screenshots as it goes (war-<n>-<what>.png).
// It says what the battle's arrival weighs and draws (the `arrival:` line:
// every model file the page fetched, a fresh context so nothing cached, and
// one frame's calls and triangles in among the fighters), so a change to
// the ships' files is measured before and after on the same battle.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { MODEL_FILE } from './galaxy-budget.mjs';

const out = process.env.OUT ?? '.';
const quality = process.argv[3] ?? 'mid';
const side = process.env.SIDE ?? 'rebel';
const kind = process.env.KIND ?? null;
const base = process.env.BASE ?? 'http://localhost:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(out, { recursive: true });
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.localStorage.removeItem('tp-gcw');
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking)
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader|WebGL/i.test(m.text()) && errors.push(m.text()));
// (every .glb, .ktx2 and .bin it fetched, as galaxy-check.mjs counts a system's models)
let modelBytes = 0;
let modelFiles = 0;
page.on('requestfinished', async (req) => {
  if (!MODEL_FILE.test(req.url())) return;
  const sizes = await req.sizes().catch(() => null);
  modelBytes += sizes?.responseBodySize ?? 0;
  modelFiles++;
});
let shot = 0;
const snap = (what) => page.screenshot({ path: `${out}/war-${shot++}-${what}.png` });

// which system: the one named, or the major order's
await page.goto(`${base}/?quality=${quality}#/galaxy`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__galaxy === 'function' && Boolean(window.__galaxy().system), null, { timeout: 180000 });
await page.waitForFunction(() => Boolean(window.__galaxyOath), null, { timeout: 30000 });
await page.evaluate((s) => window.__galaxyOath.swear(s), side);
const war = await page.evaluate(() => window.__galaxyOath.get().war);
const table = await page.evaluate(async (w) => (await import('/src/components/galaxy/warState.js')).warNow(Date.now(), w), war);
const sysId = process.argv[2] || table.major;
const row = table.systems.find((s) => s.id === sysId);
console.log('war:', table.epoch, 'major', table.major, '·', sysId, row?.owner, row?.control, row?.battle?.id, row?.battle?.fighting ? 'fighting' : 'lull');
check(kind || Boolean(row?.battle), `there's a battle on at ${sysId} in ${war}`);

await page.goto(`${base}/?quality=${quality}#/galaxy/${sysId}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction((id) => typeof window.__galaxy === 'function' && window.__galaxy().system === id, sysId, { timeout: 180000 });
await page.waitForFunction(() => !window.__galaxy().jump, null, { timeout: 120000 }).catch(() => {});
await page.waitForFunction(() => Boolean(window.__galaxy().war?.battle), null, { timeout: kind ? 5000 : 60000 }).catch(() => {});
if (kind) {
  await page.evaluate(([s, k]) => window.__galaxyDebug.war.force(s, k), [side, kind]);
  check((await page.evaluate(() => window.__galaxy().war?.laid?.kind)) === kind, `a battle of the kind asked for: ${kind}`);
}
await page.addStyleTag({ content: '.galaxy-panel, .comms { display: none !important; }' });
const info = await page.evaluate(() => window.__galaxy().war);
console.log('battle:', info?.laid?.name, JSON.stringify(info?.battle));
check(Boolean(info?.battle), 'the battle is there when you drop in');
check(info?.laid && Math.hypot(...info.laid.at) > 0, 'it’s fought off the planet');
await page.waitForTimeout(500);
const you = await page.evaluate(() => window.__galaxyDebug.war.battle?.you.team);
const yours = await page.evaluate((s) => window.__galaxyDebug.war.on?.sides?.indexOf(s), side);
check(you !== null && you === yours, `you’re in it on your side’s team (${side}: ${you})`);

const pin = (fn, arg) =>
  page.evaluate(
    ([f, a]) => {
      const d = window.__galaxyDebug;
      const pose = new Function('d', 'a', f)(d, a);
      d.state.safeUntil = 1e12;
      d.state.shield = 100;
      d.pin(pose);
    },
    [fn, arg],
  );
// the whole of it, from behind the Rebel line: the planet beyond
await pin(`
  const b = d.war.battle; const own = b.capitals.find((c) => c.team === 0 && c.role === 'flagship');
  const other = b.capitals.find((c) => c.team === 1 && c.role === 'flagship');
  const dx = other.pos.x - own.pos.x, dz = other.pos.z - own.pos.z; const l = Math.hypot(dx, dz);
  const x = own.pos.x - dx / l * 60, z = own.pos.z - dz / l * 60;
  return { x, y: own.pos.y + 30, z, heading: Math.atan2(-dx, -dz), pitch: -0.2, bank: 0 };
`);
await page.waitForTimeout(9000);
await snap('panorama');
// the Imperial flagship, close
await pin(`
  const b = d.war.battle; const f = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
  const s = f.size; const x = f.pos.x - f.fwd.x * s * 0.2 + f.right.x * s * 0.7, z = f.pos.z - f.fwd.z * s * 0.2 + f.right.z * s * 0.7;
  return { x, y: f.pos.y + s * 0.18, z, heading: Math.atan2(x - f.pos.x, z - f.pos.z), pitch: -0.15, bank: 0 };
`);
await page.waitForTimeout(7000);
await snap('flagship');
// in among the fighters, the planet below
await pin(`
  const b = d.war.battle; const c = { x: 0, y: 0, z: 0 }; let n = 0;
  for (const f of b.fighters) if (f.alive) { c.x += f.pos.x; c.y += f.pos.y; c.z += f.pos.z; n++; }
  c.x /= n; c.y /= n; c.z /= n;
  return { x: c.x - 18, y: c.y + 4, z: c.z - 6, heading: Math.atan2(-18, -6), pitch: -0.05, bank: 0 };
`);
await page.waitForTimeout(6000);
await snap('dogfight');
// one whole frame's counts from here, read as galaxy-check.mjs reads them (a
// frame asked for every tick, its counts taken and the count reset, the
// busiest of a second's frames kept: the node renderer's draws are its
// drawCalls, the classic one's its calls), and what the page has fetched by now
const frame = await page.evaluate(
  () =>
    new Promise((done) => {
      const info = window.__galaxyDebug.renderer.info;
      const wasAuto = info.autoReset;
      info.autoReset = false;
      let most = { calls: 0, triangles: 0 };
      const t0 = performance.now();
      window.__RUNTIME__?.invalidate();
      const tick = (now) => {
        window.__RUNTIME__?.invalidate();
        const f = { calls: info.render.drawCalls ?? info.render.calls, triangles: info.render.triangles };
        if (f.calls > most.calls) most = f;
        info.reset();
        if ((now - t0 < 1500 || most.calls === 0) && now - t0 < 20000) requestAnimationFrame(tick);
        else {
          info.autoReset = wasAuto;
          done(most);
        }
      };
      requestAnimationFrame(tick);
    }),
);
console.log(`arrival: models ${(modelBytes / 1e6).toFixed(2)} MB in ${modelFiles} files · the dogfight's frame: calls ${frame.calls}, triangles ${frame.triangles}`);
const lock = await page.evaluate(() => (window.__galaxyDebug.war.targets ?? []).length);
check(lock > 0, 'its fighters and objectives are there to lock on to');
// one of the other side's fighters down, for your side
const before = await page.evaluate(() => window.__galaxy().war.mine);
await page.evaluate(() => {
  const w = window.__galaxyDebug.war;
  const b = w.battle;
  const f = b.fighters.find((x) => x.alive && x.team !== b.you.team && x.role !== 'bomber');
  // (where it's drawn, as your guns see it: the battle's carried on past its last step)
  const p = f?.seen ?? f?.pos;
  for (let i = 0; i < 40 && f?.alive; i++) w.hit({ x: p.x, y: p.y + 2, z: p.z }, { x: p.x, y: p.y - 0.01, z: p.z }, 5);
});
await page.waitForTimeout(1500);
check((await page.evaluate(() => window.__galaxy().war.mine)) > before, 'a fighter down counts in the war');
const keys = await page.evaluate(async () => (await import('/src/components/galaxy/warState.js')).warTally().keys());
const code = await page.evaluate(async (s) => (await import('/src/components/galaxy/sides.js')).SIDES[s].code, side);
check(keys.some((k) => k.startsWith(`${code}:`)), `and it's your side's (${code}: keys)`);

// the objectives, from your guns: each stage of the battle's plan in turn
// (universe/battlePlan.js, drawn for it: generators, satellites, batteries,
// platforms, a relay…), its gate passed first (the dev hook moves the shared
// clock on), what's to be shot shot with the battle's own hit(), and a zone
// held as the other pilots here would have it (their word on the tally)
const takeStage = (i) =>
  page.evaluate(async (si) => {
    const w = window.__galaxyDebug.war;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const gate = w.director.plan.stages[si].opensAt - w.info.shared.t;
    if (gate > 0) w.jump(gate + 1);
    await wait(1500);
    const b = w.battle;
    for (const o of b.objectives.filter((x) => x.phase === si + 1)) {
      if (o.zone) {
        if (o.after) await wait(1500);
        w.onNet({ type: 'fight', from: 'check', msg: { e: w.on.id, m: { [`${o.key}:a`]: 1e4 }, t: {} } });
        continue;
      }
      for (let n = 0; n < 300 && o.alive && b.isOpen(o); n++) w.hit({ x: o.pos.x, y: o.pos.y + 2, z: o.pos.z }, { x: o.pos.x, y: o.pos.y - 0.01, z: o.pos.z }, 3);
    }
    await wait(2000);
    return { phase: b.phase, over: b.over, stage: w.director.plan.stages[si].id };
  }, i);
const attacking = await page.evaluate(() => window.__galaxyDebug.war.battle.attacker === window.__galaxyDebug.war.battle.you.team);
const pieces = await page.evaluate(() => window.__galaxyDebug.war.director.plan.stages.some((st) => st.objectives.some((o) => o.on.piece)));
if (attacking && !pieces) {
  const stages = await page.evaluate(() => window.__galaxyDebug.war.director.plan.stages.map((st) => `${st.id} (${st.objectives.map((o) => o.kind).join(', ')})`));
  console.log('plan:', stages.join(' → '));
  const first = await takeStage(0);
  check(first.phase === 2, `the first stage taken (${first.stage}): the second's on`);
  await snap('first-stage');
  await takeStage(1);
  // (watching the ship the objectives are on, for the break-up)
  await pin(`
    const b = d.war.battle; const f = b.capitals.find((c) => c.objective);
    const s = f.size; const x = f.pos.x + f.right.x * s * 1.1 - f.fwd.x * s * 0.1, z = f.pos.z + f.right.z * s * 1.1 - f.fwd.z * s * 0.1;
    return { x, y: f.pos.y + s * 0.3, z, heading: Math.atan2(x - f.pos.x, z - f.pos.z), pitch: -0.25, bank: 0 };
  `);
  const last = await takeStage(2);
  check(last.over?.winner === you, `the plan's done: the battle's won for your side (${JSON.stringify(last.over)})`);
  await page.waitForTimeout(10000);
  await snap('breaking');
  const mine = await page.evaluate(() => window.__galaxy().war.mine);
  check(mine >= 6, `the war counted what you did (${mine} points)`);
}
// the war table
await page.keyboard.press('m');
await page.waitForSelector('.holomap', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
await snap('war-table');
check((await page.locator('.holomap-warcard, .holomap-order').count()) > 0, 'the holotable shows the war');
const sworn = await page.locator('.galaxy-oath-sides button[aria-pressed="true"]').first().textContent().catch(() => '');
console.log('sworn on the table:', sworn);
check(/Sworn to/.test(sworn ?? ''), 'the holotable shows your oath');
check((await page.locator('.galaxy-oath-wars button[aria-pressed="true"]').count()) === 1, 'and the war you fight in');
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
