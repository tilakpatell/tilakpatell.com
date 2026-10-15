// The runtime's browser parts, loaded on the first mount (they bring
// three.js with them): the backends and the loaders.

import { loadTexture, forgetTexture } from '../lib/three/textures';
import { hdrWanted } from '../lib/video.js';
import { loadGltf, forgetGltf } from '../lib/three/gltf';
import { loadBuffer } from '../lib/audio';
import { createWebGL } from './webgl';
import { createWebGPU } from './webgpu';

export function makeBackend(kind, opts) {
  // (`canvas`: the OffscreenCanvas a worker was handed, runtime/worker/)
  const canvas = opts.canvas ?? document.createElement('canvas');
  canvas.className = 'world-canvas';
  // ('nodes-webgl' is the node renderer on WebGL 2: never the classic one)
  // (?traa=off, development's: the reference shots' chain without its
  // temporal pass, scripts/reference-frames.mjs)
  const temporal = !(import.meta.env?.DEV && /[?&]traa=off\b/.test(`${globalThis.location?.search}&${globalThis.location?.hash}`));
  // (HDR output only where the display has the range: lib/video.js's hdrWanted)
  return kind === 'webgl' ? createWebGL(canvas, opts) : createWebGPU(canvas, { ...opts, forceWebGL: kind === 'nodes-webgl', temporal, hdr: hdrWanted({ hdr: opts.hdr ? 'on' : 'off' }) });
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
// The chip's WebGL name (lib/gpu) goes with the facts: a weak one by name is
// T0 with no probe at all. → { tier, why } (lib/gpuProbe's reasons)
export async function rendererTier(gfx) {
  const [{ adapterFacts, decideTier, probeTier, readTier, PROBE, TIER_KEY }, { createGpuTime }, { device }, { gpu }] = await Promise.all([import('../lib/gpuProbe'), import('../lib/three/gpuTime'), import('../lib/device'), import('../lib/gpu')]);
  const { search, hash } = window.location;
  let stored = null;
  try {
    stored = window.localStorage.getItem(TIER_KEY);
  } catch {
    /* storage unavailable: probed this page */
  }
  if (gfx?.backend !== 'webgpu' || !gfx.renderer) {
    const kept = readTier(search, hash, stored, null);
    return { tier: kept.tier, why: kept.why ?? null };
  }
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
  const { tier, why } = await decideTier({ search, hash, stored, facts: adapterFacts(adapter), phone: device().phone, name: gpu().renderer, probe });
  return { tier, why };
}
