// Each stage’s pure parts, by id, for the module and the ledger: its beats
// and its lore. A stage not yet written has none (the module holds nowhere
// in it; the ledger counts it at HOLDS_UNWRITTEN seconds of holds).
// The scenes are imported only as a stage is built (scenes.js).

import { BEATS as hobbiton } from './hobbiton/beats';
import { LORE as hobbitonLore } from './hobbiton/lore';
import { BEATS as shireEdge } from './shire-edge/beats';
import { LORE as shireEdgeLore } from './shire-edge/lore';
import { BEATS as bree } from './bree/beats';
import { LORE as breeLore } from './bree/lore';
import { BEATS as weathertop } from './weathertop/beats';
import { LORE as weathertopLore } from './weathertop/lore';
import { BEATS as ford } from './ford/beats';
import { LORE as fordLore } from './ford/lore';
import { BEATS as rivendell } from './rivendell/beats';
import { LORE as rivendellLore } from './rivendell/lore';

export const BEATS_OF = { hobbiton, 'shire-edge': shireEdge, bree, weathertop, ford, rivendell };
export const LORE_OF = { hobbiton: hobbitonLore, 'shire-edge': shireEdgeLore, bree: breeLore, weathertop: weathertopLore, ford: fordLore, rivendell: rivendellLore };
export const HOLDS_UNWRITTEN = 30; // s a stage, until its beats say
