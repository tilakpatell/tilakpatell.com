// Each stage’s soil: what its ground is painted with and what it is made of
// close up. Data only: ground.js paints the ground map with it, soil.js lays
// its photo scans over that map, blades.js grows its grass.
//
//   SOILS[stage] = {
//     greens: [low, mid, high]: the ground’s colour by height and a slow noise
//       (the grass, or the snow, the stone, the ash, where a stage has none)
//     dirt: the road’s worn colour; rock: the steep ground’s
//     scans: { grass, road, steep }: public/cc0/galaxy/’s roles (Poly Haven,
//       CC0; lib/three/scansNodes), the ground where it grows, where it is
//       worn, where it is steep
//     blades: 0…1, how thick the grass close round you stands (0: none); blade: its height, m
//   }
//   (a stage’s own `ground.paint`, stages/index.js, is laid over its soil’s colours)
//   soilOf(stage) → its row (Hobbiton’s for an unknown one)

export const SOILS = {
  // the Shire in late summer: long green grass, a dry lane, mossy stones
  hobbiton: { greens: [0x3d6e2b, 0x5c8f3a, 0x93b54c], dirt: 0xb59d72, rock: 0x8a8272, scans: { grass: 'grass', road: 'gravel', steep: 'mossrock' }, blades: 1, blade: 0.42 },
  'shire-edge': { greens: [0x45682a, 0x678a38, 0xa2ac4a], dirt: 0xa88e62, rock: 0x857c6c, scans: { grass: 'grass', road: 'gravel', steep: 'mossrock' }, blades: 1, blade: 0.5 },
  // Bree on a wet night: dark turf, the lane churned to mud
  bree: { greens: [0x2c4424, 0x405a34, 0x587040], dirt: 0x5c4c3a, rock: 0x6a665e, scans: { grass: 'grass', road: 'mud', steep: 'rock' }, blades: 0.8, blade: 0.38 },
  // the Lone-lands and Weathertop: heath gone olive and brown, grey stone breaking through
  weathertop: { greens: [0x4a4c2e, 0x66663c, 0x86784a], dirt: 0x8a7a5a, rock: 0x6e6a62, scans: { grass: 'grass', road: 'gravel', steep: 'rock' }, blades: 0.75, blade: 0.5 },
  // the Trollshaws in autumn: the floor of the woods, river stones
  ford: { greens: [0x3a5428, 0x56723a, 0x8a8440], dirt: 0x8e7a58, rock: 0x77736a, scans: { grass: 'grass', road: 'gravel', steep: 'mossrock' }, blades: 0.85, blade: 0.45 },
  // Imladris: lawns kept short, the paths pale
  rivendell: { greens: [0x325a28, 0x4e7c38, 0x80a046], dirt: 0xb4a47e, rock: 0x8a8478, scans: { grass: 'grass', road: 'gravel', steep: 'mossrock' }, blades: 0.9, blade: 0.32 },
  // Hollin’s heath under the Redhorn, the snow above (the stage’s own paint
  // lays it, stages/index.js): grass where it grows, snow’s grain on the snow and the trodden road
  caradhras: { greens: [0xc4ccd8, 0xdfe4ec, 0xf4f6fa], dirt: 0xaeb4be, rock: 0x55555c, scans: { grass: 'grass', road: 'snow', steep: 'rock' }, blades: 0.5, blade: 0.32 },
  // Moria: the dwarves’ stone floors, the dust on them
  moria: { greens: [0x2a2826, 0x34312d, 0x403b35], dirt: 0x3a3632, rock: 0x2e2c2a, scans: { grass: 'rock', road: 'stone', steep: 'rock' }, blades: 0 },
  // Lothlórien: gold leaves fallen under the mallorns, the grass between
  lorien: { greens: [0x4e6a2a, 0x7c8c3a, 0xb8a04a], dirt: 0xa89068, rock: 0x8a8276, scans: { grass: 'leaves', road: 'gravel', steep: 'mossrock' }, blades: 0.5, blade: 0.36 },
  // the Great River’s banks: grass to a stony shore
  anduin: { greens: [0x3c5c30, 0x58783e, 0x7c904a], dirt: 0x9a8a6a, rock: 0x7a766c, scans: { grass: 'grass', road: 'gravel', steep: 'rock' }, blades: 0.8, blade: 0.5 },
  // the Dead Marshes: black mud and dead tussocks
  marshes: { greens: [0x34342a, 0x464632, 0x5c583a], dirt: 0x3e362a, rock: 0x4a463e, scans: { grass: 'mud', road: 'mud', steep: 'rock' }, blades: 0.45, blade: 0.6 },
  // Ithilien: the garden of Gondor gone wild, herbs and long grass
  ithilien: { greens: [0x386a2c, 0x588a38, 0x88ac48], dirt: 0xa8946a, rock: 0x8c8678, scans: { grass: 'grass', road: 'gravel', steep: 'mossrock' }, blades: 1, blade: 0.48 },
  // Cirith Ungol: the stair in black rock
  'cirith-ungol': { greens: [0x282422, 0x332e2a, 0x403832], dirt: 0x3a322c, rock: 0x2a2624, scans: { grass: 'rock', road: 'rock', steep: 'rock' }, blades: 0 },
  // Gorgoroth: ash and cinders under the pall
  gorgoroth: { greens: [0x2a2422, 0x3a302a, 0x4a3e34], dirt: 0x4a3e34, rock: 0x2a2624, scans: { grass: 'ash', road: 'ash', steep: 'redrock' }, blades: 0 },
  // the Pelennor: green fields to the white walls, the road paved
  'minas-tirith': { greens: [0x48702e, 0x688a3c, 0x98a44c], dirt: 0xb8aa88, rock: 0xc4beb0, scans: { grass: 'grass', road: 'stone', steep: 'rock' }, blades: 0.8, blade: 0.4 },
  // the Grey Havens: dune grass to the sand
  havens: { greens: [0x4c6c36, 0x6c8a46, 0xb8ac80], dirt: 0xc8b896, rock: 0x8a8478, scans: { grass: 'grass', road: 'beach', steep: 'rock' }, blades: 0.7, blade: 0.55 },
};

export const soilOf = (stage) => SOILS[stage] ?? SOILS.hobbiton;
