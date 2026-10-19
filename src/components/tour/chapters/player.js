import { ABOUT } from '../../guide/abouts';
import { WORLDS, WORLD_MB } from '../../worlds/worlds';
import { ACHIEVEMENTS } from '../../Achievements';
import { worldStop } from './shared';

// The player's tour: what there is to play, in about seven minutes. The
// ship (the map's own basics, briefs.js's '/universe/fly'), the galaxy, the
// worlds, the games, playing together, the checklist and the colours.
// Chapter 1 is the shell (shared.js's SHELL_STOPS); these follow, on the
// map, and then the tour walks into eight of the worlds (WALKED, each a
// chapter marked `world`): it waits for each, its download gate included,
// so a phone takes the whole tour too; a world kept light is toured as it
// is. The rest are offered from their cards (Go there).

// Star Wars' worlds are the galaxy's chapter; every other world is a card in
// the worlds chapter, in the map's order. Each card is the guide's line on
// it (guide/abouts.js), so a world added to the map has its card once it
// has its basics.
const starWars = (w) => w.from === 'Star Wars';
// each world's row in the checklist (src/data/todo.js), where it has one
const ROW = {
  '/galaxy': 'galaxy',
  '/deathstar': 'deathstar',
  '/music': 'music',
  '/middle-earth': 'middle-earth',
  '/cybertron': 'cybertron',
  '/avengers': 'avengers',
  '/albuquerque': 'albuquerque',
  '/scranton': 'scranton',
  '/c-137': 'c-137',
  '/dot-matrix': 'dot-matrix',
  '/dot-matrix/64': 'mario-tribute',
  '/dot-matrix/minecraft': 'minecraft-tribute',
  '/earth': 'earth',
  '/caribbean': 'dead-mans-tide',
  '/invincible': 'invincible',
};
const card = (w, go) => worldStop(w, ABOUT[w.to], WORLD_MB[w.to], go, ROW[w.to]);
export const worldCards = () => WORLDS.filter((w) => !starWars(w)).map((w) => card(w));
const galaxyCards = () => WORLDS.filter(starWars).map((w) => card(w, w.to === '/galaxy' ? 'Fly to the galaxy' : 'Go there'));

// "Over 240": the count rounded down to the ten below it
const achievements = Math.floor((Object.keys(ACHIEVEMENTS).length - 1) / 10) * 10;

// The worlds the tour walks into, each one card, lit round the thing named
// where the world marks one (data-tour)
const walk = (id, path, title, stop) => ({ id: `walk-${id}`, title, path, world: true, stops: [{ id: `walk-${id}-stop`, ...stop }] });
export const WALKED = [
  walk('galaxy', '/galaxy/hoth', 'A galaxy far, far away', {
    at: 'galaxy-panel',
    wait: true, // (the world's own panel or HUD mounts after the page)
    title: 'Twenty-four systems, three wars',
    text: 'Jump from Tatooine to Hoth to Endor (J jumps, M is the holotable). Swear to a side and your battles count for it. Each system has a briefing; land and walk it as Luke, Leia, Han or Boba. Hoth lands in the 2017 game itself.',
  }),
  walk('avengers', '/avengers', 'Avengers HQ', {
    title: 'The compound',
    text: 'You’re Spider-Man: swing, zip, perch. Each building is a game, most of them for an Infinity Stone, and the Space Stone opens a portal to Titan. Twelve backpacks and a ring course are hidden round the grounds.',
  }),
  walk('middleearth', '/middle-earth', 'Middle-earth', {
    at: 'me-map',
    wait: true, // (the world's own panel or HUD mounts after the page)
    title: 'The road to Mount Doom',
    text: 'A map of chapters from Hobbiton to Doom. Every stop has a walk as Frodo, a co-op kitchen with a room code for a friend, and a side game. Wax seals mark the ones you’ve won.',
  }),
  walk('scranton', '/scranton', 'Scranton', {
    title: 'A week at Dunder Mifflin',
    text: 'Seven jobs as Jim: reception, the stapler in Jell-O, the chili, paper toss, the fire drill, a Dundie. Find the eggs round the office and the awards board fills up.',
  }),
  walk('invincible', '/invincible', 'Invincible', {
    title: 'Six kilometres of city',
    text: 'Fly it as Mark: Dad’s ten rings, eight hidden title cards, rescues, the Flaxan portal, the airliner, and up through the air to the Moon and Mars.',
  }),
  walk('c137', '/c-137', 'Dimension C-137', {
    title: 'The portal gun',
    text: 'The Smiths’ street as Morty, with Rick’s cruiser outside. The dial has thirty-six destinations, each with a micro-quest, and the games are Portal Panic, Total Rickall, the Meeseeks box and Roy.',
  }),
  walk('albuquerque', '/albuquerque', 'Albuquerque', {
    at: 'hud',
    wait: true, // (the world's own panel or HUD mounts after the page)
    title: 'Walt’s Aztek',
    text: 'Drive it (handbrake drifts), make deliveries with Hank’s SUV on your tail, cook to order in Metherria. Places unlock as the career grows. Twelve Blue Sky crystals are out in the desert.',
  }),
  walk('dotmatrix', '/dot-matrix', 'Dot Matrix', {
    at: 'cartridges',
    wait: true, // (the world's own panel or HUD mounts after the page)
    title: 'The games',
    text: 'An island of cartridges, each a real project of mine, and coins to collect. The giant Game Boy, the N64 and the crafting table are doors: Super Mario 64 and Minecraft are through them.',
  }),
];

