// A bot's name, from the game's lists (`Gameplay/GameModes/<mode>/AINames_<faction>_<mode>`,
// ai.names.json): the faction's list for the mode (`skirmish`, `spaceBattles`),
// else its Skirmish list (the ground bots' own: the game has no multiplayer
// list), shuffled by the seed so a battle's order is its seed's, and no name
// twice in a match; once the list runs out a name comes round again numbered
// (`TK-772 2`). Pure.
//
//   nameFor(faction, mode, seed, taken) → string (added to `taken`)
//   namesFor(faction, mode, seed, n) → the first n of the seed's order
//   factionOf(team, era) → 'rebels' | 'empire' | 'republic' | 'separatists'   team: a teams.json side ({ faction })

import NAMES from '../../../data/bf2017/ai.names.json';
import { seeded } from '../../seeded.js';

const listOf = (faction, mode) => {
  const f = NAMES.rows[faction] ?? {};
  return [...new Set((f[mode] ?? f.skirmish ?? Object.values(f)[0] ?? { names: [] }).names)];
};

// the list in the seed's order (Fisher–Yates on its own seeded draw, not the sim's)
function order(faction, mode, seed) {
  const list = listOf(faction, mode);
  const rand = seeded((seed * 7919) ^ 0x5eed);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function nameFor(faction, mode, seed, taken = new Set()) {
  const list = order(faction, mode, seed);
  if (!list.length) return null;
  for (let round = 1; ; round++) {
    for (const n of list) {
      const name = round === 1 ? n : `${n} ${round}`;
      if (!taken.has(name)) {
        taken.add(name);
        return name;
      }
    }
  }
}

export const namesFor = (faction, mode, seed, n) => order(faction, mode, seed).slice(0, n);

export function factionOf(team, era = 'Orig') {
  const light = /light/i.test(team?.faction ?? '');
  return era === 'Orig' ? (light ? 'rebels' : 'empire') : light ? 'republic' : 'separatists';
}
