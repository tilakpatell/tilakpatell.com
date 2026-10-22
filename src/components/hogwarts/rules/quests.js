// The thirteen things to do in a term (the design’s §4.7), as data and one
// machine: each quest a row `{ id, n, title, where, steps, points, needs }`
// and `advance(state, event)` moving it on. A quest moves only on the
// events its own step is waiting for (a lesson’s end, a room gone into, a
// thing picked up, the dementors driven off): nothing else touches it, and
// a quest that isn’t open yet (its `needs` not met: a quest before it, or a
// week of the term) doesn’t move at all. A step can count (three sweets),
// and a step can be undone (caught on the way back from the Restricted
// Section, you go back to getting there). Pure.
//
// The events read: the lessons’ `{ type: 'lesson', id, done }` (Lane E’s;
// ‘lesson-done’ the same), `{ type: 'points' … }` (not here: rules/points.js),
// the Sorting’s `{ type: 'sorted', house }`, a room gone into `{ type:
// 'enter', room }`, a thing taken `{ type: 'pickup', id }`, the Willow
// stilled `{ type: 'willow', frozen }`, and this lane’s own: `{ type:
// 'restricted' }` (the Restricted Section reached after curfew), `{ type:
// 'book', quiet }` (the roped book read), `{ type: 'caught' }`, `{ type:
// 'learnt', spell }`, `{ type: 'driven' }`, `{ type: 'butterbeer' }`, `{
// type: 'sweet', id }`, `{ type: 'feast' }`, `{ type: 'week', week }`.
//
//   QUESTS: [{ id, n, title, where, place, blurb, steps: [{ id, text, count? }], points, paid, needs: { quests, sorted, week } }]
//     needs.sorted: open once you’re sorted, the common room found or not (the
//     lessons don’t wait on a password)
//     paid: 'quest' (this machine gives the points when it’s done) or 'lesson' (the lesson gives its own)
//   questById(id)
//   newQuests() → { [id]: { step, got, done } }
//   isOpen(state, quest, ctx) → its needs are met; ctx: { house, week }
//   advance(state, event, ctx) → { state, events }: events { type: 'quest', id, step, done, text }
//     and, for a quest this machine pays, { type: 'points', house, delta, why }
//   objectiveOf(state, ctx) → { id, text } the next thing to do, or null
//   listFor(state, ctx) → rows for the kit’s QuestList: { id, name, where, blurb, done, open, locked }
//   doneCount(state) → how many are done
//   COMMON: { house: the common room’s room id }

export const COMMON = { gryffindor: 'gryffindor', hufflepuff: 'hufflepuff', ravenclaw: 'ravenclaw', slytherin: 'slytherin' };
// (a common room by its house’s id, or by a ‘common-’ name, whichever the rooms are registered under)
const isCommon = (room, house) => Boolean(room) && (room === COMMON[house] || room === `common-${house}` || room === `common/${house}`);
const isLesson = (e, id) => (e.type === 'lesson' || e.type === 'lesson-done') && e.id === id && e.done !== false;

const step = (id, text, on, more = {}) => ({ id, text, on, ...more });

