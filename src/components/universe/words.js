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

// A Rick and Morty sector planet's way in and out, as its card and the nav
// map say it: a whole world (universes.js's `big`) is the cruiser's to land
// on, the rest are walked into (the guide's planet page says the same).
export const moonWay = (moon) =>
  moon.big
    ? 'It’s a whole world: the cruiser sets down and you climb out as Rick, Morty beside you; take off again and you’re back out in space.'
    : 'Land on it and you’re straight into it, on foot as Morty, with something to do there; its own portal brings you back out to space.';

// A generated place's card (places/cards.js): what each star, planet, moon,
// station and thing out in the endless universe is called, the line about it,
// its facts and its buttons, and the card a link shows before the scene has
// found the place, or with no scene to find it.
const count = (n, word) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : `no ${word}s`);
// Lane 4a's things in space: what E does there, and what's said when it does.
const LORE = [
  'The signs say the stars here were moved, once, by hand.',
  'A map, cut in stone, of a sky that hasn’t been seen for a million years.',
  'Names, thousands of them, and the last one left unfinished.',
  'A warning, repeated in seven scripts: do not wake the deep one.',
  'A count of days that stops at the day this slab was set here.',
  'Instructions for building a gate. Half the stone is missing.',
  'A poem about the cold between the galaxies. It rhymes in no tongue you know.',
  'The same face, over and over, smaller each time.',
  'A record of a trade: one star for one song.',
  'A list of worlds. Three of them are ones you’ve been to.',
  'A promise to come back. It’s signed with a handprint of six fingers.',
  'Nothing but a spiral, worn smooth by hands.',
];
export const THINGS = {
  verb: { mine: 'Mine', salvage: 'Salvage', scan: 'Scan', follow: 'Follow the signal', hail: 'Hail', survey: 'Survey', probe: 'Probe the anomaly', search: 'Search the moon' },
  surveyed: (name, facts) => `Surveyed ${name}. ${facts.join(' · ')}.`,
  probed: (name, id) => `${name}: ${{ gravity: 'the probe falls up and comes back heavier', timeslip: 'the probe comes back a day older than it left', mirror: 'the probe sends back pictures of a planet that isn’t here', song: 'the probe records the ground singing, the same twelve notes', ghostlight: 'the probe follows the lights and they follow it back' }[id]}. The readings are worth something.`,
  searched: (name, kind) => `${name}: ${{ cache: 'a cache, sealed and still full', wreck: 'a wreck under the dust, its logs intact', signal: 'the signal’s source, a beacon older than anyone’s maps', machine: 'a machine, still running, that stops when you land' }[kind]}.`,
  braved: (name) => `You rode out ${name}’s worst. The readings are worth something.`,
  prompt: (verb, name) => `E: ${THINGS.verb[verb]} · ${name}`,
  did: ({ verb, pay, lore, leads, trap, name }) => {
    if (verb === 'mine') return pay ? 'Ore aboard. Worth something at any station.' : 'You’ve taken all this field will give for now.';
    if (verb === 'salvage') return !pay ? `Nothing left worth taking from ${name}.` : trap ? `Salvaged ${name}. Something on it has woken up.` : `Salvaged ${name}.`;
    if (verb === 'scan') return lore !== undefined ? LORE[lore % LORE.length] : pay ? `Scanned ${name}: the logs are worth something.` : `Already scanned ${name}.`;
    if (verb === 'follow') return leads === 'distress' ? 'A distress call. Somebody out here needs help.' : 'A signal with coordinates in it. Something’s hidden out there.';
    return `${name} answers your hail.`;
  },
  tail: 'Through the comet’s tail: ice samples aboard.',
  beam: (kind) => (kind === 'magnetar' ? 'A magnetar’s beam: your screens scramble.' : 'A pulsar’s beam sweeps over you: your screens scramble.'),
  jet: 'Inside a quasar’s jet: the shields are burning off.',
  thrown: (key) => `Through the wormhole. You’re in ${key}, a long way from where you were.`,
};

