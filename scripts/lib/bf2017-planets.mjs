// The game's planet skins, for the galaxy's planets seen from orbit
// (lane K: docs/superpowers/plans/2026-10-10-bf2017-phaseK-planet-skins.md).
// The drop paints its planets by shader, so no model names these maps and
// the optimiser never cut them: they sit in the bucket as the game named them
// (`web/textures/<lowercased name>.png` and `.ktx2`). SKINS says which game
// maps each site planet wears; the import resolves it against the bucket's
// list, converts what it finds to the site's sizes under
// `public/textures/galaxy/planets/<id>/`, and writes src/data/planetSkins.json,
// which bodies.js reads. The mapping is data reviewed in the PR, never a
// guess in the code that draws.
//
// What the drop holds, looked at on 2026-10-10: the space levels' colour
// (`_CS`, smoothness in alpha), normal (`_N`, `_NI`) and cloud maps
// (coverage in alpha) are whole-planet maps stored square, seamless round
// the planet; the game's planet meshes (levels/space/*/planet/planet_*_mesh,
// objects/planets/_planetmeshes/planet_01_mesh) bind no texture (a shader
// does) and carry UVs once round and pole to pole once, so bodySkin.js lays
// a map on that way. The front end's `_CA` globes, Endor's gas giant and
// Yavin's are pictures of a lit disc, which no sphere can wear (PICTURES).
//
// SKINS: { [site look id]: { color?, normal?, clouds?, atmo?, rings?, tiles?,
//   cloudTiles?, cloudCut?, cloudsIn?, seas?, greenDown?, atmoScale?, ringsAt? } }; each map
//   a glob over the lowercased game names, or a list of them, best first: the
//   first that matches exactly one name wins, so one that matches two is
//   reported, not guessed between. seas: the colour's alpha (smoothness) at
//   which the ground is water; tiles, cloudTiles: times round the planet
//   (the game's 1); cloudCut: the coverage under which there's no cloud;
//   cloudsIn: where a cloud map keeps its coverage, 'alpha' (the space
//   levels', the default where the map has one) or 'rgb' (the campaign's
//   objects/planets/<world>/T_Clouds*_CA: white cloud on black, its alpha
//   255 all over)
// sizesFor(kind, tier) → { w, format } | null
// planFor(skin, available: Set<name>) → { fetch: [{ kind, name }], missing: [{ kind, why }] }
// convertSkin({ id, skin, images: { kind: Buffer }, outDir, encodeKtx2 }) →
//   { entry, files: [{ path, bytes, tier }] }

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { isSequel } from './bf2017-manifest.mjs';
import { normalPng } from './bf2017-textures.mjs';

// (the sharp glTF-Transform's ndarray-pixels loads: see bf2017-textures.mjs)
const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');

// The sequel's worlds, refused whatever the table says (the autopilot's rule;
// phase 0's isSequel knows the drop's folder names, these are the planets')
export const SEQUEL_WORLDS = ['jakku', 'starkiller', 'takodana', 'crait', 'dqar', 'resurgent', 'hosnian'];
export const sequelWorld = (s) => isSequel(s) || SEQUEL_WORLDS.some((w) => s.toLowerCase().includes(w));

// The drop's planet textures, as the spec counts them (103 listed on 2026-10-10)
export const isPlanetTexture = (name) => /planet|gasgiant|moon_|cluster_|debrisring|asteroids_/i.test(name);

const SB = 'levels/space';
export const SKINS = {
  bespin: { color: 'objects/planets/bespin/t_planetbespin_01_c' },
  endor: {
    color: `${SB}/sb_endor_01/planet/t_planet_endor_01_cs`,
    normal: `${SB}/sb_endor_01/planet/t_planet_endor_01_n`,
    // (_03 is the map; _01 is a picture of the lit globe)
    clouds: `${SB}/sb_endor_01/planet/t_planet_endor_cloudes_03_c`,
    atmo: `${SB}/sb_endor_01/planet/t_planet_endor_atmosphere_01_c`,
    cloudCut: 0.5,
    seas: 0.38,
  },
  geonosis: { rings: 's5_1/objects/planets/geonosis/t_planetfrontendgeonosisrings_01_ca', ringsAt: [1.35, 2.3] },
  kamino: { color: 'objects/planets/kamino/t_planetkamino_01_c', seas: 0 },
  naboo: {
    color: `${SB}/sb_naboo_01/planet/t_planet_naboo_01_cs`,
    normal: `${SB}/sb_naboo_01/planet/t_planet_naboo_01_ni`,
    clouds: `${SB}/sb_naboo_01/planet/t_planet_naboo_01_clouds_rgba`,
    cloudCut: 0.45,
    seas: 0.38,
  },
  // the fifth design's lane E5: the six worlds it made systems of. The
  // campaign's planets (objects/planets/<world>) are whole-planet colour maps
  // with a cloud map of their own (coverage in alpha); Fondor's is its space
  // level's, with a relief map, as Naboo's
  fondor: {
    color: `${SB}/sb_fondor_01/planet/t_planet_fondor_03_cs`,
    normal: `${SB}/sb_fondor_01/planet/t_planet_fondor_03_ni`,
  },
  pillio: {
    // (Pillio_Alive: before Operation Cinder; Pillio_Dead is the burnt world
    // after. Its _CA is the cloud map, white on black, the alpha solid)
    color: 'objects/planets/pillio_alive/t_pillio_alive_01_c',
    clouds: 'objects/planets/pillio_alive/t_pillio_alive_01_ca',
    cloudsIn: 'rgb',
    cloudCut: 0.3,
  },
  sullust: {
    color: 'objects/planets/sullust/t_planetsullust_01_c',
    clouds: 'objects/planets/sullust/t_cloudssullust_01_ca',
    cloudsIn: 'rgb',
    cloudCut: 0.3,
  },
  vardos: {
    // (Vardos_Alive: before Operation Cinder, as the OT era has it)
    color: 'objects/planets/vardos_alive/t_planetvardosalive_01_c',
    clouds: 'objects/planets/vardos_alive/t_cloudsvardosalive_01_ca',
    cloudsIn: 'rgb',
    cloudCut: 0.3,
  },
};

