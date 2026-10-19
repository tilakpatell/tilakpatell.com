// The Road’s voiced lines: every line a beat says, in the site’s own
// words (the film’s only through the clips lib/clips.js lists). The list
// is what scripts/voices records on the owner’s desktop; until a line is
// recorded it shows as words in the speaker’s bubble.
//
//   VOICELINES: [{ who, text }]   (grows with each stage)
//   LINES: { beatId: { who, text } }

const sam = (text) => ({ who: 'sam', text });
const frodo = (text) => ({ who: 'frodo', text });

export const LINES = {
  // (Hobbiton, the last of the lane: the corn the Shire ends at)
  'hobbiton-field-edge': sam('Past this corn I’ve never been, Mr Frodo. Not once in all my life.'),
  'hobbiton-field-edge-answer': frodo('Then we’ll go past it together, Sam.'),
};

export const VOICELINES = Object.values(LINES);
