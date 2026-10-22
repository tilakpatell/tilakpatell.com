// The sides: whose universe each crew flies in, as data. Pick a crew and
// the whole map is theirs: who comes after you (the hunters' factions, by
// role), who helps (the wing that comes in a long fight, a convoy's
// escort), who passes by (the everyday traffic and the civilians, who calls
// for help and who's after them), what the director can set going (the set
// pieces), what enormous thing passes, and who comes at you on the ground.
// Every system on the map reads its crew's side from here instead of
// switching on a family of its own: scene.js, director.js, traffic.js,
// hunters.js, wingmen.js, skirmishes.js, leviathans.js, footScene.js and
// the wire (online/protocol.js). Pure (no three.js), so it's tested in
// Node; the design is docs/superpowers/specs/2026-10-06-universe-sides-design.md.
//
// A faction: { kinds: [[hunter kind, weight]…], ace?, laser: [r, g, b],
//   size: [least, most], role: 'hunt' (what a hunt sends, by `weight`) |
//   'bounty' (one tough one alone) | 'capital' (what a capital ship
//   launches) | 'council' (out of portals), weight?, portal? }
// A hunter kind: hunterRules.js's row (size, speed, accel, hp, fire, tail,
//   lead, spread, damage, trait: one of hunterRules.js's TRAITS, or traits:
//   several; model: the kind it's drawn as, when it has no model of its own; and for an ace
//   `stages`: [{ below: of its hull left, …what changes (speed, fire, trait…),
//   summon?: a faction it calls in }], hunterRules.js's `stage`); an ally: wingRules.js's row, with its bolts' colour.
// A side's `law` is the faction whose standing with you is the law's
//   (standing.js): its inspectors scan you, its patrols report you.
// A side's `police` is who comes when you're wanted (wanted.js): its
//   faction (role 'police', never sent by the director) and the kind for
//   each of wanted.js's RESPONSE units (cop, enforcer, heavy, medic).
// A troop: foot.js's TROOPS row by kind, with the gun it holds (gunplay.js's
//   GUNS) or null, and the figure it's drawn as (footScene.js's troopLook: a
//   Meshy cast kind, a model of its own, the 2017 game's body (gameTroop),
//   or built; the cast's own kind if none).

// a weighted pick from [[id, weight]…]
import { bodyOf, cutsOf } from '../../lib/cast/bodies';
import { pacedAll } from './ship';

// A troop on the 2017 game's own body: its row of the site's one cast table
// (lib/cast/bodies.js: the file, the game's skeleton, the cuts, of which a
// landing draws the light one, committed), and the look built here that it
// stands in as until that has come (footScene.js's troopFig)
const gameTroop = (kind, built) => {
  const row = bodyOf(kind);
  return { url: row.url, rig: row.rig, pack: row.pack ?? null, cuts: cutsOf(row), built };
};

const weighted = (list, rand) => {
  let r = rand() * list.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of list) if ((r -= w) <= 0) return id;
  return list[list.length - 1]?.[0] ?? null;
};

