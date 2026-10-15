import { appearanceOf, characterOfOffer } from '../../../lib/bf2017/collection';
import { BODIES, kindOf } from '../figures/figures.js';
import { readPicks } from './useCollection';

// The character on the spawn screen (Spawn.jsx): the body the offer in hand
// would wear in the field, as the stage's spec. The same rule the field
// draws by (figures.js's kindOf): the skin the Collection keeps for it, else
// the unit's own body, else its side's trooper.
//
//   kept() → the Collection's picks (none where there is no storage)
//   figureOf(offer, team, store) → { name, rig: 'walrus', src: { url }, pack, kind } | null

export const kept = () => {
  try {
    return readPicks();
  } catch {
    // (no storage: no picks)
    return {};
  }
};

export function figureOf(offer, team, store = kept()) {
  const c = characterOfOffer(offer);
  const look = c ? appearanceOf(store, c.id, { faction: c.faction }) : null;
  const kind = kindOf({ team, unitId: offer.kind === 'class' ? null : offer.id, appearance: look });
  const body = BODIES[kind];
  return body ? { name: kind, rig: 'walrus', src: { url: body.url }, pack: body.pack ?? null, kind } : null;
}