// The maps that are pictures of a planet, not a planet's maps: what the site
// has for these worlds stays procedural
export const PICTURES = {
  'endor-giant': `${SB}/sb_endor_01/planet/t_gasgiant_endor_01_c`,
  geonosis: 's5_1/objects/planets/geonosis/t_planetfrontendgeonosis_01_ca',
  hoth: 's2/objects/planets/hoth/t_planetfrontenhoth_01_ca',
  kashyyyk: 's2/objects/planets/kashyyyk/t_planetfrontendkashyyyk_01_ca',
  scarif: 's9_3/scarif/objects/planets/scarif/t_planetfrontendscarif_01_ca',
  tatooine: 's2/objects/planets/tatooine/t_planetfrontendtatooine_01_ca',
  yavin: 'levels/lighting/yavin/sunset_01/t_yavin_01_planet_c',
  yavin4: 's2/objects/planets/yavin4/t_planetfrontendyavin4_01_ca',
  // (lane E5: Felucia and Kessel have only the front end's globes in the drop)
  felucia: 's8/felucia/objects/planets/felucia/t_planetfrontendfelucia_01_ca',
  kessel: 's3/objects/planets/kessel/t_planetfrontendkessel_01',
};

// The worlds the drop paints that no system on the site has a body for: left
// out until a system draws them (a new look in bodies.js and a place in
// systems.js are another lane's). Ryloth and Athulla have maps like Endor's
// and Naboo's; lane E5 placed Sullust, Kessel, Felucia, Fondor, Pillio and
// Vardos (SKINS and PICTURES above). Athulla's map (A3 M3ATH) is 179
// asteroids and no ground, so it is no system of its own
export const UNPLACED = ['naboo moon', 'death star II', 'ryloth and its moon', 'fondor’s moon', 'athulla'];

// The site's sizes, never larger than the game drew it. Low draws no skin (a
// weak device keeps the procedural ground and its memory); the cloud map is
// half the colour's size; the ultra colour and normal are UASTC, which stays
// compressed on the graphics chip. Files are named by tier
// (`<stem>-<tier>.<webp|ktx2>`: bodySkin.js's skinFile)
const COLOR = { mid: { w: 1024, format: 'webp' }, high: { w: 2048, format: 'webp' }, ultra: { w: 4096, format: 'ktx2' } };
export const TIERS = ['mid', 'high', 'ultra'];
export function sizesFor(kind, tier) {
  const c = COLOR[tier];
  if (!c) return null;
  if (kind === 'color' || kind === 'normal') return { ...c };
  if (kind === 'clouds') return { w: c.w / 2, format: 'webp' };
  if (kind === 'rings') return { w: 512, format: 'webp' };
  return null; // (the atmosphere is a colour, read once at import)
}

