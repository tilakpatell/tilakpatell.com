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
import { BEATS as caradhras } from './caradhras/beats';
import { LORE as caradhrasLore } from './caradhras/lore';
import { BEATS as moria } from './moria/beats';
import { LORE as moriaLore } from './moria/lore';
import { BEATS as lorien } from './lorien/beats';
import { LORE as lorienLore } from './lorien/lore';
import { BEATS as anduin } from './anduin/beats';
import { LORE as anduinLore } from './anduin/lore';
import { BEATS as marshes } from './marshes/beats';
import { LORE as marshesLore } from './marshes/lore';
import { BEATS as ithilien } from './ithilien/beats';
import { LORE as ithilienLore } from './ithilien/lore';
import { BEATS as cirithUngol } from './cirith-ungol/beats';
import { LORE as cirithUngolLore } from './cirith-ungol/lore';
import { BEATS as gorgoroth } from './gorgoroth/beats';
import { BEATS as minasTirith } from './minas-tirith/beats';
import { LORE as minasTirithLore } from './minas-tirith/lore';
import { LORE as gorgorothLore } from './gorgoroth/lore';

export const BEATS_OF = { hobbiton, 'shire-edge': shireEdge, bree, weathertop, ford, rivendell, caradhras, moria, lorien, anduin, marshes, ithilien, 'cirith-ungol': cirithUngol, gorgoroth, 'minas-tirith': minasTirith };
export const LORE_OF = { hobbiton: hobbitonLore, 'shire-edge': shireEdgeLore, bree: breeLore, weathertop: weathertopLore, ford: fordLore, rivendell: rivendellLore, caradhras: caradhrasLore, moria: moriaLore, lorien: lorienLore, anduin: anduinLore, marshes: marshesLore, ithilien: ithilienLore, 'cirith-ungol': cirithUngolLore, gorgoroth: gorgorothLore, 'minas-tirith': minasTirithLore };
export const HOLDS_UNWRITTEN = 30; // s a stage, until its beats say
