// The new worlds' landmarks (surface/sites/prequels.js, rebellion.js,
// shows.js and drop.js): one each, made with Meshy (meshy.ai, the site
// owner's account) by scripts/meshy-galaxy-buildings.mjs from
// scripts/meshy-galaxy-worlds.mjs, nineteen lifted out of a Wookieepedia
// picture of the place and five drawn from words first where no picture
// shows it whole. They stand where the worlds had props built in code.
// None has a built one behind it: a kind that won't load goes without.
// Fields as in made.js.
export const MODELS = {
  // Utapau: a tower of Pau City, its stacked bone-white domes and landing ledge
  pautower: { made: 'meshy', as: 'the towers of Pau City', metres: 60, along: 'y', lod: true, detail: 'adobe' },
  // Mygeeto: a tower of the crystal cities, its stacked copper discs
  mygeetotower: { made: 'meshy', as: 'the towers of Mygeeto', metres: 150, along: 'y', hero: true, lod: true, detail: 'metal' },
  // Saleucami: Cut Lawquane's farmhouse, the adobe dome under its plank roof
  lawquanefarm: { made: 'meshy', as: 'the domed farmhouses', metres: 16, along: 'x', lod: true, detail: 'adobe' },
  // Cato Neimoidia: the rock arch and the city hung under it
  catobridge: { made: 'meshy', as: 'the bridge city', metres: 170, along: 'x', hero: true, lod: true, detail: 'redrock' },
  // Polis Massa: the base's domes and the tubes between them
  massabase: { made: 'meshy', as: 'the Polis Massa base', metres: 60, along: 'x', hero: true, lod: true, detail: 'metal' },
  // Malastare: the Imperial palace of the Dug Council, its black spires
  dugpalace: { made: 'meshy', as: 'the Imperial palace of Malastare', metres: 80, along: 'y', hero: true, lod: true },
  // Jedha: the Temple of the Kyber, the sandstone obelisk on its steps
  kybertemple: { made: 'meshy', as: 'the Temple of the Kyber', metres: 90, along: 'y', hero: true, lod: true, detail: 'stone' },
  // Eadu: the research facility, its black fin of a tower and the landing platform
  eadulab: { made: 'meshy', as: 'the Eadu facility', metres: 90, along: 'x', hero: true, lod: true, detail: 'metal' },
  // Lah'mu: the Erso homestead, the sunk dome and the vaporator mast
  ersohome: { made: 'meshy', as: 'the Erso homestead', metres: 26, along: 'x', lod: true, detail: 'concrete' },
  // Kafrene: the Ring's towers on their chunk of asteroid (sunk into the ground where it stands)
  kafrenering: { made: 'meshy', as: 'the Ring of Kafrene', metres: 90, along: 'y', hero: true, lod: true, detail: 'metal' },
  // Ord Mantell: the palace of Ord Mantell City, its onion dome and spires
  mantellpalace: { made: 'meshy', as: 'the palace of Ord Mantell City', metres: 90, along: 'y', hero: true, lod: true, detail: 'stone' },
  // Tython: the seeing stone in its ring of standing stones
  seeingstone: { made: 'meshy', as: 'the seeing stone', metres: 34, along: 'x', lod: true, detail: 'stone' },
  // Arvala-7: the Nikto compound, its adobe blocks round the courtyard
  niktocompound: { made: 'meshy', as: 'the Nikto compound', metres: 60, along: 'x', lod: true, detail: 'adobe' },
  // Morak: the Imperial refinery, the stepped concrete fortress
  morakrefinery: { made: 'meshy', as: 'the Morak refinery', metres: 120, along: 'x', hero: true, lod: true, detail: 'concrete' },
  // Seatos: a monolith of the ruins (darkened to the film's near-black stone)
  seatosmonolith: { made: 'meshy', as: 'the monoliths of Seatos', metres: 30, along: 'y', detail: 'stone', tint: '#6a6a70' },
  // Felucia: a nicillin farm's water tower on its timber trestle
  felwatertower: { made: 'meshy', as: 'the farm’s water tower', metres: 14, along: 'y', detail: 'wood' },
  // Sullust: the Imperial factory in the lava fields
  sullustfactory: { made: 'meshy', as: 'the Imperial factory', metres: 110, along: 'x', hero: true, lod: true, detail: 'metal' },
  // Vardos: the Imperial monument tower of Kestro City, its banners
  kestrotower: { made: 'meshy', as: 'the Kestro City tower', metres: 120, along: 'y', hero: true, lod: true },
  // Corellia: a shipyard tower of Coronet City, its radar dome on stilts
  coronettower: { made: 'meshy', as: 'the shipyard towers', metres: 60, along: 'y', hero: true, lod: true, detail: 'metal' },
  // Corvus: the magistrate's pagoda in Calodan
  calodanpagoda: { made: 'meshy', as: 'the magistrate’s pagoda', metres: 45, along: 'y', hero: true, lod: true, detail: 'wood' },
  // Wobani: a guard tower of the labour camp
  wobanitower: { made: 'meshy', as: 'the camp’s guard towers', metres: 24, along: 'y', lod: true, detail: 'metal' },
  // Plazir-15: the city under its dome
  plazirdome: { made: 'meshy', as: 'the domed city', metres: 110, along: 'x', hero: true, lod: true },
  // Pillio: the Emperor's observatory, the bunker in its mossy rock
  pilliovault: { made: 'meshy', as: 'the Emperor’s observatory', metres: 32, along: 'x', hero: true, lod: true, detail: 'concrete' },
  // Fondor: a construction gantry of the shipyards
  fondorgantry: { made: 'meshy', as: 'the shipyard gantries', metres: 90, along: 'y', hero: true, lod: true, detail: 'metal' },
};
