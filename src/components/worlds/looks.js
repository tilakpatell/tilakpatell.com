// One art a world (docs/superpowers/specs/2026-10-08-one-feel-site-wide-design.md,
// piece 1): every world and page game has a look.js beside its scene that
// says what it is drawn as, which tone mapper it takes and which bloom, and
// why where it differs from the house. Pure, so the sweep in looks.test.js
// can hold every folder to it.
//
//   LOOK_FOLDERS → [{ folder, routes }]: each folder (under src/components)
//     that holds a world’s or a page game’s scene, and the routes it draws
//   validateLook(look) → string[]: what is wrong with a look (empty: nothing)
//   oklabDistance(a, b) → how far apart two colours look (OKLab, 0…~1)
//
// A look:
//   { art: 'painted' | 'scanned' | 'own',
//     palette: ['#…', …],      painted only: six to sixteen colours, none
//                               closer than MIN_APART to another
//     tone: 'house' | 'none',  house: Neutral through houseOn
//     bloom: { threshold, strength, radius } | false,
//     shadow: 0x…,             optional: the look’s shadow colour
//     why: { art?, tone?, bloom? } }
// `own` (a renderer of its own kind), `tone: 'none'` and a bloom threshold
// under 1 each need their why.

import * as THREE from 'three';

export const ARTS = ['painted', 'scanned', 'own'];
export const TONES = ['house', 'none'];

// two palette colours nearer than this read as one at a glance
export const MIN_APART = 0.08;

// The roster (the spec’s table), a folder a row: a folder holds one look,
// so where one folder draws more than one world (Middle-earth’s bridge, ring,
// Gorgoroth and map backdrop; the Death Star and its trench) the look is
// the folder’s and its why says what differs. A folder inside another is
// its own entry, and the outer one’s sweep stops at it. (The phone out past
// the home system is a secret, kept out of every file but its own: its look
// is its own business, and the roster doesn’t name it.)
export const LOOK_FOLDERS = [
  { folder: 'universe', routes: ['/universe'] },
  { folder: 'universe/landings', routes: ['/universe'] },
  { folder: 'universe/shipyard', routes: ['/universe'] },
  { folder: 'galaxy', routes: ['/galaxy'] },
  { folder: 'galaxy/surface', routes: ['/galaxy/hoth/surface'] },
  { folder: 'expanse/flight', routes: ['/fly'] }, // planet flight (scripts/flight-island.mjs removes this row)
  { folder: 'deathstar', routes: ['/deathstar'] },
  { folder: 'deathstar/inside', routes: ['/deathstar/inside'] },
  { folder: 'cockpit', routes: ['/galaxy'] },
  { folder: 'hyperspace3d', routes: ['/galaxy'] },
  { folder: 'middleearth', routes: ['/middle-earth'] },
  { folder: 'middleearth/shire', routes: ['/middle-earth/shire'] },
  { folder: 'middleearth/towns', routes: ['/middle-earth/bree'] },
  { folder: 'middleearth/rush', routes: ['/middle-earth/shire'] },
  { folder: 'albuquerque/world', routes: ['/albuquerque'] },
  { folder: 'albuquerque/casa', routes: ['/albuquerque'] },
  { folder: 'albuquerque/metherria', routes: ['/albuquerque'] },
  { folder: 'office', routes: ['/scranton'] },
  { folder: 'office/world', routes: ['/scranton'] },
  { folder: 'cybertron', routes: ['/cybertron'] },
  { folder: 'cybertron/world', routes: ['/cybertron'] },
  { folder: 'cybertron/game', routes: ['/cybertron'] },
  { folder: 'cybertron/rollout', routes: ['/cybertron'] },
  { folder: 'avengers/world', routes: ['/avengers'] },
  { folder: 'avengers/hq', routes: ['/avengers'] },
  { folder: 'invincible/world', routes: ['/invincible'] },
  { folder: 'invincible/thinkmark', routes: ['/invincible'] },
  { folder: 'invincible/viewer', routes: ['/invincible'] },
  { folder: 'rickmorty', routes: ['/c-137'] },
  { folder: 'rickmorty/world', routes: ['/c-137'] },
  { folder: 'rickmorty/citadel', routes: ['/c-137/citadel'] },
  { folder: 'rickmorty/portal', routes: ['/c-137'] },
  { folder: 'rickmorty/wardrobe', routes: ['/c-137'] },
  { folder: 'caribbean/tide', routes: ['/caribbean'] },
  { folder: 'dotmatrix', routes: ['/dot-matrix'] },
  { folder: 'mario64', routes: ['/dot-matrix/64'] },
  { folder: 'minecraft', routes: ['/dot-matrix/minecraft'] },
  { folder: 'earth', routes: ['/earth'] },
  { folder: 'battlefront', routes: ['/battlefront/hoth/galacticAssault'] },
  { folder: 'music/world', routes: ['/music'] },
  { folder: 'projects/cartridges', routes: ['/projects'] },
  { folder: 'contact/plane', routes: ['/contact'] },
  { folder: 'ambience', routes: ['/home'] },
  { folder: 'experience/motif3d', routes: ['/experience'] },
  { folder: 'mist', routes: ['/home'] },
  { folder: 'peace', routes: ['/home'] },
  { folder: 'travel/akd3d', routes: ['/travel'] },
  { folder: 'travel/globe3d', routes: ['/travel'] },
];

