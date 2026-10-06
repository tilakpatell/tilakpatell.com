// Edoras, the story: Gimli at the court of Rohan, from the doors of the
// Golden Hall to the morning the Rohirrim rode for Gondor. The six things
// to do, in order, and what's said on the way. The places are in
// ./layout.js, the games in ./rules.js.

import { progress } from '../story';

export const QUESTS = [
  {
    id: 'weapons',
    name: 'Weapons at the door',
    where: 'The terrace of Meduseld',
    blurb: 'Up through Edoras with Gandalf, Aragorn and Legolas, to the doors of the Golden Hall, where Háma keeps the door.',
    go: 'Up through Edoras to the doors of the Golden Hall. Háma keeps the door.',
  },
  {
    id: 'king',
    name: 'Théoden King',
    where: 'The Golden Hall',
    blurb: 'Gandalf goes to break Saruman’s hold on the king. Keep Wormtongue’s men off him while he works.',
    go: 'Into the hall. Keep Wormtongue’s men off Gandalf while he works: E (or Space) to knock one down.',
    needs: 'weapons',
    locked: 'Once you are let in.',
  },
  {
    id: 'flowers',
    name: 'Simbelmynë',
    where: 'The barrows, outside the gate',
    blurb: 'The king’s son is laid in his barrow by the road. Gather the white flowers from the barrows of his fathers, and lay them on his.',
    go: 'Out of the gate to the barrows. Gather the white flowers on seven of them, and lay them on Théodred’s, by the gate.',
    needs: 'king',
    locked: 'When the king is himself again.',
  },
  {
    id: 'feast',
    name: 'The drinking game',
    where: 'The Golden Hall, at the feast',
    blurb: 'A feast in Meduseld, and Legolas reckons an Elf can drink any Dwarf under the table. Show him.',
    go: 'Back to the hall for the feast. Legolas is waiting at the end of the table on the right.',
    needs: 'flowers',
    locked: 'After the funeral.',
  },
  {
    id: 'beacon',
    name: 'The beacons are lit',
    where: 'The terrace, at night',
    blurb: 'Gondor will call for aid with fire on the mountains, if it calls at all. Keep the watch, and see it first.',
    go: 'Out on the terrace at night: watch the White Mountains for a fire (A and D to look along them, E when you see it).',
    needs: 'feast',
    locked: 'After the feast.',
  },
  {
    id: 'muster',
    name: 'Rohan will answer',
    where: 'The plain below Edoras',
    blurb: 'At dawn the host of Rohan rides for Gondor. Ride with them.',
    go: 'Ride out with the Rohirrim: hold W.',
    needs: 'beacon',
    locked: 'When the beacon is seen.',
  },
];

// the seal won at the end (../../../Achievements.jsx); finding the hill at
// all wins its own, and drinking a dozen tankards before you go under wins
// one on the side
export const SEAL = { muster: 'rohanwillanswer' };
export const FOUND = 'edoras';
export const SIDE = { seal: 'drinkinggame', drinks: 12 };

// What's next, the objective, where you are, and the time of day.
export function edorasProgress(done = []) {
  const p = progress(QUESTS, done);
  const next = p.quests.find((q) => q.id === p.next);
  const objective = p.finished ? 'Rohan has ridden for Gondor. Edoras is quiet: walk it as long as you like.' : next.go;
  const zone = p.finished ? 'hill' : ({ weapons: 'hill', king: 'hall', flowers: 'hill', feast: 'hall', beacon: 'terrace', muster: 'muster' }[p.next] ?? 'hill');
  const time = p.finished ? 'day' : ({ weapons: 'day', king: 'day', flowers: 'day', feast: 'evening', beacon: 'night', muster: 'dawn' }[p.next] ?? 'day');
  return { ...p, objective, zone, time };
}

