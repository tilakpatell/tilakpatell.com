// Rivendell’s beats (the design’s §4.3, row 6; the plan’s Stage table):
// the valley opening below the ridge, the bridge, the Council in the garden,
// the shards of Narsil, Bilbo on his bench with his book, and the nine
// walking out under the arch. `at` in metres into the stage, `hold` in
// seconds; a `params` height is over the ground (`above`), the stage’s
// scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the reveal from the ridge: terraces, bridges, the falls catching the sun
  { id: 'reveal', kind: 'reveal', at: 14, hold: 12, rig: 'crane', reach: 16, params: { seconds: 10, top: 18, lookAt: [-70, -8, 96], above: true } },
  // down over the bridge
  { id: 'bridge', kind: 'bridge', at: 48, hold: 0, rig: 'follow' },
  // the Council: a hard cut to the ring of chairs, the Ring on its plinth, Frodo stands
  { id: 'council', kind: 'council', at: 78, hold: 20, rig: 'seat', cut: 0, reach: 12, params: { at: [-0.5, 2.6, 80], lookAt: [-9, 1, 85.5], above: true }, lines: ['rivendell-elrond', 'rivendell-boromir'], deed: { verb: 'press', label: 'Stand up and say you’ll carry it', at: 7.5, lines: ['rivendell-frodo'] } },
  // Gimli on his feet as the hold ends (the clip after the voices, never under one)
  { id: 'axe', kind: 'axe', at: 79, hold: 0, rig: 'seat', reach: 6, params: { at: [-0.5, 2.6, 80], lookAt: [-9, 1, 85.5], above: true }, clip: 'andMyAxe' },
  // the shards of Narsil on their cloth (low by the road, Frodo before the hall: the low rig looks up the road, and the hall is off it)
  { id: 'narsil', kind: 'narsil', at: 100, hold: 8, rig: 'wide', reach: 10, params: { at: [1.6, 0.9, 95.5], lookAt: [-9, 1.6, 103.5], above: true }, deed: { verb: 'press', label: 'Touch the shards of Narsil', at: 2, lines: ['rivendell-narsil'] } },
  // Bilbo on a bench with his book (looked at from up the road: from the side the file stood between)
  { id: 'bilbo', kind: 'bilbo', at: 116, hold: 8, rig: 'seat', reach: 12, params: { at: [2.2, 1.5, 123.5], lookAt: [6, 1.1, 119.2], above: true }, lines: ['rivendell-bilbo'], deed: { verb: 'press', label: 'Take Sting from Bilbo', at: 3, lines: ['rivendell-sting'] } },
  // winter’s first light: nine walk out under the arch, you behind them
  { id: 'setout', kind: 'setout', at: 138, hold: 6, rig: 'lead', reach: 14 },
];
