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
  // at the foot of the last cliff, Sam’s rope hanging down it (from the
  // side: the cliff stands on the left, behind them)
  { id: 'rope', kind: 'rope', at: 18, hold: 6, rig: 'side', reach: 12 },
  // Gollum head first down the rock in the night, onto them, and arguing with himself
  { id: 'gollum', kind: 'gollum', at: 30, hold: 10, rig: 'seat', cut: 0, reach: 12, params: { at: [-0.5, 1.3, 30], lookAt: [6.5, 3.6, 23.5], above: true }, clip: 'nobodyLikesYou', deed: { verb: 'press', label: 'Let Sméagol off the rope', at: 4, lines: ['marshes-sweet'] } },
  // out over the marsh in the mist, the candles in the pools
  { id: 'candles', kind: 'candles', at: 58, hold: 0, rig: 'side', reach: 18 },
  // the faces under the water; Frodo down at the edge, pulled back (looking
  // down past him into the pool: a low camera sees only the water’s skin)
  { id: 'faces', kind: 'faces', at: 80, hold: 8, rig: 'seat', reach: 12, params: { at: [1.5, 1.7, 78], lookAt: [9, -0.6, 85], above: true }, deed: { verb: 'hold', label: 'Pull Frodo back from the water', seconds: 3, at: 2.5, lines: ['marshes-faces'] } },
  // the fell beast’s shadow across the marsh, its scream
  { id: 'fellbeast', kind: 'fellbeast', at: 102, hold: 6, rig: 'wide', reach: 14, params: { at: [-6, 1.2, 96], lookAt: [8, 14, 120], above: true }, clip: 'nazgul', deed: { verb: 'hold', label: 'Down in the water: keep still', seconds: 3, at: 1, lines: ['marshes-down'] } },
  // the Morannon: the Easterlings marching in under the trumpets, the doors; the other way
  { id: 'gate', kind: 'gate', at: 128, hold: 12, rig: 'wide', reach: 18, params: { at: [-4, 3, 122], lookAt: [60, 14, 148], above: true }, lines: ['marshes-gollum'] },
];