const STARWARS = {
  id: 'starwars',
  label: 'A galaxy far, far away',
  crews: ['xwing', 'falcon'],
  factions: {
    empire: { role: 'hunt', weight: 1, kinds: [['tie', 3], ['interceptor', 2], ['tiebomber', 1], ['missileboat', 0.6]], ace: 'tieadvanced', laser: [0.5, 5.5, 0.9], size: [3, 5] },
    // what the Star Destroyer launches: bombers and a gunboat among the TIEs,
    // a missile boat, and a repair shuttle that keeps them flying
    navy: { role: 'capital', weight: 1, kinds: [['tie', 2], ['tiebomber', 2], ['gunboat', 1], ['missileboat', 0.7], ['repairshuttle', 0.5]], laser: [0.5, 5.5, 0.9], size: [3, 4] },
    // bounty hunters: one at a time, tough and quick (director.js's bounty)
    fett: { role: 'bounty', weight: 1, kinds: [['slave1', 1]], laser: [5.5, 0.9, 0.5], size: [1, 1] },
    ig88: { role: 'bounty', weight: 1, kinds: [['ig2000', 1]], laser: [5.5, 1.2, 0.5], size: [1, 1] },
    bossk: { role: 'bounty', weight: 1, kinds: [['houndstooth', 1]], laser: [5.5, 2.4, 0.5], size: [1, 1] },
    dengar: { role: 'bounty', weight: 1, kinds: [['punishingone', 1]], laser: [5.5, 0.8, 0.8], size: [1, 1] },
    // pirates: Weequay skiffs, after anyone with cargo
    weequay: { role: 'pirates', weight: 1, kinds: [['skiff', 1]], laser: [6.0, 3.0, 0.6], size: [2, 3] },
    // the ISB: who comes when you're wanted (wanted.js)
    isb: { role: 'police', weight: 1, kinds: [['isbpatrol', 2], ['isbenforcer', 1], ['isbgunboat', 1], ['isbshuttle', 1]], laser: [0.5, 5.5, 0.9], size: [2, 4] },
  },
  kinds: {
    tie: { size: 0.3, speed: 19, accel: 17, hp: 1, fire: [0.8, 1.6] },
    interceptor: { size: 0.32, speed: 25, accel: 20, hp: 1, fire: [0.7, 1.3], tail: 0.25 },
    // Vader: hurt to half, he stops playing: faster, closer, on your tail
    tieadvanced: { size: 0.36, speed: 26, accel: 22, hp: 7, fire: [0.45, 0.8], tail: 0.45, lead: 0.9, spread: 0.8, stages: [{ below: 0.5, speed: 29, accel: 25, fire: [0.3, 0.55], tail: 0.8, lead: 0.97 }] },
    // Fett: hurt to half, Slave I drops its seismic charges instead
    slave1: { size: 0.55, speed: 24, accel: 20, hp: 8, fire: [0.5, 0.9], tail: 0.45, lead: 0.9, spread: 0.85, stages: [{ below: 0.5, trait: 'bomber', fire: [1.4, 2.0], speed: 22 }] },
    // slow, and it means it: one bomb a run (hunterRules.js's traits)
    tiebomber: { size: 0.34, speed: 16, accel: 13, hp: 3, fire: [2.2, 3.2], trait: 'bomber' },
    gunboat: { size: 0.42, speed: 18, accel: 15, hp: 4, fire: [0.45, 0.8], spread: 1.3, trait: 'holdoff' },
    // IG-88 overclocks; Bossk stands off and pounds you; Dengar's jammer hides him when he's hit
    ig2000: { size: 0.5, speed: 25, accel: 21, hp: 7, fire: [0.45, 0.8], tail: 0.4, lead: 0.95, spread: 0.7, stages: [{ below: 0.5, speed: 29, accel: 24, fire: [0.3, 0.5], spread: 0.5 }] },
    houndstooth: { size: 0.62, speed: 22, accel: 18, hp: 9, fire: [0.6, 1.0], tail: 0.3, lead: 0.85, spread: 0.9, stages: [{ below: 0.5, trait: 'holdoff', fire: [0.4, 0.7] }] },
    punishingone: { size: 0.52, speed: 24, accel: 20, hp: 7, fire: [0.5, 0.9], tail: 0.5, lead: 0.9, spread: 0.85, stages: [{ below: 0.5, trait: 'flicker', speed: 27 }] },
    skiff: { size: 0.32, speed: 17, accel: 15, hp: 1, fire: [1.0, 1.8], spread: 1.4 },
    // the missile boat: stands off, and its missiles come round after you
    missileboat: { size: 0.42, speed: 17, accel: 14, hp: 5, fire: [0.9, 1.5], spread: 1.1, traits: ['holdoff', 'missile'], model: 'gunboat' },
    // a Lambda that patches up the TIEs round it: shoot it first
    repairshuttle: { size: 0.55, speed: 15, accel: 12, hp: 5, fire: [1.4, 2.2], traits: ['medic', 'holdoff'], model: 'shuttle' },
    // the ISB: a patrol TIE, an interceptor with ion cannons that hold your
    // drive down, a gunboat with missiles, a shuttle that keeps them flying
    isbpatrol: { size: 0.3, speed: 20, accel: 18, hp: 2, fire: [0.7, 1.3], model: 'tie' },
    isbenforcer: { size: 0.32, speed: 26, accel: 22, hp: 2, fire: [0.6, 1.1], tail: 0.35, trait: 'ion', model: 'interceptor' },
    isbgunboat: { size: 0.42, speed: 18, accel: 15, hp: 6, fire: [0.5, 0.9], spread: 1.1, traits: ['holdoff', 'missile'], model: 'gunboat' },
    isbshuttle: { size: 0.55, speed: 16, accel: 13, hp: 5, fire: [1.4, 2.2], traits: ['medic', 'holdoff'], model: 'shuttle' },
  },
  names: { isbpatrol: 'ISB patrol', isbenforcer: 'ISB enforcer', isbgunboat: 'ISB gunboat', isbshuttle: 'ISB support shuttle', missileboat: 'Missile boat', repairshuttle: 'Repair shuttle', tie: 'TIE fighter', interceptor: 'TIE interceptor', tieadvanced: 'TIE Advanced', slave1: 'Slave I', tiebomber: 'TIE bomber', gunboat: 'Assault gunboat', ig2000: 'IG-2000', houndstooth: 'Hound’s Tooth', punishingone: 'Punishing One', skiff: 'Pirate skiff' },
  allies: {
    xwing: { speed: 24, accel: 20, turn: 2.6, fire: [0.9, 1.6], spread: 0.15, size: 0.36, colour: [5.5, 0.6, 0.5] },
    // Gold Squadron: slow, and their bolts hit hard
    ywing: { speed: 21, accel: 16, turn: 2.0, fire: [1.3, 2.1], spread: 0.1, size: 0.38, damage: 2, colour: [5.5, 1.2, 0.4] },
    // Green Squadron: quick, a few passes and gone
    awing: { speed: 30, accel: 26, turn: 3.2, fire: [0.6, 1.1], spread: 0.2, size: 0.3, stay: 3, tour: 18, colour: [5.5, 0.6, 0.5] },
  },
  traffic: ['tie', 'interceptor', 'tiebomber', 'xwing', 'ywing', 'awing', 'shuttle', 'destroyer', 'slave1'],
  civil: ['freighter', 'transport', 'corvette'],
  convoy: { escort: 'xwing' },
  distress: { civil: 'transport', pirates: 'weequay' },
  skirmish: { faction: 'empire', escort: 'xwing', civil: 'transport' },
  pieces: ['destroyer'],
  law: 'empire', // (standing.js: whose inspectors and patrols)
  police: { faction: 'isb', units: { cop: 'isbpatrol', enforcer: 'isbenforcer', heavy: 'isbgunboat', medic: 'isbshuttle' } },
  capital: 'navy', // what the Star Destroyer launches
  capitalShip: 'destroyer', // (the model the director's capital ship jumps in as)
  leviathan: 'purrgil',
  // the Empire on the ground: stormtroopers and scout troopers (the 2017
  // game's, on its skeleton, so they walk, aim, flinch and fall on its own
  // clips as the galaxy's do: gameTroop), and a probe droid that hangs back
  // and calls more in (built: footScene.js's LOOKS)
  troops: { stormtrooper: { gun: 'rifle', figure: gameTroop('stormtrooper', 'stormtrooper') }, scout: { gun: 'blaster', figure: gameTroop('scouttrooper', 'scout') }, probe: { gun: null, figure: { built: 'probe' } } },
  squads: (n) => (n < 1 ? ['stormtrooper', 'stormtrooper', 'probe'] : n < 3 ? ['stormtrooper', 'stormtrooper', 'scout'] : ['stormtrooper', 'scout', 'scout', 'probe']),
  ahead: { tie: 3, tieadvanced: 1, tiebomber: 1, gunboat: 1 },
};

