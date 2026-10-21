// Ithilien’s beats (the design’s §4.3, row 12; the plan’s Stage table):
// green again under the woods, the Haradrim on the road below with two
// mûmakil, Faramir’s rangers out of the ferns, Henneth Annûn seen from
// behind its falls, the fallen king at the Cross-roads, the Morgul Vale with
// its tower lit and its host going out under the Dawnless Day, and far off
// west the beacons lit one by one. `at` in metres into the stage, `hold` in
// seconds; a `params` height is over the ground (`above`), the stage’s
// scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the woods of bay and cedar, streams across the path
  { id: 'woods', kind: 'woods', at: 10, hold: 0, rig: 'follow', reach: 14 },
  // the Haradrim column on the road below, two mûmakil in it
  { id: 'mumakil', kind: 'mumakil', at: 28, hold: 12, rig: 'wide', reach: 16, params: { at: [3, 1.8, 24], lookAt: [-34, 2, 46], above: true }, lines: ['ithilien-sam'], deed: { verb: 'hold', label: 'Keep down in the ferns', stance: 'crouch', seconds: 3, at: 4, lines: ['ithilien-ferns'] } },
  // Faramir’s rangers up out of the ferns round the three
  { id: 'rangers', kind: 'rangers', at: 50, hold: 6, rig: 'seat', reach: 10, params: { at: [3.5, 1.5, 45], lookAt: [-1, 1.2, 53], above: true }, lines: ['ithilien-faramir'], deed: { verb: 'choose', label: 'Tell Faramir who you are', at: 2, choices: [{ label: 'Frodo, son of Drogo', right: true }, { label: 'Mr Underhill', line: { who: 'faramir', text: 'That is the name you gave in Bree, I think. Again, and truly.' } }, { label: 'A friend of Sméagol', line: { who: 'faramir', text: 'Then you keep poor company. Your own name, please.' } }], lines: ['ithilien-name'] } },
  // inside Henneth Annûn, looking out through its falling water at the sunset
  { id: 'henneth', kind: 'henneth', at: 66, hold: 8, rig: 'seat', reach: 10, params: { at: [-9, 2.2, 72], lookAt: [-9, 2.6, 60], above: true } },
  // the Cross-roads: the seated king, his head fallen and crowned with flowers
  { id: 'crossroads', kind: 'crossroads', at: 88, hold: 5, rig: 'low', reach: 10, deed: { verb: 'press', label: 'Look up at the fallen king', at: 1, lines: ['ithilien-crown'] } },
  // the Morgul Vale: the tower lit, its beam, the Witch-king rising, the host out
  { id: 'vale', kind: 'vale', at: 112, hold: 18, rig: 'crane', cut: 0, reach: 18, params: { seconds: 14, top: 9, lookAt: [44, 18, 150] }, deed: { verb: 'hold', label: 'Keep hold of Frodo', seconds: 4, at: 1.5, lines: ['ithilien-vale'] } },
  // far off across the dark to the west, the beacons lit one by one
  { id: 'beacons', kind: 'beacons', at: 146, hold: 13, rig: 'wide', reach: 14, params: { at: [2, 2.4, 142], lookAt: [-90, 14, 150], above: true } },
];
