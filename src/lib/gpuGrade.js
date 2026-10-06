// How strong a graphics chip is, read from the name the browser gives it, so
// the textures and the geometry can be as fine as the chip can draw: an
// RTX 5090 gets the sharpest maps and the smoothest curves on the site, a
// laptop's built-in chip what it always had, a weak one a little less. The
// device tier (lib/device) still decides everything else (phones, memory,
// software WebGL); this only grades the chip in a desktop or laptop.
//
//   gpuScore(renderer) → a number (a GeForce GTX 1060 is 100) or null
//   gpuGrade(renderer) → 'ultra' | 'high' | 'mid' | null
//
// null means the name doesn't say: Firefox rounds names off ("…, or
// similar"), Safari calls every Mac's chip "Apple GPU", some built-in chips
// give no model at all, and software WebGL is the tier's business. A chip
// that can't be graded is drawn as a desktop always was.
//
// The scores are each chip's place among the others (from 3DMark Time Spy
// graphics scores, a desktop GTX 1060 at 4,100 being 100), not a promise
// about any one scene: the renderers still watch the frames (lib/three/pace)
// and lib/detail lowers a chip that turns out to struggle. A generation the
// tables have never heard of is placed by its class and how far it is past
// the last one they know, so next year's cards don't fall to the bottom.

// The lines between the grades. Ultra starts about an RTX 3060 Ti, a
// 4060 Ti, an RX 6700 XT or an M1 Max: comfortably more than the site needs,
// so the extra detail costs nothing a visitor would feel. Below `high` are
// the chips that already work hard at a desktop's settings (older built-in
// Intel and AMD graphics, the entry GeForces).
export const GRADE_AT = { ultra: 280, high: 50 };

const ROUNDED = /or similar/i; // Firefox's rounded names
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|gdi generic/i;
const LAPTOP = 0.72; // a laptop part against the desktop card of the same name

// GeForce, by model (Ti and SUPER as written).
const GEFORCE = {
  5090: 1170, 5080: 800, '5070 ti': 730, 5070: 535, '5060 ti': 360, 5060: 300, 5050: 220,
  4090: 880, '4080 super': 700, 4080: 685, '4070 ti super': 600, '4070 ti': 550, '4070 super': 500, 4070: 425, '4060 ti': 330, 4060: 255, 4050: 200,
  '3090 ti': 530, 3090: 475, '3080 ti': 470, 3080: 425, '3070 ti': 355, 3070: 330, '3060 ti': 285, 3060: 215, 3050: 120,
  '2080 ti': 340, '2080 super': 285, 2080: 270, '2070 super': 245, 2070: 220, '2060 super': 210, 2060: 185,
  '1660 ti': 155, '1660 super': 150, 1660: 130, '1650 super': 115, 1650: 85,
  '1080 ti': 230, 1080: 175, '1070 ti': 160, 1070: 145, 1060: 100, '1050 ti': 60, 1050: 45,
  '980 ti': 140, 980: 105, 970: 85, 960: 55, 950: 45, '780 ti': 75, 780: 60, 770: 45, 760: 35, '750 ti': 30, 750: 25,
};
// Radeon RX, by model (XT, XTX and GRE as written).
const RADEON = {
  '9070 xt': 710, 9070: 610, '9060 xt': 410, 9060: 330,
  '7900 xtx': 720, '7900 xt': 635, '7900 gre': 530, '7800 xt': 475, '7700 xt': 400, 7700: 350, '7600 xt': 280, 7600: 265,
  '6950 xt': 520, '6900 xt': 490, '6800 xt': 450, 6800: 380, '6750 xt': 330, '6700 xt': 305, 6700: 270, '6650 xt': 245, '6600 xt': 230, 6600: 195, '6500 xt': 110, 6400: 85,
  '5700 xt': 230, 5700: 205, '5600 xt': 190, 5600: 170, '5500 xt': 130, 5500: 110, 5300: 90,
  590: 115, 580: 105, 570: 90, 560: 60, 550: 45, 480: 100, 470: 85, 460: 55,
};
// Apple's chips by generation: the plain one, Pro, Max, Ultra.
const APPLE = {
  '': { 1: 60, 2: 80, 3: 95, 4: 110, 5: 130 },
  pro: { 1: 150, 2: 170, 3: 180, 4: 240, 5: 280 },
  max: { 1: 290, 2: 330, 3: 400, 4: 460, 5: 530 },
  ultra: { 1: 480, 2: 560, 3: 640 },
};
const APPLE_STEP = { '': 1, pro: 2.1, max: 4.2, ultra: 7 };

