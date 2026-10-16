// Fetches the CC0 assets the 3D games use and saves them, ready for the web,
// under public/games/. Only scanned, physically based sources: Poly Haven
// (textures and models) and ambientCG (facades). Every asset here is CC0
// (https://polyhaven.com/license, https://docs.ambientcg.com/license/), so no
// credit is required; credits.json keeps one anyway.
//
//   tex/<name>/color.webp     base colour (sRGB)
//   tex/<name>/normal.webp    OpenGL normal map
//   tex/<name>/arm.webp       ambient occlusion (R), roughness (G), metalness (B)
//   tex/<name>/emission.webp  lit windows, where the source has them
//   models/<name>.glb         simplified, meshopt-compressed, WebP textures
//   hdri/<name>.hdr           environment light, 512 × 256 Radiance HDR
//   sky/<name>.webp           the sky you see: the upper half of a 2K pure-sky
//                             HDRI, range-compressed into 8 bits (x / (1 + x),
//                             then gamma 2.2; the game undoes both)
//
// Run with `npm run cc0` (add `-- name …` to fetch only those). Behind a
// proxy, set NODE_USE_ENV_PROXY=1 so Node's fetch uses it. The output is
// committed, so the site never needs these services at runtime.

import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games');

// Poly Haven textures: name in the game → id
export const TEXTURES = {
  'asphalt-desert': 'asphalt_02',
  'asphalt-city': 'asphalt_track',
  'plate-road': 'metal_plate_02',
  'desert-ground': 'dry_ground_rocks',
  'desert-sand': 'gravelly_sand',
  'mesa-rock': 'cliff_side',
  sidewalk: 'concrete_pavement',
  'plate-deck': 'metal_plate',
  concrete: 'concrete_floor_worn_001',
  armour: 'blue_metal_plate',
  // the music planet's courtyard: its paving, its parapet, the dunes beyond
  'music-terrace': 'red_sandstone_pavement',
  'music-wall': 'old_sandstone_02',
  'music-dunes': 'aerial_sand',
};

// ambientCG materials (facades lit at night)
export const FACADES = {
  'facade-brick': 'Facade018B',
  'facade-office': 'Facade020B',
  'facade-tower': 'Facade013',
  'facade-glass': 'Facade009',
};

// Poly Haven models: id, how much of the scan to keep, texture size, and how
// far the simplified surface may stray (relative to the model's size)
export const MODELS = {
  barrier: ['concrete_road_barrier_02', 0.12, 1024],
  crate: ['wooden_crate_01', 0.5, 512],
  barrel: ['Barrel_01', 0.7, 512],
  tyre: ['old_tyre', 0.6, 512],
  rock: ['rock_07', 0.06, 512, 0.02],
  'quiver-tree': ['quiver_tree_02', 0.025, 1024, 0.008],
  'street-lamp': ['street_lamp_01', 0.3, 512],
  'utility-box': ['utility_box_01', 0.6, 512],
  'trash-can': ['metal_trash_can', 0.35, 512],
  shrub: ['shrub_02', 0.06, 512, 0.01],
  brush: ['dry_branches_medium_01', 0.1, 512, 0.01],
  boulders: ['namaqualand_boulders_01', 0.015, 1024, 0.02],
  boulder: ['namaqualand_boulder_05', 0.01, 1024, 0.02],
  'dead-trunk': ['dead_quiver_trunk', 0.12, 512],
};

// Poly Haven HDRIs, one per stage: the light the metal reflects
const HDRIS = {
  jasper: 'rogland_sunset',
  mission: 'modern_buildings_night',
  kaon: 'abandoned_tank_farm_05',
  'music-dusk': 'belfast_sunset_puresky',
};

// Poly Haven pure skies (no ground in them), one per stage: what you see
// above the horizon
export const SKIES = {
  'jasper-sky': 'kloppenheim_06_puresky',
  'mission-sky': 'kloppenheim_07_puresky',
  'kaon-sky': 'industrial_sunset_puresky',
};

const UA = { 'User-Agent': 'tilakpatell.com CC0 asset fetch' };
async function get(url, as = 'json') {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: 'follow' });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return as === 'json' ? await res.json() : Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i === 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  return null;
}

