// The wars: each crew's universe at war with itself, as data (the design:
// docs/superpowers/specs/2026-10-06-fleet-war-design.md). Pure, tested.
//
// A war is two sides fighting over a line of seven sectors out in deep
// space, from one side's home to the other's (war.js keeps where the front
// is; battle.js fights each battle there; front.js puts it on the map):
// - Star Wars: the Rebel Alliance against the Galactic Empire, over the
//   systems the galaxy's holotable shows (so it can show who holds them)
// - Rick and Morty: the Council of Ricks against the Galactic Federation
// - Breaking Bad: Gus Fring's empire against Don Eladio's cartel
//
// A side: { id, name, short, colour (css), laser and turbo ([r, g, b], hot
// enough to bloom: its fighters' bolts and its capital ships' turbolasers),
// fighters: [{ kind, role: 'fighter' | 'interceptor' | 'bomber', weight }],
// capitals: [{ kind, role: 'flagship' | 'escort', size (map units long),
// hull }] }.
// FIGHTERS: how each fighter flies and fights (map units, seconds, radians).
// SUBSYSTEMS: a flagship's objectives, at points of its hull (shares of its
// length, centred on its box, nose +z, +y up), each with the phase it falls
// in (Battlefront's Fleet Assault: the shield generators, the bridge, the
// reactor). TURRETS: where its batteries are. HULLS: its shape for flying
// round, as spheres along its length ([z, radius], shares of its length;
// the galaxy's set pieces fly round the same ones).

import { paced } from './ship';
import { POSITIONS } from './layout';
import { SPREAD } from './scale';

const rebels = {
  id: 'rebels',
  name: 'Rebel Alliance',
  short: 'Rebels',
  colour: '#ff6b4a',
  laser: [5.8, 0.75, 0.55],
  turbo: [6.5, 1.1, 0.6],
  fighters: [
    { kind: 'xwing', role: 'fighter', weight: 3 },
    { kind: 'awing', role: 'interceptor', weight: 2 },
    { kind: 'ywing', role: 'bomber', weight: 1.5 },
    { kind: 'bwing', role: 'bomber', weight: 1 },
  ],
  capitals: [
    { kind: 'moncal', role: 'flagship', size: 29, hull: 600 },
    { kind: 'nebulon', role: 'escort', size: 7.5, hull: 160 },
    { kind: 'corvette', role: 'escort', size: 3.6, hull: 80 },
    { kind: 'corvette', role: 'escort', size: 3.6, hull: 80 },
  ],
};

const empire = {
  id: 'empire',
  name: 'Galactic Empire',
  short: 'Empire',
  colour: '#62e08a',
  laser: [0.5, 5.5, 0.9],
  turbo: [0.7, 6.5, 1.2],
  fighters: [
    { kind: 'tie', role: 'fighter', weight: 4 },
    { kind: 'interceptor', role: 'interceptor', weight: 2 },
    { kind: 'tiebomber', role: 'bomber', weight: 1.5 },
  ],
  capitals: [
    { kind: 'destroyer', role: 'flagship', size: 38, hull: 700 },
    { kind: 'lightcruiser', role: 'escort', size: 10, hull: 200 },
    { kind: 'gozanti', role: 'escort', size: 6, hull: 110 },
  ],
};

const council = {
  id: 'council',
  name: 'The Council of Ricks',
  short: 'Council',
  colour: '#7cf0c8',
  laser: [0.6, 5.5, 4.2],
  turbo: [0.8, 6.5, 5],
  fighters: [
    { kind: 'councilship', role: 'fighter', weight: 3 },
    { kind: 'meeseeks', role: 'interceptor', weight: 1.5 },
    { kind: 'gearship', role: 'bomber', weight: 1.2 },
  ],
  capitals: [
    { kind: 'councildread', role: 'flagship', size: 30, hull: 620 },
    { kind: 'gearship', role: 'escort', size: 7, hull: 150 },
    { kind: 'saucer', role: 'escort', size: 4, hull: 90 },
  ],
};

