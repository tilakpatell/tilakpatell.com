// What this device can afford, decided once so every scene, game and world
// fits it the same way. Phones have less to draw with (a smaller graphics
// chip, sharing memory with everything else, throttled when warm), less room
// to keep things in, and often a metered connection, so they start lower and
// ask before a world downloads a lot.
//
//   tier      'high' (a desktop or laptop with a graphics chip), 'mid' (a
//             phone or tablet, or a small or low-memory computer) or 'low'
//             (software WebGL, an older or budget phone, very little memory)
//   phone     a phone or tablet
//   saveData  the visitor asked for less data (Data Saver, Low Data Mode),
//             or the connection is 2G
//   memory    GB of memory, where the browser says (Chrome-based only)
//   why       what pulled the tier down: 'phone', 'memory', 'cores', 'gpu',
//             'software', 'screen'
//   grade     how strong a desktop's graphics chip is, from its name
//             (lib/gpuGrade): 'ultra', 'high', 'mid', or null where the name
//             doesn't say (and on a phone, where the tier already does)
//   detail    the quality level in force: 'low', 'mid', 'high' or 'ultra'.
//             Auto gives a laptop or desktop with a graphics chip 'ultra'
//             (one whose chip grades 'mid', old built-in graphics, 'high'),
//             a phone or a small computer its tier, software WebGL 'low'.
//             lib/detail turns it into texture sizes and segment counts,
//             lib/budgets into how much is drawn. The tier is never
//             'ultra': every check of the tier stays as it was.
//   auto      the level Auto picks here, whatever the visitor pinned (the
//             settings panel labels Auto with it)
//
// `budget()` turns the tier into numbers a renderer uses: the sharpest pixel
// ratio, multisampling, shadows, bloom, texture filtering; at the ultra
// detail level, a row with more of each (and drawing sharper than a plain
// monitor's pixels, so edges and fine texture come out clean). The
// renderers' own watchdogs still step down from there when frames run long,
// and a strong card that struggles anyway is held at high from then on
// (`capDetail`, kept for that chip only).
//
// The visitor picks a mode in the settings panel (components/settings): Auto,
// or a level, kept as localStorage 'tp-quality' (`setQuality`, which tells
// the page with a 'tp:quality' event; `quality()` reads it back). A level
// picked by hand is never capped. ?quality=low (or mid, high, ultra) in the
// address pins one for that visit, over what is kept.

import { gpuGrade } from './gpuGrade';
import { anisotropyOf, read as readVideo, resolve as resolveVideo, samplesFor } from './video.js';

const KEY = 'tp-quality';
const CAP_KEY = 'tp-detail-cap';
export const LEVELS = ['low', 'mid', 'high', 'ultra'];

// Phone graphics chips that struggle with full scenes: Mali's older and
// entry lines, Adreno 2xx to 5xx, PowerVR, VideoCore, Vivante, early Tegra.
const WEAK_GPU = /mali-(4\d\d|t\d|g(31|51|52)\b)|adreno[^\d]*[2-5]\d\d|powervr|sgx|videocore|vivante|tegra [34]\b/i;
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i;

// Each row says which tier it is (ultra's is high: it's the high tier with
// a strong graphics card), so a check of `budget().tier` reads true.
// `minRatio` draws sharper than the screen where the screen's own pixels are
// coarser: a plain 1440p monitor gets one and a half pixels drawn for each at
// ultra, and a quarter more at high (Active Theory's `getDPR` does the same,
// max(1.25, dpr) on most desktops), smoothing every edge and every highlight,
// as long as the frames keep up: each renderer's watchdog drops it when not.
export const BUDGETS = {
  ultra: { tier: 'high', ratio: 2, minRatio: 1.5, antialias: true, samples: 8, shadows: true, shadowMap: 4096, bloom: 1, aniso: 16, stars: 1 },
  high: { tier: 'high', ratio: 2, minRatio: 1.25, antialias: true, samples: 4, shadows: true, shadowMap: 2048, bloom: 1, aniso: 16, stars: 1 },
  mid: { tier: 'mid', ratio: 1.5, antialias: true, samples: 2, shadows: true, shadowMap: 1024, bloom: 0.5, aniso: 4, stars: 0.6 },
  low: { tier: 'low', ratio: 1, antialias: false, samples: 0, shadows: false, shadowMap: 512, bloom: 0, aniso: 1, stars: 0.35 },
};

