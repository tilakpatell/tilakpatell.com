// Minas Tirith, the story: Pippin in the city of the kings, from the ride
// up through its seven gates on Shadowfax to the morning the White Tree
// flowered. The six things to do, in order, and what's said on the way.
// The places are in ./layout.js, the games in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'ride',
    name: 'The seven gates',
    where: 'Up through the city, on Shadowfax',
    blurb: 'Gandalf rides for Minas Tirith with Pippin in front of him. Gallop up through the seven levels, round the carts and the crowds.',
    go: 'Up through the city to the Citadel. Steer round the carts and the people (A and D); hold W to gallop.',
  },
  {
    id: 'court',
    name: 'The Court of the Fountain',
    where: 'The Citadel, at the top of the city',
    blurb: 'The dead White Tree on its lawn, guarded still. A man of the Guard, Beregond, will tell you about it.',
    go: 'Find Beregond of the Guard, by the White Tree.',
    needs: 'ride',
    locked: 'Once you are up in the Citadel.',
  },
  {
    id: 'steward',
    name: 'Denethor, Steward of Gondor',
    where: 'The hall of the kings',
    blurb: 'The Steward sits at the foot of the empty throne, grieving for his son Boromir. Offer him your service.',
    go: 'Into the hall of the kings, through the doors at the west of the court. Denethor is at the foot of the throne.',
    needs: 'court',
    locked: 'After Beregond.',
  },
  {
    id: 'beacon',
    name: 'The beacon',
    where: 'A ledge on the mountain, over the Citadel',
    blurb: 'Gandalf needs Rohan, and the Steward will not send for it. Creep along the ledge while the guard is busy, climb the pile, and light it.',
    go: 'Along the ledge to the beacon. Move only while the guard is at his supper; when he stirs, get behind a rock.',
    needs: 'steward',
    locked: 'Once you are sworn to the Steward.',
  },
  {
    id: 'walls',
    name: 'The siege of Gondor',
    where: 'The first wall, by the Great Gate',
    blurb: 'The host of Mordor fills the Pelennor, and its siege-towers are coming. Loose the trebuchets, and bring the towers down before one reaches the wall.',
    go: 'To the engines on the first wall. Loose when the range is on a tower (Space), and lead it.',
    needs: 'beacon',
    locked: 'After the beacon is lit.',
  },
  {
    id: 'crown',
    name: 'The White Tree in flower',
    where: 'The Court of the Fountain',
    blurb: 'The war is over, and the King has come back to his city. The White Tree is in flower. Go to him.',
    go: 'The King is waiting under the White Tree. Go to him.',
    needs: 'walls',
    locked: 'When the siege is lifted.',
  },
];

// the seals the chapter wins (../../../Achievements.jsx), one for each thing
// done but finding Beregond; coming to the city at all wins its own, as
// soon as you're in
export const SEAL = { ride: 'sevengates', steward: 'guardofthecitadel', beacon: 'beaconslit', walls: 'siegeofgondor', crown: 'kingreturns' };
export const FOUND = 'minastirith';

// ── on the side ──
// Gondor calls for aid: once the beacon over the Citadel is lit, the fire
// runs west along the White Mountains to Rohan; watch the beacons catch,
// and name them back in order (./beacons.js). Nothing the story needs. Its
// own record is kept apart from the story's (../side.js), and its star is
// an achievement of its own, not one of the chapter's seals.
export const SIDE = {
  id: 'beacons',
  name: 'Gondor calls for aid',
  where: 'The beacons of the White Mountains',
  blurb: 'The fire runs west to Rohan, beacon by beacon. Watch them catch, then name them in order, more each time, up to all seven.',
  locked: 'Once the beacon is lit.',
  needs: 'beacon',
  seal: 'callsforaid',
};
export const sideBest = (slips) => (slips === 0 ? 'Your best: all seven, without a slip.' : `Your best: all seven, with ${slips} ${slips === 1 ? 'slip' : 'slips'}.`);

