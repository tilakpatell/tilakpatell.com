// The runtime's browser parts, loaded on the first mount (they bring
// three.js with them): the backends and the loaders.

import { loadTexture, forgetTexture } from '../lib/three/textures';
import { loadGltf, forgetGltf } from '../lib/three/gltf';
import { loadBuffer } from '../lib/audio';
import { createWebGL } from './webgl';
import { createWebGPU } from './webgpu';

export function makeBackend(kind, opts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'world-canvas';
  // ('nodes-webgl' is the node renderer on WebGL 2: never the classic one)
  return kind === 'webgl' ? createWebGL(canvas, opts) : createWebGPU(canvas, { ...opts, forceWebGL: kind === 'nodes-webgl' });
}

export const loaders = {
  texture: (url, opts) => loadTexture(url, opts),
  gltf: (url, opts) => loadGltf(url, opts),
  audio: (url) => loadBuffer(url),
};

export const forget = {
  texture: (url) => forgetTexture(url),
  gltf: (url) => forgetGltf(url),
};

// The renderer tier (lib/gpuProbe), asked once a page by the runtime before
// the first 'nodes' world: the address's ?tier=, else the one kept for this
// chip, else the probe scene (the lit fixture's ring) drawn for a second
// into a fixed 1,280 × 720 target and timed by the chip's own timestamps.
// Only on a WebGPU device: the node renderer over WebGL 2 is a fallback,
// and a tier decided there would be kept for the chip it fell back from.
// The timestamps are let go after the probe (N2's controller turns them on
// again for its own reading), so a page pays for them for that second only.
export async function rendererTier(gfx) {
  const [{ adapterFacts, decideTier, probeTier, readTier, PROBE, TIER_KEY }, { createGpuTime }, { device }] = await Promise.all([import('../lib/gpuProbe'), import('../lib/three/gpuTime'), import('../lib/device')]);
  const { search, hash } = window.location;
  let stored = null;
  try {
    stored = window.localStorage.getItem(TIER_KEY);
  } catch {
    /* storage unavailable: probed this page */
  }
  if (gfx?.backend !== 'webgpu' || !gfx.renderer) return readTier(search, hash, stored, null).tier;
  const adapter = await navigator.gpu?.requestAdapter?.({ powerPreference: 'high-performance' }).catch(() => null);
  const renderer = gfx.renderer;
  const probe = async () => {
    const [THREE, { probeScene }] = await Promise.all([import('three'), import('./fixtures/litWorld')]);
    const { scene, camera, dispose } = probeScene();
    const target = new THREE.RenderTarget(...PROBE.size, { depthBuffer: true });
    const tracking = renderer.backend?.trackTimestamp ?? false;
    try {
      // (linked first: a pipeline compiled inside the second is not the chip's drawing time)
      await gfx.compile?.(scene, camera);
      return await probeTier({ renderer, scene, camera, gpuTime: createGpuTime(renderer), target });
    } finally {
      if (renderer.backend) renderer.backend.trackTimestamp = tracking;
      target.dispose();
      dispose();
    }
  };
  const { tier } = await decideTier({ search, hash, stored, facts: adapterFacts(adapter), phone: device().phone, probe });
  return tier;
}
