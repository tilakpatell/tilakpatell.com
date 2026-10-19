// Rivendell’s beats (the design’s §4.3, row 6; the plan’s Stage table):
// the valley opening below the ridge, the bridge, the Council in the garden,
// the shards of Narsil, Bilbo on his bench with his book, and the nine
// walking out under the arch. `at` in metres into the stage, `hold` in
// seconds; a `params` height is over the ground (`above`), the stage’s
// scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the reveal from the ridge: terraces, bridges, the falls catching the sun
  { id: 'reveal', kind: 'reveal', at: 14, hold: 12, rig: 'crane', reach: 16, params: { seconds: 10, top: 18, lookAt: [-30, -6, 90], above: true } },
  // down over the bridge
  { id: 'bridge', kind: 'bridge', at: 48, hold: 0, rig: 'follow' },
  // the Council: the ring of chairs, the Ring on its plinth, Frodo stands
  { id: 'council', kind: 'council', at: 78, hold: 20, rig: 'seat', reach: 12, params: { at: [7, 2.2, 74], lookAt: [-2, 1.1, 84], above: true }, clip: 'andMyAxe', lines: ['rivendell-elrond', 'rivendell-boromir', 'rivendell-frodo'] },
  // the shards of Narsil on their cloth
  { id: 'narsil', kind: 'narsil', at: 100, hold: 8, rig: 'low', reach: 10 },
  // Bilbo on a bench with his book
  { id: 'bilbo', kind: 'bilbo', at: 116, hold: 8, rig: 'side', reach: 12, lines: ['rivendell-bilbo'] },
  // winter’s first light: nine walk out under the arch, you behind them
  { id: 'setout', kind: 'setout', at: 138, hold: 6, rig: 'lead', reach: 14 },
];
