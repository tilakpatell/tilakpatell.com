// The places on the map that open a chapter of the page, in the road's
// order. `at` is on the 800×560 sheet where its stop is (./sheet.js),
// `stop` the stop on the road (./road.js) Frodo walks to, `lift` how high over the sheet its pin
// floats in 3D (over its landmark); `seals` are the achievements that
// chapter can earn, shown as wax seals on the map once won.
import { STOPS } from './road';
import { placeAt } from './sheet';

export const CHAPTERS = [
  {
    id: 'shire',
    stop: 'hobbiton',
    lift: 2.4,
    name: 'The Shire',
    title: 'Hobbiton, on the day of the party',
    blurb: 'Walk about the Shire: Maggot’s mushrooms, smoke rings with Gandalf, the fireworks, and the Ring.',
    at: placeAt('hobbiton'),
    theme: 'shire',
    seals: ['mushrooms', 'smokerings', 'fireworks', 'secretsafe', 'getoffroad'],
  },
  {
    id: 'bree',
    stop: 'bree',
    lift: 2.4,
    name: 'Bree',
    title: 'The Prancing Pony, on a wet night',
    blurb: 'In at the West Gate in the rain: Butterbur, pints for Pippin, a Ranger called Strider, and the Nazgûl in the lanes at night. Then the Pony’s kitchen, co-op with friends online.',
    at: placeAt('bree'),
    theme: 'shire',
    seals: ['breegate', 'underhill', 'pints', 'strider', 'slipaway'],
  },
  {
    id: 'weathertop',
    stop: 'weathertop',
    lift: 2.8,
    name: 'Weathertop',
    title: 'Amon Sûl, by night',
    blurb: 'The ruined watchtower on its hill: Sam’s supper, five Nazgûl on the summit, kingsfoil by lantern, and the ride with Arwen to the Ford.',
    at: placeAt('weathertop'),
    theme: 'shire',
    seals: ['amonsul', 'putitout', 'weathertop', 'kingsfoil', 'bruinen'],
  },
  {
    id: 'rivendell',
    stop: 'rivendell',
    lift: 2.8,
    name: 'Rivendell',
    title: 'The house of Elrond, in autumn',
    blurb: 'Wake after the Ford: the shards of Narsil, the Council of Elrond, Bilbo’s gifts, and nine walkers setting out.',
    at: placeAt('rivendell'),
    theme: 'shire',
    seals: ['elrond', 'narsil', 'iwilltakeit', 'oldring', 'fellowship'],
  },
  {
    id: 'moria',
    stop: 'moria',
    lift: 3.8,
    name: 'Moria',
    title: 'The long dark of Moria',
    blurb: 'Speak, friend, and enter: past the Watcher, through the dark of Dwarrowdelf to Balin’s tomb, the cave troll, and the Bridge of Khazad-dûm.',
    at: placeAt('moria'),
    theme: 'shire',
    seals: ['mellon', 'dwarrowdelf', 'fooloftook', 'mithril', 'flyyoufools', 'balrog'],
  },
  {
    id: 'lorien',
    stop: 'lorien',
    lift: 3.8,
    name: 'Lothlórien',
    title: 'The golden wood',
    blurb: 'Haldir and the Galadhrim, Caras Galadhon by lantern-light, the Mirror, the Lady’s gifts, and the boats down to the Argonath. And the places it was filmed.',
    at: placeAt('lorien'),
    theme: 'shire',
    seals: ['goldenwood', 'carasgaladhon', 'ipassthetest', 'earendil', 'argonath'],
  },
  {
    id: 'amon-hen',
    stop: 'amon-hen',
    lift: 3.2,
    name: 'Amon Hen',
    title: 'The breaking of the Fellowship',
    blurb: 'Parth Galen by the lake, Boromir among the old kings, the Seat of Seeing and the Eye, the Uruk-hai in the woods, and Sam in the water.',
    at: placeAt('amon-hen'),
    theme: 'shire',
    seals: ['parthgalen', 'wanderalone', 'seatofseeing', 'runfrodo', 'promise'],
  },
  {
    id: 'dead-marshes',
    stop: 'dead-marshes',
    lift: 2.6,
    name: 'The Dead Marshes',
    title: 'The Emyn Muil, the Dead Marshes and the Black Gate',
    blurb: 'Down the cliffs on Sam’s elven rope, catching Gollum by night, across the marshes past the faces in the water, and the Black Gate, shut and watched.',
    at: placeAt('dead-marshes'),
    theme: 'shire',
    seals: ['elvenrope', 'swearontheprecious', 'deadmarshes', 'anotherway'],
  },
  {
    id: 'cirith-ungol',
    stop: 'cirith-ungol',
    lift: 3.4,
    name: 'Cirith Ungol',
    title: 'The stairs, the lair and the Tower',
    blurb: 'Minas Morgul’s green light and the host pouring out, the endless stairs, Shelob in the dark and the phial of Galadriel, Sam’s fight, and the orcs’ Tower.',
    at: placeAt('cirith-ungol'),
    theme: 'shire',
    seals: ['minasmorgul', 'stairs', 'aiyaearendil', 'samwisethebrave', 'tower'],
  },
  {
    id: 'mordor',
    stop: 'mount-doom',
    lift: 4.2,
    name: 'Mordor',
    title: 'Gorgoroth and Mount Doom',
    blurb: 'In orc-gear in the column, across Gorgoroth under the Eye, Sam carrying Frodo up the mountain, the Crack of Doom, and the eagles.',
    at: placeAt('mount-doom'),
    theme: 'mordor',
    seals: ['maggots', 'gorgoroth', 'carryyou', 'ringbearer', 'eagles'],
  },
];

export const chapter = (id) => CHAPTERS.find((c) => c.id === id) || null;

// the next and the one before, along the road
export function neighbours(id) {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return { prev: i > 0 ? CHAPTERS[i - 1] : null, next: i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1] : null };
}

// where on the road a place is, as the index of its stop
export const stopOf = (id) => Math.max(0, STOPS.findIndex((s) => s.id === chapter(id)?.stop));