const federation = {
  id: 'federation',
  name: 'The Galactic Federation',
  short: 'Federation',
  colour: '#6fa8ff',
  laser: [0.6, 2.2, 6.5],
  turbo: [0.8, 2.8, 7],
  fighters: [
    { kind: 'patrol', role: 'fighter', weight: 3 },
    { kind: 'gromflomite', role: 'interceptor', weight: 2 },
    { kind: 'hauler', role: 'bomber', weight: 1.2 },
  ],
  capitals: [
    { kind: 'fedbattleship', role: 'flagship', size: 34, hull: 680 },
    { kind: 'federation', role: 'escort', size: 8, hull: 170 },
    { kind: 'hauler', role: 'escort', size: 4.5, hull: 90 },
  ],
};

const gus = {
  id: 'gus',
  name: 'Gus Fring’s empire',
  short: 'Los Pollos',
  colour: '#ffcc33',
  laser: [6.0, 4.6, 0.8],
  turbo: [6.5, 5.2, 1],
  fighters: [
    { kind: 'mikesedan', role: 'fighter', weight: 3 },
    { kind: 'saulcaddy', role: 'interceptor', weight: 1.5 },
    { kind: 'pollostruck', role: 'bomber', weight: 1.5 },
  ],
  capitals: [
    { kind: 'superlab', role: 'flagship', size: 30, hull: 620 },
    { kind: 'madrigal', role: 'escort', size: 7, hull: 150 },
    { kind: 'pestvan', role: 'escort', size: 3.6, hull: 80 },
  ],
};

const cartel = {
  id: 'cartel',
  name: 'Don Eladio’s cartel',
  short: 'Cartel',
  colour: '#ff7a3d',
  laser: [6.0, 2.5, 0.5],
  turbo: [6.6, 2.8, 0.6],
  fighters: [
    { kind: 'lowrider', role: 'fighter', weight: 3 },
    { kind: 'cousins', role: 'interceptor', weight: 1 },
    { kind: 'pickup', role: 'bomber', weight: 1.5 },
  ],
  capitals: [
    { kind: 'hacienda', role: 'flagship', size: 32, hull: 650 },
    { kind: 'pollostruck', role: 'escort', size: 5, hull: 110 },
    { kind: 'pickup', role: 'escort', size: 3.6, hull: 70 },
  ],
};

// seven sectors in a line from `a` to `b`, named in order from the first
// side's home to the second's. The numbers are where the lines were before
// the spread (scale.js's SPREAD), beside their planets; the line moves as far
// as its planet, `by`, moved (the planet's place now, less where it
// was: x and z by SPREAD, its height twice what it was, as the spread to
// four made it and the spread to six left it: layout.js's HEIGHT), so a war
// is still fought round its own world and keeps its length
const moved = (id, p) => {
  const [x, y, z] = POSITIONS[id];
  return [p[0] + x - x / SPREAD, p[1] + y - y / 2, p[2] + z - z / SPREAD];
};
const line = (a, b, names, by) => {
  const [from, to] = [moved(by, a), moved(by, b)];
  return names.map(([id, name], i) => {
    const k = i / (names.length - 1);
    return { id, name, at: from.map((v, j) => Math.round(v + (to[j] - v) * k)) };
  });
};

