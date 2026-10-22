// Hogwarts’ hero models: what each is, where it came from, how big it is in
// the world and how it is cut for the site’s detail levels. Pure data and
// pure reads, so the cut (scripts/hogwarts-models.mjs), the tests and the
// world read the same list. public/models/hogwarts/models.json is what the
// cut wrote: each file’s triangles and bytes.
//
// A model is made one of three ways:
//   meshy      Meshy’s image to 3D from a reference photograph
//              (scripts/meshy-hogwarts.mjs); its lighter cuts are Meshy’s
//              own remesh of the same task, which keeps the paint
//   gen3d      made on the desktop’s GPU (scripts/gen3d/make.mjs), cut from
//              its bake, scripts/gen3d/cache/<from>/baked.glb
//   sketchfab  someone else’s model, downloaded with the owner’s token and
//              credited in src/data/modelCredits.json under its licence
//
// url: the plain (mid) cut; the others sit beside it (SUFFIX)
// size: { along: 'x' | 'y' | 'z', metres }: scaled so that side is that
//   long, stood on y = 0 with its footprint’s middle on the origin, its
//   front (the side its picture shows) toward +z
// cuts: the tiers it has, each one’s triangles and texture size (ultra and
//   hq only for what is looked at close or across the whole lake)
// drop: a RegExp on its parts’ names, those left out (a ground plate)
// bare: [r, g, b]: its shape only, its paint and UVs let go; the world
//   paints it by world position (a bark, a stone)
// below: a share of its height: what is wholly under it cut away (a plinth)
// ground: a scan's patch of ground cut away round its footprint
// recolour: { material, bands }: bands of its atlas repainted (a livery)

// the files a cut is written to, by tier: the suffixes of
// scripts/gen3d/budget.mjs, so one table reads both
export const SUFFIX = { ultra: '.ultra', hq: '.hq', mid: '', lo: '.lo' };
// a cut over this goes to the bucket (scripts/assets-publish.mjs) and
// leaves git; the site then loads it only when it is sent to the bucket
export const COMMIT_BYTES = 4 * 1024 * 1024;