// A model the table doesn't have, from the nearest one it does in the same
// class (the third digit of an RTX's number: a 6090 from the 5090), a
// quarter stronger for each generation after it and a fifth weaker before.
function nearestGeForce(gen, cls) {
  let best = null;
  for (const key of Object.keys(GEFORCE)) {
    if (!/^\d{4}$/.test(key) || key[2] !== String(cls) || Number(key[0]) < 2) continue;
    const g = Number(key[0]);
    if (!best || Math.abs(g - gen) < Math.abs(best.g - gen) || (Math.abs(g - gen) === Math.abs(best.g - gen) && g > best.g)) best = { g, score: GEFORCE[key] };
  }
  if (!best) return null;
  return best.score * (gen >= best.g ? 1.25 ** (gen - best.g) : 0.8 ** (best.g - gen));
}

// A model by its number and suffixes, from a table: the exact model, or the
// plain one with a little added for Ti or SUPER (XT, XTX).
function byModel(table, num, suffixes, extra) {
  const exact = [num, ...suffixes].join(' ');
  if (table[exact] != null) return table[exact];
  if (table[num] != null) return table[num] * (suffixes.length ? extra : 1);
  return null;
}

function nvidia(s) {
  // the workstation cards first: their numbers look like a GeForce's
  let m = s.match(/RTX\s*(?:PRO\s*)?(\d)000\s*(?:SFF\s*)?(Ada|Blackwell)/i);
  if (m) return (m[2].toLowerCase() === 'ada' ? { 2: 240, 4: 340, 5: 520, 6: 640 } : { 4: 450, 5: 750, 6: 1100 })[m[1]] ?? 300;
  if ((m = s.match(/RTX\s*A(\d)(\d)00\b/i))) return { 2: 150, 4: 300, 5: 380, 6: 460 }[m[1]] * (m[2] === '5' ? 1.1 : 1);
  if ((m = s.match(/Quadro\s*RTX\s*(\d)000/i))) return { 3: 190, 4: 240, 5: 280, 6: 330, 8: 340 }[m[1]] ?? 240;
  if ((m = s.match(/Quadro\s*([PTMK])(\d{3,4})/i))) return ({ P: 45, T: 80, M: 18, K: 12 }[m[1].toUpperCase()] * Number(m[2])) / 1000;
  if ((m = s.match(/TITAN\s*(RTX|V|Xp|X|Black|Z)\b/i))) return { rtx: 340, v: 320, xp: 240, x: 200, black: 70, z: 60 }[m[1].toLowerCase()];
  const mobile = /laptop|max-q|mobile|notebook/i.test(s) ? LAPTOP : 1;
  if ((m = s.match(/[RG]TX\s*(\d{3,4})(\s*Ti)?(\s*SUPER)?/i))) {
    const suffixes = [m[2] && 'ti', m[3] && 'super'].filter(Boolean);
    let score = byModel(GEFORCE, m[1], suffixes, suffixes.includes('ti') ? 1.12 : 1.08);
    const rtx = m[1].match(/^(\d)0(\d)0$/);
    if (score == null && rtx) score = nearestGeForce(Number(rtx[1]), Number(rtx[2]));
    return score == null ? null : score * mobile;
  }
  if ((m = s.match(/\bMX\s*(\d)\d\d/i))) return { 1: 18, 2: 24, 3: 32, 4: 45, 5: 58 }[m[1]] ?? 30;
  if ((m = s.match(/\bGT\s*(\d{3,4})/i))) return m[1] === '1030' ? 24 : 10;
  return null;
}

