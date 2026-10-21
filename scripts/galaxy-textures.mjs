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
//   NODE_USE_ENV_PROXY=1 node --max-old-space-size=8192 scripts/galaxy-textures.mjs --ultra [role …]
//
// --ultra makes the 8192 set worn at ultra only (lib/three/core's
// coreFiles: `color-xl` and `normal-xl` beside the 1K files, the index's
// `xl` saying which kind), from Poly Haven's 8K maps (4K where there's no
// 8K, scaled up). Each map goes out as KTX2 (UASTC, flipped for three's
// UVs: it stays compressed on the graphics chip, 85 MB where an 8192 WebP
// decodes to 256 MB) where scripts/ktx2.mjs's verdict says it's worth it,
// a WebP where it isn't; a normal map is always KTX2 (lossy WebP wrecks
// normals). A KTX2 over XL_MAX is encoded harder until it fits. The set is
// too big to keep in the repository (tens of MB a role): it's made on the
// owner's machine and published with the site (public/ is what's deployed),
// and until it's made, ultra wears the 1K set. A role that Poly Haven
// doesn't have (an id that's moved) is skipped with a line saying so.
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
// (the castle's own go in a folder of their own: CASTLE_ROLES, below)
const CASTLE_OUT = join(ROOT, 'public', 'cc0', 'castle');

// kit role → Poly Haven id, how much of its colour to keep (0 grey … 1 all),
// and the brightness its detail map is centred on (sRGB, 0…1)
export const ROLES = {
  adobe: { id: 'patterned_clay_plaster', keep: 0.1, mean: 0.82 }, // (little of its own warmth: a pale wall stays pale)
  stone: { id: 'large_sandstone_blocks_01', keep: 0.2, mean: 0.8 },
  metal: { id: 'metal_plate_02', keep: 0.1, mean: 0.78 },
  paint: { id: 'blue_metal_plate', keep: 0, mean: 0.86 },
  bark: { id: 'bark_brown_02', keep: 0.3, mean: 0.78 },
  wood: { id: 'weathered_planks', keep: 0.3, mean: 0.8 },
  concrete: { id: 'concrete_wall_008', keep: 0.1, mean: 0.84 },
  rock: { id: 'rock_face', keep: 0.25, mean: 0.8 },
  // the grounds underfoot (ground.js lays one over a world's land up close,
  // by its site's `ground.detail`): sand, snow, grass, a pine floor, leaf
  // litter, swamp mud, burnt ash, red soil, grey gravel, a beach
  sand: { id: 'aerial_sand', keep: 0.15, mean: 0.82 },
  snow: { id: 'snow_02', keep: 0.05, mean: 0.9 },
  grass: { id: 'grass_ground', keep: 0.2, mean: 0.78 },
  needles: { id: 'forrest_ground_03', keep: 0.2, mean: 0.76 },
  leaves: { id: 'forest_floor', keep: 0.2, mean: 0.76 },
  mud: { id: 'brown_mud_leaves_01', keep: 0.2, mean: 0.74 },
  ash: { id: 'burned_ground_01', keep: 0.1, mean: 0.76 },
  redsoil: { id: 'red_laterite_soil_stones', keep: 0.2, mean: 0.78 },
  gravel: { id: 'ground_grey', keep: 0.1, mean: 0.8 },
  beach: { id: 'coast_sand_01', keep: 0.15, mean: 0.84 },
  // the bases' floors (Phase 2): Theed's polished plaza and hangar, and the
  // tread plate of Echo Base's grates and Tipoca's deck
  tiles: { id: 'large_floor_tiles_02', keep: 0.15, mean: 0.84 },
  deck: { id: 'metal_plate', keep: 0.05, mean: 0.8 },
  // the worlds' own rock, where grey rock face reads wrong: Geonosis's red,
  // eroded stone (its spires, hives and arena) and Endor's mossy boulders
  // (the bunker's mound, the forest's rocks and logs)
  redrock: { id: 'rock_boulder_cracked', keep: 0.3, mean: 0.78 },
  mossrock: { id: 'mossy_rock', keep: 0.35, mean: 0.72 },
  // more grounds for the layered ground at ultra (galaxy/surface/splat.js
  // takes the first of each layer's list that's been made): a desert's dry
  // crust and its stony flats, rock seen from above, a snowfield, a forest's
  // mossy floor, swamp mud, a city's paving
  dryground: { id: 'dry_ground_01', keep: 0.2, mean: 0.8 },
  stones: { id: 'rocky_terrain_02', keep: 0.2, mean: 0.78 },
  aerialrock: { id: 'aerial_rocks_02', keep: 0.2, mean: 0.78 },
  snowfield: { id: 'snow_field_aerial', keep: 0.05, mean: 0.9 },
  moss: { id: 'forrest_ground_01', keep: 0.3, mean: 0.74 },
  swampmud: { id: 'brown_mud_02', keep: 0.25, mean: 0.72 },
  paving: { id: 'concrete_floor_02', keep: 0.1, mean: 0.82 },
};

