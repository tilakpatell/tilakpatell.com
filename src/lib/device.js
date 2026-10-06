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
//   detail    how fine to make textures and geometry: the tier, except that
//             a desktop's grade moves it, up to 'ultra' for a strong card (an
//             RTX 5090 or 4080, an RX 7900, an M3 Max) and down to 'mid' for
//             a weak built-in chip. lib/detail turns it into texture sizes,
//             segment counts and the like. The tier is never 'ultra': every
//             check of the tier stays as it was.
//
// `budget()` turns the tier into numbers a renderer uses: the sharpest pixel
// ratio, multisampling, shadows, bloom, texture filtering; at the ultra
// detail level, a row with more of each (and drawing sharper than a plain
// monitor's pixels, so edges and fine texture come out clean). The
// renderers' own watchdogs still step down from there when frames run long,
// and a strong card that struggles anyway is held at high from then on
// (`capDetail`, kept for that chip only).
//
// For testing on a desktop: ?quality=low (or mid, high, ultra) in the
// address, or localStorage 'tp-quality', pins the tier and the detail level.

import { gpuGrade } from './gpuGrade';

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
// coarser: a plain 1440p monitor gets one and a half pixels drawn for each,
// smoothing every edge and every highlight, as long as the frames keep up.
export const BUDGETS = {
  ultra: { tier: 'high', ratio: 2, minRatio: 1.5, antialias: true, samples: 8, shadows: true, shadowMap: 4096, bloom: 1, aniso: 16, stars: 1 },
  high: { tier: 'high', ratio: 2, antialias: true, samples: 4, shadows: true, shadowMap: 2048, bloom: 1, aniso: 16, stars: 1 },
  mid: { tier: 'mid', ratio: 1.5, antialias: true, samples: 2, shadows: true, shadowMap: 1024, bloom: 0.5, aniso: 4, stars: 0.6 },
  low: { tier: 'low', ratio: 1, antialias: false, samples: 0, shadows: false, shadowMap: 512, bloom: 0, aniso: 1, stars: 0.35 },
};

// The detail level from the tier and the chip's grade: a desktop's grade
// moves it a step either way; nothing else does. A cap (`{ renderer,
// level }`, kept when this chip struggled at ultra) holds it down for that
// chip only.
function detailOf(tier, grade, renderer, cap) {
  let detail = tier;
  if (tier === 'high' && (grade === 'ultra' || grade === 'mid')) detail = grade;
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
  let detail = detailOf(tier, grade, renderer, cap);
  if (LEVELS.includes(override)) {
    tier = override === 'ultra' ? 'high' : override;
    detail = override;
  }
  return { tier, phone, saveData: lowData, memory: memory ?? null, why, grade, detail };
}

function readOverride() {
  try {
    const q = new URLSearchParams(window.location.search).get('quality') ?? new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('quality');
    if (LEVELS.includes(q)) return q;
    const kept = window.localStorage.getItem(KEY);
    return LEVELS.includes(kept) ? kept : null;
  } catch {
    return null;
  }
}

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
export const budget = (tier) => {
  if (tier == null) {
    const d = device();
    tier = d.detail === 'ultra' ? 'ultra' : d.tier;
  }
  return BUDGETS[tier] ?? BUDGETS.high;
};

// The sharpest pixel ratio worth drawing at: the tier's, under the scene's
// own cap, never above the screen's (except at ultra, which draws at least
// `minRatio` pixels per screen pixel: supersampling, for clean edges).
export function pixelRatio(cap = 2, tier) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const b = budget(tier);
  return Math.min(cap, b.ratio, Math.max(dpr, b.minRatio ?? 0));
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
// too little room left asks about anything but the lightest.
export const HEAVY_MB = 3;
export function worldCheck(mb, dev = device(), free = null) {
  if (mb <= 1) return { ask: false, why: null };
  if (dev.saveData) return { ask: true, why: 'data' };
  if (free != null && free < mb * 4) return { ask: true, why: 'storage' };
  if (dev.tier === 'low') return { ask: true, why: dev.why.includes('software') ? 'software' : 'weak' };
  if (dev.tier === 'mid' && dev.phone && mb >= HEAVY_MB) return { ask: true, why: 'phone' };
  return { ask: false, why: null };
}
