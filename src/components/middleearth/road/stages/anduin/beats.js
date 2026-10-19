// The Anduin’s beats (the design’s §4.3, row 10; the plan’s Stage table):
// the boats on the river with Gollum’s log far behind, the Argonath, the
// lake under Tol Brandir with Rauros roaring, the Seat of Seeing on Amon
// Hen, the horn and the Uruks, and the breaking: Frodo to the boat, Sam
// after him. `at` in metres into the stage, `hold` in seconds; a `params`
// height is over the ground (`above`), the stage’s scene reads the rest.
// Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // in the boats at night, the log drifting far behind
  { id: 'river', kind: 'river', at: 0, hold: 0, rig: 'ride', reach: 40, params: { offset: [-0.6, 1.6, -3.4] } },
  // the Kings of old either side of the gorge, rising as the boats come under them
  { id: 'argonath', kind: 'argonath', at: 46, hold: 12, rig: 'crane', reach: 16, params: { seconds: 10, top: 8, lookAt: [0, 40, 70] } },
  // Nen Hithoel opening out: Tol Brandir, the roar of Rauros
  { id: 'nenhithoel', kind: 'nenhithoel', at: 78, hold: 0, rig: 'wide', reach: 18, params: { at: [-10, 2.6, 70], lookAt: [6, 8, 120], above: true } },
  // ashore at Parth Galen, up to the Seat: the vision across the sky
  { id: 'seat', kind: 'seat', at: 112, hold: 12, rig: 'seat', cut: 0, reach: 10, params: { at: [2.6, 2.2, 108], lookAt: [-1, 2.6, 130], above: true }, fx: [{ kind: 'vision', at: 2, seconds: 8 }] },
  // three notes of the horn, the Uruks through the trees
  { id: 'horn', kind: 'horn', at: 130, hold: 8, rig: 'follow', reach: 12, clip: 'meatsBack' },
  // Frodo to the boat, Sam into the water after him, hauled in
  { id: 'breaking', kind: 'breaking', at: 146, hold: 10, rig: 'side', reach: 20 },
];
