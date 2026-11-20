// The goods there are: what a hold carries, a station trades and a field,
// a wreck or a far region gives. Common goods move along the stations' chain
// (stations.js); each area's specialties are cheap where they're made and
// worth more the further they're hauled (prices.js); the rares, found only far
// from the Core, are what a ship's Mk IV and Mk V take (ships/tiers.js's
// RARE_OF, catalog.js's GOOD_NAME: the same ids). The design:
// docs/superpowers/specs/2026-11-18-ships-market-exploration-design.md,
// section 2. Pure data.
//
// GOODS: { [id]: { id, family, name, base (credits a unit), rare?, pure?,
//   contraband? } }; FAMILIES; goodById(id) → a good or null; isGood(id)

export const FAMILIES = ['raw', 'salvage', 'trade', 'refined', 'specialty', 'rare'];

const good = (id, family, name, base, extra = {}) => Object.freeze({ id, family, name, base, ...extra });

const LIST = [
  good('iron', 'raw', 'Iron ore', 12),
  good('titanium', 'raw', 'Titanium', 24),
  good('ice', 'raw', 'Ice', 10),
  good('gas', 'raw', 'Gas', 16),
  good('organics', 'raw', 'Organics', 14), // (a forest's or an ocean's world: the planets' traits, lib/space/traits.js)
  good('scrap', 'salvage', 'Scrap', 14),
  good('components', 'salvage', 'Components', 40),
  good('datacores', 'salvage', 'Data cores', 70),
  good('food', 'trade', 'Food', 18),
  good('medicine', 'trade', 'Medicine', 45),
  good('machinery', 'trade', 'Machinery', 55),
  good('electronics', 'trade', 'Electronics', 60),
  good('luxuries', 'trade', 'Luxuries', 90),
  good('munitions', 'trade', 'Munitions', 50),
  good('alloys', 'refined', 'Alloys', 38),
  good('fuelcells', 'refined', 'Fuel cells', 48),
  // (each area's own: areas.js says where)
  good('vibranium', 'specialty', 'Vibranium ore', 120),
  good('energon', 'specialty', 'Energon cubes', 110),
  good('mithril', 'specialty', 'Mithril', 130),
  good('herbs', 'specialty', 'Potion herbs', 60),
  good('paper', 'specialty', 'Dunder Mifflin paper', 30),
  good('rum', 'specialty', 'Rum and spices', 55),
  good('pollos', 'specialty', 'Pollos chicken', 40),
  good('vinyl', 'specialty', 'Vinyl records', 70),
  good('rigs', 'specialty', 'Stage rigs', 85),
  good('arcade', 'specialty', 'Arcade boards', 75),
  good('imperialscrap', 'specialty', 'Imperial scrap', 45),
  good('spice', 'specialty', 'Spice', 150),
  good('kyber', 'specialty', 'Kyber crystals', 180),
  good('bacta', 'specialty', 'Bacta', 95),
  good('tibanna', 'specialty', 'Tibanna gas', 80),
  good('portalfluid', 'specialty', 'Portal fluid', 140),
  good('plumbus', 'specialty', 'Plumbuses', 65),
  good('kalaxian', 'specialty', 'Kalaxian crystals', 120),
  good('megaseeds', 'specialty', 'Mega seeds', 90),
  good('cometwater', 'specialty', 'Comet water', 35),
  good('stellargas', 'specialty', 'Stellar gas', 30),
  good('plasma', 'specialty', 'Young-star plasma', 85),
  good('contraband', 'specialty', 'Contraband', 110, { contraband: true }),
  // (the rares, and their pure grade, found 25 or more sectors out)
  ...[
    ['exotic', 'Exotic matter', 400],
    ['voidcrystal', 'Void crystal', 450],
    ['relics', 'Relics', 350],
    ['silk', 'Nebula silk', 380],
  ].flatMap(([id, name, base]) => [good(id, 'rare', name, base, { rare: true }), good(`${id}-pure`, 'rare', `Pure ${name.toLowerCase()}`, Math.round(base * 2.5), { rare: true, pure: true })]),
];

export const GOODS = Object.freeze(Object.fromEntries(LIST.map((g) => [g.id, g])));
export const isGood = (id) => typeof id === 'string' && Object.hasOwn(GOODS, id);
export const goodById = (id) => (isGood(id) ? GOODS[id] : null);
