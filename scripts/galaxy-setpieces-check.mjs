/* global window, document */
// A browser check of the Galactic Civil War's set pieces (galaxy/
// warpieces/). With the dev server up (npx vite --port 5188):
//   OUT=/tmp/shots node scripts/galaxy-setpieces-check.mjs endor|hoth|scarif|hangar [quality]
// endor: the second Death Star turned off its spin with its dish on the
//   Rebel fleet, the shield generator on the moon knocked out, the run in
//   through its superstructure to its reactor, the reactor shot, out, and
//   the station going up.
// hoth: the Empire attacking: the ion cannon disabling a Star Destroyer, the
//   transports running.
// scarif: the Death Star away while the battle's on; the Persecutor's
//   shield taken down, the Hammerhead's ram, the two Star Destroyers onto
//   the gate, the shield down; and the Death Star out of hyperspace over
//   the planet, firing on it from its dish.
// hangar: into a Star Destroyer's belly hangar, its reactor shot, out, and
//   the ship breaking up.
// Each forces a battle at the system (the warfront's dev hook), so it runs
// whatever the war's doing, and runs the battle on with skip() where it's
// waiting on the battle's clock (software GL draws a frame a second or so,
// and the battle steps about a quarter of a second a frame at most). Screenshots:
// piece-<what>-<n>-<moment>.png.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const what = process.argv[2] ?? 'endor';
const quality = process.argv[3] ?? 'mid';
const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://localhost:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(out, { recursive: true });
const SYS = { endor: 'endor', hoth: 'hoth', scarif: 'scarif', hangar: 'tatooine' }[what];
const problems = [];
const check = (ok, text) => {
  console.log(ok ? 'ok  ' : 'FAIL', text);
  if (!ok) problems.push(text);
};
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking)
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader|WebGL/i.test(m.text()) && errors.push(m.text()));
let shot = 0;
// (software GL can take a long while over a frame with a station filling it)
const snap = (moment) => page.screenshot({ path: `${out}/piece-${what}-${shot++}-${moment}.png`, timeout: 120000 });
const ev = (fn, arg) => page.evaluate(fn, arg);
// the ship put somewhere, looking at a point (the debug pin), shields held up
const look = (from, at) =>
  ev(
    ([f, a]) => {
      const d = window.__galaxyDebug;
      d.state.safeUntil = 1e12;
      d.state.shield = 100;
      d.pin({ x: f[0], y: f[1], z: f[2], heading: Math.atan2(f[0] - a[0], f[2] - a[2]), pitch: Math.atan2(a[1] - f[1], Math.hypot(a[0] - f[0], a[2] - f[2])), bank: 0 });
    },
    [from, at],
  );
const keepAlive = () => ev(() => ((window.__galaxyDebug.state.shield = 100), (window.__galaxyDebug.state.safeUntil = 1e12)));