const RICKMORTY = {
  id: 'rickmorty',
  label: 'Dimension C-137',
  crews: ['cruiser'],
  factions: {
    // (and their kamikaze drones, and a medic ship that keeps the rest flying)
    federation: { role: 'hunt', weight: 2, kinds: [['patrol', 3], ['gunship', 1], ['wardrone', 1], ['fedmedic', 0.5]], laser: [0.6, 2.2, 6.5], size: [3, 5] },
    // Evil Morty's guard: a swarm of quick yellow fighters, a sharpshooter or two, his own ship at their head
    mortys: { role: 'hunt', weight: 1, kinds: [['mortyfighter', 1], ['mortysniper', 0.35]], ace: 'evilmortyship', laser: [5.5, 4.8, 0.6], size: [4, 6] },
    // the Zigerions: a simulation ship that's gone when you hit it
    zigerions: { role: 'hunt', weight: 0.7, kinds: [['zigerion', 1]], laser: [0.6, 5.5, 5.0], size: [2, 3] },
    // what the Federation cruiser launches
    fedfleet: { role: 'capital', weight: 1, kinds: [['gunship', 1], ['patrol', 2], ['wardrone', 1], ['fedmedic', 0.5]], laser: [0.6, 2.2, 6.5], size: [3, 4] },
    council: { role: 'council', weight: 1, kinds: [['councilship', 1]], laser: [0.6, 5.5, 4.2], size: [2, 4], portal: true },
    // pirates: what's after someone in distress
    bugs: { role: 'pirates', weight: 1, kinds: [['gromflomite', 1]], laser: [0.6, 2.2, 6.5], size: [2, 3] },
    // the Federation's police: who comes when you're wanted (wanted.js)
    fedpolice: { role: 'police', weight: 1, kinds: [['fedcop', 2], ['fedenforcer', 1], ['fedwarden', 1], ['fedmedic', 1]], laser: [0.6, 2.2, 6.5], size: [2, 4] },
    phoenix: { role: 'bounty', weight: 1, kinds: [['phoenixperson', 1]], laser: [6.0, 2.6, 0.8], size: [1, 1] },
    // Krombopulos Michael: he just loves killing, but he waits for you to start it
    krombopulos: { role: 'bounty', weight: 1, kinds: [['krombopulos', 1]], laser: [5.5, 0.6, 2.4], size: [1, 1] },
  },
  kinds: {
    patrol: { size: 0.34, speed: 19, accel: 17, hp: 2, fire: [0.8, 1.5] },
    councilship: { size: 0.42, speed: 24, accel: 19, hp: 3, fire: [0.6, 1.1], tail: 0.2 },
    gromflomite: { size: 0.3, speed: 18, accel: 16, hp: 1, fire: [0.9, 1.7] },
    // Phoenixperson: hurt to half, the Federation's upgrades kick in
    phoenixperson: { size: 0.42, speed: 25, accel: 21, hp: 6, fire: [0.55, 1.0], tail: 0.4, lead: 0.9, stages: [{ below: 0.5, speed: 29, accel: 25, fire: [0.35, 0.6], tail: 0.7 }] },
    gunship: { size: 0.44, speed: 17, accel: 14, hp: 4, fire: [0.45, 0.8], spread: 1.3, trait: 'holdoff' },
    mortyfighter: { size: 0.28, speed: 24, accel: 22, hp: 1, fire: [0.8, 1.4], spread: 1.2 },
    // Evil Morty: hurt to half, he falls back and his guard comes in
    evilmortyship: { size: 0.4, speed: 27, accel: 23, hp: 8, fire: [0.4, 0.75], tail: 0.5, lead: 0.95, spread: 0.7, stages: [{ below: 0.5, trait: 'holdoff', summon: 'mortys' }] },
    zigerion: { size: 0.38, speed: 21, accel: 18, hp: 3, fire: [0.8, 1.4], trait: 'flicker' },
    // Krombopulos Michael: hurt to half, he goes dark between shots
    krombopulos: { size: 0.42, speed: 25, accel: 21, hp: 7, fire: [0.45, 0.8], tail: 0.5, lead: 0.95, spread: 0.7, trait: 'quietUntilFired', stages: [{ below: 0.5, trait: 'flicker', speed: 28 }] },
    // no guns: straight at you, and it goes off
    wardrone: { size: 0.3, speed: 26, accel: 24, hp: 1, fire: [9, 9], trait: 'rammer', model: 'gromflomite' },
    fedmedic: { size: 0.44, speed: 16, accel: 13, hp: 5, fire: [1.2, 2.0], traits: ['medic', 'holdoff'], model: 'gunship' },
    mortysniper: { size: 0.28, speed: 22, accel: 20, hp: 2, fire: [1.8, 2.6], trait: 'sniper', model: 'mortyfighter' },
    // the Federation's police: patrol cruisers, enforcers with stun guns,
    // wardens with missiles (and their medic ship)
    fedcop: { size: 0.34, speed: 20, accel: 18, hp: 2, fire: [0.7, 1.3], model: 'patrol' },
    fedenforcer: { size: 0.42, speed: 25, accel: 21, hp: 3, fire: [0.6, 1.1], tail: 0.35, trait: 'ion', model: 'councilship' },
    fedwarden: { size: 0.44, speed: 17, accel: 14, hp: 6, fire: [0.5, 0.9], spread: 1.2, traits: ['holdoff', 'missile'], model: 'gunship' },
  },
  names: { fedcop: 'Federation police', fedenforcer: 'Federation enforcer', fedwarden: 'Federation warden', wardrone: 'Kamikaze drone', fedmedic: 'Federation medic ship', mortysniper: 'Morty sharpshooter', patrol: 'Federation patrol', councilship: 'Council cruiser', gromflomite: 'Gromflomite', phoenixperson: 'Phoenixperson', gunship: 'Federation gunship', mortyfighter: 'Morty fighter', evilmortyship: 'Evil Morty', zigerion: 'Zigerion ship', krombopulos: 'Krombopulos Michael' },
  allies: {
    birdperson: { speed: 22, accel: 22, turn: 3, fire: [1, 1.8], spread: 0.16, size: 0.4, colour: [0.7, 5.5, 1.2] },
    // Squanchy: close in, and every bolt counts
    squanchship: { speed: 23, accel: 21, turn: 2.8, fire: [0.7, 1.2], spread: 0.25, size: 0.36, damage: 2, colour: [6.0, 2.5, 0.5] },
    // Mr. Poopybutthole: quick and cheerful, and off again before long
    poopyship: { speed: 28, accel: 25, turn: 3.2, fire: [1.1, 1.8], spread: 0.3, size: 0.3, stay: 3, tour: 16, colour: [5.5, 1.5, 3.5] },
  },
  traffic: ['patrol', 'federation', 'gunship', 'gromflomite', 'mortyfighter', 'meeseeks', 'birdperson', 'squanchship', 'poopyship'],
  civil: ['saucer', 'hauler', 'gearship'],
  convoy: { escort: 'patrol' },
  distress: { civil: 'saucer', pirates: 'bugs' },
  skirmish: { faction: 'federation', escort: 'birdperson', civil: 'saucer' },
  pieces: ['council', 'destroyer', 'remover'],
  law: 'federation',
  police: { faction: 'fedpolice', units: { cop: 'fedcop', enforcer: 'fedenforcer', heavy: 'fedwarden', medic: 'fedmedic' } },
  capital: 'fedfleet',
  capitalShip: 'fedcruiser',
  leviathan: 'cromulon',
  // the Federation's, and from the third squad Evil Morty's guard (the cast's
  // Morty, in the guard's yellow)
  troops: { gromflomite: { gun: 'rifle' }, cop: { gun: 'coppistol' }, gazorpian: { gun: null }, mortyguard: { gun: 'laser', figure: { meshy: 'mortyclone' } } },
  squads: (n) => (n < 1 ? ['gromflomite'] : n < 2 ? ['gromflomite', 'gromflomite', 'cop'] : n < 4 ? ['gromflomite', 'cop', 'mortyguard', 'mortyguard'] : ['cop', 'gazorpian', 'mortyguard', 'mortyguard']),
  ahead: { patrol: 4, councilship: 3, gromflomite: 2, gunship: 1, mortyfighter: 3, zigerion: 1 },
};

