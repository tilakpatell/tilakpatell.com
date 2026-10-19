// Each stage’s pure parts, by id, for the module and the ledger: its beats
// and its lore. A stage not yet written has none (the module holds nowhere
// in it; the ledger counts it at HOLDS_UNWRITTEN seconds of holds).
// The scenes are imported only as a stage is built (scenes.js).

import { BEATS as hobbiton } from './hobbiton/beats';
import { LORE as hobbitonLore } from './hobbiton/lore';

export const BEATS_OF = { hobbiton };
export const LORE_OF = { hobbiton: hobbitonLore };
export const HOLDS_UNWRITTEN = 30; // s a stage, until its beats say
