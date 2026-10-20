// The Road’s voiced lines: every line a beat says, in the site’s own
// words (the film’s only through the clips lib/clips.js lists). The list
// is what scripts/voices records on the owner’s desktop; until a line is
// recorded it shows as words in the speaker’s bubble.
//
//   VOICELINES: [{ who, text }]   (grows with each stage)
//   LINES: { beatId: { who, text } }
//   SPEAKERS: who may say one: the cast, and the few met on the road who
//     do not walk it (Butterbur at his own bar, Saruman on the wind, Haldir
//     on the Nimrodel, Faramir in Ithilien)
//
// A line the site has recorded already is reused word for word, so its
// voice is found (lib/voiced.js’s lineId reads the words): Strider’s at
// Bree’s dawn, Boromir’s at the Council, Bilbo’s with his book.

import { CAST } from './fellowship';

export const SPEAKERS = [...CAST, 'butterbur', 'saruman', 'haldir', 'faramir'];

const sam = (text) => ({ who: 'sam', text });
const frodo = (text) => ({ who: 'frodo', text });
const aragorn = (text) => ({ who: 'aragorn', text });
const gandalf = (text) => ({ who: 'gandalf', text });

export const LINES = {
  // (Hobbiton, the last of the lane: the corn the Shire ends at)
  'hobbiton-field-edge': sam('Past this corn I’ve never been, Mr Frodo. Not once in all my life.'),
  'hobbiton-field-edge-answer': frodo('Then we’ll go past it together, Sam.'),
  // (Bree: Butterbur through the Pony’s window, then Strider at dawn)
  'bree-pony': { who: 'butterbur', text: 'Mr Underhill, was it? There’s a letter come for you, and I clean forgot it.' },
  'bree-dawn': aragorn('Weathertop is six days from here, by the wild ways.'),
  // (Weathertop: Aragorn kneeling over Frodo)
  'weathertop-kingsfoil': aragorn('A Morgul blade, and a shard of it still in him. This is past my healing.'),
  // (the Ford: Arwen out of the trees)
  'ford-arwen': { who: 'arwen', text: 'I am Arwen, Elrond’s daughter. Hold fast to me, Frodo. My father’s house is near.' },
  // (the Council: Elrond, Boromir, and Frodo on his feet)
  'rivendell-elrond': { who: 'elrond', text: 'It cannot be hidden here, nor sent over the Sea. It must go east, into the fire it came from.' },
  'rivendell-boromir': { who: 'boromir', text: 'Minas Tirith is the safer road. You know that.' },
  'rivendell-frodo': frodo('Then it had better be me. I don’t know the way, but I’ll carry it.'),
  // (Bilbo on his bench, the book open)
  'rivendell-bilbo': { who: 'bilbo', text: 'There and Back Again: A Hobbit’s Tale, by Bilbo Baggins.' },
  // (Caradhras: Saruman on the wind, then Gandalf reading the Doors)
  'caradhras-saruman': { who: 'saruman', text: 'Turn back, Grey Pilgrim. The mountain is mine tonight, and it will bury you.' },
  'caradhras-mellon': gandalf('Speak, friend, and enter. I read it as a riddle. It was only ever a welcome: mellon.'),
  // (Balin’s tomb)
  'moria-gimli': { who: 'gimli', text: 'Here lies Balin, son of Fundin, Lord of Moria. So he is dead, then. I feared it.' },
  // (Haldir on the Nimrodel, then the Lady on her dais)
  'lorien-haldir': { who: 'haldir', text: 'You breathe so loud we could have shot you in the dark. Come. The Lady has asked for you.' },
  'lorien-galadriel': { who: 'galadriel', text: 'Nine left Rivendell. Eight are here. Your quest stands on the edge of a knife.' },
  // (before the Black Gate: Gollum’s other way)
  'marshes-gollum': { who: 'gollum', text: 'Not this gate, master. They will catch you. There is another way, a secret way, up the dark stairs.' },
  // (Ithilien: Sam at the mûmakil, Faramir out of the ferns)
  'ithilien-sam': sam('An oliphaunt, Mr Frodo. Grey as a house, and nobody at home will ever believe me.'),
  'ithilien-faramir': { who: 'faramir', text: 'You are no orcs, and no spies of the Enemy I know. Tell me what brings two halflings to Ithilien.' },
  // (Cirith Ungol: Gollum in Frodo’s ear, then Sam alone over him)
  'cirith-gollum': { who: 'gollum', text: 'The fat one eats the bread, master. He wants it for himself. Send him away.' },
  'cirith-sam': sam('I won’t leave you to them, Mr Frodo. Not while I’ve breath in me.'),
  // (the deeds’: said once the visitor has done them)
  'marshes-faces': sam('Don’t look in the lights, Mr Frodo. Come away from the water.'),
  'ithilien-crown': frodo('Look, Sam. Flowers round his head, a crown of them. The dark doesn’t win every time.'),
  'ithilien-vale': sam('Not that way, Mr Frodo. Look at me, not at it.'),
  'cirith-phial': sam('Galadriel’s light. Back to your hole, you, and stay there.'),
  // (the White City: Pippin on the field, the King in the Court before the four bow)
  'minas-pippin': { who: 'pippin', text: 'There it is. I rode up all seven of those streets on Shadowfax, in the dark, with Gandalf.' },
  'minas-aragorn': aragorn('This city is yours as much as mine. Every one of you carried it here.'),
  // (the Havens: Gandalf by the ship, Frodo to the three)
  'havens-gandalf': { who: 'gandalfwhite', text: 'It is time, Frodo. The tide will not wait for us twice.' },
  'havens-frodo': frodo('Go home, Sam. Rosie is waiting, and the little one. The Shire needs you more than I do.'),
};

export const VOICELINES = Object.values(LINES);
