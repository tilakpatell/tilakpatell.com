// Who he flies as (part 3): the figures with flight clips in the cast, each
// a row of multipliers on ./flight.js's numbers and ./brawl.js's fists, a
// power (./powers.js) and what unlocks it. Missions stay Mark's.
//
//   hero(id) → the row (an unknown id is Mark's)
//   canPlay(id, { story, achievements }) → bool: Eve once her race is won,
//     Omni-Man once episode 8 is played (`truth`), Thragg once Think, Mark!
//     is won (`regent`)
//   speedFor(id) → his top speed, m/s

import { FLY } from './flight';

export const DEFAULT = 'mark';
// flight: top (and cruise) speed, agility (how fast he turns), boom (the
// sound barrier's speed); fists: what a blow is worth; power: ./powers.js's
export const HEROES = {
  mark: { id: 'mark', name: 'Invincible', cast: 'mark', voice: null, flight: { top: 1, agility: 1, boom: FLY.barrier }, fists: 1, power: null },
  eve: { id: 'eve', name: 'Atom Eve', cast: 'eve', voice: 'eve', flight: { top: 0.8, agility: 1.3, boom: FLY.barrier }, fists: 1, power: 'transmute' },
  omniman: { id: 'omniman', name: 'Omni-Man', cast: 'omni', voice: 'omni', flight: { top: 1.6, agility: 1, boom: 90 }, fists: 1.5, power: 'linebreak' },
  thragg: { id: 'thragg', name: 'Thragg', cast: 'thragg', voice: 'thragg', flight: { top: 1.8, agility: 1, boom: FLY.barrier }, fists: 2, power: 'shout' },
};
export const ORDER = ['mark', 'eve', 'omniman', 'thragg'];

export const hero = (id) => HEROES[id] ?? HEROES[DEFAULT];

export function canPlay(id, { story = {}, achievements = [] } = {}) {
  const got = new Set(Array.isArray(achievements) ? achievements : []);
  if (id === 'mark') return true;
  if (id === 'eve') return Number.isFinite(story?.best?.everace);
  if (id === 'omniman') return got.has('truth');
  if (id === 'thragg') return got.has('regent');
  return false;
}

export const speedFor = (id) => FLY.top * hero(id).flight.top;
