// The term, composed (Lane F): the week (rules/term.js), the house points
// and the rivals (rules/points.js), the thirteen quests (rules/quests.js)
// and the cards found (rules/cards.js), kept in the world’s one save under
// tp-hogwarts beside the Sorting’s keys (the house, the wand), and moved by
// the world’s events: a lesson’s end, points won and lost, a match’s
// result, a room gone into, the night’s own (the dementors driven off, the
// Patronus learnt, caught after curfew). What it says back goes to the page
// through `tell`: toasts, the week, the points chip’s numbers, the
// objective and the list of things to do, achievements.
//
//   SAVE_KEY, KEYS (the save’s keys this lane writes)
//   readSave(saves) → the save’s object (never null); writeSave(saves, patch) → merged in, nothing else touched
//   createSchool({ saves, tell, house, week, day }) → {
//     hear(type, data) → the world’s events, step(dt, t) (t: world hours), view() → the HUD’s view,
//     house, week, learnt, knows(spell), feast() → the Cup (the leaving feast held), sleep(day), setWeek(w), nextYear(day) }
//   hears: 'points' (always your house’s, unless marked rival), 'lesson', 'result', 'house', 'sorted', 'room' and
//     'enter' (a room gone into), 'learnt', 'driven', 'pickup', 'caught', 'restricted', 'book', 'willow',
//     'frozen', 'butterbeer', 'sweet'
//   tells: 'toast', 'school' (the view), 'cup' (a point won or lost, with the totals), 'week', 'quest', 'card', 'achievement'
//   view(): { house, week, label, season, totals, standings, list, objective, done, total, christmas, leaving, feasted }

import { TERM, advance as termOn, isChristmas, isLeaving, newTerm, seasonOf, weekLabel } from '../rules/term';
import { apply, newPoints, standings, totals, winner, words } from '../rules/points';
import { QUESTS, advance as questOn, doneCount, listFor, newQuests, objectiveOf } from '../rules/quests';
import { find } from '../rules/cards';

export const SAVE_KEY = 'tp-hogwarts';
export const KEYS = ['term', 'points', 'quests', 'cards', 'learnt', 'cloak'];
const isObject = (o) => Boolean(o) && typeof o === 'object' && !Array.isArray(o);

// (registered as the Sorting’s lane registers it: version 1, every key kept)
export function readSave(saves) {
  saves?.register?.({ key: SAVE_KEY, version: 1, migrate: (old) => ({ ...(isObject(old) ? old : {}) }) });
  const s = saves?.get?.(SAVE_KEY, {});
  return isObject(s) ? s : {};
}
export function writeSave(saves, patch) {
  const now = readSave(saves);
  saves?.set?.(SAVE_KEY, { ...now, ...patch });
}

const HOUSES = { gryffindor: 'Gryffindor', hufflepuff: 'Hufflepuff', ravenclaw: 'Ravenclaw', slytherin: 'Slytherin' };
const PARCEL = 'An owl drops a parcel at your feet: a cloak like water, and a note with no name on it. I to put it on.';
// (one sentence a toast: what’s done, and what it was worth if this lane pays it)
const DONE_LINE = (q, house) => (q.points && q.paid === 'quest' ? `${q.title}, done: ${words(q.points)} points to ${HOUSES[house]}.` : `${q.title}, done.`);
const WEEK_LINE = (w) => (w === TERM.christmas ? `${weekLabel(w)}, with snow on the grounds and twelve trees in the Great Hall.` : w === TERM.leaving ? `${weekLabel(w)}, the last week of term: the leaving feast is tonight.` : `${weekLabel(w)}, and the term goes on.`);

