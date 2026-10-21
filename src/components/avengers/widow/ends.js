// An Infiltration level's end card, in the 3D game's words, for both views,
// and who saw her when she's caught.
import { LEVELS, LEVEL_COUNT } from './rules';
import { HALF_OF } from '../world/labels';

export const CAUGHT = { guard: 'A guard saw you.', camera: 'The camera saw you.', laser: 'You stood in a live laser.' };

export function levelEnd(result, index) {
  const r = result ?? {};
  return {
    won: true,
    kicker: `Level ${index + 1} · ${LEVELS[index].name} · clear`,
    title: r.stone ? 'The file is out.' : ['Clean.', 'Unseen.', 'Like a ghost.'][Math.min(2, r.turns % 3)],
    line: `${r.turns} turns${r.takedowns ? ` · ${r.takedowns} ${r.takedowns === 1 ? 'takedown' : 'takedowns'}` : ''}${r.bites ? ` · ${r.bites} ${r.bites === 1 ? 'bite' : 'bites'}` : ''}. ${index + 1 < LEVEL_COUNT ? 'One more line of her file, declassified.' : 'Every line of it.'}`,
    stone: r.stone ? 'soul' : null,
    half: r.both ? null : HALF_OF['soul-natasha'],
    stoneText: r.both ? 'Natasha’s half of the Soul Stone, and Clint’s: the Soul Stone is yours.' : 'Natasha’s half of the Soul Stone. Clint has the other half, at the range.',
  };
}