// Hogwarts’ castle’s own (hogwarts/world/castle/materials.js): its walls’
// dressed blocks, the rough stacked stone of its plinths, piers and the
// Owlery, and the dark Highland slate of its roofs and cones. Made the same
// way into a folder and an index of their own (public/cc0/castle/), kept
// out of ROLES and the galaxy's set: those are the surfaces the galaxy’s
// worlds are dressed by, each swapped for a source in the game’s own maps
// on a Star Wars world (lib/bf2017-roles.mjs, lib/three/scans.js), and no
// Star Wars world wears a Scottish castle’s stone.
export const CASTLE_ROLES = {
  ashlar: { id: 'stone_brick_wall_001', keep: 0.15, mean: 0.78 },
  rubble: { id: 'castle_wall_slates', keep: 0.2, mean: 0.76 },
  slate: { id: 'roof_slates_03', keep: 0.1, mean: 0.74 },
};

const get = async (url, as = 'json') => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return as === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
};

// the colour map as a detail map: mostly grey, its mean brightness `mean`
async function detail(buffer, size, { keep, mean }) {
  const { data, info } = await sharp(buffer, { limitInputPixels: false }).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
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
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 }, limitInputPixels: false });
}

// the 8192 set (--ultra): a map to KTX2 where it's worth it, else WebP;
// returns the kind written
const XL = 8192;
const XL_MAX = 48 * 1024 * 1024;
async function xlMap(img, dir, file, role) {
  const { encodeImage, gpuBytes, verdict } = await import('./ktx2.mjs');
  const png = await img.png().toBuffer();
  const webp = await sharp(png, { limitInputPixels: false }).webp({ quality: 84, effort: 4 }).toBuffer();
  let ktx2 = null;
  for (const rdo of [1, 3, 6]) {
    ({ ktx2 } = await encodeImage(png, { role, rdo, level: 1, flipY: true })); // (level 1: level 2 takes over 20 minutes a map at 8192)
    if (ktx2.byteLength <= XL_MAX) break;
  }
  const say = verdict({ role, mime: 'image/webp', before: webp.byteLength, after: ktx2.byteLength, gpuBefore: gpuBytes(XL, XL, 'rgba'), gpuAfter: gpuBytes(XL, XL, 'uastc'), width: XL });
  const kind = role === 'normal' || say !== 'keep' ? 'ktx2' : 'webp';
  await writeFile(join(dir, `${file}-xl.${kind}`), kind === 'ktx2' ? ktx2 : webp);
  console.log(`  ${file}-xl.${kind}  ${(Math.max(1, kind === 'ktx2' ? ktx2.byteLength : webp.byteLength) / 1048576).toFixed(1)} MB (${say})`);
  return kind;
}

