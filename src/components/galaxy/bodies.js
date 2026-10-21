// The planets and moons of the galaxy's star systems (systems.js names one
// by its look; world.js builds it, puts it where it goes and spins it).
// Every body is a perfect sphere (what the ship collides with) drawn by one
// shader (bodyShaders.js): the ground, its relief and its clouds all
// procedural, sampled on the sphere itself, as fine as the pixel it lands
// in, so a world's as good as a disc in the sky as it is with the ship
// skimming its dunes; round it, its atmosphere (a glow at the limb, a sky
// when you're down in it). Lit by its system's sun or suns.
//
// LOOKS: { [id]: { name, swatch, family, pal: { slot: '#rrggbb' }, p: { param: n },
//   flags, bump, clouds, atmo, shield, detail ([flat, steep] ground scans up
//   close: detailScans) } }; the families and their slots and
//   params are FAMILIES below
// buildBody(look, { r = 40, small = false, tier }) → { group, radius, reach,
//   update(t, camera), setSuns([{ dir, color }]), setDetail(k), set(name, value), dispose() }
//   look: an id (or a LOOKS entry); radius: the solid sphere, = r; reach:
//   how far it shows (atmosphere, shield); setDetail: how many octaves of
//   noise the ground is worked to, 0…1 from 4 up to all it was built with (9,
//   or 5 small), for a scene that's short of frame rate (and from orbit, on
//   tier high or ultra, two finer again: nearOctaves); set: 'shield'
//   (Scarif's shield, 0..1); anything else is ignored
// A look the game painted wears its skin from orbit (look.skin, from
// src/data/planetSkins.json; bodySkin.js): on tiers above low, its maps at the
// tier's size, giving way to the procedural ground in the air (update's camera)

import * as THREE from 'three';
import { SHIELD_FRAG, SHIELD_VERT, SURFACE_VERT, surfaceFrag } from './bodyShaders';
import { createAtmosphere, stepsFor } from '../../lib/three/atmosphere';
import { detailLevel } from '../../lib/detail';
import { loadScan, scanOf } from './surface/kit';
import { forgetTexture, loadTexture } from '../../lib/three/textures';
import PLANET_SKINS from '../../data/planetSkins.json';
import { skinFile, skinMixAt } from './bodySkin';
import { CHARTED_LOOKS } from './charted/looks';

// each family's colour slots (uPal, in order) and params (uP0, uP1)
export const FAMILIES = {
  desert: { slots: ['sand', 'sand2', 'rock', 'dark', 'salt', 'crest'], params: ['dunes', 'rock', 'craters', 'salt', 'scars', 'duneFreq', 'canyons', 'mesas'] },
  ice: { slots: ['snow', 'ice', 'rock', 'deep'], params: ['ice', 'mountains', 'crevasses'] },
  lush: { slots: ['deep', 'shallow', 'forest', 'grass', 'rock', 'snow', 'beach', 'murk'], params: ['sea', 'forest', 'mountains', 'caps', 'islands', 'swamp', 'rivers', 'scale'] },
  city: { slots: ['steel', 'brown', 'dark', 'plaza', 'warm', 'white'], params: ['lights', 'grid', 'districts', 'plazas'] },
  lava: { slots: ['crust', 'ash', 'hot', 'lava', 'ember'], params: ['rivers', 'lakes', 'glow', 'pulse'] },
  gas: { slots: ['band1', 'band2', 'band3', 'band4', 'band5', 'storm'], params: ['bands', 'turb', 'flow', 'fine', 'stormSize', 'stormLat', 'stormLon'] },
  moon: { slots: ['base', 'dark', 'bright', 'crack'], params: ['craters', 'maria', 'cracks'] },
};

// atmo: { color, top (shell radius, in radii), falloff, density, glow (toward the sun), sunset }
// clouds: { cover 0..1, sharp, drift (radians a second), scale, color }
const air = (color, density = 2, top = 1.06, sunset = '#ffa070', falloff = 3.5, glow = 0.8) => ({ color, top, falloff, density, glow, sunset });
const sky = (cover, color = '#ffffff', sharp = 1.6, scale = 3, drift = 0.004) => ({ cover, sharp, drift, scale, color });

