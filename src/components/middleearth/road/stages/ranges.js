// The mountains and hills on each stage’s horizon, as the map has them
// (docs/research/2026-10-18-middle-earth-map-geography.md): the Shire’s
// downs, the Weather Hills, the Misty Mountains looming from the Ford and
// over Rivendell, Caradhras’s three peaks, the Emyn Muil, the Ephel Dúath
// over the Dead Marshes and Ithilien, Mount Doom alone on Gorgoroth with
// the Ered Lithui behind, Mindolluin over Minas Tirith, the Blue Mountains
// either side of the Gulf of Lune. Data only: backdrop.js draws it.
//
//   RANGES[stage] = [{ az, width, dist, height, colour, snow, jag, cone, haze, seed }]
//     az: degrees from the stage’s ahead (+z), toward its left (+x) positive;
//     width: degrees of the horizon it spans; dist and height in metres;
//     colour: its rock or its woods; snow: the share of its height the snow
//     comes down to (null for none); jag: 0 a rounded down, 1 a sawtooth of
//     peaks; cone: one peak, a volcano; haze: how much of the sky’s colour
//     is in it (by its distance when left out)
//   rangesOf(stage) → its rows ([] for none)
//   LANDMARKS, landmarksOf(stage): what stands before them (below)

const DOWNS = 0x587856; // grass over chalk, blue with distance
const WOODED = 0x3e5638;
const GREY = 0x6e6a60;
const MISTY = 0x6e7280; // the Misty Mountains’ grey granite
const DARK = 0x2e2a2c; // the Mountains of Shadow
const WHITE = 0x666a76; // the White Mountains’ rock (their snow above it: at noon a snow line under halfway made them one white wall)
const BLUE = 0x5e6c7e; // Ered Luin

