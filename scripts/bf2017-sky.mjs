// A level's light probe from Star Wars Battlefront II (2017) (EA DICE's,
// used with permission on this non-commercial fan project), published for
// the owner's lighting lane (this pipeline builds no lighting: the owner's
// rule of 2026-10-10, 04:40): the six Radiance faces of one of the level's
// reflection volumes, fetched from the drop's bucket into lab/assets/bf2017/
// (git-ignored), brought to the site's light (scripts/lib/bf2017-sky.mjs)
// and written at the game's 128 and at 64, as
// public/textures/galaxy/sky/<name>-probe-<size>-<face>.hdr, with what each
// is in docs/superpowers/evidence/bf2017-<world>/skies.md.
//
//   node scripts/bf2017-sky.mjs <bucket folder> <probe id> --name hoth [--mean 0.8]
//
//   folder  web/textures/levels/mp/hoth_01/reflectionvolumetexture/cloudy_vfx
//   id      the probe's id, its faces <id>-tex_{px,nx,py,ny,pz,nz}.hdr (the
//           daytime one out on the level's main arena: look at them first)
//
// And a space level's star field, the game's own panorama (lane Q of the
// fifth design): its KTX2 as the bucket holds it, the top levels dropped for
// each quality level (4096 wide for ultra, 2048 for high, 1024 for mid;
// nothing re-encoded), as public/textures/galaxy/sky/space/<as>.<width>.ktx2,
// published (scripts/assets-publish.mjs walks the folder; the surface
// skies may take the same files) (galaxy/sky.js composites it under the
// galaxy it bakes: skyPanorama.js says which system has which).
//
//   node scripts/bf2017-sky.mjs --panorama t_space_endor01_c --as endor
//   node scripts/bf2017-sky.mjs --panorama t_space_no_large_stars_01_c --webp sb_fondor
//   (--webp <world>: the panorama as a level area's dome, galaxy/levelArea.js:
//   2048 wide, WebP, public/models/galaxy/bf2017/levels/<world>/sky.webp)
//   (t_space_01_c --as core; t_space_no_large_stars_01_c --as rim)
//
// And the galaxy map's system discs (globes.js, HoloMap.jsx): the front
// end's globes (lane K's PICTURES: a lit planet's picture, which no sphere
// can wear) each cut to 96 pixels square, and, for every world with a skin
// and no picture (lane S3: bespin, endor, kamino, naboo; E5's as their skins
// land in src/data/planetSkins.json), a globe rendered from the skin's
// colour map and clouds (scripts/lib/bf2017-sky.mjs's renderGlobe) at the
// same 96 (WebP, alpha kept), as public/models/galaxy/space/globes/
// <system>.webp, and src/data/galaxy/space/globes.json (`kind`: picture or
// skin). Then publish them by hash:
//   node scripts/assets-publish.mjs --only 'models/galaxy/space/globes/*'
//
//   node scripts/bf2017-sky.mjs --globes
//
// The keys: SUPABASE_URL and BF2017_KEY (or SUPA_KEY) from the environment,
// never printed; a face already on disk is not fetched again.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FloatType } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { parseArgs } from './lib/args.mjs';
import { bucketFile } from './lib/bf2017-bucket.mjs';
import { encodeRgbe, halve, normalise, renderGlobe } from './lib/bf2017-sky.mjs';
import { dropLevels, ktx2Info } from './lib/ktx2-levels.mjs';
import { PICTURES } from './lib/bf2017-planets.mjs';
import { unpackKtx2 } from './lib/bf2017-textures.mjs';
import { createRequire } from 'node:module';
import { writeCredit } from './lib/catalog-write.mjs';
import { PERMISSION } from './bf2017-import.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
// (the game's own 128, and half of it for a weak device)
const SIZES = [128, 64];

async function face(root, bucketPath) {
  const file = await bucketFile(root, bucketPath);
  const buf = await readFile(file);
  const l = new HDRLoader();
  l.setDataType(FloatType);
  const { data, width, height } = l.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  return { data, width, height };
}

