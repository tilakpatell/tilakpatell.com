// The sixteen stages of the Road, in order (the design’s §4.3 table): each
// its id, the name and the date its title card shows (the Tale of Years,
// §5), the metres of road it is built along, the way it is travelled first
// (a stage with two keeps its switch in its own folder) and the place on
// the map’s sheet it stands for (geography.js’s ids).
//
// The lengths are the ledger’s: the ride on auto must be 20 to 30 minutes
// (clock.test.js), so the briefs are binding and the lengths give.

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
    // west again before the stage’s end, so its channel never meets a seam
    ground: { rivers: [{ points: [[-240, 0, -30], [-120, 0, 30], [-42, 0, 95], [-38, 0, 140], [-110, 0, 190], [-200, 0, 214]], depth: 2.6, width: 12, bank: 22 }] },
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
    ground: { spec: { seed: 14, relief: [{ type: 'swell', scale: 240, height: 4 }, { type: 'hills', scale: 70, height: 4, gain: 0.4, octaves: 3 }, { type: 'island', at: [0, 120], r: 72, height: 26 }, { type: 'mountains', scale: 200, height: 30, from: 360, to: 500 }] } },
  },
  { id: 'ford', name: 'The Ford of Bruinen', date: '20 October 3018', length: 200, mode: 'walk', place: 'ford-of-bruinen' },
  { id: 'rivendell', name: 'Rivendell', date: '25 October 3018', length: 155, mode: 'walk', place: 'rivendell' },
  { id: 'caradhras', name: 'Caradhras', date: '11 January 3019', length: 230, mode: 'walk', place: 'redhorn' },
  { id: 'moria', name: 'Moria', date: '13 January 3019', length: 250, mode: 'walk', place: 'moria' },
  { id: 'lorien', name: 'Lothlórien', date: '17 January 3019', length: 200, mode: 'walk', place: 'lorien' },
  { id: 'anduin', name: 'The Anduin', date: '16 February 3019', length: 240, mode: 'boat', place: 'argonath' },
  { id: 'marshes', name: 'The Dead Marshes', date: '1 March 3019', length: 210, mode: 'walk', place: 'dead-marshes' },
  { id: 'ithilien', name: 'Ithilien', date: '7 March 3019', length: 230, mode: 'walk', place: 'minas-morgul' },
  { id: 'cirith-ungol', name: 'Cirith Ungol', date: '12 March 3019', length: 180, mode: 'climb', place: 'cirith-ungol' },
  { id: 'gorgoroth', name: 'Gorgoroth', date: '15 March 3019', length: 240, mode: 'walk', place: 'mount-doom' },
  { id: 'minas-tirith', name: 'Minas Tirith', date: '1 May 3019', length: 160, mode: 'walk', place: 'minas-tirith' },
  { id: 'havens', name: 'The Grey Havens', date: '29 September 3021', length: 160, mode: 'walk', place: 'grey-havens' },
];

export const stageById = (id) => STAGES.find((s) => s.id === id) ?? null;