export const RANGES = {
  // the Shire: low downs all round, the Far Downs behind to the west
  hobbiton: [
    { az: 55, width: 110, dist: 1700, height: 70, colour: DOWNS, jag: 0.15, seed: 1 },
    { az: -95, width: 130, dist: 1900, height: 95, colour: DOWNS, jag: 0.2, seed: 2 },
    { az: 175, width: 90, dist: 2300, height: 130, colour: DOWNS, jag: 0.25, seed: 3 },
  ],
  // the Marish to the Brandywine, the Old Forest a dark ridge beyond it
  'shire-edge': [
    { az: -35, width: 70, dist: 1600, height: 110, colour: WOODED, jag: 0.3, seed: 4 },
    { az: 70, width: 100, dist: 2000, height: 80, colour: DOWNS, jag: 0.15, seed: 5 },
    { az: 185, width: 110, dist: 2200, height: 105, colour: DOWNS, jag: 0.2, seed: 6 },
  ],
  // the Barrow-downs behind, rounded and bare; low hills about
  bree: [
    { az: 205, width: 90, dist: 1800, height: 150, colour: 0x66745a, jag: 0.15, seed: 7 },
    { az: 70, width: 90, dist: 2300, height: 100, colour: WOODED, jag: 0.25, seed: 8 },
    { az: -60, width: 90, dist: 2200, height: 90, colour: DOWNS, jag: 0.2, seed: 9 },
  ],
  // the Weather Hills running north and south of it, the Misty Mountains faint far ahead
  weathertop: [
    { az: 65, width: 90, dist: 1900, height: 170, colour: GREY, jag: 0.45, seed: 10 },
    { az: -65, width: 80, dist: 2100, height: 150, colour: GREY, jag: 0.4, seed: 11 },
    { az: 0, width: 120, dist: 3800, height: 420, colour: MISTY, snow: 0.7, jag: 0.8, haze: 0.62, seed: 12 },
  ],
  // the Misty Mountains looming ahead over the Trollshaws’ wooded hills
  ford: [
    { az: 8, width: 160, dist: 3400, height: 650, colour: MISTY, snow: 0.55, jag: 0.85, seed: 13 },
    { az: 80, width: 70, dist: 1500, height: 200, colour: WOODED, jag: 0.4, seed: 14 },
    { az: -80, width: 70, dist: 1600, height: 190, colour: WOODED, jag: 0.4, seed: 15 },
  ],
  // the mountains over the valley, snow on the high ones; the moors behind
  rivendell: [
    { az: 10, width: 170, dist: 3200, height: 800, colour: MISTY, snow: 0.5, jag: 0.9, seed: 16 },
    { az: 120, width: 70, dist: 1900, height: 420, colour: GREY, snow: 0.8, jag: 0.7, seed: 17 },
    { az: 190, width: 110, dist: 2600, height: 260, colour: GREY, jag: 0.45, seed: 18 },
    // (the gorge’s walls: the far side of the valley close across it on the right, and behind)
    { az: -70, width: 80, dist: 820, height: 270, colour: GREY, jag: 0.8, seed: 46 },
    { az: 165, width: 60, dist: 900, height: 250, colour: GREY, jag: 0.75, seed: 47 },
  ],
  // the Redhorn: Caradhras ahead, Celebdil and Fanuidhol either side, snow on everything
  caradhras: [
    { az: 8, width: 46, dist: 2600, height: 900, colour: 0x7a5a52, snow: 0.18, jag: 1, seed: 19 },
    { az: 58, width: 56, dist: 3000, height: 760, colour: MISTY, snow: 0.25, jag: 1, seed: 20 },
    { az: -52, width: 62, dist: 2900, height: 720, colour: MISTY, snow: 0.25, jag: 1, seed: 21 },
    { az: 180, width: 130, dist: 3200, height: 600, colour: MISTY, snow: 0.4, jag: 0.9, seed: 22 },
  ],
  // under the mountains (seen only from the Dimrill Dale, behind and about)
  moria: [
    { az: 180, width: 150, dist: 2500, height: 800, colour: MISTY, snow: 0.4, jag: 1, seed: 23 },
    { az: 70, width: 70, dist: 2900, height: 620, colour: MISTY, snow: 0.45, jag: 0.9, seed: 24 },
  ],
  // the Misty Mountains behind, the Wold far ahead
  lorien: [
    { az: 170, width: 130, dist: 3400, height: 700, colour: MISTY, snow: 0.5, jag: 0.9, seed: 25 },
    { az: 20, width: 90, dist: 3000, height: 90, colour: 0x6c7448, jag: 0.15, seed: 26 },
  ],
  // the Emyn Muil’s broken hills either side of the River
  anduin: [
    { az: 55, width: 90, dist: 1600, height: 220, colour: 0x6a645a, jag: 0.65, seed: 27 },
    { az: -55, width: 90, dist: 1500, height: 190, colour: 0x6a645a, jag: 0.65, seed: 28 },
    { az: 175, width: 90, dist: 3600, height: 560, colour: MISTY, snow: 0.55, jag: 0.8, haze: 0.7, seed: 29 },
  ],
  // the Ephel Dúath ahead, black and jagged; the Emyn Muil behind
  marshes: [
    { az: 15, width: 130, dist: 3500, height: 620, colour: DARK, jag: 1, seed: 30 },
    { az: 185, width: 90, dist: 2000, height: 180, colour: 0x5a564e, jag: 0.6, seed: 31 },
  ],
  // the Mountains of Shadow over the garden to the east, the White Mountains far to the west
  ithilien: [
    { az: 80, width: 140, dist: 2700, height: 660, colour: DARK, jag: 1, seed: 32 },
    { az: -80, width: 90, dist: 3500, height: 700, colour: WHITE, snow: 0.5, jag: 0.85, haze: 0.66, seed: 33 },
  ],
  // in the Ephel Dúath: black peaks close on every side
  'cirith-ungol': [
    { az: 0, width: 80, dist: 1600, height: 480, colour: 0x262224, jag: 1.2, seed: 34 },
    { az: 90, width: 90, dist: 1300, height: 420, colour: 0x262224, jag: 1.2, seed: 35 },
    { az: -90, width: 90, dist: 1500, height: 450, colour: 0x262224, jag: 1.2, seed: 36 },
    { az: 180, width: 90, dist: 1800, height: 460, colour: 0x262224, jag: 1.1, seed: 37 },
  ],
  // the Ash Mountains to the north, the Ephel Dúath behind (Mount Doom ahead is the
  // stage's own, the chapter's mountain: stages/gorgoroth)
  gorgoroth: [
    { az: 80, width: 120, dist: 3500, height: 520, colour: 0x2a2426, jag: 1, seed: 39 },
    { az: 185, width: 150, dist: 2600, height: 560, colour: 0x262224, jag: 1.1, seed: 40 },
  ],
  // Mindolluin over the city ahead, the White Mountains west of it, Mordor’s mountains dark across the River
  'minas-tirith': [
    { az: 0, width: 70, dist: 3000, height: 950, colour: WHITE, snow: 0.6, jag: 0.9, seed: 41 },
    { az: -45, width: 90, dist: 3300, height: 800, colour: WHITE, snow: 0.64, jag: 0.85, seed: 42 },
    { az: 150, width: 100, dist: 3500, height: 520, colour: DARK, jag: 1, haze: 0.6, seed: 43 },
  ],
  // the Blue Mountains either side of the Gulf of Lune, the sea between to the west
  havens: [
    { az: 70, width: 90, dist: 3200, height: 520, colour: BLUE, snow: 0.75, jag: 0.8, seed: 44 },
    { az: -70, width: 90, dist: 3300, height: 500, colour: BLUE, snow: 0.75, jag: 0.8, seed: 45 },
  ],
};

export const rangesOf = (stage) => RANGES[stage] ?? [];

// What stands against the mountains, seen from far off: the White City on
// Mindolluin’s knee across the River from Ithilien, where the beacons are
// lit (the map’s model; on its own stage the chapter’s city stands, near:
// stages/minas-tirith), and Barad-dûr beyond Mount Doom with the Eye
// between its horns.
//   LANDMARKS[stage] = [{ kind: 'city' | 'tower', az, dist, height, model }]
export const LANDMARKS = {
  ithilien: [{ kind: 'city', az: -78, dist: 3200, height: 220, model: '/models/sketchfab/minas-tirith.glb' }],
  gorgoroth: [{ kind: 'tower', az: 30, dist: 3300, height: 560 }],
};
export const landmarksOf = (stage) => LANDMARKS[stage] ?? [];