export const HEROES = {
  castle: {
    url: '/models/hogwarts/castle/castle.glb',
    made: 'sketchfab',
    from: 'castle-vox.glb',
    uid: '8c5af96a404040c8b42ca628a3c7c867',
    // (a voxel model: cut by class, not by its palette strip; scripts/hogwarts-castle.mjs)
    voxel: { step: 0.05 },
    what: 'Hogwarts on its crag, as the films lay it out: the Great Hall’s long roof along the cliff, the Grand Staircase and the round towers under slate cones, the clock tower’s courtyard, the Astronomy Tower highest, the viaduct, the covered bridge, the boathouse and its stair, the greenhouses and the Owlery',
    size: { along: 'z', metres: 398 },
    // (the far cut no lower: every window is a seam the simplifier keeps, and
    // forced under 39,000 the Owlery goes)
    cuts: { ultra: { tris: 300000, tex: 0 }, hq: { tris: 160000, tex: 0 }, mid: { tris: 70000, tex: 0 }, lo: { tris: 40000, tex: 0 } },
  },
  'express-engine': {
    url: '/models/hogwarts/props/express-engine.glb',
    made: 'sketchfab',
    from: 'express-engine.glb',
    uid: '373a1594ecd24ee59f4517cb2d5a7b96',
    what: 'the Hogwarts Express’s engine and tender, a scarlet Hall-class locomotive',
    size: { along: 'z', metres: 19.2 },
    cuts: { mid: { tris: 64000, tex: 2048 }, lo: { tris: 20000, tex: 1024 } },
  },
  boat: {
    url: '/models/hogwarts/props/boat.glb',
    made: 'sketchfab',
    from: 'boat.glb',
    uid: '3e9093b6f0ce474da4d8cfea7e01f420',
    what: 'one of the first-years’ boats, a clinker rowing boat with a lantern on a pole',
    size: { along: 'z', metres: 3.6 },
    cuts: { mid: { tris: 7100, tex: 1024 }, lo: { tris: 3000, tex: 512 } },
  },
  'hagrid-hut': {
    url: '/models/hogwarts/props/hagrid-hut.glb',
    made: 'meshy',
    task: 'hagrid-hut',
    from: { hq: 'hagrid-hut.glb', mid: 'hagrid-hut@20000.glb', lo: 'hagrid-hut@20000.glb' },
    what: 'Hagrid’s hut: the round stone hut and its smaller twin under steep slate cones, the plank door, the woodpile and the barrels by the step',
    size: { along: 'x', metres: 12 },
    cuts: { hq: { tris: 61000, tex: 2048 }, mid: { tris: 20000, tex: 2048 }, lo: { tris: 9000, tex: 1024 } },
  },
  boathouse: {
    url: '/models/hogwarts/castle/boathouse.glb',
    made: 'meshy',
    task: 'boathouse',
    from: { hq: 'boathouse.glb', mid: 'boathouse@20000.glb', lo: 'boathouse@20000.glb' },
    what: 'the boathouse at the cliff’s foot: a gabled stone house over the water, its pointed arch for the boats, the chimney and the lantern by the door',
    size: { along: 'z', metres: 18 },
    cuts: { hq: { tris: 55000, tex: 2048 }, mid: { tris: 20000, tex: 2048 }, lo: { tris: 9000, tex: 1024 } },
  },
  station: {
    url: '/models/hogwarts/props/station.glb',
    made: 'meshy',
    task: 'station',
    from: { hq: 'station.glb', mid: 'station@20000.glb', lo: 'station@20000.glb' },
    what: 'Hogsmeade station: the brick booking hall under its slate roof and chimneys, the iron canopy over the platform, the red doors',
    size: { along: 'x', metres: 30 },
    cuts: { hq: { tris: 54000, tex: 2048 }, mid: { tris: 20000, tex: 2048 }, lo: { tris: 9000, tex: 1024 } },
  },
  greenhouse: {
    url: '/models/hogwarts/props/greenhouse.glb',
    made: 'sketchfab',
    from: 'greenhouse.glb',
    uid: 'e00471c89eec45ae8ddb9b06e3f1966e',
    what: 'a greenhouse, glass over an iron frame under a barrel roof',
    size: { along: 'x', metres: 24 },
    // (its lo cut no lower: under 12,000 the simplifier eats the glass panes)
    cuts: { mid: { tris: 17600, tex: 2048 }, lo: { tris: 12500, tex: 1024 } },
  },
  willow: {
    url: '/models/hogwarts/props/willow.glb',
    made: 'meshy',
    task: 'willow',
    from: { hq: 'willow.glb', mid: 'willow@40000.glb', lo: 'willow@12000.glb' },
    what: 'the Whomping Willow: a squat gnarled trunk twisted on itself, knuckled limbs, its crown a fan of long whips',
    size: { along: 'y', metres: 16 },
    // (its shape only, painted bark by the world: Meshy left it unpainted;
    // its mound of roots cut away, where the lawn will be)
    bare: [0.34, 0.26, 0.19],
    below: 0.08,
    cuts: { hq: { tris: 100000, tex: 0 }, mid: { tris: 40000, tex: 0 }, lo: { tris: 12000, tex: 0 } },
  },
  'sorting-hat': {
    url: '/models/hogwarts/hall/sorting-hat.glb',
    made: 'sketchfab',
    from: 'sorting-hat.glb',
    uid: '7717cff94177400ea68d89f835731f49',
    what: 'the Sorting Hat, patched and frayed, its brim folded into a mouth',
    size: { along: 'y', metres: 0.5 },
    cuts: { mid: { tris: 20000, tex: 1024 }, lo: { tris: 6000, tex: 512 } },
  },
  'teacher-chair': {
    url: '/models/hogwarts/hall/teacher-chair.glb',
    made: 'sketchfab',
    from: 'teacher-chair.glb',
    uid: 'ac4970731bd14d4ebb8e0025e0c83970',
    what: 'a high-backed chair at the staff table, carved oak and green leather',
    size: { along: 'y', metres: 1.75 },
    cuts: { mid: { tris: 1300, tex: 1024 }, lo: { tris: 1300, tex: 512 } },
  },
  'express-coach': {
    url: '/models/hogwarts/props/express-coach.glb',
    made: 'sketchfab',
    from: 'coach-b.glb',
    uid: 'b29f47bbd3fe474fb105513f0e7d0d50',
    what: 'one of the Express’s carriages, a corridor coach of the old Great Western kind with its doors and its windows in a row',
    size: { along: 'x', metres: 19.5 },
    // The Express's livery on the coach's own paint: its atlas is in bands
    // (scripts/hogwarts-models.mjs recolour), the chocolate lower panel and
    // the cream upper one both the Express's maroon, the pale roof dark
    // grey, the wear and the lining kept (rows: the share of the atlas, top
    // down; to: sRGB, scaled by each pixel's brightness against the band's)
    recolour: { material: /Exterior/, bands: [{ rows: [0.546, 0.621], to: [0.42, 0.06, 0.07] }, { rows: [0.622, 0.728], to: [0.5, 0.08, 0.09] }, { rows: [0.731, 1], to: [0.17, 0.17, 0.18] }] },
    // (its lo cut no lower: under 12,000 the roof's paint smears)
    cuts: { mid: { tris: 26000, tex: 2048 }, lo: { tris: 12000, tex: 1024 } },
  },
  'house-table': {
    url: '/models/hogwarts/hall/house-table.glb',
    made: 'sketchfab',
    from: 'house-table.glb',
    uid: '15bb05a31c7645bfa50640683f98d3ad',
    what: 'a length of a house table, dark oak on trestles; four of them end to end make one house’s table',
    size: { along: 'x', metres: 7.5 },
    cuts: { mid: { tris: 3500, tex: 1024 }, lo: { tris: 1200, tex: 512 } },
  },
  bench: {
    url: '/models/hogwarts/hall/bench.glb',
    made: 'sketchfab',
    from: 'bench.glb',
    uid: '76017263f0ea4d46915c0f48edc04923',
    what: 'a plain oak bench, one along each side of a house table',
    size: { along: 'x', metres: 3.6 },
    cuts: { mid: { tris: 2100, tex: 1024 }, lo: { tris: 700, tex: 512 } },
  },
  hourglass: {
    url: '/models/hogwarts/hall/hourglass.glb',
    made: 'sketchfab',
    from: 'hourglass.glb',
    uid: '45347868524748a1bcdeba3b579a2e3c',
    what: 'a house-points hourglass, taller than a man, a gilt frame round its glass',
    size: { along: 'y', metres: 3.2 },
    cuts: { mid: { tris: 14000, tex: 1024 }, lo: { tris: 4000, tex: 512 } },
  },
  candle: {
    url: '/models/hogwarts/hall/candle.glb',
    made: 'sketchfab',
    from: 'candle.glb',
    uid: 'f9ccd7e51c004c9e8354a4c723d20010',
    what: 'one of the floating candles, white wax run down its sides',
    size: { along: 'y', metres: 0.32 },
    cuts: { mid: { tris: 1040, tex: 512 }, lo: { tris: 200, tex: 256 } },
  },
  stand: {
    url: '/models/hogwarts/props/stand.glb',
    made: 'meshy',
    task: 'stand',
    // (from words: there is nothing of it to photograph)
    words: true,
    // (both cuts from the raw model: Meshy's remesh smeared the bracing)
    from: { mid: 'stand.glb', lo: 'stand.glb' },
    what: 'a Quidditch stand: a timber tower on braced legs, a viewing box at the top under a steep striped canvas roof, bunting round its rail',
    size: { along: 'y', metres: 22 },
    cuts: { mid: { tris: 36000, tex: 2048 }, lo: { tris: 12000, tex: 1024 } },
  },
  'standing-stone': {
    url: '/models/hogwarts/props/standing-stone.glb',
    made: 'sketchfab',
    from: 'standing-stone.glb',
    uid: 'dfe747c771534f43ba202f49ea5ea403',
    what: 'a standing stone, scanned from a real one; a ring of them, each turned and sized its own way, is the stone circle at the far end of the covered bridge',
    size: { along: 'y', metres: 3.6 },
    // (its shape only: the scan's eleven tiles of photograph would be eleven
    // draws a ring; the world paints it with the cliff's rock)
    bare: [0.46, 0.45, 0.42],
    // (the patch of field it was scanned standing in, cut away round it)
    ground: true,
    cuts: { mid: { tris: 4000, tex: 0 }, lo: { tris: 1200, tex: 0 } },
  },
};

