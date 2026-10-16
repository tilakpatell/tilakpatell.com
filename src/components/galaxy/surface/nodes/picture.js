// A world's picture as the 2017 game makes it (lane Q6's records, the
// picture-everywhere design's lane P): for a world whose level's lighting
// rulebook and picture are on the site (Hoth's: maps/hoth.lighting.json,
// light/hoth.picture.json), the weather's VisualEnvironment record (its sun,
// sky, fog, tone map, grade), its painted panorama, fog gradient, cloud
// shadow and LUT, and the level's placed lights. ./stack.js draws it: the
// grade, the Gaussians and the LUT in the chain, the painted sky and the
// record's fog over the surface's dome, the clouds in the sun's shadow, the
// lamps clustered. A world without them gets null and keeps its own.
//
//   PICTURES: { world → { lighting(), picture(), records() } } (loaded when asked)
//   pictureFor(world, weather?, { url }) → Promise<null | { name, weather,
//     record, lut, panorama, gradient, cloudShadow, lights }>
//   pictureOfRows(rows, picture, weather, { url, records }) → the same, from
//     what is loaded (pure): the weather's whole record where `records` has
//     it, else the one entryFor makes from the rulebook's rows

import { entryFor, lightsJsonOf } from '../../../../lib/three/light/lighting';
import { assetUrl } from '../../../../lib/assetBase';

export const PICTURES = {
  hoth: {
    lighting: () => import('../../../../data/bf2017/maps/hoth.lighting.json').then((m) => m.default ?? m),
    picture: () => import('../../../../data/bf2017/light/hoth.picture.json').then((m) => m.default ?? m),
    // (the weathers' whole VisualEnvironment records, as the bucket's map
    // extras carry them: the rulebook's rows hold only part, without the
    // tone map's method, the LUT, the panorama's fields or the flare)
    records: () => import('../../../../data/bf2017/light/hoth.ve.json').then((m) => m.default ?? m),
  },
};

// (the picture's urls are the site's paths without their first slash)
const site = (url) => (path) => (path ? url(`/${String(path).replace(/^\/+/, '')}`) : null);
const withUrl = (part, at) => (part?.url ? { ...part, url: at(part.url) } : null);

export function pictureOfRows(rows, picture, weather = null, { url = assetUrl, records = null } = {}) {
  if (!rows?.weathers) return null;
  const name = weather && rows.weathers[weather] ? weather : rows.default;
  const whole = records?.[name] ?? null;
  const { name: ve, record } = whole?.record ? { name: whole.name ?? entryFor(rows, name).name, record: whole.record } : entryFor(rows, name);
  const p = picture?.weathers?.[name] ?? null;
  const at = site(url);
  return {
    name: ve,
    weather: name,
    record,
    lut: withUrl(p?.lut, at),
    panorama: withUrl(p?.panorama, at),
    gradient: withUrl(p?.gradient, at),
    cloudShadow: withUrl(p?.cloudShadow, at),
    lights: rows.lights?.length ? lightsJsonOf(rows.lights) : null,
  };
}

export async function pictureFor(world, weather = null, { url = assetUrl } = {}) {
  const books = PICTURES[world];
  if (!books) return null;
  const [lighting, picture, records] = await Promise.all([books.lighting(), books.picture().catch(() => null), books.records?.().catch(() => null) ?? null]);
  return pictureOfRows(lighting?.rows ?? lighting, picture, weather, { url, records });
}
