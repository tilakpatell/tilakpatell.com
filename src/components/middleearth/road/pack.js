// What the Road fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/middle-earth/road',
  pages: ['src/pages/TheRoad.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/middleearth/road', 'src/pages/TheRoad.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  // the nature kits’ files the stages’ tables plant (scatter.test.js holds the list to the tables): the MegaKit’s, and the older pack’s maples, birches and dead trees
  urls: ['/kit/nature/index.json', '/kit/nature/birchtree.glb', '/kit/nature/deadtree.glb', '/kit/nature/mapletree.glb', '/kit/naturemega/index.json', '/kit/naturemega/birch.glb', '/kit/naturemega/bush.glb', '/kit/naturemega/clover.glb', '/kit/naturemega/commontree.glb', '/kit/naturemega/deadtree.glb', '/kit/naturemega/fern.glb', '/kit/naturemega/flower.glb', '/kit/naturemega/giantpine.glb', '/kit/naturemega/grass.glb', '/kit/naturemega/mushroom.glb', '/kit/naturemega/pebble.glb', '/kit/naturemega/pine.glb', '/kit/naturemega/plant.glb', '/kit/naturemega/rock.glb', '/kit/naturemega/twistedtree.glb', '/kit/farm/cow.glb', '/kit/farm/horse.glb', '/kit/farm/pig.glb', '/kit/farm/sheep.glb', '/models/sketchfab/bag-end-door.glb', '/models/sketchfab/minas-tirith.glb'],
  globs: ['/models/middleearth/cast/*', '/models/middleearth/fx/*', '/cc0/galaxy/**'], // the fellowship (road/cast.js: each figure and its idle, walk and run), as Middle-earth’s pack has them; the weather’s sheets (road/weather.js); the soils’ photo scans (stages/soils.js, road/soil.js; the set’s, as Middle-earth’s pack has it)
  computed: ['/kit'], // (the kit’s files are named by its manifest, not the source)
};
