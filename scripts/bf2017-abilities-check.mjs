#!/usr/bin/env node
/* global window, requestAnimationFrame */
// The Battlefront world's abilities probed in a headless browser, through
// its dev door (window.__battlefront: src/components/battlefront/module.js):
//
//   node scripts/bf2017-abilities-check.mjs [--out docs/superpowers/evidence/bf2017-abilities-2026-10-12] [--only recoil,grenade,sentry,shield,turret,shock]
//     [--quality ultra] [--size 1280x720] [--name probe]
//
// With the dev server up (npx vite --port 5655 --strictPort --host 127.0.0.1;
// BASE says another) and a Chromium (CHROMIUM: Edge on the owner's desk).
// Each leg deploys a trooper and reads the sim's own numbers a frame at a
// time while the page draws:
//
//   recoil   ten shots of the assault's rifle: the gun's recoil amplitude and
//            the camera's kick a frame (the climb and the recovery)
//   grenade  the thermal detonator on a tap: thrown, at rest, the blast, how far
//   sentry   the heavy's sentry with the trigger held: up, the first bolt,
//            bolts a second, the bolts and the seconds to the heat that ends it
//   shield   the heavy's combat shield: its health, the second press
//   turret   the officer's turret and presence: placed, the overhealth
//   shock    the specialist's shock grenade: the fuse after rest, the field
//
// The numbers go to <out>/probe.json and a shot of each leg beside it. The
// sim runs on its own 50 ms step whatever the frame rate, so the times are
// the sim's; the frame rate is recorded and not judged. The recoil's
// trace is a frame's, so it wants frames: a busy desk gives it them with
// --quality low --size 640x360.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const OUT = join(ROOT, arg('out', 'docs/superpowers/evidence/bf2017-abilities-2026-10-12'));
const ONLY = arg('only', 'recoil,grenade,sentry,shield,turret,shock').split(',');
const QUALITY = arg('quality', 'ultra');
const [W, H] = arg('size', '1280x720').split('x').map(Number);
const NAME = arg('name', 'probe');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5655';
const EXE = process.env.CHROMIUM ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const WAIT = Number(process.env.PHASE_WAIT ?? 900000);
const DEG = 180 / Math.PI;
mkdirSync(OUT, { recursive: true });

const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: EXE, args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
  window.localStorage.setItem('tp-quality', q);
}, QUALITY);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${BASE}/#/battlefront/hoth/galacticAssault?gpu=webgpu`, { waitUntil: 'domcontentloaded', timeout: WAIT });
await page.waitForFunction(() => Boolean(window.__battlefront?.view), null, { timeout: WAIT, polling: 1000 });
await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
// (the waiting screen's own Deploy, through its wipe: the field is behind it until then)
await page.waitForSelector('[data-bf-stage="spawn"]', { timeout: WAIT });
await page.click('.bf-spawn-screen-cell[data-kind="class"]');
await page.waitForSelector('[data-bf-stage="field"]', { timeout: WAIT });
await page.waitForTimeout(1500);

