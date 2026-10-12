// The 2017 drop's textures, turned into what glTF and the site read. The
// bucket holds a KTX2 for each map a GLB names (and perhaps, later, the raw
// PNGs DICE's maps came as). A KTX2 is unpacked to PNG so the import can
// resize and re-encode it to WebP like every other surface map. From raw
// PNGs, the uploader's derived maps are rebuilt by the manifest's `derived`
// recipe: DICE packs a normal's x and y with occlusion and metal in one map,
// and smoothness in the colour map's alpha, where glTF wants a normal map
// and one occlusion-roughness-metal map.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { basisuPath } from '../ktx2.mjs';
import { localPath, mapPath } from './bf2017-paths.mjs';

// (the sharp glTF-Transform's ndarray-pixels loads: see battlefront-import.mjs)
const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const run = promisify(execFile);
export const sharpOf = () => sharp;

// basisu writes every level in every GPU format; the closest to the source
// is the uncompressed one where it writes it, else ASTC, else BC7 (both near
// lossless from UASTC)
const BEST = ['RGBA32', 'ASTC_RGBA', 'ASTC_LDR_4X4_RGBA', 'BC7_RGBA'];

export async function unpackKtx2(file, outDir, { basisu = basisuPath() } = {}) {
  await mkdir(outDir, { recursive: true });
  const work = await mkdtemp(join(outDir, '.unpack-'));
  try {
    try {
      await run(basisu, ['-unpack', '-no_ktx', '-file', resolve(file)], { cwd: work, maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      const last = String(e.stderr || e.stdout || e.message).trim().split('\n').pop();
      throw new Error(`basisu could not unpack ${file}: ${last}`);
    }
    const files = await readdir(work);
    const level0 = (fmt) => files.find((f) => f.toUpperCase().endsWith(`_UNPACKED_RGBA_${fmt}_0_0000.PNG`));
    const pick = BEST.map(level0).find(Boolean) ?? files.find((f) => /_unpacked_rgba_.*_0_0000\.png$/i.test(f));
    if (!pick) throw new Error(`basisu wrote no RGBA level 0 for ${file}`);
    const out = join(outDir, `${basename(file).replace(/\.ktx2$/i, '')}.png`);
    // (always RGBA: basisu drops the alpha of an opaque map, and the recipe may read it)
    await sharp(join(work, pick)).ensureAlpha().png().toFile(out);
    return out;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// `normal:<map>` and `orm:<map>:ao=<map>|<ch>;rough=<map>|<ch>;metal=<map>|<ch>[;rebuild]`
// (`rebuild`: a recipe the site mended, weaponRecipes; the map is built from
// it even where the uploader's own PNG of the derived map is on disk)
export function parseDerived(derived = []) {
  const out = { normal: [], orm: [] };
  for (const d of derived ?? []) {
    const [kind, ...rest] = d.split(':');
    if (kind === 'normal') out.normal.push(rest.join(':'));
    else if (kind === 'orm') {
      const [from, recipe = ''] = [rest[0], rest.slice(1).join(':')];
      const parts = Object.fromEntries(
        recipe
          .split(';')
          .filter(Boolean)
          .map((p) => {
            const [key, val = ''] = p.split('=');
            const [map, ch] = val.split('|');
            return [key, map ? { map, ch } : null];
          }),
      );
      out.orm.push({ from, ao: parts.ao ?? null, rough: parts.rough ?? null, metal: parts.metal ?? null, rebuild: 'rebuild' in parts });
    }
  }
  return out;
}

// The Walrus weapon presets (SS_WeaponsPreset, _Alpha, _TransparentDepth)
// bind three maps: _BaseColor (`_CS`: colour, smoothness in alpha), _Normal
// (`_NAM`: x and y, a wear mask in blue, 255 in alpha) and _Mask (`_RGB`:
// the metal mask in green, red and blue empty). The uploader's ORM recipe
// reads a weapon's metal from the NAM's blue, which is the wear mask (near
// black on all eight class weapons: docs/superpowers/evidence/
// bf2017-guns-2026-10-12.md), so every blaster came in as dark plastic.
// This adds a mended recipe after the uploader's, from the GLB's own
// materials (the export writes the shader and its bound maps in each
// material's extras): the metal from the _Mask's green, marked `rebuild` so
// it is built rather than read from the uploader's PNG; resolveImage takes
// it when its maps are on disk and falls back to the uploader's when the
// mask is not (a fixture, a half-fetched folder). A model on another shader
// is left as it is.
//   weaponRecipes(derived, materials) → derived, a mended ORM line after each weapon's
const WEAPON_PRESET = /SS_Weapons?Preset/i;
const frostbiteName = (file) =>
  String(file)
    .replace(/^(web\/)?textures\//, '')
    .replace(/\.(png|ktx2)$/, '');
export function weaponRecipes(derived = [], materials = []) {
  const masks = new Map(); // the normal map's name (lower case) → its mask's
  for (const m of materials) {
    const x = m?.extras ?? {};
    if (!WEAPON_PRESET.test(String(x.shader ?? '')) || !x.textures?._Mask || !x.textures?._Normal) continue;
    masks.set(frostbiteName(x.textures._Normal).toLowerCase(), frostbiteName(x.textures._Mask));
  }
  if (!masks.size) return derived;
  const mended = derived.filter((d) => /;rebuild$/.test(d)).map((d) => d.split(':')[1].toLowerCase());
  return derived.flatMap((d) => {
    const [kind, from, recipe = ''] = d.split(':');
    const mask = kind === 'orm' && !mended.includes(String(from).toLowerCase()) ? masks.get(String(from).toLowerCase()) : null;
    if (!mask || /;rebuild$/.test(d)) return [d];
    const kept = recipe.split(';').filter((p) => p && !/^metal=/.test(p));
    return [d, `orm:${from}:${[...kept, `metal=${mask}|g`, 'rebuild'].join(';')}`];
  });
}

const CH = { r: 0, g: 1, b: 2, a: 3 };

// The ORM map by a recipe: R occlusion (255 without one), G roughness =
// 255 − the channel named (DICE stores smoothness; 128 without one), B metal
// (0 without one), at the size of the first map read.
export async function ormPng(recipe, readPng) {
  const cache = new Map();
  let size = null;
  const read = async (map) => {
    if (!cache.has(map)) {
      let img = sharp(await readPng(map)).ensureAlpha();
      if (size) img = img.resize(size.width, size.height, { fit: 'fill' });
      const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
      size ??= { width: info.width, height: info.height };
      cache.set(map, data);
    }
    return cache.get(map);
  };
  const chans = {};
  for (const key of ['ao', 'rough', 'metal']) if (recipe[key]) chans[key] = { data: await read(recipe[key].map), c: CH[recipe[key].ch] };
  if (!size) throw new Error('an ORM recipe with no map');
  const n = size.width * size.height;
  const out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = chans.ao ? chans.ao.data[i * 4 + chans.ao.c] : 255;
    out[i * 3 + 1] = chans.rough ? 255 - chans.rough.data[i * 4 + chans.rough.c] : 128;
    out[i * 3 + 2] = chans.metal ? chans.metal.data[i * 4 + chans.metal.c] : 0;
  }
  return sharp(out, { raw: { width: size.width, height: size.height, channels: 3 } }).png().toBuffer();
}

// A normal map from DICE's packed one: x and y kept, z rebuilt from them
// (B and A carry occlusion or metal in the drop), opaque.
export async function normalPng(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const x = data[i] / 127.5 - 1;
    const y = data[i + 1] / 127.5 - 1;
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    data[i + 2] = Math.round((z + 1) * 127.5);
    data[i + 3] = 255;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// One image a GLB names (a bucket path to a KTX2), as a PNG from what is on
// disk under `root`, best first: an ORM a mended recipe says to rebuild
// (weaponRecipes), from its source PNGs; a PNG of the map itself; for a
// derived map (`__normal`, `__orm_<hash>`), its source PNG split by the
// recipe; the KTX2 unpacked into `unpackDir`. Null when none is there (the
// upload is still running): the material then goes without that map.
export async function resolveImage(bucketPath, { root, derived, unpackDir }) {
  const own = bucketPath.replace(/\.ktx2$/, '.png');
  const onDisk = (p) => existsSync(localPath(root, p));
  const read = (p) => readFile(localPath(root, p));
  // (a derived map by its stem: the bucket's GLBs name it as KTX2, the
  // export's on disk as the uploader's PNG; its source is the map's own PNG)
  const stem = bucketPath.replace(/\.(ktx2|png)$/, '');
  const kind = /__normal$/.test(stem) ? 'normal' : /__orm_[0-9a-f]+$/.test(stem) ? 'orm' : null;
  const source = kind ? `${stem.replace(/__(normal|orm_[0-9a-f]+)$/, '')}.png` : own;
  // (the map's recipes: a mended one first where its maps are on disk, else
  // one whose maps are, else the first, for the message)
  const mapsOf = (r) => [r.ao, r.rough, r.metal].filter(Boolean).map((c) => mapPath(c.map));
  const recipes = kind === 'orm' ? parseDerived(derived).orm.filter((r) => mapPath(r.from) === source) : [];
  const recipe = recipes.find((r) => r.rebuild && mapsOf(r).every(onDisk)) ?? recipes.find((r) => mapsOf(r).every(onDisk)) ?? recipes[0] ?? null;
  const maps = recipe ? mapsOf(recipe) : [];
  const orm = async () => ({ png: await ormPng(recipe, (map) => read(mapPath(map))), from: `${[...new Set(maps)].map((m) => basename(m)).join(' + ')} (orm${recipe.rebuild ? ', rebuilt' : ''})` });
  if (recipe?.rebuild && maps.every(onDisk)) return orm();
  if (onDisk(own)) return { png: await read(own), from: basename(own) };
  if (kind && source !== own && onDisk(source)) {
    if (kind === 'normal') return { png: await normalPng(await read(source)), from: `${basename(source)} (normal)` };
    if (recipe && maps.every(onDisk)) return orm();
  }
  if (bucketPath.endsWith('.ktx2') && onDisk(bucketPath)) {
    // (unpacked once: each cut of a model, and every model sharing a map, reads the same PNG)
    const ktx2 = localPath(root, bucketPath);
    const done = join(unpackDir, dirname(bucketPath), basename(bucketPath).replace(/\.ktx2$/, '.png'));
    const fresh = existsSync(done) && (await stat(done)).mtimeMs >= (await stat(ktx2)).mtimeMs;
    const out = fresh ? done : await unpackKtx2(ktx2, dirname(done));
    return { png: await readFile(out), from: `${basename(bucketPath)} (unpacked)` };
  }
  return null;
}

// A mesh variation database binds a material's maps by the shader's
// parameter names (lane colour, task 6): which glTF slot each fills. The
// packed maps (`_RGB`, `Mask`, `RSSSAO`, `MSR`, `RM`) are the roughness,
// metal and occlusion the pipeline derives (parseDerived); `F90ColorTexture`
// (the Fresnel colour) is noted and not bound, as is any name not here.
//   slotOfParameter(name) → 'color' | 'normal' | 'packed' | 'emissive' | null
const SLOT_OF = [
  ['color', /^_?(Colou?r|CS|CA|CW|C|Base[Cc]olou?r)$/],
  ['normal', /^_?(NS|NAM|NA|N|NM|NW|Normals?)(_texcoord\d)?$/],
  ['packed', /^_?(RGB|Mask|RSSSAO|MSR|MSW|RM|RGBM)$/],
  ['emissive', /^_?(Emissive|EM|E)$/],
];
export function slotOfParameter(name) {
  return SLOT_OF.find(([, re]) => re.test(String(name ?? '')))?.[0] ?? null;
}
