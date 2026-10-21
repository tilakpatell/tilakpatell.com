// What Hogwarts fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/hogwarts',
  pages: ['src/pages/Hogwarts.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/hogwarts', 'src/pages/Hogwarts.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  // the MegaKit's files the shore plants (rules/shore.js's rows): its rocks, pebbles, grass, ferns and pines
  urls: ['/kit/naturemega/index.json', '/kit/naturemega/rock.glb', '/kit/naturemega/pebble.glb', '/kit/naturemega/grass.glb', '/kit/naturemega/fern.glb', '/kit/naturemega/pine.glb'],
  // the weather's particle sheets (world/weather.js, the Road's, the site's own), and the photo scans the
  // grounds and the castle wear (world/ground.js, world/castle/materials.js: by role, so named by the index)
  globs: ['/models/middleearth/fx/*', '/cc0/galaxy/grass/*', '/cc0/galaxy/needles/*', '/cc0/galaxy/gravel/*', '/cc0/galaxy/rock/*', '/cc0/galaxy/ashlar/*', '/cc0/galaxy/rubble/*', '/cc0/galaxy/slate/*'],
  computed: ['/kit'], // (the kit's files are named by its manifest, not the source)
};
