// A word with the company: what whoever walks beside you says when you
// turn to them (T, or the Talk button), stage by stage, in the site's own
// words: where they are, what has happened, what they fear is ahead, so
// the ride tells its story between the beats as well as at them. Pure.
//
//   NAMES: { id: the name shown over a line }   nameOf(id, stage) → the name (Strider until Rivendell)
//   CHATTER: { stageId: [{ who, text }] }   (said in order, by whoever of them walks there)
//   COMPANY: { id: [text] }   (anywhere, once the stage's own are said)
//   nextLine(stage, present, said) → { id, who, text } | null: the next line
//     not yet said (`said`: a Set of ids) by someone `present` (ids walking now)
//   saidFor(text) → ms a line's subtitle stays (Said.jsx): time to read it, slowly

export const NAMES = {
  frodo: 'Frodo',
  sam: 'Sam',
  merry: 'Merry',
  pippin: 'Pippin',
  gandalf: 'Gandalf',
  gandalfwhite: 'Gandalf the White',
  aragorn: 'Aragorn',
  boromir: 'Boromir',
  legolas: 'Legolas',
  gimli: 'Gimli',
  bilbo: 'Bilbo',
  arwen: 'Arwen',
  elrond: 'Elrond',
  galadriel: 'Galadriel',
  gollum: 'Gollum',
  butterbur: 'Barliman Butterbur',
  saruman: 'Saruman',
  haldir: 'Haldir',
};
const STRIDER = new Set(['bree', 'weathertop', 'ford']);
export const nameOf = (id, stage = null) => (id === 'aragorn' && STRIDER.has(stage) ? 'Strider' : (NAMES[id] ?? id));

const line = (who) => (text) => ({ who, text });
const frodo = line('frodo');
const sam = line('sam');
const merry = line('merry');
const pippin = line('pippin');
const gandalf = line('gandalf');
const aragorn = line('aragorn');
const boromir = line('boromir');
const legolas = line('legolas');
const gimli = line('gimli');
const arwen = line('arwen');
const gollum = line('gollum');

