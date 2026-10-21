// The ground war's one difficulty: the game's multiplayer rows by their
// names (src/lib/battlefront/ai/difficulty.js), Normal unless the Menu says
// otherwise, kept in the visitor's storage and set for a check by the
// address (`?difficulty=expert`). Every soldier's brain takes it (brain.js):
// how soon it fires at a new target, how quickly its aim settles, how much
// a sprint or a crouch throws it, and its damage to you. Pure, tested.
//
//   DIFFICULTY_KEY, DEFAULT_DIFFICULTY
//   difficultyName(raw) → one of DIFFICULTIES (the default for anything else)
//   difficultyFrom(param, stored) → the address's name, else the kept one, else the default
//   nextDifficulty(name) → the Menu's next   difficultyLabel(name) → its words

import { DIFFICULTIES } from '../../../../lib/battlefront/ai/difficulty';

export const DIFFICULTY_KEY = 'tp-galaxy-difficulty';
export const DEFAULT_DIFFICULTY = 'normal';

export const difficultyName = (raw) => (typeof raw === 'string' && DIFFICULTIES.includes(raw.toLowerCase()) ? raw.toLowerCase() : DEFAULT_DIFFICULTY);

export const difficultyFrom = (param, stored) => difficultyName(param ?? stored);

export const nextDifficulty = (name) => DIFFICULTIES[(DIFFICULTIES.indexOf(difficultyName(name)) + 1) % DIFFICULTIES.length];

export const difficultyLabel = (name) => {
  const n = difficultyName(name);
  return n[0].toUpperCase() + n.slice(1);
};
