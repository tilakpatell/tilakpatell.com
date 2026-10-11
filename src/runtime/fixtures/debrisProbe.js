// Lane N5's checks on the lit fixture (litWorld.js with `debris`): a
// hundred breaks a minute on the fixture's ground (a crate, a wall
// section, a speeder, a barrel, in turn round the ring), each split by
// src/lib/physics/breaks.js into Rapier hulls and a GPU burst
// (src/lib/three/particles/debris.js), the burst landing on last frame's
// depth: on WebGPU a depth pass of the scene drawn after each frame; on the
// node renderer over WebGL 2 (the CPU path) the ground's depth from the
// fixture's camera, computed once (the camera doesn't move), so the CPU
// twin's collision shows too. The CPU step is timed a frame: the physics
// step and the hulls' sleep check (the plan's gate: under 2 ms p95 with a
// hundred breaks a minute) and, apart, the particles' CPU work.
// scripts/light-fixture.mjs --debris reads `probe.debris`.
//
// createDebrisProbe({ scene, renderer, camera, light, tier, breaks = true }) → Promise<{
//   (breaks false: the same scene, nothing broken: the frame's before)
//   mode, step(dt), run(seconds) → the table's row, stats(), draw(r) (the depth pass), dispose() }>

import { createPhysics } from '../../lib/physics/world.js';
import { createEffects } from '../../lib/three/particles/effects.js';
import { createDebris, createDebrisMeshes, debrisDefs } from '../../lib/three/particles/debris.js';
import { depthSampler } from '../../lib/three/particles/collide.js';

const EVERY = 0.6; // s between breaks: a hundred a minute (the design's gate)
const KINDS = [
  { size: 1, label: 'crate' },
  { size: 3, label: 'wall' },
  { size: 4.5, label: 'speeder', light: { color: [1, 0.55, 0.25], candela: 2500, range: 9 } },
  { size: 1.5, label: 'barrel' },
];
const DEPTH = 128; // texels a side of the CPU path's depth

// the ground's depth (y = 0) seen by `camera`, in its own depth range (1: nothing)
function groundDepth(THREE, camera) {
  camera.updateMatrixWorld();
  const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse.copy(camera.matrixWorld).invert());
  const inv = vp.clone().invert();
  const depth = new Float32Array(DEPTH * DEPTH).fill(1);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let y = 0; y < DEPTH; y++)
    for (let x = 0; x < DEPTH; x++) {
      const nx = ((x + 0.5) / DEPTH) * 2 - 1;
      const ny = (0.5 - (y + 0.5) / DEPTH) * 2;
      a.set(nx, ny, camera.coordinateSystem === THREE.WebGPUCoordinateSystem ? 0 : -1).applyMatrix4(inv);
      b.set(nx, ny, 1).applyMatrix4(inv);
      const t = a.y / (a.y - b.y);
      if (t > 0 && t < 1) depth[y * DEPTH + x] = a.clone().lerp(b, t).applyMatrix4(vp).z;
    }
  return depthSampler(depth, DEPTH, DEPTH);
}

const pct = (xs, p) => {
  const s = [...xs].sort((x, y) => x - y);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3) : null;
};

export async function createDebrisProbe({ scene, renderer, camera, light, tier = 'ultra', breaks = true }) {
  const THREE = await import('three/webgpu');
  const physics = await createPhysics();
  physics.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [100, 0.5, 100] }] });
  const effects = createEffects(scene, renderer, { tier, defs: debrisDefs(), light });
  let meshes = null;
  const debris = createDebris(effects, physics, { seed: 1, onStatic: (p) => meshes?.statics(p) });
  meshes = await createDebrisMeshes(scene, debris);
  const mode = renderer.backend?.isWebGLBackend ? 'cpu' : 'gpu';
  let depthRT = null;
  if (mode === 'gpu') {
    // last frame's depth: the scene drawn again into a half-size target after each frame
    depthRT = new THREE.RenderTarget(512, 288, { depthTexture: new THREE.DepthTexture(512, 288) });
    effects.setDepth({ depth: depthRT.depthTexture });
  } else effects.setDepth({ depthAt: groundDepth(THREE, camera), texel: [1 / DEPTH, 1 / DEPTH] });

  let clock = 0;
  let next = 0;
  let n = 0;
  const stepMs = [];
  const fxMs = [];
  const now = () => performance.now();
  function step(dt) {
    clock += dt;
    while (breaks && clock >= next) {
      const k = KINDS[n % KINDS.length];
      const a = (n * 2.39996) % (Math.PI * 2); // (the golden angle: breaks spread round the ring)
      const r = 3 + (n % 5);
      debris.break([Math.cos(a) * r, k.size / 2 + 0.2, Math.sin(a) * r - 2], k.size, [0, 1.5, 0], k.label, { light: k.light ?? null });
      n++;
      next += EVERY;
    }
    const t0 = now();
    physics.step(dt);
    debris.update(dt);
    const t1 = now();
    effects.update(dt, camera);
    // (a speeder's flash among the ring's lamps: placed.js's list, the newest dropped past the pool)
    light?.setParticleLights?.(effects.lights());
    stepMs.push(t1 - t0);
    fxMs.push(now() - t1);
    meshes.update();
  }
  return {
    mode,
    step,
    // `seconds` of play at 60 frames a second, undrawn: the CPU step's row
    run(seconds = 60) {
      stepMs.length = 0;
      fxMs.length = 0;
      const before = n;
      for (let i = 0; i < seconds * 60; i++) step(1 / 60);
      return {
        seconds,
        breaks: n - before,
        stepMs: { p50: pct(stepMs, 0.5), p95: pct(stepMs, 0.95), max: pct(stepMs, 1) },
        particlesMs: { p50: pct(fxMs, 0.5), p95: pct(fxMs, 0.95), max: pct(fxMs, 1) },
        debris: debris.stats(),
        effects: { ...effects.stats },
        lights: effects.lights().length,
      };
    },
    stats: () => ({ debris: debris.stats(), effects: { ...effects.stats } }),
    // after the frame: the depth the next frame's bursts land on
    draw(r) {
      if (!depthRT) return;
      r.setRenderTarget(depthRT);
      r.render(scene, camera);
      r.setRenderTarget(null);
    },
    dispose() {
      debris.dispose();
      meshes.dispose();
      effects.dispose();
      depthRT?.dispose();
      physics.dispose();
    },
  };
}
