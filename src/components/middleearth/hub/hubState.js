// The first step the hub offers: one way in, worded for where the visitor
// is. Someone new is offered the Road first (the Road's design, §4.9), the
// Shire beside it; someone who has ridden it and won nothing yet is told to
// walk it themselves, from the Shire; someone part-way carries on at the
// first chapter in the road's order they haven't won (not the furthest
// they've reached, so a jump ahead doesn't hide the gaps behind it); someone
// who has won it all is offered the road again. The ghost beside it is the
// other way in. Pure, so the map and its ribbon agree and the tests can check it.
import { CHAPTERS, chapter } from '../chapters';
import { chapterRecord } from '../record';

const RIDE = '/middle-earth/road';
const BEGIN = { kind: 'begin', id: 'shire', label: 'Begin at the Shire' };

// the first chapter in road order not yet won, or null when all are
export function nextUnfinished(unlocked = []) {
  return CHAPTERS.find((c) => !chapterRecord(c, { unlocked }).won)?.id ?? null;
}

const anySeal = (unlocked) => {
  const have = new Set(unlocked);
  return CHAPTERS.some((c) => c.seals.some((s) => have.has(s)));
};

// `ridden`: the Road counts as ridden (./road/entry.js's `ridden`)
export function firstStep(unlocked = [], { ridden = false } = {}) {
  if (!anySeal(unlocked)) return ridden ? { ...BEGIN, label: 'Now walk it yourself · Begin at the Shire' } : { kind: 'ride', to: RIDE, label: 'Ride the Road' };
  const id = nextUnfinished(unlocked);
  if (!id) return { kind: 'again', id: 'shire', label: 'The road again' };
  return { kind: 'carry', id, label: `Carry on · ${chapter(id).name}` };
}

export function ghost(unlocked = [], { ridden = false } = {}) {
  if (ridden) return { kind: 'ride-again', to: RIDE, label: 'Ride the Road again' };
  return anySeal(unlocked) ? { kind: 'ride', to: RIDE, label: 'Ride the Road' } : BEGIN;
}
