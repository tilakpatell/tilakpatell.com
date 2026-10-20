// Bag End’s study, pure: the things in the room to touch, and what each
// does and says (the room’s 3D is ./study.js; the view from the window is
// ./outside.js, with ./valar.js). The words are the site’s own; the films’
// only through their clips (lib/clips). A thing: { id, name (what a hover or
// a screen reader calls it), say (the caption’s line), act (what the room
// does with it: study.js), clip?, to? (an address it opens), sound? (lib/sfx
// or the book’s cues), lines? (a few to say in turn) }.
//
//   ROOM → the things; roomThing(id) → one, or null
//   nextLine(thing, n) → what it says the n-th time it is touched
//   VIEWS → where the camera may stand; nextView(view, key) → where a key takes it

export const ROOM = [
  { id: 'hearth', name: 'The fire', act: 'stoke', sound: 'crackle', say: 'You stir the fire. Sparks go up the chimney, and the room grows warmer.' },
  { id: 'candles', name: 'The candles', act: 'snuff', sound: 'pop', say: 'A pinch, and the candle is out. Another, and it is lit again.' },
  { id: 'pipe', name: 'Bilbo’s pipe', act: 'rings', say: 'A pull of Old Toby, and a smoke ring sails up into the beams. Gandalf’s go through Bilbo’s.' },
  {
    id: 'sting',
    name: 'Sting',
    act: 'draw',
    sound: 'clang',
    // (drawn, then put back: the lines go in turn with it)
    lines: ['Bilbo’s little Elvish sword, found in a troll’s cave. Drawn, its blade shines blue, as it does when orcs are near.', 'Back on its peg. The blue goes out of the blade, and the fire has the room again.'],
  },
  { id: 'mithril', name: 'The mithril coat', act: 'glint', sound: 'ding', say: 'Light as a feather and as hard as dragon scales. Bilbo never said what it was worth: more than the Shire and everything in it.' },
  { id: 'lantern', name: 'The beam and its lantern', act: 'swing', sound: 'knock', say: 'The beam is low, the lantern swings. Gandalf always finds it with his head.' },
  {
    id: 'books',
    name: 'Bilbo’s books',
    act: 'book',
    sound: 'thunk',
    lines: [
      'Translations from the Elvish, by B. B., in three volumes, much read.',
      'A Long-expected Party: lists of guests, of presents, and of who was not invited.',
      'A Book of Shire Recipes: seed-cake, mushrooms six ways, and what to give Dwarves who arrive without warning.',
      'Maps of the Wilderland, one of them in Thrór’s hand, with moon-letters that show only under the right moon.',
      'There and Back Again, a fair copy, with a blank page at the end for whoever goes next.',
    ],
  },
  { id: 'map', name: 'The map of Middle-earth', act: 'map', to: '/middle-earth/map', say: 'Every road out of Bag End is on it. Look closer, and it opens.' },
  { id: 'door', name: 'The round green door', act: 'door', to: '/middle-earth/road', say: 'The Road goes on from this door. Step out, and walk it all the way to the sea.' },
  { id: 'sign', name: 'The sign by the door', act: 'glint', say: 'No admittance except on party business, it says, in Bilbo’s best hand.' },
  { id: 'window', name: 'The round window', act: 'window', say: 'The night outside, and someone at the gate.' },
  { id: 'leaf', name: 'A jar of Longbottom Leaf', act: 'glint', clip: 'secondBreakfast', say: 'The finest pipe-weed in the Southfarthing. Pippin would like to know when the next meal is.' },
];

export const roomThing = (id) => ROOM.find((t) => t.id === id) ?? null;

export const nextLine = (thing, n = 0) => (thing?.lines?.length ? thing.lines[((n % thing.lines.length) + thing.lines.length) % thing.lines.length] : (thing?.say ?? ''));

// where the camera stands: over the book, round the room from the chair,
// at the window looking out, in the Palantír, and with the Ring in hand
export const VIEWS = ['book', 'look', 'window', 'stone', 'ring'];

const KEYS = { KeyL: 'look', KeyW: 'window', KeyB: 'book' };
export function nextView(view, key) {
  const to = KEYS[key];
  if (!to) return view;
  // (a key for the view you are in takes you back to the book)
  return to === view ? 'book' : to;
}
