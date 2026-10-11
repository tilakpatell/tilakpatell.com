// A world's look for the house (lib/three/house: shade as a colour, fog as
// the sky), from its site: what the site says in `look`, and the rest from
// its sky. Pure, so it's tested.
//
//   lookOf(site) → { shadow, edge, mix, fogLow, fogHigh, fogBelow, halo,
//     fogMix, exposure } (the house's LOOK shape, colours as ints)
//   exposureOf(site, base = 1) → the exposure: the site's own (1 unless it
//     says) times `base` (1 on the surface: its post tone-maps with its own
//     shoulder, universe/post.js, so the house's ACES-to-Neutral lift isn't
//     wanted there)
//   groundPieces(site) → { map, grass, bounce }: which ground pieces a world
//     gets (none with no ground under it; grass only where the site grows
//     some)
//   adoptLater(house, object) → how many lit materials of something added
//     after the scene was adopted the house took on (0 for nothing)
//
//   LOOK: the world's look for components/worlds/looks.js (its art, tone and
//     bloom, and why)
//
// A site's `look`: { shadow, edge: [from, to], fogBelow, halo } (colours as
// '#rrggbb', as the sites write them); left out, the shadow is the sky a
// third of the way from its zenith to its horizon, darkened: a blue sky
// shades blue, a sunset violet.

import * as THREE from 'three';
import { LOOK as HOUSE } from '../../../lib/three/houseNodes';

const SHADOW_MIX = 1 / 3;
const SHADOW_DARK = 0.55;

const isColour = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isUnit = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const toInt = (v) => new THREE.Color(v).getHex();

export function lookOf(site) {
  const sky = site?.sky ?? {};
  const zenith = new THREE.Color(sky.zenith ?? '#3f7ccc');
  const horizon = new THREE.Color(sky.horizon ?? '#f6dfb0');
  const shadow = zenith.clone().lerp(horizon, SHADOW_MIX).multiplyScalar(SHADOW_DARK);
  const own = site?.look && typeof site.look === 'object' ? site.look : {};
  return {
    ...HOUSE,
    shadow: isColour(own.shadow) ? toInt(own.shadow) : shadow.getHex(),
    edge: Array.isArray(own.edge) && own.edge.length === 2 && own.edge.every(isUnit) ? [own.edge[0], own.edge[1]] : HOUSE.edge,
    fogLow: horizon.getHex(),
    fogHigh: zenith.getHex(),
    fogBelow: isUnit(own.fogBelow) ? own.fogBelow : HOUSE.fogBelow,
    halo: isColour(own.halo) ? toInt(own.halo) : HOUSE.halo,
    exposure: exposureOf(site, HOUSE.exposure),
  };
}

export const exposureOf = (site, base = 1) => (isUnit(site?.exposure) && site.exposure > 0 ? site.exposure : 1) * base;

export function groundPieces(site) {
  if (site?.noGround) return { map: false, grass: false, bounce: false };
  return { map: true, grass: Boolean(site?.grass), bounce: true };
}

export const adoptLater = (house, object) => (object ? house.adopt(object) : 0);

// The surfaces’ look (components/worlds/looks.js): scanned, the sites’
// glTF people, walkers, landmarks and props under the house’s shade (above:
// a site’s sky). Like the galaxy map they go through the universe’s lens
// (universe/post.js, lane 2C’s), which tone-maps and grades in its last
// pass and has its own bloom, so the renderer maps no tone and this owns no
// bloom. What isn’t scanned: the crew’s and the people’s toon ramp comes in
// with rickmorty/portal/meshyCast.js’s animator, and the core kit
// (./kit.js, ./detail.js) draws some props in code.
export const LOOK = {
  art: 'scanned',
  tone: 'none',
  bloom: false,
  why: {
    art: 'the people’s animator (rickmorty/portal/meshyCast.js) brings a toon ramp, and the core kit draws some props in code',
    tone: 'the universe’s lens (universe/post.js) tone-maps and grades the picture in its last pass, so the renderer maps none',
    bloom: 'the lens’s own bloom (universe/post.js, a threshold of 1.7): only the sun, lamps, engines and bolts glow',
  },
};
