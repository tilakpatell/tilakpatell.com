// HOME's page as the game draws it offline (the game's StartScreen, the HOME
// tab's link; MainMenu.jsx): its three news tiles of the offline set, each
// with its picture, and none of the online parts. Pure.
//
// homeValues(box, path) → values for the StartScreen tree (layout.js's)

import { offline } from './menuHeader';

const HIDE = { hidden: true };
// (the online parts: the timed challenges, the loot crates, the online one of
// the two tiles the game's code picks between at the top right, the loader)
const ONLINE = new Set(['TimedChallengesWidget', 'LootBoxButton', 'smallTopTile MP', 'LoadingContainer']);
// Each news tile's picture: the game's code gives it (the record names none);
// the one UI/Bitmaps/Frontend/Tiles texture of the tile's size and name (hand)
const TILE_ART = {
  'bigTile Campaign': 'UI/Bitmaps/Frontend/Tiles/Backup-Campaign',
  'smallTopTile Connect for more features': 'UI/Bitmaps/Frontend/Tiles/Backup-Connect',
  'smallBottomTile Arcade': 'UI/Bitmaps/Frontend/Tiles/Backup-Arcade',
};

export function homeValues(b, path) {
  const off = offline(b, path);
  if (off) return off;
  const name = path.at(-1);
  if (ONLINE.has(name)) return HIDE;
  const tile = path.find((p) => TILE_ART[p]);
  if (tile && name === 'Image' && b.type === 'texture') return { image: TILE_ART[tile] };
  return null;
}