// What Auto picks from the tier and the chip's grade: a laptop or desktop
// with a graphics chip ultra, unless its chip grades 'mid' (high); anything
// else its tier. A cap (`{ renderer, level }`, kept when this chip struggled
// at ultra) holds it down for that chip only.
function detailOf(tier, grade, renderer, cap) {
  let detail = tier;
  if (tier === 'high') detail = grade === 'mid' ? 'high' : 'ultra';
  if (cap && cap.renderer === renderer && LEVELS.includes(cap.level) && LEVELS.indexOf(detail) > LEVELS.indexOf(cap.level)) detail = cap.level;
  return detail;
}

// The tier from what the browser tells us. Pure, so it can be tested.
export function classifyDevice({ ua = '', touchPoints = 0, coarse = false, screen = 1920, memory = null, cores = null, saveData = false, net = '', renderer = '', software = false, override = null, cap = null } = {}) {
  const phone = MOBILE_UA.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1) || (coarse && screen < 900);
  const lowData = Boolean(saveData) || /(^|-)2g$/.test(net);
  const why = [];
  if (software) why.push('software');
  if (memory != null && memory <= (phone ? 3 : 2)) why.push('memory');
  if (cores != null && cores > 0 && cores <= 2) why.push('cores');
  if (phone && WEAK_GPU.test(renderer)) why.push('gpu');
  let tier = why.length ? 'low' : 'high';
  if (tier === 'high') {
    if (phone) why.push('phone');
    else if (memory != null && memory <= 4) why.push('memory');
    else if (screen < 700) why.push('screen');
    if (why.length) tier = 'mid';
  }
  const grade = phone ? null : gpuGrade(renderer);
  const auto = detailOf(tier, grade, renderer, cap);
  let detail = auto;
  // (a level picked by hand: never capped)
  if (LEVELS.includes(override)) {
    tier = override === 'ultra' ? 'high' : override;
    detail = override;
  }
  return { tier, phone, saveData: lowData, memory: memory ?? null, why, grade, detail, auto };
}

function readUrlLevel() {
  try {
    const q = new URLSearchParams(window.location.search).get('quality') ?? new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('quality');
    return LEVELS.includes(q) ? q : null;
  } catch {
    return null;
  }
}

function readOverride() {
  try {
    const q = readUrlLevel();
    if (q) return q;
    const kept = window.localStorage.getItem(KEY);
    return LEVELS.includes(kept) ? kept : null;
  } catch {
    return null;
  }
}

const readKey = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

// The cap a chip earned by struggling at ultra (see `capDetail`).
function readCap() {
  try {
    const kept = JSON.parse(window.localStorage.getItem(CAP_KEY) ?? 'null');
    return kept && typeof kept.renderer === 'string' && LEVELS.includes(kept.level) ? kept : null;
  } catch {
    return null;
  }
}

// What the browser says about itself. The graphics chip comes from lib/gpu's
// one look (passed in, so this module doesn't pull it in where it isn't used).
export function signals(gpuInfo = {}) {
  if (typeof window === 'undefined') return {};
  const nav = window.navigator ?? {};
  const conn = nav.connection ?? {};
  return {
    ua: nav.userAgent ?? '',
    touchPoints: nav.maxTouchPoints ?? 0,
    coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    screen: Math.min(window.screen?.width ?? 1920, window.screen?.height ?? 1080, window.innerWidth || 1920),
    memory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    saveData: Boolean(conn.saveData),
    net: conn.effectiveType ?? '',
    renderer: gpuInfo.renderer ?? '',
    software: Boolean(gpuInfo.software),
    override: readOverride(),
    cap: readCap(),
  };
}

let cached = null;
let gpuLook = null;

// The device, looked at once. lib/gpu hands over its look at the graphics
// chip when it makes one, which can sharpen the answer (a weak phone chip,
// software WebGL); until then the tier is read from everything else.
export function device() {
  return (cached ??= classifyDevice(signals(gpuLook ?? {})));
}

export function noteGpu(info) {
  gpuLook = info;
  cached = null;
}

// Look again from scratch (the tests; a mode just changed).
export function resetDevice() {
  cached = null;
  videoCache = null;
}

// The mode the visitor chose ('auto' or a level; the address's ?quality=
// counts as chosen, and `pinned` says it's the address's, which a pick in
// the panel can't override), the level in force, and what Auto would pick.
export function quality() {
  const d = device();
  return { mode: readOverride() ?? 'auto', level: d.detail, auto: d.auto, pinned: readUrlLevel() != null };
}

