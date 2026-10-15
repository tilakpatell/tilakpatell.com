// The line of fire's fixture, src/lib/battlefront/fixtures/hothGround.json:
// the page's navgrid over a rectangle of a map, and what a ray cast on the
// game's own shapes says for seeded pairs of standing places there
// (scripts/lib/bf2017-nav-fixture.mjs has the how). Made again when the
// pack's heightmaps, its shapes or its nav.bin change.
//
//   node scripts/bf2017-nav-fixture.mjs <pack dir> [--map hoth] [--area -20,-1436,284,-1110]
//     [--seed 2017] [--pairs 1000] [--out src/lib/battlefront/fixtures/hothGround.json] [--dry]
//
//   pack dir  a level pack whole: level.json, terrain/*.png, nav.bin, physics/*.bin, cells/*.bin
//   area      x0,z0,x1,z1 in the export's frame; the default is Hoth's five command posts and the ground between them
//   dry       measure, write nothing
//
// The site's modules are loaded through Vite, as scripts/x2-profile.mjs loads
// them: the physics engine's packages have no entry plain Node can import.

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { parseArgs } from './lib/args.mjs';
import { groundFixture } from './lib/bf2017-nav-fixture.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [dir] = args._;
  if (!dir) {
    console.error('usage: node scripts/bf2017-nav-fixture.mjs <pack dir> [--map hoth] [--area x0,z0,x1,z1] [--seed 2017] [--pairs 1000] [--out file] [--dry]');
    process.exit(1);
  }
  const area = (typeof args.area === 'string' ? args.area : '-20,-1436,284,-1110').split(',').map(Number);
  const pairs = { seed: Number(args.seed) || 2017, count: Number(args.pairs) || 1000, near: 10, far: 60 };
  const out = resolve(ROOT, typeof args.out === 'string' ? args.out : 'src/lib/battlefront/fixtures/hothGround.json');
  const vite = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { json, stats } = await groundFixture({ load: (p) => vite.ssrLoadModule(p), dir: resolve(dir), map: typeof args.map === 'string' ? args.map : 'hoth', area, pairs });
    console.log(`${stats.cols} × ${stats.rows} cells; ${stats.pairs} pairs, ${stats.clear} clear on the pack's ${stats.bodies} shapes and its heightmap; ${stats.bytes} bytes deflated`);
    if (args.dry) return;
    await writeFile(out, `${JSON.stringify(json)}\n`);
    console.log(`wrote ${out}`);
  } finally {
    await vite.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
