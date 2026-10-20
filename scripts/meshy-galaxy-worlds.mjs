// The new worlds' own buildings (the charted worlds and the 2017 game's
// drop, surface/sites/prequels.js, rebellion.js, shows.js and drop.js): one
// landmark a world, in place of the props built in code they stood on till
// now, made by scripts/meshy-galaxy-buildings.mjs like its own and in its
// format (that script's header has the fields). Nineteen are lifted out of
// a Wookieepedia picture of the place (the crops the desktop's gen3d asks,
// issues #1046 to #1069, were cut from); five, which no picture shows whole,
// are drawn from words first. Kept in a file of their own; their tasks go in
// scripts/meshy-galaxy-worlds-tasks.json (MESHY_TASKS), made on the account
// whose key is MESHY_API_KEY_ACC_3 (a task is read back with the key that
// made it).
//
//   MESHY_API_KEY=$MESHY_API_KEY_ACC_3 MESHY_TASKS=scripts/meshy-galaxy-worlds-tasks.json MESHY_REVIEW=lab/meshy/worlds node scripts/meshy-galaxy-buildings.mjs <step> <kind …>

// a picture's building, lifted with the finer image model (it keeps the
// paint and the small parts), 2K maps
const lifted = (ref, crop, lift, metres, along, more = {}) => ({ ref, crop, lift, metres, along, lifter: 'nano-banana-pro', tris: 40000, tex: 2048, ...more });
// one drawn from words first
const drawn = (prompt, metres, along, more = {}) => ({ prompt, metres, along, tris: 40000, tex: 2048, ...more });

