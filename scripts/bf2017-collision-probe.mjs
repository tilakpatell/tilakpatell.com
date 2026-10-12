/* global window */
// A collision probe of the Battlefront world: what the sim lets a soldier do
// against what the page draws, on a grid of points, in windows along a map's
// play. Two things a player meets are counted: snow the body walks through
// (the drawn ground over the feet, a drawn mesh's surface between the shin
// and the head, at a spot the sim lets a soldier stand), and walls nothing
// draws (a blocked spot with no drawn mesh in the body's space there, beside
// it or within 0.8 m at knee, chest or head, on ground a soldier could
// stand on). Then the soldier is walked at the biggest of each.
//
// The scene is asked directly: every placed instance of the level's meshes
// (lane L's InstancedMeshes) and the ground's own triangles are indexed on
// the page and a ray is cast down each point, so the answer is what is
// drawn, at the level of detail it is drawn at, not a mesh's box. The sums
// are scripts/lib/bf2017-collision-probe.mjs's.
//
//   node scripts/bf2017-collision-probe.mjs [--base http://127.0.0.1:5622] [--world hoth] [--mode galacticAssault]
//     [--at 'x,z;x,z'] [--radius 100] [--step 0.5] [--walks 6] [--quality ultra] [--out <json>] [--chrome <msedge.exe>]
//
//   at      the windows' middles (the default: eight, 200 m apart, from Hoth's first spawn to Echo Base)
//   walks   how many of the biggest wall clusters, and as many buried spots, the soldier is walked at
//
// It needs a dev server (npx vite --port 5622) and the world's dev door
// (module.js: 'teleport', 'walkable', 'ground', 'look'). It prints a table a
// window and the totals, and writes them as JSON.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { buriedOf, clustersOf, lookedAt, tableOf, wallsOf } from './lib/bf2017-collision-probe.mjs';

const args = parseArgs(process.argv.slice(2));
const BASE = args.base ?? 'http://127.0.0.1:5622';
const WORLD = args.world ?? 'hoth';
const MODE = args.mode ?? 'galacticAssault';
const OUT = args.out ?? null;
const RADIUS = Number(args.radius ?? 100);
const STEP = Number(args.step ?? 0.5);
const WALKS = Number(args.walks ?? 6);
const QUALITY = args.quality ?? 'ultra';
const CHROME = args.chrome ?? process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
// (Hoth's Galactic Assault, from the attackers' first spawn down the walkers' road to the base: each window ±100 m)
const HOTH = [0, 200].flatMap((x) => [-1000, -1200, -1400, -1600].map((z) => [x, z]));
const ATS = typeof args.at === 'string' ? args.at.split(';').map((p) => p.split(',').map(Number)) : HOTH;

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
const t0 = Date.now();
await page.goto(`${BASE}/#/battlefront/${WORLD}/${MODE}?gpu=webgpu`, { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => Boolean(window.__battlefront?.view), null, { timeout: 600000, polling: 1000 });
await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: 600000, polling: 1000 });
const loaded = () => page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: 600000, polling: 500 });
const alive = async () => {
  const p = await page.evaluate(() => window.__battlefront.view().player);
  if (p?.state === 'alive') return p;
  await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' }));
  await page.waitForTimeout(500);
  return page.evaluate(() => window.__battlefront.view().player);
};
const first = await alive();
const gpu = await page.evaluate(() => window.__battlefront.do('gpu'));
const spawn = first.at.slice();
const mask = await page.evaluate(() => window.__battlefront.view().level.physics);
console.log(`up in ${Date.now() - t0} ms on ${gpu}; the soldier at ${spawn.map((v) => v.toFixed(1)).join(', ')}; ${JSON.stringify(mask)}`);

