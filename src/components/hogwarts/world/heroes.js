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

// the files a cut is written to, by tier: the suffixes of
// scripts/gen3d/budget.mjs, so one table reads both
export const SUFFIX = { ultra: '.ultra', hq: '.hq', mid: '', lo: '.lo' };
// a cut over this goes to the bucket (scripts/assets-publish.mjs) and
// leaves git; the site then loads it only when it is sent to the bucket
export const COMMIT_BYTES = 4 * 1024 * 1024;

export const HEROES = {
  castle: {
    url: '/models/hogwarts/castle/castle.glb',
    made: 'meshy',
    task: 'castle-m1',
    from: { ultra: 'castle-m1.glb', hq: 'castle-m1@120000.glb', mid: 'castle-m1@60000.glb', lo: 'castle-m1@20000.glb' },
    what: 'Hogwarts on its crag, as the films show it from across the lake: the Great Hall’s long roof, the round towers under slate cones, the viaduct, the clock tower and the Astronomy Tower highest',
    size: { along: 'x', metres: 240 },
    cuts: { ultra: { tris: 310000, tex: 4096 }, hq: { tris: 126000, tex: 4096 }, mid: { tris: 63000, tex: 2048 }, lo: { tris: 21000, tex: 1024 } },
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
    made: 'sketchfab',
    from: 'hagrid-hut.glb',
    uid: '8ea2d386032b43c0954a650080d8bc59',
    what: 'Hagrid’s hut: the round stone hut and its annex under conical roofs, the chimney, the pumpkins by the door',
    size: { along: 'x', metres: 9 },
    drop: /jardin/i,
    cuts: { mid: { tris: 16000, tex: 2048 }, lo: { tris: 6000, tex: 1024 } },
  },
  greenhouse: {
    url: '/models/hogwarts/props/greenhouse.glb',
    made: 'sketchfab',
    from: 'greenhouse.glb',
    uid: 'e00471c89eec45ae8ddb9b06e3f1966e',
    what: 'a greenhouse, glass over an iron frame under a barrel roof',
    size: { along: 'x', metres: 24 },
    cuts: { mid: { tris: 17600, tex: 2048 }, lo: { tris: 6000, tex: 1024 } },
  },
  willow: {
    url: '/models/hogwarts/props/willow.glb',
    made: 'gen3d',
    from: 'hp-willow-p1',
    what: 'the Whomping Willow: a squat gnarled trunk twisted on itself, its limbs a crown of long whips',
    size: { along: 'y', metres: 16 },
    // (its shape only, painted bark by the world; its card plinth cut away)
    bare: [0.34, 0.26, 0.19],
    below: 0.1,
    cuts: { hq: { tris: 84000, tex: 1024 }, mid: { tris: 42000, tex: 1024 }, lo: { tris: 12600, tex: 1024 } },
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