// The few files we want out of a zip, without a zip library.
function unzip(buf, wanted) {
  const out = {};
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const key = wanted.find((w) => name.endsWith(w));
    if (key) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      out[key] = method === 8 ? inflateRawSync(data) : Buffer.from(data);
    }
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

// Pack AO, roughness and metalness into one RGB map (the glTF ORM layout).
async function packArm({ ao, rough, metal }, size) {
  const grey = async (b, fill) => (b ? sharp(b).resize(size, size, { fit: 'fill' }).greyscale().raw().toBuffer() : Buffer.alloc(size * size, fill));
  const [r, g, b] = await Promise.all([grey(ao, 255), grey(rough, 200), grey(metal, 0)]);
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    rgb[i * 3] = r[i];
    rgb[i * 3 + 1] = g[i];
    rgb[i * 3 + 2] = b[i];
  }
  return sharp(rgb, { raw: { width: size, height: size, channels: 3 } });
}

const webp = (img, file, quality) => img.webp({ quality, effort: 6 }).toFile(file);

async function texture(name, id) {
  const [files, info] = await Promise.all([get(`https://api.polyhaven.com/files/${id}`), get(`https://api.polyhaven.com/info/${id}`)]);
  const dir = join(OUT, 'tex', name);
  await mkdir(dir, { recursive: true });
  const url = (k) => files[k]?.['1k']?.jpg?.url ?? files[k]?.['1k']?.png?.url;
  const [color, normal, arm] = await Promise.all(['Diffuse', 'nor_gl', 'arm'].map((k) => get(url(k), 'buffer')));
  await webp(sharp(color).resize(1024, 1024, { fit: 'fill' }), join(dir, 'color.webp'), 80);
  await webp(sharp(normal).resize(1024, 1024, { fit: 'fill' }), join(dir, 'normal.webp'), 80);
  await webp(sharp(arm).resize(1024, 1024, { fit: 'fill' }), join(dir, 'arm.webp'), 78);
  return { source: `https://polyhaven.com/a/${id}`, id, name: info.name, authors: Object.keys(info.authors ?? {}), license: 'CC0 1.0', size: '1K' };
}

async function facade(name, id) {
  const zip = await get(`https://ambientcg.com/get?file=${id}_1K-JPG.zip`, 'buffer');
  const f = unzip(zip, ['_Color.jpg', '_NormalGL.jpg', '_Roughness.jpg', '_Metalness.jpg', '_AmbientOcclusion.jpg', '_Emission.jpg']);
  const dir = join(OUT, 'tex', name);
  await mkdir(dir, { recursive: true });
  await webp(sharp(f['_Color.jpg']).resize(1024, 1024, { fit: 'fill' }), join(dir, 'color.webp'), 80);
  await webp(sharp(f['_NormalGL.jpg']).resize(1024, 1024, { fit: 'fill' }), join(dir, 'normal.webp'), 78);
  await webp(await packArm({ ao: f['_AmbientOcclusion.jpg'], rough: f['_Roughness.jpg'], metal: f['_Metalness.jpg'] }, 1024), join(dir, 'arm.webp'), 78);
  if (f['_Emission.jpg']) await webp(sharp(f['_Emission.jpg']).resize(1024, 1024, { fit: 'fill' }), join(dir, 'emission.webp'), 80);
  return { source: `https://ambientcg.com/view?id=${id}`, id, name: id, authors: ['ambientCG'], license: 'CC0 1.0', size: '1K' };
}

