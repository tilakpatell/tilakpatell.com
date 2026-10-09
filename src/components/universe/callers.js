// Who's on the radio: the crews' lines (crews.js, galaxy/lines.js) say
// 'comms' for anyone who isn't the crew, and whose voice it is is only in
// where the line is in them (npc.tammy.hello is Tammy, events.stage.tieadvanced
// is Vader). These name each caller, for the comms box (speakers.js), and say
// whose voice their lines are made in (lib/voiced.js; ./voicelines.js lists
// them). A radio line nobody's named here stays the radio's: no name, no voice.
// Pure, tested.

// name: as the comms box shows it; voice: the voice its lines are made in
// (null: a name, but nobody to sound like)
export const CALLERS = {
  // the Rick and Morty multiverse
  tammy: { name: 'Tammy', voice: 'tammy' },
  jerry: { name: 'Jerry', voice: 'jerry' },
  squanchy: { name: 'Squanchy', voice: 'squanchy' },
  evilmorty: { name: 'Evil Morty', voice: 'evilmorty' },
  poopybutthole: { name: 'Mr. Poopybutthole', voice: 'poopybutthole' },
  birdperson: { name: 'Birdperson', voice: 'birdperson' },
  phoenixperson: { name: 'Phoenixperson', voice: 'birdperson' },
  krombopulos: { name: 'Krombopulos Michael', voice: 'krombopulos' },
  council: { name: 'The Council of Ricks', voice: 'rick' },
  citadel: { name: 'The Citadel', voice: 'rick' }, // (a Rick on the desk)
  fedcustoms: { name: 'Federation customs', voice: 'fedofficer' },
  federation: { name: 'The Federation', voice: 'fedofficer' },
  cromulon: { name: 'A Cromulon', voice: 'cromulon' },
  // a galaxy far, far away
  vader: { name: 'Darth Vader', voice: 'vader' },
  customs: { name: 'Imperial customs', voice: 'imperialofficer' },
  empire: { name: 'Imperial command', voice: 'imperialofficer' },
  officer: { name: 'An Imperial officer', voice: 'imperialofficer' },
  hondo: { name: 'Hondo', voice: 'hondo' },
  lando: { name: 'Lando', voice: 'lando' },
  han: { name: 'Han', voice: 'han' },
  ackbar: { name: 'Admiral Ackbar', voice: 'ackbar' },
  redleader: { name: 'Red Leader', voice: 'redleader' },
  redtwo: { name: 'Red Two', voice: 'wedge' }, // (Wedge, in A New Hope)
  rogue: { name: 'Rogue Squadron', voice: 'wedge' },
  goldleader: { name: 'Gold Leader', voice: 'rebeltrooper' },
  green: { name: 'Green Squadron', voice: 'rebeltrooper' },
  rebels: { name: 'A Rebel pilot', voice: 'rebeltrooper' },
  brighthope: { name: 'Bright Hope', voice: 'rebeltrooper' },
  echobase: { name: 'Echo Base', voice: 'rebeltrooper' },
  fleet: { name: 'The Rebel fleet', voice: 'rebeltrooper' },
  ig88: { name: 'IG-88', voice: null },
  // Albuquerque
  tuco: { name: 'Tuco', voice: 'tuco' },
  hank: { name: 'Hank', voice: 'hank' },
  dea: { name: 'The DEA', voice: 'hank' },
  saul: { name: 'Saul', voice: 'saul' },
  mike: { name: 'Mike', voice: 'mike' },
  badger: { name: 'Badger', voice: 'badger' },
  pete: { name: 'Skinny Pete', voice: 'pete' },
};

