// Cirith Ungol’s beats (the design’s §4.3, row 13; the plan’s Stage
// table): up the stair in the dark cliff, Gollum’s betrayal and Sam sent
// back down, the tunnel with the Phial the one light, Shelob out of her side
// passage and Frodo stung, the orcs’ torches and Sam alone, the tower’s
// stair and Frodo found, and out between the Watchers onto the plain. `at`
// in metres into the stage, `hold` in seconds; a `params` height is over
// the ground (`above`), the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the first stair, straight up the cliff in the dark
  { id: 'stair', kind: 'stair', at: 0, hold: 0, rig: 'follow', reach: 30 },
  // near the top: Gollum’s word in Frodo’s ear, Sam sent back down
  { id: 'betrayal', kind: 'betrayal', at: 40, hold: 8, rig: 'seat', reach: 10, params: { at: [2.2, 1.6, 36], lookAt: [-0.5, 1.2, 42], above: true }, lines: ['cirith-gollum'] },
  // into the tunnel: the webs, the Phial lit
  { id: 'tunnel', kind: 'tunnel', at: 62, hold: 0, rig: 'follow', reach: 14 },
  // Shelob out of the side passage; the sting; Sam with the light, and she goes
  { id: 'shelob', kind: 'shelob', at: 82, hold: 16, rig: 'low', cut: 0, reach: 12 },
  // the orcs’ torches round Frodo; Sam alone in the dark
  { id: 'taken', kind: 'taken', at: 100, hold: 8, rig: 'seat', reach: 10, params: { at: [-3, 1.4, 96], lookAt: [1, 0.8, 104], above: true }, lines: ['cirith-sam'] },
  // up the tower’s stair; Frodo found, sitting up
  { id: 'tower', kind: 'tower', at: 118, hold: 10, rig: 'seat', reach: 10, params: { at: [2.5, 1.5, 116], lookAt: [-1.5, 0.7, 121], above: true } },
  // out through the gate between the Watchers, onto the plain
  { id: 'gate', kind: 'gate', at: 132, hold: 0, rig: 'follow', reach: 10 },
];
