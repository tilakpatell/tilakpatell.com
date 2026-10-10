// A saber hero's stance: the game's strokes from its stroke table
// (src/data/bf2017/strokes/, stanceFromTable.js), for a figure on the 2017
// game's rig; a figure on the rig whose pack has no strikes of its own (the
// Emperor's set, a clone's) fences by Luke's, the rulebook's stand-in. Apart
// from combatRules.js so the pages that only need its names (the universe's
// online protocol reads STANCE_IDS) don't load the tables: with them behind it
// every flight page carried them, and the multiplayer check's turret reached
// the other pilot half a second later, past its 3 s.
//
//   stanceFor(id, hero?) → the stance; hero: { rig, pack } (a crew row): null off the game's rig (nothing else fences)
//   strokeFor(stance, { last, now, dir, heavy, combo })   the stroke to make now: { clip, speed, contact, heavy, kind, i };
//                        a way held (dir) its own (the stance's `dirs`), a heavy one the next of its `heavies` while they
//                        chain, else the next of the combo within `combo` seconds (the rulebook's hand.combo) of the last
//                        ending (`last`: the stroke before, with its endedAt)

import BOOK from '../../../data/bf2017/saber.json';
import { strokeTable } from '../../../data/bf2017/strokes';
import { stanceFromTable } from './stanceFromTable';

const GAME = new Map();
const STAND_IN = BOOK.hand.standIn;

export function stanceFor(id, hero = null) {
  if (hero?.rig !== 'walrus') return null;
  const key = `${hero.pack ?? ''}:${id}`;
  if (!GAME.has(key)) GAME.set(key, stanceFromTable(strokeTable(hero.pack), { id }) ?? stanceFromTable(strokeTable(STAND_IN), { id }));
  return GAME.get(key);
}

export function strokeFor(stance, { last = null, now = 0, dir = null, heavy = false, combo = BOOK.hand.combo } = {}) {
  const chain = (kind) => last?.kind === kind && now - last.endedAt <= combo;
  const pick = (kind, i, k, extra = {}) => ({ kind, i, clip: k.clip, speed: k.speed ?? 1, heavy: kind === 'heavy', ...(k.contact ? { contact: k.contact } : {}), ...extra });
  if (heavy) {
    const i = chain('heavy') ? (last.i + 1) % stance.heavies.length : 0;
    return pick('heavy', i, stance.heavies[i]);
  }
  const way = stance.dirs?.[dir];
  if (way) return pick('dir', 0, way);
  const i = chain('combo') ? (last.i + 1) % stance.strokes.length : 0;
  return pick('combo', i, stance.strokes[i], stance.strokes[i].site ? { site: stance.strokes[i].site } : {});
}
