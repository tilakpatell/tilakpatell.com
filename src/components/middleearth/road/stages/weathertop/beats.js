// Weathertop’s beats (the design’s §4.3, row 4; the plan’s Stage table):
// the Lone-lands wide under the sky, Sam’s supper fire in the dell, the five
// on the skyline, the Ring on and the kings in their crowns, Aragorn with
// fire in both hands, and the kingsfoil. `at` in metres into the stage,
// `hold` in seconds; a `params` height is over the ground (`above`), the
// stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the Lone-lands: the walkers small under a wide dusk, the hill ahead
  { id: 'lonelands', kind: 'lonelands', at: 20, hold: 0, rig: 'wide', reach: 24, params: { at: [22, 9, 4], lookAt: [-4, 2, 60], above: true } },
  // the dell under the summit: Sam’s fire, the pans, the dark coming down
  { id: 'dell', kind: 'dell', at: 66, hold: 8, rig: 'seat', reach: 14, params: { at: [4.5, 1.3, 74], lookAt: [-1.5, 0.8, 66], above: true } },
  // five on the skyline above the dell
  { id: 'summit', kind: 'summit', at: 100, hold: 6, rig: 'crane', reach: 12, params: { seconds: 6, top: 9, lookAt: [0, 6, 122], above: true } },
  // the Ring goes on: the world drains, the five are kings, the blade
  { id: 'ring', kind: 'ring', at: 114, hold: 14, rig: 'seat', cut: 0, reach: 12, params: { at: [3.4, 2.7, 111], lookAt: [-0.5, 1.1, 126], above: true }, clip: 'nazgul', fx: [{ kind: 'vision', at: 1, seconds: 12 }] },
  // Aragorn with fire in both hands, the Riders burning and gone
  { id: 'fire', kind: 'fire', at: 128, hold: 8, rig: 'follow', reach: 12 },
  // Frodo on the ground, Aragorn kneeling over him: the Morgul blade
  { id: 'kingsfoil', kind: 'kingsfoil', at: 146, hold: 10, rig: 'low', reach: 14, lines: ['weathertop-kingsfoil'] },
];
