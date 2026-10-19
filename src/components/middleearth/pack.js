// What Middle-earth fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/middle-earth',
  pages: ['src/pages/MiddleEarth.jsx', 'src/pages/RedBook.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/middleearth', 'src/pages/MiddleEarth.jsx', 'src/pages/RedBook.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/games/models/boulder.glb',
    '/games/models/boulders.glb',
    '/games/models/rock.glb',
    '/audio/clips/fly-you-fools.mp3',
    '/audio/clips/i-can-carry-you.mp3',
    '/audio/clips/kings-arrival.mp3',
    '/audio/clips/my-precious.mp3',
    '/audio/clips/nazgul-scream.mp3',
    '/audio/clips/wizard-is-never-late.mp3',
    '/audio/clips/second-breakfast.mp3',
    '/audio/clips/one-ring.mp3',
    '/audio/clips/the-world-is-changed.mp3',
    '/audio/clips/task-appointed-to-you.mp3',
    '/audio/clips/this-foe-is-beyond-any-of-you.mp3',
    '/audio/clips/you-shall-not-pass.mp3',
    '/audio/clips/and-my-axe.mp3',
    '/audio/clips/find-you-a-box.mp3',
    '/audio/clips/meats-back-on-the-menu.mp3',
    '/audio/clips/nobody-likes-you.mp3',
    '/audio/clips/you-bow-to-no-one.mp3',
    '/audio/clips/lotr-theme.mp3',
    '/models/sketchfab/orthanc.glb',
    '/models/sketchfab/minas-tirith.glb',
    '/models/sketchfab/bag-end-door.glb',
  ], // single files
  globs: ['/cc0/galaxy/**', '/models/middleearth/cast/*'], // folders: `*` within a folder, `**` any depth
  computed: ['/models/sketchfab'], // folders the source only builds paths in: the files it takes are listed above
};
