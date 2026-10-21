// What the Eye says to whoever holds the Palantír too long, pure: a line
// at a time once the Eye is open, each a little nearer, the last as it
// sees them and the stone falls (./stone.js has the times). The words are
// the site’s own. ./sauronVoice.js says them.
//
//   LINES → [{ at (s of gaze), text, loud (0…1) }]
//   lineFor(gaze, said) → the index of the line due now, or −1 (`said`: how many have been said)

import { DROP } from './stone';

export const LINES = [
  { at: 2.6, loud: 0.35, text: 'Who looks into my stone, so far from the Black Land?' },
  { at: 4.6, loud: 0.45, text: 'A small round room. A fire. A book. I see them all.' },
  { at: 6.6, loud: 0.55, text: 'You have something that was mine. I can feel it near you, warm in the dark.' },
  { at: 8.6, loud: 0.65, text: 'Bring it to me, and I will leave you your little hill.' },
  { at: 10.4, loud: 0.8, text: 'There is no hole in Middle-earth deep enough to hide you.' },
  { at: 12.2, loud: 0.9, text: 'Look away, if you can.' },
  { at: DROP - 0.3, loud: 1, text: 'I see you.' },
];

export function lineFor(gaze, said = 0) {
  if (said >= LINES.length) return -1;
  return gaze >= LINES[said].at ? said : -1;
}