export const LOOKS = {
  // ── Deserts ──
  tatooine: {
    name: 'Tatooine', swatch: '#d9b680', family: 'desert', bump: 0.022,
    pal: { sand: '#d4b88c', sand2: '#bf9868', rock: '#9a6c46', dark: '#5a3c26', salt: '#ece6d8', crest: '#e6d2ac' },
    p: { dunes: 1, rock: 0.12, craters: 0, salt: 0.75, scars: 0, duneFreq: 48, canyons: 1, mesas: 0.85 },
    atmo: air('#ffe0b8', 1.3, 1.04, '#ffa060', 4),
  },
  geonosis: {
    name: 'Geonosis', swatch: '#c0613a', family: 'desert', bump: 0.026, flags: ['CRATERS'], detail: ['redsoil', 'rock'],
    pal: { sand: '#c96a40', sand2: '#a9512d', rock: '#8c4024', dark: '#4a2016', salt: '#d99a6e', crest: '#da7e4e' },
    p: { dunes: 0.45, rock: -0.12, craters: 0.85, salt: 0.15, scars: 0, duneFreq: 40, canyons: 0.8, mesas: 1 },
    atmo: air('#ff9c5c', 2.2, 1.05, '#ff7040', 3),
  },
  // Mandalore: glassed in the Purge, a pale crust of fused glass and ash,
  // bomb scars and craters, a poisoned lilac haze
  mandalore: {
    name: 'Mandalore', swatch: '#a8a4b4', family: 'desert', bump: 0.02, flags: ['CRATERS', 'SCARS'], detail: ['gravel', 'rock'],
    pal: { sand: '#aaa6b4', sand2: '#8b8597', rock: '#5e5a68', dark: '#27232d', salt: '#dfe4f0', crest: '#c6c4d2' },
    p: { dunes: 0.25, rock: 0.02, craters: 0.6, salt: 0.6, scars: 1, duneFreq: 30, canyons: 0.5, mesas: 0.3 },
    clouds: sky(0.22, '#bdb4c8', 1.2, 2.8, 0.004),
    atmo: air('#b4a4d6', 1.9, 1.05, '#d08ab0', 3.6),
  },
  // ── Ice ──
  hoth: {
    name: 'Hoth', swatch: '#e6f0fa', family: 'ice', bump: 0.02,
    pal: { snow: '#e8eef6', ice: '#b6cce6', rock: '#5e6672', deep: '#46668e' },
    p: { ice: 0.4, mountains: 0.55, crevasses: 0.7 },
    clouds: sky(0.34, '#ffffff', 1.7, 4.8, 0.005),
    atmo: air('#a6ccff', 2.2, 1.065),
  },
  // ── Living worlds ──
  endor: {
    name: 'Endor', swatch: '#3f6a3a', family: 'lush', bump: 0.02, detail: ['needles', 'rock'],
    pal: { deep: '#123248', shallow: '#2a6870', forest: '#2a4c26', grass: '#66763c', rock: '#5a5246', snow: '#eef2f4', beach: '#8f8460', murk: '#2a3a2a' },
    p: { sea: -0.22, forest: 1.25, mountains: 0.3, caps: 0.05, islands: 0, swamp: 0, rivers: 0, scale: 2.3 },
    clouds: sky(0.3, '#ffffff', 1.8, 5),
    atmo: air('#8ac6d6', 2.3, 1.065),
  },
  yavin4: {
    name: 'Yavin 4', swatch: '#2f6b3a', family: 'lush', bump: 0.02, flags: ['RIVERS'],
    pal: { deep: '#0e384a', shallow: '#1f6a68', forest: '#245a26', grass: '#3a7a30', rock: '#4c5a40', snow: '#e0e8e0', beach: '#76764e', murk: '#24382a' },
    p: { sea: -0.12, forest: 1.2, mountains: 0.5, caps: 0, islands: 0, swamp: 0, rivers: 1, scale: 2.4 },
    clouds: sky(0.45, '#ffffff', 1.7, 4.8),
    atmo: air('#82ccbe', 2.7, 1.07),
  },
  kashyyyk: {
    name: 'Kashyyyk', swatch: '#2e5a34', family: 'lush', bump: 0.02, flags: ['ISLANDS'], detail: ['leaves', 'rock'],
    pal: { deep: '#0c2c52', shallow: '#1e6a8a', forest: '#224a20', grass: '#446832', rock: '#4a4a40', snow: '#e8eef0', beach: '#a09468', murk: '#22302a' },
    p: { sea: 0.02, forest: 1.1, mountains: 0.6, caps: 0.04, islands: 0.3, swamp: 0, rivers: 0, scale: 2.6 },
    clouds: sky(0.32, '#ffffff', 1.7, 4.8),
    atmo: air('#88c0e8', 2.2, 1.065),
  },
  dagobah: {
    name: 'Dagobah', swatch: '#4a5a40', family: 'lush', bump: 0.016, flags: ['SWAMP'],
    pal: { deep: '#1a2420', shallow: '#2c3828', forest: '#1f2b1a', grass: '#36402a', rock: '#3a362c', snow: '#a8aca0', beach: '#403c2c', murk: '#262e22' },
    p: { sea: -0.16, forest: 0.7, mountains: 0.25, caps: 0, islands: 0, swamp: 1, rivers: 0, scale: 2.5 },
    clouds: sky(0.55, '#7a8470', 0.7, 2.8, 0.003),
    atmo: air('#8a9a80', 2.6, 1.07, '#c09060'),
  },
  naboo: {
    name: 'Naboo', swatch: '#4d8a52', family: 'lush', bump: 0.02, flags: ['RIVERS'],
    pal: { deep: '#10386a', shallow: '#2a7aa0', forest: '#346a2e', grass: '#74a444', rock: '#6a6458', snow: '#f4f6f8', beach: '#c8b88a', murk: '#2a3a2a' },
    p: { sea: 0.0, forest: 0.45, mountains: 0.8, caps: 0.12, islands: 0, swamp: 0, rivers: 0.6, scale: 2.0 },
    clouds: sky(0.3, '#ffffff', 1.7, 4.6),
    atmo: air('#78b2ff', 2.3, 1.065),
  },
  lothal: {
    name: 'Lothal', swatch: '#9aa85a', family: 'lush', bump: 0.022, flags: ['RIVERS'],
    pal: { deep: '#1c4a6a', shallow: '#3a7f8e', forest: '#56763a', grass: '#a6b05c', rock: '#8a8272', snow: '#eef0ee', beach: '#c4b88a', murk: '#3a4a2a' },
    p: { sea: -0.24, forest: 0.12, mountains: 0.75, caps: 0.04, islands: 0, swamp: 0, rivers: 0.35, scale: 2.2 },
    clouds: sky(0.28),
    atmo: air('#8ab8f0', 2.2, 1.065),
  },
  sorgan: {
    name: 'Sorgan', swatch: '#3a6a3e', family: 'lush', bump: 0.02, flags: ['RIVERS', 'SWAMP'],
    pal: { deep: '#163a4a', shallow: '#2e6a6a', forest: '#2a5230', grass: '#5a7a40', rock: '#5a5648', snow: '#e8ece8', beach: '#7a7458', murk: '#2c3c2c' },
    p: { sea: -0.1, forest: 1, mountains: 0.4, caps: 0.02, islands: 0, swamp: 0.4, rivers: 0.6, scale: 2.6 },
    clouds: sky(0.4, '#f2f4f2', 1.6, 4.6),
    atmo: air('#94c4d0', 2.4, 1.065),
  },
  scarif: {
    name: 'Scarif', swatch: '#2fb8c0', family: 'lush', bump: 0.02, flags: ['ISLANDS'], shield: true,
    pal: { deep: '#0a3c7a', shallow: '#26cfc6', forest: '#2a8a34', grass: '#5ac04a', rock: '#6a7058', snow: '#ffffff', beach: '#f4ecd0', murk: '#2a3a2a' },
    p: { sea: 0.36, forest: 0.6, mountains: 0.3, caps: 0, islands: 1, swamp: 0, rivers: 0, scale: 2.0 },
    clouds: sky(0.26, '#ffffff', 2.4, 5),
    atmo: air('#86c6ff', 2.2, 1.065),
  },
  kamino: {
    name: 'Kamino', swatch: '#4a6278', family: 'lush', bump: 0.015, flags: ['STORMS'],
    pal: { deep: '#1a3346', shallow: '#2c4a5c', forest: '#3a4a40', grass: '#4a5a48', rock: '#4a5056', snow: '#d0d8e0', beach: '#6a7078', murk: '#2a3a3a' },
    p: { sea: 0.62, forest: 0.5, mountains: 0.3, caps: 0, islands: 0, swamp: 0, rivers: 0, scale: 2.2 },
    clouds: sky(0.55, '#a8b0ba', 1.1, 2.6, 0.006),
    atmo: air('#8a9eb4', 2.6, 1.065, '#d09070'),
  },
  // ── The city ──
  coruscant: {
    name: 'Coruscant', swatch: '#8a8478', family: 'city', bump: 0.01,
    pal: { steel: '#7c7e84', brown: '#7c6a56', dark: '#3a3a40', plaza: '#cac6ba', warm: '#ff9a3c', white: '#ffe2ae' },
    p: { lights: 2.1, grid: 1, districts: 0.8, plazas: 1 },
    clouds: sky(0.16, '#d8dce2', 1, 3),
    atmo: air('#a8b8da', 2.5, 1.06, '#ff9a60'),
  },
  // ── Volcanic ──
  mustafar: {
    name: 'Mustafar', swatch: '#5a1a10', family: 'lava', bump: 0.024,
    pal: { crust: '#141012', ash: '#3a3634', hot: '#ffd070', lava: '#ff4a10', ember: '#a01808' },
    p: { rivers: 1, lakes: 1, glow: 1, pulse: 1 },
    clouds: sky(0.25, '#3a2c2a', 1, 3, 0.003),
    atmo: air('#b0381e', 1.7, 1.06, '#ff5020'),
  },
  // Nevarro: mostly black lava flats under ash, a few rivers still glowing
  nevarro: {
    name: 'Nevarro', swatch: '#3a302c', family: 'lava', bump: 0.024,
    pal: { crust: '#201d1c', ash: '#5e5752', hot: '#ffc070', lava: '#ff5a1a', ember: '#6a2010' },
    p: { rivers: 0.28, lakes: 0.08, glow: 0.75, pulse: 0.4 },
    clouds: sky(0.18, '#6a605a', 1, 3, 0.003),
    atmo: air('#c09a84', 1.9, 1.05, '#ff8050'),
  },
  // ── Gas giants ──
  'endor-giant': {
    name: 'Endor', swatch: '#6a9498', family: 'gas', bump: 0.002,
    pal: { band1: '#5a8a8e', band2: '#7ea6aa', band3: '#4a6a7a', band4: '#9cbab6', band5: '#3e5a6a', storm: '#cadcd8' },
    p: { bands: 9, turb: 0.6, flow: 0.004, fine: 1, stormSize: 0.03, stormLat: -0.4, stormLon: 1 },
    atmo: air('#9ac4d0', 2.2, 1.03),
  },
  yavin: {
    name: 'Yavin', swatch: '#d0703c', family: 'gas', bump: 0.002,
    pal: { band1: '#a83c22', band2: '#d8763e', band3: '#f2d2a6', band4: '#c0542c', band5: '#e8a066', storm: '#f6e2c4' },
    p: { bands: 10, turb: 0.9, flow: 0.005, fine: 1.2, stormSize: 0.06, stormLat: 0.35, stormLon: 2.2 },
    atmo: air('#ffb080', 2.2, 1.03),
  },
  bespin: {
    name: 'Bespin', swatch: '#f0b898', family: 'gas', bump: 0.003,
    pal: { band1: '#e0a282', band2: '#ebc0a0', band3: '#d6887a', band4: '#f0d8bc', band5: '#cf9070', storm: '#f8e8d8' },
    p: { bands: 7, turb: 0.5, flow: 0.003, fine: 1, stormSize: 0, stormLat: 0, stormLon: 0 },
    atmo: air('#ffc8a0', 2.6, 1.035, '#ff8a6a'),
  },
  // ── The 2017 game's worlds (lane E5): each wears the game's skin from orbit
  // on mid and up (scripts/lib/bf2017-planets.mjs's SKINS); these are the
  // procedural grounds under them, and what low draws ──
  // Felucia: a fungus forest in every colour, little open water, a humid green haze
  felucia: {
    name: 'Felucia', swatch: '#6a9a3a', family: 'lush', bump: 0.02, flags: ['RIVERS'], detail: ['leaves', 'rock'],
    pal: { deep: '#1a3a3a', shallow: '#2e6a5a', forest: '#4a7a2c', grass: '#8aa43a', rock: '#7a6a4a', snow: '#e8ecd8', beach: '#b8a860', murk: '#2a3a24' },
    p: { sea: -0.3, forest: 1.3, mountains: 0.35, caps: 0, islands: 0, swamp: 0.2, rivers: 0.5, scale: 2.4 },
    clouds: sky(0.36, '#f4f8e8', 1.6, 4.4),
    atmo: air('#a8d8a0', 2.4, 1.065, '#ffb070'),
  },
  // Kessel: white salt flats and dark spice rock, a thin yellow air
  kessel: {
    name: 'Kessel', swatch: '#c8bca0', family: 'desert', bump: 0.024, flags: ['CRATERS'], detail: ['gravel', 'rock'],
    pal: { sand: '#c4b898', sand2: '#9a8c70', rock: '#5a4e46', dark: '#2e2824', salt: '#efeae0', crest: '#d8d0b8' },
    p: { dunes: 0.3, rock: 0.2, craters: 0.5, salt: 0.9, scars: 0, duneFreq: 30, canyons: 0.7, mesas: 0.4 },
    atmo: air('#e0d0a0', 1.2, 1.04, '#ffb060', 4),
  },
  // Sullust: black rock and sulphur, lava in the cracks, a brown-yellow haze
  sullust: {
    name: 'Sullust', swatch: '#4a3a30', family: 'lava', bump: 0.024,
    pal: { crust: '#2a2624', ash: '#6a645e', hot: '#ffc870', lava: '#ff6a20', ember: '#8a2a10' },
    p: { rivers: 0.5, lakes: 0.3, glow: 0.8, pulse: 0.6 },
    clouds: sky(0.3, '#8a7a66', 1, 3, 0.003),
    atmo: air('#c8b090', 2, 1.055, '#ff8a50'),
  },
  // Pillio: an ocean world, cliffs and coral islands under white cloud
  pillio: {
    name: 'Pillio', swatch: '#3a9ac8', family: 'lush', bump: 0.02, flags: ['ISLANDS'],
    pal: { deep: '#0c3a6a', shallow: '#2a9ab8', forest: '#3a7a44', grass: '#7aa860', rock: '#6a6a60', snow: '#f4f8fa', beach: '#e8dcb8', murk: '#2a3a3a' },
    p: { sea: 0.42, forest: 0.5, mountains: 0.5, caps: 0.06, islands: 0.8, swamp: 0, rivers: 0, scale: 2.2 },
    clouds: sky(0.38, '#ffffff', 1.8, 4.8),
    atmo: air('#8ac0ff', 2.3, 1.065),
  },
  // Vardos: grey-green, a terraced coast of cities under a cool haze
  vardos: {
    name: 'Vardos', swatch: '#6a7a6a', family: 'lush', bump: 0.018, flags: ['RIVERS'], detail: ['gravel', 'rock'],
    pal: { deep: '#1a3448', shallow: '#3a6a7a', forest: '#3a5a44', grass: '#7a8a6a', rock: '#6a6a66', snow: '#eef0f0', beach: '#a8a898', murk: '#2a3a34' },
    p: { sea: 0.1, forest: 0.6, mountains: 0.7, caps: 0.1, islands: 0, swamp: 0, rivers: 0.4, scale: 2.1 },
    clouds: sky(0.34, '#e8ecee', 1.4, 4.2),
    atmo: air('#9ab0c8', 2.4, 1.065, '#e0a080'),
  },
  // Fondor: an industrial world, grey and brown under its own smog, the yards' lights at night
  fondor: {
    name: 'Fondor', swatch: '#8a8278', family: 'city', bump: 0.01,
    pal: { steel: '#80807e', brown: '#7a6a58', dark: '#36363a', plaza: '#b8b4aa', warm: '#ffa848', white: '#ffe0b0' },
    p: { lights: 1.6, grid: 0.8, districts: 0.7, plazas: 0.6 },
    clouds: sky(0.3, '#c8c4bc', 1, 3, 0.003),
    atmo: air('#b0a898', 2.4, 1.06, '#ff9a60'),
  },
  // ── Moons ──
  'moon-grey': {
    name: 'Moon', swatch: '#8a8a88', family: 'moon', bump: 0.03,
    pal: { base: '#8c8c8a', dark: '#555553', bright: '#b6b6b2', crack: '#3a3a3a' },
    p: { craters: 1, maria: 0.5, cracks: 0 },
  },
  'moon-ice': {
    name: 'Ice moon', swatch: '#dfe8f0', family: 'moon', bump: 0.02, detail: ['snow', 'rock'],
    pal: { base: '#dfe8f0', dark: '#a8bccc', bright: '#ffffff', crack: '#6a8aa8' },
    p: { craters: 0.4, maria: 0.3, cracks: 1 },
  },
  'moon-dust': {
    name: 'Dusty moon', swatch: '#b89a72', family: 'moon', bump: 0.03, detail: ['sand', 'rock'],
    pal: { base: '#b89a72', dark: '#8a6e50', bright: '#d8c09a', crack: '#5a4a38' },
    p: { craters: 0.8, maria: 0.3, cracks: 0 },
  },
  'moon-rust': {
    name: 'Red moon', swatch: '#9a4a30', family: 'moon', bump: 0.03, detail: ['redsoil', 'rock'],
    pal: { base: '#9a4a30', dark: '#6a2e1e', bright: '#c07050', crack: '#4a1e14' },
    p: { craters: 0.8, maria: 0.4, cracks: 0 },
  },
  // ── The charted worlds' (charted/looks.js: one copy for both renderers) ──
  ...CHARTED_LOOKS,
};

