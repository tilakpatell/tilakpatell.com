// What Dimension C-137 fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/c-137',
  pages: ['src/pages/RickMorty.jsx', 'src/pages/Citadel.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/rickmorty', 'src/pages/RickMorty.jsx', 'src/pages/Citadel.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/models/albuquerque/walt.glb',
    '/models/albuquerque/jesse.glb',
    '/models/albuquerque/jesse-lab.glb',
    '/models/wardrobe/portalgun.glb',
    // (the town round the street's street lights, signs, flowers, bushes and rocks: world/town/scene.js)
    '/models/quaternius/props/street.glb',
    '/models/quaternius/nature/flowers.glb',
    '/models/quaternius/nature/trees.glb',
    '/models/quaternius/nature/rocks.glb',
    '/audio/clips/what-is-my-purpose.mp3',
    '/audio/clips/im-mr-meeseeks.mp3',
    '/audio/clips/wubba-lubba-dub-dub.mp3',
    '/audio/clips/can-do.mp3',
    '/audio/clips/portal-gun.mp3',
    '/audio/clips/im-in.mp3',
    '/audio/clips/riggity-wrecked-son.mp3',
    '/audio/clips/snap.mp3',
    '/audio/clips/disqualified.mp3',
    '/audio/clips/show-me-what-you-got.mp3',
    '/audio/clips/i-like-what-you-got.mp3',
    '/audio/clips/pickle-rick.mp3',
    '/audio/clips/here-i-go-killing-again.mp3',
    '/audio/clips/get-schwifty.mp3',
    '/audio/clips/my-man.mp3',
    '/audio/clips/ooo-wee.mp3',
    '/audio/clips/bird-culture.mp3',
    '/audio/clips/scary-terry.mp3',
    '/audio/clips/cool.mp3',
    '/audio/clips/cant-take-it-anymore.mp3',
  ], // single files
  globs: ['/games/meshy/*.glb', '/games/meshy/crowd/**', '/models/c137/**', '/games/kenney**'], // folders: `*` within a folder, `**` any depth
  computed: ['/games/meshy'], // folders the source only builds paths in: what it takes (not rollout/, Cybertron's) is the globs above
};
