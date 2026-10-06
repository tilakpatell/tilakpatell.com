import { GUIDES, guideKeyFor } from './routes';

// What the guide says about each page: a line on what it is, its controls
// (`keys` for a keyboard, `touch` for a phone; each a list of groups, a group
// a label and rows of [keys, what they do], keys written as keys.js reads
// them) and its tips. Its title, and whether its first visit gets a note,
// are in routes.js. Loaded with the guide's panel, not before.

// the portfolio pages run into one another (components/feed)
const FEED_TIP = ['Keep scrolling', 'The six portfolio pages run into one another: reach the end of one and the next begins. After the sixth, the end.'];

const FLY = [
  ['W S', 'Throttle'],
  ['A D', 'Roll (or turn: flight settings)'],
  ['← →', 'Swing the nose'],
  ['↑ ↓', 'Nose up and down (all the way over, if you hold it)'],
  ['Space / Shift', 'Boost (the pulse drive, out in the open)'],
  ['hold F', 'Fire'],
  ['R / 1 2 3', 'Weapons: blaster, spread, heavy ordnance (Shift+R back)'],
  ['T / Q', 'Next / previous target'],
  ['V', 'Cockpit or chase camera'],
  ['Drag', 'Fly like a stick'],
];

const WALK = [
  ['W A S D / ← ↑ ↓ →', 'Walk'],
  ['Shift', 'Run'],
  ['Drag', 'Look round'],
  ['E / Enter', 'Do what the prompt says'],
  ['M', 'The list of things to do'],
];
const WALK_TOUCH = [
  ['Stick', 'Walk (push it all the way to run)'],
  ['Swipe', 'Look round'],
];

