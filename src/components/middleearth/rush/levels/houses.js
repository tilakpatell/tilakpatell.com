// The Houses of Healing, the night after the Pelennor: the wounded of
// Gondor and Rohan in long white halls under the Citadel, and the King,
// not yet crowned, come in by the back way with a handful of kingsfoil.
// Athelas chopped and steeped in the kettles, poured off into cups; bread
// from the ovens for those who can eat; and the skins filled at the
// cistern. Beregond of the Guard has been sent down with every man who
// can carry a kettle, and calls the orders. (The tiles are ../rules.js's.)

export const HOUSES = {
  id: 'houses',
  town: 'minas-tirith',
  theme: 'houses',
  name: 'The Houses of Healing',
  host: 'Beregond',
  lead: 'The battle is won, and the Houses of Healing are full. The King has come in by the back way asking for kingsfoil: chop it, steep it in the kettles and pour it off into cups, bake bread for those who can eat, and fill the skins at the cistern for those who can only drink.',
  work: 'chop, wash',
  tiles: [
    '#hh#BB#PP#dd',
    'm..........O',
    'm...#..#...O',
    'k...#..#...T',
    'k..........T',
    'X..........W',
    '#..........R',
    '##SS####SS##',
  ],
  spawn: [
    [2, 1],
    [9, 1],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { h: 'herb', d: 'dough' },
    shelves: { m: 'mug', k: 'skin' },
    pot: { takes: ['herb'], need: 2, into: 'mug', makes: 'tea' },
    oven: { takes: 'dough', makes: 'loaf' },
    tap: { into: 'skin', makes: 'water' },
  },
  stock: { mug: 4, skin: 4 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { chop: 1.3, wash: 1.5, scrape: 1.2, cook: 8, burn: 10, bake: 6, char: 8, fill: 2.4, spill: 7, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 14,
    max: 4,
    patience: { athelas: 80, bread: 60, water: 45 },
    mix: { athelas: 0.4, bread: 0.3, water: 0.3 },
    lapse: 5,
  },
  prices: { athelas: 16, bread: 10, water: 7 },
  tip: 6,
  time: 180,
  stars: [55, 120, 185],
  dishes: {
    athelas: { name: 'Athelas', note: 'Two of kingsfoil, chopped, steeped in the kettle, poured into a cup', icon: '🌿', steps: ['chop 2', 'kettle', 'cup'], k: 'mug', s: 'tea', back: 'mug' },
    bread: { name: 'Bread', note: 'Dough, oven', icon: '🍞', steps: ['dough', 'oven'], k: 'loaf', s: 'baked', back: null },
    water: { name: 'A waterskin', note: 'Skin, cistern', icon: '💧', steps: ['skin', 'cistern'], k: 'skin', s: 'water', back: 'skin' },
  },
  lines: {
    start: ['“Every bed is full, and the King has asked for kingsfoil. Chop it fine and steep it. The smell alone does good.”'],
    order: {
      athelas: ['“Athelas for the Lady of Rohan. The King is with her.”', '“A cup of kingsfoil for the Halfling. He went out on the field after her.”', '“Athelas for the Lord Faramir. Quickly.”'],
      bread: ['“Bread for the men of the Rammas. They have not eaten since the gate fell.”', '“Bread for the other Halfling. He says he is starving, and I believe him.”'],
      water: ['“Water for the riders of Rohan, at the end of the hall.”', '“A skin for the wardens. They have been on their feet all night.”'],
    },
    served: ['“Good. The fever is going out of him already.”', '“That is the King’s doing, and yours.”'],
    lapsed: ['“He has fallen asleep at last. That is a kind of healing too.”'],
    burnt: ['“Burnt. Bake another; the ovens are hot enough.”'],
    spilt: ['“Mind the water. There is little enough of it up here tonight.”'],
    end: ['“The halls are quiet, and every one of them is sleeping. Go up and rest. The King says the Tree will flower yet.”'],
  },
};
