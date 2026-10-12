// A level pack's nav.bin: the game's shapes walked as its capsule controller
// walks them, on the navgrid of the map's bounds (the Battlefront world's
// navgrid, src/lib/battlefront/nav.js, takes it as its mask: where a soldier
// may stand, how high over the ground it stands there, a pile's top or a
// trench's floor, and what blocks). The walk floods from the map's spawns.
// The ground is the pack's own two heightmaps, read as the world reads them
// (map/level.js's heightAt), a hole in the near map no surface, so the mask
// must be built again when they change (their sizes are in the header's meta).
//
//   node scripts/bf2017-nav.mjs <pack dir> [--map hoth] [--radius 0.3] [--fine 0.5] [--cell 2] [--climb 0.55] [--dry]
//
//   pack dir  a level pack with its physics section (scripts/bf2017-physics.mjs)
//   map       src/data/bf2017/maps/<map>.json: its rows' bounds, spawns and volumes
//   radius    the capsule's radius (the default: the soldier's PhysicalRadius)
//   climb     the rise a step takes (the default: the game's StepHeightValue, navMask.js's CLIMB)
//   dry       measure, write nothing
//
// It prints the paths from each team's spawn to the mode's volumes, without
// the mask and with it (pathTable), and the file's size. The engine's
// package resolves only through Vite (vite.config.js's ssr note), so the
// builder (scripts/lib/bf2017-nav.mjs) is loaded through a Vite server.

import { readFile, stat, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { createServer } from 'vite';
import { encodeMask } from '../src/lib/battlefront/navMask.js';
import { decodePng16 } from '../src/lib/level/png16.js';
import { LAYERS, imageLayerFrom } from '../src/lib/land/layers.js';
import { CLIMB } from '../src/lib/battlefront/navMask.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function groundOf(dir, pack) {
  const t = pack.terrain;
  const [nearBytes, farBytes] = await Promise.all([readFile(join(dir, t.near.png)), readFile(join(dir, t.far.png))]);
  const [near, far] = await Promise.all([decodePng16(nearBytes), decodePng16(farBytes)]);
  const frame = (m, img) => ({ data: img.data, w: img.w, h: img.h, minX: m.min[0], minZ: m.min[1], metresPerPixel: m.metresPerPixel });
  const layer = imageLayerFrom({ heightScale: t.scale, heightOffset: t.offset, holePixels: t.hole === null ? 0 : 1 }, frame(t.near, near), frame(t.far, far));
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  const heightAt = (x, z) => LAYERS.image((x - ox) * c + (z - oz) * s, -(x - ox) * s + (z - oz) * c, layer) + oy;
  // (a hole in the near map: the game cut the ground away there, for a trench's floor or a hangar's)
  const n = t.near;
  const holeAt = (x, z) => {
    if (t.hole === null) return false;
    const px = Math.round(((x - ox) * c + (z - oz) * s - n.min[0]) / n.metresPerPixel);
    const pz = Math.round((-(x - ox) * s + (z - oz) * c - n.min[1]) / n.metresPerPixel);
    if (px < 0 || pz < 0 || px >= near.w || pz >= near.h) return false;
    return near.data[pz * near.w + px] === t.hole;
  };
  return { heightAt, holeAt, bytes: { near: nearBytes.length, far: farBytes.length } };
}

