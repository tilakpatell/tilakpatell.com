// Whether to tell the visitor how to put the browser on the graphics card.
// Every context the site makes asks for the high-performance chip, but the
// browser and the system decide which one it gets: Chrome on Windows takes
// one adapter for all of its work, on a laptop usually the processor's
// built-in graphics, and ignores the page's powerPreference (Chrome's WebGPU
// troubleshooting tips; crbug 369219127). Neither Windows nor its browsers
// show a page a second GPU, so a laptop with a card it is not using looks,
// from here, like a laptop with none: the hint is given wherever the chip
// drawing is a built-in one on Windows or Linux, and says "if". A Mac
// switches by itself for a high-performance context; a phone, a Snapdragon
// laptop or a software renderer has no card to switch to. Pure; the
// renderer string is lib/gpu's, the phone flag lib/device's.
//
//   builtIn(renderer) → boolean: a processor's own graphics (Intel UHD,
//     Iris, Arc Graphics; AMD Radeon Graphics, 7x0M, Vega 3–11)
//   chipName(renderer) → the chip's name, read out of ANGLE's string
//   osOf({ ua, platform }) → 'windows' | 'mac' | 'linux' | 'chromeos' | 'android' | 'ios' | 'other'
//   browserOf(ua) → 'edge' | 'chrome' | 'firefox' | 'safari' | 'other'
//   gpuHint({ renderer, software, phone, os, kept }) → null | { chip, os }
//     (kept: the chip whose hint was dismissed, HINT_KEY)

export const HINT_KEY = 'tp-gpu-hint';
export const FLAG = 'force-high-performance-gpu'; // (chrome://flags/#… and edge://flags/#…: Chrome's own advice for a laptop's card)

const NOT_BUILT_IN = /NVIDIA|GeForce|Quadro|Apple|Adreno|Mali|PowerVR|SwiftShader|llvmpipe|softpipe|Basic Render/i;
const INTEL_CARD = /Arc\s*(?:\(TM\)\s*)?[AB]\d{3}/i; // (Arc A770, B580: the cards; Arc Graphics and Arc 140V are built in)
const AMD_CARD = /\bRX\s*\d{3,4}|Radeon\s*(?:\(TM\)\s*)?Pro\b|Radeon\s*VII|Vega\s*(?:56|64)\b|FirePro/i;
const AMD_BUILT_IN = /Radeon\s*(?:\(TM\)\s*)?(?:\d{3}M\b|Graphics|Vega\s*\d{1,2}\b|R[2-7]\b)/i;

export function builtIn(renderer = '') {
  const s = String(renderer ?? '');
  if (!s || NOT_BUILT_IN.test(s)) return false;
  if (/Intel/i.test(s)) return !INTEL_CARD.test(s);
  if (/Radeon|AMD/i.test(s)) return !AMD_CARD.test(s) && AMD_BUILT_IN.test(s);
  return false;
}

// ANGLE (vendor, the chip (0x…) Direct3D11 vs_5_0 ps_5_0, D3D11): the chip;
// any other string as it is. The (R) and (TM) marks go.
export function chipName(renderer = '') {
  const s = String(renderer ?? '').trim();
  const m = s.match(/^ANGLE \([^,]*,\s*(.+?)(?:\s*\(0x[0-9A-Fa-f]+\))?(?:\s+(?:Direct3D|OpenGL|Vulkan|Metal)[^,]*)?(?:,|\)$)/);
  return (m ? m[1] : s).replace(/\s*\((?:R|TM)\)/gi, '').replace(/\s+/g, ' ').trim();
}

export function osOf({ ua = '', platform = '' } = {}) {
  const p = String(platform ?? '').toLowerCase();
  if (p) {
    if (p.includes('win')) return 'windows';
    if (p.includes('mac')) return 'mac';
    if (p.includes('chrome')) return 'chromeos';
    if (p.includes('android')) return 'android';
    if (p.includes('linux')) return 'linux';
  }
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'mac';
  if (/Linux/.test(ua)) return 'linux';
  return 'other';
}

export function browserOf(ua = '') {
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\/|Chromium\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

export function gpuHint({ renderer = '', software = false, phone = false, os = 'other', kept = null } = {}) {
  if (phone || software || (os !== 'windows' && os !== 'linux')) return null;
  if (!builtIn(renderer)) return null;
  const chip = chipName(renderer);
  if (kept && kept === chip) return null;
  return { chip, os };
}
