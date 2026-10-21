// A Ricochet room's end card, in the 3D game's words, for both views.
import { ROOMS, limitFor } from './rules';

export function roomEnd(phase, result, index) {
  const def = ROOMS[index];
  if (phase === 'cleared') {
    const { stars, throws, catches } = result;
    return {
      won: true,
      kicker: `Room ${index + 1} clear`,
      title: ['', 'Done.', 'Nice throwing.', 'He could do this all day.'][stars],
      line: `${throws === 1 ? 'One throw' : `${throws} throws`}, par ${def.par}${catches ? ` · caught it ${catches === 1 ? 'once' : `${catches} times`}` : ''}.`,
      stars: { got: stars, of: 3 },
      stone: result.stone ? 'mind' : null,
      stoneText: 'The Mind Stone is yours, out of Loki’s sceptre.',
    };
  }
  const hostage = result?.reason === 'hostage';
  return {
    won: false,
    kicker: `Room ${index + 1}`,
    title: hostage ? 'You hit the hostage.' : 'Out of throws.',
    line: hostage ? 'The orange dummy is a hostage. Find a way around it.' : `Par is ${def.par}; you get ${limitFor(def)}. ${def.tip}`,
    stars: null,
    stone: null,
    stoneText: '',
  };
}
