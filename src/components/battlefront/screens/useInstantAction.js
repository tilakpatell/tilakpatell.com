import { useEffect, useMemo, useState } from 'react';
import { loadSettings, optionsFor, sideCap } from '../../../lib/battlefront/instantAction.js';
import { defaultsOf, rowsFor, setCount, sidesOf, step } from '../../../lib/battlefront/instantActionForm.js';
import { loadRulebook } from '../../../lib/battlefront/rulebook.js';
import { device } from '../../../lib/device';

// The Instant Action setup screen's state: the round's options as the
// screen changes them, over the sim's own list of them (lib/battlefront/
// instantAction.js's optionsFor, each count's most already brought down to
// this machine's share) and its logic (instantActionForm.js: the game's
// order, words, steps and defaults). The settings' rows come apart from the
// page (68 KB), so the list is null for a moment.
//
// useInstantAction(level, { schema }) → null | { rows, options, sides, words, step(id, dir), setCount(id, n), reset(), changeFaction() }
//   (`schema` given, a test's or the world's own, is used as it is)

// the screen's own words (the rulebook's ai.instantAction.$screen: the game's strings)
export const wordsOf = (rb) => Object.fromEntries(Object.entries(rb?.ai?.instantAction?.$screen ?? {}).map(([k, v]) => [k, v?.text ?? '']));

// the rows the screen lists, by the game's two headings: the side is the foot's CHANGE FACTION, and the Overhaul's
// own rows stand only while its bot logic is the one chosen
export function groupsOf(rows, options) {
  const of = (g) => rows.filter((r) => r.group === g);
  const overhaul = options?.botLogic === 'overhaul' ? of('overhaul') : [];
  return { modifiers: of('modifiers'), advanced: [...of('advanced'), ...of('site'), ...overhaul] };
}

// the row above or below (dir -1 or 1) in the list's order, stopping at its ends
export function moveRow(ids, at, dir) {
  const i = ids.indexOf(at);
  if (i < 0) return ids[0] ?? null;
  return ids[Math.max(0, Math.min(ids.length - 1, i + dir))];
}

export function useInstantAction(level = 'hoth', { schema: given = null } = {}) {
  const [gs, setGs] = useState(null);
  useEffect(() => {
    if (given) return undefined;
    let live = true;
    loadSettings()
      .then((s) => live && setGs(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [given]);
  const rb = useMemo(() => loadRulebook(), []);
  const schema = useMemo(() => given ?? (gs ? optionsFor(gs, { rulebook: rb, level, cap: sideCap(device().detail) }) : null), [given, gs, rb, level]);
  const [picked, setPicked] = useState(null);
  if (!schema) return null;
  const options = picked ?? defaultsOf(schema);
  return {
    rows: rowsFor(schema, options),
    options,
    sides: sidesOf(schema, options),
    words: wordsOf(rb),
    step: (id, dir) => setPicked(step(schema, options, id, dir)),
    setCount: (id, n) => setPicked(setCount(schema, options, id, n)),
    reset: () => setPicked(defaultsOf(schema)),
    changeFaction: () => setPicked(step(schema, options, 'team', 1)),
  };
}