const line = (name, r) =>
  `| ${name} | ${r.solid} | ${r.offSpawns} of ${r.spawns} | ${r.teams[2]?.found ?? 0} / ${r.teams[1]?.found ?? 0} of ${r.volumes} | ${r.teams[2]?.bots ?? 0} / ${r.teams[1]?.bots ?? 0} | ${r.teams[2]?.metres ?? 0} / ${r.teams[1]?.metres ?? 0} | ${r.ms} ms |`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [dir] = args._;
  if (!dir) {
    console.error('usage: node scripts/bf2017-nav.mjs <pack dir> [--map hoth] [--radius 0.3] [--fine 0.5] [--cell 2] [--climb 0.55] [--dry]');
    process.exit(1);
  }
  const mapName = typeof args.map === 'string' ? args.map : 'hoth';
  const pack = JSON.parse(await readFile(join(dir, 'level.json'), 'utf8'));
  const map = JSON.parse(await readFile(join(ROOT, 'src/data/bf2017/maps', `${mapName}.json`), 'utf8')).rows;
  const soldier = JSON.parse(await readFile(join(ROOT, 'src/data/bf2017/physics/soldier.json'), 'utf8'));
  // (Rapier's bare package carries only a `module` entry: the builder comes through Vite, as scripts/x2-profile.mjs does)
  const vite = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  const { capsuleOf, navMaskOf, pathTable, raysOf } = await vite.ssrLoadModule('/scripts/lib/bf2017-nav.mjs');
  const capsule = capsuleOf(soldier);
  const rays = raysOf(soldier);
  if (args.radius) Object.assign(capsule, { radius: Number(args.radius), sources: { ...capsule.sources, radius: 'hand (--radius)' } });
  const climb = args.climb ? Number(args.climb) : CLIMB;
  const cell = Number(args.cell) || 2;
  const fine = Number(args.fine) || 0.5;
  const { heightAt, holeAt, bytes } = await groundOf(dir, pack);
  // (the walk starts at every spawn the map places, whatever the mode)
  const seeds = (map.spawns ?? []).filter((q) => q.at).map((q) => [q.at[0], q.at[1], q.at[2]]);
  const loadBin = async (file) => {
    const b = await readFile(join(dir, file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  const bounds = { min: map.bounds.min, max: map.bounds.max };
  const t0 = Date.now();
  const mask = await navMaskOf({ pack, loadBin, heightAt, holeAt, bounds, seeds, capsule, rays, climb, cell, fine });
  await vite.close();
  const ms = Date.now() - t0;
  mask.meta = { map: mapName, sources: { ...capsule.sources, rays: rays.sources, climb: 'CharacterStateCheckSupportControllerData.StepHeightValue (navMask.js CLIMB)' }, seeds: seeds.length, terrain: bytes, physics: Object.keys(pack.physics?.meshes ?? {}).length };
  const out = deflateSync(Buffer.from(encodeMask(mask)), { level: 9 });
  const plain = pathTable({ map: { ...map, bounds }, heightAt, cell });
  const masked = pathTable({ map: { ...map, bounds }, heightAt, cell, mask });
  let stood = 0;
  for (const b of mask.stand?.bytes ?? []) if (b) stood++;
  console.log(`mask: ${mask.cols} × ${mask.rows} cells of ${cell} m, fine ${fine} m, capsule r ${capsule.radius} from ${capsule.step} to ${capsule.height} m, rays ${rays.start} to ${rays.end} m, climb ${climb} m, ${seeds.length} seeds; ${mask.stats.bodies} bodies (${mask.stats.refused} refused); ${stood} fine cells stand off the ground in ${(mask.stand?.bytes.length ?? 0) / 16} blocks; ${ms} ms; ${out.length} bytes deflated`);
  console.log('');
  console.log('| nav source | solid cells | spawns not walkable | paths found, team 2 / team 1 | within the bots’ 20,000 cells | metres walked, team 2 / team 1 | nav build |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  console.log(line('ground only', plain));
  console.log(line(`ground and the walk mask (r ${capsule.radius}, climb ${climb})`, masked));
  console.log(`\nfrom ${plain.teams[2]?.from} (team 2) and ${plain.teams[1]?.from} (team 1)`);
  if (args.dry) return;
  await writeFile(join(dir, 'nav.bin'), out);
  console.log(`wrote ${join(dir, 'nav.bin')} (${(await stat(join(dir, 'nav.bin'))).size} bytes)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
