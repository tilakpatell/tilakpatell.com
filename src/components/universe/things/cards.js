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
// GIANT_FAR: how far off a gargantuan is listed (400,000: it's seen from across a sector)

import { KINDS, rowAt, traitsOf } from '../../expanse/shared/gen';
import { PLACE } from '../words';

const DOT = Object.freeze({ shape: 'dot', priority: 20 });
export const GIANT_FAR = 400000;
const STAR = Object.freeze({ shape: 'star', priority: 30 });
const CLOUD = Object.freeze({ shape: 'cloud', priority: 35 });
const dot = (priority) => Object.freeze({ shape: 'dot', priority });
const card = (kind, more = {}) => ({ type: PLACE.thing[kind], about: PLACE.about[kind], color: KINDS[kind].color, solid: true, chart: DOT, ...more });

export const CATALOGUE_CARDS = {
  rogue: card('rogue', { land: (row) => traitsOf(row).land }),
  outpost: card('outpost'),
  beacon: card('beacon'),
  relay: card('relay'),
  monolith: card('monolith'),
  field: card('field', { solid: false, chart: dot(15) }),
  icefield: card('icefield', { solid: false, chart: dot(15) }),
  comet: card('comet', { move: (row, t) => rowAt(row, t), chart: dot(25) }),
  rig: card('rig'),
  fleet: card('fleet', { chart: dot(30) }),
  shipyard: card('shipyard', { chart: dot(30) }),
  pocket: card('pocket', { solid: false, chart: CLOUD }),
  remnant: card('remnant', { solid: false, chart: CLOUD }),
  // (a storm, a herd and a swarm are parked outside, not inside: solid on the card, passable in flight)
  storm: card('storm', { move: (row, t) => rowAt(row, t), chart: dot(30) }),
  herd: card('herd', { move: (row, t) => rowAt(row, t), chart: dot(30) }),
  swarm: card('swarm', { move: (row, t) => rowAt(row, t), chart: dot(30) }),
  debris: card('debris', { solid: false, chart: dot(15) }),
  magnetar: card('magnetar', { chart: STAR }),
  protostar: card('protostar', { chart: STAR }),
  // (parked outside its throat)
  wormhole: card('wormhole', { chart: Object.freeze({ shape: 'hole', priority: 40 }) }),
  // (a gargantuan is on the sky from across a sector, so it's listed out to 400,000; parked
  // outside its whole extent)
  hole: card('hole', { far: GIANT_FAR, chart: Object.freeze({ shape: 'hole', priority: 80 }) }),
  arc: card('arc', { far: GIANT_FAR, chart: Object.freeze({ shape: 'dot', priority: 80 }) }),
  hulk: card('hulk', { far: GIANT_FAR, chart: Object.freeze({ shape: 'dot', priority: 80 }) }),
  giant: card('giant', { far: GIANT_FAR, chart: Object.freeze({ shape: 'dot', priority: 80 }) }),
  dyson: card('dyson', { far: GIANT_FAR, chart: Object.freeze({ shape: 'star', priority: 80 }) }),
};
