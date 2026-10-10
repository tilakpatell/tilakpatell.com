// The galaxy map's system discs as the game's front end drew its planets
// (lane K's PICTURES, cut to 96 pixels by scripts/bf2017-sky.mjs --globes):
// Geonosis, Hoth, Kashyyyk, Scarif, Tatooine and Yavin 4 wear their globe;
// every other system keeps its dot of light.
//
// globeUrl(id) → the published picture's URL, or null

import GLOBES from '../../data/galaxy/space/globes.json';
import { assetUrl } from '../../lib/assetBase';

export const globeUrl = (id) => (GLOBES[id] ? assetUrl(GLOBES[id].url) : null);
