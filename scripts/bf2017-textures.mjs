// The site's surface roles made from Star Wars Battlefront II (2017)'s own
// maps (EA DICE's, used with permission on this non-commercial fan
// project), for the Star Wars worlds: each role's source in
// scripts/lib/bf2017-roles.mjs fetched from the drop's bucket into
// lab/assets/bf2017/ (git-ignored), unpacked from KTX2 where that's what the
// bucket holds, and written as the roles' WebPs under
// public/textures/galaxy/bf2017/<role>/ the way scripts/galaxy-textures.mjs
// wrote the scans': the colour as a detail map (mostly grey, its brightness
// centred on the role's `mean`, so a part's own colour still says what it
// is), the normal map, and occlusion, roughness and metal packed as three
// reads them (R, G, B: glTF's ORM is that order). A role with no colour map
// in the drop (Hoth's snow) takes its grain from its occlusion. The index
// (public/textures/galaxy/bf2017/index.json) is lib/three/scans.js's for a
// world whose look says `scanned: 'bf2017'`.
//
//   node scripts/bf2017-textures.mjs [role …]      (every role by default)
//
// The keys: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (lib/bucket.mjs) from the environment.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bucketFile } from './lib/bf2017-bucket.mjs';
import { ROLE_SOURCES } from './lib/bf2017-roles.mjs';
import { unpackKtx2 } from './lib/bf2017-textures.mjs';

const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = join(ROOT, 'lab', 'assets', 'bf2017');
const OUT = join(ROOT, 'public', 'textures', 'galaxy', 'bf2017');
const SIZE = 1024;
const ARM = 512;

// a map from the bucket as a PNG on disk (a KTX2 unpacked once)
async function png(bucketPath) {
  const file = await bucketFile(LAB, bucketPath);
  if (!file.endsWith('.ktx2')) return file;
  const out = join(LAB, 'unpacked', `${bucketPath.split('/').pop().replace(/\.ktx2$/, '')}.png`);
  return existsSync(out) ? out : unpackKtx2(file, join(LAB, 'unpacked'));
}

// a picture's luma as a detail map: grey, `keep` of its colour, centred on `mean`
// (a trim sheet's tiling part: `crop`, [x0, y0, x1, y1] of the map)
async function cropped(file, crop) {
  const img = sharp(file, { limitInputPixels: false });
  if (!crop) return img;
  const { width, height } = await img.metadata();
  const [x0, y0, x1, y1] = crop;
  return sharp(file, { limitInputPixels: false }).extract({ left: Math.round(x0 * width), top: Math.round(y0 * height), width: Math.round((x1 - x0) * width), height: Math.round((y1 - y0) * height) });
}

async function detail(file, { keep, mean, channel = null, crop = null }) {
  let img = (await cropped(file, crop)).resize(SIZE, SIZE, { fit: 'fill' });
  if (channel != null) img = img.extractChannel(channel).toColourspace('srgb');
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const n = info.width * info.height;
  const at = (i, c) => data[i * ch + Math.min(c, ch - 1)];
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 0.2126 * at(i, 0) + 0.7152 * at(i, 1) + 0.0722 * at(i, 2);
  const scale = (mean * 255) / Math.max(1, sum / n);
  const out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const rgb = [at(i, 0), at(i, 1), at(i, 2)];
    const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.max(0, Math.min(255, Math.round((y + (rgb[c] - y) * keep) * scale)));
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } });
}

async function role(name, src) {
  const dir = join(OUT, name);
  await mkdir(dir, { recursive: true });
  const orm = src.orm ? await png(src.orm) : null;
  const color = src.color ? await detail(await png(src.color), src) : await detail(orm, { ...src, channel: 0 });
  await color.webp({ quality: 82, effort: 6 }).toFile(join(dir, 'color.webp'));
  const normal = src.normal ? (await cropped(await png(src.normal), src.crop)).resize(SIZE, SIZE, { fit: 'fill' }).removeAlpha() : sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 128, g: 128, b: 255 } } });
  await normal.webp({ quality: 82, effort: 6 }).toFile(join(dir, 'normal.webp'));
  if (orm) await (await cropped(orm, src.crop)).resize(ARM, ARM, { fit: 'fill' }).removeAlpha().webp({ quality: 80, effort: 6 }).toFile(join(dir, 'arm.webp'));
  const from = src.color ?? src.orm;
  return { source: 'Star Wars Battlefront II (2017)', id: from.split('/').pop().replace(/\.(png|ktx2)$/, ''), from, authors: ['EA DICE'], license: 'permission', metres: src.metres, mean: src.mean, arm: Boolean(orm) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2);
  const indexFile = join(OUT, 'index.json');
  const index = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : {};
  let failed = 0;
  for (const [name, src] of Object.entries(ROLE_SOURCES)) {
    if (only.length && !only.includes(name)) continue;
    try {
      index[name] = await role(name, src);
      console.log(`${name.padEnd(11)} ${index[name].id}  ${src.metres} m${index[name].arm ? '' : ' (no arm map)'}`);
    } catch (e) {
      failed++;
      console.log(`${name.padEnd(11)} not made: ${e.message}`);
    }
  }
  const sorted = Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]));
  await writeFile(indexFile, `${JSON.stringify(sorted, null, 2)}\n`);
  process.exit(failed ? 1 : 0);
}