// Albuquerque's sky: the RV grew wings, and so did everyone after it
const BREAKINGBAD = {
  id: 'breakingbad',
  label: 'Albuquerque',
  crews: ['rv'],
  factions: {
    // the DEA: black SUVs in twos and threes, Hank's own now and then
    // (and a chopper with a marksman in the door)
    dea: { role: 'hunt', weight: 3, kinds: [['suv', 1], ['deachopper', 0.35]], ace: 'suvace', laser: [0.8, 1.8, 6.2], size: [3, 5] },
    // the cartel: Tuco's lowriders, quick and wild, and a car bomb now and then
    cartel: { role: 'hunt', weight: 2, kinds: [['lowrider', 1], ['carbomb', 0.4]], laser: [6.0, 4.2, 0.6], size: [2, 4] },
    // Gus's people: box trucks with rockets, tough, that hold their range
    pollos: { role: 'capital', weight: 1, kinds: [['pollostruck', 1], ['pollosrocket', 0.5]], ace: 'gusvolvo', laser: [6.0, 1.2, 0.6], size: [2, 3] },
    // the Cousins: two Mercedes, one hunter, who never say a word
    cousins: { role: 'bounty', weight: 1, kinds: [['cousins', 1]], laser: [5.5, 5.5, 5.5], size: [1, 1] },
    // Jack's crew: pickups, after anyone with something to take
    jacks: { role: 'pirates', weight: 1, kinds: [['pickup', 1]], laser: [6.0, 2.5, 0.5], size: [2, 3] },
    // Albuquerque PD and the DEA's tactical team: who comes when you're wanted (wanted.js)
    apd: { role: 'police', weight: 1, kinds: [['apdcruiser', 2], ['deatactical', 1], ['swattruck', 1], ['apdsupport', 1]], laser: [0.8, 1.8, 6.2], size: [2, 4] },
  },
  kinds: {
    suv: { size: 0.34, speed: 19, accel: 17, hp: 2, fire: [0.8, 1.5] },
    // Hank: hurt to half, he falls back and calls in the DEA
    suvace: { size: 0.36, speed: 25, accel: 21, hp: 7, fire: [0.5, 0.9], tail: 0.4, lead: 0.9, spread: 0.85, trait: 'spotlight', stages: [{ below: 0.5, trait: 'holdoff', summon: 'dea' }] },
    lowrider: { size: 0.34, speed: 25, accel: 20, hp: 1, fire: [0.6, 1.1], tail: 0.3, spread: 1.6 },
    pollostruck: { size: 0.5, speed: 17, accel: 14, hp: 4, fire: [0.9, 1.5], trait: 'holdoff' },
    // Gus himself: he doesn't fire first, and he doesn't miss
    // Gus: hurt to half, he keeps his distance and his trucks come; the Cousins just get faster
    gusvolvo: { size: 0.36, speed: 24, accel: 20, hp: 8, fire: [0.5, 0.85], tail: 0.3, lead: 0.95, spread: 0.6, trait: 'quietUntilFired', stages: [{ below: 0.5, trait: 'holdoff', fire: [0.35, 0.6], summon: 'pollos' }] },
    cousins: { size: 0.6, speed: 25, accel: 21, hp: 9, fire: [0.5, 0.9], tail: 0.5, lead: 0.9, spread: 0.8, trait: 'quietUntilFired', stages: [{ below: 0.5, fire: [0.3, 0.55], tail: 0.85, speed: 28 }] },
    pickup: { size: 0.32, speed: 18, accel: 16, hp: 1, fire: [0.9, 1.7] },
    // Albuquerque PD's cruisers, the DEA's tactical team with tasers, a
    // SWAT truck with rockets, and a support van that keeps them going
    apdcruiser: { size: 0.34, speed: 20, accel: 18, hp: 2, fire: [0.7, 1.3], model: 'suv' },
    deatactical: { size: 0.34, speed: 25, accel: 21, hp: 3, fire: [0.6, 1.1], tail: 0.35, trait: 'ion', model: 'suv' },
    swattruck: { size: 0.5, speed: 17, accel: 14, hp: 6, fire: [0.5, 0.9], traits: ['holdoff', 'missile'], model: 'pollostruck' },
    apdsupport: { size: 0.4, speed: 16, accel: 13, hp: 4, fire: [1.4, 2.2], traits: ['medic', 'holdoff'], model: 'pestvan' },
    deachopper: { size: 0.5, speed: 18, accel: 15, hp: 4, fire: [1.6, 2.4], trait: 'sniper' },
    carbomb: { size: 0.34, speed: 27, accel: 23, hp: 1, fire: [9, 9], trait: 'rammer', model: 'lowrider' },
    pollosrocket: { size: 0.5, speed: 16, accel: 13, hp: 5, fire: [1.0, 1.6], traits: ['holdoff', 'missile'], model: 'pollostruck' },
  },
  names: { apdcruiser: 'APD cruiser', deatactical: 'DEA tactical', swattruck: 'SWAT truck', apdsupport: 'APD support van', deachopper: 'DEA chopper', carbomb: 'Car bomb', pollosrocket: 'Pollos rocket truck', suv: 'DEA SUV', suvace: 'Hank’s SUV', lowrider: 'Cartel lowrider', pollostruck: 'Pollos truck', cousins: 'The Cousins', pickup: 'Jack’s pickup', gusvolvo: 'Gus’s Volvo' },
  allies: {
    saulcaddy: { speed: 24, accel: 20, turn: 2.6, fire: [0.9, 1.6], spread: 0.15, size: 0.36, colour: [5.5, 5.0, 1.2] },
    mikesedan: { speed: 21, accel: 18, turn: 2.2, fire: [1.6, 2.4], spread: 0.05, size: 0.36, damage: 2, colour: [4.5, 3.6, 2.2] },
    // Badger and Skinny Pete: chatty, and they miss a lot
    beater: { speed: 21, accel: 17, turn: 2.3, fire: [0.6, 1.1], spread: 0.6, size: 0.36, colour: [1.2, 3.5, 6.0] },
  },
  traffic: ['suv', 'lowrider', 'beater', 'gusvolvo'],
  civil: ['pollostruck', 'madrigal', 'pestvan', 'balloon'],
  convoy: { escort: 'mikesedan' },
  distress: { civil: 'madrigal', pirates: 'jacks' },
  skirmish: { faction: 'cartel', escort: 'saulcaddy', civil: 'madrigal' },
  pieces: ['roadblock', 'destroyer'],
  law: 'dea',
  police: { faction: 'apd', units: { cop: 'apdcruiser', enforcer: 'deatactical', heavy: 'swattruck', medic: 'apdsupport' } },
  capital: 'pollos',
  capitalShip: 'madrigal', // (a Madrigal freighter jumps in, and Gus's trucks come out of it)
  leviathan: 'bear',
  // DEA agents (Hank's figure), the cartel's gunmen (Tuco's), and Jack's crew
  // (built: there's no model of them)
  troops: { dea: { gun: 'coppistol', figure: { url: '/models/albuquerque/hank.glb' } }, cartel: { gun: 'rifle', figure: { url: '/models/albuquerque/tuco.glb' } }, jackscrew: { gun: 'rifle', figure: { built: 'jackscrew' } } },
  squads: (n) => (n < 1 ? ['dea'] : n < 3 ? ['dea', 'dea', 'cartel'] : n < 4 ? ['dea', 'cartel', 'cartel', 'cartel'] : ['cartel', 'jackscrew', 'jackscrew']),
  ahead: { suv: 3, lowrider: 2, pollostruck: 1, deachopper: 1 },
};