async function model(name, [id, keep, texSize, error = 0.002]) {
  const [files, info] = await Promise.all([get(`https://api.polyhaven.com/files/${id}`), get(`https://api.polyhaven.com/info/${id}`)]);
  const g = files.gltf['1k'].gltf;
  const tmp = await mkdtemp(join(tmpdir(), 'cc0-'));
  await writeFile(join(tmp, 'model.gltf'), await get(g.url, 'buffer'));
  for (const [rel, f] of Object.entries(g.include ?? {})) {
    await mkdir(dirname(join(tmp, rel)), { recursive: true });
    await writeFile(join(tmp, rel), await get(f.url, 'buffer'));
  }
  // the gltf names its buffer after the asset; keep it findable
  const gltf = JSON.parse(await readFile(join(tmp, 'model.gltf'), 'utf8'));
  await writeFile(join(tmp, 'model.gltf'), JSON.stringify(gltf));
  await mkdir(join(OUT, 'models'), { recursive: true });
  const out = join(OUT, 'models', `${name}.glb`);
  const cli = ['--yes', '@gltf-transform/cli@4', 'optimize', join(tmp, 'model.gltf'), out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(texSize), '--simplify-ratio', String(keep), '--simplify-error', String(error)];
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', cli, { stdio: 'inherit' });
  await rm(tmp, { recursive: true, force: true });
  return { source: `https://polyhaven.com/a/${id}`, id, name: info.name, authors: Object.keys(info.authors ?? {}), license: 'CC0 1.0', size: `1K, simplified to ${Math.round(keep * 100)}%` };
}

// Radiance HDR: read (flat or run-length scanlines) into floats, and write
// back run-length encoded.
function readHdr(buf) {
  let p = 0;
  const line = () => {
    const e = buf.indexOf(10, p);
    const l = buf.toString('latin1', p, e);
    p = e + 1;
    return l;
  };
  while (line() !== '');
  const [, h, , w] = line().split(' ').map((v, i) => (i % 2 ? Number(v) : v));
  const px = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (buf[p] === 2 && buf[p + 1] === 2 && ((buf[p + 2] << 8) | buf[p + 3]) === w) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        for (let x = 0; x < w; ) {
          let n = buf[p++];
          if (n > 128) {
            n -= 128;
            const v = buf[p++];
            while (n--) scan[(x++) * 4 + c] = v;
          } else while (n--) scan[(x++) * 4 + c] = buf[p++];
        }
      }
    } else for (let i = 0; i < w * 4; i++) scan[i] = buf[p++];
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? 2 ** (e - 136) : 0;
      for (let c = 0; c < 3; c++) px[(y * w + x) * 3 + c] = scan[x * 4 + c] * f;
    }
  }
  return { w, h, px };
}

function writeHdr({ w, h, px }) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'latin1');
  const parts = [head];
  const rgbe = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const m = Math.max(px[i], px[i + 1], px[i + 2]);
      if (m < 1e-32) rgbe.fill(0, x * 4, x * 4 + 4);
      else {
        const e = Math.ceil(Math.log2(m));
        const k = 256 / 2 ** e;
        rgbe[x * 4] = Math.min(255, px[i] * k);
        rgbe[x * 4 + 1] = Math.min(255, px[i + 1] * k);
        rgbe[x * 4 + 2] = Math.min(255, px[i + 2] * k);
        rgbe[x * 4 + 3] = e + 128;
      }
    }
    const out = [2, 2, w >> 8, w & 255];
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < w) {
        let run = 1;
        while (x + run < w && run < 127 && rgbe[(x + run) * 4 + c] === rgbe[x * 4 + c]) run++;
        if (run >= 4) {
          out.push(128 + run, rgbe[x * 4 + c]);
          x += run;
        } else {
          let n = 0;
          const start = x;
          while (x < w && n < 128) {
            let r = 1;
            while (x + r < w && r < 4 && rgbe[(x + r) * 4 + c] === rgbe[x * 4 + c]) r++;
            if (r >= 4) break;
            x++;
            n++;
          }
          out.push(n);
          for (let k = start; k < start + n; k++) out.push(rgbe[k * 4 + c]);
        }
      }
    }
    parts.push(Buffer.from(out));
  }
  return Buffer.concat(parts);
}

async function hdri(name, id) {
  const [files, info] = await Promise.all([get(`https://api.polyhaven.com/files/${id}`), get(`https://api.polyhaven.com/info/${id}`)]);
  const src = readHdr(await get(files.hdri['1k'].hdr.url, 'buffer'));
  // halve it: plenty for light that's blurred into an environment map anyway
  const w = src.w / 2;
  const h = src.h / 2;
  const px = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) s += src.px[((y * 2 + dy) * src.w + x * 2 + dx) * 3 + c];
        px[(y * w + x) * 3 + c] = s / 4;
      }
  await mkdir(join(OUT, 'hdri'), { recursive: true });
  await writeFile(join(OUT, 'hdri', `${name}.hdr`), writeHdr({ w, h, px }));
  return { source: `https://polyhaven.com/a/${id}`, id, name: info.name, authors: Object.keys(info.authors ?? {}), license: 'CC0 1.0', size: `${w} × ${h}` };
}

