// The keys the galaxy's key card (KeysCard.jsx) shows: [group, [[keys, what it does]]]. Each is one of the guide's (guide/pages.js, which
// has them all; KeysCard.test.jsx checks they're there).
// Once you've flown in the galaxy on this device the card waits for its chip: it came up on every visit, every jump back from a
// planet's surface, as if each were the first (GalaxyView.jsx keeps this).
export const FLOWN_KEY = 'tp-galaxy-flown';
export const hasFlown = (raw) => raw === true;
// (up by itself till that first flight, or when the chip asks for it)
export const keysUp = ({ flown, asked }) => !flown || asked;

export const GROUPS = [
  ['Fly', [['W S', 'Throttle'], ['A D', 'Roll'], ['Arrows', 'Steer'], ['Space', 'Boost'], ['V', 'Cockpit']]],
  ['Fight', [['F', 'Fire (hold)'], ['R 1 2 3', 'Weapons'], ['T Q', 'Next, last target'], ['G', 'Crew power'], ['X', 'The big one']]],
  ['Travel', [['J', 'Jump to the star ahead'], ['M', 'Galaxy map'], ['E', 'Land'], ['H', 'Hangar'], ['C', 'Crew']]],
];
