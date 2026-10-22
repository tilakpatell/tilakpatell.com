// Chocolate Frog cards (the design’s §4.9): twenty, hidden through the
// world, each a witch or wizard of the books with a card’s worth of the
// site’s own words on the back. Found once each, kept in the save (the
// `cards` key under tp-hogwarts), shown in the binder (hud/Binder.jsx).
// Where each hides is a room (rooms/index.js’s ids; ‘common’ is your own
// house’s) or a place on the grounds (rules/places.js), with a hint the
// binder prints under an empty pocket. Pure.
//
//   CARDS: [{ id, name, title, text, where: { room } | { place }, hint }]
//   cardById(id)
//   hiddenIn({ room, place }) → the cards hidden there
//   find(found, id) → { found, fresh }: the list with it in (once), and whether it was new
//   binder(found) → [{ id, name, title, text, hint, found }] in the binder’s order
//   foundCount(found)
//   roomOf(card, house) → the room it hides in (the common room’s: your house’s)
//   cardsIn(room, { house, found }) → the cards still to find in a room
//   spotFor(card, room) → { at: [x, z], r } where it lies in that room’s frame (NEAR: by a named place)

export const CARDS = [
  { id: 'dumbledore', name: 'Albus Dumbledore', title: 'Headmaster of Hogwarts', text: 'Keeps socks in high regard and the castle in better order than it looks. Known to hum in corridors. Has never once been seen to hurry.', where: { room: 'requirement' }, hint: 'At the top of the hill of lost things' },
  { id: 'merlin', name: 'Merlin', title: 'Of the court of Camelot', text: 'Wore his beard long and his advice longer. Advised a king, outlived several, and left his name to an order and to a great many oaths.', where: { room: 'honeydukes' }, hint: 'Inside a Chocolate Frog from Honeydukes' },
  { id: 'morgana', name: 'Morgana', title: 'Enchantress', text: 'Merlin’s rival, and never once his pupil, whatever he told people. Could hide an island in a mist and a grudge for a thousand years.', where: { room: 'astronomy' }, hint: 'Where the telescopes point at the stars' },
  { id: 'circe', name: 'Circe', title: 'Of the island of Aeaea', text: 'Turned unwelcome sailors into pigs, and was rarely troubled by sailors again. Her guests were advised to bring wine and not to stay.', where: { room: 'owlery' }, hint: 'Among the owls, under the straw' },
  { id: 'agrippa', name: 'Cornelius Agrippa', title: 'Scholar', text: 'Wrote so much about magic that the Muggles of his day locked him up to stop him. Wrote more in there. Collectors find this card hardest of all to keep.', where: { room: 'common' }, hint: 'Down the back of a chair in your common room' },
  { id: 'ptolemy', name: 'Ptolemy', title: 'Astronomer', text: 'Drew the heavens as he saw them, wrongly and beautifully. Astronomy students still check his sums for mistakes, and still find them.', where: { place: 'stone-circle' }, hint: 'Leaning on a standing stone' },
  { id: 'paracelsus', name: 'Paracelsus', title: 'Healer and alchemist', text: 'Changed his name to sound grander and his medicines to work better. The second change did more good. A bust of him sits somewhere in the castle, frowning.', where: { room: 'potions' }, hint: 'Behind the jars on the Potions shelves' },
  { id: 'cliodna', name: 'Cliodna', title: 'Druidess', text: 'Could turn herself into a seabird at will, and preferred to. Three birds of hers sang so sweetly that the sick slept and woke well.', where: { room: 'boathouse' }, hint: 'In the boathouse, where the boats are tied' },
  { id: 'gryffindor', name: 'Godric Gryffindor', title: 'Founder of Hogwarts', text: 'Took the brave and the reckless, and could seldom tell them apart. Left a sword, a hat with opinions and a tower full of noise.', where: { room: 'greatHall' }, hint: 'Under the high table in the Great Hall' },
  { id: 'hufflepuff', name: 'Helga Hufflepuff', title: 'Founder of Hogwarts', text: 'Took everyone the others turned away, and fed them. Many of the castle’s best recipes are hers, and so is its kitchen’s good temper.', where: { room: 'kitchens' }, hint: 'A house-elf has it, by the kitchen fires' },
  { id: 'ravenclaw', name: 'Rowena Ravenclaw', title: 'Founder of Hogwarts', text: 'Designed the staircases that move, and claimed it was on purpose. Valued a good question over a quick answer, and a quick answer over none.', where: { room: 'library' }, hint: 'Between two books in the library' },
  { id: 'slytherin', name: 'Salazar Slytherin', title: 'Founder of Hogwarts', text: 'Wanted the best students and argued about who they were until he left. Cold, clever and fond of snakes, which may have been the trouble.', where: { room: 'staircase' }, hint: 'Behind a portrait on the Grand Staircase' },
  { id: 'flamel', name: 'Nicolas Flamel', title: 'Alchemist', text: 'Lived long enough to forget his own birthday, though his wife never let him forget hers. Keeps a very old stone and a very small garden.', where: { room: 'charms' }, hint: 'On Professor Flitwick’s pile of books' },
  { id: 'scamander', name: 'Newt Scamander', title: 'Magizoologist', text: 'Wrote the book on fantastic beasts and kept several of them in a suitcase. Prefers the company of a Niffler to that of most people, which the Niffler returns.', where: { room: 'hut' }, hint: 'In the teapot in Hagrid’s hut' },
  { id: 'bott', name: 'Bertie Bott', title: 'Confectioner', text: 'Meant to make sweets taste of everything and was alarmingly successful. Tasted the earwax one himself, so nobody else would have to first.', where: { room: 'broomsticks' }, hint: 'On the mantelpiece of the Three Broomsticks' },
  { id: 'jones', name: 'Gwenog Jones', title: 'Captain of the Holyhead Harpies', text: 'Has never lost a fight she started, and has started a few. The only player known to have beaten a Bludger back to its own crate.', where: { place: 'pitch' }, hint: 'Under the stands at the Quidditch pitch' },
  { id: 'wright', name: 'Bowman Wright', title: 'Metal-charmer', text: 'Made the first Golden Snitch to spare a bird the trouble. Took three tries to stop the first one leaving the country.', where: { room: 'defence' }, hint: 'In the wardrobe, once the boggart has gone' },
  { id: 'bonham', name: 'Mungo Bonham', title: 'Healer', text: 'Founded the wizarding hospital that still bears his name, and its rule that nobody leaves without a biscuit. Healers still swear by both.', where: { room: 'hogshead' }, hint: 'Stuck under a table at the Hog’s Head' },
  { id: 'wendelin', name: 'Wendelin the Weird', title: 'Enthusiast', text: 'Was caught and burnt at the stake forty-seven times by Muggles who couldn’t take a hint. Enjoyed the warmth. Went back for more in a different hat.', where: { room: 'shack' }, hint: 'On the broken piano in the Shrieking Shack' },
  { id: 'uric', name: 'Uric the Oddball', title: 'Wizard, of a sort', text: 'Wore a jellyfish for a hat and kept fifty Augureys to tell him the weather. Was wrong about nearly everything, with great confidence.', where: { place: 'greenhouses' }, hint: 'Tucked into a pot in greenhouse three' },
];

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export const cardById = (id) => BY_ID.get(id) ?? null;

