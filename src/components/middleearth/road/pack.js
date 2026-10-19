// What the Road fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/middle-earth/road',
  pages: ['src/pages/TheRoad.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/middleearth/road', 'src/pages/TheRoad.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  // the nature kit’s files the stages’ tables plant (scatter.test.js holds the list to the tables)
  urls: ['/kit/naturemega/index.json', '/kit/naturemega/bush.glb', '/kit/naturemega/commontree.glb', '/kit/naturemega/deadtree.glb', '/kit/naturemega/flower.glb', '/kit/naturemega/grass.glb', '/kit/naturemega/pine.glb', '/kit/naturemega/rock.glb', '/kit/farm/horse.glb', '/models/sketchfab/bag-end-door.glb'],
  globs: ['/models/middleearth/cast/*', '/models/middleearth/fx/*'], // the fellowship (road/cast.js: each figure and its idle, walk and run), as Middle-earth’s pack has them; the weather’s sheets (road/weather.js)
  computed: ['/kit'], // (the kit’s files are named by its manifest, not the source)
};