export const PAGES = {
  '/home': {
    tips: [
      ['The route line', 'It draws itself down the page as you scroll, lighting each stop.'],
      ['The Game Boy', 'It plays. In Super Tilak Land a fire flower lets B throw fire, stomps in a row score more each time, and a king waits at the end of the castle. Each game keeps its best score.'],
      ['Off the clock', 'Every icon in the row does something, and every card has a toy in it.'],
      FEED_TIP,
    ],
    keys: [
      {
        label: 'The Game Boy',
        rows: [
          ['← ↑ ↓ →', 'D-pad'],
          ['Z / Space', 'A'],
          ['X', 'B'],
          ['Enter', 'Start'],
          ['Shift', 'Select'],
        ],
      },
    ],
    touch: [{ label: 'The Game Boy', rows: [['Tap', 'Its own buttons']] }],
  },
  '/experience': {
    tips: [
      ['Company colors', 'Each role re-themes the site as you scroll past it.'],
      ['The crawl', 'Play the opening crawl for the whole story so far.'],
      ['Share a role', 'Each role has its own address (/experience/aws): a link opens right on it.'],
      FEED_TIP,
    ],
  },
  '/projects': {
    tips: [
      ['The periodic table', 'Click a tile to light up the projects built with it. Click again to clear.'],
      ['The sitar string', 'Pluck it.'],
      FEED_TIP,
    ],
  },
  '/project': {
    tips: [['The demo', 'The panel at the top is live: try it.']],
  },
  '/resume': {
    tips: [
      ['Skills', 'Click any skill on the résumé to light up every line that uses it; the PDF tab has the one-page version.'],
      ['Elsewhere', 'Every role and project on it has its own page, under Experience and Projects.'],
      FEED_TIP,
    ],
  },
  '/contact': {
    tips: [
      ['The memo', 'The form opens your email app with the memo filled in. Nothing is sent from this page.'],
      ['Email', 'Copy address copies it with one press; ⌘K (Ctrl+K) can copy it from anywhere on the site, too.'],
      FEED_TIP,
    ],
  },
  '/universe': {
    about: 'The whole site as places in space: the stations round the sun are its pages, the planets in deep space its worlds. Fly a ship to any of them, or pick one.',
    keys: [
      { label: 'Flying', rows: [...FLY, ['M', 'The nav map: pick a place and a drive'], ['J', 'Jump to the place picked'], ['E / Enter', 'Land or dock where you are'], ['G', 'Land and step out (G again to get back in)'], ['H', 'The hangar: paint and parts'], ['O', 'Flight settings'], ['Esc', 'Back out to the whole map']] },
      { label: 'On foot', rows: [['W A S D', 'Walk'], ['Q E', 'Step sideways'], ['Shift', 'Run'], ['Space', 'Jump'], ['F / Click', 'Fire'], ['X', 'Play the other one of your crew'], ['V', 'Out of their eyes'], ['Enter', 'Into the planet’s page']] },
    ],
    touch: [
      {
        rows: [
          ['Drag', 'Fly, anywhere on the map'],
          ['↑ ↓', 'Hold to pull the nose up and down'],
          ['Tap', 'A planet, station or wonder to fly there; a hunter to lock on'],
        ],
      },
      { label: 'The buttons', rows: [['Boost', 'Hold to go fast'], ['Fire', 'Shoot'], ['View', 'The cockpit'], ['Wrench', 'The hangar'], ['Sliders', 'How it all feels']] },
    ],
    tips: [
      ['Pick a ship', 'Rick and Morty’s cruiser, Luke and Artoo’s X-wing, Han and Chewie’s Falcon or Walt and Jesse’s RV. Each crew has a word about every place. No ship? Pick a place and the camera flies there.'],
      ['Getting about', 'The worlds are far apart. Boost in the open and the pulse drive takes over; it drops back near a place. Or open the nav map (M) and let the ship take you: hyperspeed (a jump), super speed or cruise. Star systems are on it too: pick one and the ship flies through the gate. Tour visits every place, nearest first; Escape stops it.'],
      ['Links', 'Every place has a link that opens the map there (/universe/aurelia, say): Copy a link here on the nav map. The terminal’s fly <place> and ⌘K’s Fly to do the same.'],
      ['Deep space', 'Between the worlds are the wonders: a ringed gas giant, an ice giant, two other suns with their own worlds, a black hole, two nebulae, the Citadel of Ricks, a pulsar, a binary star, a rogue planet and a wreck field round a white dwarf, with a rim of ice round the edge of the map. The crew have a word about each.'],
      ['Mind the planets', 'Brush one and you bounce off; fly into one at speed and you crash into its page.'],
      ['Hunted', 'Now and then someone comes after you, sooner if you’ve been shooting. The guns lock on: shoot at the pip ahead of them and the shots bend home. Lose your shields and you’re back at the nearest place.'],
      ['The Citadel of Ricks', 'Knock out the four shield generators, then only heavy ordnance hurts the core. Everyone online shares the siege.'],
      ['Happenings', 'A Star Destroyer drops out of hyperspace and launches fighters, someone calls for help with pirates on their tail, a convoy goes by, a star flares and rattles the ship, a rift opens ahead (fly in and it drops you elsewhere on the map), and something enormous swims past: purrgil, or a Cromulon. Rocks cross your path (shoot or steer round them), and now and then a bounty hunter comes for you: Boba Fett in Slave I, or Phoenixperson.'],
      ['The black hole', 'The one thing out there you don’t come back from. On its far side is a friend’s universe; Back brings you home.'],
      ['Online', 'Multiplayer, bottom left: everyone else on the map is there in their own ships. Fly together, or shoot each other down.'],
    ],
  },
  '/galaxy': {
    about: 'Eighteen star systems from the films and the shows, each a moment from them playing out round you.',
    keys: [{ label: 'Flying', rows: [...FLY, ['M', 'The galaxy map: plot a course'], ['J', 'Jump to lightspeed, to the star on your nose'], ['E / Enter', 'Land on the planet (or board the Death Star)']] }],
    touch: [{ rows: [['Drag', 'Fly'], ['Tap', 'A star’s name to plot a course'], ['Jump', 'Lightspeed, to the star on your nose']] }],
    tips: [
      ['Jumping', 'Turn the nose toward a star and its name comes up; press J, or fly out of the system toward it. The galaxy map (M) filters by era or film.'],
      ['Missions', 'Each system has one. The trench run and boarding the Death Star are playable now; the rest are briefings for games still being built. Watch for the tractor beam at Alderaan.'],
      ['Online', 'The other pilots in the same system are there with you, in their own ships. The galaxy map shows how many are where.'],
    ],
  },
  '/galaxy/surface': {
    about: 'A world from the films, on foot: its places to find, its people to talk to, things to ride.',
    keys: [
      {
        rows: [
          ['W A S D', 'Walk (the way the camera faces); on a ride, throttle and steer'],
          ['Shift', 'Run (or boost)'],
          ['Space', 'Jump'],
          ['Drag', 'Look round'],
          ['Scroll', 'Zoom'],
          ['E', 'Talk, ride (and get off), go in, get in the ship'],
          ['F', 'Fire your blaster'],
          ['Q', 'Things to do'],
          ['Tab', 'Swap to your crewmate'],
        ],
      },
    ],
    touch: [
      {
        rows: [
          ['Stick', 'Walk'],
          ['Drag', 'Look round'],
          ['Jump', 'Jump'],
          ['Use', 'Talk, ride, go in, get in the ship'],
          ['Run', 'Hold to run'],
          ['Fire', 'Hold to fire'],
        ],
      },
    ],
    tips: [
      ['The places', 'The compass names the places from the films until you’ve found them, with what the crew have to say about each.'],
      ['Leaving', 'Get back in the ship (E by it, or Back to orbit) to take off.'],
    ],
  },
  '/galaxy/mission': {
    tips: [['The briefing', 'Each system’s mission opens with its own crawl. The trench run and boarding the Death Star play now; the rest are games still being built.']],
  },
  '/deathstar': {
    keys: [
      {
        label: 'The trench run',
        rows: [
          ['W A S D / ← ↑ ↓ →', 'Steer'],
          ['hold Space', 'Lasers (or hold the mouse)'],
          ['F / Enter', 'Proton torpedo'],
          ['T', 'Targeting computer off: half again on the score'],
        ],
      },
    ],
    touch: [{ label: 'The trench run', rows: [['Drag', 'Steer'], ['Laser', 'Hold to fire'], ['Torpedo', 'Fire one']] }],
    tips: [
      ['The superlaser', 'Fire it, or set a course to another planet first.'],
      ['The Battle of Yavin', 'Set course for Yavin 4 and a clock starts. Fly the trench run before the moon is in range.'],
      ['The trench run', 'Shoot the TIEs and towers over the surface, then dive in: dodge the catwalks, shoot the turrets, lose Vader. Torpedoes hit the first thing in their path, so keep one for the port: it glows as you close in and turns green when you’re lined up, low and centred. Rookie, Red Five or Jedi; each keeps its best.'],
      ['The readout', 'Open any part of the station on the technical readout.'],
    ],
  },
  '/caribbean': {
    keys: [
      {
        label: 'Dead man’s tide',
        rows: [
          ['A D / ← →', 'Turn'],
          ['W S', 'More or less sail'],
          ['Q', 'Port guns'],
          ['E', 'Starboard guns'],
          ['Click / Space', 'Fire the side you’re looking at (move the mouse to look)'],
          ['1 2 3', 'Pick a refit'],
          ['P', 'Pause'],
        ],
      },
    ],
    touch: [{ label: 'Dead man’s tide', rows: [['Stick', 'Sail'], ['Tap', 'The buttons to fire each side']] }],
    tips: [
      ['Dead man’s tide', 'You’re Jack Sparrow at the Black Pearl’s helm. Gold arcs on the water show what each side can reach. Sink the patrol, take the four chests, silence the fort (keep off the red rings), then the Flying Dutchman and the kraken. A controller works too.'],
      ['The captain’s effects', 'The compass points at what you want most: press it to want something else. Drink the rum, all of it. Press the jar of dirt until it tells you what’s inside.'],
      ['Wanted', 'Every poster does something. Jack and Davy Jones recolour the whole site (so does typing savvy); Barbossa brings the moonlight, and in the moonlight the curse shows.'],
      ['The code', 'Press an article to see what it comes to in practice.'],
    ],
  },
  '/invincible': {
    about: 'The Graysons’ city to fly about as Mark, and Think, Mark!, the game.',
    keys: [
      {
        label: 'The city',
        rows: [
          ['W A S D', 'Fly the way you’re looking (walk, on the ground)'],
          ['Space', 'Up (and take off)'],
          ['C', 'Down (and land)'],
          ['Shift', 'Flat out: past about 430 km/h the air breaks with a boom'],
          ['Drag / ← ↑ ↓ →', 'Look round'],
          ['J / F / Click', 'Punch (a little way off, he lunges)'],
          ['E', 'Go in at a place (Cecil, at the GDA, has a job)'],
          ['T', 'The time of day'],
        ],
      },
      {
        label: 'Think, Mark!',
        rows: [
          ['W A S D', 'Fly the way the camera looks'],
          ['Space / C', 'Climb / drop'],
          ['Shift', 'Flat out'],
          ['Drag / ← ↑ ↓ →', 'Look round'],
          ['J / Click', 'Punch'],
          ['K / Right-click', 'Dodge'],
          ['Tab', 'Next target'],
          ['P', 'Pause'],
        ],
      },
    ],
    touch: [
      { label: 'The city', rows: [['Stick', 'Fly (on the left)'], ['Up', 'Up'], ['Down', 'Down'], ['Boost', 'Flat out'], ['Punch', 'Punch']] },
      { label: 'Think, Mark!', rows: [['Stick', 'Left of the screen steers'], ['Drag', 'Right of the screen looks'], ['Tap', 'Punch'], ['Dodge', 'Dodge']] },
    ],
    tips: [
      ['The city', 'Six kilometres of downtown, river, suburbs, coast and hills. Come down fast and the street cracks; hit a tower too fast and you bounce off it. The places: the Graysons’, the high school, Burger Mart, the Guardians’ hall, the GDA.'],
      ['Things to do', 'Dad’s rings start over the street outside the house: ten of them to the Guardians’ hall, against the clock. The first season’s eight title cards are hidden round the city (one high up). Every minute or so someone needs catching: follow the red beacon, catch them, land to set them down. Fly alongside the airliner and your father has something to say.'],
      ['The Flaxans', 'They come through a portal over the river, when Cecil sends you or a few minutes in on their own. Punch them out of the sky, or fly into them fast; their purple bolts knock you about. All twelve down and the portal closes.'],
      ['Space', 'Keep climbing: the sky goes dark, the stars come out, and past 9 km you’re out of the air with the Earth under you. Out there you drift, and flat out you go twenty times faster. The Moon and Mars are on the gauge: land on them (Space jumps off again), and someone’s waiting at each. Dive back and you come down through fire over the city.'],
      ['Think, Mark!', 'Four chapters: your father’s rings, the Flaxans, then Omni-Man and Thragg. A Viltrumite blocks and hits back unless he’s recovering from a charge: dodge as the ring closes round him, then hit him while he’s open. A last-moment dodge slows everything down. A controller works too.'],
      ['The title card', 'Press it for the next episode. It has a rough season.'],
      ['The files', 'Drag a figure to turn him, or pick a pose: they’re the HD models the game uses.'],
      ['Things your father said', 'Every card does something.'],
    ],
  },
  '/middle-earth': {
    about: 'A map of the road from Hobbiton to Mount Doom. Every stop is a chapter: a place to walk as Frodo, a kitchen to cook in, and its own game.',
    tips: [
      ['The map', 'Pick a place and the camera flies down to it. The map button takes you back up. A wax seal marks each place you’ve won.'],
      ['The Doors of Durin', 'Move your pointer over the cliff to light the lines, or call the moon. Then say the word: read the arch.'],
      ['The bridge', 'Face the Balrog. Raise the staff (Space) as the whip falls; strike the bridge (Enter) with it right over the deep for a perfect.'],
      ['Gorgoroth', 'Hold to walk (Space or →). Let go when the Eye’s light comes close: standing still, the elven cloaks hide you. Rest before the Ring gets too heavy.'],
      ['The Ring', 'Hold it to the fire to read it, put it on (Escape takes it off), or cast it in.'],
    ],
  },
  '/middle-earth/place': {
    about: 'Walk the place as Frodo, then cook in its kitchen, Overcooked-style, alone or with friends.',
    keys: [
      { label: 'Walking', rows: [...WALK, ['R', 'The Ring, on or off (in the Shire)'], ['Esc', 'Leave what you’re doing']] },
      { label: 'In the kitchen', rows: [['W A S D', 'Walk'], ['E / Space', 'Pick up, put down, serve'], ['hold F', 'Work: chop, wash, scrape'], ['Shift', 'Dash']] },
    ],
    touch: [
      { label: 'Walking', rows: WALK_TOUCH },
      { label: 'In the kitchen', rows: [['Stick', 'Walk'], ['Grab', 'Pick up, put down, serve'], ['Work', 'Hold to work'], ['Dash', 'Dash']] },
    ],
    tips: [
      ['Co-op', 'The kitchen gives you a room code: send it (or its link) to a friend and you cook together.'],
      ['A controller', 'Works too, walking and cooking.'],
    ],
  },
  '/avengers': {
    about: 'The compound in 3D, as Spider-Man. Each building opens its game, and each game wins an Infinity Stone.',
    keys: [
      { label: 'On the ground', rows: [['W A S D / ← ↑ ↓ →', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump (at a wall: run up it)'], ['Drag', 'Look round'], ['E / Enter', 'Go in at a door'], ['M', 'The buildings, with Go there'], ['Esc', 'Out of a game']] },
      { label: 'Swinging', rows: [['hold Space', 'In the air: web a roof edge, tree or mast and swing'], ['Right-click', 'Hold to swing, too'], ['Shift', 'In the air: zip'], ['Q', 'Launch to a perch'], ['T', 'A flip (or a twist, with a direction held)']] },
      { label: 'In the armour', rows: [['W A S D', 'Fly (it leans into its speed)'], ['Space', 'Climb'], ['Shift', 'Come down'], ['E', 'Step out, wherever you are']] },
      { label: 'Anywhere', rows: [['O', 'Settings']] },
    ],
    touch: [
      { rows: [['Stick', 'Walk (all the way to run)'], ['Jump', 'Hold in the air to swing'], ['Zip', 'Zip'], ['Perch', 'Launch to a perch'], ['Trick', 'A flip in the air']] },
      { label: 'In the armour', rows: [['Stick', 'Fly'], ['Up', 'Hold to climb'], ['Down', 'Hold to come down'], ['Step out', 'Out of the armour']] },
    ],
    tips: [
      ['Swinging', 'Let go on the upswing for a perfect release. Hold on with nothing to catch for web wings. Race the swing tour’s rings round the compound.'],
      ['The stones', 'Win a building’s game and its stone hangs over the door. The Space Stone opens a portal over the helipad: walk under it to Titan.'],
      ['Other players', 'See other players goes online: everyone else on the compound shows as a hologram with their name over them.'],
      ['The gate: Thwip!', 'Spider-Man, late for school. Hold to web the wall ahead and swing, let go to fly; let go on the upswing for a perfect. Grab Peter’s backpacks, beat the bell, keep off the street.'],
      ['Without 3D', 'The compound is drawn from the air, and its pins open each game in its simple version.'],
    ],
  },
  '/scranton': {
    about: 'Dunder Mifflin in 3D, as Jim. A week of seven jobs: reception, the stapler in Jell-O, Kevin’s chili, paper toss, the fact check, Dwight’s fire drill and the Dundies.',
    keys: [{ rows: [...WALK, ['1 2 3 4', 'Pick what to say'], ['Space / Enter', 'Go on (a talk), throw (paper toss)'], ['Esc', 'Leave a job']] }],
    touch: [{ rows: [...WALK_TOUCH, ['Tap', 'The prompt, and what to say']] }],
    tips: [
      ['The office from above', 'Further down: pick a desk to visit someone (on a phone, tap a name under the plan).'],
      ['The paper airplane', 'It glides down the page with you as you scroll.'],
      ['Kevin mode', 'Why waste time say lot word.'],
      ['The Dundies', 'One for every easter egg you have found on the site.'],
    ],
  },
  '/cybertron': {
    keys: [
      {
        label: 'Roll out',
        rows: [
          ['A D / ← →', 'Steer'],
          ['Space / ↑', 'Boost (vehicle) or jump (robot)'],
          ['Shift / T / ↓', 'Transform'],
          ['P', 'Pause'],
        ],
      },
    ],
    touch: [{ label: 'Roll out', rows: [['Drag', 'Steer'], ['Tap', 'The buttons to boost, jump and transform']] }],
    tips: [
      ['Sides', 'Join the Autobots or the Decepticons: the site changes color with you, and so does who you can transform.'],
      ['Roll out', 'As a vehicle you’re fast and smash debris; as a robot you fight and jump the barricades, but standing up burns energon. Transforming takes half a second: read the road. Clearing an obstacle pays double if you changed at the last moment.'],
      ['Ground bridge', 'Hold the button, Space, or the scene to open the bridge as an Autobot reaches it. Let go before a Vehicon does.'],
      ['The Iacon database', 'Pick what each Cybertronian entry says before the decryption bar fills. Show the key to read it letter by letter.'],
      ['The roster', 'Roll out as any of them to wear their colors. The soundboard plays through Soundwave’s visor.'],
    ],
  },
  '/albuquerque': {
    about: 'Drive round town in Walt’s Aztek. Places open up as Walt’s career grows, each with its own game.',
    keys: [
      {
        label: 'Driving',
        rows: [
          ['W A S D / ← ↑ ↓ →', 'Drive'],
          ['hold Space', 'Handbrake: hold it into a turn and the tail swings round'],
          ['E / Enter', 'Go in (or wash the Aztek at A1A)'],
          ['M', 'Places'],
          ['R', 'Run a delivery'],
          ['T', 'The time of day'],
          ['P', 'Throw a pizza on the roof (at Walt’s house)'],
          ['H', 'The horn'],
          ['O', 'Driving settings'],
        ],
      },
    ],
    touch: [{ label: 'Driving', rows: [['Stick', 'Drive'], ['Slide', 'Hold into a turn: the handbrake']] }],
    tips: [
      ['Walt’s Metherria', 'Cook to order, Papa’s style: take the ticket at the hatch, then work the stations along the bench. Every station is scored, and so is the wait. From day three Hank drops by (press H to hide the batch).'],
      ['The title card', 'Type a name and it becomes a Breaking Bad title card.'],
      ['The letter board', 'Rows light up in turn: ring (Space, the button or a tap) to pick the row, then again on the right letter.'],
      ['Inside', 'Order at the Los Pollos Hermanos counter (Gus is serving) and the tray fills up. Then call Saul.'],
      ['Others online', 'Other drivers show as ghost Azteks.'],
    ],
  },
  '/c-137': {
    about: 'The Smiths’ street in 3D, as Morty, with Rick’s cruiser in the garage and a portal to everywhere.',
    keys: [
      { label: 'Walking', rows: [['W A S D / ← ↑ ↓ →', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump'], ['Drag', 'Look round'], ['E', 'Doors, the cruiser, the games'], ['M', 'Things to do']] },
      { label: 'In the cruiser', rows: [['W A S D', 'Fly'], ['Space', 'Climb'], ['Shift', 'Drop'], ['E', 'Land (slow, over open ground)']] },
      { label: 'Portal panic', rows: [['W A S D', 'Move'], ['Mouse', 'Aim: the gun fires on its own'], ['F', 'Auto-fire off (then hold the mouse to fire)'], ['Space / Shift', 'Portal-dash'], ['1 2 3', 'Take a gadget'], ['P', 'Pause']] },
    ],
    touch: [{ rows: [['Stick', 'Walk, or fly'], ['Swipe', 'Look round'], ['Tap', 'Jump, climb, drop and act, on their buttons']] }],
    tips: [
      ['The portal gun', 'Fire it to look through into another dimension.'],
      ['Portal panic', 'Three waves in each of four dimensions; a gadget from Rick’s bench after each, and a boss to portal on. Rick, Morty or Pickle Rick. A controller works too.'],
      ['The Meeseeks box', 'Press the button and give him a task. Give him one he can’t do and he gets help.'],
      ['Interdimensional cable', 'Turn the dial.'],
      ['The Smiths', 'Four of them are a color scheme for the site. Jerry can ask.'],
    ],
  },
  '/c-137/citadel': {
    keys: [{ rows: [...WALK, ['1 2 3 4', 'Answer'], ['Space', 'Drop a wafer (Simple Rick’s)'], ['Esc', 'Leave a scene']] }],
    touch: [{ rows: [...WALK_TOUCH, ['Tap', 'The prompt, and the answers']] }],
    tips: [
      ['Morty Day Care', 'Six Mortys are loose. They run from you, so come at them from the far side and drive them through the gate.'],
      ['Simple Rick’s', 'Lay the next layer as the dispenser swings over the stack. What hangs over is cut off. Three good wafers.'],
      ['The Council', 'Answer the way C-137 would. Grovelling gets you held in contempt.'],
      ['Election day', 'Once the first three are done: hear out three voters, then vote at Candidate Morty’s booth.'],
      ['Red alert', 'The Cop Ricks see in a cone and hear you running. The core, the kiosks and the planters hide you; the benches don’t. Get to the hangar.'],
    ],
  },
  '/dot-matrix': {
    keys: [
      {
        rows: [
          ['W A S D / ← ↑ ↓ →', 'Walk'],
          ['Space / Z', 'Jump (hold to jump higher)'],
          ['X / Enter', 'Read a sign, play the Game Boy, go down a pipe'],
          ['Q E', 'Turn the camera'],
          ['Drag', 'Turn the island'],
          ['M', 'The cartridges, with hints'],
        ],
      },
    ],
    touch: [{ rows: [['Pad', 'Walk'], ['A', 'Jump'], ['B', 'Read, play, go down'], ['Drag', 'Turn the island']] }],
    tips: [
      ['The cartridges', 'Eight of them, each one a project of mine, hidden round the island.'],
      ['Mind', 'Jump on the walkers; walking into one hurts. A plant won’t come up while you stand on its pipe. Three hearts, and a "?" block gives one back.'],
      ['The screen', 'The chip at the top switches between the DMG’s greens, the Pocket’s greys and the Light’s teal.'],
    ],
  },
  '/earth': {
    keys: [
      { label: 'From orbit', rows: [['Drag', 'Turn the globe'], ['Click', 'A place, to fly there'], ['M', 'Down to the globe, or back up']] },
      { label: 'Flying', rows: [['W A S D / ← ↑ ↓ →', 'Turn, climb and descend'], ['Shift / Space', 'Faster'], ['R', 'A barrel roll'], ['Drag', 'Look round'], ['V', 'Cockpit or chase camera'], ['P', 'The passport'], ['N', 'Always day'], ['Esc', 'Take the controls back from the autopilot']] },
    ],
    touch: [{ rows: [['Drag', 'Turn the globe'], ['Stick', 'Fly'], ['Faster', 'Go faster']] }],
    tips: [
      ['From orbit', 'The Earth right now: the sun where it is, so the night side is the real night.'],
      ['The passport', 'Fly over a place to stamp it and get its postcard. Fly here sets the autopilot along the great circle; the arrow at the bottom points at the next place.'],
      ['A controller', 'Works too.'],
    ],
  },
  '/music': {
    keys: [{ label: 'The courtyard', rows: [['W A S D', 'Walk'], ['← →', 'Turn'], ['Drag', 'Look round'], ['E', 'Play the instrument you’re by']] }, { label: 'The sitar', rows: [['hold Space', 'A chikari roll']] }],
    touch: [{ label: 'The courtyard', rows: [...WALK_TOUCH, ['Tap', 'An instrument’s button to play it']] }],
    tips: [
      ['Tune up', 'Pick a Sa and a raga (forty of them, or one of your own), then start the tanpura.'],
      ['Play', 'Click the sitar’s frets, the harmonium’s keys or the tabla. Everything tunes to the same Sa. Record the room keeps what you play.'],
    ],
  },
  '/terminal': {
    keys: [{ rows: [['Enter', 'Run a command'], ['Tab', 'Complete'], ['↑ ↓', 'Walk the history'], ['Ctrl+L', 'Clear']] }],
    tips: [['Commands', 'Type help. Try worlds, order66, deathstar or language.']],
  },
  '/travel': {
    tips: [
      ['The globe', 'Drag to spin it, and click a place to fly there.'],
      ['Fly there yourself', 'Earth, on the universe map, puts you in a little plane to every place on it.'],
      FEED_TIP,
    ],
  },
};

// The site's own keys, after ⌘K (the guide adds that one, in this device's way)
export const SHORTCUTS = [
  ['?', 'This guide'],
  ['Esc', 'Close whatever’s open'],
  ['↑ ↑ ↓ ↓ ← → ← → B A', 'Lightspeed'],
];

export const SITE = [
  ['Two ways round', 'The Universe and Classic switch at the top: fly the site as a universe, or read it as plain pages. Either takes you to the same place in the other, and the site remembers which you picked.'],
  ['Getting around', 'The menu at the top, or the command palette, which goes anywhere and does most things. The Terminal page takes commands too.'],
  ['Colors', 'The dot in the menu picks a color scheme: each company I’ve worked at, any fan theme you’ve unlocked, or your own color. Each scheme brings a background: quiet for the companies, lively for the fan themes (click on empty page). Switch them off at the bottom of the same menu.'],
  ['Languages', 'Read the whole site in Aurebesh, Cybertronian or Dwarf runes, from the Off the clock row, ⌘K, or the Death Star, Middle-earth and Cybertron pages. Back to English is always at the bottom of the screen, or type english.'],
  ['Easter eggs', 'One on each main page, and one more on the page that isn’t there. Some words work typed anywhere: try aurebesh, rollout, mellon, snap, twss, parkour, precious, wubbalubbadubdub or say my name.'],
  ['Achievements', 'Each egg you find is counted; the Dundies in Scranton show you where you stand.'],
];

// A path's entry, with its `key` (the entry's own path) and title, or null
export function guideFor(pathname) {
  const key = guideKeyFor(pathname);
  return key && PAGES[key] ? { key, ...GUIDES[key], ...PAGES[key] } : null;
}