// the game's skins, by look (scripts/bf2017-planets.mjs writes the file)
for (const [id, skin] of Object.entries(PLANET_SKINS)) if (LOOKS[id]) LOOKS[id].skin = skin;

const MIN_OCT = 4; // the fewest octaves of noise a ground is worked to, however little detail is asked for
// the ground scans a world wears up close (bodyShaders.js's DETAIL; at
// ultra their 8192 set where it's made, lib/three/core's coreFiles;
// public/cc0/galaxy/), [flat, steep]: by the look's own `detail`, else its
// family's (a swamp's is mud); a gas giant has no ground
const DETAIL_SCANS = { desert: ['sand', 'rock'], ice: ['snow', 'rock'], lush: ['grass', 'rock'], city: ['concrete', 'metal'], lava: ['ash', 'rock'], moon: ['gravel', 'rock'] };
export const detailScans = (L) => L.detail ?? (L.family === 'lush' && L.flags?.includes('SWAMP') ? ['mud', 'rock'] : DETAIL_SCANS[L.family]) ?? null;
const TILE = 0.45; // world units a tile of the coarser scan covers (the finer one's 6.5 times smaller)
let blank = null; // (what the samplers read until the scans are in: plain white, and a flat normal)
const blanks = () => {
  if (!blank) {
    const one = (r, g, b) => {
      const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
      t.needsUpdate = true;
      return t;
    };
    blank = { color: one(255, 255, 255), normal: one(128, 128, 255), none: one(0, 0, 0) };
  }
  return blank;
};
const SEG = { big: [128, 96], small: [64, 48], moon: [64, 48] };
// at ultra (lib/budgets' terrain row, 2), the sphere twice as fine each
// way, its ground worked to more octaves (MAX_OCT, and twice NEAR_OCT from
// orbit), its air marched in twice the steps (lib/three/atmosphere's stepsFor)
export const segmentsFor = (kind, level) => SEG[kind].map((n) => (level === 'ultra' ? n * 2 : n));
const MAX_OCT = { small: 5, big: 9, ultra: 11 };

