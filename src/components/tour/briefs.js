// Each world's basics: the tour's cards (Tour.jsx) the first time you arrive,
// before you're dropped in (brief.js decides when). What the place is, how
// to move, how to do things, what to go for, and where the rest is. Keyed as
// the guide is (guide/routes); the guide (guide/pages.js) has every control
// and tip, so this keeps to the few you need in the first minute.
//
// A stop is { id, title, text, keys, touch, at }: `keys` and `touch` are
// rows as the guide writes them ([keys, what they do]), the keyboard's or a
// phone's, whichever this device is; `at` lights something on the page
// (data-tour), and a card in the middle where it isn't showing.

import { ABOUT } from '../guide/abouts';
import { CYBERTRON_TOUCH, cybertronRows } from '../guide/cybertron';
import { HOGWARTS_KEYS, HOGWARTS_WALK } from '../guide/hogwarts';

const help = (where) => ({
  id: 'help',
  at: 'guide',
  title: 'The rest is under ?',
  text: `Every control and tip for ${where} is in the guide: press ? (or tap the button) any time. Esc gets you out of most things.`,
});

// the walking every 3D place on foot shares (guide/pages.js's WALK)
const WALK = [
  ['W A S D / ← ↑ ↓ →', 'Walk'],
  ['Shift', 'Run'],
  ['Drag', 'Look round'],
];
const WALK_TOUCH = [
  ['Stick', 'Walk (push it all the way to run)'],
  ['Swipe', 'Look round'],
];