// What's next, the objective, where you are, the time of day, and whether
// Pippin wears the black and silver of the Tower yet.
export function minasProgress(done = []) {
  const p = progress(QUESTS, done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'The King is crowned and the White Tree flowers. Walk the city as long as you like.' : next.go;
  const zone = p.finished ? 'court' : ({ ride: 'ride', court: 'court', steward: 'court', beacon: 'beacon', walls: 'walls' }[p.next] ?? 'court');
  const day = p.finished || p.next === 'crown';
  const livery = p.done.includes('steward');
  return { ...p, objective, zone, day, livery };
}

export const CONVOS = {
  // under the last gate, off the horse
  arrive: {
    start: 'stand',
    nodes: {
      stand: { who: 'narrator', say: 'Shadowfax comes to a stand under the seventh gate, blowing. Above you, white against the mountain, the Tower of Ecthelion; before you a court, a fountain, and a tree.', next: 'out' },
      out: { who: 'gandalf', say: '“Out you get, Peregrin. And mind your tongue in this city: say nothing of Boromir to the Steward unless he speaks of him first.”', next: 'ask' },
      ask: {
        who: 'pippin',
        say: 'What do you say?',
        choices: [
          { text: '“Is that the White Tree? It looks rather… dead.”', to: 'tree' },
          { text: '“Is there breakfast in Minas Tirith?”', to: 'breakfast' },
        ],
      },
      tree: { who: 'gandalf', say: '“Dead it may be, but it is guarded still, and so is the city. Find one of the Guard who can tell you about it. I must see the Steward.”', end: 'won' },
      breakfast: { who: 'gandalf', say: '“There will be food when there is time for it. Go and find one of the Guard who can tell you about the city. I must see the Steward.”', end: 'won' },
    },
  },
  // by the tree
  beregond: {
    start: 'hail',
    nodes: {
      hail: { who: 'beregond', say: '“Well met, little one. Beregond, of the Third Company of the Citadel. You are the halfling who rode in on the grey horse with Mithrandir.”', next: 'ask' },
      ask: {
        who: 'pippin',
        say: 'What do you ask him?',
        choices: [
          { text: 'About the tree.', to: 'tree' },
          { text: 'About the Steward.', to: 'steward' },
        ],
      },
      tree: { who: 'beregond', say: '“The White Tree of the Kings. It has stood dead since the last king went, and we guard it still. One day the King may come back, they say, and the tree flower again.”', next: 'go' },
      steward: { who: 'beregond', say: '“The Lord Denethor is proud, and wise, and sees further than most. But he has lost his elder son, and his heart is heavy. Speak carefully.”', next: 'go' },
      go: { who: 'beregond', say: '“The Steward will see you now. The hall of the kings is through the doors at the west of the court. Go on: I’ll keep you a place at supper.”', end: 'won' },
    },
  },
  // at the foot of the throne
  denethor: {
    start: 'hall',
    nodes: {
      hall: { who: 'narrator', say: 'The hall is long, and very quiet. Between the black pillars the kings of old stand in stone. The throne at the far end is empty; on a plain black chair at its foot sits an old man, a cloven horn in his lap.', next: 'why' },
      why: { who: 'denethor', say: '“So. A halfling, and Mithrandir’s. My son fell defending you, they tell me. How is it you escaped, and he did not, so mighty a man?”', next: 'answer' },
      answer: {
        who: 'pippin',
        say: 'What do you say?',
        choices: [
          { text: '“He died to save us. I will repay that, if I can.”', to: 'kneel' },
          { text: '“There were too many of them, my lord. He stood alone.”', to: 'alone' },
        ],
      },
      alone: { who: 'denethor', say: '“Alone. Yes: he would.” He looks at you a long while. “And what would you have of me, halfling?”', next: 'kneel' },
      kneel: { who: 'narrator', say: 'You go down on one knee, and hold out your little sword, hilt first, and offer your service to Gondor, for what it is worth.', next: 'take' },
      take: { who: 'denethor', say: '“It is accepted. You shall have the livery of the Guard of the Tower, and you shall wait on me, and sing, if I ask it.”', next: 'livery' },
      livery: { who: 'narrator', say: 'Black and silver, with the White Tree on the breast, made long ago for some page of the Tower and too small for anyone since. A guard of the Citadel of Gondor.', end: 'won' },
    },
  },
  // the Steward's supper
  tomato: {
    start: 'dish',
    nodes: {
      dish: { who: 'narrator', say: 'On a little table by the Steward’s chair: a dish of small red tomatoes, a heel of bread, and a jug of wine.', next: 'take' },
      take: {
        who: 'pippin',
        say: 'What do you do?',
        choices: [
          { text: 'Take one. Just one.', to: 'one' },
          { text: 'Leave them be.', to: 'leave' },
        ],
      },
      one: { who: 'narrator', say: 'You take one. It bursts as you bite it and runs down your chin, and behind you the Steward goes on with his supper as if nothing had happened.', end: 'won' },
      leave: { who: 'narrator', say: 'You leave them. The Steward eats one, slowly, and the juice runs into his beard. You try very hard not to watch.', end: 'won' },
    },
  },
  // evening, on the walls of the Citadel
  dusk: {
    start: 'red',
    nodes: {
      red: { who: 'narrator', say: 'Evening. You find Gandalf on the wall of the Citadel, looking east, where the sky over Mordor is red.', next: 'rohan' },
      rohan: { who: 'gandalf', say: '“The Steward will not call on Rohan. Pride, or despair; it hardly matters which. But there is a beacon on the mountain over us, and its keeper takes his supper about now.”', next: 'me' },
      me: { who: 'pippin', say: '“You want me to light it.”', next: 'not' },
      not: { who: 'gandalf', say: '“I want nothing of the kind. But if I were a hobbit, and small, and quick, and quiet…”', next: 'how' },
      how: { who: 'narrator', say: 'Creep along the ledge (hold W) while he eats. When he stirs, get behind a rock and keep still. Then climb the pile (hold W), and light it (E).', end: 'won' },
    },
  },
  // the beacons, away to Rohan
  lit: {
    start: 'chain',
    nodes: {
      chain: { who: 'narrator', say: 'Fire on the next peak, and the next, away along the mountains into the north: Amon Dîn, Eilenach, Nardol, Erelas, Min-Rimmon, Calenhad, Halifirien.', next: 'edoras' },
      edoras: { who: 'narrator', say: 'Far off, in a golden hall, a king looks up from his table. Gondor calls for aid.', next: 'down' },
      down: { who: 'gandalf', say: 'From below, very softly: “Well done, Peregrin Took. Now come down, before the Steward hears of it.”', end: 'won' },
    },
  },
  // night, on the first wall
  siege: {
    start: 'fires',
    nodes: {
      fires: { who: 'narrator', say: 'Night, and the Pelennor is full of fires. The host of Mordor has come, more than you can count; its siege-towers are rolling for the wall.', next: 'engines' },
      engines: { who: 'gandalf', say: '“Peregrin! Here, by the engines. They cannot see over the smoke, and you can. Tell them when to loose.”', next: 'how' },
      how: { who: 'narrator', say: 'The range swings out and back. Loose (Space) when it’s on a tower, and lead it: the towers keep coming while the stone is in the air. Bring down four before one reaches the wall.', end: 'won' },
    },
  },
  // the siege lifted
  held: {
    start: 'falls',
    nodes: {
      falls: { who: 'narrator', say: 'The last tower lurches, leans, and goes over in a roar of dust and fire. A cheer runs along the wall.', next: 'horns' },
      horns: { who: 'narrator', say: 'And then, in the grey before morning, away to the north: horns. Horns, and horns, and the thunder of horses. Rohan has come.', next: 'after' },
      after: { who: 'narrator', say: 'Weeks pass. The war is ended; the Shadow is gone. And one morning the bells of the city ring, and go on ringing.', end: 'won' },
    },
  },
  // under the tree, at the end
  crown: {
    start: 'court',
    nodes: {
      court: { who: 'narrator', say: 'The court is full of people, and of flowers. The King stands under the White Tree, and the tree is white with blossom, as no one living has seen it.', next: 'king' },
      king: { who: 'aragorn', say: '“Peregrin, Guard of the Citadel. I have not forgotten who lit the beacon.”', next: 'bow' },
      bow: {
        who: 'pippin',
        say: 'What do you do?',
        choices: [{ text: 'Bow to the King.', to: 'none' }],
      },
      none: { who: 'aragorn', say: '“My friends, you bow to no one.”', next: 'kneel' },
      kneel: { who: 'narrator', say: 'And the King kneels; and all the court kneels with him, and the people in the streets below, the whole white city: to four hobbits.', end: 'won' },
    },
  },
  // from the point of the prow
  view: {
    start: 'field',
    nodes: {
      field: { who: 'narrator', say: 'From the point of the prow the whole Pelennor lies under you, green and gold to the river; and beyond the river the Mountains of Shadow, with a red light behind them that never quite goes out.', next: 'mordor' },
      mordor: { who: 'pippin', say: '“That’s Mordor, isn’t it?” Nobody answers. Nobody needs to.', end: 'won' },
    },
  },
};

export const SPEAKERS = { gandalf: 'Gandalf', pippin: 'Pippin', beregond: 'Beregond', denethor: 'Denethor', aragorn: 'Aragorn', narrator: '' };