async function roleXl(name, spec, out = OUT) {
  const files = await get(`https://api.polyhaven.com/files/${spec.id}`);
  const url = (k) => (files[k]?.['8k'] ?? files[k]?.['4k'])?.png?.url ?? (files[k]?.['8k'] ?? files[k]?.['4k'])?.jpg?.url;
  const [color, normal] = await Promise.all(['Diffuse', 'nor_gl'].map((k) => (url(k) ? get(url(k), 'buffer') : null)));
  if (!color || !normal) throw new Error(`${spec.id}: no 8K or 4K colour or normal map`);
  const dir = join(out, name);
  await mkdir(dir, { recursive: true });
  const kind = await xlMap((await detail(color, XL, spec)), dir, 'color', 'color');
  await xlMap(sharp(normal, { limitInputPixels: false }).resize(XL, XL, { fit: 'fill' }), dir, 'normal', 'normal');
  return kind;
}

async function role(name, spec, out = OUT) {
  const [files, info] = await Promise.all([get(`https://api.polyhaven.com/files/${spec.id}`), get(`https://api.polyhaven.com/info/${spec.id}`)]);
  const url = (k) => files[k]?.['1k']?.jpg?.url ?? files[k]?.['1k']?.png?.url;
  const [color, normal, arm] = await Promise.all(['Diffuse', 'nor_gl', 'arm'].map((k) => (url(k) ? get(url(k), 'buffer') : null)));
  if (!color || !normal) throw new Error(`${spec.id}: no 1K colour or normal map`);
  const dir = join(out, name);
  await mkdir(dir, { recursive: true });
  await (await detail(color, 1024, spec)).webp({ quality: 82, effort: 6 }).toFile(join(dir, 'color.webp'));
  await sharp(normal).resize(1024, 1024, { fit: 'fill' }).webp({ quality: 82, effort: 6 }).toFile(join(dir, 'normal.webp'));
  if (arm) await sharp(arm).resize(512, 512, { fit: 'fill' }).webp({ quality: 80, effort: 6 }).toFile(join(dir, 'arm.webp'));
  // (Poly Haven's dimensions are in millimetres, the scan's width first)
  const metres = (info.dimensions?.[0] ?? 2000) / 1000;
  return { source: `https://polyhaven.com/a/${spec.id}`, id: spec.id, name: info.name, authors: Object.keys(info.authors ?? {}), license: 'CC0 1.0', metres, mean: spec.mean, arm: Boolean(arm) };
}

async function main() {
  const args = process.argv.slice(2);
  const ultra = args.includes('--ultra');
  const only = args.filter((a) => !a.startsWith('--'));
  // (each set into its own folder and index: the galaxy's surfaces, and the castle's own)
  for (const [roles, out] of [[ROLES, OUT], [CASTLE_ROLES, CASTLE_OUT]]) {
    const indexFile = join(out, 'index.json');
    const index = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : {};
    for (const [name, spec] of Object.entries(roles)) {
      if (only.length && !only.includes(name)) continue;
      try {
        if (ultra) {
          // (the 8192 set beside a 1K set: the 1K set first, where there's none)
          if (!index[name]) index[name] = await role(name, spec, out);
          index[name].xl = await roleXl(name, spec, out);
        } else index[name] = { ...(await role(name, spec, out)), ...(index[name]?.xl ? { xl: index[name].xl } : {}) };
        console.log(`${name.padEnd(10)} ${spec.id.padEnd(28)} ${index[name].metres} m${index[name].arm ? '' : ' (no arm map)'}${index[name].xl ? ` · 8192 ${index[name].xl}` : ''}`);
      } catch (e) {
        console.log(`${name.padEnd(10)} ${spec.id.padEnd(28)} skipped: ${e.message}`);
      }
      // (written as it goes: an 8192 run is long, and one stopped keeps what it made)
      await mkdir(out, { recursive: true });
      await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