export function createSchool({ saves = null, tell = () => {}, house: given = null, week = null, day = 0 } = {}) {
  let forced = week;
  const save = readSave(saves);
  // (the house the Sorting gave, from the save; a Sorting in this visit sets it again)
  let house = given ?? (typeof save.house === 'string' ? save.house : 'gryffindor');
  let term = isObject(save.term) ? { ...newTerm({ day }), ...save.term } : newTerm({ day });
  // (?week= sets the week for the visit without writing it)
  if (forced) term = { ...term, week: forced, began: day };
  let points = isObject(save.points) && isObject(save.points.own) ? { ...newPoints({ house, year: term.year }), own: { ...newPoints().own, ...save.points.own }, log: save.points.log ?? [] } : newPoints({ house, year: term.year });
  let quests = { ...newQuests(), ...(isObject(save.quests) ? save.quests : {}) };
  let cards = Array.isArray(save.cards) ? save.cards : [];
  let learnt = Array.isArray(save.learnt) ? save.learnt : [];
  let cloak = Boolean(save.cloak);
  let feasted = Boolean(term.feast);
  let dirty = false;
  let seen = -1; // (the world’s day, as the clock last said)

  const keep = () => {
    dirty = false;
    writeSave(saves, { term: forced ? (readSave(saves).term ?? null) : term, points: { own: points.own, log: points.log }, quests, cards, learnt, cloak });
  };
  const ctx = () => ({ house, week: term.week });
  const toast = (text) => text && tell('toast', { text });

  // the HUD’s view, worked out when something changes
  let view = null;
  const refresh = () => {
    const t = totals(points, term.week);
    view = {
      house,
      houseName: HOUSES[house],
      week: term.week,
      label: weekLabel(term.week),
      season: seasonOf(term.week),
      totals: t,
      standings: standings(points, term.week),
      list: listFor(quests, ctx()),
      objective: objectiveOf(quests, ctx()),
      done: doneCount(quests),
      total: QUESTS.length,
      christmas: isChristmas(term.week),
      leaving: isLeaving(term.week),
      feasted,
      year: term.year,
      cloak,
    };
    tell('school', view);
  };

  // the quests first (their own points come back as events, counted in turn)
  function quest(e) {
    const r = questOn(quests, e, ctx());
    if (!r.events.length) return;
    quests = r.state;
    dirty = true;
    for (const ev of r.events) {
      if (ev.type === 'points') score(ev);
      else if (ev.type === 'quest') {
        const q = QUESTS.find((x) => x.id === ev.id);
        if (ev.done) {
          toast(DONE_LINE(q, house));
          tell('quest', ev);
          if (doneCount(quests) === QUESTS.length && feasted && winner(points, term.week) === house) tell('achievement', { id: 'hp-head' });
        } else if (ev.back) toast(`${q.title}: back to “${ev.text}”.`);
        else tell('quest', ev);
      }
    }
  }
  function score(e) {
    const was = points;
    points = apply(points, e);
    if (points === was) return;
    dirty = true;
    // (as 'cup', not 'points': what this hears is 'points', and it mustn’t hear itself)
    tell('cup', { house: e.house, delta: e.delta, why: e.why ?? null, totals: totals(points, term.week) });
  }
  function weeks(r) {
    if (!r.events.length && r.term === term) return;
    term = r.term;
    dirty = true;
    for (const ev of r.events) {
      if (ev.type !== 'week') continue;
      toast(WEEK_LINE(ev.week));
      tell('week', { week: term.week });
    }
    quest({ type: 'week', week: term.week });
  }

  function hear(type, data = {}) {
    const e = data && typeof data === 'object' ? data : {};
    switch (type) {
      case 'points':
        // (whatever house the teller had in mind when it was made: every point the
        // world gives or takes is for something you did, so it’s your house’s,
        // and a lesson begun before the Sorting pays the house the Hat chose)
        score({ type: 'points', ...e, house: e.rival && HOUSES[e.house] ? e.house : house });
        break;
      case 'room':
        // (the rooms’ host says which room you’re in; the quests read it as a room gone into)
        if (e.id) quest({ type: 'enter', room: e.id });
        break;
      case 'lesson':
        if (e.done === false) break;
        quest({ type: 'lesson', id: e.id, done: true });
        weeks(termOn(term, { type: 'lesson-done', day: e.day ?? (seen >= 0 ? seen : term.began) }));
        break;
      case 'result':
        if (e.caught === 'you' || e.caught === 'us') tell('achievement', { id: 'hp-snitch' });
        break;
      case 'house':
        if (HOUSES[e.house] && e.house !== house) {
          house = e.house;
          points = { ...points, house };
          dirty = true;
        }
        break;
      case 'sorted':
        if (HOUSES[e.house]) {
          house = e.house;
          points = { ...points, house };
        }
        quest({ type: 'sorted', house });
        tell('achievement', { id: 'hp-sorted' });
        break;
      case 'learnt':
        if (e.spell && !learnt.includes(e.spell)) learnt = [...learnt, e.spell];
        quest({ type: 'learnt', spell: e.spell });
        break;
      case 'driven':
        quest({ type: 'driven' });
        tell('achievement', { id: 'hp-patronus' });
        break;
      case 'pickup':
        if (e.id === 'cloak') cloak = true;
        if (e.card) {
          const r = find(cards, e.card);
          cards = r.found;
          if (r.fresh) tell('card', { id: e.card });
        }
        quest({ type: 'pickup', id: e.id });
        break;
      case 'caught':
        quest({ type: 'caught' });
        break;
      case 'enter':
      case 'restricted':
      case 'book':
      case 'willow':
      case 'frozen':
      case 'butterbeer':
      case 'sweet':
        quest({ type, ...e });
        break;
      default:
        return;
    }
    if (dirty) {
      keep();
      refresh();
    }
  }

  return {
    hear,
    // the world’s clock, in world hours: the week moves on every three days
    step(dt, t) {
      const d = Math.floor(t / 24);
      if (d !== seen) {
        seen = d;
        weeks(termOn(term, { type: 'day', day: d }));
        if (dirty) {
          keep();
          refresh();
        }
      }
      // (the cloak comes at Christmas if it hasn’t been found before: a parcel, and no name on the note)
      if (!cloak && term.week >= TERM.christmas) {
        toast(PARCEL);
        hear('pickup', { id: 'cloak' });
      }
    },
    sleep(d) {
      weeks(termOn(term, { type: 'sleep', day: d }));
      keep();
      refresh();
    },
    // the leaving feast held: the Cup is given (quest 13), and next year can begin
    feast() {
      if (!isLeaving(term.week)) return null;
      const t = totals(points, term.week);
      const won = winner(points, term.week);
      if (!feasted) {
        feasted = true;
        term = termOn(term, { type: 'feast' }).term;
        dirty = true;
        quest({ type: 'feast' });
        keep();
        refresh();
      }
      return { winner: won, totals: t, standings: standings(points, term.week), mine: points.own[house], house };
    },
    // the week for this visit only (the development hook’s term(week)), not written
    setWeek(w) {
      forced = Math.min(TERM.weeks, Math.max(1, Math.round(w)));
      term = { ...term, week: forced };
      refresh();
    },
    nextYear(d) {
      if (!feasted) return;
      term = termOn(term, { type: 'year', day: d }).term;
      points = newPoints({ house, year: term.year });
      quests = { ...quests, cup: { step: 0, got: [], done: false } };
      feasted = false;
      keep();
      refresh();
    },
    view() {
      if (!view) refresh();
      return view;
    },
    knows: (spell) => learnt.includes(spell),
    get learnt() {
      return learnt;
    },
    get cloak() {
      return cloak;
    },
    get cards() {
      return cards;
    },
    get house() {
      return house;
    },
    get week() {
      return term.week;
    },
  };
}
