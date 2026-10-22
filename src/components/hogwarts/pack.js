// What Hogwarts fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/hogwarts',
  pages: ['src/pages/Hogwarts.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/hogwarts', 'src/pages/Hogwarts.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  // the MegaKit's files the shore plants (rules/shore.js's rows): its rocks, pebbles, grass, ferns and pines
  urls: ['/kit/naturemega/index.json', '/kit/naturemega/rock.glb', '/kit/naturemega/pebble.glb', '/kit/naturemega/grass.glb', '/kit/naturemega/fern.glb', '/kit/naturemega/pine.glb'],
  // the castle's people stood in by Middle-earth's cast until Lane B's are in (cast/figures.js's STAND_IN): each figure and its idle, walk and run;
  // the weather's particle sheets (world/weather.js, the Road's, the site's own); and the photo scans the grounds and the castle
  // wear (world/ground.js, world/castle/materials.js: by role, so named by the index)
  // (and first, the hero models, every cut of each: world/heroes.js)
  globs: ['/models/hogwarts/castle/*.glb', '/models/hogwarts/hall/*.glb', '/models/hogwarts/props/boat*.glb', '/models/hogwarts/props/express-coach*.glb', '/models/hogwarts/props/express-engine*.glb', '/models/hogwarts/props/greenhouse*.glb', '/models/hogwarts/props/hagrid-hut*.glb', '/models/hogwarts/props/stand*.glb', '/models/hogwarts/props/standing-stone*.glb', '/models/hogwarts/props/station*.glb', '/models/hogwarts/props/willow*.glb', '/models/middleearth/cast/frodo*.glb', '/models/middleearth/cast/pippin*.glb', '/models/middleearth/cast/rosie*.glb', '/models/middleearth/cast/sam*.glb', '/models/middleearth/cast/merry*.glb', '/models/middleearth/cast/hobbit*.glb', '/models/middleearth/cast/gandalfwhite*.glb', '/models/middleearth/cast/galadriel*.glb', '/models/middleearth/cast/aragorn*.glb', '/models/middleearth/cast/gimli*.glb', '/models/middleearth/cast/bilbo*.glb', '/models/middleearth/cast/eowyn*.glb', '/models/middleearth/cast/arwen*.glb', '/models/middleearth/cast/butterbur*.glb', '/models/middleearth/cast/theoden*.glb', '/models/middleearth/cast/boromir*.glb', '/models/middleearth/cast/goblin*.glb', '/models/middleearth/fx/*', '/cc0/galaxy/grass/*', '/cc0/galaxy/needles/*', '/cc0/galaxy/gravel/*', '/cc0/galaxy/rock/*', '/cc0/castle/ashlar/*', '/cc0/castle/rubble/*', '/cc0/castle/slate/*'],
  // (the kit's files are named by its manifest, not the source; the stand-ins above by cast/figures.js from a name; the castle's scans by their role)
  computed: ['/kit', '/models/middleearth/cast', '/cc0/castle'],
};
