// The galaxy's cities' houses (surface/sites/city.js lays their streets with
// them): what a city has many of, beside its landmark (worlds.js), made with
// Meshy (meshy.ai, the site owner's account) by scripts/meshy-galaxy-
// buildings.mjs from scripts/meshy-galaxy-cities.mjs, each drawn from words
// first. Light enough to stand by the dozen: instanced, a light copy beside
// each. None has a built one behind it: a kind that won't load goes without.
// Fields as in made.js.
export const MODELS = {
  // Corellia, Coronet City: the old stone tenements and the spacers' shops
  coronetblock: { made: 'meshy', as: 'the tenements of Coronet City', metres: 20, along: 'y', lod: true, detail: 'stone' },
  coronetshop: { made: 'meshy', as: 'the shops of Coronet City', metres: 10, along: 'y', lod: true, detail: 'metal' },
  // Ord Mantell, Worlport: the scrap-patched tenements and the market hall
  worlportblock: { made: 'meshy', as: 'the tenements of Worlport', metres: 16, along: 'y', lod: true, detail: 'metal' },
  worlportmarket: { made: 'meshy', as: 'the market halls of Worlport', metres: 22, along: 'x', lod: true, detail: 'metal' },
  // Vardos, Kestro City: the town houses
  kestrohouse: { made: 'meshy', as: 'the town houses of Kestro City', metres: 16, along: 'y', lod: true, detail: 'stone' },
  // Utapau, Pau City: the Pau'ans' dwellings
  pauhouse: { made: 'meshy', as: 'the dwellings of Pau City', metres: 14, along: 'y', lod: true, detail: 'adobe' },
  // Mygeeto: the crystal city's blocks
  mygeetoblock: { made: 'meshy', as: 'the crystal blocks of Mygeeto', metres: 40, along: 'y', lod: true, detail: 'metal' },
  // Cato Neimoidia: the merchants' residences
  catohab: { made: 'meshy', as: 'the residences of Cato Neimoidia', metres: 16, along: 'y', lod: true, detail: 'stone' },
  // Jedha, the Holy City: the sandstone houses and towers
  jedhahouse: { made: 'meshy', as: 'the houses of the Holy City', metres: 9, along: 'y', lod: true, detail: 'stone' },
  jedhatower: { made: 'meshy', as: 'the towers of the Holy City', metres: 22, along: 'y', lod: true, detail: 'stone' },
  // Plazir-15: the white villas
  plazirvilla: { made: 'meshy', as: 'the villas of Plazir-15', metres: 12, along: 'y', lod: true, detail: 'concrete' },
  // Kafrene: the trading post's habitation blocks
  kafreneshack: { made: 'meshy', as: 'the habitation blocks of Kafrene', metres: 14, along: 'y', lod: true, detail: 'metal' },
  // Trask: the harbour's fishing halls
  traskhall: { made: 'meshy', as: 'the fishing halls of Trask', metres: 18, along: 'x', lod: true, detail: 'stone' },
  // Lothal, Capital City: the Empire's blocks
  lothalblock: { made: 'meshy', as: 'the Imperial blocks of Capital City', metres: 24, along: 'y', lod: true, detail: 'concrete' },
};
