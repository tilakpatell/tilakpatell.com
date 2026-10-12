/* global window */
// A collision probe of the Battlefront world on Hoth: the soldier walked at
// the snow piles and snow walls round a spot, and the sim's walkable grid
// scanned for places that block where no placed mesh stands (the invisible
// walls). The level's meshes are batched on the scene (levelBatch.js), so
// each placed instance's world box comes from the pack's own cell bins, the
// records the scene draws from.
//
//   node scripts/bf2017-collision-probe.mjs --pack <dir with level.json, cells/>
//     [--base http://127.0.0.1:5622] [--out <json>] [--radius 100] [--piles 40]
//     [--walk 12] [--quality ultra] [--chrome <msedge.exe>]
//
// It prints a table a pile (through / stuck inside / blocked at the edge),
// the grid's counts and the biggest clusters of bare blocked cells, and
// writes them as JSON.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from './lib/args.mjs';

const args = parseArgs(process.argv.slice(2));
const PACK = args.pack;
if (!PACK) {
  console.error('usage: node scripts/bf2017-collision-probe.mjs --pack <dir> [--base url] [--out json]');
  process.exit(1);
}
const BASE = args.base ?? 'http://127.0.0.1:5622';
const OUT = args.out ?? null;
const RADIUS = Number(args.radius ?? 100);
const PILES = Number(args.piles ?? 40);
const WALKS = Number(args.walk ?? 12);
const QUALITY = args.quality ?? 'ultra';
const CHROME = args.chrome ?? process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ROUTE = '/battlefront/hoth/galacticAssault';
const SNOW = /pile|snow|drift/i;
const NOT_SNOW = /cables|hangarsnowcave|snowspeeder|plane/i;
const GROW = 0.3; // m: the soldier's radius, a box's reach on the walk

// every placed instance of the pack, in the export's frame, with its world box
function instancesOf(pack) {
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const out = [];
  for (const [key, c] of Object.entries(pack.cells)) {
    const b = readFileSync(join(PACK, c.bin ?? `cells/${key.replace(',', '_')}.bin`));
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    for (const d of c.draws)
      for (let i = d.offset; i < d.offset + d.count; i++) {
        const o = i * 32;
        const p = [0, 1, 2].map((k) => v.getFloat32(o + k * 4, true));
        const q = [0, 1, 2, 3].map((k) => v.getInt16(o + 12 + k * 2, true) / 32767);
        const s = [0, 1, 2].map((k) => v.getFloat32(o + 20 + k * 4, true));
        const m = pack.meshes[d.mesh];
        const bb = m.bounds;
        const [qx, qy, qz, qw] = q;
        const rot = (x, y, z) => {
          const ix = qw * x + qy * z - qz * y;
          const iy = qw * y + qz * x - qx * z;
          const iz = qw * z + qx * y - qy * x;
          const iw = -qx * x - qy * y - qz * z;
          return [ix * qw - iw * qx - iy * qz + iz * qy, iy * qw - iw * qy - iz * qx + ix * qz, iz * qw - iw * qz - ix * qy + iy * qx];
        };
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let k = 0; k < 8; k++) {
          const w = rot((k & 1 ? bb[3] : bb[0]) * s[0], (k & 2 ? bb[4] : bb[1]) * s[1], (k & 4 ? bb[5] : bb[2]) * s[2]);
          for (let a = 0; a < 3; a++) {
            const val = w[a] + p[a] + [ox, oy, oz][a];
            if (val < min[a]) min[a] = val;
            if (val > max[a]) max[a] = val;
          }
        }
        out.push({ mesh: d.mesh, name: m.name.split('/').pop().replace(/_mesh\.glb$/, ''), at: [p[0] + ox, p[1] + oy, p[2] + oz], min, max });
      }
  }
  return out;
}

