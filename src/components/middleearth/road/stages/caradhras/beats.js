// Caradhras’ beats (the design’s §4.3, row 7; the plan’s Stage table):
// Hollin’s holly under a hard sky, the crebain over the ridge, the Redhorn
// in a white-out with Saruman on the wind, the slab that slides, then down
// to the Walls of Moria: the Doors come up in the moonlight and open on the
// word, and the Watcher comes out of the lake. `at` in metres into the
// stage, `hold` in seconds; a `params` height is over the ground (`above`),
// the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // Eregion’s bare hills, the holly, the mountains ahead (from the side: a lead shot
  // looks back from among the nine walking ahead of Frodo)
  { id: 'hollin', kind: 'hollin', at: 12, hold: 0, rig: 'side', reach: 16 },
  // the flock over the ridge and back; the walkers under the rocks
  { id: 'crebain', kind: 'crebain', at: 32, hold: 8, rig: 'wide', reach: 12, params: { at: [-9, 2.2, 22], lookAt: [6, 9, 52], above: true } },
  // the Redhorn in snow, the wind at full, Saruman’s voice on it
  { id: 'snow', kind: 'snow', at: 64, hold: 10, rig: 'wide', reach: 12, params: { at: [7, 4, 50], lookAt: [-1, 1.5, 70], above: true }, lines: ['caradhras-saruman'] },
  // the slab slides off the ridge above: a white burst, the frame shaken
  { id: 'avalanche', kind: 'avalanche', at: 80, hold: 5, rig: 'follow', cut: 0, reach: 10, fx: [{ kind: 'shake', at: 0.8, seconds: 3 }] },
  // down to the Walls: the lake black under the cliff, the holly either side
  { id: 'walls', kind: 'walls', at: 110, hold: 0, rig: 'follow', reach: 18 },
  // the moon up, the lines rise in the stone, the word, the Doors open
  { id: 'doors', kind: 'doors', at: 140, hold: 14, rig: 'low', reach: 12, lines: ['caradhras-mellon'] },
  // the arms out of the water, Frodo lifted and cut down, the Doors fall behind
  { id: 'watcher', kind: 'watcher', at: 146, hold: 10, rig: 'seat', cut: 0, reach: 18, params: { at: [0.5, 1.7, 135], lookAt: [-11, 4.2, 145], above: true } },
];
