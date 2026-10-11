// The level's effects and volumes on the game's world (the sixth design's
// picture lane), each from the pack's own file, moved into the map's frame
// (map/packFrame.js) and behind the tier, as the galaxy's fixtures wire
// them (src/runtime/fixtures/particleProbe.js, litWorld.js):
//
// - the effects (fidelity lane X): effects.json's spawns, at high and
//   ultra, through createEffects with the game's own tables
//   (src/data/bf2017/fx/), the light stack's params lighting the quads and
//   its sun's shadow term shading them. Every cell is entered at once: the
//   blueprints' CullDistance, MaxActiveInstanceCount and nearby caps decide
//   what runs (effects.js), so a far one costs a distance test a frame.
// - the volumes (fidelity lane V): volumes.json's glows and light cones for
//   applyGameLight's `volumetrics`, marched on high and ultra (CONES_LIT),
//   on WebGPU only: on the node renderer over WebGL 2 (SwiftShader, 2026-10-11)
//   Hoth's 130 volumes turned the whole frame black at high, sky and all,
//   where V's six-cone fixture draws; the owner's laptop is to say whether a
//   real driver's WebGL 2 draws them (VOLUME_BACKENDS).
//
// A pack without the file skips its pass with one log line.
//
// The picture lanes not yet on main when this was written (2026-10-10), and
// where each lands here (the sixth design's picture lane, task 4):
// - Q6 (the LUT after a linear tonemap, the five-Gaussian bloom, the HBAO
//   numbers, the painted sky): its passes come through applyGameLight's
//   `passes` into rt.gfx.post (module.js) with nothing to add; the record's
//   grade must stay one application (the stack's lut pass, not a second).
// - N (the scatter, merged): createWorldScatter below, the galaxy's
//   levelScatter in the level's group (the pack's frame, which its mask is
//   in), on the pack's ground; Hoth's terrain scatters nothing (its
//   scatter.json says so), so on Hoth it is null.
// - U (merged): the chain's start step (headroomAt at level 0: under a 4K
//   screen on ultra and high) in module.js; the runtime's pace already
//   lowers the ratio, so the chain is not rebuilt on each step. Batching,
//   bundles and occlusion through map/level.js's `batch`, off unless asked
//   (?batch=on), as U's rule keeps them until the laptop's table.
//
//   EFFECT_TIERS, VOLUME_TIERS
//   createWorldEffects({ scene, renderer, tier, level, light, deps })
//     → Promise<null | { update(dt, camera, wind), stats, dispose() }>
//   createWorldScatter({ level, tier, renderer, small, deps }) → null | { update([x, y, z], dt), stats(), dispose() }
//   levelVolumes(level, tier, backend = 'webgpu') → Promise<volumes.json in the map's frame | null>
//   (backend: light/three.js's backendOf(renderer))
//   (level: { pack, file(name) → Promise<json | null> }, map/level.js's)

import * as laneL from '../galaxy/shared/level.js';
import { toPack } from './map/level.js';
import { rebaseCells } from './map/packFrame.js';

export const EFFECT_TIERS = ['high', 'ultra'];
export const VOLUME_TIERS = ['high', 'ultra'];
export const VOLUME_BACKENDS = ['webgpu'];

const skipped = (file, pass) => console.info(`battlefront: the level has no ${file}; ${pass} skipped`);

// the game's effect tables, loaded by name as a spawn first asks for one
const TABLES = import.meta.glob('../../data/bf2017/fx/FX_*.json', { import: 'default' });
const loadTable = (name) => TABLES[`../../data/bf2017/fx/${name}.json`]?.() ?? Promise.resolve(null);

const DEPS = {
  createEffects: (...a) => import('../../lib/three/particles/effects.js').then((m) => m.createEffects(...a)),
  // the sprite sheets' manifest (lane X's fx.json), null where the host has
  // none: each sheet then draws as the placeholder
  sheets: () =>
    import('../../lib/three/particles/sheets.js')
      .then(({ SHEET_DIR }) => fetch(`${SHEET_DIR}fx.json`))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  loadTexture: (url) => import('three').then(({ TextureLoader }) => new TextureLoader().loadAsync(url)),
};

export async function createWorldEffects({ scene, renderer, tier, level, light = null, deps = {} }) {
  if (!EFFECT_TIERS.includes(tier)) return null;
  const d = { ...DEPS, ...deps };
  const file = await level.file('effects.json');
  if (!file?.cells) {
    skipped('effects.json', 'the effects');
    return null;
  }
  const sheets = await d.sheets();
  // (X's sprites ask the sun's shadow as a function of a corner; the
  // stack's term, apply.js's sunShadowNode, reads the fragment's own place)
  const term = light?.shadowTerm ?? null;
  const effects = await d.createEffects(scene, renderer, { tier, load: loadTable, sheets, light, shadow: term ? () => term : null, loadTexture: d.loadTexture });
  const spawns = rebaseCells(file, level.pack);
  const placed = effects.place(spawns);
  for (const key of Object.keys(spawns.cells)) placed.enter(key);
  return {
    update: (dt, camera, wind) => effects.update(dt, camera, wind),
    get stats() {
      return effects.stats;
    },
    dispose() {
      placed.dispose();
      effects.dispose();
    },
  };
}

export function createWorldScatter({ level, tier, renderer = null, small = false, deps = {} }) {
  const make = deps.createLevelScatter ?? laneL.createLevelScatter;
  const inner = make({ scene: level.group, site: { level: level.world }, tier, renderer, groundAt: (x, z) => level.packHeightAt(x, z), wind: null, small });
  if (!inner) return null;
  return {
    update: (at, dt) => inner.update(toPack(level.pack, at), dt),
    stats: () => inner.stats(),
    dispose: () => inner.dispose(),
  };
}

export async function levelVolumes(level, tier, backend = 'webgpu') {
  if (!VOLUME_TIERS.includes(tier)) return null;
  if (!VOLUME_BACKENDS.includes(backend)) {
    console.info(`battlefront: the volumes are off on ${backend} (they blackened the frame there)`);
    return null;
  }
  const file = await level.file('volumes.json');
  if (!file?.cells) {
    skipped('volumes.json', 'the volumes');
    return null;
  }
  return rebaseCells(file, level.pack);
}
