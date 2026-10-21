// Each place's world: what stands round it and who's about in it, for
// ./outskirts.js to lay out and ./surround.js to draw (stage.js reads a
// place's record by its id). Imported only by stage.js and the places'
// builders, so the records never reach the page's first download (the
// solids a gathering stands on are ./blocks.js's, which the rules read).
//
// A record (the spec's "A world record",
// docs/superpowers/specs/2026-10-21-rm-worlds-not-rooms-design.md):
//   look { walls, roofs, lit, trim, night }   the code buildings' colours
//   edge { kind, h, color, models }           outdoors: kerb, rail, fence,
//                                             barrier, wall; rocks or bushes (models)
//   ring { n, e, s, w }: { styles, rows, h, sets: [{ model, h, n }] } | null
//   far { n, e, s, w }: { styles, h } | null    the skyline
//   vista, hero [dx, dz]                       the open view north from the
//                                             way in, and what it's on
//   forecourt { path: { w, color }, props: [{ model, h, n }] }
//   crowd { walk: [{ kinds, n: { high, mid, low }, loop: 'street' | [[dx, dz]…], speed, until, after }],
//           gather: [{ kinds, n, at: [dx, dz], r, face: 'hero' | [dx, dz], block, until, after }] }
//     (a room's crowd outside goes on low, but one marked `always`, a gathering's
//     or a stand's: the view itself, a dome of Mortys)
//   fliers [{ model, n, y: [lo, hi], speed, h, climb: [dx, dz] }]   (climb: straight
//                                             up from that pad instead of across)
//   windows [{ wall, from, to, y0, h, mullion }], outside 'ground' | 'space',
//     sky, fog, ground                         a room's
//   bodies [{ bearing, up, size, color }]      a space room's planets and moons:
//                                             degrees round from north to the east,
//                                             up over the eye, and across
//   sight [{ from: [dx, y, dz], to: [dx, y, dz] }]   lines nothing round it may stand in
//   watch 'morty'                              its crowd watches Morty always, not only
//                                             while the place hunts him
//   pieces [{ model, at: [dx, dz], turn, h, w, d, y, spin, own }]   the place's own
//     models where its code buildings stood (a set piece's file, by path),
//     on every level, casting their shadows; `spin` radians a second; `own`
//     the spot that's its own (the siren's pull), which it may stand by
// A crowd kind is one of the cast's (../../portal/meshyCastCore.js's MESHY)
// or one of the Citadel's light copies (`crowd:<name>`, /games/meshy/crowd).
// The rest of the places' records are ./worlds2.js's, merged in here.

import { WORLDS2 } from './worlds2';

