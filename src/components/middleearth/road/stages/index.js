// The sixteen stages of the Road, in order (the design’s §4.3 table): each
// its id, the name and the date its title card shows (the Tale of Years,
// §5), the metres of road it is built along, the way it is travelled first
// (a stage with two keeps its switch in its own folder) and the place on
// the map’s sheet it stands for (geography.js’s ids).
//
// The lengths are the ledger’s: the ride on auto must be 20 to 30 minutes
// (clock.test.js), so the briefs are binding and the lengths give.

import { MERES, POOLS, clearOf, hollowsOf } from './marshes/water';

export const MODES = ['walk', 'horse', 'climb', 'boat', 'carried', 'eagle', 'ship'];

export const STAGES = [
  {
    id: 'hobbiton',
    name: 'Hobbiton',
    date: '22 September 3018',
    length: 220,
    mode: 'walk',
    place: 'hobbiton',
    // the Water, in from the west, by the lane past the mill and away
    // west again before the stage’s end, so its channel never meets a seam;
    // the Hill, Bag End in its west face (hobbiton/props.js builds its turf)
    ground: { rivers: [{ points: [[-240, 0, -30], [-120, 0, 30], [-42, 0, 95], [-38, 0, 140], [-110, 0, 190], [-200, 0, 214]], depth: 2.6, width: 12, bank: 22 }], mounds: [{ at: [34, 6], r: 18, squash: 0.6, sink: 0.3 }] },
  },
  {
    id: 'shire-edge',
    name: 'The Shire’s edge',
    date: '24 September 3018',
    length: 175,
    mode: 'walk',
    place: 'bucklebury',
    // the Brandywine across the lane near its end, wide and slow: the ferry
    // crosses it, and its channel is cut and banked before the seam
    ground: { rivers: [{ points: [[-540, 0, 160], [-260, 0, 154], [0, 0, 150], [240, 0, 147], [540, 0, 152]], depth: 2.4, width: 22, bank: 6 }] },
  },
  {
    id: 'bree',
    name: 'Bree',
    date: '29 September 3018',
    length: 150,
    mode: 'walk',
    place: 'bree',
    // the town levelled along its lane, gate to back hedge, so its houses stand square;
    // Bree-hill rising behind them on the right
    ground: {
      flats: [
        { at: [0, 40], r: 22, edge: 14 },
        { at: [0, 80], r: 22, edge: 14 },
        { at: [0, 118], r: 22, edge: 14 },
      ],
      spec: { seed: 13, relief: [{ type: 'swell', scale: 220, height: 5 }, { type: 'hills', scale: 80, height: 6, gain: 0.4, octaves: 3 }, { type: 'island', at: [-140, 90], r: 110, height: 38 }] },
      // (the town's streets and yards: no grass standing up through the cobbles; the fields
      // before the gate and Bree-hill keep theirs)
      bare: [
        { at: [0, 40], r: 15 },
        { at: [0, 80], r: 15 },
        { at: [0, 118], r: 15 },
      ],
    },
  },
  {
    id: 'weathertop',
    name: 'Weathertop',
    date: '6 October 3018',
    length: 165,
    mode: 'walk',
    place: 'weathertop',
    // the hill on the road: the Lone-lands low and open, then the climb to
    // Amon Sûl’s crown at the ring (z 122) and down off it to the seam
    // (the crown levelled under the ruin, as the chapter’s plateau)
    ground: { spec: { seed: 14, relief: [{ type: 'swell', scale: 240, height: 4 }, { type: 'hills', scale: 70, height: 4, gain: 0.4, octaves: 3 }, { type: 'island', at: [0, 120], r: 72, height: 26 }, { type: 'mountains', scale: 200, height: 30, from: 360, to: 500 }] }, flats: [{ at: [2.2, 122], r: 16, edge: 12 }] },
  },
  {
    id: 'ford',
    name: 'The Ford of Bruinen',
    date: '20 October 3018',
    length: 200,
    mode: 'walk',
    // (on Asfaloth from the ride’s beat to the stage’s end)
    modes: [{ at: 80, mode: 'horse' }],
    place: 'ford-of-bruinen',
    // the Hoarwell under the Last Bridge, and the Bruinen at the Ford, shallow
    // and fast under Rivendell’s hills; both cut and banked inside the seams
    ground: {
      rivers: [
        { points: [[-540, 0, 60], [-200, 0, 54], [0, 0, 52], [220, 0, 49], [540, 0, 44]], depth: 3.2, width: 9, bank: 4 },
        { points: [[-540, 0, 160], [-240, 0, 166], [0, 0, 168], [260, 0, 171], [540, 0, 164]], depth: 1.1, width: 16, bank: 5 },
      ],
      // (nothing planted in the trolls' clearing, ford/index.js's CLEARING)
      clear: [{ at: [9.5, 40], r: 8 }],
    },
  },
  {
    id: 'rivendell',
    name: 'Rivendell',
    date: '25 October 3018',
    length: 155,
    mode: 'walk',
    place: 'rivendell',
    // the valley of Imladris falling away on the right to the falls’ cliff,
    // the stream under the bridge, the mountains round it all
    ground: {
      spec: { seed: 16, relief: [{ type: 'swell', scale: 200, height: 5 }, { type: 'hills', scale: 60, height: 3, gain: 0.4, octaves: 3 }, { type: 'island', at: [-100, 98], r: 90, height: -34 }, { type: 'mountains', scale: 140, height: 110, from: 230, to: 420 }] },
      rivers: [{ points: [[-540, 0, 44], [-200, 0, 48], [0, 0, 50], [200, 0, 53], [540, 0, 49]], depth: 1.6, width: 5, bank: 3 }],
      // (the court, the hall of the shards and Bilbo’s pavilion stand on level ground, nothing planted in them)
      flats: [
        { at: [-9, 85], r: 9, edge: 8 },
        { at: [-9.5, 103.5], r: 8, edge: 8 },
        { at: [6.2, 119], r: 5, edge: 6 },
      ],
      clear: [
        { at: [-9, 85], r: 8 },
        { at: [-9.5, 103.5], r: 8 },
        { at: [6.2, 119], r: 4 },
        { at: [-34, 94], r: 12 },
      ],
    },
  },
  // (stages 7 to 10 shorter than the table’s first lengths: their holds are
  // longer than the half minute the ledger counted, and the ride must stay
  // under half an hour with stages 11 to 16 still to come)
  {
    id: 'caradhras',
    name: 'Caradhras',
    date: '11 January 3019',
    length: 170,
    mode: 'walk',
    place: 'redhorn',
    // Hollin’s bare hills, then the road over the Redhorn’s shoulder in snow
    // (the peak itself up on the left), and down to the black lake under the
    // Walls of Moria on the right, the cliff across the road’s end
    ground: {
      spec: {
        seed: 17,
        relief: [
          { type: 'swell', scale: 180, height: 6 },
          { type: 'ridges', scale: 110, height: 8, octaves: 4 },
          { type: 'island', at: [0, 74], r: 62, height: 20 },
          { type: 'island', at: [120, 70], r: 90, height: 120, core: 0.04, ragged: 0.5 },
          { type: 'island', at: [-42, 134], r: 30, height: -12 },
          { type: 'mountains', scale: 140, height: 140, from: 200, to: 420 },
        ],
      },
      // (the shore under the cliff level, where the Doors are read)
      flats: [{ at: [0, 150], r: 13, edge: 10 }],
      // (and the shore clear where the Watcher’s arms come out, so nothing stands in front of them)
      clear: [
        { at: [0, 156], r: 12 },
        { at: [-14, 142], r: 14 },
      ],
      paint: { greens: [0x4a4c34, 0x666242, 0x8a8260], dirt: 0x8c8474, snow: [9, 13] },
    },
  },
  {
    id: 'moria',
    name: 'Moria',
    date: '13 January 3019',
    length: 180,
    mode: 'walk',
    place: 'moria',
    // the halls level, then down the broken stair (z 76 to 90) twelve metres
    // to the deep, the abyss across the road under the Bridge (z 91 to 125),
    // and the Dimrill Dale climbing out to the seam, the Mirrormere in its
    // hollow on the left, the Misty Mountains round it
    ground: {
      spec: {
        seed: 18,
        relief: [
          { type: 'swell', scale: 260, height: 1 },
          { type: 'island', at: [0, 140], r: 60, height: -12, core: 0.85, ragged: 0 },
          { type: 'island', at: [0, 108], r: 18, height: -40, core: 0.55, ragged: 0.15 },
          { type: 'island', at: [28, 160], r: 18, height: -5, core: 0.4 },
          { type: 'mountains', scale: 120, height: 140, from: 200, to: 360 },
        ],
      },
      // (the Chamber of Mazarbul and the hall’s floor level; nothing grows under the mountain)
      flats: [
        { at: [-14, 24], r: 10, edge: 6 },
        { at: [4.5, 56], r: 26, edge: 8 },
      ],
      paint: { greens: [0x585a54, 0x6e6e62, 0x8a8874], dirt: 0x5a5650, snow: [10, 16] },
    },
  },
  {
    id: 'lorien',
    name: 'Lothlórien',
    date: '17 January 3019',
    length: 150,
    mode: 'walk',
    // the Nimrodel across the road under the first mallorns; the wood’s
    // floor gently rolling; the Silverlode in from the right to the hythe and
    // on down the road into the Anduin (its width and depth the Anduin’s, so
    // the two meet at the seam)
    ground: {
      spec: { seed: 19, relief: [{ type: 'swell', scale: 220, height: 5 }, { type: 'hills', scale: 80, height: 5, gain: 0.4, octaves: 3 }, { type: 'mountains', scale: 160, height: 40, from: 320, to: 480 }] },
      rivers: [
        { points: [[-540, 0, 6], [-200, 0, 10], [0, 0, 14], [200, 0, 18], [540, 0, 14]], depth: 0.9, width: 5, bank: 3 },
        { points: [[-300, 0, 70], [-120, 0, 100], [-30, 0, 126], [0, 0, 138], [0, 0, 220]], depth: 2.4, width: 30, bank: 4 },
      ],
      // (the Mirror’s hollow level)
      flats: [{ at: [-5, 103], r: 7, edge: 6 }],
      clear: [{ at: [-5, 103], r: 8 }],
      paint: { greens: [0x5a6a38, 0x8a8a44, 0xb89c4c] },
    },
    // (round the mallorn’s stair to the flets, along them, and down to the boats at the hythe)
    modes: [
      { at: 46, mode: 'climb' },
      { at: 76, mode: 'walk' },
      { at: 136, mode: 'boat' },
    ],
    place: 'lorien',
  },
  {
    id: 'anduin',
    name: 'The Anduin',
    date: '16 February 3019',
    length: 170,
    mode: 'boat',
    // the Great River down the road between rising walls of rock, the
    // Argonath over it, then the lake opening out: the river swings left
    // round Parth Galen’s shore (the road on land from z 95 to 138); Amon
    // Hen’s wooded hill on the
    // right, Tol Brandir in the lake ahead; at the end it runs across the
    // road, and the boat crosses it to the east bank (so the river is gone
    // from the seam, as the Marshes have none)
    ground: {
      spec: {
        seed: 20,
        relief: [
          { type: 'swell', scale: 180, height: 6 },
          { type: 'ridges', scale: 90, height: 10, octaves: 4 },
          { type: 'island', at: [-60, 24], r: 44, height: 56, ragged: 0.4 },
          { type: 'island', at: [60, 24], r: 44, height: 56, ragged: 0.4 },
          { type: 'island', at: [-12, 118], r: 28, height: 9, core: 0.3 },
          { type: 'mountains', scale: 140, height: 110, from: 240, to: 420 },
        ],
      },
      rivers: [{ points: [[0, 0, -40], [0, 0, 80], [24, 0, 108], [26, 0, 130], [8, 0, 148], [-60, 0, 148], [-300, 0, 134]], depth: 2.4, width: 30, bank: 4 }],
      // (the Seat on its hill’s shoulder level)
      flats: [{ at: [-7, 118], r: 7, edge: 6 }],
      clear: [{ at: [-7, 118], r: 7 }],
      paint: { greens: [0x4a5838, 0x66704a, 0x8a8a64], dirt: 0x8a7c62 },
    },
    // (ashore at Parth Galen for the Seat and the horn, the boat across to the east bank, and on foot)
    modes: [
      { at: 100, mode: 'walk' },
      // (a metre before the breaking’s mark: the clock holds a hair short of it)
      { at: 139, mode: 'boat' },
      { at: 166, mode: 'walk' },
    ],
    place: 'argonath',
  },
  {
    id: 'marshes',
    name: 'The Dead Marshes',
    date: '1 March 3019',
    length: 150,
    mode: 'walk',
    place: 'dead-marshes',
    // down off the Emyn Muil (its cliff and spires are the props: a seam
    // eases the land flat), out over the marsh, its pools sunk either side
    // of the track, then the dry slag of Dagorlad up to the Gate, which
    // stands off to the left in its mountains’ arms at the stage’s end
    ground: {
      spec: {
        seed: 21,
        relief: [
          { type: 'swell', scale: 260, height: 1.5 },
          { type: 'hills', scale: 40, height: 1.2, gain: 0.4, octaves: 3 },
          ...hollowsOf(POOLS, -1.6),
          { type: 'mountains', scale: 140, height: 90, from: 260, to: 460 },
          // (the meres after the mountains, so the layers before keep their seeds)
          ...hollowsOf(MERES, -1.1),
        ],
      },
      paint: { greens: [0x4e4a30, 0x6a6440, 0x7a7048], dirt: 0x4a4436 },
      // (nothing planted in the water: marshes/water.js)
      clear: clearOf([...POOLS, ...MERES]),
    },
  },
  {
    id: 'ithilien',
    name: 'Ithilien',
    date: '7 March 3019',
    length: 160,
    mode: 'walk',
    place: 'minas-morgul',
    // green hills and a stream across the path by Henneth Annûn’s fall; the Haradrim road low on the right; then the Cross-
    // roads, and the Morgul Vale opening on the left, the Mountains of
    // Shadow behind it
    ground: {
      spec: {
        seed: 22,
        relief: [
          { type: 'swell', scale: 200, height: 5 },
          { type: 'hills', scale: 70, height: 6, gain: 0.42, octaves: 4 },
          { type: 'island', at: [-44, 40], r: 30, height: -7, core: 0.6 },
          { type: 'mountains', scale: 150, height: 110, from: 220, to: 420 },
        ],
      },
      rivers: [{ points: [[-300, 0, 120], [-60, 0, 90], [-18, 0, 64], [0, 0, 60], [60, 0, 54], [300, 0, 50]], depth: 1, width: 4, bank: 3 }],
      paint: { greens: [0x4a6a30, 0x6a8a3c, 0x8a9a52] },
    },
  },
  {
    id: 'cirith-ungol',
    name: 'Cirith Ungol',
    date: '12 March 3019',
    length: 150,
    mode: 'climb',
    place: 'cirith-ungol',
    // up the stair in the cliff (the land rising thirty metres to the
    // tunnel’s mouth), through Shelob’s Lair (its rock is the props’), the
    // tower above the pass on the left, and down onto the plain
    ground: {
      spec: {
        seed: 23,
        relief: [
          { type: 'swell', scale: 180, height: 4 },
          { type: 'ridges', scale: 80, height: 10, octaves: 4 },
          { type: 'island', at: [0, 80], r: 70, height: 30, core: 0.7, ragged: 0.2 },
          { type: 'mountains', scale: 120, height: 140, from: 120, to: 360 },
        ],
      },
      paint: { greens: [0x3a3634, 0x4a4440, 0x5a524c], dirt: 0x3a3430 },
    },
    // (the tunnel on the level, the tower’s stair, out of the gate)
    modes: [
      { at: 56, mode: 'walk' },
      { at: 108, mode: 'climb' },
      { at: 122, mode: 'walk' },
    ],
  },
  {
    id: 'gorgoroth',
    name: 'Gorgoroth',
    date: '15 March 3019',
    length: 180,
    mode: 'walk',
    place: 'mount-doom',
    // the plain of ash, then the Mountain’s slope from the carry up to the
    // Sammath Naur’s door (the Mountain itself and the Tower are the props)
    ground: {
      spec: {
        seed: 24,
        relief: [
          { type: 'swell', scale: 260, height: 2 },
          { type: 'hills', scale: 50, height: 2.5, gain: 0.45, octaves: 3 },
          { type: 'island', at: [20, 150], r: 70, height: 26, core: 0.3, ragged: 0.3 },
          { type: 'mountains', scale: 160, height: 90, from: 280, to: 480 },
        ],
      },
      paint: { greens: [0x2a2422, 0x3a302a, 0x4a3a30], dirt: 0x2a2220 },
    },
    // (carried up the slope, on foot at the Cracks, and on the Eagles out)
    modes: [
      { at: 100, mode: 'carried' },
      { at: 120, mode: 'walk' },
      { at: 165, mode: 'eagle' },
    ],
  },
  {
    id: 'minas-tirith',
    name: 'Minas Tirith',
    date: '1 May 3019',
    length: 160,
    // (the Eagles carry them out of Mordor and the Road cuts here: its land
    // never drawn beside Gorgoroth's, lands.js)
    cut: true,
    mode: 'walk',
    place: 'minas-tirith',
    // the Pelennor levelled under the city and its causeway (the city stands on
    // its own levels, stages/minas-tirith/place.js), and Mindolluin rising behind it
    ground: {
      flats: [{ at: [0, 150], r: 150, edge: 40, h: 0 }],
      spec: {
        seed: 25,
        relief: [
          { type: 'swell', scale: 240, height: 3 },
          { type: 'hills', scale: 90, height: 3, gain: 0.42, octaves: 3 },
          { type: 'island', at: [0, 400], r: 220, height: 300, core: 0.2, ragged: 0.25 },
          { type: 'mountains', scale: 180, height: 60, from: 360, to: 500 },
        ],
      },
    },
  },
  {
    id: 'havens',
    name: 'The Grey Havens',
    date: '29 September 3021',
    length: 290,
    mode: 'walk',
    place: 'grey-havens',
    // the beach and the dunes running down into the Gulf of Lune (the sea's
    // basin under the quay and the ship's way out, stages/havens/place.js)
    ground: {
      spec: {
        seed: 26,
        relief: [
          { type: 'swell', scale: 200, height: 2 },
          { type: 'hills', scale: 30, height: 1.2, gain: 0.4, octaves: 3 },
          { type: 'island', at: [0, 210], r: 200, height: -14, core: 0.35, ragged: 0.12 },
        ],
      },
      // (the Gulf's level, place.js's WATER: nothing is planted under it)
      sea: -2,
    },
    // (aboard her once she casts off)
    modes: [{ at: 160, mode: 'ship' }],
  },
];

export const stageById = (id) => STAGES.find((s) => s.id === id) ?? null;

// the way a stage is travelled at `local` metres into it: its first mode,
// then each of its `modes` switches ({ at, mode }) once passed
export function modeAt(stage, local) {
  let mode = stage?.mode ?? 'walk';
  for (const m of stage?.modes ?? []) if (local >= m.at) mode = m.mode;
  return mode;
}