// From orbit (the world over NEAR_PX pixels tall), on a strong enough
// device, the ground is worked NEAR_OCT octaves finer than its pixels'
// footprint alone would give it, and wears a fine grain that catches the
// sun (bodyShaders.js's octs and nearRelief): from a parking orbit the
// footprint, not the octave cap, is what held it soft
const NEAR_PX = 300;
const NEAR_OCT = 2;
const NEAR_EASE = 0.1; // octaves a frame drawn it eases in and out at (no pop as a world crosses NEAR_PX)
export const nearOctaves = ({ tier, pxTall: px }) => ((tier === 'high' || tier === 'ultra') && px > NEAR_PX ? (tier === 'ultra' ? NEAR_OCT * 2 : NEAR_OCT) : 0);
// how many of a `height`-pixel view's pixels a ball of radius r fills, top
// to bottom, from `dist` away with a vertical field of view of `fov` degrees
// (Infinity from inside it)
export const pxTall = ({ r, dist, fov, height }) => (dist <= r ? Infinity : ((2 * Math.asin(r / dist)) / ((fov * Math.PI) / 180)) * height);
const bufferSize = new THREE.Vector2();
const bodyAt = new THREE.Vector3();
const SHIELD_R = 1.12;
const DUNE_DIR = new THREE.Vector3(0.62, 0.32, 0.72).normalize();