const pack = JSON.parse(readFileSync(join(PACK, 'level.json'), 'utf8'));
const PROXY = /shadowmesh|_shadow_mesh|(?<!no)occluder|lightblocker|blockercsg/i;
const culled = new Set(pack.cull?.[QUALITY]?.dropped ?? pack.cull?.high?.dropped ?? []);
const all = instancesOf(pack).filter((i) => !culled.has(i.mesh) && !PROXY.test(i.name));
const inBox = (x, z, i, grow = GROW) => x > i.min[0] - grow && x < i.max[0] + grow && z > i.min[2] - grow && z < i.max[2] + grow;

const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: CHROME, args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-quality', q);
}, QUALITY);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const t0 = Date.now();
await page.goto(`${BASE}/#${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => Boolean(window.__battlefront?.view), null, { timeout: 600000, polling: 1000 });
await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: 600000, polling: 1000 });
const gpu = await page.evaluate(() => window.__battlefront.do('gpu'));
const deploy = await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' }));
await page.evaluate(() => window.__battlefront.do('advance', 10));
await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: 600000, polling: 1000 });
await page.waitForTimeout(1500);
const view = await page.evaluate(() => window.__battlefront.view());
const spawn = view.player.at.slice();
console.log(`up in ${Date.now() - t0} ms on ${gpu}; deploy ${JSON.stringify(deploy)}; player at ${spawn.map((v) => v.toFixed(1))}; physics ${JSON.stringify(view.level.physics)}`);

// the scene's level meshes, as they are (batched)
const scene = await page.evaluate(() => {
  const root = window.__battlefront.chain?.[0]?.scene ?? null;
  const level = root?.getObjectByName('level:hoth') ?? null;
  const kinds = {};
  const names = [];
  level?.traverse((o) => {
    if (!o.isMesh && !o.isBatchedMesh && !o.isInstancedMesh) return;
    const k = o.isBatchedMesh ? 'BatchedMesh' : o.isInstancedMesh ? 'InstancedMesh' : 'Mesh';
    kinds[k] = (kinds[k] ?? 0) + 1;
    if (names.length < 12) names.push(`${k}:${o.name}`);
  });
  return { found: Boolean(level), kinds, names };
});
console.log('scene level:', JSON.stringify(scene));

const at = () => page.evaluate(() => window.__battlefront.view().player);
const teleport = (p) => page.evaluate((q) => window.__battlefront.do('teleport', q), p);
const look = (yaw) => page.evaluate((y) => window.__battlefront.do('look', { yaw: y, pitch: 0 }), yaw);
// walk ahead (W) toward (tx, tz) for up to `secs`, sampling the body: stops when it stalls or arrives
async function walkTo(tx, tz, secs, { stopAt = 0.6 } = {}) {
  const path = [];
  let p = await at();
  let stalled = 0;
  let last = p.at.slice();
  await page.keyboard.down('KeyW');
  const until = Date.now() + secs * 1000;
  let why = 'time';
  while (Date.now() < until) {
    p = await at();
    if (!p || p.state !== 'alive') {
      why = 'dead';
      break;
    }
    const dx = tx - p.at[0];
    const dz = tz - p.at[2];
    const d = Math.hypot(dx, dz);
    path.push([p.at[0], p.at[1], p.at[2]]);
    if (d < stopAt) {
      why = 'arrived';
      break;
    }
    await look(Math.atan2(dx, dz));
    await page.waitForTimeout(100);
    const moved = Math.hypot(p.at[0] - last[0], p.at[2] - last[2]);
    last = p.at.slice();
    stalled = moved < 0.02 ? stalled + 1 : 0;
    if (stalled >= 5) {
      why = 'stalled';
      break;
    }
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(80);
  p = await at();
  return { why, end: p.at.slice(), path };
}

// 1. the snow piles and walls round the spawn: walk at each from the spawn's side
const snow = all
  .filter((i) => SNOW.test(i.name) && !NOT_SNOW.test(i.name) && Math.hypot(i.at[0] - spawn[0], i.at[2] - spawn[2]) < RADIUS)
  .sort((a, b) => Math.hypot(a.at[0] - spawn[0], a.at[2] - spawn[2]) - Math.hypot(b.at[0] - spawn[0], b.at[2] - spawn[2]))
  .slice(0, PILES);
console.log(`\n${snow.length} snow instances within ${RADIUS} m of the spawn (of ${all.filter((i) => SNOW.test(i.name) && !NOT_SNOW.test(i.name)).length} on the map)`);
const piles = [];
for (const i of snow) {
  const cx = (i.min[0] + i.max[0]) / 2;
  const cz = (i.min[2] + i.max[2]) / 2;
  const half = Math.hypot(i.max[0] - i.min[0], i.max[2] - i.min[2]) / 2;
  let dx = spawn[0] - cx;
  let dz = spawn[2] - cz;
  const L = Math.hypot(dx, dz) || 1;
  dx /= L;
  dz /= L;
  const start = [cx + dx * (half + 3), i.at[1], cz + dz * (half + 3)];
  await teleport(start);
  await page.waitForTimeout(150);
  // (through the middle and out the far side)
  const far = [cx - dx * (half + 3), cz - dz * (half + 3)];
  const w = await walkTo(far[0], far[1], Math.min(20, (2 * half + 8) / 3));
  const inside = (p, grow = -0.2) => inBox(p[0], p[2], i, grow) && p[1] < i.max[1] && p[1] > i.min[1] - 0.5;
  const wentIn = w.path.some((p) => inside(p));
  const endIn = inside(w.end);
  const verdict = w.why === 'arrived' ? (wentIn ? 'through' : 'round') : w.why === 'stalled' ? (endIn ? 'stuck inside' : wentIn ? 'stuck past' : 'blocked at the edge') : w.why;
  const sink = wentIn ? Math.max(...w.path.filter((p) => inside(p)).map((p) => i.max[1] - p[1])) : null;
  piles.push({ name: i.name, at: i.at.map((v) => Math.round(v * 10) / 10), size: [0, 1, 2].map((a) => Math.round((i.max[a] - i.min[a]) * 10) / 10), verdict, why: w.why, wentIn, endIn, sinkBelowTop: sink == null ? null : Math.round(sink * 100) / 100, end: w.end.map((v) => Math.round(v * 10) / 10) });
  console.log(`${i.name.padEnd(36)} at ${i.at.map((v) => v.toFixed(0)).join(',').padEnd(16)} h ${(i.max[1] - i.min[1]).toFixed(1)}  ${verdict}${sink != null ? ` (body ${sink.toFixed(2)} m under the top)` : ''}`);
}
const tally = {};
for (const p of piles) tally[p.verdict] = (tally[p.verdict] ?? 0) + 1;
console.log('piles:', JSON.stringify(tally));

// 2. the sim's walkable grid round the spawn: blocked where no placed mesh stands
const step = 0.5;
const half = RADIUS;
const pts = [];
for (let x = spawn[0] - half; x <= spawn[0] + half; x += step) for (let z = spawn[2] - half; z <= spawn[2] + half; z += step) pts.push([x, z]);
const walk = await page.evaluate((list) => list.map(([x, z]) => (window.__battlefront.do('walkable', [x, z]) ? 1 : 0)), pts);
const near = all.filter((i) => i.max[0] > spawn[0] - half - 5 && i.min[0] < spawn[0] + half + 5 && i.max[2] > spawn[2] - half - 5 && i.min[2] < spawn[2] + half + 5);
let blocked = 0;
let bare = 0;
const bareSet = new Set();
const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
pts.forEach(([x, z], k) => {
  if (walk[k]) return;
  blocked++;
  if (near.some((i) => inBox(x, z, i, GROW + 0.5))) return;
  bare++;
  bareSet.add(key(x, z));
});
// clusters of bare cells (8-neighbour)
const seen = new Set();
const clusters = [];
for (const k of bareSet) {
  if (seen.has(k)) continue;
  const stack = [k];
  seen.add(k);
  const cells = [];
  while (stack.length) {
    const c = stack.pop();
    cells.push(c);
    const [cx, cz] = c.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const n = `${cx + dx},${cz + dz}`;
        if (bareSet.has(n) && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
  }
  const xs = cells.map((c) => c.split(',').map(Number));
  const mx = (xs.reduce((a, b) => a + b[0], 0) / xs.length) * step;
  const mz = (xs.reduce((a, b) => a + b[1], 0) / xs.length) * step;
  clusters.push({ cells: cells.length, at: [Math.round(mx * 10) / 10, Math.round(mz * 10) / 10], span: [Math.min(...xs.map((v) => v[0])) * step, Math.max(...xs.map((v) => v[0])) * step, Math.min(...xs.map((v) => v[1])) * step, Math.max(...xs.map((v) => v[1])) * step] });
}
clusters.sort((a, b) => b.cells - a.cells);
console.log(`\ngrid ${step} m over ±${half} m: ${pts.length} points, ${blocked} blocked, ${bare} blocked with no placed mesh within ${GROW + 0.5} m (${clusters.length} clusters)`);
for (const c of clusters.slice(0, 12)) console.log(`  cluster ${c.cells} cells at ${c.at.join(', ')}  x ${c.span[0].toFixed(0)}…${c.span[1].toFixed(0)} z ${c.span[2].toFixed(0)}…${c.span[3].toFixed(0)}`);

// 3. walk at the biggest bare clusters: an invisible wall stalls the body with nothing drawn there
const walls = [];
for (const c of clusters.slice(0, WALKS)) {
  const cx = c.at[0];
  const cz = c.at[1];
  let dx = spawn[0] - cx;
  let dz = spawn[2] - cz;
  const L = Math.hypot(dx, dz) || 1;
  dx /= L;
  dz /= L;
  const start = [cx + dx * 4, spawn[1], cz + dz * 4];
  await teleport(start);
  await page.waitForTimeout(150);
  const w = await walkTo(cx - dx * 4, cz - dz * 4, 5);
  const stopNearMesh = near.some((i) => inBox(w.end[0], w.end[2], i, GROW + 0.5));
  const verdict = w.why === 'arrived' ? 'walked through' : w.why === 'stalled' ? (stopNearMesh ? 'stopped by a drawn mesh' : 'invisible wall') : w.why;
  walls.push({ cluster: c, verdict, end: w.end.map((v) => Math.round(v * 10) / 10) });
  console.log(`  at ${c.at.join(', ')} (${c.cells} cells): ${verdict}`);
}
const wallTally = {};
for (const w of walls) wallTally[w.verdict] = (wallTally[w.verdict] ?? 0) + 1;
console.log('walls:', JSON.stringify(wallTally));

// 4. the stage's combat area (the game's out-of-bounds, a timer not a wall): the bare cells inside and out
const map = JSON.parse(readFileSync(new URL('../src/data/bf2017/maps/hoth.json', import.meta.url), 'utf8')).rows;
const inPoly = (poly, x, z) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const area = map.volumes.find((v) => v.id === 'FantasyBattle_Shapes:12');
let bareIn = 0;
let bareOut = 0;
for (const k of bareSet) {
  const [cx, cz] = k.split(',').map((v) => Number(v) * step);
  if (area && inPoly(area.points, cx, cz)) bareIn++;
  else bareOut++;
}
console.log(`\nbare blocked cells inside the first attackers' combat area (${area?.id}): ${bareIn}; outside: ${bareOut}; spawn inside: ${area ? inPoly(area.points, spawn[0], spawn[2]) : null}`);

const result = { base: BASE, gpu, quality: QUALITY, spawn, physics: view.level.physics, scene, piles, tally, grid: { step, half, points: pts.length, blocked, bare, clusters: clusters.slice(0, 30) }, walls, wallTally, combatArea: { id: area?.id, bareIn, bareOut }, errors: errors.slice(0, 20) };
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log(`\nwritten ${OUT}`);
}
await browser.close();
