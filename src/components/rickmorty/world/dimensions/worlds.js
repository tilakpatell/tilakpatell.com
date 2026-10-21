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
//   fliers [{ model, n, y: [lo, hi], speed, h }]
//   windows [{ wall, from, to, y0, h, mullion }], outside 'ground' | 'space',
//     sky, fog, ground                         a room's
//   sight [{ from: [dx, y, dz], to: [dx, y, dz] }]   lines nothing round it may stand in
// A crowd kind is one of the cast's (../../portal/meshyCastCore.js's MESHY)
// or one of the Citadel's light copies (`crowd:<name>`, /games/meshy/crowd).

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

export const WORLDS = {};