export const BRIEFS = {
  // the map's first flight: asked for as a ship takes off under you
  '/universe/fly': [
    {
      id: 'hello',
      title: 'Flying',
      // (the player's tour shows these too, before a ship may be picked)
      text: ({ ship } = {}) =>
        `${ship ? 'You’re flying.' : 'Pick a ship on the panel to fly it yourself.'} The stations round the sun are the site’s pages; the planets out in deep space are its worlds. Fly to any of them, or pick one on the panel and let the ship take you.`,
    },
    {
      id: 'fly',
      title: 'The stick',
      text: 'Throttle up and steer; hold the nose up or down and you loop right over.',
      keys: [
        ['W S', 'Throttle'],
        ['A D', 'Roll'],
        ['← ↑ ↓ →', 'Steer the nose'],
        ['Space / Shift', 'Boost'],
      ],
      touch: [
        ['Drag', 'Fly, anywhere on the map'],
        ['↑ ↓', 'Hold to pull the nose up and down'],
        ['Boost', 'Hold to go fast'],
      ],
    },
    {
      id: 'go',
      title: 'Getting about',
      text: 'The worlds are far apart. Boost in the open and the pulse drive takes over, or open the nav map and let the ship take you.',
      keys: [
        ['M', 'The nav map: pick a place and a drive'],
        ['J', 'Jump to the place picked'],
        ['E / Enter', 'Land or dock where you are'],
      ],
      touch: [['Tap', 'A planet or station, to fly there']],
    },
    {
      id: 'land',
      title: 'Landing, and trouble',
      text: 'Fly down into a planet’s air and you land on it; come in boosting and you crash into its page. Now and then someone comes after you: shoot at the pip ahead of them.',
      keys: [
        ['hold F', 'Fire'],
        ['T', 'Next target'],
        ['V', 'Cockpit or chase camera'],
        ['H', 'The hangar: paint and parts'],
      ],
      touch: [
        ['Fire', 'Shoot'],
        ['View', 'The cockpit'],
      ],
    },
    help('the map'),
  ],
  '/galaxy': [
    {
      id: 'hello',
      title: 'A galaxy far, far away',
      text: `${ABOUT['/galaxy']} Pick a ship on the panel to fly it yourself.`,
    },
    {
      id: 'fly',
      title: 'Flying',
      text: 'Throttle up and steer; boost to go fast. Hold the nose up or down and you loop right over.',
      keys: [
        ['W S', 'Throttle'],
        ['A D', 'Roll'],
        ['← ↑ ↓ →', 'Steer the nose'],
        ['Space / Shift', 'Boost'],
      ],
      touch: [
        ['Drag', 'Fly'],
        ['Boost', 'Hold to go fast'],
      ],
    },
    {
      id: 'fight',
      title: 'Fighting',
      text: 'The guns lock on: shoot at the pip ahead of a target and the shots bend home.',
      keys: [
        ['hold F', 'Fire'],
        ['T / Q', 'Next / previous target'],
        ['V', 'Cockpit or chase camera'],
      ],
      touch: [['Fire', 'Hold to shoot']],
    },
    {
      id: 'go',
      title: 'Going somewhere',
      text: 'Put the nose on a named star and jump. Every system has a planet to land on and a mission.',
      keys: [
        ['J', 'Jump to lightspeed, to the star on your nose'],
        ['M', 'The galaxy map: plot a course'],
        ['E / Enter', 'Land on the planet'],
      ],
      touch: [
        ['Tap', 'A star’s name to plot a course'],
        ['Jump', 'Lightspeed, to the star on your nose'],
      ],
    },
    help('the galaxy'),
  ],
  '/galaxy/surface': [
    {
      id: 'hello',
      title: 'Down on the surface',
      text: `${ABOUT['/galaxy/surface']} The button with your name on it, top right, picks who you play.`,
    },
    {
      id: 'move',
      title: 'Getting about',
      text: 'You walk the way the camera faces.',
      keys: [
        ['W A S D', 'Walk'],
        ['Shift', 'Run'],
        ['Space', 'Jump'],
        ['Drag', 'Look round'],
      ],
      touch: [
        ['Stick', 'Walk'],
        ['Drag', 'Look round'],
        ['Run', 'Hold to run'],
      ],
    },
    {
      id: 'act',
      title: 'Talking and fighting',
      text: 'Enemies show their health over their heads. Blocking spends your guard, and guns heat up: vent before they lock.',
      keys: [
        ['E', 'Talk, ride, go in, get in the ship'],
        ['F', 'Fire (or swing a lightsaber)'],
        ['C', 'Hold to block with the lightsaber'],
        ['X', 'Dodge'],
        ['R', 'Vent the gun’s heat (or throw the lightsaber)'],
      ],
      touch: [
        ['Use', 'Talk, ride, go in, get in the ship'],
        ['Fire', 'Hold to fire (Swing, with a lightsaber)'],
        ['Dodge', 'A roll'],
      ],
    },
    {
      id: 'goal',
      title: 'What to do',
      text: 'The compass names the places from the films until you’ve found them. Get back in the ship to take off again.',
      keys: [
        ['Q', 'Things to do'],
        ['Tab', 'Swap to your crewmate'],
      ],
    },
    help('the surface'),
  ],
  '/deathstar': [
    {
      id: 'hello',
      title: 'The Death Star',
      text: ABOUT['/deathstar'],
    },
    {
      id: 'fly',
      title: 'The trench run',
      text: 'Shoot the TIEs and towers over the surface, then dive in: dodge the catwalks, shoot the turrets, lose Vader.',
      keys: [
        ['W A S D / ← ↑ ↓ →', 'Steer'],
        ['hold Space', 'Lasers (or hold the mouse)'],
        ['F / Enter', 'Proton torpedo'],
      ],
      touch: [
        ['Drag', 'Steer'],
        ['Laser', 'Hold to fire'],
        ['Torpedo', 'Fire one'],
      ],
    },
    {
      id: 'port',
      title: 'The exhaust port',
      text: 'Torpedoes hit the first thing in their path, so keep one for the port. It glows as you close in and turns green when you’re lined up, low and centred.',
      keys: [['T', 'Targeting computer off: half again on the score']],
    },
    {
      id: 'yavin',
      title: 'The Battle of Yavin',
      text: 'Set course for Yavin 4 and a clock starts: fly the trench run before the moon is in range. Rookie, Red Five or Jedi; each keeps its best.',
    },
    help('the Death Star'),
  ],
  // planet flight: begin (scripts/flight-island.mjs removes this block)
  '/fly': [
    {
      id: 'hello',
      title: 'Planet flight',
      text: ABOUT['/fly'],
    },
    {
      id: 'fly',
      title: 'Flying',
      text: 'Lean the ship and it turns the way it leans; let go and the wings come level. Keep off the ground: touch it and you’re put back up.',
      keys: [
        ['W S', 'Nose down and up'],
        ['A D', 'Bank'],
        ['Q E', 'Turn'],
        ['Shift / F', 'Faster and slower'],
      ],
      touch: [
        ['Stick', 'Fly'],
        ['+ −', 'Faster and slower'],
      ],
    },
    help('the flight'),
  ],
  // planet flight: end
  '/deathstar/inside': [
    {
      id: 'hello',
      title: 'Aboard the Death Star',
      text: ABOUT['/deathstar/inside'],
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'Click the station to take the pointer, and the mouse turns your head. Doors open as you come near.',
      keys: [
        ['W A S D / ← ↑ ↓ →', 'Walk'],
        ['Shift', 'Run'],
        ['Mouse', 'Look'],
        ['E', 'Use: lifts, consoles, people'],
        ['V', 'Third or first person'],
      ],
      touch: [
        ['Stick', 'Walk'],
        ['Drag', 'Look'],
        ['Use', 'Lifts, consoles, people'],
      ],
    },
    {
      id: 'fight',
      title: 'Blasters',
      text: 'Bolts fly, and stop at walls. Your gun heats as you fire; let it get too hot and it vents, so vent it yourself first.',
      keys: [
        ['Click', 'Fire'],
        ['Right-click', 'Aim'],
        ['R', 'Vent the gun'],
      ],
      touch: [
        ['Fire', 'Shoot'],
        ['Aim', 'Hold to aim'],
      ],
    },
    {
      id: 'objective',
      at: 'ds-objective',
      title: 'What to do',
      text: 'Your objective is up here. Follow the story, or roam the station free: the story waits for you.',
    },
    {
      id: 'map',
      at: 'ds-map',
      title: 'The map',
      text: 'The station’s blueprint, filled in as you see each room.',
      keys: [['M / Tab', 'Open the map']],
    },
    help('the station'),
  ],
  '/caribbean': [
    {
      id: 'hello',
      title: 'The Caribbean',
      text: `${ABOUT['/caribbean']} The page has the captain’s effects, the wanted posters and the code too.`,
    },
    {
      id: 'sail',
      title: 'Sailing',
      text: 'A D turns her, W S sets the sail. A controller works too.',
      keys: [
        ['A D / ← →', 'Turn'],
        ['W S', 'More or less sail'],
      ],
      touch: [['Stick', 'Sail']],
    },
    {
      id: 'guns',
      title: 'Broadsides',
      text: 'The guns are along the sides, not the bow: gold arcs on the water show what each side can reach. Bring her round.',
      keys: [
        ['Q', 'Port guns'],
        ['E', 'Starboard guns'],
        ['Click / Space', 'Fire the side you’re looking at'],
      ],
      touch: [['Tap', 'The buttons to fire each side']],
    },
    {
      id: 'goal',
      title: 'The voyage',
      text: 'Sink the patrol, take the four chests, silence the fort (keep off the red rings), then the Flying Dutchman and the kraken. Pick a refit between fights.',
      keys: [
        ['1 2 3', 'Pick a refit'],
        ['P', 'Pause'],
      ],
    },
    help('the Caribbean'),
  ],
  '/invincible': [
    {
      id: 'hello',
      title: 'Invincible',
      text: `${ABOUT['/invincible']} Think, Mark!, the game, is on the page too.`,
    },
    {
      id: 'fly',
      title: 'Flying',
      text: 'You fly the way you’re looking. Past about 430 km/h the air breaks with a boom.',
      keys: [
        ['W A S D', 'Fly (walk, on the ground)'],
        ['Space', 'Up (and take off)'],
        ['C', 'Down (and land)'],
        ['Shift', 'Flat out'],
        ['Drag / ← ↑ ↓ →', 'Look round'],
      ],
      touch: [
        ['Stick', 'Fly'],
        ['Up', 'Up'],
        ['Down', 'Down'],
        ['Boost', 'Flat out'],
      ],
    },
    {
      id: 'act',
      title: 'Punching and places',
      text: 'A little way off, Mark lunges. Come down fast and the street cracks.',
      keys: [
        ['J / F / Click', 'Punch'],
        ['E', 'Go in at a place'],
      ],
      touch: [['Punch', 'Punch']],
    },
    {
      id: 'goal',
      title: 'Where to start',
      text: 'Dad’s rings start over the street outside the house: ten of them to the Guardians’ hall, against the clock. Cecil, at the GDA, has a job. Keep climbing and you reach space.',
    },
    help('the city'),
  ],
  '/hogwarts': [
    {
      id: 'hello',
      title: 'Hogwarts',
      text: `${ABOUT['/hogwarts']} For now it’s the shore, the night you arrive: the rest comes as the world is made.`,
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'W A S D walks, Shift runs, a drag looks round. The jetty and the boats are down the shingle on your right.',
      keys: HOGWARTS_WALK.slice(0, 3),
      touch: WALK_TOUCH,
    },
    {
      id: 'wand',
      title: 'The wand',
      text: 'Your wand comes at the first lesson. Hold Q for the wheel of nine spells, or press 1 to 9 for one straight off.',
      keys: HOGWARTS_KEYS.find((g) => g.label.startsWith('The wand')).rows.slice(0, 3),
    },
    {
      id: 'broom',
      title: 'The broom',
      text: 'After the flying lesson the broom is yours: W to lean on and go, A D to bank, Space up and C down, Shift flat out.',
      keys: HOGWARTS_KEYS.find((g) => g.label.startsWith('The broom')).rows.slice(0, 4),
    },
    {
      id: 'goal',
      title: 'What to go for',
      text: 'The House Cup: every lesson, quest and Snitch earns your house points, and a spell cast at a person outside a duel loses them. The Marauder’s Map (M) comes after the first week.',
    },
    help('Hogwarts'),
  ],
  '/middle-earth': [
    {
      id: 'hello',
      title: 'Middle-earth',
      text: ABOUT['/middle-earth'],
    },
    {
      id: 'book',
      title: 'The Red Book',
      text: 'Turn the pages from Bag End to the Havens. Touch what stands up on a page; Play it opens its chapter’s game, Walk it the Road.',
      keys: [['← →', 'Turn the pages'], ['Click', 'Something on the page']],
      touch: [['Swipe', 'Turn the pages'], ['Tap', 'Something on the page']],
    },
    {
      id: 'ring',
      title: 'The Ring and the stone',
      text: 'Put on the Ring (R) to see what is hidden, but not for long. Look into the Palantír (P) to go anywhere on the map.',
    },
    help('Middle-earth'),
  ],
  '/middle-earth/road': [
    {
      id: 'hello',
      title: 'The Road',
      text: ABOUT['/middle-earth/road'],
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'Hold W to walk on, Shift to run, S to step back.',
      keys: [['W', 'Walk on'], ['Shift', 'Run'], ['S', 'Step back']],
      touch: [['Walk', 'Hold to walk on'], ['Run', 'Hold to run']],
    },
    {
      id: 'look',
      title: 'Looking',
      text: 'Drag to look about; let go and the view comes back to the road.',
      keys: [['Drag', 'Look about']],
      touch: [['Drag', 'Look about']],
    },
    {
      id: 'auto',
      title: 'The road walks itself',
      text: 'Leave the keys and it walks on at a walk, stopping where something happens. Space turns it off and on.',
      keys: [['Space', 'Let the road walk']],
    },
    help('the Road'),
  ],
  '/middle-earth/place': [
    {
      id: 'hello',
      title: 'A stop on the road',
      text: ABOUT['/middle-earth/place'],
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'Walk up to someone or something and a prompt says what you can do.',
      keys: [...WALK, ['E / Enter', 'Do what the prompt says'], ['M', 'The list of things to do']],
      touch: WALK_TOUCH,
    },
    {
      id: 'kitchen',
      title: 'In the kitchen',
      text: 'Overcooked-style: pick up, work and serve each order before its ticket runs out. The kitchen gives you a room code: send it to a friend to cook together.',
      keys: [
        ['E / Space', 'Pick up, put down, serve'],
        ['hold F', 'Work: chop, wash, scrape'],
        ['Shift', 'Dash'],
      ],
      touch: [
        ['Grab', 'Pick up, put down, serve'],
        ['Work', 'Hold to work'],
        ['Dash', 'Dash'],
      ],
    },
    help('the road'),
  ],
  '/avengers': [
    {
      id: 'hello',
      title: 'Avengers HQ',
      text: ABOUT['/avengers'],
    },
    {
      id: 'walk',
      title: 'On the ground',
      text: 'Jump at a wall and you run up it.',
      keys: [
        ['W A S D / ← ↑ ↓ →', 'Walk'],
        ['Shift', 'Run'],
        ['Space', 'Jump'],
        ['Drag', 'Look round'],
      ],
      touch: [
        ['Stick', 'Walk (all the way to run)'],
        ['Jump', 'Jump'],
      ],
    },
    {
      id: 'swing',
      title: 'Swinging',
      text: 'In the air, web a roof edge, tree or mast. Let go on the upswing for a perfect release; hold on with nothing to catch for web wings.',
      keys: [
        ['hold Space', 'In the air: swing'],
        ['Shift', 'In the air: zip'],
        ['Q', 'Launch to a perch'],
      ],
      touch: [
        ['Jump', 'Hold in the air to swing'],
        ['Zip', 'Zip'],
        ['Perch', 'Launch to a perch'],
      ],
    },
    {
      id: 'goal',
      title: 'The stones',
      text: 'Go in at a building and win its game: its stone hangs over the door. The Space Stone opens a portal over the helipad.',
      keys: [
        ['E / Enter', 'Go in at a door'],
        ['M', 'Things to do: the buildings, with Go there'],
      ],
    },
    help('the compound'),
  ],
  '/scranton': [
    {
      id: 'hello',
      title: 'Dunder Mifflin',
      text: ABOUT['/scranton'],
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'Walk up to someone or something and a prompt says what you can do.',
      keys: [...WALK, ['E / Enter', 'Do what the prompt says']],
      touch: [...WALK_TOUCH, ['Tap', 'The prompt']],
    },
    {
      id: 'jobs',
      title: 'The jobs',
      text: 'The list says what’s next. In a talk, pick what to say.',
      keys: [
        ['M', 'The list of things to do'],
        ['1 2 3 4', 'Pick what to say'],
        ['Esc', 'Leave a job'],
      ],
      touch: [['Tap', 'What to say']],
    },
    help('the office'),
  ],
  '/cybertron': [
    {
      id: 'hello',
      title: 'Cybertron',
      text: `${ABOUT['/cybertron']} Roll out, the game, is further down.`,
    },
    {
      id: 'move',
      title: 'Walking and driving',
      text: 'Click the world to play; Esc lets go of the mouse.',
      // (the world's one list of keys, the start card's and the guide's: guide/cybertron.js)
      keys: cybertronRows(['W A S D', 'Shift', 'Space', 'Q']),
      touch: cybertronRows(['Stick', 'Drag', 'Transform'], CYBERTRON_TOUCH),
    },
    {
      id: 'act',
      title: 'Fighting and missions',
      text: 'When someone has a job for you, it says so at the top: walk up and talk. E by a ground bridge goes through it.',
      keys: cybertronRows(['Mouse', 'Click / F', 'E', 'M']),
      touch: cybertronRows(['Fire'], CYBERTRON_TOUCH),
    },
    help('Cybertron'),
  ],
  '/albuquerque': [
    {
      id: 'hello',
      title: 'Albuquerque',
      text: ABOUT['/albuquerque'],
    },
    {
      id: 'drive',
      title: 'Driving',
      text: 'S brakes. Hold the handbrake into a turn and the tail swings round.',
      keys: [
        ['W A S D / ← ↑ ↓ →', 'Drive'],
        ['hold Space', 'Handbrake'],
        ['H', 'The horn'],
      ],
      touch: [
        ['Stick', 'Drive'],
        ['Slide', 'Hold into a turn: the handbrake'],
      ],
    },
    {
      id: 'places',
      title: 'Places and deliveries',
      text: 'Pull up at a place and go in. Hank’s SUV is the flashing dot: don’t race past him, or carry near him.',
      keys: [
        ['E / Enter', 'Go in'],
        ['M', 'Things to do'],
        ['R', 'Run a delivery'],
      ],
    },
    help('Albuquerque'),
  ],
  '/c-137': [
    {
      id: 'hello',
      title: 'Dimension C-137',
      text: ABOUT['/c-137'],
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'The Smiths’ house, Rick’s garage, the school, Shoney’s and Dr. Wong’s office are along the street; Blips and Chitz is through the portal.',
      keys: [...WALK, ['Space', 'Jump']],
      touch: WALK_TOUCH,
    },
    {
      id: 'act',
      title: 'Doing things',
      text: 'Walk up to a door, the cruiser or a game and a prompt shows. Some places fight back.',
      keys: [
        ['E', 'Doors, the cruiser, the games'],
        ['F', 'Fire, in a fight'],
        ['M', 'Things to do'],
      ],
      touch: [['Tap', 'Jump, act and fire, on their buttons']],
    },
    {
      id: 'goal',
      title: 'Where to start',
      text: 'The story starts at Shoney’s, up the street: the line at the top says what’s next, and each episode opens more of the portal gun’s thirty-two places (Free roam, in Things to do, opens them all). The gun’s on Rick’s bench in the garage, its portal on the west wall. Or take the cruiser up (E by it). The show’s planets are on the universe map: land on one and you’re in it.',
      keys: [
        ['E', 'The portal gun, at Rick’s bench'],
        ['P', 'The portal gun, from anywhere'],
      ],
    },
    help('C-137'),
  ],
  '/c-137/citadel': [
    {
      id: 'hello',
      title: 'The Citadel of Ricks',
      text: ABOUT['/c-137/citadel'],
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'Walk up to someone or something and a prompt says what you can do.',
      keys: [...WALK, ['E / Enter', 'Do what the prompt says'], ['M', 'The list of things to do']],
      touch: [...WALK_TOUCH, ['Tap', 'The prompt']],
    },
    {
      id: 'talk',
      title: 'Answering',
      text: 'Answer the way C-137 would. Grovelling gets you held in contempt.',
      keys: [
        ['1 2 3 4', 'Answer'],
        ['Esc', 'Leave a scene'],
      ],
      touch: [['Tap', 'The answers']],
    },
    help('the Citadel'),
  ],
  '/dot-matrix': [
    {
      id: 'hello',
      title: 'Dot Matrix',
      text: ABOUT['/dot-matrix'],
    },
    {
      id: 'move',
      title: 'Moving',
      text: 'Hold jump to jump higher.',
      keys: [
        ['W A S D / ← ↑ ↓ →', 'Walk'],
        ['Space / Z', 'Jump'],
        ['Q E', 'Turn the camera'],
      ],
      touch: [
        ['Pad', 'Walk'],
        ['A', 'Jump'],
        ['Drag', 'Turn the island'],
      ],
    },
    {
      id: 'act',
      title: 'Reading and playing',
      text: 'Jump on the walkers; walking into one hurts. Three hearts, and a “?” block gives one back.',
      keys: [
        ['X / Enter', 'Read a sign, play, go down a pipe'],
        ['M', 'The cartridges, with hints'],
      ],
      touch: [['B', 'Read, play, go down']],
    },
    help('the island'),
  ],
  '/dot-matrix/64': [
    {
      id: 'hello',
      title: 'Super Mario 64',
      text: `${ABOUT['/dot-matrix/64']} Or play the real game on the N64, from your own ROM.`,
    },
    {
      id: 'run',
      title: 'Running and jumping',
      text: 'Mario goes the way you push, from the camera. Jump again on landing for a double, a third time for the triple.',
      keys: [
        ['W A S D / ← ↑ ↓ →', 'Run'],
        ['Space / K', 'Jump'],
        ['Q E / Drag', 'Turn the camera'],
      ],
      touch: [
        ['Stick', 'Run'],
        ['A', 'Jump'],
        ['Drag', 'Turn the camera'],
      ],
    },
    {
      id: 'moves',
      title: 'Moves',
      text: 'Crouch and jump to backflip; run, crouch and jump to long jump. In the air, crouch to ground pound.',
      keys: [
        ['J / F', 'Punch, pick up, throw; talk and read'],
        ['Shift', 'Crouch'],
      ],
      touch: [
        ['B', 'Punch, pick up, talk'],
        ['Z', 'Crouch, ground pound'],
      ],
    },
    {
      id: 'goal',
      title: 'Power Stars',
      text: 'Jump into a painting to go to its world. Each world has three Power Stars, and the star doors open at so many stars.',
    },
    help('the castle'),
  ],
  '/dot-matrix/minecraft': [
    {
      id: 'hello',
      title: 'Minecraft',
      text: `${ABOUT['/dot-matrix/minecraft']} Minecraft itself, 1.12.2 and 1.8.8, is here too, behind a password.`,
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'Click the world to take the pointer, and the mouse turns your head. You walk, jump and swim by the game’s own numbers.',
      keys: [
        ['W A S D / ← ↑ ↓ →', 'Walk'],
        ['Mouse', 'Look'],
        ['Space', 'Jump; swim up'],
        ['Shift', 'Sneak, and stay on the edge'],
        ['W twice', 'Sprint'],
      ],
      touch: [
        ['Stick', 'Walk'],
        ['Drag', 'Look'],
        ['⇧', 'Jump; swim up'],
        ['⇩', 'Sneak'],
      ],
    },
    {
      id: 'build',
      title: 'Digging and building',
      text: 'Hold the button on a block to dig it, then pick up what it drops. Punch a tree for logs: they make planks, a crafting table and tools.',
      keys: [
        ['Click', 'Dig (hold)'],
        ['Right-click', 'Place; open a crafting table'],
        ['E', 'Inventory and crafting'],
        ['1 – 9', 'The hotbar'],
      ],
      touch: [
        ['Tap', 'Dig (hold)'],
        ['Stick', 'Walk'],
      ],
    },
    {
      id: 'goal',
      title: 'Coming',
      text: 'Night falls after ten minutes: torches keep it back, and a bed sleeps it away. Caves and mobs arrive a piece at a time.',
    },
    help('the world'),
  ],
  '/earth': [
    {
      id: 'hello',
      title: 'Earth',
      text: `${ABOUT['/earth']} The sun is where it is, so the night side is the real night.`,
    },
    {
      id: 'orbit',
      title: 'From orbit',
      text: 'Turn the globe and pick a place.',
      keys: [
        ['Drag', 'Turn the globe'],
        ['Click', 'A place, to fly there'],
        ['M', 'Down to the globe, or back up'],
      ],
      touch: [['Drag', 'Turn the globe']],
    },
    {
      id: 'fly',
      title: 'Flying',
      text: 'Fly over a place to stamp your passport and get its postcard. Fly here sets the autopilot; Esc takes the controls back.',
      keys: [
        ['W A S D / ← ↑ ↓ →', 'Turn, climb and descend'],
        ['Shift / Space', 'Faster'],
        ['V', 'Cockpit or chase camera'],
        ['P', 'The passport'],
      ],
      touch: [
        ['Stick', 'Fly'],
        ['Faster', 'Go faster'],
      ],
    },
    help('Earth'),
  ],
  '/music': [
    {
      id: 'hello',
      title: 'The music room',
      text: `${ABOUT['/music']} Everything tunes to the same Sa.`,
    },
    {
      id: 'walk',
      title: 'Walking',
      text: 'Click the courtyard first, then walk up to an instrument.',
      keys: [
        ['W A S D', 'Walk'],
        ['← →', 'Turn'],
        ['Drag', 'Look round'],
      ],
      touch: WALK_TOUCH,
    },
    {
      id: 'play',
      title: 'Playing',
      text: 'Pick a Sa and a raga, start the tanpura, then click the sitar’s frets, the harmonium’s keys or the tabla. Record the room keeps what you play.',
      keys: [
        ['E', 'Play the instrument you’re by'],
        ['hold Space', 'A chikari roll, on the sitar'],
      ],
      touch: [['Tap', 'An instrument’s button to play it']],
    },
    help('the music room'),
  ],
};

// the rows this device reads: a phone's where there are any, else the
// keyboard's, and none for a phone where a stop has only the keyboard's
export const rowsFor = (step, touch) => (touch ? step.touch ?? null : step.keys ?? null);