// each crowd kind's triangles (its model's own, held to the file by
// ./worlds.test.js): what a level's crowd allowance is counted in
export const TRIS = {
  zigerion: 9377,
  "zigerion-b": 9364,
  "zigerion-c": 9256,
  stairgoblin: 29215,
  hepatitis: 31307,
  gonorrhoea: 31200,
  tuberculosis: 31159,
  plague: 30934,
  ecoli: 31245,
  "jerry-robe": 9263,
  "jerry-golf": 9385,
  "jerry-tux": 9261,
  "jerry-track": 9198,
  "jerry-gown": 9215,
  "jerry-cardigan": 9269,
  "magdalian-a": 9382,
  "magdalian-b": 9301,
  "magdalian-c": 9356,
  "plutonian-a": 9251,
  "plutonian-b": 9248,
  "gearperson-a": 9156,
  "gearperson-b": 9227,
  simman: 14018,
  primedrone: 13770,
  "froopy-a": 14595,
  "froopy-b": 14507,
  "heister-a": 14446,
  "heister-b": 14555,
  "snake-a": 12461,
  "snake-b": 12541,
  snakeastronaut: 14433,
  mytholog: 14609,
  gloopnurse: 14392,
  "resortguest-a": 14372,
  "resortguest-b": 14406,
  "deathstalker-a": 14486,
  "deathstalker-b": 14525,
  agencyguard: 14481,
  sewerrat: 12496,
  frundles: 12478,
  frundlesdog: 12466,
  mrspancakes: 14439,
  meeseeks: 8311,
  gromflomite: 8356,
  gazorpian: 9380,
  cronenberg: 9405,
  cop: 8309,
  fedagent: 10390,
  secretservice: 10350,
  glipglop: 30591,
  atlantean: 30542,
  zeep: 41082,
  birdperson: 40834,
  general: 10307,
  president: 12403,
  "crowd:morty": 3179,
  "crowd:sheriffmorty": 2774,
  "crowd:retrorick": 2742,
  "crowd:hazmatrick": 3592,
  "crowd:maskmorty": 3238,
  "crowd:cop": 3208,
  "crowd:hobbitmorty": 4152,
  "crowd:visorrick": 3576,
  "crowd:doofusrick": 3216,
  "crowd:suitrick": 4531,
  "crowd:simplerick": 6010,
  "crowd:slickmorty": 7483,
  "crowd:supremeguard": 4383,
  "crowd:sweaterrick": 4372,
  "crowd:punkmorty": 2870,
  "crowd:punkrick": 6242,
  "crowd:pilotrick": 3456,
  "crowd:garmentrick": 3166,
  "crowd:bigmorty": 8506,
  "crowd:rick": 3890,
  "crowd:factoryrick": 4284,
  "crowd:copmorty": 4270,
  "crowd:overallsmorty": 2466,
  "crowd:constructionrick": 4030,
  "crowd:evilrick": 9567,
  "crowd:glassesmorty": 3267,
  "crowd:astronautmorty": 3478,
  "crowd:rickd3": 9064,
  "crowd:beaniemorty": 2666,
  "crowd:detectiverick": 4599,
  "crowd:chefrick": 3756,
  "crowd:sheriffrick": 3806,
  "crowd:mulletrick": 4155,
  "crowd:cowboyrick": 4831,
  "crowd:wizardrick": 3226,
};

// (an Earth audience: the Citadel's light copy of a police officer, the only
// generic Earth figure light enough to pack a stadium with)
const EARTH = ['crowd:cop'];
const STAGE = [0, -14];
// the stands' concrete, pale under the dusk so the audience reads on it
const STANDS = { walls: [0xb8b4ac, 0x9a968e], roofs: [0x8a867e], lit: [0xffe24a], trim: 0x6a665e };

// a day's sky, for a room's outside that hasn't one of its own
const DAY = { top: 0x2a6ac8, mid: 0x8ac8f0, low: 0xe8f4f8, sun: 0xfff6d8, clouds: 1, moons: 0 };
const FEDSHIP = '/models/c137/fedship.glb';

