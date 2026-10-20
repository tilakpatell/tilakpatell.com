// The stone heist: each building's game gives up one Infinity Stone, kept
// between visits. Clint and Natasha went to Vormir together, so the Soul Stone
// takes both of their games. The stones you earn are set in Thanos's
// gauntlet; all six earned this way is the heist. Each stone's first win and
// each game's tries are kept in the heist's record (./heist.js, tp-hq-heist,
// through runtime/saves).
import { useEffect, useState } from 'react';
import { createSaves } from '../../../runtime/saves';
import { HEIST_GAMES, HEIST_KEY, loadHeist, registerHeist, withStone, withTry } from './heist';

const KEY = 'tp-hq-stones';
const EVENT = 'tp:stones';

// the gauntlet's order (src/components/interests/stones.js)
export const STONE_IDS = ['space', 'mind', 'reality', 'power', 'time', 'soul'];
export const SOUL_HALVES = ['soul-clint', 'soul-natasha'];

function read() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((s) => STONE_IDS.includes(s) || SOUL_HALVES.includes(s)) : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: it lasts for this page */
  }
}

// The heist's record, through a saves instance made on each call (as read and
// write read window each time; the cached localSaves() would keep the first storage it saw).
const localStore = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
const heistSaves = () => {
  const saves = createSaves({ local: localStore() });
  registerHeist(saves);
  return saves;
};
const noteHeist = (change, held) => {
  const saves = heistSaves();
  saves.set(HEIST_KEY, change(loadHeist(saves, held)));
};

// The stones earned, in the gauntlet's order.
export const earnedStones = () => {
  const have = read();
  return STONE_IDS.filter((s) => have.includes(s));
};

// Whether a half of the Soul Stone (or a whole stone) has been earned.
export const hasEarned = (id) => read().includes(id);

export const heistComplete = () => earnedStones().length === STONE_IDS.length;

// Earn a stone (or Clint's or Natasha's half of the Soul Stone). True only
// when this completes a stone that wasn't already held.
export function earnStone(id) {
  if (!STONE_IDS.includes(id) && !SOUL_HALVES.includes(id)) return false;
  const have = read();
  if (have.includes(id)) return false;
  const next = [...have, id];
  let got = STONE_IDS.includes(id) ? id : null;
  if (!got && SOUL_HALVES.every((h) => next.includes(h)) && !next.includes('soul')) {
    next.push('soul');
    got = 'soul';
  }
  write(next);
  // (seeded with the stones held before this win, so this one gets its time rather than null)
  if (got) noteHeist((r) => withStone(r, got, Date.now()), STONE_IDS.filter((s) => have.includes(s)));
  if (!got) return false;
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: got }));
  } catch {
    /* no window events here */
  }
  return true;
}

export function forgetStones() {
  write([]);
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
  } catch {
    /* no window events here */
  }
}

// The heist's record: when each stone was first won (null for one held
// before the record began) and how many times each game was started. Never writes.
export const heistRecord = () => loadHeist(heistSaves(), earnedStones());

// One start of a building's game (a place id); any other id is ignored.
export function recordTry(game) {
  if (!HEIST_GAMES.includes(game)) return;
  noteHeist((r) => withTry(r, game), earnedStones());
}

// The stones earned so far, kept up to date as games give them up.
export function useStones() {
  const [stones, setStones] = useState(earnedStones);
  useEffect(() => {
    const on = () => setStones(earnedStones());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return stones;
}