function amd(s) {
  let m = s.match(/\bRX\s*(\d{3,4})\s*(XTX|XT|GRE)?\s*(M|S)?(?![A-Za-z0-9])/i);
  if (m) {
    const score = byModel(RADEON, m[1], m[2] ? [m[2].toLowerCase()] : [], 1.1);
    return score == null ? null : score * (m[3] ? LAPTOP : 1);
  }
  if ((m = s.match(/Vega\s*(\d+)/i))) {
    const n = Number(m[1]);
    // the discrete Vegas are 56 and 64; the built-in ones are numbered by
    // their compute units, 3 to 11
    if (n >= 56) return n >= 64 ? 165 : 150;
    return { 3: 10, 6: 15, 7: 20, 8: 27, 9: 28, 10: 30, 11: 32 }[n] ?? 20;
  }
  if (/Radeon\s*VII/i.test(s)) return 280;
  if ((m = s.match(/Radeon\s*Pro\s*W(\d{4})/i))) return { 7900: 550, 7800: 450, 7700: 350, 6800: 350, 6600: 200, 5700: 200 }[m[1]] ?? 200;
  if ((m = s.match(/Radeon\s*Pro\s*(\d{3,4})(M|X)?/i))) return { 5600: 150, 5500: 110, 5300: 85, 580: 100, 570: 85, 560: 55, 555: 45 }[m[1]] ?? null;
  if ((m = s.match(/Radeon\s*(?:\(TM\)\s*)?(\d{3})M\b/i))) return { 890: 100, 880: 90, 780: 71, 760: 58, 740: 40, 680: 60, 660: 40, 610: 15 }[m[1]] ?? 50;
  if ((m = s.match(/Radeon\s*R(\d)\s/i))) return { 9: 60, 7: 20, 5: 10 }[m[1]] ?? 15;
  if (/Radeon\s*HD\s*\d{4}/i.test(s)) return 15;
  return null;
}

function intel(s) {
  let m = s.match(/Arc\s*(?:\(TM\)\s*)?([AB])(\d{3})(M)?/i);
  if (m) return ({ A310: 70, A380: 95, A580: 190, A750: 230, A770: 250, B570: 260, B580: 300 }[`${m[1].toUpperCase()}${m[2]}`] ?? (m[1].toUpperCase() === 'B' ? 280 : 150)) * (m[3] ? LAPTOP : 1);
  if (/Arc\s*(?:\(TM\)\s*)?1[34]0V/i.test(s)) return 90;
  if (/Arc\s*(?:\(TM\)\s*)?Graphics/i.test(s)) return 85;
  if ((m = s.match(/Iris\s*(?:\(R\)\s*)?Xe\s*(MAX)?/i))) return m[1] ? 50 : 40;
  if (/Iris\s*(?:\(R\)\s*)?(?:Plus|Pro)/i.test(s)) return 22;
  if ((m = s.match(/UHD\s*Graphics\s*(\d)?/i))) return m[1] === '7' ? 20 : m[1] === '6' ? 11 : 12;
  if (/HD\s*Graphics/i.test(s)) return 8;
  return null;
}

function apple(s) {
  const m = s.match(/Apple\s*M(\d+)(?:\s*(Pro|Max|Ultra))?/i);
  if (!m) return null;
  const gen = Number(m[1]);
  const kind = (m[2] ?? '').toLowerCase();
  return APPLE[kind][gen] ?? (60 + 18 * (gen - 1)) * APPLE_STEP[kind];
}

function qualcomm(s) {
  // a Snapdragon laptop's chip; a phone's Adreno (three digits) is the
  // device tier's business
  const m = s.match(/Adreno\s*(?:\(TM\)\s*)?X(\d)-(\d{2})/i);
  if (!m) return null;
  return { 'X1-85': 55, 'X1-45': 35 }[`X${m[1]}-${m[2]}`] ?? (m[1] === '1' ? 45 : 100);
}

export function gpuScore(renderer) {
  const s = String(renderer ?? '');
  if (!s || ROUNDED.test(s) || SOFTWARE.test(s)) return null;
  const score = nvidia(s) ?? amd(s) ?? intel(s) ?? apple(s) ?? qualcomm(s);
  return score == null || !Number.isFinite(score) ? null : Math.round(score);
}

export function gpuGrade(renderer) {
  const score = gpuScore(renderer);
  if (score == null) return null;
  return score >= GRADE_AT.ultra ? 'ultra' : score >= GRADE_AT.high ? 'high' : 'mid';
}
