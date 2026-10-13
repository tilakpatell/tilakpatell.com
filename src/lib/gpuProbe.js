// A device’s renderer tier: which of the GPU-first paths its chip may take,
// decided once from the adapter’s features and a one-second draw of a fixed
// scene, and kept (the design’s G1,
// docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md §4). The
// quality level stays the visitor’s (lib/device’s `tp-quality`); the tier
// says which paths a level may use: lane N6’s table reads it.
//
//   T0  a phone, no timestamp-query, the software adapter, a chip whose
//       WebGL name grades under lib/gpuGrade's high line (the Radeon 740M,
//       Iris Xe: no probe needed), a chip the probe scene kept busy over
//       8 ms (an integrated chip, a weak one), or one whose WebGPU device
//       was lost in the last seven days
//   T1  a discrete chip: the GPU scene, SSGI and SSR
//   T2  T1 plus 64-bit min-max atomics, subgroups and 16 storage buffers a
//       stage: the cluster tier’s compute rasteriser (lane N7)
//
// The tier keeps its reason (`why`): 'phone', 'fallback', 'features',
// 'name', 'slow', 'probe' (nothing measured), 'lost', 'pinned', or null
// for T1 and T2. A T0 for 'name', 'slow' or 'lost' (CAPPING) holds Auto at
// Low (lib/device reads `tierHold` of the kept record): the owner's word,
// 2026-10-13, after a 740M hung on the High chain
// (docs/superpowers/specs/2026-10-13-every-chip-plays-design.md). A loss
// is counted for its chip: two within LOST_DAYS start the next visits on
// the node renderer over WebGL 2 (`lostTwice`, runtime/index.js).
//
// The pure rules are here, tested in Node; the scene drawn and the clock it
// is timed by are passed in (src/lib knows no three.js: the runtime’s
// browser.js hands over the lit fixture’s probeScene and lib/three/gpuTime).
//
// judgeTier({ features, limits, medianMs, phone, info, score }) → { tier, why }
// classifyTier(same) → 'T0' | 'T1' | 'T2'
// nameVendor(name) → 'nvidia' | 'amd' | 'intel' | 'apple' | 'qualcomm' | null
// nameScore(name, adapterVendor) → lib/gpuGrade's score, or null when the name is another chip's
// readTier(search, hash, stored, info, now) → { tier, fresh, pinned, why }
// keepTier(tier, info, storage, { why })
// tierHold(stored, now) → 'low' | null   noteLoss(info, storage, now) → record   lostTwice(stored, now) → boolean
// adapterFacts(adapter) → { features, limits, info: { vendor, architecture, fallback } }
// probeTier({ renderer, scene, camera, gpuTime, target, ms, now }) → Promise<median ms | null>
// decideTier({ search, hash, stored, facts, phone, name, probe, keep, now }) → Promise<{ tier, probed, pinned, why }>

import { GRADE_AT, gpuScore } from './gpuGrade';

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
export const CAPPING = new Set(['name', 'slow', 'lost']);
export const LOST_DAYS = 7; // _source: the every-chip-plays design: a loss holds the chip at Low, and two send it to WebGL 2, for a week
const DAY_MS = 86400000;

export function judgeTier({ features = new Set(), limits = {}, medianMs = null, phone = false, info = {}, score = null } = {}) {
  if (phone) return { tier: 'T0', why: 'phone' };
  if (info?.fallback) return { tier: 'T0', why: 'fallback' };
  if (!features.has('timestamp-query')) return { tier: 'T0', why: 'features' };
  if (Number.isFinite(score) && score < GRADE_AT.high) return { tier: 'T0', why: 'name' };
  if (!Number.isFinite(medianMs)) return { tier: 'T0', why: 'probe' };
  if (medianMs > PROBE.slowMs) return { tier: 'T0', why: 'slow' };
  if (features.has('atomic-vec2u-min-max') && features.has('subgroups') && (limits.maxStorageBuffersPerShaderStage ?? 0) >= PROBE.storageBuffers) return { tier: 'T2', why: null };
  return { tier: 'T1', why: null };
}

export const classifyTier = (facts) => judgeTier(facts).tier;

// (the vendor a WebGL renderer name is, as WebGPU's adapter.info.vendor spells it)
const VENDORS = [
  ['nvidia', /nvidia|geforce|quadro|\brtx\b|\bgtx\b/i],
  ['amd', /\bamd\b|radeon|\bati\b/i],
  ['intel', /intel|iris|\buhd\b|\barc\b/i],
  ['apple', /apple/i],
  ['qualcomm', /qualcomm|adreno/i],
];
export function nameVendor(name = '') {
  for (const [v, re] of VENDORS) if (re.test(String(name ?? ''))) return v;
  return null;
}

