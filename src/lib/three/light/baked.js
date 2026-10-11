// The game's own baked bounce (GPU-first lane N3, "Far: the Enlighten
// atlases"): a level's Enlighten irradiance atlas, sampled on the mesh's
// second uv set (TEXCOORD_1, three's `uv1`), as the diffuse indirect light
// of the game material, in place of the probe term it stood for.
//
// What the export holds (docs/superpowers/evidence/bf2017-picture/w/atlases/FORMAT.md):
// per lit level one StaticEnlightenData set a lighting setup, five maps the
// same size: the HDR irradiance (BC6U or R9G9B9E5 in the export; RGBA16F
// KTX2 in the bucket through lane W's `atlases` job), three direction maps,
// one a colour channel (R, G, B; Enlighten's directional irradiance, the
// records' DirectionalIrradianceRgbEnable), and the sky visibility.
//
// The directional term. Each colour channel's map holds that channel's
// dominant direction, encoded 0…1 about 0.5, its length the share that is
// directional, and in alpha the rebalance Enlighten divides by. Per
// channel c, at a world normal n turned into the game's frame:
//
//   E_c = irradiance_c × max(0, dot(n, dir_c.xyz − 0.5) + 0.5) / max(DIRECTION_FLOOR, dir_c.w)
//
// (_source: Enlighten's directional output as Unity ships it, UnityCG.cginc's
// DecodeDirectionalLightmap, one map per channel here as the records ask.)
// A map with no direction (0.5, 0.5, 0.5, 1) gives half the irradiance on
// every side, which is what the rebalance of 1 means.
//
// The units. The atlas is irradiance in the record's own units, those of
// its SunIntensity; lane S's calibration (calibrate.js) brings the sun to
// the site by `gameToSite`, so the bounce of that sun comes by the same rate.
//
// The mapping. A mesh's TEXCOORD_1 is only the atlas's own when the
// instance's chart is known: Enlighten places each instance in the atlas by
// a chart rectangle kept in the level's DatabaseResource, which the
// exporter never read (the surfaces design, "the baked light"; lane Q3's
// probe). So the design has two roads to an atlas a mesh can read (the
// GPU-first spec's §11): the game's charts, if Q3's desktop spike reads them,
// or the site's own bake into charts it unwraps itself (a lane W desktop job);
// the sampler takes either the same way. A row's `charts` says how a mesh's
// uv1 reaches the atlas: 'game' or 'site' with `rects` ({ mesh: [x, y, w, h] },
// read at uv1 × rect.zw + rect.xy), 'uv1' (the uv1 is the atlas's own: the
// fixture's), { mesh: [sx, sy, ox, oy] } (a scale and offset a mesh), or
// null (none known: nothing is looked up, the mesh keeps the probe term). A mesh without TEXCOORD_1 always keeps the probe
// term (Review Focus 1): never a lookup through a uv that is not there.
//
// The sky visibility is sampled and handed out (`skyVisibility(uv1)`) for
// the material's overlay context; this lane does not blend the probes by
// it (the picture stays the record's: the atlas already holds its sky).
//
// hasUv1(geometry) → boolean                                         (pure)
// directionalIrradiance(irr, [dirR, dirG, dirB], n) → [r, g, b]       (pure: the TSL twin's CPU function)
// turnToGame(n, yaw) → n in the game's frame                          (pure)
// pickSet(rows, weather) → row | null; chartOf(row, mesh) → [sx, sy, ox, oy] | null   (pure)
// createBaked(renderer, rows, { loadTexture, calibrate, weather, yaw }) → Promise<{
//   node(uv1, chart) → vec3, skyVisibility(uv1, chart) → float, chartOf(mesh),
//   scale, directional, set, dispose() } | null>
// withBaked(material, baked, { chart, three }) → material (its indirect diffuse the atlas's)

import { indirectDiffuse } from '../surface/compose.js';
import { loadThree } from './three.js';

// the least rebalance divided by (_source: UnityCG.cginc's max(1e-4, w))
export const DIRECTION_FLOOR = 1e-4;
const WHOLE = [1, 1, 0, 0];

export function hasUv1(geometry) {
  const a = geometry?.attributes?.uv1;
  return Boolean(a && a.itemSize === 2 && a.count > 0);
}

export function directionalIrradiance(irr, dirs, n) {
  return [0, 1, 2].map((c) => {
    const d = dirs[c];
    const lambert = n[0] * (d[0] - 0.5) + n[1] * (d[1] - 0.5) + n[2] * (d[2] - 0.5) + 0.5;
    return (irr[c] * Math.max(0, lambert)) / Math.max(DIRECTION_FLOOR, d[3] ?? 1);
  });
}

// The pack turned the level by yaw about y (bf2017-level.mjs's rebase:
// x' = x cos + z sin, z' = −x sin + z cos); the atlas's directions are
// the game's, so a site normal goes back by the inverse
export function turnToGame(n, yaw = 0) {
  if (!yaw) return n;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c];
}