export const CONVOS = {
  // at the doors
  door: {
    start: 'hama',
    nodes: {
      hama: { who: 'hama', say: '“None go armed before the king, Gandalf Greyhame. Those are the orders of Gríma Wormtongue.”', next: 'others' },
      others: { who: 'narrator', say: 'Aragorn unbuckles his sword and hands it over. Legolas hands over his bow, and then a knife, and another, and another. Háma looks at you.', next: 'axe' },
      axe: {
        who: 'gimli',
        say: 'What do you do?',
        choices: [
          { text: 'Hand over the axe, with a growl.', to: 'growl' },
          { text: 'Keep the axe.', to: 'keep' },
        ],
      },
      keep: { who: 'hama', say: 'Háma waits, and says nothing, and goes on waiting. Gandalf gives you a look over his shoulder.', next: 'growl' },
      growl: { who: 'gimli', say: 'You lay the axe in Háma’s arms as if it were a sleeping child. “Mind the edge,” you tell him. “And mind the haft. And mind me.”', next: 'staff' },
      staff: { who: 'hama', say: '“Your staff, too.”', next: 'stick' },
      stick: { who: 'gandalf', say: '“Would you take an old man’s walking stick?” Háma hesitates, and lets it pass. The doors open.', end: 'won' },
    },
  },
  // in the hall, before the throne
  king: {
    start: 'dim',
    nodes: {
      dim: { who: 'narrator', say: 'The hall is long and dim and smells of smoke. On the throne at the far end sits an old man, bent and grey, and at his ear a pale man in black, whispering.', next: 'crow' },
      crow: { who: 'grima', say: '“The king has no wish to see you, Stormcrow. Ill news follows you about like a crow. Why should he welcome you?”', next: 'work' },
      work: { who: 'narrator', say: 'Gandalf throws back his grey cloak, and under it he is all in white, and he lifts his staff to the throne.', next: 'men' },
      men: { who: 'narrator', say: 'Out of the shadows between the pillars come Wormtongue’s men. Keep them off Gandalf while he works (walk, and E or Space to knock one down).', end: 'won' },
    },
  },
  // the king himself again
  freed: {
    start: 'eyes',
    nodes: {
      eyes: { who: 'narrator', say: 'There is a crack like thunder from the throne, and a cry; and the old man there straightens, and his face is younger, and his eyes are clear.', next: 'dreams' },
      dreams: { who: 'theoden', say: '“Gandalf? Dark have been my dreams of late.”', next: 'grima' },
      grima: { who: 'narrator', say: 'Gríma is thrown out of the doors and down the great stair, and is gone on a stolen horse, west, towards Isengard.', next: 'son' },
      son: { who: 'theoden', say: '“Where is Théodred? Where is my son?”', end: 'won' },
    },
  },
  // by the barrows
  barrows: {
    start: 'laid',
    nodes: {
      laid: { who: 'narrator', say: 'They have laid the king’s son in a new barrow by the road, nearest the gate. Along the road the barrows of his fathers are white with little flowers.', next: 'evermind' },
      evermind: { who: 'gandalf', say: '“Simbelmynë. Evermind, the Riders call it: it flowers on the graves of their kings in every season of the year.”', next: 'how' },
      how: { who: 'narrator', say: 'Gather the white flowers from seven of the barrows (walk to them, E), and lay them at the foot of Théodred’s.', end: 'won' },
    },
  },
  // laid on the barrow
  laid: {
    start: 'lay',
    nodes: {
      lay: { who: 'narrator', say: 'You lay the flowers at the foot of the new barrow. The king stands a long time beside you, and says nothing at all, and then a little.', next: 'child' },
      child: { who: 'theoden', say: '“No parent should have to bury their child.”', end: 'won' },
    },
  },
  // at the feast
  feast: {
    start: 'elf',
    nodes: {
      elf: { who: 'legolas', say: '“You will find an Elf a poor drinking companion, Gimli. It takes us a very long time to feel anything at all.”', next: 'game' },
      game: { who: 'gimli', say: '“Then it’s a drinking game. Last one standing wins.” You pull a tankard towards you.', next: 'how' },
      how: { who: 'narrator', say: 'Drink when the tankard comes to your lips (Space or E). Miss, and it goes down your beard. The more you drink, the more the room sways.', end: 'won' },
    },
  },
  // under the table
  down: {
    start: 'tilt',
    nodes: {
      tilt: { who: 'narrator', say: 'The hall tilts, gently, and then not so gently, and the floor comes up very kindly to meet you.', next: 'tingle' },
      tingle: { who: 'legolas', say: '“I feel… something. A tingle, in my fingers. Perhaps it is working.” He looks down at you. “Gimli?”', next: 'snore' },
      snore: { who: 'narrator', say: 'Gimli, son of Glóin, lies under the table, snoring happily.', end: 'won' },
    },
  },
  // on the terrace, at night
  watch: {
    start: 'night',
    nodes: {
      night: { who: 'narrator', say: 'Night on the terrace of Meduseld. Away east the White Mountains are black against the stars. Everyone else has gone in.', next: 'what' },
      what: { who: 'gimli', say: '“Keep watch for what, exactly?”', next: 'how' },
      how: { who: 'narrator', say: 'For a fire on the peaks: Gondor’s beacons, if Gondor calls. Look along the mountains (A and D) and say when you see it (E).', end: 'won' },
    },
  },
  // the beacon seen
  lit: {
    start: 'fire',
    nodes: {
      fire: { who: 'narrator', say: 'A point of fire on a far peak, very small and very bright. You shout, and Aragorn comes running out past you.', next: 'aragorn' },
      aragorn: { who: 'aragorn', say: '“The beacons of Minas Tirith! The beacons are lit!”', next: 'answer' },
      answer: { who: 'theoden', say: 'From the doors, the king, after a moment: “And Rohan will answer. Muster the Rohirrim.”', end: 'won' },
    },
  },
  // dawn, below Edoras
  muster: {
    start: 'host',
    nodes: {
      host: { who: 'narrator', say: 'Dawn. The host of Rohan is gathered on the plain under Edoras, more riders than you can count, and the banners of the white horse over them.', next: 'ride' },
      ride: { who: 'theoden', say: '“Ride with us, Gimli son of Glóin. We ride for Gondor.”', next: 'how' },
      how: { who: 'narrator', say: 'Hold W to ride out with them.', end: 'won' },
    },
  },
};

export const SPEAKERS = { gimli: 'Gimli', gandalf: 'Gandalf', hama: 'Háma', grima: 'Gríma', theoden: 'Théoden', legolas: 'Legolas', aragorn: 'Aragorn', narrator: '' };