export const QUESTS = [
  {
    id: 'sorting',
    n: 1,
    title: 'The Sorting',
    where: 'The Great Hall',
    place: 'great-hall',
    blurb: 'Be sorted, then find your common room with the password you were given.',
    steps: [step('sorted', 'Be sorted', (e) => e.type === 'sorted'), step('common', 'Find your common room', (e, c) => e.type === 'enter' && isCommon(e.room, c.house))],
    points: 10,
    paid: 'quest',
    needs: { quests: [], week: 1 },
  },
  { id: 'flying', n: 2, title: 'Up!', where: 'The lawn', place: 'lawn', blurb: 'The flying lesson with Madam Hooch: call the broom up and fly the three rings.', steps: [step('lesson', 'Fly the rings round the lawn', (e) => isLesson(e, 'flying'))], points: 10, paid: 'lesson', needs: { quests: [], sorted: true, week: 1 } },
  { id: 'feather', n: 3, title: 'The feather', where: 'The Charms classroom', place: 'charms', blurb: 'Wingardium Leviosa on your feather, all the way to the ceiling.', steps: [step('lesson', 'Float your feather to the ceiling', (e) => isLesson(e, 'charms'))], points: 10, paid: 'lesson', needs: { quests: [], sorted: true, week: 1 } },
  { id: 'potion', n: 4, title: 'A potion', where: 'The Potions dungeon', place: 'potions', blurb: 'A Cure for Boils from the board, in the right order, without melting the cauldron.', steps: [step('lesson', 'Brew a Cure for Boils', (e) => isLesson(e, 'potions'))], points: 10, paid: 'lesson', needs: { quests: [], sorted: true, week: 1 } },
  { id: 'mandrakes', n: 5, title: 'Mandrakes', where: 'The greenhouses', place: 'greenhouses', blurb: 'Earmuffs on, and four Mandrakes repotted before their crying gets through.', steps: [step('lesson', 'Repot four Mandrakes', (e) => isLesson(e, 'herbology'))], points: 10, paid: 'lesson', needs: { quests: [], sorted: true, week: 2 } },
  { id: 'buckbeak', n: 6, title: 'Buckbeak', where: 'The paddock', place: 'paddock', blurb: 'Bow to the Hippogriff and wait for him to bow back. Then hold on.', steps: [step('lesson', 'Bow to Buckbeak, and ride', (e) => isLesson(e, 'buckbeak'))], points: 10, paid: 'lesson', needs: { quests: [], sorted: true, week: 3 } },
  {
    id: 'willow',
    n: 7,
    title: 'The Willow’s knot',
    where: 'The Whomping Willow',
    place: 'willow',
    blurb: 'A library book is caught in the Willow. Still it with a stone on its knot and fetch the book back.',
    steps: [
      step('freeze', 'Drop a stone on the Willow’s knot', (e) => (e.type === 'willow' && e.frozen) || (e.type === 'frozen' && e.id === 'willow')),
      step('book', 'Take the book from under its roots', (e) => e.type === 'pickup' && e.id === 'willow-book'),
      step('return', 'Give it back to the library', (e) => e.type === 'enter' && e.room === 'library'),
    ],
    points: 15,
    paid: 'quest',
    needs: { quests: ['feather'], week: 2 },
  },
  { id: 'duel', n: 8, title: 'The duelling club', where: 'The Defence classroom', place: 'defence', blurb: 'Three rounds against Malfoy on the platform. Protego on the beat.', steps: [step('lesson', 'Win the duel against Malfoy', (e) => isLesson(e, 'duel'))], points: 20, paid: 'lesson', needs: { quests: [], sorted: true, week: 3 } },
  { id: 'boggart', n: 9, title: 'The boggart', where: 'The Defence classroom', place: 'defence', blurb: 'Whatever comes out of the wardrobe, find the joke that makes it ridiculous.', steps: [step('lesson', 'Laugh the boggart back into the wardrobe', (e) => isLesson(e, 'boggart'))], points: 10, paid: 'lesson', needs: { quests: [], sorted: true, week: 4 } },
  {
    id: 'night',
    n: 10,
    title: 'After hours',
    where: 'The Restricted Section',
    place: 'restricted',
    blurb: 'Find the cloak, then the Restricted Section after curfew, read the roped book and get back to bed unseen.',
    steps: [
      step('cloak', 'Find the cloak in the room of hidden things', (e) => e.type === 'pickup' && e.id === 'cloak'),
      step('restricted', 'Reach the Restricted Section after curfew', (e) => e.type === 'restricted'),
      step('book', 'Read the roped book without waking it', (e) => (e.type === 'book' && e.quiet ? true : e.type === 'caught' ? 'back' : false)),
      step('back', 'Back to your common room unseen', (e, c) => (e.type === 'enter' && isCommon(e.room, c.house) ? true : e.type === 'caught' ? 'back' : false)),
    ],
    // (caught on the way: back to reaching the Restricted Section)
    backTo: 'restricted',
    points: 20,
    paid: 'quest',
    needs: { quests: [], sorted: true, week: 2 },
  },
  {
    id: 'patronus',
    n: 11,
    title: 'The Patronus',
    where: 'The shore of the Black Lake',
    place: 'shore',
    blurb: 'Learn Expecto Patronum on a boggart in the Defence classroom, then drive the dementors off the shore by night.',
    steps: [step('learn', 'Learn Expecto Patronum in the Defence classroom', (e) => e.type === 'learnt' && e.spell === 'patronus'), step('shore', 'Drive the dementors off the shore at night', (e) => e.type === 'driven')],
    points: 30,
    paid: 'quest',
    needs: { quests: ['boggart'], week: 7 },
  },
  {
    id: 'hogsmeade',
    n: 12,
    title: 'Hogsmeade weekend',
    where: 'Hogsmeade',
    place: 'hogsmeade',
    blurb: 'Up the road to the village: a butterbeer, three sweets from Honeydukes, and a look at the Shrieking Shack by the tunnel.',
    any: true,
    steps: [
      step('butterbeer', 'A butterbeer at the Three Broomsticks', (e) => e.type === 'butterbeer'),
      step('sweets', 'Find the three sweets at Honeydukes', (e) => (e.type === 'sweet' ? e.id : false), { count: 3 }),
      step('shack', 'The Shrieking Shack, by the tunnel under the Willow', (e) => e.type === 'enter' && e.room === 'shack'),
    ],
    points: 15,
    paid: 'quest',
    needs: { quests: [], sorted: true, week: 3 },
  },
  { id: 'cup', n: 13, title: 'The House Cup', where: 'The Great Hall', place: 'great-hall', blurb: 'When the term is out, the leaving feast: the hourglasses settle and the hall takes the winner’s colours.', steps: [step('feast', 'Be at the leaving feast', (e) => e.type === 'feast')], points: 0, paid: 'quest', needs: { quests: [], week: 12 } },
];