export const WARS = {
  starwars: {
    id: 'starwars',
    name: 'The Galactic Civil War',
    ready: false, // (fought in the galaxy far, far away, at its own planets: galaxy/gcw.js)
    galaxy: '/galaxy',
    sides: [rebels, empire],
    sectors: line(
      [-5200, 140, -4000],
      [-3600, 140, -4000],
      [
        ['yavin', 'Yavin'],
        ['hoth', 'Hoth'],
        ['bespin', 'Bespin'],
        ['endor', 'Endor'],
        ['scarif', 'Scarif'],
        ['mustafar', 'Mustafar'],
        ['coruscant', 'Coruscant'],
      ],
      'starwars',
    ),
    battleName: (s) => `Battle of ${s.name}`,
  },
  rickmorty: {
    id: 'rickmorty',
    name: 'The War for the Multiverse',
    ready: true,
    sides: [council, federation],
    // in the main map's deep space (the Citadel and the show's worlds are
    // through the portal, in a sector of their own: layout.js), from the
    // Council's picket out in the dark to the sky over Earth C-137 (the Rick
    // and Morty world), which the Federation took, as it did in the show
    sectors: line(
      [1216, -135, -4464],
      [-288, -135, -3916],
      [
        ['picket', 'The Council’s picket'],
        ['blips', 'Blips and Chitz'],
        ['anatomy', 'Anatomy Park'],
        ['froopy', 'Froopyland'],
        ['unity', 'Unity’s world'],
        ['gromflom', 'Gromflom Prime'],
        ['c137', 'Earth C-137'],
      ],
      'rickmorty',
    ),
    battleName: (s) => `The fight over ${s.name}`,
  },
  breakingbad: {
    id: 'breakingbad',
    name: 'The Cartel War',
    ready: true,
    sides: [gus, cartel],
    // at its real places on the map: from Los Pollos just off Albuquerque
    // (the Breaking Bad world) out, away from home, past the border to Don
    // Eladio's hacienda, clear of the Twins and the Maw
    sectors: line(
      [4250, 235, -700],
      [5800, 120, 300],
      [
        ['pollos', 'Los Pollos Hermanos'],
        ['superlab', 'The Superlab'],
        ['laundry', 'Lavandería Brillante'],
        ['madrigal', 'Madrigal'],
        ['border', 'The Border'],
        ['juarez', 'Ciudad Juárez'],
        ['hacienda', 'Don Eladio’s hacienda'],
      ],
      'breakingbad',
    ),
    battleName: (s) => `The showdown at ${s.name}`,
  },
};

export const warFor = (sideId) => (sideId && Object.hasOwn(WARS, sideId) ? WARS[sideId] : null);

