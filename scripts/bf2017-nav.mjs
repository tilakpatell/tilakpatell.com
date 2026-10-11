// A level pack's nav.bin: where the game's shapes leave no room for a
// soldier's capsule, on the navgrid of the map's bounds (the Battlefront
// world's navgrid, src/lib/battlefront/nav.js, takes it as its mask). The
// ground is the pack's own two heightmaps, read as the world reads them
// (map/level.js's heightAt), so the mask must be built again when they change
// (their sizes are in the header's meta).
//
//   node scripts/bf2017-nav.mjs <pack dir> [--map hoth] [--radius 0.3] [--fine 0.5] [--cell 2] [--dry]
//
//   pack dir  a level pack with its physics section (scripts/bf2017-physics.mjs)
//   map       src/data/bf2017/maps/<map>.json: its rows' bounds, spawns and volumes
//   radius    the capsule's radius (the default: the soldier's PhysicalRadius)
//   dry       measure, write nothing
//
// It prints the paths from each team's spawn to the mode's volumes, without
// the mask and with it (pathTable), and the file's size.

import { readFile, stat, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { capsuleOf, navMaskOf, pathTable } from './lib/bf2017-nav.mjs';
import { encodeMask } from '../src/lib/battlefront/navMask.js';
import { decodePng16 } from '../src/lib/level/png16.js';
import { LAYERS, imageLayerFrom } from '../src/lib/land/layers.js';

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
  return { heightAt, bytes: { near: nearBytes.length, far: farBytes.length } };
}

const line = (name, r) =>
  `| ${name} | ${r.solid} | ${r.offSpawns} of ${r.spawns} | ${r.teams[2]?.found ?? 0} / ${r.teams[1]?.found ?? 0} of ${r.volumes} | ${r.teams[2]?.bots ?? 0} / ${r.teams[1]?.bots ?? 0} | ${r.teams[2]?.metres ?? 0} / ${r.teams[1]?.metres ?? 0} | ${r.ms} ms |`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [dir] = args._;
  if (!dir) {
    console.error('usage: node scripts/bf2017-nav.mjs <pack dir> [--map hoth] [--radius 0.3] [--fine 0.5] [--cell 2] [--dry]');
    process.exit(1);
  }
  const mapName = typeof args.map === 'string' ? args.map : 'hoth';
  const pack = JSON.parse(await readFile(join(dir, 'level.json'), 'utf8'));
  const map = JSON.parse(await readFile(join(ROOT, 'src/data/bf2017/maps', `${mapName}.json`), 'utf8')).rows;
  const soldier = JSON.parse(await readFile(join(ROOT, 'src/data/bf2017/physics/soldier.json'), 'utf8'));
  const capsule = capsuleOf(soldier);
  if (args.radius) Object.assign(capsule, { radius: Number(args.radius), sources: { ...capsule.sources, radius: 'hand (--radius)' } });
  const cell = Number(args.cell) || 2;
  const fine = Number(args.fine) || 0.5;
  const { heightAt, bytes } = await groundOf(dir, pack);
  const loadBin = async (file) => {
    const b = await readFile(join(dir, file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  const bounds = { min: map.bounds.min, max: map.bounds.max };
  const t0 = Date.now();
  const mask = await navMaskOf({ pack, loadBin, heightAt, bounds, capsule, cell, fine });
  const ms = Date.now() - t0;
  mask.meta = { map: mapName, sources: capsule.sources, terrain: bytes, physics: Object.keys(pack.physics?.meshes ?? {}).length };
  const out = deflateSync(Buffer.from(encodeMask(mask)), { level: 9 });
  const plain = pathTable({ map: { ...map, bounds }, heightAt, cell });
  const masked = pathTable({ map: { ...map, bounds }, heightAt, cell, mask });
  console.log(`mask: ${mask.cols} × ${mask.rows} cells of ${cell} m, fine ${fine} m, capsule r ${capsule.radius} from ${capsule.step} to ${capsule.height} m; ${mask.stats.bodies} bodies (${mask.stats.refused} refused); ${ms} ms; ${out.length} bytes deflated`);
  console.log('');
  console.log('| nav source | solid cells | spawns not walkable | paths found, team 2 / team 1 | within the bots’ 20,000 cells | metres walked, team 2 / team 1 | nav build |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  console.log(line('ground only', plain));
  console.log(line(`ground and the capsule mask (r ${capsule.radius})`, masked));
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
