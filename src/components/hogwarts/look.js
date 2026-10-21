// Hogwarts' look (components/worlds/looks.js): the house's scanned look,
// the kit's models and the CC0 sets on the house shade, under the house
// tone and the house bloom: the castle's windows, the lanterns and the moon
// are lifted over its threshold, so they halo and the lit stone doesn't.

import { BLOOM } from '../../lib/three/bloom';

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: BLOOM,
  why: { art: 'A Highland night drawn as the films light it: the kit’s pines and rocks and the castle’s stone on the house shade, the warmth all in the windows and the lanterns.' },
};