// the file of a model’s cut, as the site asks for it
export const fileOf = (name, tier, heroes = HEROES) => heroes[name].url.replace(/\.glb$/, `${SUFFIX[tier]}.glb`);

// The scale and the offset that set a model of bounds { min, max } to its
// size, its footprint’s middle on the origin and its lowest point on y = 0:
// { s, offset: [x, y, z] }, applied as p * s + offset.
export function placement({ min, max }, { along, metres }) {
  const axis = { x: 0, y: 1, z: 2 }[along];
  const s = metres / (max[axis] - min[axis]);
  return { s, offset: [(-s * (min[0] + max[0])) / 2, -s * min[1], (-s * (min[2] + max[2])) / 2] };
}

// The tier a detail level loads, a step down at a time to one the model has
// and the site can reach (`has(file)`: a cut only the bucket holds is
// reachable only when the site is sent to the bucket): the same table as
// lib/three/gen3d’s CUTS.
export const TIER_OF = { ultra: 'ultra', high: 'hq', mid: 'mid', low: 'lo' };
export const FALLBACK = { ultra: 'hq', hq: 'mid', mid: 'lo', lo: null };
export function tierFor(name, detail, { has = () => true, heroes = HEROES } = {}) {
  let tier = TIER_OF[detail] ?? 'mid';
  while (tier && !(heroes[name].cuts[tier] && has(fileOf(name, tier, heroes)))) tier = FALLBACK[tier];
  return tier;
}
