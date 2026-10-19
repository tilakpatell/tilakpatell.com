// The Dead Marshes’ beats (the design’s §4.3, row 11; the plan’s Stage
// table): the rope down the Emyn Muil’s last cliff, Gollum creeping down the
// rock onto them and tamed, the candles in the mist, the faces under the
// water and Frodo drawn down to them, the fell beast’s shadow over the
// marsh, and the Black Gate between its towers, the Easterlings marching in
// and Gollum’s other way. `at` in metres into the stage, `hold` in seconds;
// a `params` height is over the ground (`above`), the stage’s scene reads
// the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // at the foot of the last cliff, Sam’s rope hanging down it
  { id: 'rope', kind: 'rope', at: 10, hold: 6, rig: 'low', reach: 12 },
  // Gollum head first down the rock in the night, onto them, and arguing with himself
  { id: 'gollum', kind: 'gollum', at: 30, hold: 10, rig: 'seat', cut: 0, reach: 12, params: { at: [-2.5, 1.5, 26], lookAt: [-9, 4, 38], above: true }, clip: 'nobodyLikesYou' },
  // out over the marsh in the mist, the candles in the pools
  { id: 'candles', kind: 'candles', at: 58, hold: 0, rig: 'side', reach: 18 },
  // the faces under the water; Frodo down at the edge, pulled back
  { id: 'faces', kind: 'faces', at: 80, hold: 8, rig: 'low', reach: 12 },
  // the fell beast’s shadow across the marsh, its scream
  { id: 'fellbeast', kind: 'fellbeast', at: 102, hold: 6, rig: 'wide', reach: 14, params: { at: [-6, 1.2, 96], lookAt: [8, 14, 120], above: true }, clip: 'nazgul' },
  // the Morannon: the Easterlings marching in under the trumpets, the doors; the other way
  { id: 'gate', kind: 'gate', at: 128, hold: 12, rig: 'wide', reach: 18, params: { at: [-4, 3, 122], lookAt: [60, 14, 148], above: true }, lines: ['marshes-gollum'] },
];
