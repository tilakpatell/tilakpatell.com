// The object library's names and files (catalog/bf2017-library.js has the
// rest), on their own so the import script (scripts/bf2017-library-import.mjs)
// reads the same ones without the page's JSON.

export const GAME = 'game:';
export const gameKind = (name) => `${GAME}${name}`;
export const isGame = (model) => typeof model === 'string' && model.startsWith(GAME);
export const gameName = (model) => (isGame(model) ? model.slice(GAME.length) : null);

// FNV-1a, 32 bits, in base 36: short, and the same in the script and the page
const hash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36).padStart(7, '0');
};
export const slugOf = (name) => {
  const last = name
    .split('/')
    .pop()
    .replace(/_mesh$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 40);
  return `${last}${hash(name)}`;
};
export const gameUrl = (name, cut = null) => `/models/galaxy/surface/game/${slugOf(name)}${cut ? `.${cut}` : ''}.glb`;
