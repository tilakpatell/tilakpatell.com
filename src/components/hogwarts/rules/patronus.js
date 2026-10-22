// Learning the Patronus (quest 11’s first step, the design’s §4.7): the
// boggart in the wardrobe comes out as a dementor and drifts at you, and
// Expecto Patronum is tried on it until it takes. The first tries are a
// silver mist that only holds it back a moment; the third is a Patronus,
// and the boggart goes back in the wardrobe with the door banging. If it
// reaches you first, everything goes grey: you come round on the floor
// with it back in the wardrobe and your tries kept. Pure.
//
//   PATRONUS: { tries, start (m it comes out to), near (m it reaches you at), pace, hold (s a mist holds it) }
//   newLesson() → { tries, at (m off), held (s), learnt, out (gone in again), downs }
//   tryCast(lesson) → { lesson, says, learnt }: one Expecto Patronum; `learnt` on the try that takes
//   drift(lesson, dt) → { lesson, events }: it comes on unless held; { type: 'down' } when it reaches you
//   LINES: what is said at each try and when you go down (the site’s own words)

export const PATRONUS = { tries: 3, start: 5.2, near: 1.2, pace: 0.35, hold: 3, back: 1.1 };

export const LINES = {
  tries: ['A mist is a start. Think of the happiest thing you know, and hold on to it.', 'Better. Not the happiest thing you remember: the happiest thing you feel.', 'That’s a Patronus. Now you know you can.'],
  down: 'Everything went grey and cold, and then you were on the floor with the wardrobe shut.',
  begin: 'The wardrobe rattles. What comes out of it is tall and hooded and very cold.',
};

export const newLesson = () => ({ tries: 0, at: PATRONUS.start, held: 0, learnt: false, out: false, downs: 0 });

export function tryCast(lesson) {
  if (lesson.learnt) return { lesson, says: null, learnt: false };
  const tries = lesson.tries + 1;
  const says = LINES.tries[Math.min(tries, PATRONUS.tries) - 1];
  if (tries >= PATRONUS.tries) return { lesson: { ...lesson, tries, learnt: true, out: true, held: 0 }, says, learnt: true };
  // (a mist: it stops, and the second one pushes it back a little)
  const at = Math.min(PATRONUS.start, lesson.at + (tries > 1 ? PATRONUS.back : 0));
  return { lesson: { ...lesson, tries, at, held: PATRONUS.hold * (tries > 1 ? 1.4 : 1) }, says, learnt: false };
}

export function drift(lesson, dt) {
  if (lesson.learnt || lesson.out) return { lesson, events: [] };
  if (lesson.held > 0) return { lesson: { ...lesson, held: Math.max(0, lesson.held - dt) }, events: [] };
  const at = lesson.at - PATRONUS.pace * dt;
  if (at > PATRONUS.near) return { lesson: { ...lesson, at }, events: [] };
  // (it reached you: you go down, and it’s back in the wardrobe to come out again)
  return { lesson: { ...lesson, at: PATRONUS.start, held: PATRONUS.hold, downs: lesson.downs + 1 }, events: [{ type: 'down', says: LINES.down }] };
}