// OKLab (Björn Ottosson’s), from three’s linear colour: the space where a
// distance is how different two colours look, which is what “apart” means
export function oklabDistance(a, b) {
  const lab = (hex) => {
    const { r, g, b: bl } = new THREE.Color(hex); // (linear: three converts from sRGB)
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

const isColour = (c) => (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 0xffffff) || (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c));
const said = (why, key) => typeof why?.[key] === 'string' && why[key].trim().length > 0;

export function validateLook(look) {
  if (!look || typeof look !== 'object') return ['look: not an object'];
  const out = [];
  const { art, palette, tone, bloom, shadow, why } = look;
  if (!ARTS.includes(art)) out.push(`art: ${JSON.stringify(art)} is not one of ${ARTS.join(', ')}`);
  if (art === 'own' && !said(why, 'art')) out.push('art: own, with no why.art');
  if (art === 'painted') {
    if (!Array.isArray(palette) || palette.length < 6 || palette.length > 16) out.push('palette: a painted world names six to sixteen colours');
    else if (!palette.every(isColour)) out.push('palette: a colour that is not #rrggbb or 0xrrggbb');
    else {
      for (let i = 0; i < palette.length; i++) {
        for (let j = i + 1; j < palette.length; j++) {
          const d = oklabDistance(palette[i], palette[j]);
          if (d < MIN_APART) out.push(`palette: ${palette[i]} and ${palette[j]} are ${d.toFixed(3)} apart, under ${MIN_APART}`);
        }
      }
    }
  } else if (palette !== undefined) out.push('palette: only a painted world has one');
  if (!TONES.includes(tone)) out.push(`tone: ${JSON.stringify(tone)} is not one of ${TONES.join(', ')}`);
  if (tone === 'none' && !said(why, 'tone')) out.push('tone: none, with no why.tone');
  if (bloom !== false) {
    const nums = bloom && ['threshold', 'strength', 'radius'].every((k) => typeof bloom[k] === 'number' && Number.isFinite(bloom[k]) && bloom[k] >= 0);
    if (!nums) out.push('bloom: false or { threshold, strength, radius }');
    else if (bloom.threshold < 1 && !said(why, 'bloom')) out.push(`bloom: a threshold of ${bloom.threshold}, under 1, with no why.bloom`);
  }
  if (shadow !== undefined && !isColour(shadow)) out.push('shadow: not a colour');
  return out;
}
