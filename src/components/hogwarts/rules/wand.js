// The wand that comes with the house (the design’s §4.2): its wood, its
// core and its length read off the three answers the Hat heard, so the
// same answers always make the same wand, and said on the card as a
// wandmaker would say it. Pure.
//
//   WOODS: { house: [four woods] }   CORES   FLEX
//   wandFor(answers, house) → { wood, core, inches, flex, said }
//     the wood: the house’s four, by the second answer (what you did for a
//     friend); the core: by the third (what you would hate to be called),
//     a phoenix feather now and then by the answers’ own seed; the length
//     nine to fourteen inches in quarters, by the seed; how it gives, by
//     the first answer and the seed
//   inchesSaid(inches) → 'eleven and three-quarter inches'

import { HOUSE_IDS, seedOf } from './sorting';

export const WOODS = {
  gryffindor: ['holly', 'red oak', 'larch', 'chestnut'],
  slytherin: ['blackthorn', 'yew', 'ebony', 'hawthorn'],
  ravenclaw: ['vine', 'walnut', 'hornbeam', 'silver lime'],
  hufflepuff: ['ash', 'beech', 'pear', 'rowan'],
};
export const CORES = ['dragon heartstring', 'unicorn hair', 'phoenix feather'];
// the third answer’s core: the coward and the ordinary want fire; the fool and the unkind want patience
const CORE_OF = [0, 0, 1, 1];
const PHOENIX = 9; // one seed in nine finds a feather
export const FLEX = ['Quite springy.', 'Unyielding.', 'Nice and supple.', 'Reasonably pliant.', 'Surprisingly swishy.', 'Slightly yielding.', 'Quite bendy.', 'Solid.'];

const WHOLE = ['nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
const PART = ['', ' and a quarter', ' and a half', ' and three-quarter'];

export function inchesSaid(inches) {
  const whole = Math.floor(inches);
  const part = Math.round((inches - whole) * 4);
  return `${WHOLE[whole - 9]}${PART[part]} inches`;
}

export function wandFor(answers, house) {
  if (!HOUSE_IDS.includes(house)) throw new Error(`no house ${house}`);
  const seed = seedOf(answers);
  const wood = WOODS[house][answers[1]];
  const core = seed % PHOENIX === 0 ? CORES[2] : CORES[CORE_OF[answers[2]]];
  // (nine to fourteen in quarters: 21 lengths)
  const inches = 9 + ((seed >>> 4) % 21) / 4;
  const flex = FLEX[(answers[0] * 2 + ((seed >>> 9) & 1)) % FLEX.length];
  const said = `${wood[0].toUpperCase()}${wood.slice(1)}, ${core}, ${inchesSaid(inches)}. ${flex}`;
  return { wood, core, inches, flex, said };
}