const finish = (s) => {
  // (their speeds as tuned, at the ship's pace: ship.js's PACE)
  s.kinds = pacedAll(s.kinds);
  s.allies = pacedAll(s.allies);
  const roles = new Set(Object.values(s.factions).map((f) => f.role));
  // what the director's events need of a side
  s.has = (need) => roles.has(need) || s.pieces.includes(need) || (need === 'pirates' && Boolean(s.distress.pirates)) || (need === 'leviathan' && Boolean(s.leviathan));
  for (const f of Object.values(s.factions)) f.family = s.id; // (hunterRules.js reads it)
  return s;
};

export const SIDES = { starwars: finish(STARWARS), rickmorty: finish(RICKMORTY), breakingbad: finish(BREAKINGBAD) };
const ALL = Object.values(SIDES);
const BY_CREW = new Map(ALL.flatMap((s) => s.crews.map((c) => [c, s])));

export const sideFor = (crewId) => BY_CREW.get(crewId) ?? null;
export const sideOf = (crewId) => sideFor(crewId)?.id ?? null;

// Whose space it is where the ship is: a sector of the map that's one
// side's own (layout.js's SECTORS: the Rick and Morty sector is the Rick and
// Morty side's) has that side's hunters, traffic and goings-on, whoever's
// flying; anywhere else, the crew's own side's. sideAt(crewId, sector) → a
// side; crewAt(crewId, sector) → the crew whose side that is (the traffic
// is set by crew: traffic.js setCrew), the crew itself where it's its own
export const SECTOR_SIDES = { rickmorty: 'rickmorty' };
export const sideAt = (crewId, sector = 'main') => SIDES[SECTOR_SIDES[sector]] ?? sideFor(crewId);
export const crewAt = (crewId, sector = 'main') => {
  const side = SIDES[SECTOR_SIDES[sector]];
  return !side || sideFor(crewId) === side ? crewId : side.crews[0];
};