// How each fighter flies and fights: size (map units), speed (its top, in
// the fight), accel, turn (radians a second at its top speed), hp (bolts it
// takes), burst ([seconds between shots in a burst, seconds' rest after
// three]), range (how far it opens fire), cone (radians: how near its nose
// must be), damage (a bolt's), and for a bomber its torpedoes (seconds
// between runs' shots: `reload`)
// (at the ship's pace: ship.js's PACE)
const F = (o) => paced({ accel: o.speed * 0.8, burst: [0.12, 0.7], range: 14, cone: 0.1, damage: 1, ...o });
export const FIGHTERS = {
  // Star Wars
  xwing: F({ size: 0.36, speed: 20, turn: 2.3, hp: 5 }),
  awing: F({ size: 0.3, speed: 25, turn: 2.9, hp: 4, burst: [0.1, 0.6] }),
  ywing: F({ size: 0.42, speed: 15, turn: 1.7, hp: 9, reload: 1.2 }),
  bwing: F({ size: 0.5, speed: 16, turn: 1.8, hp: 10, reload: 1.1 }),
  tie: F({ size: 0.3, speed: 21, turn: 2.6, hp: 5 }),
  interceptor: F({ size: 0.32, speed: 25, turn: 3, hp: 4, burst: [0.1, 0.55] }),
  tiebomber: F({ size: 0.38, speed: 15, turn: 1.7, hp: 9, reload: 1.2 }),
  uwing: F({ size: 0.5, speed: 17, turn: 1.9, hp: 8 }),
  tieadvanced: F({ size: 0.32, speed: 23, turn: 3, hp: 8, burst: [0.1, 0.5] }),
  tiedefender: F({ size: 0.34, speed: 26, turn: 3.1, hp: 10, burst: [0.09, 0.45] }), // (the Remnant's ace's: galaxy/battlePlans.js)
  // (and the galaxy's other wars': the Clone Wars' droids and clones, the
  // Hutts' Weequay skiffs, the Ghost with Hera at the controls)
  vulture: F({ size: 0.3, speed: 21, turn: 2.6, hp: 3, reload: 1.4 }),
  trifighter: F({ size: 0.32, speed: 25, turn: 2.9, hp: 5, burst: [0.1, 0.55] }),
  arc170: F({ size: 0.46, speed: 18, turn: 2.1, hp: 8, reload: 1.3 }),
  delta7: F({ size: 0.3, speed: 25, turn: 3, hp: 5, burst: [0.1, 0.55] }),
  // (Starfighter Assault's kits the rows above lack, galaxy/surface/missions/
  // starfighterKits.js: each as the row whose game handling it shares,
  // src/data/bf2017/air.json: the V-wing the A-wing's, 115 m/s and its turn
  // rates; the Hyena the Y-wing's, 90 m/s; the T-65 the X-wing's own)
  xwing65: F({ size: 0.36, speed: 20, turn: 2.3, hp: 5 }),
  vwing: F({ size: 0.3, speed: 25, turn: 2.9, hp: 4, burst: [0.1, 0.6] }),
  hyena: F({ size: 0.4, speed: 15, turn: 1.7, hp: 7, reload: 1.2 }),
  skiff: F({ size: 0.4, speed: 18, turn: 2.2, hp: 5, reload: 1.5 }),
  ghost: F({ size: 0.8, speed: 17, turn: 1.8, hp: 14, burst: [0.1, 0.5] }),
  // Rick and Morty
  councilship: F({ size: 0.42, speed: 21, turn: 2.4, hp: 6 }),
  meeseeks: F({ size: 0.34, speed: 24, turn: 2.9, hp: 4, burst: [0.1, 0.6] }),
  gearship: F({ size: 0.5, speed: 15, turn: 1.7, hp: 9, reload: 1.2 }),
  patrol: F({ size: 0.34, speed: 20, turn: 2.4, hp: 5 }),
  gromflomite: F({ size: 0.3, speed: 24, turn: 2.9, hp: 4, burst: [0.1, 0.6] }),
  hauler: F({ size: 0.5, speed: 14, turn: 1.6, hp: 10, reload: 1.2 }),
  // Breaking Bad
  mikesedan: F({ size: 0.36, speed: 20, turn: 2.3, hp: 6 }),
  saulcaddy: F({ size: 0.36, speed: 24, turn: 2.8, hp: 5, burst: [0.1, 0.6] }),
  pollostruck: F({ size: 0.5, speed: 15, turn: 1.6, hp: 10, reload: 1.2 }),
  lowrider: F({ size: 0.34, speed: 22, turn: 2.6, hp: 5 }),
  cousins: F({ size: 0.6, speed: 24, turn: 2.6, hp: 8, burst: [0.1, 0.5] }),
  pickup: F({ size: 0.32, speed: 15, turn: 1.7, hp: 8, reload: 1.2 }),
};

// what each is called on the targeting bracket
export const NAMES = {
  xwing: 'X-wing',
  awing: 'A-wing',
  ywing: 'Y-wing',
  bwing: 'B-wing',
  tie: 'TIE fighter',
  interceptor: 'TIE interceptor',
  tiebomber: 'TIE bomber',
  uwing: 'U-wing',
  tieadvanced: 'TIE Advanced',
  tiedefender: 'TIE Defender',
  vulture: 'Vulture droid',
  trifighter: 'Droid tri-fighter',
  arc170: 'ARC-170',
  delta7: 'Jedi starfighter',
  xwing65: 'X-wing',
  vwing: 'V-wing',
  hyena: 'Hyena bomber',
  skiff: 'Weequay skiff',
  ghost: 'The Ghost',
  councilship: 'Council cruiser',
  meeseeks: 'Meeseeks ship',
  gearship: 'Gear ship',
  patrol: 'Federation patrol',
  gromflomite: 'Gromflomite',
  hauler: 'Federation hauler',
  mikesedan: 'Mike’s sedan',
  saulcaddy: 'Saul’s Cadillac',
  pollostruck: 'Pollos truck',
  lowrider: 'Cartel lowrider',
  cousins: 'The Cousins',
  pickup: 'Cartel pickup',
  shieldgen: 'Shield generator',
  bridge: 'Bridge',
  reactor: 'Reactor',
  turret: 'Turbolaser battery',
  transport: 'GR-75 transport',
};

