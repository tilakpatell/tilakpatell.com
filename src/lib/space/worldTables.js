// The tables a generated planet's variety is drawn from (./variety.js) that the
// flight and the universe share: its land's characters' ranges, a moon's
// family, and the thirteen Expanse planets the flight's roster flies, with the
// colour each one's template wears, so a generated sibling keeps clear of it.
// Shared by the universe's looks and the landings, so the two draw one planet. Pure.
//
//   TERRAIN[kind] → { shape, sea: [lo, hi], peaks: [lo, hi] (m), lift (m) }
//   MOON_FAMILY, familyOf(type) → the family a moon's type is made from
//   SEEDED_EXPANSE → [[id, type]…]; SEEDED_DOMINANT[type] → [hue°, lightness] of
//     that type's template (the landings' type looks; their test holds the two equal)

// starting values, tuned by the contact sheet (scripts/planet-contact-sheet.mjs)
export const TERRAIN = {
  continents: { shape: 1.3, sea: [0.35, 0.6], peaks: [300, 900], lift: 260 },
  archipelago: { shape: 3.2, sea: [0.62, 0.8], peaks: [150, 450], lift: 200 },
  canyons: { shape: 1.0, sea: [0, 0.15], peaks: [150, 350], lift: 60 },
  mesas: { shape: 1.0, sea: [0, 0.15], peaks: [60, 160], lift: 60 },
  dunes: { shape: 0.9, sea: [0, 0.1], peaks: [20, 60], lift: 40 },
  craters: { shape: 1.0, sea: [0, 0.1], peaks: [70, 140], lift: 60 },
  ridges: { shape: 1.1, sea: [0, 0.3], peaks: [600, 950], lift: 200 },
  plateaus: { shape: 1.0, sea: [0, 0.3], peaks: [80, 200], lift: 0 },
};

// the thirteen Expanse planets the roster flies (fixtures/expanse.json's, in order): their
// ground is a plane of their type's template, held as it was (the endless universe's spec, E)
export const SEEDED_EXPANSE = [
  ['e:1,0:0:0', 'gas'], ['e:1,0:0:1', 'forest'], ['e:1,0:0:2', 'lava'], ['e:1,0:0:3', 'ice'], ['e:1,0:0:4', 'rock'], ['e:1,0:0:5', 'ice'], ['e:1,0:0:6', 'desert'],
  ['e:1,0:1:0', 'desert'], ['e:1,0:1:1', 'ocean'], ['e:1,0:1:2', 'rock'],
  ['e:1,0:2:0', 'gas'], ['e:1,0:2:1', 'ocean'], ['e:1,0:2:2', 'rock'],
];

// a moon's type (the generator's) as the family its ground is made from
export const MOON_FAMILY = { rocky: 'rock', icy: 'ice' };
export const familyOf = (type) => MOON_FAMILY[type] ?? type;

export const SEEDED_DOMINANT = {
  gas: [30.9677419354839, 0.8647058823529412],
  forest: [88.42105263157896, 0.36666666666666664],
  lava: [20, 0.14705882352941174],
  ice: [212.30769230769238, 0.9411764705882353],
  rock: [18.053097345132755, 0.4725490196078431],
  desert: [38.674698795180745, 0.7313725490196078],
  ocean: [45, 0.9313725490196079],
};
