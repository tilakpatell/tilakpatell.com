// The quick tour's cards (QuickTour.jsx): the site in five, read in half a
// minute while the universe gets ready behind them. A card is a title, a
// sentence, and rows of keys (each with what it does) for a keyboard, or a
// sentence of its own for a touch screen. `key` is the palette's shortcut
// (⌘K or Ctrl K, lib/palette's shortcutLabel). `art` names the drawing.
//
// (the flying card's keys are the five that matter in the first minute,
// UniverseMap's hint; the guide has the rest)

export const cardsFor = ({ key = 'Ctrl K' } = {}) => [
  {
    id: 'universe',
    art: 'sun',
    title: 'My site is a universe',
    text: 'Every page and every world here is a place you can fly to. Pick a ship and go, or pick a place and the camera takes you there.',
  },
  {
    id: 'stations',
    art: 'stations',
    title: 'The stations are my pages',
    text: 'Experience, projects, résumé, contact and the terminal orbit the sun. Fly up to one, or pick it on the panel, and it opens.',
  },
  {
    id: 'worlds',
    art: 'planets',
    title: 'The planets are worlds I love',
    text: 'Star Wars, Marvel, Middle-earth, Rick and Morty and more, out in deep space. Fly down into a planet’s air to go in.',
  },
  {
    id: 'fly',
    art: 'ship',
    title: 'Flying',
    rows: [
      { keys: ['W', 'S'], text: 'throttle' },
      { keys: ['Arrows'], text: 'steer' },
      { keys: ['Space'], text: 'boost' },
      { keys: ['F'], text: 'fire' },
    ],
    touch: 'Drag to fly, and hold Boost and Fire. A phone flies better on its side.',
  },
  {
    id: 'help',
    art: 'compass',
    title: 'You can’t get lost',
    rows: [
      { keys: ['M'], text: 'the nav map: every place by name' },
      { keys: [key], text: 'search every page, project and world' },
      { keys: ['?'], text: 'the guide: every control, and longer tours' },
    ],
    touch: 'The nav map, search and the guide are buttons on the screen.',
    after: 'Rather read? The Classic switch at the top of every page is the same site as pages.',
  },
];

// the brief the flying card stands in for: the map's first flight
// (components/tour/brief's ASKED), not shown again once this card has been
export const FLY_BRIEF = '/universe/fly';