// a flagship's objectives: two shield generators, the bridge, the reactor
// (hp: what each takes, in damage as battle.js counts it)
const flagship = (gens, bridge, reactor) => [
  { id: 'gen-port', kind: 'shieldgen', phase: 1, at: gens[0], r: 0.03, hp: 120 },
  { id: 'gen-star', kind: 'shieldgen', phase: 1, at: gens[1], r: 0.03, hp: 120 },
  { id: 'bridge', kind: 'bridge', phase: 2, at: bridge, r: 0.035, hp: 200 },
  { id: 'reactor', kind: 'reactor', phase: 3, at: reactor, r: 0.045, hp: 260 },
];
export const SUBSYSTEMS = {
  // the Star Destroyer: the two domes on the bridge tower, the bridge in its
  // face, the reactor's bulb under the hull
  destroyer: flagship(
    [
      [-0.05, 0.21, -0.36],
      [0.05, 0.21, -0.36],
    ],
    [0, 0.17, -0.31],
    [0, -0.12, -0.16],
  ),
  // the Mon Calamari cruiser: projectors on its back toward the stern, the
  // bridge up front, the reactor among the engines
  moncal: flagship(
    [
      [-0.06, 0.13, -0.24],
      [0.06, 0.13, -0.24],
    ],
    [0, 0.09, 0.36],
    [0, 0.02, -0.44],
  ),
  // the Executor: the domes on its bridge tower, at the stern, the bridge in
  // the tower's face, the reactor under the middle of its hull
  executor: flagship(
    [
      [-0.018, 0.075, -0.415],
      [0.018, 0.075, -0.415],
    ],
    [0, 0.06, -0.395],
    [0, -0.035, -0.12],
  ),
  // the Interdictor: its shield generators the two gravity-well domes on its
  // back nearest the bridge tower, the bridge in the tower's face, the
  // reactor's bulb under the hull (an interdiction's objectives: battles.js)
  interdictor: flagship(
    [
      [-0.12, 0.11, -0.12],
      [0.12, 0.11, -0.12],
    ],
    [0, 0.17, -0.31],
    [0, -0.12, -0.16],
  ),
  // the Venator: the domes on its two bridge towers, the bridge in the
  // starboard tower's face, the reactor under its hull amidships
  venator: flagship(
    [
      [-0.07, 0.15, -0.34],
      [0.07, 0.15, -0.34],
    ],
    [0.06, 0.13, -0.27],
    [0, -0.11, -0.1],
  ),
  // the Providence (the Invisible Hand): its sensor domes either side of the
  // bridge tower aft, the bridge at the tower's face, the reactor astern
  providence: flagship(
    [
      [-0.06, 0.13, -0.3],
      [0.06, 0.13, -0.3],
    ],
    [0, 0.12, -0.22],
    [0, -0.1, -0.3],
  ),
  // the Lucrehulk: its shield generators out on the ring either side, the
  // bridge atop the core sphere, the reactor under it
  lucrehulk: flagship(
    [
      [-0.33, 0.04, 0],
      [0.33, 0.04, 0],
    ],
    [0, 0.25, 0.04],
    [0, -0.25, 0],
  ),
  // a Hutt kajidic's Gozanti: its shield projectors aft either side, the
  // bridge in the nose, the reactor under the engines
  gozanti: flagship(
    [
      [-0.15, 0.11, -0.26],
      [0.15, 0.11, -0.26],
    ],
    [0, 0.1, 0.43],
    [0, -0.15, -0.36],
  ),
  // the Council's dreadnought (scripts/meshy-war.mjs, in the Citadel's look):
  // its two teal shield domes either side of the spire, the glass dome bridge
  // up front, the reactor under the engines (its spire stands tall of the
  // deck, so the deck's below the middle of its box)
  councildread: flagship(
    [
      [-0.12, -0.06, -0.16],
      [0.12, -0.06, -0.16],
    ],
    [0, -0.06, 0.19],
    [0, -0.14, -0.38],
  ),
  // the Federation's battleship, as the show drew it: its shield generators
  // in the engine pods either side, the bridge at the glass along the top up
  // front, the reactor atop the great dome at its back
  fedbattleship: flagship(
    [
      [-0.31, -0.05, 0.14],
      [0.31, -0.05, 0.14],
    ],
    [0, 0.19, 0.17],
    [0, 0.28, -0.3],
  ),
  // Gus's superlab barge (scripts/meshy-war.mjs): its shield generators the
  // two domes on the deckhouse's roof, fore and aft, the bridge at the
  // deckhouse's front, the reactor in the stern among the thrusters
  superlab: flagship(
    [
      [0, 0.11, 0.215],
      [0, 0.11, -0.205],
    ],
    [0, 0.08, 0.38],
    [0, -0.03, -0.5],
  ),
  // Don Eladio's flying hacienda, its thrusters in the rock either side:
  // its shield generators in the domes of the two back towers, the bridge
  // in the main house over the front door, the reactor at the foot of the
  // rock it stands on
  hacienda: flagship(
    [
      [-0.37, 0.34, -0.29],
      [0.37, 0.34, -0.29],
    ],
    [0, 0.28, 0.34],
    [0, -0.37, 0],
  ),
};