const door = (action, x) => page.evaluate(([a, y]) => window.__battlefront.do(a, y), [action, x]);
const shoot = (name) => page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 72, timeout: WAIT });
// a fresh life as a class: down, the three seconds to the deploy screen, deployed, a moment to settle
async function deployAs(classId) {
  const state = await page.evaluate(() => window.__battlefront.view().player?.state);
  if (state === 'alive') {
    await door('die');
    await door('advance', 3.5);
  }
  const r = await door('deploy', { classId });
  if (!r?.ok) throw new Error(`deploy ${classId}: ${r?.why}`);
  await door('look', { pitch: 0 });
  await page.waitForTimeout(600);
}
// the sim's numbers a frame, while `script` (in the page) presses what it presses; ends when it says so or after `seconds` of the sim's clock
const record = (script, seconds) =>
  page.evaluate(
    ([src, limit]) =>
      new Promise((done) => {
        const B = window.__battlefront;
        const act = new Function('B', 'row', 'rows', 'mem', src);
        const rows = [];
        const mem = {};
        const t0 = B.view().time;
        const ms0 = performance.now();
        const tick = () => {
          const l = B.do('look');
          const k = B.do('kit');
          const v = B.view();
          const row = { ms: performance.now() - ms0, t: v.time - t0, pitch: l.pitch, kick: l.recoil.pitch, kickYaw: l.recoil.yaw, amp: l.amplitude[1], ampYaw: l.amplitude[0], gun: k.gun, heat: k.heat, spin: k.spin, hp: k.hp, shield: k.shield, over: k.over, state: k.state, drawn: k.drawn, grenades: k.grenades, slots: (v.player?.abilities ?? []).map((a) => a.state), at: v.player?.at ?? null };
          rows.push(row);
          const stop = act(B, row, rows, mem);
          if (stop || row.t >= limit) done(rows);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [script, seconds],
  );
const round = (v, n = 3) => (v == null ? v : Math.round(v * 10 ** n) / 10 ** n);
const fps = (rows) => round((rows.length - 1) / ((rows.at(-1).ms - rows[0].ms) / 1000), 1);
const out = { at: new Date().toISOString(), backend: await door('gpu'), quality: QUALITY, size: [W, H], errors };

if (ONLY.includes('recoil')) {
  await deployAs('d-orig-assault');
  // the trigger down from the first frame; up once ten bolts have added their heat; two seconds more for the recovery
  const rows = await record(
    `
    if (rows.length === 1) B.do('fire', { on: true });
    if (row.heat > 0 && mem.per == null) { mem.per = row.heat; mem.first = row.t; }
    if (mem.per != null && mem.up == null && row.heat >= mem.per * 9.5) { B.do('fire', { on: false }); mem.up = row.t; }
    return mem.up != null && row.t >= mem.up + 2;
  `,
    12,
  );
  await door('fire', { on: false });
  const per = rows.find((r) => r.heat > 0)?.heat ?? 0;
  const first = rows.find((r) => r.heat > 0)?.t ?? 0;
  const shots = Math.round(Math.max(...rows.map((r) => r.heat)) / (per || 1));
  const last = rows.findLast((r, i) => i > 0 && r.heat > rows[i - 1].heat)?.t ?? first;
  const peak = (key) => Math.max(...rows.map((r) => r[key])) * DEG;
  const back = rows.find((r) => r.t > last && Math.abs(r.kick) * DEG < 0.02 && r.amp === 0);
  out.recoil = {
    fps: fps(rows),
    shots,
    heatPerBolt: round(per, 4),
    firstShotAt: round(first),
    lastShotAt: round(last),
    amplitudePeakDeg: round(peak('amp')),
    amplitudeSidePeakDeg: round(Math.max(...rows.map((r) => Math.abs(r.ampYaw))) * DEG),
    cameraKickPeakDeg: round(peak('kick')),
    recoveredAfterLastShotS: back ? round(back.t - last) : null,
    // the aim's pitch a frame: the player's own, the gun's amplitude, the camera's kick (degrees)
    frames: rows.filter((r) => r.t >= first - 0.1).map((r) => [round(r.t - first), round(r.pitch * DEG), round(r.amp * DEG), round(r.kick * DEG), round((r.pitch + r.kick) * DEG)]),
  };
  console.log('recoil', JSON.stringify({ ...out.recoil, frames: out.recoil.frames.length }));
}

if (ONLY.includes('grenade')) {
  await deployAs('d-orig-assault');
  const rows = await record(
    `
    if (rows.length === 1) B.do('ability', { tap: 1 });
    if (row.grenades.length) mem.seen = true;
    if (mem.seen && !row.grenades.length && mem.gone == null) mem.gone = row.t;
    return mem.gone != null && row.t >= mem.gone + 0.6;
  `,
    14,
  );
  const withG = rows.filter((r) => r.grenades.length);
  const thrown = withG[0];
  const rest = withG.find((r) => r.grenades[0].resting);
  const gone = rows.find((r) => r.t > thrown.t && !r.grenades.length);
  const lastAt = withG.at(-1).grenades[0].at;
  const me = thrown.at;
  out.grenade = {
    fps: fps(rows),
    pressedAt: 0,
    thrownAt: round(thrown.t),
    restAt: rest ? round(rest.t) : null,
    blastAt: round(gone.t),
    fuseAfterRestS: rest ? round(gone.t - rest.t) : null,
    flightToRestS: rest ? round(rest.t - thrown.t) : null,
    restedMetresOut: round(Math.hypot(lastAt[0] - me[0], lastAt[2] - me[2]), 2),
    drawnGrenadesPeak: Math.max(...rows.map((r) => r.drawn.grenades)),
    drawnBlastsPeak: Math.max(...rows.map((r) => r.drawn.blasts)),
    slotsWhileInHand: rows.find((r) => r.slots[0] === 'activating')?.slots ?? null,
    slotsAfter: rows.at(-1).slots,
  };
  console.log('grenade', JSON.stringify(out.grenade));
  await door('ability', { tap: 0 });
}

if (ONLY.includes('sentry')) {
  await deployAs('d-orig-heavy');
  const rows = await record(
    `
    if (rows.length === 1) { B.do('ability', { tap: 2 }); B.do('fire', { on: true }); }
    if (row.gun === 'sentry') mem.up = true;
    if (mem.up && row.gun !== 'sentry' && mem.end == null) mem.end = row.t;
    return mem.end != null || row.state !== 'stand' && row.state !== 'crouch';
  `,
    30,
  );
  await door('fire', { on: false });
  const up = rows.filter((r) => r.gun === 'sentry');
  const firstBolt = up.find((r) => r.heat > 0);
  const end = rows.find((r) => r.t > (up[0]?.t ?? 0) && r.gun !== 'sentry');
  const peakHeat = Math.max(...up.map((r) => r.heat));
  const at5 = up.find((r) => firstBolt && r.t >= firstBolt.t + 5);
  out.sentry = {
    fps: fps(rows),
    gunSwappedAt: round(up[0]?.t),
    firstBoltAt: firstBolt ? round(firstBolt.t) : null,
    boltsASecond: firstBolt && at5 ? round((at5.heat - firstBolt.heat) / 0.0035 / (at5.t - firstBolt.t), 2) : null,
    bolts: Math.round(peakHeat / 0.0035),
    endedAt: end ? round(end.t) : null,
    secondsOfFire: firstBolt && end ? round(end.t - firstBolt.t) : null,
    slotsWhileUp: up[Math.floor(up.length / 2)]?.slots ?? null,
    slotsAfter: rows.at(-1).slots,
    diedDuring: rows.at(-1).state !== 'stand' && rows.at(-1).state !== 'crouch',
  };
  console.log('sentry', JSON.stringify(out.sentry));
}

if (ONLY.includes('shield')) {
  await deployAs('d-orig-heavy');
  const rows = await record(
    `
    if (rows.length === 1) B.do('ability', { tap: 3 });
    if (row.shield != null && mem.up == null) mem.up = row.t;
    if (mem.up != null && mem.early == null && row.t >= mem.up + 1) { B.do('ability', { tap: 3 }); mem.early = row.t; }
    if (mem.up != null && mem.late == null && row.t >= mem.up + 2.2) { B.do('ability', { tap: 3 }); mem.late = row.t; }
    return mem.late != null && row.t >= mem.late + 0.5;
  `,
    8,
  );
  const up = rows.find((r) => r.shield != null);
  const down = rows.find((r) => r.t > (up?.t ?? 0) && r.shield == null);
  out.shield = { fps: fps(rows), health: up?.shield ?? null, raisedAt: round(up?.t), stillUpAfterPressAt1s: rows.find((r) => r.t >= (up?.t ?? 0) + 1.5)?.shield != null, loweredAt: down ? round(down.t) : null, loweredAfterS: down && up ? round(down.t - up.t) : null, drawnShieldsPeak: Math.max(...rows.map((r) => r.drawn.shields)), slotsWhileUp: rows.find((r) => r.shield != null && r.t >= (up?.t ?? 0) + 0.5)?.slots ?? null, slotsAfter: rows.at(-1).slots };
  console.log('shield', JSON.stringify(out.shield));
  // a shot of it up: a fresh one, after its recharge
  await door('advance', 31);
  await door('ability', { tap: 3 });
  await page.waitForTimeout(700);
  await shoot('shield');
}

if (ONLY.includes('turret')) {
  await deployAs('d-orig-officer');
  // (the bots' officers stand turrets too: the player's own is up when its slot says active)
  const rows = await record(
    `
    if (rows.length === 1) { B.do('ability', { tap: 3 }); mem.before = row.drawn.turrets; }
    if (row.slots[2] === 'active' && mem.placed == null) { mem.placed = row.t; B.do('ability', { tap: 2 }); }
    return mem.placed != null && row.t >= mem.placed + 1.5;
  `,
    8,
  );
  const placed = rows.find((r) => r.slots[2] === 'active');
  const charged = rows.find((r) => r.over >= 100);
  const charging = rows.find((r) => r.over > 0);
  out.turret = { fps: fps(rows), placedAt: round(placed?.t), drawnTurretsBefore: rows[0].drawn.turrets, drawnTurretsAfter: rows.at(-1).drawn.turrets, overhealthPeak: Math.max(...rows.map((r) => r.over)), overhealthFullAfterS: charged && charging ? round(charged.t - charging.t) : null, slotsAfter: rows.at(-1).slots };
  console.log('turret', JSON.stringify(out.turret));
  await shoot('turret');
}

if (ONLY.includes('shock')) {
  await deployAs('d-orig-specialist');
  await door('look', { pitch: -0.25 });
  const rows = await record(
    `
    if (rows.length === 1) B.do('ability', { tap: 1 });
    if (row.grenades.length) mem.seen = true;
    if (mem.seen && !row.grenades.length && mem.gone == null) mem.gone = row.t;
    return mem.gone != null && row.t >= mem.gone + 0.8;
  `,
    14,
  );
  const withG = rows.filter((r) => r.grenades.length);
  const rest = withG.find((r) => r.grenades[0].resting);
  const gone = withG.length ? rows.find((r) => r.t > withG[0].t && !r.grenades.length) : null;
  out.shock = { fps: fps(rows), thrownAt: round(withG[0]?.t), restAt: rest ? round(rest.t) : null, blastAt: round(gone?.t), fuseAfterRestS: rest && gone ? round(gone.t - rest.t) : null, drawnBlastsPeak: Math.max(...rows.map((r) => r.drawn.blasts)), fieldDrawnAfterBlast: rows.at(-1).drawn.fields };
  console.log('shock', JSON.stringify(out.shock));
  await shoot('shock-field');
}

writeFileSync(join(OUT, `${NAME}.json`), `${JSON.stringify(out, null, 1)}\n`);
await browser.close();
if (errors.length) {
  console.error(`console errors:\n${errors.join('\n')}`);
  process.exit(1);
}
