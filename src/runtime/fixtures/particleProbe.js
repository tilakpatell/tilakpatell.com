// Lane X's checks on the lit fixture (litWorld.js with `particles`):
// the game's effects from their emitter tables through createEffects (the
// hangar's ceiling snow over the ring, one box past its cull distance, a
// blaster bolt into the snow every 1.5 s, a ship circling with its engine's
// glow and contrail), and the GPU twin held to the CPU
// step (scripts/light-fixture.mjs --particles
// reads `probe.particles`).
//
// parity(): the same emitter, the same seed and the same spawns, stepped
// 120 frames by emitter.js on the CPU and by gpu.js's compute pass, read
// back; the largest distance between a slot's two positions over the live
// slots (the plan's bar: 1 cm). On WebGL 2 the compute pass runs through
// three's transform-feedback fallback, so both kinds can be measured.
//
// createParticleProbe({ scene, renderer, camera, light, tier }) → Promise<probe>

import SNOW from '../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import IMPACT from '../../data/bf2017/fx/FX_Impact_Blaster_Snow_01.json';
import EXHAUST from '../../data/bf2017/fx/FX_Veh_GR75_Engine_Exhaust_01.json';
import { createEffects } from '../../lib/three/particles/effects.js';
import { createSim } from '../../lib/three/particles/gpu.js';
import { MAX_OWNERS, OWNER } from '../../lib/three/particles/emitter.js';

const WIND = [0.6, 0, 0.2];

export async function createParticleProbe({ scene, renderer, camera, light, tier = 'ultra' }) {
  const defs = { [SNOW.name]: SNOW, [IMPACT.name]: IMPACT, [EXHAUST.name]: EXHAUST };
  const effects = createEffects(scene, renderer, { tier, defs, light });
  // the hangar's ceiling snow as a level places it: three boxes 6 m up over
  // the ring, a fourth past the blueprint's cull (it must cost nothing)
  for (const at of [
    [0, 6, 0],
    [-5, 6, -3],
    [5, 6, -3],
    [0, 6, -400],
  ])
    effects.spawn(SNOW.name, at);
  // a ship circling the ring 4 m up at 12 m/s, its engine's glow and contrail riding it
  const { Object3D } = await import('three/webgpu');
  const ship = new Object3D();
  ship.name = 'fixture-ship';
  scene.add(ship);
  effects.spawn(EXHAUST.name, [0, 0, -1], [0, 0, 0, 1], 0.25, { parent: ship });
  let lap = 0;
  await Promise.all(Object.keys(defs).map((n) => effects.ready(n)));
  let since = 0;
  const out = {
    mode: renderer.backend?.isWebGLBackend ? 'cpu' : 'gpu',
    effects,
    stats: () => ({ ...effects.stats }),
    // the snow run for `seconds` before the first shot, so the boxes are full
    warm(seconds = 6) {
      for (let t = 0; t < seconds; t += 1 / 30) out.step(1 / 30);
    },
    step(dt) {
      lap += (dt * 12) / 7;
      ship.position.set(Math.cos(lap) * 7, 4, Math.sin(lap) * 7 - 2);
      // (facing along its path: +z of the ship is forward, the engine at -z)
      ship.rotation.set(0, -lap, 0);
      ship.updateMatrixWorld(true);
      // a bolt into the snow by the cube every 1.5 s
      since += dt;
      if (since > 1.5) {
        since = 0;
        effects.spawn(IMPACT.name, [1.4, 0.05, 1.4]);
      }
      effects.update(dt, out.camera, WIND);
    },
    camera,
    dispose() {
      ship.removeFromParent();
      effects.dispose();
    },
    async parity(frames = 120) {
      const em = SNOW.emitters[0];
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
      return { frames, live, agree: agree / n, worstMetres: worst, backend: renderer.backend?.isWebGLBackend ? 'nodes-webgl' : 'webgpu' };
    },
  };
  return out;
}
