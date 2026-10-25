// The universe map's rows of the glossary (src/lib/words.js has the site's):
// what the map is, its places, its drives and its verbs, written once so the
// panel, the nav map, the scene's prompts and the guide say the same thing.
// System text is plain; the crews keep their own words (crews.js).

// What the map is, in one sentence, as the panel says it. The start choice,
// the guide's entry (guide/abouts.js) and the tour's briefs say the same in
// their own words; when one is next rewritten, it should read this.
export const ABOUT = 'the stations round the sun are my pages, and the planets out in deep space are worlds I love';

// The nav map, its views, and the way back from it to the 3D scene.
export const NAV = {
  name: 'Nav map',
  kicker: 'Nav map · everywhere there is to go',
  view: 'Nav map view', // the chart's group, for a screen reader
  back: 'Universe view', // the button that closes it
  out: 'Out to the universe', // from a star system or the Curve back to the whole chart
  mode: 'Show the places as', // a phone's two ways to see them
  list: 'List',
  chart: 'Chart',
  tap: 'Tap a place for its card. The list has every one by name.', // under a phone's chart
};

// The flight round every stop, nearest first (not "the tour": that is the
// site's own tour of its pages).
export const FLY_PAST = {
  name: 'Fly past everything',
  short: 'Fly past',
  title: 'Fly past everything: every stop, nearest first (Esc to stop)',
  pill: (n, of, next) => `Flying past everything · ${n} of ${of}${next ? ` · next: ${next}` : ''}`,
};

// Hunters holding the jump down, said the same way on the HUD and the chart.
export const JAMMED = {
  long: 'Hunters are jamming the jump. Shake them off first.',
  short: 'Jump: jammed by hunters',
};

// The jump's charge, in the drive picker and the scene's note.
export const jumpState = (ready, wait) => (ready ? 'Jump: ready' : `Jump: charging, ${Math.ceil(wait)} s`);

// No ship yet: the one way to say how to get one.
export const PICK_A_SHIP = 'Pick a ship to fly out to it.';

// A generated place's card (places/cards.js): what each star, planet, moon,
// station and thing out in the endless universe is called, the line about it,
// its facts and its buttons, and the card a link shows before the scene has
// found the place, or with no scene to find it.
const count = (n, word) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : `no ${word}s`);
export const PLACE = {
  star: { O: 'Blue giant', B: 'Blue giant', A: 'White star', F: 'Yellow-white star', G: 'Yellow star', K: 'Orange star', M: 'Red dwarf', 'white dwarf': 'White dwarf', neutron: 'Neutron star' },
  system: (star) => `${star} system`,
  planet: { rock: 'Rocky world', ice: 'Ice world', gas: 'Gas giant', lava: 'Lava world', ocean: 'Ocean world', desert: 'Desert world', forest: 'Forest world', ringed: 'Ringed giant' },
  moon: { rocky: 'Rocky moon', icy: 'Icy moon' },
  station: 'Station',
  thing: { rock: 'Asteroid', ice: 'Ice shard', derelict: 'Derelict', rogue: 'Rogue planet', nebula: 'Nebula', pulsar: 'Pulsar', default: 'Something in space' },
  about: {
    system: ({ star, planets, station, held }) => `${/^[aeiou]/i.test(star) ? 'An' : 'A'} ${star.toLowerCase()} with ${count(planets, 'planet')}${station ? ' and a station' : ''}, held by ${held}.`,
    planet: ({ type, system, moons, rings }) => `${type} round ${system}, with ${count(moons, 'moon')}${rings ? ' and rings' : ''}.`,
    moon: ({ type, planet, system }) => `${type} of ${planet}, round ${system}.`,
    station: ({ system, held }) => `A station over ${system}’s star, held by ${held}. Dock for the hangar and the shop.`,
    rock: 'A drifting rock, pitted and slow.',
    ice: 'A shard of ice, catching the light.',
    derelict: 'A dead ship, drifting. Nobody aboard answers.',
    rogue: 'A planet with no star of its own, dark and cold.',
    nebula: 'A cloud of gas and dust. Not solid: fly right through it.',
    pulsar: 'A dead star, spinning, its beams sweeping round.',
    default: 'Out here between the stars.',
  },
  held: (name) => name.replace(/^The /, 'the '), // (a faction's name mid-sentence)
  hazard: { storm: 'Ion storms', pirates: 'Pirates', minefield: 'A minefield' },
  traffic: (k) => (k >= 0.66 ? 'Busy' : k >= 0.33 ? 'Some' : 'Quiet'),
  facts: { system: 'System', planet: 'Planet', planets: 'Planets', moons: 'Moons', rings: 'Rings', held: 'Held by', traffic: 'Traffic', hazard: 'Hazard' },
  yes: 'Yes',
  fly: 'Fly here',
  dock: 'Dock here',
  hangar: 'Hangar and shop',
  docked: (name) => `Docked at ${name} · H for the hangar and shop`,
  plotting: 'Plotting a course…', // (a link's card while the scene finds the place)
  flat: 'Out in the endless universe. Fly here in 3D.', // (a link's card with 3D off, failed or lost: no scene runs to find it)
};