export async function makeSky(folder, id, { name, mean = 0.8, root = join(ROOT, 'lab', 'assets', 'bf2017'), out = join(ROOT, 'public', 'textures', 'galaxy', 'sky') } = {}) {
  if (!/^[a-z0-9]+$/.test(name ?? '')) throw new Error('--name: the world, letters and digits (hoth)');
  const faces = normalise(await Promise.all(FACES.map((f) => face(root, `${folder}/${id}-tex_${f}.hdr`))), mean);
  await mkdir(out, { recursive: true });
  const written = [];
  let level = faces;
  for (const size of SIZES) {
    while (level[0].width > size) level = level.map(halve);
    for (const [i, f] of FACES.entries()) {
      const file = join(out, `${name}-probe-${size}-${f}.hdr`);
      await writeFile(file, encodeRgbe(level[i]));
      written.push(file);
    }
  }
  for (const f of written) console.log(relative(ROOT, f));
  return written;
}

// where the bucket keeps each panorama the space maps name (their extras'
// SkyComponentData: PanoramicTexture)
export const PANORAMAS = {
  t_space_endor01_c: 'web/textures/levels/space/sb_endor_01/planet/t_space_endor01_c.ktx2',
  t_space_01_c: 'web/textures/lighting/textures/space/t_space_01_c.ktx2',
  t_space_no_large_stars_01_c: 'web/textures/lighting/textures/space/t_space_no_large_stars_01_c.ktx2',
};
export const PANORAMA_WIDTHS = [4096, 2048, 1024];

export async function makePanorama(name, { as, root = join(ROOT, 'lab', 'assets', 'bf2017'), out = join(ROOT, 'public', 'textures', 'galaxy', 'sky', 'space') } = {}) {
  if (!PANORAMAS[name]) throw new Error(`${name}: not a panorama (${Object.keys(PANORAMAS).join(', ')})`);
  if (!/^[a-z0-9]+$/.test(as ?? '')) throw new Error('--as: what the site calls it, letters and digits (endor)');
  const bytes = new Uint8Array(await readFile(await bucketFile(root, PANORAMAS[name])));
  const { width } = ktx2Info(bytes);
  await mkdir(out, { recursive: true });
  const written = [];
  // (none wider than the game's own: the Outer Rim's is 2048)
  for (const want of PANORAMA_WIDTHS.filter((w) => w <= width)) {
    const drop = Math.round(Math.log2(width / want));
    const file = join(out, `${as}.${want}.ktx2`);
    await writeFile(file, dropLevels(bytes, drop));
    written.push(file);
  }
  for (const f of written) console.log(relative(ROOT, f));
  const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';
  await writeCredit(join(ROOT, 'src/data/modelCredits.json'), 'space-skies', {
    title: `Star Wars Battlefront II (2017): the space levels' star fields (${Object.keys(PANORAMAS).join(', ')})`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    where: 'galaxy',
    as: 'the star fields behind the systems’ skies',
    paths: ['public/textures/galaxy/sky/space/'],
    permission: PERMISSION,
  });
  return written;
}

// a panorama as a level area's sky dome (galaxy/levelArea.js reads a picture, not a KTX2)
export async function makePanoramaWebp(name, world, { root = join(ROOT, 'lab', 'assets', 'bf2017'), width = 2048 } = {}) {
  if (!PANORAMAS[name]) throw new Error(`${name}: not a panorama (${Object.keys(PANORAMAS).join(', ')})`);
  if (!/^[a-z0-9_]+$/.test(world ?? '')) throw new Error('--webp: the level pack, letters, digits and _ (sb_fondor)');
  const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
  const png = await unpackKtx2(await bucketFile(root, PANORAMAS[name]), join(root, 'unpacked', dirname(PANORAMAS[name])));
  const file = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', world, 'sky.webp');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, await sharp(await readFile(png)).resize({ width, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer());
  console.log(`${relative(ROOT, file)} ← ${name}`);
  return file;
}

// the system each globe is the disc of (the giant Endor and Yavin 4 circle
// is the system's parent, not its world: Yavin Prime's and the giant's
// pictures stay lane K's)
export const GLOBES = { geonosis: 'geonosis', hoth: 'hoth', kashyyyk: 'kashyyyk', scarif: 'scarif', tatooine: 'tatooine', yavin: 'yavin4' };
export const GLOBE_PX = 96; // (_source: the front end's globe pictures as lane K cut them, 96 px on the map's disc)
const GLOBE_OVER = 4; // (rendered at four times the size and brought down, so the limb is smooth)