// a long jump into generated space, in hops (explore/route.js): the HUD's note
export const HOPS = {
  going: (k, n, name) => `Hop ${k} of ${n}${name ? ` · ${name}` : ''}: past the hyperdrive’s range, it goes in hops.`,
  last: (k, n) => `Hop ${k} of ${n}: the last.`,
};
// the scan, charting and the data bank (explore/): the HUD's notes
export const EXPLORE = {
  charted: (id, n) => `Sector charted · ${id} · +${n} data`,
  scanned: ({ systems, things, surveyed, paid }) =>
    paid ? `Scanned ${systems} system${systems === 1 ? '' : 's'} and ${things} thing${things === 1 ? '' : 's'}${surveyed ? ' · sector surveyed' : ''} · +${paid} data` : 'Scanned: nothing new in reach.',
  charging: (s) => `Scanner charging · ${Math.ceil(s)} s`,
  paid: (n) => `Exploration data sold · +${n.toLocaleString('en-GB')} ¢`,
};
// the ships' signatures and the cargo pod (signatures/): the HUD's notes
export const SIGNS = {
  portal: 'Portal gun: straight there.',
  lab: (name) => `The lab: one more ${name.toLowerCase()}.`,
  seized: (fine) => `Contraband found in the open and taken${fine ? `, and a fine of ${fine.toLocaleString('en-GB')} ¢` : ''}.`,
  podTaken: (n, more) => `Cargo pod: ${n} aboard${more ? '; the hold’s full, the rest left in it' : ''}.`,
  podLeft: 'Your cargo’s in a pod where you went down. Fly back to it and press E.',
};
// a docked station's market (places/MarketTab.jsx)
const credits = (n) => `${n.toLocaleString('en-GB')} ¢`;
export const MARKET = {
  title: 'Market',
  opening: 'The market’s opening…',
  type: (name) => `${name} station`,
  hold: (used, room) => `Hold ${used} / ${room}`,
  buy: (p) => `Buy · ${credits(p)}`,
  sell: (p) => `Sell · ${credits(p)}`,
  sellAll: 'Sell all',
  dump: 'Dump one',
  bought: (name, p) => `Bought one ${name.toLowerCase()} for ${credits(p)}.`,
  sold: (n, name, got) => `Sold ${n} ${name.toLowerCase()} for ${credits(got)}.`,
  dumped: (name) => `Dumped one ${name.toLowerCase()}.`,
  why: { shop: 'The market’s opening…', unsold: 'They don’t sell that here.', room: 'The hold’s full.', credits: 'Not enough credits.', none: 'Nothing of that to sell.' },
};

// the hold (market/): what mining and salvage put in it, and when there's no room
export const HOLD = {
  stowed: (list) => `Into the hold: ${list}.`,
  full: 'The hold’s full. Sell at a station, or dump something.',
  minedOut: 'This field is mined out for now. Come back in a couple of hours.',
  stripped: (name) => `${name ?? 'This wreck'} has been stripped already.`,
};