export const WORLDS = {
  // Interdimensional Customs: the north wall glazed onto the spaceport's
  // apron (hangars, a control tower, Federation ships on their pads) and the
  // alien city that was painted there, made 3D in its own colours; a queue
  // from other dimensions in the pen by the far arch
  customs: {
    look: { walls: [0xe8e4d8, 0xd8dcd4, 0xc8d0ca], roofs: [0xb8506a, 0xe07a3a, 0x5a9ab8, 0x9ac85a, 0xb86a9a, 0xd8a04a, 0x6ab88a], lit: [0x9dffb8, 0xffe08a], trim: 0x5a6a64 },
    windows: [{ wall: 'n', from: -15, to: 15, y0: 0.6, h: 5.9, mullion: 2.5 }],
    outside: 'ground',
    ground: 0xd8c890,
    sky: { top: 0xe8b860, mid: 0xf6d27a, low: 0xfbeab2, sun: 0xfff6d8, clouds: 0.4, moons: 1 },
    ring: { n: { styles: ['hangar', 'dome', 'block'], rows: 2, h: [8, 14], sets: [{ model: FEDSHIP, h: 4, n: 2 }] }, e: null, s: null, w: null },
    far: { n: { styles: ['mushroom', 'spire', 'tower'], h: [45, 90] } },
    landmarks: [{ at: [-30, -44], style: 'tower', w: 8, d: 8, h: 30 }],
    crowd: {
      gather: [
        { kinds: ['zigerion', 'gearperson-a', 'plutonian-a', 'magdalian-a'], n: { high: 16, mid: 10, low: 5 }, at: [-12.5, 7], r: 2.5, face: [-6, 0], block: 'queue' },
        { kinds: ['gearperson-b', 'zigerion-b'], n: { high: 8, mid: 5, low: 0 }, at: [6, -40], r: 5, face: [6, -70] },
      ],
    },
    fliers: [
      { model: FEDSHIP, n: { high: 2, mid: 1, low: 0 }, y: [40, 70], speed: 18, h: 4 },
      { model: '/models/c137/rm/zigerion-ship.glb', n: { high: 1, mid: 1, low: 0 }, y: [95, 115], speed: 5, h: 40 },
    ],
  },

  // the cable studio: the west wall's windows on the studio lot (sound
  // stages, a broadcast mast), a studio audience on the gallery by the east
  // wall, facing the sets; crew on the lot
  cablestudio: {
    look: { walls: [0x8a8a92, 0x7a7a84, 0x9a948a], roofs: [0x5a5a64, 0x3a3a44], lit: [0xffe08a, 0x6ad8ff], trim: 0x2a2a30 },
    windows: [{ wall: 'w', from: -10, to: 2, y0: 1.2, h: 4.6, mullion: 2 }],
    outside: 'ground',
    ground: 0x7a7a72,
    sky: DAY,
    ring: { w: { styles: ['hangar', 'block'], rows: 2, h: [10, 16] }, n: null, e: null, s: null },
    far: { w: { styles: ['tower', 'block'], h: [45, 80] } },
    landmarks: [{ at: [-50, -6], style: 'mast', w: 6, d: 6, h: 36 }],
    crowd: {
      gather: [{ kinds: ['gearperson-b', 'plutonian-b', 'magdalian-b'], n: { high: 10, mid: 7, low: 4 }, at: [18, 15.5], row: 7, y: 1, face: [18, 0], block: 'gallery' }],
      walk: [{ kinds: ['zigerion-c', 'gearperson-a'], n: { high: 6, mid: 4, low: 0 }, loop: 'street', speed: 1.1 }],
    },
  },

  // the Meeseeks' golf course: the clubhouse due north, Jerry's suburb
  // either side, trees on the fairways running on, a hedge for an edge; the
  // Meeseeks' mob on the clubhouse terrace (every one of them a hunter here:
  // beyond the edge)
  meeseeksgolf: {
    look: { walls: [0xf2ecd8, 0xe8dcc0, 0xdde6ee], roofs: [0x7a4a3a, 0x3a5a7a, 0x5a6a4a], lit: [0xfff4c0], trim: 0x5a4a3a },
    edge: { kind: 'bushes', h: 0.9, models: ['q:Bush_Common_Flowers', 'q:Bush_Long_1'] },
    ring: { e: { styles: ['house'], rows: 2, h: [7, 10] }, w: { styles: ['house'], rows: 2, h: [7, 10] }, s: { styles: ['house'], rows: 1, h: [7, 9] }, n: null },
    far: null,
    hero: [0, -48],
    vista: 0.3,
    landmarks: [{ at: [0, -50], style: 'house', w: 26, d: 14, h: 12 }],
    scatter: [
      { model: 'q:CommonTree_3', h: 9.4, n: { high: 34, mid: 20, low: 8 }, r: [18, 170] },
      { model: 'q:CommonTree_5', h: 7, n: { high: 18, mid: 10, low: 4 }, r: [15, 110] },
    ],
    forecourt: { path: { w: 2.4, color: 0xd8d0b8 }, props: [{ model: 'q:Flower_3_Single', h: 0.6, n: 10 }] },
    crowd: { gather: [{ kinds: ['meeseeks'], n: { high: 20, mid: 12, low: 5 }, at: [0, -38], r: 5, face: [0, 0] }] },
  },

  // the simulation: the hangar's sky-blue walls kept, no window out; the
  // copy-pasted townsfolk walking one line in lockstep (2% of a CPU), and
  // Zigerion staff along the raised walkway
  simulation: {
    outside: null,
    crowd: {
      walk: [{ kinds: ['simman'], n: { high: 12, mid: 8, low: 4 }, loop: [[-24, -12], [-24, 14]], speed: 1 }],
      gather: [
        { kinds: ['zigerion'], n: { high: 4, mid: 3, low: 2 }, at: [-17, -17.6], row: 10, y: 3.2, face: [-17, 0], block: 'walkway' },
        { kinds: ['zigerion'], n: { high: 4, mid: 3, low: 2 }, at: [17, -17.6], row: 10, y: 3.2, face: [17, 0], block: 'walkway' },
      ],
    },
  },

  // the agency at night: windows north and east on the city's lit towers;
  // rats running the west wall's skirting; the guards' kind only out past the glass
  agency: {
    look: { walls: [0x3e3e56, 0x4a4a66, 0x34344a], roofs: [0x22222e], lit: [0xffe08a, 0x9ad8ff, 0xff8a5a], trim: 0x101018, night: true },
    windows: [
      { wall: 'n', from: -21, to: -8, y0: 1.4, h: 4, mullion: 2.2 },
      { wall: 'n', from: 5, to: 21, y0: 1.4, h: 4, mullion: 2.2 },
      { wall: 'e', from: -18, to: -2, y0: 1.4, h: 4, mullion: 2.2 },
    ],
    outside: 'ground',
    ground: 0x1e1e26,
    sky: { top: 0x05050f, mid: 0x1e1e4a, low: 0x4a3a6a, sun: 0xb0b0ff, clouds: 0, moons: 1 },
    ring: { n: { styles: ['tower', 'block'], rows: 2, h: [14, 30] }, e: { styles: ['tower', 'block'], rows: 2, h: [14, 30] }, s: null, w: null },
    far: { n: { styles: ['tower'], h: [80, 140] }, e: { styles: ['tower'], h: [80, 140] } },
    crowd: {
      walk: [{ kinds: ['sewerrat'], n: { high: 6, mid: 4, low: 2 }, loop: [[-20.5, -18], [-20.5, 18]], speed: 1.6 }],
      gather: [{ kinds: ['agencyguard'], n: { high: 4, mid: 3, low: 0 }, at: [8, -34], r: 2.5, face: [8, 0] }],
    },
  },

  // the Microverse: the north window made real, on Zeep's white towers and,
  // out on the plaza, his people stomping in time
  microverse: {
    look: { walls: [0xf2f6f2, 0xdbe8de, 0xe8f0ea], roofs: [0x3fb46a, 0xf2f6f2], lit: [0x9dffb8], trim: 0x2f8a52 },
    windows: [{ wall: 'n', from: -4.7, to: 4.7, y0: 1, h: 2.6, mullion: 1.6 }],
    outside: 'ground',
    ground: 0xdfe8df,
    sky: { top: 0x2f8a52, mid: 0x8ae0a8, low: 0xe8fff0, sun: 0xf8fff0, clouds: 0.6, moons: 0 },
    ring: { n: { styles: ['spire', 'dome', 'tower'], rows: 2, h: [10, 22] }, e: null, s: null, w: null },
    far: { n: { styles: ['spire', 'tower'], h: [60, 110] } },
    crowd: { gather: [{ kinds: ['zeep'], n: { high: 3, mid: 2, low: 0 }, at: [0, -40], r: 2, face: [0, -70], beat: 1 }] },
  },

  // Fantasy World: a village of Tudor houses round the square, hills and a
  // castle's towers beyond, woods out to the fog, and up the beanstalk, on a
  // cloud, the giants' castle: P8's climb on screen from the way in
  fantasy: {
    look: { walls: [0xf2e8d0, 0xe8dcc0, 0xf6eedc], roofs: [0x8a5a3a, 0x6a4a3a, 0x7a6a4a], lit: [0xffe08a], trim: 0x4a3020 },
    edge: { kind: 'fence', h: 1.2, color: 0x7a5a3a },
    ring: { e: { styles: ['tudor'], rows: 2, h: [7, 11] }, w: { styles: ['tudor'], rows: 2, h: [7, 11] }, s: { styles: ['tudor', 'hut'], rows: 1, h: [6, 9] }, n: { styles: ['tudor'], rows: 1, h: [7, 10] } },
    far: { n: { styles: ['berm', 'spire'], h: [32, 60] }, e: { styles: ['berm'], h: [32, 50] }, w: { styles: ['berm', 'spire'], h: [32, 60] }, s: { styles: ['berm'], h: [32, 50] } },
    hero: [-6, -19],
    vista: 0.26,
    landmarks: [
      { at: [-22, -24], y: 52, style: 'dome', w: 28, d: 22, h: 7, look: { walls: [0xffffff], roofs: [0xf2f6ff], lit: [0xffffff], trim: 0xe8eef8 } },
      { at: [-22, -24], y: 56, style: 'tower', w: 14, d: 14, h: 22, look: { walls: [0xb8b4a8, 0xa8a49a], roofs: [0x6a5a7a], lit: [0xffe08a], trim: 0x5a5650 } },
    ],
    scatter: [
      { model: 'q:CommonTree_4', h: 9.4, n: { high: 30, mid: 18, low: 8 }, r: [20, 170] },
      { model: 'q:Pine_4', h: 10.2, n: { high: 20, mid: 12, low: 6 }, r: [30, 190] },
    ],
    forecourt: { path: { w: 2.6, color: 0x9a9080 }, props: [{ model: 'q:Flower_1_Single', h: 0.5, n: 8 }, { model: 'q:Rock_Medium_2', h: 0.6, n: 4 }] },
  },

  // Froopyland: mushroom houses and candy domes round the meadow, Beth's
  // castle to the north, candy hills beyond; the Froopylanders (its
  // hunters) out past the hedge only
  froopyland: {
    look: { walls: [0xff9ad8, 0xa8e8ff, 0xfff09a, 0xb8ffb0, 0xffc090], roofs: [0xff6ab0, 0x6ad8ff, 0xffd84a, 0xa86aff], lit: [0xffffff], trim: 0xffffff },
    edge: { kind: 'bushes', h: 0.9, models: ['q:Bush_Common_Flowers'] },
    ring: { e: { styles: ['mushroom', 'dome'], rows: 2, h: [6, 12] }, w: { styles: ['mushroom', 'dome'], rows: 2, h: [6, 12] }, s: { styles: ['mushroom'], rows: 1, h: [6, 10] }, n: null },
    far: { n: { styles: ['dome', 'mushroom'], h: [32, 60] }, e: { styles: ['dome'], h: [32, 55] }, w: { styles: ['dome'], h: [32, 55] }, s: { styles: ['dome'], h: [32, 50] } },
    hero: [0, -60],
    landmarks: [{ at: [0, -60], style: 'tower', w: 16, d: 16, h: 26, look: { walls: [0xfff2fa, 0xffd8ee], roofs: [0xff6ab0], lit: [0xffffff], trim: 0xffb8e0 } }],
    crowd: { gather: [{ kinds: ['froopy-a', 'froopy-b'], n: { high: 8, mid: 5, low: 3 }, at: [-34, -44], r: 4, face: [0, 0] }] },
  },

  // Dimension 35-C: the forest of Mega Trees out to the fog, roots and rocks
  // for an edge, ferns under them; Federation patrols over the canopy, its
  // agents (its hunters) out past the roots only
  dim35c: {
    look: { walls: [0x6a4a2a], roofs: [0x3a6a3a], lit: [0x9dffb8], trim: 0x4a3420 },
    edge: { kind: 'rocks', h: 0.8, models: ['q:Rock_Medium_1', 'q:Rock_Medium_2', 'q:Rock_Medium_4'] },
    ring: { n: null, e: null, s: null, w: null },
    far: null,
    scatter: [
      { model: 'q:Pine_4', h: 56, n: { high: 28, mid: 16, low: 8 }, r: [34, 200] },
      { model: 'q:CommonTree_4', h: 44, n: { high: 22, mid: 12, low: 6 }, r: [30, 180] },
      { model: 'q:Fern_2', h: 1.4, n: { high: 40, mid: 24, low: 10 }, r: [12, 50] },
    ],
    crowd: { gather: [{ kinds: ['gromflomite'], n: { high: 4, mid: 3, low: 2 }, at: [30, -40], r: 3, face: [0, 0] }] },
    fliers: [{ model: FEDSHIP, n: { high: 2, mid: 1, low: 1 }, y: [60, 80], speed: 14, h: 4.5 }],
  },

  // the Gromflomite base: hangar windows either side of the cell, onto
  // Federation ships docked on the apron, gantries, ground crew out past the
  // glass (the guards' kind, and theirs only there), patrols overhead
  gromflomites: {
    look: { walls: [0x5a6a64, 0x4a5a54, 0x6a7a72], roofs: [0x3a4a44, 0x8a9a94], lit: [0x9dffb8, 0xffe08a], trim: 0x2a3430 },
    windows: [
      { wall: 'n', from: -19, to: -5, y0: 1.5, h: 5.5, mullion: 2.3 },
      { wall: 'n', from: 5, to: 19, y0: 1.5, h: 5.5, mullion: 2.3 },
    ],
    outside: 'ground',
    ground: 0x4a5450,
    sky: { top: 0x1a2a3a, mid: 0x4a6a7a, low: 0x9ab8b8, sun: 0xe8f4ff, clouds: 0.3, moons: 2 },
    ring: { n: { styles: ['hangar', 'mast', 'block'], rows: 2, h: [10, 20], sets: [{ model: FEDSHIP, h: 4.5, n: 2 }] }, e: null, s: null, w: null },
    far: { n: { styles: ['tower', 'mast'], h: [50, 90] } },
    crowd: { gather: [{ kinds: ['gromflomite'], n: { high: 8, mid: 5, low: 0 }, at: [0, -54], r: 4, face: [0, -80] }] },
    fliers: [{ model: FEDSHIP, n: { high: 2, mid: 1, low: 0 }, y: [35, 60], speed: 16, h: 4.5 }],
  },

  // Get Schwifty: a stadium at dusk round the stage, Earth's towers beyond;
  // north left to the stage, the light towers and the heads
  schwifty: {
    look: { walls: [0x3a3a48, 0x4a4a5a, 0x2e2e3a], roofs: [0x5a5a6a, 0x6a4a5a], lit: [0xff6ab0, 0xffe24a, 0x6ad8ff, 0xfff0c0], trim: 0x9a9aa8, night: true },
    edge: { kind: 'barrier', h: 1.1 },
    ring: { n: null, e: null, s: null, w: null },
    far: { n: null, e: { styles: ['tower', 'block'], h: [45, 95] }, s: { styles: ['tower', 'block'], h: [45, 95] }, w: { styles: ['tower', 'block'], h: [45, 95] } },
    hero: STAGE,
    vista: 0.5,
    forecourt: { path: { w: 4.5, color: 0x26262e } },
    // (on low, the stands' few in the south one, behind the way in)
    stands: [
      { at: [50, 0], w: 46, d: 12, h: 7, rows: 4, face: STAGE, kinds: EARTH, n: { high: 24, mid: 14, low: 0 }, look: STANDS },
      { at: [-50, 0], w: 46, d: 12, h: 7, rows: 4, face: STAGE, kinds: EARTH, n: { high: 24, mid: 14, low: 0 }, look: STANDS },
      { at: [0, 40], w: 64, d: 12, h: 7, rows: 4, face: STAGE, kinds: EARTH, n: { high: 24, mid: 14, low: 12 }, look: STANDS },
    ],
    crowd: {
      gather: [
        { kinds: EARTH, n: { high: 14, mid: 9, low: 8 }, at: [-9, 14], r: 5.5, face: STAGE, block: 'pit-w' },
        { kinds: EARTH, n: { high: 14, mid: 9, low: 8 }, at: [-23.5, 14], r: 5.5, face: STAGE, block: 'pit-w' },
        { kinds: EARTH, n: { high: 14, mid: 9, low: 8 }, at: [9, 14], r: 5.5, face: STAGE, block: 'pit-e' },
        { kinds: EARTH, n: { high: 14, mid: 9, low: 8 }, at: [23.5, 14], r: 5.5, face: STAGE, block: 'pit-e' },
      ],
    },
    // the heads, seen from the mic: nothing round the stadium stands in the way
    sight: [
      { from: [0, 1.6, -9.4], to: [0, 22, -60] },
      { from: [0, 1.6, -9.4], to: [-40, 22, -56] },
      { from: [0, 1.6, -9.4], to: [40, 22, -58] },
    ],
  },

  ...WORLDS2,
};
