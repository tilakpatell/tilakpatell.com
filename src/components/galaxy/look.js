// The galaxy map’s look (components/worlds/looks.js): its own. The planets,
// the stars, most of the ships and the war’s fleets are drawn in code, with
// a few models (the big ships, the Falcon, Slave I) lit under the house
// look’s shade (houseOn with its tone mapper off, ./scene.js).
//
// It shares the universe map’s lens (universe/post.js, lane 2C’s): that
// pass tone-maps the picture itself (Khronos’ neutral shoulder without its
// toe, so the faint Milky Way stays as drawn) and grades it. So the
// renderer maps no tone.
//
// The bloom is its own, a halo and not a veil. With the map’s (a threshold
// of 1.7, strength 0.8, radius 0.55) a battle’s dogfight had the darkest
// half of the frame lifted to a mean luma of 0.09–0.15 from black: three’s
// pass glows a texel’s whole light once it’s over the line, and a radius
// of 0.55 weighs the widest, 1/32-scale mip as much as the sharpest, so a
// few hundred bolts fogged the whole frame green. Here only the light over
// the line glows (a soft knee of 0.5 round 1.4), the wide mips fall away
// (falloff), a flare scales it by 1.6 at the most, and its first level is
// up to 960 across on a large screen, so a thin bolt’s glow holds still.
// Measured at a forced Endor battle (scripts/galaxy-bloom-check.mjs): the
// darkest half of a dogfight 0.022, of a panorama 0.0004 (from 0.033–0.044).
//
// The models' shade is space's, as the films' and the 2017 game's capital
// ships are lit: a hard sun, and the side away from it a dark cool grey with
// its plating still in it, not the house's blue-violet (which on a Star
// Destroyer's 1,600 m read as a navy slab). `house` is the house look's
// (lib/three/house: its shade leaned most of the way to grey, the turn to
// shade quick, and only part of the shade the look's own colour, so the
// light the environment gives each face, the relief, shows through);
// `space` the light the shade is made of: the ambient's colour and its share
// of the ambient the scene sets (`fill`), the dark of the sky the
// environment is drawn on (what metal and the shade reflect, ./scene.js's
// systemEnvironment) and the bounce opposite the sun, a little blue (a
// planet's, the nebula's), not a saturated blue.
// Leaned toward the 2017 game's own art, as the owner chose (its
// Starfighter Assault tile, public/ui/bf2017/bitmaps/tiles-starfighter-small:
// a hull dark and cool away from the sun, its lit edges hard against it),
// past the films' measure it was first set to.
//
// And measured against the game's own frames (its campaign's cinematics,
// public/films/bf2017/a1-m1end-ds05 and a1-m2fon-ds01): a lit Star
// Destroyer's hull there is a bright, slightly cool plane (a median luma of
// 178 of 255, blue a little over red), its shade dark but not black (a
// median of 11 to 19, its edges catching light). Ours was a warm mid-grey
// deck (97 in a battle) over a navy void (3 to 7, blue at 2.5 to 3 times
// red): Endor's sun is 21 degrees up, so every deck took the light edge-on.
// So the ships' key (`space.key`, keyLight) is the system's sun lifted to 40
// degrees at the least (its bearing kept; the sky's disc, the planets and
// the eclipse keep the real sun), a third brighter and cooled to the game's
// white at the same luminance; the shade is lifted and made a neutral grey
// (`ambient`, `fill`, `house.grey`, the bounce); and a dim cool kicker
// (`space.kicker`, the second light where a system has one sun) shines from
// opposite the sun and a little below, so the side away has its edges and
// its plates, as the game's has.

import * as THREE from 'three';

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: Object.freeze({ threshold: 1.4, knee: 0.5, strength: 0.5, radius: 0, falloff: Object.freeze([1, 0.6, 0.3, 0.12, 0.04]), flareMax: 1.6, cap: 960 }),
  house: Object.freeze({ grey: 0.8, edge: Object.freeze([0.06, 0.45]), mix: 0.6 }),
  space: Object.freeze({
    ambient: '#a6adb9',
    fill: 0.8,
    sky: '#101216',
    bounce: Object.freeze([0.07, 0.075, 0.09]),
    // the ships' key: its intensity, the least height of its sun (degrees),
    // the cool it leans to and how far
    key: Object.freeze({ intensity: 3.3, least: 40, cool: '#eef3ff', toCool: 0.65 }),
    // the dim light from the far side of a one-sun system, a little below
    kicker: Object.freeze({ colour: '#b4c0d4', intensity: 0.45, below: 0.35 }),
  }),
  why: {
    art: 'drawn in code: the planets, the stars, the lanes, most ships and the fleets; the few models take the house’s shade',
    tone: 'the universe map’s lens (universe/post.js) tone-maps and grades the picture in its last pass, so the renderer maps none',
    bloom: 'a halo, not a veil: only the light over 1.4 glows (a soft knee), the wide mips fall away, so a battle’s hundreds of bolts don’t fog the frame; the sun, engines and shots glow',
  },
};

// (a colour's luminance, Rec. 709, in its linear values)
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

// The ships' key from a system's sun: its direction lifted to `least`
// degrees above the plane if it's lower, its bearing kept, and its colour
// leaned toward the game's cool white at the same luminance.
//   dir: [x, y, z] or a Vector3; colour: a Color or anything Color takes
export function keyLight(dir, colour, key = LOOK.space.key) {
  const d = (Array.isArray(dir) ? new THREE.Vector3(...dir) : dir.clone()).normalize();
  const h = Math.hypot(d.x, d.z);
  d.y = Math.max(d.y, Math.tan((key.least * Math.PI) / 180) * h);
  d.normalize();
  const c = new THREE.Color(colour);
  const cool = new THREE.Color(key.cool);
  cool.multiplyScalar(lum(c) / lum(cool));
  return { dir: d, colour: c.lerp(cool, key.toCool) };
}

// The kicker's direction: from opposite the sun, a little below
export function kickerDir(sunDir, kicker = LOOK.space.kicker) {
  const d = Array.isArray(sunDir) ? new THREE.Vector3(...sunDir) : sunDir.clone();
  return new THREE.Vector3(-d.x, -kicker.below, -d.z).normalize();
}
