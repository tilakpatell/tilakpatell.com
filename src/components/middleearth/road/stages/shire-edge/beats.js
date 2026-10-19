// The Shire’s edge’s beats (the design’s §4.3, row 2; the plan’s Stage
// table): Merry and Pippin out of Maggot’s crop, the Rider over the roots
// the four hide under, then the run to Bucklebury Ferry in the rain and the
// Rider reining in at the landing behind the raft. `at` in metres into the
// stage, `hold` in seconds; a `params` height is over the ground (`above`),
// the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the corn parts, two hobbits tumble into the lane with their arms full
  { id: 'mushrooms', kind: 'mushrooms', at: 24, hold: 6, rig: 'side', reach: 20, clip: 'secondBreakfast' },
  // under the roots: hooves over the bank, the sniffing, the Ring pulling twice
  { id: 'roots', kind: 'roots', at: 92, hold: 16, rig: 'low', cut: 0, reach: 12, fx: [{ kind: 'vision', at: 6, seconds: 0.12 }, { kind: 'vision', at: 10, seconds: 0.12 }] },
  // the run for the ferry as the rain comes on, the lane coming at you
  { id: 'run', kind: 'run', at: 106, hold: 0, rig: 'lead', reach: 22 },
  // on the raft, the Rider at the landing behind them, reining in at the water
  { id: 'ferry', kind: 'ferry', at: 140, hold: 12, rig: 'wide', reach: 14, params: { at: [-11, 2.4, 170], lookAt: [0, 1.4, 133], above: true } },
];