const BY_ID = new Map(QUESTS.map((q) => [q.id, q]));
export const questById = (id) => BY_ID.get(id) ?? null;

export const newQuests = () => Object.fromEntries(QUESTS.map((q) => [q.id, { step: 0, got: [], done: false }]));

const of = (state, id) => state?.[id] ?? { step: 0, got: [], done: false };

const isSorted = (state) => of(state, 'sorting').done || of(state, 'sorting').step >= 1;

export function isOpen(state, quest, ctx = {}) {
  if ((ctx.week ?? 1) < (quest.needs.week ?? 1)) return false;
  if (quest.needs.sorted && !isSorted(state)) return false;
  return quest.needs.quests.every((id) => of(state, id).done);
}

// a quest whose steps go in any order: the steps it has done, kept as `got`
// (‘step:key’ for a counting step’s keys)
function anyOrder(q, s, e, ctx) {
  const got = new Set(s.got);
  let moved = false;
  for (const st of q.steps) {
    if (got.has(st.id)) continue;
    const r = st.on(e, ctx);
    if (!r) continue;
    if (st.count) {
      const key = `${st.id}:${r}`;
      if (got.has(key)) continue;
      got.add(key);
      moved = true;
      if ([...got].filter((k) => k.startsWith(`${st.id}:`)).length >= st.count) got.add(st.id);
    } else {
      got.add(st.id);
      moved = true;
    }
  }
  if (!moved) return null;
  const doneSteps = q.steps.filter((st) => got.has(st.id)).length;
  return { step: doneSteps, got: [...got], done: doneSteps === q.steps.length };
}

function inOrder(q, s, e, ctx) {
  const st = q.steps[s.step];
  if (!st) return null;
  const r = st.on(e, ctx);
  if (r === 'back') {
    const to = Math.max(0, q.steps.findIndex((x) => x.id === q.backTo));
    return s.step === to ? null : { step: to, got: [], done: false, back: true };
  }
  if (!r) return null;
  if (st.count) {
    const got = new Set(s.got);
    if (got.has(r)) return null;
    got.add(r);
    if (got.size < st.count) return { ...s, got: [...got] };
  }
  const next = s.step + 1;
  return { step: next, got: [], done: next >= q.steps.length };
}

export function advance(state, event, ctx = {}) {
  const out = { ...state };
  const events = [];
  if (!event?.type) return { state: out, events };
  for (const q of QUESTS) {
    const s = of(state, q.id);
    if (s.done || !isOpen(state, q, ctx)) continue;
    const r = q.any ? anyOrder(q, s, event, ctx) : inOrder(q, s, event, ctx);
    if (!r) continue;
    out[q.id] = { step: r.step, got: r.got, done: r.done };
    const text = r.done ? null : (q.steps[r.step]?.text ?? null);
    events.push({ type: 'quest', id: q.id, step: r.step, done: r.done, back: Boolean(r.back), text });
    if (r.done && q.paid === 'quest' && q.points) events.push({ type: 'points', house: ctx.house, delta: q.points, why: q.id });
  }
  return { state: out, events };
}

export const doneCount = (state) => QUESTS.filter((q) => of(state, q.id).done).length;

// the next thing to do: the first open quest not done, its step’s words
export function objectiveOf(state, ctx = {}) {
  for (const q of QUESTS) {
    const s = of(state, q.id);
    if (s.done || !isOpen(state, q, ctx)) continue;
    const st = q.any ? q.steps.find((x) => !s.got.includes(x.id)) : q.steps[s.step];
    if (!st) continue;
    const counted = st.count ? s.got.filter((k) => (q.any ? k.startsWith(`${st.id}:`) : true)).length : 0;
    return { id: q.id, text: st.count && counted ? `${st.text} (${counted} of ${st.count})` : st.text };
  }
  return null;
}

// the rows for the kit’s QuestList (and the notice board): what each is, where,
// done or open, and what a locked one waits on
export function listFor(state, ctx = {}) {
  return QUESTS.map((q) => {
    const s = of(state, q.id);
    const open = isOpen(state, q, ctx);
    const before = q.needs.quests.filter((id) => !of(state, id).done).map((id) => `“${questById(id).title}”`);
    const waits = (ctx.week ?? 1) < (q.needs.week ?? 1) ? `From week ${q.needs.week}` : q.needs.sorted && !isSorted(state) ? 'Once you’re sorted' : `After ${before.join(' and ')}`;
    return { id: q.id, name: `${q.n}. ${q.title}`, where: q.where, blurb: q.blurb, done: s.done, open: open && !s.done, locked: open ? null : waits };
  });
}