// batteries down the flanks and along the top, as shares of the length
const flanks = (w, h, zs) => zs.flatMap((z) => [[-w, h, z], [w, h, z]]);
export const TURRETS = {
  destroyer: [...flanks(0.17, 0.05, [-0.3, -0.18, -0.06, 0.06, 0.18]), [0, 0.12, -0.2], [0, 0.08, 0]],
  moncal: [...flanks(0.09, 0.04, [-0.3, -0.1, 0.1, 0.28])],
  executor: [...flanks(0.07, 0.02, [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36]), [0, 0.04, -0.3], [0, 0.03, 0]],
  interdictor: [...flanks(0.17, 0.05, [-0.25, 0, 0.2])],
  hammerhead: [...flanks(0.08, 0.05, [-0.2, 0.2])],
  transport: [[0, 0.1, 0.2]],
  nebulon: [...flanks(0.06, 0.03, [-0.3, 0.3])],
  corvette: [...flanks(0.08, 0.05, [-0.2, 0.2])],
  lightcruiser: [...flanks(0.1, 0.05, [-0.2, 0.1])],
  gozanti: [...flanks(0.1, 0.06, [-0.15, 0.15])],
  venator: [...flanks(0.16, 0.05, [-0.3, -0.12, 0.06, 0.22]), [0, 0.1, -0.2]],
  acclamator: [...flanks(0.2, 0.06, [-0.2, 0.05])],
  munificent: [...flanks(0.06, 0.1, [-0.25, 0.25])],
  providence: [...flanks(0.09, 0.06, [-0.25, 0, 0.25])],
  lucrehulk: [...flanks(0.4, 0.05, [-0.2, 0.2]), [0, 0.06, 0.42], [0, 0.06, -0.42]],
  councildread: [...flanks(0.1, -0.08, [-0.25, -0.05, 0.15])],
  fedbattleship: [...flanks(0.28, 0.12, [-0.2, 0.05]), [0, 0.28, -0.15]],
  gearship: [...flanks(0.12, 0.05, [-0.15, 0.15])],
  saucer: [...flanks(0.2, 0.05, [0])],
  federation: [...flanks(0.12, 0.05, [-0.15, 0.15])],
  hauler: [...flanks(0.12, 0.05, [-0.1, 0.1])],
  superlab: [...flanks(0.125, 0.035, [-0.2, 0.02, 0.24]), [0, 0.095, 0]],
  madrigal: [...flanks(0.12, 0.05, [-0.15, 0.15])],
  pestvan: [...flanks(0.12, 0.05, [-0.1, 0.1])],
  hacienda: [...flanks(0.43, 0.33, [-0.33, 0.33]), ...flanks(0.38, 0.3, [0])],
  pollostruck: [...flanks(0.12, 0.05, [-0.1, 0.1])],
  pickup: [...flanks(0.12, 0.05, [-0.1, 0.1])],
};

