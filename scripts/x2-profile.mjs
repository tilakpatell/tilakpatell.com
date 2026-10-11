#!/usr/bin/env node
// Lane X2's profile of the Battlefront world's CPU work (docs/superpowers/
// plans/2026-10-11-bf2017-picture-laneX2-wasm.md, task 2), without the
// draw. In headless Chromium the frame is drawn by SwiftShader on the CPU,
// a frame at high takes minutes, and the main thread waits on the GPU
// process for nearly all of it: a minute's CPU profile there held two
// frames and 177 ms of script (galaxy-check.mjs PROFILE=60, the evidence's
// README). So this runs what the world's `step` runs a frame
// (src/components/battlefront/module.js), on Hoth's own pack from disk, in
// Node, for `--seconds` of play at 60 frames a second, and profiles the
// main thread through the inspector:
//
//   the battle (battle.js's step at its fixed rate: the bots' brains, the
//     sim, the navgrid's paths), and view(sim) every frame
//   the level (map/level.js): the stream's wanted cells, the LOD table
//     sorted every 8 m (levelScene.js), its InstancedMeshes filled, every
//     mesh one box (the GLBs' decode is a load's, not a frame's)
//   the collision (map/collision.js, collision.update(4)): the cells' bins
//     decoded into Rapier as they come, the engine stepped
//   the heights: every heightAt the sim asks (the pack's image layer)
//
//   node scripts/x2-profile.mjs [--seconds 60] [--tier high] [--out dir] [--seed 1] [--search js|wasm]
//     [--breaks 100 [--debris-world own|level]]
//
// --breaks n (GPU-first lane N5): n breaks a minute round the player (a
// crate, a wall section, a speeder, a barrel in turn, 8 to 15 m off), each
// split by src/lib/physics/breaks.js into Rapier hulls (debris.js, at most
// 64 live) and a GPU burst (counted, never stepped here: on WebGPU it costs
// the CPU its spawn call); and the engine stepped every frame, which the
// Battlefront does not do without them (collision.js steps it only when a
// cell comes), so the step timed (`physics` in the JSON: the step and the
// hulls' sleep check a frame) holds the level's colliders and the hulls
// both. The plan's gate: under 2 ms p95. --debris-world own (the default)
// puts the hulls and their floor tiles in a small world of their own,
// stepped every frame, and leaves the level's as the Battlefront has it:
// Rapier 0.21 steps a fixed collider for about 0.3 µs whether anything
// moves or not, so Hoth's near cells (3,873 colliders) cost 1.1 to 1.3 ms a
// step with nothing in them (lane N5's evidence README); `level` steps the
// level's world every frame with the hulls in it. `battle` is the run's fingerprint
// (the searches it made and a hash of every entity's place at the end): the
// same seed with and without breaks must give the same battle.
//
// --search wasm runs the navgrid's A* in its WebAssembly port (navWasm.js)
// for the whole run; either way every search the minute made is recorded
// and replayed after, five times through each of the two, for the port's
// own before and after on the same calls (`replay` in the JSON).
//
// It writes <out>/x2-cpu-<tier>-<search>.cpuprofile and .profile.json (the time
// by module and function per frame, scripts/cpu-profile.mjs) and prints
// the top of each. The player walks a slow circle round the HQ, so the
// stream and the LOD have ground to cover.

import { Session } from 'node:inspector/promises';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { summarise } from './cpu-profile.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const SECONDS = Number(arg('seconds', 60));
const TIER = arg('tier', 'high');
const OUT = resolve(ROOT, arg('out', 'docs/superpowers/evidence/bf2017-picture/x2'));
const SEED = Number(arg('seed', 1));
const SEARCH = arg('search', 'js');
const BREAKS = Number(arg('breaks', 0)); // a minute
const DEBRIS_WORLD = arg('debris-world', 'own');
const FPS = 60;
mkdirSync(OUT, { recursive: true });

