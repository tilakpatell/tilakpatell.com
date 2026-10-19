// A line on what each page is and what you do there, written once: the
// guide (pages.js) opens on it, a world's basics (tour/briefs.js) begin with
// it, and the player's tour starts each world's card with it. Keyed as the
// guide is (routes.js). Plain data, importing nothing, so the tour's chunk
// can have it for next to nothing.

export const ABOUT = {
  '/universe': 'The whole site as places in space: the stations round the sun are its pages, the planets in deep space its worlds. Fly a ship to any of them, or pick one.',
  '/galaxy': 'Twenty-four star systems from the films, shows and games: fly between them, land on their planets, and pick a side.',
  '/galaxy/surface': 'A world from the films, on foot: its places to find, its people to talk to, things to ride.',
  '/deathstar': 'That’s no moon. Open any part of the station on the technical readout, fire the superlaser, or fly the trench run.',
  '/fly': 'A ship low over a planet that never ends: Hoth’s snowfields and ridges, Echo Base flat among them, and forty-nine more worlds.', // planet flight (scripts/flight-island.mjs removes this row)
  '/deathstar/inside': 'Still being built: both Death Stars, to walk room by room. For now the page says what’s coming.',
  '/caribbean': 'You’re Jack Sparrow at the Black Pearl’s helm in Dead Man’s Tide: sink the patrol, take the chests, then face the kraken.',
  '/invincible': 'The Graysons’ city, to fly about as Mark: race Dad’s rings, punch the Flaxans out of the sky, and climb to space.',
  '/middle-earth': 'The road from Hobbiton to Mount Doom. At each stop, walk as Frodo, cook in its kitchen and play its game.',
  '/middle-earth/road': 'One ride from Bag End to the Grey Havens, the films’ moments round you. The games wait at its end.',
  '/middle-earth/place': 'Walk the place as Frodo, then cook in its kitchen, Overcooked-style, alone or with friends.',
  '/avengers': 'The compound in 3D, as Spider-Man: swing across it, and win each building’s game to gather the Infinity Stones.',
  '/scranton': 'Dunder Mifflin in 3D, as Jim: put the stapler in Jell-O, carry Kevin’s chili, and get through the week to a Dundie.',
  '/cybertron': 'Iacon at war, to walk and drive as Optimus: transform any time, take the missions, and join the Autobots or the Decepticons.',
  '/albuquerque': 'Drive round town in Walt’s Aztek. Places open up as Walt’s career grows, each with its own game.',
  '/c-137': 'The Smiths’ street in 3D, as Morty: dial the portal gun to twenty-six places from the show, or take Rick’s cruiser up.',
  '/c-137/citadel': 'The Citadel of Ricks, as Rick C-137. Round up the day care’s Mortys, stack Simple Rick’s wafers, face the Council, then vote on election day.',
  '/dot-matrix': 'A Game Boy island: find the eight cartridges hidden round it, each a project of mine, and play the giant Game Boy.',
  '/dot-matrix/64': 'A Super Mario 64 tribute: Peach’s castle and Bob-omb Ridge, rebuilt in the browser. Triple jump, throw King Bob-omb, find Power Stars.',
  '/dot-matrix/minecraft': 'A Minecraft tribute built here: an endless world of blocks, made from a seed. Dig, build, craft, and see out the night.',
  '/earth': 'The Earth right now, from orbit. Pick a place, fly there in a little plane and get your passport stamped.',
  '/music': 'A sandstone courtyard at dusk: pick a raga, play the sitar, harmonium and tabla over the tanpura, and record the room.',
};
