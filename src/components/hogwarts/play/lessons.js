// The lessons (the design’s §4.7): each a small game whose rules are a
// file under rules/ with a bot that wins it, drawn here where it is held:
// the flying lesson on the lawn (play/lessons/flying.js), and the classes
// the rooms’ lane gives a place to (Charms, Potions, Herbology, Buckbeak,
// the duelling club, the boggart: play/lessons/*.js). One lesson runs at a
// time; while it runs it has the E key and says what to do next on the
// HUD’s objective line, its teacher’s words in the kit’s Bubble.
//
//   LESSONS → { [id]: { name, quest, where, load } }: `quest` the design’s
//     number, `where` the place or room it belongs to (rules/places.js,
//     rooms/index.js), `load` the lesson’s module
//   createLessons(ctx) → { start(id, at), stop(), step(dt, input, pad, world)
//     → whether it has the keys, act(down), active, state(), dispose() }
//   ctx: { rt, scene, camera, house, houseName, wand, broom, walker, floorAt,
//     tell, said, cards, figure } (`figure(name, { height })`: a person of the
//     cast to stand there, the rooms’ lane’s cast/figures.js; null draws
//     nobody, and the lines are still said where they would stand)
//   `at`: { p: [x, y, z], yaw } where the lesson is held (the walk’s yaw:
//     the way you face as you stand at its start)
//
// What it tells the page and the term (`tell(type, data)`): 'objective' {
// id, text } for the objective line (text null when it ends), 'toast' {
// text }, and when one is done 'lesson' { type: 'lesson', id, quest, done:
// true } and 'points'
// { type: 'points', house, delta, why: id } for what it is worth (a melted
// cauldron or a burnt feather, a negative delta with its why).

export const LESSONS = {
  flying: { name: 'The flying lesson', quest: 2, where: 'lawn', load: () => import('./lessons/flying.js') },
};

export function createLessons(ctx) {
  let active = null; // { id, lesson (the module’s instance) }
  let loading = 0;
  const tell = ctx.tell ?? (() => {});

  // the lesson’s own events go out as the page’s and the term’s
  const out = {
    ...ctx,
    objective: (text) => tell('objective', { id: active?.id ?? null, text }),
    toast: (text) => text && tell('toast', { text }),
    points: (delta, why) => delta && tell('points', { type: 'points', house: ctx.houseName, delta, why }),
    done(extra = {}) {
      const id = active?.id;
      if (!id) return;
      tell('lesson', { type: 'lesson', id, quest: LESSONS[id].quest, done: true, ...extra });
    },
  };

  function stop() {
    if (!active) return;
    active.lesson.dispose?.();
    active = null;
    ctx.said?.clear?.();
    tell('objective', { id: null, text: null });
  }

  async function start(id, at) {
    const row = LESSONS[id];
    if (!row) throw new Error(`lessons: no lesson '${id}'`);
    stop();
    const mine = ++loading;
    const mod = await row.load();
    if (mine !== loading) return null;
    const lesson = (mod.default ?? mod).create(out, at);
    active = { id, lesson };
    return lesson;
  }

  return {
    start,
    stop,
    step(dt, input, pad, world = {}) {
      if (!active) return false;
      const r = active.lesson.step(dt, input, pad, world);
      if (active?.lesson.over) {
        const ended = active.lesson;
        active = null;
        ended.dispose?.();
        tell('objective', { id: null, text: null });
      }
      return Boolean(r);
    },
    act(down = true) {
      return active ? Boolean(active.lesson.act?.(down)) : false;
    },
    get active() {
      return active?.id ?? null;
    },
    state: () => (active ? { id: active.id, ...(active.lesson.state?.() ?? {}) } : null),
    dispose: stop,
  };
}