// each look its own stretch of the noise (whole numbers, a way off)
const seedOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return new THREE.Vector3((h >>> 0) % 997, ((h >>> 10) >>> 0) % 991, ((h >>> 20) >>> 0) % 983);
};
const colors = (look) => {
  const out = FAMILIES[look.family].slots.map((n) => new THREE.Color(look.pal?.[n] ?? '#808080'));
  while (out.length < 8) out.push(new THREE.Color(0, 0, 0));
  return out;
};
const params = (look) => {
  const v = FAMILIES[look.family].params.map((n) => look.p?.[n] ?? 0);
  while (v.length < 8) v.push(0);
  return [new THREE.Vector4(...v.slice(0, 4)), new THREE.Vector4(...v.slice(4, 8))];
};

export function buildBody(look, { r = 40, small = false, tier = typeof document !== 'undefined' ? detailLevel() : 'mid', load = loadTexture } = {}) {
  const L = (typeof look === 'string' ? LOOKS[look] : look) ?? LOOKS['moon-grey'];
  const group = new THREE.Group();
  const made = [];
  const moon = L.family === 'moon' || r < 6;
  const [ws, hs] = segmentsFor(moon ? 'moon' : small ? 'small' : 'big', tier);
  const [p0, p1] = params(L);
  const atmo = L.atmo ?? null;
  const clouds = L.clouds ?? null;

  // shared by the surface, its atmosphere and its shield
  const shared = {
    uTime: { value: 0 },
    uR: { value: r },
    uCenter: { value: new THREE.Vector3() },
    uRot: { value: new THREE.Matrix3() },
    uSunDir: { value: [new THREE.Vector3(1, 0.3, 0.4).normalize(), new THREE.Vector3(1, 0.3, 0.4).normalize()] },
    uSunCol: { value: [new THREE.Color(1.25, 1.2, 1.1), new THREE.Color(0, 0, 0)] },
    uAtmo: { value: new THREE.Color(atmo?.color ?? '#000000') },
    uAtmoP: { value: new THREE.Vector4(atmo?.top ?? 1.05, atmo?.falloff ?? 3.5, atmo?.density ?? 0, atmo?.glow ?? 0.8) },
    uSunset: { value: new THREE.Color(atmo ? atmo.sunset : '#ffffff') },
  };
  const maxOct = small ? MAX_OCT.small : tier === 'ultra' ? MAX_OCT.ultra : MAX_OCT.big;
  const uniforms = {
    ...shared,
    uMaxOct: { value: maxOct },
    uNearOct: { value: 0 },
    uBump: { value: L.bump ?? 0.02 },
    uPal: { value: colors(L) },
    uP0: { value: p0 },
    uP1: { value: p1 },
    uCloud: { value: new THREE.Vector4(clouds?.cover ?? 0, clouds?.sharp ?? 1.5, clouds?.drift ?? 0.004, clouds?.scale ?? 3) },
    uCloudCol: { value: new THREE.Color(clouds?.color ?? '#ffffff') },
    uDir: { value: DUNE_DIR.clone() },
    uSeed: { value: seedOf(L.name + L.family) },
  };
  const defines = {};
  for (const f of L.flags ?? []) defines[f] = '';
  if (clouds) defines.CLOUDS = '';
  if (atmo) defines.ATMO = '';
  if (tier === 'ultra' && !small) defines.FBM_OCT = MAX_OCT.ultra + NEAR_OCT * 2;
  // the scans up close: in once both are loaded (on: uDetK.w)
  const scans = !small && typeof document !== 'undefined' && detailLevel() !== 'low' ? detailScans(L) : null;
  if (scans?.every(scanOf)) {
    defines.DETAIL = '';
    const b = blanks();
    Object.assign(uniforms, {
      uDetA: { value: b.color },
      uDetAN: { value: b.normal },
      uDetB: { value: b.color },
      uDetBN: { value: b.normal },
      uDetMean: { value: new THREE.Vector2(...scans.map((id) => Math.pow(scanOf(id).mean ?? 0.8, 2.2))) },
      uDetK: { value: new THREE.Vector4(r / TILE, 0.55, 0.22, 0) },
    });
    Promise.all(scans.map((id) => loadScan(id, { xl: tier === 'ultra' }))).then(([a, bb]) => {
      if (!a || !bb) return;
      uniforms.uDetA.value = a.map;
      uniforms.uDetAN.value = a.normalMap;
      uniforms.uDetB.value = bb.map;
      uniforms.uDetBN.value = bb.normalMap;
      uniforms.uDetK.value.w = 1;
    });
  }

  // the game's skin from orbit, where the import made one and the tier draws
  // it (not on a small body: the scans' rule, a scene short of power). Its
  // maps are shared by URL (lib/three/textures), and one body draws a planet
  const skin = !small && L.skin && skinFile(L.skin.color ?? L.skin.rings, tier) ? L.skin : null;
  const painted = Boolean(skin?.color); // (a skin may be rings alone: Geonosis's)
  const skinTex = []; // [{ url, texture }]: freed with the body
  let skinOn = 0; // (1 once its colour is in: until then the procedural look stands)
  let gone = false;
  const atmoBase = atmo ? { color: new THREE.Color(atmo.color), density: atmo.density } : null;
  const atmoSkin = painted && atmo ? { color: new THREE.Color(skin.atmo ?? atmo.color), density: atmo.density * (skin.atmoScale ?? 1) } : null;
  const take = (kind, color) => {
    const url = `/${skinFile(skin[kind], tier, kind)}`;
    return Promise.resolve(load(url, { color }))
      .then((t) => {
        if (gone) {
          t?.dispose?.();
          forgetTexture(url);
          return null;
        }
        skinTex.push({ url, texture: t });
        return t;
      })
      .catch(() => null); // (a map not there: the procedural look stands)
  };
  if (painted) {
    const b = blanks();
    defines.SKIN = '';
    if (skin.normal) defines.SKIN_NORMAL = '';
    if (skin.clouds) defines.SKIN_CLOUDS = '';
    if (skin.seas !== undefined) defines.SKIN_SEAS = '';
    Object.assign(uniforms, {
      uSkinColor: { value: b.color },
      uSkinNormal: { value: b.normal },
      uSkinClouds: { value: b.none },
      uSkinMix: { value: 0 },
      uSkinK: { value: new THREE.Vector4(skin.tiles ?? 1, 1, skin.greenDown ? -1 : 1, skin.seas ?? 0) },
      uSkinC: { value: new THREE.Vector4(skin.cloudTiles ?? 1, skin.cloudCut ?? 0, 0, 0) },
    });
    const into = (slot) => (t) => {
      if (!t) return null;
      t.wrapS = THREE.RepeatWrapping; // (round the planet; not over the poles)
      t.needsUpdate = true;
      uniforms[slot].value = t;
      return t;
    };
    take('color', true)
      .then(into('uSkinColor'))
      .then((t) => {
        if (t) skinOn = 1;
      });
    if (skin.normal) take('normal', false).then(into('uSkinNormal'));
    if (skin.clouds) take('clouds', false).then(into('uSkinClouds'));
  }

  const geo = new THREE.SphereGeometry(r, ws, hs);
  const mat = new THREE.ShaderMaterial({ vertexShader: SURFACE_VERT, fragmentShader: surfaceFrag(L.family, FAMILIES[L.family].slots, { skin: painted }), uniforms, defines });
  const surface = new THREE.Mesh(geo, mat);
  // (how tall it is on the screen, as it's drawn: the near octaves eased
  // toward what that asks for, a frame at a time)
  if (!small) {
    surface.onBeforeRender = (renderer, scene, camera) => {
      if (!camera?.isPerspectiveCamera) return;
      renderer.getDrawingBufferSize(bufferSize);
      surface.getWorldPosition(bodyAt);
      const want = nearOctaves({ tier, pxTall: pxTall({ r, dist: camera.position.distanceTo(bodyAt), fov: camera.fov, height: bufferSize.y }) });
      const n = uniforms.uNearOct;
      n.value += Math.max(-NEAR_EASE, Math.min(NEAR_EASE, want - n.value));
    };
  }
  group.add(surface);
  made.push(geo, mat);

  let reach = r;
  if (atmo) {
    // (lib/three's shell, the universe map's planets' too, reading this
    // body's own sun and air: its uniforms are the surface's)
    const shell = createAtmosphere({ radius: r, top: atmo.top, segments: moon || small ? [48, 32] : [96, 64], steps: tier === 'ultra' ? stepsFor('ultra', 7) : 7, inner: Math.cos(Math.PI / hs), uniforms: shared });
    group.add(shell.mesh);
    made.push(shell);
    reach = r * atmo.top;
  }

  // the skin's rings: the game's strip of them (across: the radius, down: the
  // way round, eight times), flat round the equator
  if (skin?.rings && skin.ringsAt) {
    const [inner, outer] = skin.ringsAt;
    const ringGeo = new THREE.RingGeometry(r * inner, r * outer, 128, 1);
    const uv = ringGeo.attributes.uv;
    for (let j = 0, k = 0; j <= 1; j++) for (let i = 0; i <= 128; i++, k++) uv.setXY(k, j, (i / 128) * 8);
    const ringMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, color: new THREE.Color(0.9, 0.9, 0.9) });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    group.add(ring);
    made.push(ringGeo, ringMat);
    reach = Math.max(reach, r * outer);
    take('rings', true).then((t) => {
      if (!t) return;
      t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      ringMat.map = t;
      ringMat.needsUpdate = true;
      ring.visible = true;
    });
  }

  let shield = null;
  let lastT = null; // (update's last clock, for how long since)
  if (L.shield) {
    const shieldGeo = new THREE.SphereGeometry(r * SHIELD_R, small ? 64 : 96, small ? 48 : 64);
    const shieldMat = new THREE.ShaderMaterial({ vertexShader: SHIELD_VERT, fragmentShader: SHIELD_FRAG, uniforms: { uShield: { value: 0 }, uTime: shared.uTime, uHit: { value: 0 }, uHitAt: { value: new THREE.Vector3(0, 1, 0) } }, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.visible = false;
    group.add(shield);
    made.push(shieldGeo, shieldMat);
    reach = Math.max(reach, r * SHIELD_R);
  }

  return {
    group,
    surface, // (the mesh a crash lays its shockwave over)
    radius: r,
    reach,
    // (the camera needn't be passed: the shaders know where it is)
    update(t, camera) {
      const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT));
      lastT = t;
      shared.uTime.value = t;
      if (shield && shield.material.uniforms.uHit.value > 0) shield.material.uniforms.uHit.value = Math.max(0, shield.material.uniforms.uHit.value - dt * 1.1); // (a bump's flash dies away in about a second)
      group.updateWorldMatrix(true, false);
      shared.uCenter.value.setFromMatrixPosition(group.matrixWorld);
      shared.uRot.value.setFromMatrix4(group.matrixWorld);
      if (painted && camera?.position) {
        const k = skinOn * skinMixAt(camera.position.distanceTo(shared.uCenter.value) / r, atmo?.top ?? 1.05);
        uniforms.uSkinMix.value = k;
        if (atmoSkin) {
          shared.uAtmo.value.lerpColors(atmoBase.color, atmoSkin.color, k);
          shared.uAtmoP.value.z = atmoBase.density + (atmoSkin.density - atmoBase.density) * k;
        }
      }
    },
    setSuns(suns = []) {
      const list = suns.length ? suns : [{ dir: new THREE.Vector3(1, 0.3, 0.4).normalize(), color: new THREE.Color(1.25, 1.2, 1.1) }];
      for (let i = 0; i < 2; i++) {
        const s = list[i];
        shared.uSunDir.value[i].copy((s ?? list[0]).dir).normalize();
        if (s) shared.uSunCol.value[i].copy(s.color);
        else shared.uSunCol.value[i].setRGB(0, 0, 0);
      }
    },
    setDetail(k) {
      uniforms.uMaxOct.value = Math.round(MIN_OCT + (maxOct - MIN_OCT) * Math.min(1, Math.max(0, Number(k) || 0)));
    },
    set(name, value) {
      const v = Math.min(1, Math.max(0, Number(value) || 0));
      if (name === 'shield' && shield) {
        shield.material.uniforms.uShield.value = v;
        shield.visible = v > 0.001;
      }
    },
    // a ship's bump into the shield at `point` (world space): a flash there
    // and a ring out across the shell, dying away over the next second.
    // False on a body with no shield
    hit(point) {
      if (!shield) return false;
      group.updateWorldMatrix(true, false);
      shield.material.uniforms.uHitAt.value.copy(point).applyMatrix4(group.matrixWorld.clone().invert()).normalize();
      shield.material.uniforms.uHit.value = 1;
      return true;
    },
    // (how far the last bump's flash has to go, 0 for none: for checking)
    get hitLeft() {
      return shield ? shield.material.uniforms.uHit.value : 0;
    },
    dispose() {
      gone = true;
      for (const m of made) m.dispose();
      made.length = 0;
      for (const { url, texture } of skinTex) {
        texture.dispose();
        forgetTexture(url);
      }
      skinTex.length = 0;
    },
  };
}