// the worlds with a skin (src/data/planetSkins.json: a colour map on disk, the
// site's mid cut) and no picture: their globes are rendered from the skin
export async function skinnedGlobes({ skins, pictures = GLOBES, publicDir = join(ROOT, 'public') }) {
  const out = [];
  for (const [system, skin] of Object.entries(skins)) {
    if (!skin.color || pictures[system]) continue;
    out.push({ system, colour: join(publicDir, `${skin.color}-mid.webp`), clouds: skin.clouds ? join(publicDir, `${skin.clouds}-mid.webp`) : null, cloudCut: skin.cloudCut ?? 0.5, atmo: skin.atmo ?? null, from: skin.color });
  }
  return out;
}

const hexRgb = (hex) => (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : null);

export async function makeGlobes({ root = join(ROOT, 'lab', 'assets', 'bf2017'), out = join(ROOT, 'public', 'models', 'galaxy', 'space', 'globes'), data = join(ROOT, 'src', 'data', 'galaxy', 'space', 'globes.json'), skins = join(ROOT, 'src', 'data', 'planetSkins.json') } = {}) {
  const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
  await mkdir(out, { recursive: true });
  const index = {};
  // the skinned worlds first (no bucket needed: the skins are the site's own files)
  const raw = async (file) => {
    const { data: px, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(px.buffer, px.byteOffset, px.length), width: info.width, height: info.height };
  };
  for (const g of await skinnedGlobes({ skins: JSON.parse(await readFile(skins, 'utf8')) })) {
    const globe = renderGlobe({ colour: await raw(g.colour), clouds: g.clouds ? await raw(g.clouds) : null, cloudCut: g.cloudCut, atmo: hexRgb(g.atmo), size: GLOBE_PX, over: GLOBE_OVER });
    const webp = await sharp(Buffer.from(globe.data.buffer), { raw: { width: globe.width, height: globe.height, channels: 4 } })
      .resize(GLOBE_PX, GLOBE_PX, { kernel: 'lanczos3' })
      .webp({ quality: 88, alphaQuality: 90 })
      .toBuffer();
    const file = join(out, `${g.system}.webp`);
    await writeFile(file, webp);
    index[g.system] = { url: `/models/galaxy/space/globes/${g.system}.webp`, from: g.from, kind: 'skin' };
    console.log(`${relative(ROOT, file)} ${(webp.length / 1024).toFixed(1)} KB ← ${g.from} (rendered)`);
  }
  for (const [system, picture] of Object.entries(GLOBES)) {
    const name = PICTURES[picture];
    let png = null;
    try {
      png = await readFile(await bucketFile(root, `web/textures/${name}.png`));
    } catch {
      png = await readFile(await unpackKtx2(await bucketFile(root, `web/textures/${name}.ktx2`), join(root, 'unpacked', dirname(name))));
    }
    // (cut to the globe's own square, so its disc fills the dot)
    const img = sharp(png).trim({ threshold: 2 });
    const webp = await img.resize(GLOBE_PX, GLOBE_PX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88, alphaQuality: 90 }).toBuffer();
    const file = join(out, `${system}.webp`);
    await writeFile(file, webp);
    index[system] = { url: `/models/galaxy/space/globes/${system}.webp`, from: name, kind: 'picture' };
    console.log(`${relative(ROOT, file)} ${(webp.length / 1024).toFixed(1)} KB ← ${name}`);
  }
  await mkdir(dirname(data), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]));
  await writeFile(data, `${JSON.stringify(sorted, null, 1)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.globes) {
    await makeGlobes();
    process.exit(0);
  }
  if (args.panorama && args.webp) {
    await makePanoramaWebp(String(args.panorama), String(args.webp));
    process.exit(0);
  }
  if (args.panorama) {
    await makePanorama(String(args.panorama), { as: args.as ? String(args.as) : undefined });
    process.exit(0);
  }
  const [folder, id] = args._;
  if (!folder || !id) {
    console.error('usage: node scripts/bf2017-sky.mjs <bucket folder> <probe id> --name <world> [--mean 0.8]');
    process.exit(1);
  }
  makeSky(folder, id, { name: args.name, mean: args.mean ? Number(args.mean) : 0.8 }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
