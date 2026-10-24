// A small sector made by hand, the shape of gen/sector.js's (sectors.test.js'
// HAND, with each planet's orbit where it is): two systems 40,311 apart, the
// first with a ringed gas giant and its two moons, and a wonder of each kind.
// Raw, as makeSector gives one: run it through addBodies for its moons, rings
// and reach.

const planet = (id, type, at, orbit, more = {}) => ({ id, name: id, type, radius: 30, color: '#888888', at, orbit, moons: 0, rings: false, seed: 1n, ...more });

export const HAND = {
  id: 'E:5,0',
  sx: 5,
  sz: 0,
  seed: 1n,
  origin: [400000, 0, 0],
  systems: [
    {
      id: 'E:5,0:0',
      name: 'A',
      at: [390000, 0, 0],
      star: { class: 'G', color: '#fff4ea', size: 150 },
      planets: [planet('E:5,0:0:0', 'rock', [390400, 0, 0], 400), planet('E:5,0:0:1', 'gas', [390000, 0, 700], 700, { radius: 100, moons: 2, rings: true, seed: 7n })],
      faction: { id: 'x', name: 'X' },
      traffic: 0.5,
      hazard: null,
    },
    {
      id: 'E:5,0:1',
      name: 'B',
      at: [425000, 0, 20000],
      star: { class: 'M', color: '#ffb56c', size: 90 },
      planets: [planet('E:5,0:1:0', 'ocean', [425500, 0, 20000], 500)],
      faction: { id: 'x', name: 'X' },
      traffic: 0.2,
      hazard: 'storm',
    },
  ],
  wonders: ['nebula', 'pulsar', 'derelict', 'rogue'].map((kind, k) => ({ id: `E:5,0:w${k}`, kind, name: kind, at: [400000 + k * 3000, 0, -20000], size: 400, seed: BigInt(k + 1) })),
  beacons: {},
};