// Keep a mode ('auto' forgets the pick) and tell the page: a 'tp:quality'
// event on window with the level now in force. The runtime hears it and
// retunes the world that's up, or offers to reload it; scenes built later
// are built to the new level.
export function setQuality(mode) {
  if (mode !== 'auto' && !LEVELS.includes(mode)) return;
  try {
    if (mode === 'auto') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, mode);
  } catch {
    /* storage unavailable: it lasts for this page */
  }
  cached = null;
  window.dispatchEvent(new CustomEvent('tp:quality', { detail: device().detail }));
}

// How sharp to draw against the level's own pixel ratio: ½ to 2, 1 by
// default (the settings panel's Sharpness, kept as 'tp-sharpness').
export function sharpness() {
  const k = Number.parseFloat(readKey('tp-sharpness'));
  return Number.isFinite(k) ? Math.min(2, Math.max(0.5, k)) : 1;
}

// Hold this chip at `level` from now on (lib/detail calls it when frames
// stayed late at ultra with every softening already used up). Kept with the
// chip's name, so a new graphics card starts fresh; ?quality=ultra tries it
// again. Scenes already built keep what they have; the next one is built to
// the new level.
export function capDetail(level = 'high') {
  if (!LEVELS.includes(level)) return;
  try {
    window.localStorage.setItem(CAP_KEY, JSON.stringify({ renderer: gpuLook?.renderer ?? '', level }));
  } catch {
    /* storage unavailable: it lasts for this page */
  }
  cached = classifyDevice({ ...signals(gpuLook ?? {}), cap: { renderer: gpuLook?.renderer ?? '', level } });
}

// The renderer's numbers. With no tier given, this device's: the ultra row
// for a strong card, otherwise its tier's.
export const budget = (tier, video = videoValues()) => {
  if (tier == null) {
    const d = device();
    tier = d.detail === 'ultra' ? 'ultra' : d.tier;
  }
  const row = BUDGETS[tier] ?? BUDGETS.high;
  // (the video settings, lib/video.js: multisampling and anisotropy under
  // the row's own, never over it)
  const samples = samplesFor(video);
  const aniso = anisotropyOf(video);
  if (samples == null && aniso == null) return row;
  return { ...row, ...(samples != null ? { samples: Math.min(row.samples, samples) } : {}), ...(aniso != null ? { aniso: Math.min(row.aniso, aniso) } : {}) };
};

// The visitor's video overrides as this device may draw them (lib/video.js
// resolve's `overridden`, the ceiling this device's detail): only what the
// visitor turned, so a row asked for by its tier keeps its own numbers
// otherwise. Read once and again after a change ('tp:video') or a reset.
let videoCache = null;
export function videoValues() {
  return (videoCache ??= resolveVideo(readVideo(), { ceiling: device().detail }).overridden);
}
export function resetVideo() {
  videoCache = null;
}
if (typeof window !== 'undefined') window.addEventListener('tp:video', resetVideo);

// The sharpest pixel ratio worth drawing at: the tier's, under the scene's
// own cap, never above the screen's (except at high and ultra, which draw at
// least `minRatio` pixels per screen pixel: supersampling, for clean edges).
export function pixelRatio(cap = 2, tier) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const b = budget(tier);
  return Math.min(cap, b.ratio, Math.max(dpr, b.minRatio ?? 0) * sharpness());
}

// Room left in this site's storage, in MB (null where the browser won't say).
export async function storageFree() {
  try {
    const est = await window.navigator?.storage?.estimate?.();
    if (!est || typeof est.quota !== 'number') return null;
    return Math.max(0, (est.quota - (est.usage ?? 0)) / 1048576);
  } catch {
    return null;
  }
}

// Whether a world of `mb` megabytes should wait for the visitor to say so
// before it downloads its 3D, and why. Desktops just load. Phones load the
// light ones and ask about the heavy ones; a weak device, Data Saver, or
// too little room left asks about anything but the lightest. The visitor
// can say not to ask (the settings panel's Data, 'tp-ask-download' off):
// then only too little room still asks.
export const HEAVY_MB = 3;
export function worldCheck(mb, dev = device(), free = null) {
  if (mb <= 1) return { ask: false, why: null };
  if (free != null && free < mb * 4) return { ask: true, why: 'storage' };
  if (readKey('tp-ask-download') === 'off') return { ask: false, why: null };
  if (dev.saveData) return { ask: true, why: 'data' };
  if (dev.tier === 'low') return { ask: true, why: dev.why.includes('software') ? 'software' : 'weak' };
  if (dev.tier === 'mid' && dev.phone && mb >= HEAVY_MB) return { ask: true, why: 'phone' };
  return { ask: false, why: null };
}