export const PLAYER = [
  {
    id: 'flying',
    title: 'Flying',
    path: '/universe',
    brief: '/universe/fly',
  },
  {
    id: 'galaxy',
    title: 'The galaxy',
    path: '/universe',
    stops: galaxyCards(),
  },
  {
    id: 'worlds',
    title: 'The worlds',
    path: '/universe',
    stops: [
      {
        id: 'worlds-hello',
        title: 'Fourteen more worlds',
        text: 'Each is its own game. The tour walks into eight of them next; Go there leaves it for any, and when you’re back, the guide carries on where you left off.',
      },
      ...worldCards(),
    ],
  },
  ...WALKED,
  {
    id: 'games',
    title: 'The games',
    path: '/universe',
    stops: [
      {
        id: 'games',
        title: 'Games all over',
        text: 'The Game Boy on the Home page has three. Dot Matrix has a giant one, Invincible a boss fight, C-137 a dimension of them.',
        actions: [{ label: 'Fly to Dot Matrix', to: '/dot-matrix' }],
      },
    ],
  },
  {
    id: 'together',
    title: 'Together',
    path: '/universe',
    stops: [
      {
        id: 'together',
        title: 'Better with friends',
        text: 'Multiplayer, bottom left, puts you in the universe with whoever else is here, in their own ships and paint. No account: pick a name and you’re in.',
        todo: 'go-online',
      },
      {
        id: 'together-play',
        title: 'Things to do together',
        text: 'Bring down the Citadel of Ricks together, cook in Middle-earth’s kitchens with a friend, or pick a side in the galaxy’s wars.',
        todo: 'shire-kitchen',
      },
    ],
  },
  {
    id: 'checklist',
    title: 'The checklist',
    path: '/universe',
    stops: [
      {
        id: 'checklist',
        at: 'guide',
        title: 'The checklist',
        text: ({ touch } = {}) => `The guide’s checklist lists what there is and ticks off what you’ve done; a row’s Show me takes you to it. ${touch ? 'Tap the ? button' : 'Try ? now'}.`,
        release: ['?'],
      },
      {
        id: 'achievements',
        title: `Over ${achievements} achievements`,
        text: 'Most are secrets, and many unlock something: paint or a part for your ship in the hangar, or a colour for the site.',
        actions: [{ label: 'See yours', to: '/terminal' }],
        todo: 'terminal-achievements',
      },
    ],
  },
  {
    id: 'colours',
    title: 'Colours and scripts',
    path: '/universe',
    stops: [
      {
        id: 'colours-fans',
        title: 'Colours to find',
        todo: 'site-colours',
        text: 'Each company I’ve worked at has its colours. Secrets unlock fan colours too: the Shire, Heisenberg, Optimus, the Black Pearl.',
      },
      {
        id: 'colours-scripts',
        title: 'And scripts to read',
        text: 'Some change the letters too: the site in Aurebesh, Cybertronian or dwarf runes. Read all three and you’re a Polyglot.',
      },
    ],
  },
  {
    id: 'player-end',
    title: 'That’s the tour',
    path: null,
    stops: [
      {
        id: 'player-end',
        title: 'Go and play',
        text: 'Fly somewhere and land. The guide’s checklist keeps what’s left, and the hiring tour shows the work behind the site.',
        actions: [{ label: 'Take the hiring tour', tour: 'recruiter' }],
      },
    ],
  },
];
