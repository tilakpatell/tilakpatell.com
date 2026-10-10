// The worlds the game lights (scripts/bf2017-light.mjs writes each one's
// JSON): a site names its entry by `gameLight`; a site that names none, or
// one not here, keeps its own sky and light.

import bespin from './bespin.json';
import endor from './endor.json';
import geonosis from './geonosis.json';
import hoth from './hoth.json';
import kamino from './kamino.json';
import kashyyyk from './kashyyyk.json';
import naboo from './naboo.json';
import sbKamino from './sb_kamino.json';
import scarif from './scarif.json';
import tatooine from './tatooine.json';
import yavin from './yavin.json';

// (sb_kamino: Kamino's space level's own, for Starfighter Assault's area: galaxy/levelArea.js)
export const LIGHTS = { bespin, endor, geonosis, hoth, kamino, kashyyyk, naboo, sb_kamino: sbKamino, scarif, tatooine, yavin };

export const gameLightOf = (site) => (site?.gameLight ? (LIGHTS[site.gameLight] ?? null) : null);
