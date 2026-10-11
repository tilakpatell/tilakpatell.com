// The galaxy map's system discs as the game drew its planets: the front end's
// own globe pictures for Geonosis, Hoth, Kashyyyk, Scarif, Tatooine and
// Yavin 4 (lane K's PICTURES), and a globe rendered from the skin for every
// world the game gave whole-planet maps (Bespin, Endor, Kamino, Naboo, and
// E5's as they land), all cut to 96 pixels by scripts/bf2017-sky.mjs
// --globes and published by hash; a world with neither (a procedural look:
// Coruscant, Dagobah…; or no planet at all: Alderaan's rubble) keeps its dot
// of light.
//
// globeUrl(id) → the published picture's URL, or null
// discOf(id) → the dot's props for HoloMap.jsx: `data-globe` and the picture
//   in `--globe` where there is one, nothing where there isn't

import GLOBES from '../../data/galaxy/space/globes.json';
import { assetUrl } from '../../lib/assetBase';

export const globeUrl = (id) => (GLOBES[id] ? assetUrl(GLOBES[id].url) : null);

export function discOf(id) {
  const url = globeUrl(id);
  return url ? { 'data-globe': '', style: { '--globe': `url("${url}")` } } : {};
}