// The page's side: the drawn scene indexed round a window, and the grid scanned.
const scanAt = (centre) =>
  page.evaluate(
    async ({ centre, RADIUS, STEP }) => {
      const url = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .find((n) => /\/deps\/three(\.module)?\.js/.test(n));
      const THREE = await import(/* @vite-ignore */ url ?? '/@id/three');
      const bf = window.__battlefront;
      const group = bf.level.group;
      group.updateMatrixWorld(true);
      const HASH = 8;
      const lo = [centre[0] - RADIUS - 4, centre[1] - RADIUS - 4];
      const hi = [centre[0] + RADIUS + 4, centre[1] + RADIUS + 4];
      // 1. the level's placed meshes, each instance with its world box, hashed on the ground
      const cells = new Map();
      const m4 = new THREE.Matrix4();
      const box = new THREE.Box3();
      const grounds = [];
      let instances = 0;
      group.traverse((o) => {
        if (!o.isMesh) return;
        let inGround = false;
        for (let a = o; a && a !== group.parent; a = a.parent) {
          if (!a.visible) return;
          if (a.name === 'ground') inGround = true;
        }
        if (inGround) {
          grounds.push(o);
          return;
        }
        if (!o.isInstancedMesh) return;
        const g = o.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const name = String(o.userData?.glb ?? o.name ?? '?')
          .split('/')
          .pop()
          .replace(/(_mesh)?(\.lod\d|\.far|\.ultra)?\.glb$/, '');
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m4);
          const w = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m4);
          box.copy(g.boundingBox).applyMatrix4(w);
          if (box.max.x < lo[0] || box.min.x > hi[0] || box.max.z < lo[1] || box.min.z > hi[1]) continue;
          const it = { g, w, name, minY: box.min.y, maxY: box.max.y, b: [box.min.x, box.min.z, box.max.x, box.max.z], groups: Array.isArray(o.material) ? g.groups.length : 0 };
          instances++;
          for (let cx = Math.floor(box.min.x / HASH); cx <= Math.floor(box.max.x / HASH); cx++)
            for (let cz = Math.floor(box.min.z / HASH); cz <= Math.floor(box.max.z / HASH); cz++) {
              const key = `${cx},${cz}`;
              if (!cells.has(key)) cells.set(key, []);
              cells.get(key).push(it);
            }
        }
      });
      // (both faces: a ray from inside a solid still finds its skin)
      const both = { side: THREE.DoubleSide };
      const scratch = new THREE.Mesh(new THREE.BufferGeometry(), both);
      const rc = new THREE.Raycaster();
      const hitsOf = (origin, dir, far, list) => {
        rc.set(origin, dir);
        rc.near = 0;
        rc.far = far;
        const out = [];
        for (const it of list) {
          scratch.geometry = it.g;
          scratch.material = it.groups ? Array.from({ length: it.groups }, () => both) : both;
          scratch.matrixWorld = it.w;
          const got = [];
          THREE.Mesh.prototype.raycast.call(scratch, rc, got);
          for (const h of got) out.push({ d: h.distance, y: h.point.y, name: it.name });
        }
        return out;
      };
      // 2. the ground's triangles over the window, hashed (its meshes carry no tree: a ray would try them all)
      const GH = 4;
      const gcells = new Map();
      const v = new THREE.Vector3();
      let triangles = 0;
      for (const g of grounds) {
        const p = g.geometry.attributes.position;
        const idx = g.geometry.index;
        const count = idx ? idx.count : p.count;
        const at = (i) => {
          v.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(g.matrixWorld);
          return [v.x, v.y, v.z];
        };
        for (let t = 0; t < count; t += 3) {
          // (a cheap look at the first corner before the other two: most of a ground is far away)
          const a = at(t);
          if (a[0] < lo[0] - 40 || a[0] > hi[0] + 40 || a[2] < lo[1] - 40 || a[2] > hi[1] + 40) continue;
          const b = at(t + 1);
          const c = at(t + 2);
          const x0 = Math.min(a[0], b[0], c[0]);
          const x1 = Math.max(a[0], b[0], c[0]);
          const z0 = Math.min(a[2], b[2], c[2]);
          const z1 = Math.max(a[2], b[2], c[2]);
          if (x1 < lo[0] || x0 > hi[0] || z1 < lo[1] || z0 > hi[1]) continue;
          triangles++;
          const tri = [a, b, c];
          for (let cx = Math.floor(x0 / GH); cx <= Math.floor(x1 / GH); cx++)
            for (let cz = Math.floor(z0 / GH); cz <= Math.floor(z1 / GH); cz++) {
              const key = `${cx},${cz}`;
              if (!gcells.has(key)) gcells.set(key, []);
              gcells.get(key).push(tri);
            }
        }
      }
      // the highest drawn ground over (x, z)
      const groundAt = (x, z) => {
        let best = null;
        for (const [a, b, c] of gcells.get(`${Math.floor(x / GH)},${Math.floor(z / GH)}`) ?? []) {
          const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
          if (Math.abs(d) < 1e-12) continue;
          const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
          const w = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
          if (u < -1e-9 || w < -1e-9 || u + w > 1 + 1e-9) continue;
          const y = u * a[1] + w * b[1] + (1 - u - w) * c[1];
          if (best === null || y > best) best = y;
        }
        return best;
      };
      // 3. the grid
      const DOWN = new THREE.Vector3(0, -1, 0);
      const o = new THREE.Vector3();
      const n = Math.round((2 * RADIUS) / STEP) + 1;
      const N = n * n;
      const open = new Array(N);
      const feet = new Array(N);
      const truth = new Array(N);
      const ground = new Array(N).fill(null);
      const top = new Array(N).fill(null);
      const under = new Array(N).fill(null);
      const topName = new Array(N).fill(-1);
      const above = new Array(N).fill(0);
      const names = [];
      const t0 = performance.now();
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const k = r * n + c;
          const x = centre[0] - RADIUS + c * STEP;
          const z = centre[1] - RADIUS + r * STEP;
          open[k] = bf.do('walkable', [x, z]) ? 1 : 0;
          const f = bf.do('ground', [x, z]);
          feet[k] = Math.round(f * 1000) / 1000;
          truth[k] = Math.round(bf.level.heightAt(x, z) * 1000) / 1000;
          const g = groundAt(x, z);
          ground[k] = g === null ? null : Math.round(g * 1000) / 1000;
          const list = cells.get(`${Math.floor(x / HASH)},${Math.floor(z / HASH)}`);
          if (!list) continue;
          const cand = list.filter((it) => x >= it.b[0] && x <= it.b[2] && z >= it.b[1] && z <= it.b[3] && it.maxY > f - 3);
          if (!cand.length) continue;
          let cross = 0;
          for (const h of hitsOf(o.set(x, f + 40, z), DOWN, 43, cand)) {
            if (h.y > f + 1.0) cross++;
            if (h.y > f + 0.3 && h.y <= f + 1.9 && (top[k] === null || h.y > top[k])) {
              top[k] = Math.round(h.y * 1000) / 1000;
              if (!names.includes(h.name)) names.push(h.name);
              topName[k] = names.indexOf(h.name);
            }
            if (h.y <= f + 0.3 && (under[k] === null || h.y > under[k])) under[k] = Math.round(h.y * 1000) / 1000;
          }
          above[k] = Math.min(255, cross);
        }
      const ms = performance.now() - t0;
      // 4. the sideways look, for the candidates the sums pick: any drawn mesh within `reach` at knee, chest or head
      const DIRS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(Math.sin((i * Math.PI) / 4), 0, Math.cos((i * Math.PI) / 4)));
      window.__probe = {
        near(x, z, f, reach = 0.8) {
          const list = [];
          const seen = new Set();
          for (let cx = Math.floor((x - reach) / HASH); cx <= Math.floor((x + reach) / HASH); cx++)
            for (let cz = Math.floor((z - reach) / HASH); cz <= Math.floor((z + reach) / HASH); cz++)
              for (const it of cells.get(`${cx},${cz}`) ?? []) {
                if (seen.has(it)) continue;
                seen.add(it);
                if (x + reach >= it.b[0] && x - reach <= it.b[2] && z + reach >= it.b[1] && z - reach <= it.b[3] && it.maxY > f + 0.4 && it.minY < f + 1.7) list.push(it);
              }
          let best = null;
          for (const h of [0.5, 1.0, 1.5])
            for (const d of DIRS) for (const hit of hitsOf(o.set(x, f + h, z), d, reach, list)) if (!best || hit.d < best.d) best = { d: Math.round(hit.d * 100) / 100, name: hit.name };
          return best;
        },
      };
      return { n, step: STEP, centre, radius: RADIUS, instances, grounds: grounds.length, triangles, ms, open, feet, truth, ground, top, under, topName, above, names };
    },
    { centre, RADIUS, STEP },
  );

