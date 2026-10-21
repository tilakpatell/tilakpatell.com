// The Ford’s beats (the design’s §4.3, row 5; the plan’s Stage table):
// Bilbo’s trolls in stone in their clearing, Arwen out of the trees on
// Asfaloth, the ride with the Nine behind, and the Ford: across, the Nine
// at the water, the river rising in horses of foam. `at` in metres into the
// stage, `hold` in seconds; a `params` height is over the ground (`above`),
// the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the three trolls in stone, as Bilbo left them, under the leaves: the
  // walkers small beside them (the plan’s low rig had the walkers fill the frame)
  { id: 'trolls', kind: 'trolls', at: 30, hold: 8, rig: 'wide', reach: 14, params: { at: [-2.5, 1.5, 27], lookAt: [9.5, 2.4, 40], above: true }, deed: { verb: 'press', label: 'Look up at the stone trolls', at: 2, lines: ['ford-trolls'] } },
  // Arwen out of the trees on the white horse
  { id: 'arwen', kind: 'arwen', at: 72, hold: 6, rig: 'side', reach: 8, lines: ['ford-arwen'], deed: { verb: 'press', label: 'Take Arwen’s hand', at: 2, lines: ['ford-asfaloth'] } },
  // the ride: on Asfaloth behind her, the trees whipping by, the Nine gaining
  // (low at the white horse’s near flank and a little behind, the riders and the road ahead in the frame)
  { id: 'ride', kind: 'ride', at: 80, hold: 0, rig: 'ride', reach: 96, params: { offset: [-1.3, 2.4, -4.4] }, deed: { verb: 'rhythm', label: 'Ride for the Ford', beats: 10 } },
  // the far bank: the Nine at the water, the river rising, horses of foam
  { id: 'ford', kind: 'ford', at: 186, hold: 18, rig: 'seat', cut: 0, reach: 12, params: { at: [5, 2.4, 190], lookAt: [0, 1.6, 156], above: true }, clip: 'nazgul', deed: { verb: 'press', label: 'Call up the river', at: 5 } },
];
