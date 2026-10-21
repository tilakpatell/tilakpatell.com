// Lothlórien’s beats (the design’s §4.3, row 9; the plan’s Stage table):
// the Nimrodel’s stream, Haldir out of the trees, the climb round a
// mallorn to the flets, Galadriel and Celeborn on the dais, the Mirror (the
// basin darkening, the Eye in it, her light), and the boats at the hythe.
// `at` in metres into the stage, `hold` in seconds; a `params` height is
// over the ground (`above`), the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the stream under the first mallorns, gold leaves on the water
  { id: 'nimrodel', kind: 'nimrodel', at: 10, hold: 0, rig: 'side', reach: 14 },
  // Haldir out of the trees, bow in hand
  { id: 'haldir', kind: 'haldir', at: 28, hold: 6, rig: 'seat', reach: 10, params: { at: [4, 1.7, 24], lookAt: [-1.5, 1.6, 33], above: true }, lines: ['lorien-haldir'], deed: { verb: 'choose', label: 'Greet Haldir', at: 1, choices: [{ label: 'Mae govannen', right: true }, { label: 'Mellon', line: { who: 'haldir', text: 'Friend? Perhaps. The Lady will decide that, not you.' } }, { label: 'Edro', line: { who: 'haldir', text: 'There are no doors in these woods to open, little one.' } }], lines: ['lorien-greeting'] } },
  // up the stair round the great tree
  { id: 'climb', kind: 'climb', at: 46, hold: 0, rig: 'follow', reach: 28 },
  // the dais on the flet round the great tree, 18 m up: the Lady and the Lord
  { id: 'dais', kind: 'dais', at: 80, hold: 8, rig: 'seat', reach: 10, params: { at: [3.4, 19.9, 75.5], lookAt: [-4.2, 19.7, 81.6], above: true }, lines: ['lorien-galadriel'] },
  // the Mirror: the basin goes dark, the Eye looks out, then her light (no vision
  // drain: the Eye’s fire is to be the one colour in the frame)
  { id: 'mirror', kind: 'mirror', at: 100, hold: 14, rig: 'seat', cut: 0, reach: 10, params: { at: [-2.6, 3.9, 98.6], lookAt: [-6, 0.4, 103.2], above: true }, deed: { verb: 'press', label: 'Look into the Mirror', clip: 'taskAppointed' } },
  // the hythe and the swan-boat; away down the Silverlode
  { id: 'boats', kind: 'boats', at: 128, hold: 6, rig: 'lead', reach: 22, deed: { verb: 'press', label: 'Take the Lady’s gift', at: 2, lines: ['lorien-phial'] } },
];