const globRe = (g) => new RegExp(`^${g.toLowerCase().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
// (a `*` inside a segment stays in it; a leading `*/` stands for any folders)
const matches = (glob, names) => {
  const re = glob.startsWith('*/') ? new RegExp(`(^|/)${globRe(glob.slice(2)).source.slice(1)}`) : globRe(glob);
  return names.filter((n) => re.test(n));
};

export const KINDS = ['color', 'normal', 'clouds', 'atmo', 'rings'];
export function planFor(skin, available) {
  const names = [...(available ?? [])].map((n) => String(n).toLowerCase()).sort();
  const fetch = [];
  const missing = [];
  for (const kind of KINDS) {
    const globs = skin?.[kind];
    if (!globs) continue;
    let found = null;
    const seen = [];
    for (const g of [].concat(globs)) {
      const hit = matches(g, names).filter((n) => !sequelWorld(n));
      if (hit.length === 1) {
        found = hit[0];
        break;
      }
      if (hit.length > 1) seen.push(`${g}: ${hit.length} names (${hit.slice(0, 3).join(', ')}${hit.length > 3 ? ', …' : ''})`);
    }
    if (found) fetch.push({ kind, name: found });
    else missing.push({ kind, why: seen.length ? `ambiguous: ${seen.join('; ')}` : 'not in the bucket yet' });
  }
  return { fetch, missing };
}

// A game name from a bucket path or a textures.jsonl line, as SKINS globs it
export const nameOf = (path) =>
  String(path)
    .toLowerCase()
    .replace(/^web\//, '')
    .replace(/^textures\//, '')
    .replace(/\.(png|ktx2)$/, '');

// textures.jsonl's names (the line's `name`, `path` or `file`), planet ones only
export function planetNames(text) {
  const out = new Set();
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const n = e.name ?? e.path ?? e.file;
    if (typeof n === 'string' && isPlanetTexture(n)) out.add(nameOf(n));
  }
  return out;
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
// the mean colour of a map, weighted by its alpha and its brightness (an
// atmosphere's picture is clear, or black, where there's no air)
export async function meanColor(buffer) {
  const { data } = await sharp(buffer).ensureAlpha().resize(64, 64, { fit: 'fill', kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = (data[i + 3] / 255) * (Math.max(data[i], data[i + 1], data[i + 2]) / 255);
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    w += a;
  }
  return w > 0 ? hex(r / w, g / w, b / w) : null;
}

// a cloud map as coverage in one channel: its alpha where it has one, else
// its brightness; `from: 'rgb'` takes the brightness whatever the alpha (the
// campaign's cloud maps, white on black with a solid alpha)
export async function coveragePng(buffer, from = 'alpha') {
  const meta = await sharp(buffer).metadata();
  const chan = meta.hasAlpha && from !== 'rgb' ? sharp(buffer).ensureAlpha().extractChannel(3) : sharp(buffer).removeAlpha().greyscale();
  return chan.png().toBuffer();
}

// a skin's file stem, as planetSkins.json names it
export const stemOf = (id, kind) => `textures/galaxy/planets/${id}/${kind}`;
export const fileOf = (id, kind, tier, format) => `${stemOf(id, kind)}-${tier}.${format === 'ktx2' ? 'ktx2' : 'webp'}`;

// One planet's maps at every tier, and its planetSkins.json entry (null when
// it has neither a colour nor rings)
export async function convertSkin({ id, skin = {}, images, outDir, encodeKtx2 }) {
  const files = [];
  const entry = {};
  const write = async (path, buf, tier) => {
    const abs = join(outDir, path.replace(/^textures\/galaxy\/planets\//, ''));
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, buf);
    files.push({ path, bytes: buf.length, tier });
  };
  for (const kind of ['color', 'normal', 'clouds', 'rings']) {
    let src = images[kind];
    if (!src) continue;
    const { width: srcW, height: srcH } = await sharp(src).metadata();
    // (the colour's alpha is smoothness: kept only where it marks the seas)
    if (kind === 'color' && skin.seas === undefined) src = await sharp(src).removeAlpha().png().toBuffer();
    if (kind === 'normal') src = await normalPng(src);
    if (kind === 'clouds') src = await coveragePng(src, skin.cloudsIn);
    for (const tier of kind === 'rings' ? ['mid'] : TIERS) {
      const size = sizesFor(kind, tier);
      const w = Math.min(size.w, srcW);
      const img = sharp(src).resize(w, Math.round((w * srcH) / srcW), { fit: 'fill', kernel: 'lanczos3' });
      if (size.format === 'ktx2') {
        // (stored bottom row first, as three's UVs want a KTX2: scripts/ktx2.mjs)
        const { ktx2 } = await encodeKtx2(await img.png().toBuffer(), { role: kind === 'normal' ? 'normal' : 'color', flipY: true });
        await write(fileOf(id, kind, tier, 'ktx2'), ktx2, tier);
      } else {
        await write(fileOf(id, kind, tier, 'webp'), await img.webp({ quality: kind === 'color' ? 82 : 80, alphaQuality: 40 }).toBuffer() /* (the alpha is only the seas' mask) */, tier);
      }
    }
    entry[kind] = stemOf(id, kind);
  }
  if (!entry.color && !entry.rings) return { entry: null, files };
  if (images.atmo) entry.atmo = await meanColor(images.atmo);
  for (const k of ['tiles', 'cloudTiles', 'cloudCut', 'seas', 'greenDown', 'atmoScale']) if (skin[k] !== undefined && entry.color) entry[k] = skin[k];
  if (entry.rings && skin.ringsAt) entry.ringsAt = skin.ringsAt;
  return { entry, files };
}

// the manifest's text: keys sorted
export function skinsJson(entries) {
  const sorted = Object.fromEntries(
    Object.keys(entries)
      .sort()
      .map((k) => [k, Object.fromEntries(Object.keys(entries[k]).sort().map((f) => [f, entries[k][f]]))]),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
