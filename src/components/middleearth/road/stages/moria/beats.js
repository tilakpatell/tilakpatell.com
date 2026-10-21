// Moria’s beats (the design’s §4.3, row 8; the plan’s Stage table): the
// dark with the staff alight, Balin’s tomb in its shaft of light, the
// drums, the hall of the Dwarrowdelf, the broken stair down, the Bridge
// (the Balrog behind them, Gandalf turning on the span, the staff down, the
// fall, his last words) and out into the Dimrill Dale. `at` in metres into
// the stage, `hold` in seconds; a `params` height is over the ground
// (`above`), the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

// the Bridge’s shot: from the far bank, low by the stone, back along the
// span past Gandalf to the Balrog at the near end (the company crossed, in
// front of the camera)
const BRIDGE = { at: [2.6, 1.3, 127], lookAt: [0, 4.5, 88], above: true };

export const BEATS = [
  // in from the Doors: black, the staff’s light the only light
  { id: 'dark', kind: 'dark', at: 6, hold: 0, rig: 'follow', reach: 14 },
  // the Chamber of Mazarbul: the shaft of light on Balin’s tomb
  { id: 'tomb', kind: 'tomb', at: 22, hold: 10, rig: 'seat', reach: 8, params: { at: [-8.2, 1.7, 21], lookAt: [-14, 1.3, 24.5], above: true }, lines: ['moria-gimli'], deed: { verb: 'press', label: 'Read the Book of Mazarbul', at: 3, lines: ['moria-book'] } },
  // the drums in the deep; goblins down the pillars ahead
  { id: 'drums', kind: 'drums', at: 34, hold: 6, rig: 'follow', reach: 12, fx: [{ kind: 'shake', at: 0, seconds: 1.4 }], deed: { verb: 'press', label: 'Bar the door', at: 1, lines: ['moria-door'] } },
  // the Dwarrowdelf’s pillars going on into the dark
  { id: 'dwarrowdelf', kind: 'dwarrowdelf', at: 50, hold: 8, rig: 'crane', reach: 18, params: { seconds: 7, top: 12, lookAt: [0, 6, 74], above: true } },
  // down the broken stair to the abyss
  { id: 'stair', kind: 'stair', at: 78, hold: 0, rig: 'follow', reach: 14 },
  // the fire behind them: Gandalf turns them out onto the bridge
  { id: 'run', kind: 'run', at: 94, hold: 0, rig: 'follow', reach: 10, clip: 'gandalfRun' },
  // the Bridge of Khazad-dûm: the Balrog, the staff down, the bridge breaks, the whip
  { id: 'bridge', kind: 'bridge', at: 106, hold: 22, rig: 'seat', cut: 0, reach: 2, params: BRIDGE, fx: [{ kind: 'shake', at: 11, seconds: 2 }], deed: { verb: 'hold', label: 'Hold the bridge with Gandalf', seconds: 3, at: 8, clip: 'youShallNotPass' } },
  // his last words from the edge, the same shot, as the hold ends
  { id: 'fly', kind: 'fly', at: 107, hold: 0, rig: 'seat', reach: 4, params: BRIDGE, clip: 'flyYouFools' },
  // out into the light: the Mirrormere, the eight grieving on the slope
  { id: 'dale', kind: 'dale', at: 150, hold: 8, rig: 'wide', reach: 16, params: { at: [-10, 8, 134], lookAt: [22, 0, 162], above: true } },
];
