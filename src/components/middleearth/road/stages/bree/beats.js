// Bree’s beats (the design’s §4.3, row 3; the plan’s Stage table): the
// gatekeeper’s lantern at the hatch, the lane to the Pony under the eaves,
// the common room through its window, the four Riders through the gate at a
// gallop to the beds, and Strider leading them out the back way at dawn.
// `at` in metres into the stage, `hold` in seconds; a `params` height is
// over the ground (`above`), the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the West-gate in the rain, the hatch open, the lantern held up
  { id: 'gate', kind: 'gate', at: 16, hold: 8, rig: 'low', reach: 14 },
  // the lane between the tall houses, Bree men under the eaves
  { id: 'lane', kind: 'lane', at: 50, hold: 0, rig: 'follow' },
  // the Pony’s window: Butterbur at the bar, a pipe glowing in the corner
  { id: 'pony', kind: 'pony', at: 82, hold: 12, rig: 'seat', reach: 14, params: { at: [-5.5, 1.5, 88], lookAt: [-9.5, 1.9, 96], above: true }, lines: ['bree-pony'] },
  // the Riders: four through the gate at a gallop, the blades in the beds
  { id: 'riders', kind: 'riders', at: 108, hold: 10, rig: 'wide', cut: 0, reach: 14, params: { at: [6, 7, 122], lookAt: [-2, 1.5, 70], above: true }, clip: 'nazgul' },
  // grey morning: Strider takes them out by the back way
  { id: 'dawn', kind: 'dawn', at: 134, hold: 0, rig: 'lead', reach: 16, lines: ['bree-dawn'] },
];