// the name's grade only when it names the WebGPU adapter's chip: a laptop
// whose WebGL is on its NVIDIA chip and its WebGPU on the Intel one (or the
// reverse) is the probe's to judge, not the name's
export function nameScore(name, adapterVendor = '') {
  const v = String(adapterVendor ?? '').toLowerCase();
  const n = nameVendor(name);
  if (v && n && v !== n) return null;
  return gpuScore(name);
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
const parse = (stored) => {
  try {
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};
// (a loss is kept for LOST_DAYS: after that the chip is judged afresh)
const stale = (kept, now) => kept?.why === 'lost' && !(now - (kept.lostAt ?? 0) < LOST_DAYS * DAY_MS);

export function readTier(search = '', hash = '', stored = null, info = null, now = Date.now()) {
  const q = new URLSearchParams(search).get('tier') ?? new URLSearchParams(String(hash).split('?')[1] ?? '').get('tier');
  if (TIERS.includes(q)) return { tier: q, fresh: false, pinned: true };
  const kept = parse(stored);
  if (kept && TIERS.includes(kept.tier) && (info == null || sameChip(kept.info, info)) && !stale(kept, now)) return { tier: kept.tier, fresh: false, pinned: false, why: kept.why };
  return { tier: null, fresh: true, pinned: false };
}

const pageStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function keepTier(tier, info, storage = pageStorage(), { why = null, ...rest } = {}) {
  if (!TIERS.includes(tier)) return;
  try {
    storage?.setItem(TIER_KEY, JSON.stringify({ tier, info: chip(info), ...(why ? { why } : {}), ...rest }));
  } catch {
    /* storage unavailable: probed again next visit */
  }
}

// Auto's ceiling from the kept tier: Low for a chip that is weak by its
// name, slow on the probe, or lost in the last LOST_DAYS; else none
export function tierHold(stored, now = Date.now()) {
  const kept = parse(stored);
  if (kept?.tier !== 'T0' || !CAPPING.has(kept.why) || stale(kept, now)) return null;
  return 'low';
}

// A WebGPU device lost (not destroyed by the site): the chip is T0 for
// LOST_DAYS, its losses counted from the first in that span
export function noteLoss(info, storage = pageStorage(), now = Date.now()) {
  let kept = null;
  try {
    kept = parse(storage?.getItem(TIER_KEY));
  } catch {
    kept = null;
  }
  const again = kept?.why === 'lost' && sameChip(kept.info, info) && !stale(kept, now);
  const record = { tier: 'T0', info: chip(info), why: 'lost', losses: again ? (kept.losses ?? 1) + 1 : 1, lostAt: now };
  try {
    storage?.setItem(TIER_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable: the loss lasts for this page */
  }
  return record;
}

export function lostTwice(stored, now = Date.now()) {
  const kept = parse(stored);
  return kept?.why === 'lost' && (kept.losses ?? 0) >= 2 && !stale(kept, now);
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

// The tier for this page: the address’s pin; else the facts alone when
// they say T0 (a phone, no clock, a weak chip by its WebGL `name`: decided
// before a kept tier, so one kept under an older rule is put right); else
// the kept one from this chip; else decided now by the probe, and kept.
export async function decideTier({ search = '', hash = '', stored = null, facts = adapterFacts(null), phone = false, name = '', probe, keep = keepTier, now = Date.now() }) {
  const read = readTier(search, hash, stored, facts.info, now);
  if (read.pinned) return { tier: read.tier, probed: false, pinned: true, why: 'pinned' };
  const plain = { ...facts, phone, score: nameScore(name, facts.info?.vendor) };
  const known = judgeTier({ ...plain, medianMs: 0 });
  if (known.tier === 'T0') {
    keep('T0', facts.info, { why: known.why });
    return { tier: 'T0', probed: false, pinned: false, why: known.why };
  }
  if (!read.fresh) return { tier: read.tier, probed: false, pinned: false, why: read.why ?? null };
  let medianMs = null;
  try {
    medianMs = await probe();
  } catch {
    // (a probe that failed says nothing of the chip: T0 for this page, asked again on the next)
    return { tier: 'T0', probed: false, pinned: false, why: 'probe' };
  }
  const { tier, why } = judgeTier({ ...plain, medianMs });
  keep(tier, facts.info, { why });
  return { tier, probed: true, pinned: false, why };
}
