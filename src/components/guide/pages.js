import { ABOUT } from './abouts';
import { GUIDES, guideKeyFor } from './routes';
import { CYBERTRON_KEYS, CYBERTRON_TOUCH } from './cybertron';
import { TRIBUTE_KEYS, TRIBUTE_PAD, TRIBUTE_TOUCH } from './mario64';

// What the guide says about each page: a line on what it is, its controls
// (`keys` for a keyboard, `touch` for a phone; each a list of groups, a group
// a label and rows of [keys, what they do], keys written as keys.js reads
// them) and its tips. Its title, and whether its first visit gets a note,
// are in routes.js. Loaded with the guide's panel, not before.

// the portfolio pages run into one another (components/feed)
const FEED_TIP = ['Keep scrolling', 'The classic site’s six pages run into one another: reach the end of one and the next begins. After the sixth, the end.'];

// flying, on either map: `guns` are the rows after Fire that only one map
// has (the universe map's weapons; the galaxy's crew powers)
const fly = (guns) => [
  ['W S', 'Throttle'],
  ['A D', 'Roll (or turn: flight settings)'],
  ['← →', 'Swing the nose'],
  ['↑ ↓', 'Nose up and down (all the way over, if you hold it)'],
  ['Space / Shift', 'Boost (the pulse drive, out in the open)'],
  ['hold F', 'Fire'],
  ...guns,
  ['T / Q', 'Next / previous target'],
  ['V', 'Cockpit or chase camera'],
  ['Drag', 'Fly like a stick'],
];
// the universe map's armory (universe/weapons.js)
const WEAPONS = [['R / 1 2 3', 'Weapons: blaster, spread, heavy ordnance (Shift+R back)']];
// the galaxy's crew powers (universe/shipPowers.js): no weapons to switch there
const POWERS = [
  ['G', 'Your crew’s power: Force Focus, Never tell me the odds, the portal gun or Magnets'],
  ['X', 'The big one, once your kills have charged it: a torpedo salvo, Chewie on the guns, the death ray or Say my name'],
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
      ['Company colours', 'Each role re-themes the site as you scroll past it.'],
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
      ['Email', 'Copy email address copies it with one press; ⌘K (Ctrl K) can copy it from anywhere on the site, too.'],
      FEED_TIP,
    ],
  },
  '/universe': {
    about: ABOUT['/universe'],
    keys: [
      { label: 'Flying', rows: [...fly(WEAPONS), ['hold S', 'Drop out of a lane'], ['hold W', 'Carry on through a junction'], ['M', 'The nav map: pick a place and a drive'], ['J', 'Jump to the place picked'], ['E / Enter', 'Land or dock where you are'], ['H', 'The hangar: paint and parts'], ['O', 'Flight settings'], ['Esc', 'Back out to the whole universe']] },
      { label: 'On foot', rows: [['W A S D', 'Walk'], ['Q E', 'Step sideways'], ['Shift', 'Run'], ['Space', 'Jump'], ['Click, then the mouse', 'Look round (Esc lets go)'], ['F / Click', 'Fire'], ['X', 'Play the other one of your crew'], ['B', 'Rick’s next gadget: the portal gun, the freeze ray, the shrink ray'], ['V', 'Out of their eyes'], ['G', 'Through a door, or back into the ship'], ['Enter', 'Into the planet’s page']] },
    ],
    touch: [
      {
        rows: [
          ['Drag', 'Fly, anywhere on the map'],
          ['↑ ↓', 'Hold to pull the nose up and down'],
          ['Tap', 'A planet, station or wonder to fly there; a hunter to lock on'],
        ],
      },
      { label: 'The buttons', rows: [['Boost', 'Hold to go fast'], ['Fire', 'Shoot'], ['View', 'The cockpit'], ['Hangar', 'Paint and parts (the wrench)'], ['Flight settings', 'How it all feels (the sliders)']] },
    ],
    tips: [
      ['Pick a ship', 'Rick and Morty’s cruiser, Luke and Artoo’s X-wing, Han and Chewie’s Falcon or Walt and Jesse’s RV. Each crew has a word about every place. No ship? Pick a place and the camera flies there.'],
      ['Getting about', 'The worlds are far apart. Boost in the open and the pulse drive takes over; it drops back near a place. Or put the nose on a far star and press J to jump to it, or open the nav map (M) and let the ship take you: a jump, super speed or cruise. Star systems are on it too: pick one and the ship flies through the gate. Fly past everything visits every place, nearest first; Esc stops it.'],
      ['Links', 'Every place has a link that opens the map there (/universe/aurelia, say): Copy a link here on the nav map. The terminal’s fly <place> and ⌘K’s Fly to do the same.'],
      ['Deep space', 'Between the worlds are the wonders: a ringed gas giant, an ice giant, two other suns with their own worlds, a black hole, two nebulae, the Citadel of Ricks, a pulsar, a binary star, a rogue planet and a wreck field round a white dwarf, with a rim of ice round the edge of the map. The crew have a word about each.'],
      ['Mind the planets', 'Fly down into a planet’s air and you’re straight into its world; come in boosting and you crash into it. Brush a station and you bounce off.'],
      ['Hunted', 'Now and then someone comes after you, sooner if you’ve been shooting. The guns lock on: shoot at the pip ahead of them and the shots bend home. Lose your shields and you’re back at the nearest place.'],
      ['The Citadel of Ricks', 'Knock out the four shield generators, then only heavy ordnance hurts the core. Everyone online shares the siege.'],
      ['Happenings', 'A Star Destroyer drops out of hyperspace and launches fighters, someone calls for help with pirates on their tail, a convoy goes by, a star flares and rattles the ship, a rift opens ahead (fly in and it drops you elsewhere on the map), and something enormous swims past: purrgil, or a Cromulon. Rocks cross your path (shoot or steer round them), and now and then a bounty hunter comes for you: Boba Fett in Slave I, or Phoenixperson.'],
      ['The black hole', 'The one thing out there you don’t come back from. On its far side is a friend’s universe; Back brings you home.'],
      ['Online', 'Multiplayer, bottom left: everyone else on the map is there in their own ships. Fly together, or shoot each other down.'],
    ],
  },
  '/galaxy': {
    about: ABOUT['/galaxy'],
    keys: [{ label: 'Flying', rows: [...fly(POWERS), ['M', 'The galaxy map: plot a course'], ['J', 'Jump to lightspeed, to the star on your nose, or else to the course you plotted'], ['E / Enter', 'Land on the planet (or board the Death Star)'], ['H', 'The shipyard: build, paint and parts'], ['O', 'Flight settings']] }, { label: 'On the galaxy map', rows: [['M / Esc', 'Close the galaxy map'], ['/', 'Find a system'], ['J', 'Jump to the course you plotted'], ['+ − 0', 'Zoom in, out, the whole galaxy; drag to pan']] }],
    touch: [{ rows: [['Drag', 'Fly'], ['Tap', 'A star’s name to plot a course'], ['Jump', 'Lightspeed, to the star on your nose'], ['Power', 'Your crew’s power'], ['Big one', 'Once your kills have charged it'], ['Shipyard', 'Open the shipyard in the panel: build, paint and parts']] }],
    tips: [
      ['Jumping', 'Turn the nose toward a star and its name comes up; press J, or fly out of the system toward it. A course plotted on the galaxy map (M) stays on your flight HUD, and J with the nose on no star jumps to it. The map filters by era or film, and its layers switch off what you don’t need.'],
      ['Ship powers', 'Each crew has its own. Luke slows time and Artoo locks four torpedoes; Han corkscrews out of trouble and Chewie takes the quad guns; Rick portals onto a tail and fires the death ray; Walt and Jesse’s magnet drags fighters into a ball, then the crystal goes off. The big one charges as you shoot them down.'],
      ['Pickups', 'A fighter you shoot down now and then leaves one behind (an ace or a capital ship always), floating for 25 seconds: fly through it. A repair kit gives back 40 deflectors, Overcharge a faster boost, Rapid fire quicker guns, a bubble shield takes the next 60 damage, and a power cell charges the big one a quarter and cuts the crew power’s cooldown. The effects show over the cluster, and each pickup is a cyan dot on the radar. A jump, a crash or a landing loses them all.'],
      ['The shipyard', 'H, or the wrench in the corner: the same shipyard as on the universe map, and what you fit there is on the ship in both. The secondary and ordnance lines fire on the universe map only; here the crew’s powers take their place.'],
      ['Missions', 'Each system has one. The trench run and boarding the Death Star are playable now; the rest are briefings for games still being built. Watch for the tractor beam at Alderaan.'],
      ['Out there', 'Each system is open 2,400 out from its planet, with three to six places to find in it: a derelict, a comet, a beacon, an outpost. Well out from everything, holding Boost opens the drive into super speed; it eases off again coming up on anything.'],
      ['Online', 'The other pilots in the same system are there with you, in their own ships. The galaxy map shows how many are where.'],
      ['The wars', 'Three wars at once, one for each era: the Clone Wars, the Galactic Civil War and the Remnant War, with the Hutts against everyone. Pick yours on the galaxy map and swear to a side; battles near you count for it, you rise in its ranks, and who holds a system decides who hunts you there and who flies with you.'],
    ],
  },
  '/galaxy/surface': {
    about: ABOUT['/galaxy/surface'],
    keys: [
      {
        rows: [
          ['W A S D', 'Walk (the way the camera faces); on a ride, throttle and steer'],
          ['Shift', 'Run (or boost)'],
          ['Space', 'Jump'],
          ['Click, then the mouse', 'Look round (Esc lets go; the Menu’s Look: Drag to drag instead)'],
          ['Scroll', 'Zoom'],
          ['E', 'Talk, ride (and get off), go in, get in the ship'],
          ['F / Left button', 'Fire your blaster (bursts and pellets as the gun has them); with a lightsaber, a stroke on release: strokes chain, and held is the heavy one, which breaks shields'],
          ['Right button', 'Hold to aim down the sights (the weapon’s zoom; a steadier shot); with a lightsaber, hold to block'],
          ['C', 'Hold to block with the lightsaber: bolts come off the blade, swipes cost your guard; a block as a swipe lands is a parry'],
          ['R', 'Throw the lightsaber (it comes back); with a gun, vent the heat (overheated, hit the blue band)'],
          ['X', 'Dodge: a roll the way you’re going, nothing landing through its start'],
          ['G', 'Your hero’s first power: a Force push (a Jedi), a choke (Vader, Maul), lightning held (the Emperor), or a thermal detonator (anyone else)'],
          ['V', 'The second: a Force pull, a repulse, a rage or a rush (the hero’s own, as the panel says); or the overcharge: no heat and a harder shot for a while'],
          ['Q', 'Things to do'],
          ['Tab', 'Swap to your crewmate'],
          ['L', 'Lock on: the camera stays on the one you’re squared up to (L again lets go)'],
          ['B', 'Hold for the emote wheel (a hero from the 2017 game does its own four)'],
          ['P', 'Out of your own eyes, and back (a figure from the 2017 game, on foot, on a computer)'],
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
          ['Fire', 'Hold to fire (Swing, with a lightsaber: held, the heavy stroke)'],
          ['Throw / Vent', 'Throw the lightsaber, or vent a gun’s heat'],
          ['Block / Aim', 'Hold to block with the lightsaber, or toggle the sights'],
          ['Push / Bomb, Pull / Charge', 'The Force, or the detonator and the overcharge'],
          ['Dodge', 'A roll'],
          ['Lock', 'Lock on: the camera stays on the one you’re squared up to (on by itself when an enemy comes close)'],
        ],
      },
    ],
    tips: [
      ['Play as', 'The button with your name on it, top right: pick who you play as (Luke, Leia, Han, Chewie, Ahsoka, Boba Fett); for a Jedi the blade’s colour, the hilt and the stance (single, double, dual, crossguard); for the rest the gun (the galaxy’s and others’) and two mods on it; and three perks for anyone, Battlefront’s star cards in spirit.'],
      ['The fight', 'Enemies show their health over their heads; the one you’re squared up to wears a ring and is named at the bottom, and your strokes step in to them. Blocking spends your guard: broken, you stagger. A duellist’s guard is the white line over his health: his blade turns your strokes until it breaks. Guns heat up; vent early or ride the lock.'],
      ['The places', 'The compass names the places from the films until you’ve found them, with what the crew have to say about each.'],
      ['Galactic assault', 'On Hoth, Geonosis, Scarif and Endor, a battle for the command posts (from the system’s mission page). Pick a side and a post to deploy at; stand in a post with more of yours than theirs and it turns; take every post of the phase and the next begins. Down, you deploy again for one of your side’s reinforcements.'],
      ['Heroes vs Villains', 'On Hoth, Endor, Tatooine, Geonosis and Kashyyyk, four heroes against four villains in the level’s hero arena, you one of your side as the hero you’re playing. Each side has a target, marked over its head: only a target going down scores, ten points win. Down, you’re back in ten seconds; ten seconds outside the arena’s wall of light and you’re down.'],
      ['Blast', 'On the same five worlds, ten a side on the level’s team-deathmatch ground: no posts, just the score bar. The first side to a hundred kills wins.'],
      ['Leaving', 'Get back in the ship (E by it, or Back to orbit) to take off.'],
    ],
  },
  '/galaxy/mission': {
    tips: [['The briefing', 'Each system’s mission opens with its own crawl. The trench run, boarding the Death Star, Endor’s chase, Lothal’s star map, Dagobah’s swamp and the battles of Hoth, Geonosis, Scarif and Endor play now; the rest are games still being built.']],
  },
  '/deathstar': {
    about: ABOUT['/deathstar'],
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
  // planet flight: begin (scripts/flight-island.mjs removes this block)
  '/fly': {
    about: ABOUT['/fly'],
    keys: [
      {
        rows: [
          ['W S / ↑ ↓', 'Nose down and up'],
          ['A D', 'Bank: the ship turns the way it leans'],
          ['Q E / ← →', 'Turn'],
          ['Shift / R', 'Faster'],
          ['F', 'Slower'],
          ['M', 'The planet map: tap a place or the ground for a waypoint; Esc closes it'],
          ['Space', 'Fire'],
          ['B', 'Build a turret on the ground under you (low and slow)'],
          ['X', 'Take down your own turret, within 30 m'],
        ],
      },
    ],
    touch: [{ rows: [['Stick', 'Fly: up is the nose down, to the side a bank'], ['+ −', 'Faster and slower'], ['Minimap', 'Tap it for the planet map; drag to look about, pinch to zoom, tap for a waypoint'], ['Build', 'A turret on the ground under you']] }],
    tips: [
      ['The ground', 'Made as you fly, from the planet’s seed: the same planet is the same land every time, however far you go.'],
      ['Echo Base', 'On Hoth, straight ahead from where you start: a flat field the snow eases into.'],
      ['Too low', 'Touch the ground and you’re put back up 200 m over where you were.'],
      ['The map', 'The minimap, top right, is the ground round you, drawn as you fly; the planet map shows all you’ve flown over, the named places with how far they are, and the shared world’s cell you’re in.'],
      ['Other planets', 'Fifty, each its own world’s ground: the galaxy’s, Rick and Morty’s moons, the map’s worlds and the Expanse’s. The Menu has a few; any of them is /fly/ and its name.'],
      ['Turrets', 'Built turrets stay for everyone who flies here, and fire at every ship but their builder’s. Shoot one to nothing and it’s gone for everyone.'],
      ['Online', 'Online, you see the pilots in the few kilometres round you, and they see you.'],
    ],
  },
  // planet flight: end
  '/deathstar/inside': {
    about: ABOUT['/deathstar/inside'],
    keys: [
      {
        label: 'Moving',
        rows: [
          ['W A S D / ← ↑ ↓ →', 'Walk'],
          ['Shift', 'Run'],
          ['Space', 'Jump'],
          ['C', 'Crouch'],
          ['Mouse', 'Look (click the station first to hold the pointer)'],
          ['E', 'Use: doors, lifts, consoles, people'],
          ['V', 'Third or first person'],
        ],
      },
      {
        label: 'Fighting',
        rows: [
          ['Click', 'Fire'],
          ['Right-click', 'Aim'],
          ['R', 'Vent the gun before it overheats'],
        ],
      },
      {
        label: 'Aboard',
        rows: [
          ['H', 'Helmet on or off'],
          ['G', 'Roar (as Chewbacca)'],
          ['M / Tab', 'The station’s map'],
          ['1 – 4', 'Choose what to say in a conversation'],
          ['Esc / P', 'Pause'],
        ],
      },
    ],
    touch: [
      {
        rows: [
          ['Stick', 'Walk (push it all the way to run)'],
          ['Drag', 'Look'],
          ['Fire', 'Shoot'],
          ['Aim', 'Hold to aim'],
          ['Use', 'Doors, lifts, consoles, people'],
          ['Jump', 'Jump'],
          ['Crouch', 'Crouch'],
        ],
      },
    ],
    tips: [
      ['Two stations', 'The first Death Star, over Alderaan and Yavin, and the second, over Endor. Pick one, and a side, on the start screen.'],
      ['Rebel or Imperial', 'A Rebel in stormtrooper armour is in disguise: running, shooting or a restricted room makes the garrison wonder, and with the helmet off you’re known at once. An Imperial serves aboard and hunts the intruders.'],
      ['Story or free roam', 'Follow the films’ story, or walk the station as you like: the story waits for you.'],
      ['Security', 'Each section has its own. Seen where you shouldn’t be, it goes to alert, then lockdown: the blast doors seal and squads come looking. Stay out of sight and it stands down.'],
      ['The gun', 'It heats as you fire, and when it’s too hot it vents and won’t fire for a moment. R vents it sooner, at a time you choose.'],
      ['Saving', 'Your story, the rooms you’ve seen and the secrets you’ve found are kept on this device.'],
    ],
  },
  '/caribbean': {
    about: ABOUT['/caribbean'],
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
    about: ABOUT['/invincible'],
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
          ['R', 'Take the radio’s call (a chase, a photo, Eve’s race)'],
          ['Q', 'Call a mission off'],
          ['H / ?', 'The guide'],
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
      ['A pad', 'In the city: the left stick flies, the right stick looks, A goes up, B down, RT is flat out, X punches and Y goes in.'],
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
    about: ABOUT['/middle-earth'],
    tips: [
      ['The map', 'Pick a place and the camera flies down to it. The map button takes you back up. A wax seal marks each place you’ve won.'],
      ['The Doors of Durin', 'Move your pointer over the cliff to light the lines, or call the moon. Then say the word: read the arch.'],
      ['The bridge', 'Face the Balrog. Raise the staff (Space) as the whip falls; strike the bridge (Enter) with it right over the deep for a perfect.'],
      ['Gorgoroth', 'Hold to walk (Space or →). Let go when the Eye’s light comes close: standing still, the elven cloaks hide you. Rest before the Ring gets too heavy.'],
      ['The Ring', 'Hold it to the fire to read it, put it on (Esc takes it off), or cast it in.'],
    ],
  },
  '/middle-earth/place': {
    about: ABOUT['/middle-earth/place'],
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
    about: ABOUT['/avengers'],
    keys: [
      { label: 'On the ground', rows: [['W A S D / ← ↑ ↓ →', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump (at a wall: run up it)'], ['Drag', 'Look round'], ['E / Enter', 'Go in at a door'], ['M', 'Things to do: the buildings, with Go there'], ['Esc', 'Out of a game']] },
      { label: 'Swinging', rows: [['hold Space', 'In the air: web a roof edge, tree or mast and swing'], ['Right-click', 'Hold to swing, too'], ['Shift', 'In the air: zip'], ['Q', 'Launch to a perch'], ['T', 'A flip (or a twist, with a direction held)']] },
      { label: 'In the armour', rows: [['W A S D', 'Fly (it leans into its speed)'], ['Space', 'Climb'], ['Shift', 'Come down'], ['E', 'Step out, wherever you are']] },
      { label: 'Anywhere', rows: [['O', 'Settings'], ['P', 'Photo mode: drag the camera round him, [ and ] for the lens']] },
    ],
    touch: [
      { rows: [['Stick', 'Walk (all the way to run)'], ['Jump', 'Hold in the air to swing (at a wall: run up it)'], ['Zip', 'Zip'], ['Perch', 'Launch to a perch'], ['Trick', 'A flip in the air']] },
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
    about: ABOUT['/scranton'],
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
    about: ABOUT['/cybertron'],
    keys: [
      // (the world at the top of the page, its start card's keys: ./cybertron.js)
      { label: 'The world', rows: CYBERTRON_KEYS },
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
    touch: [
      { label: 'The world', rows: CYBERTRON_TOUCH },
      { label: 'Roll out', rows: [['Drag', 'Steer'], ['Tap', 'The buttons to boost, jump and transform']] },
    ],
    tips: [
      ['Sides', 'Join the Autobots or the Decepticons: the site changes colour with you, and so does who you can transform.'],
      ['Roll out', 'As a vehicle you’re fast and smash debris; as a robot you fight and jump the barricades, but standing up burns energon. Transforming takes half a second: read the road. Clearing an obstacle pays double if you changed at the last moment.'],
      ['Ground bridge', 'Hold the button, Space, or the scene to open the bridge as an Autobot reaches it. Let go before a Vehicon does.'],
      ['The Iacon database', 'Pick what each Cybertronian entry says before the decryption bar fills. Show the key to read it letter by letter.'],
      ['The roster', 'Roll out as any of them to wear their colours. The soundboard plays through Soundwave’s visor.'],
    ],
  },
  '/albuquerque': {
    about: ABOUT['/albuquerque'],
    keys: [
      {
        label: 'Driving',
        rows: [
          ['W A S D / ← ↑ ↓ →', 'Drive'],
          ['hold Space', 'Handbrake: hold it into a turn and the tail swings round'],
          ['E / Enter', 'Go in (or wash the Aztek at A1A)'],
          ['M', 'Things to do: the places, as each one opens'],
          ['R', 'Run a delivery'],
          ['B', 'Stuck? Back to where you last drove clear (Y on a pad)'],
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
    about: ABOUT['/c-137'],
    keys: [
      { label: 'Walking', rows: [['W A S D / ← ↑ ↓ →', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump'], ['Click, then the mouse', 'Look round (Esc lets go)'], ['E', 'Doors, the cruiser, the games, the portal gun on Rick’s bench'], ['P', 'The portal gun, from anywhere'], ['M', 'Things to do']] },
      { label: 'In the cruiser', rows: [['W A S D', 'Fly'], ['Space', 'Climb'], ['Shift', 'Drop'], ['E', 'Land (slow, over open ground)']] },
      { label: 'Portal panic', rows: [['W A S D', 'Move'], ['Mouse', 'Aim: the gun fires on its own'], ['F', 'Auto-fire off (then hold the mouse to fire)'], ['Space / Shift', 'Portal-dash'], ['1 2 3', 'Take a gadget'], ['P', 'Pause']] },
      { label: 'Total Rickall', rows: [['Mouse', 'Aim (click first to hold the pointer)'], ['E', 'Remember the one in the crosshair'], ['F / Click', 'Shoot them'], ['Tab', 'Lock on: the crosshair stays on them as you move'], ['Esc', 'Stop the game']] },
      { label: 'Through the portal', rows: [['E', 'Talk, take, look, free: whatever the prompt says'], ['F', 'Fire, in a fight (Evil Rick’s lair, the Blood Dome)'], ['Tab', 'Lock on, in a fight: Morty turns to face them'], ['Run', 'From whoever’s after you: the map shows them red']] },
    ],
    touch: [
      { rows: [['Stick', 'Walk, or fly'], ['Swipe', 'Look round'], ['Tap', 'Jump, climb, drop and act, on their buttons'], ['Portal gun', 'Its button at the top: pick where the garage portal goes']] },
      { label: 'Total Rickall', rows: [['Swipe', 'Aim'], ['Tap', 'Shoot the one in the crosshair (or Remember and Shoot, on their buttons)'], ['Lock', 'The crosshair stays on them as you move']] },
      { label: 'Through the portal', rows: [['Tap', 'The star fires, in a fight'], ['Lock', 'Face whoever you’re fighting (on by itself when they come close)']] },
    ],
    tips: [
      ['The portal gun', 'It’s on Rick’s bench in the garage: E there, or P (its button on a phone) anywhere, and pick a place. Then step through the portal on the garage’s west wall: twenty-six places from the show, and Blips and Chitz. Everyone in them does something; some of them come for you, and caught, you’re back at the door. Three slips to spot, a ticket to find, a cell to open, a ring to step into.'],
      ['The planets', 'Gazorpazorp, Planet Squanch, Bird World and the rest of the show’s planets are on the universe map, in the Rick and Morty sector (through the green portal beside the Rick and Morty planet): land on one and you’re in it. What you do there counts on this list (M) too.'],
      ['Portal panic', 'Three waves in each of four dimensions; a gadget from Rick’s bench after each, and a boss to portal on. Rick, Morty or Pickle Rick. A controller works too.'],
      ['Total Rickall', 'Pick up the egg on the living-room bookcase. A parasite only ever leaves good memories of itself, so shoot the ones nobody remembers a bad day with, and nobody else.'],
      ['The Meeseeks box', 'Press the button and give him a task. Give him one he can’t do and he gets help.'],
      ['Interdimensional cable', 'Turn the dial.'],
      ['A look through', 'Past the street, the page’s Fire the portal gun button shows you another dimension. It’s only a look: the gun that takes you is Rick’s, on his bench (P).'],
      ['The Smiths', 'Four of them are site colours. Jerry can ask.'],
    ],
  },
  // a Rick and Morty planet, landed on from the universe map (/c-137/<id>)
  '/c-137/planet': {
    about: 'A planet from the show, landed on from the universe map. Gazorpazorp is a whole world: the cruiser sets down and you climb out as Rick, Morty beside you. The others you walk into as Morty, through a portal, with something to do.',
    keys: [
      {
        rows: [
          ['W A S D / ← ↑ ↓ →', 'Walk'],
          ['Shift', 'Run'],
          ['Space', 'Jump'],
          ['Drag', 'Look round'],
          ['E', 'Talk, take, ride, get in the cruiser: whatever the prompt says'],
          ['F', 'Fire the portal gun (on a planet the cruiser landed on)'],
          ['M', 'Things to do'],
          ['B', 'Hold for the emote wheel'],
          ['Esc', 'Back to the cruiser and up to space'],
        ],
      },
      {
        label: 'On a ride',
        rows: [
          ['W S', 'Throttle, and back'],
          ['A D', 'Steer'],
          ['Shift', 'Boost'],
          ['Space', 'Climb (the glider: let go and it sinks)'],
          ['E', 'Get off'],
        ],
      },
    ],
    touch: [{ rows: [...WALK_TOUCH, ['Tap', 'Jump, fire and act, on their buttons']] }],
    tips: [
      ['The way out', 'Where the cruiser set you down, E at it takes off, back out to space by the planet. On a planet you walked into, the portal you came in by, just behind you, does it.'],
      ['The compass', 'The places to find are on the bar at the top, with how far: walk up to one and it’s found, and kept for next time.'],
      ['Run', 'Some of the people here come for you. Caught, you’re back where you came in.'],
      ['Rides', 'Where the cruiser set down there’s something to ride: the rock sled on Gazorpazorp. E at it gets on; a hover rides over water as well as sand.'],
      ['A minute', 'On Planet Squanch and the Purge Planet, once it goes wrong, get back through the portal inside a minute.'],
      ['The list', 'On a planet you walked into, what you do counts on Dimension C-137’s list of things to do too.'],
    ],
  },
  '/c-137/citadel': {
    about: ABOUT['/c-137/citadel'],
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
    about: ABOUT['/dot-matrix'],
    keys: [
      {
        rows: [
          ['W A S D / ← ↑ ↓ →', 'Walk'],
          ['Space / Z', 'Jump (hold to jump higher)'],
          ['X / Enter', 'Read a sign, play the Game Boy or the N64, go down a pipe'],
          ['Q E', 'Turn the camera'],
          ['Drag', 'Turn the island'],
          ['+ − / wheel', 'Zoom'],
          ['M', 'The cartridges, with hints'],
        ],
      },
    ],
    touch: [{ rows: [['Pad', 'Walk'], ['A', 'Jump'], ['B', 'Read, play, go down'], ['Drag', 'Turn the island']] }],
    tips: [
      ['The cartridges', 'Eight of them, each one a project of mine, hidden round the island.'],
      ['Mind', 'Jump on the walkers; walking into one hurts. A plant won’t come up while you stand on its pipe. Three hearts, and a “?” block gives one back.'],
      ['The screen', 'Screen, in the Menu, switches between the DMG’s greens, the Pocket’s greys and the Light’s teal.'],
    ],
  },
  '/dot-matrix/64': {
    about: ABOUT['/dot-matrix/64'],
    keys: [
      {
        label: 'The N64 (your own ROM)',
        rows: [
          ['W A S D', 'Control Stick'],
          ['Space', 'A (jump)'],
          ['J', 'B (punch)'],
          ['Shift', 'Z (crouch)'],
          ['← ↑ ↓ →', 'C buttons (the camera)'],
          ['Enter', 'Start'],
          ['Q E', 'L and R'],
        ],
      },
      {
        label: 'The fan tribute',
        rows: TRIBUTE_KEYS, // (the pause screen's too: ./mario64.js)
      },
    ],
    touch: [
      { label: 'The N64 (your own ROM)', rows: [['On-screen pad', 'The emulator’s own N64 controller']] },
      { label: 'The fan tribute', rows: TRIBUTE_TOUCH },
    ],
    tips: [
      ['The N64', 'It plays a real N64 game: give it your own Super Mario 64 ROM (.z64, .n64 or .v64) and it boots in the browser. The file stays on your device, kept for next time until you forget it. A controller works; the emulator’s menu along its bottom edge has its controls, save states and full screen.'],
      ['The paintings', 'In the tribute: jump into one to go to its world. Each world has three Power Stars; a star sends you back to the castle.'],
      ['The star doors', 'They open at so many stars. The number is on the door.'],
      ['Moves', 'Run and turn hard to side flip; crouch and jump to backflip; run, crouch and jump to long jump. Jump into a wall and jump again as you touch it to wall kick.'],
      ['Health', 'Eight wedges. A coin gives one back, and fifty coins are a life. Under water the meter is your air: come up before it runs out.'],
      ['Bob-omb Ridge', 'King Bob-omb is on the summit: get behind him, pick him up and throw him. Eight red coins make a star. Pound the Chain Chomp’s post three times.'],
      ['The look', 'On the title and the pause menu: Modern, Ultra or the N64’s own.'],
      ['A controller', TRIBUTE_PAD],
    ],
  },
  '/dot-matrix/minecraft': {
    about: ABOUT['/dot-matrix/minecraft'],
    keys: [
      {
        rows: [
          ['W A S D / ← ↑ ↓ →', 'Walk'],
          ['Mouse', 'Look (click the world first to hold the pointer)'],
          ['Space', 'Jump; swim up'],
          ['Shift', 'Sneak (you won’t walk off an edge)'],
          ['Ctrl / W twice', 'Sprint'],
          ['Click (hold)', 'Dig the block under the crosshair'],
          ['Right-click', 'Place the held block; open a crafting table'],
          ['1 – 9 / wheel', 'The hotbar'],
          ['E', 'The inventory and its 2 × 2 crafting'],
          ['Q', 'Drop one of what you hold (Ctrl Q: all)'],
          ['Esc', 'Pause'],
        ],
      },
    ],
    touch: [{ rows: [['Stick', 'Walk'], ['Drag', 'Look'], ['Jump', 'Jump; swim up'], ['Sneak', 'Sneak']] }],
    tips: [
      ['The game itself', 'With the password, Minecraft 1.12.2 and 1.8.8 run right here (Eaglercraft): singleplayer worlds saved on this device, worlds to import and export, and Open to LAN for friends. Its controls are the game’s own.'],
      ['The tribute', 'Without it, the tribute built for this site: the keys above.'],
      ['The world', 'Endless, and made from its seed: the same seed is the same world. New world on the title starts another.'],
      ['The textures', 'The game’s own, from Minecraft 1.21.11, used with Mojang’s permission.'],
      ['Crafting', 'A log makes four planks, two planks four sticks, four planks a crafting table. Right-click the table for its 3 × 3: three planks over two sticks is a pickaxe. In a screen, click picks up and puts down, right-click halves a stack or puts one, Shift-click sends it across.'],
      ['Saving', 'What you dig and build is kept on this device, and the same world comes back next time.'],
      ['The night', 'A day is twenty minutes. Torches (coal over a stick) and glowstone push the dark back; a bed (three wool over three planks) sleeps the night away and moves where you wake.'],
      ['Underground', 'Caves, ores, water and lava that flow, a furnace (ore and coal), a chest, hunger, and the night that kills.'],
    ],
  },
  '/earth': {
    about: ABOUT['/earth'],
    keys: [
      { label: 'From orbit', rows: [['Drag', 'Turn the globe'], ['Click', 'A place, to fly there'], ['M', 'Down to the globe, or back up']] },
      { label: 'Flying', rows: [['W A S D / ← ↑ ↓ →', 'Turn, climb and descend'], ['Shift / Space', 'Faster'], ['R', 'A barrel roll'], ['Drag', 'Look round'], ['V', 'Cockpit or chase camera'], ['P', 'The passport'], ['N', 'Always day'], ['Esc', 'Take the controls back from the autopilot']] },
    ],
    touch: [{ rows: [['Drag', 'Turn the globe'], ['Stick', 'Fly'], ['Faster', 'Go faster'], ['Roll', 'A barrel roll']] }],
    tips: [
      ['From orbit', 'The Earth right now: the sun where it is, so the night side is the real night.'],
      ['The passport', 'Fly over a place to stamp it and get its postcard. Fly here sets the autopilot along the great circle; the arrow at the bottom points at the next place.'],
      ['A controller', 'Works too.'],
    ],
  },
  '/music': {
    about: ABOUT['/music'],
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
  ['?', 'The guide'],
  ['Esc', 'Close whatever’s open'],
  ['↑ ↑ ↓ ↓ ← → ← → B A', 'Lightspeed'],
];

export const SITE = [
  ['Two ways round', 'The Universe and Classic switch at the top: fly through the universe, or read the classic site. Either takes you to the same place in the other, and the site remembers which you picked.'],
  ['Getting around', 'The menu at the top, or the command palette, which goes anywhere and does most things. The Terminal page takes commands too.'],
  ['Colours', 'The dot in the menu picks the site’s colours: each company I’ve worked at, any fan world’s you’ve unlocked, or your own. Each brings a background: quiet for the companies, lively for the fan worlds (click an empty part of the page). Switch them off at the bottom of the same menu.'],
  ['Settings', 'The gear beside the colours (or ⌘K, Settings) sets the quality: Auto picks what this machine can draw, or choose Low, Medium, High or Ultra yourself. Sound, motion, sharpness and what your device is doing are there too.'],
  ['Languages', 'Read the whole site in Aurebesh, Cybertronian or Dwarf runes, from the Off the clock row, ⌘K, or the Death Star, Middle-earth and Cybertron pages. Back to English is always at the bottom of the screen, or type english.'],
  ['Easter eggs', 'One on each main page, and one more on the page that isn’t there. Some words work typed anywhere: try aurebesh, rollout, mellon, snap, twss, parkour, precious, wubbalubbadubdub or say my name.'],
  ['Achievements', 'Each egg you find is counted; the Dundies in Scranton show you where you stand.'],
];

// A path's entry, with its `key` (the entry's own path) and title, or null
export function guideFor(pathname) {
  const key = guideKeyFor(pathname);
  return key && PAGES[key] ? { key, ...GUIDES[key], ...PAGES[key] } : null;
}