export const BUILDINGS = {
  // Utapau: a building of Pau City in its sinkhole's wall (a Revenge of the Sith still)
  pautower: lifted('File:Ossic building Pau City.jpg', [0, 0, 0.235, 1], 'the tall pale rounded tower (stacked bulbous bone-white domes of weathered plaster, each narrower than the one below, ringed with thin dark window slits, a small cone-topped spire on top and a curved landing ledge jutting from its side), standing on its own, without the sinkhole wall or the creatures', 60, 'h'),
  // Mygeeto: a tower of its crystal cities (a Revenge of the Sith still)
  mygeetotower: lifted('File:Mygeetobridgebattle.png', [0.584, 0.551, 0.141, 0.449], 'the tall column of stacked thick rounded discs of dull copper-pink metal (like a pile of fat rings, each one swelling out and pinched in, thin glowing white seams between them, a ribbed core up the middle), the whole tower from its foot to its top, without the other towers, the snow or the smoke', 150, 'h', { hero: true }),
  // Saleucami: Cut Lawquane's farmhouse (The Clone Wars, “The Deserter”)
  lawquanefarm: lifted('File:Lawquane farm.png', [0.26, 0.074, 0.172, 0.282], 'the low round farmhouse (a wide dome of sun-baked tan adobe and patched metal sheets, a small raised square lantern with a little pitched roof on its top, a wide arched doorway in its front, pipes and a few tanks round its base), in plain midday daylight, without the fields or the people', 16, 'w', { tris: 25000 }),
  // Cato Neimoidia: a bridge city under its rock arch (Revenge of the Sith's production art)
  catobridge: lifted('File:Cato Neimoidia concept art.jpg', [0.019, 0.028, 0.969, 0.877], 'the great natural arch of brown rock spanning between two craggy rock pillars, with a long curved city of pale domed halls, arched windows and thin spires hanging down from under the arch', 170, 'w', { hero: true }),
  // Polis Massa: the base's domes (Revenge of the Sith's production art)
  massabase: lifted('File:Polis Massa Base AoRSR.png', [0, 0.19, 0.388, 0.531], 'the cluster of round squat domed buildings of grey metal (each a drum with a shallow domed roof and two bands of lit windows round it, a small round tower behind), joined by low round tube corridors, on a flat patch of grey rock', 60, 'w', { hero: true }),
  // Malastare: the Dug palace (The Clone Wars)
  dugpalace: lifted('File:Malastare Imperial Palace.png', null, 'the dark fortress palace (a wide sloping base of dark stone ribs with rows of small glowing amber windows, rising into a crown of jagged black blade-like spires that lean outwards round one tall central needle spire), in plain overcast daylight, without the sky or the hills', 80, 'h', { hero: true }),
  // Jedha: the Temple of the Kyber (Secrets of the Rebellion's painting of the Holy City)
  kybertemple: lifted('File:JedhaCity-SoR.png', [0.708, 0.085, 0.141, 0.569], 'the tall tapering tower of pale sandstone slabs (a narrow four-sided obelisk built of huge leaning stone panels, a dark slot up its face, standing on a wide stepped base of stone blocks), without the city round it', 90, 'h', { hero: true }),
  // Eadu: the Imperial research facility on its ridge (a Rogue One still)
  eadulab: lifted('File:Eadu Scientific research base.png', [0.047, 0, 0.741, 1], 'the dark Imperial research facility (a tall black angular wedge-shaped tower leaning back like a fin, a long straight landing platform of dark grey metal running out from its foot, round lit pods and gantries along the platform), in plain grey daylight so its shape and its grey metal show, without the rain, the rocks or the ships', 90, 'w', { hero: true }),
  // Lah'mu: the Erso homestead (a Rogue One still)
  ersohome: lifted('File:Erso homestead.png', [0.428, 0, 0.572, 0.59], 'the low wide dome of weathered white-grey concrete half sunk into the ground, with a tall thin white mast of stacked vaporator rings and small dishes standing beside it', 26, 'w', { tris: 25000 }),
  // Kafrene: the Ring's towers (The Star Wars Book's art of the Ring)
  kafrenering: lifted('File:RingOfKafrene-TSWB.png', [0.191, 0.2, 0.572, 0.667], 'the dense cluster of dark industrial city towers (tall thin blocks of dark grey metal with rows of small lit windows, pipes, walkways and antennae between them) standing on a craggy chunk of grey asteroid rock, the right way up with the rock at the bottom, without the space round it', 90, 'h', { hero: true }),
  // Ord Mantell: the palace of Ord Mantell City (The Bad Batch)
  mantellpalace: lifted('File:OrdMantellCity TBB.png', [0.458, 0.146, 0.172, 0.427], 'the dark grey stone palace (a round fortress of tall slim towers with pointed caps round a great central tower with an onion dome and a tall needle spire, a few lit windows), without the mountains or the haze', 90, 'h', { hero: true }),
  // Tython: the seeing stone on its hilltop (The Mandalorian's concept art)
  seeingstone: lifted('File:SeeingStone-ConceptArt.jpg', [0.203, 0.019, 0.742, 0.802], 'the ring of huge leaning grey standing stones and fallen stone slabs round a low round flat stone in the middle, on a low grassy rocky mound', 34, 'w', { tris: 30000 }),
  // Arvala-7: the Nikto compound (The Mandalorian, Chapter 1)
  niktocompound: lifted('File:Arvala-7-Nikto-Compound-TheMandalorian.png', [0.179, 0.237, 0.821, 0.713], 'the walled compound of flat-roofed tan adobe buildings (boxy blocks of different heights with arched doorways and small dark windows, joined by thick low walls round a dusty courtyard)', 60, 'w'),
  // Morak: the Imperial rhydonium refinery (The Mandalorian, Chapter 15)
  morakrefinery: lifted('File:MorakImpRefinery-TMCh15.png', [0, 0.025, 0.836, 0.858], 'the massive stepped refinery of pale grey concrete like a fortress (great sloping buttressed walls, flat decks with pipes and tanks on top, a tall block at one end), without the jungle, the waterfall or the cliff', 120, 'w', { hero: true }),
  // Seatos: a monolith of its ruins (Ahsoka, Part Three)
  seatosmonolith: lifted('File:Sabine Wren and Baylan Skoll-Seatos.png', [0.112, 0, 0.138, 0.792], 'the tall dark grey stone monolith (a slab slightly flared towards its top, two short horn-like points at its top corners, cracked weathered faces, a thin carved line with small round marks down its front), standing on its own on a low stone foot, without the people', 30, 'h', { tris: 20000 }),
  // Felucia: a farm's water tower (The Clone Wars, “Bounty Hunters”)
  felwatertower: lifted('File:Nicillin farmers.png', [0.859, 0.233, 0.141, 0.65], 'the farm water tower (a round grey metal tank with a shallow conical roof and a small vent on top, standing on a braced timber trestle of four legs with cross-braces, a ladder up its side)', 14, 'h', { tris: 20000 }),
  // Sullust: the Imperial factory in the lava (a Battlefront still)
  sullustfactory: lifted('File:Sullust Imperial Factory.jpg', [0.672, 0.185, 0.328, 0.815], 'the huge white-grey Imperial factory (a long angular plant of stacked decks and triangular steel braces, a lit white stripe along its side, built into a slope of black volcanic rock), without the lava', 110, 'w', { hero: true }),
  // Vardos: the Imperial monument tower of Kestro City (Battlefront II's concept art)
  kestrotower: lifted('File:VardosConcept.jpg', [0.432, 0.046, 0.176, 0.954], 'the tall smooth rounded-square tower of dark grey vertical ribs, two long red-and-white Imperial banners hanging down its face, a wide stepped base', 120, 'h', { hero: true }),
  // Corellia: a shipyard tower of Coronet City (a Solo still)
  coronettower: lifted('File:Coronet City.png', [0.697, 0, 0.239, 0.828], 'the shipyard tower (a big geodesic radar dome of pale grey panels on a short cylindrical tank, raised high on a frame of dark steel stilts and braces, a lattice conveyor gantry running across in front), without the smoke or the other buildings', 60, 'h', { hero: true }),

  // Corvus: the magistrate's pagoda in Calodan (no picture shows it whole)
  calodanpagoda: drawn('A five-tiered pagoda tower of dark weathered timber and grey stone: curved dark grey tiled roofs flaring up at their corners on each tier, each tier smaller than the one below, carved timber balconies, standing on a square walled stone base with a wide gate and steps, an old East Asian style fortress tower in a misty burnt forest.', 45, 'h', { hero: true }),
  // Wobani: a guard tower of the Imperial labour camp
  wobanitower: drawn('A tall grim guard tower of a prison labour camp: dark corroded grey steel, a broad splayed base braced with heavy girders, a tall square shaft, and at its top a boxy enclosed guard cabin with narrow dark windows, floodlights and an antenna, rust streaks and grime, rain-soaked industrial dystopia.', 24, 'h', { tris: 25000 }),
  // Plazir-15: the city under its dome
  plazirdome: drawn('A huge transparent geodesic glass dome of fine white struts over a cluster of gleaming white modernist towers with rounded corners and green roof gardens, a clean bright utopian city, the dome sitting on a low white ring base.', 110, 'w', { hero: true }),
  // Pillio: the Emperor's observatory
  pilliovault: drawn('A low angular dark grey military bunker with sloped armoured walls and a heavy round vault door in its front, set into a mossy grey rock outcrop on a tropical island, small antenna and vents on its roof, hidden and secret.', 32, 'w', { tris: 30000, hero: true }),
  // Fondor: a construction gantry of the shipyards
  fondorgantry: drawn('A colossal starship construction gantry of a shipyard: a grey steel lattice tower with two long cantilevered crane arms reaching out at its top, gangways and stairs up its sides, work lights and cable reels, standing on a heavy concrete foot, industrial and imperial.', 90, 'h', { hero: true }),
};