export function pickSet(rows, weather = null) {
  const list = (rows ?? []).filter((r) => r?.irradiance);
  if (!list.length) return null;
  const w = String(weather ?? '').toLowerCase();
  return (w && list.find((r) => String(r.variant ?? r.set ?? '').toLowerCase().includes(w))) || list[0];
}

export function chartOf(row, mesh) {
  const charts = row?.charts;
  if (charts === 'uv1') return WHOLE.slice();
  if (charts === 'game' || charts === 'site') {
    const r = row.rects?.[mesh];
    return Array.isArray(r) ? [r[2], r[3], r[0], r[1]] : null;
  }
  if (charts && typeof charts === 'object' && Array.isArray(charts[mesh])) return charts[mesh].slice();
  return null;
}

export async function createBaked(renderer, rows, { loadTexture, calibrate = null, weather = null, yaw = 0 } = {}) {
  const row = pickSet(rows, weather);
  if (!row || typeof loadTexture !== 'function') return null;
  const keys = ['irradiance', 'dirR', 'dirG', 'dirB', 'skyVisibility'];
  const loaded = await Promise.all(keys.map((k) => (row[k] ? Promise.resolve(loadTexture(row[k], k, row)).catch(() => null) : null)));
  const maps = Object.fromEntries(keys.map((k, i) => [k, loaded[i] ?? null]));
  const free = () => loaded.forEach((t) => t?.dispose?.());
  // (no irradiance, no bounce: the level keeps its probes)
  if (!maps.irradiance) {
    free();
    return null;
  }
  const directional = Boolean(maps.dirR && maps.dirG && maps.dirB);
  const scale = Number.isFinite(calibrate?.gameToSite) ? calibrate.gameToSite : Number.isFinite(calibrate) ? calibrate : 1;
  const { tsl } = await loadThree();
  const { texture, vec2, vec3, float, max, dot, normalWorld, uniform } = tsl;
  const k = uniform(scale);
  const turn = uniform(yaw);
  const at = (uv1, chart) => {
    const c = chart ?? WHOLE;
    return uv1.mul(vec2(c[0], c[1])).add(vec2(c[2], c[3]));
  };
  // the world normal in the game's frame (turnToGame's twin)
  const gameNormal = () => {
    const c = turn.cos();
    const s = turn.sin();
    return vec3(normalWorld.x.mul(c).sub(normalWorld.z.mul(s)), normalWorld.y, normalWorld.x.mul(s).add(normalWorld.z.mul(c)));
  };
  const channel = (map, uv, n) => {
    const d = texture(map, uv);
    return max(float(0), dot(n, d.xyz.sub(0.5)).add(0.5)).div(max(float(DIRECTION_FLOOR), d.w));
  };
  return {
    set: row.set ?? null,
    scale,
    directional,
    uniforms: { scale: k, yaw: turn },
    chartOf: (mesh) => chartOf(row, mesh),
    // the site's irradiance at the mesh's uv1 (directionalIrradiance's twin)
    node(uv1, chart) {
      const uv = at(uv1, chart);
      const irr = texture(maps.irradiance, uv).rgb;
      if (!directional) return irr.mul(k);
      const n = gameNormal();
      return vec3(irr.r.mul(channel(maps.dirR, uv, n)), irr.g.mul(channel(maps.dirG, uv, n)), irr.b.mul(channel(maps.dirB, uv, n))).mul(k);
    },
    skyVisibility(uv1, chart) {
      return maps.skyVisibility ? texture(maps.skyVisibility, at(uv1, chart)).r : float(1);
    },
    dispose: free,
  };
}

// The material's indirect diffuse from the atlas: its lighting model's
// indirect term sees the atlas's irradiance as the image-based one (so the
// diffuse keeps three's energy split with the specular, and the
// multi-scattered specular reads it too) and the lights' irradiance (the
// sky's hemisphere, the probe grid) dropped, since the atlas is what they
// stood in for. The environment's radiance (the reflections) is untouched.
// A mesh without a chart, or without the atlas, keeps the material as it is.
export function withBaked(material, baked, { chart = null, uv1 = null, three } = {}) {
  const { tsl } = three;
  const term = indirectDiffuse({ baked, uv1: uv1 ?? tsl.uv(1), chart, probe: null });
  if (!term) return material;
  const setup = material.setupLightingModel;
  material.setupLightingModel = function (builder) {
    const model = setup.call(this, builder);
    if (!model) return model;
    const base = model.indirect.bind(model);
    model.indirect = (b) => {
      b.context.irradiance.assign(tsl.vec3(0));
      b.context.iblIrradiance.assign(term);
      base(b);
    };
    return model;
  };
  material.userData.baked = { set: baked.set, chart, skyVisibility: baked.skyVisibility(uv1 ?? tsl.uv(1), chart) };
  material.needsUpdate = true;
  return material;
}
