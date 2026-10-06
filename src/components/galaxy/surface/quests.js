// Things to do on a world: its quests, each a few steps, and how far along
// you are in one. Pure (the scene feeds it what happens, it says what
// that does), so it's tested.
//
// A quest: { id, name, about, giver?: an actor's id (talk to them to take
// it on), place?: a place's id (find it and it starts), intro?: lines
// ([who, text]) said as it starts, steps: [step…], done?: lines said at
// the end }. A step: { type, text, … }:
//   reach    at: [x, z], r — get there (on foot or riding)
//   talk     actor — talk to them (an actor's id)
//   collect  item, n, spots: [[x, z]…] — pick up n of them (walk over them)
//   shoot    tag, n — bring down n of what's tagged so (the scene puts them
//            out: targets, creatures, troopers)
//   ride     kind — get on one (rides.js's kind)
//   race     gates: [[x, z]…], r, time, ride? — through each gate in turn
//            before the time's up (riding `ride` if it says)
//   use      id, at: [x, z], r, prompt — press E there
//   enter    zone — go in (a zone's id: the cantina, the palace)
//   trip     tag, n — bring down n walkers (circle one with a tow cable)
// and any step can have `time` (seconds: fail if it takes longer) and
// `lines` (said as it starts).
//
// Progress: { id, step, count, time } (null: none on). feed(progress,
// quest, event) → { progress, out } (out: [{ type: 'step', step } | {
// type: 'count', count, of } | { type: 'done' } | { type: 'fail', why }]).
// Events: { type: 'at', x, z } (where you are, each step of the clock), {
// type: 'talk', actor }, { type: 'pickup', item }, { type: 'kill', tag }, {
// type: 'mount', kind }, { type: 'gate', i }, { type: 'use', id }, { type:
// 'enter', zone }, { type: 'trip', tag }, { type: 'tick', dt }.

export const STEP_TYPES = ['reach', 'talk', 'collect', 'shoot', 'ride', 'race', 'use', 'enter', 'trip'];

export const start = (quest) => ({ id: quest.id, step: 0, count: 0, time: 0 });

const of = (step) => (step.type === 'race' ? step.gates.length : (step.n ?? 1));

// on to the next step (or the end)
function next(p, quest, out) {
  const step = p.step + 1;
  if (step >= quest.steps.length) {
    out.push({ type: 'done' });
    return null;
  }
  out.push({ type: 'step', step });
  return { ...p, step, count: 0, time: 0 };
}

export function feed(progress, quest, ev) {
  const out = [];
  if (!progress || !quest || progress.id !== quest.id) return { progress, out };
  const step = quest.steps[progress.step];
  if (!step) return { progress: null, out };
  let p = progress;
  const counted = (n = 1) => {
    p = { ...p, count: p.count + n };
    if (p.count >= of(step)) p = next(p, quest, out);
    else out.push({ type: 'count', count: p.count, of: of(step) });
  };
  switch (ev.type) {
    case 'tick':
      p = { ...p, time: p.time + ev.dt };
      if (step.time && p.time > step.time) {
        out.push({ type: 'fail', why: 'time' });
        p = { ...p, count: 0, time: 0 };
      }
      break;
    case 'at':
      if (step.type === 'reach' && Math.hypot(ev.x - step.at[0], ev.z - step.at[1]) <= (step.r ?? 6)) p = next(p, quest, out);
      else if (step.type === 'race') {
        const g = step.gates[p.count];
        if (g && Math.hypot(ev.x - g[0], ev.z - g[1]) <= (step.r ?? 8) && (!step.ride || ev.riding === step.ride)) counted();
      }
      break;
    case 'talk':
      if (step.type === 'talk' && ev.actor === step.actor) p = next(p, quest, out);
      break;
    case 'pickup':
      if (step.type === 'collect' && ev.item === step.item) counted();
      break;
    case 'kill':
      if (step.type === 'shoot' && ev.tag === step.tag) counted();
      break;
    case 'trip':
      if (step.type === 'trip' && ev.tag === step.tag) counted();
      break;
    case 'mount':
      if (step.type === 'ride' && ev.kind === step.kind) p = next(p, quest, out);
      break;
    case 'use':
      if (step.type === 'use' && ev.id === step.id) p = next(p, quest, out);
      break;
    case 'enter':
      if (step.type === 'enter' && ev.zone === step.zone) p = next(p, quest, out);
      break;
    default:
  }
  return { progress: p, out };
}

// what the tracker says for a step: its text, with the count where there is one
export function stepText(quest, progress) {
  const step = quest?.steps[progress?.step];
  if (!step) return '';
  const n = of(step);
  return n > 1 ? `${step.text} (${progress.count}/${n})` : step.text;
}

// where a step wants you (for its marker and the compass), or null
export function stepTarget(step, progress, actors = null) {
  if (!step) return null;
  if (step.type === 'reach' || step.type === 'use') return step.at;
  if (step.type === 'race') return step.gates[progress?.count ?? 0] ?? null;
  if (step.type === 'talk' && actors) return actors(step.actor);
  if (step.at) return step.at;
  return null;
}

// Someone's quests (a life spec's `quest`: one id, or a list of them, given
// in turn), and the one they offer now: the first not done, or null
export const questsOf = (spec) => [spec?.quest ?? []].flat();
export const nextQuest = (spec, done) => questsOf(spec).find((id) => !done.has(id)) ?? null;
