// What lives over each stage: its birds. Swallows over the Shire’s fields,
// rooks round Bree, a hawk over the Lone-lands, birds over the Trollshaws
// and the valley of Imladris, the crebain of Dunland quartering Hollin
// under Caradhras, gulls over the Havens; none in the deeps, the Marshes or
// Mordor. Data only: lands.js puts each stage’s up with its ground.
//
//   LIFE[stage] = { birds: [{ at: [x, y, z] (y over the ground), count, radius, size, colour, speed, seed }] }
//   lifeOf(stage) → its row ({ birds: [] } for none)

const SWALLOW = 0x2a2830;
const ROOK = 0x161418;

export const LIFE = {
  hobbiton: { birds: [{ at: [-30, 22, 60], count: 14, radius: 46, size: 0.32, colour: SWALLOW, speed: 11, seed: 1 }, { at: [40, 30, 170], count: 10, radius: 34, size: 0.32, colour: SWALLOW, speed: 10, seed: 2 }] },
  'shire-edge': { birds: [{ at: [26, 26, 30], count: 12, radius: 40, size: 0.34, colour: SWALLOW, speed: 11, seed: 3 }] },
  bree: { birds: [{ at: [-30, 34, 90], count: 16, radius: 36, size: 0.45, colour: ROOK, speed: 7, seed: 4 }] },
  weathertop: { birds: [{ at: [10, 60, 120], count: 2, radius: 70, size: 0.9, colour: 0x3a3028, speed: 8, seed: 5 }] },
  ford: { birds: [{ at: [-40, 40, 110], count: 12, radius: 50, size: 0.4, colour: SWALLOW, speed: 9, seed: 6 }] },
  rivendell: { birds: [{ at: [-70, 50, 90], count: 14, radius: 60, size: 0.4, colour: 0x3a3a40, speed: 8, seed: 7 }] },
  // (the crebain: a great black flock low over the land, spying)
  caradhras: { birds: [{ at: [30, 26, 40], count: 70, radius: 55, size: 0.55, colour: ROOK, speed: 13, seed: 8 }] },
  lorien: { birds: [{ at: [40, 45, 100], count: 8, radius: 50, size: 0.38, colour: 0x4a4436, speed: 8, seed: 9 }] },
  anduin: { birds: [{ at: [0, 40, 120], count: 6, radius: 70, size: 0.7, colour: 0x3a3632, speed: 9, seed: 10 }] },
  ithilien: { birds: [{ at: [-30, 30, 80], count: 12, radius: 40, size: 0.34, colour: SWALLOW, speed: 10, seed: 11 }] },
  'minas-tirith': { birds: [{ at: [20, 50, 120], count: 10, radius: 60, size: 0.45, colour: 0x2e2c30, speed: 9, seed: 12 }] },
  havens: { birds: [{ at: [-40, 30, 100], count: 14, radius: 55, size: 0.6, colour: 0xe8e8ec, speed: 8, seed: 13 }] },
};

export const lifeOf = (stage) => LIFE[stage] ?? { birds: [] };
