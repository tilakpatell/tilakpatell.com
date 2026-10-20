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
  // the Pony’s open door: Butterbur in it, the common room’s light behind him, a
  // Ranger’s pipe glowing on the bench under the eaves (the window the brief has
  // is the chapter’s Pony’s door here: its walls are closed)
  { id: 'pony', kind: 'pony', at: 82, hold: 12, rig: 'seat', reach: 14, params: { at: [1.4, 1.6, 86.5], lookAt: [-3.4, 1.5, 93.6], above: true }, lines: ['bree-pony'] },
  // the Riders: four through the gate at a gallop, the blades in the beds
  // (from over the lane at the Pony’s end, down it to the gate: the eaves either side)
  { id: 'riders', kind: 'riders', at: 108, hold: 10, rig: 'wide', cut: 0, reach: 14, params: { at: [0.2, 7.2, 121], lookAt: [0, 1.6, 48], above: true }, clip: 'nazgul' },
  // grey morning: Strider takes them out by the back way
  { id: 'dawn', kind: 'dawn', at: 134, hold: 0, rig: 'lead', reach: 16, lines: ['bree-dawn'] },
];
