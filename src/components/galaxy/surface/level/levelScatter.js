// A level world's terrain scatter (fidelity lane N: docs/superpowers/specs/
// 2026-10-10-battlefront-fidelity-design.md, "Lane N"): the pack's
// scatter.json and its derived mask (scripts/bf2017-scatter.mjs), its meshes
// through the level's own loader (their maps from the pack's tex/ at the
// tier's size), drawn round the visitor by src/lib/three/scatter/. A world
// without a pack, a pack without a scatter.json of the lane's format (a
// raw table, or one whose terrain scatters nothing), or the low tier on a
// phone: null, and nothing changes.
//
//   createLevelScatter({ scene, site, tier, renderer, groundAt, wind, small })
//     → null | { update([x, z], dt), stats(), dispose() }
//   (wind: the world's lib/three/wind.js; the sway's clock runs faster as it blows harder)

import { withFallback } from '../../../../lib/assetBase.js';
import { decodePng16 } from '../../../../lib/level/png16.js';
import { createLevelLoader } from './levelGltf.js';
import { packUrl } from './levelPack.js';

const bytesOf = (world) => (path) =>
  withFallback((u) =>
    fetch(u).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${u}`);
      return r.arrayBuffer();
    }),
  )(packUrl(world, path));

const textOf = (b) => JSON.parse(new TextDecoder().decode(b));
// the world's wind strength the game's sway is tuned at (lib/three/wind.js's
// default breath): a stronger wind runs the sway's clock faster
const WIND_AT = 0.45;

export function createLevelScatter({ scene, site, tier, renderer = null, groundAt, wind = null, small = false }) {
  if (!site?.level || (small && tier === 'low')) return null;
  const world = site.level;
  const fetchBytes = bytesOf(world);
  let inner = null;
  let loader = null;
  let gone = false;
  let last = null;
  const sway = wind ? { time: { value: 0 }, dir: wind.uniforms.uWindDir.value } : null;
  (async () => {
    const json = textOf(await fetchBytes('scatter.json'));
    // (the lane's format only, with something placed)
    if (json.format !== 1 || !json.masks?.png || !json.layers?.some((l) => l.placed)) return;
    const [png, { createScatterScene }] = await Promise.all([fetchBytes(json.masks.png).then((b) => decodePng16(new Uint8Array(b))), import('../../../../lib/three/scatter/scatterScene.js')]);
    if (gone) return;
    loader = createLevelLoader({ world, tier, renderer, fetchBytes, sizes: json.tex ?? {} });
    inner = createScatterScene({
      scene,
      json,
      mask: { data: png.data, w: png.w, h: png.h, minX: json.masks.minX, minZ: json.masks.minZ, metresPerPixel: json.masks.metresPerPixel },
      load: loader.load,
      tier,
      groundAt,
      wind: sway,
      nodes: Boolean(renderer?.isWebGPURenderer),
    });
    await inner.ready();
    if (last) inner.update(last);
  })().catch((e) => {
    if (import.meta.env?.DEV) console.warn('scatter failed', world, e);
  });
  return {
    update(position, dt = 0) {
      last = position;
      if (sway) sway.time.value += dt * Math.max(0.2, wind.uniforms.uWindStrength.value / WIND_AT);
      inner?.update(position);
    },
    stats: () => inner?.stats() ?? { instances: 0, calls: 0, tris: 0, types: 0 },
    dispose() {
      gone = true;
      inner?.dispose();
      loader?.dispose();
    },
  };
}
