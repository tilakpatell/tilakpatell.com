// Hobbiton’s beats (the design’s §4.3, row 1; the plan’s Stage table): the
// Road’s first words over black at Bag End’s door, Gandalf’s cart up the
// lane, the Party Field’s jig, the dragon and Bilbo gone, then the field’s
// edge and Sam. `at` in metres into the stage, `hold` in seconds; a
// `params` height is over the ground (`above`), the stage’s scene reads
// the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // over black, the Road’s first words, then the door on the Hill
  { id: 'open', kind: 'open', at: 0, hold: 6, rig: 'wide', params: { at: [-7, 3.2, -12], lookAt: [14, 2.4, 8], above: true }, clip: 'worldIsChanged', fx: [{ kind: 'black', at: 0, seconds: 6 }] },
  // the cart up the lane, fireworks rattling in its bed, the horse at a slow walk
  { id: 'cart', kind: 'cart', at: 40, hold: 0, rig: 'side', reach: 24, clip: 'wizardLate' },
  // the Party Field: the tree, the lanterns, the long tables, the jig
  { id: 'partyfield', kind: 'party', at: 120, hold: 14, rig: 'crane', params: { seconds: 10, top: 14, lookAt: [26, 4, 130], above: true }, fx: [{ kind: 'jig', at: 0, seconds: 14 }] },
  // the dragon over the field; Bilbo by the tree, and then not
  { id: 'dragon', kind: 'dragon', at: 150, hold: 10, rig: 'wide', reach: 10, params: { at: [-8, 4, 108], lookAt: [32, 16, 142], above: true }, fx: [{ kind: 'vision', at: 6, seconds: 0.4 }], deed: { verb: 'press', label: 'Light the dragon' } },
  // the corn at the field’s edge, as far as Sam has ever been
  { id: 'leave', kind: 'leave', at: 212, hold: 0, rig: 'follow', lines: ['hobbiton-field-edge', 'hobbiton-field-edge-answer'] },
];
