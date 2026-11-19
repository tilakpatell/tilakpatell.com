// The universe's neighbourhoods: where the fandoms' worlds live, out past
// the Core. Pure numbers, tested in Node: layout.js puts each world at its
// neighbourhood's centre plus its own offset, deep.js its landmarks, and
// regions.js makes each one a region.
//
// The Core (sector 0, 0, 0) holds the home system: the sun and the site's own
// stations (Home, Experience, Projects, Résumé, Contact, Terminal), where
// every new pilot starts, with a handful of wonders round it (the Maw,
// Aurelia, Glacia, the Wanderer, the Graveyard) and the rim. The fandoms
// are out in the Expanse, one to three and a half sectors away (a sector is
// 120,000), each neighbourhood bunched loosely round a landmark, with the
// generated systems all round and between them. The jump gets you there.
//
// Each centre sits where the Expanse's old middle layer (expanse/gen's
// makeSector, fingerprinted and never moved) left the most room in that
// part of the sky: neighbourhoods.test.js holds every member clear of every
// old system and wonder near it. The newer generator (expanse/gen/space.js)
// keeps out of the members by itself (keepOuts.js).
//
// NEIGHBOURHOODS: [{ id, name, centre: [x, y, z], members: { id: [dx, dy, dz] },
//   landmarks: { wonderId: [dx, dy, dz] }, light?: { at: [dx, dy, dz], colour }, about }]
//   (light: what lights a neighbourhood with no star among its landmarks,
//   lighting.js; a light alone, nothing drawn or solid there)
// NEIGHBOURHOOD_OF: id (a world or a wonder) → its neighbourhood's id
// memberAt(id) → [x, y, z] for a member or a landmark, null for anything else

export const NEIGHBOURHOODS = Object.freeze([
  {
    id: 'heroes',
    name: 'Hero Reach',
    about: 'Capes and robots round a red giant.',
    centre: [186000, 300, -152000],
    members: { marvel: [-5200, 300, 2400], invincible: [3800, -250, 4200], transformers: [1200, 450, -5600] },
    landmarks: { ember: [0, 0, 0] },
  },
  {
    id: 'oldroads',
    name: 'The Old Roads',
    about: 'Wizards and rings, in the light of the Veil.',
    centre: [-274000, -250, 126000],
    members: { middleearth: [-7800, -200, 2600], potter: [5600, 350, 6600] },
    landmarks: { veil: [0, 0, 0] },
    light: { at: [0, 0, 0], colour: '#c9a8ff' }, // (the Veil's own young stars)
  },
  {
    id: 'earthside',
    name: 'Earthside',
    about: 'The worlds most like home, round a warm sun.',
    centre: [124000, -125, 232000],
    members: { breakingbad: [-4800, 200, -2600], office: [-1200, -300, 5400], caribbean: [5600, 150, 1800], travel: [2600, 400, -5200] },
    landmarks: { halcyon: [0, 0, 0] },
  },
  {
    id: 'stage',
    name: 'The Stage',
    about: 'Music, alone with a stellar nursery.',
    centre: [-58000, 175, 295000],
    members: { music: [8200, 250, 1500] },
    landmarks: { cradle: [0, 0, 0] },
    light: { at: [0, 0, 0], colour: '#e6f2b0' }, // (the Cradle's newborn stars)
  },
  {
    id: 'arcade',
    name: 'The Arcade Drift',
    about: 'Games, between a pair of suns and a pulsar.',
    centre: [-176000, 240, -196000],
    members: { gaming: [0, 125, 0] },
    landmarks: { twins: [-5200, -100, -2400], lantern: [4800, 200, 3200] },
  },
  {
    id: 'rift',
    name: 'The Curve Rift',
    about: 'Rick and Morty’s world, and the portal into the Central Finite Curve.',
    centre: [-392000, -60, -55000],
    members: { rickmorty: [0, -150, 0] },
    landmarks: {},
    light: { at: [-6000, 1500, 4000], colour: '#b8ffc8' }, // (the rift's glow)
  },
  {
    id: 'maelstrom',
    name: 'The Maelstrom',
    about: 'The hyperspace gate to a galaxy far, far away.',
    centre: [401000, 60, 54000],
    members: { starwars: [0, 0, 0] },
    landmarks: {},
    light: { at: [6000, 1500, -4000], colour: '#cfe0ff' }, // (the Maelstrom's glare)
  },
].map((n) => Object.freeze(n)));

export const NEIGHBOURHOOD_OF = Object.freeze(Object.fromEntries(NEIGHBOURHOODS.flatMap((n) => [...Object.keys(n.members), ...Object.keys(n.landmarks)].map((id) => [id, n.id]))));

const BY_ID = new Map(NEIGHBOURHOODS.map((n) => [n.id, n]));
export const neighbourhoodById = (id) => BY_ID.get(id) ?? null;

export const offsetFrom = (n, [dx, dy, dz]) => [n.centre[0] + dx, n.centre[1] + dy, n.centre[2] + dz];

export function memberAt(id) {
  const n = BY_ID.get(NEIGHBOURHOOD_OF[id]);
  if (!n) return null;
  const off = n.members[id] ?? n.landmarks[id];
  return [n.centre[0] + off[0], n.centre[1] + off[1], n.centre[2] + off[2]];
}