const xz = (scan, k) => [scan.centre[0] - scan.radius + (k % scan.n) * scan.step, scan.centre[1] - scan.radius + Math.floor(k / scan.n) * scan.step];
const r1 = (v) => Math.round(v * 10) / 10;
const windows = [];
const wallSpots = []; // { cells, at, entry } for the walks
const buriedSpots = [];
for (const centre of ATS) {
  await alive();
  const y = await page.evaluate((p) => window.__battlefront.do('ground', p), centre);
  await page.evaluate((p) => window.__battlefront.do('teleport', p), [centre[0], y, centre[1]]);
  // (the stream brings the cells round the new place: wait for it, and the level-of-detail swap after it)
  await page.waitForTimeout(3000);
  await loaded();
  await page.waitForTimeout(2500);
  const scan = await scanAt(centre);
  const buried = buriedOf(scan);
  const walls = wallsOf(scan);
  const looks = await page.evaluate((list) => list.map(([x, z, f]) => window.__probe.near(x, z, f)), walls.candidates.map((k) => [...xz(scan, k), scan.feet[k]]));
  const bare = lookedAt(walls.candidates, looks);
  const clusters = clustersOf(bare, scan.n);
  const pits = clustersOf(buried.cells, scan.n);
  const w = {
    centre,
    points: scan.n * scan.n,
    instances: scan.instances,
    open: buried.open,
    blocked: walls.blocked,
    groundOver: buried.ground.over,
    groundDeepest: Math.round(buried.ground.deepest * 100) / 100,
    floating: buried.ground.under,
    meshBuried: buried.mesh.points,
    meshDepth: buried.mesh.depth,
    meshesThrough: Object.keys(buried.mesh.byMesh).length,
    byMesh: Object.fromEntries(Object.entries(buried.mesh.byMesh).sort((a, b) => b[1] - a[1]).slice(0, 12)),
    inside: buried.inside,
    blockedByDrawn: walls.drawn + (walls.candidates.length - bare.length),
    blockedByBank: walls.bank,
    invisible: bare.length,
    wallClusters: clusters.length,
    walls: clusters.slice(0, 8).map((c) => ({ cells: c.cells, at: xz(scan, Math.round(c.at[1]) * scan.n + Math.round(c.at[0])).map(r1) })),
  };
  windows.push(w);
  console.log(`(${centre.join(', ')}) ±${RADIUS} m: ${w.instances} placed meshes, ${scan.triangles} ground triangles, ${w.points} points in ${Math.round(scan.ms)} ms; open ${w.open}, blocked ${w.blocked}`);
  console.log(`  walked through: the drawn ground 0.3 m or more over the feet at ${w.groundOver} points (at most ${w.groundDeepest} m); a drawn mesh over them at ${w.meshBuried} (${JSON.stringify(w.meshDepth)}), ${w.meshesThrough} kinds: ${Object.entries(w.byMesh).slice(0, 6).map(([k, v]) => `${k} ×${v}`).join(', ')}`);
  console.log(`  blocked: by a drawn mesh ${w.blockedByDrawn}, by a bank past 45° ${w.blockedByBank}, by nothing drawn ${w.invisible} in ${w.wallClusters} clusters; feet 0.3 m or more over everything drawn: ${w.floating}; under one surface only: ${w.inside}`);
  // the walks' spots, kept with what they need (a start on open ground beside the cluster, toward its middle)
  const openNear = (k, reach) => {
    const c0 = k % scan.n;
    const r0 = Math.floor(k / scan.n);
    for (let ring = 1; ring <= reach; ring++)
      for (let dr = -ring; dr <= ring; dr++)
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const rr = r0 + dr;
          const cc = c0 + dc;
          if (rr < 0 || cc < 0 || rr >= scan.n || cc >= scan.n) continue;
          const j = rr * scan.n + cc;
          if (scan.open[j] && !(scan.top[j] !== null && scan.top[j] - scan.feet[j] >= 0.3) && !(scan.ground[j] !== null && scan.ground[j] - scan.feet[j] >= 0.3)) return j;
        }
    return -1;
  };
  for (const c of clusters.slice(0, WALKS)) {
    const mid = c.members.reduce((best, q) => (Math.hypot((q % scan.n) - c.at[0], Math.floor(q / scan.n) - c.at[1]) < Math.hypot((best % scan.n) - c.at[0], Math.floor(best / scan.n) - c.at[1]) ? q : best), c.members[0]);
    const from = openNear(mid, Math.round(6 / scan.step));
    if (from >= 0) wallSpots.push({ cells: c.cells, to: xz(scan, mid), from: xz(scan, from), fromY: scan.feet[from] });
  }
  for (const c of pits.slice(0, WALKS)) {
    const deep = c.members.reduce((best, q) => (scan.top[q] - scan.feet[q] > scan.top[best] - scan.feet[best] ? q : best), c.members[0]);
    const from = openNear(deep, Math.round(6 / scan.step));
    if (from >= 0) buriedSpots.push({ cells: c.cells, depth: Math.round((scan.top[deep] - scan.feet[deep]) * 100) / 100, mesh: scan.names[scan.topName[deep]], to: xz(scan, deep), from: xz(scan, from), fromY: scan.feet[from] });
  }
}

