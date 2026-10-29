import { UNIVERSES } from '../universe/universes';
import { classicPathFor, readStart, universePathFor, viewOf } from '../../lib/view';

// The hidden worlds, one per fandom, each a page of its own (the universes
// on the map that have one, and the pages inside them: Star Wars has the
// galaxy, and the Death Star in it), in map order.
export const WORLDS = UNIVERSES.filter((u) => u.world).flatMap((u) => [{ to: u.to, label: u.world, from: u.label }, ...(u.pages ?? []).map((p) => ({ to: p.to, label: p.world, from: u.label }))]);

// What each world downloads when it opens (models, textures, skies,
// sound), in MB, measured on a phone-sized screen and rounded up: a phone
// asks before loading the heavy ones (WorldGate, lib/device's worldCheck).
// A world on the world runtime (src/runtime) says the same in its module's
// `mb` (its test checks they agree).
export const WORLD_MB = {
  '/universe': 6, // not a world (nothing gates it), but the map's own download, for the tour's "Open the universe map · N MB" on a phone: the planets' textures, the stations and ships, from /home at a phone's size (5.7 MB measured 2026-10-21, lane C2: 6.9 before the Star Wars fleet's gen3d interceptor, 746 KB, and Meshy Slave I, 477 KB, gave way to the game's far copies, 16 KB each)
  '/caribbean': 16, // Dead Man's Tide's ships and sea creatures
  '/invincible': 7, // the three HD figures and the city's three skies, and the street furniture and tenements (the Downtown City MegaKit's two tenements, its props and the Street Pack: 3.2 MB, 2026-10-22)
  '/hogwarts': 23, // the install's pack as built: Lane D's 21.2 MB (the Middle-earth figures standing in for the castle's people until Lane B's land, 8.6; the physics' wasm the broom and the knockables bring, 6.4; the page) and the grounds' (the castle's three scans and the ground's four, 2.9, the weather's sheets; the MegaKit's grounds files were already in it); Lane G measures it from a walk
  '/cybertron': 38, // Iacon at war's robots, Metroplex and the city's kit (the world at the top), and below it Roll out's cast, scanned ground, rocks and sky, the statues, and Optimus's transformation; and Rapier (1.7 MB) for Iacon's loose crates, on a computer that loads it (never a phone)
  '/avengers': 13, // the walkable compound's sky, scanned ground and trees, Spider-Man and the people from Sketchfab (each building's game more as you go in); and Rapier (1.7 MB) for the lawn's props, on a computer that loads it (never a phone)
  '/c-137': 18, // about: the Smiths' street, the house, the school and Blips and Chitz, the Smiths and the cruiser; Portal panic's cast; the Citadel inside, its cast, the Council and the crowd's light copies (partly added up from the files); the town round the street, 2.3 more (Quaternius's street lights, signs, flowers, bushes and rocks, the bronze Reverse Giraffe, and the principal, a Meeseeks, a Gromflomite and a policeman walking it). Mortytown is about 11 more, fetched when the lift goes down
  '/albuquerque': 22, // the town's buildings, cars, the RV and the cast, and Metherria's cast and lab; and Rapier (1.7 MB) for the street's props, on a computer that loads it (never a phone)
  '/scranton': 5, // the office cast and set (the walkable office and the one from above share them)
  '/galaxy': 19, // (17 until the 2017 cast, phase 2: Hoth's models at a phone's level went from 18.1 to 19.3 MB with its troopers', pilots', droids' and tauntauns' light cuts and their packs, galaxy-check's measure; 10 until the 2017 heroes: a world with Luke and Vader adds their light cuts and the game's clip packs, 7 MB at mid, measured on Hoth when the light cuts carried 1024 maps; at 512 they are 0.6 and 0.7 MB, so the true figure is lower and 17 holds; at high their plain files, 1.9 and 2.4 MB) drawn in code (its planets, most of its ships), but for the big ships, the Death Star and its trench, Slave I and the Falcon; and down on a world, its models (its people, walkers, landmarks: a few MB a world); and Rapier (1.7 MB) for the loose crates by a site's stacks, on a computer that loads it (never a phone)
  '/deathstar': 1, // drawn in code, but for the X-wing (a third of an MB)
  // planet flight: begin (scripts/flight-island.mjs removes this block)
  // the ground is made in a worker from the planet's seed and wears the galaxy's scans (a few at a planet, under 2 MB); Coruscant adds its film-made Senate, Temple and tower (2.2 MB);
  // the POIs' buildings and the kit clutter round where it starts add the heaviest planet's 16.8 MB at mid (Naboo, its AAT, MTT, N-1 and droidekas
  // the game's own, natively, at their light cut since lane V; Middle-earth 11.2, Geonosis 10.8, Mustafar 7.8, Yavin 7.5, Lothal 7.4, Tatooine 5.9,
  // the rest 5.2 or less, an Expanse planet 1.5 at most: expanse/flight/landmarkFiles.test.js)
  '/fly': 22,
  // planet flight: end
  '/deathstar/inside': 6, // aboard the station: the first room's kit and textures at phone size, and the cast it starts with (people, guns, the borrowed clips) (3.8 MB measured 2026-10-21 at a phone's mid, lane C3, the cast on the game's bodies: 2.7 before; a Rebel's story start, the Falcon's crew on the heroes' light cuts, fetches 16.7 MB of models where it was 5.4, past this row's first room)
  '/middle-earth/road': 27, // the Road ridden end to end on high, every file once: 26.1 MB, the boot 7.1 (lab/road/measure-ride.mjs, 2026-10-25)
  '/middle-earth': 1, // the Red Book is drawn in code; Gandalf through its window is the cast’s model and its three clips, 0.52 MB, fetched the first time the window is looked through (the map hub’s two places are under a tenth of an MB)
  '/music': 7, // the music planet's courtyard: its instruments, chhatri, lamps and gaddi (Meshy models), sandstone, a dusk sky
  '/dot-matrix': 1, // drawn in code
  '/dot-matrix/64': 7, // the castle's and Bob-omb Ridge's texture sets at phone size, two skies, and Mario, the cast and the props (fan-made Sketchfab models, 2 MB)
  '/earth': 2, // NASA's globe at phone size, the stars and the plane
  '/dot-matrix/minecraft': 2, // drawn in code from the pack's tiles: the block strip, the skins and the sky's and HUD's sprites (under a tenth of an MB today)
  '/battlefront': 0, // bf2-web's engine: its own page and build, from the private bucket (cloudflare/play.js), not the site's files
};

