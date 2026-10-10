// Lane X's checks on the lit fixture (litWorld.js with `particles`):
// the game's effects from their own tables (src/data/bf2017/fx/, read from
// the bf2017-assets bucket) through createEffects: Hoth's interior steam and
// smoke, its falling snow (a two-second one-shot in the record, fired again
// every 2.5 s here, as the level's triggers would), one snow past its cull
// distance, a blaster bolt into the snow every 1.5 s, and a GR-75's engine
// and a TIE's contrail on ships circling the ring; and the GPU twin held to
// the CPU step (scripts/light-fixture.mjs --particles reads `probe.particles`).
//
// parity(): two of the game's emitters (the hangar's thin dust: a box and
// drawn directions; the bolt's plume: a sphere, drag and wind), each with
// the same seed and spawns, stepped 120 frames by emitter.js on the CPU and
// by gpu.js's compute pass, read back; the largest distance between a
// slot's two positions over the live slots (the plan's bar: 1 cm). On
// WebGL 2 the compute pass runs through three's transform-feedback
// fallback, so both kinds can be measured.
//
// createParticleProbe({ scene, renderer, camera, light, tier }) → Promise<probe>

import SNOW from '../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import STEAM from '../../data/bf2017/fx/FX_RisingSteam_Thick_HothInterior.json';
import SMOKE from '../../data/bf2017/fx/FX_Smokevolume_Hoth_Indoor_XL.json';
import IMPACT from '../../data/bf2017/fx/FX_Impact_Blaster_Snow.json';
import EXHAUST from '../../data/bf2017/fx/FX_EngineExhaust_TransportGR75_Prim.json';
import TIE from '../../data/bf2017/fx/FX_ConTrail_TieFighter.json';
import { createEffects } from '../../lib/three/particles/effects.js';
import { createSim } from '../../lib/three/particles/gpu.js';
import { MAX_OWNERS, OWNER } from '../../lib/three/particles/emitter.js';

const WIND = [3, 0, 1];
const SNOW_AT = [
  [0, 7, 0],
  [-5, 7, -3],
  [5, 7, -3],
];

export async function createParticleProbe({ scene, renderer, camera, light, tier = 'ultra' }) {
  const defs = Object.fromEntries([SNOW, STEAM, SMOKE, IMPACT, EXHAUST, TIE].map((d) => [d.name, d]));
  const effects = createEffects(scene, renderer, { tier, defs, light });
  effects.spawn(STEAM.name, [-3, 0, 2]);
  effects.spawn(STEAM.name, [3.5, 0, 1]);
  effects.spawn(SMOKE.name, [0, 1.5, -4]);
  // (past the snow's CullDistance of 50 m: it must cost nothing)
  effects.spawn(SNOW.name, [0, 7, -400]);
  // ships circling the ring 4 m up at 12 m/s, an engine and a contrail riding them
  const { Object3D } = await import('three/webgpu');
  const ship = new Object3D();
  const fighter = new Object3D();
  scene.add(ship, fighter);
  effects.spawn(EXHAUST.name, [0, 0, -1], [0, 0, 0, 1], 0.4, { parent: ship });
  effects.spawn(TIE.name, [0, 0, -0.5], [0, 0, 0, 1], 1, { parent: fighter });
  let lap = 0;
  await Promise.all(Object.keys(defs).map((n) => effects.ready(n)));
  let bolt = 0;
  let snow = 2.5;
  const out = {
    mode: renderer.backend?.isWebGLBackend ? 'cpu' : 'gpu',
    effects,
    stats: () => ({ ...effects.stats }),
    // the effects run for `seconds` before the first shot
    warm(seconds = 6) {
      for (let t = 0; t < seconds; t += 1 / 30) out.step(1 / 30);
    },
    step(dt) {
      lap += (dt * 12) / 7;
      ship.position.set(Math.cos(lap) * 7, 4, Math.sin(lap) * 7 - 2);
      // (facing along its path: +z of the ship is forward, the engine at -z)
      ship.rotation.set(0, -lap, 0);
      fighter.position.set(Math.cos(lap + Math.PI) * 9, 5.5, Math.sin(lap + Math.PI) * 9 - 2);
      fighter.rotation.set(0, -lap - Math.PI, 0);
      ship.updateMatrixWorld(true);
      fighter.updateMatrixWorld(true);
      bolt += dt;
      if (bolt > 1.5) {
        bolt = 0;
        effects.spawn(IMPACT.name, [1.4, 0.05, 1.4]);
      }
      snow += dt;
      if (snow > 2.5) {
        snow = 0;
        for (const at of SNOW_AT) effects.spawn(SNOW.name, at);
      }
      effects.update(dt, out.camera, WIND);
    },
    camera,
    dispose() {
      ship.removeFromParent();
      fighter.removeFromParent();
      effects.dispose();
    },
    async parity(frames = 120) {
      const thin = SNOW.emitters.find((e) => e.name.includes('dust_thin'));
      const plume = IMPACT.emitters.find((e) => e.name.includes('plume'));
      const rows = [];
      for (const em of [thin, plume]) rows.push(await parityOf(renderer, { ...em, loop: true }, frames));
      const failed = rows.find((r) => r.error);
      if (failed) return failed;
      return {
        frames,
        emitters: rows.map((r) => r.name),
        live: rows.reduce((n, r) => n + r.live, 0),
        agree: Math.min(...rows.map((r) => r.agree)),
        worstMetres: Math.max(...rows.map((r) => r.worstMetres)),
        backend: renderer.backend?.isWebGLBackend ? 'nodes-webgl' : 'webgpu',
      };
    },
  };
  return out;
}

// one emitter stepped on both, two owners (one turned), the wind on
async function parityOf(renderer, em, frames) {
  const n = 2048;
  const owners = new Float32Array(MAX_OWNERS * OWNER);
  owners.set([0, 12, 0, 1, 0, 0, 0, 1], 0);
  owners.set([8, 10, -4, 1, 0, 0.3826834, 0, 0.9238795], OWNER);
  const cpu = await createSim(em, n, { renderer, seed: 77, mode: 'cpu' });
  let gpu;
  try {
    gpu = await createSim(em, n, { renderer, seed: 77, mode: 'gpu' });
  } catch (e) {
    return { error: `gpu sim: ${String(e.message ?? e).split('\n')[0]}` };
  }
  const batches = [
    { owner: 0, count: 0 },
    { owner: 1, count: 0 },
  ];
  const wind = [1.5, 0, -0.5];
  for (let f = 0; f < frames; f++) {
    batches[0].count = f < 60 ? 9 : 0;
    batches[1].count = f % 3 === 0 ? 5 : 0;
    cpu.step(1 / 60, { batches, owners, wind });
    gpu.step(1 / 60, { batches, owners, wind });
  }
  const [a, b] = [await cpu.read(), await gpu.read()];
  let worst = 0;
  let live = 0;
  let agree = 0;
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    const la = a.posAge[k + 3] < a.velLife[k + 3];
    const lb = b.posAge[k + 3] < b.velLife[k + 3];
    if (la === lb) agree++;
    if (!la || !lb) continue;
    live++;
    worst = Math.max(worst, Math.hypot(a.posAge[k] - b.posAge[k], a.posAge[k + 1] - b.posAge[k + 1], a.posAge[k + 2] - b.posAge[k + 2]));
  }
  gpu.dispose();
  return { name: em.name.split('/').pop(), live, agree: agree / n, worstMetres: worst };
}