// thin enough that the space beside a hull is open
export const HULLS = {
  destroyer: [[-0.4, 0.09], [-0.24, 0.085], [-0.08, 0.075], [0.08, 0.06], [0.24, 0.045], [0.38, 0.03]],
  executor: [[-0.45, 0.04], [-0.36, 0.035], [-0.27, 0.032], [-0.18, 0.03], [-0.09, 0.028], [0, 0.026], [0.09, 0.024], [0.18, 0.021], [0.27, 0.018], [0.36, 0.014], [0.44, 0.01]],
  venator: [[-0.4, 0.085], [-0.22, 0.08], [-0.04, 0.07], [0.14, 0.055], [0.32, 0.035]],
  acclamator: [[-0.36, 0.11], [-0.12, 0.1], [0.12, 0.08], [0.34, 0.05]],
  munificent: [[-0.36, 0.08], [-0.12, 0.08], [0.12, 0.08], [0.36, 0.1]],
  providence: [[-0.38, 0.09], [-0.14, 0.09], [0.1, 0.08], [0.34, 0.06]],
  lucrehulk: [[-0.38, 0.1], [-0.15, 0.18], [0, 0.22], [0.15, 0.18], [0.38, 0.1]],
  moncal: [[-0.38, 0.12], [-0.14, 0.13], [0.1, 0.12], [0.34, 0.09]],
  nebulon: [[-0.38, 0.07], [-0.1, 0.05], [0.18, 0.08], [0.38, 0.07]],
  corvette: [[-0.36, 0.1], [-0.1, 0.06], [0.14, 0.06], [0.36, 0.12]],
  hammerhead: [[-0.36, 0.08], [-0.06, 0.05], [0.24, 0.05], [0.42, 0.1]],
  interdictor: [[-0.4, 0.09], [-0.2, 0.085], [0, 0.075], [0.2, 0.055], [0.38, 0.03]],
  transport: [[-0.3, 0.12], [0, 0.13], [0.3, 0.11]],
  lightcruiser: [[-0.36, 0.1], [-0.12, 0.09], [0.12, 0.07], [0.36, 0.05]],
  gozanti: [[-0.36, 0.12], [-0.12, 0.13], [0.12, 0.12], [0.36, 0.1]],
  councildread: [[-0.38, 0.12], [-0.15, 0.13], [0.1, 0.08], [0.32, 0.04]],
  fedbattleship: [[-0.27, 0.26], [0.02, 0.2], [0.22, 0.18], [0.42, 0.07]],
  gearship: [[-0.3, 0.16], [0, 0.18], [0.3, 0.16]],
  saucer: [[-0.2, 0.3], [0.2, 0.3]],
  federation: [[-0.36, 0.12], [-0.12, 0.12], [0.12, 0.11], [0.36, 0.08]],
  hauler: [[-0.34, 0.16], [0, 0.17], [0.34, 0.15]],
  superlab: [[-0.42, 0.09], [-0.27, 0.11], [-0.09, 0.11], [0.09, 0.11], [0.27, 0.1], [0.42, 0.08]],
  madrigal: [[-0.34, 0.15], [0, 0.16], [0.34, 0.14]],
  pestvan: [[-0.34, 0.16], [0, 0.17], [0.34, 0.15]],
  hacienda: [[-0.18, 0.23], [0, 0.3], [0.18, 0.23]],
  pollostruck: [[-0.34, 0.16], [0, 0.17], [0.34, 0.15]],
  pickup: [[-0.34, 0.16], [0, 0.17], [0.34, 0.15]],
};
