// The Grey Havens’ beats (the design’s §4.3, row 16): three years on, the
// Gulf of Lune under the Blue Mountains at sunset; out along the long grey
// quay; the farewell by the white ship, the four who sail aboard; Frodo
// turns to Sam, Merry and Pippin (the deed), and goes up into her; she
// casts off and the quay falls behind, the three on it; and away into the
// light. `at` in metres into the stage, `hold` in seconds; a `params`
// height is over the ground where it says `above`, else the quay’s own
// (place.js). Pure.

import { QUAY, SAIL } from './place';

export { entered, left } from '../../beats';

export const BEATS = [
  // the Gulf at sunset: the quay out over the water, the ship white at its end
  { id: 'gulf', kind: 'gulf', at: 10, hold: 0, rig: 'wide', reach: 30, params: { at: [12, 5, 2], lookAt: [2, 3, 165], above: true } },
  // out along the quay
  { id: 'quay', kind: 'quay', at: 52, hold: 0, rig: 'side', reach: 40 },
  // by the ship: the four who sail are aboard; Frodo turns to the three
  {
    id: 'farewell',
    kind: 'farewell',
    at: SAIL - 20,
    hold: 18,
    rig: 'seat',
    cut: 0,
    reach: 20,
    params: { at: [-2.6, QUAY.top + 1.5, SAIL - 13], lookAt: [2.4, QUAY.top + 1.1, SAIL - 3] },
    lines: ['havens-gandalf'],
    deed: { verb: 'press', label: 'Say goodbye', at: 5, lines: ['havens-frodo'] },
  },
  // she casts off: the quay falling behind, the three small on it
  { id: 'sail', kind: 'sail', at: SAIL, hold: 0, rig: 'lead', reach: 70, clip: 'lotr' },
  // away into the light, from the quay’s end
  { id: 'away', kind: 'away', at: SAIL + 70, hold: 6, rig: 'wide', reach: 80, params: { at: [-1.2, QUAY.top + 2.2, QUAY.z[1] - 6], lookAt: [0, 2, 420] }, deed: { verb: 'press', label: 'Wave to the three on the quay', at: 2, lines: ['havens-wave'] } },
];
