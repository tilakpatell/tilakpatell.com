// The cards of lane 4a's things in space: a row a kind, lane 3's card shape
// ({ type, about, color, solid, far?, move? }) with two more, spread into
// places/cards.js's THING_CARDS after its own rows. Pure (no React, DOM or
// three.js). It imports nothing of places/: places/cards.js imports it, so
// the other way round would be a cycle. A row with no `far` is listed out to
// the far plane; places/cards.js gives it that when it spreads these in.
//
// CATALOGUE_CARDS: { [kind]: { type, about, color, solid, far?, move?, land?, chart } }
//   land(row) → boolean, for a kind you can land on (placeCard's `land`)
//   chart: { shape: 'dot' | 'cloud' | 'hole' | 'star', priority }, for the map's marks

import { KINDS, traitsOf } from '../../expanse/shared/gen';
import { PLACE } from '../words';

const DOT = Object.freeze({ shape: 'dot', priority: 20 });
const card = (kind, more = {}) => ({ type: PLACE.thing[kind], about: PLACE.about[kind], color: KINDS[kind].color, solid: true, chart: DOT, ...more });

export const CATALOGUE_CARDS = {
  rogue: card('rogue', { land: (row) => traitsOf(row).land }),
  outpost: card('outpost'),
  beacon: card('beacon'),
  relay: card('relay'),
  monolith: card('monolith'),
};
