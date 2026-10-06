// The surfaces the galaxy's worlds build their own buildings and props from
// (galaxy/surface/kit.js: adobe, dressed stone, bare and painted metal, bark,
// planks, concrete), as photo-scanned CC0 materials from Poly Haven: each one
// a colour map made into a detail map (most of its colour taken out and its
// brightness centred, so the part's own colour, kept in its vertices, still
// says what it is: a white Imperial bunker, an orange adobe dome, and the
// texture only adds the grain, the seams, the stains), its OpenGL normal map,
// and its ambient occlusion, roughness and metalness packed into one map (R,
// G, B). How big the scan is in the world (Poly Haven's own dimensions) goes
// into public/cc0/galaxy/index.json, so a wall's bricks come out brick-sized.
//
//   NODE_USE_ENV_PROXY=1 node scripts/galaxy-textures.mjs [role …]
//
// Every source is CC0 (https://polyhaven.com/license); public/cc0/README.md
// lists them anyway. The output is committed: the site never calls Poly
// Haven at runtime.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'cc0', 'galaxy');

// kit role → Poly Haven id, how much of its colour to keep (0 grey … 1 all),
// and the brightness its detail map is centred on (sRGB, 0…1)
export const ROLES = {
  adobe: { id: 'patterned_clay_plaster', keep: 0.25, mean: 0.82 },
  stone: { id: 'large_sandstone_blocks_01', keep: 0.2, mean: 0.8 },
  metal: { id: 'metal_plate_02', keep: 0.1, mean: 0.78 },
  paint: { id: 'blue_metal_plate', keep: 0, mean: 0.86 },
  bark: { id: 'bark_brown_02', keep: 0.3, mean: 0.78 },
  wood: { id: 'weathered_planks', keep: 0.3, mean: 0.8 },
  concrete: { id: 'concrete_wall_008', keep: 0.1, mean: 0.84 },
  rock: { id: 'rock_face', keep: 0.25, mean: 0.8 },
};

const get = async (url, as = 'json') => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return as === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
};

// the colour map as a detail map: mostly grey, its mean brightness `mean`
async function detail(buffer, size, { keep, mean }) {
  const { data, info } = await sharp(buffer).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
  const scale = (mean * 255) / (sum / n);
  const out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.max(0, Math.min(255, Math.round((y + ([r, g, b][c] - y) * keep) * scale)));
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } });
}

async function role(name, spec) {
  const [files, info] = await Promise.all([get(`https://api.polyhaven.com/files/${spec.id}`), get(`https://api.polyhaven.com/info/${spec.id}`)]);
  const url = (k) => files[k]?.['1k']?.jpg?.url ?? files[k]?.['1k']?.png?.url;
  const [color, normal, arm] = await Promise.all(['Diffuse', 'nor_gl', 'arm'].map((k) => (url(k) ? get(url(k), 'buffer') : null)));
  if (!color || !normal) throw new Error(`${spec.id}: no 1K colour or normal map`);
  const dir = join(OUT, name);
  await mkdir(dir, { recursive: true });
  await (await detail(color, 1024, spec)).webp({ quality: 82, effort: 6 }).toFile(join(dir, 'color.webp'));
  await sharp(normal).resize(1024, 1024, { fit: 'fill' }).webp({ quality: 82, effort: 6 }).toFile(join(dir, 'normal.webp'));
  if (arm) await sharp(arm).resize(512, 512, { fit: 'fill' }).webp({ quality: 80, effort: 6 }).toFile(join(dir, 'arm.webp'));
  // (Poly Haven's dimensions are in millimetres, the scan's width first)
  const metres = (info.dimensions?.[0] ?? 2000) / 1000;
  return { source: `https://polyhaven.com/a/${spec.id}`, id: spec.id, name: info.name, authors: Object.keys(info.authors ?? {}), license: 'CC0 1.0', metres, arm: Boolean(arm) };
}

async function main() {
  const only = process.argv.slice(2);
  const indexFile = join(OUT, 'index.json');
  const index = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : {};
  for (const [name, spec] of Object.entries(ROLES)) {
    if (only.length && !only.includes(name)) continue;
    index[name] = await role(name, spec);
    console.log(`${name.padEnd(9)} ${spec.id.padEnd(28)} ${index[name].metres} m${index[name].arm ? '' : ' (no arm map)'}`);
  }
  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