await page.goto(`${base}/?quality=${quality}#/galaxy/${SYS}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction((id) => typeof window.__galaxy === 'function' && window.__galaxy().system === id, SYS, { timeout: 180000 });
await page.waitForFunction(() => !window.__galaxy().jump, null, { timeout: 120000 }).catch(() => {});
// (and done getting ready: the system's there before its veil's gone, and nothing's drawn under it)
await page.waitForFunction(() => !document.querySelector('.universe-loading.loading-veil:not(.is-done)'), null, { timeout: 420000 });
await page.addStyleTag({ content: '.galaxy-panel, .universe-hint { display: none !important; }' });
// sworn to the Rebellion: the set pieces' targets are a side's to take (the
// moon's generator, an enemy Star Destroyer's reactor), and the unsworn
// pilot's shots count for nobody
await page.waitForFunction(() => Boolean(window.__galaxyOath), null, { timeout: 30000 });
await ev(() => window.__galaxyOath.swear('rebel'));
await page.waitForTimeout(500);
await ev((a) => window.__galaxyDebug.war.force(a), what === 'hoth' ? 'empire' : 'rebel');
await page.waitForTimeout(1500);
check(await ev(() => Boolean(window.__galaxyDebug.war.battle)), `a battle at ${SYS}`);

if (what === 'endor') {
  // the station turned, its dish on the Rebel fleet (world.js's face: eased round over a few seconds)
  const facing = () =>
    ev(() => {
      const d = window.__galaxyDebug;
      const dish = d.state.world.war.dish('deathstar2');
      const D = d.state.sys.pieces.find((p) => p.kind === 'deathstar2').at;
      const fleet = d.war.battle.capitals.filter((c) => c.team === 0);
      const c = [0, 1, 2].map((i) => fleet.reduce((a, f) => a + [f.pos.x, f.pos.y, f.pos.z][i], 0) / fleet.length);
      const u = [dish.x - D[0], dish.y - D[1], dish.z - D[2]];
      const w = [c[0] - D[0], c[1] - D[1], c[2] - D[2]];
      return (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / Math.hypot(...u) / Math.hypot(...w);
    });
  for (let i = 0; i < 120 && (await facing()) < 0.98; i++) await page.waitForTimeout(1000);
  check((await facing()) > 0.98, 'the second Death Star’s dish turned onto the Rebel fleet');
  const dishView = await ev(() => {
    const d = window.__galaxyDebug;
    const dish = d.state.world.war.dish('deathstar2');
    const D = d.state.sys.pieces.find((p) => p.kind === 'deathstar2').at;
    const u = [dish.x - D[0], dish.y - D[1], dish.z - D[2]];
    const l = Math.hypot(...u);
    return { from: [D[0] + (u[0] / l) * 260, D[1] + (u[1] / l) * 260 + 30, D[2] + (u[2] / l) * 260], at: D };
  });
  await look(dishView.from, dishView.at);
  await page.waitForTimeout(6000);
  await snap('the-dish');
  const gen = await ev(() => window.__galaxyDebug.war.pieces[0].targets.find((t) => t.kind === 'shieldgen').at);
  await look([gen.x * 1.06 + 8, gen.y * 1.06 + 4, gen.z * 1.06 + 8], [gen.x, gen.y, gen.z]);
  await page.waitForTimeout(6000);
  await snap('generator');
  await ev(() => {
    const w = window.__galaxyDebug.war;
    const e = w.pieces[0];
    for (let i = 0; i < 400; i++) {
      const g = e.targets.find((t) => t.kind === 'shieldgen');
      if (!g) break;
      w.hit({ x: g.at.x, y: g.at.y + 3, z: g.at.z }, { x: g.at.x, y: g.at.y - 0.01, z: g.at.z }, 3);
    }
  });
  await page.waitForTimeout(1500);
  check(await ev(() => !window.__galaxyDebug.war.pieces[0].targets.some((t) => t.kind === 'shieldgen')), 'the shield generator’s knocked out');
  // (the battle's plan, pinned: the run opens once the Executor's bridge is
  // down too and the last stage's gate, 5:00, is passed; the other pilots
  // take the bridge here, their word on the tally, and the dev hook moves
  // the shared clock on)
  await ev(() => {
    const w = window.__galaxyDebug.war;
    w.onNet({ type: 'fight', from: 'check', msg: { e: w.on.id, m: { bridge: 1e4 }, t: {} } });
    w.jump(Math.max(0, 301 - w.info.shared.t));
  });
  // (the run opens on the next frame the battle's run on: software GL's a frame or two a second)
  await page.waitForFunction(() => window.__galaxyDebug.war.pieces[0].run.state !== 'shut', null, { timeout: 30000 }).catch(() => {});
  // to the run's mouth, and in
  const way = await ev(() => {
    const s = window.__galaxyDebug.state.ship;
    return window.__galaxyDebug.war.pieces[0].markers({ x: s.x, y: s.y, z: s.z, ...{} }).find((m) => /main reactor/.test(m.title))?.pos ?? null;
  });
  check(Boolean(way), 'the way in to the main reactor is marked');
  const D = await ev(() => window.__galaxyDebug.state.sys.pieces.find((p) => p.kind === 'deathstar2').at);
  const dir = [D[0] - way.x, D[1] - way.y, D[2] - way.z];
  const dl = Math.hypot(...dir);
  const u = dir.map((x) => x / dl);
  await look([way.x - u[0] * 30, way.y - u[1] * 30 + 6, way.z - u[2] * 30], [way.x, way.y, way.z]);
  await page.waitForTimeout(6000);
  await snap('the-way-in');
  await look([way.x - u[0] * 3, way.y - u[1] * 3, way.z - u[2] * 3], [way.x + u[0] * 10, way.y + u[1] * 10, way.z + u[2] * 10]);
  await page.keyboard.down('w');
  for (let i = 0; i < 25 && !(await ev(() => window.__galaxyDebug.war.pieces[0].run.inside)); i++) {
    await page.waitForTimeout(1000);
    await keepAlive();
  }
  await page.waitForTimeout(3000);
  await page.keyboard.up('w');
  check(await ev(() => window.__galaxyDebug.war.pieces[0].run.inside), 'in the tunnel');
  await snap('in-the-tunnel');
  // on to the chamber (a pin down the tunnel: software GL flies it slowly)
  const core = await ev(() => {
    const c = window.__galaxyDebug.war.pieces[0].run.core;
    return { x: c.x, y: c.y, z: c.z };
  });
  const toCore = [core.x - way.x, core.y - way.y, core.z - way.z];
  const cl = Math.hypot(...toCore);
  await look([core.x - (toCore[0] / cl) * 5.5, core.y - (toCore[1] / cl) * 5.5 + 1.5, core.z - (toCore[2] / cl) * 5.5], [core.x, core.y, core.z]);
  await page.waitForTimeout(4000);
  check((await ev(() => window.__galaxyDebug.war.pieces[0].run.where)) === 'chamber', 'in the reactor’s chamber');
  check(await ev(() => window.__galaxyDebug.war.pieces[0].targets.some((t) => t.kind === 'reactor')), 'the reactor’s there to shoot, inside');
  await snap('the-reactor');
  await ev(() => {
    const w = window.__galaxyDebug.war;
    for (let i = 0; i < 120; i++) {
      const c = w.pieces[0].targets.find((t) => t.kind === 'reactor');
      if (!c) break;
      w.hit({ x: c.at.x, y: c.at.y + 2, z: c.at.z }, { x: c.at.x, y: c.at.y - 0.01, z: c.at.z }, 1);
    }
  });
  await page.waitForTimeout(2500);
  await snap('get-out');
  // out (a pin), the escape cut short (software GL's slow), watching it go
  await look([way.x - u[0] * 260, way.y - u[1] * 260 + 40, way.z - u[2] * 260], [D[0], D[1], D[2]]);
  await page.waitForTimeout(1500);
  check(!(await ev(() => window.__galaxyDebug.war.pieces[0].run.inside)), 'out of it');
  await ev(() => window.__galaxyDebug.war.pieces[0].run.hurry());
  for (let i = 0; i < 40 && !(await ev(() => window.__galaxyDebug.war.battle?.over)); i++) {
    await page.waitForTimeout(1000);
    await keepAlive();
  }
  await page.waitForTimeout(1200);
  await snap('death-star-gone');
  check((await ev(() => window.__galaxyDebug.war.battle?.over?.why)) === 'deathstar', 'the Death Star’s gone and the Rebellion’s won');
} else if (what === 'hoth') {
  const at = await ev(() => window.__galaxy().war.laid.at);
  await look([at[0] + 40, at[1] + 50, at[2] + 120], at);
  for (let i = 0; i < 30 && !(await ev(() => window.__galaxyDebug.war.battle.capitals.some((c) => c.disabled > 0))); i++) await ev(() => window.__galaxyDebug.war.skip(1));
  await page.waitForTimeout(2500);
  check(await ev(() => window.__galaxyDebug.war.battle.capitals.some((c) => c.disabled > 0)), 'the ion cannon’s disabled a Star Destroyer');
  await snap('ion');
  for (let i = 0; i < 60 && !(await ev(() => window.__galaxyDebug.war.battle.runners.length)); i++) await ev(() => window.__galaxyDebug.war.skip(1));
  await ev(() => window.__galaxyDebug.war.skip(4));
  const r = await ev(() => {
    const t = window.__galaxyDebug.war.battle.runners[0];
    return t ? { x: t.pos.x, y: t.pos.y, z: t.pos.z, fx: t.fwd.x, fz: t.fwd.z } : null;
  });
  check(Boolean(r), 'a transport’s running');
  if (r) {
    await look([r.x - r.fx * 14 + 6, r.y + 4, r.z - r.fz * 14], [r.x, r.y, r.z]);
    await page.waitForTimeout(3000);
    await snap('transport');
  }
} else if (what === 'scarif') {
  // (the Death Star's solid: there only while it's shown, world.js)
  const dsThere = () => ev(() => (window.__galaxyDebug.state.world.solids.find((o) => o.id === 'deathstar')?.r ?? 0) > 0);
  let away = true;
  for (let i = 0; i < 5; i++) {
    if (await dsThere()) away = false;
    await page.waitForTimeout(1000);
  }
  check(away, 'the Death Star’s away while the battle’s on');
  await ev(() => {
    const w = window.__galaxyDebug.war;
    const b = w.battle;
    const flag = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
    for (const s of flag.subs.filter((o) => o.phase === 1)) for (let i = 0; i < 200 && s.alive; i++) w.hit({ x: s.pos.x, y: s.pos.y + 2, z: s.pos.z }, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 3);
  });
  await page.waitForTimeout(2000);
  const pers = await ev(() => {
    const b = window.__galaxyDebug.war.battle;
    const f = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
    return [f.pos.x, f.pos.y, f.pos.z];
  });
  await look([pers[0] + 70, pers[1] + 30, pers[2] + 60], pers);
  // (the battle's plan, pinned: the gate's stage, after the Persecutor's
  // bridge and from 5:00; the other pilots take the bridge, their word on
  // the tally, and the dev hook moves the shared clock on to the gate)
  await ev(() => {
    const w = window.__galaxyDebug.war;
    w.onNet({ type: 'fight', from: 'check', msg: { e: w.on.id, m: { bridge: 1e4 }, t: {} } });
    w.jump(Math.max(0, 301 - w.info.shared.t));
  });
  await ev(() => window.__galaxyDebug.war.skip(12));
  await page.waitForTimeout(3000);
  check(await ev(() => window.__galaxyDebug.war.battle.capitals.some((c) => c.kind === 'hammerhead' && c.moved)), 'the Hammerhead’s coming round to ram');
  await snap('ram');
  const G = await ev(() => window.__galaxyDebug.state.sys.pieces.find((p) => p.kind === 'gate').at);
  await look([G[0] + 120, G[1] + 90, G[2] + 140], G);
  check(await ev(() => window.__galaxyDebug.war.pieces[0].targets.some((t) => t.kind === 'gate')), 'the Shield Gate’s there to shoot');
  // (the gate brought down, by your guns and the pilots' word on it)
  await ev(() => {
    const w = window.__galaxyDebug.war;
    const g = w.pieces[0].targets.find((t) => t.kind === 'gate');
    for (let i = 0; i < 20 && g; i++) w.hit({ x: g.at.x, y: g.at.y + 2, z: g.at.z }, { x: g.at.x, y: g.at.y - 0.01, z: g.at.z }, 3);
    w.onNet({ type: 'fight', from: 'check', msg: { e: w.on.id, m: { gate: 1e4 }, t: {} } });
  });
  for (let i = 0; i < 60 && !(await ev(() => window.__galaxyDebug.war.battle?.over)); i++) await ev(() => window.__galaxyDebug.war.skip(1));
  await page.waitForTimeout(2500);
  await snap('gate');
  check((await ev(() => window.__galaxyDebug.war.battle?.over?.why)) === 'gate', 'the gate’s gone and the Rebellion’s won');
  check(await ev(() => window.__galaxyDebug.state.world.shield === null), 'Scarif’s shield is down');
  // the Death Star in, a few seconds on (on the wall clock), its dish on the planet
  for (let i = 0; i < 60 && !(await dsThere()); i++) await page.waitForTimeout(1000);
  check(await dsThere(), 'the Death Star’s dropped out of hyperspace over Scarif');
  // (from the planet's side of it, a little off its line of fire: the Death Star, then its beam coming past)
  const view = await ev(() => {
    const p = window.__galaxyDebug.state.sys.pieces.find((x) => x.type === 'superlaser');
    const d = [p.at[0] - p.from[0], p.at[1] - p.from[1], p.at[2] - p.from[2]];
    const l = Math.hypot(...d);
    const side = [d[2] / l, 0, -d[0] / l];
    return { from: [0, 1, 2].map((i) => p.from[i] + (d[i] / l) * 170 + side[i] * 60 + (i === 1 ? 30 : 0)), at: p.from };
  });
  await look(view.from, view.at);
  await page.waitForTimeout(4000);
  await snap('death-star-in');
  // (it fires about 18 s after it's in)
  await page.waitForTimeout(14000);
  await snap('death-star-fires');
} else if (what === 'hangar') {
  const isd = await ev(() => {
    const b = window.__galaxyDebug.war.battle;
    const c = b.capitals.find((x) => x.team === 1 && x.kind === 'destroyer' && x.role !== 'flagship');
    return { pos: [c.pos.x, c.pos.y, c.pos.z], up: [c.up.x, c.up.y, c.up.z], size: c.size };
  });
  const below = isd.pos.map((v, i) => v - isd.up[i] * isd.size * 0.5);
  await look([below[0] + 10, below[1] - 4, below[2] + 10], isd.pos.map((v, i) => v - isd.up[i] * isd.size * 0.07));
  await page.waitForTimeout(6000);
  await snap('belly');
  check(await ev(() => window.__galaxyDebug.war.pieces.at(-1).markers({ x: window.__galaxyDebug.state.ship.x, y: window.__galaxyDebug.state.ship.y, z: window.__galaxyDebug.state.ship.z }).some((m) => /Hangar/.test(m.title))), 'the hangar’s marked');
}
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
