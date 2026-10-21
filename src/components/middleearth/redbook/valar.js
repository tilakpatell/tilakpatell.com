// The sky outside Bag End’s window, pure: Eru Ilúvatar’s light at the top of
// it, and the Valar under it as constellations, as Varda might have set
// them, each a few stars and the lines that join them, in the sky’s 0…1 box
// (y down). And Gandalf at the gate below, who was Olórin once and learned
// pity from Nienna. The words are the site’s own (./outside.js draws it).
//
//   VALAR → [{ id, name, title, say, stars: [[x, y, size]], lines: [[i, j]], at: [x, y] }]
//   ERU, GANDALF → the light above and the wizard below
//   nearestStar(list, [x, y], reach) → the one whose middle is nearest, or null

export const ERU = {
  id: 'eru',
  name: 'Eru Ilúvatar',
  title: 'The One',
  at: [0.5, 0.15],
  clip: 'worldIsChanged',
  say: 'Before the world, the One made the Ainur from his thought and gave them a theme to sing. The world is that music, still being played.',
};

export const GANDALF = {
  id: 'gandalf',
  name: 'Gandalf',
  title: 'Olórin, once',
  clip: 'wizardLate',
  say: 'He was Olórin in the West, wisest of the Maiar, and came to Middle-earth an old man in grey. He is late, he will tell you. He is not.',
};

// a figure in stars: its points, and which join which
const fig = (id, name, title, at, say, stars, lines) => ({ id, name, title, at, say, stars: stars.map(([x, y, s = 1]) => [at[0] + x, at[1] + y, s]), lines });

export const VALAR = [
  fig('manwe', 'Manwë', 'Lord of the Breath of Arda', [0.5, 0.34], 'King of the Valar, on the top of Taniquetil. The winds are his, and the eagles carry his word.', [[0, -0.07, 1.6], [-0.12, -0.02], [-0.07, 0.03], [0.07, 0.03], [0.12, -0.02], [0, 0.08, 1.2]], [[1, 2], [2, 0], [0, 3], [3, 4], [0, 5]]),
  fig('varda', 'Varda', 'Elbereth, Kindler of the Stars', [0.3, 0.3], 'She made the stars, and the Elves call to her by night: Elbereth Gilthoniel. Frodo did, on Weathertop.', [[0, 0, 1.8], [-0.05, -0.05], [0.05, -0.05], [-0.06, 0.05], [0.06, 0.05], [0, 0.08]], [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]),
  fig('ulmo', 'Ulmo', 'Lord of Waters', [0.16, 0.57], 'All the waters of the world are his. Those who hear his horns in the sea long for it ever after.', [[0, -0.06, 1.3], [-0.04, 0], [0.03, 0.02], [-0.02, 0.07], [0.05, 0.09]], [[0, 1], [1, 2], [2, 3], [3, 4]]),
  fig('aule', 'Aulë', 'The Smith', [0.84, 0.59], 'He made the mountains with his hands, and in his impatience the Dwarves. They have loved stone ever since.', [[0, -0.05, 1.3], [0.05, -0.05], [0.05, 0.0], [0, 0.0], [0.02, 0.08]], [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]]),
  fig('yavanna', 'Yavanna', 'Giver of Fruits', [0.7, 0.3], 'She sang the Two Trees into being, and loves every growing thing. The ents are her answer to the axe.', [[0, 0.07], [0, 0.0, 1.4], [-0.05, -0.04], [0.05, -0.04], [0, -0.07]], [[0, 1], [1, 2], [1, 3], [1, 4]]),
  fig('orome', 'Oromë', 'The Hunter', [0.85, 0.42], 'He rode through the dark forests of Middle-earth in the Elder Days, and his horn Valaróma scattered the servants of the Enemy.', [[-0.05, 0], [0, -0.03, 1.4], [0.05, 0], [0.03, 0.05], [-0.03, 0.05]], [[0, 1], [1, 2], [2, 3], [0, 4]]),
  fig('mandos', 'Námo', 'Mandos, the Doomsman', [0.33, 0.48], 'Keeper of the Houses of the Dead, who forgets nothing and says only what will be.', [[0, -0.04, 1.2], [-0.03, 0.04], [0.03, 0.04], [0, 0.09]], [[0, 1], [0, 2], [1, 3], [2, 3]]),
  fig('nienna', 'Nienna', 'Who weeps for the world', [0.67, 0.48], 'She mourns every hurt of Arda, and turns it to wisdom. Olórin was her pupil: it is why Gandalf pities Gollum.', [[0, -0.05, 1.2], [-0.02, 0.02], [0.02, 0.02], [-0.01, 0.07], [0.01, 0.09]], [[0, 1], [0, 2], [1, 3], [2, 4]]),
  fig('tulkas', 'Tulkas', 'The Valiant', [0.16, 0.41], 'Last of the Valar to come, and the strongest. He laughs in battle, and the Enemy fled from his laughter.', [[0, -0.05, 1.3], [-0.05, 0.0], [0.05, 0.0], [-0.03, 0.07], [0.03, 0.07]], [[1, 0], [0, 2], [0, 3], [0, 4]]),
];

// the one whose figure is nearest a point in the sky, within reach
export function nearestStar(list, [x, y], reach = 0.08) {
  let best = null;
  let d = reach;
  for (const v of list) {
    const e = Math.hypot(v.at[0] - x, v.at[1] - y);
    if (e < d) {
      d = e;
      best = v;
    }
  }
  return best;
}
