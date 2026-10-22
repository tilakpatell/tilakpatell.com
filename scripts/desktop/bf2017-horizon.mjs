// Lane W's `horizon` job, asked by the GPU-first design's lane N4 (its
// plan's task 1; docs/superpowers/evidence/gpu-first/n4/README.md): every
// surface pack's coarse horizon grid made at full quality on the owner's
// graphics chip and published. On the desktop, for each pack with a ground
// (a space level has none; an interior sees no horizon):
//
//   - node scripts/bf2017-horizon.mjs <pack> with ANGLE=d3d11 and the
//     desktop's Chrome, so the impostors' 16 × 16 views are drawn by the chip,
//     not SwiftShader: horizon/ beside the pack (its index.json, the cells'
//     GLBs, the atlases' rows) and level.json's `coarse` row
//   - node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/levels/*/horizon/*'
//     with the bucket's keys: the cells and atlases to site-assets by hash,
//     src/data/galaxyAssets.json naming them, .gitignore taking them out of git
//     (index.json stays committed, as a pack's JSON does)
//
//   node scripts/desktop/bf2017-horizon.mjs [--dry] [--only hoth] [--limit N] [--no-pr]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { horizonCells, impostorsOf } from '../lib/bf2017-horizon.mjs';
import { runCli, step } from './bf2017-desk.mjs';

export const LEVELS = 'public/models/galaxy/bf2017/levels';

// The surface packs in a checkout, districts included (`<world>/<district>`),
// each with its grid's plan from level.json alone (the arena's cells: the
// horizon's few instances are placed in the run, from horizon.bin)
export function packs(root) {
  const dir = join(root, LEVELS);
  if (!existsSync(dir)) return [];
  const out = [];
  const visit = (rel) => {
    const file = join(dir, rel, 'level.json');
    if (existsSync(file)) {
      const pack = JSON.parse(readFileSync(file, 'utf8'));
      if (pack.terrain && !pack.inside && pack.far?.draws?.length) {
        const imp = impostorsOf(pack);
        out.push({ name: rel, cells: Object.keys(horizonCells(pack, {}, { impostors: imp })).length, impostors: imp.length });
      }
    }
    for (const sub of readdirSync(join(dir, rel), { withFileTypes: true })) if (sub.isDirectory() && existsSync(join(dir, rel, sub.name, 'level.json'))) visit(join(rel, sub.name).split('\\').join('/'));
  };
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) if (e.isDirectory()) visit(e.name);
  return out;
}

// the bake's command: the pack, drawn on the chip through the desktop's Chrome
export const horizonArgs = (pack, d, env) => ({ argv: ['scripts/bf2017-horizon.mjs', pack], env: { ...env, ANGLE: 'd3d11', CHROMIUM: d.chrome } });

export const spec = {
  job: 'horizon',
  title: 'The coarse horizon grid at full quality',
  vram: 2048,
  columns: ['name', 'cells', 'impostors'],
  needs: (d) => [
    { name: 'Chrome (the impostors drawn on the chip)', file: d.chrome, fix: 'install Chrome, or set CHROME to its chrome.exe' },
    { name: "the bucket's keys", keys: true, fix: "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (R2's S3 keys) in the runner's .env (~\\actions-runner\\.env), then restart the runner" },
  ],
  async plan({ root }) {
    const items = packs(root);
    return {
      items,
      notes: [
        `${items.length} surface packs (${LEVELS}/*/level.json with a ground, not an interior), ${items.reduce((n, i) => n + i.cells, 0)} arena cells of 512 m, ${items.reduce((n, i) => n + i.impostors, 0)} impostor meshes`,
        'each baked by scripts/bf2017-horizon.mjs with ANGLE=d3d11, then the horizon/ files published by hash (scripts/assets-publish.mjs)',
      ],
    };
  },
  async run(items, { root, d, env, log }) {
    const rows = [];
    for (const item of items) {
      const { argv, env: e } = horizonArgs(item.name, d, env);
      try {
        step(process.execPath, argv, { cwd: root, env: e, log });
        const index = JSON.parse(readFileSync(join(root, LEVELS, item.name, 'horizon/index.json'), 'utf8'));
        rows.push({ name: item.name, cells: Object.keys(index.cells ?? {}).length, mb: ((index.bytes?.cells ?? 0) / 1e6).toFixed(2), lo: ((index.bytes?.lo ?? 0) / 1e6).toFixed(2), atlases: ((index.bytes?.atlases?.high ?? 0) / 1e6).toFixed(2) });
      } catch (err) {
        rows.push({ name: item.name, failed: String(err.message ?? err).slice(0, 200) });
      }
    }
    const made = rows.filter((r) => !r.failed);
    if (made.length) step(process.execPath, ['scripts/assets-publish.mjs', '--only', 'models/galaxy/bf2017/levels/*/horizon/*'], { cwd: root, env, log });
    const report = [
      `Baked ${made.length} of ${items.length} packs on the chip (ANGLE d3d11).`,
      '',
      '| pack | cells | proxies MB | .lo MB | atlases at 2,048 MB |',
      '| --- | --: | --: | --: | --: |',
      ...rows.map((r) => (r.failed ? `| ${r.name} | failed: ${r.failed} | | | |` : `| ${r.name} | ${r.cells} | ${r.mb} | ${r.lo} | ${r.atlases} |`)),
    ].join('\n');
    return { files: [LEVELS, 'src/data/galaxyAssets.json', '.gitignore'], report, failed: items.length > 0 && !made.length };
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await runCli(spec);
