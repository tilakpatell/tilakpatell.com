// A 2017 hero's stance from its stroke table (src/data/bf2017/strokes/,
// measured from Battlefront II's clips): the strokes saber.js swings and
// strokeFor (gameStance.js) picks. The chain is the game's six strikes in
// turn, each with its measured contact window and its way back to the guard;
// the heavies are the jump attack and the dash; each way held is a strike the
// tip was measured cutting that way. A _BackToIdle is a strike's return, never
// a strike. What a stroke deals is the game's, the engine's (lib/combat/
// saber2017.js), not the stance's. Pure.
//
//   WAYS                          the ways a stroke can be held to: up (W), left, right (A, D), rise (S)
//   stanceFromTable(table, { id }) → a stance, or null when the set has no strikes
//     { id, name, strokes [{ clip, speed, contact, back, site? }], heavies [{ clip, speed, contact }], dirs { way: { clip, contact } },
//     blocks { left, right, any } (by the side each holds the blade on, as measured), blocked, staggers, dodges, dash, jump,
//     cadence { clip: { dur (till the blade rests), back (its return) } } (the duel's), cuts { clip: 'left' | 'right' } (the side of
//     the striker each of the game's strokes was measured coming in from, on the root's axes, the table's `side`, not its `dir`:
//     blockSide.js's; none for one more up or down than across), game (the hero) }

import { STANCE_NAMES } from './combatRules';

export const WAYS = ['up', 'left', 'right', 'rise'];

export function stanceFromTable(table, { id = 'single' } = {}) {
  const chain = (table?.strikes ?? []).filter((s) => s.variant === 1).sort((a, b) => a.index - b.index);
  if (!chain.length) return null;
  const all = [...(table.strikes ?? [])].sort((a, b) => b.variant - a.variant || a.index - b.index);
  const strokes = chain.map((s) => ({
    clip: s.name,
    speed: 1,
    contact: s.contact,
    back: s.return,
    ...(s.site ? { site: s.site } : {}),
  }));
  // (a hero with neither falls back on its second strikes, the _V2 set: still the game's)
  const heavyOf = (k) => k && { clip: k.name, speed: 1, contact: k.contact };
  let heavies = [table.jump, table.dash].map(heavyOf).filter(Boolean);
  if (!heavies.length) heavies = all.filter((s) => s.variant > 1).map(heavyOf);
  if (!heavies.length) heavies = [heavyOf(chain.at(-1))];
  const dirs = Object.fromEntries(
    WAYS.map((way) => {
      const s = all.find((k) => k.dir === way) ?? chain[0];
      return [way, { clip: s.name, contact: s.contact }];
    }),
  );
  const cadence = Object.fromEntries((table.strikes ?? []).map((s) => [s.name, { dur: s.settle ?? s.duration, back: s.returnDuration }]));
  const cuts = Object.fromEntries([...(table.strikes ?? []), table.jump, table.dash].filter((s) => s?.side).map((s) => [s.name, s.side]));
  return {
    id,
    name: STANCE_NAMES[id] ?? STANCE_NAMES.single,
    strokes,
    heavies,
    dirs,
    blocks: table.blocks,
    blocked: table.blocked ?? [],
    staggers: table.staggers ?? null,
    dodges: table.dodges ?? null,
    dash: table.dash ?? null,
    cadence,
    cuts,
    game: table.hero,
  };
}