const PACK = join(ROOT, 'public/models/galaxy/bf2017/levels/hoth');
const disk = (path) => {
  const b = readFileSync(join(PACK, path));
  return Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

const vite = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
const load = (p) => vite.ssrLoadModule(p);
const THREE = await import('three');
const { loadRulebook } = await load('/src/lib/battlefront/rulebook.js');
const battle = await load('/src/components/battlefront/battle.js');
const { createLevel } = await load('/src/components/battlefront/map/level.js');
const { createLevelCollision } = await load('/src/components/battlefront/map/collision.js');
const { createLevelScene } = await load('/src/components/galaxy/surface/level/levelScene.js');
const { createLevelStream } = await load('/src/components/galaxy/surface/level/levelStream.js');
const { imageLayerFrom } = await load('/src/lib/land/layers.js');
const { decodePng16 } = await load('/src/lib/level/png16.js');
const { inflateMask } = await load('/src/lib/battlefront/navMask.js');
const { createPhysics, preload } = await load('/src/lib/physics/world.js');
const { engineBuild } = await load('/src/lib/physics/engine.js');
const navSearch = await load('/src/lib/battlefront/navSearch.js');
const { loadNavSearch, wasmSearch } = await load('/src/lib/battlefront/navWasm.js');
const wasmBytes = readFileSync(join(ROOT, 'src/lib/wasm/navsearch/navsearch_bg.wasm'));
const glue = await load('/src/lib/wasm/navsearch/navsearch.js');
glue.initSync({ module: wasmBytes });
const port = wasmSearch(glue);
if (SEARCH === 'wasm' && !(await loadNavSearch({ bytes: wasmBytes, importer: async () => glue }))) throw new Error('the port did not come up');
// every search the run makes, recorded (and timed) on its way to the one in use
const calls = [];
let recording = false;
let searchMs = 0;
const inUse = SEARCH === 'wasm' ? port : navSearch.searchJs;
navSearch.setSearch((nav, s, goal, blocked, max) => {
  const a = performance.now();
  const out = inUse(nav, s, goal, blocked, max);
  if (recording) {
    searchMs += performance.now() - a;
    calls.push({ nav, s, goal, blocked: blocked ? new Set(blocked) : null, max });
  }
  return out;
});

const pack = JSON.parse(new TextDecoder().decode(await disk('level.json')));
async function imageLayer() {
  const t = pack.terrain;
  const [near, far] = await Promise.all([disk(t.near.png).then(decodePng16), disk(t.far.png).then(decodePng16)]);
  const frame = (m, img) => ({ data: img.data, w: img.w, h: img.h, minX: m.min[0], minZ: m.min[1], metresPerPixel: m.metresPerPixel });
  return imageLayerFrom({ heightScale: t.scale, heightOffset: t.offset, holePixels: t.hole === null ? 0 : 1 }, frame(t.near, near), frame(t.far, far));
}
// every mesh a box, made once: the scene's work is the table, not the GLB
const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
const loader = { load: () => Promise.resolve({ scene: box.clone() }), dispose() {} };
const scene = new THREE.Scene();
const level = createLevel({
  scene,
  tier: TIER,
  world: 'hoth',
  ground: false,
  onCell: (k, b, band) => collision?.add(k, b, band),
  onDrop: (k) => collision?.drop(k),
  deps: {
    packOf: async () => pack,
    imageLayer,
    createLevelLoader: () => loader,
    createLevelScene,
    createLevelStream: (o) => createLevelStream({ ...o, fetch: (path) => disk(path) }),
    navOf: () => disk('nav.bin').then(inflateMask),
  },
});
let collision = null;
await level.ready;
await preload();
const physics = await createPhysics();
collision = createLevelCollision({ pack, loadBin: disk, physics, tier: TIER });
const mask = await level.navOf();

// (--breaks) the debris: hulls into the engine, bursts counted
let debris = null;
let debrisPhysics = null;
const burst = {
  spawned: 0,
  particles: 0,
  spawn(name, at, quat, scale, o) {
    burst.spawned++;
    burst.particles += o?.burst ?? 0;
  },
};
const physicsMs = [];
let breaks = 0;
const KINDS = [1, 3, 4.5, 1.5]; // m: a crate, a wall section, a speeder, a barrel
const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
const cy = Math.cos(pack.yaw ?? 0);
const sy = Math.sin(pack.yaw ?? 0);
if (BREAKS > 0) {
  const { createDebris } = await load('/src/lib/three/particles/debris.js');
  // (the ground under a break, in the pack's frame: Hoth's collision holds
  // the cells' shapes and no terrain, so debris lays a tile there)
  const groundAt = (px, pz) => level.heightAt(ox + px * cy - pz * sy, oz + px * sy + pz * cy) - oy;
  debrisPhysics = DEBRIS_WORLD === 'level' ? physics : await createPhysics();
  debris = createDebris(burst, debrisPhysics, { seed: SEED, groundAt });
}
function breakNear(at) {
  const a = breaks * 2.39996; // (the golden angle: round the player)
  const r = 8 + (breaks % 8);
  const x = at[0] + Math.cos(a) * r;
  const z = at[2] + Math.sin(a) * r;
  const size = KINDS[breaks % KINDS.length];
  const ground = level.heightAt(x, z);
  // (into the pack's frame, where the collision is: map/level.js's toPack)
  const px = (x - ox) * cy + (z - oz) * sy;
  const pz = -(x - ox) * sy + (z - oz) * cy;
  debris.break([px, (Number.isFinite(ground) ? ground : at[1]) - oy + size / 2 + 0.3, pz], size, [0, 1.5, 0]);
  breaks++;
}

// every heightAt the sim asks, counted and timed apart (a call is too short
// for the sampler to place alone)
let heights = 0;
const heightAt = (x, z) => {
  heights++;
  return level.heightAt(x, z);
};
const rb = loadRulebook();
const sim = battle.createBattle({ rulebook: rb, level: 'hoth', mode: 'galacticAssault', heightAt, mask, seed: SEED });
const me = battle.addPlayer(sim, { team: 2 });
battle.deploy(sim, me, { classId: 'd-orig-assault' });

// a few seconds' warm-up (the JIT, the first cells), then the profile
let acc = 0;
let t = 0;
let yaw = 0;
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
function frame(dt) {
  t += dt;
  yaw += dt * 0.15;
  battle.view(sim);
  acc = Math.min(acc + dt, battle.STEP * 10);
  while (acc >= battle.STEP) {
    acc -= battle.STEP;
    battle.step(sim, [{ id: me, move: [0, 1], yaw, pitch: 0, fire: Math.floor(t) % 3 === 0, aim: false, sprint: false, crouch: false, vent: false, ability: 0 }]);
  }
  collision.update(4);
  const p = sim.player?.id ? sim.sim.entities.get(sim.player.id) : null;
  if (debris) {
    if (p && t * (BREAKS / 60) >= breaks + 1) breakNear(p.at);
    const a = performance.now();
    debrisPhysics.step(dt);
    debris.update(dt);
    if (recording) physicsMs.push(performance.now() - a);
  }
  if (p) level.update(p.at);
  else if (battle.view(sim).deploy?.open) battle.deploy(sim, me, { classId: 'd-orig-assault' });
}
for (let i = 0; i < FPS * 3; i++) {
  frame(1 / FPS);
  if (i % 30 === 0) await settle(1); // (the stream's reads land between frames, as on the page)
}

const session = new Session();
session.connect();
await session.post('Profiler.enable');
await session.post('Profiler.setSamplingInterval', { interval: 200 });
await session.post('Profiler.start');
const frames = FPS * SECONDS;
const times = [];
heights = 0;
recording = true;
for (let i = 0; i < frames; i++) {
  const a = performance.now();
  frame(1 / FPS);
  times.push(performance.now() - a);
  if (i % 30 === 0) await settle(1);
}
const { profile } = await session.post('Profiler.stop');
session.disconnect();
recording = false;

// the same searches again through each, five times, alternating (the JIT warm for both)
function replay(fn) {
  const a = performance.now();
  for (const c of calls) fn(c.nav, c.s, c.goal, c.blocked, c.max);
  return performance.now() - a;
}
const runs = { js: [], wasm: [] };
let differ = 0;
for (const c of calls) if (JSON.stringify(port(c.nav, c.s, c.goal, c.blocked, c.max)) !== JSON.stringify(navSearch.searchJs(c.nav, c.s, c.goal, c.blocked, c.max))) differ++;
for (let k = 0; k < 5; k++) {
  runs.js.push(replay(navSearch.searchJs));
  runs.wasm.push(replay(port));
}
const median = (a) => +[...a].sort((x, y) => x - y)[2].toFixed(2);
const replayed = { calls: calls.length, differ, jsMs: median(runs.js), wasmMs: median(runs.wasm), perCallJsUs: +((median(runs.js) / Math.max(1, calls.length)) * 1000).toFixed(1), perCallWasmUs: +((median(runs.wasm) / Math.max(1, calls.length)) * 1000).toFixed(1) };

times.sort((a, b) => a - b);
const pick = (q) => +times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(3);
const pickOf = (xs, q) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length ? +v[Math.min(v.length - 1, Math.floor(q * v.length))].toFixed(3) : null;
};
// the battle's fingerprint: every entity's place at the end, hashed (FNV-1a over the rounded numbers)
function fingerprint() {
  let h = 2166136261;
  for (const [id, e] of [...sim.sim.entities].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    for (const ch of `${id}:${(e.at ?? []).map((v) => v.toFixed(4)).join(',')};`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  }
  return h.toString(16);
}
const sum = summarise(profile, { frames, top: 25 });
const stats = level.stats();
const out = {
  _source: 'scripts/x2-profile.mjs on this machine (Node, the lane X2 container): the Battlefront world’s step on Hoth’s pack, the draw left out',
  seconds: SECONDS,
  tier: TIER,
  seed: SEED,
  rapier: engineBuild(),
  search: SEARCH,
  searchMsPerFrame: +(searchMs / frames).toFixed(4),
  replay: replayed,
  battle: { searches: calls.length, hash: fingerprint() },
  ...(debris ? { breaks: { perMinute: BREAKS, world: DEBRIS_WORLD, made: breaks, ...debris.stats(), bursts: burst.spawned, particles: burst.particles }, physics: { p50: pickOf(physicsMs, 0.5), p95: pickOf(physicsMs, 0.95), max: pickOf(physicsMs, 1), mean: +(physicsMs.reduce((a, b) => a + b, 0) / Math.max(1, physicsMs.length)).toFixed(3) } } : {}),
  frame: { p50: pick(0.5), p95: pick(0.95), max: pick(1) },
  heightsPerFrame: +(heights / frames).toFixed(1),
  level: { instances: stats.instances, rebuilds: null },
  bots: sim.sim.entities.size,
  ...sum,
};
const name = `x2-cpu-${TIER}-${SEARCH}${BREAKS ? `-breaks${BREAKS}-${DEBRIS_WORLD}` : ''}`;
writeFileSync(join(OUT, `${name}.cpuprofile`), JSON.stringify(profile));
writeFileSync(join(OUT, `${name}.profile.json`), `${JSON.stringify(out, null, 2)}\n`);
console.log(`${SECONDS} s at ${FPS} fps, ${TIER}, Rapier ${engineBuild()}: frame p50 ${out.frame.p50} ms, p95 ${out.frame.p95} ms; ${out.heightsPerFrame} heights a frame; ${out.bots} entities`);
console.log(`the battle: ${out.battle.searches} searches, hash ${out.battle.hash}`);
if (debris) console.log(`breaks (${DEBRIS_WORLD} world): ${breaks} made (${BREAKS} a minute), ${out.breaks.hulls} hulls live, ${out.breaks.statics} gone static, ${out.breaks.lost} lost, ${out.breaks.refused} refused by the cap, ${burst.particles} particles in ${burst.spawned} bursts; the physics step p50 ${out.physics.p50} ms, p95 ${out.physics.p95} ms, worst ${out.physics.max} ms`);
console.log(`search (${SEARCH}): ${out.searchMsPerFrame} ms a frame; replayed ${replayed.calls} searches: JavaScript ${replayed.jsMs} ms, WebAssembly ${replayed.wasmMs} ms (${replayed.perCallJsUs} against ${replayed.perCallWasmUs} µs a search), ${differ} differ`);
console.log('by module (self, ms a frame):');
for (const m of sum.modules.slice(0, 15)) console.log(`  ${m.module.padEnd(64)} ${m.perFrame.toFixed(3)}  ${(m.share * 100).toFixed(1)}%`);
console.log('by function (total, ms a frame):');
for (const m of sum.total.slice(0, 25)) console.log(`  ${m.fn.padEnd(90)} ${m.perFrame.toFixed(3)}  ${(m.share * 100).toFixed(1)}%`);
level.dispose?.();
if (debrisPhysics && debrisPhysics !== physics) debrisPhysics.dispose();
physics.dispose();
await vite.close();