export const PLACE = {
  star: { O: 'Blue giant', B: 'Blue giant', A: 'White star', F: 'Yellow-white star', G: 'Yellow star', K: 'Orange star', M: 'Red dwarf', 'white dwarf': 'White dwarf', neutron: 'Neutron star' },
  system: (star) => `${star} system`,
  planet: { rock: 'Rocky world', ice: 'Ice world', gas: 'Gas giant', lava: 'Lava world', ocean: 'Ocean world', desert: 'Desert world', forest: 'Forest world', ringed: 'Ringed giant' },
  moon: { rocky: 'Rocky moon', icy: 'Icy moon' },
  station: 'Station',
  thing: { rock: 'Asteroid', ice: 'Ice shard', derelict: 'Derelict', rogue: 'Rogue planet', nebula: 'Nebula', pulsar: 'Pulsar', outpost: 'Abandoned outpost', beacon: 'Beacon', relay: 'Relay array', monolith: 'Monolith', field: 'Asteroid field', icefield: 'Ice field', comet: 'Comet', rig: 'Mining rig', fleet: 'Fleet at anchor', shipyard: 'Shipyard', pocket: 'Nebula', remnant: 'Supernova remnant', storm: 'Ion storm', herd: 'Leviathan herd', swarm: 'Swarm', debris: 'Battle debris', magnetar: 'Magnetar', protostar: 'Forming star', wormhole: 'Wormhole', hole: 'Black hole', arc: 'Ringworld arc', hulk: 'Derelict hulk', giant: 'Supergiant', dyson: 'Dyson swarm', dwarf: 'Brown dwarf', quasar: 'Quasar', default: 'Something in space' },
  about: {
    system: ({ star, planets, station, held, companions = [] }) => `${/^[aeiou]/i.test(star) ? 'An' : 'A'} ${[star.toLowerCase(), ...companions.map((c) => `${/^[aeiou]/i.test(c) ? 'an' : 'a'} ${c}`)].join(', ').replace(/, ([^,]*)$/, ' and $1')} with ${count(planets, 'planet')}${station ? ' and a station' : ''}, held by ${held}.`,
    planet: ({ type, system, moons, rings }) => `${type} round ${system}, with ${count(moons, 'moon')}${rings ? ' and rings' : ''}.`,
    moon: ({ type, planet, system }) => `${type} of ${planet}, round ${system}.`,
    mined: ({ planet }) => `A moon of ${planet} mined out by someone long gone: its scars cut deep, a few of their rigs still lit.`,
    station: ({ system, held }) => `A station over ${system}’s star, held by ${held}. Dock for the hangar and the shop.`,
    rock: 'A drifting rock, pitted and slow.',
    ice: 'A shard of ice, catching the light.',
    derelict: 'A dead ship, drifting. Nobody aboard answers.',
    rogue: 'A planet with no star of its own, dark and cold.',
    nebula: 'A cloud of gas and dust. Not solid: fly right through it.',
    pulsar: 'A dead star, spinning, its beams sweeping round.',
    outpost: 'An outpost nobody runs any more. Some of it might still be worth taking.',
    beacon: 'A beacon, blinking. Something out here is calling for someone.',
    relay: 'A relay array, still listening. Worth a scan.',
    monolith: 'A dark slab older than the stars round it, cut all over with signs.',
    field: 'A drift of rock round the edge of a system. Shoot a rock for its ore.',
    icefield: 'A drift of ice shards. Shoot one for what’s frozen inside.',
    comet: 'A comet on its long way round, its tail pointing away from its star.',
    rig: 'A mining rig on a big rock, its haulers coming and going.',
    fleet: 'Ships at anchor, flying their colours. Hail them.',
    shipyard: 'A hull going up in its scaffold, the cranes still working.',
    pocket: 'A pocket of glowing gas. Fly in.',
    remnant: 'The shell a star threw off when it blew. Fly through it.',
    storm: 'An ion storm, drifting. Inside it the shields drain.',
    herd: 'A herd of space leviathans going their own way.',
    swarm: 'Glowing drifters that live in the nebula.',
    debris: 'What’s left of an old battle. Salvage what you can.',
    magnetar: 'A dead star with a field strong enough to scramble a ship’s screens.',
    protostar: 'A star still forming in its disc of dust.',
    wormhole: 'A tear in space. Fly in and it throws you far away, one way only.',
    hole: 'A black hole, its disc burning round the dark.',
    arc: 'A ringworld left unfinished: a band of land as wide as a world, curving round nothing.',
    hulk: 'A dead ship the size of a moon.',
    giant: 'A gas giant big enough to swallow a system, a storm turning on its face.',
    dyson: 'A star wrapped in a swarm of collectors, most of its light caught.',
    dwarf: 'A failed star, too small to burn: a dull red glow through bands of cloud.',
    quasar: 'A black hole feeding so hard its core outshines a galaxy, two jets blazing from its poles. Keep out of the jets.',
    default: 'Out here between the stars.',
  },
  held: (name) => name.replace(/^The /, 'the '), // (a faction's name mid-sentence)
  hazard: { storm: 'Ion storms', pirates: 'Pirates', minefield: 'A minefield' },
  traffic: (k) => (k >= 0.66 ? 'Busy' : k >= 0.33 ? 'Some' : 'Quiet'),
  facts: { system: 'System', planet: 'Planet', planets: 'Planets', moons: 'Moons', rings: 'Rings', held: 'Held by', traffic: 'Traffic', hazard: 'Hazard', mined: 'Mined', resources: 'Resources', rare: 'Rare find', anomaly: 'Anomaly', ruins: 'Ruins', secret: 'A moon’s secret', station: 'Station', danger: 'Danger' },
  good: { organics: 'Organics' },
  anomaly: { gravity: 'Gravity runs wrong here', timeslip: 'Clocks drift in orbit', mirror: 'The sky shows another world', song: 'The ground sings on the radio', ghostlight: 'Lights move on the night side' },
  secret: (moon, kind) => `${moon}: ${{ cache: 'a hidden cache', wreck: 'a buried wreck', signal: 'a signal from under the ice', machine: 'an old machine, still running' }[kind]}`,
  danger: (id, level) => `${{ radiation: 'Radiation', quakes: 'Quakes', duststorms: 'Dust storms', heat: 'Heat', blizzards: 'Blizzards', cold: 'Deep cold', predators: 'Predators', spores: 'Spores', storms: 'Storms', crushing: 'Crushing winds', debris: 'Ring debris', pirates: 'Pirates' }[id]}${['', '', ', bad', ', deadly'][level] ?? ''}`,
  mined: 'Stripped by someone long gone',
  yes: 'Yes',
  fly: 'Fly here',
  dock: 'Dock here',
  hangar: 'Hangar and shop',
  docked: (name) => `Docked at ${name} · H for the hangar and shop`,
  plotting: 'Plotting a course…', // (a link's card while the scene finds the place)
  flat: 'Out in the endless universe. Fly here in 3D.', // (a link's card with 3D off, failed or lost: no scene runs to find it)
};

// The nav map's chart: its tools, its readout of where the ship is (its
// sector, lib/space/address.js, and how far above or below the disc the
// hand-made places sit in), and its keys. ("3D view" is retired: the chart
// tilts and turns, and looks straight down again.)
export const CHART_WORDS = {
  tools: 'Chart',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  toShip: 'Back to the ship',
  flat: 'Look straight down',
  fit: 'Show everything',
  sector: ([sx, sy, sz]) => `Sector ${[sx, sy, sz].map((n) => String(n).replace('-', '−')).join(', ')}`,
  height: (far, side) => (side === 0 ? 'Level with the disc' : `${far} ${side > 0 ? 'above' : 'below'} the disc`),
  keys: 'zoom in and out, 0 back to the ship',
};