export const hiddenIn = ({ room = null, place = null } = {}) => CARDS.filter((c) => (room && c.where.room === room) || (place && c.where.place === place));

// The common room’s card is in yours, whichever house that is
const HOUSES = new Set(['gryffindor', 'hufflepuff', 'ravenclaw', 'slytherin']);
export const roomOf = (card, house) => (card.where.room === 'common' ? house : card.where.room ?? null);

// the cards still to find in a room you’re in (`room` its id: a house’s id is its common room)
export function cardsIn(room, { house = null, found = [] } = {}) {
  if (!room) return [];
  return CARDS.filter((c) => !found.includes(c.id) && (c.where.room === room || (c.where.room === 'common' && HOUSES.has(room) && room === house)));
}

// Where a card lies in a room, in the room’s own frame: by the place its
// hint names when the room has it (NEAR, a place’s id and a step off it),
// else a few steps into the room from where you come in
export const NEAR = {
  gryffindor: { place: 'high-table', off: [1.2, 2.2] },
  hufflepuff: { place: 'kitchens', off: [2.4, 1.6] },
  slytherin: { place: 'landing-3', off: [0.8, 0] },
};
export function spotFor(card, room = {}) {
  const near = NEAR[card.id];
  const place = near && (room.places ?? []).find((p) => p.id === near.place);
  if (place) return { at: [place.at[0] + near.off[0], place.at[1] + near.off[1]], r: 1.1 };
  const s = room.spawn ?? { at: [0, 0, 0], yaw: 0 };
  const [x, z] = s.at.length === 3 ? [s.at[0], s.at[2]] : s.at;
  const yaw = s.yaw ?? 0;
  // (three steps ahead of the way in and one to the left: the walk’s yaw looks along (−sin, −cos))
  return { at: [x - Math.sin(yaw) * 3 - Math.cos(yaw) * 1.2, z - Math.cos(yaw) * 3 + Math.sin(yaw) * 1.2], r: 1.1 };
}

export function find(found = [], id) {
  if (!BY_ID.has(id) || found.includes(id)) return { found, fresh: false };
  return { found: [...found, id], fresh: true };
}

export const binder = (found = []) => CARDS.map((c) => ({ id: c.id, name: c.name, title: c.title, text: c.text, hint: c.hint, found: found.includes(c.id) }));

export const foundCount = (found = []) => CARDS.filter((c) => found.includes(c.id)).length;
