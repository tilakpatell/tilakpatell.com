// The Road’s voiced lines: every line a beat says, in the site’s own
// words (the film’s only through the clips lib/clips.js lists). The list
// is what scripts/voices records on the owner’s desktop; until a line is
// recorded it shows as words in the speaker’s bubble.
//
//   VOICELINES: [{ who, text }]   (grows with each stage)
//   LINES: { beatId: { who, text } }
//   SPEAKERS: who may say one: the cast, and the few met on the road who
//     do not walk it (Butterbur at his own bar)
//
// A line the site has recorded already is reused word for word, so its
// voice is found (lib/voiced.js’s lineId reads the words): Strider’s at
// Bree’s dawn, Boromir’s at the Council, Bilbo’s with his book.

import { CAST } from './fellowship';

export const SPEAKERS = [...CAST, 'butterbur'];

const sam = (text) => ({ who: 'sam', text });
const frodo = (text) => ({ who: 'frodo', text });
const aragorn = (text) => ({ who: 'aragorn', text });

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
};

export const VOICELINES = Object.values(LINES);