const sidesOf = (sideId) => (sideId ? [SIDES[sideId]].filter(Boolean) : ALL);
// the hunters' factions (hunterRules.js's shape) and kinds: one side's, or every side's (null: for another pilot's hunters, whoever they are)
export const factionsOf = (sideId = null) => Object.assign({}, ...sidesOf(sideId).map((s) => s.factions));
export const kindsOf = (sideId = null) => Object.assign({}, ...sidesOf(sideId).map((s) => s.kinds));
export const namesOf = (sideId = null) => Object.assign({}, ...sidesOf(sideId).map((s) => s.names));
export const allKinds = Object.keys(kindsOf(null));
// every side's allies (wingRules.js's shape, the colour too)
export const alliesOf = (sideId = null) => Object.assign({}, ...sidesOf(sideId).map((s) => s.allies));
export const AHEAD_OF = (side) => side?.ahead ?? {};

// a faction of the side by role ('hunt', 'bounty', 'capital', 'council', 'pirates'), or null
export function pick(side, role, rand = Math.random) {
  if (!side) return null;
  if (role === 'pirates') return side.distress.pirates ?? null;
  if (role === 'capital') return side.capital ?? null;
  const list = Object.entries(side.factions).filter(([, f]) => f.role === role).map(([id, f]) => [id, f.weight ?? 1]);
  return list.length ? weighted(list, rand) : null;
}
// who comes in a long fight
export const wingOf = (side, rand = Math.random) => weighted(Object.keys(side?.allies ?? {}).map((k) => [k, 1]), rand);
// who comes on the n-th squad on the ground
export const squadKinds = (side, n) => side?.squads(n) ?? ['gromflomite'];