// Whose a crew's radio lines are, by where they are in its lines (their
// keys, dotted, the numbers left out): the longest of these a line's place
// starts with. What's left (a freighter's mayday, a thank-you from nobody in
// particular, the recordings' voices) is anybody on the radio.
// The galaxy's (galaxy/lines.js), whoever's flying:
const GALAXY = {
  'hunted.weequay': 'hondo',
  'events.shield-down': 'ackbar',
  'events.gcw-shieldgen': 'ackbar',
  'events.shield-up': 'lando',
  'events.gcw-gate': 'fleet',
  'events.gcw-evacuated': 'echobase',
  'events.ion': 'echobase',
  'events.boarded': 'officer',
};
// the Empire's, after the X-wing and the Falcon alike
const EMPIRE = {
  'npc.vader': 'vader',
  'npc.customs': 'customs',
  'npc.hondo': 'hondo',
  'npc.lando': 'lando',
  'hunted.ace': 'vader',
  'events.standing.wanted': 'empire',
  'events.standing.trusted': 'customs',
  'events.standing.friend': 'hondo', // (the outer lanes' pirates: Hondo's)
  'events.stage.tieadvanced': 'vader',
  'events.stage.ig2000': 'ig88',
  'events.skirmishThanks': 'rebels',
  'events.wingmen.ywing': 'goldleader',
  'events.wingmen.awing': 'green',
};
const CALLS = {
  cruiser: {
    ...GALAXY,
    'npc.tammy': 'tammy',
    'npc.jerry': 'jerry',
    'npc.squanchy': 'squanchy',
    'npc.evilmorty': 'evilmorty',
    'npc.fedcustoms': 'fedcustoms',
    'hunted.council': 'council',
    'hunted.krombopulos': 'krombopulos',
    'crashInto.citadel': 'citadel',
    'events.wingmen.squanchship': 'squanchy',
    'events.wingmen.poopyship': 'poopybutthole',
    'events.standing.wanted': 'federation',
    'events.standing.trusted': 'fedcustoms',
    'events.stage.evilmortyship': 'evilmorty',
    'events.stage.phoenixperson': 'phoenixperson',
    'events.stage.krombopulos': 'krombopulos',
    'events.leviathan': 'cromulon',
  },
  xwing: {
    ...GALAXY,
    ...EMPIRE,
    'hunted.navy': 'redleader',
    'hunted.empire': 'redleader',
    'traffic.xwing': 'redleader',
    kill: 'redleader', // (Red Five, watch your fire)
    'crashInto.citadel': 'citadel',
    cleared: 'han', // (back for the Death Star: “Great shot, kid”)
    'ram.cleared': 'han',
    'events.wingmen.xwing': 'redtwo',
    'events.wingmenGone': 'redtwo',
    'events.distress': 'brighthope',
    'events.rescued': 'brighthope',
  },
  falcon: {
    ...GALAXY,
    ...EMPIRE,
    kill: 'rebels',
    'crashInto.citadel': 'citadel',
    'events.wingmen.xwing': 'rogue',
    'events.wingmenGone': 'rogue',
  },
  rv: {
    ...GALAXY,
    'npc.tuco': 'tuco',
    'npc.hank': 'hank',
    'npc.saul': 'saul',
    'npc.mike': 'mike',
    'kill.beater': 'pete', // (“That’s Badger, yo!”)
    'crashInto.citadel': 'citadel',
    'events.wingmen.saulcaddy': 'saul',
    'events.wingmen.mikesedan': 'mike',
    'events.wingmen.beater': 'badger',
    'events.wingmen.xwing': 'rogue',
    'events.wingmen.birdperson': 'birdperson',
    'events.standing.wanted': 'dea',
    'events.standing.trusted': 'dea',
    'events.roadblock': 'dea',
    'events.stage.suvace': 'hank',
    'events.leviathan.cromulon': 'cromulon',
  },
};

// The caller ({ name, voice }) whose radio line is at `path` ([crew id,
// ...keys] into the crew's lines), or null.
export function speakerOf(path) {
  const [crew, ...keys] = path;
  const calls = CALLS[crew];
  if (!calls) return null;
  const at = keys.filter((k) => typeof k === 'string'); // (not the places in a list)
  for (let n = at.length; n > 0; n--) {
    const id = calls[at.slice(0, n).join('.')];
    if (id) return CALLERS[id];
  }
  return null;
}

const isLine = (v) => Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string';

// Each line ([who, text, clip?]) in some lines (a crew, or any part of one),
// with where it is: fn(line, path).
export function eachLine(lines, path, fn) {
  if (isLine(lines)) fn(lines, path);
  else if (Array.isArray(lines)) lines.forEach((l, i) => eachLine(l, [...path, i], fn));
  else if (lines && typeof lines === 'object') Object.entries(lines).forEach(([k, l]) => eachLine(l, [...path, k], fn));
}

// the radio's lines whose caller is known, by the line itself (what the crew
// hands the comms box is the lines themselves, not where they came from)
const CALLER = new WeakMap();
const seen = new WeakSet(); // (the crews whose lines have been gone through)

// The caller of a radio line of this crew's, or null (one of the crew's own,
// or anybody on the radio).
export function callerOf(crew, line) {
  if (!crew || !isLine(line) || line[0] !== 'comms') return null;
  if (!seen.has(crew)) {
    seen.add(crew);
    eachLine(crew, [crew.id], (l, path) => {
      const caller = l[0] === 'comms' && speakerOf(path);
      if (caller) CALLER.set(l, caller);
    });
  }
  return CALLER.get(line) ?? null;
}

// A radio line with its words filled in (an offer's part named), still its caller's.
export function retold(crew, line, text) {
  const told = [line[0], text, line[2]];
  const caller = callerOf(crew, line);
  if (caller) CALLER.set(told, caller);
  return told;
}