// The walks: the soldier put on open ground beside a spot and walked at it (W held, the look turned toward it).
const player = () => page.evaluate(() => window.__battlefront.view().player);
async function walk(spot, secs = 6) {
  await alive();
  await page.evaluate((p) => window.__battlefront.do('teleport', p), [spot.from[0], spot.fromY, spot.from[1]]);
  await page.waitForTimeout(400);
  let p = await player();
  let last = p.at.slice();
  let stalled = 0;
  let why = 'time';
  await page.keyboard.down('KeyW');
  const until = Date.now() + secs * 1000;
  while (Date.now() < until) {
    p = await player();
    if (!p || p.state !== 'alive') {
      why = 'down';
      break;
    }
    const dx = spot.to[0] - p.at[0];
    const dz = spot.to[1] - p.at[2];
    if (Math.hypot(dx, dz) < 0.35) {
      why = 'arrived';
      break;
    }
    await page.evaluate((yaw) => window.__battlefront.do('look', { yaw, pitch: 0 }), Math.atan2(dx, dz));
    await page.waitForTimeout(100);
    const moved = Math.hypot(p.at[0] - last[0], p.at[2] - last[2]);
    last = p.at.slice();
    stalled = moved < 0.02 ? stalled + 1 : 0;
    if (stalled >= 6) {
      why = 'stalled';
      break;
    }
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(100);
  p = await player();
  return { why, end: p.at.map((v) => Math.round(v * 100) / 100), short: Math.round(Math.hypot(spot.to[0] - p.at[0], spot.to[1] - p.at[2]) * 100) / 100 };
}
const walks = { walls: [], buried: [] };
for (const s of wallSpots.sort((a, b) => b.cells - a.cells).slice(0, WALKS)) {
  const w = await walk(s);
  const verdict = w.why === 'arrived' ? 'walked through' : w.why === 'stalled' ? 'stopped by nothing drawn' : w.why;
  walks.walls.push({ at: s.to.map(r1), cells: s.cells, verdict, short: w.short });
  console.log(`wall at ${s.to.map(r1).join(', ')} (${s.cells} points): ${verdict}, ${w.short} m short`);
}
for (const s of buriedSpots.sort((a, b) => b.cells * b.depth - a.cells * a.depth).slice(0, WALKS)) {
  const w = await walk(s);
  const verdict = w.why === 'arrived' ? 'walked into it' : w.why === 'stalled' ? 'stopped short' : w.why;
  walks.buried.push({ at: s.to.map(r1), mesh: s.mesh, depth: s.depth, cells: s.cells, verdict, short: w.short });
  console.log(`${s.mesh} at ${s.to.map(r1).join(', ')} (${s.depth} m over the feet, ${s.cells} points): ${verdict}, ${w.short} m short`);
}

const sum = (k) => windows.reduce((a, w) => a + w[k], 0);
const kinds = new Set(windows.flatMap((w) => Object.keys(w.byMesh)));
const totals = { windows: windows.length, points: sum('points'), open: sum('open'), blocked: sum('blocked'), groundOver: sum('groundOver'), groundDeepest: Math.max(...windows.map((w) => w.groundDeepest)), meshBuried: sum('meshBuried'), meshKinds: kinds.size, blockedByDrawn: sum('blockedByDrawn'), blockedByBank: sum('blockedByBank'), invisible: sum('invisible'), wallClusters: sum('wallClusters'), floating: sum('floating'), inside: sum('inside'), wallsStopped: walks.walls.filter((w) => w.verdict === 'stopped by nothing drawn').length, wallsWalked: walks.walls.length, buriedEntered: walks.buried.filter((w) => w.verdict === 'walked into it').length, buriedWalked: walks.buried.length };
console.log('');
console.log(
  tableOf([
    ['window', 'points', 'open', 'ground over the feet', 'mesh over the feet', 'blocked', 'by a drawn mesh', 'by a bank', 'by nothing drawn', 'clusters'],
    ...windows.map((w) => [`${w.centre.join(', ')}`, w.points, w.open, w.groundOver, w.meshBuried, w.blocked, w.blockedByDrawn, w.blockedByBank, w.invisible, w.wallClusters]),
    ['all', totals.points, totals.open, totals.groundOver, totals.meshBuried, totals.blocked, totals.blockedByDrawn, totals.blockedByBank, totals.invisible, totals.wallClusters],
  ]),
);
console.log(`\nwalks: ${totals.wallsStopped} of ${totals.wallsWalked} wall spots stopped the soldier with nothing drawn; ${totals.buriedEntered} of ${totals.buriedWalked} buried spots were walked into`);
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ base: BASE, world: WORLD, mode: MODE, gpu, quality: QUALITY, radius: RADIUS, step: STEP, spawn, mask, totals, windows, walks, errors: errors.slice(0, 10) }, null, 1)}\n`);
  console.log(`written ${OUT}`);
}
await browser.close();
