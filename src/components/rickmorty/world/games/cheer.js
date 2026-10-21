// A place's crowd cheering its game won (the worlds spec's "the audience
// cheers when it closes"): from the step a place's game's task is done, its
// gatherings hop on a beat for a while. The first step of a visit only notes
// whether it's done, so a task done before the visit cheers nobody. Pure and
// import-free, stepped by the place's stage (../dimensions/stage.js), which
// starts it afresh whenever the place calms; tested in Node.
//
//   newCheer() → cheer
//   stepCheer(cheer, { done, t }) → cheer   `hop`: the crowd hops this step

export const CHEER = Object.freeze({
  s: 6, // seconds the cheer lasts
  beat: 0.5, // seconds between hops
});

export const newCheer = () => ({ seen: null, till: -1, next: 0, hop: false });

export function stepCheer(c, { done, t }) {
  if (c.seen === null) return { ...c, seen: done, hop: false };
  const n = { ...c, hop: false };
  if (!n.seen && done) Object.assign(n, { seen: true, till: t + CHEER.s, next: t });
  if (t <= n.till + 1e-9 && t >= n.next - 1e-9) Object.assign(n, { hop: true, next: t + CHEER.beat });
  return n;
}
