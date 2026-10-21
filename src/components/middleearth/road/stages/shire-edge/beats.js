// The Shire’s edge’s beats (the design’s §4.3, row 2; the plan’s Stage
// table): Merry and Pippin out of Maggot’s crop, the Rider over the roots
// the four hide under, then the run to Bucklebury Ferry in the rain and the
// Rider reining in at the landing behind the raft. `at` in metres into the
// stage, `hold` in seconds; a `params` height is over the ground (`above`),
// the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the corn parts, two hobbits tumble into the lane with their arms full
  { id: 'mushrooms', kind: 'mushrooms', at: 24, hold: 6, rig: 'side', reach: 20, clip: 'secondBreakfast', deed: { verb: 'press', label: 'Catch the mushrooms', at: 1.5, lines: ['shire-mushrooms'] } },
  // under the roots: a hard cut into the hollow, low, looking out and up at
  // the Rider over it, the sniffing, the Ring pulling twice
  { id: 'roots', kind: 'roots', at: 92, hold: 16, rig: 'seat', cut: 0, reach: 12, params: { at: [2.95, 0.5, 93.4], lookAt: [-0.6, 1.7, 95.8], above: true }, fx: [{ kind: 'vision', at: 6, seconds: 0.12 }, { kind: 'vision', at: 10, seconds: 0.12 }], deed: { verb: 'hold', label: 'Keep still, and keep the Ring off', stance: 'crouch', seconds: 4, at: 6.5 } },
  // the run for the ferry as the rain comes on, the lane coming at you
  { id: 'run', kind: 'run', at: 106, hold: 0, rig: 'lead', reach: 22 },
  // on the raft, the Rider at the landing behind them, reining in at the water
  { id: 'ferry', kind: 'ferry', at: 140, hold: 12, rig: 'wide', reach: 14, params: { at: [-10, 3.4, 170], lookAt: [0, 1.4, 133], above: true }, deed: { verb: 'rhythm', label: 'Pole the ferry across', beats: 10, at: 1, lines: ['shire-ferry'] } },
];