// The worlds that need a real GPU (lib/fit's starWarsFit): the Star Wars
// worlds, drawn from the 2017 game's own levels, cast and ships, the
// heaviest assets on the site (the owner's word, 2026-10-13). A device
// without one is shown WorldGate's card instead. The trench run, /deathstar,
// is drawn in code (a third of an MB) and plays anywhere.
export const NEEDS_GPU = ['/galaxy', '/battlefront', '/deathstar/inside'];
export const needsGpu = (pathname) => NEEDS_GPU.some((to) => pathname === to || pathname.startsWith(`${to}/`));

// The world a path is in: '/middle-earth/moria' is Middle-earth. Some
// worlds sit inside another's address ('/dot-matrix/64' inside
// '/dot-matrix'), so the longest match wins: each gets its own download size
// and its own phone gate, not its parent's.
export const worldAt = (pathname) =>
  WORLDS.filter((w) => pathname === w.to || pathname.startsWith(`${w.to}/`)).reduce((best, w) => (best && best.to.length >= w.to.length ? best : w), null);

// The way out of a world, for the view the visitor is in (the glossary's
// last row): "Universe map", back to this world's place on the map, or
// "Classic site", to the pages, for one who reads the site as pages. For a
// world's HUD Menu (runtime/hud's Menu takes it as it is).
export const wayOut = (pathname, start = readStart()) =>
  viewOf(pathname, start) === 'classic' ? { label: 'Classic site', to: classicPathFor(pathname) } : { label: 'Universe map', to: universePathFor(pathname) };
