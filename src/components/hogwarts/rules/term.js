// The term (the design’s §4.7): a clock of twelve weeks, from September
// to the leaving feast. A week goes by when you sleep in your bed, when you
// finish a lesson, or when the world’s clock has run three of its days
// since the week began (a week is a Monday, a Tuesday and a Saturday:
// rules/people.js keeps every third day for the weekend). The season
// follows the weeks: autumn, the Christmas feast at the sixth with snow on
// the grounds and the twelve trees in the hall, winter, spring, and the
// leaving feast at the twelfth, when the House Cup is given. The term holds
// at its last week; the year after starts it again from the first. Pure.
//
//   TERM: { weeks, days (world days a week), christmas, leaving, map (the week the Map comes) }
//   MONTHS: the month each week is in
//   newTerm({ week, day, year }) → { week, began (the world day the week began), year, feast }
//   advance(term, event) → { term, events }
//     event: { type: 'sleep', day } | { type: 'lesson-done', day } | { type: 'day', day }
//            | { type: 'feast' } (the leaving feast held) | { type: 'year', day } (the next year begun)
//     events: { type: 'week', week, from, why } as a week goes by, { type: 'christmas' } on reaching it,
//             { type: 'leaving' } on reaching the last week
//   seasonOf(week) → 'autumn' | 'winter' | 'spring' | 'summer'
//   isChristmas(week), isLeaving(week)
//   weekLabel(week) → ‘Week 6 · December’
//   parseWeek(search) → the week from ?week= (1…12), or null

export const TERM = { weeks: 12, days: 3, christmas: 6, leaving: 12, map: 2 };

export const MONTHS = ['September', 'September', 'October', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];

const clampWeek = (w) => Math.min(TERM.weeks, Math.max(1, Math.round(w)));

export const newTerm = ({ week = 1, day = 0, year = 1 } = {}) => ({ week: clampWeek(week), began: day, year, feast: false });

export function seasonOf(week) {
  const w = clampWeek(week);
  if (w < TERM.christmas) return 'autumn';
  if (w <= 8) return 'winter';
  if (w < TERM.leaving) return 'spring';
  return 'summer';
}
export const isChristmas = (week) => clampWeek(week) === TERM.christmas;
export const isLeaving = (week) => clampWeek(week) === TERM.leaving;
export const weekLabel = (week) => `Week ${clampWeek(week)} · ${MONTHS[clampWeek(week) - 1]}`;

export function parseWeek(search) {
  if (search == null) return null;
  const raw = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('week') : search.get?.('week');
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= TERM.weeks ? n : null;
}

// one week on (none past the last), with what reaching it brings
function onWeek(term, day, why) {
  if (term.week >= TERM.weeks) return { term: { ...term, began: day ?? term.began }, events: [] };
  const week = term.week + 1;
  const events = [{ type: 'week', week, from: term.week, why }];
  if (week === TERM.christmas) events.push({ type: 'christmas' });
  if (week === TERM.leaving) events.push({ type: 'leaving' });
  return { term: { ...term, week, began: day ?? term.began }, events };
}

export function advance(term, event) {
  switch (event?.type) {
    case 'sleep':
      return onWeek(term, event.day, 'slept');
    case 'lesson-done':
      return onWeek(term, event.day, 'lesson');
    case 'day': {
      // (the clock run on: a week for every three days since this one began, one at a time)
      if (event.day - term.began < TERM.days) return { term, events: [] };
      return onWeek(term, term.began + TERM.days, 'days');
    }
    case 'feast':
      return isLeaving(term.week) ? { term: { ...term, feast: true }, events: [] } : { term, events: [] };
    case 'year':
      return term.feast ? { term: newTerm({ week: 1, day: event.day ?? term.began, year: term.year + 1 }), events: [{ type: 'week', week: 1, from: term.week, why: 'year' }] } : { term, events: [] };
    default:
      return { term, events: [] };
  }
}
