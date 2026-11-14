// A long piece of work done in one go (a world made all at once), broken up
// so the page gets a turn: a click, a key, React's commit for it, a frame.
// The work awaits breathe() between its parts; while the part so far is
// under `budget` ms that's a promise kept at once (no gap at all), and once
// it's over, a promise kept after a task's gap, which whatever was waiting
// (the click) goes in. A timer's task, not scheduler.yield: a yield's
// continuation goes ahead of the page's other tasks, React's commit among
// them (decisions/2026-10-12-the-page-gets-a-turn-between-shader-builds.md).
//
// breather(budget = 12, { now, gap }) → breathe() → Promise (now and gap passed in for a test)

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const task = (fn) => setTimeout(fn, 0);

export function breather(budget = 12, { now = clock, gap = task } = {}) {
  let since = now();
  return () => {
    if (now() - since < budget) return Promise.resolve();
    return new Promise((resolve) =>
      gap(() => {
        since = now();
        resolve();
      }),
    );
  };
}
