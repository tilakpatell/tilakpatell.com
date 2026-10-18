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
  { id: 'hobbiton', name: 'Hobbiton', date: '22 September 3018', length: 220, mode: 'walk', place: 'hobbiton' },
  { id: 'shire-edge', name: 'The Shire’s edge', date: '24 September 3018', length: 190, mode: 'walk', place: 'bucklebury' },
  { id: 'bree', name: 'Bree', date: '29 September 3018', length: 170, mode: 'walk', place: 'bree' },
  { id: 'weathertop', name: 'Weathertop', date: '6 October 3018', length: 200, mode: 'walk', place: 'weathertop' },
  { id: 'ford', name: 'The Ford of Bruinen', date: '20 October 3018', length: 220, mode: 'walk', place: 'ford-of-bruinen' },
  { id: 'rivendell', name: 'Rivendell', date: '25 October 3018', length: 180, mode: 'walk', place: 'rivendell' },
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