export const CHATTER = {
  hobbiton: [
    frodo('Bilbo’s party tonight, and then he means to go. He wouldn’t say where.'),
    frodo('He left me Bag End, and a gold ring in an envelope. Gandalf made me promise to hide it and tell no one.'),
    frodo('Gandalf thinks it’s the Enemy’s own Ring. If he’s right I can’t stay in the Shire with it.'),
    sam('I’ll come, Mr Frodo. I promised Gandalf I wouldn’t let you out of my sight, and I won’t.'),
    sam('Rosie Cotton at the Green Dragon. I never did say anything to her.'),
  ],
  'shire-edge': [
    frodo('Bree, then Rivendell. Gandalf should have met us at Bag End. He never came.'),
    sam('Something on a black horse was asking for Baggins at the Gaffer’s gate. I don’t like it.'),
    merry('Farmer Maggot’s dogs know us of old. We’d best not stop for a chat.'),
    pippin('You can’t leave the Shire without us. Who’d carry the mushrooms?'),
    frodo('When it stopped on the road above us, I wanted to put the Ring on. I don’t know why.'),
    merry('The Bucklebury ferry: once we’re over the river, the Riders have to go round by the bridge.'),
  ],
  bree: [
    frodo('We wait at the Prancing Pony for Gandalf. Underhill is my name here, not Baggins.'),
    sam('Big folk everywhere, and that one in the corner hasn’t taken his eyes off you.'),
    pippin('A drink in an inn in Bree. If Gaffer Gamgee could see us now.'),
    merry('They call him Strider: a Ranger from the wild. Gandalf’s letter says to trust him.'),
    sam('If he’s a friend of Gandalf’s, I’ll trust him. I’ll still keep a hand on the pans.'),
  ],
  weathertop: [
    aragorn('Amon Sûl: a watchtower of the old kings. From the top you can see for miles, and be seen.'),
    sam('No fire, he says. Then what’s the point of a pan.'),
    frodo('There are five of them, Strider says. Maybe all nine are out looking for us.'),
    aragorn('The Nine, the Ringwraiths: kings once, and now only shadows of the Enemy’s will. They feel the Ring and come to it.'),
    merry('Rivendell is still days away, and Frodo’s getting colder.'),
  ],
  ford: [
    aragorn('The Trollshaws: the trolls Bilbo met are still here, turned to stone by the dawn.'),
    sam('Mr Bilbo’s trolls. He told the tale a hundred times and I never believed a word.'),
    arwen('The river Bruinen is my father’s. If we cross it, they cannot follow.'),
    aragorn('Ride, and don’t look back. Arwen’s horse is the fastest in the north.'),
  ],
  rivendell: [
    frodo('Elrond’s house. Bilbo’s here, writing his book. I thought I’d never see him again.'),
    sam('Elves, Mr Frodo. Real Elves, singing in the trees. I could stop here all my days.'),
    aragorn('Narsil, the sword that was broken. Elendil’s blade, and Isildur cut the Ring from Sauron with it.'),
    merry('They’ve called a council: Elves, Dwarves, Men. All of them arguing over one ring.'),
    gimli('My people asked for news of Balin. None has come out of Moria in thirty years.'),
    legolas('Nine walkers against the nine Riders. Elrond chose well.'),
    boromir('Gondor has held the East for a thousand years. We could use this weapon against him.'),
  ],
  caradhras: [
    gandalf('Over the pass of Caradhras, or under the mountains through Moria. I would rather the snow.'),
    aragorn('Those birds are Saruman’s spies. Down, all of you, out of sight.'),
    legolas('There is a fell voice on the air. The mountain is not on our side.'),
    gimli('My cousin Balin rules in Moria now. There’d be fires and meat and ale for us, under the mountain.'),
    boromir('The halflings will die in this snow. We must turn back.'),
    gandalf('The Doors of Durin. They open only for a word, and I have forgotten more words than most.'),
  ],
  moria: [
    gimli('Balin’s tomb. He came to take Moria back, and Moria took him.'),
    gandalf('Quietly now. Something lives in the dark down here, and it is awake.'),
    pippin('I’m sorry about the well. I only touched it.'),
    gandalf('Dwarrowdelf, the great halls. Once they shone with lamps and gold.'),
    legolas('Fire and shadow out of the elder days. No bow of mine can touch it.'),
    aragorn('Gandalf! … Out, all of you. We go on, without him, for now.'),
  ],
  lorien: [
    legolas('Lothlórien: the Golden Wood. Its lady has kept it from the Shadow since the world was young.'),
    gimli('An Elf-witch in a wood, they say at home. I’ll keep my eyes open and my axe close.'),
    sam('Elves in the trees, ladders of rope, lamps like stars. Mr Frodo, I’ve no words for it.'),
    frodo('The Lady looked at me and I heard her voice in my head. She knows what I carry.'),
    aragorn('The Elves will give us boats. The river runs south, past the Pillars, to the Falls of Rauros.'),
  ],
  anduin: [
    aragorn('The Argonath: Isildur and Anárion, carved in the rock. My fathers.'),
    boromir('Minas Tirith is east and south of here. We could still go to my father’s city.'),
    sam('Boats. I never liked them. A hobbit belongs on the ground.'),
    frodo('Something is following the boats. I see it on a log, paddling in the dark.'),
    legolas('Orcs on the east bank. We should not linger at Amon Hen.'),
  ],
  marshes: [
    gollum('This way, master. Gollum knows the safe paths. Mind the lights in the water: look at them and you go under.'),
    sam('I don’t trust him, Mr Frodo. He’d slit our throats for that ring.'),
    frodo('Faces in the water, Sam. Elves, men, orcs, dead a long age ago.'),
    gollum('The Black Gate. Masters can’t go in there. Gollum knows another way.'),
  ],
  ithilien: [
    sam('Rabbits and herbs, Mr Frodo. A proper supper, if he’d let me cook it.'),
    gollum('Fish, fresh and cold. The fat one burns it and spoils it.'),
    frodo('Faramir, Boromir’s brother. He let us go, when he could have taken it.'),
    sam('The Morgul Vale. Even the flowers there smell of graves.'),
  ],
  'cirith-ungol': [
    gollum('Up the stairs, master. The stairs, and then the tunnel. Nice and quiet.'),
    sam('He’s leading us somewhere, Mr Frodo. I can feel it in my bones.'),
    frodo('Galadriel’s phial: the light of Eärendil, she said. For dark places.'),
  ],
  gorgoroth: [
    sam('There’s the Mountain, Mr Frodo. Not far now. We can make it.'),
    frodo('I can’t see the stars, Sam. Only the fire, and the Eye.'),
    sam('Think of the Shire, Mr Frodo. The Gaffer’s taters, and the Green Dragon of an evening.'),
    sam('Up you get. If your legs won’t do it, mine will, and you on my back.'),
  ],
  'minas-tirith': [
    aragorn('The White City. My city, now, and the people waiting in it.'),
    gimli('Seven circles of stone. My people would have made it ten.'),
    legolas('The Shadow has gone from the east. The air is clean again.'),
    pippin('I lit the beacon on the top of the citadel. I’ll tell you all about it.'),
  ],
  havens: [
    frodo('The Grey Havens. There is a ship waiting, and room on it for one more.'),
    sam('You’re going, Mr Frodo. I thought we’d grow old in the Shire together.'),
    merry('We came home and the Shire was the same. It was us who were different.'),
  ],
};

export const COMPANY = {
  frodo: ['It feels heavier every day. I can’t say how.', 'I wish the Ring had never come to me.'],
  sam: ['Every step’s the farthest from the Shire I’ve ever been, and the next one farther.', 'Potatoes. That’s what I’d give a lot for, a few good potatoes.'],
  merry: ['Pippin. Keep up.'],
  pippin: ['What about second breakfast?'],
  gandalf: ['Courage, and a little luck. They have carried smaller folk farther than this.'],
  aragorn: ['Keep close, and keep quiet. We are watched.'],
  boromir: ['In Gondor they would laugh: nine walkers, and four of them no taller than a boy.'],
  legolas: ['The trees are speaking. They remember the Elves.'],
  gimli: ['I’ll take a mountain over a forest any day.'],
  gollum: ['My precious!'],
  arwen: ['The light of the Elves will not fail you.'],
};

export function nextLine(stage, present, said) {
  const here = new Set(present);
  const own = CHATTER[stage] ?? [];
  for (let i = 0; i < own.length; i++) {
    const id = `${stage}:${i}`;
    if (here.has(own[i].who) && !said.has(id)) return { id, ...own[i] };
  }
  for (const who of present) {
    const lines = COMPANY[who] ?? [];
    for (let i = 0; i < lines.length; i++) {
      const id = `any:${who}:${i}`;
      if (!said.has(id)) return { id, who, text: lines[i] };
    }
  }
  return null;
}

export const saidFor = (text) => Math.min(9000, Math.max(2600, 1600 + 62 * text.length));
