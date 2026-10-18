// What the Road fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/middle-earth/road',
  pages: ['src/pages/TheRoad.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/middleearth/road', 'src/pages/TheRoad.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [],
};
