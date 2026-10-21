// Each stage’s road underfoot: what track.js lays along it. Data only.
//
//   TRACKS[stage] = {
//     kind: 'lane' (a cart's: two wheel ruts, the crown between them) | 'path' (one trodden line),
//     width: m across, edge to broken edge (inside the levelled lane, 6 m)
//     ruts: m off the middle each rut runs (a lane's)
//     crown: 0…1, the grass down a lane's middle
//     stones: 0…1, how thick the stones lie in it
//     puddles: 0…1, the water standing in its ruts (or its trodden line)
//     dirt?: its own colour, where the soil's (stages/soils.js) is too pale for a road worn into it
//   }
//   (none for a stage walked on what it builds, or on snow: Caradhras, Moria,
//   the River, Cirith Ungol; its ground's paint is its road, as before)
//   trackOf(stage) → its row, or null

export const TRACKS = {
  // the lane from Bag End: dry, rutted by the carts, the grass down its middle
  hobbiton: { kind: 'lane', width: 3.4, ruts: 0.68, crown: 0.85, stones: 0.3, puddles: 0 },
  'shire-edge': { kind: 'lane', width: 3.4, ruts: 0.68, crown: 0.7, stones: 0.35, puddles: 0 },
  // the Great East Road into Bree: wider, rutted deep, the night's rain in the ruts
  bree: { kind: 'lane', width: 4.2, ruts: 0.82, crown: 0.3, stones: 0.45, puddles: 0.75 },
  // the wild: one trodden path
  weathertop: { kind: 'path', width: 1.7, stones: 0.7, puddles: 0 },
  ford: { kind: 'path', width: 2.2, stones: 0.8, puddles: 0.25 },
  rivendell: { kind: 'path', width: 2.4, stones: 0.45, puddles: 0 },
  lorien: { kind: 'path', width: 1.6, stones: 0.15, puddles: 0 },
  marshes: { kind: 'path', width: 1.4, stones: 0.1, puddles: 0.85 },
  ithilien: { kind: 'path', width: 1.6, stones: 0.5, puddles: 0 },
  // the orcs' road over the plain, its ash stamped hard
  gorgoroth: { kind: 'path', width: 3.2, stones: 0.9, puddles: 0 },
  // the road over the Pelennor to the Gate, its ruts the carts' and the wains'
  // (its earth darker than the Pelennor's pale soil: in that, the road read as sand and its ruts not at all)
  'minas-tirith': { kind: 'lane', width: 4.8, ruts: 0.95, crown: 0.15, stones: 0.5, puddles: 0, dirt: 0x8e7e62 },
  // down the beach to the quay
  havens: { kind: 'path', width: 2.4, stones: 0.55, puddles: 0 },
};

export const trackOf = (stage) => TRACKS[stage] ?? null;
