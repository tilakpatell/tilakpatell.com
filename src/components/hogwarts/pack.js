// What Hogwarts fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/hogwarts',
  pages: ['src/pages/Hogwarts.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/hogwarts', 'src/pages/Hogwarts.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  // the MegaKit's files the shore plants (rules/shore.js's rows): its rocks, pebbles, grass, ferns and pines
  urls: ['/kit/naturemega/index.json', '/kit/naturemega/rock.glb', '/kit/naturemega/pebble.glb', '/kit/naturemega/grass.glb', '/kit/naturemega/fern.glb', '/kit/naturemega/pine.glb'],
  // the castle's people stood in by Middle-earth's cast until Lane B's are in (cast/figures.js's STAND_IN): each figure and its idle, walk and run
  globs: ['/models/middleearth/cast/frodo*.glb', '/models/middleearth/cast/pippin*.glb', '/models/middleearth/cast/rosie*.glb', '/models/middleearth/cast/sam*.glb', '/models/middleearth/cast/merry*.glb', '/models/middleearth/cast/hobbit*.glb', '/models/middleearth/cast/gandalfwhite*.glb', '/models/middleearth/cast/galadriel*.glb', '/models/middleearth/cast/aragorn*.glb', '/models/middleearth/cast/gimli*.glb', '/models/middleearth/cast/bilbo*.glb', '/models/middleearth/cast/eowyn*.glb', '/models/middleearth/cast/arwen*.glb', '/models/middleearth/cast/butterbur*.glb', '/models/middleearth/cast/theoden*.glb', '/models/middleearth/cast/boromir*.glb', '/models/middleearth/cast/goblin*.glb'],
  // (the kit's files are named by its manifest, not the source; the cast's by cast/figures.js from a name: Lane B's own, listed in its cast.json once it lands, and the stand-ins above)
  computed: ['/kit', '/models/hogwarts/cast', '/models/middleearth/cast'],
};