// The sky: the top half of the 2K HDRI (and a little below the horizon),
// scaled so the middle of the sky sits near 0.35, squeezed into 8 bits.
// Prints where the sun is, for the stage's light to come from the same place.
async function sky(name, id) {
  const [files, info] = await Promise.all([get(`https://api.polyhaven.com/files/${id}`), get(`https://api.polyhaven.com/info/${id}`)]);
  const src = readHdr(await get(files.hdri['2k'].hdr.url, 'buffer'));
  const rows = src.h / 2 + src.h / 16; // down to 11.25° below the horizon
  const lum = (i) => src.px[i] * 0.2126 + src.px[i + 1] * 0.7152 + src.px[i + 2] * 0.0722;
  let sun = 0;
  let sunAt = 0;
  const all = [];
  for (let y = 0; y < src.h / 2; y++)
    for (let x = 0; x < src.w; x += 4) {
      const l = lum((y * src.w + x) * 3);
      all.push(l);
      if (l > sun) [sun, sunAt] = [l, y * src.w + x];
    }
  all.sort((a, b) => a - b);
  const scale = 0.35 / all[all.length >> 1];
  const out = Buffer.alloc(src.w * rows * 3);
  for (let i = 0; i < src.w * rows * 3; i++) {
    const v = (src.px[i] * scale) / (1 + src.px[i] * scale);
    out[i] = Math.round(255 * v ** (1 / 2.2));
  }
  await mkdir(join(OUT, 'sky'), { recursive: true });
  await sharp(out, { raw: { width: src.w, height: rows, channels: 3 } }).webp({ quality: 88, effort: 6 }).toFile(join(OUT, 'sky', `${name}.webp`));
  const u = ((sunAt % src.w) + 0.5) / src.w;
  const elev = 90 - ((Math.floor(sunAt / src.w) + 0.5) / src.h) * 180;
  console.log(`         sun at u ${u.toFixed(4)}, ${elev.toFixed(2)}° up; scaled ×${scale.toFixed(3)}`);
  return { source: `https://polyhaven.com/a/${id}`, id, name: info.name, authors: Object.keys(info.authors ?? {}), license: 'CC0 1.0', size: `${src.w} × ${rows}`, sun: { u: Number(u.toFixed(4)), elevation: Number(elev.toFixed(2)) } };
}

async function main() {
  const only = process.argv.slice(2);
  const pick = (name) => !only.length || only.includes(name);
  const creditsFile = join(OUT, 'credits.json');
  let credits = {};
  try {
    credits = JSON.parse(await readFile(creditsFile, 'utf8'));
  } catch {
    /* first run */
  }
  for (const [name, id] of Object.entries(TEXTURES)) if (pick(name)) (credits[`tex/${name}`] = await texture(name, id)) && console.log(`texture  ${name.padEnd(14)} ${id}`);
  for (const [name, id] of Object.entries(FACADES)) if (pick(name)) (credits[`tex/${name}`] = await facade(name, id)) && console.log(`facade   ${name.padEnd(14)} ${id}`);
  for (const [name, id] of Object.entries(HDRIS)) if (pick(name)) (credits[`hdri/${name}`] = await hdri(name, id)) && console.log(`hdri     ${name.padEnd(14)} ${id}`);
  for (const [name, id] of Object.entries(SKIES)) if (pick(name)) (credits[`sky/${name}`] = await sky(name, id)) && console.log(`sky      ${name.padEnd(14)} ${id}`);
  for (const [name, spec] of Object.entries(MODELS)) if (pick(name)) (credits[`models/${name}`] = await model(name, spec)) && console.log(`model    ${name.padEnd(14)} ${spec[0]}`);
  await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
