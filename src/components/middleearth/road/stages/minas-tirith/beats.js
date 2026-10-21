// The White City's beats (the design’s §4.3, row 15): the city across the
// Pelennor on its knee of Mindolluin, the walk up the causeway to the Great
// Gate, under the gate, and the Court of the Fountain at the top: the King
// before the White Tree, the company with him, the four come before him and
// bow, and he and all of them bow to the four. `at` in metres into the
// stage, `hold` in seconds; a `params` height is over the ground where it
// says `above`, else the city's own (place.js). Pure.

import { COURT, GATE } from './place';

export { entered, left } from '../../beats';

export const BEATS = [
  // the city white in the sun across the field, the company small on the road to it
  { id: 'pelennor', kind: 'pelennor', at: 6, hold: 6, rig: 'wide', reach: 22, params: { at: [-16, 3, 2], lookAt: [0, 48, 250], above: true }, lines: ['minas-pippin'], deed: { verb: 'press', label: 'Look up at the White City', at: 2, lines: ['minas-city'] } },
  // up the causeway, the walls rising over them
  { id: 'causeway', kind: 'causeway', at: 48, hold: 0, rig: 'crane', reach: 30, params: { seconds: 12, top: 16, lookAt: [0, 40, 240] } },
  // under the Great Gate, looking up
  { id: 'gate', kind: 'gate', at: GATE - 12, hold: 4, rig: 'low', reach: 14, deed: { verb: 'press', label: 'Walk in through the Great Gate', at: 1, lines: ['minas-gate'] } },
  // the Court of the Fountain: the King crowned before the Tree; the four bow,
  // and are stopped; the court bows to them (the rest of the stage holds here)
  {
    id: 'court',
    kind: 'court',
    at: GATE + 14,
    hold: 24,
    rig: 'seat',
    cut: 0,
    reach: 40,
    params: { at: COURT.camera, lookAt: COURT.look },
    clip: 'kingsArrival',
    lines: ['minas-aragorn'],
    deed: { verb: 'press', label: 'Bow to the King', at: 9, clip: 'bowToNoOne' },
  },
];
