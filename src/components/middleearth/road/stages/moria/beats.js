// Moria’s beats (the design’s §4.3, row 8; the plan’s Stage table): the
// dark with the staff alight, Balin’s tomb in its shaft of light, the
// drums, the hall of the Dwarrowdelf, the stair, the Bridge (the Balrog,
// the staff down, the fall, the last words) and the Dimrill Dale. `at` in
// metres into the stage, `hold` in seconds; a `params` height is over the
// ground (`above`), the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // in from the Doors: black, the staff’s light the only light
  { id: 'dark', kind: 'dark', at: 8, hold: 0, rig: 'follow', reach: 20 },
  // the Chamber of Mazarbul: the shaft of light on Balin’s tomb
  { id: 'tomb', kind: 'tomb', at: 38, hold: 10, rig: 'seat', reach: 10, params: { at: [-3.5, 1.6, 34], lookAt: [3, 1, 42], above: true }, lines: ['moria-gimli'] },
  // the drums in the deep; goblins down the pillars
  { id: 'drums', kind: 'drums', at: 50, hold: 6, rig: 'follow', reach: 14 },
  // the Dwarrowdelf’s pillars going on into the dark
  { id: 'dwarrowdelf', kind: 'dwarrowdelf', at: 76, hold: 8, rig: 'crane', reach: 18, params: { seconds: 7, top: 14, lookAt: [0, 6, 110], above: true } },
  // the broken stair, across the gap
  { id: 'stair', kind: 'stair', at: 104, hold: 0, rig: 'follow', reach: 16 },
  // the fire behind them: Gandalf turns them out onto the bridge
  { id: 'run', kind: 'run', at: 124, hold: 0, rig: 'follow', reach: 10, clip: 'gandalfRun' },
  // the Bridge of Khazad-dûm, low on the stone looking up past Gandalf: the Balrog, the staff down, the bridge breaks, the whip
  { id: 'bridge', kind: 'bridge', at: 136, hold: 22, rig: 'low', cut: 0, reach: 4, clip: 'youShallNotPass' },
  // his last words from the edge, the same shot, as the hold ends
  { id: 'fly', kind: 'fly', at: 137, hold: 0, rig: 'low', reach: 6, clip: 'flyYouFools' },
  // out into the light: the Mirrormere, the eight grieving on the slope
  { id: 'dale', kind: 'dale', at: 164, hold: 8, rig: 'wide', reach: 16, params: { at: [-8, 3, 158], lookAt: [6, 0, 180], above: true } },
];
