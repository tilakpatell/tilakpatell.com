// A device’s renderer tier: which of the GPU-first paths its chip may take,
// decided once from the adapter’s features and a one-second draw of a fixed
// scene, and kept (the design’s G1,
// docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md §4). The
// quality level stays the visitor’s (lib/device’s `tp-quality`); the tier
// says which paths a level may use: lane N6’s table reads it.
//
//   T0  a phone, no timestamp-query, the software adapter, or a chip the
//       probe scene kept busy over 8 ms (an integrated chip, a weak one)
//   T1  a discrete chip: the GPU scene, SSGI and SSR
//   T2  T1 plus 64-bit min-max atomics, subgroups and 16 storage buffers a
//       stage: the cluster tier’s compute rasteriser (lane N7)
//
// The pure rules are here, tested in Node; the scene drawn and the clock it
// is timed by are passed in (src/lib knows no three.js: the runtime’s
// browser.js hands over the lit fixture’s probeScene and lib/three/gpuTime).
//
// classifyTier({ features, limits, medianMs, phone, info }) → 'T0' | 'T1' | 'T2'
// readTier(search, hash, stored, info) → { tier, fresh, pinned }
// keepTier(tier, info, storage)
// adapterFacts(adapter) → { features, limits, info: { vendor, architecture, fallback } }
// probeTier({ renderer, scene, camera, gpuTime, target, ms, now }) → Promise<median ms | null>
// decideTier({ search, hash, stored, facts, phone, probe, keep }) → Promise<{ tier, probed, pinned }>

export const TIERS = ['T0', 'T1', 'T2'];
export const TIER_KEY = 'tp-tier'; // beside lib/device’s 'tp-quality'

export const PROBE = {
  ms: 1000, // _source: the design’s G1 (“a one-second draw of the lit fixture’s scene”)
  frames: 10, // _source: this file: the fewest frames a median is taken over, however slow the chip
  slowMs: 8, // _source: the G1 plan’s Task 2 (“medianMs over 8 ms for the fixture’s probe scene”): half a 60 Hz frame on a scene a tenth of a world’s
  storageBuffers: 16, // _source: the research note’s WebGPU section (Dawn 146 raised the default 8 to 16); the G1 plan’s T2 row
  size: [1280, 720], // _source: this file: a fixed target, so the canvas’s size (1 × 1 before it is placed) never moves the number
};

const LIMITS = ['maxStorageBuffersPerShaderStage', 'maxColorAttachmentBytesPerSample'];

export function classifyTier({ features = new Set(), limits = {}, medianMs = null, phone = false, info = {} } = {}) {
  if (phone || info?.fallback || !features.has('timestamp-query')) return 'T0';
  if (!Number.isFinite(medianMs) || medianMs > PROBE.slowMs) return 'T0';
  if (features.has('atomic-vec2u-min-max') && features.has('subgroups') && (limits.maxStorageBuffersPerShaderStage ?? 0) >= PROBE.storageBuffers) return 'T2';
  return 'T1';
}

// (the chip a kept tier was decided on: a different vendor or architecture
// is a different chip, whatever its driver’s description says)
const chip = (info) => ({ vendor: String(info?.vendor ?? ''), architecture: String(info?.architecture ?? '') });
const sameChip = (a, b) => {
  const x = chip(a);
  const y = chip(b);
  return x.vendor === y.vendor && x.architecture === y.architecture;
};

// ?tier= in the search, or after the ? in the hash (the site’s routes are
// hashes), as ?quality= and ?gpu= are read; an unknown value pins nothing.
export function readTier(search = '', hash = '', stored = null, info = null) {
  const q = new URLSearchParams(search).get('tier') ?? new URLSearchParams(String(hash).split('?')[1] ?? '').get('tier');
  if (TIERS.includes(q)) return { tier: q, fresh: false, pinned: true };
  let kept = null;
  try {
    kept = stored ? JSON.parse(stored) : null;
  } catch {
    kept = null;
  }
  if (kept && TIERS.includes(kept.tier) && (info == null || sameChip(kept.info, info))) return { tier: kept.tier, fresh: false, pinned: false };
  return { tier: null, fresh: true, pinned: false };
}

export function keepTier(tier, info, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!TIERS.includes(tier)) return;
  try {
    storage?.setItem(TIER_KEY, JSON.stringify({ tier, info: chip(info) }));
  } catch {
    /* storage unavailable: probed again next visit */
  }
}

export function adapterFacts(adapter) {
  const limits = {};
  for (const k of LIMITS) if (typeof adapter?.limits?.[k] === 'number') limits[k] = adapter.limits[k];
  const info = adapter?.info ?? {};
  return { features: new Set(adapter?.features ?? []), limits, info: { ...chip(info), fallback: Boolean(info.isFallbackAdapter ?? adapter?.isFallbackAdapter) } };
}

// The probe scene drawn back to back for `ms` (and at least PROBE.frames
// frames), each frame’s GPU time resolved before the next, into a target of
// a fixed size when one is given; the GPU median, or null with no clock.
export async function probeTier({ renderer, scene, camera, gpuTime, target = null, ms = PROBE.ms, now = () => performance.now() }) {
  if (!gpuTime?.available) return null;
  const was = renderer.getRenderTarget?.() ?? null;
  if (target) renderer.setRenderTarget?.(target);
  gpuTime.reset?.();
  try {
    const start = now();
    for (let n = 0; n < PROBE.frames || now() - start < ms; n++) {
      renderer.render(scene, camera);
      await gpuTime.frame();
    }
  } finally {
    if (target) renderer.setRenderTarget?.(was);
  }
  return gpuTime.median;
}

// The tier for this page: the address’s pin, else the kept one from this
// chip, else decided now (no probe when the facts alone say T0) and kept.
export async function decideTier({ search = '', hash = '', stored = null, facts = adapterFacts(null), phone = false, probe, keep = keepTier }) {
  const read = readTier(search, hash, stored, facts.info);
  if (!read.fresh) return { tier: read.tier, probed: false, pinned: read.pinned };
  const plain = { ...facts, phone };
  if (classifyTier({ ...plain, medianMs: 0 }) === 'T0') {
    keep('T0', facts.info);
    return { tier: 'T0', probed: false, pinned: false };
  }
  let medianMs = null;
  try {
    medianMs = await probe();
  } catch {
    // (a probe that failed says nothing of the chip: T0 for this page, asked again on the next)
    return { tier: 'T0', probed: false, pinned: false };
  }
  const tier = classifyTier({ ...plain, medianMs });
  keep(tier, facts.info);
  return { tier, probed: true, pinned: false };
}
